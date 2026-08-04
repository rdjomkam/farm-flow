/**
 * src/lib/validation/previsions.schema.ts
 *
 * Schemas Zod pour toutes les routes API du module Previsions (Sprint PR2,
 * story PR2.2). Reference ADR-053.
 *
 * Choix de convention (zod, pas la validation manuelle champ par champ de
 * `src/app/api/vagues/route.ts`) — a justifier explicitement, la pre-analyse
 * PR2.2 notant que les deux conventions coexistent dans le depot : le module
 * Previsions expose environ 25 payloads distincts (7 groupes de modeles,
 * plusieurs remplacements en bloc de tableaux) — zod (deja utilise dans
 * `src/lib/validation/*.schema.ts` pour les domaines les plus recents, ex.
 * `ecart-assignation.schema.ts`, `releve.schema.ts`) reduit fortement le code
 * repetitif par rapport a la validation manuelle, et centralise les regles
 * (positivite, entiers, enums R2) en un seul endroit par DTO plutot que
 * dispersees dans chaque route.
 *
 * R2 : chaque enum est valide via `z.nativeEnum(...)`, jamais une chaine
 * litterale.
 */
import { z } from "zod";
import {
  TailleGranule,
  StatutScenarioPrevision,
  TypePostePrevision,
  CategorieJournalPrevu,
  TypeApportCapital,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isoDateString = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), { message: "Date invalide (format ISO 8601 attendu)." });

const positiveInt = z.number().int({ message: "Doit etre un entier." }).nonnegative({
  message: "Doit etre superieur ou egal a 0.",
});

const strictPositiveInt = z.number().int({ message: "Doit etre un entier." }).positive({
  message: "Doit etre strictement superieur a 0.",
});

const nonNegativeNumber = z.number().nonnegative({ message: "Doit etre superieur ou egal a 0." });

/** Pourcentage echelle 0..100 (R7 : jamais 0..1) — margeSecuriteAlevinsPct, tauxEpargnePct. */
const pourcentage0a100 = z
  .number()
  .min(0, { message: "Doit etre superieur ou egal a 0." })
  .max(100, { message: "Doit etre inferieur ou egal a 100." });

// ---------------------------------------------------------------------------
// ScenarioPrevision / ParametresPrevision / PalierRemise
// ---------------------------------------------------------------------------

export const parametresPrevisionCreateSchema = z.object({
  effectifAlevinsParVague: strictPositiveInt,
  margeSecuriteAlevinsPct: nonNegativeNumber,
  poidsMoyenInitialG: nonNegativeNumber,
  poidsObjectifG: nonNegativeNumber,
  prixAlevinUnitaireFCFA: nonNegativeNumber,
  prixVenteKgFCFA: nonNegativeNumber,
  nombreBacsSimultanesCible: strictPositiveInt,
  frequenceStockageMois: z.number().positive({ message: "Doit etre strictement superieur a 0." }),
  capaciteTransportAlimentsSacs: positiveInt.optional(),
  coutTransportAlimentsFCFA: nonNegativeNumber.optional(),
  capaciteTransportPoissonsKg: positiveInt.optional(),
  coutTransportPoissonsFCFA: nonNegativeNumber.optional(),
  capaciteTransportAlevinsNb: positiveInt.optional(),
  coutTransportAlevinsFCFA: nonNegativeNumber.optional(),
  /**
   * Story PR2q.2 — optionnel a la creation (retombe sur le `@default(30)`
   * du schema, coherent avec le jeu d'or) mais consomme par le moteur des
   * qu'il est fourni (ERR-141 : jamais un champ saisi/valide sans site de
   * lecture cote calcul).
   */
  tauxEpargnePct: pourcentage0a100.optional(),
  /** ADR-053 §14 / ERR-170 — defaut applique a la creation des VaguePrevue */
  alevinsAchetesParDefaut: z.boolean().optional(),
});

export const createScenarioSchema = z.object({
  code: z.string().min(1, "Le code est obligatoire."),
  nom: z.string().min(1, "Le nom est obligatoire."),
  description: z.string().nullable().optional(),
  dureeCycleMois: strictPositiveInt.optional(),
  dateDebutPlan: isoDateString,
  parametres: parametresPrevisionCreateSchema,
});
export type CreateScenarioInput = z.infer<typeof createScenarioSchema>;

export const updateParametresPrevisionSchema = parametresPrevisionCreateSchema.partial();
export type UpdateParametresPrevisionInput = z.infer<typeof updateParametresPrevisionSchema>;

