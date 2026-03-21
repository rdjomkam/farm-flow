/**
 * Tests i18n — Sprint 40 : namespaces navigation, permissions, abonnements, settings, analytics
 *
 * Couvre :
 * - Chaque fichier JSON fr et en charge correctement
 * - Parité de clés fr/en pour chaque namespace
 * - Sections obligatoires présentes
 * - Valeurs non vides
 * - Traductions fr vs en différentes pour les chaînes localisées
 * - Clés métier critiques présentes (FCR→ICA, SGR→TCS, rôles, plans)
 */

import { describe, it, expect } from "vitest";
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

// ---------------------------------------------------------------------------
// Helper — extrait toutes les clés imbriquées en notation pointée
// ---------------------------------------------------------------------------

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

function deepGet(obj: unknown, path: string): unknown {
  return path.split(".").reduce((cur, part) => {
    if (cur !== null && typeof cur === "object") {
      return (cur as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

// ---------------------------------------------------------------------------
// 40.1 — navigation.json
// ---------------------------------------------------------------------------

describe("navigation.json — chargement (Sprint 40.1)", () => {
  it("fr/navigation.json charge et est un objet", () => {
    expect(frNavigation).toBeDefined();
    expect(typeof frNavigation).toBe("object");
    expect(frNavigation).not.toBeNull();
  });

  it("en/navigation.json charge et est un objet", () => {
    expect(enNavigation).toBeDefined();
    expect(typeof enNavigation).toBe("object");
    expect(enNavigation).not.toBeNull();
  });

  it("fr/navigation.json contient la section 'modules'", () => {
    expect(frNavigation).toHaveProperty("modules");
  });

  it("fr/navigation.json contient la section 'items'", () => {
    expect(frNavigation).toHaveProperty("items");
  });

  it("fr/navigation.json contient la section 'roles'", () => {
    expect(frNavigation).toHaveProperty("roles");
  });

  it("fr/navigation.json contient la section 'actions'", () => {
    expect(frNavigation).toHaveProperty("actions");
  });

  it("en/navigation.json contient les mêmes sections de premier niveau que fr", () => {
    expect(Object.keys(enNavigation).sort()).toEqual(Object.keys(frNavigation).sort());
  });
});

describe("navigation.json — parité de clés fr/en (Sprint 40.1)", () => {
  it("fr et en ont exactement les mêmes clés imbriquées", () => {
    const frKeys = extractKeys(frNavigation as Record<string, unknown>);
    const enKeys = extractKeys(enNavigation as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("modules.grossissement est différent en fr et en", () => {
    const frVal = deepGet(frNavigation, "modules.grossissement") as string;
    const enVal = deepGet(enNavigation, "modules.grossissement") as string;
    expect(frVal).toBeDefined();
    expect(enVal).toBeDefined();
    expect(frVal).not.toBe(enVal);
  });

  it("modules.ingenieur est non vide en fr", () => {
    const val = deepGet(frNavigation, "modules.ingenieur") as string;
    expect(typeof val).toBe("string");
    expect(val.length).toBeGreaterThan(0);
  });

  it("actions.logout est 'Se déconnecter' en fr", () => {
    const val = deepGet(frNavigation, "actions.logout") as string;
    expect(val).toBe("Se déconnecter");
  });

  it("actions.logout est 'Log out' en en", () => {
    const val = deepGet(enNavigation, "actions.logout") as string;
    expect(val).toBe("Log out");
  });

  it("roles.admin est 'Administrateur' en fr", () => {
    const val = deepGet(frNavigation, "roles.admin") as string;
    expect(val).toBe("Administrateur");
  });

  it("roles.admin est 'Administrator' en en", () => {
    const val = deepGet(enNavigation, "roles.admin") as string;
    expect(val).toBe("Administrator");
  });

  it("items.vagues est non vide en fr", () => {
    const val = deepGet(frNavigation, "items.vagues") as string;
    expect(typeof val).toBe("string");
    expect(val.length).toBeGreaterThan(0);
  });

  it("items.dashboard a la même valeur en fr et en (terme technique universel)", () => {
    const frVal = deepGet(frNavigation, "items.dashboard") as string;
    const enVal = deepGet(enNavigation, "items.dashboard") as string;
    expect(frVal).toBe("Dashboard");
    expect(enVal).toBe("Dashboard");
  });

  it("aucune valeur fr/navigation n'est vide", () => {
    const frKeys = extractKeys(frNavigation as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frNavigation, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en/navigation n'est vide", () => {
    const enKeys = extractKeys(enNavigation as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const val = deepGet(enNavigation, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 40.2 — permissions.json
// ---------------------------------------------------------------------------

describe("permissions.json — chargement (Sprint 40.2)", () => {
  it("fr/permissions.json charge et est un objet", () => {
    expect(frPermissions).toBeDefined();
    expect(typeof frPermissions).toBe("object");
  });

  it("en/permissions.json charge et est un objet", () => {
    expect(enPermissions).toBeDefined();
    expect(typeof enPermissions).toBe("object");
  });

  it("fr/permissions.json contient la section 'groups'", () => {
    expect(frPermissions).toHaveProperty("groups");
  });

  it("fr/permissions.json contient la section 'permissions'", () => {
    expect(frPermissions).toHaveProperty("permissions");
  });

  it("fr/permissions.json contient la section 'roles'", () => {
    expect(frPermissions).toHaveProperty("roles");
  });

  it("en/permissions.json contient les mêmes sections de premier niveau que fr", () => {
    expect(Object.keys(enPermissions).sort()).toEqual(Object.keys(frPermissions).sort());
  });
});

describe("permissions.json — parité de clés fr/en (Sprint 40.2)", () => {
  it("fr et en ont exactement les mêmes clés imbriquées", () => {
    const frKeys = extractKeys(frPermissions as Record<string, unknown>);
    const enKeys = extractKeys(enPermissions as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("roles.ADMIN.name est 'Administrateur' en fr", () => {
    const val = deepGet(frPermissions, "roles.ADMIN.name") as string;
    expect(val).toBe("Administrateur");
  });

  it("roles.ADMIN.name est 'Administrator' en en", () => {
    const val = deepGet(enPermissions, "roles.ADMIN.name") as string;
    expect(val).toBe("Administrator");
  });

  it("roles.GERANT.name est 'Gerant' en fr", () => {
    const val = deepGet(frPermissions, "roles.GERANT.name") as string;
    expect(val).toBe("Gerant");
  });

  it("roles.PISCICULTEUR.name est non vide en fr", () => {
    const val = deepGet(frPermissions, "roles.PISCICULTEUR.name") as string;
    expect(typeof val).toBe("string");
    expect(val.length).toBeGreaterThan(0);
  });

  it("groups.administration est la même valeur en fr et en (terme identique)", () => {
    const frVal = deepGet(frPermissions, "groups.administration") as string;
    const enVal = deepGet(enPermissions, "groups.administration") as string;
    expect(frVal).toBe("Administration");
    expect(enVal).toBe("Administration");
  });

  it("groups.elevage est différent en fr et en", () => {
    const frVal = deepGet(frPermissions, "groups.elevage") as string;
    const enVal = deepGet(enPermissions, "groups.elevage") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("permissions.VAGUES_VOIR est non vide en fr", () => {
    const val = deepGet(frPermissions, "permissions.VAGUES_VOIR") as string;
    expect(typeof val).toBe("string");
    expect(val.length).toBeGreaterThan(0);
  });

  it("permissions.SITE_GERER est différent en fr et en", () => {
    const frVal = deepGet(frPermissions, "permissions.SITE_GERER") as string;
    const enVal = deepGet(enPermissions, "permissions.SITE_GERER") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("toutes les permissions fr sont des strings non vides", () => {
    const perms = (frPermissions as Record<string, Record<string, string>>).permissions;
    for (const [key, val] of Object.entries(perms)) {
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
      void key;
    }
  });

  it("toutes les permissions en sont des strings non vides", () => {
    const perms = (enPermissions as Record<string, Record<string, string>>).permissions;
    for (const [key, val] of Object.entries(perms)) {
      expect(typeof val).toBe("string");
      expect(val.length).toBeGreaterThan(0);
      void key;
    }
  });
});

// ---------------------------------------------------------------------------
// 40.3 — abonnements.json
// ---------------------------------------------------------------------------

describe("abonnements.json — chargement (Sprint 40.3)", () => {
  it("fr/abonnements.json charge et est un objet", () => {
    expect(frAbonnements).toBeDefined();
    expect(typeof frAbonnements).toBe("object");
  });

  it("en/abonnements.json charge et est un objet", () => {
    expect(enAbonnements).toBeDefined();
    expect(typeof enAbonnements).toBe("object");
  });

  it("fr/abonnements.json contient la section 'plans'", () => {
    expect(frAbonnements).toHaveProperty("plans");
  });

  it("fr/abonnements.json contient la section 'periods'", () => {
    expect(frAbonnements).toHaveProperty("periods");
  });

  it("fr/abonnements.json contient la section 'statuts'", () => {
    expect(frAbonnements).toHaveProperty("statuts");
  });

  it("fr/abonnements.json contient la section 'providers'", () => {
    expect(frAbonnements).toHaveProperty("providers");
  });

  it("en/abonnements.json contient les mêmes sections de premier niveau que fr", () => {
    expect(Object.keys(enAbonnements).sort()).toEqual(Object.keys(frAbonnements).sort());
  });
});

describe("abonnements.json — parité de clés fr/en (Sprint 40.3)", () => {
  it("fr et en ont exactement les mêmes clés imbriquées", () => {
    const frKeys = extractKeys(frAbonnements as Record<string, unknown>);
    const enKeys = extractKeys(enAbonnements as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("plans.DECOUVERTE est 'Découverte' en fr", () => {
    const val = deepGet(frAbonnements, "plans.DECOUVERTE") as string;
    expect(val).toBe("Découverte");
  });

  it("plans.DECOUVERTE est 'Discovery' en en", () => {
    const val = deepGet(enAbonnements, "plans.DECOUVERTE") as string;
    expect(val).toBe("Discovery");
  });

  it("plans.INGENIEUR_PRO est non vide en fr", () => {
    const val = deepGet(frAbonnements, "plans.INGENIEUR_PRO") as string;
    expect(typeof val).toBe("string");
    expect(val.length).toBeGreaterThan(0);
  });

  it("statuts.ACTIF est 'Actif' en fr", () => {
    const val = deepGet(frAbonnements, "statuts.ACTIF") as string;
    expect(val).toBe("Actif");
  });

  it("statuts.ACTIF est 'Active' en en", () => {
    const val = deepGet(enAbonnements, "statuts.ACTIF") as string;
    expect(val).toBe("Active");
  });

  it("statuts.EN_GRACE est non vide en fr", () => {
    const val = deepGet(frAbonnements, "statuts.EN_GRACE") as string;
    expect(typeof val).toBe("string");
    expect(val.length).toBeGreaterThan(0);
  });

  it("periods.MENSUEL est 'Mensuel' en fr", () => {
    const val = deepGet(frAbonnements, "periods.MENSUEL") as string;
    expect(val).toBe("Mensuel");
  });

  it("periods.MENSUEL est 'Monthly' en en", () => {
    const val = deepGet(enAbonnements, "periods.MENSUEL") as string;
    expect(val).toBe("Monthly");
  });

  it("providers.MANUEL est différent en fr et en", () => {
    const frVal = deepGet(frAbonnements, "providers.MANUEL") as string;
    const enVal = deepGet(enAbonnements, "providers.MANUEL") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("providers.MTN_MOMO a la même valeur en fr et en (nom de marque)", () => {
    const frVal = deepGet(frAbonnements, "providers.MTN_MOMO") as string;
    const enVal = deepGet(enAbonnements, "providers.MTN_MOMO") as string;
    expect(frVal).toBe("MTN Mobile Money");
    expect(enVal).toBe("MTN Mobile Money");
  });

  it("aucune valeur fr/abonnements n'est vide", () => {
    const frKeys = extractKeys(frAbonnements as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frAbonnements, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 40.4a — settings.json
// ---------------------------------------------------------------------------

describe("settings.json — chargement (Sprint 40.4)", () => {
  it("fr/settings.json charge et est un objet", () => {
    expect(frSettings).toBeDefined();
    expect(typeof frSettings).toBe("object");
  });

  it("en/settings.json charge et est un objet", () => {
    expect(enSettings).toBeDefined();
    expect(typeof enSettings).toBe("object");
  });

  it("fr/settings.json contient la section 'triggers'", () => {
    expect(frSettings).toHaveProperty("triggers");
  });

  it("fr/settings.json contient la section 'activities'", () => {
    expect(frSettings).toHaveProperty("activities");
  });

  it("fr/settings.json contient la section 'phases'", () => {
    expect(frSettings).toHaveProperty("phases");
  });

  it("fr/settings.json contient la section 'operators'", () => {
    expect(frSettings).toHaveProperty("operators");
  });

  it("fr/settings.json contient la section 'actions'", () => {
    expect(frSettings).toHaveProperty("actions");
  });

  it("fr/settings.json contient la section 'severity'", () => {
    expect(frSettings).toHaveProperty("severity");
  });

  it("fr/settings.json contient la section 'placeholders'", () => {
    expect(frSettings).toHaveProperty("placeholders");
  });

  it("en/settings.json contient les mêmes sections de premier niveau que fr", () => {
    expect(Object.keys(enSettings).sort()).toEqual(Object.keys(frSettings).sort());
  });
});

describe("settings.json — parité de clés fr/en (Sprint 40.4)", () => {
  it("fr et en ont exactement les mêmes clés imbriquées", () => {
    const frKeys = extractKeys(frSettings as Record<string, unknown>);
    const enKeys = extractKeys(enSettings as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("triggers.FCR_ELEVE est 'ICA élevé' en fr (renommage FCR→ICA)", () => {
    const val = deepGet(frSettings, "triggers.FCR_ELEVE") as string;
    expect(val).toBe("ICA élevé");
  });

  it("triggers.FCR_ELEVE est 'High FCR' en en (conserve FCR en anglais)", () => {
    const val = deepGet(enSettings, "triggers.FCR_ELEVE") as string;
    expect(val).toBe("High FCR");
  });

  it("activities.ALIMENTATION est 'Alimentation' en fr", () => {
    const val = deepGet(frSettings, "activities.ALIMENTATION") as string;
    expect(val).toBe("Alimentation");
  });

  it("activities.ALIMENTATION est 'Feeding' en en", () => {
    const val = deepGet(enSettings, "activities.ALIMENTATION") as string;
    expect(val).toBe("Feeding");
  });

  it("phases.GROSSISSEMENT est 'Grossissement' en fr", () => {
    const val = deepGet(frSettings, "phases.GROSSISSEMENT") as string;
    expect(val).toBe("Grossissement");
  });

  it("phases.GROSSISSEMENT est 'Fattening' en en", () => {
    const val = deepGet(enSettings, "phases.GROSSISSEMENT") as string;
    expect(val).toBe("Fattening");
  });

  it("operators.SUPERIEUR est différent en fr et en", () => {
    const frVal = deepGet(frSettings, "operators.SUPERIEUR") as string;
    const enVal = deepGet(enSettings, "operators.SUPERIEUR") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("placeholders.valeur.description mentionne ICA ou TCS en fr", () => {
    const val = deepGet(frSettings, "placeholders.valeur.description") as string;
    expect(val).toMatch(/ICA|TCS/);
  });

  it("placeholders.valeur.description mentionne FCR ou SGR en en", () => {
    const val = deepGet(enSettings, "placeholders.valeur.description") as string;
    expect(val).toMatch(/FCR|SGR/);
  });

  it("placeholders.bac.example est 'Bac 3' en fr", () => {
    const val = deepGet(frSettings, "placeholders.bac.example") as string;
    expect(val).toBe("Bac 3");
  });

  it("placeholders.bac.example est 'Tank 3' en en", () => {
    const val = deepGet(enSettings, "placeholders.bac.example") as string;
    expect(val).toBe("Tank 3");
  });

  it("aucune valeur fr/settings n'est vide", () => {
    const frKeys = extractKeys(frSettings as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frSettings, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en/settings n'est vide", () => {
    const enKeys = extractKeys(enSettings as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const val = deepGet(enSettings, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 40.4b — analytics.json
// ---------------------------------------------------------------------------

describe("analytics.json — chargement (Sprint 40.4)", () => {
  it("fr/analytics.json charge et est un objet", () => {
    expect(frAnalytics).toBeDefined();
    expect(typeof frAnalytics).toBe("object");
  });

  it("en/analytics.json charge et est un objet", () => {
    expect(enAnalytics).toBeDefined();
    expect(typeof enAnalytics).toBe("object");
  });

  it("fr/analytics.json contient la section 'benchmarks'", () => {
    expect(frAnalytics).toHaveProperty("benchmarks");
  });

  it("fr/analytics.json contient la section 'kpi'", () => {
    expect(frAnalytics).toHaveProperty("kpi");
  });

  it("fr/analytics.json contient la section 'axes'", () => {
    expect(frAnalytics).toHaveProperty("axes");
  });

  it("fr/analytics.json contient la section 'labels'", () => {
    expect(frAnalytics).toHaveProperty("labels");
  });

  it("fr/analytics.json contient la section 'simulation'", () => {
    expect(frAnalytics).toHaveProperty("simulation");
  });

  it("en/analytics.json contient les mêmes sections de premier niveau que fr", () => {
    expect(Object.keys(enAnalytics).sort()).toEqual(Object.keys(frAnalytics).sort());
  });
});

describe("analytics.json — parité de clés fr/en (Sprint 40.4)", () => {
  it("fr et en ont exactement les mêmes clés imbriquées", () => {
    const frKeys = extractKeys(frAnalytics as Record<string, unknown>);
    const enKeys = extractKeys(enAnalytics as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("benchmarks.fcr.label est 'ICA' en fr (renommage FCR→ICA)", () => {
    const val = deepGet(frAnalytics, "benchmarks.fcr.label") as string;
    expect(val).toBe("ICA");
  });

  it("benchmarks.fcr.label est 'FCR' en en (conserve l'acronyme anglais)", () => {
    const val = deepGet(enAnalytics, "benchmarks.fcr.label") as string;
    expect(val).toBe("FCR");
  });

  it("benchmarks.fcr.full mentionne 'ICA' en fr", () => {
    const val = deepGet(frAnalytics, "benchmarks.fcr.full") as string;
    expect(val).toContain("ICA");
  });

  it("benchmarks.fcr.full mentionne 'FCR' en en", () => {
    const val = deepGet(enAnalytics, "benchmarks.fcr.full") as string;
    expect(val).toContain("FCR");
  });

  it("benchmarks.sgr.label est 'TCS' en fr (renommage SGR→TCS)", () => {
    const val = deepGet(frAnalytics, "benchmarks.sgr.label") as string;
    expect(val).toBe("TCS");
  });

  it("benchmarks.sgr.label est 'SGR' en en (conserve l'acronyme anglais)", () => {
    const val = deepGet(enAnalytics, "benchmarks.sgr.label") as string;
    expect(val).toBe("SGR");
  });

  it("benchmarks.sgr.full mentionne 'TCS' en fr", () => {
    const val = deepGet(frAnalytics, "benchmarks.sgr.full") as string;
    expect(val).toContain("TCS");
  });

  it("benchmarks.sgr.full mentionne 'SGR' en en", () => {
    const val = deepGet(enAnalytics, "benchmarks.sgr.full") as string;
    expect(val).toContain("SGR");
  });

  it("axes.sgrPerDay est 'TCS %/j' en fr", () => {
    const val = deepGet(frAnalytics, "axes.sgrPerDay") as string;
    expect(val).toBe("TCS %/j");
  });

  it("axes.sgrPerDay est 'SGR %/d' en en", () => {
    const val = deepGet(enAnalytics, "axes.sgrPerDay") as string;
    expect(val).toBe("SGR %/d");
  });

  it("axes.fcrInverse contient 'ICA' en fr", () => {
    const val = deepGet(frAnalytics, "axes.fcrInverse") as string;
    expect(val).toContain("ICA");
  });

  it("axes.fcrInverse contient 'FCR' en en", () => {
    const val = deepGet(enAnalytics, "axes.fcrInverse") as string;
    expect(val).toContain("FCR");
  });

  it("labels.fcr est 'ICA' en fr", () => {
    const val = deepGet(frAnalytics, "labels.fcr") as string;
    expect(val).toBe("ICA");
  });

  it("labels.sgr est 'TCS' en fr", () => {
    const val = deepGet(frAnalytics, "labels.sgr") as string;
    expect(val).toBe("TCS");
  });

  it("labels.sgrUnit est '%/j' en fr", () => {
    const val = deepGet(frAnalytics, "labels.sgrUnit") as string;
    expect(val).toBe("%/j");
  });

  it("labels.sgrUnit est '%/d' en en", () => {
    const val = deepGet(enAnalytics, "labels.sgrUnit") as string;
    expect(val).toBe("%/d");
  });

  it("simulation.fcrLabel est 'ICA' en fr", () => {
    const val = deepGet(frAnalytics, "simulation.fcrLabel") as string;
    expect(val).toBe("ICA");
  });

  it("simulation.fcrLabel est 'FCR' en en", () => {
    const val = deepGet(enAnalytics, "simulation.fcrLabel") as string;
    expect(val).toBe("FCR");
  });

  it("kpi.vaguesActives est différent en fr et en", () => {
    const frVal = deepGet(frAnalytics, "kpi.vaguesActives") as string;
    const enVal = deepGet(enAnalytics, "kpi.vaguesActives") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("simulation.title est différent en fr et en", () => {
    const frVal = deepGet(frAnalytics, "simulation.title") as string;
    const enVal = deepGet(enAnalytics, "simulation.title") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("aucune valeur fr/analytics n'est vide", () => {
    const frKeys = extractKeys(frAnalytics as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frAnalytics, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en/analytics n'est vide", () => {
    const enKeys = extractKeys(enAnalytics as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const val = deepGet(enAnalytics, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Vérification de cohérence globale entre les 4 namespaces Sprint 40
// ---------------------------------------------------------------------------

describe("Sprint 40 — cohérence globale des 5 namespaces", () => {
  it("navigation.json fr et en ont le même nombre de clés", () => {
    const frKeys = extractKeys(frNavigation as Record<string, unknown>);
    const enKeys = extractKeys(enNavigation as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("permissions.json fr et en ont le même nombre de clés", () => {
    const frKeys = extractKeys(frPermissions as Record<string, unknown>);
    const enKeys = extractKeys(enPermissions as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("abonnements.json fr et en ont le même nombre de clés", () => {
    const frKeys = extractKeys(frAbonnements as Record<string, unknown>);
    const enKeys = extractKeys(enAbonnements as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("settings.json fr et en ont le même nombre de clés", () => {
    const frKeys = extractKeys(frSettings as Record<string, unknown>);
    const enKeys = extractKeys(enSettings as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("analytics.json fr et en ont le même nombre de clés", () => {
    const frKeys = extractKeys(frAnalytics as Record<string, unknown>);
    const enKeys = extractKeys(enAnalytics as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("FCR→ICA cohérent : analytics.labels.fcr='ICA' et settings.triggers.FCR_ELEVE contient 'ICA'", () => {
    const analyticsVal = deepGet(frAnalytics, "labels.fcr") as string;
    const settingsVal = deepGet(frSettings, "triggers.FCR_ELEVE") as string;
    expect(analyticsVal).toBe("ICA");
    expect(settingsVal).toContain("ICA");
  });

  it("SGR→TCS cohérent : analytics.labels.sgr='TCS' et axes.sgrPerDay contient 'TCS'", () => {
    const labelsVal = deepGet(frAnalytics, "labels.sgr") as string;
    const axesVal = deepGet(frAnalytics, "axes.sgrPerDay") as string;
    expect(labelsVal).toBe("TCS");
    expect(axesVal).toContain("TCS");
  });
});
