/**
 * Available i18n namespaces.
 * Each namespace maps to a JSON file under src/messages/{locale}/{namespace}.json.
 * Add new namespaces here when new message files are created.
 */
export const namespaces = ["common", "format", "navigation", "abonnements", "permissions", "settings", "analytics", "errors", "stock", "ventes", "vagues", "releves", "alevins", "users", "commissions", "activites", "admin", "alertes", "backoffice", "bacs", "besoins", "calibrage", "config-elevage", "dashboard", "depenses", "ingenieur", "layout", "notes", "observations", "packs", "planning", "pwa", "remises", "sites"] as const;

export type Namespace = (typeof namespaces)[number];
