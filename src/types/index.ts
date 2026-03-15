/**
 * Barrel export — point d'entree unique pour tous les types du projet.
 *
 * Usage :
 * ```ts
 * import { Bac, CreateVagueDTO, IndicateursVague, ReleveTyped } from "@/types";
 * ```
 */

// Modeles et enums Prisma
export {
  Role,
  Permission,
  StatutVague,
  TypeReleve,
  TypeAliment,
  CauseMortalite,
  MethodeComptage,
  CategorieProduit,
  UniteStock,
  TypeMouvement,
  StatutCommande,
  StatutFacture,
  ModePaiement,
  SexeReproducteur,
  StatutReproducteur,
  StatutPonte,
  StatutLotAlevins,
  // Sprint 11 — Alertes & Planning
  TypeAlerte,
  StatutAlerte,
  TypeActivite,
  StatutActivite,
  Recurrence,
  // Sprint 16 — Depenses
  CategorieDepense,
  StatutDepense,
  FrequenceRecurrence,
  // Sprint 17 — Besoins
  StatutBesoins,
  // Sprint 19 — ConfigElevage
  PhaseElevage,
  // Sprint 20 — Packs & Provisioning
  StatutActivation,
  // Sprint 21 — Moteur de regles d'activites
  TypeDeclencheur,
  // Sprint 23 — Monitoring Ingénieur
  VisibiliteNote,
} from "./models";
export type {
  Site,
  SiteRole,
  SiteRoleWithCount,
  SiteMember,
  SiteMemberWithRelations,
  SiteWithMembers,
  User,
  Session,
  SessionWithUser,
  Bac,
  BacWithVague,
  Vague,
  VagueWithRelations,
  Releve,
  ReleveWithRelations,
  Fournisseur,
  Produit,
  ProduitWithFournisseur,
  MouvementStock,
  MouvementStockWithRelations,
  Commande,
  CommandeWithRelations,
  LigneCommande,
  LigneCommandeWithProduit,
  ReleveConsommation,
  ReleveConsommationWithRelations,
  Client,
  Vente,
  VenteWithRelations,
  Facture,
  FactureWithRelations,
  Paiement,
  PaiementWithRelations,
  Reproducteur,
  ReproducteurWithRelations,
  Ponte,
  PonteWithRelations,
  LotAlevins,
  LotAlevinsWithRelations,
  // Sprint 11 — Alertes & Planning
  ConfigAlerte,
  ConfigAlerteWithRelations,
  Notification,
  NotificationWithRelations,
  Activite,
  ActiviteWithRelations,
  // Sprint 16 — Depenses
  Depense,
  DepenseWithRelations,
  PaiementDepense,
  // Sprint 17 — Besoins
  ListeBesoins,
  ListeBesoinsWithRelations,
  LigneBesoin,
  LigneBesoinWithRelations,
  // Sprint 18 — Depenses Recurrentes
  DepenseRecurrente,
  DepenseRecurrenteWithRelations,
  // Sprint 19 — ConfigElevage
  ConfigElevage,
  ConfigElevageWithRelations,
  AlimentTailleEntree,
  AlimentTauxEntree,
  // Sprint 20 — Packs & Provisioning
  Pack,
  PackWithRelations,
  PackProduit,
  PackProduitWithProduit,
  PackActivation,
  PackActivationWithRelations,
  // Sprint 21 — Moteur de regles d'activites
  RegleActivite,
  RegleActiviteWithRelations,
  // Sprint 23 — Monitoring Ingénieur
  NoteIngenieur,
  NoteIngenieurWithRelations,
} from "./models";

// Types authentification et multi-tenancy (DTOs, session, contexte)
export type {
  UserSession,
  AuthContext,
  LoginDTO,
  RegisterDTO,
  CreateSiteDTO,
  UpdateSiteDTO,
  SwitchSiteDTO,
  AddMemberDTO,
  UpdateMemberDTO,
  CreateSiteRoleDTO,
  UpdateSiteRoleDTO,
  AuthResponse,
} from "./auth";

// Types discrimines pour les releves
export type {
  ReleveBase,
  ReleveBiometrie,
  ReleveMortalite,
  ReleveAlimentation,
  ReleveQualiteEau,
  ReleveComptage,
  ReleveObservation,
  ReleveTyped,
} from "./releves";
export {
  isBiometrie,
  isMortalite,
  isAlimentation,
  isQualiteEau,
  isComptage,
  isObservation,
} from "./releves";

