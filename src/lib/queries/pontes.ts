import { prisma } from "@/lib/db";
import { StatutPonte, StatutReproducteur, CauseEchecPonte } from "@/types";
import type {
  CreatePonteDTO,
  UpdatePonteDTO,
  PonteFilters,
  CreatePonteV2DTO,
  StrippingStepDTO,
  ResultatPonteDTO,
} from "@/types";
import {
  getLatenceTheoriqueH,
  estimerNombreOeufs,
} from "@/lib/reproduction/calculs";

export type {
  CreatePonteDTO,
  UpdatePonteDTO,
  PonteFilters,
  CreatePonteV2DTO,
  StrippingStepDTO,
  ResultatPonteDTO,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Genere le prochain code de ponte au format PONTE-YYYY-NNN pour un site.
 * Utilise findFirst+orderBy (meme pattern que numero-utils.ts) pour eviter
 * les race conditions en cas de requetes concurrentes.
 */
async function generatePonteCode(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  siteId: string
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PONTE-${year}-`;

  const last = await tx.ponte.findFirst({
    where: { siteId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let seq = 1;
  if (last) {
    const parts = last.code.split("-");
    // code = PONTE-YYYY-NNN => parts[2] = NNN
    seq = (parseInt(parts[2], 10) || 0) + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Queries — Lecture
// ---------------------------------------------------------------------------

/**
 * Liste les pontes d'un site avec filtres et pagination (ADR-044 §6.2).
 * Prend en charge : statut, femelleId, lotGeniteursFemellId, dateFrom, dateTo.
 */
export async function listPontes(
  siteId: string,
  params: {
    statut?: string;
    femelleId?: string;
    lotGeniteursFemellId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ data: unknown[]; total: number }> {
  const where: Record<string, unknown> = { siteId };

  if (params.statut) where.statut = params.statut;
  if (params.femelleId) where.femelleId = params.femelleId;
  if (params.lotGeniteursFemellId)
    where.lotGeniteursFemellId = params.lotGeniteursFemellId;

  if (params.dateFrom || params.dateTo) {
    where.datePonte = {
      ...(params.dateFrom && { gte: new Date(params.dateFrom) }),
      ...(params.dateTo && { lte: new Date(params.dateTo) }),
    };
  }

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.ponte.findMany({
      where,
      include: {
        femelle: { select: { id: true, code: true } },
        lotGeniteursFemelle: { select: { id: true, code: true } },
        _count: { select: { lots: true, incubations: true } },
      },
      orderBy: { datePonte: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.ponte.count({ where }),
  ]);

  return { data, total };
}

/** Liste les pontes d'un site avec filtres optionnels et pagination (API historique) */
export async function getPontes(
  siteId: string,
  filters?: PonteFilters,
  pagination?: { limit: number; offset: number }
) {
  const where: Record<string, unknown> = { siteId };

  if (filters?.statut) where.statut = filters.statut;
  if (filters?.femelleId) where.femelleId = filters.femelleId;
  if (filters?.search) {
    where.OR = [
      { code: { contains: filters.search, mode: "insensitive" } },
      { notes: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const limit = Math.min(pagination?.limit ?? 50, 200);
  const offset = pagination?.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.ponte.findMany({
      where,
      include: {
        femelle: { select: { id: true, code: true, sexe: true, poids: true } },
        male: { select: { id: true, code: true, sexe: true, poids: true } },
        _count: { select: { lots: true } },
      },
      orderBy: { datePonte: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.ponte.count({ where }),
  ]);

  return { data, total };
}

/**
 * Recupere une ponte par ID avec toutes ses relations :
 * femelle, male, lotGeniteurs, lots, incubations.
 * Verifie le siteId (R8).
 */
export async function getPonteById(id: string, siteId: string) {
  return prisma.ponte.findFirst({
    where: { id, siteId },
    include: {
      femelle: true,
      male: true,
      lotGeniteursFemelle: true,
      lotGeniteursMale: true,
      lots: {
        orderBy: { createdAt: "desc" },
        include: {
          bac: { select: { id: true, nom: true } },
          vagueDestination: { select: { id: true, code: true } },
        },
      },
      incubations: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          statut: true,
          dateDebutIncubation: true,
          nombreOeufsPlaces: true,
          nombreLarvesEcloses: true,
        },
      },
      _count: { select: { lots: true, incubations: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Queries — Creation (Etape 1 : injection)
// ---------------------------------------------------------------------------

/**
 * Cree une ponte — Etape 1 : selection des geniteurs et injection hormonale.
 *
 * Contraintes :
 * - Exactement un des deux champs doit etre fourni : femelleId XOR lotGeniteursFemellId
 * - La femelle (individuelle ou lot) doit avoir le statut ACTIF
 * - Le male si fourni doit aussi avoir le statut ACTIF
 * - Le code est auto-genere si absent (format PONTE-YYYY-NNN)
 * - La latence theorique est calculee si temperatureEauC est fourni
 *
 * R4 : operation atomique via transaction.
 * R8 : siteId verifie sur tous les reproducteurs.
 */
export async function createPonteV2(siteId: string, dto: CreatePonteV2DTO) {
  // Validation : exactement un des deux champs femelle
  const hasFemelleId = Boolean(dto.femelleId);
  const hasLotFemelle = Boolean(dto.lotGeniteursFemellId);

  if (hasFemelleId === hasLotFemelle) {
    throw new Error(
      "Exactement un des deux champs doit etre fourni : femelleId ou lotGeniteursFemellId (pas les deux, pas aucun)"
    );
  }

  return prisma.$transaction(async (tx) => {
    // --- Validation femelle individuelle ---
    if (dto.femelleId) {
      const femelle = await tx.reproducteur.findFirst({
        where: { id: dto.femelleId, siteId },
      });
      if (!femelle)
        throw new Error(
          "Femelle introuvable ou n'appartient pas a ce site"
        );
      if (femelle.statut !== StatutReproducteur.ACTIF) {
        throw new Error(
          "La femelle doit avoir le statut ACTIF pour creer une ponte"
        );
      }
    }

    // --- Validation lot femelles ---
    if (dto.lotGeniteursFemellId) {
      const lot = await tx.lotGeniteurs.findFirst({
        where: { id: dto.lotGeniteursFemellId, siteId },
      });
      if (!lot)
        throw new Error(
          "Lot de femelles introuvable ou n'appartient pas a ce site"
        );
      if (lot.statut !== StatutReproducteur.ACTIF) {
        throw new Error(
          "Le lot de femelles doit avoir le statut ACTIF pour creer une ponte"
        );
      }
    }

    // --- Validation male individuel (optionnel) ---
    if (dto.maleId) {
      const male = await tx.reproducteur.findFirst({
        where: { id: dto.maleId, siteId },
      });
      if (!male)
        throw new Error("Male introuvable ou n'appartient pas a ce site");
      if (male.statut !== StatutReproducteur.ACTIF) {
        throw new Error(
          "Le male doit avoir le statut ACTIF pour creer une ponte"
        );
      }
    }

    // --- Validation lot males (optionnel) ---
    if (dto.lotGeniteursMaleId) {
      const lotMale = await tx.lotGeniteurs.findFirst({
        where: { id: dto.lotGeniteursMaleId, siteId },
      });
      if (!lotMale)
        throw new Error(
          "Lot de males introuvable ou n'appartient pas a ce site"
        );
    }

    // --- Code auto-genere si absent ---
    const code = dto.code ?? (await generatePonteCode(tx, siteId));

    // Verifier unicite du code
    const existing = await tx.ponte.findFirst({ where: { code } });
    if (existing) {
      throw new Error(`Le code "${code}" est deja utilise`);
    }

    // --- Calcul de la latence theorique ---
    let latenceTheorique: number | null = null;
    if (dto.temperatureEauC !== undefined && dto.temperatureEauC !== null) {
      latenceTheorique = getLatenceTheoriqueH(dto.temperatureEauC);
    }

    // --- Gestion de femelleId obligatoire dans le schema Prisma ---
    // Le schema Prisma exige femelleId NOT NULL. Si on utilise la gestion par lot,
    // on cherche le premier reproducteur actif du site comme representant technique.
    // La vraie information est portee par lotGeniteursFemellId.
    let femelleId = dto.femelleId;
    if (!femelleId && dto.lotGeniteursFemellId) {
      const placeholder = await tx.reproducteur.findFirst({
        where: { siteId, statut: StatutReproducteur.ACTIF },
        orderBy: { code: "asc" },
        select: { id: true },
      });
      if (!placeholder) {
        throw new Error(
          "Aucun reproducteur actif trouve sur ce site. " +
            "Creez au moins un reproducteur ou utilisez femelleId directement."
        );
      }
      femelleId = placeholder.id;
    }

    // --- Creation de la ponte ---
    const ponte = await tx.ponte.create({
      data: {
        code,
        femelleId: femelleId!,
        maleId: dto.maleId ?? null,
        lotGeniteursFemellId: dto.lotGeniteursFemellId ?? null,
        lotGeniteursMaleId: dto.lotGeniteursMaleId ?? null,
        datePonte: dto.datePonte ? new Date(dto.datePonte) : new Date(),
        typeHormone: dto.typeHormone ?? null,
        doseHormone: dto.doseHormone ?? null,
        doseMgKg: dto.doseMgKg ?? null,
        coutHormone: dto.coutHormone ?? null,
        heureInjection: dto.heureInjection
          ? new Date(dto.heureInjection)
          : null,
        temperatureEauC: dto.temperatureEauC ?? null,
        latenceTheorique,
        statut: StatutPonte.EN_COURS,
        notes: dto.notes ?? null,
        siteId,
      },
      include: {
        femelle: { select: { id: true, code: true } },
        male: { select: { id: true, code: true } },
        lotGeniteursFemelle: { select: { id: true, code: true } },
      },
    });

    // --- R4 : Mettre a jour le reproducteur femelle atomiquement ---
    if (dto.femelleId) {
      await tx.reproducteur.update({
        where: { id: dto.femelleId },
        data: {
          nombrePontesTotal: { increment: 1 },
          dernierePonte: ponte.datePonte,
        },
      });
    }

    return ponte;
  });
}

/** Cree une ponte — API historique (workflow simple sans multi-etapes) */
export async function createPonte(siteId: string, data: CreatePonteDTO) {
  // Verifier unicite du code
  const existing = await prisma.ponte.findUnique({
    where: { code: data.code },
  });
  if (existing) {
    throw new Error(`Le code "${data.code}" est deja utilise`);
  }

  // Verifier que la femelle appartient au site et est active
  const femelle = await prisma.reproducteur.findFirst({
    where: { id: data.femelleId, siteId },
  });
  if (!femelle) {
    throw new Error("Femelle introuvable");
  }
  if (femelle.statut !== StatutReproducteur.ACTIF) {
    throw new Error(
      "La femelle doit avoir le statut ACTIF pour creer une ponte"
    );
  }

  // Verifier le male si fourni
  if (data.maleId) {
    const male = await prisma.reproducteur.findFirst({
      where: { id: data.maleId, siteId },
    });
    if (!male) {
      throw new Error("Male introuvable");
    }
    if (male.statut !== StatutReproducteur.ACTIF) {
      throw new Error(
        "Le male doit avoir le statut ACTIF pour creer une ponte"
      );
    }
  }

  return prisma.ponte.create({
    data: {
      code: data.code,
      femelleId: data.femelleId,
      maleId: data.maleId ?? null,
      datePonte: new Date(data.datePonte),
      nombreOeufs: data.nombreOeufs ?? null,
      tauxFecondation: data.tauxFecondation ?? null,
      notes: data.notes ?? null,
      siteId,
    },
    include: {
      femelle: { select: { id: true, code: true } },
      male: { select: { id: true, code: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Queries — Etapes du workflow (Etapes 2 et 3)
// ---------------------------------------------------------------------------

/**
 * Etape 2 : enregistrement des resultats du stripping.
 *
 * Met a jour heureStripping, poids des oeufs, qualite et infos male.
 * Si poidsOeufsPontesG est fourni et nombreOeufsEstime absent,
 * le systeme calcule automatiquement : Math.round(poids * 750).
 *
 * R4 : updateMany avec conditions.
 */
export async function updateStripping(
  id: string,
  siteId: string,
  dto: StrippingStepDTO
) {
  // Calculer nombreOeufsEstime si poidsOeufsPontesG est fourni et estimation absente
  let nombreOeufsEstime: number | undefined = dto.nombreOeufsEstime;
  if (
    nombreOeufsEstime === undefined &&
    dto.poidsOeufsPontesG !== undefined &&
    dto.poidsOeufsPontesG > 0
  ) {
    nombreOeufsEstime = estimerNombreOeufs(dto.poidsOeufsPontesG);
  }

  const result = await prisma.ponte.updateMany({
    where: { id, siteId },
    data: {
      heureStripping: new Date(dto.heureStripping),
      ...(dto.poidsOeufsPontesG !== undefined && {
        poidsOeufsPontesG: dto.poidsOeufsPontesG,
      }),
      ...(nombreOeufsEstime !== undefined && { nombreOeufsEstime }),
      ...(dto.qualiteOeufs !== undefined && { qualiteOeufs: dto.qualiteOeufs }),
      ...(dto.methodeMale !== undefined && { methodeMale: dto.methodeMale }),
      ...(dto.motiliteSperme !== undefined && {
        motiliteSperme: dto.motiliteSperme,
      }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    },
  });

  if (result.count === 0) {
    throw new Error("Ponte introuvable ou n'appartient pas a ce site");
  }

  return prisma.ponte.findFirst({
    where: { id, siteId },
    include: {
      femelle: { select: { id: true, code: true } },
      male: { select: { id: true, code: true } },
      _count: { select: { lots: true, incubations: true } },
    },
  });
}

/**
 * Etape 3 : enregistrement des resultats finaux.
 *
 * Met a jour tauxFecondation, tauxEclosion, nombreLarvesViables, coutTotal
 * et fait passer le statut a TERMINEE.
 *
 * R4 : updateMany avec conditions.
 */
export async function updateResultat(
  id: string,
  siteId: string,
  dto: ResultatPonteDTO
) {
  const result = await prisma.ponte.updateMany({
    where: { id, siteId },
    data: {
      ...(dto.tauxFecondation !== undefined && {
        tauxFecondation: dto.tauxFecondation,
      }),
      ...(dto.tauxEclosion !== undefined && {
        tauxEclosion: dto.tauxEclosion,
      }),
      ...(dto.nombreLarvesViables !== undefined && {
        nombreLarvesViables: dto.nombreLarvesViables,
      }),
      ...(dto.coutTotal !== undefined && { coutTotal: dto.coutTotal }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      statut: StatutPonte.TERMINEE,
    },
  });

  if (result.count === 0) {
    throw new Error("Ponte introuvable ou n'appartient pas a ce site");
  }

  return prisma.ponte.findFirst({
    where: { id, siteId },
    include: {
      femelle: { select: { id: true, code: true } },
      male: { select: { id: true, code: true } },
      _count: { select: { lots: true, incubations: true } },
    },
  });
}

/**
 * Marque une ponte comme echouee.
 *
 * Passe le statut a ECHOUEE et enregistre la cause d'echec.
 * R4 : updateMany avec conditions.
 */
export async function markEchec(
  id: string,
  siteId: string,
  data: { causeEchec: CauseEchecPonte; notes?: string }
) {
  const result = await prisma.ponte.updateMany({
    where: { id, siteId },
    data: {
      statut: StatutPonte.ECHOUEE,
      causeEchec: data.causeEchec,
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  if (result.count === 0) {
    throw new Error("Ponte introuvable ou n'appartient pas a ce site");
  }

  return prisma.ponte.findFirst({
    where: { id, siteId },
    include: {
      femelle: { select: { id: true, code: true } },
      _count: { select: { lots: true, incubations: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// Queries — Modification generique et Suppression
// ---------------------------------------------------------------------------

/** Met a jour une ponte (champs libres via UpdatePonteDTO) */
export async function updatePonte(
  id: string,
  siteId: string,
  data: UpdatePonteDTO
) {
  // Verifier unicite du code si modifie
  if (data.code !== undefined) {
    const existing = await prisma.ponte.findFirst({
      where: { code: data.code, NOT: { id } },
    });
    if (existing) {
      throw new Error(`Le code "${data.code}" est deja utilise`);
    }
  }

  const result = await prisma.ponte.updateMany({
    where: { id, siteId },
    data: {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.maleId !== undefined && { maleId: data.maleId }),
      ...(data.datePonte !== undefined && {
        datePonte: new Date(data.datePonte),
      }),
      ...(data.nombreOeufs !== undefined && { nombreOeufs: data.nombreOeufs }),
      ...(data.tauxFecondation !== undefined && {
        tauxFecondation: data.tauxFecondation,
      }),
      ...(data.statut !== undefined && { statut: data.statut }),
      ...(data.notes !== undefined && { notes: data.notes || null }),
    },
  });

  if (result.count === 0) {
    throw new Error("Ponte introuvable");
  }

  return prisma.ponte.findFirst({
    where: { id, siteId },
    include: {
      femelle: { select: { id: true, code: true } },
      male: { select: { id: true, code: true } },
      _count: { select: { lots: true } },
    },
  });
}

/**
 * Supprime une ponte.
 *
 * Interdit si la ponte a des incubations ou des lots d'alevins lies.
 * R8 : siteId verifie.
 */
export async function deletePonte(id: string, siteId: string) {
  const ponte = await prisma.ponte.findFirst({
    where: { id, siteId },
    include: { _count: { select: { lots: true, incubations: true } } },
  });

  if (!ponte) {
    throw new Error("Ponte introuvable");
  }

  if (ponte._count.lots > 0) {
    throw new Error(
      `Impossible de supprimer : cette ponte a ${ponte._count.lots} lot(s) d'alevins lie(s)`
    );
  }

  if (ponte._count.incubations > 0) {
    throw new Error(
      `Impossible de supprimer : cette ponte a ${ponte._count.incubations} incubation(s) liee(s)`
    );
  }

  await prisma.ponte.delete({ where: { id } });
}
