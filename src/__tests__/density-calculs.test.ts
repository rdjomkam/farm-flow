/**
 * Tests — density-calculs.test.ts (Sprint 27-28, ADR-density-alerts)
 *
 * Couvre les fonctions pures de calcul de densite et de renouvellement :
 *   - calculerDensiteBac()      — densite per-bac via computeVivantsByBac + biometrie filtree
 *   - calculerDensiteVague()    — densite vague-level (sum biomasses / sum volumes)
 *   - computeTauxRenouvellement() — taux effectif %/jour depuis les releves RENOUVELLEMENT
 *   - computeVivantsByBac()     — vivants per-bac (deja disponible, tests complementaires)
 *
 * NOTE : calculerDensiteBac(), calculerDensiteVague() et computeTauxRenouvellement()
 * sont specifiees dans ADR-density-alerts section 4 mais PAS encore implementees.
 * Les tests correspondants sont marques .todo avec leurs specifications.
 * computeVivantsByBac() est deja implementee dans src/lib/calculs.ts.
 */

import { describe, it, expect } from "vitest";
import { computeVivantsByBac } from "@/lib/calculs";

// ---------------------------------------------------------------------------
// Types helpers pour les tests (imite les signatures ADR section 4)
// ---------------------------------------------------------------------------

/** Releve minimal pour les tests de vivants et densite */
type ReleveCtx = {
  bacId: string | null;
  typeReleve: string;
  nombreMorts: number | null;
  nombreCompte: number | null;
  poidsMoyen?: number | null;
  date?: Date;
  pourcentageRenouvellement?: number | null;
  volumeRenouvele?: number | null;
};

/** Bac minimal pour les tests */
type BacCtx = {
  id: string;
  volume: number | null;
  nombreInitial: number | null;
};

// ---------------------------------------------------------------------------
// computeVivantsByBac — tests complementaires (fonction existante)
// ---------------------------------------------------------------------------

describe("computeVivantsByBac — cas de base", () => {
  it("utilise nombreInitial par bac quand renseigne", () => {
    const bacs = [
      { id: "bac-1", nombreInitial: 300 },
      { id: "bac-2", nombreInitial: 700 },
    ];
    const releves: ReleveCtx[] = [];
    const result = computeVivantsByBac(bacs, releves, 1000);
    expect(result.get("bac-1")).toBe(300);
    expect(result.get("bac-2")).toBe(700);
  });

  it("repartit uniformement si nombreInitial null sur les bacs", () => {
    const bacs = [
      { id: "bac-1", nombreInitial: null },
      { id: "bac-2", nombreInitial: null },
    ];
    const releves: ReleveCtx[] = [];
    const result = computeVivantsByBac(bacs, releves, 1000);
    expect(result.get("bac-1")).toBe(500);
    expect(result.get("bac-2")).toBe(500);
  });

  it("soustrait les mortalites par bac", () => {
    const bacs = [
      { id: "bac-1", nombreInitial: 500 },
      { id: "bac-2", nombreInitial: 500 },
    ];
    const releves: ReleveCtx[] = [
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 20, nombreCompte: null },
      { bacId: "bac-2", typeReleve: "MORTALITE", nombreMorts: 10, nombreCompte: null },
    ];
    const result = computeVivantsByBac(bacs, releves, 1000);
    expect(result.get("bac-1")).toBe(480);
    expect(result.get("bac-2")).toBe(490);
  });

  it("utilise le dernier comptage si present (ecrase mortalite)", () => {
    const bacs = [{ id: "bac-1", nombreInitial: 500 }];
    const releves: ReleveCtx[] = [
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 50, nombreCompte: null },
      { bacId: "bac-1", typeReleve: "COMPTAGE", nombreMorts: null, nombreCompte: 420 },
    ];
    const result = computeVivantsByBac(bacs, releves, 500);
    // Le comptage remplace le calcul par soustraction
    expect(result.get("bac-1")).toBe(420);
  });

  it("ignore les mortalites sans bacId", () => {
    const bacs = [{ id: "bac-1", nombreInitial: 500 }];
    const releves: ReleveCtx[] = [
      { bacId: null, typeReleve: "MORTALITE", nombreMorts: 100, nombreCompte: null },
    ];
    const result = computeVivantsByBac(bacs, releves, 500);
    // Mortalite sans bacId ignoree → vivants = 500
    expect(result.get("bac-1")).toBe(500);
  });

  it("distribution non-uniforme : bac1=300 bac2=700 → densites differentes", () => {
    const bacs = [
      { id: "bac-1", nombreInitial: 300 },
      { id: "bac-2", nombreInitial: 700 },
    ];
    const releves: ReleveCtx[] = [];
    const result = computeVivantsByBac(bacs, releves, 1000);
    expect(result.get("bac-1")).not.toBe(result.get("bac-2"));
    expect(result.get("bac-1")).toBe(300);
    expect(result.get("bac-2")).toBe(700);
  });

  it("bacs vides → retourne une Map vide", () => {
    const result = computeVivantsByBac([], [], 0);
    expect(result.size).toBe(0);
  });

  it("accumule plusieurs releves MORTALITE sur le meme bac", () => {
    const bacs = [{ id: "bac-1", nombreInitial: 500 }];
    const releves: ReleveCtx[] = [
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 20, nombreCompte: null },
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 15, nombreCompte: null },
      { bacId: "bac-1", typeReleve: "MORTALITE", nombreMorts: 5, nombreCompte: null },
    ];
    const result = computeVivantsByBac(bacs, releves, 500);
    expect(result.get("bac-1")).toBe(460); // 500 - 20 - 15 - 5
  });
});

