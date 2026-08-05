/**
 * Test d'integration DB-gated — story A.3 (Sprint PR3-ter) : correction
 * structurelle de la portee du mapping ALIMENT_PREVISION.
 *
 * Reproduit EXACTEMENT le defaut prouve par la pre-analyse et prouve qu'il
 * est corrige de bout en bout, via le code de PRODUCTION uniquement
 * (`calculerRapprochementScenario`, jamais une reimplementation locale,
 * ERR-171) :
 *   1. Un mapping ALIMENT_PREVISION est cree pour un site en pointant (via
 *      `composeCibleAlimentPrevision`) l'`AlimentPrevision` du SCENARIO A.
 *   2. Un SECOND scenario B, du MEME site, porte un `AlimentPrevision` de
 *      la MEME tailleGranule mais un id DIFFERENT.
 *   3. Une sortie de stock (aliment reel) est enregistree.
 *   4. `calculerRapprochementScenario` sur le scenario B doit rattacher ce
 *      montant reel a l'AlimentPrevision DE B (RAPPROCHE, reel > 0) — AVANT
 *      A.3, ce montant se serait accumule sous l'id de A et n'aurait
 *      JAMAIS ete relu (disparition silencieuse, ni RAPPROCHE, ni
 *      NON_RAPPROCHE, ni SANS_SOURCE_REELLE).
 *
 * Pourquoi DB-gated : `AlimentPrevision.tailleGranule` est lu et compare via
 * Prisma/Postgres reel (contrainte `@@unique([scenarioId, tailleGranule])`),
 * et `calculerRapprochementScenario` agrege via `$queryRaw` — aucun mock JS
 * ne peut prouver que la resolution croisee scenario A/B fonctionne contre
 * un vrai schema Postgres.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";
import { createScenario } from "@/lib/queries/previsions-scenarios";
import { creerVersionMapping } from "@/lib/queries/previsions-rapprochement-mapping";
import {
  calculerRapprochementScenario,
  composeCibleAlimentPrevision,
} from "@/lib/queries/previsions-rapprochement";
import { SourceRapprochement, CibleRapprochement, TailleGranule } from "@/types";

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

async function seedSite(
  c: PoolClient,
  suffix: string
): Promise<{ siteId: string; userId: string; produitId: string }> {
  const siteId = `pr3ter-a3-site-${suffix}`;
  const userId = `pr3ter-a3-user-${suffix}`;
  const produitId = `pr3ter-a3-produit-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR3ter A3 ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR3ter A3 ${suffix}`, userId]
  );
  await c.query(
    `INSERT INTO "Produit" (id, nom, categorie, unite, "prixUnitaire", "stockActuel", "seuilAlerte", "isActive", "tailleGranule", "siteId", "createdAt", "updatedAt")
     VALUES ($1, 'Aliment G1', 'ALIMENT', 'SACS', 15000, 0, 0, true, 'G1', $2, now(), now())`,
    [produitId, siteId]
  );

  return { siteId, userId, produitId };
}

/**
 * `createScenario` copie AUTOMATIQUEMENT les `Produit` ALIMENT actifs du
 * site en `AlimentPrevision` a la creation (ADR-053 decision 1,
 * `copierAlimentsPrevisionDepuisProduits`) — chaque scenario cree contre un
 * site portant un `Produit` de tailleGranule G1 recoit donc DEJA son propre
 * `AlimentPrevision` G1, avec un id DIFFERENT par scenario (jamais insere
 * manuellement ici, ce qui violerait `@@unique([scenarioId,
 * tailleGranule])` si le site porte deja un `Produit` de cette
 * granulometrie). Cette fonction lit l'id AUTO-CREE, ne l'insere jamais.
 */
async function idAlimentPrevisionAutoCree(
  c: PoolClient,
  scenarioId: string,
  tailleGranule: TailleGranule
): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `SELECT id FROM "AlimentPrevision" WHERE "scenarioId" = $1 AND "tailleGranule" = $2::"TailleGranule"`,
    [scenarioId, tailleGranule]
  );
  if (rows.length !== 1) {
    throw new Error(
      `AlimentPrevision attendu (auto-copie depuis Produit) introuvable pour scenario ${scenarioId} / ${tailleGranule}`
    );
  }
  return rows[0].id;
}

async function insertMouvementSortie(
  c: PoolClient,
  id: string,
  siteId: string,
  userId: string,
  produitId: string,
  quantite: number,
  date: Date
): Promise<void> {
  await c.query(
    `INSERT INTO "MouvementStock" (id, "produitId", type, quantite, "userId", date, "siteId", "createdAt")
     VALUES ($1, $2, 'SORTIE', $3, $4, $5, $6, now())`,
    [id, produitId, quantite, userId, date, siteId]
  );
}

async function cleanup(
  c: PoolClient,
  siteId: string,
  userId: string,
  produitId: string
): Promise<void> {
  await c.query(`DELETE FROM "ClotureMois" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "MappingRapprochement" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "MouvementStock" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "AlimentPrevision" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "ParametresPrevision" WHERE "scenarioId" IN (SELECT id FROM "ScenarioPrevision" WHERE "siteId" = $1)`, [siteId]);
  await c.query(`DELETE FROM "ScenarioPrevision" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "Produit" WHERE id = $1`, [produitId]);
  await c.query(`DELETE FROM "Site" WHERE id = $1`, [siteId]);
  await c.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
}

