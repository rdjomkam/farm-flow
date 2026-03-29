/**
 * Tests unitaires pour gompertz.ts
 *
 * Fonctions testees :
 *   - gompertzWeight        : evaluation du modele W(t) = W∞ × exp(−exp(−K×(t−ti)))
 *   - gompertzVelocity      : vitesse de croissance instantanee dW/dt
 *   - calibrerGompertz      : calibration Levenberg-Marquardt depuis points biometriques
 *   - projeterDateRecolte   : projection analytique de la date de recolte
 *   - genererCourbeGompertz : generation de points pour le graphe
 *
 * Donnees FAO de reference : Clarias gariepinus en etang (15 points)
 */

import { describe, it, expect } from "vitest";
import {
  gompertzWeight,
  gompertzVelocity,
  calibrerGompertz,
  projeterDateRecolte,
  genererCourbeGompertz,
  type GompertzParams,
} from "@/lib/gompertz";

// ---------------------------------------------------------------------------
// Donnees FAO de reference — Clarias gariepinus, culture en etang
// ---------------------------------------------------------------------------

const FAO_CLARIAS_POINTS = [
  { jour: 0, poidsMoyen: 0.5 },
  { jour: 14, poidsMoyen: 5 },
  { jour: 28, poidsMoyen: 20 },
  { jour: 42, poidsMoyen: 50 },
  { jour: 56, poidsMoyen: 95 },
  { jour: 70, poidsMoyen: 150 },
  { jour: 84, poidsMoyen: 210 },
  { jour: 98, poidsMoyen: 280 },
  { jour: 112, poidsMoyen: 350 },
  { jour: 126, poidsMoyen: 420 },
  { jour: 140, poidsMoyen: 490 },
  { jour: 154, poidsMoyen: 550 },
  { jour: 168, poidsMoyen: 600 },
  { jour: 182, poidsMoyen: 640 },
  { jour: 196, poidsMoyen: 670 },
];

/** Parametres de reference bases sur les donnees FAO */
const PARAMS_REFERENCE: GompertzParams = {
  wInfinity: 1200,
  k: 0.018,
  ti: 95,
};

// ---------------------------------------------------------------------------
// gompertzWeight — evaluation du modele W(t)
// ---------------------------------------------------------------------------

describe("gompertzWeight", () => {
  it("retourne des valeurs croissantes pour t croissant", () => {
    const t_values = [0, 20, 50, 80, 120, 200, 400];
    const weights = t_values.map((t) => gompertzWeight(t, PARAMS_REFERENCE));
    for (let i = 1; i < weights.length; i++) {
      expect(weights[i]).toBeGreaterThan(weights[i - 1]);
    }
  });

  it("tend vers W∞ quand t → ∞ (t=1000)", () => {
    const w1000 = gompertzWeight(1000, PARAMS_REFERENCE);
    // A t=1000 jours, le poids doit etre tres proche de W∞ (a 0.1% pres)
    expect(w1000).toBeGreaterThan(PARAMS_REFERENCE.wInfinity * 0.999);
    expect(w1000).toBeLessThanOrEqual(PARAMS_REFERENCE.wInfinity);
  });

  it("retourne ~0 a t=0 avec les parametres de reference (W∞=1200, k=0.018, ti=95)", () => {
    const w0 = gompertzWeight(0, PARAMS_REFERENCE);
    // W(0) = 1200 * exp(-exp(-0.018*(0-95))) = 1200 * exp(-exp(1.71))
    // exp(1.71) ≈ 5.53 → exp(-5.53) ≈ 0.004 → W(0) ≈ 4.7g
    // C'est proche de zero par rapport a W∞=1200g (< 1%)
    expect(w0).toBeGreaterThan(0);
    expect(w0).toBeLessThan(PARAMS_REFERENCE.wInfinity * 0.01);
  });

  it("W(t=ti) = W∞ / e (propriete mathematique du point d'inflexion)", () => {
    const { wInfinity, ti } = PARAMS_REFERENCE;
    const wTi = gompertzWeight(ti, PARAMS_REFERENCE);
    // W(ti) = W∞ * exp(-exp(0)) = W∞ * exp(-1) = W∞ / e
    expect(wTi).toBeCloseTo(wInfinity / Math.E, 4);
  });

  it("W(t) est toujours positif pour tout t reel", () => {
    const t_values = [-50, -10, 0, 50, 100, 500];
    for (const t of t_values) {
      expect(gompertzWeight(t, PARAMS_REFERENCE)).toBeGreaterThan(0);
    }
  });

  it("W(t) ne depasse jamais W∞", () => {
    const t_values = [0, 50, 100, 200, 500, 1000];
    for (const t of t_values) {
      expect(gompertzWeight(t, PARAMS_REFERENCE)).toBeLessThanOrEqual(
        PARAMS_REFERENCE.wInfinity
      );
    }
  });

  it("W∞ plus grand → poids plus grand a t donne", () => {
    const paramsSmall: GompertzParams = { wInfinity: 500, k: 0.018, ti: 95 };
    const paramsLarge: GompertzParams = { wInfinity: 2000, k: 0.018, ti: 95 };
    const t = 100;
    expect(gompertzWeight(t, paramsLarge)).toBeGreaterThan(
      gompertzWeight(t, paramsSmall)
    );
  });

  it("K plus grand → croissance plus rapide (atteint W∞ plus vite)", () => {
    const paramsSlow: GompertzParams = { wInfinity: 1200, k: 0.01, ti: 95 };
    const paramsFast: GompertzParams = { wInfinity: 1200, k: 0.05, ti: 95 };
    // Apres le point d'inflexion, un K plus grand signifie deja plus avance
    // On compare a t=200 (bien apres ti=95)
    expect(gompertzWeight(200, paramsFast)).toBeGreaterThan(
      gompertzWeight(200, paramsSlow)
    );
  });
});

