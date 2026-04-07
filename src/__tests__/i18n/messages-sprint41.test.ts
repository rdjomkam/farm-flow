/**
 * Tests i18n — Sprint 41 : namespaces vagues, releves, stock, ventes, alevins, users, commissions, errors
 *
 * Couvre :
 * - Chaque fichier JSON fr et en charge correctement
 * - Parite de cles fr/en pour chaque namespace
 * - Sections obligatoires presentes
 * - Valeurs non vides
 * - Traductions fr vs en differentes pour les chaines localisees
 * - Cles metier critiques presentes (FCR→ICA, SGR→TCS, types de releve, etc.)
 */

import { describe, it, expect } from "vitest";
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
import { namespaces } from "@/messages/index";

// ---------------------------------------------------------------------------
// Helper — extrait toutes les cles imbriquees en notation pointee
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
// index.ts — namespaces Sprint 41
// ---------------------------------------------------------------------------

describe("index.ts — namespaces Sprint 41 enregistres", () => {
  it("namespaces contient 'vagues' (Sprint 41.1)", () => {
    expect(namespaces).toContain("vagues");
  });

  it("namespaces contient 'releves' (Sprint 41.1)", () => {
    expect(namespaces).toContain("releves");
  });

  it("namespaces contient 'stock' (Sprint 41.2)", () => {
    expect(namespaces).toContain("stock");
  });

  it("namespaces contient 'ventes' (Sprint 41.2)", () => {
    expect(namespaces).toContain("ventes");
  });

  it("namespaces contient 'alevins' (Sprint 41.3)", () => {
    expect(namespaces).toContain("alevins");
  });

  it("namespaces contient 'users' (Sprint 41.3)", () => {
    expect(namespaces).toContain("users");
  });

  it("namespaces contient 'commissions' (Sprint 41.3)", () => {
    expect(namespaces).toContain("commissions");
  });

  it("namespaces contient 'errors' (Sprint 41.4)", () => {
    expect(namespaces).toContain("errors");
  });
});

// ---------------------------------------------------------------------------
// 41.1a — vagues.json
// ---------------------------------------------------------------------------

describe("vagues.json — chargement (Sprint 41.1)", () => {
  it("fr/vagues.json charge et est un objet", () => {
    expect(frVagues).toBeDefined();
    expect(typeof frVagues).toBe("object");
    expect(frVagues).not.toBeNull();
  });

  it("en/vagues.json charge et est un objet", () => {
    expect(enVagues).toBeDefined();
    expect(typeof enVagues).toBe("object");
    expect(enVagues).not.toBeNull();
  });

  it("fr/vagues.json contient la section 'page'", () => {
    expect(frVagues).toHaveProperty("page");
  });

  it("fr/vagues.json contient la section 'list'", () => {
    expect(frVagues).toHaveProperty("list");
  });

  it("fr/vagues.json contient la section 'statuts'", () => {
    expect(frVagues).toHaveProperty("statuts");
  });

  it("fr/vagues.json contient la section 'indicateurs'", () => {
    expect(frVagues).toHaveProperty("indicateurs");
  });

  it("fr/vagues.json contient la section 'form'", () => {
    expect(frVagues).toHaveProperty("form");
  });

  it("fr/vagues.json contient la section 'comparison'", () => {
    expect(frVagues).toHaveProperty("comparison");
  });

  it("en/vagues.json contient les memes sections de premier niveau que fr", () => {
    expect(Object.keys(enVagues).sort()).toEqual(Object.keys(frVagues).sort());
  });
});

