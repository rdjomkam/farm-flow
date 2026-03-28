/**
 * DTOs (Data Transfer Objects) pour les endpoints API.
 *
 * Conventions :
 * - Create*DTO : corps du POST pour creer une ressource
 * - Update*DTO : corps du PUT/PATCH pour modifier une ressource
 * - *Response : reponse renvoyee par l'API
 * - *ListResponse : reponse paginee ou liste
 *
 * Aucun `any` — tout est strictement type.
 */

import {
  ActionRegle,
  CategorieCalibrage,
  CategorieDepense,
  CauseMortalite,
  CategorieProduit,
  FrequenceRecurrence,
  FournisseurPaiement,
  LogiqueCondition,
  MethodeComptage,
  ModePaiement,
  OperateurCondition,
  PeriodeFacturation,
  PlaceholderFormat,
  PlaceholderMode,
  Recurrence,
  Role,
  SeveriteAlerte,
  SiteModule,
  SiteStatus,
  StatutAbonnement,
  StatutActivation,
  StatutActivite,
  StatutAlerte,
  StatutBesoins,
  StatutCommande,
  StatutDepense,
  StatutFacture,
  StatutLotAlevins,
  StatutPonte,
  StatutReproducteur,
  StatutVague,
  SexeReproducteur,
  TypeActivite,
  TypeAlerte,
  TypeAliment,
  TypeDeclencheur,
  TypeMouvement,
  TypePlan,
  TypeReleve,
  TypeRemise,
  UniteStock,
  VisibiliteNote,
} from "./models";
import type {
  AlimentTailleEntree,
  AlimentTauxEntree,
  Bac,
  CalibrageModificationWithUser,
  CalibrageWithModifications,
  Client,
  ReleveModificationWithUser,
  ReleveWithModifications,
  Commande,
  ConfigElevage,
  ConfigElevageWithRelations,
  Depense,
  Facture,
  Fournisseur,
  LigneCommande,
  LigneBesoin,
  LigneBesoinWithRelations,
  ListeBesoins,
  ListeBesoinsWithRelations,
  LotAlevins,
  MouvementStock,
  NoteIngenieur,
  NoteIngenieurWithRelations,
  Pack,
  PackActivation,
  PackActivationWithRelations,
  PackProduit,
  PackProduitWithProduit,
  PackWithRelations,
  Paiement,
  PaiementDepense,
  PhaseElevage,
  Ponte,
  Produit,
  Releve,
  Reproducteur,
  Site,
  User,
  Vague,
  Vente,
} from "./models";
import type { IndicateursVague } from "./calculs";

// ---------------------------------------------------------------------------
// Bacs
// ---------------------------------------------------------------------------

/** DTO pour creer un nouveau bac */
export interface CreateBacDTO {
  /** Nom du bac (ex: "Bac 1") */
  nom: string;
  /** Volume en litres */
  volume: number;
  /** Nombre de poissons initial (optionnel, mis a jour via comptages) */
  nombrePoissons?: number;
}

/** DTO pour modifier un bac (PUT /api/bacs/[id]) — permission BACS_MODIFIER requise */
export interface UpdateBacDTO {
  /** Nouveau nom du bac */
  nom?: string;
  /** Nouveau volume en litres */
  volume?: number;
  /** Nombre de poissons actuel */
  nombrePoissons?: number;
  /** Nombre initial de poissons */
  nombreInitial?: number;
  /** Poids moyen initial en grammes */
  poidsMoyenInitial?: number;
  /** Type de systeme d'elevage — Sprint 27-28 (ADR-density-alerts, section 5.2) */
  typeSysteme?: string;
}

/** Reponse d'un bac avec indication d'occupation */
export interface BacResponse extends Bac {
  /** Code de la vague assignee si occupee, null si libre */
  vagueCode: string | null;
}

/** Reponse liste des bacs */
export interface BacListResponse {
  bacs: BacResponse[];
  /** Nombre total de bacs */
  total: number;
}

// ---------------------------------------------------------------------------
// Vagues
// ---------------------------------------------------------------------------

/** Repartition des alevins pour un bac lors de la creation d'une vague */
export interface BacStockingEntry {
  bacId: string;
  nombrePoissons: number;
}

/** DTO pour creer une nouvelle vague */
export interface CreateVagueDTO {
  /** Code unique de la vague (ex: "VAGUE-2024-001") */
  code: string;
  /** Date de mise en eau (ISO 8601) */
  dateDebut: string;
  /** Nombre d'alevins au demarrage */
  nombreInitial: number;
  /** Poids moyen des alevins en grammes */
  poidsMoyenInitial: number;
  /** Provenance des alevins */
  origineAlevins?: string;
  /** Distribution des alevins par bac */
  bacDistribution: BacStockingEntry[];
}

/** DTO pour modifier/cloturer une vague */
export interface UpdateVagueDTO {
  /** Nouveau statut (ex: TERMINEE pour cloturer) */
  statut?: StatutVague;
  /** Date de fin (obligatoire si statut = TERMINEE) */
  dateFin?: string;
  /** Nombre d'alevins au demarrage (non modifiable si vague TERMINEE) */
  nombreInitial?: number;
  /** Poids moyen des alevins en grammes (non modifiable si vague TERMINEE) */
  poidsMoyenInitial?: number;
  /** Provenance des alevins (non modifiable si vague TERMINEE) */
  origineAlevins?: string | null;
  /** Ajouter des bacs a la vague */
  addBacIds?: string[];
  /** Retirer des bacs de la vague */
  removeBacIds?: string[];
}

/** Resume d'une vague pour la liste */
export interface VagueSummaryResponse {
  id: string;
  code: string;
  dateDebut: Date;
  dateFin: Date | null;
  statut: StatutVague;
  nombreInitial: number;
  poidsMoyenInitial: number;
  origineAlevins: string | null;
  /** Nombre de bacs assignes */
  nombreBacs: number;
  /** Nombre de jours depuis le debut */
  joursEcoules: number;
  createdAt: Date;
}

/** Reponse liste des vagues */
export interface VagueListResponse {
  vagues: VagueSummaryResponse[];
  total: number;
}

/** Reponse detaillee d'une vague (GET /api/vagues/[id]) */
export interface VagueDetailResponse {
  vague: Vague;
  bacs: Bac[];
  releves: Releve[];
  indicateurs: IndicateursVague;
}

// ---------------------------------------------------------------------------
// Releves
// ---------------------------------------------------------------------------

/** DTO pour une consommation de produit lors d'un releve */
export interface CreateReleveConsommationDTO {
  /** ID du produit consomme */
  produitId: string;
  /** Quantite consommee (dans l'unite du produit) */
  quantite: number;
}

/** Champs communs pour la creation d'un releve */
interface CreateReleveBase {
  /** ID de la vague */
  vagueId: string;
  /** ID du bac (doit appartenir a la vague) */
  bacId: string;
  /** Notes libres */
  notes?: string;
  /** Produits consommes lors de ce releve (optionnel, genere des mouvements de stock) */
  consommations?: CreateReleveConsommationDTO[];
  /** ID de l'activite planifiee a lier (optionnel — si absent, auto-match par type/vague/date) */
  activiteId?: string;
  /** Date du releve (ISO 8601, optionnel — defaut : maintenant).
   * Ne peut pas etre dans le futur.
   * Ne peut pas etre anterieure a la dateDebut de la vague.
   */
  date?: string;
}

/** DTO pour creer un releve de biometrie */
export interface CreateReleveBiometrieDTO extends CreateReleveBase {
  typeReleve: TypeReleve.BIOMETRIE;
  /** Poids moyen en grammes */
  poidsMoyen: number;
  /** Taille moyenne en cm (optionnel) */
  tailleMoyenne?: number;
  /** Nombre de poissons echantillonnes */
  echantillonCount: number;
}

/** DTO pour creer un releve de mortalite */
export interface CreateReleveMortaliteDTO extends CreateReleveBase {
  typeReleve: TypeReleve.MORTALITE;
  /** Nombre de poissons morts */
  nombreMorts: number;
  /** Cause presumee */
  causeMortalite: CauseMortalite;
}

/** DTO pour creer un releve d'alimentation */
export interface CreateReleveAlimentationDTO extends CreateReleveBase {
  typeReleve: TypeReleve.ALIMENTATION;
  /** Quantite en kg */
  quantiteAliment: number;
  /** Type d'aliment */
  typeAliment: TypeAliment;
  /** Frequence quotidienne */
  frequenceAliment: number;
}

/** DTO pour creer un releve de qualite d'eau */
export interface CreateReleveQualiteEauDTO extends CreateReleveBase {
  typeReleve: TypeReleve.QUALITE_EAU;
  /** Temperature en °C */
  temperature?: number;
  /** pH */
  ph?: number;
  /** Oxygene dissous en mg/L */
  oxygene?: number;
  /** Ammoniac en mg/L */
  ammoniac?: number;
}

/** DTO pour creer un releve de comptage */
export interface CreateReleveComptageDTO extends CreateReleveBase {
  typeReleve: TypeReleve.COMPTAGE;
  /** Nombre de poissons comptes */
  nombreCompte: number;
  /** Methode de comptage */
  methodeComptage: MethodeComptage;
}

/** DTO pour creer un releve d'observation */
export interface CreateReleveObservationDTO extends CreateReleveBase {
  typeReleve: TypeReleve.OBSERVATION;
  /** Description de l'observation */
  description: string;
}

