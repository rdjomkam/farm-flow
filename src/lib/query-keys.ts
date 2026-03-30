/**
 * Query key factory for TanStack Query.
 *
 * Convention:
 *   - `all`  → broadest key for a domain (use for mass invalidation)
 *   - `list` → filtered collection
 *   - `detail` → single entity by id
 *
 * Usage:
 *   queryKeys.vagues.all              → ["vagues"]
 *   queryKeys.vagues.list({ statut }) → ["vagues", "list", { statut }]
 *   queryKeys.vagues.detail("abc")    → ["vagues", "detail", "abc"]
 */

export const queryKeys = {
  // --- Core ---
  vagues: {
    all: ["vagues"] as const,
    list: (filters?: Record<string, unknown>) => ["vagues", "list", filters] as const,
    detail: (id: string) => ["vagues", "detail", id] as const,
  },
  releves: {
    all: ["releves"] as const,
    list: (filters?: Record<string, unknown>) => ["releves", "list", filters] as const,
  },
  bacs: {
    all: ["bacs"] as const,
    list: (filters?: Record<string, unknown>) => ["bacs", "list", filters] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
  },

  // --- Stock ---
  produits: {
    all: ["produits"] as const,
    list: () => ["produits", "list"] as const,
    detail: (id: string) => ["produits", "detail", id] as const,
  },
  stock: {
    mouvements: (filters?: Record<string, unknown>) => ["stock", "mouvements", filters] as const,
    commandes: (filters?: Record<string, unknown>) => ["stock", "commandes", filters] as const,
    fournisseurs: () => ["stock", "fournisseurs"] as const,
  },

  // --- Ventes ---
  clients: {
    all: ["clients"] as const,
    list: () => ["clients", "list"] as const,
  },
  ventes: {
    all: ["ventes"] as const,
    list: (filters?: Record<string, unknown>) => ["ventes", "list", filters] as const,
    detail: (id: string) => ["ventes", "detail", id] as const,
  },
  factures: {
    all: ["factures"] as const,
    list: (filters?: Record<string, unknown>) => ["factures", "list", filters] as const,
    detail: (id: string) => ["factures", "detail", id] as const,
  },

  // --- Alevins ---
  alevins: {
    pontes: (filters?: Record<string, unknown>) => ["alevins", "pontes", filters] as const,
    lots: (filters?: Record<string, unknown>) => ["alevins", "lots", filters] as const,
    reproducteurs: () => ["alevins", "reproducteurs"] as const,
  },

  // --- Notifications & Alertes ---
  notifications: {
    all: ["notifications"] as const,
    count: () => ["notifications", "count"] as const,
  },

  // --- Depenses ---
  depenses: {
    all: ["depenses"] as const,
    list: (filters?: Record<string, unknown>) => ["depenses", "list", filters] as const,
  },

  // --- Besoins ---
  besoins: {
    all: ["besoins"] as const,
    list: (filters?: Record<string, unknown>) => ["besoins", "list", filters] as const,
  },

  // --- Planning ---
  planning: {
    activites: (filters?: Record<string, unknown>) => ["planning", "activites", filters] as const,
    regles: () => ["planning", "regles"] as const,
  },

  // --- Users & Sites ---
  users: {
    all: ["users"] as const,
    list: () => ["users", "list"] as const,
    detail: (id: string) => ["users", "detail", id] as const,
  },
  sites: {
    all: ["sites"] as const,
    list: () => ["sites", "list"] as const,
    detail: (id: string) => ["sites", "detail", id] as const,
    members: (siteId: string) => ["sites", "members", siteId] as const,
    roles: (siteId: string) => ["sites", "roles", siteId] as const,
  },

  // --- Abonnements & Config ---
  abonnements: {
    all: ["abonnements"] as const,
    plans: () => ["abonnements", "plans"] as const,
    packs: () => ["abonnements", "packs"] as const,
  },
  config: {
    all: ["config"] as const,
    elevage: () => ["config", "elevage"] as const,
    roles: () => ["config", "roles"] as const,
  },

  // --- Notes & Observations ---
  notes: {
    all: ["notes"] as const,
    list: (filters?: Record<string, unknown>) => ["notes", "list", filters] as const,
  },

  // --- Commissions & Remises ---
  commissions: {
    all: ["commissions"] as const,
  },
  remises: {
    all: ["remises"] as const,
  },
} as const;
