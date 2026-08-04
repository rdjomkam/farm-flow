/**
 * src/lib/previsions/__tests__/tableau-de-bord-helpers.test.ts
 *
 * Tests unitaires — story PR2.4 (tableau de bord Previsions), verification
 * par le @tester. Couvre `calculerTresorerieActuelle` (le point le plus
 * delicat : jamais un chiffre invente hors de l'horizon du plan) et
 * `libelleMoisCalendaire` (passage d'annee inclus).
 */
import { describe, it, expect } from "vitest";
import {
  calculerTresorerieActuelle,
  libelleMoisCalendaire,
  moisAbsoluDepuis,
  type MoisSoldeEntry,
} from "../tableau-de-bord-helpers";

describe("calculerTresorerieActuelle", () => {
  const dateDebutPlan = new Date(2026, 0, 1); // janvier 2026
  const horizonMois = 21; // jeu d'or : 21 mois, moisAbsolu 0..20

  function serie(soldes: number[]): MoisSoldeEntry[] {
    return soldes.map((soldeFCFA, moisAbsolu) => ({ moisAbsolu, soldeFCFA }));
  }

  it("mois courant AU DEBUT de l'horizon (moisAbsolu = 0)", () => {
    const aujourdHui = new Date(2026, 0, 15); // toujours janvier 2026
    const mois = serie([1000000, 900000, 800000]);
    const result = calculerTresorerieActuelle(dateDebutPlan, horizonMois, mois, aujourdHui);

    expect(result.statut).toBe("disponible");
    expect(result.moisAbsolu).toBe(0);
    expect(result.soldeFCFA).toBe(1000000);
  });

  it("mois courant AU MILIEU de l'horizon", () => {
    // Mois strictement au milieu de 0..20 : moisAbsolu = 10 (novembre 2026).
    const milieu = new Date(2026, 10, 1); // novembre 2026 -> moisAbsolu 10
    const mois = serie(Array.from({ length: 21 }, (_, i) => 500000 - i * 10000));
    const result = calculerTresorerieActuelle(dateDebutPlan, horizonMois, mois, milieu);

    expect(result.statut).toBe("disponible");
    expect(result.moisAbsolu).toBe(10);
    expect(result.soldeFCFA).toBe(500000 - 10 * 10000);
  });

  it("mois courant A LA FIN EXACTE de l'horizon (dernier mois inclus, moisAbsolu = horizonMois - 1)", () => {
    const dernierMois = new Date(2027, 8, 1); // horizonMois=21 -> dernier index 20 -> +20 mois depuis janv 2026 = sept 2027
    const mois = serie(Array.from({ length: 21 }, (_, i) => 100000 + i));
    const result = calculerTresorerieActuelle(dateDebutPlan, horizonMois, mois, dernierMois);

    expect(moisAbsoluDepuis(dateDebutPlan, dernierMois)).toBe(20);
    expect(result.statut).toBe("disponible");
    expect(result.moisAbsolu).toBe(20);
    expect(result.soldeFCFA).toBe(100000 + 20);
  });

  it("mois courant AVANT dateDebutPlan (plan futur) -> statut avant_horizon, aucun chiffre", () => {
    const avant = new Date(2025, 5, 1); // juin 2025, avant janvier 2026
    const mois = serie([1000000, 900000]);
    const result = calculerTresorerieActuelle(dateDebutPlan, horizonMois, mois, avant);

    expect(result.statut).toBe("avant_horizon");
    expect(result.moisAbsolu).toBeNull();
    expect(result.soldeFCFA).toBeNull();
  });

  it("mois courant APRES la fin de l'horizon (plan perime) -> statut apres_horizon, aucun chiffre", () => {
    const apres = new Date(2030, 0, 1); // largement apres l'horizon de 21 mois
    const mois = serie(Array.from({ length: 21 }, (_, i) => 100000 + i));
    const result = calculerTresorerieActuelle(dateDebutPlan, horizonMois, mois, apres);

    expect(result.statut).toBe("apres_horizon");
    expect(result.moisAbsolu).toBeNull();
    expect(result.soldeFCFA).toBeNull();
  });

  it("serie mensuelle VIDE mais moisCourant dans l'horizon nominal -> repli defensif apres_horizon, jamais un crash ni 0 invente", () => {
    const dansHorizon = new Date(2026, 5, 1); // moisAbsolu 5, < horizonMois=21
    const result = calculerTresorerieActuelle(dateDebutPlan, horizonMois, [], dansHorizon);

    // Aucune entree ne correspond au moisAbsolu demande dans une serie vide :
    // le helper ne doit JAMAIS renvoyer 0 FCFA comme si c'etait une vraie
    // valeur — il retombe sur un statut explicite.
    expect(result.statut).not.toBe("disponible");
    expect(result.soldeFCFA).toBeNull();
    expect(result.moisAbsolu).toBeNull();
  });

  it("serie mensuelle VIDE et horizonMois = 0 -> hors horizon (apres_horizon), jamais un acces hors bornes", () => {
    const result = calculerTresorerieActuelle(dateDebutPlan, 0, [], new Date(2026, 2, 1));
    expect(result.statut).toBe("apres_horizon");
    expect(result.soldeFCFA).toBeNull();
  });

  it("jamais de soldeFCFA = 0 invente pour un mois hors bornes de la serie (repli defensif, meme si moisCourant < horizonMois)", () => {
    // Serie partielle : seuls les mois 0..4 sont fournis, horizonMois annonce 21
    // (cas defensif documente en commentaire du helper — ne devrait pas arriver
    // en production, mais ne doit jamais produire un solde fictif).
    const serieePartielle = serie([1000, 2000, 3000, 4000, 5000]);
    const moisHorsSerieMaisDansHorizon = new Date(2026, 9, 1); // moisAbsolu 9, < 21 mais absent de la serie
    const result = calculerTresorerieActuelle(dateDebutPlan, horizonMois, serieePartielle, moisHorsSerieMaisDansHorizon);

    expect(result.statut).toBe("apres_horizon");
    expect(result.soldeFCFA).toBeNull();
    expect(result.soldeFCFA).not.toBe(0);
  });

  it("point bas negatif nominal (jeu d'or annexe B) reste lisible via une entree de serie a ce mois", () => {
    // -6 334 704 FCFA en novembre 2026 (moisAbsolu 10 depuis janvier 2026)
    const mois = serie(Array.from({ length: 21 }, (_, i) => (i === 10 ? -6334704 : 100000)));
    const result = calculerTresorerieActuelle(dateDebutPlan, horizonMois, mois, new Date(2026, 10, 15));

    expect(result.statut).toBe("disponible");
    expect(result.soldeFCFA).toBe(-6334704);
    expect(result.moisAbsolu).toBe(10);
  });
});

