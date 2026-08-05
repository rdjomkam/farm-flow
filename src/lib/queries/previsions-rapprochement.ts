/**
 * src/lib/queries/previsions-rapprochement.ts
 *
 * Queries Prisma — couche de LECTURE du reel pour le rapprochement
 * prevu/reel (Sprint PR3, story PR3.5). Reference ADR-053 section 5,
 * section 15 entiere (15.1 SANS_SOURCE_REELLE, 15.3 historisation du
 * mapping, 15.6 discipline de test).
 *
 * ROLE STRICT DE CE FICHIER : charger le prevu (depuis un scenario) et le
 * reel (Depense/Vente/MouvementStock, agreges en base), resoudre le mapping
 * applicable, puis appeler le moteur PUR `reconcilierPrevuEtReel`
 * (`src/lib/previsions/rapprochement.ts`) — CE FICHIER NE RECALCULE RIEN
 * (aucun ecart, aucun signe, aucune couleur). Toute logique de comparaison
 * vit exclusivement dans le moteur (ADR-053 section 15.6 point 2, ERR-171).
 *
 * R8 : `siteId` filtre sur CHAQUE requete, y compris les agregations SQL
 *      brutes ci-dessous.
 * R2 : tous les enums reels (`CategorieDepense`, `TypeMouvement`,
 *      `CategorieProduit`, `TailleGranule`) sont importes depuis "@/types",
 *      jamais une valeur litterale non typee cote TypeScript (les valeurs
 *      apparaissent en dur UNIQUEMENT a l'interieur des requetes SQL, comme
 *      valeurs de filtre — comportement identique a du SQL Prisma
 *      equivalent `where: { type: TypeMouvement.SORTIE }`).
 *
 * INTERDICTION ABSOLUE (ADR-053 section 5.1(a), rappelee section 15.6
 * dernier paragraphe) : ce module N'ECRIT JAMAIS dans `Depense`, `Vente`,
 * `MouvementStock`, `LigneDepense`, `Produit` ni aucune table du domaine
 * reel — uniquement des `SELECT`/`$queryRaw` en lecture. Aucune fonction de
 * ce fichier n'appelle `create`/`update`/`delete`/`upsert` sur une table du
 * domaine reel.
 *
 * Granulometrie cote achats (pre-analyse PR3, section A) : le chemin
 * FIABLE est `MouvementStock.produitId -> Produit.tailleGranule` (FK non
 * nullable). Le chemin `Depense -> LigneDepense.produitId? ->
 * Produit.tailleGranule` est nullable a DEUX niveaux (une Depense peut
 * n'avoir aucune LigneDepense ; une LigneDepense peut n'avoir aucun
 * produitId) — `getDepensesAlimentReellesParGranulometrie` ci-dessous
 * rattache explicitement ces montants a un bucket "GRANULOMETRIE_INCONNUE"
 * VISIBLE, jamais reparti arbitrairement ni omis silencieusement.
 */
import { prisma } from "@/lib/db";
import { CategorieDepense, SourceRapprochement, CibleRapprochement, TailleGranule } from "@/types";
import { BusinessRuleError } from "@/lib/errors";
import { Decimal } from "@/lib/previsions/decimal-config";
import type {
  EntreePrevueRapprochement,
  EntreeReelleAgregee,
  MappingRapprochementActif,
} from "@/lib/previsions/rapprochement";
import { reconcilierPrevuEtReel } from "@/lib/previsions/rapprochement";
import type { LigneRapprochement } from "@/lib/previsions/types";
import {
  chargerScenarioPourMoteur,
  type ScenarioPourCalcul,
} from "@/lib/queries/previsions-scenario-loader";
import {
  calculerProjectionScenario,
  moisAbsoluDepuis,
  type ProjectionScenarioResult,
} from "@/lib/previsions/route-orchestration";
import { getMappingActif, getMappingParVersion } from "@/lib/queries/previsions-rapprochement-mapping";

/** Bucket explicite pour une granulometrie non determinable (JAMAIS omis, JAMAIS reparti arbitrairement). */
export const GRANULOMETRIE_INCONNUE = "GRANULOMETRIE_INCONNUE";

/* ------------------------------------------------------------------ *
 * 0. Convention de namespacing des cles (partagee reel <-> mapping)
 * ------------------------------------------------------------------ */

/**
 * Compose la `categorieCle` d'une `EntreeReelleAgregee` / le `sourceCle` cote
 * moteur a partir du couple (sourceType, valeur litterale reelle). Sert de
 * SEULE source de verite pour ce format — utilise a la fois par les
 * fonctions d'agregation du reel ci-dessous et par la resolution du mapping,
 * pour garantir qu'une meme categorie produit toujours la meme cle des deux
 * cotes (namespace necessaire : "ALIMENT" existe a la fois comme
 * `CategorieDepense` et comme `CategorieProduit`, sans ce prefixe les deux
 * collisionneraient).
 */
export function composeCategorieCle(sourceType: SourceRapprochement, valeur: string): string {
  return `${sourceType}:${valeur}`;
}

/** Cles prevues fixes pour le revenu de vente (pas d'entite propre, cf. ADR-053 §3.9/§15.1). */
export const CLE_VENTE_PREVUE_MONTANT = "VENTE_PREVUE:MONTANT";
export const CLE_VENTE_PREVUE_TONNAGE = "VENTE_PREVUE:TONNAGE";
/** Cle prevue fixe des apports en capital — toujours SANS_SOURCE_REELLE (ADR-053 §15.1). */
export const CLE_APPORT_CAPITAL = "APPORT_CAPITAL";

