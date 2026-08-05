/**
 * src/lib/previsions-presentation/reprevision-glissante.ts
 *
 * Fusion « Reprevision glissante » (ADR-053 §6.5 des exigences
 * fonctionnelles, amendement §15.2, sprint PR3-ter, story B.2).
 *
 * PERIMETRE, TRANCHE PAR L'ADR, NON REINTERPRETABLE (§15.2, avant-dernier
 * paragraphe) : cette fusion vit dans la COUCHE DE PRESENTATION, jamais
 * dans le moteur (`src/lib/previsions/`) ni dans le schema Prisma. Aucune
 * ecriture en base ne resulte de cette fonction — c'est purement du calcul
 * de presentation, appele a la demande par la route/le composant qui
 * affiche la vue tresorerie.
 *
 * SEMANTIQUE, TRANCHEE PAR L'ADR (§15.2) — ne pas la reinventer :
 * - Pour chaque mois `m` de l'horizon : si une `ClotureMois` existe pour
 *   `m` (mois clos) -> la valeur mensuelle de la reprevision est le REEL
 *   NETTE de ce mois (`src/lib/previsions-presentation/tresorerie-reelle-
 *   nette.ts`, story B.1). Sinon (mois non clos) -> la valeur mensuelle
 *   est la PREVISION ACTUALISEE de ce mois (`resultatFCFA` du moteur,
 *   `calculerProjectionScenario`, ADR-053 §15.2 : "l'etat courant du
 *   scenario, recalcule a la demande").
 * - PREVISION ACTUALISEE != Reprevision (ADR-053 §15.2, dernier
 *   paragraphe) : deux notions distinctes, nommees distinctement ici
 *   (`MoisPrevisionActualiseePourFusion` vs `MoisReprevisionGlissante`) —
 *   la Reprevision est la SERIE FUSIONNEE resultante, la Prevision
 *   Actualisee n'est qu'UNE de ses deux sources possibles par mois.
 * - LE PIEGE CENTRAL DE CETTE STORY : le solde CUMULE de la reprevision
 *   doit etre RECALCULE en cumulant cette serie mixte — JAMAIS recopie du
 *   cumul deja calcule par l'une ou l'autre serie source. Recopier le
 *   cumul "Prevision Actualisee" pour les mois non clos casserait la
 *   continuite au point de bascule (le cumul de la Prevision Actualisee
 *   ignore par construction toute substitution du reel sur les mois clos
 *   qui le precedent). Recopier le cumul "Reel" pour les mois clos
 *   casserait la continuite au premier mois non clos qui suit (le cumul
 *   du Reel n'a jamais integre les mois non clos avant lui). La seule
 *   construction correcte est un cumul UNIQUE, tenu par cette fonction,
 *   qui additionne le delta mensuel choisi (Reel nette OU Prevision
 *   Actualisee) mois apres mois, sans jamais lire un champ "cumule"
 *   pre-existant d'aucune des deux series sources.
 *
 * CAVEAT PROPAGE (ADR-053 §15.1(b)) : tout mois source REEL herite du
 * caveat "apports reels non modelises" de
 * `tresorerie-reelle-nette.ts` — porte explicitement par
 * `MoisReprevisionGlissante.caveatSerieReelleIncomplete`, non filtrable,
 * meme sur un mois source PREVISION_ACTUALISEE (le caveat qualifie la
 * SERIE dans son ensemble : un mois non clos aujourd'hui peut devenir un
 * mois clos demain, portant le meme biais structurel — l'appelant ne doit
 * jamais pouvoir l'oublier en ne lisant le champ que sur les mois deja
 * clos).
 *
 * Fonctions PURES, ZERO I/O.
 */
import { Decimal } from "../previsions/decimal-config";
import type { MoisProjectionResult } from "../previsions/route-orchestration";
import type { SoldeReelNette } from "./tresorerie-reelle-nette";

/** Source effective retenue pour un mois donne de la reprevision glissante (ADR-053 §15.2). */
export type SourceMoisReprevision = "REEL" | "PREVISION_ACTUALISEE";

/**
 * Entree PREVISION ACTUALISEE pour la fusion — sous-ensemble de
 * `MoisProjectionResult` (moteur `calculerProjectionScenario`, jamais
 * recalcule ici). `resultatFCFA` est le DELTA mensuel (revenus + apports -
 * depenses), pas un solde cumule — c'est le meme delta qui alimente deja
 * `MoisProjectionResult.soldeFCFA` cumule par le moteur (ADR-053, moteur
 * `tresorerie.ts`), mais cette fonction ne lit JAMAIS `soldeFCFA` :
 * conforme au piege central ci-dessus, le cumul de la reprevision est
 * recalcule ici a partir des deltas, jamais recopie d'un cumul existant.
 */