export const palierRemiseInputSchema = z.object({
  seuilTonnes: nonNegativeNumber,
  pourcentageRemise: z.number().min(0).max(100, "Le pourcentage de remise doit etre entre 0 et 100."),
  ordre: positiveInt,
});

/**
 * Remplacement en bloc des paliers de remise.
 *
 * `.superRefine` : deux paliers ne peuvent pas partager le meme `ordre`.
 * Sans cette garde, zod passait, `validerPaliersRemiseCroissants` passait
 * (elle ne verifie que la croissance des seuils), puis le `createMany` de
 * `replacePaliersRemise` echouait sur `@@unique([scenarioId, ordre])` en
 * P2002 -> l'utilisateur lisait "Cette valeur existe deja (scenarioId,
 * ordre)", un message de base de donnees dans une UI francaise. Le doublon
 * d'ordre est une erreur METIER (l'ordre d'evaluation des paliers doit etre
 * sans ambiguite, cf. ADR-053 section 13.8 point 3 : sinon le `orderBy:
 * { ordre: "asc" }` est non deterministe), elle merite donc un message metier
 * et un `field` pointant le palier fautif, exactement comme la croissance des
 * seuils.
 */
export const replacePaliersRemiseSchema = z
  .object({
    paliers: z.array(palierRemiseInputSchema),
  })
  .superRefine((valeur, ctx) => {
    const premierIndexParOrdre = new Map<number, number>();
    valeur.paliers.forEach((palier, index) => {
      const premier = premierIndexParOrdre.get(palier.ordre);
      if (premier === undefined) {
        premierIndexParOrdre.set(palier.ordre, index);
        return;
      }
      ctx.addIssue({
        code: "custom",
        path: ["paliers", index, "ordre"],
        message: `Deux paliers de remise ne peuvent pas avoir le meme ordre d'evaluation : l'ordre ${palier.ordre} est utilise par le palier ${premier + 1} et le palier ${index + 1}.`,
      });
    });
  });
export type ReplacePaliersRemiseInput = z.infer<typeof replacePaliersRemiseSchema>;

export const scenariosQuerySchema = z.object({
  statut: z.nativeEnum(StatutScenarioPrevision).optional(),
});

// ---------------------------------------------------------------------------
// AlimentPrevision / RepartitionMoisAliment
// ---------------------------------------------------------------------------

export const repartitionMoisAlimentInputSchema = z.object({
  moisCycle: strictPositiveInt,
  pourcentage: z.number().min(0).max(100, "Le pourcentage doit etre entre 0 et 100."),
});

// Coefficient de besoin en aliment par tonne de POISSON produit. Nullable :
// null = non configure (ADR-053, amendement Sprint PR2 §11). Strictement
// positif s'il est renseigne. Reste au niveau CALIBRE (ADR-053 §12).
const sacsParTonneStandardSchema = z
  .number()
  .positive({ message: "Doit etre strictement superieur a 0." })
  .nullable()
  .optional();

/**
 * Caracteristiques d'un ARTICLE (ADR-053 §12.3) — pas de
 * `partApprovisionnementPct` ici : tant qu'un seul article existe pour un
 * calibre, elle vaut 100% implicitement, ecrite par le serveur (§12.6),
 * jamais demandee dans ce payload.
 */
export const alimentArticlePrevisionInputSchema = z.object({
  libelle: z.string().min(1, "Le libelle est obligatoire."),
  poidsSacKg: z.number().positive({ message: "Doit etre strictement superieur a 0." }),
  prixSacFCFA: nonNegativeNumber,
  produitId: z.string().nullable().optional(),
  ordre: positiveInt.optional(),
});
export type AlimentArticlePrevisionInput = z.infer<typeof alimentArticlePrevisionInputSchema>;

/**
 * Cree un CALIBRE + son unique ARTICLE, dans le meme geste (ADR-053 §12.6) —
 * `tailleGranule` obligatoire (identite du calibre, NOT NULL depuis
 * l'amendement §12).
 */
export const createAlimentPrevisionSchema = z.object({
  tailleGranule: z.nativeEnum(TailleGranule),
  sacsParTonneStandard: sacsParTonneStandardSchema,
  ordre: positiveInt.optional(),
  article: alimentArticlePrevisionInputSchema,
  repartitions: z.array(repartitionMoisAlimentInputSchema).optional(),
});
export type CreateAlimentPrevisionInput = z.infer<typeof createAlimentPrevisionSchema>;

