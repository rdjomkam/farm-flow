/**
 * Helper partagé — point de passage obligé pour tout test d'intégration
 * DB-gated (ADR-052 §3.2).
 *
 * Objectif : centraliser le point de décision « ce test doit-il tourner ? »
 * de sorte qu'un futur test d'intégration DB-gated n'ait techniquement aucune
 * raison d'écrire son propre `!!process.env.DATABASE_URL` ou son propre garde
 * de connexion — il appelle ce helper et rien d'autre.
 *
 * Contrat exact (ADR-052 §3.2) :
 * - Hors CI (`process.env.CI` non défini) :
 *   - `DATABASE_URL` absent → retourne `false` (permet à
 *     `describe.runIf(requireDatabaseUrl())` de skipper proprement en dev
 *     local sans Docker — ce skip reste visible dans le résumé Vitest comme
 *     un skip normal, jamais masqué).
 *   - `DATABASE_URL` présent → retourne `true`.
 * - En CI (`process.env.CI` défini) :
 *   - `DATABASE_URL` absent → ce cas ne devrait jamais être atteint puisque le
 *     garde global (`src/test/ci-db-guard.setup.ts`) a déjà fait échouer le
 *     run avant la collecte des tests. Ce helper lève quand même une `Error`
 *     par défense en profondeur (double protection, pas une redondance
 *     inutile : si `ci-db-guard.setup.ts` était un jour retiré de
 *     `setupFiles` par erreur, ce helper resterait le dernier filet).
 *   - `DATABASE_URL` présent → retourne `true`.
 *
 * Ce helper ne se connecte JAMAIS lui-même à la base et ne teste jamais la
 * joignabilité réseau — il vérifie uniquement la présence de la variable
 * d'environnement. La vérification de joignabilité réelle reste la
 * responsabilité du `beforeAll` de chaque fichier de test : si `DATABASE_URL`
 * est présent mais que la base n'est pas joignable, ce n'est plus un problème
 * de *gating* (le test a légitimement décidé de tourner), c'est un échec
 * d'infrastructure du run — qui doit faire échouer les tests bruyamment, pas
 * les faire passer silencieusement.
 */
export function requireDatabaseUrl(): boolean {
  const databaseUrl = process.env.DATABASE_URL;
  const isCi = !!process.env.CI;

  if (isCi) {
    if (!databaseUrl) {
      throw new Error(
        "[requireDatabaseUrl] DATABASE_URL est absente alors que process.env.CI est défini. " +
          "Ce cas ne devrait jamais être atteint : le garde global " +
          "(src/test/ci-db-guard.setup.ts, déclaré dans test.setupFiles de vitest.config.ts) " +
          "doit déjà avoir fait échouer la suite avant la collecte de ce test. " +
          "Si vous voyez cette erreur, c'est que ce garde a été retiré ou contourné — " +
          "restaurez-le, ou vérifiez que le service Postgres du workflow CI " +
          "(.github/workflows/ci.yml) exporte bien DATABASE_URL avant `npx vitest run` " +
          "(voir ADR-052 §5.1)."
      );
    }
    return true;
  }

  return !!databaseUrl;
}