/* ------------------------------------------------------------------ *
 * 0bis. Portee du mapping ALIMENT_PREVISION (correction structurelle,
 * Sprint PR3-ter story A.3 — pre-analyse PR3ter.A)
 * ------------------------------------------------------------------ *
 *
 * `AlimentPrevision` est SCENARIO-scope (`@@unique([scenarioId,
 * tailleGranule])`, prisma/schema.prisma) alors que `MappingRapprochement`
 * est SITE-scope (ADR-053 §3.9). Porter directement `AlimentPrevision.id`
 * (FK d'un scenario precis, potentiellement archive) dans `cibleId` reproduit
 * exactement le defaut qui fait disparaitre silencieusement un montant reel
 * (pre-analyse PR3ter.A) : lu depuis un AUTRE scenario que celui d'origine,
 * ce `cibleId` ne correspond a AUCUN `AlimentPrevision.cle` du scenario
 * courant, mais n'est pas non plus `null` — le montant s'accumule sous une
 * cle morte (`src/lib/previsions/rapprochement.ts:310-322`) puis n'est
 * jamais relu (ligne 343-344, `?? new Decimal(0)`), sans jamais apparaitre
 * dans NON_RAPPROCHE (une cible NON NULLE a bien ete resolue).
 *
 * Correction : `cibleId` porte desormais un COUPLE compose
 * `${tailleGranule}::${alimentPrevisionId}` — `tailleGranule` est la cle
 * METIER STABLE inter-scenario (existe deja, `@@unique([scenarioId,
 * tailleGranule])` garantit au plus un AlimentPrevision par tailleGranule et
 * par scenario) ; `alimentPrevisionId` documente l'AlimentPrevision
 * D'ORIGINE selectionne au moment de la creation du mapping (utile pour
 * l'affichage/l'audit), mais N'EST JAMAIS UTILISE pour la resolution. La
 * resolution vers l'AlimentPrevision du scenario COURANT se fait
 * DYNAMIQUEMENT a la lecture (`versMappingActif` ci-dessous), via la
 * tailleGranule uniquement — jamais via l'id fige. Si le scenario courant ne
 * porte aucun AlimentPrevision pour cette tailleGranule, la resolution
 * echoue explicitement (`cibleCle = null`) : le montant reel tombe alors
 * dans le bac NON_RAPPROCHE (visible, jamais perdu) plutot que sous une cle
 * morte invisible — c'est l'amelioration structurelle de cette story par
 * rapport au defaut d'origine. Le filet de securite (story A.1,
 * `previsions-mapping-orphelins.ts`) signale en plus, cote administration du
 * mapping, cette ligne comme `cibleOrpheline` a part entiere.
 *
 * AUCUNE migration R10 necessaire : `MappingRapprochement` compte 0 ligne en
 * base au moment de cette story (revérifié par SQL, pre-analyse PR3ter.A) —
 * ce format ne remplace donc aucune donnee existante.
 */
const SEPARATEUR_CIBLE_ALIMENT_PREVISION = "::";

/**
 * Compose la valeur `cibleId` d'un mapping `ALIMENT_PREVISION` (A.3) :
 * `tailleGranule` (cle metier stable, utilisee seule a la resolution) suivi
 * de l'id de l'`AlimentPrevision` selectionne a la creation (documentaire
 * uniquement, jamais relu pour la resolution).
 */
export function composeCibleAlimentPrevision(
  tailleGranule: TailleGranule,
  alimentPrevisionId: string
): string {
  return `${tailleGranule}${SEPARATEUR_CIBLE_ALIMENT_PREVISION}${alimentPrevisionId}`;
}

/** Resultat de `parseCibleAlimentPrevision` — les deux composantes du couple compose (A.3). */
export interface CibleAlimentPrevisionParsee {
  /** `null` si `cibleId` est absent ou dans un format non reconnu (jamais lance en exception ici). */
  tailleGranule: TailleGranule | null;
  /** id de l'AlimentPrevision d'origine — documentaire, jamais utilise pour la resolution. */
  alimentPrevisionIdOrigine: string | null;
}

/**
 * Decompose le `cibleId` compose d'un mapping `ALIMENT_PREVISION` (A.3).
 * Fonction PURE, aucune I/O — la resolution vers un `AlimentPrevision` reel
 * du scenario courant est faite par l'appelant (`versMappingActif`), jamais
 * ici.
 */
export function parseCibleAlimentPrevision(cibleId: string | null): CibleAlimentPrevisionParsee {
  if (!cibleId) {
    return { tailleGranule: null, alimentPrevisionIdOrigine: null };
  }
  const indexSeparateur = cibleId.indexOf(SEPARATEUR_CIBLE_ALIMENT_PREVISION);
  if (indexSeparateur === -1) {
    // Format non reconnu (jamais produit par ce module) — aucune tailleGranule
    // extractible, resolution impossible en amont (jamais une exception ici).
    return { tailleGranule: null, alimentPrevisionIdOrigine: null };
  }
  const tailleGranuleBrute = cibleId.slice(0, indexSeparateur);
  const alimentPrevisionIdOrigine =
    cibleId.slice(indexSeparateur + SEPARATEUR_CIBLE_ALIMENT_PREVISION.length) || null;
  const tailleGranule = (Object.values(TailleGranule) as string[]).includes(tailleGranuleBrute)
    ? (tailleGranuleBrute as TailleGranule)
    : null;
  return { tailleGranule, alimentPrevisionIdOrigine };
}

/**
 * Resout, pour une `tailleGranule` donnee, l'`AlimentPrevision.id` du
 * scenario COURANT (A.3) — au plus un resultat possible
 * (`@@unique([scenarioId, tailleGranule])`). Requete UNIQUE, jamais en
 * boucle par ligne de mapping (evite un N+1 sur un mapping a N lignes
 * ALIMENT_PREVISION).
 */