describe.runIf(requireDatabaseUrl())(
  "PR3ter.A3 — le mapping ALIMENT_PREVISION cree contre le scenario A se resout dynamiquement contre le scenario B (jamais une disparition silencieuse)",
  () => {
    it(
      "un montant reel mappe via l'AlimentPrevision du scenario A apparait RAPPROCHE contre l'AlimentPrevision du scenario B (meme tailleGranule)",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3ter.A3] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId, produitId } = await seedSite(client, "cross");
        try {
          const scenarioA = await createScenario(siteId, {
            code: "PR3TER-A3-SCN-A",
            nom: "Scenario A (origine du mapping)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const scenarioB = await createScenario(siteId, {
            code: "PR3TER-A3-SCN-B",
            nom: "Scenario B (lecture)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const alimentAId = await idAlimentPrevisionAutoCree(client, scenarioA.id, TailleGranule.G1);
          const alimentBId = await idAlimentPrevisionAutoCree(client, scenarioB.id, TailleGranule.G1);
          expect(alimentAId).not.toBe(alimentBId);

          // Le mapping porte le cibleId compose depuis l'AlimentPrevision DU
          // SCENARIO A (comportement attendu d'une administration du mapping
          // qui ne connait, au moment de la creation, que le scenario A).
          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.MOUVEMENT_STOCK,
              sourceCle: "G1",
              cibleType: CibleRapprochement.ALIMENT_PREVISION,
              cibleId: composeCibleAlimentPrevision(TailleGranule.G1, alimentAId),
            },
          ]);

          await insertMouvementSortie(client, "pr3ter-a3-mvt", siteId, userId, produitId, 12, new Date("2026-01-15"));

          const lignesB = await calculerRapprochementScenario(scenarioB.id, siteId, 0, 0);

          // Preuve centrale : le montant reel doit apparaitre RAPPROCHE,
          // rattache a l'AlimentPrevision DE B (id = alimentBId), jamais
          // disparu silencieusement (ni absent, ni NON_RAPPROCHE).
          const ligneAlimentB = lignesB.find((l) => l.id.startsWith(`${alimentBId}::`));
          expect(ligneAlimentB).toBeDefined();
          expect(ligneAlimentB?.statutRapprochement).toBe("RAPPROCHE");
          expect(ligneAlimentB?.reel?.toNumber()).toBe(12);

          // Le montant n'est PAS non plus tombe dans NON_RAPPROCHE (ce qui
          // masquerait la vraie cause) ni sous une cle scenario A quelconque.
          const ligneNonRapprochee = lignesB.find((l) => l.statutRapprochement === "NON_RAPPROCHE");
          expect(ligneNonRapprochee).toBeUndefined();
          const ligneSousIdA = lignesB.find((l) => l.id.startsWith(`${alimentAId}::`));
          expect(ligneSousIdA).toBeUndefined();
        } finally {
          await cleanup(client, siteId, userId, produitId);
        }
      },
      20000
    );

    it(
      "si le scenario COURANT ne porte AUCUN AlimentPrevision pour cette tailleGranule, le montant reel tombe dans NON_RAPPROCHE (visible), jamais perdu",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3ter.A3] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId, produitId } = await seedSite(client, "sans-cible");
        try {
          const scenarioA = await createScenario(siteId, {
            code: "PR3TER-A3-SANSCIBLE-A",
            nom: "Scenario A",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const scenarioC = await createScenario(siteId, {
            code: "PR3TER-A3-SANSCIBLE-C",
            nom: "Scenario C (aucun G1)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const alimentAId = await idAlimentPrevisionAutoCree(client, scenarioA.id, TailleGranule.G1);
          // Scenario C a lui aussi ete auto-copie avec un AlimentPrevision G1
          // (meme site, meme Produit ALIMENT actif) — supprime explicitement
          // ici pour simuler un scenario qui NE PORTE PLUS cette
          // granulometrie (ex. calibre retire du plan), condition requise
          // par ce test.
          await client.query(`DELETE FROM "AlimentPrevision" WHERE "scenarioId" = $1`, [scenarioC.id]);

          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.MOUVEMENT_STOCK,
              sourceCle: "G1",
              cibleType: CibleRapprochement.ALIMENT_PREVISION,
              cibleId: composeCibleAlimentPrevision(TailleGranule.G1, alimentAId),
            },
          ]);

          await insertMouvementSortie(client, "pr3ter-a3-sanscible-mvt", siteId, userId, produitId, 7, new Date("2026-01-15"));

          const lignesC = await calculerRapprochementScenario(scenarioC.id, siteId, 0, 0);

          const ligneNonRapprochee = lignesC.find((l) => l.statutRapprochement === "NON_RAPPROCHE");
          expect(ligneNonRapprochee).toBeDefined();
          expect(ligneNonRapprochee?.reel?.toNumber()).toBe(7);
        } finally {
          await cleanup(client, siteId, userId, produitId);
        }
      },
      20000
    );
  }
);
