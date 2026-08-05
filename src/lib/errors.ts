/**
 * Erreurs metier de l'application Suivi Silures.
 *
 * Ces classes permettent aux routes API de distinguer les erreurs metier
 * des erreurs systeme et de retourner le code HTTP approprié (ex: 422).
 */

/**
 * Erreur levee quand la conservation des poissons n'est pas respectee
 * lors d'un calibrage.
 *
 * Conservation : sum(groupes.nombrePoissons) + nombreMorts === sum(sources.vivants)
 * Tolerance : 0.5% du total source, minimum 1.
 *
 * Retourne 422 Unprocessable Entity depuis les routes POST/PATCH calibrages.
 */
export class ConservationError extends Error {
  constructor(
    message: string,
    public readonly sourcesTotal: number,
    public readonly saisiTotal: number,
    public readonly ecart: number,
    public readonly nombreMorts: number,
    public readonly bacId?: string,
  ) {
    super(message);
    this.name = "ConservationError";
  }
}

/**
 * Erreur levee lors d'une validation metier echouee (ex: type de vague
 * invalide, statut incompatible, champ invalide).
 *
 * Retourne 400 Bad Request par defaut depuis les routes API (`handleApiError`,
 * `src/lib/api-utils.ts`, gere ce type de maniere centrale, AVANT tout
 * `statusMap` local a une route).
 *
 * `status` (optionnel, defaut 400) : permet a un site de levee de choisir
 * 422 (Unprocessable Entity) pour une violation de REGLE METIER sur un
 * payload par ailleurs bien forme — distinct de 400 (payload malforme).
 * Ajoute pour ERR-162 (`src/lib/previsions/validation.ts`,
 * `validerCouvertureMoisRepartition`) : cette violation est de la meme
 * famille que "la somme des pourcentages doit valoir 100" (422, deja mappee
 * dans `PREVISIONS_STATUS_MAP`), jamais une malformation de payload (400) —
 * le champ `status` evite d'ajouter une nouvelle entree `match:` a ce
 * statusMap (deja signale fragile, ERR-165) pour un cas qui a deja un
 * mecanisme type disponible ici. Retro-compatible : tous les appelants
 * existants omettent `status` et continuent de recevoir 400 sans changement.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Erreur metier typee portant explicitement son statut HTTP (et,
 * optionnellement, un code machine stable) — remplacement d'ERR-165
 * (`docs/knowledge/ERRORS-AND-FIXES.md`, `PREVISIONS_STATUS_MAP` par
 * `message.includes()` dans `src/app/api/previsions/_shared.ts`).
 *
 * ERR-165 : deriver un statut HTTP d'une sous-chaine d'un message
 * utilisateur cree un couplage invisible entre le texte d'UI (traduisible,
 * reformulable) et le contrat d'API — accentuer un message francais
 * (correction legitime) cassait silencieusement le mapping et faisait
 * retomber le cas en 500. `BusinessRuleError` porte son `status` comme
 * DONNEE, jamais deduit du texte : `handleApiError`
 * (`src/lib/api-utils.ts`) lit `error.status` directement.
 *
 * Distinct de `ValidationError` (retro-compatible, statut par defaut 400,
 * introduite pour ERR-162) : les deux classes forment la MEME famille
 * generalisee par ADR-053 §15.4 (typage explicite plutot qu'un mapping par
 * sous-chaine) — `BusinessRuleError` ajoute un `code` machine optionnel et
 * rend le `status` obligatoire (jamais de defaut implicite pour une
 * violation de regle metier : chaque site de levee doit choisir
 * explicitement 400/409/422).
 *
 * @example
 * throw new BusinessRuleError(
 *   "La somme des pourcentages de repartition mensuelle doit valoir 100.",
 *   422
 * );
 */
export class BusinessRuleError extends Error {
  constructor(
    message: string,
    public readonly status: number, // 400 | 409 | 422 — jamais deduit du message
    public readonly code?: string // identifiant machine stable, optionnel (ex. futur i18n)
  ) {
    super(message);
    this.name = "BusinessRuleError";
  }
}
