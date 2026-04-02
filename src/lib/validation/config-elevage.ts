/**
 * Schemas Zod pour la validation des champs JSON de ConfigElevage.
 *
 * Valide :
 * - alimentTailleConfig : ranges de poids sans gaps ni overlaps, tailleGranule present
 * - alimentTauxConfig : toutes les phases presentes, tauxMin <= tauxMax
 * - Coherence des seuils de phases (monotoniquement croissants)
 * - Absence d'inversions dans les benchmarks (excellent > bon > acceptable)
 *
 * Adresse : F-08, EC-5.3, EC-5.6, EC-5.7
 */

import { z } from "zod";
import { PhaseElevage } from "@/types";

// ---------------------------------------------------------------------------
// Schema : alimentTailleConfig
// ---------------------------------------------------------------------------

export const alimentTailleEntreeSchema = z.object({
  poidsMin: z.number().nonnegative("poidsMin doit etre >= 0"),
  poidsMax: z.number().positive("poidsMax doit etre > 0"),
  tailleGranule: z.string().min(1, "tailleGranule est obligatoire"),
  description: z.string().optional(),
  proteines: z.number().min(0).max(100).optional(),
});

export type AlimentTailleEntree = z.infer<typeof alimentTailleEntreeSchema>;

/**
 * Valide un tableau de configurations de taille d'aliment.
 *
 * Regles :
 * - poidsMin < poidsMax pour chaque entree
 * - Pas de gaps : le poidsMin de l'entree suivante = poidsMax de l'entree precedente
 * - Pas d'overlaps (decoule de la regle precedente)
 * - Tableau non vide
 * - Tri par poidsMin croissant
 *
 * Adresse : EC-5.3
 */
export const alimentTailleConfigSchema = z
  .array(alimentTailleEntreeSchema)
  .min(1, "alimentTailleConfig doit contenir au moins une entree")
  .superRefine((entries, ctx) => {
    // Tri par poidsMin pour faciliter la validation
    const sorted = [...entries].sort((a, b) => a.poidsMin - b.poidsMin);

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];

      // Verifier poidsMin < poidsMax
      if (entry.poidsMin >= entry.poidsMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Entry[${i}] : poidsMin (${entry.poidsMin}) doit etre < poidsMax (${entry.poidsMax})`,
          path: [i],
        });
      }

      // Verifier pas de gap avec l'entree precedente
      if (i > 0) {
        const prev = sorted[i - 1];
        if (Math.abs(prev.poidsMax - entry.poidsMin) > 0.001) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Gap detecte entre entry[${i - 1}].poidsMax (${prev.poidsMax}) et entry[${i}].poidsMin (${entry.poidsMin})`,
            path: [i],
          });
        }
      }
    }
  });

// ---------------------------------------------------------------------------
// Schema : alimentTauxConfig
// ---------------------------------------------------------------------------

const PHASES_REQUISES = Object.values(PhaseElevage);

export const alimentTauxEntreeSchema = z.object({
  phase: z.nativeEnum(PhaseElevage),
  tauxMin: z.number().positive("tauxMin doit etre > 0"),
  tauxMax: z.number().positive("tauxMax doit etre > 0"),
  frequence: z.number().int().positive("frequence doit etre un entier > 0"),
  notes: z.string().optional(),
});

export type AlimentTauxEntree = z.infer<typeof alimentTauxEntreeSchema>;

/**
 * Valide un tableau de configurations de taux d'alimentation.
 *
 * Regles :
 * - tauxMin <= tauxMax pour chaque entree
 * - Toutes les 6 phases sont presentes exactement une fois
 * - Aucun doublon de phase
 *
 * Adresse : EC-5.3, EC-5.7
 */
