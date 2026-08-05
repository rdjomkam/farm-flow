/**
 * Test d'integration DB-gated — `previsions-rapprochement.ts` (Sprint PR3,
 * story PR3.5). Reference ADR-053 section 5, section 15 (15.1, 15.3, 15.6).
 *
 * Couvre (ADR-053 §15.6 point 4 + prompt PR3.5) :
 * - (a) agregation mensuelle correcte, montants DISTINCTS par mois (jamais
 *   une constante qui ne discriminerait rien) ;
 * - (b) une categorie reelle SANS mapping ressort en NON_RAPPROCHE et EST
 *   comptee dans le total reel ;
 * - (c) IMMUABILITE : un mois CLOTURE garde sa version de mapping figee,
 *   changer le mapping ACTIF ensuite ne modifie PAS le resultat deja
 *   calcule pour ce mois ;
 * - (d) une depense ALIMENT sans LigneDepense ressort en
 *   GRANULOMETRIE_INCONNUE, jamais ignoree ;
 * - (e) le filtre siteId isole bien deux sites.
 *
 * Pourquoi DB-gated : les agregations SQL (`$queryRaw`, `GROUP BY`,
 * `EXTRACT`), la contrainte d'unicite versionnee de `MappingRapprochement`
 * et la resolution `ClotureMois.versionMapping` s'appuient sur un vrai
 * moteur Postgres — aucun mock JS ne peut prouver qu'un `GROUP BY`/`JOIN`
 * SQL produit le bon resultat, ni qu'une deuxieme version de mapping ne
 * remonte pas silencieusement dans un mois deja clos.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, type PoolClient } from "pg";
import { requireDatabaseUrl } from "@/test/require-database-url";
import { createScenario } from "@/lib/queries/previsions-scenarios";
import { createPostePrevision, upsertChargeMensuelle } from "@/lib/queries/previsions-charges";
import { creerVersionMapping } from "@/lib/queries/previsions-rapprochement-mapping";
import {
  getDepensesReellesParCategorie,
  getDepensesAlimentReellesParGranulometrie,
  getSortiesAlimentReellesParGranulometrie,
  getReelAgregeSite,
  calculerRapprochementScenario,
  composeCategorieCle,
  GRANULOMETRIE_INCONNUE,
} from "@/lib/queries/previsions-rapprochement";
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

async function seedSite(c: PoolClient, suffix: string): Promise<{ siteId: string; userId: string; clientId: string; produitId: string }> {
  const siteId = `pr3-rappr-site-${suffix}`;
  const userId = `pr3-rappr-user-${suffix}`;
  const clientId = `pr3-rappr-client-${suffix}`;
  const produitId = `pr3-rappr-produit-${suffix}`;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User PR3 rappr ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site PR3 rappr ${suffix}`, userId]
  );
  await c.query(
    `INSERT INTO "Client" (id, nom, "isActive", "isSysteme", "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, $3, now(), now())`,
    [clientId, `Client PR3 rappr ${suffix}`, siteId]
  );
  await c.query(
    `INSERT INTO "Produit" (id, nom, categorie, unite, "prixUnitaire", "stockActuel", "seuilAlerte", "isActive", "tailleGranule", "siteId", "createdAt", "updatedAt")
     VALUES ($1, 'Aliment G1', 'ALIMENT', 'SACS', 15000, 0, 0, true, 'G1', $2, now(), now())`,
    [produitId, siteId]
  );

  return { siteId, userId, clientId, produitId };
}

async function cleanup(
  c: PoolClient,
  siteId: string,
  userId: string,
  clientId: string,
  produitId: string
): Promise<void> {
  await c.query(`DELETE FROM "ClotureMois" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "MappingRapprochement" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "MouvementStock" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "LigneDepense" WHERE "depenseId" IN (SELECT id FROM "Depense" WHERE "siteId" = $1)`, [siteId]);
  await c.query(`DELETE FROM "Depense" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "Vente" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "ChargeMensuellePrevue" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "PostePrevision" WHERE "siteId" = $1`, [siteId]);
  // ADR-053 §16 (story A.4) — PosteReferentiel apres PostePrevision (FK Restrict)
  await c.query(`DELETE FROM "PosteReferentiel" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "ParametresPrevision" WHERE "scenarioId" IN (SELECT id FROM "ScenarioPrevision" WHERE "siteId" = $1)`, [siteId]);
  await c.query(`DELETE FROM "ScenarioPrevision" WHERE "siteId" = $1`, [siteId]);
  await c.query(`DELETE FROM "Produit" WHERE id = $1`, [produitId]);
  await c.query(`DELETE FROM "Client" WHERE id = $1`, [clientId]);
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
     VALUES ($1, $2, 'Depense test PR3.5', $3::"CategorieDepense", $4, 0, 0, 'NON_PAYEE', $5, $6, $7, now(), now())`,
    [id, id, categorieDepense, montantTotal, date, userId, siteId]
  );
}

async function insertMouvementStock(
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
  "PR3.5 — previsions-rapprochement : lecture agregee du reel",
  () => {
  it(
    "(a) agregation mensuelle avec montants DISTINCTS par mois — pas une constante",
    async () => {
      if (!dbAvailable || !client) {
        console.warn("[PR3.5] DB de dev injoignable — test ignore (dbAvailable=false).");
        return;
      }
      const { siteId, userId, clientId, produitId } = await seedSite(client, "agg-mois");
      try {
        await insertDepense(client, "dep-pr35-m0", siteId, userId, "ELECTRICITE", 111111, new Date("2026-01-15"));
        await insertDepense(client, "dep-pr35-m1", siteId, userId, "ELECTRICITE", 222222, new Date("2026-02-15"));

        const lignes = await getDepensesReellesParCategorie(siteId, new Date("2026-01-01"), 0, 1);
        const parMois = new Map(lignes.map((l) => [l.moisAbsolu, l.montantReel.toNumber()]));

        expect(parMois.get(0)).toBe(111111);
        expect(parMois.get(1)).toBe(222222);
        expect(parMois.get(0)).not.toBe(parMois.get(1));
      } finally {
        await cleanup(client, siteId, userId, clientId, produitId);
      }
    },
    20000
  );

  it(
    "(b) une categorie reelle SANS mapping ressort en NON_RAPPROCHE et est comptee dans le total reel",
    async () => {
      if (!dbAvailable || !client) {
        console.warn("[PR3.5] DB de dev injoignable — test ignore (dbAvailable=false).");
        return;
      }
      const { siteId, userId, clientId, produitId } = await seedSite(client, "non-mappe");
      try {
        const scenario = await createScenario(siteId, {
          code: "PR35-NONMAPPE",
          nom: "Scenario non mappe",
          dateDebutPlan: new Date("2026-01-01").toISOString(),
          userId,
          parametres: parametresBase,
        });

        // Une seule categorie MAPPEE (SALAIRE) — EAU reste volontairement sans mapping.
        const poste = await createPostePrevision(scenario.id, siteId, {
          libelle: "Salaires",
          type: TypePostePrevision.CHARGE_EXPLOITATION,
          ordre: 0,
        });
        await upsertChargeMensuelle(poste.id, siteId, 0, 50000);
        // ADR-053 §16 (story A.4) : cibleId = posteReferentielId (site-scope).
        await creerVersionMapping(siteId, [
          {
            sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
            sourceCle: "SALAIRE",
            cibleType: CibleRapprochement.POSTE_PREVISION,
            cibleId: poste.posteReferentielId,
          },
        ]);

        await insertDepense(client, "dep-pr35-eau", siteId, userId, "EAU", 7000, new Date("2026-01-10"));

        const lignes = await calculerRapprochementScenario(scenario.id, siteId, 0, 0);
        const ligneEau = lignes.find((l) => l.statutRapprochement === "NON_RAPPROCHE");

        expect(ligneEau).toBeDefined();
        expect(ligneEau?.reel?.toNumber()).toBe(7000);
        expect(ligneEau?.libelle).toContain("EAU");

        // Comptee dans le total reel (jamais absorbee/ignoree) :
        const totalReel = lignes
          .filter((l) => l.statutRapprochement !== "SANS_SOURCE_REELLE")
          .reduce((acc, l) => acc + (l.reel?.toNumber() ?? 0), 0);
        expect(totalReel).toBeGreaterThanOrEqual(7000);
      } finally {
        await cleanup(client, siteId, userId, clientId, produitId);
      }
    },
    20000
  );

  it(
    "(c) IMMUABILITE : un mois CLOTURE garde la version de mapping figee — changer le mapping actif ensuite ne modifie pas le resultat deja calcule",
    async () => {
      if (!dbAvailable || !client) {
        console.warn("[PR3.5] DB de dev injoignable — test ignore (dbAvailable=false).");
        return;
      }
      const { siteId, userId, clientId, produitId } = await seedSite(client, "immuable");
      try {
        const scenario = await createScenario(siteId, {
          code: "PR35-IMMUABLE",
          nom: "Scenario immuabilite mapping",
          dateDebutPlan: new Date("2026-01-01").toISOString(),
          userId,
          parametres: parametresBase,
        });

        const poste = await createPostePrevision(scenario.id, siteId, {
          libelle: "Transport",
          type: TypePostePrevision.LOGISTIQUE,
          ordre: 0,
        });
        await upsertChargeMensuelle(poste.id, siteId, 0, 30000);

        // v1 : TRANSPORT -> poste "Transport". ADR-053 §16 (story A.4) :
        // `cibleId` d'un mapping POSTE_PREVISION est desormais un
        // `PosteReferentiel.id` (site-scope), jamais un `PostePrevision.id`
        // (scenario-scope) — `poste.posteReferentielId`, pas `poste.id`.
        const v1 = await creerVersionMapping(siteId, [
          {
            sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
            sourceCle: "TRANSPORT",
            cibleType: CibleRapprochement.POSTE_PREVISION,
            cibleId: poste.posteReferentielId,
          },
        ]);

        await insertDepense(client, "dep-pr35-transport", siteId, userId, "TRANSPORT", 30000, new Date("2026-01-10"));

        // Clot le mois 0 avec la version 1 (figee).
        await client.query(
          `INSERT INTO "ClotureMois" (id, "scenarioId", "moisAbsolu", "clotureeParId", "dateCloture", "siteId", "versionMapping")
           VALUES ($1, $2, 0, $3, now(), $4, $5)`,
          [`cloture-pr35-immuable`, scenario.id, userId, siteId, v1[0].version]
        );

        const avantChangement = await calculerRapprochementScenario(scenario.id, siteId, 0, 0);
        const ligneTransportAvant = avantChangement.find(
          (l) => l.statutRapprochement === "RAPPROCHE" && l.libelle === "Transport"
        );
        expect(ligneTransportAvant).toBeDefined();
        expect(ligneTransportAvant?.reel?.toNumber()).toBe(30000);

        // v2 : TRANSPORT redevient NON mappe (retire du mapping).
        await creerVersionMapping(siteId, [
          {
            sourceType: SourceRapprochement.DEPENSE_CATEGORIE,
            sourceCle: "SALAIRE",
            cibleType: CibleRapprochement.NON_RAPPROCHE,
            cibleId: null,
          },
        ]);

        const apresChangement = await calculerRapprochementScenario(scenario.id, siteId, 0, 0);
        const ligneTransportApres = apresChangement.find(
          (l) => l.statutRapprochement === "RAPPROCHE" && l.libelle === "Transport"
        );

        // Le mois CLOS doit rester IDENTIQUE : toujours RAPPROCHE, reel = 30000,
        // jamais retombe en NON_RAPPROCHE malgre le changement de mapping actif.
        expect(ligneTransportApres).toBeDefined();
        expect(ligneTransportApres?.reel?.toNumber()).toBe(30000);
        expect(apresChangement.find((l) => l.statutRapprochement === "NON_RAPPROCHE" && l.libelle.includes("TRANSPORT"))).toBeUndefined();
      } finally {
        await cleanup(client, siteId, userId, clientId, produitId);
      }
    },
    20000
  );

  it(
    "(d) une depense ALIMENT sans LigneDepense ressort en GRANULOMETRIE_INCONNUE, pas ignoree",
    async () => {
      if (!dbAvailable || !client) {
        console.warn("[PR3.5] DB de dev injoignable — test ignore (dbAvailable=false).");
        return;
      }
      const { siteId, userId, clientId, produitId } = await seedSite(client, "granulo-inconnue");
      try {
        // Depense ALIMENT globale, SANS aucune LigneDepense.
        await insertDepense(client, "dep-pr35-aliment-global", siteId, userId, "ALIMENT", 45000, new Date("2026-01-20"));

        // Depense ALIMENT AVEC une LigneDepense dont le produit porte une granulometrie connue (G1).
        await insertDepense(client, "dep-pr35-aliment-detail", siteId, userId, "ALIMENT", 20000, new Date("2026-01-22"));
        await client.query(
          `INSERT INTO "LigneDepense" (id, "depenseId", designation, "categorieDepense", quantite, "prixUnitaire", "montantTotal", "produitId", "siteId", "createdAt", "updatedAt")
           VALUES ($1, $2, 'Sac G1', 'ALIMENT', 1, 20000, 20000, $3, $4, now(), now())`,
          ["ligne-pr35-detail", "dep-pr35-aliment-detail", produitId, siteId]
        );

        const lignes = await getDepensesAlimentReellesParGranulometrie(siteId, new Date("2026-01-01"), 0, 0);

        // Story C.1 (PR3-ter) : la source reelle de cette fonction est
        // Depense/LigneDepense, jamais MouvementStock — la cle doit refleter
        // DEPENSE_CATEGORIE, pas MOUVEMENT_STOCK (cf. commentaire dans
        // previsions-rapprochement.ts).
        const inconnue = lignes.find(
          (l) => l.categorieCle === composeCategorieCle(SourceRapprochement.DEPENSE_CATEGORIE, `ALIMENT:${GRANULOMETRIE_INCONNUE}`)
        );
        const connue = lignes.find(
          (l) => l.categorieCle === composeCategorieCle(SourceRapprochement.DEPENSE_CATEGORIE, "ALIMENT:G1")
        );

        expect(inconnue).toBeDefined();
        expect(inconnue?.montantReel.toNumber()).toBe(45000);
        expect(connue).toBeDefined();
        expect(connue?.montantReel.toNumber()).toBe(20000);
      } finally {
        await cleanup(client, siteId, userId, clientId, produitId);
      }
    },
    20000
  );

  it(
    "(d2, story C.1 PR3-ter) aucune collision de categorieCle entre la depense ALIMENT par granulometrie (FCFA) et la sortie MouvementStock par granulometrie (kg), meme granulometrie",
    async () => {
      if (!dbAvailable || !client) {
        console.warn("[PR3ter.C1] DB de dev injoignable — test ignore (dbAvailable=false).");
        return;
      }
      const { siteId, userId, clientId, produitId } = await seedSite(client, "collision-c1");
      try {
        // Meme granulometrie (G1, cf. seedSite) des DEUX cotes : une Depense
        // ALIMENT detaillee (FCFA) et une sortie MouvementStock (kg).
        await insertDepense(client, "dep-pr3ter-c1-aliment", siteId, userId, "ALIMENT", 20000, new Date("2026-01-22"));
        await client.query(
          `INSERT INTO "LigneDepense" (id, "depenseId", designation, "categorieDepense", quantite, "prixUnitaire", "montantTotal", "produitId", "siteId", "createdAt", "updatedAt")
           VALUES ($1, $2, 'Sac G1', 'ALIMENT', 1, 20000, 20000, $3, $4, now(), now())`,
          ["ligne-pr3ter-c1", "dep-pr3ter-c1-aliment", produitId, siteId]
        );
        await insertMouvementStock(client, "mvt-pr3ter-c1", siteId, userId, produitId, 75, new Date("2026-01-22"));

        const lignesDepense = await getDepensesAlimentReellesParGranulometrie(siteId, new Date("2026-01-01"), 0, 0);
        const lignesQuantite = await getSortiesAlimentReellesParGranulometrie(siteId, new Date("2026-01-01"), 0, 0);

        const clesDepense = new Set(lignesDepense.map((l) => l.categorieCle));
        const clesQuantite = new Set(lignesQuantite.map((l) => l.categorieCle));
        const intersection = [...clesDepense].filter((cle) => clesQuantite.has(cle));

        // AUCUNE cle commune entre les deux sources — sinon une combinaison
        // future (ex. getReelAgregeSite) sommerait un montant FCFA et une
        // quantite kg sous la meme cle, silencieusement.
        expect(intersection).toEqual([]);

        const ligneDepenseG1 = lignesDepense.find((l) => l.categorieCle.includes("G1"));
        const ligneQuantiteG1 = lignesQuantite.find((l) => l.categorieCle.includes("G1"));
        expect(ligneDepenseG1).toBeDefined();
        expect(ligneQuantiteG1).toBeDefined();
        expect(ligneDepenseG1?.natureGrandeur).toBe("DEPENSE");
        expect(ligneQuantiteG1?.natureGrandeur).toBe("QUANTITE");
        expect(ligneDepenseG1?.montantReel.toNumber()).toBe(20000);
        expect(ligneQuantiteG1?.montantReel.toNumber()).toBe(75);
      } finally {
        await cleanup(client, siteId, userId, clientId, produitId);
      }
    },
    20000
  );

  it(
    "(e) le filtre siteId isole bien deux sites",
    async () => {
      if (!dbAvailable || !client) {
        console.warn("[PR3.5] DB de dev injoignable — test ignore (dbAvailable=false).");
        return;
      }
      const siteA = await seedSite(client, "isolation-a");
      const siteB = await seedSite(client, "isolation-b");
      try {
        await insertDepense(client, "dep-pr35-isoA", siteA.siteId, siteA.userId, "SALAIRE", 10000, new Date("2026-01-05"));
        await insertDepense(client, "dep-pr35-isoB", siteB.siteId, siteB.userId, "SALAIRE", 999999, new Date("2026-01-05"));

        const reelA = await getReelAgregeSite(siteA.siteId, new Date("2026-01-01"), 0, 0);
        const cle = composeCategorieCle(SourceRapprochement.DEPENSE_CATEGORIE, "SALAIRE");
        const ligneA = reelA.find((l) => l.categorieCle === cle);

        expect(ligneA).toBeDefined();
        expect(ligneA?.montantReel.toNumber()).toBe(10000);
        expect(ligneA?.montantReel.toNumber()).not.toBe(999999);
      } finally {
        await cleanup(client, siteA.siteId, siteA.userId, siteA.clientId, siteA.produitId);
        await cleanup(client, siteB.siteId, siteB.userId, siteB.clientId, siteB.produitId);
      }
    },
    20000
  );
});
