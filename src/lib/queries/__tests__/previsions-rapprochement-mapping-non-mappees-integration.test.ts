/**
 * Test d'integration DB-gated — `getCategoriesReellesNonMappees`
 * (`src/lib/queries/previsions-rapprochement-mapping.ts`), correctif du
 * gap signale par la review du sprint PR3 (Moyenne #2,
 * `docs/reviews/review-sprint-PR3.md`) : la fonction excluait
 * `SourceRapprochement.MOUVEMENT_STOCK` du bac "categories a mapper", alors
 * que cette source alimente deja le calcul d'ecarts (`getReelAgregeSite` ->
 * `getSortiesAlimentReellesParGranulometrie`) et peut donc apparaitre en
 * `NON_RAPPROCHE` sans jamais offrir de moyen de la mapper.
 *
 * Discipline ERR-172 : aucun jeu d'or n'existe pour le rapprochement — ce
 * fichier construit des fixtures qui font DIVERGER "MOUVEMENT_STOCK exclu"
 * de "MOUVEMENT_STOCK inclus" (une assertion qui passerait dans les deux cas
 * ne prouverait rien).
 *
 * Pourquoi DB-gated : la fonction lit `MouvementStock` JOIN `Produit` via un
 * `$queryRaw` (COALESCE + agregat DISTINCT) — aucun mock JS ne peut prouver
 * qu'un JOIN/COALESCE SQL reel produit la bonne granulometrie.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";
import {
  getCategoriesReellesNonMappees,
  creerVersionMapping,
} from "@/lib/queries/previsions-rapprochement-mapping";
import { SourceRapprochement, CibleRapprochement } from "@/types";

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;
let client: PoolClient | null = null;
let dbAvailable = false;
let erreurConnexion: unknown = null;

const MESSAGE_DB_INJOIGNABLE =
  "[non-mappees] DATABASE_URL est definie (le gating a legitimement decide que ce " +
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

async function seedSite(
  c: PoolClient,
  suffix: string
): Promise<{ siteId: string; userId: string; produitConnuId: string; produitInconnuId: string }> {
  const siteId = `pr3-nonmap-site-${suffix}`;
  const userId = `pr3-nonmap-user-${suffix}`;
  const produitConnuId = `pr3-nonmap-produit-connu-${suffix}`;
  const produitInconnuId = `pr3-nonmap-produit-inconnu-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR3 nonmap ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR3 nonmap ${suffix}`, userId]
  );
  // Produit ALIMENT avec granulometrie connue (G2).
  await c.query(
    `INSERT INTO "Produit" (id, nom, categorie, unite, "prixUnitaire", "stockActuel", "seuilAlerte", "isActive", "tailleGranule", "siteId", "createdAt", "updatedAt")
     VALUES ($1, 'Aliment G2', 'ALIMENT', 'SACS', 15000, 0, 0, true, 'G2', $2, now(), now())`,
    [produitConnuId, siteId]
  );
  // Produit ALIMENT SANS granulometrie renseignee (chemin COALESCE -> 'INCONNU').
  await c.query(
    `INSERT INTO "Produit" (id, nom, categorie, unite, "prixUnitaire", "stockActuel", "seuilAlerte", "isActive", "tailleGranule", "siteId", "createdAt", "updatedAt")
     VALUES ($1, 'Aliment sans granulo', 'ALIMENT', 'SACS', 15000, 0, 0, true, NULL, $2, now(), now())`,
    [produitInconnuId, siteId]
  );

  return { siteId, userId, produitConnuId, produitInconnuId };
}

async function insertMouvement(
  c: PoolClient,
  id: string,
  siteId: string,
  userId: string,
  produitId: string,
  type: "SORTIE" | "ENTREE",
  quantite: number,
  date: Date
): Promise<void> {
  await c.query(
    `INSERT INTO "MouvementStock" (id, "produitId", type, quantite, "userId", date, "siteId", "createdAt")
     VALUES ($1, $2, $3::"TypeMouvement", $4, $5, $6, $7, now())`,
    [id, produitId, type, quantite, userId, date, siteId]
  );
}

async function cleanup(
  c: PoolClient,
  siteId: string,
  userId: string,
  produitConnuId: string,
  produitInconnuId: string
): Promise<void> {
  await c.query(`DELETE FROM "MappingRapprochement" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "MouvementStock" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "Produit" WHERE id IN ($1, $2)`, [produitConnuId, produitInconnuId]);
  await c.query(`DELETE FROM "Site" WHERE id = $1`, [siteId]);
  await c.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
}

describe.runIf(requireDatabaseUrl())(
  "Correctif review-sprint-PR3 Moyenne #2 — getCategoriesReellesNonMappees couvre MOUVEMENT_STOCK",
  () => {
    it(
      "une granulometrie SORTIE aliment non mappee (connue G2 + INCONNU) apparait dans le bac a mapper",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        const { siteId, userId, produitConnuId, produitInconnuId } = await seedSite(client, "granulo");
        try {
          await insertMouvement(client, "mvt-nonmap-g2", siteId, userId, produitConnuId, "SORTIE", 10, new Date("2026-01-10"));
          await insertMouvement(client, "mvt-nonmap-inconnu", siteId, userId, produitInconnuId, "SORTIE", 5, new Date("2026-01-11"));

          const resultat = await getCategoriesReellesNonMappees(siteId);

          const g2 = resultat.find(
            (r) => r.sourceType === SourceRapprochement.MOUVEMENT_STOCK && r.sourceCle === "G2"
          );
          const inconnu = resultat.find(
            (r) => r.sourceType === SourceRapprochement.MOUVEMENT_STOCK && r.sourceCle === "INCONNU"
          );

          expect(g2).toBeDefined();
          expect(inconnu).toBeDefined();
        } finally {
          await cleanup(client, siteId, userId, produitConnuId, produitInconnuId);
        }
      },
      20000
    );

    it(
      "une granulometrie MAPPEE n'apparait plus dans le bac (le mapping actif la couvre)",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        const { siteId, userId, produitConnuId, produitInconnuId } = await seedSite(client, "mappee");
        try {
          await insertMouvement(client, "mvt-mappee-g2", siteId, userId, produitConnuId, "SORTIE", 10, new Date("2026-01-10"));

          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.MOUVEMENT_STOCK,
              sourceCle: "G2",
              cibleType: CibleRapprochement.NON_RAPPROCHE,
              cibleId: null,
            },
          ]);

          const resultat = await getCategoriesReellesNonMappees(siteId);
          const g2 = resultat.find(
            (r) => r.sourceType === SourceRapprochement.MOUVEMENT_STOCK && r.sourceCle === "G2"
          );

          expect(g2).toBeUndefined();
        } finally {
          await cleanup(client, siteId, userId, produitConnuId, produitInconnuId);
        }
      },
      20000
    );

    it(
      "un mouvement ENTREE (pas SORTIE) n'est pas pris en compte — meme filtre que getSortiesAlimentReellesParGranulometrie",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        const { siteId, userId, produitConnuId, produitInconnuId } = await seedSite(client, "entree");
        try {
          await insertMouvement(client, "mvt-entree-g2", siteId, userId, produitConnuId, "ENTREE", 10, new Date("2026-01-10"));

          const resultat = await getCategoriesReellesNonMappees(siteId);
          const g2 = resultat.find(
            (r) => r.sourceType === SourceRapprochement.MOUVEMENT_STOCK && r.sourceCle === "G2"
          );

          expect(g2).toBeUndefined();
        } finally {
          await cleanup(client, siteId, userId, produitConnuId, produitInconnuId);
        }
      },
      20000
    );

    it(
      "site sans MouvementStock : aucune entree MOUVEMENT_STOCK, jamais une erreur (les Produit catalogues restent detectes via PRODUIT_CATEGORIE, comportement pre-existant inchange)",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        const { siteId, userId, produitConnuId, produitInconnuId } = await seedSite(client, "vide");
        try {
          const resultat = await getCategoriesReellesNonMappees(siteId);
          const mouvementStock = resultat.filter((r) => r.sourceType === SourceRapprochement.MOUVEMENT_STOCK);
          expect(mouvementStock).toEqual([]);
        } finally {
          await cleanup(client, siteId, userId, produitConnuId, produitInconnuId);
        }
      },
      20000
    );
  }
);