// ---------------------------------------------------------------------------
// gompertzVelocity — vitesse de croissance instantanee dW/dt
// ---------------------------------------------------------------------------

describe("gompertzVelocity", () => {
  it("est maximale a t = ti (point d'inflexion)", () => {
    const { ti } = PARAMS_REFERENCE;
    const vTi = gompertzVelocity(ti, PARAMS_REFERENCE);
    // Tester quelques points autour de ti
    const vBefore = gompertzVelocity(ti - 10, PARAMS_REFERENCE);
    const vAfter = gompertzVelocity(ti + 10, PARAMS_REFERENCE);
    expect(vTi).toBeGreaterThan(vBefore);
    expect(vTi).toBeGreaterThan(vAfter);
  });

  it("est positive pour tout t", () => {
    const t_values = [0, 20, 50, 95, 150, 300, 1000];
    for (const t of t_values) {
      expect(gompertzVelocity(t, PARAMS_REFERENCE)).toBeGreaterThan(0);
    }
  });

  it("retourne des taux de croissance plausibles (g/jour) — entre 0 et W∞*K", () => {
    // La vitesse maximale theorique (au point d'inflexion) est W∞*K/e
    const vMax = PARAMS_REFERENCE.wInfinity * PARAMS_REFERENCE.k * Math.exp(-1);
    const t_values = [0, 50, 95, 150, 300];
    for (const t of t_values) {
      const v = gompertzVelocity(t, PARAMS_REFERENCE);
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(vMax * 1.001); // marge pour erreur numerique
    }
  });

  it("vitesse au point d'inflexion = W∞ × K / e (formule analytique)", () => {
    const { wInfinity, k, ti } = PARAMS_REFERENCE;
    const vTi = gompertzVelocity(ti, PARAMS_REFERENCE);
    // dW/dt|t=ti = W∞ * K * exp(-1) (car u=0 au point d'inflexion)
    const vExpected = wInfinity * k * Math.exp(-1);
    expect(vTi).toBeCloseTo(vExpected, 6);
  });

  it("decroit vers 0 apres le point d'inflexion", () => {
    const velocities = [100, 150, 200, 300, 500].map((t) =>
      gompertzVelocity(t, PARAMS_REFERENCE)
    );
    for (let i = 1; i < velocities.length; i++) {
      expect(velocities[i]).toBeLessThan(velocities[i - 1]);
    }
  });
});

// ---------------------------------------------------------------------------
// calibrerGompertz — calibration Levenberg-Marquardt
// ---------------------------------------------------------------------------

