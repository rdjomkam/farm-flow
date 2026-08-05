/**
 * src/components/previsions/tresorerie-types.ts
 *
 * DTO Server -> Client de la vue tresorerie a TROIS SERIES (ADR-053 §6.5
 * des exigences fonctionnelles, amendement §15.1(b)/§15.2, Sprint PR3-ter,
 * story B.5). Miroir exact de la sortie JSON de `GET
 * /api/previsions/scenarios/[id]/tresorerie` (voir la route pour le detail
 * de chaque champ) — `Decimal` deja converti en `number` avant de
 * traverser la frontiere Server -> Client, meme discipline que
 * `projection-types.ts`/`rapprochement-types.ts`.
 */

/** Source effective retenue pour un mois donne de la Reprevision glissante (ADR-053 §15.2). PREVISION ACTUALISEE != Reprevision : deux notions distinctes, jamais confondues. */
export type SourceMoisReprevisionDTO = "REEL" | "PREVISION_ACTUALISEE";

/** Une ligne mensuelle de la vue tresorerie a 3 series. */
export interface MoisTresorerieTroisSeriesDTO {
  moisAbsolu: number;
  /** BUDGET INITIAL fige a l'activation — `null` ssi le scenario n'a jamais ete active. */
  budgetInitialFCFA: number | null;
  /** PRÉVISION ACTUALISÉE — recalculee a la demande, toujours definie. */
  previsionActualiseeFCFA: number;
  /** RÉEL nette, cumule sur tout l'horizon (delta 0 les mois sans ligne reelle) — toujours definie. */
  reelFCFA: number;
  /** Caveat non filtrable (ADR-053 §15.1(b)) : la serie REEL n'a AUCUN modele pour les apports/subventions/prets reellement encaisses — biaisee a la baisse des qu'un apport a ete reellement encaisse. */
  caveatApportsReelsNonModelises: true;
}

/** Une ligne mensuelle de la Reprevision glissante (fusion REEL sur mois clos / PREVISION ACTUALISEE sur mois non clos, ADR-053 §15.2). */
export interface MoisReprevisionGlissanteDTO {
  moisAbsolu: number;
  source: SourceMoisReprevisionDTO;
  soldeMensuelFCFA: number;
  soldeCumuleFCFA: number;
  /** Meme caveat non filtrable, propage y compris sur les mois source PREVISION_ACTUALISEE (le biais qualifie la serie, pas seulement le mois deja substitue). */
  caveatSerieReelleIncomplete: true;
}

/** Sortie complete de `GET /api/previsions/scenarios/[id]/tresorerie`. */
export interface TresorerieTroisSeriesDTO {
  scenarioId: string;
  horizonMois: number;
  /** `true` ssi le scenario a ete active au moins une fois (au moins une ligne dans `SnapshotBudgetInitial`). */
  budgetInitialDisponible: boolean;
  series: MoisTresorerieTroisSeriesDTO[];
  reprevisionGlissante: MoisReprevisionGlissanteDTO[];
  caveatSerieReelleIncomplete: true;
  calculeLe: string;
}
