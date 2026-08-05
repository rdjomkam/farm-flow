/**
 * src/lib/previsions/rapprochement.ts
 *
 * Moteur de calcul des ecarts prevu/reel (ADR-053 section 15, amendement
 * Sprint PR3, story PR3.4). Fonctions PURES, ZERO I/O : aucun `prisma.*`
 * ici. Les agregats reels (Depense/LigneDepense/Vente/MouvementStock deja
 * groupes par mois/categorie) et les lignes prevues sont charges en amont
 * par la couche queries (`src/lib/queries/previsions-rapprochement.ts`,
 * story separee) et passes en argument ; le resultat est retourne en
 * valeur, jamais ecrit (ADR-053 section 4, section 5, section 15.6 point 1).
 *
 * Le module Previsions n'ecrit JAMAIS dans Depense, Vente, MouvementStock
 * ni aucune table du domaine reel (section 5.1(a)) — aucune fonction de ce
 * fichier n'appelle create/update/delete sur ces tables, garantie portee
 * par revue de code (checklist obligatoire R1-R11 a chaque review de
 * sprint PR3, section 15.6 dernier paragraphe).
 *
 * ATTENTION (ERR-142/ERR-160/ERR-171, section 15.6) : il n'existe AUCUN
 * jeu d'or externe pour ce sous-module (Depense/Vente/MouvementStock ne
 * sont jamais modelises dans le classeur Previsions_Elevage_Silure_v12.
 * xlsx). La seule protection contre une formule fausse est une suite de
 * fixtures SYNTHETIQUES concues pour FAIRE DIVERGER deux implementations
 * candidates (ERR-160), verifiees par falsification chiffree (ERR-168/
 * ERR-171) — jamais un compte brut d'assertions vertes. Tout test de ce
 * module doit appeler EXCLUSIVEMENT les fonctions ci-dessous, jamais
 * reimplementer `ecartAbsolu`/`ecartPct`/`sens` localement dans le fichier
 * de test (c'est litteralement le defaut nomme par ERR-171).
 */
import { Decimal } from "./decimal-config";
import type {
  CouleurEcart,
  LigneRapprochement,
  NatureGrandeur,
  SensEcart,
  StatutRapprochement,
} from "./types";

/* ------------------------------------------------------------------ *
 * 1. Ecart brut (ADR-053 section 15.5)
 * ------------------------------------------------------------------ */

/** Resultat de `calculerEcart` — les deux composantes de l'ecart brut. */
export interface EcartCalcule {
  /** reel - prevu, jamais prevu - reel. null si reel est null. */
  ecartAbsolu: Decimal | null;
  /** (reel - prevu) / |prevu|. null si prevu === 0 OU reel === null. */
  ecartPct: Decimal | null;
}

/**
 * Calcule l'ecart absolu et l'ecart relatif entre une valeur prevue et une
 * valeur reelle (ADR-053 section 15.5).
 *
 * Regles, non negociables :
 * - `ecartAbsolu = reel - prevu` — TOUJOURS dans ce sens. Un signe positif
 *   signifie « le reel depasse le prevu », uniformement, quelle que soit
 *   la nature de la grandeur (le sens favorable/defavorable est tranche
 *   separement par `calculerSensEcart`, jamais ici).
 * - `reel === null` (statut SANS_SOURCE_REELLE, ADR-053 section 15.1) :
 *   `ecartAbsolu` et `ecartPct` valent tous deux `null` — il n'existe
 *   structurellement aucune donnee a comparer, jamais un `0` trompeur.
 * - `prevu === 0` : `ecartPct` vaut `null` (aucune base de comparaison
 *   relative n'existe pour une division par 0) — JAMAIS `Infinity`,
 *   JAMAIS `NaN`, JAMAIS `0` par convention. `ecartAbsolu` reste calcule
 *   normalement (`reel - 0 = reel`) : le cas `prevu = 0 && reel > 0`
 *   (depense non budgetee) produit donc TOUJOURS un ecart absolu non nul
 *   et visible, jamais une disparition silencieuse.
 */
export function calculerEcart(prevu: Decimal, reel: Decimal | null): EcartCalcule {
  if (reel === null) {
    return { ecartAbsolu: null, ecartPct: null };
  }
  const ecartAbsolu = reel.minus(prevu);
  const ecartPct = prevu.isZero() ? null : ecartAbsolu.dividedBy(prevu.abs());
  return { ecartAbsolu, ecartPct };
}

