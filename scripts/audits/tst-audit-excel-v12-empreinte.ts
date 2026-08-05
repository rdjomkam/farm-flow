/**
 * TST — Empreinte d'intégrité AVANT sprint du scénario de référence EXCEL-V12.
 *
 * STRICTEMENT EN LECTURE SEULE : uniquement des SELECT. Aucun INSERT/UPDATE/
 * DELETE, aucune migration, aucun seed. Lit `DATABASE_URL` depuis
 * process.env (R11) — jamais d'identifiant en dur.
 *
 * Le scénario s'identifie par `ScenarioPrevision.code = 'EXCEL-V12'`
 * (PAS par `nom` — une requête sur `nom` renvoie 0 à tort, cf. TASKS.md
 * ligne 7790).
 *
 * Usage :
 *   npx tsx scripts/audits/tst-audit-excel-v12-empreinte.ts
 */

import { Pool } from "pg";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL non défini dans l'environnement.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const scenarioRes = await pool.query(
      `SELECT * FROM "ScenarioPrevision" WHERE code = 'EXCEL-V12'`
    );
    if (scenarioRes.rowCount === 0) {
      console.error("Scénario EXCEL-V12 introuvable (code = 'EXCEL-V12').");
      process.exit(1);
    }
    const scenario = scenarioRes.rows[0];
    const scenarioId: string = scenario.id;

    const out: Record<string, unknown> = {};
    out.scenario = scenario;

    const parametresRes = await pool.query(
      `SELECT * FROM "ParametresPrevision" WHERE "scenarioId" = $1`,
      [scenarioId]
    );
    out.parametres = parametresRes.rows[0] ?? null;

    const vaguesAggRes = await pool.query(
      `SELECT COUNT(*)::int AS nb, COALESCE(SUM("effectifAlevinsPrevu"),0)::bigint AS total_alevins
       FROM "VaguePrevue" WHERE "scenarioId" = $1`,
      [scenarioId]
    );
    out.vaguesPrevues_agg = vaguesAggRes.rows[0];

    const alimentsRes = await pool.query(
      `SELECT id, "tailleGranule", "sacsParTonneStandard", ordre
       FROM "AlimentPrevision" WHERE "scenarioId" = $1 ORDER BY ordre ASC`,
      [scenarioId]
    );
    out.alimentPrevision_calibres = alimentsRes.rows;

    const alimentIds = alimentsRes.rows.map((r) => r.id);

    let articles: unknown[] = [];
    let repartitions: unknown[] = [];
    if (alimentIds.length > 0) {
      const articlesRes = await pool.query(
        `SELECT * FROM "AlimentArticlePrevision"
         WHERE "alimentCalibrePrevisionId" = ANY($1::text[])
         ORDER BY "alimentCalibrePrevisionId", ordre ASC`,
        [alimentIds]
      );
      articles = articlesRes.rows;

      const repRes = await pool.query(
        `SELECT * FROM "RepartitionMoisAliment"
         WHERE "alimentPrevisionId" = ANY($1::text[])
         ORDER BY "alimentPrevisionId", "moisCycle" ASC`,
        [alimentIds]
      );
      repartitions = repRes.rows;
    }
    out.alimentArticlePrevision = articles;
    out.repartitionMoisAliment = repartitions;

    const paliersRes = await pool.query(
      `SELECT * FROM "PalierRemise" WHERE "scenarioId" = $1 ORDER BY ordre ASC`,
      [scenarioId]
    );
    out.paliersRemise = paliersRes.rows;

    const apportsRes = await pool.query(
      `SELECT * FROM "ApportCapital" WHERE "scenarioId" = $1 ORDER BY date ASC`,
      [scenarioId]
    );
    const apportsSumRes = await pool.query(
      `SELECT COUNT(*)::int AS nb, COALESCE(SUM("montantFCFA"),0)::numeric AS total
       FROM "ApportCapital" WHERE "scenarioId" = $1`,
      [scenarioId]
    );
    out.apportCapital_lignes = apportsRes.rows;
    out.apportCapital_agg = apportsSumRes.rows[0];

    const journalRes = await pool.query(
      `SELECT * FROM "JournalDepensePrevue" WHERE "scenarioId" = $1 ORDER BY date ASC`,
      [scenarioId]
    );
    const journalSumRes = await pool.query(
      `SELECT COUNT(*)::int AS nb, COALESCE(SUM("montantFCFA"),0)::numeric AS total
       FROM "JournalDepensePrevue" WHERE "scenarioId" = $1`,
      [scenarioId]
    );
    out.journalDepensePrevue_lignes = journalRes.rows;
    out.journalDepensePrevue_agg = journalSumRes.rows[0];

    const postesRes = await pool.query(
      `SELECT p.id, p.libelle, p.type, p."inclusBaseRepartition", p.ordre,
              COUNT(c.id)::int AS nb_lignes,
              COALESCE(SUM(c."montantFCFA"),0)::numeric AS total_poste
       FROM "PostePrevision" p
       LEFT JOIN "ChargeMensuellePrevue" c ON c."posteId" = p.id
       WHERE p."scenarioId" = $1
       GROUP BY p.id, p.libelle, p.type, p."inclusBaseRepartition", p.ordre
       ORDER BY p.ordre ASC`,
      [scenarioId]
    );
    out.postePrevision_detail = postesRes.rows;

    const chargesAggRes = await pool.query(
      `SELECT COUNT(*)::int AS nb_lignes, COALESCE(SUM(c."montantFCFA"),0)::numeric AS total
       FROM "ChargeMensuellePrevue" c
       JOIN "PostePrevision" p ON p.id = c."posteId"
       WHERE p."scenarioId" = $1`,
      [scenarioId]
    );
    out.chargeMensuellePrevue_agg = chargesAggRes.rows[0];

    const alimentParVagueAggRes = await pool.query(
      `SELECT COUNT(*)::int AS nb, COALESCE(SUM(a."coutCalculeFCFA"),0)::numeric AS total_cout
       FROM "AlimentParVaguePrevue" a
       JOIN "VaguePrevue" v ON v.id = a."vaguePrevueId"
       WHERE v."scenarioId" = $1`,
      [scenarioId]
    );
    out.alimentParVaguePrevue_agg = alimentParVagueAggRes.rows[0];

    const clotureRes = await pool.query(
      `SELECT COUNT(*)::int AS nb FROM "ClotureMois" WHERE "scenarioId" = $1`,
      [scenarioId]
    );
    out.clotureMois_count = clotureRes.rows[0];

    const mappingRes = await pool.query(
      `SELECT COUNT(*)::int AS nb FROM "MappingRapprochement" WHERE "siteId" = $1`,
      [scenario.siteId]
    );
    out.mappingRapprochement_count_for_site = mappingRes.rows[0];

    console.log(JSON.stringify(out, null, 2));
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
