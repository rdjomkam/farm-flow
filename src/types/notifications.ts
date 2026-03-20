/**
 * notifications.ts — Types structures pour les actions recommandees dans les Notifications.
 *
 * Le champ Notification.actionPayload (JSON en base) est type ici en TypeScript
 * sous forme d'union discriminee par le champ `type`.
 *
 * Usage cote composant :
 * ```ts
 * import type { NotificationActionPayload } from "@/types/notifications";
 *
 * const payload = notification.actionPayload as NotificationActionPayload | null;
 * if (payload?.type === "CREER_RELEVE") {
 *   // => payload.typeReleve, payload.bacId, payload.vagueId sont disponibles
 * }
 * ```
 *
 * Avantages du typage structure vs URL libre (lien) :
 * - Le composant mobile construit l'URL dynamiquement selon son environnement
 * - Le texte du bouton CTA est traduit localement (pas encode dans l'URL)
 * - L'evolution du schema evolue sans changer la table Notification
 *
 * Sprint 27-28 (ADR-density-alerts, section 7.1)
 */

import type { TypeReleve } from "./models";

// ---------------------------------------------------------------------------
// Union discriminee — NotificationActionPayload
// ---------------------------------------------------------------------------

/**
 * Payload d'action structure pour le bouton CTA d'une Notification.
 *
 * Union discriminee par le champ `type`.
 * Correspond au JSON stocke dans Notification.actionPayload.
 */
export type NotificationActionPayload =
  | CreateReleveAction
  | ModifyBacAction
  | ViewVagueAction
  | ViewStockAction;

// ---------------------------------------------------------------------------
// Types d'action individuels
// ---------------------------------------------------------------------------

/**
 * CreateReleveAction — Ouvre le formulaire de creation de releve pre-rempli.
 *
 * L'URL est construite par le composant :
 * `/vagues/[vagueId]/releves/new?bacId=[bacId]&type=[typeReleve]`
 *
 * Cas d'usage :
 * - DENSITE_ELEVEE → CREER_RELEVE(QUALITE_EAU)
 * - DENSITE_CRITIQUE_QUALITE_EAU → CREER_RELEVE(RENOUVELLEMENT)
 * - RENOUVELLEMENT_EAU_INSUFFISANT → CREER_RELEVE(RENOUVELLEMENT)
 * - AUCUN_RELEVE_QUALITE_EAU → CREER_RELEVE(QUALITE_EAU)
 * - RAPPEL_ALIMENTATION → CREER_RELEVE(ALIMENTATION)
 * - RAPPEL_BIOMETRIE → CREER_RELEVE(BIOMETRIE)
 */
export interface CreateReleveAction {
  type: "CREER_RELEVE";
  /** Type de releve pre-selectionne dans le formulaire */
  typeReleve: TypeReleve;
  /** Bac concerne (pre-selectionne dans le formulaire) */
  bacId: string;
  /** Vague concernee (pour la route de l'URL) */
  vagueId: string;
}

/**
 * ModifyBacAction — Ouvre le formulaire de modification d'un bac.
 *
 * L'URL est construite par le composant : `/bacs/[bacId]/edit`
 *
 * Cas d'usage :
 * - Bac sans typeSysteme defini : inviter a renseigner le type pour des seuils precis
 * - Bac sans volume defini : inviter a renseigner le volume pour calculer la densite
 *
 * NOTE : "tauxRenouvellement" est exclu de champsAModifier — ce champ n'existe plus sur Bac.
 * Le renouvellement est suivi via les releves RENOUVELLEMENT.
 */
export interface ModifyBacAction {
  type: "MODIFIER_BAC";
  /** Bac a modifier */
  bacId: string;
  /**
   * Champs a mettre en evidence dans le formulaire.
   * Le composant peut surligner ou pre-focuser ces champs.
   */
  champsAModifier: ("typeSysteme" | "volume")[];
}

/**
 * ViewVagueAction — Navigue vers la page detail d'une vague.
 *
 * L'URL est construite par le composant : `/vagues/[vagueId]`
 *
 * Cas d'usage :
 * - Alertes generiques sur une vague sans action specifique recommandee
 * - Mortalite elevee : voir les details pour decider de l'action
 */
export interface ViewVagueAction {
  type: "VOIR_VAGUE";
  /** Vague a afficher */
  vagueId: string;
}

/**
 * ViewStockAction — Navigue vers la page stock (global ou produit specifique).
 *
 * L'URL est construite par le composant :
 * - `/stock` si produitId est absent
 * - `/stock?produit=[produitId]` si produitId est renseigne
 *
 * Cas d'usage :
 * - STOCK_BAS : voir le niveau de stock du produit en alerte
 */
export interface ViewStockAction {
  type: "VOIR_STOCK";
  /** Produit specifique a mettre en evidence (null = liste generale du stock) */
  produitId?: string;
}