describe("vagues.json — parite de cles fr/en (Sprint 41.1)", () => {
  it("fr et en ont exactement les memes cles imbriquees", () => {
    const frKeys = extractKeys(frVagues as Record<string, unknown>);
    const enKeys = extractKeys(enVagues as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("indicateurs.fcr est 'ICA' en fr (renommage FCR→ICA)", () => {
    const val = deepGet(frVagues, "indicateurs.fcr") as string;
    expect(val).toBe("ICA");
  });

  it("indicateurs.fcr est 'FCR' en en (conserve l'acronyme anglais)", () => {
    const val = deepGet(enVagues, "indicateurs.fcr") as string;
    expect(val).toBe("FCR");
  });

  it("indicateurs.sgr est 'TCS' en fr (renommage SGR→TCS)", () => {
    const val = deepGet(frVagues, "indicateurs.sgr") as string;
    expect(val).toBe("TCS");
  });

  it("indicateurs.sgr est 'SGR' en en (conserve l'acronyme anglais)", () => {
    const val = deepGet(enVagues, "indicateurs.sgr") as string;
    expect(val).toBe("SGR");
  });

  it("statuts.EN_COURS est 'En cours' en fr", () => {
    const val = deepGet(frVagues, "statuts.EN_COURS") as string;
    expect(val).toBe("En cours");
  });

  it("statuts.EN_COURS est 'Active' en en", () => {
    const val = deepGet(enVagues, "statuts.EN_COURS") as string;
    expect(val).toBe("Active");
  });

  it("statuts.TERMINEE est different en fr et en", () => {
    const frVal = deepGet(frVagues, "statuts.TERMINEE") as string;
    const enVal = deepGet(enVagues, "statuts.TERMINEE") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("statuts.ANNULEE est different en fr et en", () => {
    const frVal = deepGet(frVagues, "statuts.ANNULEE") as string;
    const enVal = deepGet(enVagues, "statuts.ANNULEE") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("list.newButton est different en fr et en", () => {
    const frVal = deepGet(frVagues, "list.newButton") as string;
    const enVal = deepGet(enVagues, "list.newButton") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("form.close.title contient '{code}' (interpolation) en fr et en", () => {
    const frVal = deepGet(frVagues, "form.close.title") as string;
    const enVal = deepGet(enVagues, "form.close.title") as string;
    expect(frVal).toContain("{code}");
    expect(enVal).toContain("{code}");
  });

  it("comparison.metrics.roi est 'ROI' en fr et en (terme universel)", () => {
    const frVal = deepGet(frVagues, "comparison.metrics.roi") as string;
    const enVal = deepGet(enVagues, "comparison.metrics.roi") as string;
    expect(frVal).toBe("ROI");
    expect(enVal).toBe("ROI");
  });

  it("aucune valeur fr/vagues n'est vide", () => {
    const frKeys = extractKeys(frVagues as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frVagues, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en/vagues n'est vide", () => {
    const enKeys = extractKeys(enVagues as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const val = deepGet(enVagues, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 41.1b — releves.json
// ---------------------------------------------------------------------------

describe("releves.json — chargement (Sprint 41.1)", () => {
  it("fr/releves.json charge et est un objet", () => {
    expect(frReleves).toBeDefined();
    expect(typeof frReleves).toBe("object");
  });

  it("en/releves.json charge et est un objet", () => {
    expect(enReleves).toBeDefined();
    expect(typeof enReleves).toBe("object");
  });

  it("fr/releves.json contient la section 'types'", () => {
    expect(frReleves).toHaveProperty("types");
  });

  it("fr/releves.json contient la section 'form'", () => {
    expect(frReleves).toHaveProperty("form");
  });

  it("fr/releves.json contient la section 'modify'", () => {
    expect(frReleves).toHaveProperty("modify");
  });

  it("fr/releves.json contient la section 'modifications'", () => {
    expect(frReleves).toHaveProperty("modifications");
  });

  it("en/releves.json contient les memes sections de premier niveau que fr", () => {
    expect(Object.keys(enReleves).sort()).toEqual(Object.keys(frReleves).sort());
  });
});

describe("releves.json — parite de cles fr/en (Sprint 41.1)", () => {
  it("fr et en ont exactement les memes cles imbriquees", () => {
    const frKeys = extractKeys(frReleves as Record<string, unknown>);
    const enKeys = extractKeys(enReleves as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("types.BIOMETRIE est 'Biometrie' ou similaire en fr", () => {
    const val = deepGet(frReleves, "types.BIOMETRIE") as string;
    expect(typeof val).toBe("string");
    expect(val.length).toBeGreaterThan(0);
  });

  it("types.BIOMETRIE est different en fr et en", () => {
    const frVal = deepGet(frReleves, "types.BIOMETRIE") as string;
    const enVal = deepGet(enReleves, "types.BIOMETRIE") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("types contient les 7 types de releve obligatoires", () => {
    const types = (frReleves as Record<string, Record<string, string>>).types;
    expect(types).toHaveProperty("BIOMETRIE");
    expect(types).toHaveProperty("MORTALITE");
    expect(types).toHaveProperty("ALIMENTATION");
    expect(types).toHaveProperty("QUALITE_EAU");
    expect(types).toHaveProperty("COMPTAGE");
    expect(types).toHaveProperty("OBSERVATION");
    expect(types).toHaveProperty("RENOUVELLEMENT");
  });

  it("types en contient aussi les 7 types de releve", () => {
    const types = (enReleves as Record<string, Record<string, string>>).types;
    expect(types).toHaveProperty("BIOMETRIE");
    expect(types).toHaveProperty("MORTALITE");
    expect(types).toHaveProperty("ALIMENTATION");
    expect(types).toHaveProperty("QUALITE_EAU");
    expect(types).toHaveProperty("COMPTAGE");
    expect(types).toHaveProperty("OBSERVATION");
    expect(types).toHaveProperty("RENOUVELLEMENT");
  });

  it("form.mortalite.causes contient MALADIE, QUALITE_EAU, STRESS, PREDATION, CANNIBALISME, INCONNUE, AUTRE", () => {
    const causes = deepGet(frReleves, "form.mortalite.causes") as Record<string, string>;
    expect(causes).toHaveProperty("MALADIE");
    expect(causes).toHaveProperty("QUALITE_EAU");
    expect(causes).toHaveProperty("STRESS");
    expect(causes).toHaveProperty("PREDATION");
    expect(causes).toHaveProperty("CANNIBALISME");
    expect(causes).toHaveProperty("INCONNUE");
    expect(causes).toHaveProperty("AUTRE");
  });

  it("form.alimentation.types contient ARTISANAL, COMMERCIAL, MIXTE", () => {
    const types = deepGet(frReleves, "form.alimentation.types") as Record<string, string>;
    expect(types).toHaveProperty("ARTISANAL");
    expect(types).toHaveProperty("COMMERCIAL");
    expect(types).toHaveProperty("MIXTE");
  });

  it("form.comptage.methodes contient DIRECT, ESTIMATION, ECHANTILLONNAGE", () => {
    const methodes = deepGet(frReleves, "form.comptage.methodes") as Record<string, string>;
    expect(methodes).toHaveProperty("DIRECT");
    expect(methodes).toHaveProperty("ESTIMATION");
    expect(methodes).toHaveProperty("ECHANTILLONNAGE");
  });

  it("modify.title est different en fr et en", () => {
    const frVal = deepGet(frReleves, "modify.title") as string;
    const enVal = deepGet(enReleves, "modify.title") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("modifications.historyTitle est different en fr et en", () => {
    const frVal = deepGet(frReleves, "modifications.historyTitle") as string;
    const enVal = deepGet(enReleves, "modifications.historyTitle") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("aucune valeur fr/releves n'est vide", () => {
    const frKeys = extractKeys(frReleves as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frReleves, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en/releves n'est vide", () => {
    const enKeys = extractKeys(enReleves as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const val = deepGet(enReleves, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 41.2a — stock.json
// ---------------------------------------------------------------------------

describe("stock.json — chargement (Sprint 41.2)", () => {
  it("fr/stock.json charge et est un objet", () => {
    expect(frStock).toBeDefined();
    expect(typeof frStock).toBe("object");
  });

  it("en/stock.json charge et est un objet", () => {
    expect(enStock).toBeDefined();
    expect(typeof enStock).toBe("object");
  });

  it("fr/stock.json contient la section 'categories'", () => {
    expect(frStock).toHaveProperty("categories");
  });

  it("fr/stock.json contient la section 'unites'", () => {
    expect(frStock).toHaveProperty("unites");
  });

  it("fr/stock.json contient la section 'statuts'", () => {
    expect(frStock).toHaveProperty("statuts");
  });

  it("fr/stock.json contient la section 'produits'", () => {
    expect(frStock).toHaveProperty("produits");
  });

  it("fr/stock.json contient la section 'fournisseurs'", () => {
    expect(frStock).toHaveProperty("fournisseurs");
  });

  it("fr/stock.json contient la section 'commandes'", () => {
    expect(frStock).toHaveProperty("commandes");
  });

  it("fr/stock.json contient la section 'mouvements'", () => {
    expect(frStock).toHaveProperty("mouvements");
  });

  it("en/stock.json contient les memes sections de premier niveau que fr", () => {
    expect(Object.keys(enStock).sort()).toEqual(Object.keys(frStock).sort());
  });
});

describe("stock.json — parite de cles fr/en (Sprint 41.2)", () => {
  it("fr et en ont exactement les memes cles imbriquees", () => {
    const frKeys = extractKeys(frStock as Record<string, unknown>);
    const enKeys = extractKeys(enStock as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("categories.ALIMENT est 'Aliment' en fr", () => {
    const val = deepGet(frStock, "categories.ALIMENT") as string;
    expect(val).toBe("Aliment");
  });

  it("categories.ALIMENT est 'Feed' en en", () => {
    const val = deepGet(enStock, "categories.ALIMENT") as string;
    expect(val).toBe("Feed");
  });

  it("categories contient ALIMENT, INTRANT, EQUIPEMENT", () => {
    const cats = (frStock as Record<string, Record<string, string>>).categories;
    expect(cats).toHaveProperty("ALIMENT");
    expect(cats).toHaveProperty("INTRANT");
    expect(cats).toHaveProperty("EQUIPEMENT");
  });

  it("unites contient GRAMME, KG, MILLILITRE, LITRE, UNITE, SACS", () => {
    const unites = (frStock as Record<string, Record<string, string>>).unites;
    expect(unites).toHaveProperty("GRAMME");
    expect(unites).toHaveProperty("KG");
    expect(unites).toHaveProperty("MILLILITRE");
    expect(unites).toHaveProperty("LITRE");
    expect(unites).toHaveProperty("UNITE");
    expect(unites).toHaveProperty("SACS");
  });

  it("statuts.BROUILLON est different en fr et en", () => {
    const frVal = deepGet(frStock, "statuts.BROUILLON") as string;
    const enVal = deepGet(enStock, "statuts.BROUILLON") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("types.ENTREE est different en fr et en", () => {
    const frVal = deepGet(frStock, "types.ENTREE") as string;
    const enVal = deepGet(enStock, "types.ENTREE") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("fournisseurs.title est 'Fournisseurs' en fr", () => {
    const val = deepGet(frStock, "fournisseurs.title") as string;
    expect(val).toBe("Fournisseurs");
  });

  it("fournisseurs.title est 'Suppliers' en en", () => {
    const val = deepGet(enStock, "fournisseurs.title") as string;
    expect(val).toBe("Suppliers");
  });

  it("aucune valeur fr/stock n'est vide", () => {
    const frKeys = extractKeys(frStock as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frStock, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en/stock n'est vide", () => {
    const enKeys = extractKeys(enStock as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const val = deepGet(enStock, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 41.2b — ventes.json
// ---------------------------------------------------------------------------

describe("ventes.json — chargement (Sprint 41.2)", () => {
  it("fr/ventes.json charge et est un objet", () => {
    expect(frVentes).toBeDefined();
    expect(typeof frVentes).toBe("object");
  });

  it("en/ventes.json charge et est un objet", () => {
    expect(enVentes).toBeDefined();
    expect(typeof enVentes).toBe("object");
  });

  it("fr/ventes.json contient la section 'clients'", () => {
    expect(frVentes).toHaveProperty("clients");
  });

  it("fr/ventes.json contient la section 'ventes'", () => {
    expect(frVentes).toHaveProperty("ventes");
  });

  it("fr/ventes.json contient la section 'factures'", () => {
    expect(frVentes).toHaveProperty("factures");
  });

  it("fr/ventes.json contient la section 'paiements'", () => {
    expect(frVentes).toHaveProperty("paiements");
  });

  it("fr/ventes.json contient la section 'finances'", () => {
    expect(frVentes).toHaveProperty("finances");
  });

  it("en/ventes.json contient les memes sections de premier niveau que fr", () => {
    expect(Object.keys(enVentes).sort()).toEqual(Object.keys(frVentes).sort());
  });
});

describe("ventes.json — parite de cles fr/en (Sprint 41.2)", () => {
  it("fr et en ont exactement les memes cles imbriquees", () => {
    const frKeys = extractKeys(frVentes as Record<string, unknown>);
    const enKeys = extractKeys(enVentes as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("factures.statuts contient BROUILLON, ENVOYEE, PAYEE_PARTIELLEMENT, PAYEE, ANNULEE", () => {
    const statuts = deepGet(frVentes, "factures.statuts") as Record<string, string>;
    expect(statuts).toHaveProperty("BROUILLON");
    expect(statuts).toHaveProperty("ENVOYEE");
    expect(statuts).toHaveProperty("PAYEE_PARTIELLEMENT");
    expect(statuts).toHaveProperty("PAYEE");
    expect(statuts).toHaveProperty("ANNULEE");
  });

  it("paiements.modes contient ESPECES, MOBILE_MONEY, VIREMENT, CHEQUE", () => {
    const modes = deepGet(frVentes, "paiements.modes") as Record<string, string>;
    expect(modes).toHaveProperty("ESPECES");
    expect(modes).toHaveProperty("MOBILE_MONEY");
    expect(modes).toHaveProperty("VIREMENT");
    expect(modes).toHaveProperty("CHEQUE");
  });

  it("paiements.modes.ESPECES est different en fr et en", () => {
    const frVal = deepGet(frVentes, "paiements.modes.ESPECES") as string;
    const enVal = deepGet(enVentes, "paiements.modes.ESPECES") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("paiements.modes.MOBILE_MONEY est identique en fr et en (marque)", () => {
    const frVal = deepGet(frVentes, "paiements.modes.MOBILE_MONEY") as string;
    const enVal = deepGet(enVentes, "paiements.modes.MOBILE_MONEY") as string;
    expect(frVal).toBe("Mobile Money");
    expect(enVal).toBe("Mobile Money");
  });

  it("factures.title est 'Factures' en fr", () => {
    const val = deepGet(frVentes, "factures.title") as string;
    expect(val).toBe("Factures");
  });

  it("factures.title est 'Invoices' en en", () => {
    const val = deepGet(enVentes, "factures.title") as string;
    expect(val).toBe("Invoices");
  });

  it("finances.kpis.margeBrute est different en fr et en", () => {
    const frVal = deepGet(frVentes, "finances.kpis.margeBrute") as string;
    const enVal = deepGet(enVentes, "finances.kpis.margeBrute") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("aucune valeur fr/ventes n'est vide", () => {
    const frKeys = extractKeys(frVentes as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frVentes, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en/ventes n'est vide", () => {
    const enKeys = extractKeys(enVentes as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const val = deepGet(enVentes, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 41.3a — alevins.json
// ---------------------------------------------------------------------------

describe("alevins.json — chargement (Sprint 41.3)", () => {
  it("fr/alevins.json charge et est un objet", () => {
    expect(frAlevins).toBeDefined();
    expect(typeof frAlevins).toBe("object");
  });

  it("en/alevins.json charge et est un objet", () => {
    expect(enAlevins).toBeDefined();
    expect(typeof enAlevins).toBe("object");
  });

  it("fr/alevins.json contient la section 'page'", () => {
    expect(frAlevins).toHaveProperty("page");
  });

  it("fr/alevins.json contient la section 'reproducteurs'", () => {
    expect(frAlevins).toHaveProperty("reproducteurs");
  });

  it("fr/alevins.json contient la section 'pontes'", () => {
    expect(frAlevins).toHaveProperty("pontes");
  });

  it("fr/alevins.json contient la section 'lots'", () => {
    expect(frAlevins).toHaveProperty("lots");
  });

  it("fr/alevins.json contient la section 'common'", () => {
    expect(frAlevins).toHaveProperty("common");
  });

  it("en/alevins.json contient les memes sections de premier niveau que fr", () => {
    expect(Object.keys(enAlevins).sort()).toEqual(Object.keys(frAlevins).sort());
  });
});

describe("alevins.json — parite de cles fr/en (Sprint 41.3)", () => {
  it("fr et en ont exactement les memes cles imbriquees", () => {
    const frKeys = extractKeys(frAlevins as Record<string, unknown>);
    const enKeys = extractKeys(enAlevins as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("page.title est different en fr et en", () => {
    const frVal = deepGet(frAlevins, "page.title") as string;
    const enVal = deepGet(enAlevins, "page.title") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("reproducteurs.sexe.MALE est 'Male' en fr et en (terme universel)", () => {
    const frVal = deepGet(frAlevins, "reproducteurs.sexe.MALE") as string;
    const enVal = deepGet(enAlevins, "reproducteurs.sexe.MALE") as string;
    expect(frVal).toBe("Male");
    expect(enVal).toBe("Male");
  });

  it("reproducteurs.sexe.FEMELLE est different en fr et en", () => {
    const frVal = deepGet(frAlevins, "reproducteurs.sexe.FEMELLE") as string;
    const enVal = deepGet(enAlevins, "reproducteurs.sexe.FEMELLE") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("reproducteurs.statuts contient ACTIF, REFORME, MORT", () => {
    const statuts = deepGet(frAlevins, "reproducteurs.statuts") as Record<string, string>;
    expect(statuts).toHaveProperty("ACTIF");
    expect(statuts).toHaveProperty("REFORME");
    expect(statuts).toHaveProperty("MORT");
  });

  it("pontes.statuts contient EN_COURS, TERMINEE, ECHOUEE", () => {
    const statuts = deepGet(frAlevins, "pontes.statuts") as Record<string, string>;
    expect(statuts).toHaveProperty("EN_COURS");
    expect(statuts).toHaveProperty("TERMINEE");
    expect(statuts).toHaveProperty("ECHOUEE");
  });

  it("lots.statuts contient EN_INCUBATION, EN_ELEVAGE, TRANSFERE, PERDU", () => {
    const statuts = deepGet(frAlevins, "lots.statuts") as Record<string, string>;
    expect(statuts).toHaveProperty("EN_INCUBATION");
    expect(statuts).toHaveProperty("EN_ELEVAGE");
    expect(statuts).toHaveProperty("TRANSFERE");
    expect(statuts).toHaveProperty("PERDU");
  });

  it("lots.transfert.button est different en fr et en", () => {
    const frVal = deepGet(frAlevins, "lots.transfert.button") as string;
    const enVal = deepGet(enAlevins, "lots.transfert.button") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("lots.transfert.description contient '{count}' (interpolation)", () => {
    const frVal = deepGet(frAlevins, "lots.transfert.description") as string;
    const enVal = deepGet(enAlevins, "lots.transfert.description") as string;
    expect(frVal).toContain("{count}");
    expect(enVal).toContain("{count}");
  });

  it("aucune valeur fr/alevins n'est vide", () => {
    const frKeys = extractKeys(frAlevins as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frAlevins, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en/alevins n'est vide", () => {
    const enKeys = extractKeys(enAlevins as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const val = deepGet(enAlevins, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 41.3b — users.json
// ---------------------------------------------------------------------------

describe("users.json — chargement (Sprint 41.3)", () => {
  it("fr/users.json charge et est un objet", () => {
    expect(frUsers).toBeDefined();
    expect(typeof frUsers).toBe("object");
  });

  it("en/users.json charge et est un objet", () => {
    expect(enUsers).toBeDefined();
    expect(typeof enUsers).toBe("object");
  });

  it("fr/users.json contient la section 'list'", () => {
    expect(frUsers).toHaveProperty("list");
  });

  it("fr/users.json contient la section 'form'", () => {
    expect(frUsers).toHaveProperty("form");
  });

  it("fr/users.json contient la section 'roles'", () => {
    expect(frUsers).toHaveProperty("roles");
  });

  it("fr/users.json contient la section 'profile'", () => {
    expect(frUsers).toHaveProperty("profile");
  });

  it("fr/users.json contient la section 'security'", () => {
    expect(frUsers).toHaveProperty("security");
  });

  it("fr/users.json contient la section 'impersonation'", () => {
    expect(frUsers).toHaveProperty("impersonation");
  });

  it("fr/users.json contient la section 'memberships'", () => {
    expect(frUsers).toHaveProperty("memberships");
  });

  it("en/users.json contient les memes sections de premier niveau que fr", () => {
    expect(Object.keys(enUsers).sort()).toEqual(Object.keys(frUsers).sort());
  });
});

describe("users.json — parite de cles fr/en (Sprint 41.3)", () => {
  it("fr et en ont exactement les memes cles imbriquees", () => {
    const frKeys = extractKeys(frUsers as Record<string, unknown>);
    const enKeys = extractKeys(enUsers as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("roles.ADMIN est different en fr et en", () => {
    const frVal = deepGet(frUsers, "roles.ADMIN") as string;
    const enVal = deepGet(enUsers, "roles.ADMIN") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("roles contient ADMIN, GERANT, PISCICULTEUR, INGENIEUR", () => {
    const roles = (frUsers as Record<string, Record<string, string>>).roles;
    expect(roles).toHaveProperty("ADMIN");
    expect(roles).toHaveProperty("GERANT");
    expect(roles).toHaveProperty("PISCICULTEUR");
    expect(roles).toHaveProperty("INGENIEUR");
  });

  it("list.title est 'Utilisateurs' en fr", () => {
    const val = deepGet(frUsers, "list.title") as string;
    expect(val).toBe("Utilisateurs");
  });

  it("list.title est 'Users' en en", () => {
    const val = deepGet(enUsers, "list.title") as string;
    expect(val).toBe("Users");
  });

  it("impersonation.sectionTitle est identique en fr et en (terme technique)", () => {
    const frVal = deepGet(frUsers, "impersonation.sectionTitle") as string;
    const enVal = deepGet(enUsers, "impersonation.sectionTitle") as string;
    expect(frVal).toBe("Impersonation");
    expect(enVal).toBe("Impersonation");
  });

  it("impersonation.banner.viewingAs est different en fr et en", () => {
    const frVal = deepGet(frUsers, "impersonation.banner.viewingAs") as string;
    const enVal = deepGet(enUsers, "impersonation.banner.viewingAs") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("profile.desactiverDescription contient '{name}' (interpolation)", () => {
    const frVal = deepGet(frUsers, "profile.desactiverDescription") as string;
    const enVal = deepGet(enUsers, "profile.desactiverDescription") as string;
    expect(frVal).toContain("{name}");
    expect(enVal).toContain("{name}");
  });

  it("aucune valeur fr/users n'est vide", () => {
    const frKeys = extractKeys(frUsers as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frUsers, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en/users n'est vide", () => {
    const enKeys = extractKeys(enUsers as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const val = deepGet(enUsers, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 41.3c — commissions.json
// ---------------------------------------------------------------------------

describe("commissions.json — chargement (Sprint 41.3)", () => {
  it("fr/commissions.json charge et est un objet", () => {
    expect(frCommissions).toBeDefined();
    expect(typeof frCommissions).toBe("object");
  });

  it("en/commissions.json charge et est un objet", () => {
    expect(enCommissions).toBeDefined();
    expect(typeof enCommissions).toBe("object");
  });

  it("fr/commissions.json contient la section 'portefeuille'", () => {
    expect(frCommissions).toHaveProperty("portefeuille");
  });

  it("fr/commissions.json contient la section 'commissions'", () => {
    expect(frCommissions).toHaveProperty("commissions");
  });

  it("fr/commissions.json contient la section 'retraits'", () => {
    expect(frCommissions).toHaveProperty("retraits");
  });

  it("fr/commissions.json contient la section 'admin'", () => {
    expect(frCommissions).toHaveProperty("admin");
  });

  it("en/commissions.json contient les memes sections de premier niveau que fr", () => {
    expect(Object.keys(enCommissions).sort()).toEqual(Object.keys(frCommissions).sort());
  });
});

describe("commissions.json — parite de cles fr/en (Sprint 41.3)", () => {
  it("fr et en ont exactement les memes cles imbriquees", () => {
    const frKeys = extractKeys(frCommissions as Record<string, unknown>);
    const enKeys = extractKeys(enCommissions as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("commissions.statuts contient EN_ATTENTE, DISPONIBLE, DEMANDEE, PAYEE, ANNULEE", () => {
    const statuts = deepGet(frCommissions, "commissions.statuts") as Record<string, string>;
    expect(statuts).toHaveProperty("EN_ATTENTE");
    expect(statuts).toHaveProperty("DISPONIBLE");
    expect(statuts).toHaveProperty("DEMANDEE");
    expect(statuts).toHaveProperty("PAYEE");
    expect(statuts).toHaveProperty("ANNULEE");
  });

  it("retraits.statuts contient EN_ATTENTE, CONFIRME, ECHEC, EXPIRE", () => {
    const statuts = deepGet(frCommissions, "retraits.statuts") as Record<string, string>;
    expect(statuts).toHaveProperty("EN_ATTENTE");
    expect(statuts).toHaveProperty("CONFIRME");
    expect(statuts).toHaveProperty("ECHEC");
    expect(statuts).toHaveProperty("EXPIRE");
  });

  it("portefeuille.title est different en fr et en", () => {
    const frVal = deepGet(frCommissions, "portefeuille.title") as string;
    const enVal = deepGet(enCommissions, "portefeuille.title") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("retraits.dialog.errors.montantMinimum mentionne 5 000 FCFA en fr", () => {
    const val = deepGet(frCommissions, "retraits.dialog.errors.montantMinimum") as string;
    expect(val).toContain("5");
    expect(val).toContain("FCFA");
  });

  it("admin.traiterDialog.ingenieur est 'Ingenieur' ou similaire en fr (non vide)", () => {
    const val = deepGet(frCommissions, "admin.traiterDialog.ingenieur") as string;
    expect(typeof val).toBe("string");
    expect(val.length).toBeGreaterThan(0);
  });

  it("retraits.dialog.virementInfo contient 'DKFarm' en fr", () => {
    const val = deepGet(frCommissions, "retraits.dialog.virementInfo") as string;
    expect(val).toContain("DKFarm");
  });

  it("aucune valeur fr/commissions n'est vide", () => {
    const frKeys = extractKeys(frCommissions as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frCommissions, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en/commissions n'est vide", () => {
    const enKeys = extractKeys(enCommissions as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const val = deepGet(enCommissions, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 41.4 — errors.json
// ---------------------------------------------------------------------------

describe("errors.json — chargement (Sprint 41.4)", () => {
  it("fr/errors.json charge et est un objet", () => {
    expect(frErrors).toBeDefined();
    expect(typeof frErrors).toBe("object");
  });

  it("en/errors.json charge et est un objet", () => {
    expect(enErrors).toBeDefined();
    expect(typeof enErrors).toBe("object");
  });

  it("fr/errors.json contient la section 'validation'", () => {
    expect(frErrors).toHaveProperty("validation");
  });

  it("fr/errors.json contient la section 'notFound'", () => {
    expect(frErrors).toHaveProperty("notFound");
  });

  it("fr/errors.json contient la section 'conflict'", () => {
    expect(frErrors).toHaveProperty("conflict");
  });

  it("fr/errors.json contient la section 'auth'", () => {
    expect(frErrors).toHaveProperty("auth");
  });

  it("fr/errors.json contient la section 'server'", () => {
    expect(frErrors).toHaveProperty("server");
  });

  it("fr/errors.json contient la section 'quota'", () => {
    expect(frErrors).toHaveProperty("quota");
  });

  it("en/errors.json contient les memes sections de premier niveau que fr", () => {
    expect(Object.keys(enErrors).sort()).toEqual(Object.keys(frErrors).sort());
  });
});

describe("errors.json — parite de cles fr/en (Sprint 41.4)", () => {
  it("fr et en ont exactement les memes cles imbriquees", () => {
    const frKeys = extractKeys(frErrors as Record<string, unknown>);
    const enKeys = extractKeys(enErrors as Record<string, unknown>);
    expect(enKeys).toEqual(frKeys);
  });

  it("notFound contient les entites metier cles : vague, bac, releve, client, user, site", () => {
    const notFound = (frErrors as Record<string, Record<string, string>>).notFound;
    expect(notFound).toHaveProperty("vague");
    expect(notFound).toHaveProperty("bac");
    expect(notFound).toHaveProperty("releve");
    expect(notFound).toHaveProperty("client");
    expect(notFound).toHaveProperty("user");
    expect(notFound).toHaveProperty("site");
  });

  it("notFound contient aussi facture, vente, produit, commande, fournisseur", () => {
    const notFound = (frErrors as Record<string, Record<string, string>>).notFound;
    expect(notFound).toHaveProperty("facture");
    expect(notFound).toHaveProperty("vente");
    expect(notFound).toHaveProperty("produit");
    expect(notFound).toHaveProperty("commande");
    expect(notFound).toHaveProperty("fournisseur");
  });

  it("conflict.bacAlreadyAssigned est present (regle metier bac unique)", () => {
    const val = deepGet(frErrors, "conflict.bacAlreadyAssigned") as string;
    expect(typeof val).toBe("string");
    expect(val.length).toBeGreaterThan(0);
  });

  it("conflict.bacAlreadyAssigned est different en fr et en", () => {
    const frVal = deepGet(frErrors, "conflict.bacAlreadyAssigned") as string;
    const enVal = deepGet(enErrors, "conflict.bacAlreadyAssigned") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("auth.unauthorized est different en fr et en", () => {
    const frVal = deepGet(frErrors, "auth.unauthorized") as string;
    const enVal = deepGet(enErrors, "auth.unauthorized") as string;
    expect(frVal).not.toBe(enVal);
  });

  it("auth.invalidCredentials est present et non vide en fr et en", () => {
    const frVal = deepGet(frErrors, "auth.invalidCredentials") as string;
    const enVal = deepGet(enErrors, "auth.invalidCredentials") as string;
    expect(typeof frVal).toBe("string");
    expect(frVal.length).toBeGreaterThan(0);
    expect(typeof enVal).toBe("string");
    expect(enVal.length).toBeGreaterThan(0);
  });

  it("server contient les cles pour les entites principales (getVagues, createVague, getBacs, etc.)", () => {
    const server = (frErrors as Record<string, Record<string, string>>).server;
    expect(server).toHaveProperty("getVagues");
    expect(server).toHaveProperty("createVague");
    expect(server).toHaveProperty("getBacs");
    expect(server).toHaveProperty("getReleves");
    expect(server).toHaveProperty("createReleve");
  });

  it("quota contient vaguesLimit et bacsLimit (limites par plan)", () => {
    const quota = (frErrors as Record<string, Record<string, string>>).quota;
    expect(quota).toHaveProperty("vaguesLimit");
    expect(quota).toHaveProperty("bacsLimit");
  });

  it("validation.fieldRequired contient '{field}' (interpolation)", () => {
    const frVal = deepGet(frErrors, "validation.fieldRequired") as string;
    const enVal = deepGet(enErrors, "validation.fieldRequired") as string;
    expect(frVal).toContain("{field}");
    expect(enVal).toContain("{field}");
  });

  it("aucune valeur fr/errors n'est vide", () => {
    const frKeys = extractKeys(frErrors as Record<string, unknown>);
    for (const keyPath of frKeys) {
      const val = deepGet(frErrors, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });

  it("aucune valeur en/errors n'est vide", () => {
    const enKeys = extractKeys(enErrors as Record<string, unknown>);
    for (const keyPath of enKeys) {
      const val = deepGet(enErrors, keyPath);
      expect(typeof val).toBe("string");
      expect((val as string).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Coherence globale — Sprint 41 (8 namespaces)
// ---------------------------------------------------------------------------

describe("Sprint 41 — coherence globale des 8 namespaces", () => {
  it("vagues.json fr et en ont le meme nombre de cles", () => {
    const frKeys = extractKeys(frVagues as Record<string, unknown>);
    const enKeys = extractKeys(enVagues as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("releves.json fr et en ont le meme nombre de cles", () => {
    const frKeys = extractKeys(frReleves as Record<string, unknown>);
    const enKeys = extractKeys(enReleves as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("stock.json fr et en ont le meme nombre de cles", () => {
    const frKeys = extractKeys(frStock as Record<string, unknown>);
    const enKeys = extractKeys(enStock as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("ventes.json fr et en ont le meme nombre de cles", () => {
    const frKeys = extractKeys(frVentes as Record<string, unknown>);
    const enKeys = extractKeys(enVentes as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("alevins.json fr et en ont le meme nombre de cles", () => {
    const frKeys = extractKeys(frAlevins as Record<string, unknown>);
    const enKeys = extractKeys(enAlevins as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("users.json fr et en ont le meme nombre de cles", () => {
    const frKeys = extractKeys(frUsers as Record<string, unknown>);
    const enKeys = extractKeys(enUsers as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("commissions.json fr et en ont le meme nombre de cles", () => {
    const frKeys = extractKeys(frCommissions as Record<string, unknown>);
    const enKeys = extractKeys(enCommissions as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("errors.json fr et en ont le meme nombre de cles", () => {
    const frKeys = extractKeys(frErrors as Record<string, unknown>);
    const enKeys = extractKeys(enErrors as Record<string, unknown>);
    expect(enKeys.length).toBe(frKeys.length);
  });

  it("FCR→ICA coherent : vagues.indicateurs.fcr='ICA' en fr", () => {
    const val = deepGet(frVagues, "indicateurs.fcr") as string;
    expect(val).toBe("ICA");
  });

  it("SGR→TCS coherent : vagues.indicateurs.sgr='TCS' en fr", () => {
    const val = deepGet(frVagues, "indicateurs.sgr") as string;
    expect(val).toBe("TCS");
  });

  it("FCR conserve 'FCR' en en dans vagues.indicateurs.fcr", () => {
    const val = deepGet(enVagues, "indicateurs.fcr") as string;
    expect(val).toBe("FCR");
  });

  it("SGR conserve 'SGR' en en dans vagues.indicateurs.sgr", () => {
    const val = deepGet(enVagues, "indicateurs.sgr") as string;
    expect(val).toBe("SGR");
  });

  it("les 8 types de releve sont couverts dans releves.types (fr et en)", () => {
    const frTypes = Object.keys((frReleves as Record<string, Record<string, string>>).types);
    const enTypes = Object.keys((enReleves as Record<string, Record<string, string>>).types);
    expect(frTypes.length).toBe(8);
    expect(enTypes.length).toBe(8);
  });

  it("errors.conflict.bacAlreadyAssigned couvre la regle metier bac unique en fr et en", () => {
    const frVal = deepGet(frErrors, "conflict.bacAlreadyAssigned") as string;
    const enVal = deepGet(enErrors, "conflict.bacAlreadyAssigned") as string;
    expect(frVal.length).toBeGreaterThan(0);
    expect(enVal.length).toBeGreaterThan(0);
  });
});
