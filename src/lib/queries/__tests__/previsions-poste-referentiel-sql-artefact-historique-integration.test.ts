/**
 * Test d'integration DB-gated — condition factuelle de l'ADR-053 §17
 * (Sprint de resorption des reserves, story PR2non.5, reserve R5, ERR-184).
 *
 * ADR-053 §17.2 tranche : le SQL de backfill de la migration
 * `20260805120000_add_poste_referentiel` (bloc `DO $$ ... $$` anonyme, deja
 * applique, gele par R10) est un ARTEFACT HISTORIQUE — un compte-rendu de ce
 * qu'une execution unique a fait un jour donne — et non un invariant de
 * parite a maintenir avec `sluggifierLibellePoste` (TypeScript, seule
 * autorite vivante pour la normalisation de `PosteReferentiel.code`).
 *
 * Cet arbitrage n'est valide QUE tant qu'aucune dependance vivante a cette
 * normalisation n'existe en base — pas de fonction, pas de trigger, pas de
 * DEFAULT/colonne GENERATED sur `code`, pas de CHECK. Ce test rend cette
 * condition VERIFIABLE (introspection reelle des catalogues systeme
 * Postgres) au lieu de rester seulement AFFIRMEE par le texte de l'ADR
 * (§17.1.1). Il ne compare aucune valeur de slug, ni SQL ni JS — il n'y a
 * plus de comparaison a faire (§17.2) ; un test qui recalculerait une table
 * de caracteres serait une regression vers l'option A explicitement ecartee
 * (§17.2, "Options ecartees").
 *
 * Falsification (rejouee manuellement lors de l'ecriture de ce test, jamais
 * via une migration — R10 interdit toute nouvelle migration touchant ces
 * tables pour ce seul besoin de preuve) : creer temporairement, par SQL brut
 * hors migration, une fonction dont le nom contient "poste"/"slug" et un
 * trigger non interne sur PosteReferentiel fait tomber respectivement
 * l'assertion (1) et l'assertion (2) — puis DROP immediat, sans laisser de
 * trace. Voir le rapport de la story pour le detail (assertions tombees /
 * restauration / preuve de retour a l'etat initial).
 *
 * Toutes les requetes sont en LECTURE SEULE (BEGIN READ ONLY) sur des
 * catalogues systeme — aucune ecriture sur les donnees applicatives,
 * conformement a la contrainte "scenario EXCEL-V12 en lecture seule
 * stricte" de cette story.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;
let client: PoolClient | null = null;
let dbAvailable = false;
let erreurConnexion: unknown = null;

const MESSAGE_DB_INJOIGNABLE =
  "[ADR053-17] DATABASE_URL est definie (le gating a legitimement decide que ce " +
  "test devait tourner) mais la connexion a la base a echoue : ce n'est pas un " +
  "skip, c'est un echec d'infrastructure du run (contrat ADR-052 §3.2 / " +
  "src/test/require-database-url.ts). Ce test ne peut donc PAS prouver la " +
  "condition d'ADR-053 §17.1.1 (aucune dependance vivante en base) : l'arbitrage " +
  "ne doit pas etre considere comme verifie. Action : verifiez que Postgres " +
  "tourne (`docker compose up -d`) et que DATABASE_URL pointe vers une base " +
  "joignable, puis relancez.";

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

describe.runIf(requireDatabaseUrl())(
  "ADR-053 §17 (ERR-184) — le SQL de backfill de PosteReferentiel.code est un artefact historique : aucune dependance vivante en base",
  () => {
    it(
      "(1) pg_proc — aucune fonction PostgreSQL dont le nom evoque slug/poste/referentiel",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        await client.query("BEGIN READ ONLY");
        try {
          const { rows } = await client.query(
            `SELECT proname FROM pg_proc
             WHERE proname ILIKE '%slug%' OR proname ILIKE '%poste%' OR proname ILIKE '%referentiel%'`
          );
          expect(rows).toHaveLength(0);
        } finally {
          await client.query("ROLLBACK");
        }
      },
      20000
    );

    it(
      "(2) pg_trigger — aucun trigger non interne sur PosteReferentiel / PostePrevision",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        await client.query("BEGIN READ ONLY");
        try {
          const { rows } = await client.query(
            `SELECT tgname FROM pg_trigger
             WHERE tgrelid IN ('"PosteReferentiel"'::regclass, '"PostePrevision"'::regclass)
               AND NOT tgisinternal`
          );
          expect(rows).toHaveLength(0);
        } finally {
          await client.query("ROLLBACK");
        }
      },
      20000
    );

    it(
      "(3) information_schema.columns — aucun DEFAULT/GENERATED touchant la normalisation de code (hors defauts legitimes deja connus, exclus explicitement)",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        await client.query("BEGIN READ ONLY");
        try {
          const { rows } = await client.query(
            `SELECT table_name, column_name, column_default, is_generated
             FROM information_schema.columns
             WHERE table_name IN ('PosteReferentiel', 'PostePrevision')
               AND (column_default IS NOT NULL OR is_generated <> 'NEVER')
               -- Exclusions explicites, verifiees en base au moment de l'ecriture
               -- de ce test (ADR-053 §17.5) — aucune n'a de rapport avec la
               -- normalisation de PosteReferentiel.code, toutes portent un
               -- DEFAULT Prisma ordinaire materialise en base :
               --  - PosteReferentiel.actif        -> @default(true)
               --  - PosteReferentiel.createdAt     -> @default(now())
               --  - PostePrevision.inclusBaseRepartition -> @default(true)
               -- Si une future colonne a defaut legitime apparait, elle doit
               -- etre ajoutee ici EXPLICITEMENT et commentee comme ci-dessus
               -- (jamais par un filtre vague qui viderait ce test de son sens,
               -- ADR-053 §17.5).
               AND NOT (table_name = 'PosteReferentiel' AND column_name = 'actif')
               AND NOT (table_name = 'PosteReferentiel' AND column_name = 'createdAt')
               AND NOT (table_name = 'PostePrevision' AND column_name = 'inclusBaseRepartition')`
          );
          expect(rows).toHaveLength(0);
        } finally {
          await client.query("ROLLBACK");
        }
      },
      20000
    );

    it(
      "(4) pg_constraint — aucune contrainte CHECK sur PosteReferentiel / PostePrevision (l'UNIQUE(siteId, code) est contype='u', hors perimetre)",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        await client.query("BEGIN READ ONLY");
        try {
          const { rows } = await client.query(
            `SELECT conname FROM pg_constraint
             WHERE conrelid IN ('"PosteReferentiel"'::regclass, '"PostePrevision"'::regclass)
               AND contype = 'c'`
          );
          expect(rows).toHaveLength(0);
        } finally {
          await client.query("ROLLBACK");
        }
      },
      20000
    );
  }
);
