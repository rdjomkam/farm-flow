/**
 * src/lib/previsions/rapprochement-vagues.ts
 *
 * Composition PURE (ZERO I/O, aucun `prisma.*`) de la vue "par vague" du
 * rapprochement prevu/reel (ADR-053 section 15, story PR3.7, §6.4 des
 * exigences fonctionnelles). Compagnon de `rapprochement.ts` — n'y ajoute
 * AUCUNE regle nouvelle de sens/couleur, appelle EXCLUSIVEMENT
 * `calculerEcart`/`calculerSensEcart`/`couleurPourSensEcart` deja exportes
 * par ce fichier (ERR-171 : jamais une reimplementation locale de la
 * comparaison prevu/reel).
 *
 * Cette vue solde la dette du "libelle de cohorte" (story PR3.7) : chaque
 * ligne porte a la fois le code de la VaguePrevue (ex. "V7") et, si elle
 * est rattachee, le code de la Vague reelle correspondante (via
 * `Vague.vaguePrevueId`) — jamais un agregat anonyme de quantites sans
 * savoir quelles vagues le composent.
 *
 * Distinction imperative, non negociable : une VaguePrevue NON REALISEE
 * (aucune Vague reelle liee, `vagueReelleId === null`) n'a STRUCTURELLEMENT
 * aucune donnee reelle a comparer — `realisee = false` et tous les champs
 * `reel` de la ligne valent `null`, JAMAIS `0`. C'est distinct de
 * `SANS_SOURCE_REELLE` (ADR-053 §15.1, qui concerne les encaissements hors
 * vente) : ici la source existe (Depense/Vente portent un `vagueId`), c'est
 * seulement qu'aucune vague reelle n'a encore ete rattachee a ce plan.
 */
import { Decimal } from "./decimal-config";
import { calculerEcart, calculerSensEcart, couleurPourSensEcart, SEUILS_ECART_PAR_DEFAUT } from "./rapprochement";
import type { CouleurEcart, NatureGrandeur, SensEcart } from "./types";

/** Comparaison chiffree prevu/reel pour UNE grandeur (cout, revenu, marge, cout au kg). */
export interface ComparaisonChiffree {
  /** null uniquement si la grandeur prevue elle-meme est structurellement indisponible (ex. cout/kg avec une biomasse prevue nulle) — jamais un 0 substitue. */
  prevu: Decimal | null;
  /** null si la vague n'est pas realisee (`realisee === false`), ou si le denominateur reel est nul (cout/kg avec poids reel nul). */
  reel: Decimal | null;
  ecartAbsolu: Decimal | null;
  ecartPct: Decimal | null;
  sens: SensEcart;
  couleur: CouleurEcart;
}

/** Une VaguePrevue deja projetee par le moteur (`ProjectionScenarioResult.vagues`) — entree de `construireVueParVague`. */
export interface VaguePrevuePourVueInput {
  vaguePrevueId: string;
  codePrevu: string;
  statut: string;
  /** id de la Vague reelle liee (relation inverse Vague.vaguePrevueId), null si non realisee. */
  vagueReelleId: string | null;
  coutProductionFCFA: Decimal;
  revenuPrevuFCFA: Decimal;
  biomasseKg: Decimal;
}

/** Agregat reel deja groupe par Vague (charge en amont par la couche queries, jamais lu ici). */
export interface VagueReelleAgregat {
  vagueId: string;
  codeReel: string;
  coutReelFCFA: Decimal;
  revenuReelFCFA: Decimal;
  poidsReelKg: Decimal;
}

/** Une ligne de la vue "par vague" — le libelle de cohorte complet (ADR-053, dette soldee par cette story). */
export interface VagueRapprochementRow {
  vaguePrevueId: string;
  codePrevu: string;
  statut: string;
  vagueReelleId: string | null;
  codeReel: string | null;
  /** false = plan pas encore realise : tous les champs `reel` ci-dessous valent null, jamais 0. */
  realisee: boolean;
  coutComplet: ComparaisonChiffree;
  marge: ComparaisonChiffree;
  coutAuKg: ComparaisonChiffree;
}

