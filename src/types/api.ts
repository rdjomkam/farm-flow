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
  CategorieDepense,
  CauseMortalite,
  CategorieProduit,
  FrequenceRecurrence,
  MethodeComptage,
  ModePaiement,
  Recurrence,
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
  TypeMouvement,
  TypeReleve,
  UniteStock,
} from "./models";
import type {
  Bac,
  Client,
  Commande,
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
  Paiement,
  PaiementDepense,
  Ponte,
  Produit,
  Releve,
  Reproducteur,
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
  /** IDs des bacs a assigner a cette vague */
  bacIds: string[];
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
}

/** DTO pour creer un releve de biometrie */
export interface CreateReleveBiometrieDTO extends CreateReleveBase {
  typeReleve: TypeReleve.BIOMETRIE;
  /** Poids moyen en grammes */
  poidsMoyen: number;
  /** Taille moyenne en cm */
  tailleMoyenne: number;
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
  | CreateReleveObservationDTO;

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
}

/** DTO pour modifier une liste de besoins (seulement si SOUMISE) */
export interface UpdateListeBesoinsDTO {
  titre?: string;
  vagueId?: string | null;
  notes?: string | null;
  lignes?: CreateLigneBesoinDTO[];
}

/** Filtres pour lister les listes de besoins */
export interface ListeBesoinsFilters {
  statut?: StatutBesoins;
  demandeurId?: string;
  vagueId?: string;
  dateFrom?: string;
  dateTo?: string;
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
