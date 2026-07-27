/**
 * Tests story BD.0 — Un COMPTAGE correctif doit marquer la dérive résolue.
 *
 * Contexte (docs/analysis/pre-analysis-sprint-BD.md, docs/TASKS.md section BD.0) :
 * `verifyAssignationInvariant` n'a que 6 call sites (arrivage, transfert x2,
 * calibrage, vente, vente d'alevins, bon de livraison) — COMPTAGE n'en fait
 * PAS partie. `createReleve` (src/lib/queries/releves.ts) ne recalculait donc
 * jamais l'écart de conservation pour un relevé COMPTAGE, ce qui signifiait
 * qu'un comptage correctif ne faisait jamais passer `resoluLe` à une date : il
 * fallait attendre qu'une autre opération guardée touche le même bac.
 *
 * Contrainte NON NÉGOCIABLE (spec utilisateur) : un relevé COMPTAGE ne doit
 * JAMAIS échouer à cause de cet ajout :
 *  - le garde bloquant `verifyAssignationInvariant` n'est PAS invoqué depuis
 *    `createReleve` — seuls `calculerEcartsParBac` (lecture) et
 *    `persisterEcartConstate` (best-effort, n'échoue jamais lui-même) le sont ;
 *  - un COMPTAGE qui aggrave l'écart doit être accepté quand même (dérive
 *    enregistrée, aucune exception) ;
 *  - un échec de la persistance de l'écart ne doit jamais faire échouer la
 *    création du relevé.
 *
 * Fichier fusionné (correction BD.0 v2, verdict FAIL du tester) : ce fichier
 * remplace `bd0-comptage-recalcule-ecart.test.ts` (db-specialist, 7 cas) ET
 * `comptage-ecart-resolution.test.ts` (tester, 4 cas indépendants écrits en
 * parallèle par collision de process) — union des cas, aucun perdu. Le
 * second fichier est supprimé.
 *
 * Cas couverts (mock complet — voir aussi le test d'intégration réel,
 * non mocké, dans src/lib/queries/__tests__/bd0-savepoint-integration.test.ts) :
 *  (a) COMPTAGE qui ramène l'écart à zéro → EcartAssignationConstate.resoluLe renseigné
 *  (b) COMPTAGE qui aggrave l'écart → relevé créé quand même, pas d'exception, dérive enregistrée
 *  (c) échec de persisterEcartConstate (mock qui throw un rejet JS) → création du relevé réussit malgré tout
 *  (d) COMPTAGE sur un bac sain (aucune dérive avant/après) → aucune ligne parasite
 *  (e) symétrie : MORTALITE (qui décrémente déjà nombreActuel sans passer par
 *      un call site guardé) recalcule et persiste l'écart de la même façon,
 *      dans les deux sens (résolution ET aggravation, sans jamais throw)
 *
 * IMPORTANT (correction BD.0 v2) : `createReleve` encadre désormais le bloc
 * de recalcul/persistance d'un SAVEPOINT Postgres (`tx.$executeRawUnsafe`),
 * pas seulement d'un try/catch JS (voir src/lib/queries/releves.ts). Le mock
 * `tx` ci-dessous fournit donc des doublures `$executeRawUnsafe`/
 * `$queryRawUnsafe` qui résolvent normalement dans les scénarios "heureux" —
 * seul le test d'intégration réel prouve le comportement de désavortement
 * effectif contre une vraie erreur SQL (un mock JS ne peut structurellement
 * pas le prouver, cf. ERR-103).
 *
 * Stratégie : mock complet de Prisma ($transaction), pattern réutilisé de
 * src/lib/queries/__tests__/cloture-vente-avarie.test.ts et
 * src/__tests__/ecart-assignation-constate.test.ts. `calculerEcartsParBac`
 * (code réel, pas mocké) relit `tx.releve.findMany` : chaque scénario fournit
 * donc la liste des relevés cohérente avec le relevé COMPTAGE/MORTALITE qu'on
 * vient de "créer" (read-your-own-writes simulé manuellement, puisque le mock
 * de tx.releve.create n'alimente pas automatiquement tx.releve.findMany).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createReleve } from "@/lib/queries/releves";
import { TypeReleve, StatutVague, MethodeComptage, CauseMortalite } from "@/types";
import type { CreateReleveDTO } from "@/types";

// ---------------------------------------------------------------------------
// Mocks Prisma
// ---------------------------------------------------------------------------

const mockBacFindFirst = vi.fn();
const mockAssignationBacFindFirst = vi.fn();
const mockAssignationBacFindMany = vi.fn();
const mockAssignationBacUpdate = vi.fn();
const mockVagueFindFirst = vi.fn();
const mockReleveCreate = vi.fn();
const mockReleveFindMany = vi.fn();
const mockTransfertGroupeFindMany = vi.fn();
const mockActiviteFindFirst = vi.fn();
const mockEcartUpsert = vi.fn();
const mockEcartFindUnique = vi.fn();
const mockEcartUpdate = vi.fn();
const mockExecuteRawUnsafe = vi.fn();
const mockQueryRawUnsafe = vi.fn();

function buildTx() {
  return {
    lotAlevins: { findFirst: vi.fn() },
    bac: { findFirst: (...args: unknown[]) => mockBacFindFirst(...args) },
    assignationBac: {
      findFirst: (...args: unknown[]) => mockAssignationBacFindFirst(...args),
      findMany: (...args: unknown[]) => mockAssignationBacFindMany(...args),
      update: (...args: unknown[]) => mockAssignationBacUpdate(...args),
    },
    vague: { findFirst: (...args: unknown[]) => mockVagueFindFirst(...args) },
    releve: {
      create: (...args: unknown[]) => mockReleveCreate(...args),
      findMany: (...args: unknown[]) => mockReleveFindMany(...args),
    },
    transfertGroupe: {
      findMany: (...args: unknown[]) => mockTransfertGroupeFindMany(...args),
    },
    activite: {
      findFirst: (...args: unknown[]) => mockActiviteFindFirst(...args),
      update: vi.fn(),
    },
    ecartAssignationConstate: {
      upsert: (...args: unknown[]) => mockEcartUpsert(...args),
      findUnique: (...args: unknown[]) => mockEcartFindUnique(...args),
      update: (...args: unknown[]) => mockEcartUpdate(...args),
    },
    // Correction BD.0 v2 — le bloc MORTALITE/COMPTAGE de createReleve encadre
    // désormais calculerEcartsParBac + persisterEcartConstate d'un SAVEPOINT
    // Postgres (au lieu d'un simple try/catch JS), avec une requête sonde
    // (canary) juste après. Ces mocks résolvent normalement ici : ce fichier
    // teste le comportement fonctionnel (a-e), pas le désavortement réel
    // d'une transaction Postgres — voir bd0-savepoint-integration.test.ts.
    $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
  };
}

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(buildTx()),
  },
}));

const SITE_ID = "site-bd0";
const USER_ID = "user-bd0";
const VAGUE_ID = "vague-bd0";
const BAC_ID = "bac-bd0";

const DATE_DEBUT_VAGUE = new Date("2026-01-01");
const RELEVE_DATE = "2026-07-27T10:00:00.000Z";

function makeComptageDTO(nombreCompte: number): CreateReleveDTO {
  return {
    typeReleve: TypeReleve.COMPTAGE,
    vagueId: VAGUE_ID,
    bacId: BAC_ID,
    date: RELEVE_DATE,
    nombreCompte,
    methodeComptage: MethodeComptage.DIRECT,
  } as CreateReleveDTO;
}

function makeMortaliteDTO(nombreMorts: number): CreateReleveDTO {
  return {
    typeReleve: TypeReleve.MORTALITE,
    vagueId: VAGUE_ID,
    bacId: BAC_ID,
    date: RELEVE_DATE,
    nombreMorts,
    causeMortalite: CauseMortalite.INCONNUE,
  } as CreateReleveDTO;
}

/**
 * Le relevé COMPTAGE tel qu'il serait relu par calculerEcartsParBac dans la
 * même transaction (read-your-own-writes simulé — voir le commentaire
 * d'en-tête du fichier).
 */
