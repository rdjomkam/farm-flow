/**
 * Test d'intégration — SU.4 : robustesse transactionnelle de
 * `signerBonLivraison` (src/lib/queries/bons-livraison.ts).
 *
 * Contrairement au reste de la suite `bons-livraison*.test.ts` (qui mocke
 * intégralement `@/lib/db`, y compris `$transaction` — un passthrough factice
 * sans aucune notion de rollback), ce fichier N'EST PAS mocké : il appelle la
 * VRAIE fonction `signerBonLivraison` contre un VRAI PostgreSQL (Docker, port
 * 8432 — voir MEMORY.md). Ce que ce test vérifie est un comportement du
 * MOTEUR (rollback réel sur exception, verrouillage de lignes lors d'écritures
 * concurrentes) — un mock de `$transaction` ne peut structurellement pas le
 * prouver (cf. pre-analysis sprint SU, story SU.4, et ERR-103 leçon (e) : "un
 * test qui mocke le moteur ne teste pas le moteur", même principe appliqué
 * ici à Postgres plutôt qu'à @react-pdf/renderer).
 *
 * Pattern réutilisé de SU.12
 * (scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts) :
 * connexion `pg.Pool` directe pour le setup/la vérification/le nettoyage,
 * `describe.runIf(requireDatabaseUrl())` (helper ADR-052 §3.2) pour ne jamais
 * bloquer `npx vitest run` sur une machine sans Docker.
 *
 * DIFFÉRENCE IMPORTANTE avec SU.12 : SU.12 encapsule tout dans
 * BEGIN/ROLLBACK sur une seule connexion `pg`. Ici, ce n'est PAS possible :
 * `signerBonLivraison` gère SA PROPRE transaction via `prisma.$transaction`,
 * sur SA PROPRE connexion (le client Prisma partagé de `@/lib/db`, pool
 * `max: 1`). On ne peut donc pas englober son appel dans un BEGIN/ROLLBACK
 * piloté depuis `pg` : le nettoyage se fait par DELETE explicites en
 * `afterEach`/`finally`, jamais par ROLLBACK.
 *
 * CE QUE CES TESTS PROUVENT RÉELLEMENT (voir rapport docs/tests/rapport-sprint-SU.md
 * pour le détail complet) :
 * 1. Atomicité : quand `verifyAssignationInvariant` rejette réellement (pas
 *    un mock — un vrai calcul contre des données réellement en base) APRÈS
 *    que plusieurs écritures de la transaction ont eu lieu (LigneVente,
 *    LigneBonLivraison, Vente, BonLivraison), AUCUNE de ces écritures ne
 *    persiste : le VRAI moteur Postgres a fait un VRAI rollback.
 * 2. Concurrence : deux appels réels et concurrents (`Promise.allSettled`)
 *    sur le même BonLivraison aboutissent à exactement un succès + un échec
 *    propre, sans double décrément.
 *
 * CE QU'ILS NE PROUVENT PAS (limitation honnête, à ne pas maquiller) :
 * Le client Prisma partagé (`src/lib/db.ts`) est configuré avec
 * `PrismaPg({ max: 1, ... })` — UNE SEULE connexion physique dans le pool.
 * Les deux appels concurrents de test 2 sont donc nécessairement SÉRIALISÉS
 * au niveau de la connexion Postgres (la deuxième transaction ne peut
 * commencer qu'après que la première ait libéré la connexion), même s'ils
 * sont lancés concurremment côté JS. Ce test prouve donc que le garde
 * applicatif (`updateMany` conditionnel, R4) fonctionne correctement contre
 * un VRAI Postgres sous un ordonnancement JS concurrent — mais PAS un
 * scénario de vraie concurrence moteur (deux transactions Postgres
 * réellement imbriquées dans le temps, avec verrouillage de ligne
 * disputé). Prouver ce dernier point nécessiterait de modifier
 * `src/lib/db.ts` (pool > 1) ou d'introduire un second client Prisma dédié
 * au test — les deux sont hors du périmètre "ne pas modifier le code de
 * production" de cette story. Documenté explicitement, pas maquillé.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Pool, type PoolClient } from "pg";
import { signerBonLivraison } from "@/lib/queries/bons-livraison";
import { persisterEcartConstate } from "@/lib/guards/assignation-invariant";
import { ContexteDetectionEcart } from "@/types";
import { requireDatabaseUrl } from "@/test/require-database-url";

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

const DUMMY_SIGNATURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

interface SeedIds {
  siteId: string;
  userId: string;
  vagueId: string;
  bacId: string;
  clientId: string;
  venteId: string;
  ligneVenteId: string;
  bonLivraisonId: string;
  ligneBonLivraisonId: string;
}

/**
 * Seed complet minimal pour un BL EN_ATTENTE_SIGNATURE prêt à signer.
 * `avecReleveVente` contrôle la présence du relevé VENTE lié au bac : c'est
 * ce relevé qui, mis à jour dans la boucle de `signerBonLivraison`, compense
 * exactement la nouvelle mortalité créée (voir commentaire du test 1) — son
 * absence est l'anomalie de données qui déclenche un VRAI rejet de
 * `verifyAssignationInvariant`.
 */