describe("libelleMoisCalendaire", () => {
  it("mois 0 = dateDebutPlan elle-meme", () => {
    const debut = new Date(2026, 0, 1); // janvier 2026
    expect(libelleMoisCalendaire(debut, 0)).toMatch(/janv/);
    expect(libelleMoisCalendaire(debut, 0)).toContain("2026");
  });

  it("passage d'annee : decembre -> janvier de l'annee suivante", () => {
    const debut = new Date(2026, 0, 1); // janvier 2026
    const libelleDecembre = libelleMoisCalendaire(debut, 11); // decembre 2026
    const libelleJanvierSuivant = libelleMoisCalendaire(debut, 12); // janvier 2027

    expect(libelleDecembre).toMatch(/dec/);
    expect(libelleDecembre).toContain("2026");
    expect(libelleJanvierSuivant).toMatch(/janv/);
    expect(libelleJanvierSuivant).toContain("2027");
  });

  it("libelle est un texte francais lisible, jamais un index numerique brut de mois", () => {
    const debut = new Date(2026, 0, 1);
    const libelle = libelleMoisCalendaire(debut, 10); // novembre 2026
    expect(libelle).toMatch(/nov/i);
    expect(libelle).toContain("2026");
    // Ne doit jamais ressembler a un simple "Mois 10" ou "10"
    expect(libelle).not.toBe("10");
    expect(libelle).not.toMatch(/^Mois \d+$/);
  });

  it("dateDebutPlan elle-meme au milieu d'un mois civil (jour > 1) ne decale pas le mois calcule", () => {
    const debut = new Date(2026, 2, 17); // 17 mars 2026
    expect(libelleMoisCalendaire(debut, 0)).toMatch(/mars/);
    expect(libelleMoisCalendaire(debut, 1)).toMatch(/avr/);
  });
});

describe("moisAbsoluDepuis (reexporte, non modifie) — sanite de la reexportation", () => {
  it("0 pour la meme date que dateDebutPlan", () => {
    const d = new Date(2026, 3, 1);
    expect(moisAbsoluDepuis(d, d)).toBe(0);
  });

  it("negatif quand la date est avant dateDebutPlan", () => {
    expect(moisAbsoluDepuis(new Date(2026, 3, 1), new Date(2026, 0, 1))).toBe(-3);
  });
});
