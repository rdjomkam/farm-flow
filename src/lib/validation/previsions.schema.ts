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
  SourceRapprochement,
  CibleRapprochement,
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
  /**
   * Tresorerie d'ouverture (§4.1 des exigences) — LIBRE, peut etre
   * negative (un scenario peut demarrer decouvert) : surtout PAS de
   * `.min(0)` ici, contrairement aux champs de transport ci-dessus.
   * Optionnel a la creation/mise a jour, retombe sur le `@default(0)` du
   * schema si absent.
   */
  tresorerieInitialeFCFA: z.number().optional(),
});

export const createScenarioSchema = z.object({
  code: z.string().min(1, "Le code est obligatoire."),
  nom: z.string().min(1, "Le nom est obligatoire."),
  description: z.string().nullable().optional(),
  dureeCycleMois: strictPositiveInt.optional(),
  dateDebutPlan: isoDateString,
  parametres: parametresPrevisionCreateSchema,
  /**
   * ADR-053 §18 — selection explicite des Produit ALIMENT a copier vers le
   * scenario. ABSENT (jamais envoye par le client) : comportement actuel
   * STRICTEMENT inchange (copie de tous les Produit ALIMENT actifs du site,
   * garde 422 tout-ou-rien inchange sur `tailleGranule`) — ne pas confondre
   * avec un tableau vide. PRESENT ET `[]` : selection vide explicitement
   * autorisee (arbitrage c), scenario cree sans calibre, signal explicite
   * via `nombreCalibresAlimentsCrees` en reponse (voir
   * `src/components/previsions/api-types.ts`). PRESENT ET NON VIDE : chaque
   * id est valide par le garde serveur (appartenance au site, categorie
   * ALIMENT, actif, ET eligible au sens de
   * `evaluerEligibiliteProduitAlimentairePrevision`,
   * `src/lib/previsions/eligibilite.ts`) — AVANT toute ecriture, jamais apres coup dans la
   * transaction (§18, point 6 des arbitrages deja tranches).
   */
  produitIds: z.array(z.string().min(1)).optional(),
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

/**
 * ADR-053 §16.6/§16.12 (story A.5) — contrat XOR ACTIVE : `posteReferentielId`
 * XOR `nouveauPosteReferentielLibelle`, exactement l'un des deux. La
 * validation XOR elle-meme (avec les codes machine
 * `POSTE_REFERENTIEL_CHAMPS_EXCLUSIFS`/`POSTE_REFERENTIEL_CHAMP_REQUIS`) reste
 * appliquee par `createPostePrevision` (`src/lib/queries/previsions-charges.ts`,
 * `BusinessRuleError` avec `status`/`code` explicites) — c'est la query qui
 * reste le seul point de verite METIER pour la distinction
 * CHAMPS_EXCLUSIFS/CHAMP_REQUIS, jamais deux implementations divergentes de
 * la logique. Ce schema Zod ne fait que typer/exiger la PRESENCE d'au moins
 * un champ non vide (filet de securite au niveau forme du payload, avant
 * meme d'atteindre la query) : quand ce filet rejette (aucun champ fourni),
 * il court-circuite la requete AVANT la query — la branche
 * `POSTE_REFERENTIEL_CHAMP_REQUIS` de `createPostePrevision` devient alors du
 * code mort cote route si ce refine ne porte pas lui-meme le meme `code`
 * machine. Corrige (review story A.5, ecart Moyenne #1) via `params.code`,
 * relaye par `parseBody` (`src/app/api/previsions/_shared.ts`) — le refine ne
 * duplique aucune logique de decision, il ne fait que reetiqueter avec le
 * MEME code documente le meme cas qu'aurait rejete la query. Le cas
 * symetrique (les deux champs fournis, `POSTE_REFERENTIEL_CHAMPS_EXCLUSIFS`)
 * n'a PAS besoin du meme traitement : ce refine utilise un OU (`||`), pas un
 * XOR strict, donc "les deux fournis" passe la validation Zod et atteint
 * reellement `createPostePrevision`, qui leve alors son `BusinessRuleError`
 * normalement intercepte par `handleApiError` — code deja vivant, verifie a
 * la lecture (aucun court-circuit avant la query pour ce cas).
 */
export const createPostePrevisionSchema = z
  .object({
    libelle: z.string().min(1, "Le libelle est obligatoire."),
    type: z.nativeEnum(TypePostePrevision),
    inclusBaseRepartition: z.boolean().optional(),
    ordre: positiveInt,
    posteReferentielId: z.string().min(1).optional(),
    nouveauPosteReferentielLibelle: z.string().min(1).optional(),
  })
  .refine((d) => !!d.posteReferentielId || !!d.nouveauPosteReferentielLibelle, {
    message: "Selectionnez une entree du referentiel ou creez-en une nouvelle.",
    path: ["posteReferentielId"],
    // ADR-053 §16.12 (story A.5, correctif review Moyenne #1) — ce court-circuit
    // Zod produit le MEME 400 que `createPostePrevision` (previsions-charges.ts)
    // aurait leve si la requete avait atteint la query, donc DOIT porter le
    // MEME code machine documente, sous peine que le contrat §16.12 ne soit
    // jamais observable par un appelant HTTP reel (le refine s'execute avant
    // la query, la branche `BusinessRuleError` correspondante devient alors
    // du code mort). `params.code` est le mecanisme GENERIQUE relaye par
    // `parseBody` (`src/app/api/previsions/_shared.ts`) — reutilisable par
    // tout autre `.refine()` du projet, pas un bricolage propre a cette route.
    params: { code: "POSTE_REFERENTIEL_CHAMP_REQUIS" },
  });
export type CreatePostePrevisionInput = z.infer<typeof createPostePrevisionSchema>;

/**
 * PATCH /api/previsions/postes-referentiel/[id] (ADR-053 §16.12, story A.5,
 * "Arbitrage 1") — `libelle` UNIQUEMENT. `.strict()` : un champ `code`
 * (ou tout autre champ) dans le body est REFUSE explicitement (400), jamais
 * ignore silencieusement — un appelant qui croit pouvoir changer `code` doit
 * etre informe que ce n'est pas possible, pas laisse croire que ca a marche.
 */
export const renommerPosteReferentielSchema = z
  .object({
    libelle: z.string().min(1, "Le libelle est obligatoire."),
  })
  .strict();
export type RenommerPosteReferentielInput = z.infer<typeof renommerPosteReferentielSchema>;

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

// ---------------------------------------------------------------------------
// MappingRapprochement / ClotureMois (Sprint PR3, story PR3.6)
// ---------------------------------------------------------------------------

/**
 * Separateur du couple compose `cibleId` d'un mapping `ALIMENT_PREVISION`
 * (Sprint PR3-ter, story A.3 — cf. `src/lib/queries/previsions-
 * rapprochement.ts`, section "0bis", SEULE source de verite du format :
 * `${tailleGranule}::${alimentPrevisionId}`). Duplique ici volontairement
 * (constante litterale, pas un import de la couche queries dans la couche
 * validation) pour eviter un couplage validation -> queries -> prisma —
 * garde par un test de non-regression qui verifie l'egalite des deux
 * constantes.
 */
const SEPARATEUR_CIBLE_ALIMENT_PREVISION = "::";

/**
 * `cibleId` d'un mapping `ALIMENT_PREVISION` doit desormais porter le couple
 * compose `tailleGranule::alimentPrevisionId` (Sprint PR3-ter, story A.3) —
 * la tailleGranule (cle metier stable inter-scenario, `@@unique([scenarioId,
 * tailleGranule])`) est la SEULE partie utilisee a la resolution
 * (`src/lib/queries/previsions-rapprochement.ts`, `versMappingActif`) ;
 * l'id documente l'AlimentPrevision d'origine, jamais relu pour la
 * resolution. Valide la NATURE du `cibleId` (format + tailleGranule connue),
 * pas seulement sa presence — un `cibleId` qui ne serait qu'un cuid brut
 * (ancien format, pre-A.3) est desormais REJETE explicitement plutot que
 * silencieusement tolere.
 */
function cibleAlimentPrevisionEstBienFormee(cibleId: string): boolean {
  const indexSeparateur = cibleId.indexOf(SEPARATEUR_CIBLE_ALIMENT_PREVISION);
  if (indexSeparateur <= 0) return false;
  const tailleGranuleBrute = cibleId.slice(0, indexSeparateur);
  const idOrigine = cibleId.slice(indexSeparateur + SEPARATEUR_CIBLE_ALIMENT_PREVISION.length);
  const tailleGranuleConnue = (Object.values(TailleGranule) as string[]).includes(tailleGranuleBrute);
  return tailleGranuleConnue && idOrigine.length > 0;
}

/**
 * Une ligne du mapping (ADR-053 §3.9) — `cibleId` nullable (NON_RAPPROCHE
 * n'a pas de cible). `.refine()` (Sprint PR3-bis, story PR3bis.1, pre-analyse
 * section 1 : gap signale par la review PR3) : lie explicitement la presence
 * de `cibleId` a `cibleType`, plutot que de laisser le moteur traiter
 * silencieusement une ligne mal formee comme NON_RAPPROCHE
 * (`previsions-rapprochement.ts:105-113`, `cibleCle = null` si `cibleId`
 * absent). `POSTE_PREVISION`/`ALIMENT_PREVISION` exigent un `cibleId` reel
 * (FK) ; `VENTE_PREVUE` (cible singleton batie depuis `sourceCle`, jamais un
 * FK, `previsions-rapprochement.ts:113-114`) et `NON_RAPPROCHE` (aucune
 * cible, ADR-053 section 5) exigent `cibleId` absent/`null`.
 *
 * Sprint PR3-ter, story A.3 : pour `ALIMENT_PREVISION` specifiquement, le
 * `cibleId` doit en plus respecter le format compose `tailleGranule::id`
 * (voir `cibleAlimentPrevisionEstBienFormee` ci-dessus) — la NATURE du
 * `cibleId` est validee, pas seulement sa presence.
 */
export const ligneMappingRapprochementInputSchema = z
  .object({
    sourceType: z.nativeEnum(SourceRapprochement),
    sourceCle: z.string().min(1, "sourceCle est obligatoire."),
    cibleType: z.nativeEnum(CibleRapprochement),
    cibleId: z.string().nullable().optional(),
  })
  .superRefine((ligne, ctx) => {
    const exigeCibleId =
      ligne.cibleType === CibleRapprochement.POSTE_PREVISION ||
      ligne.cibleType === CibleRapprochement.ALIMENT_PREVISION;
    const aCibleId = ligne.cibleId !== null && ligne.cibleId !== undefined && ligne.cibleId !== "";
    if (exigeCibleId && !aCibleId) {
      ctx.addIssue({
        code: "custom",
        path: ["cibleId"],
        message: "cibleId est obligatoire pour cibleType POSTE_PREVISION ou ALIMENT_PREVISION.",
      });
    }
    if (!exigeCibleId && aCibleId) {
      ctx.addIssue({
        code: "custom",
        path: ["cibleId"],
        message: "cibleId doit etre absent (ou null) pour cibleType VENTE_PREVUE ou NON_RAPPROCHE.",
      });
    }
    if (
      ligne.cibleType === CibleRapprochement.ALIMENT_PREVISION &&
      aCibleId &&
      !cibleAlimentPrevisionEstBienFormee(ligne.cibleId as string)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["cibleId"],
        message:
          "cibleId doit etre au format 'tailleGranule::alimentPrevisionId' pour cibleType ALIMENT_PREVISION.",
      });
    }
  });