export async function chargerResolveurAlimentParTailleGranule(
  scenarioId: string
): Promise<(tailleGranule: TailleGranule) => string | null> {
  const aliments = await prisma.alimentPrevision.findMany({
    where: { scenarioId },
    select: { id: true, tailleGranule: true },
  });
  const idParTailleGranule = new Map<TailleGranule, string>();
  for (const aliment of aliments) {
    idParTailleGranule.set(aliment.tailleGranule as TailleGranule, aliment.id);
  }
  return (tailleGranule: TailleGranule) => idParTailleGranule.get(tailleGranule) ?? null;
}

/**
 * Resout, pour un `posteReferentielId` donne (SITE-scope, ADR-053 §16, story
 * A.4), le `PostePrevision.id` du scenario COURANT — au plus un resultat
 * possible (`@@unique([scenarioId, libelle])` implique en pratique au plus un
 * PostePrevision par entree referentiel dans un meme scenario, aucune route
 * ne permettant de lier deux PostePrevision d'un meme scenario a la meme
 * entree). Requete UNIQUE, jamais en boucle par ligne de mapping — meme
 * patron que `chargerResolveurAlimentParTailleGranule` ci-dessus, en
 * substituant `posteReferentielId` a `tailleGranule` comme cle metier stable.
 */
export async function chargerResolveurPosteParPosteReferentielId(
  scenarioId: string
): Promise<(posteReferentielId: string) => string | null> {
  const postes = await prisma.postePrevision.findMany({
    where: { scenarioId },
    select: { id: true, posteReferentielId: true },
  });
  const idParPosteReferentielId = new Map<string, string>();
  for (const poste of postes) {
    idParPosteReferentielId.set(poste.posteReferentielId, poste.id);
  }
  return (posteReferentielId: string) => idParPosteReferentielId.get(posteReferentielId) ?? null;
}

/**
 * Traduit une ligne `MappingRapprochement` (Prisma) en `MappingRapprochementActif`
 * (contrat du moteur pur). Seule fonction qui sait deriver `cibleCle` a
 * partir de (`cibleType`, `cibleId`) :
 * - `POSTE_PREVISION` : `cibleId` porte desormais un `PosteReferentiel.id`
 *   SITE-scope (ADR-053 §16, story A.4 — le meme scope que
 *   `MappingRapprochement` lui-meme), resolu DYNAMIQUEMENT vers le
 *   `PostePrevision` du scenario COURANT via `resoudrePosteCibleCle` —
 *   `null` si le scenario courant n'a aucun PostePrevision lie a cette
 *   entree referentiel (bac NON_RAPPROCHE, jamais une cle morte invisible) ;
 *   meme patron que `ALIMENT_PREVISION` ci-dessous.
 * - `ALIMENT_PREVISION` : `cibleId` compose (A.3 ci-dessus), resolu
 *   DYNAMIQUEMENT vers l'`AlimentPrevision` du scenario COURANT via
 *   `resoudreAlimentCibleCle` (jamais via l'id fige a la creation) —
 *   `null` si le scenario courant n'a aucun AlimentPrevision pour cette
 *   tailleGranule (bac NON_RAPPROCHE, jamais une cle morte invisible) ;
 * - `VENTE_PREVUE` : couple de sentinelles fixes disambiguees par
 *   `sourceCle` (MONTANT/TONNAGE, ADR-053 §15.1 : "vers le revenu prevu",
 *   pas une entite) ;
 * - `NON_RAPPROCHE` : retourne `null` (bac explicite du moteur, ADR-053
 *   section 5).
 */
function versMappingActif(
  ligne: {
    sourceType: string;
    sourceCle: string;
    cibleType: string;
    cibleId: string | null;
  },
  resoudreAlimentCibleCle: (tailleGranule: TailleGranule) => string | null,
  resoudrePosteCibleCle: (posteReferentielId: string) => string | null
): MappingRapprochementActif {
  const sourceCle = composeCategorieCle(ligne.sourceType as SourceRapprochement, ligne.sourceCle);

  let cibleCle: string | null;
  switch (ligne.cibleType as CibleRapprochement) {
    case CibleRapprochement.POSTE_PREVISION:
      cibleCle = ligne.cibleId !== null ? resoudrePosteCibleCle(ligne.cibleId) : null;
      break;
    case CibleRapprochement.ALIMENT_PREVISION: {
      const { tailleGranule } = parseCibleAlimentPrevision(ligne.cibleId);
      cibleCle = tailleGranule !== null ? resoudreAlimentCibleCle(tailleGranule) : null;
      break;
    }
    case CibleRapprochement.VENTE_PREVUE:
      cibleCle = `VENTE_PREVUE:${ligne.sourceCle}`;
      break;
    case CibleRapprochement.NON_RAPPROCHE:
    default:
      cibleCle = null;
      break;
  }

  return { sourceCle, cibleCle };
}

/* ------------------------------------------------------------------ *
 * 1. Resolution du mapping applicable a un mois (ADR-053 section 15.3)
 * ------------------------------------------------------------------ */

/**
 * Determine la VERSION de `MappingRapprochement` applicable a un mois donne
 * (ADR-053 section 15.3 — coeur de l'immuabilite de l'historique) :
 * - mois CLOTURE (`ClotureMois` existe pour ce scenario/mois) -> la version
 *   FIGEE au moment de la cloture (`ClotureMois.versionMapping`), quelle que
 *   soit la version `actif` courante au moment de la lecture ;
 * - mois NON CLOTURE -> `null`, qui signifie "utiliser le mapping ACTIF
 *   courant" (comportement dynamique legitime tant que le mois n'est pas
 *   clos, ADR-053 §15.3).
 *
 * C'est la SEULE fonction du module qui doit decider cette bascule — aucune
 * autre fonction ne doit relire `ClotureMois` ailleurs dans ce fichier
 * (evite qu'une variante oublie le filtre et relise silencieusement le
 * mapping actif pour un mois clos).
 */