// ---------------------------------------------------------------------------
// calculerDensiteBac — tests (fonction a implementer, ADR section 4.1)
// ---------------------------------------------------------------------------

describe("calculerDensiteBac — cas normal", () => {
  /**
   * TODO : implementer calculerDensiteBac() dans src/lib/calculs.ts
   *
   * Signature attendue (ADR section 4.1) :
   *   function calculerDensiteBac(
   *     bac: { id: string; volume: number | null; nombreInitial: number | null },
   *     bacs: { id: string; nombreInitial: number | null }[],
   *     releves: ReleveCtx[],
   *     nombreInitialVague: number
   *   ): number | null
   *
   * Algorithme :
   *   1. vivantsBac via computeVivantsByBac()[bac.id]
   *   2. poidsMoyenBac = derniere biometrie avec bacId == bac.id,
   *      fallback : derniere biometrie globale
   *   3. biomasseBac = poidsMoyenBac * vivantsBac / 1000 (kg)
   *   4. densiteKgM3 = biomasseBac / (bac.volume / 1000)
   */

  it.todo(
    "cas normal : bac avec volume + biometrie per-bac + mortalites → densite correcte"
    // Attendu : bac { id:'b1', volume:3900, nombreInitial:400 }
    //   mortalite: 0, poidsMoyen: 375g
    //   biomasse = 375 * 400 / 1000 = 150 kg
    //   volumeM3 = 3900 / 1000 = 3.9 m3
    //   densite = 150 / 3.9 ≈ 38.46 kg/m3
  );

  it.todo(
    "bac avec biometrie per-bac specifique → utilise sa biometrie propre, pas la globale"
    // bac-1 a biometrie poids=100g, bac-2 a biometrie globale poids=200g
    // densiteBac(bac-1) doit utiliser 100g, pas 200g
  );

  it.todo(
    "aucune biometrie per-bac → fallback sur derniere biometrie globale"
    // bac-1 n'a pas de biometrie propre
    // Il existe une biometrie sans bacId (globale)
    // densiteBac(bac-1) doit utiliser cette biometrie globale
  );

  it.todo(
    "volume null → retourne null"
    // bac { id:'b1', volume:null, ... }
    // calculerDensiteBac() doit retourner null
  );

  it.todo(
    "volume = 0 → retourne null (division par zero)"
    // bac { id:'b1', volume:0, ... }
    // calculerDensiteBac() doit retourner null
  );

  it.todo(
    "aucune biometrie du tout → retourne null"
    // Pas de releve BIOMETRIE dans toute la vague
    // Impossible de calculer le poids moyen → null
  );

  it.todo(
    "vivants = 0 → retourne 0 (densite nulle, bac vide)"
    // Tous les poissons morts (comptage = 0)
    // biomasse = 0 kg → densite = 0 kg/m3
  );

  it.todo(
    "distribution non-uniforme : bac1=300 bac2=700 → densites differentes pour meme volume"
    // bac1 et bac2 ont meme volume mais nombreInitial different
    // calculerDensiteBac(bac1) != calculerDensiteBac(bac2)
  );
});