/* ------------------------------------------------------------------ *
 * 2. Sens favorable/defavorable (ADR-053 section 15.5)
 * ------------------------------------------------------------------ */

/**
 * Determine le sens (favorable/defavorable) d'un ecart deja calcule, en
 * fonction de la nature de la grandeur comparee (ADR-053 section 15.5).
 *
 * Le signe seul ne determine JAMAIS `sens` — c'est la nature de la
 * grandeur (portee explicitement par l'appelant, jamais devinee) qui fixe
 * l'interpretation :
 * - `DEPENSE` : `reel > prevu` -> DEFAVORABLE ; `reel < prevu` -> FAVORABLE.
 * - `ENTREE` / `QUANTITE` : `reel > prevu` -> FAVORABLE ; `reel < prevu`
 *   -> DEFAVORABLE.
 * - egalite stricte -> NEUTRE, dans tous les cas.
 * - `ecartAbsolu === null` (statut SANS_SOURCE_REELLE) -> NON_APPLICABLE,
 *   jamais un des trois autres.
 *
 * Cas `prevu = 0 && reel > 0` : AUCUN traitement special ici — la regle
 * ci-dessus s'applique telle quelle. Pour une DEPENSE, `reel > 0 = prevu`
 * produit naturellement DEFAVORABLE (depense non budgetee, toujours
 * signalee). Pour une ENTREE/QUANTITE, le meme cas produit naturellement
 * FAVORABLE (recette/production non budgetee mais bel et bien realisee).
 * C'est `couleurPourSensEcart` (ci-dessous) qui garantit que ce cas reste
 * TOUJOURS signale au niveau maximal, jamais neutralise par l'absence de
 * base de comparaison relative (`ecartPct === null`).
 */
export function calculerSensEcart(
  natureGrandeur: NatureGrandeur,
  ecartAbsolu: Decimal | null,
): SensEcart {
  if (ecartAbsolu === null) return "NON_APPLICABLE";
  if (ecartAbsolu.isZero()) return "NEUTRE";

  const reelDepassePrevu = ecartAbsolu.isPositive();
  const depasserEstDefavorable = natureGrandeur === "DEPENSE";

  if (reelDepassePrevu) {
    return depasserEstDefavorable ? "DEFAVORABLE" : "FAVORABLE";
  }
  return depasserEstDefavorable ? "FAVORABLE" : "DEFAVORABLE";
}

/* ------------------------------------------------------------------ *
 * 3. Couleur de severite (ADR-053 section 15.5)
 * ------------------------------------------------------------------ */

/** Seuils de severite (fractions, 0.05 = 5% — jamais un entier "5"). */
export interface SeuilsEcart {
  /** |ecartPct| <= ce seuil -> teinte de faible intensite (garde la teinte du sens) */
  vertPct: Decimal;
  /** ce seuil < |ecartPct| <= seuilOrange -> "orange" (signal d'attention, quel que soit le sens) */
  orangePct: Decimal;
}

/**
 * Seuils par defaut (ADR-053 section 15.5) : |ecart| <= 5% -> vert (faible
 * intensite), <= 15% -> orange, > 15% -> rouge/vert sature selon le sens.
 * Exprimes en FRACTION (0.05, pas 5) pour etre directement comparables a
 * `ecartPct` tel que produit par `calculerEcart`.
 */
export const SEUILS_ECART_PAR_DEFAUT: SeuilsEcart = {
  vertPct: new Decimal("0.05"),
  orangePct: new Decimal("0.15"),
};