export async function resoudreVersionMappingPourMois(
  scenarioId: string,
  siteId: string,
  moisAbsolu: number
): Promise<number | null> {
  const cloture = await prisma.clotureMois.findFirst({
    where: { scenarioId, siteId, moisAbsolu },
    select: { versionMapping: true },
  });
  return cloture?.versionMapping ?? null;
}

/**
 * Mapping actif RESOLU pour un mois donne (ADR-053 §15.3) : applique
 * `resoudreVersionMappingPourMois` puis lit soit `getMappingParVersion`
 * (mois clos, version figee), soit `getMappingActif` (mois ouvert, version
 * courante) — jamais l'inverse.
 *
 * Fonction pratique pour une lecture PONCTUELLE (un seul mois, ex. une route
 * API qui affiche le detail d'un mois). Pour l'orchestration multi-mois
 * (`calculerRapprochementScenario` ci-dessous), une version groupee evite le
 * N+1 (une requete `ClotureMois` sur toute la periode + une requete par
 * VERSION DISTINCTE de mapping, jamais une requete par mois).
 */
export async function getMappingActifResoluPourMois(
  scenarioId: string,
  siteId: string,
  moisAbsolu: number
): Promise<MappingRapprochementActif[]> {
  const [versionFigee, resoudreAlimentCibleCle, resoudrePosteCibleCle] = await Promise.all([
    resoudreVersionMappingPourMois(scenarioId, siteId, moisAbsolu),
    chargerResolveurAlimentParTailleGranule(scenarioId),
    chargerResolveurPosteParPosteReferentielId(scenarioId),
  ]);
  const lignes =
    versionFigee !== null
      ? await getMappingParVersion(siteId, versionFigee)
      : await getMappingActif(siteId);
  return lignes.map((l) => versMappingActif(l, resoudreAlimentCibleCle, resoudrePosteCibleCle));
}

/**
 * Version groupee, BORNEE : une requete `ClotureMois` sur toute la periode
 * `[moisDebut, moisFin]`, puis une requete de mapping par VERSION DISTINCTE
 * rencontree (jamais une requete par mois — evite le N+1 sur un horizon de
 * plusieurs dizaines de mois). Retourne le mapping resolu PAR MOIS.
 */
async function getMappingResoluParMois(
  scenarioId: string,
  siteId: string,
  moisDebut: number,
  moisFin: number
): Promise<Map<number, MappingRapprochementActif[]>> {
  const [clotures, resoudreAlimentCibleCle, resoudrePosteCibleCle] = await Promise.all([
    prisma.clotureMois.findMany({
      where: { scenarioId, siteId, moisAbsolu: { gte: moisDebut, lte: moisFin } },
      select: { moisAbsolu: true, versionMapping: true },
    }),
    chargerResolveurAlimentParTailleGranule(scenarioId),
    chargerResolveurPosteParPosteReferentielId(scenarioId),
  ]);

  const versionParMois = new Map<number, number>();
  const versionsDistinctes = new Set<number>();
  for (const c of clotures) {
    versionParMois.set(c.moisAbsolu, c.versionMapping);
    versionsDistinctes.add(c.versionMapping);
  }

  const mappingParVersion = new Map<number, MappingRapprochementActif[]>();
  for (const version of versionsDistinctes) {
    const lignes = await getMappingParVersion(siteId, version);
    mappingParVersion.set(
      version,
      lignes.map((l) => versMappingActif(l, resoudreAlimentCibleCle, resoudrePosteCibleCle))
    );
  }

  const mappingActifCourant = (await getMappingActif(siteId)).map((l) =>
    versMappingActif(l, resoudreAlimentCibleCle, resoudrePosteCibleCle)
  );

  const resultat = new Map<number, MappingRapprochementActif[]>();
  for (let mois = moisDebut; mois <= moisFin; mois++) {
    const versionFigee = versionParMois.get(mois);
    resultat.set(
      mois,
      versionFigee !== undefined ? (mappingParVersion.get(versionFigee) ?? []) : mappingActifCourant
    );
  }
  return resultat;
}

/* ------------------------------------------------------------------ *
 * 2. Detection des categories reelles non mappees (ADR-053 section 5)
 * ------------------------------------------------------------------ */

/**
 * Set-diff PUR (aucune I/O, aucun recalcul d'ecart) : liste les
 * `categorieCle` presentes dans les donnees reelles du site sans entree de
 * mapping actif correspondante — c'est la donnee qui alimente le bac
 * `NON_RAPPROCHE` du moteur (deja gere par `reconcilierPrevuEtReel`, jamais
 * reimplemente ici). Utile independamment du rapprochement complet pour une
 * vue d'administration ("categories a mapper").
 */
export function identifierCategoriesReellesSansMapping(
  entreesReelles: EntreeReelleAgregee[],
  mapping: MappingRapprochementActif[]
): string[] {
  const mappees = new Set(mapping.map((m) => m.sourceCle));
  const nonMappees = new Set<string>();
  for (const entree of entreesReelles) {
    if (!mappees.has(entree.categorieCle)) {
      nonMappees.add(entree.categorieCle);
    }
  }
  return Array.from(nonMappees).sort();
}

/* ------------------------------------------------------------------ *
 * 3. Bornes de dates pour un intervalle de moisAbsolu
 * ------------------------------------------------------------------ */

