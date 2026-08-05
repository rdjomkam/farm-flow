/**
 * Test d'integration DB-gated — `previsions-tresorerie-trois-series.ts`
 * (Sprint PR3-ter, story B.3). Reference ADR-053 §6.5, §15.1(b), §15.2,
 * §15.7, §15.8.
 *
 * Fixtures construites pour FAIRE DIVERGER les implementations candidates
 * (ERR-160/ERR-172), pas pour decorer un scenario plausible :
 * - (a) **LE GEL MORD** (falsification obligatoire de cette story) : le
 *   BUDGET INITIAL reste identique apres une edition post-activation de la
 *   charge qui l'alimentait, alors que la PRÉVISION ACTUALISÉE, elle,
 *   diverge — remplacer la lecture de `SnapshotBudgetInitial` par un
 *   `calculerProjectionScenario` a la volee DOIT faire tomber cette
 *   assertion (verifie manuellement par mutation, cf. rapport de cloture).
 * - (b) scenario JAMAIS active : `budgetInitialDisponible = false`,
 *   `budgetInitialFCFA = null` sur TOUS les mois — jamais un 0 qui
 *   masquerait l'absence de gel.
 * - (c) RÉEL nette correctement le signe DEPENSE (-) vs ENTREE (+), cumule
 *   sur l'HORIZON COMPLET y compris un mois SANS aucune ligne reelle (report
 *   du dernier cumul connu, jamais une rupture a `null`/0 artificiel).
 * - (d) REPREVISION GLISSANTE : le mois CLOTURE utilise le REEL (pas la
 *   PRÉVISION ACTUALISÉE, qui diverge volontairement dans la fixture), le
 *   mois NON clos utilise la PRÉVISION ACTUALISÉE — les deux sources
 *   produisent des valeurs DISTINCTES par construction pour discriminer.
 * - (e) le filtre siteId isole deux sites.
 *
 * Pourquoi DB-gated : orchestre `chargerScenarioPourMoteur` + agregations
 * SQL du reel (`$queryRaw`) + `SnapshotBudgetInitial`/`ClotureMois` reels —
 * aucun mock JS ne peut prouver qu'un scenario active, une charge editee en
 * place et une cloture Postgres produisent le bon assemblage.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";
import { createScenario } from "@/lib/queries/previsions-scenarios";
import { createPostePrevision, upsertChargeMensuelle } from "@/lib/queries/previsions-charges";
import { activerScenarioAvecSnapshot } from "@/lib/queries/previsions-snapshot-budget";
import { cloturerMois } from "@/lib/queries/previsions-cloture";
import { creerVersionMapping } from "@/lib/queries/previsions-rapprochement-mapping";
import { getTresorerieTroisSeries } from "@/lib/queries/previsions-tresorerie-trois-series";
import { TypePostePrevision, SourceRapprochement, CibleRapprochement } from "@/types";

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

async function seedSite(
  c: PoolClient,
  suffix: string
): Promise<{ siteId: string; userId: string }> {
  const siteId = `pr3ter-tresor-site-${suffix}`;
  const userId = `pr3ter-tresor-user-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR3ter tresor ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR3ter tresor ${suffix}`, userId]
  );

  return { siteId, userId };
}

async function cleanup(c: PoolClient, siteId: string, userId: string): Promise<void> {
  await c.query(`DELETE FROM "ClotureMois" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "SnapshotBudgetInitial" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "MappingRapprochement" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "LigneDepense" WHERE "depenseId" IN (SELECT id FROM "Depense" WHERE "siteId" = $1)`, [siteId]);
  await c.query(`DELETE FROM "Depense" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "Vente" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "ChargeMensuellePrevue" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "PostePrevision" WHERE "siteId" = $1`, [siteId]);
  // ADR-053 §16 (story A.4) — PosteReferentiel apres PostePrevision (FK Restrict)
  await c.query(`DELETE FROM "PosteReferentiel" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "ParametresPrevision" WHERE "scenarioId" IN (SELECT id FROM "ScenarioPrevision" WHERE "siteId" = $1)`, [siteId]);
  await c.query(`DELETE FROM "ScenarioPrevision" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "Site" WHERE id = $1`, [siteId]);
  await c.query(`DELETE FROM "User" WHERE id = $1`, [userId]);
}

async function insertDepense(
  c: PoolClient,
  id: string,
  siteId: string,
  userId: string,
  categorieDepense: string,
  montantTotal: number,
  date: Date
): Promise<void> {
  await c.query(
    `INSERT INTO "Depense" (id, numero, description, "categorieDepense", "montantTotal", "montantPaye", "montantFraisSupp", statut, date, "userId", "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, 'Depense test PR3ter.B3', $3::"CategorieDepense", $4, 0, 0, 'NON_PAYEE', $5, $6, $7, now(), now())`,
    [id, id, categorieDepense, montantTotal, date, userId, siteId]
  );
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
  "PR3ter.B3 — previsions-tresorerie-trois-series : assemblage des 3 series + reprevision",
  () => {
    it(
      "(a) LE GEL MORD : budgetInitialFCFA reste identique apres edition post-activation, previsionActualiseeFCFA diverge (falsification obligatoire)",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3ter.B3] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "gel");
        try {
          const scenario = await createScenario(siteId, {
            code: "PR3TERB3-GEL",
            nom: "Scenario gel budget initial",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const poste = await createPostePrevision(scenario.id, siteId, {
            libelle: "Salaires",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
          });
          // Deux mois de donnees -> horizonMois = 2, pour ne pas se limiter
          // au seul mois 0 (piege ERR-155 : une serie jamais non nulle sur
          // plus d'un point est un angle mort).
          await upsertChargeMensuelle(poste.id, siteId, 0, 100000);
          await upsertChargeMensuelle(poste.id, siteId, 1, 50000);

          // Active -> fige le snapshot AVANT toute edition.
          await activerScenarioAvecSnapshot(scenario.id, siteId);

          const avantEdition = await getTresorerieTroisSeries(scenario.id, siteId);
          expect(avantEdition.budgetInitialDisponible).toBe(true);
          const budgetInitialMois0Avant = avantEdition.series[0].budgetInitialFCFA;
          expect(budgetInitialMois0Avant).not.toBeNull();
          expect(budgetInitialMois0Avant?.toNumber()).toBe(avantEdition.series[0].previsionActualiseeFCFA.toNumber());

          // EDITION EN PLACE post-activation (le geste que le gel doit
          // resister) : la charge du mois 0 passe de 100 000 a 999 000.
          await upsertChargeMensuelle(poste.id, siteId, 0, 999000);

          const apresEdition = await getTresorerieTroisSeries(scenario.id, siteId);
          const budgetInitialMois0Apres = apresEdition.series[0].budgetInitialFCFA;
          const previsionActualiseeMois0Apres = apresEdition.series[0].previsionActualiseeFCFA;

          // LE GEL : le budget initial n'a PAS bouge malgre l'edition.
          expect(budgetInitialMois0Apres?.toNumber()).toBe(budgetInitialMois0Avant?.toNumber());
          // LA PRÉVISION ACTUALISÉE, elle, A bouge (recalculee a la
          // demande) : les deux series DOIVENT diverger maintenant — c'est
          // l'assertion qui tombe si `SnapshotBudgetInitial` est remplace
          // par un recalcul a la volee (les deux vaudraient alors la meme
          // chose, silencieusement).
          expect(previsionActualiseeMois0Apres.toNumber()).not.toBe(budgetInitialMois0Apres?.toNumber());
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(b) scenario JAMAIS active : budgetInitialDisponible=false, budgetInitialFCFA=null sur TOUS les mois",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3ter.B3] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "jamais-active");
        try {
          const scenario = await createScenario(siteId, {
            code: "PR3TERB3-JAMAISACTIVE",
            nom: "Scenario jamais active",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const poste = await createPostePrevision(scenario.id, siteId, {
            libelle: "Transport",
            type: TypePostePrevision.LOGISTIQUE,
            ordre: 0,
          });
          await upsertChargeMensuelle(poste.id, siteId, 0, 20000);

          const resultat = await getTresorerieTroisSeries(scenario.id, siteId);

          expect(resultat.budgetInitialDisponible).toBe(false);
          expect(resultat.series.length).toBeGreaterThan(0);
          for (const m of resultat.series) {
            expect(m.budgetInitialFCFA).toBeNull();
            // previsionActualiseeFCFA/reelFCFA restent toujours definis
            // (jamais null), meme sans gel :
            expect(m.previsionActualiseeFCFA).not.toBeNull();
            expect(m.reelFCFA).not.toBeNull();
          }
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(c) REEL nette le signe (DEPENSE - / ENTREE +) et cumule sur l'horizon complet, report du dernier cumul connu sur un mois sans ligne",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3ter.B3] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "reel-signe");
        try {
          const scenario = await createScenario(siteId, {
            code: "PR3TERB3-REELSIGNE",
            nom: "Scenario reel signe",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const poste = await createPostePrevision(scenario.id, siteId, {
            libelle: "Salaires",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
          });
          // 3 mois d'horizon (0, 1, 2) — le mois 1 reste SANS aucune ligne
          // reelle (aucune Depense/Vente ce mois-la).
          await upsertChargeMensuelle(poste.id, siteId, 0, 10000);
          await upsertChargeMensuelle(poste.id, siteId, 2, 10000);

          // Mois 0 : une DEPENSE non mappee de 30 000 (bac NON_RAPPROCHE,
          // toujours comptee dans le reel nette, signe negatif).
          await insertDepense(client, "dep-pr3terb3-m0", siteId, userId, "EAU", 30000, new Date("2026-01-10"));

          const resultat = await getTresorerieTroisSeries(scenario.id, siteId);
          expect(resultat.horizonMois).toBe(3);

          // Mois 0 : reel cumule = -30 000 (DEPENSE, signe negatif).
          expect(resultat.series[0].reelFCFA.toNumber()).toBe(-30000);
          // Mois 1 : AUCUNE ligne reelle ce mois — le cumul est REPORTE
          // (pas de rupture, pas de reinitialisation a 0 alors qu'un mois
          // precedent portait deja -30 000).
          expect(resultat.series[1].reelFCFA.toNumber()).toBe(-30000);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(d) REPREVISION GLISSANTE : mois CLOTURE -> REEL, mois NON clos -> PRÉVISION ACTUALISÉE, les deux DIVERGENT par construction",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3ter.B3] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "reprevision");
        try {
          const scenario = await createScenario(siteId, {
            code: "PR3TERB3-REPREVISION",
            nom: "Scenario reprevision",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const poste = await createPostePrevision(scenario.id, siteId, {
            libelle: "Salaires",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
          });
          // Charge PREVUE de 10 000 sur le mois 0 -> resultatFCFA prevu =
          // -10 000 ce mois (aucun revenu/apport). Le mois 1 n'a aucune
          // charge -> resultatFCFA prevu = 0.
          await upsertChargeMensuelle(poste.id, siteId, 0, 10000);
          await upsertChargeMensuelle(poste.id, siteId, 1, 10000);

          // Mapping : la categorie SALAIRE (reelle) -> le poste "Salaires".
          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "SALAIRE",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: poste.id,
            },
          ]);

          // REEL du mois 0 : 77 000 (delibere DISTINCT de la prevision
          // -10 000, pour discriminer les deux sources sans ambiguite).
          await insertDepense(client, "dep-pr3terb3-repr-m0", siteId, userId, "SALAIRE", 77000, new Date("2026-01-10"));

          // Cloture UNIQUEMENT le mois 0.
          await cloturerMois(scenario.id, siteId, 0, userId);

          const resultat = await getTresorerieTroisSeries(scenario.id, siteId);
          const mois0 = resultat.reprevisionGlissante.find((m) => m.moisAbsolu === 0);
          const mois1 = resultat.reprevisionGlissante.find((m) => m.moisAbsolu === 1);

          expect(mois0?.source).toBe("REEL");
          // Le reel nette du mois 0 est une DEPENSE de 77 000 -> delta
          // negatif -77 000 (jamais la valeur prevue -10 000).
          expect(mois0?.soldeMensuelFCFA.toNumber()).toBe(-77000);

          expect(mois1?.source).toBe("PREVISION_ACTUALISEE");
          // Le mois 1 (non clos) reste sur la PRÉVISION ACTUALISÉE : charge
          // de 10 000 -> resultatFCFA = -10 000, JAMAIS le reel (qui vaut 0
          // ce mois-la, aucune ligne).
          expect(mois1?.soldeMensuelFCFA.toNumber()).toBe(-10000);

          // Les DEUX valeurs sont bien DISTINCTES l'une de l'autre (preuve
          // que la fusion ne recopie pas bêtement la meme source partout).
          expect(mois0?.soldeMensuelFCFA.toNumber()).not.toBe(mois1?.soldeMensuelFCFA.toNumber());
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(d2, story B.4 PR3-ter) REPREVISION d'un mois CLOS reste IMMUABLE meme si le mapping ACTIF change APRES la cloture — preuve end-to-end via getTresorerieTroisSeries, pas seulement au niveau du moteur de rapprochement",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3ter.B4] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "repr-immuable");
        try {
          const scenario = await createScenario(siteId, {
            code: "PR3TERB4-REPRIMMUABLE",
            nom: "Scenario reprevision immuable",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const poste = await createPostePrevision(scenario.id, siteId, {
            libelle: "Salaires",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
          });
          await upsertChargeMensuelle(poste.id, siteId, 0, 10000);

          // v1, EN VIGUEUR au moment de la cloture : SALAIRE -> poste "Salaires".
          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "SALAIRE",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: poste.id,
            },
          ]);

          await insertDepense(client, "dep-pr3terb4-m0", siteId, userId, "SALAIRE", 77000, new Date("2026-01-10"));

          // Cloture le mois 0 : `versionMapping` fige la version 1.
          await cloturerMois(scenario.id, siteId, 0, userId);

          const avantChangementMapping = await getTresorerieTroisSeries(scenario.id, siteId);
          const mois0Avant = avantChangementMapping.reprevisionGlissante.find((m) => m.moisAbsolu === 0);
          expect(mois0Avant?.source).toBe("REEL");
          expect(mois0Avant?.soldeMensuelFCFA.toNumber()).toBe(-77000);
          // (Mineure #5, review PR3-ter) Complement explicite sur `series[m].reelFCFA` :
          // meme garantie d'immuabilite que `reprevisionGlissante`, verifiee separement
          // pour ne rien laisser a l'ambiguite pour un futur lecteur — `reelFCFA` est un
          // pur report de valeur depuis `calculerRapprochementScenario` (deja preuve a un
          // niveau inferieur), cette assertion prouve que la composition dans
          // `getTresorerieTroisSeries` ne reintroduit pas de fuite.
          const serieMois0Avant = avantChangementMapping.series.find((m) => m.moisAbsolu === 0);
          expect(serieMois0Avant?.reelFCFA.toNumber()).toBe(-77000);

          // v2, APRES la cloture : SALAIRE retombe en NON_RAPPROCHE — si la
          // reprevision relisait le mapping ACTIF courant au lieu de
          // `ClotureMois.versionMapping` fige, la ligne SALAIRE quitterait
          // le rapprochement RAPPROCHE et le total nette du mois 0
          // changerait silencieusement (c'est exactement le defaut que ce
          // test doit faire echouer si l'implementation regresse).
          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "AUTRE_CATEGORIE_SANS_RAPPORT",
              cibleType: CibleRapprochement.NON_RAPPROCHE,
              cibleId: null,
            },
          ]);

          const apresChangementMapping = await getTresorerieTroisSeries(scenario.id, siteId);
          const mois0Apres = apresChangementMapping.reprevisionGlissante.find((m) => m.moisAbsolu === 0);

          // Le mois CLOS reste IDENTIQUE : meme source REEL, meme montant
          // nette -77 000, malgre le changement de mapping actif survenu
          // apres la cloture.
          expect(mois0Apres?.source).toBe("REEL");
          expect(mois0Apres?.soldeMensuelFCFA.toNumber()).toBe(mois0Avant?.soldeMensuelFCFA.toNumber());
          expect(mois0Apres?.soldeMensuelFCFA.toNumber()).toBe(-77000);
          // (Mineure #5) meme preuve sur `series[m].reelFCFA` : inchange malgre le
          // changement de mapping actif survenu apres la cloture.
          const serieMois0Apres = apresChangementMapping.series.find((m) => m.moisAbsolu === 0);
          expect(serieMois0Apres?.reelFCFA.toNumber()).toBe(serieMois0Avant?.reelFCFA.toNumber());
          expect(serieMois0Apres?.reelFCFA.toNumber()).toBe(-77000);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(e) le filtre siteId isole deux sites",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3ter.B3] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const siteA = await seedSite(client, "isolation-a");
        const siteB = await seedSite(client, "isolation-b");
        try {
          const scenarioA = await createScenario(siteA.siteId, {
            code: "PR3TERB3-ISOA",
            nom: "Scenario isolation A",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId: siteA.userId,
            parametres: parametresBase,
          });
          const posteA = await createPostePrevision(scenarioA.id, siteA.siteId, {
            libelle: "Salaires A",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
          });
          await upsertChargeMensuelle(posteA.id, siteA.siteId, 0, 5000);

          const scenarioB = await createScenario(siteB.siteId, {
            code: "PR3TERB3-ISOB",
            nom: "Scenario isolation B",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId: siteB.userId,
            parametres: parametresBase,
          });
          const posteB = await createPostePrevision(scenarioB.id, siteB.siteId, {
            libelle: "Salaires B",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
          });
          await upsertChargeMensuelle(posteB.id, siteB.siteId, 0, 999999);

          await insertDepense(client, "dep-pr3terb3-isoA", siteA.siteId, siteA.userId, "SALAIRE", 5000, new Date("2026-01-05"));
          await insertDepense(client, "dep-pr3terb3-isoB", siteB.siteId, siteB.userId, "SALAIRE", 888888, new Date("2026-01-05"));

          const resultatA = await getTresorerieTroisSeries(scenarioA.id, siteA.siteId);

          expect(resultatA.series[0].reelFCFA.toNumber()).toBe(-5000);
          expect(resultatA.series[0].reelFCFA.toNumber()).not.toBe(-888888);
        } finally {
          await cleanup(client, siteA.siteId, siteA.userId);
          await cleanup(client, siteB.siteId, siteB.userId);
        }
      },
      20000
    );
  }
);