async function seedBonLivraisonPret(
  c: PoolClient,
  suffix: string,
  opts: {
    nombrePoissons: number;
    nombreMortsTransport: number;
    avecReleveVente: boolean;
  }
): Promise<SeedIds> {
  const siteId = `su4-test-site-${suffix}`;
  const userId = `su4-test-user-${suffix}`;
  const vagueId = `su4-test-vague-${suffix}`;
  const bacId = `su4-test-bac-${suffix}`;
  const assignationId = `su4-test-assign-${suffix}`;
  const clientId = `su4-test-client-${suffix}`;
  const venteId = `su4-test-vente-${suffix}`;
  const ligneVenteId = `su4-test-lv-${suffix}`;
  const bonLivraisonId = `su4-test-bl-${suffix}`;
  const ligneBonLivraisonId = `su4-test-lbl-${suffix}`;
  const numeroVente = `SU4-V-${suffix}`;
  const numeroBL = `SU4-BL-${suffix}`;

  const { nombrePoissons, nombreMortsTransport, avecReleveVente } = opts;
  const poidsTotalKg = nombrePoissons; // 1kg/poisson, arithmétique simple
  const prixUnitaireKg = 1000;
  const montantTotal = poidsTotalKg * prixUnitaireKg;

  await c.query(
    `INSERT INTO "User" (id, name, "passwordHash", role, "isActive", "isSystem", "isSuperAdmin", "soldeCredit", "createdAt", "updatedAt")
     VALUES ($1, $2, 'x', 'PISCICULTEUR', true, false, false, 0, now(), now())`,
    [userId, `User SU.4 ${suffix}`]
  );
  await c.query(
    `INSERT INTO "Site" (id, name, "isActive", "supervised", "enabledModules", "ownerId", "createdAt", "updatedAt")
     VALUES ($1, $2, true, false, '{}', $3, now(), now())`,
    [siteId, `Site SU.4 ${suffix}`, userId]
  );
  await c.query(
    `INSERT INTO "Vague" (id, code, "dateDebut", "nombreInitial", "poidsMoyenInitial", statut, type, "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, now(), $3, 50, 'EN_COURS', 'GROSSISSEMENT', $4, now(), now())`,
    [vagueId, `SU4-VAG-${suffix}`, nombrePoissons, siteId]
  );
  await c.query(
    `INSERT INTO "Bac" (id, nom, "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, now(), now())`,
    [bacId, `Bac SU.4 ${suffix}`, siteId]
  );
  // AssignationBac active — nombreActuel == nombreInitial, cohérent (ecart=0
  // avant toute écriture de la transaction sous test).
  await c.query(
    `INSERT INTO "AssignationBac" (id, "bacId", "vagueId", "siteId", "dateAssignation", "nombrePoissonsInitial", "nombrePoissons", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, now(), $5, $5, now(), now())`,
    [assignationId, bacId, vagueId, siteId, nombrePoissons]
  );
  await c.query(
    `INSERT INTO "Client" (id, nom, "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, now(), now())`,
    [clientId, `Client SU.4 ${suffix}`, siteId]
  );
  await c.query(
    `INSERT INTO "Vente" (id, numero, "clientId", "vagueId", "quantitePoissons", "poidsTotalKg", "prixUnitaireKg", "montantTotal", statut, "origineType", "siteId", "userId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'EN_PREPARATION', 'GROSSISSEMENT', $9, $10, now(), now())`,
    [venteId, numeroVente, clientId, vagueId, nombrePoissons, poidsTotalKg, prixUnitaireKg, montantTotal, siteId, userId]
  );
  await c.query(
    `INSERT INTO "LigneVente" (id, "venteId", "vagueId", "bacId", "poidsTotalKg", "poidsMoyenG", "nombrePoissons", "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, 1000, $6, $7, now(), now())`,
    [ligneVenteId, venteId, vagueId, bacId, poidsTotalKg, nombrePoissons, siteId]
  );
  await c.query(
    `INSERT INTO "BonLivraison" (id, numero, "venteId", statut, "dateLivraison", "userId", "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'EN_ATTENTE_SIGNATURE', now(), $4, $5, now(), now())`,
    [bonLivraisonId, numeroBL, venteId, userId, siteId]
  );
  await c.query(
    `INSERT INTO "LigneBonLivraison" (id, "bonLivraisonId", "ligneVenteId", "poidsLivreKg", "nombreMortsTransport", "siteId", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())`,
    [ligneBonLivraisonId, bonLivraisonId, ligneVenteId, poidsTotalKg - nombreMortsTransport, nombreMortsTransport, siteId]
  );

  if (avecReleveVente) {
    await c.query(
      `INSERT INTO "Releve" (id, date, "typeReleve", "vagueId", "bacId", "siteId", "userId", "nombreVendus", "venteId", "createdAt", "updatedAt")
       VALUES ($1, now(), 'VENTE', $2, $3, $4, $5, $6, $7, now(), now())`,
      [`su4-test-releve-vente-${suffix}`, vagueId, bacId, siteId, userId, nombrePoissons, venteId]
    );
  }

  return {
    siteId,
    userId,
    vagueId,
    bacId,
    clientId,
    venteId,
    ligneVenteId,
    bonLivraisonId,
    ligneBonLivraisonId,
  };
}

