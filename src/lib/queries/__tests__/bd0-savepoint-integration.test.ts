/**
 * Test d'intégration — correction BD.0 v2 (verdict FAIL du tester,
 * docs/tests/rapport-story-BD.0.md).
 *
 * Contrairement à `src/__tests__/bd0-comptage-recalcule-ecart.test.ts` (qui
 * mocke intégralement `@/lib/db`, y compris `$transaction`), ce fichier N'EST
 * PAS mocké : il appelle la VRAIE fonction `createReleve`
 * (`src/lib/queries/releves.ts`) contre un VRAI PostgreSQL (Docker, port
 * 8432 — voir MEMORY.md), avec une VRAIE erreur SQL (pas un
 * `mockRejectedValue` JS) injectée dans le bloc de recalcul d'écart. C'est
 * précisément le scénario que le tester a reproduit manuellement contre
 * `silures-db` et qui a fait échouer la v1 de BD.0 (rapport, section
 * « Constat central ») : une erreur SQL réelle empoisonne toute la
 * transaction Postgres en cours (25P02 current transaction is aborted),
 * même si elle est correctement attrapée en JS — la requête suivante dans la
 * même transaction (ici la liaison Planning, `findMatchingActivite`, qui
 * exécute un vrai `tx.activite.findFirst` pour tout COMPTAGE en mode vague)
 * échouerait alors à son tour, non catchée. Un mock de `$transaction` ne peut
 * structurellement pas prouver la résistance à ce risque (cf. ERR-103 : « un
 * test qui mocke le moteur ne teste pas le moteur »), d'où ce fichier séparé,
 * pattern réutilisé de
 * `src/lib/queries/__tests__/bons-livraison-transaction-integration.test.ts`.
 *
 * CE QUE CE TEST PROUVE :
 * 1. `createReleve` RÉSOUT (ne rejette jamais) quand une vraie erreur SQL
 *    survient dans `calculerEcartsParBac`, y compris quand une vraie requête
 *    Postgres (la liaison Planning) s'exécute juste après dans la même
 *    transaction.
 * 2. Le relevé COMPTAGE est RÉELLEMENT présent en base après le retour de
 *    `createReleve` — vérifié via une connexion `pg` indépendante, PAS via
 *    la simple résolution de la promesse. C'est le piège spécifique
 *    identifié par le tester : un COMMIT envoyé après une transaction
 *    avortée peut être silencieusement dégradé en ROLLBACK par Postgres,
 *    sans que Prisma (ni donc `createReleve`) ne le détecte — la promesse
 *    résoudrait alors avec succès alors que TOUT (y compris le releve.create
 *    d'origine) aurait été annulé en base. Ce test vérifie explicitement
 *    l'absence de ce cas.
 *
 * Le SAVEPOINT posé par `createReleve` autour du bloc MORTALITE/COMPTAGE
 * (voir `src/lib/queries/releves.ts`) est ce qui permet à la transaction de
 * se désavorter après l'erreur SQL réelle, avant que la liaison Planning
 * n'exécute sa propre requête.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { Pool, type PoolClient } from "pg";
import { createReleve } from "@/lib/queries/releves";
import { requireDatabaseUrl } from "@/test/require-database-url";

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;
let client: PoolClient | null = null;
let dbAvailable = false;
let erreurConnexion: unknown = null;

const MESSAGE_DB_INJOIGNABLE =
  "[BD.0-SP] DATABASE_URL est definie (le gating a legitimement decide que ce " +
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

// -----------------------------------------------------------------------------
// Injection contrôlée d'une VRAIE erreur SQL dans calculerEcartsParBac, sans
// jamais toucher au comportement réel pour les autres appelants (guard,
// autres call sites). `vi.hoisted` permet de partager un flag mutable avec la
// factory `vi.mock` (hoistée au-dessus des imports par Vitest).
// -----------------------------------------------------------------------------
const { poisonState } = vi.hoisted(() => ({ poisonState: { active: false } }));

vi.mock("@/lib/guards/assignation-invariant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/guards/assignation-invariant")>();
  return {
    ...actual,
    calculerEcartsParBac: async (
      tx: Parameters<typeof actual.calculerEcartsParBac>[0],
      ...rest: [string, string, string[]]
    ) => {
      if (poisonState.active) {
        // VRAIE erreur SQL (pas un throw JS) : table inexistante. Postgres
        // renvoie 42P01, ce qui empoisonne la transaction en cours (état
        // "aborted") jusqu'à un ROLLBACK / ROLLBACK TO SAVEPOINT.
        await tx.$queryRawUnsafe(`SELECT * FROM table_qui_nexiste_pas_bd0_savepoint_test`);
      }
      return actual.calculerEcartsParBac(tx, ...rest);
    },
  };
});

interface SeedIds {
  siteId: string;
  userId: string;
  vagueId: string;
  bacId: string;
  assignationId: string;
}

async function seedVagueEtBac(c: PoolClient, suffix: string): Promise<SeedIds> {
  const siteId = `bd0-sp-site-${suffix}`;
  const userId = `bd0-sp-user-${suffix}`;
  const vagueId = `bd0-sp-vague-${suffix}`;
  const bacId = `bd0-sp-bac-${suffix}`;
  const assignationId = `bd0-sp-assign-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User BD.0-SP ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site BD.0-SP ${suffix}`, userId]
  );
  await c.query(
    `INSERT INTO "Vague" (id, code, "dateDebut", "nombreInitial", "poidsMoyenInitial", statut, type, "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, now() - interval '10 days', 1000, 50, 'EN_COURS', 'GROSSISSEMENT', $3, now(), now())`,
    [vagueId, `BD0SP-VAG-${suffix}`, siteId]
  );
  await c.query(
    `INSERT INTO "Bac" (id, nom, "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, now(), now())`,
    [bacId, `Bac BD.0-SP ${suffix}`, siteId]
  );
  await c.query(
    `INSERT INTO "AssignationBac" (id, "bacId", "vagueId", "siteId", "dateAssignation", "nombrePoissonsInitial", "nombrePoissons", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, now() - interval '10 days', 1000, 998, now(), now())`,
    [assignationId, bacId, vagueId, siteId]
  );

  return { siteId, userId, vagueId, bacId, assignationId };
}

async function cleanup(c: PoolClient, ids: SeedIds): Promise<void> {
  await c.query(`DELETE FROM "EcartAssignationConstate" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "ReleveModification" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Releve" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "AssignationBac" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Bac" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Vague" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Site" WHERE id = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "User" WHERE id = $1`, [ids.userId]);
}

afterEach(() => {
  poisonState.active = false;
});

describe.runIf(requireDatabaseUrl())(
  "BD.0 v2 — createReleve résiste à une vraie erreur SQL dans le recalcul d'écart (DB réelle)",
  () => {
    it(
      "une vraie erreur SQL dans calculerEcartsParBac n'empêche pas la création du COMPTAGE, et le relevé est réellement en base après le commit",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }

        const ids = await seedVagueEtBac(client, "poison");

        try {
          poisonState.active = true;

          // Ce COMPTAGE déclenche le bloc BD.0 (typeReleve COMPTAGE + bacId +
          // vagueId) qui, avec le poison actif, subit une VRAIE erreur SQL
          // (42P01) dans calculerEcartsParBac. Juste après ce bloc,
          // createReleve exécute la liaison Planning (findMatchingActivite)
          // — une VRAIE requête Postgres sur la même transaction. Sans le
          // SAVEPOINT + canary de la correction BD.0 v2, cette requête
          // échouerait avec 25P02 (transaction aborted), non catchée, et
          // ferait rejeter createReleve() en entier.
          const releve = await createReleve(ids.siteId, ids.userId, {
            typeReleve: "COMPTAGE",
            vagueId: ids.vagueId,
            bacId: ids.bacId,
            date: new Date().toISOString(),
            nombreCompte: 998,
            methodeComptage: "DIRECT",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);

          // 1. La promesse résout — pas d'exception propagée par l'erreur SQL.
          expect(releve).toBeDefined();
          expect(releve.id).toBeTruthy();

          // 2. LE PIÈGE (rapport tester, section « Constat central ») : la
          // résolution de la promesse ne suffit PAS à prouver que le COMMIT
          // a réellement eu lieu — Postgres peut dégrader silencieusement un
          // COMMIT envoyé après une transaction avortée en ROLLBACK, sans
          // que Prisma ne le détecte. On vérifie donc la présence RÉELLE du
          // relevé en base via une connexion `pg` INDÉPENDANTE de celle
          // utilisée par `createReleve` (le client Prisma partagé de
          // src/lib/db.ts), pas seulement que `createReleve` a résolu.
          const { rows } = await client.query(
            `SELECT id, "typeReleve", "nombreCompte", "bacId", "vagueId", "siteId"
             FROM "Releve" WHERE id = $1`,
            [releve.id]
          );
          expect(rows).toHaveLength(1);
          expect(rows[0].typeReleve).toBe("COMPTAGE");
          expect(rows[0].nombreCompte).toBe(998);
          expect(rows[0].bacId).toBe(ids.bacId);
          expect(rows[0].vagueId).toBe(ids.vagueId);
          expect(rows[0].siteId).toBe(ids.siteId);
        } finally {
          poisonState.active = false;
          await cleanup(client, ids);
        }
      },
      20000
    );

    it(
      "sans erreur SQL (poison inactif), le comportement fonctionnel BD.0 reste inchangé : COMPTAGE résout la dérive",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }

        const ids = await seedVagueEtBac(client, "sain");

        try {
          // AssignationBac seedée avec nombreActuel=998, nombreInitial=1000,
          // aucun relevé préalable → expected replay = 1000. Un COMPTAGE à
          // 998 aligne exactement expected et actual → écart 0, résolution
          // d'une dérive marquée au préalable (voir insertion ci-dessous).
          await client.query(
            `INSERT INTO "EcartAssignationConstate" (id, "siteId", "bacId", "vagueId", ecart, "premiereDetectionLe", "derniereDetectionLe", "dernierContexte", "resoluLe", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, -2, now(), now(), 'INDETERMINE', NULL, now(), now())`,
            [`bd0-sp-ecart-${ids.bacId}`, ids.siteId, ids.bacId, ids.vagueId]
          );

          const releve = await createReleve(ids.siteId, ids.userId, {
            typeReleve: "COMPTAGE",
            vagueId: ids.vagueId,
            bacId: ids.bacId,
            date: new Date().toISOString(),
            nombreCompte: 998,
            methodeComptage: "DIRECT",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);

          expect(releve).toBeDefined();

          const { rows } = await client.query(
            `SELECT ecart, "resoluLe" FROM "EcartAssignationConstate" WHERE "bacId" = $1`,
            [ids.bacId]
          );
          expect(rows).toHaveLength(1);
          expect(rows[0].ecart).toBe(0);
          expect(rows[0].resoluLe).not.toBeNull();
        } finally {
          await cleanup(client, ids);
        }
      },
      20000
    );
  }
);