export type MoisPrevisionActualiseePourFusion = Pick<
  MoisProjectionResult,
  "moisAbsolu" | "resultatFCFA"
>;

/** Ligne de la serie « Reprevision glissante » fusionnee, pour un mois donne. */
export interface MoisReprevisionGlissante {
  moisAbsolu: number;
  /** Source effectivement retenue pour ce mois (REEL si mois clos, sinon PREVISION_ACTUALISEE). */
  source: SourceMoisReprevision;
  /** Delta mensuel de la source retenue (reel nette du mois, ou resultatFCFA de la prevision actualisee). */
  soldeMensuelFCFA: Decimal;
  /**
   * Solde cumule de la SERIE MIXTE, recalcule par cette fonction —
   * JAMAIS recopie du cumul de la serie Reel ni de celui de la Prevision
   * Actualisee (piege central de cette story, voir JSDoc du module).
   */
  soldeCumuleFCFA: Decimal;
  /**
   * Caveat non filtrable (ADR-053 §15.1(b), propage depuis
   * `tresorerie-reelle-nette.ts`) : la serie REEL est structurellement
   * incomplete (aucun modele domaine reel pour un apport/subvention/pret
   * reellement encaisse). Toujours `true`, sur tous les mois — y compris
   * ceux dont `source === "PREVISION_ACTUALISEE"` (le biais qualifie la
   * serie, pas seulement le mois deja substitue).
   */
  caveatSerieReelleIncomplete: true;
}

/**
 * Construit la serie « Reprevision glissante » (ADR-053 §6.5, story B.2) en
 * fusionnant la Prevision Actualisee (tout l'horizon) avec le Reel nette
 * (uniquement les mois clos, story B.1) selon `moisClotures`.
 *
 * @param moisPrevisionActualisee Horizon COMPLET, trie par `moisAbsolu`
 *   croissant (a la charge de l'appelant — cette fonction ne trie pas, elle
 *   suit l'ordre fourni pour determiner la liste des mois a produire : la
 *   Prevision Actualisee couvre toujours l'integralite de l'horizon du
 *   scenario, contrairement au Reel nette qui ne porte que les mois avec
 *   donnees).
 * @param moisReelNet Sortie de `netterTresorerieReelleParMois` (B.1) —
 *   MENSUELLE, jamais cumulee (cette fonction fait son propre cumul).
 * @param moisClotures Ensemble des `moisAbsolu` ayant une `ClotureMois`
 *   (mois clos) pour ce scenario.
 */
export function construireReprevisionGlissante(
  moisPrevisionActualisee: MoisPrevisionActualiseePourFusion[],
  moisReelNet: SoldeReelNette[],
  moisClotures: ReadonlySet<number>,
): MoisReprevisionGlissante[] {
  const reelParMois = new Map<number, Decimal>();
  for (const m of moisReelNet) {
    reelParMois.set(m.moisAbsolu, m.soldeNetFCFA);
  }

  let cumul = new Decimal(0);
  const resultat: MoisReprevisionGlissante[] = [];

  for (const mois of moisPrevisionActualisee) {
    const estClos = moisClotures.has(mois.moisAbsolu);
    const source: SourceMoisReprevision = estClos ? "REEL" : "PREVISION_ACTUALISEE";
    // Mois clos sans aucune ligne reelle nettable ce mois-la (cas legitime :
    // aucune depense/vente reelle ce mois) -> delta 0, jamais l'absence du
    // mois dans le resultat (la reprevision doit rester continue sur tout
    // l'horizon, comme la Prevision Actualisee qu'elle remplace mois par
    // mois).
    const soldeMensuelFCFA = estClos
      ? (reelParMois.get(mois.moisAbsolu) ?? new Decimal(0))
      : mois.resultatFCFA;

    cumul = cumul.plus(soldeMensuelFCFA);

    resultat.push({
      moisAbsolu: mois.moisAbsolu,
      source,
      soldeMensuelFCFA,
      soldeCumuleFCFA: cumul,
      caveatSerieReelleIncomplete: true,
    });
  }

  return resultat;
}
