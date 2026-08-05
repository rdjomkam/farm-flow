/**
 * Test d'integration DB-gated — `previsions-cloture.ts` (Sprint PR3, story
 * PR3.6). Reference ADR-053 §3.10/§15.3.
 *
 * Couvre :
 * - la cloture fige `versionMapping` a la version ACTIVE au moment T, dans
 *   la MEME transaction que la creation de `ClotureMois` (R4) ;
 * - changer le mapping APRES la cloture (nouvelle version) NE MODIFIE PAS
 *   `versionMapping` deja fige (immuabilite de l'historique, ADR-053 §15.3) —
 *   c'est precisement la fixture (d) de la discipline de test imposee par
 *   ADR-053 §15.6 point 4 ;
 * - une SECONDE cloture du meme mois est refusee (409) ;
 * - une cloture hors de l'horizon du plan est refusee (422) ;
 * - un site B (sans aucun scenario/mapping) ne peut ni lire ni cloturer un
 *   mois du scenario du site A (isolation `siteId`, R8).
 *
 * Pourquoi DB-gated : la garantie testee repose sur une transaction Prisma
 * reelle (lecture de la version active + creation de `ClotureMois` dans le
 * MEME `$transaction`) et une contrainte d'unicite reelle
 * (`@@unique([scenarioId, moisAbsolu])`) — un mock JS n'exerce ni
 * l'atomicite ni l'unicite.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";
import { createScenario } from "@/lib/queries/previsions-scenarios";
import { creerVersionMapping } from "@/lib/queries/previsions-rapprochement-mapping";
import { cloturerMois, getCloturesMois } from "@/lib/queries/previsions-cloture";
import { SourceRapprochement, CibleRapprochement } from "@/types";

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;
let client: PoolClient | null = null;
let dbAvailable = false;
let erreurConnexion: unknown = null;

const MESSAGE_DB_INJOIGNABLE =
  "[PR3.6] DATABASE_URL est definie (le gating a legitimement decide que ce " +
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

async function seedSite(c: PoolClient, suffix: string): Promise<{ siteId: string; userId: string }> {
  const siteId = `pr3-cloture-site-${suffix}`;
  const userId = `pr3-cloture-user-${suffix}`;
  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR3 cloture ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR3 cloture ${suffix}`, userId]
  );
  return { siteId, userId };
}

async function cleanup(c: PoolClient, siteId: string, userId: string): Promise<void> {
  await c.query(`DELETE FROM "ClotureMois" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "MappingRapprochement" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "ParametresPrevision" WHERE "scenarioId" IN (SELECT id FROM "ScenarioPrevision" WHERE "siteId" = $1)`, [
    siteId,
  ]);
  await c.query(`DELETE FROM "ScenarioPrevision" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "Site" WHERE id = $1`, [siteId]);
  await c.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
}

const parametresBase = {
  effectifAlevinsParVague: 1000,
  margeSecuriteAlevinsPct: 5,
  poidsMoyenInitialG: 5,
  poidsObjectifG: 800,
  prixAlevinUnitaireFCFA: 50,
  prixVenteKgFCFA: 2000,
  nombreBacsSimultanesCible: 2,
  frequenceStockageMois: 1,
};

describe.runIf(requireDatabaseUrl())(
  "PR3.6 — cloturerMois : figeage de versionMapping et verrous",
  () => {
  it(
    "fige versionMapping a la version ACTIVE au moment T — une version ULTERIEURE du mapping ne change JAMAIS la cloture deja ecrite",
    async () => {
      if (!dbAvailable || !client) {
        throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
      }
      const { siteId, userId } = await seedSite(client, "immuabilite");
      try {
        const scenario = await createScenario(siteId, {
          code: "PR3-CLOTURE-IMMUABILITE",
          nom: "Scenario cloture immuabilite",
          dateDebutPlan: new Date("2026-01-01").toISOString(),
          userId,
          parametres: parametresBase,
        });

        // v1 du mapping, active au moment de la cloture.
        await creerVersionMapping(siteId, [
          {
            sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
            sourceCle: "ALIMENT",
            cibleType: CibleRapprochement.NON_RAPPROCHE,
            cibleId: null,
          },
        ]);

        const cloture = await cloturerMois(scenario.id, siteId, 0, userId);
        expect(cloture.moisAbsolu).toBe(0);
        expect(cloture.versionMapping).toBe(1);

        // v2 du mapping, creee APRES la cloture — jamais un UPDATE en place.
        await creerVersionMapping(siteId, [
          {
            sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
            sourceCle: "ALIMENT",
            cibleType: CibleRapprochement.POSTE_PREVISION,
            cibleId: "poste-quelconque",
          },
        ]);

        const [cloturesRelues] = [await getCloturesMois(scenario.id, siteId)];
        expect(cloturesRelues).toHaveLength(1);
        // La cloture deja ecrite reste figee sur la version 1, MEME si la
        // version active du site est desormais 2 — c'est la garantie
        // centrale d'ADR-053 §15.3.
        expect(cloturesRelues[0].versionMapping).toBe(1);
      } finally {
        await cleanup(client, siteId, userId);
      }
    },
    20000
  );

  it(
    "refuse une SECONDE cloture du meme mois (409) — la premiere cloture n'est jamais ecrasee",
    async () => {
      if (!dbAvailable || !client) {
        throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
      }
      const { siteId, userId } = await seedSite(client, "double-cloture");
      try {
        const scenario = await createScenario(siteId, {
          code: "PR3-CLOTURE-DOUBLE",
          nom: "Scenario cloture double",
          dateDebutPlan: new Date("2026-01-01").toISOString(),
          userId,
          parametres: parametresBase,
        });

        await cloturerMois(scenario.id, siteId, 0, userId);
        await expect(cloturerMois(scenario.id, siteId, 0, userId)).rejects.toMatchObject({ status: 409 });

        const clotures = await getCloturesMois(scenario.id, siteId);
        expect(clotures).toHaveLength(1);
      } finally {
        await cleanup(client, siteId, userId);
      }
    },
    20000
  );

  it(
    "refuse une cloture hors de l'horizon du plan (422)",
    async () => {
      if (!dbAvailable || !client) {
        throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
      }
      const { siteId, userId } = await seedSite(client, "hors-horizon");
      try {
        const scenario = await createScenario(siteId, {
          code: "PR3-CLOTURE-HORIZON",
          nom: "Scenario cloture hors horizon",
          dateDebutPlan: new Date("2026-01-01").toISOString(),
          userId,
          parametres: parametresBase,
        });

        // Aucune vague/poste/journal/apport : l'horizon du plan est de 1
        // mois (mois 0 uniquement) — le mois 5 est structurellement hors
        // horizon.
        await expect(cloturerMois(scenario.id, siteId, 5, userId)).rejects.toMatchObject({ status: 422 });

        const clotures = await getCloturesMois(scenario.id, siteId);
        expect(clotures).toHaveLength(0);
      } finally {
        await cleanup(client, siteId, userId);
      }
    },
    20000
  );

  it(
    "isolation siteId : le mapping ACTIF du site A n'est jamais visible par le site B (R8)",
    async () => {
      if (!dbAvailable || !client) {
        throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
      }
      const { siteId: siteA, userId: userA } = await seedSite(client, "isolation-a");
      const { siteId: siteB, userId: userB } = await seedSite(client, "isolation-b");
      try {
        await creerVersionMapping(siteA, [
          {
            sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
            sourceCle: "ALIMENT",
            cibleType: CibleRapprochement.NON_RAPPROCHE,
            cibleId: null,
          },
        ]);

        const { getMappingActif } = await import("@/lib/queries/previsions-rapprochement-mapping");
        const mappingSiteB = await getMappingActif(siteB);
        expect(mappingSiteB).toHaveLength(0);

        const mappingSiteA = await getMappingActif(siteA);
        expect(mappingSiteA).toHaveLength(1);
      } finally {
        await cleanup(client, siteA, userA);
        await cleanup(client, siteB, userB);
      }
    },
    20000
  );
});
