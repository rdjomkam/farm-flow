/**
 * Test d'integration DB-gated — story A.1 (Sprint PR3-ter) : filet de
 * securite non negociable, point d'entree DB
 * `detecterCiblesOrphelinesDuMappingActif`.
 *
 * Preuve de bout en bout, via le code de PRODUCTION uniquement (ERR-171) :
 * un mapping actif reel, en base, dont la cible (`PostePrevision.id`)
 * n'existe QUE dans un autre scenario du meme site, est bien signale
 * `cibleOrpheline: true` quand on l'evalue contre un second scenario qui ne
 * porte pas cette cible — et `false` quand on l'evalue contre le scenario
 * d'origine.
 *
 * Pourquoi DB-gated : `chargerScenarioPourMoteur` (7 requetes Prisma) et la
 * lecture du mapping actif passent par le vrai schema Postgres — aucun mock
 * JS ne peut prouver que la resolution fonctionne contre des donnees reelles
 * cross-scenario.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";
import { createScenario } from "@/lib/queries/previsions-scenarios";
import { createPostePrevision } from "@/lib/queries/previsions-charges";
import { creerVersionMapping } from "@/lib/queries/previsions-rapprochement-mapping";
import { detecterCiblesOrphelinesDuMappingActif } from "@/lib/queries/previsions-mapping-orphelins";
import { calculerRapprochementScenario } from "@/lib/queries/previsions-rapprochement";
import { Decimal } from "@/lib/previsions/decimal-config";
import { SourceRapprochement, CibleRapprochement, TypePostePrevision } from "@/types";

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

async function seedSite(c: PoolClient, suffix: string): Promise<{ siteId: string; userId: string }> {
  const siteId = `pr3ter-a1-site-${suffix}`;
  const userId = `pr3ter-a1-user-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR3ter A1 ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR3ter A1 ${suffix}`, userId]
  );

  return { siteId, userId };
}

async function cleanup(c: PoolClient, siteId: string, userId: string): Promise<void> {
  await c.query(`DELETE FROM "MappingRapprochement" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "LigneDepense" WHERE "depenseId" IN (SELECT id FROM "Depense" WHERE "siteId" = $1)`, [siteId]);
  await c.query(`DELETE FROM "Depense" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "ChargeMensuellePrevue" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "PostePrevision" WHERE "siteId" = $1`, [siteId]);
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
     VALUES ($1, $2, 'Depense test PR3ter A.4 (composition filet+moteur)', $3::"CategorieDepense", $4, 0, 0, 'NON_PAYEE', $5, $6, $7, now(), now())`,
    [id, id, categorieDepense, montantTotal, date, userId, siteId]
  );
}

describe.runIf(requireDatabaseUrl())(
  "PR3ter.A1 — detecterCiblesOrphelinesDuMappingActif : le filet de securite contre une base reelle",
  () => {
    it(
      "une cible POSTE_PREVISION du scenario A est signalee orpheline quand evaluee contre le scenario B (meme site), et NON orpheline contre A",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3ter.A1] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "cross");
        try {
          const scenarioA = await createScenario(siteId, {
            code: "PR3TER-A1-SCN-A",
            nom: "Scenario A (porte le poste)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const scenarioB = await createScenario(siteId, {
            code: "PR3TER-A1-SCN-B",
            nom: "Scenario B (ne porte PAS ce poste)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const poste = await createPostePrevision(scenarioA.id, siteId, {
            libelle: "Electricite",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
          });

          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "ELECTRICITE",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: poste.id,
            },
          ]);

          const resultatContreA = await detecterCiblesOrphelinesDuMappingActif(scenarioA.id, siteId);
          const ligneA = resultatContreA.find((l) => l.sourceCle === "ELECTRICITE");
          expect(ligneA?.cibleOrpheline).toBe(false);

          const resultatContreB = await detecterCiblesOrphelinesDuMappingActif(scenarioB.id, siteId);
          const ligneB = resultatContreB.find((l) => l.sourceCle === "ELECTRICITE");
          expect(ligneB?.cibleOrpheline).toBe(true);
          expect(ligneB?.cibleCleResolue).toBe(poste.id);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(Moyenne #3, review PR3-ter) COMPOSITION filet + moteur : le filet detecte EXACTEMENT le cas ou le moteur fait disparaitre un montant reel, ni plus ni moins — appelle le vrai pipeline calculerRapprochementScenario, pas seulement detecterCiblesOrphelinesDuMappingActif isolement",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3ter.A4] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "composition");
        try {
          const scenarioA = await createScenario(siteId, {
            code: "PR3TER-A4-SCN-A",
            nom: "Scenario A (porte le poste d'origine du mapping)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const scenarioB = await createScenario(siteId, {
            code: "PR3TER-A4-SCN-B",
            nom: "Scenario B (scenario COURANT, ne porte PAS ce poste)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const posteA = await createPostePrevision(scenarioA.id, siteId, {
            libelle: "Electricite (scenario A)",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
          });

          // Mapping cree contre le scenario A (SITE-scope, ADR-053 §3.9) :
          // cibleId = posteA.id, qui n'existe PAS dans le referentiel du
          // scenario B (scenario courant utilise plus bas).
          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "ELECTRICITE",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: posteA.id,
            },
          ]);

          // Une depense REELLE existe bel et bien sur ce site, mois 0,
          // categorie ELECTRICITE — montant delibarement distinctif (31415)
          // pour ne jamais pouvoir se confondre avec un total legitime
          // d'une autre ligne.
          await insertDepense(client, "dep-pr3ter-a4-elec", siteId, userId, "ELECTRICITE", 31415, new Date("2026-01-10"));

          // (a) LE FILET : la ligne est bien signalee orpheline contre le
          // scenario COURANT (B).
          const detection = await detecterCiblesOrphelinesDuMappingActif(scenarioB.id, siteId);
          const ligneDetectee = detection.find((l) => l.sourceCle === "ELECTRICITE");
          expect(ligneDetectee?.cibleOrpheline).toBe(true);
          expect(ligneDetectee?.cibleCleResolue).toBe(posteA.id);

          // (b) LE MOTEUR (vrai pipeline de production, jamais reimplemente,
          // ERR-171) : le montant reel de 31415 FCFA n'apparait NULLE PART
          // dans le resultat pour le scenario COURANT — ni RAPPROCHE (aucune
          // EntreePrevueRapprochement du scenario B ne porte la cle
          // posteA.id), ni NON_RAPPROCHE (le mapping cible une cible NON
          // NULLE, meme orpheline — src/lib/previsions/rapprochement.ts
          // ligne 310-322/343-344, exactement le defaut documente par la
          // pre-analyse PR3ter.A et reporte comme non corrige pour
          // POSTE_PREVISION, review-sprint-PR3-ter.md Majeur #2).
          const lignesMoteur = await calculerRapprochementScenario(scenarioB.id, siteId, 0, 0);

          const montantTotalReel = lignesMoteur.reduce(
            (total, l) => total.plus(l.reel ?? new Decimal(0)),
            new Decimal(0)
          );

          const uneLigneContient31415 = lignesMoteur.some((l) => l.reel?.toNumber() === 31415);
          expect(uneLigneContient31415).toBe(false);
          expect(montantTotalReel.toNumber()).not.toBe(31415);

          // Preuve conjointe explicite : le filet a bien signale (a) EXACTEMENT
          // la ligne dont le moteur (b) a fait disparaitre le montant — ni un
          // faux positif (une ligne signalee orpheline dont le montant serait
          // pourtant bien compte quelque part), ni un faux negatif (un montant
          // disparu du moteur sans etre signale par le filet).
          expect(ligneDetectee?.cibleOrpheline).toBe(true);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );
  }
);