function validerIntervalleMois(moisDebut: number, moisFin: number): void {
  if (moisFin < moisDebut) {
    throw new BusinessRuleError(
      "L'intervalle de mois est invalide : moisFin doit etre >= moisDebut.",
      400
    );
  }
}

/** Premiere date (incluse) du mois `moisAbsolu`, en calendrier LOCAL — meme convention que `moisAbsoluDepuis`. */
function bordDebutMois(dateDebutPlan: Date, moisAbsolu: number): Date {
  return new Date(dateDebutPlan.getFullYear(), dateDebutPlan.getMonth() + moisAbsolu, 1);
}

/** Borne de fin EXCLUSIVE (premier jour du mois suivant `moisFin`). */
function bordFinExclusive(dateDebutPlan: Date, moisFin: number): Date {
  return new Date(dateDebutPlan.getFullYear(), dateDebutPlan.getMonth() + moisFin + 1, 1);
}

/* ------------------------------------------------------------------ *
 * 4. Agregations du reel — Depense par CategorieDepense
 * ------------------------------------------------------------------ */

interface LigneAggDepense {
  annee: number;
  mois: number;
  cle: string;
  montant: string;
}

/**
 * `Depense` agregee par (`categorieDepense`, mois calendaire) — SUM en base
 * (`$queryRaw`, jamais une somme JS sur toutes les lignes brutes). Filtre
 * `siteId` (R8) et periode `[moisDebut, moisFin]` (bornes de `moisAbsolu`,
 * convertie en dates via `dateDebutPlan`).
 */
export async function getDepensesReellesParCategorie(
  siteId: string,
  dateDebutPlan: Date,
  moisDebut: number,
  moisFin: number
): Promise<EntreeReelleAgregee[]> {
  validerIntervalleMois(moisDebut, moisFin);
  const borneDebut = bordDebutMois(dateDebutPlan, moisDebut);
  const borneFin = bordFinExclusive(dateDebutPlan, moisFin);

  const lignes = await prisma.$queryRaw<LigneAggDepense[]>`
    SELECT
      EXTRACT(YEAR FROM "date")::int AS annee,
      EXTRACT(MONTH FROM "date")::int AS mois,
      "categorieDepense"::text AS cle,
      SUM("montantTotal")::text AS montant
    FROM "Depense"
    WHERE "siteId" = ${siteId}
      AND "date" >= ${borneDebut}
      AND "date" < ${borneFin}
    GROUP BY 1, 2, 3
  `;

  return lignes.map((l) => ({
    categorieCle: composeCategorieCle(SourceRapprochement.DEPENSE_CATEGORIE, l.cle),
    moisAbsolu: moisAbsoluDepuis(dateDebutPlan, new Date(l.annee, l.mois - 1, 1)),
    montantReel: new Decimal(l.montant ?? "0"),
    natureGrandeur: "DEPENSE",
  }));
}

/* ------------------------------------------------------------------ *
 * 5. Agregations du reel — Vente (montant + tonnage)
 * ------------------------------------------------------------------ */

interface LigneAggVente {
  annee: number;
  mois: number;
  montant: string;
  poids: string;
}

/**
 * `Vente` agregee par mois calendaire (`dateCommande`) — deux grandeurs :
 * `montantTotal` (recette, nature ENTREE, cle `VENTE:MONTANT`) et
 * `poidsTotalKg` (tonnage sorti, nature QUANTITE, cle `VENTE:TONNAGE`).
 * SUM en base, filtre `siteId` (R8) et periode.
 */
export async function getVentesReelles(
  siteId: string,
  dateDebutPlan: Date,
  moisDebut: number,
  moisFin: number
): Promise<EntreeReelleAgregee[]> {
  validerIntervalleMois(moisDebut, moisFin);
  const borneDebut = bordDebutMois(dateDebutPlan, moisDebut);
  const borneFin = bordFinExclusive(dateDebutPlan, moisFin);

  const lignes = await prisma.$queryRaw<LigneAggVente[]>`
    SELECT
      EXTRACT(YEAR FROM "dateCommande")::int AS annee,
      EXTRACT(MONTH FROM "dateCommande")::int AS mois,
      SUM("montantTotal")::text AS montant,
      SUM("poidsTotalKg")::text AS poids
    FROM "Vente"
    WHERE "siteId" = ${siteId}
      AND "dateCommande" >= ${borneDebut}
      AND "dateCommande" < ${borneFin}
    GROUP BY 1, 2
  `;

  const resultat: EntreeReelleAgregee[] = [];
  for (const l of lignes) {
    const moisAbsolu = moisAbsoluDepuis(dateDebutPlan, new Date(l.annee, l.mois - 1, 1));
    resultat.push({
      categorieCle: composeCategorieCle(SourceRapprochement.VENTE, "MONTANT"),
      moisAbsolu,
      montantReel: new Decimal(l.montant ?? "0"),
      natureGrandeur: "ENTREE",
    });
    resultat.push({
      categorieCle: composeCategorieCle(SourceRapprochement.VENTE, "TONNAGE"),
      moisAbsolu,
      montantReel: new Decimal(l.poids ?? "0"),
      natureGrandeur: "QUANTITE",
    });
  }
  return resultat;
}

/* ------------------------------------------------------------------ *
 * 6. Agregations du reel — MouvementStock SORTIE aliment par granulometrie
 * ------------------------------------------------------------------ */

interface LigneAggMouvement {
  annee: number;
  mois: number;
  granulometrie: string;
  quantite: string;
}