/**
 * Calcule la couleur de severite discrete d'un ecart (ADR-053 section
 * 15.5). Prend `sens` (deja tranche par `calculerSensEcart`, jamais
 * recalcule ici) et l'amplitude `|ecartPct|` pour choisir l'intensite —
 * cette fonction, et elle seule, possede le seuil et la regle ; un
 * composant `src/components/previsions/*` ne fait que lire `ligne.sens`
 * et le resultat de cette fonction, il ne recalcule jamais de comparaison
 * `>`/`<` lui-meme.
 *
 * Regles :
 * - `sens === "NEUTRE"` ou `"NON_APPLICABLE"` -> `"neutre"`.
 * - `ecartPct === null` (cas `prevu = 0`, aucune base de comparaison
 *   relative) -> TOUJOURS signale au niveau maximal : `"rouge"` si
 *   DEFAVORABLE, `"vert"` si FAVORABLE. Le seuil pourcentuel ne s'applique
 *   jamais dans ce cas (ADR-053 section 15.5).
 * - Sinon, amplitude `|ecartPct|` comparee aux seuils :
 *   - `<= seuilVert` : garde la teinte du sens (vert si favorable, rouge
 *     si defavorable), faible intensite.
 *   - `seuilVert < amplitude <= seuilOrange` : `"orange"` — signal
 *     d'attention, quel que soit le sens (un ecart d'ampleur moyenne
 *     merite d'etre regarde meme s'il est favorable).
 *   - `> seuilOrange` : teinte du sens saturee (vert si favorable, rouge
 *     si defavorable).
 */
export function couleurPourSensEcart(
  sens: SensEcart,
  ecartPct: Decimal | null,
  seuils: SeuilsEcart = SEUILS_ECART_PAR_DEFAUT,
): CouleurEcart {
  if (sens === "NEUTRE" || sens === "NON_APPLICABLE") return "neutre";

  if (ecartPct === null) {
    return sens === "DEFAVORABLE" ? "rouge" : "vert";
  }

  const amplitude = ecartPct.abs();
  const teinteDuSens = (): CouleurEcart => (sens === "DEFAVORABLE" ? "rouge" : "vert");

  if (amplitude.lessThanOrEqualTo(seuils.vertPct)) return teinteDuSens();
  if (amplitude.lessThanOrEqualTo(seuils.orangePct)) return "orange";
  return teinteDuSens();
}

/* ------------------------------------------------------------------ *
 * 4. Construction d'une ligne de rapprochement complete
 * ------------------------------------------------------------------ */

/** Entree de `construireLigneRapprochement` — une comparaison prevu/reel deja identifiee. */
export interface ConstruireLigneRapprochementInput {
  id: string;
  moisAbsolu: number;
  libelle: string;
  natureGrandeur: NatureGrandeur;
  prevu: Decimal;
  /** null ssi statutRapprochement === "SANS_SOURCE_REELLE" (ADR-053 15.1) */
  reel: Decimal | null;
  statutRapprochement: StatutRapprochement;
}

/**
 * Assemble une `LigneRapprochement` complete (ecarts + sens) a partir
 * d'une comparaison prevu/reel deja identifiee. Fonction de composition
 * pure — appelle exclusivement `calculerEcart` et `calculerSensEcart`,
 * jamais de logique dupliquee (ERR-171).
 *
 * Garde defensive : si `statutRapprochement === "SANS_SOURCE_REELLE"`
 * mais que l'appelant a fourni un `reel` non nul par erreur, le `reel`
 * effectivement porte par la ligne est force a `null` — cette fonction ne
 * laisse jamais passer un "reel = 0" trompeur pour ce statut (ADR-053
 * section 15.1, garantie centrale).
 */
export function construireLigneRapprochement(
  input: ConstruireLigneRapprochementInput,
): LigneRapprochement {
  const reelEffectif = input.statutRapprochement === "SANS_SOURCE_REELLE" ? null : input.reel;
  const { ecartAbsolu, ecartPct } = calculerEcart(input.prevu, reelEffectif);
  const sens = calculerSensEcart(input.natureGrandeur, ecartAbsolu);

  return {
    id: input.id,
    moisAbsolu: input.moisAbsolu,
    libelle: input.libelle,
    natureGrandeur: input.natureGrandeur,
    prevu: input.prevu,
    reel: reelEffectif,
    statutRapprochement: input.statutRapprochement,
    ecartAbsolu,
    ecartPct,
    sens,
  };
}

/* ------------------------------------------------------------------ *
 * 5. Reconciliation prevu <-> reel (bac NON_RAPPROCHE, ADR-053 section 5)
 * ------------------------------------------------------------------ */