export const alimentTauxConfigSchema = z
  .array(alimentTauxEntreeSchema)
  .length(PHASES_REQUISES.length, `alimentTauxConfig doit contenir exactement ${PHASES_REQUISES.length} entrees (une par phase)`)
  .superRefine((entries, ctx) => {
    const phasesVues = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // Verifier tauxMin <= tauxMax
      if (entry.tauxMin > entry.tauxMax) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Entry[${i}] phase ${entry.phase} : tauxMin (${entry.tauxMin}) doit etre <= tauxMax (${entry.tauxMax})`,
          path: [i, "tauxMin"],
        });
      }

      // Verifier pas de doublon de phase
      if (phasesVues.has(entry.phase)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Phase ${entry.phase} apparait plusieurs fois dans alimentTauxConfig`,
          path: [i, "phase"],
        });
      }
      phasesVues.add(entry.phase);
    }

    // Verifier toutes les phases sont presentes
    for (const phase of PHASES_REQUISES) {
      if (!phasesVues.has(phase)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Phase requise manquante : ${phase}`,
          path: [],
        });
      }
    }
  });

// ---------------------------------------------------------------------------
// Schema : CreateConfigElevageDTO — validation des champs scalaires
// ---------------------------------------------------------------------------

/**
 * Valide les seuils de phases de croissance.
 * Les seuils doivent etre monotoniquement croissants. Adresse EC-5.7.
 */
function validateSeuilsPhases(data: {
  seuilAcclimatation?: number;
  seuilCroissanceDebut?: number;
  seuilJuvenile?: number;
  seuilGrossissement?: number;
  seuilFinition?: number;
}): string | null {
  const seuils = [
    { nom: "seuilAcclimatation", val: data.seuilAcclimatation },
    { nom: "seuilCroissanceDebut", val: data.seuilCroissanceDebut },
    { nom: "seuilJuvenile", val: data.seuilJuvenile },
    { nom: "seuilGrossissement", val: data.seuilGrossissement },
    { nom: "seuilFinition", val: data.seuilFinition },
  ].filter((s) => s.val !== undefined);

  for (let i = 1; i < seuils.length; i++) {
    if (seuils[i].val! <= seuils[i - 1].val!) {
      return `${seuils[i].nom} (${seuils[i].val}) doit etre > ${seuils[i - 1].nom} (${seuils[i - 1].val})`;
    }
  }
  return null;
}

/**
 * Valide les benchmarks : excellent > bon > acceptable (sans inversions).
 * Pour les metriques "lower is better" (FCR, densite, mortalite) : excellent < bon < acceptable.
 * Pour les metriques "higher is better" (SGR, survie) : excellent > bon > acceptable.
 *
 * Adresse : EC-5.6, F-08
 */
function validateBenchmarks(data: {
  fcrExcellentMax?: number;
  fcrBonMax?: number;
  fcrAcceptableMax?: number;
  sgrExcellentMin?: number;
  sgrBonMin?: number;
  sgrAcceptableMin?: number;
  survieExcellentMin?: number;
  survieBonMin?: number;
  survieAcceptableMin?: number;
  densiteExcellentMax?: number;
  densiteBonMax?: number;
  densiteAcceptableMax?: number;
  mortaliteExcellentMax?: number;
  mortaliteBonMax?: number;
  mortaliteAcceptableMax?: number;
}): string | null {
  // FCR: lower is better → excellentMax < bonMax < acceptableMax
  if (
    data.fcrExcellentMax !== undefined &&
    data.fcrBonMax !== undefined &&
    data.fcrExcellentMax >= data.fcrBonMax
  ) {
    return `FCR : fcrExcellentMax (${data.fcrExcellentMax}) doit etre < fcrBonMax (${data.fcrBonMax})`;
  }
  if (
    data.fcrBonMax !== undefined &&
    data.fcrAcceptableMax !== undefined &&
    data.fcrBonMax >= data.fcrAcceptableMax
  ) {
    return `FCR : fcrBonMax (${data.fcrBonMax}) doit etre < fcrAcceptableMax (${data.fcrAcceptableMax})`;
  }

  // SGR: higher is better → excellentMin > bonMin > acceptableMin
  if (
    data.sgrExcellentMin !== undefined &&
    data.sgrBonMin !== undefined &&
    data.sgrExcellentMin <= data.sgrBonMin
  ) {
    return `SGR : sgrExcellentMin (${data.sgrExcellentMin}) doit etre > sgrBonMin (${data.sgrBonMin})`;
  }
  if (
    data.sgrBonMin !== undefined &&
    data.sgrAcceptableMin !== undefined &&
    data.sgrBonMin <= data.sgrAcceptableMin
  ) {
    return `SGR : sgrBonMin (${data.sgrBonMin}) doit etre > sgrAcceptableMin (${data.sgrAcceptableMin})`;
  }

  // Survie: higher is better → excellentMin > bonMin > acceptableMin
  if (
    data.survieExcellentMin !== undefined &&
    data.survieBonMin !== undefined &&
    data.survieExcellentMin <= data.survieBonMin
  ) {
    return `Survie : survieExcellentMin (${data.survieExcellentMin}) doit etre > survieBonMin (${data.survieBonMin})`;
  }
  if (
    data.survieBonMin !== undefined &&
    data.survieAcceptableMin !== undefined &&
    data.survieBonMin <= data.survieAcceptableMin
  ) {
    return `Survie : survieBonMin (${data.survieBonMin}) doit etre > survieAcceptableMin (${data.survieAcceptableMin})`;
  }

  // Densite: lower is better → excellentMax < bonMax < acceptableMax
  if (
    data.densiteExcellentMax !== undefined &&
    data.densiteBonMax !== undefined &&
    data.densiteExcellentMax >= data.densiteBonMax
  ) {
    return `Densite : densiteExcellentMax (${data.densiteExcellentMax}) doit etre < densiteBonMax (${data.densiteBonMax})`;
  }
  if (
    data.densiteBonMax !== undefined &&
    data.densiteAcceptableMax !== undefined &&
    data.densiteBonMax >= data.densiteAcceptableMax
  ) {
    return `Densite : densiteBonMax (${data.densiteBonMax}) doit etre < densiteAcceptableMax (${data.densiteAcceptableMax})`;
  }

  // Mortalite: lower is better → excellentMax < bonMax < acceptableMax
  if (
    data.mortaliteExcellentMax !== undefined &&
    data.mortaliteBonMax !== undefined &&
    data.mortaliteExcellentMax >= data.mortaliteBonMax
  ) {
    return `Mortalite : mortaliteExcellentMax (${data.mortaliteExcellentMax}) doit etre < mortaliteBonMax (${data.mortaliteBonMax})`;
  }
  if (
    data.mortaliteBonMax !== undefined &&
    data.mortaliteAcceptableMax !== undefined &&
    data.mortaliteBonMax >= data.mortaliteAcceptableMax
  ) {
    return `Mortalite : mortaliteBonMax (${data.mortaliteBonMax}) doit etre < mortaliteAcceptableMax (${data.mortaliteAcceptableMax})`;
  }

  return null;
}

/**
 * Schema de base sans refinements (permet .partial() pour updateConfigElevageSchema).
 */
const baseConfigElevageObject = z.object({
    nom: z.string().min(1, "nom est obligatoire").max(100),
    description: z.string().max(500).nullable().optional(),

    // Objectif de production
    poidsObjectif: z.number().positive("poidsObjectif doit etre > 0"),
    dureeEstimeeCycle: z.number().int().positive("dureeEstimeeCycle doit etre > 0"),
    tauxSurvieObjectif: z.number().min(0).max(100, "tauxSurvieObjectif doit etre entre 0 et 100"),

    // Seuils de phases
    seuilAcclimatation: z.number().positive().optional(),
    seuilCroissanceDebut: z.number().positive().optional(),
    seuilJuvenile: z.number().positive().optional(),
    seuilGrossissement: z.number().positive().optional(),
    seuilFinition: z.number().positive().optional(),

    // JSON configs
    alimentTailleConfig: alimentTailleConfigSchema,
    alimentTauxConfig: alimentTauxConfigSchema,

    // Benchmarks FCR
    fcrExcellentMax: z.number().positive().optional(),
    fcrBonMax: z.number().positive().optional(),
    fcrAcceptableMax: z.number().positive().optional(),

    // Benchmarks SGR
    sgrExcellentMin: z.number().positive().optional(),
    sgrBonMin: z.number().positive().optional(),
    sgrAcceptableMin: z.number().positive().optional(),

    // Benchmarks Survie
    survieExcellentMin: z.number().min(0).max(100).optional(),
    survieBonMin: z.number().min(0).max(100).optional(),
    survieAcceptableMin: z.number().min(0).max(100).optional(),

    // Benchmarks Densite
    densiteExcellentMax: z.number().positive().optional(),
    densiteBonMax: z.number().positive().optional(),
    densiteAcceptableMax: z.number().positive().optional(),

    // Benchmarks Mortalite
    mortaliteExcellentMax: z.number().min(0).max(100).optional(),
    mortaliteBonMax: z.number().min(0).max(100).optional(),
    mortaliteAcceptableMax: z.number().min(0).max(100).optional(),

    // Qualite eau
    phMin: z.number().min(0).max(14).optional(),
    phMax: z.number().min(0).max(14).optional(),
    phOptimalMin: z.number().min(0).max(14).optional(),
    phOptimalMax: z.number().min(0).max(14).optional(),
    temperatureMin: z.number().optional(),
    temperatureMax: z.number().optional(),
    temperatureOptimalMin: z.number().optional(),
    temperatureOptimalMax: z.number().optional(),
    oxygeneMin: z.number().min(0).optional(),
    oxygeneAlerte: z.number().min(0).optional(),
    oxygeneOptimal: z.number().min(0).optional(),
    ammoniacMax: z.number().min(0).optional(),
    ammoniacAlerte: z.number().min(0).optional(),
    ammoniacOptimal: z.number().min(0).optional(),
    nitriteMax: z.number().min(0).optional(),
    nitriteAlerte: z.number().min(0).optional(),

    // Mortalite alertes
    mortaliteQuotidienneAlerte: z.number().min(0).max(100).optional(),
    mortaliteQuotidienneCritique: z.number().min(0).max(100).optional(),

    // Alimentation alertes
    fcrAlerteMax: z.number().positive().optional(),
    stockJoursAlerte: z.number().int().positive().optional(),

    // Tri
    triPoidsMin: z.number().positive().optional(),
    triPoidsMax: z.number().positive().optional(),
    triIntervalleJours: z.number().int().positive().optional(),

    // Biometrie
    biometrieIntervalleDebut: z.number().int().positive().optional(),
    biometrieIntervalleFin: z.number().int().positive().optional(),
    biometrieEchantillonPct: z.number().min(0).max(100).optional(),

    // Eau
    eauChangementPct: z.number().min(0).max(100).optional(),
    eauChangementIntervalleJours: z.number().int().positive().optional(),

    // Densite elevage
    densiteMaxPoissonsM3: z.number().positive().optional(),
    densiteOptimalePoissonsM3: z.number().positive().optional(),

    // Recolte
    recoltePartiellePoidsSeuil: z.number().positive().optional(),
    recolteJeuneAvantJours: z.number().int().min(0).optional(),

    // Gompertz
    gompertzWInfDefault: z.number().min(100).max(3000).nullable().optional(),
    gompertzKDefault: z.number().min(0.005).max(0.2).nullable().optional(),
    gompertzTiDefault: z.number().min(0).max(300).nullable().optional(),
    gompertzMinPoints: z.number().int().min(3).max(20).default(5),

    // Metadonnees
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

/**
 * Schema Zod pour la creation d'un profil ConfigElevage.
 */
export const createConfigElevageSchema = baseConfigElevageObject.superRefine((data, ctx) => {
    // Valider seuils de phases
    const erreurPhases = validateSeuilsPhases(data);
    if (erreurPhases) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Seuils de phases non monotones : ${erreurPhases}`,
        path: [],
      });
    }

    // Valider benchmarks
    const erreurBenchmarks = validateBenchmarks(data);
    if (erreurBenchmarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Inversions dans les benchmarks : ${erreurBenchmarks}`,
        path: [],
      });
    }

    // Valider pH min < max
    if (
      data.phMin !== undefined &&
      data.phMax !== undefined &&
      data.phMin >= data.phMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `phMin (${data.phMin}) doit etre < phMax (${data.phMax})`,
        path: ["phMin"],
      });
    }

    // Valider temperature min < max
    if (
      data.temperatureMin !== undefined &&
      data.temperatureMax !== undefined &&
      data.temperatureMin >= data.temperatureMax
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `temperatureMin (${data.temperatureMin}) doit etre < temperatureMax (${data.temperatureMax})`,
        path: ["temperatureMin"],
      });
    }

    // Valider mortaliteQuotidienneAlerte < mortaliteQuotidienneCritique
    if (
      data.mortaliteQuotidienneAlerte !== undefined &&
      data.mortaliteQuotidienneCritique !== undefined &&
      data.mortaliteQuotidienneAlerte >= data.mortaliteQuotidienneCritique
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `mortaliteQuotidienneAlerte (${data.mortaliteQuotidienneAlerte}) doit etre < mortaliteQuotidienneCritique (${data.mortaliteQuotidienneCritique})`,
        path: ["mortaliteQuotidienneAlerte"],
      });
    }
  });

export type CreateConfigElevageInput = z.infer<typeof createConfigElevageSchema>;

/**
 * Schema Zod pour la mise a jour partielle d'un profil ConfigElevage.
 * Tous les champs sont optionnels sauf les JSON qui sont valides si presents.
 */
export const updateConfigElevageSchema = baseConfigElevageObject.partial().superRefine(
  (data, ctx) => {
    // Valider seuils de phases si fournis
    const erreurPhases = validateSeuilsPhases(data);
    if (erreurPhases) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Seuils de phases non monotones : ${erreurPhases}`,
        path: [],
      });
    }

    // Valider benchmarks si fournis
    const erreurBenchmarks = validateBenchmarks(data);
    if (erreurBenchmarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Inversions dans les benchmarks : ${erreurBenchmarks}`,
        path: [],
      });
    }
  }
);

export type UpdateConfigElevageInput = z.infer<typeof updateConfigElevageSchema>;