function comptageReleveRow(nombreCompte: number) {
  return {
    bacId: BAC_ID,
    typeReleve: TypeReleve.COMPTAGE,
    date: new Date(RELEVE_DATE),
    nombreMorts: null,
    nombreCompte,
    nombreTransferes: null,
    nombreVendus: null,
    transfertGroupeId: null,
  };
}

/** Le relevé MORTALITE tel qu'il serait relu par calculerEcartsParBac dans la même tx. */
function mortaliteReleveRow(nombreMorts: number) {
  return {
    bacId: BAC_ID,
    typeReleve: TypeReleve.MORTALITE,
    date: new Date(RELEVE_DATE),
    nombreMorts,
    nombreCompte: null,
    nombreTransferes: null,
    nombreVendus: null,
    transfertGroupeId: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // Doublure standard nécessaire pour franchir les validations de createReleve.
  mockBacFindFirst.mockResolvedValue({ id: BAC_ID, siteId: SITE_ID });
  mockAssignationBacFindFirst.mockResolvedValue({
    id: "ab-1",
    bacId: BAC_ID,
    vagueId: VAGUE_ID,
    dateFin: null,
  });
  mockVagueFindFirst.mockResolvedValue({
    id: VAGUE_ID,
    siteId: SITE_ID,
    statut: StatutVague.EN_COURS,
    dateDebut: DATE_DEBUT_VAGUE,
    uniteProductionId: null,
  });
  mockReleveCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "releve-1",
    ...data,
  }));
  // Aucune activité planifiée compatible → pas de liaison Planning (hors
  // périmètre de ce sprint, ne doit pas interférer avec les assertions BD.0).
  mockActiviteFindFirst.mockResolvedValue(null);

  // Défauts guard : pas d'écart, pas de relevés annexes.
  mockAssignationBacFindMany.mockResolvedValue([]);
  mockReleveFindMany.mockResolvedValue([]);
  mockTransfertGroupeFindMany.mockResolvedValue([]);
  mockEcartFindUnique.mockResolvedValue(null);
  // Implémentations par défaut "heureuses" — réaffectées à chaque test pour
  // ne jamais laisser une implémentation (ex. mockRejectedValue du test (c))
  // fuiter vers le test suivant : vi.clearAllMocks() ne réinitialise que les
  // historiques d'appel, pas l'implémentation (mockReset() le ferait, mais
  // casserait aussi mockReleveCreate ci-dessus).
  mockEcartUpsert.mockResolvedValue(undefined);
  mockEcartUpdate.mockResolvedValue(undefined);
  mockAssignationBacUpdate.mockResolvedValue(undefined);
  mockExecuteRawUnsafe.mockResolvedValue(undefined);
  mockQueryRawUnsafe.mockResolvedValue([{ "?column?": 1 }]);
});