export type LigneMappingRapprochementInput = z.infer<typeof ligneMappingRapprochementInputSchema>;

/**
 * Remplacement en bloc du mapping d'un site — cree une NOUVELLE VERSION
 * (jamais un UPDATE en place, ADR-053 §3.9/§15.3). `lignes` doit contenir
 * AU MOINS une ligne : une version vide desactiverait tout le
 * rapprochement du site (garde identique cote query,
 * `creerVersionMapping`, verifiee ici en amont pour un message 400 immediat
 * plutot qu'un aller-retour serveur).
 */
export const creerVersionMappingSchema = z.object({
  lignes: z
    .array(ligneMappingRapprochementInputSchema)
    .min(1, "Le mapping doit contenir au moins une ligne."),
});
export type CreerVersionMappingInput = z.infer<typeof creerVersionMappingSchema>;

/**
 * `version` traverse un query param (string | null) — jamais `z.coerce.number()` seul (voir apercuGenerationPlanQuerySchema).
 *
 * `scenarioId` (Sprint PR3-ter, story A.2) : OPTIONNEL — sans lui, `GET`
 * renvoie le mapping brut, comportement inchange (retro-compatible avec
 * l'appel de `MappingFormDialog`, qui ne relit le mapping actif QUE pour
 * construire le payload du POST, jamais pour afficher un etat orphelin).
 * Fourni, il declenche l'augmentation `cibleOrpheline`/`cibleCleResolue`
 * (`detecterCiblesOrphelines`, `src/lib/queries/previsions-mapping-
 * orphelins.ts`, story A.1) contre CE scenario precis — jamais une validation
 * de forme (cuid) plus stricte que necessaire : une simple chaine non vide
 * suffit, la resolution du scenario echoue explicitement plus loin si l'id
 * est invalide (meme comportement que les autres routes `[id]` du module).
 */
export const mappingRapprochementQuerySchema = z.object({
  version: z
    .string()
    .optional()
    .refine((v) => v === undefined || (v.length > 0 && Number.isInteger(Number(v)) && Number(v) >= 0), {
      message: "Le parametre 'version' doit etre un entier positif ou nul.",
    })
    .transform((v) => (v === undefined ? undefined : Number(v))),
  scenarioId: z.string().min(1).optional(),
});
export type MappingRapprochementQueryInput = z.infer<typeof mappingRapprochementQuerySchema>;

export const cloturerMoisSchema = z.object({
  moisAbsolu: positiveInt,
});
export type CloturerMoisInput = z.infer<typeof cloturerMoisSchema>;
