/**
 * Tests — Fichiers de messages i18n (Sprint 39, Story 39.3)
 *
 * Couvre :
 * - Les fichiers common.json fr et en chargent et parsent correctement
 * - Les deux fichiers ont la même structure de clés
 * - Les fichiers format.json fr et en chargent et parsent correctement
 * - Les deux format.json ont la même structure de clés
 * - Le barrel src/messages/index.ts exporte les namespaces attendus
 */

import { describe, it, expect } from "vitest";
import frCommon from "@/messages/fr/common.json";
import enCommon from "@/messages/en/common.json";
import frFormat from "@/messages/fr/format.json";
import enFormat from "@/messages/en/format.json";
import { namespaces } from "@/messages/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts all nested keys of an object as dot-separated paths.
 * e.g. { a: { b: 1 } } => ["a.b"]
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

// ---------------------------------------------------------------------------
// common.json — chargement et structure
// ---------------------------------------------------------------------------

describe("common.json — chargement", () => {
  it("fr/common.json charge et est un objet", () => {
    expect(frCommon).toBeDefined();
    expect(typeof frCommon).toBe("object");
    expect(frCommon).not.toBeNull();
  });

  it("en/common.json charge et est un objet", () => {
    expect(enCommon).toBeDefined();
    expect(typeof enCommon).toBe("object");
    expect(enCommon).not.toBeNull();
  });

  it("fr/common.json contient la section 'buttons'", () => {
    expect(frCommon).toHaveProperty("buttons");
  });

  it("fr/common.json contient la section 'errors'", () => {
    expect(frCommon).toHaveProperty("errors");
  });

  it("fr/common.json contient la section 'labels'", () => {
    expect(frCommon).toHaveProperty("labels");
  });

  it("fr/common.json contient la section 'status'", () => {
    expect(frCommon).toHaveProperty("status");
  });

  it("fr/common.json contient la section 'empty'", () => {
    expect(frCommon).toHaveProperty("empty");
  });

  it("fr/common.json contient la section 'confirm'", () => {
    expect(frCommon).toHaveProperty("confirm");
  });

  it("en/common.json contient les mêmes sections de premier niveau que fr", () => {
    const frTopKeys = Object.keys(frCommon).sort();
    const enTopKeys = Object.keys(enCommon).sort();
    expect(enTopKeys).toEqual(frTopKeys);
  });
});