/** Division protegee : jamais NaN/Infinity — un denominateur nul produit `null`, jamais 0 par convention. */
function diviserOuNull(numerateur: Decimal, denominateur: Decimal): Decimal | null {
  if (denominateur.isZero()) return null;
  return numerateur.dividedBy(denominateur);
}

/**
 * Construit une `ComparaisonChiffree` a partir d'un couple prevu/reel deja
 * identifie — appelle exclusivement les fonctions du moteur
 * (`calculerEcart`/`calculerSensEcart`/`couleurPourSensEcart`), jamais de
 * logique de comparaison dupliquee (ERR-171).
 *
 * Si `prevu` est `null` (grandeur prevue structurellement indisponible,
 * ex. cout/kg avec une biomasse prevue nulle) : aucun ecart n'est
 * calculable, `sens = "NON_APPLICABLE"`, `couleur = "neutre"` — sans
 * appeler `calculerEcart` (qui exige un `prevu` non nul par contrat).
 */
function construireComparaison(
  natureGrandeur: NatureGrandeur,
  prevu: Decimal | null,
  reel: Decimal | null
): ComparaisonChiffree {
  if (prevu === null) {
    return { prevu: null, reel, ecartAbsolu: null, ecartPct: null, sens: "NON_APPLICABLE", couleur: "neutre" };
  }
  const { ecartAbsolu, ecartPct } = calculerEcart(prevu, reel);
  const sens = calculerSensEcart(natureGrandeur, ecartAbsolu);
  const couleur = couleurPourSensEcart(sens, ecartPct, SEUILS_ECART_PAR_DEFAUT);
  return { prevu, reel, ecartAbsolu, ecartPct, sens, couleur };
}

/**
 * Assemble la vue "par vague" complete (ADR-053 §6.4, story PR3.7) : cout
 * complet prevu vs reel, marge prevue vs reelle, cout au kg prevu vs reel —
 * pour CHAQUE VaguePrevue du scenario, avec le libelle de cohorte a double
 * identifiant (code prevu + code reel si rattachee).
 *
 * `reelParVaguePrevueId` associe `vagueReelleId` (jamais `vaguePrevueId`,
 * cle differente) a son agregat reel — l'appelant (couche queries) doit
 * deja avoir resolu cette indirection.
 */
export function construireVueParVague(
  vaguesPrevues: VaguePrevuePourVueInput[],
  reelParVagueReelleId: Map<string, VagueReelleAgregat>
): VagueRapprochementRow[] {
  return vaguesPrevues.map((v) => {
    const realisee = v.vagueReelleId !== null;
    const reelAgregat = v.vagueReelleId ? reelParVagueReelleId.get(v.vagueReelleId) : undefined;

    const coutReel = realisee ? (reelAgregat?.coutReelFCFA ?? new Decimal(0)) : null;
    const revenuReel = realisee ? (reelAgregat?.revenuReelFCFA ?? new Decimal(0)) : null;
    const poidsReel = realisee ? (reelAgregat?.poidsReelKg ?? new Decimal(0)) : null;

    const coutComplet = construireComparaison("DEPENSE", v.coutProductionFCFA, coutReel);

    const margePrevue = v.revenuPrevuFCFA.minus(v.coutProductionFCFA);
    const margeReelle = realisee && coutReel !== null && revenuReel !== null ? revenuReel.minus(coutReel) : null;
    const marge = construireComparaison("ENTREE", margePrevue, margeReelle);

    const coutAuKgPrevu = diviserOuNull(v.coutProductionFCFA, v.biomasseKg);
    const coutAuKgReel =
      realisee && coutReel !== null && poidsReel !== null ? diviserOuNull(coutReel, poidsReel) : null;
    const coutAuKg = construireComparaison("DEPENSE", coutAuKgPrevu, coutAuKgReel);

    return {
      vaguePrevueId: v.vaguePrevueId,
      codePrevu: v.codePrevu,
      statut: v.statut,
      vagueReelleId: v.vagueReelleId,
      codeReel: reelAgregat?.codeReel ?? null,
      realisee,
      coutComplet,
      marge,
      coutAuKg,
    };
  });
}