describe("calibrerGompertz", () => {
  it("retourne null si < 5 points", () => {
    const result = calibrerGompertz({
      points: [
        { jour: 0, poidsMoyen: 1 },
        { jour: 30, poidsMoyen: 50 },
        { jour: 60, poidsMoyen: 150 },
        { jour: 90, poidsMoyen: 280 },
      ],
    });
    expect(result).toBeNull();
  });

  it("retourne null avec 0 points", () => {
    const result = calibrerGompertz({ points: [] });
    expect(result).toBeNull();
  });

  it("retourne null avec 1 point", () => {
    const result = calibrerGompertz({
      points: [{ jour: 50, poidsMoyen: 200 }],
    });
    expect(result).toBeNull();
  });

  it("converge sur le dataset FAO Clarias (15 points)", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS });
    expect(result).not.toBeNull();
    expect(result!.params.wInfinity).toBeGreaterThan(0);
    expect(result!.params.k).toBeGreaterThan(0);
    expect(result!.params.ti).toBeGreaterThan(0);
  });

  it("R² > 0.90 avec le dataset FAO (15 points bien distribues)", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS });
    expect(result).not.toBeNull();
    expect(result!.r2).toBeGreaterThan(0.9);
  });

  it("R² > 0.95 avec le dataset FAO (15 points — attendu HIGH)", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS });
    expect(result).not.toBeNull();
    expect(result!.r2).toBeGreaterThan(0.95);
  });

  it("W∞ calibre > max poids observe (borne physique respectee)", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS });
    const maxObserve = Math.max(...FAO_CLARIAS_POINTS.map((p) => p.poidsMoyen));
    expect(result).not.toBeNull();
    expect(result!.params.wInfinity).toBeGreaterThanOrEqual(maxObserve);
  });

  it("K calibre est strictement positif (pas de croissance negative)", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS });
    expect(result).not.toBeNull();
    expect(result!.params.k).toBeGreaterThan(0);
  });

  it("K est dans les bornes physiques [0.005, 0.2] pour Clarias", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS });
    expect(result).not.toBeNull();
    expect(result!.params.k).toBeGreaterThanOrEqual(0.005);
    expect(result!.params.k).toBeLessThanOrEqual(0.2);
  });

  it("ti est dans les bornes physiques [0, 120] pour Clarias", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS });
    expect(result).not.toBeNull();
    expect(result!.params.ti).toBeGreaterThanOrEqual(0);
    expect(result!.params.ti).toBeLessThanOrEqual(120);
  });

  it("RMSE est exprime en grammes (meme unite que les donnees)", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS });
    expect(result).not.toBeNull();
    // RMSE doit etre fini et positif
    expect(result!.rmse).toBeGreaterThanOrEqual(0);
    expect(isFinite(result!.rmse)).toBe(true);
  });

  it("biometrieCount correspond au nombre de points fournis", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS });
    expect(result).not.toBeNull();
    expect(result!.biometrieCount).toBe(FAO_CLARIAS_POINTS.length);
  });

  it("confidenceLevel = HIGH avec 15 points et R² > 0.95", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS });
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("HIGH");
  });

  it("confidenceLevel = LOW avec exactement 5 points", () => {
    const points5 = FAO_CLARIAS_POINTS.slice(0, 5);
    const result = calibrerGompertz({ points: points5 });
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("LOW");
  });

  it("confidenceLevel = LOW avec exactement 6 points", () => {
    const points6 = FAO_CLARIAS_POINTS.slice(0, 6);
    const result = calibrerGompertz({ points: points6 });
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("LOW");
  });

  it("confidenceLevel = MEDIUM avec 7 points", () => {
    const points7 = FAO_CLARIAS_POINTS.slice(0, 7);
    const result = calibrerGompertz({ points: points7 });
    expect(result).not.toBeNull();
    // 7 points → MEDIUM (quelque soit R²)
    expect(result!.confidenceLevel).toBe("MEDIUM");
  });

  it("confidenceLevel = MEDIUM avec 9 points", () => {
    const points9 = FAO_CLARIAS_POINTS.slice(0, 9);
    const result = calibrerGompertz({ points: points9 });
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("MEDIUM");
  });
});

// ---------------------------------------------------------------------------
// projeterDateRecolte — projection de la date de recolte
// ---------------------------------------------------------------------------

