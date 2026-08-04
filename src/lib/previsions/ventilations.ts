/**
 * src/lib/previsions/ventilations.ts
 *
 * Logique pure (testable sans base de donnees) pour les ventilations de la
 * vue mensuelle des previsions demandees "au-dela du classeur" (Sprint
 * PR2-quinquies, story PR2q.4) : apports par type (`TypeApportCapital`) et
 * depenses par poste (`PostePrevision`). Meme discipline que
 * `tableau-de-bord-helpers.ts` : ce fichier NE fait PAS partie du moteur
 * recette et ne modifie ni ne reimplemente aucune fonction du moteur
 * (`route-orchestration.ts`, `charges.ts`) — il reutilise `moisAbsoluDepuis`
 * telle quelle et REPRODUIT EXACTEMENT le filtre de `calculerBaseRepartition`
 * (charges.ts), pas une variante approchee.
 *
 * --------------------------------------------------------------------------
 * Ventilation des apports par type — triviale et exacte par construction
 * --------------------------------------------------------------------------
 * `ventilerApportsParType` partitionne la MEME liste d'`ApportCapital`, par
 * le MEME `moisAbsoluDepuis`, que celle sommee par le moteur pour produire
 * `MoisProjectionDTO.apportsFCFA` (route-orchestration.ts, `apportsFlat`).
 * Consequence : pour tout mois m, la somme des deux types
 * (CAPITAL + CREDIT) de `ventilerApportsParType(...)` vaut exactement
 * `apportsFCFA` de ce mois — verifie par test dedie
 * (`__tests__/ventilations.test.ts`), pas seulement affirme ici.
 *
 * --------------------------------------------------------------------------
 * Ventilation des depenses par poste — piege 2 de la pre-analyse PR2q.4
 * --------------------------------------------------------------------------
 * `TypePostePrevision` n'a que 2 valeurs (LOGISTIQUE, CHARGE_EXPLOITATION) —
 * bien trop grossier pour "ventiler par poste" au sens ou l'utilisateur
 * l'entend (main-d'oeuvre, energie, produits veterinaires, loyer...). Cette
 * ventilation groupe donc par `PostePrevision` INDIVIDUEL (`posteId` ->
 * `libelle`), jamais par `TypePostePrevision`.
 *
 * Option retenue pour rapprocher le total ventile de la ligne agregee
 * (2 options possibles d'apres la pre-analyse, cf. rapport de la story) :
 * ventiler explicitement `baseRepartitionFCFA` (PAS `depensesFCFA` complet),
 * en 2 composantes, exactement les 2 composantes sommees par
 * `calculerBaseRepartition` (charges.ts) :
 *   1. les charges des postes dont `inclusBaseRepartition = true`,
 *      ventilees PAR POSTE (`parPoste`) ;
 *   2. le journal `OPERATIONNEL` SANS `vaguePrevueId` (depense generale non
 *      affectee a une vague), qui n'appartient a aucun poste
 *      (`journalGeneral`).
 * Les postes dont `inclusBaseRepartition = false` sont EXCLUS de
 * `parPoste` — exactement comme leurs charges sont exclues de
 * `baseRepartitionFCFA`/`depensesFCFA` par le moteur (`calculerBaseRepartition`
 * ne les somme jamais, nulle part). Les inclure ici recreerait un ecart
 * avec la ligne agregee que cette ventilation doit rapprocher : elles ne
 * sont PAS rapprochables de `depensesFCFA` par construction du moteur, donc
 * ne sont pas representees comme une "depense" de ce tableau.
 *
 * Le journal de depenses `OPERATIONNEL` AFFECTE a une vague
 * (`vaguePrevueId` non nul) et le journal `INVESTISSEMENT` restent HORS de
 * cette ventilation "par poste" (le premier est deja compte dans la
 * quote-part directe de la vague concernee — ADR-053 decision 6 — le second
 * alimente la ligne separee "Investissements", jamais quote-parte). C'est
 * exactement le filtre de `calculerBaseRepartition` : voir le test
 * `piege 2 — journal affecte a une vague` pour le cas NON degenere qui
 * distingue une ventilation correcte d'une ventilation naive (ERR-154).
 */
import { CategorieJournalPrevu, type TypeApportCapital } from "@/types";
import { moisAbsoluDepuis } from "./tableau-de-bord-helpers";

/** Valeur numerique ou serialisee (Prisma.Decimal.toJSON()) — meme tolerance que `format-previsions.ts`. */
type NumeriqueEntrant = number | string;