/** Modifie les champs du CALIBRE uniquement — `tailleGranule` n'est jamais modifiable (identite, ADR-053 §12.3). */
export const updateAlimentPrevisionSchema = z.object({
  sacsParTonneStandard: sacsParTonneStandardSchema,
  ordre: positiveInt.optional(),
});
export type UpdateAlimentPrevisionInput = z.infer<typeof updateAlimentPrevisionSchema>;

/** Modifie un article existant (marque, poids de sac, prix) — jamais sa part d'approvisionnement. */
export const updateAlimentArticlePrevisionSchema = z.object({
  libelle: z.string().min(1, "Le libelle est obligatoire.").optional(),
  poidsSacKg: z.number().positive({ message: "Doit etre strictement superieur a 0." }).optional(),
  prixSacFCFA: nonNegativeNumber.optional(),
  produitId: z.string().nullable().optional(),
  ordre: positiveInt.optional(),
});
export type UpdateAlimentArticlePrevisionInput = z.infer<typeof updateAlimentArticlePrevisionSchema>;

const alimentArticlePartInputSchema = z.object({
  articleId: z.string().optional(),
  partApprovisionnementPct: z.number().min(0).max(100, "La part doit etre entre 0 et 100."),
});

/**
 * Ajoute un second (ou N-ieme) article a un calibre existant — action
 * secondaire explicite (ADR-053 §12.6). `repartition` porte la part
 * COMPLETE de tous les articles du calibre apres ajout.
 */
export const addAlimentArticlePrevisionSchema = z.object({
  nouvelArticle: alimentArticlePrevisionInputSchema,
  repartition: z.array(alimentArticlePartInputSchema).min(1),
});
export type AddAlimentArticlePrevisionInput = z.infer<typeof addAlimentArticlePrevisionSchema>;

export const replaceRepartitionsMoisAlimentSchema = z.object({
  repartitions: z.array(repartitionMoisAlimentInputSchema),
});
export type ReplaceRepartitionsMoisAlimentInput = z.infer<typeof replaceRepartitionsMoisAlimentSchema>;

// ---------------------------------------------------------------------------
// VaguePrevue / AlimentParVaguePrevue
// ---------------------------------------------------------------------------

export const createVaguePrevueSchema = z.object({
  code: z.string().min(1, "Le code est obligatoire."),
  dateStockagePrevue: isoDateString,
  effectifAlevinsPrevu: strictPositiveInt,
  poidsMoyenInitialG: nonNegativeNumber,
  /** ADR-053 §14 / ERR-170 — a defaut, retombe sur ParametresPrevision.alevinsAchetesParDefaut */
  alevinsAchetes: z.boolean().optional(),
});
export type CreateVaguePrevueInput = z.infer<typeof createVaguePrevueSchema>;

export const updateVaguePrevueSchema = createVaguePrevueSchema.partial();
export type UpdateVaguePrevueInput = z.infer<typeof updateVaguePrevueSchema>;

/**
 * `alevinsAchetes` est volontairement omis par enfant : une vague fille issue
 * d'une scission herite obligatoirement de la valeur du parent, jamais du
 * defaut de scenario (ADR-053 §14). L'accepter dans ce payload sans effet
 * serait un contrat d'API trompeur — voir `scinderVaguePrevue`
 * (src/lib/queries/previsions-vagues.ts) qui ecrit `parent.alevinsAchetes`.
 */
const scissionVaguePrevueSchema = createVaguePrevueSchema.omit({ alevinsAchetes: true });

export const scinderVaguePrevueSchema = z.object({
  scissions: z.array(scissionVaguePrevueSchema).min(2, "Une scission doit produire au moins 2 vagues prevues."),
});
export type ScinderVaguePrevueInput = z.infer<typeof scinderVaguePrevueSchema>;

export const rattacherVaguePrevueSchema = z.object({
  vagueId: z.string().min(1, "L'identifiant de la vague reelle est obligatoire."),
});
export type RattacherVaguePrevueInput = z.infer<typeof rattacherVaguePrevueSchema>;

export const alimentParVaguePrevueLigneSchema = z.object({
  alimentPrevisionId: z.string().min(1),
  moisCycle: strictPositiveInt,
  sacsCalcules: positiveInt,
  sacsSaisis: positiveInt.nullable(),
  quantiteKgCalculee: nonNegativeNumber,
  coutCalculeFCFA: nonNegativeNumber,
});

export const replaceAlimentsParVaguePrevueSchema = z.object({
  lignes: z.array(alimentParVaguePrevueLigneSchema),
});
export type ReplaceAlimentsParVaguePrevueInput = z.infer<typeof replaceAlimentsParVaguePrevueSchema>;