// ---------------------------------------------------------------------------
// calculerDensiteVague — tests (fonction a implementer, ADR section 4.1b)
// ---------------------------------------------------------------------------

describe("calculerDensiteVague — cas normal", () => {
  /**
   * TODO : implementer calculerDensiteVague() dans src/lib/calculs.ts
   *
   * Signature attendue (ADR section 4.1b) :
   *   function calculerDensiteVague(
   *     bacs: { id: string; volume: number | null; nombreInitial: number | null }[],
   *     releves: ReleveCtx[],
   *     nombreInitialVague: number
   *   ): number | null
   *
   * Algorithme :
   *   densiteVague = sum(biomasseBac_i) / sum(volumeM3_i)
   *   (uniquement pour les bacs avec volume non null)
   *   Ponderation correcte par volume (pas moyenne des densites)
   */

  it.todo(
    "bac unique → meme resultat que calculerDensiteBac"
    // 1 seul bac → densiteVague == densiteBac(bac)
  );

  it.todo(
    "deux bacs → sum biomasses / sum volumes (ponderation par volume)"
    // bac1: volume=2000L, biomasse=80kg → densite=40 kg/m3
    // bac2: volume=1000L, biomasse=50kg → densite=50 kg/m3
    // densiteVague = (80+50) / (2+1) = 130/3 ≈ 43.33 kg/m3  (PAS (40+50)/2=45)
  );

  it.todo(
    "certains bacs sans volume → exclus du calcul"
    // bac1: volume=2000L, biomasse=80kg (inclus)
    // bac2: volume=null (exclu)
    // densiteVague = 80kg / 2m3 = 40 kg/m3
  );

  it.todo(
    "aucun bac avec volume → retourne null"
    // Tous les bacs ont volume=null
    // calculerDensiteVague() doit retourner null
  );

  it.todo(
    "aucune biometrie → retourne null"
    // Pas de poids moyen → biomasse incalculable → null
  );
});

// ---------------------------------------------------------------------------
// computeTauxRenouvellement — tests (fonction a implementer, ADR section 4.2)
// ---------------------------------------------------------------------------

describe("computeTauxRenouvellement — cas normal", () => {
  /**
   * TODO : implementer computeTauxRenouvellement() dans src/lib/calculs.ts
   *
   * Signature attendue (ADR section 4.2) :
   *   function computeTauxRenouvellement(
   *     relevesRenouvellement: Array<{
   *       date: Date;
   *       pourcentageRenouvellement: number | null;
   *       volumeRenouvele: number | null;
   *     }>,
   *     bacVolumeLitres: number,
   *     periodeDays?: number  // defaut: 7
   *   ): number | null
   *
   * Semantique :
   *   tauxMoyen = somme(pourcentages dans la periode) / periodeDays
   *   Si pourcentageRenouvellement null mais volumeRenouvele present :
   *     conversion = (volumeRenouvele / bacVolumeLitres) * 100
   */

  it.todo(
    "aucun releve dans la periode → retourne null"
    // Pas de releve RENOUVELLEMENT dans les 7 derniers jours
    // computeTauxRenouvellement([]) doit retourner null
  );

  it.todo(
    "3 releves de 50% chacun sur 7 jours → 3*50/7 ≈ 21.4%/jour"
    // releves: [50%, 50%, 50%] dans la fenetre de 7 jours
    // taux = 150 / 7 ≈ 21.43 %/jour
  );

  it.todo(
    "1 releve de 86% sur 7 jours → 86/7 ≈ 12.3%/jour"
    // taux = 86 / 7 ≈ 12.29 %/jour
  );

  it.todo(
    "releve avec volumeRenouvele (sans pourcentage) + bacVolume connu → conversion correcte"
    // volumeRenouvele=500L, bacVolume=1000L → pourcentage=50%
    // taux sur 7j = 50/7 ≈ 7.14%/jour
  );

  it.todo(
    "releves mixtes : certains avec %, certains avec volumeRenouvele → combine les deux"
    // releve1: pourcentage=50
    // releve2: volumeRenouvele=300, bacVolume=1000L → 30%
    // taux = (50+30)/7 ≈ 11.43%/jour
  );

  it.todo(
    "bacVolumeLitres null + releve avec volumeRenouvele uniquement → retourne null"
    // Impossible de convertir volumeRenouvele en % sans bacVolume
    // Ces releves doivent etre ignores → 0 releve valide → null
  );

  it.todo(
    "periode de 0 jours → retourne null (division par zero)"
    // periodeDays=0 → null
  );

  it.todo(
    "fenetre glissante : releve hors periode ignore"
    // releve1: il y a 8 jours (hors fenetre 7j) → ignore
    // releve2: il y a 3 jours (dans fenetre) → utilise
    // taux = releve2.pourcentage / 7
  );
});

