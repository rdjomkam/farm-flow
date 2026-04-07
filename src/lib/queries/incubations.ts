/**
 * Queries — Module Reproduction : Incubations + TraitementIncubation
 *
 * Ce fichier expose les fonctions CRUD pour :
 *   1. Incubation        — suivi d'une phase d'incubation des oeufs d'une ponte
 *   2. TraitementIncubation — traitements antifongiques / parasiticides
 *   3. recordEclosion    — enregistre l'éclosion + crée automatiquement un LotAlevins
 *
 * Règles respectées :
 *   R2 — Enums importés depuis @/types, jamais de strings brutes
 *   R4 — Opérations atomiques : updateMany avec siteId, $transaction pour recordEclosion
 *   R8 — Toujours filtrer par siteId
 */

import { prisma } from "@/lib/db";
import {
  StatutIncubation,
  SubstratIncubation,
  StatutLotAlevins,
  PhaseLot,
} from "@/types";
import type {
  CreateIncubationDTO,
  UpdateIncubationDTO,
  CreateTraitementIncubationDTO,
} from "@/types";
import { getDureeIncubationH } from "@/lib/reproduction/calculs";

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

/**
 * Génère le prochain code d'incubation pour un site.
 * Format : "INC-{YYYY}-{NNN}"  (ex: "INC-2026-001", "INC-2026-042")
 *
 * Utilise findFirst + orderBy desc pour éviter les race-conditions
 * (même pattern que generateNextNumero dans numero-utils.ts).
 */
