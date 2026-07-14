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
  ) {
    super(message);
    this.name = "ConservationError";
  }
}

/**
 * Erreur levee lors d'une validation metier echouee (ex: type de vague
 * invalide, statut incompatible, champ invalide).
 *
 * Retourne 400 Bad Request depuis les routes API.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
