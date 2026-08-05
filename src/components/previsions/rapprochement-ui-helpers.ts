/**
 * src/components/previsions/rapprochement-ui-helpers.ts
 *
 * Aides d'AFFICHAGE PUR pour l'onglet Rapprochement (Sprint PR3, story
 * PR3.7) — mappent une `CouleurEcart` DEJA TRANCHEE par le moteur
 * (`couleurPourSensEcart`, cote serveur, cf. `rapprochement-dto.ts`) vers
 * des classes Tailwind. AUCUNE fonction ici ne compare `prevu`/`reel`, ne
 * recalcule un signe, ni un pourcentage — c'est exactement l'interdiction
 * de l'ADR-053 section 15.5/15.6 (ERR-171) : un composant ne fait QUE lire
 * `ligne.sens`/`ligne.couleur` et choisir une classe.
 *
 * R6 : uniquement des classes Tailwind adossees aux variables CSS du theme
 * (`text-danger`/`text-success`/`text-warning`, deja definies
 * `src/app/globals.css`), jamais une couleur hexadecimale en dur.
 */
import type { CouleurEcartDTO } from "@/components/previsions/rapprochement-types";

/** Classe de texte pour une `CouleurEcart` — jamais une comparaison, une simple table de correspondance. */
export function classeTexteCouleur(couleur: CouleurEcartDTO): string {
  switch (couleur) {
    case "vert":
      return "text-success";
    case "rouge":
      return "text-danger";
    case "orange":
      return "text-warning";
    case "neutre":
    default:
      return "text-muted-foreground";
  }
}

/** Classe de fond discrete (badge/pastille) pour une `CouleurEcart`. */
export function classeFondCouleur(couleur: CouleurEcartDTO): string {
  switch (couleur) {
    case "vert":
      return "bg-success/10";
    case "rouge":
      return "bg-danger/10";
    case "orange":
      return "bg-warning/10";
    case "neutre":
    default:
      return "bg-muted";
  }
}
