/**
 * Tests unitaires — `src/lib/queries/previsions-postes-referentiel.ts`
 * (ADR-053 §16, story A.4).
 *
 * Couvre R8 (isolation stricte par site — jamais une fuite d'un
 * PosteReferentiel d'un autre site) et le filtre `actif`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createEmptyStores, buildFakePrisma, type Stores } from "./previsions-fake-db";

const stores: Stores = createEmptyStores();

vi.mock("@/lib/db", () => ({
  prisma: buildFakePrisma(stores),
}));

beforeEach(() => {
  Object.assign(stores, createEmptyStores());
});

describe("listerPostesReferentielActifs — R8 isolation par site", () => {
  it("ne renvoie que les entrees ACTIVES du site demande — jamais celles d'un autre site (R8)", async () => {
    const { listerPostesReferentielActifs } = await import(
      "@/lib/queries/previsions-postes-referentiel"
    );
    stores.posteReferentiel.push(
      { id: "ref-a1", siteId: "site-A", code: "salaires", libelle: "Salaires", actif: true },
      { id: "ref-a2", siteId: "site-A", code: "energie", libelle: "Energie", actif: true },
      { id: "ref-b1", siteId: "site-B", code: "salaires", libelle: "Salaires (site B)", actif: true }
    );

    const resultatA = await listerPostesReferentielActifs("site-A");
    const resultatB = await listerPostesReferentielActifs("site-B");

    expect(resultatA.map((r: { id: string }) => r.id).sort()).toEqual(["ref-a1", "ref-a2"]);
    expect(resultatB.map((r: { id: string }) => r.id)).toEqual(["ref-b1"]);
    // Aucune fuite croisee : aucun id de A n'apparait dans le resultat de B et inversement.
    expect(resultatA.some((r: { id: string }) => r.id === "ref-b1")).toBe(false);
    expect(resultatB.some((r: { id: string }) => r.id === "ref-a1")).toBe(false);
  });

  it("exclut les entrees DESACTIVEES (actif: false), meme sur le bon site", async () => {
    const { listerPostesReferentielActifs } = await import(
      "@/lib/queries/previsions-postes-referentiel"
    );
    stores.posteReferentiel.push(
      { id: "ref-actif", siteId: "site-A", code: "salaires", libelle: "Salaires", actif: true },
      { id: "ref-inactif", siteId: "site-A", code: "vieux-poste", libelle: "Vieux poste", actif: false }
    );

    const resultat = await listerPostesReferentielActifs("site-A");

    expect(resultat.map((r: { id: string }) => r.id)).toEqual(["ref-actif"]);
  });

  it("un site sans aucune entree renvoie un tableau vide (jamais une erreur)", async () => {
    const { listerPostesReferentielActifs } = await import(
      "@/lib/queries/previsions-postes-referentiel"
    );
    expect(await listerPostesReferentielActifs("site-sans-postes")).toEqual([]);
  });
});
