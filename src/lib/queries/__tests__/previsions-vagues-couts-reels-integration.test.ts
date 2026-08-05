/**
 * Test d'integration DB-gated — `previsions-vagues-couts-reels.ts` (Sprint
 * PR3, story PR3.7, ADR-053 section 15, §6.4 des exigences fonctionnelles).
 *
 * Couvre :
 * - (a) `getCoutsReelsParVagues` agrege correctement `Depense.montantTotal`
 *   (cout) et `Vente.montantTotal`/`poidsTotalKg` (revenu/tonnage) par
 *   `Vague.id` reelle, via de vraies requetes SQL `GROUP BY` (`$queryRaw`) —
 *   aucun mock JS ne peut prouver qu'un `GROUP BY`/`SUM` SQL agrege
 *   correctement plusieurs lignes de Depense/Vente pour une meme vague.
 * - (b) une Vague sans AUCUNE Depense/Vente enregistree ressort quand meme
 *   dans la Map, avec des totaux a 0 (donnee legitime, jamais absente).
 * - (c) le filtre `siteId` (R8) isole deux sites : une Vague d'un AUTRE site
 *   partageant le meme id n'est jamais retournee (verifie indirectement en
 *   filtrant sur un id inexistant pour le site interroge).
 *
 * Pourquoi DB-gated : `getCoutsReelsParVagues` repose sur deux agregations
 * SQL brutes (`$queryRaw`, `SUM`, `GROUP BY`, `IN (...)` via `Prisma.join`)
 * — un mock JS ne peut pas prouver qu'un vrai moteur Postgres agrege
 * correctement plusieurs lignes reelles pour une meme vague.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";
import { getCoutsReelsParVagues } from "@/lib/queries/previsions-vagues-couts-reels";

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;
let client: PoolClient | null = null;
let dbAvailable = false;
let erreurConnexion: unknown = null;

const MESSAGE_DB_INJOIGNABLE =
  "[PR3.7] DATABASE_URL est definie (le gating a legitimement decide que ce " +
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

async function seedSite(c: PoolClient, suffix: string): Promise<{ siteId: string; userId: string; clientId: string }> {
  const siteId = `pr3-7-vcr-site-${suffix}`;
  const userId = `pr3-7-vcr-user-${suffix}`;
  const clientId = `pr3-7-vcr-client-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR3.7 vcr ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR3.7 vcr ${suffix}`, userId]
  );
  await c.query(
    `INSERT INTO "Client" (id, nom, "isActive", "isSysteme", "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, $3, now(), now())`,
    [clientId, `Client PR3.7 vcr ${suffix}`, siteId]
  );

  return { siteId, userId, clientId };
}

async function insertVague(c: PoolClient, id: string, siteId: string, code: string): Promise<void> {
  await c.query(
    `INSERT INTO "Vague" (id, code, "dateDebut", "nombreInitial", "poidsMoyenInitial", statut, type, "isBlocked", "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, now(), 1000, 5, 'EN_COURS', 'GROSSISSEMENT', false, $3, now(), now())`,
    [id, code, siteId]
  );
}

async function insertDepense(c: PoolClient, id: string, siteId: string, userId: string, vagueId: string, montant: number): Promise<void> {
  await c.query(
    `INSERT INTO "Depense" (id, numero, description, "categorieDepense", "montantTotal", "montantPaye", "montantFraisSupp", statut, date, "vagueId", "userId", "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, 'Depense test PR3.7', 'ALIMENT', $3, 0, 0, 'NON_PAYEE', now(), $4, $5, $6, now(), now())`,
    [id, id, montant, vagueId, userId, siteId]
  );
}

async function insertVente(
  c: PoolClient,
  id: string,
  siteId: string,
  userId: string,
  clientId: string,
  vagueId: string,
  montant: number,
  poidsKg: number
): Promise<void> {
  await c.query(
    `INSERT INTO "Vente" (id, numero, "clientId", "vagueId", "quantitePoissons", "poidsTotalKg", "prixUnitaireKg", "montantTotal", "dateCommande", statut, "origineType", "siteId", "userId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, 100, $5, 2000, $6, now(), 'LIVREE', 'GROSSISSEMENT', $7, $8, now(), now())`,
    [id, id, clientId, vagueId, poidsKg, montant, siteId, userId]
  );
}

async function cleanup(c: PoolClient, siteId: string, userId: string, clientId: string): Promise<void> {
  await c.query(`DELETE FROM "Vente" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "Depense" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "Vague" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "Client" WHERE id = $1`, [clientId]);
  await c.query(`DELETE FROM "Site" WHERE id = $1`, [siteId]);
  await c.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
}

describe.runIf(requireDatabaseUrl())("PR3.7 — previsions-vagues-couts-reels : agregation reelle par vague", () => {
  it(
    "agrege Depense + Vente par Vague, inclut une vague sans mouvement (totaux a 0), et isole le siteId",
    async () => {
      if (!dbAvailable || !client) {
        throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
      }
      const c = client;

      const siteA = await seedSite(c, "a");
      const siteB = await seedSite(c, "b");

      const vagueAvecMouvements = `pr3-7-vcr-v1-${Date.now()}`;
      const vagueSansMouvement = `pr3-7-vcr-v2-${Date.now()}`;
      const vagueAutreSite = `pr3-7-vcr-v3-${Date.now()}`;

      await insertVague(c, vagueAvecMouvements, siteA.siteId, "V1-VCR");
      await insertVague(c, vagueSansMouvement, siteA.siteId, "V2-VCR");
      await insertVague(c, vagueAutreSite, siteB.siteId, "V3-VCR");

      // Deux Depense + deux Vente sur la meme vague — prouve le SUM/GROUP BY.
      await insertDepense(c, `${vagueAvecMouvements}-dep1`, siteA.siteId, siteA.userId, vagueAvecMouvements, 100000);
      await insertDepense(c, `${vagueAvecMouvements}-dep2`, siteA.siteId, siteA.userId, vagueAvecMouvements, 50000);
      await insertVente(c, `${vagueAvecMouvements}-vte1`, siteA.siteId, siteA.userId, siteA.clientId, vagueAvecMouvements, 300000, 150);
      await insertVente(c, `${vagueAvecMouvements}-vte2`, siteA.siteId, siteA.userId, siteA.clientId, vagueAvecMouvements, 200000, 100);

      try {
        const resultat = await getCoutsReelsParVagues(siteA.siteId, [
          vagueAvecMouvements,
          vagueSansMouvement,
        ]);

        expect(resultat.size).toBe(2);

        const agg1 = resultat.get(vagueAvecMouvements);
        expect(agg1).toBeDefined();
        expect(agg1!.codeReel).toBe("V1-VCR");
        expect(agg1!.coutReelFCFA.toNumber()).toBe(150000);
        expect(agg1!.revenuReelFCFA.toNumber()).toBe(500000);
        expect(agg1!.poidsReelKg.toNumber()).toBe(250);

        // (b) vague sans AUCUN mouvement -> presente, totaux a 0 (jamais absente).
        const agg2 = resultat.get(vagueSansMouvement);
        expect(agg2).toBeDefined();
        expect(agg2!.codeReel).toBe("V2-VCR");
        expect(agg2!.coutReelFCFA.toNumber()).toBe(0);
        expect(agg2!.revenuReelFCFA.toNumber()).toBe(0);
        expect(agg2!.poidsReelKg.toNumber()).toBe(0);

        // (c) R8 : une vague d'un AUTRE site, meme demandee explicitement,
        // n'est jamais retournee pour siteA.
        const resultatCrossSite = await getCoutsReelsParVagues(siteA.siteId, [vagueAutreSite]);
        expect(resultatCrossSite.size).toBe(0);

        // vagueIds vide -> Map vide, aucune requete emise (garde explicite du contrat).
        const resultatVide = await getCoutsReelsParVagues(siteA.siteId, []);
        expect(resultatVide.size).toBe(0);
      } finally {
        await cleanup(c, siteA.siteId, siteA.userId, siteA.clientId);
        await cleanup(c, siteB.siteId, siteB.userId, siteB.clientId);
      }
    }
  );
});
