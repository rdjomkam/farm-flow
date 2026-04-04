import { Permission } from "@/types";

// ---------------------------------------------------------------------------
// Static fallback maps (used in non-i18n contexts or as default locale fr)
// ---------------------------------------------------------------------------

export const groupLabels: Record<string, string> = {
  administration: "Administration",
  elevage: "Elevage",
  stock: "Stock & Approvisionnement",
  clients: "Clients",
  ventes: "Ventes & Facturation",
  alevins: "Production Alevins",
  planning: "Planning",
  finances: "Finances",
  alertes: "Alertes",
  depenses: "Depenses & Besoins",
  general: "General",
  packs: "Packs & Provisioning",
  configElevage: "Configuration Elevage",
  ingenieur: "Ingenieur",
  utilisateurs: "Utilisateurs",
  abonnements: "Abonnements & Commissions",
};

export const permissionLabels: Record<string, string> = {
  [Permission.SITE_GERER]: "Gerer le site",
  [Permission.MEMBRES_GERER]: "Gerer les membres",
  [Permission.VAGUES_VOIR]: "Voir les vagues",
  [Permission.VAGUES_CREER]: "Creer des vagues",
  [Permission.VAGUES_MODIFIER]: "Modifier les vagues",
  [Permission.BACS_GERER]: "Gerer les bacs",
  [Permission.BACS_MODIFIER]: "Modifier les bacs",
  [Permission.RELEVES_VOIR]: "Voir les releves",
  [Permission.RELEVES_CREER]: "Creer des releves",
  [Permission.RELEVES_MODIFIER]: "Modifier les releves",
  [Permission.CALIBRAGES_VOIR]: "Voir les calibrages",
  [Permission.CALIBRAGES_CREER]: "Creer des calibrages",
  [Permission.CALIBRAGES_MODIFIER]: "Modifier les calibrages",
  [Permission.STOCK_VOIR]: "Voir le stock",
  [Permission.STOCK_GERER]: "Gerer le stock",
  [Permission.APPROVISIONNEMENT_VOIR]: "Voir approvisionnement",
  [Permission.APPROVISIONNEMENT_GERER]: "Gerer approvisionnement",
  [Permission.CLIENTS_VOIR]: "Voir les clients",
  [Permission.CLIENTS_GERER]: "Gerer les clients",
  [Permission.VENTES_VOIR]: "Voir les ventes",
  [Permission.VENTES_CREER]: "Creer des ventes",
  [Permission.FACTURES_VOIR]: "Voir les factures",
  [Permission.FACTURES_GERER]: "Gerer les factures",
  [Permission.PAIEMENTS_CREER]: "Enregistrer des paiements",
  [Permission.ALEVINS_VOIR]: "Voir les alevins",
  [Permission.ALEVINS_CREER]: "Creer des lots d'alevins",
  [Permission.ALEVINS_MODIFIER]: "Modifier les alevins",
  [Permission.ALEVINS_SUPPRIMER]: "Supprimer des alevins",
  [Permission.ALEVINS_GERER]: "Gerer les alevins",
  [Permission.PLANNING_VOIR]: "Voir le planning",
  [Permission.PLANNING_GERER]: "Gerer le planning",
  [Permission.FINANCES_VOIR]: "Voir les finances",
  [Permission.FINANCES_GERER]: "Gerer les finances",
  [Permission.ALERTES_VOIR]: "Voir les alertes",
  [Permission.ALERTES_CONFIGURER]: "Configurer les alertes",
  [Permission.DASHBOARD_VOIR]: "Voir le dashboard",
  [Permission.EXPORT_DONNEES]: "Exporter les donnees",
  [Permission.DEPENSES_VOIR]: "Voir les depenses",
  [Permission.DEPENSES_CREER]: "Creer des depenses",
  [Permission.DEPENSES_MODIFIER]: "Modifier les depenses",
  [Permission.DEPENSES_PAYER]: "Payer les depenses",
  [Permission.DEPENSES_SUPPRIMER]: "Supprimer des depenses",
  [Permission.BESOINS_SOUMETTRE]: "Soumettre des besoins",
  [Permission.BESOINS_APPROUVER]: "Approuver des besoins",
  [Permission.BESOINS_TRAITER]: "Traiter des besoins",
  // Phase 3
  [Permission.GERER_PACKS]: "Gerer les packs",
  [Permission.ACTIVER_PACKS]: "Activer les packs",
  [Permission.GERER_CONFIG_ELEVAGE]: "Gerer la configuration d'elevage",
  [Permission.REGLES_ACTIVITES_VOIR]: "Voir les regles d'activites",
  [Permission.GERER_REGLES_ACTIVITES]: "Gerer les regles d'activites",
  [Permission.GERER_REGLES_GLOBALES]: "Gerer les regles globales",
  [Permission.MONITORING_CLIENTS]: "Monitoring clients",
  [Permission.ENVOYER_NOTES]: "Envoyer des notes",
  // Utilisateurs
  [Permission.UTILISATEURS_VOIR]: "Voir les utilisateurs",
  [Permission.UTILISATEURS_CREER]: "Creer des utilisateurs",
  [Permission.UTILISATEURS_MODIFIER]: "Modifier les utilisateurs",
  [Permission.UTILISATEURS_SUPPRIMER]: "Supprimer des utilisateurs",
  [Permission.UTILISATEURS_GERER]: "Gerer les utilisateurs",
  [Permission.UTILISATEURS_IMPERSONNER]: "Impersonner un utilisateur",
  // Abonnements & Commissions
  [Permission.ABONNEMENTS_VOIR]: "Voir les abonnements",
  [Permission.ABONNEMENTS_GERER]: "Gerer les abonnements",
  [Permission.PLANS_GERER]: "Gerer les plans",
  [Permission.REMISES_GERER]: "Gerer les remises",
  [Permission.COMMISSIONS_VOIR]: "Voir les commissions",
  [Permission.COMMISSIONS_GERER]: "Gerer les commissions",
  [Permission.COMMISSION_PREMIUM]: "Commission premium",
  [Permission.PORTEFEUILLE_VOIR]: "Voir le portefeuille",
  [Permission.PORTEFEUILLE_GERER]: "Gerer le portefeuille",
};

// ---------------------------------------------------------------------------
// i18n-compatible helper functions
// Usage: pass t from useTranslations("permissions") or getTranslations("permissions")
// ---------------------------------------------------------------------------

type TranslateFn = (key: string) => string;

/**
 * Get the translated label for a permission group key.
 * Falls back to the static groupLabels map if t is not provided.
 */
export function getGroupLabel(groupKey: string, t?: TranslateFn): string {
  if (t) {
    try {
      return t(`groups.${groupKey}`);
    } catch {
      // Key not found in messages — fall through to static fallback
    }
  }
  return groupLabels[groupKey] ?? groupKey;
}

/**
 * Get the translated label for a permission value.
 * Falls back to the static permissionLabels map if t is not provided.
 */
export function getPermissionLabel(permission: string, t?: TranslateFn): string {
  if (t) {
    try {
      return t(`permissions.${permission}`);
    } catch {
      // Key not found in messages — fall through to static fallback
    }
  }
  return permissionLabels[permission] ?? permission;
}