describe("BD.0 — COMPTAGE recalcule et persiste l'écart de conservation, sans jamais échouer", () => {
  it("(a) un COMPTAGE qui ramène l'écart à zéro marque l'EcartAssignationConstate du bac résolu", async () => {
    // AssignationBac actuelle : nombreActuel = 998 (dérive préexistante).
    // Le COMPTAGE confirme exactement 998 poissons réels → nouvel écart = 998 - 998 = 0.
    mockAssignationBacFindMany.mockResolvedValue([
      {
        id: "ab-1",
        bacId: BAC_ID,
        nombreActuel: 998,
        nombreInitial: 1000,
        dateAssignation: DATE_DEBUT_VAGUE,
        bac: { nom: "Bac Test" },
      },
    ]);
    // calculerEcartsParBac relit ce COMPTAGE (read-your-own-writes simulé) :
    // il devient la nouvelle base de rejeu → expected = 998.
    mockReleveFindMany.mockResolvedValue([comptageReleveRow(998)]);
    // Une dérive était déjà active pour ce bac avant ce COMPTAGE.
    mockEcartFindUnique.mockResolvedValue({ id: "ecart-1", resoluLe: null });

    const releve = await createReleve(SITE_ID, USER_ID, makeComptageDTO(998));

    expect(releve).toBeDefined();
    expect(mockEcartUpdate).toHaveBeenCalledTimes(1);
    const call = mockEcartUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ bacId: BAC_ID });
    expect(call.data.ecart).toBe(0);
    expect(call.data.resoluLe).toBeInstanceOf(Date);
    // Pas d'upsert dans ce cas (résolution d'une dérive existante, pas nouvelle dérive).
    expect(mockEcartUpsert).not.toHaveBeenCalled();
  });

  it("(b) un COMPTAGE qui AGGRAVE l'écart est accepté SANS exception et la dérive est enregistrée", async () => {
    // nombreActuel = 990, mais le COMPTAGE annonce 950 (poissons réellement
    // comptés) → nouvel écart = 990 - 950 = 40 (dérive constatée/aggravée).
    mockAssignationBacFindMany.mockResolvedValue([
      {
        id: "ab-1",
        bacId: BAC_ID,
        nombreActuel: 990,
        nombreInitial: 1000,
        dateAssignation: DATE_DEBUT_VAGUE,
        bac: { nom: "Bac Test" },
      },
    ]);
    mockReleveFindMany.mockResolvedValue([comptageReleveRow(950)]);

    // Contrainte non-négociable : jamais de throw, quelle que soit l'ampleur
    // de l'écart. Le garde bloquant verifyAssignationInvariant n'est JAMAIS
    // invoqué par createReleve — seul le recalcul + la persistance
    // (best-effort) le sont.
    await expect(createReleve(SITE_ID, USER_ID, makeComptageDTO(950))).resolves.toBeDefined();

    expect(mockEcartUpsert).toHaveBeenCalledTimes(1);
    const call = mockEcartUpsert.mock.calls[0][0];
    expect(call.where).toEqual({ bacId: BAC_ID });
    expect(call.create.ecart).toBe(40);
    expect(call.update.ecart).toBe(40);
  });

  it("(c) un échec JS de persisterEcartConstate (upsert qui throw) n'empêche jamais la création du relevé COMPTAGE", async () => {
    mockAssignationBacFindMany.mockResolvedValue([
      {
        id: "ab-1",
        bacId: BAC_ID,
        nombreActuel: 990,
        nombreInitial: 1000,
        dateAssignation: DATE_DEBUT_VAGUE,
        bac: { nom: "Bac Test" },
      },
    ]);
    mockReleveFindMany.mockResolvedValue([comptageReleveRow(950)]);
    // Simule un échec réel d'écriture de la table EcartAssignationConstate.
    mockEcartUpsert.mockRejectedValue(new Error("DB down: EcartAssignationConstate"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createReleve(SITE_ID, USER_ID, makeComptageDTO(950))).resolves.toBeDefined();
    // L'échec est bien journalisé (best-effort de traçabilité, ADR-048 section 6),
    // mais n'a jamais été propagé à l'appelant. Ici l'échec est avalé par le
    // propre try/catch interne de `persisterEcartConstate` (ADR-048 section 6)
    // AVANT d'atteindre le try/catch de createReleve : aucune exception ne
    // remonte à ce niveau, donc pas de ROLLBACK TO SAVEPOINT ici (un mock JS
    // ne poisonne pas réellement de transaction Postgres — voir le test
    // d'intégration réel, bd0-savepoint-integration.test.ts, pour la preuve
    // du désavortement effectif contre une VRAIE erreur SQL).
    expect(errorSpy).toHaveBeenCalled();
    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith("SAVEPOINT ecart_constate_sp");

    errorSpy.mockRestore();
  });

  it("(d) un COMPTAGE sur un bac sain (aucune dérive avant/après) ne crée aucune ligne EcartAssignationConstate parasite", async () => {
    // Le COMPTAGE confirme exactement la valeur attendue (nombreActuel === expected) : écart = 0.
    mockAssignationBacFindMany.mockResolvedValue([
      {
        id: "ab-1",
        bacId: BAC_ID,
        nombreActuel: 1000,
        nombreInitial: 1000,
        dateAssignation: DATE_DEBUT_VAGUE,
        bac: { nom: "Bac Test" },
      },
    ]);
    mockReleveFindMany.mockResolvedValue([comptageReleveRow(1000)]);
    // Aucune ligne EcartAssignationConstate existante pour ce bac (jamais dérivé).
    mockEcartFindUnique.mockResolvedValue(null);

    await expect(createReleve(SITE_ID, USER_ID, makeComptageDTO(1000))).resolves.toBeDefined();

    expect(mockEcartUpsert).not.toHaveBeenCalled();
    expect(mockEcartUpdate).not.toHaveBeenCalled();
  });
});