/** Une ligne prevue a rapprocher (ADR-053 section 5, 15.1). */
export interface EntreePrevueRapprochement {
  /** cle stable cote prevu (ex. PostePrevision.id, AlimentPrevision.id, "VENTE_PREVUE") */
  cle: string;
  libelle: string;
  natureGrandeur: NatureGrandeur;
  moisAbsolu: number;
  montantPrevu: Decimal;
  /**
   * true si structurellement aucune table reelle n'existe pour cette
   * ligne (ADR-053 section 15.1, ex. un ApportCapital de type SUBVENTION)
   * — distinct de "aucune donnee reelle ce mois-ci" (qui reste RAPPROCHE
   * avec reel = 0).
   */
  sansSourceReelle?: boolean;
}

/**
 * Un agregat reel deja groupe par categorie et par mois (ADR-053 section
 * 15.6 point 1 — charge en amont par la couche queries, jamais lu ici).
 */
export interface EntreeReelleAgregee {
  /** valeur litterale de la source reelle (ex. CategorieDepense.ALIMENT, "VENTE") */
  categorieCle: string;
  moisAbsolu: number;
  montantReel: Decimal;
  /** nature portee par la source reelle elle-meme (une CategorieDepense est toujours DEPENSE) */
  natureGrandeur: NatureGrandeur;
}

/** Une entree active de `MappingRapprochement` (ADR-053 section 3.9), deja filtree sur `actif`/version par l'appelant. */
export interface MappingRapprochementActif {
  sourceCle: string;
  /** cle de l'EntreePrevueRapprochement ciblee. null = NON_RAPPROCHE cible explicitement. */
  cibleCle: string | null;
}

/**
 * Reconcilie une liste de lignes prevues avec des agregats reels, via un
 * mapping actif — produit la liste complete des `LigneRapprochement`
 * (ADR-053 section 5, section 15.1).
 *
 * Garanties (non negociables, testees par falsification section 15.6) :
 * - Toute `EntreeReelleAgregee` dont `categorieCle` n'a AUCUNE entree de
 *   mapping actif correspondante (ou dont le mapping cible explicitement
 *   `null`) produit une ligne `NON_RAPPROCHE` distincte, `prevu = 0`,
 *   `reel = montantReel` — JAMAIS absorbee silencieusement dans un total,
 *   jamais ignoree (ADR-053 section 5).
 * - Toute `EntreePrevueRapprochement` marquee `sansSourceReelle` produit
 *   une ligne `SANS_SOURCE_REELLE`, `reel = null` — jamais `0`.
 * - Toute `EntreePrevueRapprochement` sans donnee reelle correspondante ce
 *   mois-ci (mais rapprochable en principe) produit une ligne `RAPPROCHE`
 *   avec `reel = 0` — c'est une donnee legitime (rien depense ce mois-la),
 *   distincte de `SANS_SOURCE_REELLE`.
 */
export function reconcilierPrevuEtReel(
  entreesPrevues: EntreePrevueRapprochement[],
  entreesReelles: EntreeReelleAgregee[],
  mapping: MappingRapprochementActif[],
): LigneRapprochement[] {
  const cibleParSourceCle = new Map<string, string | null>();
  for (const m of mapping) {
    cibleParSourceCle.set(m.sourceCle, m.cibleCle);
  }

  // reel agrege par (cibleCle, moisAbsolu), pour les entrees reelles mappees vers une cible non nulle
  const reelParCibleEtMois = new Map<string, Decimal>();
  // entrees reelles non rapprochees (pas de mapping actif, ou mapping cible explicitement null)
  const reellesNonRapprochees: { categorieCle: string; moisAbsolu: number; montantReel: Decimal; natureGrandeur: NatureGrandeur }[] = [];

  for (const reelle of entreesReelles) {
    const cibleCle = cibleParSourceCle.has(reelle.categorieCle)
      ? cibleParSourceCle.get(reelle.categorieCle)!
      : undefined;

    if (cibleCle === undefined || cibleCle === null) {
      reellesNonRapprochees.push(reelle);
      continue;
    }

    const cle = `${cibleCle}::${reelle.moisAbsolu}`;
    const cumul = reelParCibleEtMois.get(cle) ?? new Decimal(0);
    reelParCibleEtMois.set(cle, cumul.plus(reelle.montantReel));
  }

  const lignes: LigneRapprochement[] = [];

  for (const prevue of entreesPrevues) {
    if (prevue.sansSourceReelle) {
      lignes.push(
        construireLigneRapprochement({
          id: `${prevue.cle}::${prevue.moisAbsolu}`,
          moisAbsolu: prevue.moisAbsolu,
          libelle: prevue.libelle,
          natureGrandeur: prevue.natureGrandeur,
          prevu: prevue.montantPrevu,
          reel: null,
          statutRapprochement: "SANS_SOURCE_REELLE",
        }),
      );
      continue;
    }

    const cle = `${prevue.cle}::${prevue.moisAbsolu}`;
    const reel = reelParCibleEtMois.get(cle) ?? new Decimal(0);
    lignes.push(
      construireLigneRapprochement({
        id: cle,
        moisAbsolu: prevue.moisAbsolu,
        libelle: prevue.libelle,
        natureGrandeur: prevue.natureGrandeur,
        prevu: prevue.montantPrevu,
        reel,
        statutRapprochement: "RAPPROCHE",
      }),
    );
  }

  for (const reelle of reellesNonRapprochees) {
    lignes.push(
      construireLigneRapprochement({
        id: `NON_RAPPROCHE::${reelle.categorieCle}::${reelle.moisAbsolu}`,
        moisAbsolu: reelle.moisAbsolu,
        libelle: `Non rapproché — ${reelle.categorieCle}`,
        natureGrandeur: reelle.natureGrandeur,
        prevu: new Decimal(0),
        reel: reelle.montantReel,
        statutRapprochement: "NON_RAPPROCHE",
      }),
    );
  }

  return lignes;
}

