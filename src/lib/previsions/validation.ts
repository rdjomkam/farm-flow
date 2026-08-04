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

/**
 * validerSommeRepartitionMoisAliment — validation bloquante (ADR-053
 * section 3.5).
 *
 * La somme des pourcentages des `RepartitionMoisAliment` d'un meme
 * `AlimentPrevision` doit valoir EXACTEMENT 100.
 *
 * @param repartitions - toutes les lignes de repartition mensuelle d'UN SEUL AlimentPrevision
 * @throws {Error} si la somme des pourcentages != 100
 */
export function validerSommeRepartitionMoisAliment(repartitions: RepartitionMoisInput[]): void {
  const somme = repartitions.reduce((s, r) => s.plus(r.pourcentage), new Decimal(0));

  if (!somme.eq(100)) {
    throw new Error(
      `La somme des pourcentages de repartition mensuelle d'un aliment previsionnel doit valoir 100 (obtenu : ${somme.toString()}).`
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
 * @throws {Error} si un seuil n'est pas strictement superieur au seuil du palier precedent, dans l'ordre trie par `ordre`
 */
export function validerPaliersRemiseCroissants(paliers: PalierRemiseInput[]): void {
  const sorted = [...paliers].sort((a, b) => a.ordre - b.ordre);

  for (let i = 1; i < sorted.length; i++) {
    if (!sorted[i].seuilTonnes.gt(sorted[i - 1].seuilTonnes)) {
      throw new Error(
        `Les paliers de remise doivent avoir des seuils strictement croissants dans leur ordre d'evaluation (ordre=${sorted[i].ordre}, seuilTonnes=${sorted[i].seuilTonnes.toString()} n'est pas > ordre=${sorted[i - 1].ordre}, seuilTonnes=${sorted[i - 1].seuilTonnes.toString()}).`
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
 * @throws {Error} si la somme des parts != 100
 */
export function validerSommeApprovisionnementArticles(parts: Decimal[]): void {
  const somme = parts.reduce((s, p) => s.plus(p), new Decimal(0));

  if (!somme.eq(100)) {
    throw new Error(
      `La somme des parts d'approvisionnement des articles d'un aliment previsionnel doit valoir 100 (obtenu : ${somme.toString()}).`
    );
  }
}
