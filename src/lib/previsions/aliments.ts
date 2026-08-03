/**
 * Moteur Previsions — Besoin en aliments, remises, cout aliment par vague.
 *
 * Etapes 2-4 (ADR-053 section 4) :
 *   calculerBesoinAlimentMensuel — Etape 2
 *   appliquerPalierRemise        — Etape 3
 *   calculerCoutAlimentVague     — Etape 4
 *
 * Comble aussi le gap signale par la recette PR1.4
 * (docs/tests/rapport-story-PR1.4.md, section 4.3) : aucune fonction ne
 * ventilait le cout aliment remise d'une vague (calculerCoutAlimentVague,
 * total sur tout le cycle) par mois — necessaire pour
 * `depenses.aliments[mois]` (serie calendaire) et
 * `AlimentParVaguePrevue.coutCalculeFCFA` (grain vague x granulometrie x
 * mois, ADR-053 section 3.6) :
 *   apportionnerCoutAlimentMensuel        — primitive de repartition (%)
 *   calculerCoutAlimentGranulometrieParMois — grain vague x granulometrie x mois
 *
 * Reference : docs/decisions/ADR-053-module-previsions.md
 */
import { Decimal } from "./decimal-config";
import type { AlimentPrevisionCalcInput, PalierRemiseInput, RepartitionMoisInput } from "./types";

export interface BesoinAlimentMensuelResult {
  alimentPrevisionId: string;
  moisCycle: number;
  quantiteKg: Decimal;
  /** ceil(quantiteKg / poidsSacKg), calcule PAR granulometrie separement — voir piege majeur ci-dessous */
  sacs: number;
}

/**
 * calculerBesoinAlimentMensuel — Etape 2 du moteur (ADR-053 section 4).
 *
 * Calcule, pour un mois de cycle donne, le besoin en kg puis en sacs de
 * CHAQUE granulometrie (AlimentPrevision) fournie, prise separement.
 *
 * PIEGE MAJEUR (identifie par la pre-analyse de la story PR1.3, verifie
 * numeriquement contre le jeu d'or) : le `ceil` s'applique PAR
 * granulometrie, JAMAIS sur un besoin total agrege au prealable. Preuve :
 * `ceil(600/15) = 40` sur un besoin agrege, alors que la fixture donne
 * `41 = ceil(x/15) + ceil(y/15) + ceil(z/15)` sur trois granulometries
 * distinctes du meme mois. Cette fonction retourne donc UN resultat par
 * AlimentPrevision fourni — jamais une somme prealable des `quantiteKg`
 * suivie d'un unique `ceil`.
 *
 * Cas limite (ADR-053 section 8) : `poidsSacKg = 0` -> granulometrie
 * ignoree pour l'achat (`sacs = 0`), `quantiteKg` reste calculee
 * normalement -> jamais de division par zero, jamais de `NaN`/`Infinity`.
 *
 * @param aliments - granulometries a evaluer pour ce mois de cycle
 * @param moisCycle - mois du cycle (1..dureeCycleMois de la VaguePrevue)
 * @returns un resultat par AlimentPrevision fourni (pourcentage absent pour ce mois -> traite comme 0%)
 */
export function calculerBesoinAlimentMensuel(
  aliments: AlimentPrevisionCalcInput[],
  moisCycle: number
): BesoinAlimentMensuelResult[] {
  return aliments.map((aliment) => {
    const repartition = aliment.repartitions.find((r) => r.moisCycle === moisCycle);
    const pourcentage = repartition?.pourcentage ?? new Decimal(0);
    const quantiteKg = aliment.besoinTotalCycleKg.times(pourcentage).dividedBy(100);

    const sacs = aliment.poidsSacKg.lte(0)
      ? 0
      : quantiteKg.dividedBy(aliment.poidsSacKg).ceil().toNumber();

    return {
      alimentPrevisionId: aliment.id,
      moisCycle,
      quantiteKg,
      sacs,
    };
  });
}

export interface RemiseAppliqueeResult {
  sacs: number;
  coutFCFA: Decimal;
  pourcentageRemiseApplique: Decimal;
}

