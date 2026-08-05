/**
 * Tests unitaires — story PR2.1, `src/lib/queries/previsions-charges.ts`.
 *
 * Couvre R8 (isolation par site) sur les 4 familles (PostePrevision,
 * ChargeMensuellePrevue, JournalDepensePrevue, ApportCapital), ainsi que le
 * comportement d'`upsertChargeMensuelle` (create la premiere fois, update
 * ensuite, cle @@unique([posteId, moisAbsolu])) et le filtre
 * `vaguePrevueId: null` explicite vs `undefined` non filtrant du journal.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { CategorieJournalPrevu, TypeApportCapital, TypePostePrevision } from "@/types";
import { createEmptyStores, buildFakePrisma, type Stores } from "./previsions-fake-db";

const stores: Stores = createEmptyStores();

vi.mock("@/lib/db", () => ({
  prisma: buildFakePrisma(stores),
}));

beforeEach(() => {
  Object.assign(stores, createEmptyStores());
});

function seedScenario(id: string, siteId: string) {
  stores.scenarioPrevision.push({ id, code: `C-${id}`, nom: "S", siteId });
}

function seedPoste(id: string, scenarioId: string, siteId: string, ordre = 0) {
  stores.postePrevision.push({
    id,
    scenarioId,
    libelle: `Poste ${id}`,
    type: TypePostePrevision.CHARGE_EXPLOITATION,
    inclusBaseRepartition: true,
    ordre,
    siteId,
  });
}

describe("PostePrevision — R8 isolation par site", () => {
  it("getPostesPrevisionParScenario ne renvoie rien pour le mauvais site", async () => {
    const { getPostesPrevisionParScenario } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedPoste("p1", "s1", "site-A");

    expect(await getPostesPrevisionParScenario("s1", "site-B")).toHaveLength(0);
  });

  it("createPostePrevision rejette si le scenario est d'un autre site, aucun poste cree", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");

    await expect(
      createPostePrevision("s1", "site-B", {
        libelle: "Electricite",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        nouveauPosteReferentielLibelle: "Electricite",
      })
    ).rejects.toThrow("Scenario introuvable");

    expect(stores.postePrevision).toHaveLength(0);
  });

  it("createPostePrevision cree le poste pour le bon site", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");

    const { poste, reutilise } = await createPostePrevision("s1", "site-A", {
      libelle: "Electricite",
      type: TypePostePrevision.CHARGE_EXPLOITATION,
      ordre: 0,
      nouveauPosteReferentielLibelle: "Electricite",
    });
    expect(poste.siteId).toBe("site-A");
    expect(poste.inclusBaseRepartition).toBe(true); // default
    expect(reutilise).toBe(false); // branche (b) : creation, pas reutilisation
  });
});

describe("PostePrevision — contrat XOR ACTIVE (ADR-053 §16.6/§16.12, story A.5)", () => {
  it("400 POSTE_REFERENTIEL_CHAMP_REQUIS si aucun des deux champs XOR n'est fourni", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    seedScenario("A", "site-A");

    await expect(
      createPostePrevision("A", "site-A", {
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
      })
    ).rejects.toMatchObject({ status: 400, code: "POSTE_REFERENTIEL_CHAMP_REQUIS" });
    expect(stores.postePrevision).toHaveLength(0);
  });

  it("400 POSTE_REFERENTIEL_CHAMPS_EXCLUSIFS si les deux champs XOR sont fournis", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    seedScenario("A", "site-A");
    stores.posteReferentiel.push({
      id: "ref-1",
      siteId: "site-A",
      code: "salaires",
      libelle: "Salaires",
      actif: true,
    });

    await expect(
      createPostePrevision("A", "site-A", {
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        posteReferentielId: "ref-1",
        nouveauPosteReferentielLibelle: "Autre libelle",
      })
    ).rejects.toMatchObject({ status: 400, code: "POSTE_REFERENTIEL_CHAMPS_EXCLUSIFS" });
    expect(stores.postePrevision).toHaveLength(0);
  });

  it("branche (a) : posteReferentielId d'une entree active du site rattache le poste sans creer de nouvelle entree, reutilise=true", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    seedScenario("A", "site-A");
    seedScenario("B", "site-A");
    stores.posteReferentiel.push({
      id: "ref-salaires",
      siteId: "site-A",
      code: "salaires",
      libelle: "Salaires",
      actif: true,
    });

    const { poste: posteB, reutilise } = await createPostePrevision("B", "site-A", {
      libelle: "Salaires (scenario B)",
      type: TypePostePrevision.CHARGE_EXPLOITATION,
      ordre: 0,
      posteReferentielId: "ref-salaires",
    });

    expect(posteB.posteReferentielId).toBe("ref-salaires");
    expect(reutilise).toBe(true);
    expect(stores.posteReferentiel).toHaveLength(1); // aucune nouvelle entree creee
  });

  it("branche (a) : 404 POSTE_REFERENTIEL_INTROUVABLE si posteReferentielId est absent ou d'un autre site (jamais 403)", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    seedScenario("A", "site-A");
    stores.posteReferentiel.push({
      id: "ref-autre-site",
      siteId: "site-B",
      code: "salaires",
      libelle: "Salaires",
      actif: true,
    });

    await expect(
      createPostePrevision("A", "site-A", {
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        posteReferentielId: "ref-autre-site",
      })
    ).rejects.toMatchObject({ status: 404, code: "POSTE_REFERENTIEL_INTROUVABLE" });
    expect(stores.postePrevision).toHaveLength(0);

    await expect(
      createPostePrevision("A", "site-A", {
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        posteReferentielId: "ref-inexistant",
      })
    ).rejects.toMatchObject({ status: 404, code: "POSTE_REFERENTIEL_INTROUVABLE" });
  });

  it("branche (a) : 409 POSTE_REFERENTIEL_INACTIF si posteReferentielId pointe une entree desactivee", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    seedScenario("A", "site-A");
    stores.posteReferentiel.push({
      id: "ref-inactif",
      siteId: "site-A",
      code: "salaires",
      libelle: "Salaires",
      actif: false,
    });

    await expect(
      createPostePrevision("A", "site-A", {
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        posteReferentielId: "ref-inactif",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "POSTE_REFERENTIEL_INACTIF",
      details: { posteReferentielExistant: { id: "ref-inactif", libelle: "Salaires" } },
    });
    expect(stores.postePrevision).toHaveLength(0);
  });

  it("branche (b) : cree une nouvelle entree PosteReferentiel dans la meme transaction quand aucune n'existe pour ce slug", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    seedScenario("A", "site-A");

    const { poste, reutilise } = await createPostePrevision("A", "site-A", {
      libelle: "Énergie et Carburant",
      type: TypePostePrevision.CHARGE_EXPLOITATION,
      ordre: 0,
      nouveauPosteReferentielLibelle: "Énergie et Carburant",
    });

    expect(stores.posteReferentiel).toHaveLength(1);
    expect(stores.posteReferentiel[0].code).toBe("energie-et-carburant");
    expect(stores.posteReferentiel[0].libelle).toBe("Énergie et Carburant");
    expect(poste.posteReferentielId).toBe(stores.posteReferentiel[0].id);
    expect(reutilise).toBe(false);
  });

  it("branche (b) : 409 POSTE_REFERENTIEL_CODE_COLLISION si le slug matche une entree ACTIVE — AUCUN suffixe numerique auto-genere, AUCUNE reutilisation silencieuse", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    seedScenario("A", "site-A");
    stores.posteReferentiel.push({
      id: "ref-actif",
      siteId: "site-A",
      code: "salaires",
      libelle: "Salaires",
      actif: true,
    });

    await expect(
      createPostePrevision("A", "site-A", {
        libelle: "Salaires (bis)",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        nouveauPosteReferentielLibelle: "Salaires",
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "POSTE_REFERENTIEL_CODE_COLLISION",
      details: { posteReferentielExistant: { id: "ref-actif", libelle: "Salaires" } },
    });

    expect(stores.postePrevision).toHaveLength(0);
    // Toujours une seule entree "salaires" — jamais "salaires-2" ni doublon.
    expect(stores.posteReferentiel).toHaveLength(1);
    expect(stores.posteReferentiel.filter((r) => r.code.startsWith("salaires")).map((r) => r.code)).toEqual([
      "salaires",
    ]);
  });

  it("branche (b) : refuse (409 BusinessRuleError POSTE_REFERENTIEL_INACTIF) si le slug matche une entree PosteReferentiel DESACTIVEE du site", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    seedScenario("A", "site-A");
    stores.posteReferentiel.push({
      id: "ref-inactif",
      siteId: "site-A",
      code: "salaires",
      libelle: "Salaires",
      actif: false,
    });

    await expect(
      createPostePrevision("A", "site-A", {
        libelle: "Salaires",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 0,
        nouveauPosteReferentielLibelle: "Salaires",
      })
    ).rejects.toMatchObject({ status: 409, code: "POSTE_REFERENTIEL_INACTIF" });

    expect(stores.postePrevision).toHaveLength(0);
    expect(stores.posteReferentiel).toHaveLength(1); // aucune reactivation, aucun doublon
  });

  it("branche (b) : les entrees PosteReferentiel actives d'un site different ne sont jamais reutilisees (R8) — meme libelle, deux entrees distinctes", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    seedScenario("A", "site-A");
    seedScenario("B", "site-B");

    const { poste: posteA } = await createPostePrevision("A", "site-A", {
      libelle: "Salaires",
      type: TypePostePrevision.CHARGE_EXPLOITATION,
      ordre: 0,
      nouveauPosteReferentielLibelle: "Salaires",
    });
    const { poste: posteB } = await createPostePrevision("B", "site-B", {
      libelle: "Salaires",
      type: TypePostePrevision.CHARGE_EXPLOITATION,
      ordre: 0,
      nouveauPosteReferentielLibelle: "Salaires",
    });

    expect(posteA.posteReferentielId).not.toBe(posteB.posteReferentielId);
    expect(stores.posteReferentiel).toHaveLength(2);
  });

  it("createPostePrevision rejette un ordre fractionnaire AVANT tout acces DB (garde assertEntierColonneInt)", async () => {
    const { createPostePrevision } = await import("@/lib/queries/previsions-charges");
    // Aucun scenario seede : si la garde n'etait pas verifiee en premier,
    // l'erreur serait "Scenario introuvable" au lieu du message de la garde.
    await expect(
      createPostePrevision("s1", "site-A", {
        libelle: "Electricite",
        type: TypePostePrevision.CHARGE_EXPLOITATION,
        ordre: 1.5,
        nouveauPosteReferentielLibelle: "Electricite",
      })
    ).rejects.toThrow("ordre doit etre un entier");

    expect(stores.postePrevision).toHaveLength(0);
  });
});

describe("ChargeMensuellePrevue — upsert + R8 isolation", () => {
  it("upsertChargeMensuelle cree la ligne la premiere fois", async () => {
    const { upsertChargeMensuelle } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedPoste("p1", "s1", "site-A");

    const result = await upsertChargeMensuelle("p1", "site-A", 0, 50000);
    expect(result.montantFCFA).toBe(50000);
    expect(stores.chargeMensuellePrevue.filter((c) => c.posteId === "p1")).toHaveLength(1);
  });

  it("upsertChargeMensuelle met a jour le meme mois au lieu de dupliquer (@@unique posteId+moisAbsolu)", async () => {
    const { upsertChargeMensuelle } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedPoste("p1", "s1", "site-A");

    await upsertChargeMensuelle("p1", "site-A", 0, 50000);
    const second = await upsertChargeMensuelle("p1", "site-A", 0, 75000);

    expect(second.montantFCFA).toBe(75000);
    expect(stores.chargeMensuellePrevue.filter((c) => c.posteId === "p1")).toHaveLength(1);
  });

  it("R8 — rejette si le poste est d'un autre site, aucune charge creee", async () => {
    const { upsertChargeMensuelle } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedPoste("p1", "s1", "site-A");

    await expect(upsertChargeMensuelle("p1", "site-B", 0, 50000)).rejects.toThrow(
      "PostePrevision introuvable"
    );
    expect(stores.chargeMensuellePrevue).toHaveLength(0);
  });

  it("upsertChargeMensuelle rejette un moisAbsolu fractionnaire AVANT tout acces DB (garde assertEntierColonneInt) — evite la collision @@unique par troncature silencieuse", async () => {
    const { upsertChargeMensuelle } = await import("@/lib/queries/previsions-charges");
    // Aucun poste seede : si la garde n'etait pas verifiee en premier,
    // l'erreur serait "PostePrevision introuvable" au lieu du message de la garde.
    await expect(upsertChargeMensuelle("p1", "site-A", 2.5, 50000)).rejects.toThrow(
      "moisAbsolu doit etre un entier"
    );

    expect(stores.chargeMensuellePrevue).toHaveLength(0);
  });

  it("getChargesMensuellesParScenario filtre par site puis par mois si fourni", async () => {
    const { upsertChargeMensuelle, getChargesMensuellesParScenario } = await import(
      "@/lib/queries/previsions-charges"
    );
    seedScenario("s1", "site-A");
    seedPoste("p1", "s1", "site-A");
    await upsertChargeMensuelle("p1", "site-A", 0, 10000);
    await upsertChargeMensuelle("p1", "site-A", 1, 20000);

    expect(await getChargesMensuellesParScenario("s1", "site-B")).toHaveLength(0);
    expect(await getChargesMensuellesParScenario("s1", "site-A", 1)).toHaveLength(1);
  });
});

describe("reporterChargeMensuelle — report en lot atomique (story PR2ter.1)", () => {
  it("cree toutes les lignes de la plage, une seule fois chacune", async () => {
    const { reporterChargeMensuelle } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedPoste("p1", "s1", "site-A");

    const lignes = await reporterChargeMensuelle("p1", "site-A", 500000, 0, 4);

    expect(lignes).toHaveLength(5);
    expect(lignes.every((l) => l.montantFCFA === 500000)).toBe(true);
    expect(stores.chargeMensuellePrevue.filter((c) => c.posteId === "p1")).toHaveLength(5);
  });

  it("ecrase les mois deja saisis dans la plage (update) et cree les autres (create), sans dupliquer", async () => {
    const { upsertChargeMensuelle, reporterChargeMensuelle } = await import(
      "@/lib/queries/previsions-charges"
    );
    seedScenario("s1", "site-A");
    seedPoste("p1", "s1", "site-A");
    await upsertChargeMensuelle("p1", "site-A", 2, 999);

    const lignes = await reporterChargeMensuelle("p1", "site-A", 500000, 0, 4);

    expect(lignes).toHaveLength(5);
    expect(stores.chargeMensuellePrevue.filter((c) => c.posteId === "p1")).toHaveLength(5);
    const moisDeux = stores.chargeMensuellePrevue.find(
      (c) => c.posteId === "p1" && c.moisAbsolu === 2
    );
    expect(moisDeux?.montantFCFA).toBe(500000);
  });

  it("R8 — rejette si le poste est d'un autre site, aucune charge creee (atomicite)", async () => {
    const { reporterChargeMensuelle } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedPoste("p1", "s1", "site-A");

    await expect(reporterChargeMensuelle("p1", "site-B", 500000, 0, 4)).rejects.toThrow(
      "PostePrevision introuvable"
    );
    expect(stores.chargeMensuellePrevue).toHaveLength(0);
  });

  it("rejette si moisFinAbsolu < moisDebutAbsolu, AVANT tout acces DB", async () => {
    const { reporterChargeMensuelle } = await import("@/lib/queries/previsions-charges");
    // Aucun scenario/poste seede : si la garde n'etait pas verifiee en
    // premier, l'erreur serait "PostePrevision introuvable".
    await expect(reporterChargeMensuelle("p1", "site-A", 500000, 5, 2)).rejects.toThrow(
      "moisFinAbsolu doit etre superieur ou egal a moisDebutAbsolu"
    );
    expect(stores.chargeMensuellePrevue).toHaveLength(0);
  });

  it("rejette un moisDebutAbsolu fractionnaire AVANT tout acces DB (garde assertEntierColonneInt)", async () => {
    const { reporterChargeMensuelle } = await import("@/lib/queries/previsions-charges");
    await expect(reporterChargeMensuelle("p1", "site-A", 500000, 1.5, 5)).rejects.toThrow(
      "moisDebutAbsolu doit etre un entier"
    );
    expect(stores.chargeMensuellePrevue).toHaveLength(0);
  });

  it("rejette un moisFinAbsolu fractionnaire AVANT tout acces DB (garde assertEntierColonneInt)", async () => {
    const { reporterChargeMensuelle } = await import("@/lib/queries/previsions-charges");
    await expect(reporterChargeMensuelle("p1", "site-A", 500000, 0, 5.5)).rejects.toThrow(
      "moisFinAbsolu doit etre un entier"
    );
    expect(stores.chargeMensuellePrevue).toHaveLength(0);
  });

  it("plage d'un seul mois (moisDebutAbsolu === moisFinAbsolu) cree exactement une ligne", async () => {
    const { reporterChargeMensuelle } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedPoste("p1", "s1", "site-A");

    const lignes = await reporterChargeMensuelle("p1", "site-A", 500000, 3, 3);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].moisAbsolu).toBe(3);
  });

  it("R4 — un upsert qui echoue AU MILIEU de la plage ne laisse AUCUNE ligne ecrite (rollback reel, pas une precondition verifiee avant tout acces DB)", async () => {
    const { reporterChargeMensuelle } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedPoste("p1", "s1", "site-A");

    // Force une VRAIE panne d'ecriture au 3e mois de la plage (0..4), APRES
    // que 2 upserts aient deja mute le magasin en memoire — seule
    // `prisma.$transaction` (snapshot/restore, cf. previsions-fake-db.ts)
    // peut annuler ces 2 ecritures deja faites. Une simple precondition
    // verifiee avant la boucle (poste introuvable, bornes invalides) ne
    // prouverait PAS ce cas : ici les 2 premiers mois sont ecrits avec
    // succes avant la panne.
    let appels = 0;
    const pushOriginal = stores.chargeMensuellePrevue.push.bind(stores.chargeMensuellePrevue);
    stores.chargeMensuellePrevue.push = ((...items: Parameters<typeof pushOriginal>) => {
      appels += 1;
      if (appels === 3) {
        throw new Error("Panne simulee au 3e mois de la plage");
      }
      return pushOriginal(...items);
    }) as typeof stores.chargeMensuellePrevue.push;

    await expect(reporterChargeMensuelle("p1", "site-A", 500000, 0, 4)).rejects.toThrow(
      "Panne simulee au 3e mois de la plage"
    );

    // Si l'atomicite etait reelle (une seule prisma.$transaction), les 2
    // ecritures reussies avant la panne doivent avoir ete annulees : AUCUNE
    // ligne ne doit subsister pour ce poste.
    expect(stores.chargeMensuellePrevue.filter((c) => c.posteId === "p1")).toHaveLength(0);
  });
});

describe("JournalDepensePrevue — R8 isolation + filtre vaguePrevueId null explicite", () => {
  function seedJournal(id: string, scenarioId: string, siteId: string, vaguePrevueId: string | null) {
    stores.journalDepensePrevue.push({
      id,
      scenarioId,
      date: new Date("2026-08-01"),
      libelle: "Depense",
      categorie: CategorieJournalPrevu.OPERATIONNEL,
      montantFCFA: 10000,
      vaguePrevueId,
      siteId,
    });
  }

  it("getJournalDepensesParScenario ne renvoie rien pour le mauvais site", async () => {
    const { getJournalDepensesParScenario } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedJournal("j1", "s1", "site-A", null);

    expect(await getJournalDepensesParScenario("s1", "site-B")).toHaveLength(0);
  });

  it("vaguePrevueId: null (explicite) filtre uniquement les lignes GENERALES", async () => {
    const { getJournalDepensesParScenario } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedJournal("j1", "s1", "site-A", null);
    seedJournal("j2", "s1", "site-A", "vp-1");

    const result = await getJournalDepensesParScenario("s1", "site-A", { vaguePrevueId: null });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("j1");
  });

  it("l'absence de filtre vaguePrevueId (undefined) ne filtre rien", async () => {
    const { getJournalDepensesParScenario } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedJournal("j1", "s1", "site-A", null);
    seedJournal("j2", "s1", "site-A", "vp-1");

    const result = await getJournalDepensesParScenario("s1", "site-A");
    expect(result).toHaveLength(2);
  });

  it("createJournalDepensePrevue rejette si le scenario est d'un autre site", async () => {
    const { createJournalDepensePrevue } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");

    await expect(
      createJournalDepensePrevue("s1", "site-B", {
        date: "2026-08-01",
        libelle: "Depense",
        categorie: CategorieJournalPrevu.OPERATIONNEL,
        montantFCFA: 10000,
      })
    ).rejects.toThrow("Scenario introuvable");
    expect(stores.journalDepensePrevue).toHaveLength(0);
  });

  it("updateJournalDepensePrevue — R8 : rejette et ne modifie rien pour un autre site", async () => {
    const { updateJournalDepensePrevue } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedJournal("j1", "s1", "site-A", null);

    await expect(
      updateJournalDepensePrevue("j1", "site-B", { montantFCFA: 99999 })
    ).rejects.toThrow("Ligne de journal introuvable");
    expect(stores.journalDepensePrevue.find((j) => j.id === "j1")!.montantFCFA).toBe(10000);
  });

  it("deleteJournalDepensePrevue — R8 : rejette et ne supprime rien pour un autre site", async () => {
    const { deleteJournalDepensePrevue } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");
    seedJournal("j1", "s1", "site-A", null);

    await expect(deleteJournalDepensePrevue("j1", "site-B")).rejects.toThrow(
      "Ligne de journal introuvable"
    );
    expect(stores.journalDepensePrevue.find((j) => j.id === "j1")).toBeDefined();
  });
});

describe("ApportCapital — R8 isolation par site", () => {
  it("getApportsCapitalParScenario ne renvoie rien pour le mauvais site", async () => {
    const { getApportsCapitalParScenario, createApportCapital } = await import(
      "@/lib/queries/previsions-charges"
    );
    seedScenario("s1", "site-A");
    await createApportCapital("s1", "site-A", {
      date: "2026-08-01",
      libelle: "Apport initial",
      montantFCFA: 1000000,
      type: TypeApportCapital.CAPITAL,
    });

    expect(await getApportsCapitalParScenario("s1", "site-B")).toHaveLength(0);
  });

  it("createApportCapital rejette si le scenario est d'un autre site, aucun apport cree", async () => {
    const { createApportCapital } = await import("@/lib/queries/previsions-charges");
    seedScenario("s1", "site-A");

    await expect(
      createApportCapital("s1", "site-B", {
        date: "2026-08-01",
        libelle: "Credit banque",
        montantFCFA: 500000,
        type: TypeApportCapital.CREDIT,
      })
    ).rejects.toThrow("Scenario introuvable");
    expect(stores.apportCapital).toHaveLength(0);
  });
});