describe("BD.0 — symétrie : MORTALITE recalcule et persiste l'écart de la même façon que COMPTAGE", () => {
  it("un MORTALITE qui reste conforme (aucune dérive avant/après) ne crée aucune ligne parasite", async () => {
    // Après décrément (100 -> 90 poissons), calculerEcartsParBac relit
    // l'assignation déjà décrémentée (simulée) et le MORTALITE qu'on vient
    // de créer. expected = nombreInitial(100) - nombreMorts(10) = 90 = actual → ecart 0.
    mockAssignationBacFindMany.mockResolvedValue([
      {
        id: "ab-1",
        bacId: BAC_ID,
        nombreActuel: 90,
        nombreInitial: 100,
        dateAssignation: DATE_DEBUT_VAGUE,
        bac: { nom: "Bac Test" },
      },
    ]);
    mockReleveFindMany.mockResolvedValue([mortaliteReleveRow(10)]);

    const releve = await createReleve(SITE_ID, USER_ID, makeMortaliteDTO(10));
    expect(releve).toBeDefined();

    // Non-régression : AssignationBac.nombreActuel toujours décrémenté comme avant BD.0.
    expect(mockAssignationBacUpdate).toHaveBeenCalledTimes(1);
    expect(mockAssignationBacUpdate.mock.calls[0][0]).toMatchObject({
      where: { id: "ab-1" },
      data: { nombreActuel: { decrement: 10 } },
    });

    // Ecart nul, aucune dérive préexistante : aucun bruit (pas d'upsert/update).
    expect(mockEcartUpsert).not.toHaveBeenCalled();
    expect(mockEcartUpdate).not.toHaveBeenCalled();
  });

  it("un MORTALITE qui révèle un écart préexistant est enregistré (dérive), pas bloqué", async () => {
    // expected = 100 - 10 = 90, mais actual (nombreActuel déjà décrémenté) = 85
    // → dérive de 5 poissons révélée par cette mortalité. createReleve
    // n'invoque jamais le garde bloquant : le relevé est créé et la dérive
    // est simplement enregistrée.
    mockAssignationBacFindMany.mockResolvedValue([
      {
        id: "ab-1",
        bacId: BAC_ID,
        nombreActuel: 85,
        nombreInitial: 100,
        dateAssignation: DATE_DEBUT_VAGUE,
        bac: { nom: "Bac Test" },
      },
    ]);
    mockReleveFindMany.mockResolvedValue([mortaliteReleveRow(10)]);

    await expect(createReleve(SITE_ID, USER_ID, makeMortaliteDTO(10))).resolves.toBeDefined();

    expect(mockEcartUpsert).toHaveBeenCalledTimes(1);
    const call = mockEcartUpsert.mock.calls[0][0];
    expect(call.create.ecart).toBe(-5);
  });

  it("un MORTALITE qui résout une dérive préexistante marque l'EcartAssignationConstate résolu", async () => {
    // Une dérive de +3 était constatée avant cette mortalité. Après décrément
    // (le MORTALITE fait disparaître exactement cet excédent), le nouvel
    // écart calculé retombe à 0 → résolution.
    mockAssignationBacFindMany.mockResolvedValue([
      {
        id: "ab-1",
        bacId: BAC_ID,
        nombreActuel: 90,
        nombreInitial: 100,
        dateAssignation: DATE_DEBUT_VAGUE,
        bac: { nom: "Bac Test" },
      },
    ]);
    mockReleveFindMany.mockResolvedValue([mortaliteReleveRow(10)]);
    mockEcartFindUnique.mockResolvedValue({ id: "ecart-2", resoluLe: null });

    await expect(createReleve(SITE_ID, USER_ID, makeMortaliteDTO(10))).resolves.toBeDefined();

    expect(mockEcartUpdate).toHaveBeenCalledTimes(1);
    const call = mockEcartUpdate.mock.calls[0][0];
    expect(call.data.ecart).toBe(0);
    expect(call.data.resoluLe).toBeInstanceOf(Date);
  });
});

