/**
 * Moteur Previsions — Validations bloquantes.
 *
 * ADR-053 section 3.5 : la somme des pourcentages de RepartitionMoisAliment
 * n'est pas exprimable par un CHECK SQL (agregat multi-lignes), elle vit
 * dans la couche API, bloquante avant toute ecriture, dans la meme
 * transaction que l'ecriture (R4). Ces fonctions portent cette logique de
 * validation — elles restent pures (aucun I/O), c'est a l'appelant (couche
 * API/queries, hors perimetre PR1.3) de les invoquer avant d'ecrire.
 *
 * Convention du depot (calculs.ts) : erreur par valeur de retour
 * (`return null`) pour un cas metier normal, exception reservee aux
 * violations d'invariant. Une somme de pourcentages != 100%, ou des
 * seuils de palier non strictement croissants, sont des violations
 * d'invariant de saisie (blocage explicite specifie par l'ADR, pas un cas
 * metier a absorber silencieusement) — d'ou l'usage d'exceptions ici,
 * conforme a cette convention.
 *
 * Reference : docs/decisions/ADR-053-module-previsions.md
 */
import { Decimal } from "./decimal-config";
import type { RepartitionMoisInput, PalierRemiseInput } from "./types";
import { ValidationError, BusinessRuleError } from "@/lib/errors";

/**
 * validerSommeRepartitionMoisAliment — validation bloquante (ADR-053
 * section 3.5).
 *
 * La somme des pourcentages des `RepartitionMoisAliment` d'un meme
 * `AlimentPrevision` doit valoir EXACTEMENT 100.
 *
 * @param repartitions - toutes les lignes de repartition mensuelle d'UN SEUL AlimentPrevision
 * @throws {BusinessRuleError} (status 422) si la somme des pourcentages != 100 — ERR-165
 */
export function validerSommeRepartitionMoisAliment(repartitions: RepartitionMoisInput[]): void {
  const somme = repartitions.reduce((s, r) => s.plus(r.pourcentage), new Decimal(0));

  if (!somme.eq(100)) {
    throw new BusinessRuleError(
      `La somme des pourcentages de repartition mensuelle d'un aliment previsionnel doit valoir 100 (obtenu : ${somme.toString()}).`,
      422
    );
  }
}

/**
 * validerCouvertureMoisRepartition — validation bloquante (ERR-162, docs/
 * knowledge/ERRORS-AND-FIXES.md).
 *
 * `validerSommeRepartitionMoisAliment` ci-dessus controle la FORME d'un
 * ensemble de `RepartitionMoisAliment` (somme des pourcentages = 100) mais
 * pas sa COMPLETUDE : un ensemble de 2 lignes `{moisCycle:1, 60%}`,
 * `{moisCycle:2, 40%}` sur un cycle de 3 mois valide deja la somme, alors que
 * le `moisCycle=3` — traite comme 0% par `aliments.ts` — n'a jamais ete saisi
 * explicitement. Cette fonction verifie que l'ensemble des `moisCycle` recus
 * est EXACTEMENT `{1, 2, ..., dureeCycleMois}` : ni mois manquant, ni
 * doublon, ni mois hors bornes. Un `pourcentage = 0` sur un mois PRESENT est
 * valide (le mois est couvert, sa part est nulle) — a ne jamais confondre
 * avec un mois ABSENT du tableau.
 *
 * `dureeCycleMois` qui fait foi ici : `ScenarioPrevision.dureeCycleMois` (la
 * valeur COURANTE du scenario, jamais `VaguePrevue.dureeCycleMoisFigee` — une
 * copie gelee par vague) puisque `RepartitionMoisAliment` est rattachee a un
 * `AlimentPrevision`, lui-meme rattache directement au `ScenarioPrevision`,
 * jamais a une `VaguePrevue` (cf. schema : `RepartitionMoisAliment.moisCycle
 * // 1..scenario.dureeCycleMois`, `prisma/schema.prisma:4568`).
 *
 * @param repartitions - toutes les lignes de repartition mensuelle d'UN SEUL AlimentPrevision (ou le tableau candidat a l'ecriture)
 * @param dureeCycleMois - `scenario.dureeCycleMois` du `ScenarioPrevision` proprietaire de cet `AlimentPrevision`
 * @throws {ValidationError} (status 422) si un mois est hors bornes (0, negatif ou > dureeCycleMois), en double, ou si un mois de `1..dureeCycleMois` est absent — le message nomme explicitement les mois fautifs
 */
