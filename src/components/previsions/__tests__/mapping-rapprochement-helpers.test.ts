/**
 * Tests — `mapping-rapprochement-helpers.ts` (Sprint PR3-ter, story A.2).
 *
 * Deux garanties distinctes :
 * 1. Le duplicat client-safe (`composeCibleAlimentPrevisionClient`,
 *    `extraireTailleGranuleDeCibleId`) produit EXACTEMENT le meme format
 *    compose que la source de verite serveur
 *    (`composeCibleAlimentPrevision`/`parseCibleAlimentPrevision`,
 *    `src/lib/queries/previsions-rapprochement.ts`) — falsifiable : changer
 *    le separateur d'une seule des deux copies doit casser ce test.
 * 2. `libelleCible` resout desormais une cible `ALIMENT_PREVISION` via la
 *    `tailleGranule` extraite du `cibleId` compose, jamais via une
 *    comparaison directe `a.id === cibleId` (qui echouerait TOUJOURS pour un
 *    format compose, meme pour une cible parfaitement valide).
 */
import { describe, it, expect } from "vitest";
import { TailleGranule, CibleRapprochement } from "@/types";
import {
  composeCibleAlimentPrevision,
  parseCibleAlimentPrevision,
} from "@/lib/queries/previsions-rapprochement";
import {
  composeCibleAlimentPrevisionClient,
  extraireTailleGranuleDeCibleId,
  libelleCible,
} from "@/components/previsions/mapping-rapprochement-helpers";

const tPrevisions = (key: string) => key;
const tStock = (key: string) => key;

describe("A.2 — composeCibleAlimentPrevisionClient / extraireTailleGranuleDeCibleId : parite avec la source de verite serveur", () => {
  it("le format compose est identique octet pour octet entre les deux copies", () => {
    const cote_serveur = composeCibleAlimentPrevision(TailleGranule.G2, "aliment-123");
    const cote_client = composeCibleAlimentPrevisionClient(TailleGranule.G2, "aliment-123");
    expect(cote_client).toBe(cote_serveur);
    expect(cote_client).toBe("G2::aliment-123");
  });

  it("extraireTailleGranuleDeCibleId extrait la meme tailleGranule que parseCibleAlimentPrevision (source serveur)", () => {
    const cibleId = composeCibleAlimentPrevision(TailleGranule.G3, "aliment-x");
    expect(extraireTailleGranuleDeCibleId(cibleId)).toBe(parseCibleAlimentPrevision(cibleId).tailleGranule);
    expect(extraireTailleGranuleDeCibleId(cibleId)).toBe(TailleGranule.G3);
  });

  it("cibleId null ou mal forme retourne null, jamais une exception ni un cast silencieux", () => {
    expect(extraireTailleGranuleDeCibleId(null)).toBeNull();
    expect(extraireTailleGranuleDeCibleId("id-brut-pre-A3-sans-separateur")).toBeNull();
    expect(extraireTailleGranuleDeCibleId("PAS_UNE_TAILLE::abc")).toBeNull();
  });
});

describe("A.2 — libelleCible : resolution ALIMENT_PREVISION par tailleGranule (jamais par id brut)", () => {
  it("resout une cible valide via la tailleGranule du cibleId compose, meme si l'id d'origine differe", () => {
    const cibleId = composeCibleAlimentPrevisionClient(TailleGranule.G3, "aliment-scenario-a");
    const libelle = libelleCible(
      CibleRapprochement.ALIMENT_PREVISION,
      cibleId,
      { postes: [], aliments: [{ id: "aliment-scenario-b", tailleGranule: TailleGranule.G3 }] },
      { tPrevisions, tStock }
    );
    expect(libelle).toBe("produits.taillesGranule.G3");
  });

  it("FALSIFICATION — une comparaison directe a.id === cibleId (pre-A.3) echouerait TOUJOURS pour un format compose : preuve que ce n'est plus le mecanisme utilise", () => {
    const cibleId = composeCibleAlimentPrevisionClient(TailleGranule.G1, "aliment-scenario-a");
    // Aucun aliment de la liste ne porte cet id COMPOSE comme `id` — une
    // implementation qui comparerait encore `a.id === cibleId` retournerait
    // "introuvable" ici. La production doit retourner le libelle resolu.
    const libelle = libelleCible(
      CibleRapprochement.ALIMENT_PREVISION,
      cibleId,
      { postes: [], aliments: [{ id: "aliment-scenario-b", tailleGranule: TailleGranule.G1 }] },
      { tPrevisions, tStock }
    );
    expect(libelle).not.toBe("rapprochementTab.mapping.cibleIntrouvable");
    expect(libelle).toBe("produits.taillesGranule.G1");
  });

  it("aucune tailleGranule du scenario courant ne correspond : cibleIntrouvable (cibles chargees)", () => {
    const cibleId = composeCibleAlimentPrevisionClient(TailleGranule.G4, "aliment-x");
    const libelle = libelleCible(
      CibleRapprochement.ALIMENT_PREVISION,
      cibleId,
      { postes: [], aliments: [{ id: "aliment-scenario-b", tailleGranule: TailleGranule.G1 }] },
      { tPrevisions, tStock },
      true
    );
    expect(libelle).toBe("rapprochementTab.mapping.cibleIntrouvable");
  });

  it("cibles non chargees (echec reseau) : cibleNonChargee, jamais cibleIntrouvable", () => {
    const cibleId = composeCibleAlimentPrevisionClient(TailleGranule.G4, "aliment-x");
    const libelle = libelleCible(
      CibleRapprochement.ALIMENT_PREVISION,
      cibleId,
      { postes: [], aliments: [] },
      { tPrevisions, tStock },
      false
    );
    expect(libelle).toBe("rapprochementTab.mapping.cibleNonChargee");
  });
});
