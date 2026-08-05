/**
 * Test d'integration DB-gated — `previsions-snapshot-budget.ts`
 * (Sprint PR3, story PR3.3). Reference ADR-053 §15.2.
 *
 * Couvre :
 * - `activerScenarioAvecSnapshot` cree le snapshot ET fait passer le
 *   scenario a ACTIF dans la MEME transaction (verifie a la fois le statut
 *   et l'existence des lignes apres l'appel) ;
 * - une SECONDE tentative d'activation est refusee (409) et NE MODIFIE ni
 *   n'ecrase le snapshot deja fige (immuabilite) ;
 * - la granularite : au moins une ligne par (poste x mois) ET les lignes
 *   agregees (ALIMENT/ALEVINS/APPORT_CAPITAL/REVENU_VENTE/TRESORERIE_SOLDE).
 *
 * Pourquoi DB-gated : la garantie testee est une transaction Prisma reelle
 * (snapshot + updateMany dans le meme `$transaction`) et une contrainte
 * d'unicite reelle (`@@unique([scenarioId, moisAbsolu, posteId, categorie])`)
 * — un mock JS n'exerce ni l'atomicite ni l'unicite.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";
import { createScenario } from "@/lib/queries/previsions-scenarios";
import { createPostePrevision, upsertChargeMensuelle } from "@/lib/queries/previsions-charges";
import { activerScenarioAvecSnapshot, getSnapshotBudgetInitial } from "@/lib/queries/previsions-snapshot-budget";
import { TypePostePrevision, StatutScenarioPrevision } from "@/types";

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;
let client: PoolClient | null = null;
let dbAvailable = false;
let erreurConnexion: unknown = null;

const MESSAGE_DB_INJOIGNABLE =
  "[PR3.3] DATABASE_URL est definie (le gating a legitimement decide que ce " +
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
  const siteId = `pr3-snapshot-site-${suffix}`;
  const userId = `pr3-snapshot-user-${suffix}`;
  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR3 snapshot ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR3 snapshot ${suffix}`, userId]
  );
  return { siteId, userId };
}

async function cleanup(c: PoolClient, siteId: string, userId: string): Promise<void> {
  await c.query(`DELETE FROM "SnapshotBudgetInitial" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "ChargeMensuellePrevue" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "PostePrevision" WHERE "siteId" = $1`, [siteId]);
  // ADR-053 §16 (story A.4) — PosteReferentiel apres PostePrevision (FK Restrict)
  await c.query(`DELETE FROM "PosteReferentiel" WHERE "siteId" = $1`, [siteId]);
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
  "PR3.3 — activerScenarioAvecSnapshot : gel transactionnel du budget initial",
  () => {
    it(
      "cree le snapshot (poste x mois + lignes agregees) ET passe le scenario a ACTIF, atomiquement",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        const { siteId, userId } = await seedSite(client, "nominal");
        try {
          const scenario = await createScenario(siteId, {
            code: "PR3-SNAPSHOT-NOMINAL",
            nom: "Scenario snapshot nominal",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const { poste } = await createPostePrevision(scenario.id, siteId, {
            libelle: "Salaires",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Salaires",
          });
          await upsertChargeMensuelle(poste.id, siteId, 0, 100000);
          await upsertChargeMensuelle(poste.id, siteId, 1, 100000);

          const active = await activerScenarioAvecSnapshot(scenario.id, siteId);
          expect(active.statut).toBe(StatutScenarioPrevision.ACTIF);

          const snapshot = await getSnapshotBudgetInitial(scenario.id, siteId);
          expect(snapshot.length).toBeGreaterThan(0);

          const lignesPoste = snapshot.filter((l) => l.posteId === poste.id);
          expect(lignesPoste).toHaveLength(2); // mois 0 et mois 1
          expect(lignesPoste.map((l) => Number(l.montantFCFA)).sort()).toEqual([100000, 100000]);
          expect(lignesPoste.every((l) => l.categorie === "Salaires")).toBe(true);

          const categoriesAgregees = new Set(snapshot.filter((l) => l.posteId === null).map((l) => l.categorie));
          expect(categoriesAgregees.has("ALIMENT")).toBe(true);
          expect(categoriesAgregees.has("ALEVINS")).toBe(true);
          expect(categoriesAgregees.has("APPORT_CAPITAL")).toBe(true);
          expect(categoriesAgregees.has("REVENU_VENTE")).toBe(true);
          expect(categoriesAgregees.has("TRESORERIE_SOLDE")).toBe(true);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "une SECONDE activation est refusee (409) et NE MODIFIE PAS le snapshot deja fige (immuabilite)",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        const { siteId, userId } = await seedSite(client, "double-activation");
        try {
          const scenario = await createScenario(siteId, {
            code: "PR3-SNAPSHOT-DOUBLE",
            nom: "Scenario snapshot double activation",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const { poste } = await createPostePrevision(scenario.id, siteId, {
            libelle: "Salaires",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Salaires",
          });
          await upsertChargeMensuelle(poste.id, siteId, 0, 250000);

          await activerScenarioAvecSnapshot(scenario.id, siteId);
          const snapshotApresPremiereActivation = await getSnapshotBudgetInitial(scenario.id, siteId);
          expect(snapshotApresPremiereActivation.length).toBeGreaterThan(0);

          // Modification du poste APRES activation — simule une edition en
          // place post-figeage (ADR-053 §15.2 : la valeur editee ne doit
          // JAMAIS remonter dans le snapshot deja fige).
          await upsertChargeMensuelle(poste.id, siteId, 0, 999999);

          await expect(activerScenarioAvecSnapshot(scenario.id, siteId)).rejects.toMatchObject({
            status: 409,
          });

          const snapshotApresSecondeTentative = await getSnapshotBudgetInitial(scenario.id, siteId);
          expect(snapshotApresSecondeTentative).toHaveLength(snapshotApresPremiereActivation.length);
          const ligneSalaires = snapshotApresSecondeTentative.find((l) => l.posteId === poste.id);
          expect(Number(ligneSalaires?.montantFCFA)).toBe(250000); // valeur FIGEE, pas 999999
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );
  }
);
