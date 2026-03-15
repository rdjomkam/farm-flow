/**
 * Fonctions de requete Prisma pour ConfigElevage.
 *
 * Chaque profil appartient a un site (siteId — R8).
 * Un seul profil peut avoir isDefault=true par site.
 *
 * Fallback defaults: valeurs hardcodees correspondant aux benchmarks FAO
 * pour Clarias gariepinus (section 6.5 du REQ). Adresse EC-5.1.
 */

import { prisma } from "@/lib/db";
import type { CreateConfigElevageDTO, UpdateConfigElevageDTO } from "@/types";

// ---------------------------------------------------------------------------
// Valeurs par defaut hardcodees (fallback EC-5.1)
// ---------------------------------------------------------------------------

/** Config fallback quand aucun profil par defaut n'existe pour un site */
export const CONFIG_ELEVAGE_DEFAULTS = {
  poidsObjectif: 800,
  dureeEstimeeCycle: 180,
  tauxSurvieObjectif: 85,
  seuilAcclimatation: 15,
  seuilCroissanceDebut: 50,
  seuilJuvenile: 150,
  seuilGrossissement: 350,
  seuilFinition: 700,
  alimentTailleConfig: [
    { poidsMin: 0, poidsMax: 15, tailleGranule: "1.2mm", description: "Aliment demarrage", proteines: 42 },
    { poidsMin: 15, poidsMax: 30, tailleGranule: "1.5-2mm", description: "Aliment croissance petit", proteines: 38 },
    { poidsMin: 30, poidsMax: 80, tailleGranule: "2-3mm", description: "Aliment croissance", proteines: 35 },
    { poidsMin: 80, poidsMax: 150, tailleGranule: "3-4mm", description: "Aliment grossissement petit", proteines: 32 },
    { poidsMin: 150, poidsMax: 350, tailleGranule: "4-6mm", description: "Aliment grossissement", proteines: 28 },
    { poidsMin: 350, poidsMax: 99999, tailleGranule: "6-9mm", description: "Aliment finition", proteines: 25 },
  ],
  alimentTauxConfig: [
    { phase: "ACCLIMATATION", tauxMin: 8, tauxMax: 10, frequence: 4, notes: "3-4 distributions/jour" },
    { phase: "CROISSANCE_DEBUT", tauxMin: 5, tauxMax: 6, frequence: 3, notes: "3 distributions/jour" },
    { phase: "JUVENILE", tauxMin: 3, tauxMax: 5, frequence: 3, notes: "2-3 distributions/jour" },
    { phase: "GROSSISSEMENT", tauxMin: 2, tauxMax: 3, frequence: 2, notes: "2 distributions/jour" },
    { phase: "FINITION", tauxMin: 1.5, tauxMax: 2, frequence: 2, notes: "1-2 distributions/jour" },
    { phase: "PRE_RECOLTE", tauxMin: 1, tauxMax: 1.5, frequence: 1, notes: "1 distribution/jour" },
  ],
  fcrExcellentMax: 1.5,
  fcrBonMax: 1.8,
  fcrAcceptableMax: 2.2,
  sgrExcellentMin: 2.0,
  sgrBonMin: 1.5,
  sgrAcceptableMin: 1.0,
  survieExcellentMin: 90,
  survieBonMin: 85,
  survieAcceptableMin: 80,
  densiteExcellentMax: 7,
  densiteBonMax: 10,
  densiteAcceptableMax: 15,
  mortaliteExcellentMax: 3,
  mortaliteBonMax: 5,
  mortaliteAcceptableMax: 10,
  phMin: 6.5,
  phMax: 8.5,
  phOptimalMin: 6.5,
  phOptimalMax: 7.5,
  temperatureMin: 22,
  temperatureMax: 36,
  temperatureOptimalMin: 26,
  temperatureOptimalMax: 32,
  oxygeneMin: 1.5,
  oxygeneAlerte: 4.0,
  oxygeneOptimal: 5.0,
  ammoniacMax: 0.5,
  ammoniacAlerte: 0.05,
  ammoniacOptimal: 0.02,
  nitriteMax: 1.0,
  nitriteAlerte: 0.5,
  mortaliteQuotidienneAlerte: 1.0,
  mortaliteQuotidienneCritique: 3.0,
  fcrAlerteMax: 2.0,
  stockJoursAlerte: 5,
  triPoidsMin: 5,
  triPoidsMax: 150,
  triIntervalleJours: 14,
  biometrieIntervalleDebut: 7,
  biometrieIntervalleFin: 14,
  biometrieEchantillonPct: 10,
  eauChangementPct: 30,
  eauChangementIntervalleJours: 3,
  densiteMaxPoissonsM3: 100,
  densiteOptimalePoissonsM3: 50,
  recoltePartiellePoidsSeuil: 400,
  recolteJeuneAvantJours: 2,
};