export function validerCouvertureMoisRepartition(
  repartitions: Pick<RepartitionMoisInput, "moisCycle">[],
  dureeCycleMois: number
): void {
  const horsBornes = [
    ...new Set(repartitions.map((r) => r.moisCycle).filter((m) => m < 1 || m > dureeCycleMois)),
  ].sort((a, b) => a - b);
  if (horsBornes.length > 0) {
    throw new ValidationError(
      `La repartition mensuelle d'un aliment previsionnel contient des mois hors du cycle (1..${dureeCycleMois}) : ${horsBornes.join(", ")}.`,
      422
    );
  }

  const occurrences = new Map<number, number>();
  for (const r of repartitions) {
    occurrences.set(r.moisCycle, (occurrences.get(r.moisCycle) ?? 0) + 1);
  }
  const doublons = [...occurrences.entries()]
    .filter(([, n]) => n > 1)
    .map(([mois]) => mois)
    .sort((a, b) => a - b);
  if (doublons.length > 0) {
    throw new ValidationError(
      `La repartition mensuelle d'un aliment previsionnel contient des mois en double : ${doublons.join(", ")}.`,
      422
    );
  }

  const presents = new Set(repartitions.map((r) => r.moisCycle));
  const manquants: number[] = [];
  for (let mois = 1; mois <= dureeCycleMois; mois++) {
    if (!presents.has(mois)) manquants.push(mois);
  }
  if (manquants.length > 0) {
    throw new ValidationError(
      `La repartition mensuelle d'un aliment previsionnel doit couvrir tous les mois du cycle (1..${dureeCycleMois}) — mois manquant(s) : ${manquants.join(", ")}.`,
      422
    );
  }
}

/**
 * validerPaliersRemiseCroissants — validation bloquante.
 *
 * Un ensemble de `PalierRemise` dont les seuils ne sont pas strictement
 * croissants, dans leur ordre d'evaluation explicite (`ordre`), est un
 * invariant viole : `determinerPourcentageRemise` (aliments.ts) presuppose que
 * le DERNIER palier atteint (en parcourant les paliers tries par `ordre`)
 * est le plus favorable — cette hypothese est fausse si les seuils ne
 * sont pas strictement croissants dans cet ordre.
 *
 * L'ADR-053 ne precise pas de mecanisme dedie pour ce cas (section 8) ; le
 * meme patron que la validation "somme = 100%" (section 3.5) est applique
 * ici par analogie, choix documente : blocage explicite a l'ecriture,
 * jamais une correction silencieuse de l'ordre des seuils.
 *
 * @param paliers - tous les paliers de remise d'UN SEUL ScenarioPrevision (ou d'un sous-ensemble coherent)
 * @throws {BusinessRuleError} (status 422) si un seuil n'est pas strictement superieur au seuil du palier precedent, dans l'ordre trie par `ordre` — ERR-165
 */
export function validerPaliersRemiseCroissants(paliers: PalierRemiseInput[]): void {
  const sorted = [...paliers].sort((a, b) => a.ordre - b.ordre);

  for (let i = 1; i < sorted.length; i++) {
    if (!sorted[i].seuilTonnes.gt(sorted[i - 1].seuilTonnes)) {
      throw new BusinessRuleError(
        `Les paliers de remise doivent avoir des seuils strictement croissants dans leur ordre d'evaluation (ordre=${sorted[i].ordre}, seuilTonnes=${sorted[i].seuilTonnes.toString()} n'est pas > ordre=${sorted[i - 1].ordre}, seuilTonnes=${sorted[i - 1].seuilTonnes.toString()}).`,
        422
      );
    }
  }
}

/**
 * validerSommeApprovisionnementArticles — validation bloquante (ADR-053 §12.2,
 * arbitrage 3, amendement Sprint PR2-quater).
 *
 * La somme des `partApprovisionnementPct` de tous les `AlimentArticlePrevision`
 * d'un meme calibre (`AlimentPrevision`) doit valoir EXACTEMENT 100 — meme
 * patron que `validerSommeRepartitionMoisAliment` ci-dessus : bloquante,
 * appelee dans la MEME transaction Prisma que l'ecriture (R4), jamais une
 * contrainte SQL (un `CHECK` ne voit qu'une ligne a la fois).
 *
 * @param parts - les `partApprovisionnementPct` de TOUS les articles d'UN SEUL calibre (remplace-tout)
 * @throws {BusinessRuleError} (status 422) si la somme des parts != 100 — ERR-165
 */
export function validerSommeApprovisionnementArticles(parts: Decimal[]): void {
  const somme = parts.reduce((s, p) => s.plus(p), new Decimal(0));

  if (!somme.eq(100)) {
    throw new BusinessRuleError(
      `La somme des parts d'approvisionnement des articles d'un aliment previsionnel doit valoir 100 (obtenu : ${somme.toString()}).`,
      422
    );
  }
}