/**
 * `MouvementStock` de type `SORTIE` sur des produits `categorie = ALIMENT`,
 * agrege par mois calendaire et par `Produit.tailleGranule` — chemin FIABLE
 * de la granulometrie cote reel (`MouvementStock.produitId` est une FK NON
 * nullable, cf. en-tete de fichier). SUM en base, filtre `siteId` (R8) et
 * periode. `COALESCE(..., 'INCONNU')` couvre le cas theorique d'un produit
 * ALIMENT sans `tailleGranule` renseignee (jamais omis).
 */
export async function getSortiesAlimentReellesParGranulometrie(
  siteId: string,
  dateDebutPlan: Date,
  moisDebut: number,
  moisFin: number
): Promise<EntreeReelleAgregee[]> {
  validerIntervalleMois(moisDebut, moisFin);
  const borneDebut = bordDebutMois(dateDebutPlan, moisDebut);
  const borneFin = bordFinExclusive(dateDebutPlan, moisFin);

  const lignes = await prisma.$queryRaw<LigneAggMouvement[]>`
    SELECT
      EXTRACT(YEAR FROM ms."date")::int AS annee,
      EXTRACT(MONTH FROM ms."date")::int AS mois,
      COALESCE(p."tailleGranule"::text, 'INCONNU') AS granulometrie,
      SUM(ms."quantite")::text AS quantite
    FROM "MouvementStock" ms
    JOIN "Produit" p ON p.id = ms."produitId"
    WHERE ms."siteId" = ${siteId}
      AND ms."type" = 'SORTIE'
      AND p."categorie" = 'ALIMENT'
      AND ms."date" >= ${borneDebut}
      AND ms."date" < ${borneFin}
    GROUP BY 1, 2, 3
  `;

  return lignes.map((l) => ({
    categorieCle: composeCategorieCle(SourceRapprochement.MOUVEMENT_STOCK, l.granulometrie),
    moisAbsolu: moisAbsoluDepuis(dateDebutPlan, new Date(l.annee, l.mois - 1, 1)),
    montantReel: new Decimal(l.quantite ?? "0"),
    natureGrandeur: "QUANTITE",
  }));
}

/* ------------------------------------------------------------------ *
 * 7. Depense d'aliment par granulometrie via LigneDepense — bucket INCONNU
 * ------------------------------------------------------------------ */

interface LigneAggDepenseGranulo {
  annee: number;
  mois: number;
  granulometrie: string;
  montant: string;
}

interface LigneAggDepenseSansLigne {
  annee: number;
  mois: number;
  montant: string;
}

/**
 * Detail de la Depense ALIMENT par granulometrie, via
 * `LigneDepense.produitId -> Produit.tailleGranule` — chemin NULLABLE A
 * DEUX NIVEAUX (pre-analyse PR3, section A) : une `Depense` peut n'avoir
 * AUCUNE `LigneDepense` (dépense globale, sans detail), et une
 * `LigneDepense` peut n'avoir aucun `produitId`. Les deux cas remontent
 * explicitement dans le bucket `GRANULOMETRIE_INCONNUE` — JAMAIS reparti
 * arbitrairement entre les granulometries connues, JAMAIS omis du total.
 *
 * Fonction DISTINCTE de `getSortiesAlimentReellesParGranulometrie` : le
 * chemin `MouvementStock` reste le chemin FIABLE pour le rapprochement
 * principal (ADR-053, pre-analyse section A) — cette fonction sert une vue
 * de detail complementaire ("d'ou vient l'argent depense en aliment"), pas
 * le rapprochement de quantite lui-meme.
 */