/**
 * appliquerPalierRemise — Etape 3 du moteur (ADR-053 section 4).
 *
 * Applique la remise de volume au cout d'achat d'un nombre de sacs donne,
 * en evaluant les paliers dans leur ordre EXPLICITE (`PalierRemise.ordre`),
 * jamais un tri implicite sur `seuilSacs` (ADR-053 section 3.4). Le
 * palier retenu est le DERNIER, dans l'ordre trie par `ordre`, dont
 * `seuilSacs <= sacs` — hypothese valide uniquement si les seuils sont
 * strictement croissants dans cet ordre, ce que
 * `validerPaliersRemiseCroissants` (validation.ts) doit avoir garanti en
 * amont, a l'ecriture (R4 : validation et ecriture dans la meme
 * transaction, pas de verification qui pourrait etre contournee). Aucun
 * palier applicable -> aucune remise (0%).
 *
 * @param sacs - nombre de sacs achetes (entier, deja arrondi par ceil — ADR-053 section 4)
 * @param prixSacFCFA - prix unitaire d'un sac, avant remise (AlimentPrevision.prixSacFCFA)
 * @param paliers - paliers de remise applicables a cet aliment, dans un ordre quelconque (re-tries ici par `ordre`)
 * @returns cout total apres remise et pourcentage de remise applique
 */
export function appliquerPalierRemise(
  sacs: number,
  prixSacFCFA: Decimal,
  paliers: PalierRemiseInput[]
): RemiseAppliqueeResult {
  const sacsDecimal = new Decimal(sacs);
  const sorted = [...paliers].sort((a, b) => a.ordre - b.ordre);

  let pourcentageRemiseApplique = new Decimal(0);
  for (const palier of sorted) {
    if (sacsDecimal.gte(palier.seuilSacs)) {
      pourcentageRemiseApplique = palier.pourcentageRemise;
    }
  }

  const coutBrutFCFA = prixSacFCFA.times(sacs);
  const coutFCFA = coutBrutFCFA.times(new Decimal(1).minus(pourcentageRemiseApplique.dividedBy(100)));

  return { sacs, coutFCFA, pourcentageRemiseApplique };
}

export interface AlimentParVagueCalcInput {
  alimentPrevisionId: string;
  /** sortie du moteur (calculerBesoinAlimentMensuel) — jamais editee directement (ADR-053 section 3.6) */
  sacsCalcules: number;
  /**
   * surcharge manuelle. `null` = utiliser `sacsCalcules`. Non-null =
   * l'utilisateur a ajuste le besoin reel constate sur le terrain sans
   * repasser par un recalcul complet du scenario (ADR-053 section 3.6).
   */
  sacsSaisis: number | null;
  prixSacFCFA: Decimal;
  paliers: PalierRemiseInput[];
}

/**
 * calculerCoutAlimentVague — Etape 4 du moteur (ADR-053 section 4).
 *
 * Somme des couts aliment d'une VaguePrevue sur tout son cycle, en
 * respectant `COALESCE(sacsSaisis, sacsCalcules)` ligne par ligne
 * (ADR-053 section 3.6) : une surcharge manuelle prime TOUJOURS sur la
 * sortie du moteur, jamais l'inverse, et jamais un melange (une meme
 * ligne n'utilise jamais `sacsCalcules` si `sacsSaisis` est renseigne).
 *
 * @param alimentsParVague - une ligne par (AlimentPrevision, moisCycle) de la vague, avec ses paliers de remise applicables
 * @returns cout total aliment de la vague sur tout le cycle, apres remises
 */
export function calculerCoutAlimentVague(alimentsParVague: AlimentParVagueCalcInput[]): Decimal {
  return alimentsParVague.reduce((total, ligne) => {
    const sacsEffectifs = ligne.sacsSaisis ?? ligne.sacsCalcules;
    const { coutFCFA } = appliquerPalierRemise(sacsEffectifs, ligne.prixSacFCFA, ligne.paliers);
    return total.plus(coutFCFA);
  }, new Decimal(0));
}

export interface CoutAlimentMoisResult {
  moisCycle: number;
  montantFCFA: Decimal;
}