describe("projeterDateRecolte", () => {
  it("retourne null si W∞ <= poidsObjectif (cible inatteignable)", () => {
    const params: GompertzParams = { wInfinity: 800, k: 0.018, ti: 95 };
    // poidsObjectif >= wInfinity → null
    expect(projeterDateRecolte(params, 800, 0)).toBeNull();
    expect(projeterDateRecolte(params, 1000, 0)).toBeNull();
  });

  it("retourne un nombre positif pour une cible atteignable", () => {
    const joursRestants = projeterDateRecolte(PARAMS_REFERENCE, 500, 0);
    expect(joursRestants).not.toBeNull();
    expect(joursRestants!).toBeGreaterThan(0);
  });

  it("retourne 0 (ou quasi) si le poids actuel est deja >= poidsObjectif", () => {
    // On est deja au jour 200 (poids ≈ 1190g), objectif 500g
    const joursRestants = projeterDateRecolte(PARAMS_REFERENCE, 500, 200);
    expect(joursRestants).not.toBeNull();
    expect(joursRestants!).toBe(0);
  });

  it("plus la cible est haute, plus le delai est long (monotonie)", () => {
    const t400 = projeterDateRecolte(PARAMS_REFERENCE, 400, 50);
    const t600 = projeterDateRecolte(PARAMS_REFERENCE, 600, 50);
    const t800 = projeterDateRecolte(PARAMS_REFERENCE, 800, 50);
    expect(t400).not.toBeNull();
    expect(t600).not.toBeNull();
    expect(t800).not.toBeNull();
    expect(t600!).toBeGreaterThan(t400!);
    expect(t800!).toBeGreaterThan(t600!);
  });

  it("plus les jours actuels sont eleves, moins il reste de jours", () => {
    // Meme objectif (500g), mais on demarre plus tard
    const r1 = projeterDateRecolte(PARAMS_REFERENCE, 500, 0);
    const r2 = projeterDateRecolte(PARAMS_REFERENCE, 500, 50);
    expect(r1).not.toBeNull();
    expect(r2).not.toBeNull();
    expect(r2!).toBeLessThan(r1!);
  });

  it("inversion analytique coherente : W(t*) ≈ poidsObjectif", () => {
    const poidsObjectif = 500;
    const joursActuels = 0;
    const joursRestants = projeterDateRecolte(
      PARAMS_REFERENCE,
      poidsObjectif,
      joursActuels
    );
    expect(joursRestants).not.toBeNull();
    const tStar = joursActuels + joursRestants!;
    const poidsATStar = gompertzWeight(tStar, PARAMS_REFERENCE);
    // Le poids predit a t* doit etre tres proche de l'objectif
    expect(poidsATStar).toBeCloseTo(poidsObjectif, 0);
  });

  it("retourne un delai plausible pour un objectif realiste (500g, depart j0)", () => {
    // Pour Clarias, 500g entre j100 et j160 en conditions FAO
    const joursRestants = projeterDateRecolte(PARAMS_REFERENCE, 500, 0);
    expect(joursRestants).not.toBeNull();
    expect(joursRestants!).toBeGreaterThan(50);
    expect(joursRestants!).toBeLessThan(300);
  });

  it("retourne null quand poidsObjectif = 0 et wInfinity = 0", () => {
    // wInfinity <= poidsObjectif (0 <= 0) → null
    const params: GompertzParams = { wInfinity: 0, k: 0.018, ti: 95 };
    expect(projeterDateRecolte(params, 0, 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// genererCourbeGompertz — generation de points pour le graphe
// ---------------------------------------------------------------------------

describe("genererCourbeGompertz", () => {
  it("retourne le bon nombre de points avec pas=1", () => {
    // joursMax=10, pas=1 → jours 0,1,2,...,10 = 11 points
    const courbe = genererCourbeGompertz(PARAMS_REFERENCE, 10, 1);
    expect(courbe).toHaveLength(11);
  });

  it("retourne le bon nombre de points avec pas=7", () => {
    // joursMax=28, pas=7 → jours 0,7,14,21,28 = 5 points
    const courbe = genererCourbeGompertz(PARAMS_REFERENCE, 28, 7);
    expect(courbe).toHaveLength(5);
  });

  it("inclut un point final a joursMax quand joursMax n'est pas multiple du pas", () => {
    // joursMax=25, pas=7 → jours 0,7,14,21 + 25 = 5 points
    const courbe = genererCourbeGompertz(PARAMS_REFERENCE, 25, 7);
    const dernierJour = courbe[courbe.length - 1].jour;
    expect(dernierJour).toBe(25);
  });

  it("les points sont monotoniquement croissants en poids", () => {
    const courbe = genererCourbeGompertz(PARAMS_REFERENCE, 300, 10);
    for (let i = 1; i < courbe.length; i++) {
      expect(courbe[i].poids).toBeGreaterThan(courbe[i - 1].poids);
    }
  });

  it("le premier point correspond a gompertzWeight(0)", () => {
    const courbe = genererCourbeGompertz(PARAMS_REFERENCE, 200, 10);
    const premierPoint = courbe[0];
    expect(premierPoint.jour).toBe(0);
    expect(premierPoint.poids).toBeCloseTo(
      gompertzWeight(0, PARAMS_REFERENCE),
      10
    );
  });

  it("chaque poids correspond bien a gompertzWeight(jour, params)", () => {
    const courbe = genererCourbeGompertz(PARAMS_REFERENCE, 100, 20);
    for (const point of courbe) {
      expect(point.poids).toBeCloseTo(
        gompertzWeight(point.jour, PARAMS_REFERENCE),
        10
      );
    }
  });

  it("les jours sont dans l'ordre croissant", () => {
    const courbe = genererCourbeGompertz(PARAMS_REFERENCE, 200, 14);
    for (let i = 1; i < courbe.length; i++) {
      expect(courbe[i].jour).toBeGreaterThan(courbe[i - 1].jour);
    }
  });

  it("retourne un seul point quand joursMax = 0", () => {
    const courbe = genererCourbeGompertz(PARAMS_REFERENCE, 0, 10);
    expect(courbe).toHaveLength(1);
    expect(courbe[0].jour).toBe(0);
  });

  it("pas = joursMax → deux points (j0 et jMax)", () => {
    // joursMax=100, pas=100 → jours 0,100 = 2 points
    const courbe = genererCourbeGompertz(PARAMS_REFERENCE, 100, 100);
    expect(courbe).toHaveLength(2);
    expect(courbe[0].jour).toBe(0);
    expect(courbe[1].jour).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Niveaux de confiance — resolveConfidenceLevel (via calibrerGompertz)
// ---------------------------------------------------------------------------

describe("niveaux de confiance via calibrerGompertz", () => {
  it("< 5 points → null (pas de confidenceLevel, pas d'INSUFFICIENT_DATA en retour)", () => {
    for (let n = 0; n <= 4; n++) {
      const result = calibrerGompertz({
        points: FAO_CLARIAS_POINTS.slice(0, n),
      });
      // La fonction retourne null, pas un objet avec confidenceLevel="INSUFFICIENT_DATA"
      expect(result).toBeNull();
    }
  });

  it("5 points → confidenceLevel = LOW", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS.slice(0, 5) });
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("LOW");
    expect(result!.biometrieCount).toBe(5);
  });

  it("6 points → confidenceLevel = LOW", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS.slice(0, 6) });
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("LOW");
    expect(result!.biometrieCount).toBe(6);
  });

  it("7 points → confidenceLevel = MEDIUM", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS.slice(0, 7) });
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("MEDIUM");
    expect(result!.biometrieCount).toBe(7);
  });

  it("8 points → confidenceLevel = MEDIUM", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS.slice(0, 8) });
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("MEDIUM");
    expect(result!.biometrieCount).toBe(8);
  });

  it("9 points → confidenceLevel = MEDIUM", () => {
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS.slice(0, 9) });
    expect(result).not.toBeNull();
    expect(result!.confidenceLevel).toBe("MEDIUM");
    expect(result!.biometrieCount).toBe(9);
  });

  it("10+ points avec R² > 0.95 → confidenceLevel = HIGH", () => {
    // Le dataset FAO complet (15 points) donne R² > 0.95
    const result = calibrerGompertz({ points: FAO_CLARIAS_POINTS });
    expect(result).not.toBeNull();
    expect(result!.r2).toBeGreaterThan(0.95);
    expect(result!.confidenceLevel).toBe("HIGH");
    expect(result!.biometrieCount).toBe(15);
  });
});
