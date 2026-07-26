/**
 * Garde-fou anti-récidive — Stories SU.12 + SU.13 (unicité numero/code
 * globale → par site).
 *
 * Contexte : `@unique` sur `numero`/`code` était global dans `prisma/schema.prisma`
 * pour 9 modèles (SU.12), alors que la séquence est calculée par
 * `generateNextNumero` scopée par `siteId` (+ année, + sexe pour LotGeniteurs).
 * Deux sites distincts généraient donc systématiquement le même numéro/code
 * dès leur première création de l'année — une collision déterministe
 * multi-tenant (voir docs/analysis/pre-analysis-sprint-SU-3.md, section
 * « Incohérences trouvées » item 4). La migration
 * `20260726174843_numero_unique_par_site` corrige ce point en remplaçant le
 * `@unique` global par `@@unique([siteId, numero])` / `@@unique([siteId, code])`.
 *
 * SU.13 a étendu ce correctif à une 10e famille oubliée par SU.3/SU.12:
 * `LotAlevins.code`, via la migration
 * `20260726212515_lotalevins_code_unique_par_site` (voir
 * docs/analysis/pre-analysis-sprint-SU-numero.md, item D).
 *
 * Ce test verrouille deux invariants pour empêcher la régression :
 *   1. Aucun des 10 modèles concernés ne doit plus porter un `@unique` GLOBAL
 *      sur son champ `numero`/`code`.
 *   2. Chacun des 10 modèles DOIT porter la contrainte composite
 *      `@@unique([siteId, numero])` ou `@@unique([siteId, code])`.
 *
 * Test volontairement basé sur une lecture texte de `prisma/schema.prisma`
 * (pas sur le client Prisma généré) : c'est la source de vérité éditée par
 * les développeurs, et une régression se manifesterait d'abord ici (un futur
 * agent qui réintroduit `@unique` par réflexe sur un nouveau champ `numero`).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SCHEMA_PATH = path.resolve(process.cwd(), "prisma/schema.prisma");
const schemaSource = readFileSync(SCHEMA_PATH, "utf-8");

/** Extrait le corps texte d'un bloc `model Xxx { ... }` (premier niveau). */
function extractModelBody(modelName: string): string {
  const marker = `model ${modelName} {`;
  const start = schemaSource.indexOf(marker);
  if (start === -1) {
    throw new Error(`Modèle "${modelName}" introuvable dans prisma/schema.prisma`);
  }
  // Recherche la fermeture de bloc correspondante en comptant les accolades.
  let depth = 0;
  let i = start + marker.length - 1; // position du premier "{"
  const end = (() => {
    for (; i < schemaSource.length; i++) {
      if (schemaSource[i] === "{") depth++;
      if (schemaSource[i] === "}") {
        depth--;
        if (depth === 0) return i;
      }
    }
    throw new Error(`Bloc non fermé pour le modèle "${modelName}"`);
  })();
  return schemaSource.slice(start, end + 1);
}

// Les 9 familles concernées par SU.12 + LotAlevins (SU.13), avec le champ
// auto-généré par site — 10 familles au total.
const MODELS_NUMERO: Array<{ model: string; field: "numero" | "code" }> = [
  { model: "Facture", field: "numero" },
  { model: "Depense", field: "numero" },
  { model: "Commande", field: "numero" },
  { model: "Vente", field: "numero" },
  { model: "BonLivraison", field: "numero" },
  { model: "ListeBesoins", field: "numero" },
  { model: "Ponte", field: "code" },
  { model: "Incubation", field: "code" },
  { model: "LotGeniteurs", field: "code" },
  { model: "LotAlevins", field: "code" },
];

describe("SU.12/SU.13 — @@unique([siteId, numero|code]) verrouillé pour les 10 familles", () => {
  it.each(MODELS_NUMERO)(
    "$model.$field n'a PLUS de @unique global sur le champ",
    ({ model, field }) => {
      const body = extractModelBody(model);
      // Comparaison LIGNE PAR LIGNE (jamais de `.*`/`\s+` multi-lignes qui
      // pourrait déborder sur la ligne suivante et faussement matcher un
      // AUTRE champ `@unique`, ex. `venteId String @unique` sur Facture).
      const fieldLineRegex = new RegExp(
        `^\\s*${field}\\s+String\\??[ \\t]*@unique\\b`
      );
      const hasGlobalUniqueOnField = body
        .split("\n")
        .some((line) => fieldLineRegex.test(line));
      expect(hasGlobalUniqueOnField).toBe(false);
    }
  );

  it.each(MODELS_NUMERO)(
    "$model porte @@unique([siteId, $field])",
    ({ model, field }) => {
      const body = extractModelBody(model);
      const compositeRegex = new RegExp(
        `@@unique\\(\\[siteId,\\s*${field}\\]\\)`
      );
      expect(body).toMatch(compositeRegex);
    }
  );

  it("la migration 20260726174843_numero_unique_par_site existe et applique les 9 index composites (SU.12)", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "prisma/migrations/20260726174843_numero_unique_par_site/migration.sql"
    );
    const sql = readFileSync(migrationPath, "utf-8");

    // SU.12 ne couvre que les 9 familles d'origine — LotAlevins (SU.13) est
    // dans une migration séparée, vérifiée par le test suivant.
    const modelsSu12 = MODELS_NUMERO.filter((m) => m.model !== "LotAlevins");
    for (const { model, field } of modelsSu12) {
      expect(sql).toContain(`DROP INDEX "${model}_${field}_key"`);
      expect(sql).toContain(
        `CREATE UNIQUE INDEX "${model}_siteId_${field}_key" ON "${model}"("siteId", "${field}")`
      );
    }
  });

  it("la migration 20260726212515_lotalevins_code_unique_par_site existe et applique l'index composite (SU.13)", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "prisma/migrations/20260726212515_lotalevins_code_unique_par_site/migration.sql"
    );
    const sql = readFileSync(migrationPath, "utf-8");

    expect(sql).toContain(`DROP INDEX "LotAlevins_code_key"`);
    expect(sql).toContain(
      `CREATE UNIQUE INDEX "LotAlevins_siteId_code_key" ON "LotAlevins"("siteId", "code")`
    );
  });
});