/**
 * apportionnerCoutAlimentMensuel — ventile un cout de cycle DEJA REMISE
 * (sortie de `appliquerPalierRemise`/`calculerCoutAlimentVague`) sur les
 * mois du cycle, au prorata des pourcentages de `RepartitionMoisAliment`.
 *
 * SEMANTIQUE VERIFIEE NUMERIQUEMENT PAR LA RECETTE PR1.4 (V7, 15 tonnes,
 * remise 6%, docs/tests/rapport-story-PR1.4.md section 4.3), a respecter
 * scrupuleusement : la remise est decidee UNE SEULE FOIS pour la vague
 * entiere (sur son tonnage/sacs-cycle propres, cf. `appliquerPalierRemise`),
 * PUIS le montant deja remise est reparti par les pourcentages mensuels —
 * la remise n'est JAMAIS recalculee mois par mois. Exemple verifie : le
 * cout du mois 1 (2mm) vaut `coutCycleTotalRemiseFCFA * repartitionMois1%`
 * (1 624 320 FCFA), PAS `sacsMois1 * prixSac * (remise recalculee sur
 * sacsMois1 seul)` — cette derniere formule donnerait un taux de remise
 * incorrect (le volume mensuel seul peut etre sous le seuil qui a pourtant
 * ete atteint sur le cycle complet).
 *
 * Aucun arrondi n'est applique ligne par ligne ici (le montant reste un
 * `Decimal` non arrondi) : arrondir a chaque mois introduirait une derive
 * cumulative face au total du cycle si la somme des pourcentages vaut
 * exactement 100 (garanti par `validerSommeRepartitionMoisAliment` en
 * amont, validation.ts) — l'arrondi final (FCFA entier), si necessaire,
 * est a la charge de l'appelant, au point de sortie uniquement.
 *
 * Cas limites (documentes ici, absents de l'ADR-053 section 8) :
 * `coutCycleTotalRemiseFCFA = 0` -> chaque mois recoit `0`, sans erreur.
 * `repartitions` vide -> tableau vide (aucun mois a ventiler).
 * Un mois absent des `repartitions` n'apparait simplement pas dans le
 * resultat (pas de mois a 0% implicite) — coherent avec
 * `calculerBesoinAlimentMensuel` qui traite un mois absent comme 0%.
 *
 * @param coutCycleTotalRemiseFCFA - cout total, DEJA remise, d'UNE granulometrie sur TOUT le cycle d'UNE vague
 * @param repartitions - pourcentages mensuels de CETTE granulometrie (RepartitionMoisAliment), doivent sommer a 100 (valide en amont, validation.ts)
 * @returns un montant par mois de cycle present dans `repartitions`
 */
export function apportionnerCoutAlimentMensuel(
  coutCycleTotalRemiseFCFA: Decimal,
  repartitions: RepartitionMoisInput[]
): CoutAlimentMoisResult[] {
  return repartitions.map((r) => ({
    moisCycle: r.moisCycle,
    montantFCFA: coutCycleTotalRemiseFCFA.times(r.pourcentage).dividedBy(100),
  }));
}

export interface AlimentParVagueMensuelCalcInput {
  alimentPrevisionId: string;
  /** total de sacs de CETTE granulometrie sur TOUT le cycle de la vague (pas un total mensuel — voir appliquerPalierRemise) */
  sacsCalculesCycle: number;
  /** surcharge manuelle du total cycle — memes regles que AlimentParVagueCalcInput.sacsSaisis (ADR-053 section 3.6) */
  sacsSaisisCycle: number | null;
  prixSacFCFA: Decimal;
  paliers: PalierRemiseInput[];
  /** pourcentages mensuels de repartition de CETTE granulometrie (RepartitionMoisAliment) */
  repartitions: RepartitionMoisInput[];
}

export interface CoutAlimentGranulometrieMoisResult {
  alimentPrevisionId: string;
  moisCycle: number;
  montantFCFA: Decimal;
}

/**
 * calculerCoutAlimentGranulometrieParMois — cout aliment REMISE, ventile
 * par mois, pour UNE granulometrie d'UNE vague : grain exact de
 * `AlimentParVaguePrevue.coutCalculeFCFA` (ADR-053 section 3.6, vague x
 * granulometrie x moisCycle).
 *
 * Compose `appliquerPalierRemise` (remise decidee UNE FOIS sur le total de
 * sacs du CYCLE COMPLET, jamais sur un volume mensuel — voir la note de
 * semantique de `apportionnerCoutAlimentMensuel`) puis
 * `apportionnerCoutAlimentMensuel` (ventilation par les pourcentages
 * mensuels du montant deja remise). Ne reimplemente aucune formule : ne
 * fait que chainer les deux etapes deja exposees par ce module.
 *
 * @param ligne - sacs du cycle complet (calcules ou surcharges), prix, paliers, et repartition mensuelle d'UNE granulometrie d'UNE vague
 * @returns un montant par mois de cycle present dans `ligne.repartitions`
 */
export function calculerCoutAlimentGranulometrieParMois(
  ligne: AlimentParVagueMensuelCalcInput
): CoutAlimentGranulometrieMoisResult[] {
  const sacsEffectifsCycle = ligne.sacsSaisisCycle ?? ligne.sacsCalculesCycle;
  const { coutFCFA } = appliquerPalierRemise(sacsEffectifsCycle, ligne.prixSacFCFA, ligne.paliers);

  return apportionnerCoutAlimentMensuel(coutFCFA, ligne.repartitions).map((r) => ({
    alimentPrevisionId: ligne.alimentPrevisionId,
    moisCycle: r.moisCycle,
    montantFCFA: r.montantFCFA,
  }));
}
