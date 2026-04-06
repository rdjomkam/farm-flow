export {
  getBacs,
  getBacById,
  createBac,
  getBacsLibres,
  assignerBac,
  libererBac,
} from "./bacs";

export {
  getVagues,
  getVagueById,
  createVague,
  cloturerVague,
  updateVague,
} from "./vagues";

export { getReleves, createReleve, getRelevesByType, deleteReleve } from "./releves";

export { getIndicateursVague } from "./indicateurs";

export { getDashboardData } from "./dashboard";

export {
  getUserSites,
  getSiteById,
  createSite,
  updateSite,
  addMember,
  removeMember,
  updateMemberSiteRole,
  getSiteMember,
  getSiteMembers,
} from "./sites";

export {
  getUserByEmail,
  getUserByPhone,
  getUserByIdentifier,
  getUserById,
  createUser,
} from "./users";

export {
  getFournisseurs,
  getFournisseurById,
  createFournisseur,
  updateFournisseur,
  deleteFournisseur,
} from "./fournisseurs";

export {
  getProduits,
  getProduitById,
  getProduitsEnAlerte,
  createProduit,
  updateProduit,
  deleteProduit,
} from "./produits";

export {
  getMouvements,
  createMouvement,
} from "./mouvements";

export {
  getCommandes,
  getCommandeById,
  createCommande,
  envoyerCommande,
  recevoirCommande,
  annulerCommande,
} from "./commandes";

export {
  getSiteRoles,
  getSiteRoleById,
  createSiteRole,
  updateSiteRole,
  deleteSiteRole,
} from "./roles";

export {
  getIndicateursBac,
  getComparaisonBacs,
  getHistoriqueBac,
  getComparaisonAliments,
  getDetailAliment,
  getSimulationChangementAliment,
  getAnalyticsDashboard,
  getComparaisonVagues,
} from "./analytics";

export {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from "./clients";

export {
  getVentes,
  getVenteById,
  createVente,
} from "./ventes";

export {
  getFactures,
  getFactureById,
  createFacture,
  updateFacture,
  ajouterPaiement,
} from "./factures";

export {
  getReproducteurs,
  getReproducteurById,
  createReproducteur,
  updateReproducteur,
  deleteReproducteur,
} from "./reproducteurs";

export {
  getPontes,
  getPonteById,
  createPonte,
  updatePonte,
  deletePonte,
} from "./pontes";

export {
  getLotsAlevins,
  getLotAlevinsById,
  createLotAlevins,
  updateLotAlevins,
  transfererLotVersVague,
} from "./lots-alevins";

export {
  getResumeFinancier,
  getRentabiliteParVague,
  getEvolutionFinanciere,
  getTopClients,
} from "./finances";
export type {
  ResumeFinancier,
  RentabiliteVague,
  RentabiliteParVague,
  EvolutionMois,
  EvolutionFinanciere,
  TopClient,
  TopClients,
} from "./finances";

export {
  getConfigAlertes,
  createConfigAlerte,
  updateConfigAlerte,
  deleteConfigAlerte,
  getNotifications,
  getNotificationById,
  updateNotificationStatut,
  getUnreadNotificationCount,
  markAllNotificationsRead,
} from "./alertes";
// CreateConfigAlerteDTO et UpdateConfigAlerteDTO sont dans @/types

export {
  getActivites,
  getActiviteById,
  createActivite,
  updateActivite,
  deleteActivite,
  getActivitesAujourdhui,
  marquerActivitesEnRetard,
  findMatchingActivite,
  completeActivite,
  getMyTasks,
  getAllMyTasks,
  getPendingTaskCount,
} from "./activites";
// CreateActiviteDTO, UpdateActiviteDTO et ActiviteFilters sont dans @/types
export type { CreateConfigAlerteDTO, UpdateConfigAlerteDTO } from "@/types";
export type { CreateActiviteDTO, UpdateActiviteDTO, ActiviteFilters } from "@/types";

export {
  getDepensesRecurrentes,
  getDepenseRecurrenteById,
  createDepenseRecurrente,
  updateDepenseRecurrente,
  deleteDepenseRecurrente,
  genererDepensesRecurrentes,
} from "./depenses-recurrentes";

// Sprint 21/25 — Moteur de regles d'activites
export {
  getReglesActivites,
  getRegleActiviteById,
  createRegleActivite,
  updateRegleActivite,
  deleteRegleActivite,
  toggleRegleActivite,
  resetFiredOnce,
} from "./regles-activites";

// Sprint 23 — Notes Ingenieur + Observations client (S17-8)
export {
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  getNotesPourClient,
  getObservationsClient,
  createObservationClient,
} from "./notes";

// Sprint 30 — Abonnements & Paiements
export {
  getPlansAbonnements,
  getPlanAbonnementById,
  createPlanAbonnement,
  updatePlanAbonnement,
  togglePlanAbonnement,
} from "./plans-abonnements";

export {
  getAbonnements,
  getAbonnementActif,
  getAbonnementActifPourSite,
  getAbonnementById,
  createAbonnement,
  activerAbonnement,
  suspendreAbonnement,
  expirerAbonnement,
  getAbonnementsExpirantAvant,
  getAbonnementsEnGraceExpires,
  logAbonnementAudit,
} from "./abonnements";

export {
  createPaiementAbonnement,
  confirmerPaiement,
  getPaiementsByAbonnement,
  getPaiementByReference,
  updatePaiementApresInitiation,
} from "./paiements-abonnements";

export {
  getRemises,
  getRemiseByCode,
  createRemise,
  appliquerRemise,
  verifierRemiseApplicable,
} from "./remises";

export {
  getCommissionsIngenieur,
  createCommission,
  rendreCommissionsDisponibles,
  getPortefeuille,
  demanderRetrait,
  traiterRetrait,
} from "./commissions";

// Sprint 46 — Quota sites (user-level)
export {
  getQuotaSites,
  getQuotasUsage,
  getQuotasUsageWithCounts,
  normaliseLimite,
  isQuotaAtteint,
} from "@/lib/abonnements/check-quotas";
export type { QuotaRessource, QuotasUsage, QuotaSites } from "@/lib/abonnements/check-quotas";