/** Nettoyage explicite — pas de ROLLBACK possible ici (voir en-tête du fichier). */
async function cleanup(c: PoolClient, ids: SeedIds): Promise<void> {
  await c.query(`DELETE FROM "SiteAuditLog" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "EcartAssignationConstate" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "ReleveModification" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Releve" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "LigneBonLivraison" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "BonLivraison" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "LigneVente" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Vente" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Facture" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "AssignationBac" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Client" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Bac" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Vague" WHERE "siteId" = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "Site" WHERE id = $1`, [ids.siteId]);
  await c.query(`DELETE FROM "User" WHERE id = $1`, [ids.userId]);
}

describe.runIf(requireDatabaseUrl())(
  "SU.4 — robustesse transactionnelle de signerBonLivraison — comportement DB réel",
  () => {
    it(
      "échec en milieu de transaction (verifyAssignationInvariant rejette réellement) → AUCUN effet partiel",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[SU.4] DB de dev injoignable — test ignoré (dbAvailable=false).");
          return;
        }

        // avecReleveVente=false : anomalie de données délibérée. Le code de
        // signerBonLivraison ne compense la nouvelle mortalité (nombreMorts
        // sur le releve MORTALITE créé) par une baisse de nombreVendus QUE
        // s'il trouve un releve VENTE existant pour ce bac. Sans lui,
        // l'expected du guard diverge réellement de nombreActuel : un VRAI
        // rejet de verifyAssignationInvariant, pas un mock.
        const ids = await seedBonLivraisonPret(client, "atomicite", {
          nombrePoissons: 100,
          nombreMortsTransport: 5,
          avecReleveVente: false,
        });

        try {
          await expect(
            signerBonLivraison(ids.siteId, ids.userId, ids.bonLivraisonId, {
              signatureClient: DUMMY_SIGNATURE,
              signataireClientNom: "Client Test SU.4",
              signatureLivreur: DUMMY_SIGNATURE,
            })
          ).rejects.toThrow(/écart/);

          // --- Vérification qu'AUCUNE écriture de la transaction n'a persisté ---
          const { rows: lv } = await client.query(
            `SELECT "nombrePoissons", "poidsLivreKg" FROM "LigneVente" WHERE id = $1`,
            [ids.ligneVenteId]
          );
          expect(lv[0].nombrePoissons).toBe(100); // pas décrémenté à 95
          expect(lv[0].poidsLivreKg).toBeNull(); // jamais écrit

          const { rows: bl } = await client.query(
            `SELECT statut, "signeLe" FROM "BonLivraison" WHERE id = $1`,
            [ids.bonLivraisonId]
          );
          expect(bl[0].statut).toBe("EN_ATTENTE_SIGNATURE"); // pas passé à SIGNE
          expect(bl[0].signeLe).toBeNull();

          const { rows: lbl } = await client.query(
            `SELECT "nombrePoissonsLivres" FROM "LigneBonLivraison" WHERE id = $1`,
            [ids.ligneBonLivraisonId]
          );
          expect(lbl[0].nombrePoissonsLivres).toBeNull(); // snapshot jamais figé

          const { rows: vente } = await client.query(
            `SELECT statut, "montantTotal", "poidsLivreKg" FROM "Vente" WHERE id = $1`,
            [ids.venteId]
          );
          expect(vente[0].statut).toBe("EN_PREPARATION"); // jamais passée LIVREE
          expect(Number(vente[0].montantTotal)).toBe(100000); // inchangé
          expect(vente[0].poidsLivreKg).toBeNull();

          const { rows: releveMortalite } = await client.query(
            `SELECT count(*)::int AS n FROM "Releve" WHERE "venteId" = $1 AND "typeReleve" = 'MORTALITE'`,
            [ids.venteId]
          );
          expect(releveMortalite[0].n).toBe(0); // aucun releve MORTALITE cree

          const { rows: audit } = await client.query(
            `SELECT count(*)::int AS n FROM "SiteAuditLog" WHERE "siteId" = $1`,
            [ids.siteId]
          );
          expect(audit[0].n).toBe(0); // aucune trace d'audit persistee

          const { rows: assignation } = await client.query(
            `SELECT "nombrePoissons" FROM "AssignationBac" WHERE "bacId" = $1`,
            [ids.bacId]
          );
          expect(assignation[0].nombrePoissons).toBe(100); // jamais touche par ce flux
        } finally {
          await cleanup(client, ids);
        }
      },
      20000
    );

    it(
      "double signature concurrente du même BL → une seule gagne, aucun double décrément",
      async () => {
        if (!dbAvailable || !client) {
          console.warn("[SU.4] DB de dev injoignable — test ignoré (dbAvailable=false).");
          return;
        }

        // nombreMortsTransport=0 : isole la question de la concurrence de
        // celle du guard d'invariant (deja couverte par le test precedent).
        const ids = await seedBonLivraisonPret(client, "concurrence", {
          nombrePoissons: 50,
          nombreMortsTransport: 0,
          avecReleveVente: true,
        });

        try {
          const dto = {
            signatureClient: DUMMY_SIGNATURE,
            signataireClientNom: "Client Test SU.4 concurrence",
            signatureLivreur: DUMMY_SIGNATURE,
          };

          // Deux appels réels, lancés concurremment côté JS, contre le même
          // BonLivraison. NOTE (voir en-tête du fichier) : le pool Prisma
          // partagé (src/lib/db.ts) est `max: 1` — les deux transactions
          // Postgres sont donc sérialisées par la connexion unique, même si
          // les deux appels sont émis concurremment ici. Ce test prouve la
          // correction du garde applicatif (updateMany conditionnel, R4)
          // contre un vrai Postgres sous ordonnancement JS concurrent — pas
          // un scénario de vraie concurrence moteur (verrouillage de ligne
          // disputé entre deux connexions distinctes).
          const results = await Promise.allSettled([
            signerBonLivraison(ids.siteId, ids.userId, ids.bonLivraisonId, dto),
            signerBonLivraison(ids.siteId, ids.userId, ids.bonLivraisonId, dto),
          ]);

          const fulfilled = results.filter((r) => r.status === "fulfilled");
          const rejected = results.filter((r) => r.status === "rejected");
          expect(fulfilled).toHaveLength(1);
          expect(rejected).toHaveLength(1);
          expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(
            /deja signe|déjà été rectifié/
          );

          // --- Vérification qu'un seul décrément a été applique ---
          const { rows: vente } = await client.query(
            `SELECT statut, "quantitePoissons", "poidsTotalKg", "montantTotal" FROM "Vente" WHERE id = $1`,
            [ids.venteId]
          );
          expect(vente[0].statut).toBe("LIVREE");
          expect(vente[0].quantitePoissons).toBe(50); // pas 0, pas de double-decrement
          expect(Number(vente[0].poidsTotalKg)).toBe(50);
          expect(Number(vente[0].montantTotal)).toBe(50000); // 50kg * 1000, une seule fois

          const { rows: bl } = await client.query(
            `SELECT statut FROM "BonLivraison" WHERE id = $1`,
            [ids.bonLivraisonId]
          );
          expect(bl[0].statut).toBe("SIGNE");

          const { rows: auditCount } = await client.query(
            `SELECT count(*)::int AS n FROM "SiteAuditLog" WHERE "siteId" = $1 AND action = 'VENTE_CLOTUREE'`,
            [ids.siteId]
          );
          expect(auditCount[0].n).toBe(1); // pas deux entrees d'audit pour deux signatures
        } finally {
          await cleanup(client, ids);
        }
      },
      20000
    );
  }
);