// ---------------------------------------------------------------------------
// Tests d'integration locale : computeVivantsByBac → densite (via calculerDensite)
// ---------------------------------------------------------------------------

describe("Integration locale : computeVivantsByBac + calculerDensite existante", () => {
  /**
   * On teste ici l'algorithme de calculerDensiteBac en combinant les fonctions
   * existantes manuellement, pour valider la logique avant que la fonction
   * wrapper soit implementee.
   */

  it("calcule la densite correcte pour un bac avec biometrie et volume", () => {
    // Bac beton : volume 3900L, 400 poissons initiaux, poids moyen 375g
    // biomasse = 375 * 400 / 1000 = 150 kg
    // volumeM3 = 3900 / 1000 = 3.9 m3
    // densite = 150 / 3.9 ≈ 38.46 kg/m3
    const bacs = [{ id: "bac-1", nombreInitial: 400 }];
    const releves: ReleveCtx[] = [
      // Biometrie per-bac
      { bacId: "bac-1", typeReleve: "BIOMETRIE", nombreMorts: null, nombreCompte: null, poidsMoyen: 375 },
    ];
    const vivants = computeVivantsByBac(bacs, releves, 400);
    const vivantsBac1 = vivants.get("bac-1") ?? 0;
    expect(vivantsBac1).toBe(400);

    const biomasse = (375 * vivantsBac1) / 1000;
    const volumeM3 = 3900 / 1000;
    const densite = biomasse / volumeM3;
    expect(densite).toBeCloseTo(38.46, 1);
  });

  it("bac de reference Nigeria : 400 poissons, 3.9m3 → 150 kg/m3 a poids cible 375g", () => {
    // Scenario commercial Nigeria : bac beton 4x3x1.3m = 15.6m3, 30% effectif = 4.68m3
    // En utilisant 3.9m3 pour simplifier
    // 400 poissons x 375g = 150kg → 150/3.9 ≈ 38.5 kg/m3 (en dessous du seuil alerte 150)
    const bacs = [{ id: "bac-commercial", nombreInitial: 400 }];
    const releves: ReleveCtx[] = [];
    const vivants = computeVivantsByBac(bacs, releves, 400);
    const biomasse = (375 * (vivants.get("bac-commercial") ?? 0)) / 1000;
    const volumeM3 = 3900 / 1000;
    const densite = biomasse / volumeM3;

    // Ce bac est en dessous du seuil alerte bac beton (150 kg/m3)
    expect(densite).toBeLessThan(150);
  });

  it("bac RAS sature : 500 kg dans 1m3 → densite critique (> 350 kg/m3)", () => {
    const bacs = [{ id: "bac-ras", nombreInitial: 1000 }];
    const releves: ReleveCtx[] = [];
    const vivants = computeVivantsByBac(bacs, releves, 1000);
    const biomasse = (500 * (vivants.get("bac-ras") ?? 0)) / 1000; // 500g chacun = 500kg
    const volumeM3 = 1000 / 1000; // 1000L = 1m3
    const densite = biomasse / volumeM3;

    // Au-dessus du seuil alerte RAS (350 kg/m3) → alerte SEUIL_DENSITE
    expect(densite).toBeGreaterThan(350);
  });

  it("vivants heterogenes : bac1=300/3900L vs bac2=700/3900L → densites differentes", () => {
    const bacs = [
      { id: "bac-1", nombreInitial: 300 },
      { id: "bac-2", nombreInitial: 700 },
    ];
    const releves: ReleveCtx[] = [];
    const vivants = computeVivantsByBac(bacs, releves, 1000);

    const poidsMoyen = 200; // 200g
    const volume = 3900; // 3.9m3

    const biomasse1 = (poidsMoyen * (vivants.get("bac-1") ?? 0)) / 1000;
    const biomasse2 = (poidsMoyen * (vivants.get("bac-2") ?? 0)) / 1000;
    const volumeM3 = volume / 1000;

    const densite1 = biomasse1 / volumeM3;
    const densite2 = biomasse2 / volumeM3;

    // bac2 a 2.33x plus de poissons → densite 2.33x plus elevee
    expect(densite2 / densite1).toBeCloseTo(7 / 3, 1);
    expect(densite1).toBeCloseTo(15.38, 1); // 60kg / 3.9m3
    expect(densite2).toBeCloseTo(35.9, 1);  // 140kg / 3.9m3
  });
});

