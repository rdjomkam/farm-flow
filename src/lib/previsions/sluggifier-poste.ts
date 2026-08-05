/**
 * Regle de normalisation pour `PosteReferentiel.code` (ADR-053 §16.11, story A.4).
 *
 * Seul point de verite de la normalisation : utilisee aux DEUX seuls endroits qui produisent
 * un `code` — le get-or-create de `createPostePrevision`
 * (`src/lib/queries/previsions-charges.ts`) et le backfill de la migration
 * `prisma/migrations/20260805120000_add_poste_referentiel/migration.sql` (implemente en SQL,
 * doit produire strictement le meme resultat que cette fonction — verifie par test sur les
 * libelles reellement presents en base, cf. pre-analyse §8).
 *
 * Etapes (dans cet ordre, ADR-053 §16.11) :
 *   1. Normalisation Unicode NFD puis suppression des marques diacritiques combinantes
 *      (plage U+0300-U+036F) — elimine les accents ("Energie" <- "Énergie").
 *   2. Mise en minuscules.
 *   3. Remplacement de chaque suite MAXIMALE de caracteres hors [a-z0-9] par un unique '-'
 *      (aucune substitution semantique : '&' ne devient jamais "et").
 *   4. Suppression des '-' en tete et en fin de chaine.
 *   5. Chaine vide -> echec explicite (BusinessRuleError, 400) — jamais un code vide en base.
 *   6. Troncature defensive a 100 caracteres, au dernier '-' avant la limite, puis nouveau
 *      passage de l'etape 4.
 */

import { BusinessRuleError } from "@/lib/errors";

const LONGUEUR_MAX_CODE = 100;

// Marques diacritiques combinantes Unicode, U+0300 a U+036F (decomposition NFD des lettres
// accentuees latines : é -> e + U+0301, etc.)
const DIACRITIQUES_COMBINANTES = /[̀-ͯ]/g;

export function sluggifierLibellePoste(libelle: string): string {
  const sansDiacritiques = libelle.normalize("NFD").replace(DIACRITIQUES_COMBINANTES, "");
  const minuscule = sansDiacritiques.toLowerCase();
  const separe = minuscule.replace(/[^a-z0-9]+/g, "-");
  let slug = separe.replace(/^-+|-+$/g, "");

  if (slug === "") {
    throw new BusinessRuleError(
      "Libellé invalide : aucun caractère alphanumérique.",
      400,
      "POSTE_LIBELLE_INVALIDE"
    );
  }

  if (slug.length > LONGUEUR_MAX_CODE) {
    slug = slug.slice(0, LONGUEUR_MAX_CODE).replace(/-[^-]*$/, "");
    slug = slug.replace(/^-+|-+$/g, "");
  }

  return slug;
}
