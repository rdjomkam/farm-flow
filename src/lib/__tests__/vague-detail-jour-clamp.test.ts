/**
 * Tests de regression pour le calcul du jour de biometrie relatif a la vague.
 *
 * Bug repro: Vague-26-03 (dateDebut = 2026-06-10 10:29:12), 4 biometries
 * enregistrees le 2026-06-10. Le calcul naif retournait jour = -1 car
 * "2026-06-10T00:00:00" (midnight local) < dateDebut(10:29 local). La boucle
 * for(j=0; j<=-1) ne s'executait pas → chart vide.
 *
 * Fix: normaliser vagueStartMs a minuit LOCAL + Math.max(0, ...).
 *
 * Note: les dates de vague sont stockees en UTC dans Postgres puis converties
 * via new Date() (local). Les dateKey de releves sont "YYYY-MM-DD" parsees en
 * minuit LOCAL via + "T00:00:00". On doit donc normaliser les deux a minuit
 * LOCAL pour que la comparaison soit coherente quelle que soit la timezone.
 */

import { describe, it, expect } from "vitest";
import { jourDepuisDebutVague } from "../calculs";

// Helper: construire une date locale a une heure donnee pour ce jour
function localDate(year: number, month: number, day: number, hour = 0, min = 0, sec = 0): Date {
  return new Date(year, month - 1, day, hour, min, sec, 0);
}

describe("jourDepuisDebutVague", () => {
  it("retourne 0 quand le releve est le meme jour que la vague, meme si avant l'heure de creation", () => {
    // Vague cree a 10:29 heure locale
    const vagueDebut = localDate(2026, 6, 10, 10, 29, 12);
    // Releve enregistre le meme jour (dateKey = "2026-06-10")
    expect(jourDepuisDebutVague(vagueDebut, "2026-06-10")).toBe(0);
  });

  it("retourne 0 pour un releve au meme moment que la vague", () => {
    const vagueDebut = localDate(2026, 6, 10, 10, 29, 12);
    expect(jourDepuisDebutVague(vagueDebut, localDate(2026, 6, 10, 10, 29, 12))).toBe(0);
  });

  it("retourne 1 pour un releve le lendemain", () => {
    const vagueDebut = localDate(2026, 6, 10, 10, 29, 12);
    expect(jourDepuisDebutVague(vagueDebut, "2026-06-11")).toBe(1);
  });

  it("retourne 7 pour un releve 7 jours apres", () => {
    const vagueDebut = localDate(2026, 6, 10, 0, 0, 0);
    expect(jourDepuisDebutVague(vagueDebut, "2026-06-17")).toBe(7);
  });

  it("retourne 0 (clamp) meme si le releve est avant la vague (cas edge)", () => {
    // Cas anormal: releve enregistre la veille — clamp a 0 par securite
    const vagueDebut = localDate(2026, 6, 10, 23, 59, 0);
    expect(jourDepuisDebutVague(vagueDebut, "2026-06-09")).toBe(0);
  });

  it("accepte un objet Date pour le releve", () => {
    const vagueDebut = localDate(2026, 6, 10, 10, 29, 12);
    const releveDate = localDate(2026, 6, 12, 8, 0, 0);
    expect(jourDepuisDebutVague(vagueDebut, releveDate)).toBe(2);
  });

  it("gere correctement une vague deja a minuit", () => {
    const vagueDebut = localDate(2026, 6, 10, 0, 0, 0);
    expect(jourDepuisDebutVague(vagueDebut, "2026-06-10")).toBe(0);
    expect(jourDepuisDebutVague(vagueDebut, "2026-06-11")).toBe(1);
  });

  it("cas Vague-26-03 exact: dateDebut 10:29 local, 4 biometries J0", () => {
    // Simulation exacte du bug produit
    const vagueDebut = localDate(2026, 6, 10, 10, 29, 12);
    const biometrieDateKey = "2026-06-10";

    const jour = jourDepuisDebutVague(vagueDebut, biometrieDateKey);

    // Avant le fix, jour = -1 → dernierJourObserve = -1 → boucle vide → chart vide
    // Apres le fix, jour = 0 → au moins 1 point dans poidsData
    expect(jour).toBeGreaterThanOrEqual(0);
    expect(jour).toBe(0);
  });
});
