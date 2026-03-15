import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// System role definitions (used when creating a new site)
// ---------------------------------------------------------------------------

/**
 * SYSTEM_ROLE_DEFINITIONS — roles systeme crees automatiquement a la creation d'un site.
 *
 * Ces definitions sont utilisees par le seed et par la mutation createSite
 * pour initialiser les SiteRole isSystem=true sur chaque nouveau site.
 * Remplace DEFAULT_PERMISSIONS qui etait indexe par Role statique.
 */
export const SYSTEM_ROLE_DEFINITIONS = [
  {
    name: "Administrateur",
    description: "Acces complet au site",
    permissions: Object.values(Permission),
  },
  {
    name: "Gerant",
    description: "Gestion quotidienne sans administration",
    permissions: Object.values(Permission).filter(
      (p) => p !== Permission.SITE_GERER && p !== Permission.MEMBRES_GERER
    ),
  },
  {
    name: "Pisciculteur",
    description: "Operations de base",
    permissions: [
      Permission.VAGUES_VOIR,
      Permission.RELEVES_VOIR,
      Permission.RELEVES_CREER,
      Permission.BACS_GERER,
      Permission.DASHBOARD_VOIR,
      Permission.ALERTES_VOIR,
    ],
  },
] as const;

// ---------------------------------------------------------------------------
// Anti-escalation: verifier qu'un caller peut assigner un role cible
// ---------------------------------------------------------------------------

/**
 * canAssignRole — verifie que le caller peut assigner ce role.
 *
 * Un caller ne peut assigner un role que si ses propres permissions
 * constituent un sur-ensemble des permissions du role cible (anti-escalation).
 *
 * @param callerPermissions - permissions effectives du caller
 * @param targetRolePermissions - permissions du role a assigner
 * @returns true si le caller peut assigner ce role
 */
export function canAssignRole(
  callerPermissions: Permission[],
  targetRolePermissions: Permission[]
): boolean {
  return targetRolePermissions.every((p) => callerPermissions.includes(p));
}

// ---------------------------------------------------------------------------
// Permission groups for UI display
// ---------------------------------------------------------------------------

export const PERMISSION_GROUPS = {
  administration: [Permission.SITE_GERER, Permission.MEMBRES_GERER],
  elevage: [
    Permission.VAGUES_VOIR,
    Permission.VAGUES_CREER,
    Permission.VAGUES_MODIFIER,
    Permission.BACS_GERER,
    Permission.BACS_MODIFIER,
    Permission.RELEVES_VOIR,
    Permission.RELEVES_CREER,
    Permission.RELEVES_MODIFIER,
  ],
  stock: [
    Permission.STOCK_VOIR,
    Permission.STOCK_GERER,
    Permission.APPROVISIONNEMENT_VOIR,
    Permission.APPROVISIONNEMENT_GERER,
  ],
  clients: [Permission.CLIENTS_VOIR, Permission.CLIENTS_GERER],
  ventes: [
    Permission.VENTES_VOIR,
    Permission.VENTES_CREER,
    Permission.FACTURES_VOIR,
    Permission.FACTURES_GERER,
    Permission.PAIEMENTS_CREER,
  ],
  alevins: [
    Permission.ALEVINS_VOIR,
    Permission.ALEVINS_CREER,
    Permission.ALEVINS_MODIFIER,
    Permission.ALEVINS_SUPPRIMER,
    Permission.ALEVINS_GERER,
  ],
  planning: [Permission.PLANNING_VOIR, Permission.PLANNING_GERER],
  finances: [Permission.FINANCES_VOIR, Permission.FINANCES_GERER],
  alertes: [Permission.ALERTES_VOIR, Permission.ALERTES_CONFIGURER],
  depenses: [
    Permission.DEPENSES_VOIR,
    Permission.DEPENSES_CREER,
    Permission.DEPENSES_PAYER,
    Permission.BESOINS_SOUMETTRE,
    Permission.BESOINS_APPROUVER,
    Permission.BESOINS_TRAITER,
  ],
  general: [
    Permission.DASHBOARD_VOIR,
    Permission.EXPORT_DONNEES,
  ],
  // Phase 3 — Packs & Ingénieur (Sprint 20)
  packs: [
    Permission.GERER_PACKS,
    Permission.ACTIVER_PACKS,
  ],
  configElevage: [
    Permission.GERER_CONFIG_ELEVAGE,
    Permission.GERER_REGLES_ACTIVITES,
  ],
  ingenieur: [
    Permission.MONITORING_CLIENTS,
    Permission.ENVOYER_NOTES,
  ],
} as const;

// ---------------------------------------------------------------------------
// Nav permission mapping — which permission is needed to SEE a module/route
// ---------------------------------------------------------------------------

/** Module → required "view" permission mapping (for nav filtering) */
export const MODULE_VIEW_PERMISSIONS: Record<string, Permission> = {
  Reproduction: Permission.ALEVINS_VOIR,
  Grossissement: Permission.VAGUES_VOIR,
  Intrants: Permission.STOCK_VOIR,
  Ventes: Permission.VENTES_VOIR,
  "Analyse & Pilotage": Permission.DASHBOARD_VOIR,
};

/** Item → required "view" permission mapping (for per-item nav filtering).
 *  Items not listed here inherit their module-level gate from MODULE_VIEW_PERMISSIONS. */
export const ITEM_VIEW_PERMISSIONS: Record<string, Permission> = {
  // Grossissement (gate: VAGUES_VOIR)
  "/bacs":               Permission.BACS_GERER,
  "/releves/nouveau":    Permission.RELEVES_CREER,
  // Intrants (gate: STOCK_VOIR)
  "/stock/fournisseurs": Permission.APPROVISIONNEMENT_VOIR,
  "/stock/commandes":    Permission.APPROVISIONNEMENT_VOIR,
  // Ventes (gate: VENTES_VOIR)
  "/clients":            Permission.CLIENTS_VOIR,
  "/factures":           Permission.FACTURES_VOIR,
  "/finances":           Permission.FINANCES_VOIR,
  // Depenses & Besoins (Sprint 18)
  "/depenses":               Permission.DEPENSES_VOIR,
  "/depenses/recurrentes":   Permission.DEPENSES_VOIR,
  "/besoins":                Permission.BESOINS_SOUMETTRE,
  // Analyse & Pilotage (gate: DASHBOARD_VOIR)
  "/planning":           Permission.PLANNING_VOIR,
  "/planning/nouvelle":  Permission.PLANNING_GERER,
  "/mes-taches":         Permission.PLANNING_VOIR,
  "/analytics/finances": Permission.FINANCES_VOIR,
};

export const SECONDARY_VIEW_PERMISSIONS: Record<string, Permission> = {
  "/sites": Permission.SITE_GERER,
  "/settings/alertes": Permission.ALERTES_CONFIGURER,
  "/notifications": Permission.ALERTES_VOIR,
};

export function hasPermission(permissions: Permission[], required: Permission): boolean {
  return permissions.includes(required);
}

export function hasAnyPermission(permissions: Permission[], required: Permission[]): boolean {
  return required.some((p) => permissions.includes(p));
}
