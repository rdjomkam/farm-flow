/**
 * Test d'integration DB-gated — `previsions-rapprochement-mapping.ts`
 * (Sprint PR3, story PR3.3). Reference ADR-053 §3.9/§15.3.
 *
 * Couvre :
 * - creation versionnee (v1 puis v2) : v1 reste lisible ET INCHANGEE apres
 *   la creation de v2 (`getMappingParVersion`) ;
 * - `getMappingActif` ne remonte QUE la version courante ;
 * - refus d'une version vide (BusinessRuleError 422).
 *
 * Pourquoi DB-gated : le versionnement s'appuie sur une contrainte reelle
 * (`@@unique([siteId, version, sourceType, sourceCle])`) et une transaction
 * Prisma reelle (`updateMany` + `createMany`) — un mock JS n'exercerait ni
 * l'unicite ni l'atomicite, meme raisonnement que les autres tests DB-gated
 * de ce module (cf. `previsions-scenarios-copie-produits-integration.test.ts`).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";
import {
  creerVersionMapping,
  getMappingActif,
  getMappingParVersion,
} from "@/lib/queries/previsions-rapprochement-mapping";
import { SourceRapprochement, CibleRapprochement } from "@/types";

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

async function seedSite(c: PoolClient, suffix: string): Promise<{ siteId: string; userId: string }> {
  const siteId = `pr3-mapping-site-${suffix}`;
  const userId = `pr3-mapping-user-${suffix}`;
  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR3 mapping ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR3 mapping ${suffix}`, userId]
  );
  return { siteId, userId };
}

async function cleanup(c: PoolClient, siteId: string, userId: string): Promise<void> {
  await c.query(`DELETE FROM "MappingRapprochement" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "Site" WHERE id = $1`, [siteId]);
  await c.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
}

describe.runIf(requireDatabaseUrl())(
  "PR3.3 — creerVersionMapping : versionnement sans UPDATE en place",
  () => {
    it(
      "v1 puis v2 : v1 reste lisible ET INCHANGEE, getMappingActif ne renvoie que v2",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3.3] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "versionnement");
        try {
          const v1 = await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "ALIMENT",
              cibleType: CibleRapprochement.NON_RAPPROCHE,
              cibleId: null,
            },
          ]);
          expect(v1).toHaveLength(1);
          expect(v1[0].version).toBe(1);
          expect(v1[0].actif).toBe(true);
          expect(v1[0].cibleType).toBe(CibleRapprochement.NON_RAPPROCHE);

          const v2 = await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "ALIMENT",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: "poste-fictif",
            },
            {
              sourceType: SourceRapprochement.VENTE,
              sourceCle: "VENTE",
              cibleType: CibleRapprochement.VENTE_PREVUE,
              cibleId: null,
            },
          ]);
          expect(v2).toHaveLength(2);
          expect(v2.every((l) => l.version === 2)).toBe(true);
          expect(v2.every((l) => l.actif === true)).toBe(true);

          // v1 reste lisible ET INCHANGEE — meme cibleType qu'a la creation,
          // jamais recalculee/reecrite par la creation de v2.
          const v1Relue = await getMappingParVersion(siteId, 1);
          expect(v1Relue).toHaveLength(1);
          expect(v1Relue[0].cibleType).toBe(CibleRapprochement.NON_RAPPROCHE);
          expect(v1Relue[0].cibleId).toBeNull();
          expect(v1Relue[0].actif).toBe(false); // desactivee, mais son CONTENU n'a pas change

          const actif = await getMappingActif(siteId);
          expect(actif).toHaveLength(2);
          expect(actif.every((l) => l.version === 2)).toBe(true);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      15000
    );

    it(
      "refuse une version vide (BusinessRuleError 422) — jamais de version active sans ligne",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3.3] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "vide");
        try {
          await expect(creerVersionMapping(siteId, [])).rejects.toMatchObject({ status: 422 });
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      15000
    );
  }
);