/**
 * Extrait le bac explicite "Non rapproché" (ADR-053 section 5) d'une
 * liste de lignes deja construite — ne recalcule rien, filtre seulement.
 * Ces lignes restent comptees dans les agregations "reel" (section 6/7 du
 * moteur, ci-dessous) : cette fonction sert uniquement l'affichage
 * explicite du bac, jamais a les exclure d'un total.
 */
export function extraireBacNonRapproche(lignes: LigneRapprochement[]): LigneRapprochement[] {
  return lignes.filter((l) => l.statutRapprochement === "NON_RAPPROCHE");
}

/* ------------------------------------------------------------------ *
 * 6. Agregations (par mois, cumulee, par poste)
 * ------------------------------------------------------------------ */

/** Agregat "reel" — exclut toujours les lignes SANS_SOURCE_REELLE (ADR-053 15.1). */
export interface AgregatEcart {
  totalPrevu: Decimal;
  /** somme des `reel` non-null uniquement — une ligne SANS_SOURCE_REELLE n'est JAMAIS traitee comme 0 additif. */
  totalReel: Decimal;
  /** somme des `ecartAbsolu` non-null (coherente avec totalReel - totalPrevu restreint aux lignes non SANS_SOURCE_REELLE) */
  totalEcartAbsolu: Decimal;
  nombreLignes: number;
  nombreLignesSansSourceReelle: number;
  nombreLignesNonRapprochees: number;
}

function agregerLignes(lignes: LigneRapprochement[]): AgregatEcart {
  let totalPrevu = new Decimal(0);
  let totalReel = new Decimal(0);
  let totalEcartAbsolu = new Decimal(0);
  let nombreLignesSansSourceReelle = 0;
  let nombreLignesNonRapprochees = 0;

  for (const l of lignes) {
    totalPrevu = totalPrevu.plus(l.prevu);
    if (l.statutRapprochement === "SANS_SOURCE_REELLE") {
      nombreLignesSansSourceReelle += 1;
      continue; // reel === null : jamais additionne comme 0 (ADR-053 15.1)
    }
    if (l.statutRapprochement === "NON_RAPPROCHE") {
      nombreLignesNonRapprochees += 1;
    }
    totalReel = totalReel.plus(l.reel as Decimal);
    totalEcartAbsolu = totalEcartAbsolu.plus(l.ecartAbsolu as Decimal);
  }

  return {
    totalPrevu,
    totalReel,
    totalEcartAbsolu,
    nombreLignes: lignes.length,
    nombreLignesSansSourceReelle,
    nombreLignesNonRapprochees,
  };
}

/** Agregat d'un mois donne, avec son `moisAbsolu`. */
export interface AgregatMois extends AgregatEcart {
  moisAbsolu: number;
}

/**
 * Agrege les lignes de rapprochement par mois (`moisAbsolu`), triees par
 * mois croissant. Une ligne SANS_SOURCE_REELLE est comptee dans
 * `nombreLignesSansSourceReelle` mais jamais dans `totalReel`. Une ligne
 * NON_RAPPROCHE est comptee dans le total reel (bac explicite, section 5)
 * ET dans `nombreLignesNonRapprochees`.
 */
