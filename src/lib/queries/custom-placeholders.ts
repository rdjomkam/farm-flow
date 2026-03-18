import { prisma } from "@/lib/db";
import type { CreateCustomPlaceholderDTO, UpdateCustomPlaceholderDTO } from "@/types";
import { KNOWN_PLACEHOLDERS } from "@/lib/regles-activites-constants";
import {
  validateFormulaSyntax,
  extractFormulaIdentifiers,
} from "@/lib/activity-engine/formula-evaluator";

// Static placeholder keys — cannot be used as custom keys
const STATIC_KEYS = new Set(KNOWN_PLACEHOLDERS.map((p) => p.key));

// Allowed source paths for MAPPING mode — re-exported from shared module
import { ALLOWED_SOURCE_PATHS } from "@/lib/source-path-entities";
export { ALLOWED_SOURCE_PATHS };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateKey(key: string): void {
  if (!/^[a-z][a-z0-9_]*$/.test(key)) {
    throw new Error(
      "La cle doit commencer par une lettre minuscule et contenir uniquement des lettres, chiffres et underscores."
    );
  }
}

function validateModeFields(
  mode: string,
  sourcePath: string | null | undefined,
  formula: string | null | undefined,
  key: string
): void {
  if (mode === "MAPPING") {
    if (!sourcePath) {
      throw new Error("Le chemin source est requis pour le mode MAPPING.");
    }
    if (!ALLOWED_SOURCE_PATHS.includes(sourcePath)) {
      throw new Error(`Chemin source non autorise: "${sourcePath}".`);
    }
  } else if (mode === "FORMULA") {
    if (!formula) {
      throw new Error("La formule est requise pour le mode FORMULA.");
    }
    if (!validateFormulaSyntax(formula)) {
      throw new Error("La syntaxe de la formule est invalide.");
    }
    const refs = extractFormulaIdentifiers(formula);
    if (refs.includes(key)) {
      throw new Error(
        "La formule ne peut pas referencer son propre placeholder (reference circulaire)."
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Liste tous les custom placeholders, tries par cle.
 *
 * @param onlyActive - Si true, retourne uniquement les placeholders actifs (defaut false)
 */
export async function getCustomPlaceholders(onlyActive = false) {
  return prisma.customPlaceholder.findMany({
    where: onlyActive ? { isActive: true } : {},
    orderBy: { key: "asc" },
  });
}

/**
 * Recupere un custom placeholder par ID.
 *
 * @param id - ID du placeholder
 */
export async function getCustomPlaceholderById(id: string) {
  return prisma.customPlaceholder.findUnique({ where: { id } });
}

/**
 * Cree un custom placeholder.
 *
 * Validations :
 * - key unique (pas de collision avec les placeholders statiques ni entre custom)
 * - key format valide (lowercase, chiffres, underscores)
 * - formule valide si mode FORMULA
 * - sourcePath valide si mode MAPPING
 * - pas de reference circulaire dans les formules
 *
 * @param data - Donnees de creation
 */
export async function createCustomPlaceholder(data: CreateCustomPlaceholderDTO) {
  // Validate key not reserved by static system
  if (STATIC_KEYS.has(data.key)) {
    throw new Error(`La cle "${data.key}" est reservee (placeholder systeme).`);
  }

  // Validate key format
  validateKey(data.key);

  // Mode-specific validation
  validateModeFields(data.mode, data.sourcePath ?? null, data.formula ?? null, data.key);

  return prisma.customPlaceholder.create({
    data: {
      key: data.key,
      label: data.label,
      description: data.description ?? null,
      example: data.example,
      mode: data.mode,
      sourcePath: data.mode === "MAPPING" ? (data.sourcePath ?? null) : null,
      formula: data.mode === "FORMULA" ? (data.formula ?? null) : null,
      format: data.format ?? "NUMBER",
      decimals: data.decimals ?? 2,
    },
  });
}

/**
 * Met a jour un custom placeholder existant.
 *
 * Validations identiques a la creation pour les champs modifies.
 *
 * @param id   - ID du placeholder a modifier
 * @param data - Champs a mettre a jour (tous optionnels)
 */
export async function updateCustomPlaceholder(id: string, data: UpdateCustomPlaceholderDTO) {
  const existing = await prisma.customPlaceholder.findUnique({ where: { id } });
  if (!existing) throw new Error("Placeholder introuvable.");

  // Validate key uniqueness and format if changing key
  if (data.key !== undefined && data.key !== existing.key) {
    if (STATIC_KEYS.has(data.key)) {
      throw new Error(`La cle "${data.key}" est reservee (placeholder systeme).`);
    }
    validateKey(data.key);
  }

  const finalMode = data.mode ?? existing.mode;
  const finalKey = data.key ?? existing.key;
  const finalSourcePath =
    data.sourcePath !== undefined ? data.sourcePath : existing.sourcePath;
  const finalFormula =
    data.formula !== undefined ? data.formula : existing.formula;

  // Mode-specific validation with final values
  validateModeFields(finalMode, finalSourcePath, finalFormula, finalKey);

  return prisma.customPlaceholder.update({
    where: { id },
    data: {
      ...(data.key !== undefined && { key: data.key }),
      ...(data.label !== undefined && { label: data.label }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.example !== undefined && { example: data.example }),
      ...(data.mode !== undefined && { mode: data.mode }),
      ...(data.sourcePath !== undefined && { sourcePath: data.sourcePath ?? null }),
      ...(data.formula !== undefined && { formula: data.formula ?? null }),
      ...(data.format !== undefined && { format: data.format }),
      ...(data.decimals !== undefined && { decimals: data.decimals }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

/**
 * Supprime un custom placeholder par ID.
 *
 * @param id - ID du placeholder a supprimer
 */
export async function deleteCustomPlaceholder(id: string) {
  const existing = await prisma.customPlaceholder.findUnique({ where: { id } });
  if (!existing) throw new Error("Placeholder introuvable.");
  await prisma.customPlaceholder.delete({ where: { id } });
  return { success: true };
}