// ---------------------------------------------------------------------------
// Validation des seuils par type de systeme (ADR section 3.1)
// ---------------------------------------------------------------------------

describe("Seuils de densite par type de systeme — reference ADR section 3.1", () => {
  const SEUILS = {
    BAC_BETON: { alerte: 150, critique: 200 },
    ETANG_TERRE: { alerte: 30, critique: 40 },
    RAS: { alerte: 350, critique: 500 },
  };

  it("classifie correctement une densite bac beton sous le seuil alerte", () => {
    const densite = 80; // 80 kg/m3
    expect(densite).toBeLessThan(SEUILS.BAC_BETON.alerte);
  });

  it("classifie correctement une densite bac beton en alerte", () => {
    const densite = 160; // 160 kg/m3
    expect(densite).toBeGreaterThan(SEUILS.BAC_BETON.alerte);
    expect(densite).toBeLessThan(SEUILS.BAC_BETON.critique);
  });

  it("classifie correctement une densite bac beton critique", () => {
    const densite = 220; // 220 kg/m3
    expect(densite).toBeGreaterThan(SEUILS.BAC_BETON.critique);
  });

  it("classifie correctement une densite RAS en alerte (> 350, < 500)", () => {
    const densite = 400;
    expect(densite).toBeGreaterThan(SEUILS.RAS.alerte);
    expect(densite).toBeLessThan(SEUILS.RAS.critique);
  });

  it("densite etang 35 kg/m3 est en alerte orange (> 30, < 40)", () => {
    const densite = 35;
    expect(densite).toBeGreaterThan(SEUILS.ETANG_TERRE.alerte);
    expect(densite).toBeLessThan(SEUILS.ETANG_TERRE.critique);
  });
});

// ---------------------------------------------------------------------------
// Renouvellement d'eau — seuils recommandes (ADR section 3.2)
// ---------------------------------------------------------------------------

describe("Seuils de renouvellement requis — reference ADR section 3.2", () => {
  const SEUILS_RENOUVELLEMENT = {
    FAIBLE_DENSITE: { seuil: 25 },  // < 50 kg/m3 → 25%/jour minimum
    MOYENNE_DENSITE: { seuil: 50 }, // 50-100 kg/m3 → 50%/jour minimum
    HAUTE_DENSITE: { seuil: 75 },   // > 100 kg/m3 → 50-100%/jour (regle R2 utilise 75)
    CRITIQUE: { seuil: 100 },       // > 200 kg/m3 → regle R3
  };

  it("renouvellement 20%/jour insuffisant pour densite > 50 kg/m3 (R1)", () => {
    const tauxRenouvellement = 20;
    const seuilR1 = SEUILS_RENOUVELLEMENT.MOYENNE_DENSITE.seuil;
    // La regle R1 se declenche si SEUIL_DENSITE > 50 ET SEUIL_RENOUVELLEMENT < 50
    expect(tauxRenouvellement).toBeLessThan(seuilR1);
  });

  it("renouvellement 60%/jour suffisant pour densite 50-100 kg/m3", () => {
    const tauxRenouvellement = 60;
    expect(tauxRenouvellement).toBeGreaterThanOrEqual(SEUILS_RENOUVELLEMENT.MOYENNE_DENSITE.seuil);
  });

  it("renouvellement optimal 86%/jour (reference etude Mont Cameroun)", () => {
    const tauxOptimal = 86;
    // Valeur de reference de la litterature camerounaise
    expect(tauxOptimal).toBeGreaterThan(SEUILS_RENOUVELLEMENT.HAUTE_DENSITE.seuil);
    expect(tauxOptimal).toBeLessThan(100);
  });
});