async function generateIncubationCode(siteId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INC-${year}-`;

  const last = await prisma.incubation.findFirst({
    where: { siteId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let seq = 1;
  if (last) {
    // code = "INC-2026-042" → parts[2] = "042"
    const parts = last.code.split("-");
    const parsed = parseInt(parts[2] ?? "0", 10);
    if (!isNaN(parsed)) seq = parsed + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}

/**
 * Génère le prochain code de lot d'alevins pour un site.
 * Format : "LOT-{YYYY}-{NNN}"  (ex: "LOT-2026-001")
 */
async function generateLotAlevinsCode(siteId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LOT-${year}-`;

  const last = await prisma.lotAlevins.findFirst({
    where: { siteId, code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let seq = 1;
  if (last) {
    const parts = last.code.split("-");
    const parsed = parseInt(parts[2] ?? "0", 10);
    if (!isNaN(parsed)) seq = parsed + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Incubation — CRUD
// ---------------------------------------------------------------------------

/**
 * Liste les incubations d'un site avec filtres optionnels et pagination.
 *
 * Retourne { data, total } pour la pagination côté client.
 */
export async function listIncubations(
  siteId: string,
  params: {
    ponteId?: string;
    statut?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const where: Record<string, unknown> = { siteId };

  if (params.ponteId) where.ponteId = params.ponteId;
  if (params.statut) where.statut = params.statut;

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  const [data, total] = await Promise.all([
    prisma.incubation.findMany({
      where,
      include: {
        ponte: {
          select: { id: true, code: true, datePonte: true, statut: true },
        },
        _count: {
          select: { traitements: true, lotAlevins: true },
        },
      },
      orderBy: { dateDebutIncubation: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.incubation.count({ where }),
  ]);

  return { data, total };
}

/**
 * Récupère une incubation par ID (vérifie siteId) avec toutes ses relations :
 * ponte, traitements, lots d'alevins générés.
 */
export async function getIncubationById(id: string, siteId: string) {
  return prisma.incubation.findFirst({
    where: { id, siteId },
    include: {
      ponte: {
        select: { id: true, code: true, datePonte: true, statut: true },
      },
      traitements: {
        orderBy: { heure: "asc" },
      },
      lotAlevins: {
        select: {
          id: true,
          code: true,
          nombreInitial: true,
          nombreActuel: true,
          phase: true,
          statut: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { traitements: true, lotAlevins: true },
      },
    },
  });
}

/**
 * Crée une nouvelle incubation pour une ponte.
 *
 * Auto-calculs si temperatureEauC est fourni :
 *   - dureeIncubationH  (via getDureeIncubationH de calculs.ts)
 *   - dateEclosionPrevue (dateDebutIncubation + dureeIncubationH)
 *
 * Si dto.code est omis, un code est généré automatiquement au format INC-{YYYY}-{NNN}.
 */
export async function createIncubation(
  siteId: string,
  dto: CreateIncubationDTO
) {
  // Résoudre le code : fourni ou auto-généré
  const code = dto.code ?? (await generateIncubationCode(siteId));

  // Vérifier l'unicité du code
  const existing = await prisma.incubation.findUnique({ where: { code } });
  if (existing) {
    throw new Error(`Le code "${code}" est déjà utilisé`);
  }

  // Résoudre la date de début
  const dateDebutIncubation = dto.dateDebutIncubation
    ? new Date(dto.dateDebutIncubation)
    : new Date();

  // Auto-calcul de la durée et de la date d'éclosion prévue
  let dureeIncubationH = dto.dureeIncubationH ?? null;
  let dateEclosionPrevue: Date | null = null;

  if (dto.temperatureEauC != null) {
    // Durée auto si non fournie explicitement
    if (dureeIncubationH == null) {
      dureeIncubationH = getDureeIncubationH(dto.temperatureEauC);
    }
    // Date d'éclosion prévue : début + durée en heures
    // dureeIncubationH est forcément non-null ici (assigné ci-dessus si null)
    const dureeH = dureeIncubationH ?? getDureeIncubationH(dto.temperatureEauC);
    dateEclosionPrevue = new Date(
      dateDebutIncubation.getTime() + dureeH * 60 * 60 * 1000
    );
  }

  // Priorité au dateEclosionPrevue fourni explicitement dans le DTO
  if (dto.dateEclosionPrevue != null) {
    dateEclosionPrevue = new Date(dto.dateEclosionPrevue);
  }

  return prisma.incubation.create({
    data: {
      code,
      ponteId: dto.ponteId,
      substrat: dto.substrat ?? SubstratIncubation.RACINES_PISTIA,
      temperatureEauC: dto.temperatureEauC ?? null,
      dureeIncubationH,
      dateDebutIncubation,
      dateEclosionPrevue,
      nombreOeufsPlaces: dto.nombreOeufsPlaces ?? null,
      statut: StatutIncubation.EN_COURS,
      notes: dto.notes ?? null,
      siteId,
    },
    include: {
      ponte: {
        select: { id: true, code: true, datePonte: true, statut: true },
      },
      _count: {
        select: { traitements: true, lotAlevins: true },
      },
    },
  });
}

/**
 * Met à jour une incubation (modification partielle).
 *
 * Utilise updateMany avec siteId pour l'isolation multi-tenant (R4/R8).
 * Lance une erreur si l'incubation est introuvable.
 */
export async function updateIncubation(
  id: string,
  siteId: string,
  dto: UpdateIncubationDTO
) {
  const result = await prisma.incubation.updateMany({
    where: { id, siteId },
    data: {
      ...(dto.substrat !== undefined && { substrat: dto.substrat }),
      ...(dto.temperatureEauC !== undefined && {
        temperatureEauC: dto.temperatureEauC,
      }),
      ...(dto.dureeIncubationH !== undefined && {
        dureeIncubationH: dto.dureeIncubationH,
      }),
      ...(dto.dateEclosionPrevue !== undefined && {
        dateEclosionPrevue: dto.dateEclosionPrevue
          ? new Date(dto.dateEclosionPrevue)
          : null,
      }),
      ...(dto.dateEclosionReelle !== undefined && {
        dateEclosionReelle: dto.dateEclosionReelle
          ? new Date(dto.dateEclosionReelle)
          : null,
      }),
      ...(dto.nombreOeufsPlaces !== undefined && {
        nombreOeufsPlaces: dto.nombreOeufsPlaces,
      }),
      ...(dto.nombreLarvesEcloses !== undefined && {
        nombreLarvesEcloses: dto.nombreLarvesEcloses,
      }),
      ...(dto.tauxEclosion !== undefined && { tauxEclosion: dto.tauxEclosion }),
      ...(dto.nombreDeformes !== undefined && {
        nombreDeformes: dto.nombreDeformes,
      }),
      ...(dto.nombreLarvesViables !== undefined && {
        nombreLarvesViables: dto.nombreLarvesViables,
      }),
      ...(dto.notesRetrait !== undefined && { notesRetrait: dto.notesRetrait }),
      ...(dto.statut !== undefined && { statut: dto.statut }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    },
  });

  if (result.count === 0) {
    throw new Error("Incubation introuvable");
  }

  return prisma.incubation.findFirst({
    where: { id, siteId },
    include: {
      ponte: {
        select: { id: true, code: true, datePonte: true, statut: true },
      },
      _count: {
        select: { traitements: true, lotAlevins: true },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// TraitementIncubation — gestion des traitements
// ---------------------------------------------------------------------------

/**
 * Ajoute un traitement antifongique / parasiticide à une incubation.
 *
 * Vérifie que l'incubation appartient au site (R8) avant la création.
 * Lance une erreur si l'incubation est introuvable.
 */
export async function addTraitement(
  incubationId: string,
  siteId: string,
  dto: CreateTraitementIncubationDTO
) {
  // Vérifier l'appartenance de l'incubation au site (R8)
  const incubation = await prisma.incubation.findFirst({
    where: { id: incubationId, siteId },
    select: { id: true },
  });

  if (!incubation) {
    throw new Error("Incubation introuvable");
  }

  return prisma.traitementIncubation.create({
    data: {
      incubationId,
      produit: dto.produit,
      concentration: dto.concentration,
      dureeMinutes: dto.dureeMinutes,
      heure: dto.heure ? new Date(dto.heure) : new Date(),
      notes: dto.notes ?? null,
      siteId,
    },
  });
}

/**
 * Supprime un traitement d'incubation.
 *
 * Vérifie que le traitement appartient au site avant suppression (R8).
 * Lance une erreur si le traitement est introuvable.
 */
export async function deleteTraitement(
  traitementId: string,
  siteId: string
): Promise<void> {
  // R4 + R8 — deleteMany avec siteId pour isoler le tenant
  const result = await prisma.traitementIncubation.deleteMany({
    where: { id: traitementId, siteId },
  });

  if (result.count === 0) {
    throw new Error("Traitement introuvable");
  }
}

// ---------------------------------------------------------------------------
// recordEclosion — transaction critique (R4)
// ---------------------------------------------------------------------------

/**
 * Enregistre l'éclosion d'une incubation.
 *
 * R4 — TRANSACTION ATOMIQUE :
 *   1. Met à jour l'incubation :
 *      - nombreLarvesEcloses, dateEclosionReelle
 *      - tauxEclosion calculé si nombreOeufsPlaces est renseigné
 *      - nombreLarvesViables = nombreLarvesEcloses - nombreDeformes
 *      - statut → TERMINEE
 *   2. Crée un LotAlevins en phase LARVAIRE avec incubationId, code auto,
 *      nombreInitial = nombreLarvesViables.
 *
 * Lance une erreur si l'incubation est introuvable ou déjà terminée.
 */
export async function recordEclosion(
  id: string,
  siteId: string,
  data: {
    nombreLarvesEcloses: number;
    nombreDeformes?: number;
    dateEclosionReelle: string;
    notes?: string;
  }
) {
  // Lire l'incubation pour avoir ponteId + nombreOeufsPlaces
  const incubation = await prisma.incubation.findFirst({
    where: { id, siteId },
    select: {
      id: true,
      ponteId: true,
      nombreOeufsPlaces: true,
      statut: true,
    },
  });

  if (!incubation) {
    throw new Error("Incubation introuvable");
  }

  if (incubation.statut === StatutIncubation.TERMINEE) {
    throw new Error("Cette incubation est déjà terminée");
  }

  // Calculs dérivés
  const nombreDeformes = data.nombreDeformes ?? 0;
  const nombreLarvesViables = data.nombreLarvesEcloses - nombreDeformes;

  const tauxEclosion =
    incubation.nombreOeufsPlaces && incubation.nombreOeufsPlaces > 0
      ? (data.nombreLarvesEcloses / incubation.nombreOeufsPlaces) * 100
      : null;

  const dateEclosionReelle = new Date(data.dateEclosionReelle);

  // Générer le code du lot avant la transaction (évite un appel Prisma imbriqué)
  const lotCode = await generateLotAlevinsCode(siteId);

  // R4 — Transaction atomique
  const [updatedIncubation, lotAlevins] = await prisma.$transaction([
    // 1. Mettre à jour l'incubation
    prisma.incubation.update({
      where: { id },
      data: {
        nombreLarvesEcloses: data.nombreLarvesEcloses,
        nombreDeformes: nombreDeformes,
        nombreLarvesViables,
        tauxEclosion,
        dateEclosionReelle,
        statut: StatutIncubation.TERMINEE,
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    }),

    // 2. Créer le lot d'alevins en phase LARVAIRE
    prisma.lotAlevins.create({
      data: {
        code: lotCode,
        ponteId: incubation.ponteId,
        incubationId: id,
        nombreInitial: nombreLarvesViables,
        nombreActuel: nombreLarvesViables,
        ageJours: 0,
        statut: StatutLotAlevins.EN_ELEVAGE,
        phase: PhaseLot.LARVAIRE,
        dateDebutPhase: dateEclosionReelle,
        nombreDeformesRetires: nombreDeformes,
        siteId,
      },
    }),
  ]);

  return { incubation: updatedIncubation, lotAlevins };
}