/** DTO pour creer un releve de renouvellement d'eau (Sprint 27-28, ADR-density-alerts) */
export interface CreateReleveRenouvellementDTO extends CreateReleveBase {
  typeReleve: TypeReleve.RENOUVELLEMENT;
  /** Pourcentage du volume du bac renouvelee (0-100) — au moins un des deux est requis */
  pourcentageRenouvellement?: number;
  /** Volume reel en litres renouvele — alternative ou complement a pourcentageRenouvellement */
  volumeRenouvele?: number;
  /** Nombre de passages de renouvellement (ex: 25% × 4 = 100%) — defaut 1, max 20 */
  nombreRenouvellements?: number;
}

/**
 * Union type pour la creation d'un releve.
 * Le typeReleve determine les champs requis.
 */
export type CreateReleveDTO =
  | CreateReleveBiometrieDTO
  | CreateReleveMortaliteDTO
  | CreateReleveAlimentationDTO
  | CreateReleveQualiteEauDTO
  | CreateReleveComptageDTO
  | CreateReleveObservationDTO
  | CreateReleveRenouvellementDTO;

/** Filtres pour lister les releves (query params) */
export interface ReleveFilters {
  /** Filtrer par vague */
  vagueId?: string;
  /** Filtrer par bac */
  bacId?: string;
  /** Filtrer par type de releve */
  typeReleve?: TypeReleve;
  /** Date de debut (ISO 8601) */
  dateFrom?: string;
  /** Date de fin (ISO 8601) */
  dateTo?: string;
  /** Exclure les releves deja lies a une activite */
  nonLie?: boolean;
  /** Filtrer uniquement les releves modifies (ADR-014) */
  modifie?: boolean;
}

/** Reponse liste des releves */
export interface ReleveListResponse {
  releves: Releve[];
  total: number;
}

/**
 * DTO pour modifier un releve (PUT /api/releves/[id]) — permission RELEVES_MODIFIER requise.
 *
 * Le typeReleve n'est PAS modifiable. Seuls les champs correspondant au type
 * du releve existant sont pris en compte. Les champs structurels
 * (vagueId, bacId, date, siteId) ne sont pas modifiables.
 */
export interface UpdateReleveDTO {
  /** Date du releve (ISO string) — modifiable pour corriger une erreur de saisie */
  date?: Date;
  /** Notes libres (commun a tous les types) */
  notes?: string | null;

  /** Produits consommes lors de ce releve.
   * Si fourni, remplace completement les consommations existantes.
   * Les anciens mouvements de stock SORTIE sont annules, les nouveaux sont crees.
   * Applicable aux types ALIMENTATION, MORTALITE, QUALITE_EAU.
   */
  consommations?: CreateReleveConsommationDTO[];

  // --- Champs biometrie (typeReleve = BIOMETRIE) ---
  /** Poids moyen en grammes */
  poidsMoyen?: number;
  /** Taille moyenne en cm */
  tailleMoyenne?: number;
  /** Nombre de poissons echantillonnes */
  echantillonCount?: number;

  // --- Champs mortalite (typeReleve = MORTALITE) ---
  /** Nombre de poissons morts */
  nombreMorts?: number;
  /** Cause presumee */
  causeMortalite?: CauseMortalite;

  // --- Champs alimentation (typeReleve = ALIMENTATION) ---
  /** Quantite en kg */
  quantiteAliment?: number;
  /** Type d'aliment */
  typeAliment?: TypeAliment;
  /** Frequence quotidienne */
  frequenceAliment?: number;

  // --- Champs qualite eau (typeReleve = QUALITE_EAU) ---
  /** Temperature en degres Celsius */
  temperature?: number;
  /** pH */
  ph?: number;
  /** Oxygene dissous en mg/L */
  oxygene?: number;
  /** Ammoniac en mg/L */
  ammoniac?: number;

  // --- Champs comptage (typeReleve = COMPTAGE) ---
  /** Nombre de poissons comptes */
  nombreCompte?: number;
  /** Methode de comptage */
  methodeComptage?: MethodeComptage;

  // --- Champs observation (typeReleve = OBSERVATION) ---
  /** Description de l'observation */
  description?: string;

  // --- Champs renouvellement (typeReleve = RENOUVELLEMENT) ---
  /** Pourcentage du volume du bac renouvele (0-100) */
  pourcentageRenouvellement?: number;
  /** Volume d'eau renouvele en litres */
  volumeRenouvele?: number;
  /** Nombre de passages de renouvellement (1-20) */
  nombreRenouvellements?: number;
}

// ---------------------------------------------------------------------------
// Sprint 26 — Modification de releve avec raison obligatoire (ADR-014)
// ---------------------------------------------------------------------------

/**
 * Corps du PATCH /api/releves/[id]
 *
 * La raison est obligatoire (min 5 chars, max 500).
 * Au moins un champ metier doit etre fourni (hors raison).
 * Les champs structurels (id, vagueId, bacId, siteId, typeReleve, date, userId) ne sont pas modifiables.
 */
export interface PatchReleveBody {
  /** Raison de la modification — obligatoire, min 5 chars, max 500 */
  raison: string;
  /** Date du releve (ISO date string) — modifiable pour corriger une erreur */
  date?: string;

  // --- Champs biometrie ---
  poidsMoyen?: number;
  tailleMoyenne?: number;
  echantillonCount?: number;
  // --- Champs mortalite ---
  nombreMorts?: number;
  causeMortalite?: CauseMortalite;
  // --- Champs alimentation ---
  quantiteAliment?: number;
  typeAliment?: TypeAliment;
  frequenceAliment?: number;
  // --- Champs qualite eau ---
  temperature?: number;
  ph?: number;
  oxygene?: number;
  ammoniac?: number;
  // --- Champs comptage ---
  nombreCompte?: number;
  methodeComptage?: MethodeComptage;
  // --- Champs observation ---
  description?: string;
  // --- Commun ---
  notes?: string | null;
  /** Consommations : remplacement complet si fourni */
  consommations?: { produitId: string; quantite: number }[];
}

/**
 * DTO interne pour creer une trace de modification de releve.
 * Utilise dans la couche query, jamais expose directement par l'API.
 */
export interface CreateReleveModificationDTO {
  releveId:       string;
  userId:         string;
  raison:         string;
  champModifie:   string;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  siteId:         string;
}

/**
 * Reponse du PATCH /api/releves/[id]
 */
export interface PatchReleveResponse {
  releve:        ReleveWithModifications;
  modifications: ReleveModificationWithUser[];
}

// ---------------------------------------------------------------------------
// Fournisseurs
// ---------------------------------------------------------------------------

/** DTO pour creer un fournisseur */
export interface CreateFournisseurDTO {
  nom: string;
  telephone?: string;
  email?: string;
  adresse?: string;
}

/** DTO pour modifier un fournisseur */
export interface UpdateFournisseurDTO {
  nom?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  isActive?: boolean;
}

/** Reponse liste des fournisseurs */
export interface FournisseurListResponse {
  fournisseurs: Fournisseur[];
  total: number;
}

// ---------------------------------------------------------------------------
// Produits
// ---------------------------------------------------------------------------

/** DTO pour creer un produit */
export interface CreateProduitDTO {
  nom: string;
  categorie: CategorieProduit;
  unite: UniteStock;
  /** Unite d'achat si differente de l'unite de base (ex: SACS pour un produit en KG) */
  uniteAchat?: UniteStock;
  /** Contenance d'une unite d'achat dans l'unite de base (ex: 25 kg/sac) */
  contenance?: number;
  prixUnitaire: number;
  seuilAlerte?: number;
  fournisseurId?: string;
}

/** DTO pour modifier un produit */
export interface UpdateProduitDTO {
  nom?: string;
  categorie?: CategorieProduit;
  unite?: UniteStock;
  /** Unite d'achat (null pour effacer) */
  uniteAchat?: UniteStock | null;
  /** Contenance (null pour effacer) */
  contenance?: number | null;
  prixUnitaire?: number;
  seuilAlerte?: number;
  fournisseurId?: string | null;
  isActive?: boolean;
}

/** Filtres pour lister les produits */
export interface ProduitFilters {
  categorie?: CategorieProduit;
  fournisseurId?: string;
  /** Filtrer les produits en dessous du seuil d'alerte */
  alerteOnly?: boolean;
}

/** Reponse liste des produits */
export interface ProduitListResponse {
  produits: Produit[];
  total: number;
}

// ---------------------------------------------------------------------------
// Mouvements de stock
// ---------------------------------------------------------------------------

/** DTO pour creer un mouvement de stock */
export interface CreateMouvementDTO {
  produitId: string;
  type: TypeMouvement;
  quantite: number;
  prixTotal?: number;
  vagueId?: string;
  commandeId?: string;
  date: string;
  notes?: string;
}

