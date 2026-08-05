/**
 * Test d'integration DB-gated — administration de `PosteReferentiel`
 * (ADR-053 §16.12, story A.5). Preuve de bout en bout, via le code de
 * PRODUCTION uniquement (ERR-171), des TROIS cas metier exiges
 * explicitement par le chef de projet pour cette story :
 *
 * (a) un `PostePrevision` dont le libelle DIVERGE de son entree referentiel
 *     reste CORRECTEMENT rapproche — le mapping suit `posteReferentielId`
 *     (l'id), jamais le texte du libelle ;
 * (b) le RENOMMAGE d'une entree referentiel (`renommerPosteReferentiel`,
 *     route PATCH) ne casse AUCUN mapping ni le rapprochement deja en place ;
 * (c) une entree DESACTIVEE refuse un NOUVEAU rattachement (branche a ET
 *     branche b de `createPostePrevision`) SANS casser les `PostePrevision`/
 *     `MappingRapprochement` deja lies — ils restent intacts et lisibles.
 *
 * Pourquoi DB-gated : `renommerPosteReferentiel`/`desactiverPosteReferentiel`
 * (updateMany + conditions), la contrainte reelle `@@unique([siteId, code])`
 * et le pipeline complet de rapprochement (`calculerRapprochementScenario`,
 * agregations SQL) s'appuient sur un vrai schema Postgres.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";
import { createScenario } from "@/lib/queries/previsions-scenarios";
import {
  createPostePrevision,
  upsertChargeMensuelle,
  getPostesPrevisionParScenario,
} from "@/lib/queries/previsions-charges";
import {
  renommerPosteReferentiel,
  desactiverPosteReferentiel,
} from "@/lib/queries/previsions-postes-referentiel";
import { creerVersionMapping } from "@/lib/queries/previsions-rapprochement-mapping";
import { calculerRapprochementScenario } from "@/lib/queries/previsions-rapprochement";
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
  const siteId = `a5-admin-site-${suffix}`;
  const userId = `a5-admin-user-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User A5 admin ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site A5 admin ${suffix}`, userId]
  );

  return { siteId, userId };
}

async function cleanup(c: PoolClient, siteId: string, userId: string): Promise<void> {
  await c.query(`DELETE FROM "MappingRapprochement" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "LigneDepense" WHERE "depenseId" IN (SELECT id FROM "Depense" WHERE "siteId" = $1)`, [siteId]);
  await c.query(`DELETE FROM "Depense" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "ChargeMensuellePrevue" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "PostePrevision" WHERE "siteId" = $1`, [siteId]);
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
     VALUES ($1, $2, 'Depense test A.5 (admin referentiel)', $3::"CategorieDepense", $4, 0, 0, 'NON_PAYEE', $5, $6, $7, now(), now())`,
    [id, id, categorieDepense, montantTotal, date, userId, siteId]
  );
}

describe.runIf(requireDatabaseUrl())(
  "A5 — administration PosteReferentiel : les 3 cas metier exiges par le chef de projet",
  () => {
    it(
      "(a) un PostePrevision dont le libelle DIVERGE de son entree referentiel reste CORRECTEMENT rapproche — le mapping suit l'id, jamais le texte",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[A5.admin.a] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "divergence");
        try {
          const scenario = await createScenario(siteId, {
            code: "A5-ADMIN-DIVERGENCE",
            nom: "Scenario divergence libelle",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          // Le PostePrevision porte un libelle SCENARIO-LOCAL volontairement
          // different du libelle de l'entree referentiel qu'il cree
          // (`libelle` != `nouveauPosteReferentielLibelle`) — le cas
          // "divergence" que la story A.5 doit signaler visuellement, sans
          // jamais casser la resolution.
          const { poste } = await createPostePrevision(scenario.id, siteId, {
            libelle: "Salaires equipe production (scenario)",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Salaires",
          });
          expect(poste.libelle).not.toBe(poste.posteReferentiel.libelle);

          await upsertChargeMensuelle(poste.id, siteId, 0, 100000);

          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "SALAIRE",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: poste.posteReferentielId,
            },
          ]);
          await insertDepense(client, "dep-a5-divergence", siteId, userId, "SALAIRE", 77000, new Date("2026-01-10"));

          const lignes = await calculerRapprochementScenario(scenario.id, siteId, 0, 0);
          const ligneSalaires = lignes.find((l) => l.statutRapprochement === "RAPPROCHE" && l.reel?.toNumber() === 77000);
          expect(ligneSalaires).toBeDefined();
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(b) le RENOMMAGE d'une entree referentiel ne casse AUCUN mapping — le rapprochement produit exactement le meme resultat avant/apres",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[A5.admin.b] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "renommage");
        try {
          const scenario = await createScenario(siteId, {
            code: "A5-ADMIN-RENOMMAGE",
            nom: "Scenario renommage",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const { poste } = await createPostePrevision(scenario.id, siteId, {
            libelle: "Transport",
            type: TypePostePrevision.LOGISTIQUE,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Transport",
          });
          await upsertChargeMensuelle(poste.id, siteId, 0, 30000);

          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "TRANSPORT",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: poste.posteReferentielId,
            },
          ]);
          await insertDepense(client, "dep-a5-renommage", siteId, userId, "TRANSPORT", 30000, new Date("2026-01-10"));

          const avantRenommage = await calculerRapprochementScenario(scenario.id, siteId, 0, 0);
          const ligneAvant = avantRenommage.find((l) => l.statutRapprochement === "RAPPROCHE" && l.reel?.toNumber() === 30000);
          expect(ligneAvant).toBeDefined();

          // Renommage reel via la fonction de production (route PATCH
          // /api/previsions/postes-referentiel/[id]) — jamais un UPDATE SQL
          // direct qui contournerait le code teste.
          const renomme = await renommerPosteReferentiel(poste.posteReferentielId, siteId, "Transport & logistique");
          expect(renomme.libelle).toBe("Transport & logistique");
          expect(renomme.code).toBe("transport"); // code FIGE (Arbitrage 1)

          const apresRenommage = await calculerRapprochementScenario(scenario.id, siteId, 0, 0);
          const ligneApres = apresRenommage.find((l) => l.statutRapprochement === "RAPPROCHE" && l.reel?.toNumber() === 30000);
          expect(ligneApres).toBeDefined();
          expect(ligneApres?.previsionnel?.toNumber()).toBe(ligneAvant?.previsionnel?.toNumber());
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(c) une entree DESACTIVEE refuse un NOUVEAU rattachement (branches a ET b) SANS casser les PostePrevision/MappingRapprochement deja lies",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[A5.admin.c] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "desactivation");
        try {
          const scenario = await createScenario(siteId, {
            code: "A5-ADMIN-DESACTIVATION",
            nom: "Scenario desactivation",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const scenarioAutre = await createScenario(siteId, {
            code: "A5-ADMIN-DESACTIVATION-2",
            nom: "Scenario 2 (tentera un nouveau rattachement)",
            dateDebutPlan: new Date("2027-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const { poste } = await createPostePrevision(scenario.id, siteId, {
            libelle: "Assurance",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Assurance",
          });
          await upsertChargeMensuelle(poste.id, siteId, 0, 15000);
          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "AUTRE",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: poste.posteReferentielId,
            },
          ]);
          await insertDepense(client, "dep-a5-desactivation", siteId, userId, "AUTRE", 15000, new Date("2026-01-10"));

          // Desactivation reelle via la fonction de production (route POST
          // .../desactiver).
          const desactivee = await desactiverPosteReferentiel(poste.posteReferentielId, siteId);
          expect(desactivee.actif).toBe(false);

          // BRANCHE (a) : un nouveau rattachement explicite a cette entree
          // desactivee est refuse (409).
          await expect(
            createPostePrevision(scenarioAutre.id, siteId, {
              libelle: "Assurance (nouveau scenario)",
              type: TypePostePrevision.CHARGE_EXPLOITATION,
              ordre: 0,
              posteReferentielId: poste.posteReferentielId,
            })
          ).rejects.toMatchObject({ status: 409, code: "POSTE_REFERENTIEL_INACTIF" });

          // BRANCHE (b) : une creation dont le slug matche cette meme entree
          // desactivee est refusee aussi (409), jamais une reactivation
          // silencieuse ni un doublon.
          await expect(
            createPostePrevision(scenarioAutre.id, siteId, {
              libelle: "Assurance",
              type: TypePostePrevision.CHARGE_EXPLOITATION,
              ordre: 0,
              nouveauPosteReferentielLibelle: "Assurance",
            })
          ).rejects.toMatchObject({ status: 409, code: "POSTE_REFERENTIEL_INACTIF" });

          // Le PostePrevision/MappingRapprochement DEJA LIES restent
          // INTACTS et LISIBLES : la desactivation ne casse rien de
          // l'existant (Arbitrage 2).
          const postesEncore = await getPostesPrevisionParScenario(scenario.id, siteId);
          expect(postesEncore.find((p) => p.id === poste.id)).toBeDefined();

          const lignesApresDesactivation = await calculerRapprochementScenario(scenario.id, siteId, 0, 0);
          const ligneEncoreRapprochee = lignesApresDesactivation.find(
            (l) => l.statutRapprochement === "RAPPROCHE" && l.reel?.toNumber() === 15000
          );
          expect(ligneEncoreRapprochee).toBeDefined();
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );
  }
);