function versNombre(valeur: NumeriqueEntrant): number {
  const n = typeof valeur === "number" ? valeur : Number(valeur);
  return Number.isFinite(n) ? n : 0;
}

function toMoisAbsolu(dateDebutPlan: Date, date: string | Date): number {
  const d = typeof date === "string" ? new Date(date) : date;
  return moisAbsoluDepuis(dateDebutPlan, d);
}

export interface ApportVentilationInput {
  date: string | Date;
  montantFCFA: NumeriqueEntrant;
  type: TypeApportCapital;
}

/**
 * Ventile les apports en capital par type (`CAPITAL` | `CREDIT`), par mois
 * absolu. `somme(resultat[CAPITAL].get(m) ?? 0, resultat[CREDIT].get(m) ?? 0)
 * === apportsFCFA du mois m` pour tout m (garantie testee, cf. en-tete de
 * fichier).
 */
export function ventilerApportsParType(
  apports: ApportVentilationInput[],
  dateDebutPlan: Date
): Record<string, Map<number, number>> {
  const result: Record<string, Map<number, number>> = {};
  for (const a of apports) {
    const m = toMoisAbsolu(dateDebutPlan, a.date);
    const montant = versNombre(a.montantFCFA);
    if (!result[a.type]) result[a.type] = new Map();
    const mapType = result[a.type];
    mapType.set(m, (mapType.get(m) ?? 0) + montant);
  }
  return result;
}

export interface ChargeVentilationInput {
  posteId: string;
  moisAbsolu: number;
  montantFCFA: NumeriqueEntrant;
}

export interface PosteVentilationInput {
  id: string;
  libelle: string;
  inclusBaseRepartition: boolean;
}

export interface JournalVentilationInput {
  date: string | Date;
  montantFCFA: NumeriqueEntrant;
  categorie: CategorieJournalPrevu;
  vaguePrevueId: string | null;
}

export interface VentilationPoste {
  posteId: string;
  libelle: string;
  parMois: Map<number, number>;
}

export interface VentilationDepensesResult {
  /** Une entree par `PostePrevision` avec `inclusBaseRepartition = true`, dans l'ordre de `postes` recu. */
  parPoste: VentilationPoste[];
  /** Journal OPERATIONNEL sans `vaguePrevueId` (depense generale) — composante de `baseRepartitionFCFA` qui n'appartient a aucun poste. */
  journalGeneral: Map<number, number>;
}

/**
 * Ventile `baseRepartitionFCFA` par poste + un bloc "journal general" —
 * REPRODUIT le filtre exact de `calculerBaseRepartition` (charges.ts) :
 * charges des postes `inclusBaseRepartition = true`, et journal
 * `OPERATIONNEL` avec `vaguePrevueId === null` uniquement. Pour tout mois m,
 * `somme(parPoste[*].parMois.get(m) ?? 0) + (journalGeneral.get(m) ?? 0) ===
 * baseRepartitionFCFA du mois m` (garantie testee, y compris le cas NON
 * degenere d'un journal `OPERATIONNEL` affecte a une vague — cf. en-tete de
 * fichier, piege 2).
 */
export function ventilerDepensesParPoste(
  charges: ChargeVentilationInput[],
  postes: PosteVentilationInput[],
  journal: JournalVentilationInput[],
  dateDebutPlan: Date
): VentilationDepensesResult {
  const postesInclus = postes.filter((p) => p.inclusBaseRepartition);
  const parPoste: VentilationPoste[] = postesInclus.map((p) => ({
    posteId: p.id,
    libelle: p.libelle,
    parMois: new Map<number, number>(),
  }));
  const parPosteIndex = new Map(parPoste.map((v) => [v.posteId, v]));

  for (const c of charges) {
    const cible = parPosteIndex.get(c.posteId);
    if (!cible) continue; // poste absent (inclusBaseRepartition = false, ou poste inconnu) — exclu volontairement, cf. en-tete de fichier
    cible.parMois.set(c.moisAbsolu, (cible.parMois.get(c.moisAbsolu) ?? 0) + versNombre(c.montantFCFA));
  }

  const journalGeneral = new Map<number, number>();
  for (const j of journal) {
    if (j.categorie !== CategorieJournalPrevu.OPERATIONNEL || j.vaguePrevueId !== null) continue;
    const m = toMoisAbsolu(dateDebutPlan, j.date);
    journalGeneral.set(m, (journalGeneral.get(m) ?? 0) + versNombre(j.montantFCFA));
  }

  return { parPoste, journalGeneral };
}