describe("common.json — parité de clés fr/en", () => {
  it("fr et en ont exactement les mêmes clés imbriquées", () => {
    const frKeys = extractKeys(frCommon as Record<string, unknown>);
    const enKeys = extractKeys(enCommon as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("fr/common.json buttons.add est une string non vide", () => {
    expect(typeof (frCommon as Record<string, Record<string, string>>).buttons.add).toBe("string");
    expect((frCommon as Record<string, Record<string, string>>).buttons.add.length).toBeGreaterThan(0);
  });

  it("en/common.json buttons.add est une string non vide", () => {
    expect(typeof (enCommon as Record<string, Record<string, string>>).buttons.add).toBe("string");
    expect((enCommon as Record<string, Record<string, string>>).buttons.add.length).toBeGreaterThan(0);
  });

  it("fr et en ont des valeurs différentes pour buttons.add", () => {
    const frButtons = (frCommon as Record<string, Record<string, string>>).buttons;
    const enButtons = (enCommon as Record<string, Record<string, string>>).buttons;
    // "Ajouter" vs "Add"
    expect(frButtons.add).not.toBe(enButtons.add);
  });

  it("fr/common.json errors.generic est une string", () => {
    const frErrors = (frCommon as Record<string, Record<string, string>>).errors;
    expect(typeof frErrors.generic).toBe("string");
  });

  it("en/common.json errors.generic est une string", () => {
    const enErrors = (enCommon as Record<string, Record<string, string>>).errors;
    expect(typeof enErrors.generic).toBe("string");
  });

  it("aucune valeur fr n'est vide", () => {
    const frKeys = extractKeys(frCommon as Record<string, unknown>);
    // Each key path should map to a non-empty string
    for (const keyPath of frKeys) {
      const parts = keyPath.split(".");
      let current: unknown = frCommon;
      for (const part of parts) {
        current = (current as Record<string, unknown>)[part];
      }
      expect(typeof current).toBe("string");
      expect((current as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en n'est vide", () => {
    const enKeys = extractKeys(enCommon as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const parts = keyPath.split(".");
      let current: unknown = enCommon;
      for (const part of parts) {
        current = (current as Record<string, unknown>)[part];
      }
      expect(typeof current).toBe("string");
      expect((current as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// format.json — chargement et structure
// ---------------------------------------------------------------------------

describe("format.json — chargement", () => {
  it("fr/format.json charge et est un objet", () => {
    expect(frFormat).toBeDefined();
    expect(typeof frFormat).toBe("object");
    expect(frFormat).not.toBeNull();
  });

  it("en/format.json charge et est un objet", () => {
    expect(enFormat).toBeDefined();
    expect(typeof enFormat).toBe("object");
    expect(enFormat).not.toBeNull();
  });

  it("fr/format.json contient la section 'units'", () => {
    expect(frFormat).toHaveProperty("units");
  });

  it("fr/format.json contient la section 'periods'", () => {
    expect(frFormat).toHaveProperty("periods");
  });

  it("fr/format.json contient la section 'dates'", () => {
    expect(frFormat).toHaveProperty("dates");
  });

  it("fr/format.json contient la section 'price'", () => {
    expect(frFormat).toHaveProperty("price");
  });

  it("en/format.json contient les mêmes sections de premier niveau que fr", () => {
    const frTopKeys = Object.keys(frFormat).sort();
    const enTopKeys = Object.keys(enFormat).sort();
    expect(enTopKeys).toEqual(frTopKeys);
  });
});

describe("format.json — parité de clés fr/en", () => {
  it("fr et en ont exactement les mêmes clés imbriquées", () => {
    const frKeys = extractKeys(frFormat as Record<string, unknown>);
    const enKeys = extractKeys(enFormat as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("fr/format.json price.free est 'Gratuit'", () => {
    const price = (frFormat as Record<string, Record<string, string>>).price;
    expect(price.free).toBe("Gratuit");
  });

  it("en/format.json price.free est 'Free'", () => {
    const price = (enFormat as Record<string, Record<string, string>>).price;
    expect(price.free).toBe("Free");
  });

  it("fr/format.json units.currency est 'FCFA'", () => {
    const units = (frFormat as Record<string, Record<string, string>>).units;
    expect(units.currency).toBe("FCFA");
  });

  it("en/format.json units.currency est 'FCFA'", () => {
    const units = (enFormat as Record<string, Record<string, string>>).units;
    expect(units.currency).toBe("FCFA");
  });

  it("fr/format.json periods.monthly est différent de en", () => {
    const frPeriods = (frFormat as Record<string, Record<string, string>>).periods;
    const enPeriods = (enFormat as Record<string, Record<string, string>>).periods;
    expect(frPeriods.monthly).not.toBe(enPeriods.monthly);
  });

  it("fr/format.json dates.daysAgo contient le placeholder {count}", () => {
    const dates = (frFormat as Record<string, Record<string, string>>).dates;
    expect(dates.daysAgo).toContain("{count}");
  });

  it("en/format.json dates.daysAgo contient le placeholder {count}", () => {
    const dates = (enFormat as Record<string, Record<string, string>>).dates;
    expect(dates.daysAgo).toContain("{count}");
  });
});

// ---------------------------------------------------------------------------
// Barrel src/messages/index.ts
// ---------------------------------------------------------------------------

describe("messages/index.ts — barrel exports", () => {
  it("exporte le tableau namespaces", () => {
    expect(namespaces).toBeDefined();
    expect(Array.isArray(namespaces)).toBe(true);
  });

  it("namespaces contient 'common'", () => {
    expect(namespaces).toContain("common");
  });

  it("namespaces contient 'format'", () => {
    expect(namespaces).toContain("format");
  });

  it("namespaces a exactement 34 entrées", () => {
    expect(namespaces).toHaveLength(34);
  });

  it("le type Namespace couvre les valeurs attendues (vérification de présence)", () => {
    const ns: string[] = [...namespaces];
    expect(ns).toContain("common");
    expect(ns).toContain("format");
  });

  it("namespaces contient 'navigation' (Sprint 40)", () => {
    expect(namespaces).toContain("navigation");
  });

  it("namespaces contient 'permissions' (Sprint 40)", () => {
    expect(namespaces).toContain("permissions");
  });

  it("namespaces contient 'abonnements' (Sprint 40)", () => {
    expect(namespaces).toContain("abonnements");
  });

  it("namespaces contient 'settings' (Sprint 40)", () => {
    expect(namespaces).toContain("settings");
  });

  it("namespaces contient 'analytics' (Sprint 40)", () => {
    expect(namespaces).toContain("analytics");
  });
});