describe("BD.0 — isolation SAVEPOINT (mock JS, complément du test d'intégration réel)", () => {
  it("pose un SAVEPOINT avant le bloc et ne le rollback jamais si tout réussit", async () => {
    mockAssignationBacFindMany.mockResolvedValue([
      {
        id: "ab-1",
        bacId: BAC_ID,
        nombreActuel: 1000,
        nombreInitial: 1000,
        dateAssignation: DATE_DEBUT_VAGUE,
        bac: { nom: "Bac Test" },
      },
    ]);
    mockReleveFindMany.mockResolvedValue([comptageReleveRow(1000)]);

    await createReleve(SITE_ID, USER_ID, makeComptageDTO(1000));

    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith("SAVEPOINT ecart_constate_sp");
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalledWith(expect.stringContaining("ROLLBACK TO SAVEPOINT"));
    // Canary appelé (SELECT 1) dans le chemin heureux.
    expect(mockQueryRawUnsafe).toHaveBeenCalledWith("SELECT 1");
  });

  it("ne pose aucun SAVEPOINT pour un type de relevé non concerné (ex. BIOMETRIE)", async () => {
    const dto = {
      typeReleve: TypeReleve.BIOMETRIE,
      vagueId: VAGUE_ID,
      bacId: BAC_ID,
      date: RELEVE_DATE,
      poidsMoyen: 250,
      tailleMoyenne: 20,
      echantillonCount: 30,
    } as CreateReleveDTO;

    await createReleve(SITE_ID, USER_ID, dto);

    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });
});
