/**
 * src/lib/previsions/poste-rattachement.ts
 *
 * Fonctions pures (aucune dependance DB/React) qui decident SI et COMMENT le
 * rattachement d'un `PostePrevision` (libelle scenario-local) a son entree
 * `PosteReferentiel` (libelle site-scope) doit etre signale a l'utilisateur
 * — ADR-053 §16.12, "Forme de la signalisation".
 *
 * Regle d'affichage (§16.12) :
 *   - le signal "inactif" est affiche SYSTEMATIQUEMENT si l'entree
 *     referentiel est desactivee, meme si les libelles coincident (l'
 *     utilisateur doit toujours savoir qu'un rattachement est desactive) ;
 *   - le signal "divergent" est affiche SEULEMENT si les libelles divergent
 *     (comparaison texte simple, trim + lowercase — JAMAIS
 *     `sluggifierLibellePoste`, qui gommerait des divergences visuellement
 *     reelles comme une casse differente n'affectant pas le slug mais que
 *     l'utilisateur percoit tout de meme) ET que l'entree est active.
 *   - sinon, aucun signal (cas tres majoritaire : libelles coincidents,
 *     entree active) — pour ne pas surcharger l'ecran d'une ligne redondante.
 *
 * ERR-185 : ne jamais fusionner silencieusement le libelle scenario-local et
 * le libelle referentiel sous un seul texte implicite — c'est exactement la
 * classe de defaut que cette fonction existe pour empecher de se reproduire.
 */

/** Le sous-objet `posteReferentiel` tel que porte par `PostePrevisionDTO`. */
export interface PosteRattachementInfo {
  libelle: string;
  actif: boolean;
}

export type PosteRattachementSignal =
  | { kind: "aucun" }
  | { kind: "divergent"; libelleReferentiel: string }
  | { kind: "inactif"; divergent: boolean; libelleReferentiel: string };

/**
 * Compare deux libelles affiches (pas leurs slugs) — comparaison texte
 * simple, insensible a la casse et aux espaces de bord uniquement.
 */
export function libelleDivergeDuReferentiel(
  libelleScenario: string,
  libelleReferentiel: string
): boolean {
  return libelleScenario.trim().toLowerCase() !== libelleReferentiel.trim().toLowerCase();
}

/**
 * Calcule le signal de rattachement a afficher pour un `PostePrevision`
 * donne (ADR-053 §16.12). Fonction pure, testable sans DB ni React —
 * consommee par les deux formes de presentation ("carte" et "compacte").
 */
export function calculerSignalRattachement(
  libelleScenario: string,
  referentiel: PosteRattachementInfo
): PosteRattachementSignal {
  const divergent = libelleDivergeDuReferentiel(libelleScenario, referentiel.libelle);
  if (!referentiel.actif) {
    return { kind: "inactif", divergent, libelleReferentiel: referentiel.libelle };
  }
  if (divergent) {
    return { kind: "divergent", libelleReferentiel: referentiel.libelle };
  }
  return { kind: "aucun" };
}
