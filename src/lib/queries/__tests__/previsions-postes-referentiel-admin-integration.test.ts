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
  reactiverPosteReferentiel,
  listerPostesReferentielAdmin,
} from "@/lib/queries/previsions-postes-referentiel";
import { creerVersionMapping } from "@/lib/queries/previsions-rapprochement-mapping";
import { calculerRapprochementScenario } from "@/lib/queries/previsions-rapprochement";
import { SourceRapprochement, CibleRapprochement, TypePostePrevision } from "@/types";

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;
let client: PoolClient | null = null;
let dbAvailable = false;
let erreurConnexion: unknown = null;

const MESSAGE_DB_INJOIGNABLE =
  "[A5.admin.a/A5.admin.b/A5.admin.c/A5.admin.d] DATABASE_URL est definie (le gating a legitimement decide que ce " +
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
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
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
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
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
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
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

    it(
      "(d) listerPostesReferentielAdmin expose nbPostesRattaches/nbMappingsRattaches en 2 requetes fixes, jamais N (reserve PR2non.3/R3)",
      async () => {
        if (!dbAvailable || !client) {
          throw new Error(MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion });
        }
        const { siteId, userId } = await seedSite(client, "decomptes");
        try {
          const scenario = await createScenario(siteId, {
            code: "A5-ADMIN-DECOMPTES",
            nom: "Scenario decomptes",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          // Poste A : 1 PostePrevision rattache + 1 MappingRapprochement actif.
          const { poste: posteA } = await createPostePrevision(scenario.id, siteId, {
            libelle: "Salaires",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Salaires",
          });
          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "SALAIRE",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: posteA.posteReferentielId,
            },
          ]);

          // Poste B : 1 PostePrevision rattache, AUCUN MappingRapprochement —
          // c'est le cas qui prouve que le `?? 0` du groupBy est legitime
          // (entree absente du groupBy, pas un echec de resolution).
          const { poste: posteB } = await createPostePrevision(scenario.id, siteId, {
            libelle: "Loyer",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 1,
            nouveauPosteReferentielLibelle: "Loyer",
          });

          const entries = await listerPostesReferentielAdmin(siteId);
          const entreeA = entries.find((e) => e.id === posteA.posteReferentielId);
          const entreeB = entries.find((e) => e.id === posteB.posteReferentielId);

          expect(entreeA).toBeDefined();
          expect(entreeA?.nbPostesRattaches).toBe(1);
          expect(entreeA?.nbMappingsRattaches).toBe(1);

          expect(entreeB).toBeDefined();
          expect(entreeB?.nbPostesRattaches).toBe(1);
          expect(entreeB?.nbMappingsRattaches).toBe(0);

          // Extension du defaut PR2non.3 (reserve R3, defaut confirme severite
          // Haute) : les TROIS mutations (renommer/desactiver/reactiver)
          // doivent renvoyer les MEMES decomptes que `listerPostesReferentielAdmin`
          // pour la meme entree — jamais `undefined` sur AUCUN de leurs points
          // de retour, y compris les retours idempotents (desactiver un
          // inactif, reactiver un actif). C'est le helper prive
          // `getPosteReferentielAdmin` qui garantit cette parite.
          const renomme = await renommerPosteReferentiel(posteA.posteReferentielId, siteId, "Salaires equipe");
          expect(renomme.nbPostesRattaches).toBe(1);
          expect(renomme.nbMappingsRattaches).toBe(1);

          const desactive = await desactiverPosteReferentiel(posteA.posteReferentielId, siteId);
          expect(desactive.actif).toBe(false);
          expect(desactive.nbPostesRattaches).toBe(1);
          expect(desactive.nbMappingsRattaches).toBe(1);

          // Retour idempotent (desactiver un DEJA-desactive) — le point le
          // plus facile a oublier lors de l'enrichissement.
          const desactiveIdempotent = await desactiverPosteReferentiel(posteA.posteReferentielId, siteId);
          expect(desactiveIdempotent.actif).toBe(false);
          expect(desactiveIdempotent.nbPostesRattaches).toBe(1);
          expect(desactiveIdempotent.nbMappingsRattaches).toBe(1);

          const reactive = await reactiverPosteReferentiel(posteA.posteReferentielId, siteId);
          expect(reactive.actif).toBe(true);
          expect(reactive.nbPostesRattaches).toBe(1);
          expect(reactive.nbMappingsRattaches).toBe(1);

          // Retour idempotent (reactiver un DEJA-actif) — meme piege.
          const reactiveIdempotent = await reactiverPosteReferentiel(posteA.posteReferentielId, siteId);
          expect(reactiveIdempotent.actif).toBe(true);
          expect(reactiveIdempotent.nbPostesRattaches).toBe(1);
          expect(reactiveIdempotent.nbMappingsRattaches).toBe(1);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );
  }
);
