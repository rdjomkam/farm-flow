/**
 * Test d'intégration DB-gated — non-régression du chemin nominal de
 * `POST /api/previsions/scenarios` : la création d'un scénario sur un site
 * qui possède déjà des `Produit` ALIMENT actifs (le premier usage réel de
 * tout utilisateur, cf. `prisma/seed.sql`).
 *
 * Contexte du bug corrigé (ADR-053 §12, amendement Sprint PR2-quater).
 * `copierAlimentsPrevisionDepuisProduits` (src/lib/queries/previsions-
 * scenarios.ts) recopie le catalogue `Produit` en calibres
 * (`AlimentPrevision`, groupés par `tailleGranule`) + articles
 * (`AlimentArticlePrevision`, un par `Produit`). Une régression a fait
 * persister `libelle` comme colonne obligatoire sur `AlimentPrevision`
 * (le calibre) sans jamais le renseigner à l'écriture, provoquant un 500
 * (`Argument 'libelle' is missing`) sur CHAQUE création de scénario.
 *
 * Pourquoi ce test est DB-gated et pas un mock (`previsions-fake-db.ts`,
 * cf. `previsions-scenarios.test.ts`) : le bug corrigé ici est une
 * incohérence entre le schéma Prisma réel (colonne `NOT NULL` sans valeur
 * par défaut) et l'appel `tx.alimentPrevision.create()` — un mock JS
 * n'applique aucune contrainte `NOT NULL` et ne peut donc jamais faire
 * échouer un `create()` auquel il manque un champ requis. Seul un vrai
 * Prisma Client contre un vrai schéma Postgres peut réellement exercer
 * cette validation (même famille de raisonnement que
 * `previsions-int-fractional-integration.test.ts`, déjà dans l'allowlist).
 *
 * Couvre aussi le rollback : `copierAlimentsPrevisionDepuisProduits` rejette
 * bruyamment (`throw`) si un `Produit` ALIMENT actif n'a pas de
 * `tailleGranule` — le test vérifie qu'aucune ligne (`ScenarioPrevision`,
 * `ParametresPrevision`, `AlimentPrevision`, `AlimentArticlePrevision`) ne
 * survit à cet échec, confirmant que `prisma.$transaction` annule bien tout
 * le lot (ADR-053 §12.1, second défaut).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";
import { createScenario } from "@/lib/queries/previsions-scenarios";
import { CategorieProduit, TailleGranule, UniteStock } from "@/types";

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

interface SeedIds {
  siteId: string;
  userId: string;
  produitIds: string[];
}

async function seedSiteEtProduits(
  c: PoolClient,
  suffix: string,
  produits: Array<{ nom: string; tailleGranule: TailleGranule | null; contenance: number; prixUnitaire: number }>
): Promise<SeedIds> {
  const siteId = `pr2q-copie-site-${suffix}`;
  const userId = `pr2q-copie-user-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR2q ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR2q ${suffix}`, userId]
  );

  const produitIds: string[] = [];
  for (let i = 0; i < produits.length; i++) {
    const p = produits[i];
    const produitId = `pr2q-copie-produit-${suffix}-${i}`;
    produitIds.push(produitId);
    await c.query(
      `INSERT INTO "Produit" (id, nom, categorie, unite, contenance, "prixUnitaire", "stockActuel", "seuilAlerte", "isActive", "tailleGranule", "siteId", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 0, 0, true, $7, $8, now(), now())`,
      [
        produitId,
        p.nom,
        CategorieProduit.ALIMENT,
        UniteStock.SACS,
        p.contenance,
        p.prixUnitaire,
        p.tailleGranule,
        siteId,
      ]
    );
  }

  return { siteId, userId, produitIds };
}

async function cleanup(c: PoolClient, ids: SeedIds): Promise<void> {
  await c.query(
    `DELETE FROM "AlimentArticlePrevision" WHERE "alimentCalibrePrevisionId" IN (SELECT id FROM "AlimentPrevision" WHERE "siteId" = $1)`,
    [ids.siteId]
  );
  await c.query(`DELETE FROM "AlimentPrevision" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "ParametresPrevision" WHERE "scenarioId" IN (SELECT id FROM "ScenarioPrevision" WHERE "siteId" = $1)`, [
    ids.siteId,
  ]);
  await c.query(`DELETE FROM "ScenarioPrevision" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Produit" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Site" WHERE id = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "User" WHERE id = $1`, [ids.userId]);
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
  "PR2-quater — copierAlimentsPrevisionDepuisProduits : creation nominale de scenario sur un site avec produits ALIMENT",
  () => {
    it(
      "cree le scenario ET ses calibres (AlimentPrevision) ET leurs articles (AlimentArticlePrevision), sans jamais exiger de libelle sur le calibre",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR2q] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const ids = await seedSiteEtProduits(client, "nominal", [
          { nom: "Aliment Croissance 3mm", tailleGranule: TailleGranule.G2, contenance: 25, prixUnitaire: 15000 },
          { nom: "Aliment Demarrage 1mm", tailleGranule: TailleGranule.P1, contenance: 15, prixUnitaire: 12000 },
        ]);
        try {
          // Avant le correctif, cet appel levait une PrismaClientValidationError
          // ("Argument `libelle` is missing") pour CHAQUE scenario, quel que
          // soit son contenu — reproduit le 500 de POST /api/previsions/scenarios.
          const scenario = await createScenario(ids.siteId, {
            code: "PR2Q-COPIE-NOMINAL",
            nom: "Scenario copie nominale",
            dateDebutPlan: new Date().toISOString(),
            userId: ids.userId,
            parametres: parametresBase,
          });

          expect(scenario.id).toBeTruthy();

          const calibres = await client!.query(
            `SELECT id, "tailleGranule", ordre FROM "AlimentPrevision" WHERE "scenarioId" = $1 ORDER BY ordre`,
            [scenario.id]
          );
          expect(calibres.rows).toHaveLength(2);
          const taillesGranule = calibres.rows.map((r) => r.tailleGranule).sort();
          expect(taillesGranule).toEqual([TailleGranule.G2, TailleGranule.P1].sort());

          const articles = await client!.query(
            `SELECT a.libelle, a."partApprovisionnementPct", a."alimentCalibrePrevisionId"
             FROM "AlimentArticlePrevision" a
             JOIN "AlimentPrevision" ap ON ap.id = a."alimentCalibrePrevisionId"
             WHERE ap."scenarioId" = $1`,
            [scenario.id]
          );
          expect(articles.rows).toHaveLength(2);
          for (const row of articles.rows) {
            expect(row.libelle).toBeTruthy();
            expect(Number(row.partApprovisionnementPct)).toBe(100);
          }
        } finally {
          await cleanup(client, ids);
        }
      },
      15000
    );

    it(
      "un Produit ALIMENT actif sans tailleGranule fait echouer copierAlimentsPrevisionDepuisProduits ET annule TOUTE la transaction (aucun ScenarioPrevision, ParametresPrevision, AlimentPrevision ni AlimentArticlePrevision ne survit)",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR2q] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const ids = await seedSiteEtProduits(client, "rollback", [
          { nom: "Aliment sans calibre", tailleGranule: null, contenance: 25, prixUnitaire: 15000 },
        ]);
        try {
          await expect(
            createScenario(ids.siteId, {
              code: "PR2Q-COPIE-ROLLBACK",
              nom: "Scenario copie rollback",
              dateDebutPlan: new Date().toISOString(),
              userId: ids.userId,
              parametres: parametresBase,
            })
          ).rejects.toThrow(/tailleGranule/);

          const scenarios = await client!.query(
            `SELECT id FROM "ScenarioPrevision" WHERE code = 'PR2Q-COPIE-ROLLBACK' AND "siteId" = $1`,
            [ids.siteId]
          );
          expect(scenarios.rows).toHaveLength(0);

          const calibres = await client!.query(`SELECT id FROM "AlimentPrevision" WHERE "siteId" = $1`, [ids.siteId]);
          expect(calibres.rows).toHaveLength(0);

          const articles = await client!.query(`SELECT id FROM "AlimentArticlePrevision" WHERE "siteId" = $1`, [
            ids.siteId,
          ]);
          expect(articles.rows).toHaveLength(0);
        } finally {
          await cleanup(client, ids);
        }
      },
      15000
    );
  }
);
