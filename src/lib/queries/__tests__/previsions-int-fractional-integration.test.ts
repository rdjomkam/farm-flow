/**
 * Test d'intégration DB-gated — story PR2.1, homonymie `sacsCalcules`
 * (dette PR1 réserve 6, cf. JSDoc `AlimentParVaguePrevueInputDTO`,
 * `src/lib/queries/previsions-vagues.ts`).
 *
 * ADR-053 §3.6 : `AlimentParVaguePrevue.sacsCalcules`/`sacsSaisis` sont des
 * colonnes Prisma `Int`. Ce fichier vérifiait à l'origine EMPIRIQUEMENT,
 * contre un VRAI Postgres (Docker, port 8432), ce qui se passait si
 * l'appelant violait la règle "toujours un entier" — et avait DÉCOUVERT un
 * bug (sévérité moyenne, rapport story PR2.1 section 9) : Prisma tronquait
 * silencieusement (`Math.trunc`, sans exception) une valeur fractionnaire
 * avant même d'atteindre Postgres, contrairement au driver `pg` nu qui
 * rejette la même valeur sur une vraie colonne `integer` (`22P02`).
 *
 * CORRECTIF appliqué depuis (même story, après ce rapport) : une garde
 * applicative explicite (`assertEntierColonneInt`, `Number.isInteger`) a été
 * ajoutée dans `replaceAlimentsParVaguePrevue` et `updateSacsSaisis`,
 * *avant* toute écriture Prisma. Ce fichier vérifie désormais le NOUVEAU
 * comportement attendu : un rejet bruyant (exception), jamais plus une
 * troncature silencieuse — la troncature Prisma sous-jacente existe
 * toujours (comportement du client, hors de notre contrôle), mais elle
 * n'est plus jamais atteinte car la garde applicative intercepte la valeur
 * fractionnaire en amont.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;
let client: PoolClient | null = null;
let dbAvailable = false;
let erreurConnexion: unknown = null;

const MESSAGE_DB_INJOIGNABLE =
  "[PR2.1] DATABASE_URL est definie (le gating a legitimement decide que ce " +
  "test devait tourner) mais la connexion a la base a echoue : ce n'est pas un " +
  "skip, c'est un echec d'infrastructure du run (contrat ADR-052 3.2 / " +
  "src/test/require-database-url.ts). Action : verifiez que Postgres tourne " +
  "(`docker compose up -d`) et que DATABASE_URL pointe vers une base joignable, " +
  "puis relancez.";

beforeAll(async () => {
  if (!DATABASE_URL) return;
  try {
    pool = new Pool({ connectionString: DATABASE_URL });
    client = await pool.connect();
    await client.query("SELECT 1");
    dbAvailable = true;
  } catch (erreur) {
    dbAvailable = false;
    erreurConnexion = erreur;
  }
});

afterAll(async () => {
  client?.release();
  await pool?.end();
});

interface SeedIds {
  siteId: string;
  userId: string;
  scenarioId: string;
  vaguePrevueId: string;
  alimentPrevisionId: string;
}

async function seed(c: PoolClient, suffix: string): Promise<SeedIds> {
  const siteId = `pr21-int-site-${suffix}`;
  const userId = `pr21-int-user-${suffix}`;
  const scenarioId = `pr21-int-scenario-${suffix}`;
  const vaguePrevueId = `pr21-int-vague-${suffix}`;
  const alimentPrevisionId = `pr21-int-aliment-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR2.1 ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR2.1 ${suffix}`, userId]
  );
  await c.query(
    `INSERT INTO "ScenarioPrevision" (id, code, nom, "dureeCycleMois", "dateDebutPlan", statut, "userId", "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, 'Scenario test', 3, now(), 'BROUILLON', $3, $4, now(), now())`,
    [scenarioId, `PR21-INT-${suffix}`, userId, siteId]
  );
  await c.query(
    `INSERT INTO "ParametresPrevision" (id, "scenarioId", "effectifAlevinsParVague", "margeSecuriteAlevinsPct", "poidsMoyenInitialG", "poidsObjectifG", "prixAlevinUnitaireFCFA", "prixVenteKgFCFA", "nombreBacsSimultanesCible", "frequenceStockageMois", "createdAt", "updatedAt")
     VALUES ($1, $2, 1000, 5, 5, 800, 50, 1500, 4, 1, now(), now())`,
    [`pr21-int-params-${suffix}`, scenarioId]
  );
  await c.query(
    `INSERT INTO "VaguePrevue" (id, "scenarioId", code, "dateStockagePrevue", "effectifAlevinsPrevu", "poidsMoyenInitialG", "dureeCycleMoisFigee", statut, "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, now(), 1000, 5, 3, 'PLANIFIEE', $4, now(), now())`,
    [vaguePrevueId, scenarioId, `V-${suffix}`, siteId]
  );
  // ADR-053 §12 (amendement PR2-quater) : AlimentPrevision est desormais le
  // niveau CALIBRE (identifie par tailleGranule, NOT NULL) ; libelle,
  // poidsSacKg, prixSacFCFA et sacsParTonneUnitaire ont migre vers le
  // niveau ARTICLE (AlimentArticlePrevision). Ce test n'exerce que
  // AlimentParVaguePrevue (grain calibre, inchange) : aucun article n'est
  // necessaire pour reproduire le bug de troncature qu'il verifie.
  await c.query(
    `INSERT INTO "AlimentPrevision" (id, "scenarioId", "tailleGranule", ordre, "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, 'G1', 0, $3, now(), now())`,
    [alimentPrevisionId, scenarioId, siteId]
  );

  return { siteId, userId, scenarioId, vaguePrevueId, alimentPrevisionId };
}

async function cleanup(c: PoolClient, ids: SeedIds): Promise<void> {
  await c.query(`DELETE FROM "AlimentParVaguePrevue" WHERE "vaguePrevueId" = $1`, [ids.vaguePrevueId]);
  await c.query(`DELETE FROM "VaguePrevue" WHERE id = $1`, [ids.vaguePrevueId]);
  await c.query(`DELETE FROM "AlimentPrevision" WHERE id = $1`, [ids.alimentPrevisionId]);
  await c.query(`DELETE FROM "ParametresPrevision" WHERE "scenarioId" = $1`, [ids.scenarioId]);
  await c.query(`DELETE FROM "ScenarioPrevision" WHERE id = $1`, [ids.scenarioId]);
  await c.query(`DELETE FROM "Site" WHERE id = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "User" WHERE id = $1`, [ids.userId]);
}

describe.runIf(requireDatabaseUrl())(
  "PR2.1 — CORRIGE : une valeur fractionnaire est desormais rejetee bruyamment par la garde applicative, jamais tronquee en silence",
  () => {
    it(
      "replaceAlimentsParVaguePrevue : sacsCalcules=3.7 est REJETE (exception), rien n'est ecrit en base",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        const ids = await seed(client, "sacscalc-frac");
        try {
          const { replaceAlimentsParVaguePrevue } = await import(
            "@/lib/queries/previsions-vagues"
          );

          // CORRIGE : la garde applicative (`assertEntierColonneInt`) rejette
          // la valeur fractionnaire AVANT toute ecriture Prisma — plus de
          // troncature silencieuse (cf. bug documente dans le rapport de la
          // story PR2.1, section 9).
          await expect(
            replaceAlimentsParVaguePrevue(ids.vaguePrevueId, ids.siteId, [
              {
                alimentPrevisionId: ids.alimentPrevisionId,
                moisCycle: 1,
                sacsCalcules: 3.7, // fractionnaire — colonne Int, ne devrait jamais arriver ici
                sacsSaisis: null,
                quantiteKgCalculee: 92.5,
                coutCalculeFCFA: 55500,
              },
            ])
          ).rejects.toThrow(/sacsCalcules doit etre un entier/);

          const { rows } = await client.query(
            `SELECT "sacsCalcules" FROM "AlimentParVaguePrevue" WHERE "vaguePrevueId" = $1`,
            [ids.vaguePrevueId]
          );
          expect(rows).toHaveLength(0);
        } finally {
          await cleanup(client, ids);
        }
      },
      20000
    );

    it(
      "updateSacsSaisis : sacsSaisis=12.3 est REJETE (exception), la valeur existante en base n'est pas modifiee",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        const ids = await seed(client, "sacssaisis-frac");
        const ligneId = "pr21-int-ligne-sacssaisis";
        try {
          await client.query(
            `INSERT INTO "AlimentParVaguePrevue" (id, "vaguePrevueId", "alimentPrevisionId", "moisCycle", "sacsCalcules", "sacsSaisis", "quantiteKgCalculee", "coutCalculeFCFA", "siteId")
             VALUES ($1, $2, $3, 1, 10, NULL, 250, 375000, $4)`,
            [ligneId, ids.vaguePrevueId, ids.alimentPrevisionId, ids.siteId]
          );

          const { updateSacsSaisis } = await import("@/lib/queries/previsions-vagues");

          await expect(updateSacsSaisis(ligneId, ids.siteId, 12.3)).rejects.toThrow(
            /sacsSaisis doit etre un entier/
          );

          const { rows } = await client.query(
            `SELECT "sacsSaisis" FROM "AlimentParVaguePrevue" WHERE id = $1`,
            [ligneId]
          );
          expect(rows[0].sacsSaisis).toBeNull();
        } finally {
          await client.query(`DELETE FROM "AlimentParVaguePrevue" WHERE id = $1`, [ligneId]);
          await cleanup(client, ids);
        }
      },
      20000
    );
  }
);