// ---------------------------------------------------------------------------
// Queries CRUD
// ---------------------------------------------------------------------------

/** Liste tous les profils ConfigElevage d'un site */
export async function getConfigsElevage(siteId: string) {
  return prisma.configElevage.findMany({
    where: { siteId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

/** Recupere un profil par ID (verifie le siteId — R8) */
export async function getConfigElevageById(id: string, siteId: string) {
  return prisma.configElevage.findFirst({
    where: { id, siteId },
  });
}

/**
 * Recupere le profil par defaut du site.
 * Retourne null si aucun profil isDefault=true n'existe.
 * Le caller doit appliquer le fallback CONFIG_ELEVAGE_DEFAULTS si null (EC-5.1).
 */
export async function getConfigElevageDefaut(siteId: string) {
  return prisma.configElevage.findFirst({
    where: { siteId, isDefault: true },
  });
}

/**
 * Cree un nouveau profil ConfigElevage.
 * Si isDefault=true, les autres profils du site passent isDefault=false (atomique).
 */
export async function createConfigElevage(siteId: string, data: CreateConfigElevageDTO) {
  return prisma.$transaction(async (tx) => {
    // Si nouveau profil est le defaut, desactiver les autres
    if (data.isDefault) {
      await tx.configElevage.updateMany({
        where: { siteId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.configElevage.create({
      data: {
        ...data,
        alimentTailleConfig: data.alimentTailleConfig as object[],
        alimentTauxConfig: data.alimentTauxConfig as object[],
        siteId,
      },
    });
  });
}

/**
 * Met a jour partiellement un profil ConfigElevage.
 * Si isDefault passe a true, les autres profils du site passent isDefault=false.
 */
export async function updateConfigElevage(
  id: string,
  siteId: string,
  data: UpdateConfigElevageDTO
) {
  return prisma.$transaction(async (tx) => {
    // Verifier que le profil appartient au site
    const existing = await tx.configElevage.findFirst({ where: { id, siteId } });
    if (!existing) return null;

    // Si ce profil passe en defaut, desactiver les autres
    if (data.isDefault === true && !existing.isDefault) {
      await tx.configElevage.updateMany({
        where: { siteId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.alimentTailleConfig) {
      updateData.alimentTailleConfig = data.alimentTailleConfig as object[];
    }
    if (data.alimentTauxConfig) {
      updateData.alimentTauxConfig = data.alimentTauxConfig as object[];
    }

    return tx.configElevage.update({
      where: { id },
      data: updateData,
    });
  });
}

/**
 * Supprime un profil ConfigElevage.
 * Interdit si isDefault=true.
 * Note: interdit aussi si lie a un Pack actif (verifie au niveau API quand Pack sera implemente).
 *
 * Retourne 'IS_DEFAULT' si le profil est le defaut, null si non trouve, ou le profil supprime.
 */
export async function deleteConfigElevage(
  id: string,
  siteId: string
): Promise<"IS_DEFAULT" | "NOT_FOUND" | { id: string }> {
  const existing = await prisma.configElevage.findFirst({ where: { id, siteId } });
  if (!existing) return "NOT_FOUND";
  if (existing.isDefault) return "IS_DEFAULT";

  return prisma.configElevage.delete({
    where: { id },
    select: { id: true },
  });
}

/**
 * Duplique un profil ConfigElevage avec un nouveau nom.
 * Le duplicat n'est jamais isDefault (EC-5.2).
 */
export async function dupliquerConfigElevage(
  id: string,
  siteId: string,
  nouveauNom: string
) {
  const source = await prisma.configElevage.findFirst({ where: { id, siteId } });
  if (!source) return null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt: _c, updatedAt: _u, isDefault: _d, nom: _n,
    alimentTailleConfig, alimentTauxConfig, ...rest } = source;

  return prisma.configElevage.create({
    data: {
      ...rest,
      nom: nouveauNom,
      isDefault: false, // le duplicat n'est jamais le defaut
      // Cast JSON fields: Prisma returns JsonValue (nullable) but create expects InputJsonValue
      alimentTailleConfig: alimentTailleConfig ?? [],
      alimentTauxConfig: alimentTauxConfig ?? [],
    },
  });
}