export function agregerParMois(lignes: LigneRapprochement[]): AgregatMois[] {
  const parMois = new Map<number, LigneRapprochement[]>();
  for (const l of lignes) {
    const groupe = parMois.get(l.moisAbsolu) ?? [];
    groupe.push(l);
    parMois.set(l.moisAbsolu, groupe);
  }

  return Array.from(parMois.entries())
    .sort(([a], [b]) => a - b)
    .map(([moisAbsolu, groupe]) => ({ moisAbsolu, ...agregerLignes(groupe) }));
}

/**
 * Agrege les lignes cumulees depuis le debut de l'horizon jusqu'a (et y
 * compris) `jusquAMoisAbsolu` inclus — ou sur toutes les lignes fournies
 * si `jusquAMoisAbsolu` est omis (l'appelant a deja restreint `lignes` a
 * l'horizon voulu).
 */
export function agregerCumule(
  lignes: LigneRapprochement[],
  jusquAMoisAbsolu?: number,
): AgregatEcart {
  const retenues =
    jusquAMoisAbsolu === undefined ? lignes : lignes.filter((l) => l.moisAbsolu <= jusquAMoisAbsolu);
  return agregerLignes(retenues);
}

/** Agregat par poste/categorie prevue (`cle`), tous mois confondus dans `lignes`. */
export interface AgregatPoste extends AgregatEcart {
  cle: string;
  libelle: string;
}

/**
 * Agrege les lignes par poste (identifie par la partie de `id` avant le
 * separateur `::moisAbsolu`, cf. `reconcilierPrevuEtReel`/
 * `construireLigneRapprochement`) — vue "par poste" du §6 des exigences.
 * Le libelle retenu est celui de la premiere ligne rencontree pour ce
 * poste (stable, toutes les lignes d'un meme poste partagent le meme
 * libelle par construction de `reconcilierPrevuEtReel`).
 */
export function agregerParPoste(lignes: LigneRapprochement[]): AgregatPoste[] {
  const cleDePoste = (l: LigneRapprochement): string => l.id.split("::").slice(0, -1).join("::");

  const parPoste = new Map<string, LigneRapprochement[]>();
  for (const l of lignes) {
    const cle = cleDePoste(l);
    const groupe = parPoste.get(cle) ?? [];
    groupe.push(l);
    parPoste.set(cle, groupe);
  }

  return Array.from(parPoste.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cle, groupe]) => ({
      cle,
      libelle: groupe[0].libelle,
      ...agregerLignes(groupe),
    }));
}

/* ------------------------------------------------------------------ *
 * 7. Top ecarts du mois
 * ------------------------------------------------------------------ */

/**
 * Retourne les `n` lignes (defaut 5) du mois `moisAbsolu` dont
 * `|ecartAbsolu|` est le plus grand, triees par ordre decroissant.
 *
 * Les lignes `SANS_SOURCE_REELLE` (`ecartAbsolu === null`) sont exclues du
 * classement — il n'existe aucune base pour les comparer a un ecart
 * chiffre.
 *
 * Departage deterministe en cas d'ex aequo sur `|ecartAbsolu|` : ordre
 * secondaire alphabetique sur `libelle`, puis sur `id` — jamais un ordre
 * instable dependant de l'ordre d'insertion (un tri instable serait une
 * regression invisible, section 6.7 du prompt de story).
 */
export function topEcartsDuMois(
  lignes: LigneRapprochement[],
  moisAbsolu: number,
  n = 5,
): LigneRapprochement[] {
  const candidates = lignes.filter(
    (l) => l.moisAbsolu === moisAbsolu && l.ecartAbsolu !== null,
  );

  const tries = [...candidates].sort((a, b) => {
    const amplitudeA = (a.ecartAbsolu as Decimal).abs();
    const amplitudeB = (b.ecartAbsolu as Decimal).abs();
    const parAmplitude = amplitudeB.comparedTo(amplitudeA); // decroissant
    if (parAmplitude !== 0) return parAmplitude;

    const parLibelle = a.libelle.localeCompare(b.libelle);
    if (parLibelle !== 0) return parLibelle;

    return a.id.localeCompare(b.id);
  });

  return tries.slice(0, n);
}