// ---------------------------------------------------------------------------
// Point de vigilance SU.2 — une erreur d'écriture du journal d'écart ne doit
// JAMAIS faire échouer l'opération métier appelante (persisterEcartConstate
// avale l'erreur en interne, cf. try/catch dans assignation-invariant.ts).
// Test unitaire (mock du tx) : on teste ici le comportement PROPRE de la
// fonction (son try/catch), pas le moteur Postgres — mock légitime, distinct
// de ERR-103 (on ne mocke pas "le moteur qu'on est censé tester", on mocke
// une dépendance injectée pour isoler un comportement de résilience).
// ---------------------------------------------------------------------------
describe("SU.2 — persisterEcartConstate n'echoue jamais l'operation appelante", () => {
  it("avale une erreur d'ecriture EcartAssignationConstate.upsert sans la propager", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fakeTx = {
      ecartAssignationConstate: {
        upsert: async () => {
          throw new Error("simulated DB write failure");
        },
        findUnique: async () => null,
        update: async () => {
          throw new Error("should not be called for ecart !== 0");
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    await expect(
      persisterEcartConstate(fakeTx, "site-x", "vague-x", "bac-x", 3, {
        userId: "user-x",
        contexte: ContexteDetectionEcart.BON_LIVRAISON,
      })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
