/**
 * Tests d'integration i18n — Completude et parite (Sprint 42, Story 42.3)
 *
 * Objectifs :
 * - Pour chaque namespace (15 au total), verifier que toutes les cles fr existent en en
 * - Verifier que toutes les cles en existent en fr (symetrie)
 * - Verifier qu'aucune valeur n'est vide dans les deux locales
 * - Verifier que les interpolations {xxx} sont presentes dans les deux locales
 * - Couvrir tous les 15 namespaces : common, format, navigation, permissions, abonnements,
 *   settings, analytics, vagues, releves, stock, ventes, alevins, users, commissions, errors
 */

import { describe, it, expect } from "vitest";
import { namespaces } from "@/messages/index";

// ---------------------------------------------------------------------------
// Imports de tous les fichiers JSON fr et en
// ---------------------------------------------------------------------------

import frCommon from "@/messages/fr/common.json";
import enCommon from "@/messages/en/common.json";
import frFormat from "@/messages/fr/format.json";
import enFormat from "@/messages/en/format.json";
import frNavigation from "@/messages/fr/navigation.json";
import enNavigation from "@/messages/en/navigation.json";
import frPermissions from "@/messages/fr/permissions.json";
import enPermissions from "@/messages/en/permissions.json";
import frAbonnements from "@/messages/fr/abonnements.json";
import enAbonnements from "@/messages/en/abonnements.json";
import frSettings from "@/messages/fr/settings.json";
import enSettings from "@/messages/en/settings.json";
import frAnalytics from "@/messages/fr/analytics.json";
import enAnalytics from "@/messages/en/analytics.json";
import frVagues from "@/messages/fr/vagues.json";
import enVagues from "@/messages/en/vagues.json";
import frReleves from "@/messages/fr/releves.json";
import enReleves from "@/messages/en/releves.json";
import frStock from "@/messages/fr/stock.json";
import enStock from "@/messages/en/stock.json";
import frVentes from "@/messages/fr/ventes.json";
import enVentes from "@/messages/en/ventes.json";
import frAlevins from "@/messages/fr/alevins.json";
import enAlevins from "@/messages/en/alevins.json";
import frUsers from "@/messages/fr/users.json";
import enUsers from "@/messages/en/users.json";
import frCommissions from "@/messages/fr/commissions.json";
import enCommissions from "@/messages/en/commissions.json";
import frErrors from "@/messages/fr/errors.json";
import enErrors from "@/messages/en/errors.json";
import frActivites from "@/messages/fr/activites.json";
import enActivites from "@/messages/en/activites.json";
import frAdmin from "@/messages/fr/admin.json";
import enAdmin from "@/messages/en/admin.json";
import frAlertes from "@/messages/fr/alertes.json";
import enAlertes from "@/messages/en/alertes.json";
import frBackoffice from "@/messages/fr/backoffice.json";
import enBackoffice from "@/messages/en/backoffice.json";
import frBacs from "@/messages/fr/bacs.json";
import enBacs from "@/messages/en/bacs.json";
import frBesoins from "@/messages/fr/besoins.json";
import enBesoins from "@/messages/en/besoins.json";
import frCalibrage from "@/messages/fr/calibrage.json";
import enCalibrage from "@/messages/en/calibrage.json";
import frConfigElevage from "@/messages/fr/config-elevage.json";
import enConfigElevage from "@/messages/en/config-elevage.json";
import frDashboard from "@/messages/fr/dashboard.json";
import enDashboard from "@/messages/en/dashboard.json";
import frDepenses from "@/messages/fr/depenses.json";
import enDepenses from "@/messages/en/depenses.json";
import frIngenieur from "@/messages/fr/ingenieur.json";
import enIngenieur from "@/messages/en/ingenieur.json";
import frLayout from "@/messages/fr/layout.json";
import enLayout from "@/messages/en/layout.json";
import frNotes from "@/messages/fr/notes.json";
import enNotes from "@/messages/en/notes.json";
import frObservations from "@/messages/fr/observations.json";
import enObservations from "@/messages/en/observations.json";
import frPacks from "@/messages/fr/packs.json";
import enPacks from "@/messages/en/packs.json";
import frPlanning from "@/messages/fr/planning.json";
import enPlanning from "@/messages/en/planning.json";
import frPwa from "@/messages/fr/pwa.json";
import enPwa from "@/messages/en/pwa.json";
import frRemises from "@/messages/fr/remises.json";
import enRemises from "@/messages/en/remises.json";
import frSites from "@/messages/fr/sites.json";
import enSites from "@/messages/en/sites.json";
import frReproduction from "@/messages/fr/reproduction.json";
import enReproduction from "@/messages/en/reproduction.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extrait toutes les cles imbriquees d'un objet en notation pointee.
 * Exemple : { a: { b: "val" } } => ["a.b"]
 */
function extractKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

/**
 * Recupere une valeur par chemin pointe.
 */
function deepGet(obj: unknown, path: string): unknown {
  return path.split(".").reduce((cur, part) => {
    if (cur !== null && typeof cur === "object") {
      return (cur as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/**
 * Trouve les placeholders {xxx} dans une chaine.
 */
function findInterpolations(value: string): string[] {
  const matches = value.match(/\{(\w+)\}/g) ?? [];
  return matches.map((m) => m.slice(1, -1)).sort();
}

/**
 * Construit un index des cles avec interpolations pour un objet.
 * Retourne : Map<keyPath, string[]> des placeholders
 */
function buildInterpolationIndex(
  obj: Record<string, unknown>
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const keys = extractKeys(obj);
  for (const keyPath of keys) {
    const val = deepGet(obj, keyPath);
    if (typeof val === "string") {
      const interps = findInterpolations(val);
      if (interps.length > 0) {
        index.set(keyPath, interps);
      }
    }
  }
  return index;
}

// ---------------------------------------------------------------------------
// Registre des paires fr/en par namespace
// ---------------------------------------------------------------------------

const namespaceFiles: Record<
  string,
  { fr: Record<string, unknown>; en: Record<string, unknown> }
> = {
  common: { fr: frCommon as Record<string, unknown>, en: enCommon as Record<string, unknown> },
  format: { fr: frFormat as Record<string, unknown>, en: enFormat as Record<string, unknown> },
  navigation: { fr: frNavigation as Record<string, unknown>, en: enNavigation as Record<string, unknown> },
  permissions: { fr: frPermissions as Record<string, unknown>, en: enPermissions as Record<string, unknown> },
  abonnements: { fr: frAbonnements as Record<string, unknown>, en: enAbonnements as Record<string, unknown> },
  settings: { fr: frSettings as Record<string, unknown>, en: enSettings as Record<string, unknown> },
  analytics: { fr: frAnalytics as Record<string, unknown>, en: enAnalytics as Record<string, unknown> },
  vagues: { fr: frVagues as Record<string, unknown>, en: enVagues as Record<string, unknown> },
  releves: { fr: frReleves as Record<string, unknown>, en: enReleves as Record<string, unknown> },
  stock: { fr: frStock as Record<string, unknown>, en: enStock as Record<string, unknown> },
  ventes: { fr: frVentes as Record<string, unknown>, en: enVentes as Record<string, unknown> },
  alevins: { fr: frAlevins as Record<string, unknown>, en: enAlevins as Record<string, unknown> },
  users: { fr: frUsers as Record<string, unknown>, en: enUsers as Record<string, unknown> },
  commissions: { fr: frCommissions as Record<string, unknown>, en: enCommissions as Record<string, unknown> },
  errors: { fr: frErrors as Record<string, unknown>, en: enErrors as Record<string, unknown> },
  activites: { fr: frActivites as Record<string, unknown>, en: enActivites as Record<string, unknown> },
  admin: { fr: frAdmin as Record<string, unknown>, en: enAdmin as Record<string, unknown> },
  alertes: { fr: frAlertes as Record<string, unknown>, en: enAlertes as Record<string, unknown> },
  backoffice: { fr: frBackoffice as Record<string, unknown>, en: enBackoffice as Record<string, unknown> },
  bacs: { fr: frBacs as Record<string, unknown>, en: enBacs as Record<string, unknown> },
  besoins: { fr: frBesoins as Record<string, unknown>, en: enBesoins as Record<string, unknown> },
  calibrage: { fr: frCalibrage as Record<string, unknown>, en: enCalibrage as Record<string, unknown> },
  "config-elevage": { fr: frConfigElevage as Record<string, unknown>, en: enConfigElevage as Record<string, unknown> },
  dashboard: { fr: frDashboard as Record<string, unknown>, en: enDashboard as Record<string, unknown> },
  depenses: { fr: frDepenses as Record<string, unknown>, en: enDepenses as Record<string, unknown> },
  ingenieur: { fr: frIngenieur as Record<string, unknown>, en: enIngenieur as Record<string, unknown> },
  layout: { fr: frLayout as Record<string, unknown>, en: enLayout as Record<string, unknown> },
  notes: { fr: frNotes as Record<string, unknown>, en: enNotes as Record<string, unknown> },
  observations: { fr: frObservations as Record<string, unknown>, en: enObservations as Record<string, unknown> },
  packs: { fr: frPacks as Record<string, unknown>, en: enPacks as Record<string, unknown> },
  planning: { fr: frPlanning as Record<string, unknown>, en: enPlanning as Record<string, unknown> },
  pwa: { fr: frPwa as Record<string, unknown>, en: enPwa as Record<string, unknown> },
  remises: { fr: frRemises as Record<string, unknown>, en: enRemises as Record<string, unknown> },
  sites: { fr: frSites as Record<string, unknown>, en: enSites as Record<string, unknown> },
  reproduction: { fr: frReproduction as Record<string, unknown>, en: enReproduction as Record<string, unknown> },
};

// ---------------------------------------------------------------------------
// 1. Verification du registre des namespaces
// ---------------------------------------------------------------------------

describe("i18n — registre des namespaces (src/messages/index.ts)", () => {
  it("exporte un tableau namespaces", () => {
    expect(Array.isArray(namespaces)).toBe(true);
  });

  it("contient exactement 35 namespaces", () => {
    expect(namespaces).toHaveLength(35);
  });

  it("contient tous les namespaces Sprint 39 (common, format)", () => {
    expect(namespaces).toContain("common");
    expect(namespaces).toContain("format");
  });

  it("contient tous les namespaces Sprint 40 (navigation, permissions, abonnements, settings, analytics)", () => {
    expect(namespaces).toContain("navigation");
    expect(namespaces).toContain("permissions");
    expect(namespaces).toContain("abonnements");
    expect(namespaces).toContain("settings");
    expect(namespaces).toContain("analytics");
  });

  it("contient tous les namespaces Sprint 41 (errors, stock, ventes, vagues, releves, alevins, users, commissions)", () => {
    expect(namespaces).toContain("errors");
    expect(namespaces).toContain("stock");
    expect(namespaces).toContain("ventes");
    expect(namespaces).toContain("vagues");
    expect(namespaces).toContain("releves");
    expect(namespaces).toContain("alevins");
    expect(namespaces).toContain("users");
    expect(namespaces).toContain("commissions");
  });

  it("chaque namespace enregistre correspond a un fichier JSON charge", () => {
    for (const ns of namespaces) {
      expect(namespaceFiles).toHaveProperty(ns);
      const pair = namespaceFiles[ns];
      expect(pair.fr).toBeDefined();
      expect(pair.en).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Parite des cles fr/en pour chaque namespace
// ---------------------------------------------------------------------------

describe("i18n — parite des cles fr/en (tous namespaces)", () => {
  for (const ns of [
    "common", "format", "navigation", "permissions", "abonnements",
    "settings", "analytics", "vagues", "releves", "stock", "ventes",
    "alevins", "users", "commissions", "errors"
  ]) {
    it(`${ns} — les cles fr et en sont identiques`, () => {
      const { fr, en } = namespaceFiles[ns];
      const frKeys = extractKeys(fr);
      const enKeys = extractKeys(en);
      expect(enKeys).toEqual(frKeys);
    });

    it(`${ns} — fr et en ont le meme nombre de cles`, () => {
      const { fr, en } = namespaceFiles[ns];
      const frKeys = extractKeys(fr);
      const enKeys = extractKeys(en);
      expect(enKeys.length).toBe(frKeys.length);
    });

    it(`${ns} — aucune cle fr manque en en`, () => {
      const { fr, en } = namespaceFiles[ns];
      const frKeys = extractKeys(fr);
      const enKeys = new Set(extractKeys(en));
      const missingInEn = frKeys.filter((k) => !enKeys.has(k));
      expect(missingInEn).toHaveLength(0);
    });

    it(`${ns} — aucune cle en manque en fr`, () => {
      const { fr, en } = namespaceFiles[ns];
      const enKeys = extractKeys(en);
      const frKeys = new Set(extractKeys(fr));
      const missingInFr = enKeys.filter((k) => !frKeys.has(k));
      expect(missingInFr).toHaveLength(0);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Valeurs non vides dans les deux locales
// ---------------------------------------------------------------------------

describe("i18n — aucune valeur vide (tous namespaces)", () => {
  for (const ns of [
    "common", "format", "navigation", "permissions", "abonnements",
    "settings", "analytics", "vagues", "releves", "stock", "ventes",
    "alevins", "users", "commissions", "errors"
  ]) {
    it(`${ns}/fr — toutes les valeurs sont des strings non vides`, () => {
      const { fr } = namespaceFiles[ns];
      const frKeys = extractKeys(fr);
      for (const keyPath of frKeys) {
        const val = deepGet(fr, keyPath);
        expect(
          typeof val,
          `${ns}/fr — ${keyPath} doit etre une string`
        ).toBe("string");
        expect(
          (val as string).length,
          `${ns}/fr — ${keyPath} ne doit pas etre vide`
        ).toBeGreaterThan(0);
      }
    });

    it(`${ns}/en — toutes les valeurs sont des strings non vides`, () => {
      const { en } = namespaceFiles[ns];
      const enKeys = extractKeys(en);
      for (const keyPath of enKeys) {
        const val = deepGet(en, keyPath);
        expect(
          typeof val,
          `${ns}/en — ${keyPath} doit etre une string`
        ).toBe("string");
        expect(
          (val as string).length,
          `${ns}/en — ${keyPath} ne doit pas etre vide`
        ).toBeGreaterThan(0);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Parite des interpolations {xxx} entre fr et en
// ---------------------------------------------------------------------------

describe("i18n — parite des interpolations {xxx} (namespaces concernes)", () => {
  /**
   * Pour chaque cle ayant des interpolations en fr, verifier que la meme cle
   * en en contient les memes placeholders (meme ensemble, pas forcement meme ordre).
   */
  function assertInterpolationParity(
    ns: string,
    fr: Record<string, unknown>,
    en: Record<string, unknown>
  ): void {
    const frIndex = buildInterpolationIndex(fr);
    for (const [keyPath, frPlaceholders] of frIndex) {
      const enVal = deepGet(en, keyPath);
      expect(
        typeof enVal,
        `${ns}/en — ${keyPath} doit exister pour verifier les interpolations`
      ).toBe("string");
      const enPlaceholders = findInterpolations(enVal as string);
      expect(
        enPlaceholders.sort(),
        `${ns} — ${keyPath} : les interpolations doivent etre identiques en fr et en`
      ).toEqual(frPlaceholders.sort());
    }
  }

  it("format — dates.daysAgo contient {count} dans fr et en", () => {
    const frVal = deepGet(frFormat as Record<string, unknown>, "dates.daysAgo") as string;
    const enVal = deepGet(enFormat as Record<string, unknown>, "dates.daysAgo") as string;
    expect(frVal).toContain("{count}");
    expect(enVal).toContain("{count}");
  });

  it("format — parite complete des interpolations fr/en", () => {
    assertInterpolationParity("format", frFormat as Record<string, unknown>, enFormat as Record<string, unknown>);
  });

  it("abonnements — banner.graceMessage contient {days} dans fr et en", () => {
    const frVal = deepGet(frAbonnements as Record<string, unknown>, "banner.graceMessage") as string;
    const enVal = deepGet(enAbonnements as Record<string, unknown>, "banner.graceMessage") as string;
    expect(frVal).toContain("{days}");
    expect(enVal).toContain("{days}");
  });

  it("abonnements — expire.graceMessage contient {daysRemaining} et {plural} dans fr et en", () => {
    const frVal = deepGet(frAbonnements as Record<string, unknown>, "expire.graceMessage") as string;
    const enVal = deepGet(enAbonnements as Record<string, unknown>, "expire.graceMessage") as string;
    expect(frVal).toContain("{daysRemaining}");
    expect(frVal).toContain("{plural}");
    expect(enVal).toContain("{daysRemaining}");
    expect(enVal).toContain("{plural}");
  });

  it("abonnements — parite complete des interpolations fr/en", () => {
    assertInterpolationParity("abonnements", frAbonnements as Record<string, unknown>, enAbonnements as Record<string, unknown>);
  });

  it("errors — validation.fieldRequired contient {field} dans fr et en", () => {
    const frVal = deepGet(frErrors as Record<string, unknown>, "validation.fieldRequired") as string;
    const enVal = deepGet(enErrors as Record<string, unknown>, "validation.fieldRequired") as string;
    expect(frVal).toContain("{field}");
    expect(enVal).toContain("{field}");
  });

  it("errors — parite complete des interpolations fr/en", () => {
    assertInterpolationParity("errors", frErrors as Record<string, unknown>, enErrors as Record<string, unknown>);
  });

  it("analytics — indicators.criticalCount contient {count} dans fr et en", () => {
    const frVal = deepGet(frAnalytics as Record<string, unknown>, "indicators.criticalCount") as string;
    const enVal = deepGet(enAnalytics as Record<string, unknown>, "indicators.criticalCount") as string;
    expect(frVal).toContain("{count}");
    expect(enVal).toContain("{count}");
  });

  it("analytics — parite complete des interpolations fr/en", () => {
    assertInterpolationParity("analytics", frAnalytics as Record<string, unknown>, enAnalytics as Record<string, unknown>);
  });

  it("vagues — card.bac contient {count} dans fr et en", () => {
    const frVal = deepGet(frVagues as Record<string, unknown>, "card.bac") as string;
    const enVal = deepGet(enVagues as Record<string, unknown>, "card.bac") as string;
    expect(frVal).toContain("{count}");
    expect(enVal).toContain("{count}");
  });

  it("vagues — detail.alevins contient {count} et {poids} dans fr et en", () => {
    const frVal = deepGet(frVagues as Record<string, unknown>, "detail.alevins") as string;
    const enVal = deepGet(enVagues as Record<string, unknown>, "detail.alevins") as string;
    expect(frVal).toContain("{count}");
    expect(frVal).toContain("{poids}");
    expect(enVal).toContain("{count}");
    expect(enVal).toContain("{poids}");
  });

  it("vagues — form.close.title contient {code} dans fr et en", () => {
    const frVal = deepGet(frVagues as Record<string, unknown>, "form.close.title") as string;
    const enVal = deepGet(enVagues as Record<string, unknown>, "form.close.title") as string;
    expect(frVal).toContain("{code}");
    expect(enVal).toContain("{code}");
  });

  it("vagues — parite complete des interpolations fr/en", () => {
    assertInterpolationParity("vagues", frVagues as Record<string, unknown>, enVagues as Record<string, unknown>);
  });

  it("releves — list.title contient {count} dans fr et en", () => {
    const frVal = deepGet(frReleves as Record<string, unknown>, "list.title") as string;
    const enVal = deepGet(enReleves as Record<string, unknown>, "list.title") as string;
    expect(frVal).toContain("{count}");
    expect(enVal).toContain("{count}");
  });

  it("releves — modifications.minutesAgo contient {count} dans fr et en", () => {
    const frVal = deepGet(frReleves as Record<string, unknown>, "modifications.minutesAgo") as string;
    const enVal = deepGet(enReleves as Record<string, unknown>, "modifications.minutesAgo") as string;
    expect(frVal).toContain("{count}");
    expect(enVal).toContain("{count}");
  });

  it("releves — parite complete des interpolations fr/en", () => {
    assertInterpolationParity("releves", frReleves as Record<string, unknown>, enReleves as Record<string, unknown>);
  });

  it("stock — alertes.title contient {count} dans fr et en", () => {
    const frVal = deepGet(frStock as Record<string, unknown>, "alertes.title") as string;
    const enVal = deepGet(enStock as Record<string, unknown>, "alertes.title") as string;
    expect(frVal).toContain("{count}");
    expect(enVal).toContain("{count}");
  });

  it("stock — produits.fields.contenance contient {baseUnit} et {achatUnit} dans fr et en", () => {
    const frVal = deepGet(frStock as Record<string, unknown>, "produits.fields.contenance") as string;
    const enVal = deepGet(enStock as Record<string, unknown>, "produits.fields.contenance") as string;
    expect(frVal).toContain("{baseUnit}");
    expect(frVal).toContain("{achatUnit}");
    expect(enVal).toContain("{baseUnit}");
    expect(enVal).toContain("{achatUnit}");
  });

  it("stock — parite complete des interpolations fr/en", () => {
    assertInterpolationParity("stock", frStock as Record<string, unknown>, enStock as Record<string, unknown>);
  });

  it("ventes — ventes.form.vagueOption contient {code} et {count} dans fr et en", () => {
    const frVal = deepGet(frVentes as Record<string, unknown>, "ventes.form.vagueOption") as string;
    const enVal = deepGet(enVentes as Record<string, unknown>, "ventes.form.vagueOption") as string;
    expect(frVal).toContain("{code}");
    expect(frVal).toContain("{count}");
    expect(enVal).toContain("{code}");
    expect(enVal).toContain("{count}");
  });

  it("ventes — parite complete des interpolations fr/en", () => {
    assertInterpolationParity("ventes", frVentes as Record<string, unknown>, enVentes as Record<string, unknown>);
  });

  it("alevins — reproducteurs.detail.confirmDelete contient {code} dans fr et en", () => {
    const frVal = deepGet(frAlevins as Record<string, unknown>, "reproducteurs.detail.confirmDelete") as string;
    const enVal = deepGet(enAlevins as Record<string, unknown>, "reproducteurs.detail.confirmDelete") as string;
    expect(frVal).toContain("{code}");
    expect(enVal).toContain("{code}");
  });

  it("alevins — lots.transfert.description contient {count} dans fr et en", () => {
    const frVal = deepGet(frAlevins as Record<string, unknown>, "lots.transfert.description") as string;
    const enVal = deepGet(enAlevins as Record<string, unknown>, "lots.transfert.description") as string;
    expect(frVal).toContain("{count}");
    expect(enVal).toContain("{count}");
  });

  it("alevins — parite complete des interpolations fr/en", () => {
    assertInterpolationParity("alevins", frAlevins as Record<string, unknown>, enAlevins as Record<string, unknown>);
  });

  it("users — profile.desactiverDescription contient {name} dans fr et en", () => {
    const frVal = deepGet(frUsers as Record<string, unknown>, "profile.desactiverDescription") as string;
    const enVal = deepGet(enUsers as Record<string, unknown>, "profile.desactiverDescription") as string;
    expect(frVal).toContain("{name}");
    expect(enVal).toContain("{name}");
  });

  it("users — parite complete des interpolations fr/en", () => {
    assertInterpolationParity("users", frUsers as Record<string, unknown>, enUsers as Record<string, unknown>);
  });

  it("commissions — commissions.taux contient {rate} dans fr et en", () => {
    const frVal = deepGet(frCommissions as Record<string, unknown>, "commissions.taux") as string;
    const enVal = deepGet(enCommissions as Record<string, unknown>, "commissions.taux") as string;
    expect(frVal).toContain("{rate}");
    expect(enVal).toContain("{rate}");
  });

  it("commissions — admin.vers contient {phone} et {provider} dans fr et en", () => {
    const frVal = deepGet(frCommissions as Record<string, unknown>, "admin.vers") as string;
    const enVal = deepGet(enCommissions as Record<string, unknown>, "admin.vers") as string;
    expect(frVal).toContain("{phone}");
    expect(frVal).toContain("{provider}");
    expect(enVal).toContain("{phone}");
    expect(enVal).toContain("{provider}");
  });

  it("commissions — parite complete des interpolations fr/en", () => {
    assertInterpolationParity("commissions", frCommissions as Record<string, unknown>, enCommissions as Record<string, unknown>);
  });
});

// ---------------------------------------------------------------------------
// 5. Coherence metier entre namespaces
// ---------------------------------------------------------------------------

describe("i18n — coherence metier cross-namespace (Sprint 39-42)", () => {
  it("FCR->ICA coherent : analytics.labels.fcr='ICA' en fr", () => {
    const val = deepGet(frAnalytics as Record<string, unknown>, "labels.fcr");
    expect(val).toBe("ICA");
  });

  it("FCR->ICA coherent : analytics.labels.fcr='FCR' en en", () => {
    const val = deepGet(enAnalytics as Record<string, unknown>, "labels.fcr");
    expect(val).toBe("FCR");
  });

  it("SGR->TCS coherent : analytics.labels.sgr='TCS' en fr", () => {
    const val = deepGet(frAnalytics as Record<string, unknown>, "labels.sgr");
    expect(val).toBe("TCS");
  });

  it("SGR->TCS coherent : analytics.labels.sgr='SGR' en en", () => {
    const val = deepGet(enAnalytics as Record<string, unknown>, "labels.sgr");
    expect(val).toBe("SGR");
  });

  it("FCR->ICA coherent dans vagues.indicateurs.fcr en fr", () => {
    const val = deepGet(frVagues as Record<string, unknown>, "indicateurs.fcr");
    expect(val).toBe("ICA");
  });

  it("FCR->ICA coherent dans vagues.indicateurs.fcr en en", () => {
    const val = deepGet(enVagues as Record<string, unknown>, "indicateurs.fcr");
    expect(val).toBe("FCR");
  });

  it("SGR->TCS coherent dans vagues.indicateurs.sgr en fr", () => {
    const val = deepGet(frVagues as Record<string, unknown>, "indicateurs.sgr");
    expect(val).toBe("TCS");
  });

  it("SGR->TCS coherent dans vagues.indicateurs.sgr en en", () => {
    const val = deepGet(enVagues as Record<string, unknown>, "indicateurs.sgr");
    expect(val).toBe("SGR");
  });

  it("settings.triggers.FCR_ELEVE contient 'ICA' en fr", () => {
    const val = deepGet(frSettings as Record<string, unknown>, "triggers.FCR_ELEVE") as string;
    expect(val).toContain("ICA");
  });

  it("settings.triggers.FCR_ELEVE contient 'FCR' en en", () => {
    const val = deepGet(enSettings as Record<string, unknown>, "triggers.FCR_ELEVE") as string;
    expect(val).toContain("FCR");
  });

  it("errors.conflict.bacAlreadyAssigned est present (regle metier : bac unique par vague)", () => {
    const frVal = deepGet(frErrors as Record<string, unknown>, "conflict.bacAlreadyAssigned");
    const enVal = deepGet(enErrors as Record<string, unknown>, "conflict.bacAlreadyAssigned");
    expect(typeof frVal).toBe("string");
    expect(typeof enVal).toBe("string");
    expect((frVal as string).length).toBeGreaterThan(0);
    expect((enVal as string).length).toBeGreaterThan(0);
  });

  it("errors.auth.unauthorized est present dans fr et en", () => {
    const frVal = deepGet(frErrors as Record<string, unknown>, "auth.unauthorized");
    const enVal = deepGet(enErrors as Record<string, unknown>, "auth.unauthorized");
    expect(typeof frVal).toBe("string");
    expect(typeof enVal).toBe("string");
  });

  it("releves.types couvre les 6 types metier en fr", () => {
    const types = deepGet(frReleves as Record<string, unknown>, "types") as Record<string, unknown>;
    expect(types).toHaveProperty("BIOMETRIE");
    expect(types).toHaveProperty("MORTALITE");
    expect(types).toHaveProperty("ALIMENTATION");
    expect(types).toHaveProperty("QUALITE_EAU");
    expect(types).toHaveProperty("COMPTAGE");
    expect(types).toHaveProperty("OBSERVATION");
  });

  it("releves.types couvre les 6 types metier en en", () => {
    const types = deepGet(enReleves as Record<string, unknown>, "types") as Record<string, unknown>;
    expect(types).toHaveProperty("BIOMETRIE");
    expect(types).toHaveProperty("MORTALITE");
    expect(types).toHaveProperty("ALIMENTATION");
    expect(types).toHaveProperty("QUALITE_EAU");
    expect(types).toHaveProperty("COMPTAGE");
    expect(types).toHaveProperty("OBSERVATION");
  });

  it("vagues.statuts couvre EN_COURS, TERMINEE, ANNULEE en fr et en", () => {
    const frStatuts = deepGet(frVagues as Record<string, unknown>, "statuts") as Record<string, unknown>;
    const enStatuts = deepGet(enVagues as Record<string, unknown>, "statuts") as Record<string, unknown>;
    expect(frStatuts).toHaveProperty("EN_COURS");
    expect(frStatuts).toHaveProperty("TERMINEE");
    expect(frStatuts).toHaveProperty("ANNULEE");
    expect(enStatuts).toHaveProperty("EN_COURS");
    expect(enStatuts).toHaveProperty("TERMINEE");
    expect(enStatuts).toHaveProperty("ANNULEE");
  });

  it("abonnements.plans contient DECOUVERTE, INGENIEUR_PRO en fr et en", () => {
    const frPlans = deepGet(frAbonnements as Record<string, unknown>, "plans") as Record<string, unknown>;
    const enPlans = deepGet(enAbonnements as Record<string, unknown>, "plans") as Record<string, unknown>;
    expect(frPlans).toHaveProperty("DECOUVERTE");
    expect(frPlans).toHaveProperty("INGENIEUR_PRO");
    expect(enPlans).toHaveProperty("DECOUVERTE");
    expect(enPlans).toHaveProperty("INGENIEUR_PRO");
  });

  it("navigation.roles couvre admin, gerant, pisciculteur, ingenieur en fr et en", () => {
    const frRoles = deepGet(frNavigation as Record<string, unknown>, "roles") as Record<string, unknown>;
    const enRoles = deepGet(enNavigation as Record<string, unknown>, "roles") as Record<string, unknown>;
    expect(frRoles).toHaveProperty("admin");
    expect(frRoles).toHaveProperty("gerant");
    expect(frRoles).toHaveProperty("pisciculteur");
    expect(frRoles).toHaveProperty("ingenieur");
    expect(enRoles).toHaveProperty("admin");
    expect(enRoles).toHaveProperty("gerant");
    expect(enRoles).toHaveProperty("pisciculteur");
    expect(enRoles).toHaveProperty("ingenieur");
  });

  it("format.price.free = 'Gratuit' en fr et 'Free' en en", () => {
    const frVal = deepGet(frFormat as Record<string, unknown>, "price.free");
    const enVal = deepGet(enFormat as Record<string, unknown>, "price.free");
    expect(frVal).toBe("Gratuit");
    expect(enVal).toBe("Free");
  });

  it("format.units.currency = 'FCFA' dans fr et en (invariant monetaire)", () => {
    const frVal = deepGet(frFormat as Record<string, unknown>, "units.currency");
    const enVal = deepGet(enFormat as Record<string, unknown>, "units.currency");
    expect(frVal).toBe("FCFA");
    expect(enVal).toBe("FCFA");
  });

  it("abonnements.providers.MTN_MOMO = 'MTN Mobile Money' dans fr et en (nom de marque)", () => {
    const frVal = deepGet(frAbonnements as Record<string, unknown>, "providers.MTN_MOMO");
    const enVal = deepGet(enAbonnements as Record<string, unknown>, "providers.MTN_MOMO");
    expect(frVal).toBe("MTN Mobile Money");
    expect(enVal).toBe("MTN Mobile Money");
  });

  it("navigation.items.dashboard = 'Dashboard' dans fr et en (terme technique universel)", () => {
    const frVal = deepGet(frNavigation as Record<string, unknown>, "items.dashboard");
    const enVal = deepGet(enNavigation as Record<string, unknown>, "items.dashboard");
    expect(frVal).toBe("Dashboard");
    expect(enVal).toBe("Dashboard");
  });
});

// ---------------------------------------------------------------------------
// 6. Couverture globale — tableau de synthese
// ---------------------------------------------------------------------------

describe("i18n — couverture globale Sprint 39-42", () => {
  it("tous les 35 namespaces ont des fichiers fr et en non vides", () => {
    for (const ns of namespaces) {
      const { fr, en } = namespaceFiles[ns];
      const frKeys = extractKeys(fr);
      const enKeys = extractKeys(en);
      expect(frKeys.length, `${ns}/fr doit avoir des cles`).toBeGreaterThan(0);
      expect(enKeys.length, `${ns}/en doit avoir des cles`).toBeGreaterThan(0);
    }
  });

  it("le nombre total de cles couvre l'integralite des 35 namespaces (>= 2500 cles fr)", () => {
    let totalFrKeys = 0;
    for (const ns of namespaces) {
      const { fr } = namespaceFiles[ns];
      totalFrKeys += extractKeys(fr).length;
    }
    // Les 35 namespaces representent au minimum 2500 cles
    expect(totalFrKeys).toBeGreaterThanOrEqual(2500);
  });

  it("chaque namespace a au moins 5 cles feuilles (completude minimale)", () => {
    for (const ns of namespaces) {
      const { fr } = namespaceFiles[ns];
      const frKeys = extractKeys(fr);
      expect(
        frKeys.length,
        `${ns}/fr doit avoir au moins 5 cles`
      ).toBeGreaterThanOrEqual(5);
    }
  });

  it("namespaces Sprint 39 (common, format) ont leur parité validee", () => {
    for (const ns of ["common", "format"]) {
      const { fr, en } = namespaceFiles[ns];
      expect(extractKeys(fr)).toEqual(extractKeys(en));
    }
  });

  it("namespaces Sprint 40 (navigation, permissions, abonnements, settings, analytics) ont leur parité validee", () => {
    for (const ns of ["navigation", "permissions", "abonnements", "settings", "analytics"]) {
      const { fr, en } = namespaceFiles[ns];
      expect(extractKeys(fr)).toEqual(extractKeys(en));
    }
  });

  it("namespaces Sprint 41 (errors, stock, ventes, vagues, releves, alevins, users, commissions) ont leur parité validee", () => {
    for (const ns of ["errors", "stock", "ventes", "vagues", "releves", "alevins", "users", "commissions"]) {
      const { fr, en } = namespaceFiles[ns];
      expect(extractKeys(fr)).toEqual(extractKeys(en));
    }
  });
});
