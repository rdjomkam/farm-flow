/**
 * Allowlist des tests d'intégration DB-gated — ADR-052 §3.4.
 *
 * Une entrée par OCCURRENCE de `describe.runIf`/`skipIf`/`*.skip` (pas une
 * entrée par fichier — `su12-numero-unique-constraint.test.ts` en compte
 * deux, une par bloc `describe.runIf`).
 *
 * Chaque entrée doit porter une `justification` non vide décrivant la
 * ressource externe réelle en jeu (moteur Postgres — SAVEPOINT, transaction,
 * contrainte unique — jamais une justification générique du type « test
 * lent » ou « pratique »). Le test méta
 * (`src/__tests__/meta/db-gated-tests-registry.test.ts`) vérifie que
 * `justification.length` dépasse un seuil minimal pour empêcher une entrée
 * ajoutée à la hâte sans explication.
 *
 * Étendre cette allowlist doit être visiblement plus pénible que d'écrire un
 * test qui n'a pas besoin d'être gated (mock au lieu d'intégration réelle) —
 * c'est le comportement par défaut souhaité : un test devrait rester mocké
 * sauf s'il prouve un comportement du moteur DB lui-même.
 */
export interface DbGatedAllowlistEntry {
  /** Chemin relatif à la racine du dépôt. */
  file: string;
  /** Motif littéral de la ligne source (après trim), tel qu'il apparaît réellement dans le fichier. */
  linePattern: string;
  /** Pourquoi ce gate est légitime : quelle ressource externe réelle, quelle garantie prouvée. */
  justification: string;
  /** Référence ADR justifiant l'existence de ce gate. */
  adr: string;
}

export const DB_GATED_ALLOWLIST: DbGatedAllowlistEntry[] = [
  {
    file: "src/lib/queries/__tests__/bd0-savepoint-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve que le SAVEPOINT + ROLLBACK TO SAVEPOINT posé par createReleve désavorte " +
      "réellement une transaction Postgres après une vraie erreur SQL (42P01) survenant " +
      "dans calculerEcartsParBac — un mock ne peut pas reproduire l'état 'transaction " +
      "aborted' (25P02) d'un vrai moteur Postgres (ERR-113/ERR-115).",
    adr: "ADR-052",
  },
  {
    file: "src/lib/queries/__tests__/bd0-savepoint-integration-persister-origin.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve que la sonde canary (SELECT 1) détecte une transaction Postgres empoisonnée " +
      "même quand l'erreur SQL survient à l'intérieur de persisterEcartConstate, qui avale " +
      "ses propres erreurs sans jamais les relancer en JS — nécessite un vrai moteur " +
      "Postgres pour observer cet état, impossible à simuler par un mock (ERR-114).",
    adr: "ADR-052",
  },
  {
    file: "src/lib/queries/__tests__/bons-livraison-transaction-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve un rollback réel de signerBonLivraison contre une vraie transaction Postgres " +
      "(aucun effet partiel après un rejet réel de verifyAssignationInvariant) et le " +
      "verrouillage réel de lignes lors d'une double signature concurrente — comportement " +
      "du moteur, structurellement non prouvable par un mock de $transaction.",
    adr: "ADR-052",
  },
  // 2 entrées distinctes, une par bloc `describe.runIf`, ADR-052 §3.4 — ne pas fusionner.
  {
    file: "scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve que la contrainte d'unicité composite (siteId, numero) est réellement " +
      "appliquée par le moteur Postgres (violation 23505 sur INSERT dupliqué au sein d'un " +
      "même site, acceptation du même numero sur deux sites distincts) — pas seulement " +
      "simulée côté Prisma.",
    adr: "ADR-052",
  },
  {
    file: "scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Vérifie via pg_indexes (catalogue système Postgres réel) que chacune des 10 tables " +
      "migrées SU.12/SU.13 expose bien un index unique composite (siteId, numero|code) et " +
      "qu'aucun index unique global résiduel ne subsiste sur le champ seul — introspection " +
      "du moteur, sans équivalent mockable significatif.",
    adr: "ADR-052",
  },
  {
    file: "src/lib/queries/__tests__/previsions-int-fractional-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve empiriquement (story PR2.1) le comportement RÉEL du client Prisma face à une " +
      "valeur fractionnaire écrite dans une colonne Int (AlimentParVaguePrevue.sacsCalcules/ " +
      "sacsSaisis) : troncature silencieuse (Math.trunc, pas de rejet), différent du driver " +
      "pg nu (rejet 22P02) — un mock ne peut pas reproduire cette divergence réelle entre le " +
      "client Prisma et Postgres, seul un vrai aller-retour le révèle (bug documenté dans " +
      "docs/tests/rapport-story-PR2.1.md).",
    adr: "ADR-052",
  },
  {
    file: "src/lib/queries/__tests__/previsions-scenarios-copie-produits-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve contre un vrai schéma Postgres (contrainte NOT NULL réelle sur " +
      "AlimentPrevision) le chemin nominal de création de scénario sur un site avec des " +
      "Produit ALIMENT actifs — régression PR2-quater où tx.alimentPrevision.create() " +
      "omettait un champ requis (500 systématique) : un mock JS (previsions-fake-db.ts) " +
      "n'applique aucune contrainte NOT NULL et ne peut jamais faire échouer un create() " +
      "auquel il manque un champ requis, seul un vrai Prisma Client contre un vrai " +
      "Postgres peut exercer cette validation. Couvre aussi le rollback complet " +
      "(ScenarioPrevision + ParametresPrevision + AlimentPrevision + " +
      "AlimentArticlePrevision) quand un Produit ALIMENT actif n'a pas de tailleGranule.",
    adr: "ADR-052",
  },
];
