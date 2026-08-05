/**
 * Regle de normalisation pour `PosteReferentiel.code` (ADR-053 §16.11, story A.4 ; statut
 * corrige par ADR-053 §17, story PR2non.5, ERR-184).
 *
 * SEULE autorite vivante pour cette normalisation, a l'execution : appelee aux deux seuls
 * endroits qui ecrivent un `code` en base a l'execution (`resoudreBrancheNouveauPosteReferentiel`
 * et son rattrapage de collision concurrente, dans `src/lib/queries/previsions-charges.ts`).
 *
 * ATTENTION — corrige une affirmation fausse de l'en-tete d'origine : cette fonction n'est PAS
 * le seul point de verite de la normalisation dans le depot. Le backfill de la migration
 * `prisma/migrations/20260805120000_add_poste_referentiel/migration.sql` (deja appliquee, R10 —
 * ne sera JAMAIS reecrite ni pour corriger ni pour aligner son algorithme sur celui-ci)
 * reimplemente independamment la meme regle en SQL (`translate()` sur une table figee de
 * caracteres latins accentues), et diverge PROUVABLEMENT de cette fonction sur `Ø`/`ø` et les
 * diacritiques d'Europe centrale/Baltique (ERR-184, test de parite
 * `src/lib/previsions/__tests__/sluggifier-poste-parite-sql.test.ts`). ADR-053 §17 tranche que
 * cette divergence n'a plus a etre resorbee : le SQL de cette migration est un artefact
 * historique fige (aucune fonction/trigger/DEFAULT/colonne GENERATED/CHECK vivant n'en depend en
 * base, verifie par
 * `src/lib/queries/__tests__/previsions-poste-referentiel-sql-artefact-historique-integration.test.ts`),
 * pas un invariant de parite a maintenir avec cette fonction. Toute evolution future de cette
 * fonction n'a donc AUCUNE obligation de rester en phase avec le texte de cette migration.
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