export async function getDepensesAlimentReellesParGranulometrie(
  siteId: string,
  dateDebutPlan: Date,
  moisDebut: number,
  moisFin: number
): Promise<EntreeReelleAgregee[]> {
  validerIntervalleMois(moisDebut, moisFin);
  const borneDebut = bordDebutMois(dateDebutPlan, moisDebut);
  const borneFin = bordFinExclusive(dateDebutPlan, moisFin);
  const categorieAliment: string = CategorieDepense.ALIMENT;

  const [avecLignes, sansLignes] = await Promise.all([
    prisma.$queryRaw<LigneAggDepenseGranulo[]>`
      SELECT
        EXTRACT(YEAR FROM d."date")::int AS annee,
        EXTRACT(MONTH FROM d."date")::int AS mois,
        COALESCE(p."tailleGranule"::text, ${GRANULOMETRIE_INCONNUE}) AS granulometrie,
        SUM(ld."montantTotal")::text AS montant
      FROM "LigneDepense" ld
      JOIN "Depense" d ON d.id = ld."depenseId"
      LEFT JOIN "Produit" p ON p.id = ld."produitId"
      WHERE d."siteId" = ${siteId}
        AND d."categorieDepense" = ${categorieAliment}::"CategorieDepense"
        AND d."date" >= ${borneDebut}
        AND d."date" < ${borneFin}
      GROUP BY 1, 2, 3
    `,
    // Depenses ALIMENT sans AUCUNE LigneDepense : le montant TOTAL de la
    // depense va integralement au bucket INCONNU (aucun detail disponible).
    prisma.$queryRaw<LigneAggDepenseSansLigne[]>`
      SELECT
        EXTRACT(YEAR FROM d."date")::int AS annee,
        EXTRACT(MONTH FROM d."date")::int AS mois,
        SUM(d."montantTotal")::text AS montant
      FROM "Depense" d
      WHERE d."siteId" = ${siteId}
        AND d."categorieDepense" = ${categorieAliment}::"CategorieDepense"
        AND d."date" >= ${borneDebut}
        AND d."date" < ${borneFin}
        AND NOT EXISTS (SELECT 1 FROM "LigneDepense" ld2 WHERE ld2."depenseId" = d.id)
      GROUP BY 1, 2
    `,
  ]);

  const parCle = new Map<string, Decimal>();
  const cleDe = (annee: number, mois: number, granulo: string) => `${annee}-${mois}::${granulo}`;

  for (const l of avecLignes) {
    const cle = cleDe(l.annee, l.mois, l.granulometrie);
    parCle.set(cle, (parCle.get(cle) ?? new Decimal(0)).plus(new Decimal(l.montant ?? "0")));
  }
  for (const l of sansLignes) {
    const cle = cleDe(l.annee, l.mois, GRANULOMETRIE_INCONNUE);
    parCle.set(cle, (parCle.get(cle) ?? new Decimal(0)).plus(new Decimal(l.montant ?? "0")));
  }

  const resultat: EntreeReelleAgregee[] = [];
  for (const [cle, montant] of parCle) {
    const [anneeMois, granulo] = cle.split("::");
    const [annee, mois] = anneeMois.split("-").map(Number);
    resultat.push({
      // Correction PR3-ter story C.1 : cette ligne vient de Depense/LigneDepense
      // (nature DEPENSE, FCFA), PAS de MouvementStock (nature QUANTITE, kg,
      // cf. getSortiesAlimentReellesParGranulometrie ci-dessus). Utiliser
      // SourceRapprochement.MOUVEMENT_STOCK ici produirait une categorieCle
      // IDENTIQUE ("MOUVEMENT_STOCK:<granulo>") pour deux grandeurs de nature
      // differente (FCFA vs kg) des qu'une story branche cette fonction dans
      // getReelAgregeSite/le mapping — collision latente, sans effet
      // aujourd'hui uniquement parce que cette fonction n'est appelee par
      // aucun agregat combine. DEPENSE_CATEGORIE + prefixe "<CategorieDepense
      // ALIMENT>:" est la source reelle et coherente avec la nature DEPENSE,
      // et reste distincte de la cle globale ALIMENT (sans granulometrie)
      // produite par getDepensesReellesParCategorie ("DEPENSE_CATEGORIE:ALIMENT").
      categorieCle: composeCategorieCle(SourceRapprochement.DEPENSE_CATEGORIE, `${categorieAliment}:${granulo}`),
      moisAbsolu: moisAbsoluDepuis(dateDebutPlan, new Date(annee, mois - 1, 1)),
      montantReel: montant,
      natureGrandeur: "DEPENSE",
    });
  }
  return resultat;
}

/* ------------------------------------------------------------------ *
 * 8. Agregat combine du reel (pour l'orchestration principale)
 * ------------------------------------------------------------------ */

/**
 * Combine `Depense` (par categorie) + `Vente` (montant + tonnage) +
 * `MouvementStock` (sortie aliment par granulometrie) en une seule liste
 * `EntreeReelleAgregee[]` — la matiere premiere "reel" de
 * `calculerRapprochementScenario`. N'inclut PAS
 * `getDepensesAlimentReellesParGranulometrie` (vue de detail complementaire,
 * cf. section 7 — le chemin retenu pour le rapprochement de quantite
 * aliment est `MouvementStock`, pas `Depense`).
 */
export async function getReelAgregeSite(
  siteId: string,
  dateDebutPlan: Date,
  moisDebut: number,
  moisFin: number
): Promise<EntreeReelleAgregee[]> {
  const [depenses, ventes, sortiesAliment] = await Promise.all([
    getDepensesReellesParCategorie(siteId, dateDebutPlan, moisDebut, moisFin),
    getVentesReelles(siteId, dateDebutPlan, moisDebut, moisFin),
    getSortiesAlimentReellesParGranulometrie(siteId, dateDebutPlan, moisDebut, moisFin),
  ]);
  return [...depenses, ...ventes, ...sortiesAliment];
}

/* ------------------------------------------------------------------ *
 * 9. Construction du prevu depuis un scenario deja charge/projete
 * ------------------------------------------------------------------ */

/**
 * Construit les `EntreePrevueRapprochement[]` (contrat du moteur pur) a
 * partir d'un scenario deja charge (`chargerScenarioPourMoteur`) et de sa
 * projection deja calculee (`calculerProjectionScenario`) — AUCUN nouveau
 * calcul ici, uniquement une lecture/reindexation des sorties DEJA
 * produites par le moteur (ADR-053 section 15.6 point 2 : le prevu vient
 * TOUJOURS du moteur de production, jamais d'une recomposition locale).
 *
 * Couvre :
 * - `PostePrevision` x `ChargeMensuellePrevue` (nature DEPENSE, cle =
 *   `PostePrevision.id`) ;
 * - `AlimentPrevision` (calibre) x mois, via `MoisProjectionResult.
 *   kgParGranulometrie` (nature QUANTITE, cle = `AlimentPrevision.id`) —
 *   PAS `sacsParGranulometrie` : cette derniere compte des SACS (bug
 *   corrige, meme famille que l'homonymie `sacsParTonne` de l'ADR-053 §11 —
 *   le reel de cette meme ligne, `MouvementStock.quantite`/
 *   `Vente.poidsTotalKg`, est en kg ; comparer des sacs a des kg sous un
 *   meme intitule "QUANTITE" produisait un ecart faux d'un facteur
 *   `poidsSacKg` — ~15x sur le plan de reference) ;
 * - le revenu de vente prevu (`MoisProjectionResult.revenusFCFA`, nature
 *   ENTREE, cle `VENTE_PREVUE:MONTANT`) et le tonnage recolte prevu
 *   (`MoisProjectionResult.ventesKg`, nature QUANTITE, cle
 *   `VENTE_PREVUE:TONNAGE`) ;
 * - les `ApportCapital` prevus, marques `sansSourceReelle: true` (ADR-053
 *   §15.1 : aucune table reelle ne modelise un apport/subvention/pret
 *   encaisse — `reel` ne doit JAMAIS valoir `0` pour cette ligne).
 */
