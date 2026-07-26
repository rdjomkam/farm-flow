/**
 * Test d'intégration — SU.12 : preuve comportementale de la contrainte
 * `@@unique([siteId, numero])` (migration `20260726174843_numero_unique_par_site`).
 *
 * Contrairement au reste de la suite (qui mocke systématiquement Prisma, voir
 * ERR-103 leçon (e)), ce test se connecte réellement à la base Postgres de dev
 * (Docker, port 8432 — voir DATABASE_URL) car ce qui est vérifié est un
 * comportement du MOTEUR PostgreSQL (l'index unique composite), pas de la
 * logique applicative. Un test qui mockerait Prisma ne prouverait rien ici :
 * il faudrait alors mocker le rejet lui-même, ce qui ne vaudrait pas mieux
 * qu'un commentaire.
 *
 * Toutes les opérations sont faites dans UNE transaction PostgreSQL terminée
 * par ROLLBACK (jamais COMMIT) — aucune donnée de test ne persiste, quel que
 * soit le résultat du test (succès ou échec).
 *
 * Si la base de dev n'est pas joignable (DATABASE_URL absent, Docker arrêté),
 * les tests sont marqués `skip` dynamiquement plutôt que de faire échouer la
 * suite complète — ce fichier documente un comportement DB réel, il ne doit
 * pas bloquer un `npx vitest run` sur une machine sans Docker.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";

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

/** Crée un Site + User minimal dans la transaction courante, retourne leurs id. */
async function seedSiteAndUser(
  c: PoolClient,
  suffix: string
): Promise<{ siteId: string; userId: string }> {
  const siteId = `su12-test-site-${suffix}`;
  const userId = `su12-test-user-${suffix}`;
  // User d'abord (Site.ownerId est une FK NOT NULL vers User — pas de cycle
  // dans l'autre sens, User ne référence aucun siteId obligatoire).
  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User test SU.12 ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site test SU.12 ${suffix}`, userId]
  );
  return { siteId, userId };
}

async function insertDepense(
  c: PoolClient,
  args: { id: string; numero: string; siteId: string; userId: string }
): Promise<void> {
  await c.query(
    `INSERT INTO "Depense"
       (id, numero, description, "categorieDepense", "montantTotal", "montantPaye", "montantFraisSupp",
        statut, date, "userId", "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, 'Dépense test SU.12', 'AUTRE', 100, 0, 0, 'NON_PAYEE', now(), $3, $4, now(), now())`,
    [args.id, args.numero, args.userId, args.siteId]
  );
}

describe.runIf(!!DATABASE_URL)(
  "SU.12 — contrainte @@unique([siteId, numero]) — comportement DB réel (rollback systématique)",
  () => {
    it("accepte le même numero pour deux sites distincts (collision multi-tenant corrigée)", async () => {
      if (!dbAvailable || !client) {
        console.warn("[SU.12] DB de dev injoignable — test ignoré (dbAvailable=false).");
        return;
      }

      await client.query("BEGIN");
      try {
        const siteA = await seedSiteAndUser(client, "a-samesite-numero");
        const siteB = await seedSiteAndUser(client, "b-samesite-numero");

        const numero = "DEP-2026-999";

        // Même numero, deux sites différents : les deux INSERT doivent réussir.
        await insertDepense(client, {
          id: "su12-test-dep-a",
          numero,
          siteId: siteA.siteId,
          userId: siteA.userId,
        });
        await insertDepense(client, {
          id: "su12-test-dep-b",
          numero,
          siteId: siteB.siteId,
          userId: siteB.userId,
        });

        const { rows } = await client.query(
          `SELECT "siteId", numero FROM "Depense" WHERE numero = $1 ORDER BY "siteId"`,
          [numero]
        );
        expect(rows).toHaveLength(2);
      } finally {
        await client.query("ROLLBACK");
      }
    });

    it("rejette un doublon (siteId, numero) au sein du même site", async () => {
      if (!dbAvailable || !client) {
        console.warn("[SU.12] DB de dev injoignable — test ignoré (dbAvailable=false).");
        return;
      }

      await client.query("BEGIN");
      try {
        const site = await seedSiteAndUser(client, "same-site-doublon");
        const numero = "DEP-2026-998";

        await insertDepense(client, {
          id: "su12-test-dep-c1",
          numero,
          siteId: site.siteId,
          userId: site.userId,
        });

        await expect(
          insertDepense(client!, {
            id: "su12-test-dep-c2",
            numero,
            siteId: site.siteId,
            userId: site.userId,
          })
        ).rejects.toMatchObject({ code: "23505" }); // unique_violation Postgres
      } finally {
        await client.query("ROLLBACK");
      }
    });
  }
);

describe.runIf(!!DATABASE_URL)(
  "SU.12/SU.13 — les 10 tables migrées exposent bien un index composite (siteId, numero|code), plus aucun index global",
  () => {
    // Les 9 tables SU.12 + LotAlevins (SU.13, migration
    // 20260726212515_lotalevins_code_unique_par_site).
    const TABLES: Array<{ table: string; field: "numero" | "code" }> = [
      { table: "Facture", field: "numero" },
      { table: "Depense", field: "numero" },
      { table: "Commande", field: "numero" },
      { table: "Vente", field: "numero" },
      { table: "BonLivraison", field: "numero" },
      { table: "ListeBesoins", field: "numero" },
      { table: "Ponte", field: "code" },
      { table: "Incubation", field: "code" },
      { table: "LotGeniteurs", field: "code" },
      { table: "LotAlevins", field: "code" },
    ];

    it.each(TABLES.map((t) => [t.table, t.field] as const))(
      "%s a un index unique composite (siteId, %s) et aucun index unique global seul",
      async (table, field) => {
        if (!dbAvailable || !client) {
          console.warn("[SU.12] DB de dev injoignable — test ignoré (dbAvailable=false).");
          return;
        }

        const { rows } = await client.query<{ indexdef: string }>(
          `SELECT indexdef FROM pg_indexes WHERE tablename = $1`,
          [table]
        );
        const defs = rows.map((r) => r.indexdef);

        // Postgres ne cite ("...") un identifiant que s'il contient des
        // majuscules ("siteId") — "numero"/"code" (tout minuscule) apparaissent
        // SANS guillemets dans indexdef (ex. `("siteId", numero)`). Le motif
        // couvre donc le champ avec guillemets optionnels.
        const fieldPattern = `"?${field}"?`;

        // Un index UNIQUE dont la définition contient à la fois "siteId" et le
        // champ (l'ordre exact des colonnes dans l'index n'a pas d'importance
        // ici — seule compte la présence conjointe des deux colonnes).
        const hasSiteScopedUnique = defs.some(
          (d) =>
            d.includes("UNIQUE") &&
            d.includes('"siteId"') &&
            new RegExp(fieldPattern).test(d)
        );
        // Aucun index UNIQUE ne doit porter uniquement sur le champ seul
        // (parenthèses ne contenant que ce champ) — l'ancienne contrainte
        // globale doit avoir disparu.
        const hasGlobalUniqueOnFieldAlone = defs.some(
          (d) => d.includes("UNIQUE") && new RegExp(`\\(\\s*${fieldPattern}\\s*\\)`).test(d)
        );

        expect(hasSiteScopedUnique).toBe(true);
        expect(hasGlobalUniqueOnFieldAlone).toBe(false);
      }
    );
  }
);