export const updateSacsSaisisSchema = z.object({
  sacsSaisis: positiveInt.nullable(),
});
export type UpdateSacsSaisisInput = z.infer<typeof updateSacsSaisisSchema>;

export const modeGenerationPlanSchema = z.enum(["ajouter", "remplacer"]);
export type ModeGenerationPlanInput = z.infer<typeof modeGenerationPlanSchema>;

export const genererPlanVaguesPrevuesSchema = z.object({
  horizonMois: positiveInt,
  mode: modeGenerationPlanSchema.optional().default("ajouter"),
});
export type GenererPlanVaguesPrevuesInput = z.infer<typeof genererPlanVaguesPrevuesSchema>;

export const apercuGenerationPlanQuerySchema = z.object({
  // `horizonMois` traverse un query param (`URLSearchParams.get`, string | null) —
  // pas de `z.coerce.number()` seul : `Number(null)` vaut `0`, ce qui ferait
  // silencieusement passer un parametre absent pour "horizon 0" au lieu d'une
  // erreur de validation explicite (le champ est obligatoire).
  horizonMois: z
    .string({ message: "Le parametre horizonMois est obligatoire." })
    .min(1, "Le parametre horizonMois est obligatoire.")
    .refine((v) => Number.isInteger(Number(v)), { message: "Doit etre un entier." })
    .transform((v) => Number(v))
    .refine((v) => v >= 0, { message: "Doit etre superieur ou egal a 0." }),
  mode: modeGenerationPlanSchema.optional().default("ajouter"),
});
export type ApercuGenerationPlanQueryInput = z.infer<typeof apercuGenerationPlanQuerySchema>;

export const vaguesPrevuesQuerySchema = z.object({
  withAliments: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

// ---------------------------------------------------------------------------
// PostePrevision / ChargeMensuellePrevue
// ---------------------------------------------------------------------------

export const createPostePrevisionSchema = z.object({
  libelle: z.string().min(1, "Le libelle est obligatoire."),
  type: z.nativeEnum(TypePostePrevision),
  inclusBaseRepartition: z.boolean().optional(),
  ordre: positiveInt,
});
export type CreatePostePrevisionInput = z.infer<typeof createPostePrevisionSchema>;

export const upsertChargeMensuelleSchema = z.object({
  moisAbsolu: positiveInt,
  montantFCFA: nonNegativeNumber,
});
export type UpsertChargeMensuelleInput = z.infer<typeof upsertChargeMensuelleSchema>;

/**
 * Report d'une meme charge sur une plage de mois consecutifs (Sprint
 * PR2-ter, story PR2ter.1). `moisFinAbsolu >= moisDebutAbsolu` verifie via
 * `.refine` (borne haute jamais avant la borne basse).
 */
export const reporterChargeMensuelleSchema = z
  .object({
    montantFCFA: nonNegativeNumber,
    moisDebutAbsolu: positiveInt,
    moisFinAbsolu: positiveInt,
  })
  .refine((d) => d.moisFinAbsolu >= d.moisDebutAbsolu, {
    message: "moisFinAbsolu doit etre superieur ou egal a moisDebutAbsolu.",
    path: ["moisFinAbsolu"],
  });
export type ReporterChargeMensuelleInput = z.infer<typeof reporterChargeMensuelleSchema>;

// ---------------------------------------------------------------------------
// JournalDepensePrevue / ApportCapital
// ---------------------------------------------------------------------------

export const createJournalDepensePrevueSchema = z.object({
  date: isoDateString,
  libelle: z.string().min(1, "Le libelle est obligatoire."),
  categorie: z.nativeEnum(CategorieJournalPrevu),
  montantFCFA: nonNegativeNumber,
  vaguePrevueId: z.string().nullable().optional(),
});
export type CreateJournalDepensePrevueInput = z.infer<typeof createJournalDepensePrevueSchema>;

export const updateJournalDepensePrevueSchema = createJournalDepensePrevueSchema.partial();
export type UpdateJournalDepensePrevueInput = z.infer<typeof updateJournalDepensePrevueSchema>;

export const createApportCapitalSchema = z.object({
  date: isoDateString,
  libelle: z.string().min(1, "Le libelle est obligatoire."),
  montantFCFA: nonNegativeNumber,
  type: z.nativeEnum(TypeApportCapital),
});
export type CreateApportCapitalInput = z.infer<typeof createApportCapitalSchema>;