/** Filtres pour lister les mouvements */
export interface MouvementFilters {
  produitId?: string;
  type?: TypeMouvement;
  vagueId?: string;
  commandeId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Reponse liste des mouvements */
export interface MouvementListResponse {
  mouvements: MouvementStock[];
  total: number;
}

// ---------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------

/** Ligne de commande pour la creation */
export interface CreateLigneCommandeDTO {
  produitId: string;
  quantite: number;
  prixUnitaire: number;
}

/** DTO pour creer une commande */
export interface CreateCommandeDTO {
  fournisseurId: string;
  dateCommande: string;
  lignes: CreateLigneCommandeDTO[];
  notes?: string;
}

/** DTO pour modifier une commande */
export interface UpdateCommandeDTO {
  statut?: StatutCommande;
  dateLivraison?: string;
  /** Ajouter des lignes */
  addLignes?: CreateLigneCommandeDTO[];
  /** Supprimer des lignes par ID */
  removeLigneIds?: string[];
}

/** Filtres pour lister les commandes */
export interface CommandeFilters {
  fournisseurId?: string;
  statut?: StatutCommande;
  dateFrom?: string;
  dateTo?: string;
}

/** Reponse liste des commandes */
export interface CommandeListResponse {
  commandes: Commande[];
  total: number;
}

/** Reponse detaillee d'une commande */
export interface CommandeDetailResponse {
  commande: Commande;
  fournisseur: Fournisseur;
  lignes: (LigneCommande & { produit: Produit })[];
  mouvements: MouvementStock[];
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

/** DTO pour creer un client */
export interface CreateClientDTO {
  nom: string;
  telephone?: string;
  email?: string;
  adresse?: string;
}

/** DTO pour modifier un client */
export interface UpdateClientDTO {
  nom?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  isActive?: boolean;
}

/** Reponse liste des clients */
export interface ClientListResponse {
  clients: Client[];
  total: number;
}

// ---------------------------------------------------------------------------
// Ventes
// ---------------------------------------------------------------------------

/** DTO pour creer une vente */
export interface CreateVenteDTO {
  clientId: string;
  vagueId: string;
  quantitePoissons: number;
  poidsTotalKg: number;
  prixUnitaireKg: number;
  notes?: string;
}

/** Reponse liste des ventes */
export interface VenteListResponse {
  ventes: Vente[];
  total: number;
}

/** Filtres pour lister les ventes */
export interface VenteFilters {
  clientId?: string;
  vagueId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ---------------------------------------------------------------------------
// Factures
// ---------------------------------------------------------------------------

/** DTO pour creer une facture a partir d'une vente */
export interface CreateFactureDTO {
  venteId: string;
  dateEcheance?: string;
  notes?: string;
}

/** DTO pour modifier une facture */
export interface UpdateFactureDTO {
  statut?: StatutFacture;
  dateEcheance?: string;
  notes?: string;
}

/** Filtres pour lister les factures */
export interface FactureFilters {
  statut?: StatutFacture;
  dateFrom?: string;
  dateTo?: string;
}

/** Reponse liste des factures */
export interface FactureListResponse {
  factures: Facture[];
  total: number;
}

/** Reponse detaillee d'une facture */
export interface FactureDetailResponse {
  facture: Facture;
  vente: Vente & { client: Client };
  paiements: Paiement[];
}

// ---------------------------------------------------------------------------
// Paiements
// ---------------------------------------------------------------------------

/** DTO pour creer un paiement sur une facture */
export interface CreatePaiementDTO {
  montant: number;
  mode: ModePaiement;
  reference?: string;
}

/** Reponse liste des paiements d'une facture */
export interface PaiementListResponse {
  paiements: Paiement[];
  total: number;
}

// ---------------------------------------------------------------------------
// Reproducteurs
// ---------------------------------------------------------------------------

/** DTO pour creer un reproducteur */
export interface CreateReproducteurDTO {
  /** Code unique du reproducteur sur le site (ex: "REP-F-001") */
  code: string;
  sexe: SexeReproducteur;
  /** Poids en grammes */
  poids: number;
  /** Age en mois */
  age?: number;
  /** Provenance (ecloserie, peche, etc.) */
  origine?: string;
  /** Statut initial (defaut : ACTIF) */
  statut?: StatutReproducteur;
  /** Date d'acquisition (ISO date string, defaut : aujourd'hui) */
  dateAcquisition?: string;
  notes?: string;
}

/** DTO pour modifier un reproducteur (PUT /api/alevins/reproducteurs/[id]) */
export interface UpdateReproducteurDTO {
  code?: string;
  sexe?: SexeReproducteur;
  /** Poids en grammes */
  poids?: number;
  /** Age en mois (null pour effacer) */
  age?: number | null;
  /** Provenance (null pour effacer) */
  origine?: string | null;
  statut?: StatutReproducteur;
  /** Notes libres (null pour effacer) */
  notes?: string | null;
}

/** Filtres pour lister les reproducteurs */
export interface ReproducteurFilters {
  sexe?: SexeReproducteur;
  statut?: StatutReproducteur;
  /** Recherche libre sur code ou origine */
  search?: string;
}

/** Reponse liste des reproducteurs */
export interface ReproducteurListResponse {
  reproducteurs: Reproducteur[];
  total: number;
}

// ---------------------------------------------------------------------------
// Pontes
// ---------------------------------------------------------------------------

/** DTO pour creer une ponte */
export interface CreatePonteDTO {
  /** Code unique de la ponte (ex: "PONTE-2026-001") */
  code: string;
  /** ID de la femelle reproductrice */
  femelleId: string;
  /** ID du male (optionnel) */
  maleId?: string;
  /** Date de la ponte (ISO date string) */
  datePonte: string;
  /** Nombre d'oeufs pondus */
  nombreOeufs?: number;
  /** Taux de fecondation en pourcentage (0-100) */
  tauxFecondation?: number;
  /** Statut initial (defaut : EN_COURS) */
  statut?: StatutPonte;
  notes?: string;
}

/** DTO pour modifier une ponte (PUT /api/pontes/[id]) */
export interface UpdatePonteDTO {
  /** Code unique de la ponte (si modification) */
  code?: string;
  /** ID du male (null pour retirer le male) */
  maleId?: string | null;
  /** Date de la ponte (ISO date string) */
  datePonte?: string;
  /** Nombre d'oeufs pondus (null pour effacer) */
  nombreOeufs?: number | null;
  /** Taux de fecondation en pourcentage (null pour effacer) */
  tauxFecondation?: number | null;
  statut?: StatutPonte;
  /** Notes libres (null pour effacer) */
  notes?: string | null;
}

/** Filtres pour lister les pontes */
export interface PonteFilters {
  femelleId?: string;
  maleId?: string;
  statut?: StatutPonte;
  dateFrom?: string;
  dateTo?: string;
  /** Recherche libre sur code ou notes */
  search?: string;
}

/** Reponse liste des pontes */
export interface PonteListResponse {
  pontes: Ponte[];
  total: number;
}

// ---------------------------------------------------------------------------
// Lots d'alevins
// ---------------------------------------------------------------------------

/** DTO pour creer un lot d'alevins */
export interface CreateLotAlevinsDTO {
  /** Code unique du lot (ex: "LOT-2026-001") */
  code: string;
  /** ID de la ponte d'origine */
  ponteId: string;
  /** Nombre d'alevins au debut du lot */
  nombreInitial: number;
  /** Nombre actuel (defaut = nombreInitial si absent) */
  nombreActuel?: number;
  /** Age en jours (defaut : 0) */
  ageJours?: number;
  /** Poids moyen en grammes */
  poidsMoyen?: number;
  /** Statut initial (defaut : EN_INCUBATION) */
  statut?: StatutLotAlevins;
  /** ID du bac d'elevage */
  bacId?: string;
  notes?: string;
}

/** DTO pour mettre a jour un lot d'alevins (PUT /api/lots-alevins/[id]) */
export interface UpdateLotAlevinsDTO {
  /** Code unique du lot (si modification) */
  code?: string;
  /** Nombre d'alevins actuellement vivants */
  nombreActuel?: number;
  /** Age en jours */
  ageJours?: number;
  /** Poids moyen en grammes (null pour effacer) */
  poidsMoyen?: number | null;
  statut?: StatutLotAlevins;
  /** ID du bac d'elevage (null pour retirer du bac) */
  bacId?: string | null;
  /** Notes libres (null pour effacer) */
  notes?: string | null;
}

/**
 * DTO pour le transfert d'un lot d'alevins vers une vague de grossissement.
 *
 * Cette operation cree une nouvelle Vague et y assigne les bacs specifies,
 * puis passe le statut du lot a TRANSFERE et renseigne vagueDestinationId.
 */
export interface TransfertLotDTO {
  /** Nom de la nouvelle vague de grossissement */
  nom: string;
  /** IDs des bacs a assigner a la nouvelle vague */
  bacIds: string[];
  /** ID de l'utilisateur effectuant le transfert (optionnel, utilise l'auth si absent) */
  userId?: string;
}

/** Filtres pour lister les lots d'alevins */
export interface LotAlevinsFilters {
  ponteId?: string;
  statut?: StatutLotAlevins;
  bacId?: string;
  /** Recherche libre sur code ou notes */
  search?: string;
}

/** Reponse liste des lots d'alevins */
export interface LotAlevinsListResponse {
  lots: LotAlevins[];
  total: number;
}

// ---------------------------------------------------------------------------
// Alertes — Configuration
// ---------------------------------------------------------------------------

/** DTO pour creer ou remplacer une regle d'alerte */
export interface CreateConfigAlerteDTO {
  typeAlerte: TypeAlerte;
  /** Valeur absolue de declenchement (mutuellement exclusif avec seuilPourcentage) */
  seuilValeur?: number;
  /** Pourcentage de declenchement (mutuellement exclusif avec seuilValeur) */
  seuilPourcentage?: number;
  /** Alerte active des la creation (defaut : true) */
  enabled?: boolean;
}

/** DTO pour modifier une regle d'alerte existante */
export interface UpdateConfigAlerteDTO {
  /** Nouvelle valeur absolue (null pour effacer) */
  seuilValeur?: number | null;
  /** Nouveau pourcentage (null pour effacer) */
  seuilPourcentage?: number | null;
  /** Activer ou suspendre l'alerte */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Alertes — Notifications
// ---------------------------------------------------------------------------

/** DTO pour changer le statut d'une notification (marquer lue ou traitee) */
export interface UpdateNotificationDTO {
  statut: StatutAlerte;
}

// ---------------------------------------------------------------------------
// Planning — Activites
// ---------------------------------------------------------------------------

/** DTO pour creer une activite dans le calendrier */
export interface CreateActiviteDTO {
  titre: string;
  description?: string;
  typeActivite: TypeActivite;
  /** Date et heure de debut (ISO 8601) */
  dateDebut: string;
  /** Date et heure de fin (ISO 8601, optionnel) */
  dateFin?: string;
  /** Periodicite de recurrence (null ou absent = activite ponctuelle) */
  recurrence?: Recurrence;
  /** Vague associee (optionnel) */
  vagueId?: string;
  /** Bac associe (optionnel) */
  bacId?: string;
  /** Membre a qui assigner l'activite (optionnel) */
  assigneAId?: string;
}

/** DTO pour modifier une activite existante */
export interface UpdateActiviteDTO {
  titre?: string;
  /** Description (null pour effacer) */
  description?: string | null;
  typeActivite?: TypeActivite;
  statut?: StatutActivite;
  /** Date et heure de debut (ISO 8601) */
  dateDebut?: string;
  /** Date et heure de fin (ISO 8601, null pour effacer) */
  dateFin?: string | null;
  /** Periodicite de recurrence (null pour rendre l'activite ponctuelle) */
  recurrence?: Recurrence | null;
  /** Vague associee (null pour dissocier) */
  vagueId?: string | null;
  /** Bac associe (null pour dissocier) */
  bacId?: string | null;
  /** Membre assigne (null pour desassigner) */
  assigneAId?: string | null;
}

/** DTO pour completer une activite (POST /api/activites/[id]/complete) */
export interface CompleteActiviteDTO {
  /** ID du releve a lier (requis pour ALIMENTATION, BIOMETRIE, QUALITE_EAU, COMPTAGE) */
  releveId?: string;
  /** Note de completion (requis pour NETTOYAGE, TRAITEMENT, RECOLTE, AUTRE) */
  noteCompletion?: string;
}

/** Types d'activite qui necessitent un releve pour etre completes */
export const RELEVE_COMPATIBLE_TYPES: TypeActivite[] = [
  TypeActivite.ALIMENTATION,
  TypeActivite.BIOMETRIE,
  TypeActivite.QUALITE_EAU,
  TypeActivite.COMPTAGE,
  TypeActivite.RENOUVELLEMENT, // Sprint 27-28 — Renouvellement eau
];

/** Filtres pour lister les activites du calendrier */
export interface ActiviteFilters {
  /** Date de debut de la plage (ISO 8601) */
  dateDebut?: string;
  /** Date de fin de la plage (ISO 8601) */
  dateFin?: string;
  statut?: StatutActivite;
  typeActivite?: TypeActivite;
  /** Filtrer par vague associee */
  vagueId?: string;
  /** Filtrer par membre assigne */
  assigneAId?: string;
}

// ---------------------------------------------------------------------------
// Finances — Filtres de periode
// ---------------------------------------------------------------------------

/**
 * Filtres de periode pour les endpoints du dashboard financier.
 *
 * Les types de reponse financiers detailles sont dans src/lib/queries/finances.ts
 * car ils dependent des resultats d'agregation Prisma.
 */
export interface FinancesPeriode {
  /** Date de debut de la periode (ISO 8601, optionnel) */
  dateFrom?: string;
  /** Date de fin de la periode (ISO 8601, optionnel) */
  dateTo?: string;
}

// ---------------------------------------------------------------------------
// Erreurs API
// ---------------------------------------------------------------------------

/** Format standard des erreurs API */
export interface ApiError {
  /** Code HTTP */
  status: number;
  /** Message d'erreur en francais */
  message: string;
  /** Champ concerne (pour les erreurs de validation) */
  field?: string;
}

/** Reponse d'erreur de validation (400) */
export interface ValidationErrorResponse {
  status: 400;
  message: string;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

// ---------------------------------------------------------------------------
// Planning — Mapping TypeActivite → TypeReleve
// ---------------------------------------------------------------------------

/**
 * Mapping des types d'activite vers les types de releve compatibles.
 *
 * Seuls les types ALIMENTATION, BIOMETRIE, QUALITE_EAU et COMPTAGE
 * peuvent etre completes par un releve du meme type.
 * Les types NETTOYAGE, TRAITEMENT, RECOLTE et AUTRE n'ont pas de releve associe.
 */
export const ACTIVITE_RELEVE_TYPE_MAP: Partial<Record<TypeActivite, TypeReleve>> = {
  [TypeActivite.ALIMENTATION]: TypeReleve.ALIMENTATION,
  [TypeActivite.BIOMETRIE]: TypeReleve.BIOMETRIE,
  [TypeActivite.QUALITE_EAU]: TypeReleve.QUALITE_EAU,
  [TypeActivite.COMPTAGE]: TypeReleve.COMPTAGE,
  // Sprint 27-28 — Renouvellement eau
  [TypeActivite.RENOUVELLEMENT]: TypeReleve.RENOUVELLEMENT,
};

// ---------------------------------------------------------------------------
// Sprint 15 — Upload Facture sur Commande
// ---------------------------------------------------------------------------

/**
 * DTO pour uploader une facture fournisseur sur une commande existante.
 * La facture est transmise via FormData (champ "file").
 */
export interface UploadFactureCommandeDTO {
  /** ID de la commande a laquelle rattacher la facture */
  commandeId: string;
  /** Fichier facture (PDF, JPG, PNG — max 10 Mo) */
  file: File;
}

/**
 * Reponse apres upload ou recuperation de facture.
 * Retourne une URL presignee (expire apres 1h).
 */
export interface FactureCommandeResponse {
  /** URL presignee pour acceder au fichier (expire apres 1h) */
  url: string;
  /** Nom original du fichier */
  fileName: string;
}

// ---------------------------------------------------------------------------
// Sprint 16 — Depenses
// ---------------------------------------------------------------------------

/** DTO pour creer une depense */
export interface CreateDepenseDTO {
  /** Description de la depense */
  description: string;
  /** Categorie operationnelle */
  categorieDepense: CategorieDepense;
  /** Montant total en FCFA */
  montantTotal: number;
  /** Date de la depense (ISO 8601) */
  date: string;
  /** Date d'echeance de paiement (ISO 8601, optionnel) */
  dateEcheance?: string;
  /** Vague associee (optionnel) */
  vagueId?: string;
  /** Commande d'origine (optionnel, generalement rempli automatiquement) */
  commandeId?: string;
  /** Notes libres (optionnel) */
  notes?: string;
}

/** DTO pour modifier une depense (champs tous optionnels) */
export interface UpdateDepenseDTO {
  description?: string;
  categorieDepense?: CategorieDepense;
  montantTotal?: number;
  date?: string;
  dateEcheance?: string | null;
  vagueId?: string | null;
  notes?: string | null;
}

/** Filtres pour lister les depenses */
export interface DepenseFilters {
  categorieDepense?: CategorieDepense;
  statut?: StatutDepense;
  dateFrom?: string;
  dateTo?: string;
  vagueId?: string;
  commandeId?: string;
}

/** DTO pour creer un paiement sur une depense */
export interface CreatePaiementDepenseDTO {
  /** Montant du paiement en FCFA */
  montant: number;
  /** Mode de paiement */
  mode: ModePaiement;
  /** Reference de transaction (optionnel) */
  reference?: string;
}

/** Reponse liste des depenses */
export interface DepenseListResponse {
  depenses: Depense[];
  total: number;
}

/** Reponse detaillee d'une depense avec ses paiements */
export interface DepenseDetailResponse {
  depense: Depense;
  paiements: PaiementDepense[];
}

/** Reponse creation d'un paiement depense */
export interface PaiementDepenseResponse {
  paiement: PaiementDepense;
  /** Nouveau statut de la depense apres paiement */
  statut: StatutDepense;
  /** Nouveau montantPaye apres paiement */
  montantPaye: number;
}

// ---------------------------------------------------------------------------
// Sprint 17 — Besoins
// ---------------------------------------------------------------------------

/** DTO pour creer une ligne de besoin */
export interface CreateLigneBesoinDTO {
  /** Designation libre de l'article */
  designation: string;
  /** Produit en stock lie (optionnel) */
  produitId?: string;
  /** Quantite demandee */
  quantite: number;
  /** Unite libre (optionnel si produit avec unite definie) */
  unite?: string;
  /** Prix unitaire estime en FCFA */
  prixEstime: number;
}

/** DTO pour creer une liste de besoins */
export interface CreateListeBesoinsDTO {
  /** Intitule de la demande */
  titre: string;
  /** Vague associee (optionnel) */
  vagueId?: string;
  /** Lignes de besoin */
  lignes: CreateLigneBesoinDTO[];
  /** Notes libres (optionnel) */
  notes?: string;
  /** Date limite de traitement (ISO 8601, optionnelle, doit etre dans le futur) */
  dateLimite?: string;
}

/** DTO pour modifier une liste de besoins (seulement si SOUMISE) */
export interface UpdateListeBesoinsDTO {
  titre?: string;
  vagueId?: string | null;
  notes?: string | null;
  lignes?: CreateLigneBesoinDTO[];
  /** Modifier la date limite (null = supprimer) */
  dateLimite?: string | null;
}

/** Filtres pour lister les listes de besoins */
export interface ListeBesoinsFilters {
  statut?: StatutBesoins;
  demandeurId?: string;
  vagueId?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Filtrer les besoins dont la dateLimite est depassee et statut non terminal */
  enRetard?: boolean;
}

/** Choix de traitement pour une ligne (COMMANDE = via commande fournisseur, LIBRE = achat direct) */
export type TraiterLigneAction = "COMMANDE" | "LIBRE";

/** Action de traitement pour une ligne de besoin */
export interface TraiterLigneDTO {
  /** ID de la ligne de besoin */
  ligneBesoinId: string;
  /** Action choisie pour cette ligne */
  action: TraiterLigneAction;
}

/** DTO pour traiter une liste de besoins (APPROUVEE → TRAITEE) */
export interface TraiterBesoinsDTO {
  /** Actions choisies par ligne */
  ligneActions: TraiterLigneDTO[];
  /** Fournisseur a utiliser pour les lignes COMMANDE (si pas de produitId, utiliser ce fournisseur) */
  fournisseurId?: string;
}

/** Ligne avec son prix reel lors de la cloture */
export interface ClotureLigneDTO {
  /** ID de la ligne de besoin */
  ligneBesoinId: string;
  /** Prix reel par unite en FCFA */
  prixReel: number;
}

/** DTO pour cloturer une liste de besoins (TRAITEE → CLOTUREE) */
export interface CloturerBesoinsDTO {
  /** Prix reels par ligne */
  lignesReelles: ClotureLigneDTO[];
}

/** DTO pour rejeter une liste de besoins (SOUMISE → REJETEE) */
export interface RejeterBesoinsDTO {
  /** Motif de rejet (optionnel) */
  motif?: string;
}

/** Reponse liste des listes de besoins */
export interface ListeBesoinsListResponse {
  listesBesoins: ListeBesoinsWithRelations[];
  total: number;
}

/** Reponse detaillee d'une liste de besoins */
export interface ListeBesoinsDetailResponse {
  listeBesoins: ListeBesoinsWithRelations;
}

// Re-export types used in Besoins context
export type { LigneBesoin, LigneBesoinWithRelations, ListeBesoins, ListeBesoinsWithRelations };

// Sprint 18 — Depenses Recurrentes

/** DTO pour creer un template de depense recurrente */
export interface CreateDepenseRecurrenteDTO {
  description: string;
  categorieDepense: CategorieDepense;
  montantEstime: number;
  frequence: FrequenceRecurrence;
  /** Jour du mois (1-28, defaut 1) */
  jourDuMois?: number;
  isActive?: boolean;
}

/** DTO pour modifier un template de depense recurrente */
export interface UpdateDepenseRecurrenteDTO {
  description?: string;
  categorieDepense?: CategorieDepense;
  montantEstime?: number;
  frequence?: FrequenceRecurrence;
  jourDuMois?: number;
  isActive?: boolean;
}

/** Reponse apres generation des depenses recurrentes */
export interface GenererDepensesRecurrentesResponse {
  generated: number;
  depenses: { id: string; numero: string; description: string; montantTotal: number }[];
}

// Sprint 19 — ConfigElevage

/** DTO pour creer un profil de configuration d'elevage */
export interface CreateConfigElevageDTO {
  nom: string;
  description?: string;
  poidsObjectif: number;
  dureeEstimeeCycle: number;
  tauxSurvieObjectif: number;
  seuilAcclimatation?: number;
  seuilCroissanceDebut?: number;
  seuilJuvenile?: number;
  seuilGrossissement?: number;
  seuilFinition?: number;
  alimentTailleConfig: AlimentTailleEntree[];
  alimentTauxConfig: AlimentTauxEntree[];
  fcrExcellentMax?: number;
  fcrBonMax?: number;
  fcrAcceptableMax?: number;
  sgrExcellentMin?: number;
  sgrBonMin?: number;
  sgrAcceptableMin?: number;
  survieExcellentMin?: number;
  survieBonMin?: number;
  survieAcceptableMin?: number;
  densiteExcellentMax?: number;
  densiteBonMax?: number;
  densiteAcceptableMax?: number;
  mortaliteExcellentMax?: number;
  mortaliteBonMax?: number;
  mortaliteAcceptableMax?: number;
  phMin?: number;
  phMax?: number;
  phOptimalMin?: number;
  phOptimalMax?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  temperatureOptimalMin?: number;
  temperatureOptimalMax?: number;
  oxygeneMin?: number;
  oxygeneAlerte?: number;
  oxygeneOptimal?: number;
  ammoniacMax?: number;
  ammoniacAlerte?: number;
  ammoniacOptimal?: number;
  nitriteMax?: number;
  nitriteAlerte?: number;
  mortaliteQuotidienneAlerte?: number;
  mortaliteQuotidienneCritique?: number;
  fcrAlerteMax?: number;
  stockJoursAlerte?: number;
  triPoidsMin?: number;
  triPoidsMax?: number;
  triIntervalleJours?: number;
  biometrieIntervalleDebut?: number;
  biometrieIntervalleFin?: number;
  biometrieEchantillonPct?: number;
  eauChangementPct?: number;
  eauChangementIntervalleJours?: number;
  densiteMaxPoissonsM3?: number;
  densiteOptimalePoissonsM3?: number;
  recoltePartiellePoidsSeuil?: number;
  recolteJeuneAvantJours?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

/** DTO pour modifier partiellement un profil de configuration d'elevage */
export type UpdateConfigElevageDTO = Partial<CreateConfigElevageDTO>;

/** Filtres pour lister les profils ConfigElevage */
export interface ConfigElevageFilters {
  isDefault?: boolean;
  isActive?: boolean;
}

/** Reponse liste des profils ConfigElevage */
export interface ConfigElevageListResponse {
  configs: ConfigElevageWithRelations[];
  total: number;
}

/** Reponse detaillee d'un profil ConfigElevage */
export interface ConfigElevageDetailResponse {
  config: ConfigElevageWithRelations;
}

// ConfigElevage types are imported at the top of this file and used inline above.

// ---------------------------------------------------------------------------
// Sprint 21/25 — Moteur de regles d'activites (RegleActivite)
// ---------------------------------------------------------------------------

/**
 * DTO pour creer une regle d'activite.
 *
 * Validations cote API (voir ADR-013) :
 * - conditionValeur requis si typeDeclencheur est SEUIL_POIDS, SEUIL_QUALITE,
 *   SEUIL_MORTALITE ou FCR_ELEVE
 * - intervalleJours requis et > 0 si typeDeclencheur === RECURRENT
 * - phaseMin doit preceder phaseMax dans PHASE_ELEVAGE_ORDER si les deux sont renseignes
 * - conditionValeur2 > conditionValeur si les deux sont renseignes (SEUIL_QUALITE)
 * - siteId est fourni par la session cote serveur — jamais null via API (pas de creation
 *   de regle globale par cette route)
 */
export interface CreateRegleActiviteDTO {
  /** Libelle interne de la regle (3–100 chars) */
  nom: string;
  /** Description metier optionnelle (max 500 chars) */
  description?: string;
  /** Type d'activite a generer */
  typeActivite: TypeActivite;
  /** Condition de declenchement */
  typeDeclencheur: TypeDeclencheur;
  /**
   * Valeur primaire du seuil.
   * Semantique selon typeDeclencheur :
   *   SEUIL_POIDS     → poids moyen en grammes
   *   SEUIL_MORTALITE → taux de mortalite en %
   *   SEUIL_QUALITE   → valeur basse (ex: pH min)
   *   FCR_ELEVE       → seuil FCR
   */
  conditionValeur?: number;
  /**
   * Valeur secondaire du seuil — SEUIL_QUALITE uniquement (ex: pH max).
   * Doit etre superieure a conditionValeur si renseignee.
   */
  conditionValeur2?: number;
  /** Phase d'elevage minimale d'application (null = toutes phases depuis le debut) */
  phaseMin?: PhaseElevage;
  /** Phase d'elevage maximale d'application (null = borne haute non contrainte) */
  phaseMax?: PhaseElevage;
  /** Intervalle en jours entre declenchements — requis si RECURRENT, doit etre > 0 */
  intervalleJours?: number;
  /**
   * Titre de l'activite generee avec placeholders {nom_placeholder}.
   * Ex: "Distribuer {quantite_calculee}kg de granule {taille}"
   * Voir KNOWN_PLACEHOLDERS dans regles-activites-constants.ts.
   * Longueur : 5–200 chars.
   */
  titreTemplate: string;
  /** Template de description courte (max 500 chars, placeholders autorises) */
  descriptionTemplate?: string;
  /** Template des instructions detaillees (max 5000 chars, Markdown, placeholders autorises) */
  instructionsTemplate?: string;
  /** Priorite des activites generees : 1 (haute) a 10 (basse) — defaut 5 */
  priorite?: number;
  /** Etat initial de la regle (defaut : true) */
  isActive?: boolean;
  /**
   * Logique de combinaison des conditions composees.
   * ET (defaut) : toutes les conditions doivent matcher.
   * OU : au moins une condition doit matcher.
   * Ignoree si conditions est vide.
   */
  logique?: LogiqueCondition;
  /**
   * Conditions composees. Si present et non vide, le moteur utilise ces
   * conditions a la place du legacy typeDeclencheur + conditionValeur.
   * Chaque element represente une condition atomique.
   */
  conditions?: {
    typeDeclencheur: TypeDeclencheur;
    operateur: OperateurCondition;
    conditionValeur: number | null;
    conditionValeur2: number | null;
    ordre: number;
  }[];
  /**
   * Type d'action execute au declenchement (Sprint 29).
   * ACTIVITE (defaut) : cree une Activite planifiee.
   * NOTIFICATION : cree une Notification (alerte).
   * LES_DEUX : cree a la fois une Activite ET une Notification.
   */
  actionType?: ActionRegle;
  /**
   * Severite de la notification generee.
   * Requis si actionType est NOTIFICATION ou LES_DEUX.
   */
  severite?: SeveriteAlerte;
  /**
   * Template du titre de la notification (avec placeholders {key}).
   * Requis si actionType est NOTIFICATION ou LES_DEUX. Max 200 chars.
   */
  titreNotificationTemplate?: string;
  /**
   * Template de la description de la notification (optionnel). Max 500 chars.
   */
  descriptionNotificationTemplate?: string;
  /**
   * Type du CTA dans la notification.
   * null / omis = pas de bouton d'action.
   * Valeurs valides : "CREER_RELEVE" | "MODIFIER_BAC" | "VOIR_VAGUE" | "VOIR_STOCK"
   */
  actionPayloadType?: string | null;
}

/**
 * DTO pour modifier une regle d'activite existante.
 *
 * Tous les champs sont optionnels. siteId n'est pas modifiable apres creation.
 */
export type UpdateRegleActiviteDTO = Partial<
  Omit<CreateRegleActiviteDTO, "typeActivite" | "typeDeclencheur">
> & {
  /** typeActivite peut etre modifie uniquement sur les regles site-specifiques */
  typeActivite?: TypeActivite;
  /** typeDeclencheur peut etre modifie uniquement sur les regles site-specifiques */
  typeDeclencheur?: TypeDeclencheur;
};

/** Filtres pour lister les regles d'activite */
export interface RegleActiviteFilters {
  /** Filtrer par etat d'activation */
  isActive?: boolean;
  /** Filtrer par type de declencheur */
  typeDeclencheur?: TypeDeclencheur;
  /** Filtrer par type d'activite generee */
  typeActivite?: TypeActivite;
  /**
   * Inclure les regles globales DKFarm (siteId = null) dans la liste.
   * Defaut : true.
   */
  includeGlobal?: boolean;
}

// ---------------------------------------------------------------------------
// Sprint 20 — Packs & Provisioning (Phase 3)
// ---------------------------------------------------------------------------

/** DTO pour creer un Pack */
export interface CreatePackDTO {
  /** Nom commercial du pack */
  nom: string;
  description?: string;
  /** Nombre d'alevins fournis (> 0) */
  nombreAlevins: number;
  /** Poids moyen initial des alevins en grammes */
  poidsMoyenInitial?: number;
  /** Prix total en FCFA (>= 0) */
  prixTotal?: number;
  /** ConfigElevage recommandée (nullable) */
  configElevageId?: string | null;
  isActive?: boolean;
  /** Plan d'abonnement associé à ce pack */
  planId: string;
}

/** DTO pour modifier un Pack (tous les champs optionnels) */
export type UpdatePackDTO = Partial<CreatePackDTO>;

/** DTO pour ajouter un produit dans un Pack */
export interface CreatePackProduitDTO {
  produitId: string;
  /** Quantite incluse (> 0) */
  quantite: number;
  /** Unite choisie (optionnel — null = unite par defaut du produit) */
  unite?: UniteStock;
}

/** DTO pour ajouter un bac pré-défini dans un Pack */
export interface CreatePackBacDTO {
  nom: string;
  volume?: number | null;
  nombreAlevins: number;
  poidsMoyenInitial?: number;
  position?: number;
}

/** DTO pour activer un Pack (provisionner un nouveau client) */
export interface ActivatePackDTO {
  /** Nom du site client a creer */
  clientSiteName: string;
  /** Adresse du site client (optionnel) */
  clientSiteAddress?: string;
  /** Nom de l'utilisateur client */
  clientUserName: string;
  /** Telephone de l'utilisateur client */
  clientUserPhone: string;
  /** Email de l'utilisateur client (optionnel) */
  clientUserEmail?: string;
  /** Mot de passe initial pour le client */
  clientUserPassword: string;
  /** Date d'expiration de l'activation (optionnel) */
  dateExpiration?: string;
  /** Notes libres */
  notes?: string;
}

/**
 * ProvisioningPayload — decrit les 6 entites crees lors du provisioning transactionnel.
 *
 * Toutes les entites sont crees dans une seule transaction Prisma (EC-2.3).
 * En cas d'erreur, le rollback est total.
 */
export interface ProvisioningPayload {
  /** 1. Site client cree */
  site: Pick<Site, "id" | "name">;
  /** 2. Utilisateur client cree */
  user: Pick<User, "id" | "name" | "phone">;
  /** 3. Vague pré-configuree creee */
  vague: Pick<Vague, "id" | "code" | "nombreInitial">;
  /** 4. Nombre de produits copies vers le stock client */
  nombreProduitsInitialises: number;
  /** 5. Nombre de mouvements stock ENTREE crees */
  nombreMouvements: number;
  /** 6. PackActivation creee avec son code */
  activation: Pick<PackActivation, "id" | "code" | "statut">;
  /** 7. Bacs crees lors du provisioning */
  bacs: { nom: string; nombreAlevins: number; volume: number | null }[];
}

/** Reponse de l'activation d'un pack (provisioning termine) */
export interface PackActivationResponse {
  activation: PackActivationWithRelations;
  provisioning: ProvisioningPayload;
}

/** Filtres pour lister les Packs */
export interface PackFilters {
  isActive?: boolean;
  configElevageId?: string;
}

/** Reponse liste des Packs */
export interface PackListResponse {
  packs: PackWithRelations[];
  total: number;
}

/** Filtres pour lister les PackActivations */
export interface PackActivationFilters {
  statut?: StatutActivation;
  packId?: string;
  clientSiteId?: string;
}

/** Reponse liste des PackActivations */
export interface PackActivationListResponse {
  activations: PackActivationWithRelations[];
  total: number;
}

// ---------------------------------------------------------------------------
// NoteIngenieur — Monitoring Ingénieur (Sprint 23)
// ---------------------------------------------------------------------------

/** DTO pour creer une note ingenieur (POST /api/notes-ingenieur) */
export interface CreateNoteIngenieurDTO {
  /** Titre court de la note */
  titre: string;
  /** Contenu en Markdown */
  contenu: string;
  /** Visibilite : PUBLIC ou INTERNE */
  visibility: VisibiliteNote;
  /** Note urgente */
  isUrgent?: boolean;
  /** True si soumise par le client (observation) */
  isFromClient?: boolean;
  /** Texte de l'observation client (utilise si isFromClient=true) */
  observationTexte?: string;
  /** Site client destinataire */
  clientSiteId: string;
  /** Vague concernee (nullable) */
  vagueId?: string;
  /** ID de la note parente pour creer une reponse dans un thread */
  replyToId?: string;
}

/** DTO pour modifier une note ingenieur (PATCH /api/notes-ingenieur/[id]) */
export interface UpdateNoteIngenieurDTO {
  /** Nouveau titre */
  titre?: string;
  /** Nouveau contenu */
  contenu?: string;
  /** Nouvelle visibilite */
  visibility?: VisibiliteNote;
  /** Modifier le flag urgent */
  isUrgent?: boolean;
  /** Marquer comme lue */
  isRead?: boolean;
  /** Nouvelle vague associee (null pour dissocier) */
  vagueId?: string | null;
}

/** Filtres pour lister les NoteIngenieur */
export interface NoteIngenieurFilters {
  clientSiteId?: string;
  visibility?: VisibiliteNote;
  isUrgent?: boolean;
  isRead?: boolean;
  isFromClient?: boolean;
  vagueId?: string;
}

/** Reponse liste des NoteIngenieur */
export interface NoteIngenieurListResponse {
  notes: NoteIngenieurWithRelations[];
  total: number;
}

// ---------------------------------------------------------------------------
// Sprint 24 — Calibrage
// ---------------------------------------------------------------------------

/** DTO pour un groupe issu du calibrage (un bac de destination + categorie de taille) */
export interface CreateCalibrageGroupeDTO {
  /** Categorie de taille de ce groupe */
  categorie: CategorieCalibrage;
  /** Bac de destination ou ce groupe est redistribue */
  destinationBacId: string;
  /** Nombre de poissons dans ce groupe */
  nombrePoissons: number;
  /** Poids moyen des poissons en grammes */
  poidsMoyen: number;
  /** Taille moyenne des poissons en cm (optionnel) */
  tailleMoyenne?: number;
}

/** DTO pour creer un calibrage (POST /api/calibrages) */
export interface CreateCalibrageDTO {
  /** Vague concernee par le calibrage */
  vagueId: string;
  /** IDs des bacs sources d'ou les poissons sont sortis */
  sourceBacIds: string[];
  /** Nombre de morts constates lors du calibrage */
  nombreMorts: number;
  /** Notes libres (optionnel) */
  notes?: string;
  /** Groupes de redistribution (au moins 1 requis) */
  groupes: CreateCalibrageGroupeDTO[];
}

// ---------------------------------------------------------------------------
// Sprint 26 — Modification de releve (ADR-014)
// ---------------------------------------------------------------------------

/**
 * Corps du PATCH /api/releves/[id]
 *
 * La raison est obligatoire (min 5 chars, max 500).
 * Au moins un champ metier doit etre fourni.
 */
export interface PatchReleveBody {
  /** Raison de la modification — obligatoire, min 5 chars, max 500 */
  raison: string;
  /** Date du releve (ISO date string) — modifiable pour corriger une erreur */
  date?: string;
  // Biometrie
  poidsMoyen?:       number;
  tailleMoyenne?:    number;
  echantillonCount?: number;
  // Mortalite
  nombreMorts?:    number;
  causeMortalite?: CauseMortalite;
  // Alimentation
  quantiteAliment?:  number;
  typeAliment?:      TypeAliment;
  frequenceAliment?: number;
  // Qualite eau
  temperature?: number;
  ph?:          number;
  oxygene?:     number;
  ammoniac?:    number;
  // Comptage
  nombreCompte?:    number;
  methodeComptage?: MethodeComptage;
  // Observation
  description?: string;
  // Commun
  notes?: string | null;
  // Consommations (remplacement total si fourni)
  consommations?: { produitId: string; quantite: number }[];
}

/**
 * DTO interne pour creer une trace de modification de releve.
 * Utilise dans la couche query, jamais expose directement par l'API.
 */
export interface CreateReleveModificationDTO {
  releveId:       string;
  userId:         string;
  raison:         string;
  champModifie:   string;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  siteId:         string;
}

/**
 * Reponse du PATCH /api/releves/[id]
 */
export interface PatchReleveResponse {
  releve:        ReleveWithModifications;
  modifications: ReleveModificationWithUser[];
}

// ---------------------------------------------------------------------------
// Sprint 26 — Modification de calibrage (ADR-015)
// ---------------------------------------------------------------------------

/**
 * DTO pour un groupe dans un PATCH calibrage.
 * Structure identique a CreateCalibrageGroupeDTO mais semantiquement distincte :
 * si groupes est fourni dans PatchCalibrageBody, il remplace COMPLETEMENT les groupes existants.
 */
export interface UpdateCalibrageGroupeDTO {
  /** Categorie de taille de ce groupe */
  categorie: CategorieCalibrage;
  /** Bac de destination (doit appartenir a la meme vague) */
  destinationBacId: string;
  /** Nombre de poissons dans ce groupe (>= 1) */
  nombrePoissons: number;
  /** Poids moyen en grammes (> 0) */
  poidsMoyen: number;
  /** Taille moyenne en cm (optionnel) */
  tailleMoyenne?: number;
}

/**
 * Corps du PATCH /api/calibrages/[id]
 *
 * La raison est obligatoire (min 5 chars, max 500).
 * Au moins un champ metier parmi nombreMorts, notes, groupes doit etre fourni.
 * Si groupes est fourni, il remplace COMPLETEMENT les groupes existants.
 * La regle de conservation est verifiee cote serveur si nombreMorts ou groupes sont fournis.
 */
export interface PatchCalibrageBody {
  /** Raison de la modification — obligatoire, min 5 chars, max 500 */
  raison: string;
  /** Nouvelle valeur du nombre de morts (>= 0) */
  nombreMorts?: number;
  /** Nouvelles notes libres (null pour effacer) */
  notes?: string | null;
  /**
   * Remplacement complet des groupes.
   * Si omis, les groupes existants sont conserves (seuls nombreMorts/notes peuvent changer).
   * Doit respecter la regle de conservation :
   *   sum(groupes.nombrePoissons) + nombreMorts === totalSourcePoissons (immuable)
   */
  groupes?: UpdateCalibrageGroupeDTO[];
}

/**
 * DTO interne pour creer une trace de modification de calibrage.
 * Utilise dans la couche query, jamais expose directement par l'API.
 */
export interface CreateCalibrageModificationDTO {
  calibrageId:    string;
  userId:         string;
  raison:         string;
  /** "nombreMorts" | "notes" | "groupes" */
  champModifie:   string;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  siteId:         string;
}

/**
 * Reponse du PATCH /api/calibrages/[id]
 */
export interface PatchCalibrageResponse {
  calibrage:     CalibrageWithModifications;
  modifications: CalibrageModificationWithUser[];
}

// ---------------------------------------------------------------------------
// Sprint 26 — CustomPlaceholder
// ---------------------------------------------------------------------------

/** DTO pour creer un placeholder personnalise (POST /api/custom-placeholders) */
export interface CreateCustomPlaceholderDTO {
  /** Cle unique du placeholder — ex: "poids_moyen" */
  key: string;
  /** Libelle affiche dans l'editeur */
  label: string;
  /** Description de l'usage (optionnel) */
  description?: string | null;
  /** Exemple de valeur pour l'interface */
  example: string;
  /** Mode de resolution */
  mode: PlaceholderMode;
  /** Chemin vers le champ source (mode MAPPING, optionnel) */
  sourcePath?: string | null;
  /** Expression de calcul (mode FORMULA, optionnel) */
  formula?: string | null;
  /** Format de la valeur resolue (defaut NUMBER) */
  format?: PlaceholderFormat;
  /** Nombre de decimales pour le format NUMBER (defaut 2) */
  decimals?: number;
}

/** DTO pour modifier un placeholder personnalise (PATCH /api/custom-placeholders/[id]) */
export interface UpdateCustomPlaceholderDTO {
  /** Nouvelle cle unique */
  key?: string;
  /** Nouveau libelle */
  label?: string;
  /** Nouvelle description (null pour effacer) */
  description?: string | null;
  /** Nouvel exemple */
  example?: string;
  /** Nouveau mode de resolution */
  mode?: PlaceholderMode;
  /** Nouveau chemin source (null pour effacer) */
  sourcePath?: string | null;
  /** Nouvelle formule (null pour effacer) */
  formula?: string | null;
  /** Nouveau format */
  format?: PlaceholderFormat;
  /** Nouveau nombre de decimales */
  decimals?: number;
  /** Activer / desactiver le placeholder */
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// User Management Module — Reponses API
// ---------------------------------------------------------------------------

export interface UserSummaryResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  sitesCount: number;
}

export interface UsersListResponse {
  users: UserSummaryResponse[];
  total: number;
}

export interface UserMembershipResponse {
  siteId: string;
  siteName: string;
  siteRoleName: string;
  isActive: boolean;
  joinedAt: Date;
}

export interface UserDetailResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  memberships: UserMembershipResponse[];
}

export interface UserMembershipsResponse {
  memberships: UserMembershipResponse[];
  total: number;
}

// ---------------------------------------------------------------------------
// DTOs — Abonnements & Paiements (Sprint 30)
// ---------------------------------------------------------------------------

/** DTO de création d'un abonnement (souscription à un plan) */
export interface CreateAbonnementDTO {
  planId: string;
  periode: PeriodeFacturation;
  phoneNumber?: string;
  fournisseur: FournisseurPaiement;
  /** Code de remise optionnel */
  remiseCode?: string;
}

/** DTO de création d'un plan d'abonnement (ADMIN uniquement) */
export interface CreatePlanAbonnementDTO {
  nom: string;
  typePlan: TypePlan;
  description?: string;
  prixMensuel?: number;
  prixTrimestriel?: number;
  prixAnnuel?: number;
  limitesSites?: number;
  limitesBacs?: number;
  limitesVagues?: number;
  limitesIngFermes?: number;
  isActif?: boolean;
  isPublic?: boolean;
  /** Modules site-level inclus dans ce plan (jamais les modules platform) */
  modulesInclus?: SiteModule[];
}

/** DTO de mise à jour partielle d'un plan d'abonnement */
export interface UpdatePlanAbonnementDTO {
  nom?: string;
  description?: string;
  prixMensuel?: number;
  prixTrimestriel?: number;
  prixAnnuel?: number;
  limitesSites?: number;
  limitesBacs?: number;
  limitesVagues?: number;
  limitesIngFermes?: number;
  isActif?: boolean;
  isPublic?: boolean;
  /** Modules site-level inclus dans ce plan (jamais les modules platform) */
  modulesInclus?: SiteModule[];
}

/** DTO pour initier un paiement Mobile Money */
export interface InitierPaiementDTO {
  abonnementId: string;
  phoneNumber: string;
  fournisseur: FournisseurPaiement;
}

/** DTO de création d'une remise (ADMIN uniquement) */
export interface CreateRemiseDTO {
  nom: string;
  code: string;
  type: TypeRemise;
  valeur: number;
  estPourcentage: boolean;
  dateDebut: string;
  dateFin?: string;
  limiteUtilisations?: number;
  planId?: string;
}

/** DTO de mise à jour d'une remise (champs modifiables — code et type sont immutables) */
export interface UpdateRemiseDTO {
  nom?: string;
  valeur?: number;
  estPourcentage?: boolean;
  dateDebut?: string;
  dateFin?: string | null;
  limiteUtilisations?: number | null;
  isActif?: boolean;
}

/** Filtres pour la liste des remises */
export interface RemiseFilters {
  siteId?: string;
  includeGlobales?: boolean;
  includeInactives?: boolean;
}

/** DTO de création d'une commission ingénieur */
export interface CreateCommissionDTO {
  ingenieurId: string;
  siteClientId: string;
  abonnementId: string;
  /** Taux entre 0.10 et 0.20 */
  taux: number;
}

/** DTO de demande de retrait du portefeuille */
export interface DemandeRetraitDTO {
  montant: number;
  phoneNumber: string;
  fournisseur: FournisseurPaiement;
}

/** Filtres pour la liste des abonnements */
export interface AbonnementFilters {
  statut?: StatutAbonnement;
  planId?: string;
  siteId?: string;
  dateDebutAfter?: string;
  dateFinBefore?: string;
}

// ---------------------------------------------------------------------------
// Admin Plateforme — DTOs (ADR-021)
// ---------------------------------------------------------------------------

/**
 * AdminSiteSummary — representation resumee d'un site pour la liste admin.
 *
 * Retourne par GET /api/admin/sites (voir ADR-021 section 3.1).
 * Le champ `status` est calcule cote serveur via computeSiteStatus().
 */
export interface AdminSiteSummary {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  supervised: boolean;
  /** ISO date string. Null si non suspendu. */
  suspendedAt: string | null;
  suspendedReason: string | null;
  /** ISO date string. Null si non archive. */
  deletedAt: string | null;
  /** R2 : utiliser SiteStatus.ACTIVE, SiteStatus.SUSPENDED, etc. */
  status: SiteStatus;
  enabledModules: SiteModule[];
  memberCount: number;
  bacCount: number;
  vagueCount: number;
  /** Abonnement actif du site. Null si aucun abonnement actif. */
  abonnement: {
    id: string;
    planNom: string;
    /** R2 : utiliser TypePlan.STANDARD, TypePlan.PREMIUM, etc. */
    typePlan: TypePlan;
    /** R2 : utiliser StatutAbonnement.ACTIF, etc. */
    statut: StatutAbonnement;
    /** ISO date string. */
    dateFin: string;
  } | null;
  /** ISO date string. */
  createdAt: string;
}

/**
 * AdminSitesListResponse — reponse paginee de GET /api/admin/sites.
 *
 * Les stats globales sont toujours renvoyees, meme avec des filtres actifs.
 */
export interface AdminSitesListResponse {
  sites: AdminSiteSummary[];
  total: number;
  page: number;
  totalPages: number;
  stats: {
    totalActive: number;
    totalSuspended: number;
    totalBlocked: number;
    totalArchived: number;
  };
}

/**
 * AdminSiteDetailResponse — reponse complete de GET /api/admin/sites/[id].
 *
 * Inclut membres, abonnement actif et journal d'audit recent.
 * R3 : tous les Decimal sont serialises en number (prixPaye).
 */
export interface AdminSiteDetailResponse {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  supervised: boolean;
  /** ISO date string. */
  suspendedAt: string | null;
  suspendedReason: string | null;
  /** ISO date string. */
  deletedAt: string | null;
  /** R2 : utiliser SiteStatus.ACTIVE, etc. */
  status: SiteStatus;
  enabledModules: SiteModule[];
  members: {
    id: string;
    userId: string;
    name: string;
    email: string | null;
    phone: string | null;
    siteRoleName: string;
    isActive: boolean;
    /** ISO date string. */
    createdAt: string;
  }[];
  /** Abonnement actif. Null si aucun. */
  abonnementActif: {
    id: string;
    planId: string;
    planNom: string;
    /** R2 : utiliser TypePlan.STANDARD, etc. */
    typePlan: TypePlan;
    /** R2 : utiliser StatutAbonnement.ACTIF, etc. */
    statut: StatutAbonnement;
    /** R2 : utiliser PeriodeFacturation.MENSUEL, etc. */
    periode: PeriodeFacturation;
    /** ISO date string. */
    dateDebut: string;
    /** ISO date string. */
    dateFin: string;
    /** ISO date string. */
    dateProchainRenouvellement: string;
    /** ISO date string. Null si pas de periode de grace. */
    dateFinGrace: string | null;
    /** Decimal serialise en number. */
    prixPaye: number;
  } | null;
  bacCount: number;
  vagueCount: number;
  memberCount: number;
  releveCount: number;
  recentAuditLogs: {
    id: string;
    actorName: string;
    action: string;
    details: Record<string, unknown> | null;
    /** ISO date string. */
    createdAt: string;
  }[];
  /** ISO date string. */
  createdAt: string;
  /** ISO date string. */
  updatedAt: string;
}

/**
 * SiteStatusUpdateDTO — corps du PATCH /api/admin/sites/[id]/status.
 *
 * `reason` est obligatoire pour SUSPEND et BLOCK.
 * `confirmArchive` est obligatoire (et doit etre true) pour ARCHIVE.
 */
export interface SiteStatusUpdateDTO {
  action: "SUSPEND" | "BLOCK" | "RESTORE" | "ARCHIVE";
  /** Obligatoire pour SUSPEND et BLOCK. */
  reason?: string;
  /** Doit etre true pour valider l'action ARCHIVE. */
  confirmArchive?: boolean;
}

/**
 * SiteStatusUpdateResponse — reponse du PATCH /api/admin/sites/[id]/status.
 */
export interface SiteStatusUpdateResponse {
  id: string;
  /** R2 : utiliser SiteStatus.ACTIVE, etc. */
  status: SiteStatus;
  isActive: boolean;
  /** ISO date string. */
  suspendedAt: string | null;
  suspendedReason: string | null;
  /** ISO date string. */
  deletedAt: string | null;
  /** ISO date string. */
  updatedAt: string;
}

/**
 * AdminSiteModulesUpdateDTO — corps du PATCH /api/admin/sites/[id]/modules.
 *
 * Les modules platform-level (ABONNEMENTS, COMMISSIONS, REMISES) sont refuses
 * pour les sites non-plateforme.
 */
export interface AdminSiteModulesUpdateDTO {
  /** R2 : utiliser SiteModule.GROSSISSEMENT, etc. */
  enabledModules: SiteModule[];
  /** Optionnel — enregistre dans SiteAuditLog. */
  reason?: string;
}

/**
 * AdminSiteModulesUpdateResponse — reponse du PATCH /api/admin/sites/[id]/modules.
 */
export interface AdminSiteModulesUpdateResponse {
  id: string;
  enabledModules: SiteModule[];
  /** ISO date string. */
  updatedAt: string;
}

/**
 * AdminAnalyticsResponse — reponse de GET /api/admin/analytics.
 *
 * KPIs consolides de toute la plateforme DKFarm.
 * MRR calcule en XAF.
 */
export interface AdminAnalyticsResponse {
  // Sites
  sitesActifs: number;
  sitesSuspendus: number;
  sitesBlockes: number;
  sitesCrees30j: number;
  // Abonnements
  abonnementsActifs: number;
  abonnementsGrace: number;
  abonnementsExpires: number;
  /** R2 : utiliser TypePlan.STANDARD, etc. */
  abonnementsParPlan: { typePlan: TypePlan; count: number }[];
  // Revenus (XAF)
  /** Somme mensuelle estimee des abonnements actifs (XAF). */
  mrrEstime: number;
  /** Paiements confirmes sur les 30 derniers jours (XAF). */
  revenusTotal30j: number;
  /** Paiements confirmes sur les 12 derniers mois (XAF). */
  revenusTotal12m: number;
  // Ingenieurs
  ingenieursActifs: number;
  ingenieursAvecClients: number;
  /** Nombre de RetraitPortefeuille en statut EN_ATTENTE. */
  commissionsEnAttente: number;
  // Modules
  modulesDistribution: {
    /** R2 : utiliser SiteModule.GROSSISSEMENT, etc. */
    module: SiteModule;
    siteCount: number;
    /** Pourcentage de sites ayant ce module (0-100). */
    pourcentage: number;
  }[];
}

/**
 * AdminAnalyticsSitesResponse — reponse de GET /api/admin/analytics/sites.
 *
 * Evolution du nombre de sites dans le temps.
 */
export interface AdminAnalyticsSitesResponse {
  points: {
    /** ISO date (YYYY-MM-DD). */
    date: string;
    /** Total cumulatif de sites actifs a cette date. */
    cumul: number;
    /** Sites crees ce jour/semaine/mois selon la periode. */
    nouveaux: number;
  }[];
  periode: "7d" | "30d" | "90d" | "12m";
}

/**
 * ModuleDefinitionResponse — representation d'un ModuleDefinition avec stats calculees.
 *
 * Retourne par GET /api/admin/modules.
 */
export interface ModuleDefinitionResponse {
  id: string;
  /** Valeur de l'enum SiteModule (ex: "GROSSISSEMENT"). */
  key: string;
  label: string;
  description: string | null;
  iconName: string;
  sortOrder: number;
  level: "site" | "platform";
  dependsOn: string[];
  isVisible: boolean;
  isActive: boolean;
  category: string | null;
  /** Nombre de sites ayant ce module dans enabledModules. Calcule dynamiquement. */
  siteCount: number;
  /** Nombre de plans incluant ce module dans modulesInclus. Calcule dynamiquement. */
  planCount: number;
}

/**
 * AdminModulesListResponse — reponse de GET /api/admin/modules.
 */
export interface AdminModulesListResponse {
  modules: ModuleDefinitionResponse[];
}

/**
 * BackofficeSession — session d'un super-admin connecte au backoffice DKFarm.
 *
 * Distinct de UserSession (multi-tenancy) : pas de siteId, isSuperAdmin est
 * un type literal `true` pour permettre la discrimination de type.
 */
export interface BackofficeSession {
  userId: string;
  email: string | null;
  phone: string | null;
  name: string;
  isSuperAdmin: true;
}
