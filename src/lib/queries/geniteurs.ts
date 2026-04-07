/**
 * Queries — Module Reproduction : Géniteurs (LotGeniteurs + Reproducteur étendu)
 *
 * Ce fichier expose deux groupes de fonctions :
 *   1. LotGeniteurs  — gestion de lots de géniteurs (mode GROUPE, défaut)
 *   2. Reproducteur  — liste, lecture et mise à jour étendus (mode INDIVIDUEL)
 *
 * Règles respectées :
 *   R2  — Enums importés depuis @/types, jamais de strings brutes
 *   R4  — Opérations atomiques via updateMany avec conditions
 *   R8  — Toujours filtrer par siteId
 */

import { prisma } from "@/lib/db";
import {
  SexeReproducteur,
  StatutReproducteur,
  StatutPonte,
  ModeGestionGeniteur,
  GenerationGeniteur,
  SourcingGeniteur,
} from "@/types";
import type {
  CreateLotGeniteurDTO,
  UpdateLotGeniteurDTO,
  UpdateReproducteurDTO,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Génère le prochain code LotGeniteurs pour un site et un sexe donnés.
 * Format : LG-{F|M}-{NNN}  (ex: "LG-F-001", "LG-M-042")
 *
 * Utilise findFirst + orderBy desc pour éviter les race-conditions
 * (même pattern que generateNextNumero dans numero-utils.ts).
 */
async function generateLotCode(
  siteId: string,
  sexe: SexeReproducteur
): Promise<string> {
  const prefix = sexe === SexeReproducteur.FEMELLE ? "LG-F-" : "LG-M-";

  const last = await prisma.lotGeniteurs.findFirst({
    where: { siteId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let seq = 1;
  if (last) {
    // code = "LG-F-042" → parts[2] = "042"
    const parts = last.code.split("-");
    const parsed = parseInt(parts[2] ?? "0", 10);
    if (!isNaN(parsed)) seq = parsed + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// LotGeniteurs — mode GROUPE
// ---------------------------------------------------------------------------

/** Paramètres de filtrage / pagination pour listLotGeniteurs */
export interface LotGeniteursFilters {
  sexe?: SexeReproducteur;
  statut?: StatutReproducteur;
  bacId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Liste les lots de géniteurs d'un site avec filtres optionnels et pagination.
 *
 * Retourne { data, total } — total utile pour la pagination côté client.
 */
export async function listLotGeniteurs(
  siteId: string,
  params: LotGeniteursFilters = {}
) {
  const where: Record<string, unknown> = { siteId };

  if (params.sexe) where.sexe = params.sexe;
  if (params.statut) where.statut = params.statut;
  if (params.bacId) where.bacId = params.bacId;

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.lotGeniteurs.findMany({
      where,
      include: {
        bac: { select: { id: true, nom: true, volume: true } },
        _count: {
          select: {
            pontesAsFemelle: true,
            pontesAsMale: true,
          },
        },
      },
      orderBy: { code: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.lotGeniteurs.count({ where }),
  ]);

  return { data, total };
}

/**
 * Récupère un lot de géniteurs par ID (vérifie siteId) avec ses relations :
 * bac assigné et compteurs de pontes.
 */
export async function getLotGeniteursById(id: string, siteId: string) {
  return prisma.lotGeniteurs.findFirst({
    where: { id, siteId },
    include: {
      bac: { select: { id: true, nom: true, volume: true } },
      _count: {
        select: {
          pontesAsFemelle: true,
          pontesAsMale: true,
        },
      },
    },
  });
}

/**
 * Crée un nouveau lot de géniteurs.
 *
 * Si `dto.code` est omis, un code est généré automatiquement au format
 * LG-{F|M}-{NNN} (ex: "LG-F-001").
 */
export async function createLotGeniteurs(
  siteId: string,
  dto: CreateLotGeniteurDTO
) {
  // Résoudre le code : fourni ou auto-généré
  const code = dto.code ?? (await generateLotCode(siteId, dto.sexe));

  // Vérifier l'unicité du code (@@unique sur Prisma)
  const existing = await prisma.lotGeniteurs.findUnique({ where: { code } });
  if (existing) {
    throw new Error(`Le code "${code}" est déjà utilisé`);
  }

  return prisma.lotGeniteurs.create({
    data: {
      code,
      nom: dto.nom,
      sexe: dto.sexe,
      nombrePoissons: dto.nombrePoissons,
      poidsMoyenG: dto.poidsMoyenG ?? null,
      poidsMinG: dto.poidsMinG ?? null,
      poidsMaxG: dto.poidsMaxG ?? null,
      origine: dto.origine ?? null,
      sourcing: dto.sourcing ?? SourcingGeniteur.ACHAT_FERMIER,
      generation: dto.generation ?? GenerationGeniteur.INCONNUE,
      dateAcquisition: dto.dateAcquisition
        ? new Date(dto.dateAcquisition)
        : new Date(),
      nombreMalesDisponibles: dto.nombreMalesDisponibles ?? null,
      seuilAlerteMales: dto.seuilAlerteMales ?? null,
      dateRenouvellementGenetique: dto.dateRenouvellementGenetique
        ? new Date(dto.dateRenouvellementGenetique)
        : null,
      bacId: dto.bacId ?? null,
      statut: dto.statut ?? StatutReproducteur.ACTIF,
      notes: dto.notes ?? null,
      siteId,
    },
    include: {
      bac: { select: { id: true, nom: true, volume: true } },
      _count: {
        select: {
          pontesAsFemelle: true,
          pontesAsMale: true,
        },
      },
    },
  });
}

/**
 * Met à jour un lot de géniteurs (modification partielle).
 *
 * Utilise updateMany avec siteId pour garantir l'isolation multi-tenant (R4/R8).
 * Lance une erreur si le lot est introuvable (count === 0).
 */
export async function updateLotGeniteurs(
  id: string,
  siteId: string,
  dto: UpdateLotGeniteurDTO
) {
  const result = await prisma.lotGeniteurs.updateMany({
    where: { id, siteId },
    data: {
      ...(dto.nom !== undefined && { nom: dto.nom }),
      ...(dto.nombrePoissons !== undefined && {
        nombrePoissons: dto.nombrePoissons,
      }),
      ...(dto.poidsMoyenG !== undefined && { poidsMoyenG: dto.poidsMoyenG }),
      ...(dto.poidsMinG !== undefined && { poidsMinG: dto.poidsMinG }),
      ...(dto.poidsMaxG !== undefined && { poidsMaxG: dto.poidsMaxG }),
      ...(dto.origine !== undefined && { origine: dto.origine }),
      ...(dto.sourcing !== undefined && { sourcing: dto.sourcing }),
      ...(dto.generation !== undefined && { generation: dto.generation }),
      ...(dto.nombreMalesDisponibles !== undefined && {
        nombreMalesDisponibles: dto.nombreMalesDisponibles,
      }),
      ...(dto.seuilAlerteMales !== undefined && {
        seuilAlerteMales: dto.seuilAlerteMales,
      }),
      ...(dto.dateRenouvellementGenetique !== undefined && {
        dateRenouvellementGenetique: dto.dateRenouvellementGenetique
          ? new Date(dto.dateRenouvellementGenetique)
          : null,
      }),
      ...(dto.bacId !== undefined && { bacId: dto.bacId }),
      ...(dto.statut !== undefined && { statut: dto.statut }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    },
  });

  if (result.count === 0) {
    throw new Error("Lot de géniteurs introuvable");
  }

  return prisma.lotGeniteurs.findFirst({
    where: { id, siteId },
    include: {
      bac: { select: { id: true, nom: true, volume: true } },
      _count: {
        select: {
          pontesAsFemelle: true,
          pontesAsMale: true,
        },
      },
    },
  });
}

/**
 * Supprime un lot de géniteurs.
 *
 * Refuse la suppression si des pontes liées ne sont pas terminées ou échouées
 * (statut différent de TERMINEE ou ECHOUEE).
 */
export async function deleteLotGeniteurs(id: string, siteId: string) {
  const lot = await prisma.lotGeniteurs.findFirst({
    where: { id, siteId },
    include: {
      pontesAsFemelle: {
        where: {
          statut: { notIn: [StatutPonte.TERMINEE, StatutPonte.ECHOUEE] },
        },
        select: { id: true, statut: true },
      },
      pontesAsMale: {
        where: {
          statut: { notIn: [StatutPonte.TERMINEE, StatutPonte.ECHOUEE] },
        },
        select: { id: true, statut: true },
      },
    },
  });

  if (!lot) {
    throw new Error("Lot de géniteurs introuvable");
  }

  const pontesActives =
    lot.pontesAsFemelle.length + lot.pontesAsMale.length;

  if (pontesActives > 0) {
    throw new Error(
      `Impossible de supprimer : ce lot a ${pontesActives} ponte(s) active(s) liée(s). ` +
        `Clôturez ou marquez les pontes comme terminées avant de supprimer le lot.`
    );
  }

  await prisma.lotGeniteurs.delete({ where: { id } });
}

/**
 * Décrémente atomiquement `nombreMalesDisponibles` d'un lot de géniteurs MALE.
 *
 * R4 — Opération atomique : utilise updateMany avec condition sur la valeur
 * courante pour éviter les race-conditions (check-then-update interdit).
 *
 * Retourne le `nombreMalesDisponibles` mis à jour.
 * Lance une erreur si :
 *   - Le lot est introuvable ou n'appartient pas au site
 *   - Le sexe du lot n'est pas MALE
 *   - `nombreMalesDisponibles` est null (non initialisé)
 *   - Il n'y a pas assez de mâles disponibles
 */
export async function utiliserMale(
  id: string,
  siteId: string,
  nombreUtilises: number
): Promise<number> {
  // Vérification préliminaire du lot (sexe + nullabilité)
  const lot = await prisma.lotGeniteurs.findFirst({
    where: { id, siteId },
    select: { sexe: true, nombreMalesDisponibles: true },
  });

  if (!lot) {
    throw new Error("Lot de géniteurs introuvable");
  }

  if (lot.sexe !== SexeReproducteur.MALE) {
    throw new Error(
      "Ce lot n'est pas un lot de mâles : impossible d'utiliser des mâles"
    );
  }

  if (lot.nombreMalesDisponibles === null) {
    throw new Error(
      "Le nombre de mâles disponibles n'est pas initialisé pour ce lot"
    );
  }

  // R4 — Opération atomique : updateMany avec condition sur la valeur courante
  // La condition `nombreMalesDisponibles >= nombreUtilises` est évaluée
  // atomiquement par la base de données (pas de TOCTOU).
  const result = await prisma.lotGeniteurs.updateMany({
    where: {
      id,
      siteId,
      nombreMalesDisponibles: { gte: nombreUtilises },
    },
    data: {
      nombreMalesDisponibles: { decrement: nombreUtilises },
    },
  });

  if (result.count === 0) {
    // Le lot n'a pas été mis à jour : stock insuffisant
    throw new Error(
      `Stock insuffisant : le lot ne dispose que de ${lot.nombreMalesDisponibles} mâle(s) disponible(s) ` +
        `(demandé : ${nombreUtilises})`
    );
  }

  // Relire la valeur mise à jour
  const updated = await prisma.lotGeniteurs.findFirst({
    where: { id, siteId },
    select: { nombreMalesDisponibles: true },
  });

  return updated?.nombreMalesDisponibles ?? 0;
}

// ---------------------------------------------------------------------------
// Reproducteur étendu — mode INDIVIDUEL
// ---------------------------------------------------------------------------

/** Paramètres de filtrage / pagination pour listReproducteurs */
export interface ReproducteurExtFilters {
  sexe?: SexeReproducteur;
  statut?: StatutReproducteur;
  modeGestion?: ModeGestionGeniteur;
  limit?: number;
  offset?: number;
}

/**
 * Liste les reproducteurs (mode individuel) d'un site avec filtres optionnels
 * et pagination.
 *
 * Inclut les compteurs de pontes et le bac associé.
 */
export async function listReproducteurs(
  siteId: string,
  params: ReproducteurExtFilters = {}
) {
  const where: Record<string, unknown> = { siteId };

  if (params.sexe) where.sexe = params.sexe;
  if (params.statut) where.statut = params.statut;
  if (params.modeGestion) where.modeGestion = params.modeGestion;

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.reproducteur.findMany({
      where,
      include: {
        bac: { select: { id: true, nom: true, volume: true } },
        _count: {
          select: {
            pontesAsFemelle: true,
            pontesAsMale: true,
          },
        },
      },
      orderBy: { code: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.reproducteur.count({ where }),
  ]);

  return { data, total };
}

/**
 * Récupère un reproducteur par ID (vérifie siteId) avec ses pontes récentes
 * et les compteurs agrégés.
 */
export async function getReproducteurById(id: string, siteId: string) {
  return prisma.reproducteur.findFirst({
    where: { id, siteId },
    include: {
      bac: { select: { id: true, nom: true, volume: true } },
      pontesAsFemelle: {
        orderBy: { datePonte: "desc" },
        take: 10,
        include: {
          _count: { select: { lots: true } },
        },
      },
      pontesAsMale: {
        orderBy: { datePonte: "desc" },
        take: 10,
        include: {
          _count: { select: { lots: true } },
        },
      },
      _count: {
        select: {
          pontesAsFemelle: true,
          pontesAsMale: true,
        },
      },
    },
  });
}

/**
 * Met à jour un reproducteur (champs étendus R1-S4 + champs de base).
 *
 * Utilise updateMany avec siteId pour l'isolation multi-tenant (R4/R8).
 * Si `data.code` est fourni, vérifie l'unicité avant la mise à jour.
 *
 * Lance une erreur si le reproducteur est introuvable.
 */
export async function updateReproducteur(
  id: string,
  siteId: string,
  data: UpdateReproducteurDTO
) {
  // Vérifier l'unicité du code si on le modifie
  if (data.code !== undefined) {
    const conflict = await prisma.reproducteur.findFirst({
      where: { code: data.code, NOT: { id } },
      select: { id: true },
    });
    if (conflict) {
      throw new Error(`Le code "${data.code}" est déjà utilisé`);
    }
  }

  const result = await prisma.reproducteur.updateMany({
    where: { id, siteId },
    data: {
      ...(data.code !== undefined && { code: data.code }),
      ...(data.sexe !== undefined && { sexe: data.sexe }),
      ...(data.poids !== undefined && { poids: data.poids }),
      ...(data.age !== undefined && { age: data.age }),
      ...(data.origine !== undefined && { origine: data.origine }),
      ...(data.statut !== undefined && { statut: data.statut }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });

  if (result.count === 0) {
    throw new Error("Reproducteur introuvable");
  }

  return prisma.reproducteur.findFirst({
    where: { id, siteId },
    include: {
      bac: { select: { id: true, nom: true, volume: true } },
      _count: {
        select: {
          pontesAsFemelle: true,
          pontesAsMale: true,
        },
      },
    },
  });
}
