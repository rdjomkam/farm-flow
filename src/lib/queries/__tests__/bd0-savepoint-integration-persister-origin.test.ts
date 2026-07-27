/**
 * Test d'intégration complémentaire — story BD.0, re-vérification tester.
 *
 * `src/lib/queries/__tests__/bd0-savepoint-integration.test.ts` (db-specialist)
 * prouve que le SAVEPOINT + canary désavortent la transaction quand la vraie
 * erreur SQL survient dans `calculerEcartsParBac` (lecture). Mais
 * `persisterEcartConstate` (écriture, `tx.ecartAssignationConstate.upsert`)
 * a son PROPRE try/catch interne qui avale déjà ses erreurs SANS jamais les
 * relancer (voir `src/lib/guards/assignation-invariant.ts` l.89-121 et son
 * commentaire de tête : « cette fonction ne doit JAMAIS faire échouer
 * l'opération métier appelante »). Une vraie erreur SQL survenant DANS cette
 * fonction ne remonte donc JAMAIS comme exception JS jusqu'au bloc appelant
 * de `createReleve` — c'est précisément le cas que la sonde canary
 * (`SELECT 1` après le bloc) a été ajoutée pour couvrir (voir le commentaire
 * dans `src/lib/queries/releves.ts`), mais qui n'était testé par AUCUN test
 * d'intégration réel avant celui-ci : le fichier existant ne poison que
 * `calculerEcartsParBac`, jamais `persisterEcartConstate`.
 *
 * Ce fichier reproduit fidèlement le mécanisme réel : on ne mocke PAS
 * `persisterEcartConstate` pour qu'il throw (ce serait retester le cas (c),
 * déjà couvert par un mock JS) — on lui fait exécuter une VRAIE requête SQL
 * invalide À L'INTÉRIEUR de son propre try/catch (donc avalée exactement
 * comme le fait le code réel), avant de retourner sans jamais propager
 * l'erreur. La question posée : le canary de `createReleve` détecte-t-il
 * quand même la transaction empoisonnée, et le SAVEPOINT la désavorte-t-il,
 * alors qu'aucune exception JS n'a jamais traversé l'appelant ?
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { Pool, type PoolClient } from "pg";
import { createReleve } from "@/lib/queries/releves";

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;
let client: PoolClient | null = null;
let dbAvailable = false;

beforeAll(async () => {
  if (!DATABASE_URL) return;
  try {
    pool = new Pool({ connectionString: DATABASE_URL });
    client = await pool.connect();
    await client.query("SELECT 1");
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  client?.release();
  await pool?.end();
});

const { poisonState } = vi.hoisted(() => ({ poisonState: { active: false } }));

vi.mock("@/lib/guards/assignation-invariant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/guards/assignation-invariant")>();
  return {
    ...actual,
    persisterEcartConstate: async (
      tx: Parameters<typeof actual.persisterEcartConstate>[0],
      ...rest: [string, string, string, number, Parameters<typeof actual.persisterEcartConstate>[5]?]
    ) => {
      if (poisonState.active) {
        // Reproduit fidèlement le contrat documenté de persisterEcartConstate :
        // une vraie erreur SQL (pas un throw JS) survient DANS son propre
        // try/catch interne et y est avalée, jamais relancée — exactement
        // comme le fait le code réel (assignation-invariant.ts l.89-121).
        try {
          await tx.$queryRawUnsafe(
            `SELECT * FROM table_qui_nexiste_pas_bd0_persister_origin_test`
          );
        } catch (err) {
          console.error(
            "[test] erreur SQL simulée avalée à l'intérieur de persisterEcartConstate (comme le vrai code)",
            err
          );
        }
        return; // ne relance JAMAIS — fidèle au contrat réel de la fonction.
      }
      return actual.persisterEcartConstate(tx, ...rest);
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
  const siteId = `bd0-po-site-${suffix}`;
  const userId = `bd0-po-user-${suffix}`;
  const vagueId = `bd0-po-vague-${suffix}`;
  const bacId = `bd0-po-bac-${suffix}`;
  const assignationId = `bd0-po-assign-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User BD.0-PO ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site BD.0-PO ${suffix}`, userId]
  );
  await c.query(
    `INSERT INTO "Vague" (id, code, "dateDebut", "nombreInitial", "poidsMoyenInitial", statut, type, "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, now() - interval '10 days', 1000, 50, 'EN_COURS', 'GROSSISSEMENT', $3, now(), now())`,
    [vagueId, `BD0PO-VAG-${suffix}`, siteId]
  );
  await c.query(
    `INSERT INTO "Bac" (id, nom, "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, now(), now())`,
    [bacId, `Bac BD.0-PO ${suffix}`, siteId]
  );
  await c.query(
    `INSERT INTO "AssignationBac" (id, "bacId", "vagueId", "siteId", "dateAssignation", "nombrePoissonsInitial", "nombrePoissons", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, now() - interval '10 days', 1000, 950, now(), now())`,
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

describe.runIf(!!DATABASE_URL)(
  "BD.0 v2 — canary détecte une transaction empoisonnée depuis L'INTÉRIEUR de persisterEcartConstate (erreur avalée en interne, jamais relancée)",
  () => {
    it(
      "une vraie erreur SQL avalée à l'intérieur de persisterEcartConstate n'empêche pas la création du COMPTAGE, et le relevé est réellement en base",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[BD.0-PO] DB de dev injoignable — test ignoré (dbAvailable=false).");
          return;
        }

        const ids = await seedVagueEtBac(client, "poison");

        try {
          poisonState.active = true;

          // nombreActuel=950, nombreInitial=1000, COMPTAGE à 950 → écart=0
          // (pas de dérive) mais peu importe : persisterEcartConstate est
          // poisonné avant même d'évaluer l'écart réel. Ce qui compte ici
          // est uniquement que la transaction sous-jacente soit empoisonnée
          // par une vraie requête SQL invalide exécutée DANS la fonction,
          // puis avalée par son propre try/catch (jamais relancée en JS) —
          // et que la liaison Planning qui s'exécute juste après (vraie
          // requête `tx.activite.findFirst`) ne fasse pas échouer
          // createReleve malgré l'absence totale d'exception JS remontée.
          const releve = await createReleve(ids.siteId, ids.userId, {
            typeReleve: "COMPTAGE",
            vagueId: ids.vagueId,
            bacId: ids.bacId,
            date: new Date().toISOString(),
            nombreCompte: 950,
            methodeComptage: "DIRECT",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);

          expect(releve).toBeDefined();
          expect(releve.id).toBeTruthy();

          // Vérification indépendante (connexion `pg` distincte de celle
          // utilisée par createReleve) : le relevé est réellement committé,
          // pas seulement "résolu en JS" (même piège COMMIT→ROLLBACK
          // silencieux que le test soeur bd0-savepoint-integration.test.ts).
          const { rows } = await client.query(
            `SELECT id, "typeReleve", "nombreCompte", "bacId", "vagueId", "siteId"
             FROM "Releve" WHERE id = $1`,
            [releve.id]
          );
          expect(rows).toHaveLength(1);
          expect(rows[0].typeReleve).toBe("COMPTAGE");
          expect(rows[0].nombreCompte).toBe(950);
        } finally {
          poisonState.active = false;
          await cleanup(client, ids);
        }
      },
      20000
    );
  }
);