// DTOs API
export type {
  CreateBacDTO,
  UpdateBacDTO,
  BacResponse,
  BacListResponse,
  CreateVagueDTO,
  UpdateVagueDTO,
  VagueSummaryResponse,
  VagueListResponse,
  VagueDetailResponse,
  CreateReleveBiometrieDTO,
  CreateReleveMortaliteDTO,
  CreateReleveAlimentationDTO,
  CreateReleveQualiteEauDTO,
  CreateReleveComptageDTO,
  CreateReleveObservationDTO,
  CreateReleveConsommationDTO,
  CreateReleveDTO,
  UpdateReleveDTO,
  ReleveFilters,
  ReleveListResponse,
  CreateFournisseurDTO,
  UpdateFournisseurDTO,
  FournisseurListResponse,
  CreateProduitDTO,
  UpdateProduitDTO,
  ProduitFilters,
  ProduitListResponse,
  CreateMouvementDTO,
  MouvementFilters,
  MouvementListResponse,
  CreateLigneCommandeDTO,
  CreateCommandeDTO,
  UpdateCommandeDTO,
  CommandeFilters,
  CommandeListResponse,
  CommandeDetailResponse,
  CreateClientDTO,
  UpdateClientDTO,
  ClientListResponse,
  CreateVenteDTO,
  VenteListResponse,
  VenteFilters,
  CreateFactureDTO,
  UpdateFactureDTO,
  FactureFilters,
  FactureListResponse,
  FactureDetailResponse,
  CreatePaiementDTO,
  PaiementListResponse,
  CreateReproducteurDTO,
  UpdateReproducteurDTO,
  ReproducteurFilters,
  ReproducteurListResponse,
  CreatePonteDTO,
  UpdatePonteDTO,
  PonteFilters,
  PonteListResponse,
  CreateLotAlevinsDTO,
  UpdateLotAlevinsDTO,
  TransfertLotDTO,
  LotAlevinsFilters,
  LotAlevinsListResponse,
  ApiError,
  ValidationErrorResponse,
  // Sprint 11 — Alertes, Planning, Finances
  CreateConfigAlerteDTO,
  UpdateConfigAlerteDTO,
  UpdateNotificationDTO,
  CompleteActiviteDTO,
  CreateActiviteDTO,
  UpdateActiviteDTO,
  ActiviteFilters,
  FinancesPeriode,
} from "./api";
// Sprint 13 — Liaison Planning ↔ Relevés
export { ACTIVITE_RELEVE_TYPE_MAP } from "./api";
// Sprint 14 — Completion types
export { RELEVE_COMPATIBLE_TYPES } from "./api";
// Sprint 15 — Upload Facture sur Commande
export type { UploadFactureCommandeDTO, FactureCommandeResponse } from "./api";
// Sprint 16 — Depenses
export type {
  CreateDepenseDTO,
  UpdateDepenseDTO,
  DepenseFilters,
  CreatePaiementDepenseDTO,
  DepenseListResponse,
  DepenseDetailResponse,
  PaiementDepenseResponse,
} from "./api";
// Sprint 17 — Besoins
export type {
  CreateLigneBesoinDTO,
  CreateListeBesoinsDTO,
  UpdateListeBesoinsDTO,
  ListeBesoinsFilters,
  TraiterLigneAction,
  TraiterLigneDTO,
  TraiterBesoinsDTO,
  ClotureLigneDTO,
  CloturerBesoinsDTO,
  RejeterBesoinsDTO,
  ListeBesoinsListResponse,
  ListeBesoinsDetailResponse,
} from "./api";
// Sprint 18 — Depenses Recurrentes
export type {
  CreateDepenseRecurrenteDTO,
  UpdateDepenseRecurrenteDTO,
  GenererDepensesRecurrentesResponse,
} from "./api";
// Sprint 19 — ConfigElevage
export type {
  CreateConfigElevageDTO,
  UpdateConfigElevageDTO,
  ConfigElevageFilters,
  ConfigElevageListResponse,
  ConfigElevageDetailResponse,
} from "./api";
// Sprint 20 — Packs & Provisioning
export type {
  CreatePackDTO,
  UpdatePackDTO,
  CreatePackProduitDTO,
  ActivatePackDTO,
  ProvisioningPayload,
  PackActivationResponse,
  PackFilters,
  PackListResponse,
  PackActivationFilters,
  PackActivationListResponse,
} from "./api";
// Sprint 21 — Moteur de regles d'activites
export type {
  CreateRegleActiviteDTO,
  UpdateRegleActiviteDTO,
  RegleActiviteFilters,
} from "./api";
// Sprint 23 — Monitoring Ingénieur
export type {
  CreateNoteIngenieurDTO,
  UpdateNoteIngenieurDTO,
  NoteIngenieurFilters,
  NoteIngenieurListResponse,
} from "./api";
export type {
  StockProduitContext,
  IndicateursContext,
  RuleEvaluationContext,
  RuleMatch,
  GeneratedActivity,
  TemplatePlaceholders,
} from "./activity-engine";

// Types pour les calculs et indicateurs
export type {
  IndicateursVague,
  BilanVague,
  EvolutionPoidsPoint,
  EvolutionMortalitePoint,
  AlimentationPoint,
  DashboardData,
  VagueDashboardSummary,
  IndicateursBac,
  ComparaisonBacs,
  AlerteBac,
  HistoriqueBac,
  HistoriqueBacCycle,
  AnalytiqueAliment,
  ComparaisonAliments,
  DetailAliment,
  DetailAlimentVague,
  SimulationResult,
  // CR-012 — Analytics dashboard + comparaison vagues
  TendanceFCRPoint,
  AnalyticsDashboard,
  IndicateursVagueComplet,
  ComparaisonVagues,
  // Sprint 22 (S16-5) — Projections de performance
  ProjectionVague,
  CourbeCroissancePoint,
  // Sprint 22 (S16-6) — Alertes graduees par benchmark
  IndicateursBenchmarkVague,
} from "./calculs";

// Types export PDF/Excel — Sprint 12
export type {
  SiteInfoExport,
  PeriodeExport,
  ClientFacturePDF,
  PaiementFacturePDF,
  CreateFacturePDFDTO,
  KPIsVaguePDF,
  BacRapportPDF,
  ReleveRapportPDF,
  EvolutionPoidsExport,
  CreateRapportVaguePDFDTO,
  KPIsFinanciersPDF,
  VenteParVaguePDF,
  TopClientPDF,
  EvolutionMensuellePDF,
  CreateRapportFinancierPDFDTO,
  ReleveExcelRow,
  ExportRelevesExcelDTO,
  MouvementExcelRow,
  ExportStockExcelDTO,
  VenteExcelRow,
  ExportVentesExcelDTO,
} from "./export";