export function construireEntreesPrevuesDepuisScenario(
  scenario: ScenarioPourCalcul,
  projection: ProjectionScenarioResult,
  moisDebut: number,
  moisFin: number
): EntreePrevueRapprochement[] {
  const entrees: EntreePrevueRapprochement[] = [];

  for (const poste of scenario.postes) {
    for (const charge of poste.chargesMensuelles) {
      if (charge.moisAbsolu < moisDebut || charge.moisAbsolu > moisFin) continue;
      entrees.push({
        cle: poste.id,
        libelle: poste.libelle,
        natureGrandeur: "DEPENSE",
        moisAbsolu: charge.moisAbsolu,
        montantPrevu: charge.montantFCFA,
      });
    }
  }

  const moisDansPlage = projection.mois.filter(
    (m) => m.moisAbsolu >= moisDebut && m.moisAbsolu <= moisFin
  );

  for (const aliment of scenario.aliments) {
    for (const mois of moisDansPlage) {
      // Bug de rapprochement corrige (ADR-053 §11/§15) : `sacsParGranulometrie`
      // compte des SACS, pas des kg — comparer ce nombre au reel (kg) sous
      // un meme intitule "QUANTITE" produisait un ecart faux (facteur
      // ~poidsSacKg). `kgParGranulometrie` porte la meme unite (kg) que le
      // reel de cette ligne (`MouvementStock.quantite`).
      const kg = mois.kgParGranulometrie[aliment.tailleGranule] ?? 0;
      entrees.push({
        cle: aliment.id,
        libelle: `Aliment ${aliment.tailleGranule}`,
        natureGrandeur: "QUANTITE",
        moisAbsolu: mois.moisAbsolu,
        montantPrevu: new Decimal(kg),
      });
    }
  }

  for (const mois of moisDansPlage) {
    entrees.push({
      cle: CLE_VENTE_PREVUE_MONTANT,
      libelle: "Revenu de vente prevu",
      natureGrandeur: "ENTREE",
      moisAbsolu: mois.moisAbsolu,
      montantPrevu: mois.revenusFCFA,
    });
    entrees.push({
      cle: CLE_VENTE_PREVUE_TONNAGE,
      libelle: "Tonnage recolte prevu",
      natureGrandeur: "QUANTITE",
      moisAbsolu: mois.moisAbsolu,
      montantPrevu: mois.ventesKg,
    });
  }

  const apportsParMois = new Map<number, Decimal>();
  for (const apport of scenario.apports) {
    const moisAbsolu = moisAbsoluDepuis(scenario.dateDebutPlan, apport.date);
    if (moisAbsolu < moisDebut || moisAbsolu > moisFin) continue;
    apportsParMois.set(moisAbsolu, (apportsParMois.get(moisAbsolu) ?? new Decimal(0)).plus(apport.montantFCFA));
  }
  for (const [moisAbsolu, montant] of apportsParMois) {
    entrees.push({
      cle: CLE_APPORT_CAPITAL,
      libelle: "Apports en capital (aucune source reelle, ADR-053 §15.1)",
      natureGrandeur: "ENTREE",
      moisAbsolu,
      montantPrevu: montant,
      sansSourceReelle: true,
    });
  }

  return entrees;
}

/* ------------------------------------------------------------------ *
 * 10. Orchestration principale
 * ------------------------------------------------------------------ */

/**
 * Charge le prevu (scenario + projection), le reel (agregations SQL
 * ci-dessus) et le mapping resolu PAR MOIS (immuabilite, section 1), puis
 * appelle EXCLUSIVEMENT `reconcilierPrevuEtReel` (moteur pur) — cette
 * fonction ne recalcule aucun ecart, aucun signe, aucune couleur (ADR-053
 * section 15.6 point 2).
 *
 * Le mapping est resolu PAR MOIS (un mois clos garde sa version figee meme
 * si un mois voisin, non clos, utilise la version active courante) — c'est
 * pourquoi le moteur est appele une fois PAR MOIS de la plage plutot qu'une
 * seule fois sur l'ensemble (l'API du moteur ne prend qu'un seul mapping
 * pour tout l'appel).
 *
 * @throws {BusinessRuleError} (400) si `moisFin < moisDebut`.
 */
export async function calculerRapprochementScenario(
  scenarioId: string,
  siteId: string,
  moisDebut: number,
  moisFin: number
): Promise<LigneRapprochement[]> {
  validerIntervalleMois(moisDebut, moisFin);

  const scenario = await chargerScenarioPourMoteur(scenarioId, siteId);
  const projection = calculerProjectionScenario(scenario);

  const entreesPrevues = construireEntreesPrevuesDepuisScenario(scenario, projection, moisDebut, moisFin);
  const entreesReelles = await getReelAgregeSite(siteId, scenario.dateDebutPlan, moisDebut, moisFin);
  const mappingParMois = await getMappingResoluParMois(scenarioId, siteId, moisDebut, moisFin);

  const lignes: LigneRapprochement[] = [];
  for (let mois = moisDebut; mois <= moisFin; mois++) {
    const prevuDuMois = entreesPrevues.filter((e) => e.moisAbsolu === mois);
    const reelDuMois = entreesReelles.filter((e) => e.moisAbsolu === mois);
    const mapping = mappingParMois.get(mois) ?? [];
    lignes.push(...reconcilierPrevuEtReel(prevuDuMois, reelDuMois, mapping));
  }
  return lignes;
}
