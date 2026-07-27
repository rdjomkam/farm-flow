/**
 * Garde global CI — ADR-052 §3.1.
 *
 * Déclaré dans `test.setupFiles` de `vitest.config.ts`, ce fichier s'exécute
 * au chargement du module (code de niveau supérieur, PAS dans un hook
 * `beforeAll`) — donc avant toute collecte de test, indépendamment de quel
 * fichier de test est lancé. C'est ce qui le rend inévitable : aucun fichier
 * de test individuel ne peut l'oublier ou le contourner par distraction,
 * puisqu'il ne dépend d'aucune action locale à un fichier précis.
 *
 * Contrat : si `process.env.CI` est défini (non vide) ET que
 * `process.env.DATABASE_URL` est absent ou vide, on lève une erreur qui fait
 * échouer tout `npx vitest run` avant même que le premier test ne s'exécute.
 * Hors CI (ou si DATABASE_URL est présent), ce fichier n'a aucun effet de
 * bord.
 *
 * Ce fichier ne doit dépendre d'AUCUN import applicatif — il doit rester
 * exécutable même si le reste du projet ne compile pas, pour ne jamais
 * lui-même devenir une source de faux négatif.
 */
if (process.env.CI && !process.env.DATABASE_URL) {
  throw new Error(
    "[ci-db-guard] DATABASE_URL est absente alors que process.env.CI est défini.\n" +
      "17 tests d'intégration DB-gated (SAVEPOINT/ROLLBACK réel sur transaction Postgres, " +
      "verrouillage de lignes, unicité composite (siteId, numero|code) appliquée par le " +
      "moteur) ne peuvent pas s'exécuter sans une base Postgres joignable. Les laisser " +
      "s'exécuter dans le vide masquerait silencieusement une régression sur des garanties " +
      "critiques du projet (voir ADR-052).\n" +
      "Corrigez le workflow CI : .github/workflows/ci.yml doit démarrer un service " +
      "`postgres` (image postgres:16-alpine), attendre sa disponibilité (pg_isready), et " +
      "exporter DATABASE_URL dans l'environnement du job avant `npx vitest run` " +
      "(voir ADR-052 §5.1)."
  );
}
