/**
 * Test d'integration DB-gated — story A.4 (Sprint PR3-quater, ADR-053 §16),
 * point d'entree DB `detecterCiblesOrphelinesDuMappingActif` +
 * `createPostePrevision` (get-or-create `PosteReferentiel`).
 *
 * Remplace l'ancien contrat (`cibleId: poste.id`, PostePrevision.id
 * scenario-scope) par le contrat CORRIGE (`cibleId: posteReferentielId`,
 * PosteReferentiel.id site-scope) — c'est le defaut exact documente par
 * ERR-179 et corrige par cette story.
 *
 * Preuve de bout en bout, via le code de PRODUCTION uniquement (ERR-171) :
 * - (1) resolution nominale par posteReferentielId ;
 * - (2) PORTABILITE INTER-SCENARIOS : un mapping cree contre le scenario A
 *   resout aussi sous le scenario B du meme site (propriete que la story
 *   achete — cf. instructions PM) ;
 * - (3) SURVIE A LA SUPPRESSION d'un scenario : le PosteReferentiel et le
 *   mapping restent valides apres suppression physique du scenario qui a
 *   cree le PostePrevision d'origine ;
 * - (4) cas orphelin legitime : un scenario qui n'a jamais eu de
 *   PostePrevision pour l'entree referentiel visee est signale ORPHELIN,
 *   jamais confondu avec NON_RAPPROCHE, jamais absorbe par un `?? 0` muet ;
 * - (5) composition filet + moteur (regression Moyenne #3, review PR3-ter) ;
 * - (6) get-or-create sous concurrence reelle (§16.9 point 10, R4) : deux
 *   creations concomitantes du meme libelle dans deux scenarios du meme site
 *   ne produisent JAMAIS deux entrees PosteReferentiel ;
 * - (7) RESTRICT (§16.9 point 4) : un DELETE SQL direct sur une PosteReferentiel
 *   referencee par un PostePrevision echoue avec une violation de contrainte
 *   FK Postgres (23503), jamais un succes silencieux.
 *
 * Pourquoi DB-gated : `chargerScenarioPourMoteur` (7 requetes Prisma), la
 * contrainte reelle `@@unique([siteId, code])` de `PosteReferentiel` et la
 * FK `onDelete: Restrict`/cascade de suppression de scenario s'appuient sur
 * un vrai schema Postgres — aucun mock JS ne peut prouver ce comportement
 * contre des donnees reelles cross-scenario ni contre une vraie course de
 * transactions concurrentes.
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
  const siteId = `pr3quater-a4-site-${suffix}`;
  const userId = `pr3quater-a4-user-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR3quater A4 ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR3quater A4 ${suffix}`, userId]
  );

  return { siteId, userId };
}

async function cleanup(c: PoolClient, siteId: string, userId: string): Promise<void> {
  await c.query(`DELETE FROM "MappingRapprochement" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "LigneDepense" WHERE "depenseId" IN (SELECT id FROM "Depense" WHERE "siteId" = $1)`, [siteId]);
  await c.query(`DELETE FROM "Depense" WHERE "siteId" = $1`, [siteId]);
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
     VALUES ($1, $2, 'Depense test PR3quater A.4 (composition filet+moteur)', $3::"CategorieDepense", $4, 0, 0, 'NON_PAYEE', $5, $6, $7, now(), now())`,
    [id, id, categorieDepense, montantTotal, date, userId, siteId]
  );
}

describe.runIf(requireDatabaseUrl())(
  "PR3quater.A4 — PosteReferentiel : le filet + le get-or-create contre une base reelle",
  () => {
    it(
      "(1) resolution nominale : une cible POSTE_PREVISION dont cibleId = posteReferentielId n'est JAMAIS orpheline sous le scenario qui la porte",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3quater.A4.1] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "nominal");
        try {
          const scenario = await createScenario(siteId, {
            code: "PR3QUATER-A4-NOMINAL",
            nom: "Scenario nominal",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const { poste } = await createPostePrevision(scenario.id, siteId, {
            libelle: "Electricite",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Electricite",
          });

          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "ELECTRICITE",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: poste.posteReferentielId,
            },
          ]);

          const resultat = await detecterCiblesOrphelinesDuMappingActif(scenario.id, siteId);
          const ligne = resultat.find((l) => l.sourceCle === "ELECTRICITE");
          expect(ligne?.cibleOrpheline).toBe(false);
          expect(ligne?.cibleCleResolue).toBe(poste.id);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(2) PORTABILITE INTER-SCENARIOS — LA PROPRIETE CENTRALE ACHETEE PAR CETTE STORY : un mapping cree contre le scenario A resout AUSSI, sans reconfiguration, sous le scenario B du meme site",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3quater.A4.2] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "portable");
        try {
          const scenarioA = await createScenario(siteId, {
            code: "PR3QUATER-A4-PORT-A",
            nom: "Scenario A (cree le mapping)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const scenarioB = await createScenario(siteId, {
            code: "PR3QUATER-A4-PORT-B",
            nom: "Scenario B (plan successeur, meme site)",
            dateDebutPlan: new Date("2027-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const { poste: posteA } = await createPostePrevision(scenarioA.id, siteId, {
            libelle: "Salaires",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Salaires",
          });
          // Contrat XOR ACTIVE (ADR-053 §16.6/§16.12, story A.5) : plus de
          // get-or-create silencieux — le scenario B rattache EXPLICITEMENT
          // son poste a la MEME entree referentiel via posteReferentielId
          // (branche a), c'est le chemin normal par lequel un administrateur
          // reproduit un poste d'un plan a l'autre.
          const { poste: posteB, reutilise } = await createPostePrevision(scenarioB.id, siteId, {
            libelle: "salaires",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            posteReferentielId: posteA.posteReferentielId,
          });
          expect(reutilise).toBe(true);
          expect(posteA.posteReferentielId).toBe(posteB.posteReferentielId);
          expect(posteA.id).not.toBe(posteB.id);

          // Le mapping est cree UNE SEULE FOIS, contre le referentiel du
          // site — jamais reconfigure pour B.
          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "SALAIRE",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: posteA.posteReferentielId,
            },
          ]);

          const resultatA = await detecterCiblesOrphelinesDuMappingActif(scenarioA.id, siteId);
          const ligneA = resultatA.find((l) => l.sourceCle === "SALAIRE");
          expect(ligneA?.cibleOrpheline).toBe(false);
          expect(ligneA?.cibleCleResolue).toBe(posteA.id);

          const resultatB = await detecterCiblesOrphelinesDuMappingActif(scenarioB.id, siteId);
          const ligneB = resultatB.find((l) => l.sourceCle === "SALAIRE");
          expect(ligneB?.cibleOrpheline).toBe(false);
          expect(ligneB?.cibleCleResolue).toBe(posteB.id);
          expect(ligneB?.cibleCleResolue).not.toBe(ligneA?.cibleCleResolue);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(3) SURVIE A LA SUPPRESSION D'UN SCENARIO : supprimer physiquement le scenario A (cascade sur ses PostePrevision) laisse PosteReferentiel intact et le mapping toujours resolvable sous B",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3quater.A4.3] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "suppression");
        try {
          const scenarioA = await createScenario(siteId, {
            code: "PR3QUATER-A4-SUPPR-A",
            nom: "Scenario A (sera supprime)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const scenarioB = await createScenario(siteId, {
            code: "PR3QUATER-A4-SUPPR-B",
            nom: "Scenario B (survit)",
            dateDebutPlan: new Date("2027-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const { poste: posteA } = await createPostePrevision(scenarioA.id, siteId, {
            libelle: "Loyer",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Loyer",
          });
          const { poste: posteB } = await createPostePrevision(scenarioB.id, siteId, {
            libelle: "Loyer",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            posteReferentielId: posteA.posteReferentielId,
          });
          expect(posteA.posteReferentielId).toBe(posteB.posteReferentielId);
          const referentielId = posteA.posteReferentielId;

          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "LOYER",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: referentielId,
            },
          ]);

          // Aucune route DELETE de scenario n'existe (pre-analyse §1.3) —
          // suppression physique directe pour prouver la garantie de schema
          // (onDelete: Cascade sur PostePrevision.scenario), pas un parcours
          // utilisateur normal.
          await client.query(`DELETE FROM "ChargeMensuellePrevue" WHERE "scenarioId" = $1`, [scenarioA.id]);
          await client.query(`DELETE FROM "ParametresPrevision" WHERE "scenarioId" = $1`, [scenarioA.id]);
          await client.query(`DELETE FROM "ScenarioPrevision" WHERE id = $1`, [scenarioA.id]);

          // PostePrevision de A a disparu (cascade), mais PosteReferentiel
          // N'A PAS ete touche — cycle de vie totalement independant du
          // scenario (ADR-053 §16.5).
          const posteAEncore = await client.query(`SELECT id FROM "PostePrevision" WHERE id = $1`, [posteA.id]);
          expect(posteAEncore.rowCount).toBe(0);
          const referentielEncore = await client.query(`SELECT id FROM "PosteReferentiel" WHERE id = $1`, [referentielId]);
          expect(referentielEncore.rowCount).toBe(1);

          // Le mapping reste syntaxiquement valide et resout TOUJOURS sous B
          // (qui n'a jamais ete touche).
          const resultatB = await detecterCiblesOrphelinesDuMappingActif(scenarioB.id, siteId);
          const ligneB = resultatB.find((l) => l.sourceCle === "LOYER");
          expect(ligneB?.cibleOrpheline).toBe(false);
          expect(ligneB?.cibleCleResolue).toBe(posteB.id);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(4) cas orphelin LEGITIME : un scenario qui n'a jamais eu de PostePrevision pour cette entree referentiel est signale ORPHELIN, jamais confondu avec une corruption",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3quater.A4.4] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "legitime");
        try {
          const scenarioA = await createScenario(siteId, {
            code: "PR3QUATER-A4-LEGIT-A",
            nom: "Scenario A (porte le poste)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const scenarioC = await createScenario(siteId, {
            code: "PR3QUATER-A4-LEGIT-C",
            nom: "Scenario C (ne budgetise pas ce poste)",
            dateDebutPlan: new Date("2026-06-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const { poste } = await createPostePrevision(scenarioA.id, siteId, {
            libelle: "Assurance",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Assurance",
          });

          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "ASSURANCE",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: poste.posteReferentielId,
            },
          ]);

          const resultatC = await detecterCiblesOrphelinesDuMappingActif(scenarioC.id, siteId);
          const ligneC = resultatC.find((l) => l.sourceCle === "ASSURANCE");
          expect(ligneC?.cibleOrpheline).toBe(true);
          expect(ligneC?.cibleCleResolue).toBeNull();
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(5, Moyenne #3 review PR3-ter, CORRIGE par A.4) COMPOSITION filet + moteur : le filet signale l'orphelinite legitime ET le moteur (vrai pipeline de production) ne fait PLUS disparaitre le montant reel — il bascule explicitement en NON_RAPPROCHE, jamais un `?? 0` muet (defaut ERR-179, CORRIGE ICI, contrairement a l'ancien comportement ALIMENT_PREVISION-seul de la story A.3)",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3quater.A4.5] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "composition");
        try {
          const scenarioA = await createScenario(siteId, {
            code: "PR3QUATER-A4-COMP-A",
            nom: "Scenario A (porte le poste d'origine du mapping)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const scenarioB = await createScenario(siteId, {
            code: "PR3QUATER-A4-COMP-B",
            nom: "Scenario B (scenario COURANT, ne budgetise pas ce poste)",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          const { poste: posteA } = await createPostePrevision(scenarioA.id, siteId, {
            libelle: "Electricite (scenario A)",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Electricite (scenario A)",
          });

          // Mapping cree contre l'entree referentiel du poste du scenario A —
          // AUCUN PostePrevision du scenario B (courant, plus bas) n'y est
          // lie : cas legitime "ce scenario ne budgetise pas ce poste", pas
          // le defaut ERR-179 (qui aurait rendu cibleId invalide meme SI B
          // avait un poste equivalent).
          await creerVersionMapping(siteId, [
            {
              sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
              sourceCle: "ELECTRICITE",
              cibleType: CibleRapprochement.POSTE_PREVISION,
              cibleId: posteA.posteReferentielId,
            },
          ]);

          await insertDepense(client, "dep-pr3quater-a4-elec", siteId, userId, "ELECTRICITE", 31415, new Date("2026-01-10"));

          // (a) LE FILET : orpheline contre le scenario COURANT (B).
          const detection = await detecterCiblesOrphelinesDuMappingActif(scenarioB.id, siteId);
          const ligneDetectee = detection.find((l) => l.sourceCle === "ELECTRICITE");
          expect(ligneDetectee?.cibleOrpheline).toBe(true);
          expect(ligneDetectee?.cibleCleResolue).toBeNull();

          // (b) LE MOTEUR (vrai pipeline de production, jamais reimplemente,
          // ERR-171) : AVANT la story A.4, ce montant disparaissait
          // silencieusement (ERR-179, cf. l'ancienne version de ce test).
          // DEPUIS A.4, `versMappingActif`/`resoudrePosteCibleCle`
          // (`previsions-rapprochement.ts`) resolvent aussi dynamiquement
          // POSTE_PREVISION : une resolution qui echoue (`cibleCle = null`)
          // fait retomber la source sur le bac NON_RAPPROCHE explicite —
          // JAMAIS un `?? 0` muet. Le montant de 31415 FCFA doit donc
          // apparaitre, mais SOUS NON_RAPPROCHE, jamais sous RAPPROCHE (qui
          // impliquerait une resolution reussie a tort).
          const lignesMoteur = await calculerRapprochementScenario(scenarioB.id, siteId, 0, 0);

          const ligneNonRapprochee31415 = lignesMoteur.find(
            (l) => l.statutRapprochement === "NON_RAPPROCHE" && l.reel?.toNumber() === 31415
          );
          expect(ligneNonRapprochee31415).toBeDefined();

          const uneLigneRapprocheeContient31415 = lignesMoteur.some(
            (l) => l.statutRapprochement === "RAPPROCHE" && l.reel?.toNumber() === 31415
          );
          expect(uneLigneRapprocheeContient31415).toBe(false);

          // Comptee dans le total reel (jamais absorbee/ignoree, ADR-053 §5) :
          const montantTotalReel = lignesMoteur
            .filter((l) => l.statutRapprochement !== "SANS_SOURCE_REELLE")
            .reduce((total, l) => total.plus(l.reel ?? new Decimal(0)), new Decimal(0));
          expect(montantTotalReel.toNumber()).toBeGreaterThanOrEqual(31415);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(6, §16.12 'Concurrence', DIVERGENCE EXPLICITE d'avec §16.9 point 10/§16.11) CONCURRENCE REELLE SOUS LE CONTRAT XOR : deux createPostePrevision concomitants avec nouveauPosteReferentielLibelle du meme libelle dans deux scenarios du meme site ne produisent JAMAIS deux entrees PosteReferentiel — mais la requete perdante recoit desormais un 409 explicite, JAMAIS une reutilisation silencieuse",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3quinquies.A5.6] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "concurrence");
        try {
          const scenarioA = await createScenario(siteId, {
            code: "PR3QUATER-A4-CONC-A",
            nom: "Scenario A",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const scenarioB = await createScenario(siteId, {
            code: "PR3QUATER-A4-CONC-B",
            nom: "Scenario B",
            dateDebutPlan: new Date("2027-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });

          // Deux appels reellement concomitants (Promise.allSettled, pas
          // sequentiel) — l'un des deux `create` de PosteReferentiel va
          // necessairement manquer son `findUnique` initial et rattraper la
          // violation @@unique([siteId, code]) reelle de Postgres (P2002).
          // Sous le contrat XOR ACTIVE (§16.12), la requete perdante ne se
          // rabat plus sur une reutilisation silencieuse : elle echoue
          // TOUJOURS avec un 409 POSTE_REFERENTIEL_CODE_COLLISION — la
          // seconde requete voulait CREER, pas SELECTIONNER.
          const [resultatA, resultatB] = await Promise.allSettled([
            createPostePrevision(scenarioA.id, siteId, {
              libelle: "Carburant",
              type: TypePostePrevision.LOGISTIQUE,
              ordre: 0,
              nouveauPosteReferentielLibelle: "Carburant",
            }),
            createPostePrevision(scenarioB.id, siteId, {
              libelle: "Carburant",
              type: TypePostePrevision.LOGISTIQUE,
              ordre: 0,
              nouveauPosteReferentielLibelle: "Carburant",
            }),
          ]);

          const resultats = [resultatA, resultatB];
          const gagnants = resultats.filter(
            (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof createPostePrevision>>> =>
              r.status === "fulfilled"
          );
          const perdants = resultats.filter(
            (r): r is PromiseRejectedResult => r.status === "rejected"
          );

          // Exactement une des deux requetes reussit, l'autre echoue en 409 —
          // jamais deux succes, jamais deux echecs.
          expect(gagnants).toHaveLength(1);
          expect(perdants).toHaveLength(1);
          expect(perdants[0].reason).toMatchObject({
            status: 409,
            code: "POSTE_REFERENTIEL_CODE_COLLISION",
          });

          const referentiels = await client.query(
            `SELECT id FROM "PosteReferentiel" WHERE "siteId" = $1 AND code = 'carburant'`,
            [siteId]
          );
          expect(referentiels.rowCount).toBe(1);

          // Un seul PostePrevision a ete cree (celui de la requete gagnante) —
          // la requete perdante n'a laisse AUCUN poste orphelin.
          const postes = await client.query(
            `SELECT id FROM "PostePrevision" WHERE "siteId" = $1`,
            [siteId]
          );
          expect(postes.rowCount).toBe(1);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );

    it(
      "(7, §16.9 point 4) RESTRICT BLOQUE LA SUPPRESSION : un DELETE SQL direct sur une PosteReferentiel referencee par au moins un PostePrevision echoue avec une violation de contrainte FK Postgres, jamais un succes silencieux",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[PR3quater.A4.7] DB de dev injoignable — test ignore (dbAvailable=false).");
          return;
        }
        const { siteId, userId } = await seedSite(client, "restrict");
        try {
          const scenario = await createScenario(siteId, {
            code: "PR3QUATER-A4-RESTRICT",
            nom: "Scenario Restrict",
            dateDebutPlan: new Date("2026-01-01").toISOString(),
            userId,
            parametres: parametresBase,
          });
          const { poste } = await createPostePrevision(scenario.id, siteId, {
            libelle: "Maintenance",
            type: TypePostePrevision.CHARGE_EXPLOITATION,
            ordre: 0,
            nouveauPosteReferentielLibelle: "Maintenance",
          });
          const referentielId = poste.posteReferentielId;

          // La PosteReferentiel est bien referencee par le PostePrevision cree ci-dessus.
          const referentielAvant = await client.query(`SELECT id FROM "PosteReferentiel" WHERE id = $1`, [referentielId]);
          expect(referentielAvant.rowCount).toBe(1);

          // Tentative de DELETE SQL direct sur la PosteReferentiel referencee :
          // aucune route applicative ne permet ce geste aujourd'hui (§16.9 point 4)
          // — le test verifie la garantie de SCHEMA elle-meme (onDelete: Restrict),
          // pas un comportement applicatif.
          await expect(
            client.query(`DELETE FROM "PosteReferentiel" WHERE id = $1`, [referentielId])
          ).rejects.toMatchObject({
            code: "23503", // foreign_key_violation (Postgres)
          });

          // La ligne n'a PAS ete supprimee : rejet de contrainte, pas un succes
          // silencieux ni une suppression partielle.
          const referentielApres = await client.query(`SELECT id FROM "PosteReferentiel" WHERE id = $1`, [referentielId]);
          expect(referentielApres.rowCount).toBe(1);

          const posteEncore = await client.query(`SELECT id FROM "PostePrevision" WHERE id = $1`, [poste.id]);
          expect(posteEncore.rowCount).toBe(1);
        } finally {
          await cleanup(client, siteId, userId);
        }
      },
      20000
    );
  }
);
