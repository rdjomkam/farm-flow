/**
 * Types miroirs du schema Prisma.
 *
 * Ces types representent les modeles tels qu'ils sont stockes en base.
 * Ils servent de source de verite TypeScript pour le projet.
 *
 * 32 modeles : Site, SiteRole, SiteMember, User, Session, Bac, Vague, Releve, Fournisseur, Produit, MouvementStock, Commande, LigneCommande, ReleveConsommation, Client, Vente, Facture, Paiement, Reproducteur, Ponte, LotAlevins, ConfigAlerte, Notification, Activite, Depense, PaiementDepense, DepenseRecurrente, ListeBesoins, LigneBesoin, RegleActivite, ConditionRegle, NoteIngenieur
 * 36 enums : Role (+ INGENIEUR), Permission (+ 6 Phase 3), StatutVague, TypeReleve (+ RENOUVELLEMENT), TypeAliment, CauseMortalite, MethodeComptage, CategorieProduit, UniteStock, TypeMouvement, StatutCommande, StatutFacture, ModePaiement, SiteModule, SexeReproducteur, StatutReproducteur, StatutPonte, StatutLotAlevins, TypeAlerte (+ 4 density), StatutAlerte, TypeActivite (+ TRI/MEDICATION/RENOUVELLEMENT), StatutActivite, Recurrence, CategorieDepense, StatutDepense, FrequenceRecurrence, StatutBesoins, PhaseElevage, StatutActivation, TypeDeclencheur (+ 3 density), VisibiliteNote, CategorieCalibrage, TypeSystemeBac, OperateurCondition, LogiqueCondition, SeveriteAlerte
 */

// ---------------------------------------------------------------------------
// Enums — Authentification & Permissions
// ---------------------------------------------------------------------------

/** Role d'un utilisateur */
export enum Role {
  ADMIN = "ADMIN",
  GERANT = "GERANT",
  PISCICULTEUR = "PISCICULTEUR",
  INGENIEUR = "INGENIEUR",
}

/** Permissions granulaires */
export enum Permission {
  // Administration
  SITE_GERER = "SITE_GERER",
  MEMBRES_GERER = "MEMBRES_GERER",
  // Elevage
  VAGUES_VOIR = "VAGUES_VOIR",
  VAGUES_CREER = "VAGUES_CREER",
  VAGUES_MODIFIER = "VAGUES_MODIFIER",
  BACS_GERER = "BACS_GERER",
  BACS_MODIFIER = "BACS_MODIFIER",
  RELEVES_VOIR = "RELEVES_VOIR",
  RELEVES_CREER = "RELEVES_CREER",
  RELEVES_MODIFIER = "RELEVES_MODIFIER",
  // Stock
  STOCK_VOIR = "STOCK_VOIR",
  STOCK_GERER = "STOCK_GERER",
  APPROVISIONNEMENT_VOIR = "APPROVISIONNEMENT_VOIR",
  APPROVISIONNEMENT_GERER = "APPROVISIONNEMENT_GERER",
  // Clients
  CLIENTS_VOIR = "CLIENTS_VOIR",
  CLIENTS_GERER = "CLIENTS_GERER",
  // Ventes
  VENTES_VOIR = "VENTES_VOIR",
  VENTES_CREER = "VENTES_CREER",
  FACTURES_VOIR = "FACTURES_VOIR",
  FACTURES_GERER = "FACTURES_GERER",
  // Paiements
  PAIEMENTS_CREER = "PAIEMENTS_CREER",
  // Alevins
  ALEVINS_VOIR = "ALEVINS_VOIR",
  ALEVINS_GERER = "ALEVINS_GERER",
  ALEVINS_CREER = "ALEVINS_CREER",
  ALEVINS_MODIFIER = "ALEVINS_MODIFIER",
  ALEVINS_SUPPRIMER = "ALEVINS_SUPPRIMER",
  // Planning
  PLANNING_VOIR = "PLANNING_VOIR",
  PLANNING_GERER = "PLANNING_GERER",
  // Finances
  FINANCES_VOIR = "FINANCES_VOIR",
  FINANCES_GERER = "FINANCES_GERER",
  // Alertes
  ALERTES_VOIR = "ALERTES_VOIR",
  ALERTES_CONFIGURER = "ALERTES_CONFIGURER",
  // General
  DASHBOARD_VOIR = "DASHBOARD_VOIR",
  EXPORT_DONNEES = "EXPORT_DONNEES",
  // Depenses
  DEPENSES_VOIR = "DEPENSES_VOIR",
  DEPENSES_CREER = "DEPENSES_CREER",
  DEPENSES_PAYER = "DEPENSES_PAYER",
  // Besoins
  BESOINS_SOUMETTRE = "BESOINS_SOUMETTRE",
  BESOINS_APPROUVER = "BESOINS_APPROUVER",
  BESOINS_TRAITER = "BESOINS_TRAITER",
  // Phase 3 — Packs & Ingénieur
  GERER_PACKS = "GERER_PACKS",
  ACTIVER_PACKS = "ACTIVER_PACKS",
  GERER_CONFIG_ELEVAGE = "GERER_CONFIG_ELEVAGE",
  REGLES_ACTIVITES_VOIR = "REGLES_ACTIVITES_VOIR",
  GERER_REGLES_ACTIVITES = "GERER_REGLES_ACTIVITES",
  MONITORING_CLIENTS = "MONITORING_CLIENTS",
  ENVOYER_NOTES = "ENVOYER_NOTES",
  // Calibrage
  CALIBRAGES_VOIR = "CALIBRAGES_VOIR",
  CALIBRAGES_CREER = "CALIBRAGES_CREER",
  CALIBRAGES_MODIFIER = "CALIBRAGES_MODIFIER",
  GERER_REGLES_GLOBALES = "GERER_REGLES_GLOBALES",
  // Utilisateurs (6)
  UTILISATEURS_VOIR = "UTILISATEURS_VOIR",
  UTILISATEURS_CREER = "UTILISATEURS_CREER",
  UTILISATEURS_MODIFIER = "UTILISATEURS_MODIFIER",
  UTILISATEURS_SUPPRIMER = "UTILISATEURS_SUPPRIMER",
  UTILISATEURS_GERER = "UTILISATEURS_GERER",
  UTILISATEURS_IMPERSONNER = "UTILISATEURS_IMPERSONNER",
}

// ---------------------------------------------------------------------------
// Enums — Elevage
// ---------------------------------------------------------------------------

/** Statut d'une vague (lot de poissons) */
export enum StatutVague {
  EN_COURS = "EN_COURS",
  TERMINEE = "TERMINEE",
  ANNULEE = "ANNULEE",
}

/** Type de releve effectue sur un bac */
export enum TypeReleve {
  BIOMETRIE = "BIOMETRIE",
  MORTALITE = "MORTALITE",
  ALIMENTATION = "ALIMENTATION",
  QUALITE_EAU = "QUALITE_EAU",
  COMPTAGE = "COMPTAGE",
  OBSERVATION = "OBSERVATION",
  /** Evenement de renouvellement d'eau d'un bac — Sprint 27-28 (ADR-density-alerts) */
  RENOUVELLEMENT = "RENOUVELLEMENT",
}

/** Type d'aliment distribue */
export enum TypeAliment {
  ARTISANAL = "ARTISANAL",
  COMMERCIAL = "COMMERCIAL",
  MIXTE = "MIXTE",
}

/** Cause de mortalite constatee */
export enum CauseMortalite {
  MALADIE = "MALADIE",
  QUALITE_EAU = "QUALITE_EAU",
  STRESS = "STRESS",
  PREDATION = "PREDATION",
  CANNIBALISME = "CANNIBALISME",
  INCONNUE = "INCONNUE",
  AUTRE = "AUTRE",
}

/** Methode utilisee pour le comptage */
export enum MethodeComptage {
  DIRECT = "DIRECT",
  ESTIMATION = "ESTIMATION",
  ECHANTILLONNAGE = "ECHANTILLONNAGE",
}

/**
 * TypeSystemeBac — Type de systeme d'elevage d'un bac.
 *
 * Determine les seuils de densite applicables (kg/m3) dans le moteur d'alertes
 * et dans le composant bac-densite-badge.
 * Null sur un bac existant = traite comme BAC_BETON par defaut (prudence).
 * Sprint 27-28 (ADR-density-alerts)
 */
export enum TypeSystemeBac {
  BAC_BETON = "BAC_BETON",
  BAC_PLASTIQUE = "BAC_PLASTIQUE",
  ETANG_TERRE = "ETANG_TERRE",
  RAS = "RAS",
}

// ---------------------------------------------------------------------------
// Enums — Stock & Approvisionnement
// ---------------------------------------------------------------------------

/** Categorie d'un produit en stock */
export enum CategorieProduit {
  ALIMENT = "ALIMENT",
  INTRANT = "INTRANT",
  EQUIPEMENT = "EQUIPEMENT",
}

/** Unite de mesure du stock */
export enum UniteStock {
  GRAMME = "GRAMME",
  KG = "KG",
  MILLILITRE = "MILLILITRE",
  LITRE = "LITRE",
  UNITE = "UNITE",
  SACS = "SACS",
}

/** Type de mouvement de stock */
export enum TypeMouvement {
  ENTREE = "ENTREE",
  SORTIE = "SORTIE",
}

/** Statut d'une commande fournisseur */
export enum StatutCommande {
  BROUILLON = "BROUILLON",
  ENVOYEE = "ENVOYEE",
  LIVREE = "LIVREE",
  ANNULEE = "ANNULEE",
}

// ---------------------------------------------------------------------------
// Enums — Ventes & Facturation
// ---------------------------------------------------------------------------

/** Statut d'une facture */
export enum StatutFacture {
  BROUILLON = "BROUILLON",
  ENVOYEE = "ENVOYEE",
  PAYEE_PARTIELLEMENT = "PAYEE_PARTIELLEMENT",
  PAYEE = "PAYEE",
  ANNULEE = "ANNULEE",
}

/** Mode de paiement */
export enum ModePaiement {
  ESPECES = "ESPECES",
  MOBILE_MONEY = "MOBILE_MONEY",
  VIREMENT = "VIREMENT",
  CHEQUE = "CHEQUE",
}

// ---------------------------------------------------------------------------
// Modeles — Multi-tenancy
// ---------------------------------------------------------------------------

/**
 * Site — une ferme piscicole.
 *
 * Chaque donnee metier (Bac, Vague, Releve) est scopee par siteId.
 * Un utilisateur accede a un site via SiteMember.
 */
/** Modules fonctionnels activables par site */
export enum SiteModule {
  REPRODUCTION = "REPRODUCTION",
  GROSSISSEMENT = "GROSSISSEMENT",
  INTRANTS = "INTRANTS",
  VENTES = "VENTES",
  ANALYSE_PILOTAGE = "ANALYSE_PILOTAGE",
  PACKS_PROVISIONING = "PACKS_PROVISIONING",
  CONFIGURATION = "CONFIGURATION",
  INGENIEUR = "INGENIEUR",
  NOTES = "NOTES",
}

export interface Site {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  supervised: boolean;
  enabledModules: SiteModule[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * SiteRole — role dynamique defini par site.
 *
 * Remplace les roles statiques (ADMIN/GERANT/PISCICULTEUR) au niveau site.
 * Les permissions sont un tableau stocke en base.
 * isSystem = true pour les roles crees automatiquement a la creation du site.
 */
export interface SiteRole {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  isSystem: boolean;
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** SiteRole avec compteur de membres */
export interface SiteRoleWithCount extends SiteRole {
  _count: { members: number };
}

/**
 * SiteMember — appartenance d'un utilisateur a un site.
 *
 * Le role et les permissions sont desormais definis via SiteRole.
 * Un user peut avoir des roles differents sur des sites differents.
 */
export interface SiteMember {
  id: string;
  userId: string;
  siteId: string;
  siteRoleId: string;
  siteRole?: SiteRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** SiteMember avec ses relations user, site et siteRole chargees */
export interface SiteMemberWithRelations extends SiteMember {
  user: User;
  site: Site;
  siteRole: SiteRole;
}

/** Site avec ses membres charges */
export interface SiteWithMembers extends Site {
  members: SiteMember[];
}

// ---------------------------------------------------------------------------
// Modeles — Authentification
// ---------------------------------------------------------------------------

/**
 * User — utilisateur de l'application.
 *
 * Le passwordHash n'est JAMAIS expose cote client.
 * Utiliser UserSession (dans auth.ts) pour les donnees de session.
 */
export interface User {
  id: string;
  /** Email de l'utilisateur (nullable — au moins email ou phone requis) */
  email: string | null;
  /** Telephone de l'utilisateur, format camerounais +237... (nullable — au moins email ou phone requis) */
  phone: string | null;
  name: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  /** True pour les comptes systeme internes (ex: auto-generation d'activites). Ces comptes ne peuvent pas se connecter. */
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session — session active d'un utilisateur.
 *
 * Le sessionToken est un UUID v4 opaque stocke dans un cookie HttpOnly.
 */
export interface Session {
  id: string;
  sessionToken: string;
  userId: string;
  /** Site actif pour cette session (null si pas encore selectionne) */
  activeSiteId: string | null;
  expires: Date;
  createdAt: Date;
}

/** Session avec sa relation user chargee */
export interface SessionWithUser extends Session {
  user: User;
}

// ---------------------------------------------------------------------------
// Modeles — Elevage
// ---------------------------------------------------------------------------

/**
 * Bac — contenant physique (bac en beton, plastique ou etang).
 *
 * Regle metier : un bac ne peut etre assigne qu'a UNE SEULE vague a la fois.
 * vagueId est nullable : null = bac libre.
 */
export interface Bac {
  id: string;
  /** Nom d'affichage du bac (ex: "Bac 1", "Etang A") */
  nom: string;
  /** Volume en litres (nullable — peut etre null pour les bacs provisionnés via Pack) */
  volume: number | null;
  /** Nombre de poissons actuellement dans le bac (mis a jour via comptages) */
  nombrePoissons: number | null;
  /** ID de la vague assignee, null si le bac est libre */
  vagueId: string | null;
  /** Nombre initial de poissons au demarrage du calibrage (nullable) */
  nombreInitial: number | null;
  /** Poids moyen initial des poissons en grammes au demarrage du calibrage (nullable) */
  poidsMoyenInitial: number | null;
  /**
   * Type de systeme d'elevage — determine les seuils de densite applicables.
   * Null pour les bacs existants = traite comme BAC_BETON par defaut dans le moteur d'alertes.
   * Sprint 27-28 (ADR-density-alerts, section 5.2)
   */
  typeSysteme: TypeSystemeBac | null;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Bac avec sa relation vague chargee */
export interface BacWithVague extends Bac {
  vague: Vague | null;
}

/**
 * Vague — lot de poissons suivi dans le temps.
 *
 * Une vague commence avec un nombre initial d'alevins repartis
 * dans un ou plusieurs bacs. Elle est cloturable quand le cycle
 * de grossissement est termine.
 */
export interface Vague {
  id: string;
  /** Code unique de la vague (ex: "VAGUE-2024-001") */
  code: string;
  /** Date de mise en eau */
  dateDebut: Date;
  /** Date de cloture (null si en cours) */
  dateFin: Date | null;
  /** Nombre d'alevins au demarrage */
  nombreInitial: number;
  /** Poids moyen des alevins au demarrage, en grammes */
  poidsMoyenInitial: number;
  /** Provenance des alevins (fournisseur, ecloserie locale, etc.) */
  origineAlevins: string | null;
  /** Statut actuel de la vague */
  statut: StatutVague;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Vague avec ses relations bacs et releves chargees */
export interface VagueWithRelations extends Vague {
  bacs: Bac[];
  releves: Releve[];
}

/**
 * Releve — mesure ou observation effectuee sur un bac pour une vague.
 *
 * Le champ typeReleve determine quels champs optionnels sont remplis.
 * En base, tous les champs specifiques sont nullables.
 * Voir src/types/releves.ts pour les types discrimines cote TypeScript.
 */
export interface Releve {
  id: string;
  /** Date et heure du releve */
  date: Date;
  /** Type de releve — determine les champs a remplir */
  typeReleve: TypeReleve;
  /** Vague concernee */
  vagueId: string;
  /** Bac concerne */
  bacId: string;
  /** ID du site (ferme) — R8 */
  siteId: string;
  /** Notes libres */
  notes: string | null;

  // --- Champs biometrie ---
  /** Poids moyen echantillonne, en grammes */
  poidsMoyen: number | null;
  /** Taille moyenne echantillonnee, en cm */
  tailleMoyenne: number | null;
  /** Nombre de poissons dans l'echantillon biometrique */
  echantillonCount: number | null;

  // --- Champs mortalite ---
  /** Nombre de poissons morts constates */
  nombreMorts: number | null;
  /** Cause presumee de la mortalite */
  causeMortalite: CauseMortalite | null;

  // --- Champs alimentation ---
  /** Quantite d'aliment distribue, en kg */
  quantiteAliment: number | null;
  /** Type d'aliment utilise */
  typeAliment: TypeAliment | null;
  /** Nombre de distributions par jour */
  frequenceAliment: number | null;

  // --- Champs qualite eau ---
  /** Temperature de l'eau en degres Celsius */
  temperature: number | null;
  /** pH de l'eau */
  ph: number | null;
  /** Oxygene dissous en mg/L */
  oxygene: number | null;
  /** Ammoniac en mg/L */
  ammoniac: number | null;

  // --- Champs comptage ---
  /** Nombre de poissons comptes */
  nombreCompte: number | null;
  /** Methode de comptage utilisee */
  methodeComptage: MethodeComptage | null;

  // --- Champs observation ---
  /** Description de l'observation */
  description: string | null;

  // --- Champs renouvellement eau (Sprint 27-28, ADR-density-alerts, section 5.3) ---
  /** Pourcentage du volume du bac renouvelee (ex: 50 = 50%) — rempli si typeReleve = RENOUVELLEMENT */
  pourcentageRenouvellement: number | null;
  /** Volume reel en litres renouvele — alternative ou complement a pourcentageRenouvellement */
  volumeRenouvele: number | null;

  createdAt: Date;
  updatedAt: Date;

  /** Flag rapide : true si ce releve a ete modifie apres creation (ADR-014) */
  modifie: boolean;

  /** Produits consommes lors de ce releve (present si la query inclut les consommations avec leur produit) */
  consommations?: ReleveConsommationWithRelations[];
  /** Historique des modifications (present si la query inclut les modifications) */
  modifications?: ReleveModificationWithUser[];
}

/** Releve avec ses relations vague et bac chargees */
export interface ReleveWithRelations extends Releve {
  vague: Vague;
  bac: Bac;
}

/**
 * Trace d'une modification de releve avec raison d'audit (ADR-014).
 *
 * Granularite : une ligne par champ modifie.
 */
export interface ReleveModification {
  id:             string;
  releveId:       string;
  userId:         string;
  raison:         string;
  /** Nom du champ modifie : "poidsMoyen" | "nombreMorts" | etc. */
  champModifie:   string;
  ancienneValeur: string | null;
  nouvelleValeur: string | null;
  siteId:         string;
  createdAt:      Date;
}

/** ReleveModification avec l'utilisateur denormalise (pour affichage) */
export interface ReleveModificationWithUser extends ReleveModification {
  user: {
    id:   string;
    name: string;
  };
}

/** Releve avec consommations ET historique complet de modifications */
export interface ReleveWithModifications extends Omit<Releve, "consommations"> {
  consommations: (ReleveConsommation & { produit: Produit })[];
  modifications: ReleveModificationWithUser[];
}

// ---------------------------------------------------------------------------
// Modeles — Stock & Approvisionnement
// ---------------------------------------------------------------------------

/**
 * Fournisseur — source d'approvisionnement en produits.
 */
export interface Fournisseur {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  isActive: boolean;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Produit — article en stock (aliment, intrant, equipement).
 *
 * stockActuel est mis a jour automatiquement via les mouvements de stock.
 * seuilAlerte declenche une notification quand stockActuel < seuilAlerte.
 */
export interface Produit {
  id: string;
  nom: string;
  categorie: CategorieProduit;
  unite: UniteStock;
  /** Unite d'achat (ex: SACS) — null si identique a unite */
  uniteAchat: UniteStock | null;
  /** Contenance d'une unite d'achat dans l'unite de base (ex: 25 kg/sac) — null si pas de conversion */
  contenance: number | null;
  prixUnitaire: number;
  /** Quantite actuelle en stock (mise a jour via MouvementStock) */
  stockActuel: number;
  /** Seuil en dessous duquel une alerte est declenchee */
  seuilAlerte: number;
  /** Fournisseur par defaut (nullable) */
  fournisseurId: string | null;
  isActive: boolean;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Produit avec son fournisseur charge */
export interface ProduitWithFournisseur extends Produit {
  fournisseur: Fournisseur | null;
}

/**
 * MouvementStock — entree ou sortie de stock pour un produit.
 *
 * Chaque mouvement peut etre lie a une vague (sortie aliment)
 * ou a une commande (entree livraison).
 */
export interface MouvementStock {
  id: string;
  produitId: string;
  type: TypeMouvement;
  quantite: number;
  /** Cout total du mouvement (nullable — pas toujours connu) */
  prixTotal: number | null;
  /** Vague associee si sortie pour alimentation */
  vagueId: string | null;
  /** Commande associee si entree de livraison */
  commandeId: string | null;
  /** Utilisateur ayant effectue le mouvement */
  userId: string;
  date: Date;
  notes: string | null;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
}

/** MouvementStock avec ses relations chargees */
export interface MouvementStockWithRelations extends MouvementStock {
  produit: Produit;
  vague: Vague | null;
  commande: Commande | null;
  user: User;
}

/**
 * Commande — commande fournisseur pour approvisionnement.
 *
 * Le montantTotal est calcule a partir des lignes de commande.
 */
export interface Commande {
  id: string;
  /** Numero unique de la commande (ex: "CMD-2026-001") */
  numero: string;
  fournisseurId: string;
  statut: StatutCommande;
  dateCommande: Date;
  dateLivraison: Date | null;
  montantTotal: number;
  /** URL de la facture fournisseur sur Hetzner Object Storage (null si non uploadee) — Sprint 15 */
  factureUrl: string | null;
  /** Utilisateur ayant cree la commande */
  userId: string;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Commande avec ses relations chargees */
export interface CommandeWithRelations extends Commande {
  fournisseur: Fournisseur;
  lignes: LigneCommande[];
  user: User;
}

/**
 * LigneCommande — ligne de detail d'une commande fournisseur.
 */
export interface LigneCommande {
  id: string;
  commandeId: string;
  produitId: string;
  quantite: number;
  prixUnitaire: number;
  createdAt: Date;
}

/** LigneCommande avec son produit charge */
export interface LigneCommandeWithProduit extends LigneCommande {
  produit: Produit;
}

// ---------------------------------------------------------------------------
// Modeles — Consommation produits via releves
// ---------------------------------------------------------------------------

/**
 * ReleveConsommation — produit consomme lors d'un releve.
 *
 * Permet de tracer la consommation de produits (aliment, intrant)
 * lors d'un releve d'alimentation et de generer automatiquement
 * les mouvements de stock (sortie).
 */
export interface ReleveConsommation {
  id: string;
  releveId: string;
  produitId: string;
  quantite: number;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
}

/** ReleveConsommation avec ses relations chargees */
export interface ReleveConsommationWithRelations extends ReleveConsommation {
  releve: Releve;
  produit: Produit;
}

// ---------------------------------------------------------------------------
// Modeles — Ventes & Facturation
// ---------------------------------------------------------------------------

/**
 * Client — client acheteur de poissons.
 */
export interface Client {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  isActive: boolean;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Vente — transaction de vente de poissons.
 *
 * Chaque vente est liee a un client et a une vague.
 * Le montantTotal est calcule : poidsTotalKg * prixUnitaireKg.
 */
export interface Vente {
  id: string;
  /** Numero unique de la vente (ex: "VTE-2026-001") */
  numero: string;
  clientId: string;
  vagueId: string;
  /** Nombre de poissons vendus */
  quantitePoissons: number;
  /** Poids total en kg */
  poidsTotalKg: number;
  /** Prix de vente par kg */
  prixUnitaireKg: number;
  /** Montant total de la vente */
  montantTotal: number;
  notes: string | null;
  /** ID du site (ferme) — R8 */
  siteId: string;
  /** Utilisateur ayant enregistre la vente */
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Vente avec ses relations chargees */
export interface VenteWithRelations extends Vente {
  client: Client;
  vague: Vague;
  user: User;
  facture: Facture | null;
}

/**
 * Facture — facture generee a partir d'une vente.
 *
 * Relation 1:1 avec Vente (venteId unique).
 * Le statut evolue : BROUILLON → ENVOYEE → PAYEE_PARTIELLEMENT → PAYEE.
 */
export interface Facture {
  id: string;
  /** Numero unique de la facture (ex: "FAC-2026-001") */
  numero: string;
  /** ID de la vente associee (relation 1:1) */
  venteId: string;
  statut: StatutFacture;
  dateEmission: Date;
  dateEcheance: Date | null;
  montantTotal: number;
  /** Montant deja paye (somme des paiements) */
  montantPaye: number;
  notes: string | null;
  /** ID du site (ferme) — R8 */
  siteId: string;
  /** Utilisateur ayant cree la facture */
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Facture avec ses relations chargees */
export interface FactureWithRelations extends Facture {
  vente: Vente & { client: Client };
  paiements: Paiement[];
  user: User;
}

/**
 * Paiement — paiement enregistre sur une facture.
 *
 * Plusieurs paiements possibles par facture (paiement partiel).
 */
export interface Paiement {
  id: string;
  factureId: string;
  montant: number;
  mode: ModePaiement;
  /** Reference du paiement (numero cheque, ref Mobile Money, etc.) */
  reference: string | null;
  date: Date;
  /** ID du site (ferme) — R8 */
  siteId: string;
  /** Utilisateur ayant enregistre le paiement */
  userId: string;
  createdAt: Date;
}

/** Paiement avec ses relations chargees */
export interface PaiementWithRelations extends Paiement {
  facture: Facture;
  user: User;
}

// ---------------------------------------------------------------------------
// Enums — Production Alevins
// ---------------------------------------------------------------------------

/** Sexe d'un reproducteur */
export enum SexeReproducteur {
  MALE = "MALE",
  FEMELLE = "FEMELLE",
}

/** Statut d'un reproducteur dans le cheptel */
export enum StatutReproducteur {
  ACTIF = "ACTIF",
  REFORME = "REFORME",
  MORT = "MORT",
}

/** Statut d'une ponte */
export enum StatutPonte {
  EN_COURS = "EN_COURS",
  TERMINEE = "TERMINEE",
  ECHOUEE = "ECHOUEE",
}

/** Statut d'un lot d'alevins */
export enum StatutLotAlevins {
  EN_INCUBATION = "EN_INCUBATION",
  EN_ELEVAGE = "EN_ELEVAGE",
  TRANSFERE = "TRANSFERE",
  PERDU = "PERDU",
}

// ---------------------------------------------------------------------------
// Modeles — Production Alevins
// ---------------------------------------------------------------------------

/**
 * Reproducteur — poisson reproducteur (male ou femelle) du cheptel.
 *
 * Chaque reproducteur est identifie par un code unique sur le site.
 * Le statut evolue : ACTIF → REFORME | MORT.
 */
export interface Reproducteur {
  id: string;
  /** Code unique du reproducteur sur le site (ex: "REP-F-001") */
  code: string;
  sexe: SexeReproducteur;
  /** Poids en grammes */
  poids: number;
  /** Age en mois (nullable si inconnu) */
  age: number | null;
  /** Provenance du reproducteur (ecloserie, peche, etc.) */
  origine: string | null;
  statut: StatutReproducteur;
  dateAcquisition: Date;
  notes: string | null;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Reproducteur avec ses relations et compteurs de pontes */
export interface ReproducteurWithRelations extends Reproducteur {
  site?: Site;
  _count?: {
    /** Nombre de pontes ou il est intervenu comme femelle */
    pontesAsFemelle: number;
    /** Nombre de pontes ou il est intervenu comme male */
    pontesAsMale: number;
  };
}

/**
 * Ponte — evenement de reproduction entre une femelle et un male optionnel.
 *
 * Une ponte genere un ou plusieurs lots d'alevins.
 * Le taux de fecondation est en pourcentage (0-100).
 */
export interface Ponte {
  id: string;
  /** Code unique de la ponte sur le site (ex: "PONTE-2026-001") */
  code: string;
  /** ID de la femelle reproductrice */
  femelleId: string;
  /** ID du male reproducteur (nullable si insemination naturelle sans male identifie) */
  maleId: string | null;
  datePonte: Date;
  /** Nombre d'oeufs pondus (nullable si non compte) */
  nombreOeufs: number | null;
  /** Taux de fecondation en pourcentage (nullable si non mesure) */
  tauxFecondation: number | null;
  statut: StatutPonte;
  notes: string | null;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Ponte avec ses relations chargees */
export interface PonteWithRelations extends Ponte {
  femelle?: Reproducteur;
  male?: Reproducteur | null;
  lots?: LotAlevins[];
  _count?: { lots: number };
}

/**
 * LotAlevins — lot d'alevins issus d'une ponte, suivi jusqu'au transfert.
 *
 * Un lot peut etre place dans un bac d'incubation/elevage (bacId)
 * puis transfere vers une vague de grossissement (vagueDestinationId).
 * La date de transfert est renseignee quand statut = TRANSFERE.
 */
export interface LotAlevins {
  id: string;
  /** Code unique du lot sur le site (ex: "LOT-2026-001") */
  code: string;
  /** ID de la ponte d'origine */
  ponteId: string;
  /** Nombre d'alevins au debut du lot */
  nombreInitial: number;
  /** Nombre d'alevins actuellement vivants */
  nombreActuel: number;
  /** Age du lot en jours depuis la ponte */
  ageJours: number;
  /** Poids moyen des alevins en grammes (nullable si non mesure) */
  poidsMoyen: number | null;
  statut: StatutLotAlevins;
  /** Bac d'elevage actuel (nullable si pas encore assigne) */
  bacId: string | null;
  /** Vague de destination apres transfert (nullable si pas encore transfere) */
  vagueDestinationId: string | null;
  /** Date du transfert vers la vague (null si pas encore transfere) */
  dateTransfert: Date | null;
  notes: string | null;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** LotAlevins avec ses relations chargees */
export interface LotAlevinsWithRelations extends LotAlevins {
  ponte?: Ponte;
  bac?: Bac | null;
  vagueDestination?: Vague | null;
}

// ---------------------------------------------------------------------------
// Enums — Alertes
// ---------------------------------------------------------------------------

/** Type d'alerte declenchee par le systeme ou configuree manuellement */
export enum TypeAlerte {
  MORTALITE_ELEVEE = "MORTALITE_ELEVEE",
  QUALITE_EAU = "QUALITE_EAU",
  STOCK_BAS = "STOCK_BAS",
  RAPPEL_ALIMENTATION = "RAPPEL_ALIMENTATION",
  RAPPEL_BIOMETRIE = "RAPPEL_BIOMETRIE",
  PERSONNALISEE = "PERSONNALISEE",
  /** Besoin en retard : dateLimite depassee avec statut SOUMISE ou APPROUVEE (ADR-017.2) */
  BESOIN_EN_RETARD = "BESOIN_EN_RETARD",
  /** Densite biomasse/volume elevee pour ce type de systeme de bac — Sprint 27-28 (ADR-density-alerts) */
  DENSITE_ELEVEE = "DENSITE_ELEVEE",
  /** Taux de renouvellement effectif insuffisant pour la densite actuelle — Sprint 27-28 */
  RENOUVELLEMENT_EAU_INSUFFISANT = "RENOUVELLEMENT_EAU_INSUFFISANT",
  /** Aucun releve qualite eau depuis N jours avec densite elevee — Sprint 27-28 */
  AUCUN_RELEVE_QUALITE_EAU = "AUCUN_RELEVE_QUALITE_EAU",
  /** Combinaison : densite elevee ET qualite eau degradee simultanement — Sprint 27-28 */
  DENSITE_CRITIQUE_QUALITE_EAU = "DENSITE_CRITIQUE_QUALITE_EAU",
}

/** Statut du cycle de vie d'une notification */
export enum StatutAlerte {
  ACTIVE = "ACTIVE",
  LUE = "LUE",
  TRAITEE = "TRAITEE",
}

/**
 * SeveriteAlerte — Niveau de gravite d'une notification pour le tri visuel.
 *
 * Stocke sur le champ Notification.severite.
 * Permet au composant mobile d'afficher les couleurs et icones adaptes.
 * Sprint 27-28 (ADR-density-alerts, section 5.9)
 */
export enum SeveriteAlerte {
  INFO = "INFO",
  AVERTISSEMENT = "AVERTISSEMENT",
  CRITIQUE = "CRITIQUE",
}

// ---------------------------------------------------------------------------
// Enums — Planning
// ---------------------------------------------------------------------------

/** Type d'activite planifiee dans le calendrier */
export enum TypeActivite {
  ALIMENTATION = "ALIMENTATION",
  BIOMETRIE = "BIOMETRIE",
  QUALITE_EAU = "QUALITE_EAU",
  COMPTAGE = "COMPTAGE",
  NETTOYAGE = "NETTOYAGE",
  TRAITEMENT = "TRAITEMENT",
  RECOLTE = "RECOLTE",
  TRI = "TRI",
  MEDICATION = "MEDICATION",
  /** Renouvellement d'eau d'un bac — genere par les regles de densite — Sprint 27-28 (ADR-density-alerts) */
  RENOUVELLEMENT = "RENOUVELLEMENT",
  AUTRE = "AUTRE",
}

/** Statut d'execution d'une activite planifiee */
export enum StatutActivite {
  PLANIFIEE = "PLANIFIEE",
  TERMINEE = "TERMINEE",
  ANNULEE = "ANNULEE",
  EN_RETARD = "EN_RETARD",
}

/** Periodicite de recurrence d'une activite */
export enum Recurrence {
  QUOTIDIEN = "QUOTIDIEN",
  HEBDOMADAIRE = "HEBDOMADAIRE",
  BIMENSUEL = "BIMENSUEL",
  MENSUEL = "MENSUEL",
  PERSONNALISE = "PERSONNALISE",
}

// ---------------------------------------------------------------------------
// Modeles — Alertes
// ---------------------------------------------------------------------------

/**
 * ConfigAlerte — regle de declenchement d'alerte configuree par un utilisateur.
 *
 * Chaque regle est scoped par siteId (R8) et par userId.
 * seuilValeur et seuilPourcentage sont mutuellement exclusifs selon le typeAlerte.
 */
export interface ConfigAlerte {
  id: string;
  typeAlerte: TypeAlerte;
  /** Valeur absolue de declenchement (ex: nb morts, niveau stock) — null si seuil en % */
  seuilValeur: number | null;
  /** Pourcentage de declenchement (ex: taux mortalite) — null si seuil absolu */
  seuilPourcentage: number | null;
  /** Alerte active ou suspendue */
  enabled: boolean;
  /** Utilisateur ayant configure cette regle */
  userId: string;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** ConfigAlerte avec sa relation user chargee */
export interface ConfigAlerteWithRelations extends ConfigAlerte {
  user?: User;
}

/**
 * Notification — alerte envoyee a un utilisateur.
 *
 * Generee automatiquement par le systeme ou manuellement.
 * Le statut evolue : ACTIVE → LUE → TRAITEE.
 * lien est une URL relative vers la ressource concernee (ex: "/vagues/[id]").
 */
export interface Notification {
  id: string;
  typeAlerte: TypeAlerte;
  /** Titre court de la notification */
  titre: string;
  /** Message detaille */
  message: string;
  statut: StatutAlerte;
  /** URL relative vers la ressource concernee (null si pas de lien) */
  lien: string | null;
  /**
   * Action directe recommandee — null si notification informative seulement.
   * Stocke en JSON (type NotificationActionPayload dans src/types/notifications.ts).
   * Le composant mobile l'utilise pour afficher un bouton CTA avec texte traduit.
   * Sprint 27-28 (ADR-density-alerts, section 5.9)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actionPayload: Record<string, any> | null;
  /**
   * Severite de l'alerte pour le tri visuel et la priorite d'affichage.
   * Defaut: INFO. Sprint 27-28 (ADR-density-alerts, section 5.9)
   */
  severite: SeveriteAlerte;
  /** Utilisateur destinataire */
  userId: string;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
}

/** Notification avec sa relation user chargee */
export interface NotificationWithRelations extends Notification {
  user?: User;
}

// ---------------------------------------------------------------------------
// Modeles — Planning
// ---------------------------------------------------------------------------

/**
 * Activite — tache planifiee dans le calendrier de la ferme.
 *
 * Une activite peut etre associee a une vague ou a un bac specifique.
 * Elle peut etre assignee a un membre du site (assigneAId).
 * La recurrence determine si l'activite se repete.
 */
export interface Activite {
  id: string;
  /** Intitule court de l'activite */
  titre: string;
  /** Description detaillee (nullable) */
  description: string | null;
  typeActivite: TypeActivite;
  statut: StatutActivite;
  /** Date et heure de debut */
  dateDebut: Date;
  /** Date et heure de fin (nullable si duree indeterminee) */
  dateFin: Date | null;
  /** Periodicite de recurrence (null si activite ponctuelle) */
  recurrence: Recurrence | null;
  /** Vague associee (nullable) */
  vagueId: string | null;
  /** Bac associe (nullable) */
  bacId: string | null;
  /** Membre du site a qui l'activite est assignee (nullable) */
  assigneAId: string | null;
  /** Utilisateur ayant cree l'activite */
  userId: string;
  /** ID du site (ferme) — R8 */
  siteId: string;
  /** Releve lie a cette activite (null si aucun releve n'a complete cette activite) — relation 1:1 optionnelle */
  releveId: string | null;
  /** Date a laquelle l'activite a ete marquee TERMINEE (null si pas encore terminee) */
  dateTerminee: Date | null;
  /** Note obligatoire pour les types non-releve lors de la completion */
  noteCompletion: string | null;
  // ---- Champs Sprint 21 — Moteur de regles ----
  /** ID de la regle ayant genere cette activite (null si creee manuellement) */
  regleId: string | null;
  /** Instructions detaillees affichees au pisciculteur lors de l'execution */
  instructionsDetaillees: string | null;
  /** Conseil contextuel genere par le moteur IA (ex: "Augmenter la ration car FCR > 1.8") */
  conseilIA: string | null;
  /** Produit recommande pour cette activite (null si non applicable) */
  produitRecommandeId: string | null;
  /** Quantite recommandee du produit en unite du produit (null si non applicable) */
  quantiteRecommandee: number | null;
  /** Priorite de 1 (basse) a 3 (critique) — defaut 1 */
  priorite: number;
  /** True si l'activite a ete generee automatiquement par le moteur de regles */
  isAutoGenerated: boolean;
  /** Phase d'elevage au moment de la generation (null si non calculable) */
  phaseElevage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Activite avec ses relations chargees */
export interface ActiviteWithRelations extends Activite {
  vague?: Vague | null;
  bac?: Bac | null;
  assigneA?: User | null;
  user?: User;
  /** Releve lie a cette activite (present si inclus par la query) */
  releve?: Releve | null;
  /** Regle a l'origine de cette activite (presente si auto-generee) */
  regle?: RegleActivite | null;
  /**
   * Produit recommande (present si produitRecommandeId renseigne).
   * Inclut stockActuel, uniteAchat et contenance pour les recommandations d'alimentation (S16-4).
   */
  produitRecommande?: Pick<Produit, "id" | "nom" | "unite" | "uniteAchat" | "contenance" | "stockActuel"> | null;
}

// ---------------------------------------------------------------------------
// Enums & Modeles — Moteur de regles d'activites (Sprint 21 + 27-28)
// ---------------------------------------------------------------------------

/**
 * OperateurCondition — Operateur de comparaison utilise dans une ConditionRegle.
 *
 * Semantique :
 * - SUPERIEUR : valeur > conditionValeur
 * - INFERIEUR : valeur < conditionValeur
 * - ENTRE     : conditionValeur <= valeur <= conditionValeur2
 * - EGAL      : valeur == conditionValeur
 *
 * Sprint 27-28 (ADR-density-alerts, section 5.5)
 */
export enum OperateurCondition {
  SUPERIEUR = "SUPERIEUR",
  INFERIEUR = "INFERIEUR",
  ENTRE = "ENTRE",
  EGAL = "EGAL",
}

/**
 * LogiqueCondition — Logique de combinaison des conditions d'une RegleActivite.
 *
 * - ET : TOUTES les ConditionRegle doivent matcher
 * - OU : AU MOINS UNE ConditionRegle doit matcher
 *
 * Sprint 27-28 (ADR-density-alerts, section 5.5)
 */
export enum LogiqueCondition {
  ET = "ET",
  OU = "OU",
}

/**
 * TypeDeclencheur — Condition qui active une regle d'activite.
 *
 * Les declencheurs de type SEUIL_* et FCR_ELEVE utilisent des valeurs numeriques
 * definies dans les champs seuilDeclencheur / comparaison de RegleActivite.
 * Les declencheurs CALENDRIER et RECURRENT utilisent les champs
 * intervalleJours / jourDeclenchement.
 */
export enum TypeDeclencheur {
  /** Activite planifiee a une date fixe (ex: debut de cycle J+0) */
  CALENDRIER = "CALENDRIER",
  /** Activite recurrente toutes les N jours depuis le debut de la vague */
  RECURRENT = "RECURRENT",
  /** Declenchee quand le poids moyen depasse un seuil en grammes */
  SEUIL_POIDS = "SEUIL_POIDS",
  /** Declenchee quand un parametre qualite eau sort de la plage optimale */
  SEUIL_QUALITE = "SEUIL_QUALITE",
  /** Declenchee quand le taux de mortalite cumulee depasse un seuil en % */
  SEUIL_MORTALITE = "SEUIL_MORTALITE",
  /** Declenchee quand le stock d'un produit passe sous le seuil d'alerte */
  STOCK_BAS = "STOCK_BAS",
  /** Declenchee quand le FCR depasse un seuil configure */
  FCR_ELEVE = "FCR_ELEVE",
  /** Declenchee a une etape cle du cycle d'elevage (ex: passage en phase GROSSISSEMENT) */
  JALON = "JALON",
  /** Declenchee quand la biomasse kg/m3 du bac depasse conditionValeur — Sprint 27-28 (ADR-density-alerts) */
  SEUIL_DENSITE = "SEUIL_DENSITE",
  /** Declenchee quand le taux de renouvellement %/jour du bac est sous conditionValeur — Sprint 27-28 */
  SEUIL_RENOUVELLEMENT = "SEUIL_RENOUVELLEMENT",
  /** Declenchee quand aucun releve d'un type donne n'est enregistre depuis N jours — Sprint 27-28 */
  ABSENCE_RELEVE = "ABSENCE_RELEVE",
  /** Declenchee quand le taux d'ammoniac depasse conditionValeur (mg/L) */
  SEUIL_AMMONIAC = "SEUIL_AMMONIAC",
  /** Declenchee quand le taux d'oxygene dissous passe sous conditionValeur (mg/L) */
  SEUIL_OXYGENE = "SEUIL_OXYGENE",
  /** Declenchee quand le pH sort de la plage optimale selon conditionValeur (min) / conditionValeur2 (max) */
  SEUIL_PH = "SEUIL_PH",
  /** Declenchee quand la temperature sort de la plage optimale selon conditionValeur (min) / conditionValeur2 (max) */
  SEUIL_TEMPERATURE = "SEUIL_TEMPERATURE",
}

/**
 * RegleActivite — Modele de regle utilisee par le moteur pour generer
 * automatiquement des activites sur les vagues actives.
 *
 * Chaque regle decrit QUAND generer une activite (typeDeclencheur + parametres)
 * et QUOI creer (typeActivite, titreTemplate, instructionsTemplate, ...).
 */
export interface RegleActivite {
  id: string;
  /** Libelle descriptif de la regle (ex: "Biometrie hebdomadaire Phase Grossissement") */
  nom: string;
  /** Description detaillee a destination des administrateurs (nullable) */
  description: string | null;
  /** Type d'activite a generer */
  typeActivite: TypeActivite;
  /** Condition de declenchement */
  typeDeclencheur: TypeDeclencheur;

  // ---- Parametres declencheur seuil ----
  /** Valeur numerique primaire du seuil (semantique selon typeDeclencheur) */
  conditionValeur: number | null;
  /** Valeur numerique secondaire — ex: pH max pour SEUIL_QUALITE */
  conditionValeur2: number | null;

  // ---- Filtres de phase ----
  /** Phase d'elevage minimale cible (null = toutes les phases depuis le debut) */
  phaseMin: PhaseElevage | null;
  /** Phase d'elevage maximale cible (null = borne haute non contrainte) */
  phaseMax: PhaseElevage | null;

  // ---- Parametres declencheur recurrent ----
  /** Intervalle en jours pour RECURRENT (ex: 7 = hebdomadaire) — null si non applicable */
  intervalleJours: number | null;

  // ---- Contenu de l'activite a generer ----
  /**
   * Titre avec placeholders Mustache.
   * Ex: "Biometrie J{{semaine}} — {{taille}}"
   * Voir TemplatePlaceholders dans activity-engine.ts
   */
  titreTemplate: string;
  /** Template de description courte de l'activite generee (nullable) */
  descriptionTemplate: string | null;
  /**
   * Instructions detaillees avec placeholders.
   * Ex: "Peser {{quantite_calculee}} kg d'aliment pour {{nombreVivants}} poissons."
   */
  instructionsTemplate: string | null;
  /** Priorite des activites generees (1=haute, 10=basse) — defaut 5 */
  priorite: number;

  /** Regle active (false = ignoree par le moteur) */
  isActive: boolean;
  /**
   * One-shot pour les seuils — desactive automatiquement apres premier declenchement (EC-3.2).
   * false = regle peut se redeclencher, true = deja declenchee une fois.
   */
  firedOnce: boolean;

  /** ID du site proprietaire — null = regle globale DKFarm (F-15) */
  siteId: string | null;
  /** Utilisateur ayant cree la regle (nullable si regle systeme) */
  userId: string | null;

  // ---- Conditions composees (Sprint 27-28, ADR-density-alerts, section 5.5) ----
  /**
   * Conditions composees de cette regle.
   * Si vide (length == 0), le moteur utilise le legacy typeDeclencheur + conditionValeur.
   * Si non vide, le moteur evalue les conditions avec la logique ET/OU.
   * Backward compatible : les regles existantes ont conditions = [].
   */
  conditions: ConditionRegle[];
  /**
   * Logique de combinaison des conditions composees.
   * ET (defaut) : toutes les conditions doivent matcher.
   * OU : au moins une condition doit matcher.
   * Ignoree si conditions est vide.
   */
  logique: LogiqueCondition;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * ConditionRegle — Condition atomique d'une RegleActivite.
 *
 * Une regle peut avoir plusieurs conditions evaluees collectivement
 * selon la logique ET/OU definie sur la regle parente.
 *
 * Backward compatibility : les regles legacy (conditions=[]) continuent
 * d'utiliser le champ typeDeclencheur de RegleActivite directement.
 *
 * Sprint 27-28 (ADR-density-alerts, section 5.5)
 */
export interface ConditionRegle {
  id: string;
  /** ID de la regle parente */
  regleId: string;
  /** Type de valeur contextuelle a evaluer */
  typeDeclencheur: TypeDeclencheur;
  /** Operateur de comparaison */
  operateur: OperateurCondition;
  /** Valeur primaire de la condition (null = match toujours pour ce type) */
  conditionValeur: number | null;
  /** Valeur secondaire — utilisee uniquement par l'operateur ENTRE comme borne haute */
  conditionValeur2: number | null;
  /** Ordre d'evaluation (ascendant) pour les conditions composees */
  ordre: number;
}

/** RegleActivite avec ses relations chargees */
export interface RegleActiviteWithRelations extends RegleActivite {
  site?: Pick<Site, "id" | "name"> | null;
  user?: Pick<User, "id" | "name"> | null;
  activites?: Pick<Activite, "id" | "titre" | "statut" | "dateDebut">[];
  _count?: { activites: number };
}

/**
 * RegleActivite avec le compteur d'activites generees.
 *
 * Utilise dans la liste des regles pour afficher le nombre d'activites
 * generees sans charger toute la relation activites.
 *
 * Correspond au select Prisma `{ _count: { select: { activites: true } } }`.
 */
export interface RegleActiviteWithCount extends RegleActivite {
  _count: { activites: number };
}

// ---------------------------------------------------------------------------
// Enums — Depenses (Sprint 16)
// ---------------------------------------------------------------------------

/** Categorie d'une depense operationnelle */
export enum CategorieDepense {
  ALIMENT = "ALIMENT",
  INTRANT = "INTRANT",
  EQUIPEMENT = "EQUIPEMENT",
  ELECTRICITE = "ELECTRICITE",
  EAU = "EAU",
  LOYER = "LOYER",
  SALAIRE = "SALAIRE",
  TRANSPORT = "TRANSPORT",
  VETERINAIRE = "VETERINAIRE",
  REPARATION = "REPARATION",
  INVESTISSEMENT = "INVESTISSEMENT",
  AUTRE = "AUTRE",
}

/** Statut de paiement d'une depense */
export enum StatutDepense {
  NON_PAYEE = "NON_PAYEE",
  PAYEE_PARTIELLEMENT = "PAYEE_PARTIELLEMENT",
  PAYEE = "PAYEE",
}

/** Frequence de recurrence d'une depense periodique */
export enum FrequenceRecurrence {
  MENSUEL = "MENSUEL",
  TRIMESTRIEL = "TRIMESTRIEL",
  ANNUEL = "ANNUEL",
}

// ---------------------------------------------------------------------------
// Enums — Besoins (Sprint 17)
// ---------------------------------------------------------------------------

/** Statut du workflow d'une liste de besoins */
export enum StatutBesoins {
  SOUMISE = "SOUMISE",
  APPROUVEE = "APPROUVEE",
  TRAITEE = "TRAITEE",
  CLOTUREE = "CLOTUREE",
  REJETEE = "REJETEE",
}

// ---------------------------------------------------------------------------
// Modeles — Depenses (Sprint 16)
// ---------------------------------------------------------------------------

/**
 * Depense — charge operationnelle de la ferme.
 *
 * Peut etre liee a une Commande (auto-creee a la reception),
 * a une Vague (charges specifiques a un lot de poissons),
 * ou etre autonome (loyer, salaire, electricite...).
 *
 * Le pattern de paiement partiel est identique a Facture/Paiement.
 */
export interface Depense {
  id: string;
  /** Numero auto-genere format DEP-YYYY-NNN */
  numero: string;
  /** Description de la depense */
  description: string;
  /** Categorie operationnelle */
  categorieDepense: CategorieDepense;
  /** Montant total de la depense */
  montantTotal: number;
  /** Montant deja paye (recalcule par aggregation) */
  montantPaye: number;
  /** Statut de paiement (NON_PAYEE → PAYEE_PARTIELLEMENT → PAYEE) */
  statut: StatutDepense;
  /** Date de la depense */
  date: Date;
  /** Date d'echeance de paiement (nullable) */
  dateEcheance: Date | null;
  /** URL facture fournisseur sur Hetzner Object Storage (nullable) */
  factureUrl: string | null;
  /** Notes libres */
  notes: string | null;
  /** Commande d'origine si auto-creee a la reception (nullable) */
  commandeId: string | null;
  /** Vague concernee (nullable) */
  vagueId: string | null;
  /** Liste de besoins d'origine (nullable) */
  listeBesoinsId: string | null;
  /** Utilisateur ayant cree la depense */
  userId: string;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Depense avec ses relations chargees */
export interface DepenseWithRelations extends Depense {
  commande?: Commande | null;
  vague?: Vague | null;
  listeBesoins?: ListeBesoins | null;
  user?: User;
  paiements?: PaiementDepense[];
}

/**
 * PaiementDepense — paiement partiel ou total d'une depense.
 *
 * Meme structure que Paiement (pour Facture), avec mode ModePaiement reutilise.
 * La suppression d'une Depense supprime en cascade ses PaiementDepense.
 */
export interface PaiementDepense {
  id: string;
  /** Depense concernee */
  depenseId: string;
  /** Montant du paiement */
  montant: number;
  /** Mode de paiement */
  mode: ModePaiement;
  /** Reference de transaction (nullable) */
  reference: string | null;
  /** Date du paiement */
  date: Date;
  /** Utilisateur ayant enregistre le paiement */
  userId: string;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Modeles — Depenses Recurrentes (Sprint 18)
// ---------------------------------------------------------------------------

/**
 * DepenseRecurrente — template pour la generation automatique de depenses.
 *
 * La generation est idempotente : une seule Depense est creee par periode
 * (mois/trimestre/annee) en se basant sur derniereGeneration.
 * jourDuMois est contraint entre 1 et 28 (evite les problemes fin de mois).
 */
export interface DepenseRecurrente {
  id: string;
  description: string;
  categorieDepense: CategorieDepense;
  montantEstime: number;
  frequence: FrequenceRecurrence;
  /** Jour du mois de generation (1-28) */
  jourDuMois: number;
  isActive: boolean;
  derniereGeneration: Date | null;
  userId: string;
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** DepenseRecurrente avec ses relations chargees */
export interface DepenseRecurrenteWithRelations extends DepenseRecurrente {
  user: { id: string; name: string };
}

// ---------------------------------------------------------------------------
// Modeles — Besoins (Sprint 17)
// ---------------------------------------------------------------------------

/**
 * ListeBesoins — demande formelle de biens ou services par un agent de la ferme.
 *
 * Workflow : SOUMISE → APPROUVEE → TRAITEE → CLOTUREE
 *                  └──────────────────────→ REJETEE
 *
 * Le demandeur soumet une liste, le valideur l'approuve ou la rejette.
 * Le traitement genere des Commandes (pour les produits en stock) et des Depenses.
 * La cloture enregistre les prix reels.
 */
export interface ListeBesoins {
  id: string;
  /** Numero auto-genere format BES-YYYY-NNN */
  numero: string;
  /** Intitule de la demande */
  titre: string;
  /** Utilisateur ayant soumis la demande */
  demandeurId: string;
  /** Utilisateur ayant approuve ou rejete la demande (nullable) */
  valideurId: string | null;
  /** Vague concernee (nullable) */
  vagueId: string | null;
  /** Statut du workflow */
  statut: StatutBesoins;
  /** Montant total estime (SUM quantite * prixEstime) */
  montantEstime: number;
  /** Montant total reel apres cloture (nullable) */
  montantReel: number | null;
  /** Motif de rejet (nullable, rempli si REJETEE) */
  motifRejet: string | null;
  /** Notes libres */
  notes: string | null;
  /** Date limite de traitement (nullable — ADR-017.2) */
  dateLimite: Date | null;
  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** ListeBesoins avec ses relations chargees */
export interface ListeBesoinsWithRelations extends ListeBesoins {
  demandeur?: User;
  valideur?: User | null;
  vague?: Vague | null;
  lignes?: LigneBesoin[];
  depenses?: Depense[];
  _count?: { lignes: number };
}

/**
 * LigneBesoin — article individuel dans une liste de besoins.
 *
 * Peut etre lie a un produit en stock (produitId) ou libre (designation seule).
 * commandeId est rempli lors du traitement si une commande a ete generee.
 * prixReel est rempli lors de la cloture.
 */
export interface LigneBesoin {
  id: string;
  /** ID de la liste de besoins parente */
  listeBesoinsId: string;
  /** Designation libre de l'article */
  designation: string;
  /** Produit en stock lie (nullable — libre si null) */
  produitId: string | null;
  /** Quantite demandee */
  quantite: number;
  /** Unite libre (nullable si produit avec unite definie) */
  unite: string | null;
  /** Prix unitaire estime */
  prixEstime: number;
  /** Prix unitaire reel apres cloture (nullable) */
  prixReel: number | null;
  /** Commande generee lors du traitement (nullable) */
  commandeId: string | null;
  createdAt: Date;
}

/** LigneBesoin avec ses relations chargees */
export interface LigneBesoinWithRelations extends LigneBesoin {
  produit?: Produit | null;
  commande?: Commande | null;
}

// ---------------------------------------------------------------------------
// Enums — Phase 3 : ConfigElevage (Sprint 19)
// ---------------------------------------------------------------------------

/** Phase de croissance d'un lot de Clarias gariepinus */
export enum PhaseElevage {
  ACCLIMATATION = "ACCLIMATATION",
  CROISSANCE_DEBUT = "CROISSANCE_DEBUT",
  JUVENILE = "JUVENILE",
  GROSSISSEMENT = "GROSSISSEMENT",
  FINITION = "FINITION",
  PRE_RECOLTE = "PRE_RECOLTE",
}

// ---------------------------------------------------------------------------
// Enums — Phase 3 : Packs & Provisioning (Sprint 20)
// ---------------------------------------------------------------------------

/** Statut d'une activation de pack pour un client */
export enum StatutActivation {
  ACTIVE = "ACTIVE",
  EXPIREE = "EXPIREE",
  SUSPENDUE = "SUSPENDUE",
}

// ---------------------------------------------------------------------------
// Types JSON — alimentTailleConfig et alimentTauxConfig
// ---------------------------------------------------------------------------

/** Une entree dans alimentTailleConfig : taille de granule pour une plage de poids */
export interface AlimentTailleEntree {
  /** Poids minimum (g, inclus) */
  poidsMin: number;
  /** Poids maximum (g, exclus sauf pour la derniere entree) */
  poidsMax: number;
  /** Taille du granule — ex: "1.2mm", "2-3mm" */
  tailleGranule: string;
  /** Description optionnelle — ex: "Aliment demarrage" */
  description?: string;
  /** Taux de proteines (%) — optionnel */
  proteines?: number;
}

/** Une entree dans alimentTauxConfig : taux d'alimentation pour une phase */
export interface AlimentTauxEntree {
  /** Phase de croissance concernee */
  phase: PhaseElevage;
  /** Taux minimum (%BW/jour) */
  tauxMin: number;
  /** Taux maximum (%BW/jour) */
  tauxMax: number;
  /** Nombre de distributions par jour */
  frequence: number;
  /** Notes optionnelles — ex: "3-4 distributions/jour" */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Modeles — ConfigElevage (Sprint 19)
// ---------------------------------------------------------------------------

/**
 * ConfigElevage — Parametres configurables par site pour piloter le moteur d'elevage.
 *
 * Miroir exact du modele Prisma ConfigElevage.
 * Chaque site peut avoir plusieurs profils. Un seul peut etre isDefault=true par site.
 * Les valeurs par defaut correspondent aux benchmarks FAO pour Clarias gariepinus.
 */
export interface ConfigElevage {
  id: string;
  /** Nom du profil — ex: "Clarias Standard Cameroun" */
  nom: string;
  description: string | null;

  // Objectif de production
  poidsObjectif: number;
  dureeEstimeeCycle: number;
  tauxSurvieObjectif: number;

  // Seuils de phases (poids en g)
  seuilAcclimatation: number;
  seuilCroissanceDebut: number;
  seuilJuvenile: number;
  seuilGrossissement: number;
  seuilFinition: number;

  // JSON configs
  alimentTailleConfig: AlimentTailleEntree[];
  alimentTauxConfig: AlimentTauxEntree[];

  // Benchmarks FCR (lower is better)
  fcrExcellentMax: number;
  fcrBonMax: number;
  fcrAcceptableMax: number;

  // Benchmarks SGR (higher is better)
  sgrExcellentMin: number;
  sgrBonMin: number;
  sgrAcceptableMin: number;

  // Benchmarks Survie (%)
  survieExcellentMin: number;
  survieBonMin: number;
  survieAcceptableMin: number;

  // Benchmarks Densite (lower is better)
  densiteExcellentMax: number;
  densiteBonMax: number;
  densiteAcceptableMax: number;

  // Benchmarks Mortalite cumulative (lower is better)
  mortaliteExcellentMax: number;
  mortaliteBonMax: number;
  mortaliteAcceptableMax: number;

  // Qualite eau
  phMin: number;
  phMax: number;
  phOptimalMin: number;
  phOptimalMax: number;
  temperatureMin: number;
  temperatureMax: number;
  temperatureOptimalMin: number;
  temperatureOptimalMax: number;
  oxygeneMin: number;
  oxygeneAlerte: number;
  oxygeneOptimal: number;
  ammoniacMax: number;
  ammoniacAlerte: number;
  ammoniacOptimal: number;
  nitriteMax: number;
  nitriteAlerte: number;

  // Mortalite alertes
  mortaliteQuotidienneAlerte: number;
  mortaliteQuotidienneCritique: number;

  // Alimentation alertes
  fcrAlerteMax: number;
  stockJoursAlerte: number;

  // Tri
  triPoidsMin: number;
  triPoidsMax: number;
  triIntervalleJours: number;

  // Biometrie
  biometrieIntervalleDebut: number;
  biometrieIntervalleFin: number;
  biometrieEchantillonPct: number;

  // Changement d'eau
  eauChangementPct: number;
  eauChangementIntervalleJours: number;

  // Densite d'elevage
  densiteMaxPoissonsM3: number;
  densiteOptimalePoissonsM3: number;

  // Seuils de densite differencies par type de systeme (kg/m3) — Sprint 27-28 (ADR-density-alerts, 5.7)
  // Utilises par le composant bac-densite-badge.tsx pour le coloriage vert/orange/rouge
  /** Seuil d'alerte (orange) pour bacs beton et plastique — defaut: 150 kg/m3 */
  densiteBacBetonAlerte: number;
  /** Seuil critique (rouge) pour bacs beton et plastique — defaut: 200 kg/m3 */
  densiteBacBetonCritique: number;
  /** Seuil d'alerte (orange) pour etangs en terre — defaut: 30 kg/m3 */
  densiteEtangAlerte: number;
  /** Seuil critique (rouge) pour etangs en terre — defaut: 40 kg/m3 */
  densiteEtangCritique: number;
  /** Seuil d'alerte (orange) pour systemes RAS — defaut: 350 kg/m3 */
  densiteRasAlerte: number;
  /** Seuil critique (rouge) pour systemes RAS — defaut: 500 kg/m3 */
  densiteRasCritique: number;
  /**
   * Fenetre temporelle en jours pour le calcul du taux de renouvellement effectif.
   * Utilisee par le context builder pour calculer tauxRenouvellementPctJour.
   * Defaut: 7 jours. Configurable par site selon l'intensite de l'elevage.
   */
  fenetreRenouvellementJours: number;

  // Recolte
  recoltePartiellePoidsSeuil: number;
  recolteJeuneAvantJours: number;

  // Metadonnees
  /** Profil par defaut du site (un seul isDefault=true par site) */
  isDefault: boolean;
  isActive: boolean;

  /** ID du site (ferme) — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** ConfigElevage avec ses relations chargees */
export interface ConfigElevageWithRelations extends ConfigElevage {
  site?: Pick<Site, "id" | "name">;
}

// ---------------------------------------------------------------------------
// Modèles — Phase 3 : Packs & Provisioning (Sprint 20)
// ---------------------------------------------------------------------------

/**
 * Pack — Kit de demarrage vendu aux clients pisciculteurs.
 * Basé sur la section 3.2 du REQ-STARTER-PACKS.md.
 */
export interface Pack {
  id: string;
  /** Nom commercial du pack — ex: "Starter 300" */
  nom: string;
  description: string | null;
  /** Nombre d'alevins fournis (> 0) */
  nombreAlevins: number;
  /** Poids moyen initial des alevins (g) */
  poidsMoyenInitial: number;
  /** Prix total du pack en FCFA (>= 0) */
  prixTotal: number;
  /** ConfigElevage recommandée pour ce pack (nullable) */
  configElevageId: string | null;
  isActive: boolean;
  /** Modules activés pour les sites provisionnés via ce pack */
  enabledModules: SiteModule[];
  /** Créateur du pack (ADMIN DKFarm) */
  userId: string;
  /** Site DKFarm propriétaire du pack — R8 */
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Pack avec ses relations chargées */
export interface PackWithRelations extends Pack {
  configElevage?: Pick<ConfigElevage, "id" | "nom"> | null;
  user?: Pick<User, "id" | "name">;
  produits?: PackProduit[];
  bacs?: PackBac[];
  _count?: { activations: number };
}

/**
 * PackBac — Configuration d'un bac pré-défini dans un Pack.
 * Chaque bac sera créé lors du provisioning.
 */
export interface PackBac {
  id: string;
  packId: string;
  nom: string;
  volume: number | null;
  nombreAlevins: number;
  poidsMoyenInitial: number;
  position: number;
}

/**
 * PackProduit — Ligne de produit incluse dans un Pack.
 * @@unique([packId, produitId])
 */
export interface PackProduit {
  id: string;
  packId: string;
  produitId: string;
  /** Quantité incluse dans le pack (> 0) */
  quantite: number;
  unite: UniteStock | null;
}

/** PackProduit avec le produit chargé */
export interface PackProduitWithProduit extends PackProduit {
  produit: Pick<Produit, "id" | "nom" | "categorie" | "unite" | "prixUnitaire" | "stockActuel">;
}

/**
 * PackActivation — Enregistrement d'une vente de pack à un client.
 *
 * - siteId = site DKFarm vendeur (R8)
 * - clientSiteId = site client créé lors du provisioning
 * IMPORTANT : Pas d'unicité sur clientSiteId (un client peut acheter plusieurs packs — F-05)
 * IMPORTANT : Pas d'unicité sur vagueId dans les vagues liées (F-06)
 */
export interface PackActivation {
  id: string;
  /** Code ACT-YYYY-NNN */
  code: string;
  packId: string;
  /** Utilisateur ayant activé (ingénieur ou admin DKFarm) */
  userId: string;
  /** Site DKFarm vendeur — R8 */
  siteId: string;
  /** Site client créé lors du provisioning */
  clientSiteId: string;
  statut: StatutActivation;
  dateActivation: Date;
  dateExpiration: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** PackActivation avec ses relations chargées */
export interface PackActivationWithRelations extends PackActivation {
  pack?: Pick<Pack, "id" | "nom" | "nombreAlevins" | "prixTotal">;
  user?: Pick<User, "id" | "name">;
  clientSite?: Pick<Site, "id" | "name">;
  vagues?: Pick<Vague, "id" | "code" | "statut">[];
}

// ---------------------------------------------------------------------------
// Enums — Monitoring Ingénieur (Sprint 23)
// ---------------------------------------------------------------------------

/** Visibilite d'une note ingenieur : PUBLIC (visible client) ou INTERNE (DKFarm uniquement) */
export enum VisibiliteNote {
  PUBLIC = "PUBLIC",
  INTERNE = "INTERNE",
}

// ---------------------------------------------------------------------------
// Modeles — Monitoring Ingénieur (Sprint 23)
// ---------------------------------------------------------------------------

/**
 * NoteIngenieur — note ou observation envoyee par un ingenieur DKFarm vers un site client.
 *
 * Deux usages :
 * 1. Note de suivi (isFromClient=false) : l'ingenieur redige une note technique.
 *    visibility=PUBLIC → visible par le client ; visibility=INTERNE → usage interne DKFarm.
 * 2. Observation client (isFromClient=true) : le client remonte une observation
 *    via observationTexte. L'ingenieur peut ensuite repondre.
 *
 * Deux FK vers Site :
 * - siteId : site DKFarm de l'ingenieur (R8)
 * - clientSiteId : site client destinataire
 */
export interface NoteIngenieur {
  id: string;
  /** Titre court de la note */
  titre: string;
  /** Contenu en Markdown */
  contenu: string;
  /** Visibilite : PUBLIC (visible client) ou INTERNE (DKFarm uniquement) */
  visibility: VisibiliteNote;
  /** Note marquee comme urgente */
  isUrgent: boolean;
  /** Note lue par le destinataire */
  isRead: boolean;
  /** True si soumise par le client (observation) */
  isFromClient: boolean;
  /** Texte de l'observation client (nullable, utilise si isFromClient=true) */
  observationTexte: string | null;
  /** Ingenieur auteur */
  ingenieurId: string;
  /** Site client destinataire */
  clientSiteId: string;
  /** Vague concernee (nullable) */
  vagueId: string | null;
  /** Site DKFarm de l'ingenieur — R8 */
  siteId: string;
  /** ID de la note parente (thread one-level deep, nullable) */
  replyToId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** NoteIngenieur avec ses relations chargees */
export interface NoteIngenieurWithRelations extends NoteIngenieur {
  ingenieur?: Pick<User, "id" | "name">;
  clientSite?: Pick<Site, "id" | "name">;
  vague?: Pick<Vague, "id" | "code"> | null;
  site?: Pick<Site, "id" | "name">;
  replyTo?: Pick<NoteIngenieur, "id" | "titre"> | null;
  replies?: NoteIngenieurWithRelations[];
  _count?: { replies: number };
}

// ---------------------------------------------------------------------------
// Enums — Calibrage (Sprint 24)
// ---------------------------------------------------------------------------

/** Categorie de taille attribuee lors d'un calibrage */
export enum CategorieCalibrage {
  PETIT = "PETIT",
  MOYEN = "MOYEN",
  GROS = "GROS",
  TRES_GROS = "TRES_GROS",
}

// ---------------------------------------------------------------------------
// Modeles — Calibrage (Sprint 24)
// ---------------------------------------------------------------------------

/**
 * Calibrage — operation de tri et redistribution d'une vague dans plusieurs bacs.
 *
 * Les poissons sont sortis d'un ou plusieurs bacs sources, tries par taille/poids,
 * puis redistribues dans des bacs de destination selon leur categorie.
 * La mortalite constatee lors du calibrage est enregistree.
 * siteId est requis (R8).
 */
export interface Calibrage {
  id: string;
  /** Date de l'operation de calibrage */
  date: Date;
  /** Vague concernee */
  vagueId: string;
  /** IDs des bacs sources d'ou les poissons sont sortis */
  sourceBacIds: string[];
  /** Nombre de morts constates lors du calibrage */
  nombreMorts: number;
  /** Notes libres (nullable) */
  notes: string | null;
  /** ID du site (ferme) — R8 */
  siteId: string;
  /** Utilisateur ayant effectue le calibrage */
  userId: string;
  /** Flag rapide : true si ce calibrage a ete modifie apres creation (ADR-015) */
  modifie: boolean;
  /** Historique des modifications (charge en option) */
  modifications?: CalibrageModification[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * CalibrageGroupe — un groupe issu du calibrage, place dans un bac de destination.
 *
 * Chaque groupe correspond a une categorie de taille.
 * La suppression d'un Calibrage supprime en cascade ses CalibrageGroupe.
 */
export interface CalibrageGroupe {
  id: string;
  /** Calibrage auquel appartient ce groupe */
  calibrageId: string;
  /** Categorie de taille de ce groupe */
  categorie: CategorieCalibrage;
  /** Bac de destination ou ce groupe est place */
  destinationBacId: string;
  /** Nombre de poissons dans ce groupe */
  nombrePoissons: number;
  /** Poids moyen des poissons en grammes */
  poidsMoyen: number;
  /** Taille moyenne des poissons en cm (nullable) */
  tailleMoyenne: number | null;
  createdAt: Date;
}

/** Calibrage avec ses relations chargees */
export interface CalibrageWithRelations extends Calibrage {
  vague: { id: string; code: string };
  user: { id: string; name: string };
  groupes: (CalibrageGroupe & {
    destinationBac: { id: string; nom: string };
  })[];
}

// ---------------------------------------------------------------------------
// Modeles — Traçabilité modification de calibrage (Sprint 26, ADR-015)
// ---------------------------------------------------------------------------

/**
 * Trace d'une modification de calibrage avec raison d'audit.
 *
 * Granularite : une ligne par champ modifie.
 * Pour le champ "groupes" (complexe), ancienneValeur/nouvelleValeur contiennent du JSON serialise.
 */
export interface CalibrageModification {
  id:             string;
  calibrageId:    string;
  userId:         string;
  raison:         string;
  /** Nom du champ modifie : "nombreMorts" | "notes" | "groupes" */
  champModifie:   string;
  /** Valeur avant modification (null si le champ etait null/absent) */
  ancienneValeur: string | null;
  /** Valeur apres modification (null si efface) */
  nouvelleValeur: string | null;
  siteId:         string;
  createdAt:      Date;
}

/** CalibrageModification avec l'utilisateur denormalise (pour affichage) */
export interface CalibrageModificationWithUser extends CalibrageModification {
  user: {
    id:   string;
    name: string;
  };
}

/** Calibrage avec groupes, relations et historique complet de modifications */
export interface CalibrageWithModifications extends CalibrageWithRelations {
  modifications: CalibrageModificationWithUser[];
}

// ---------------------------------------------------------------------------
// Enums — CustomPlaceholder (Sprint 26)
// ---------------------------------------------------------------------------

/** Mode de resolution d'un placeholder : MAPPING (champ DB) ou FORMULA (calcul) */
export enum PlaceholderMode {
  MAPPING = "MAPPING",
  FORMULA = "FORMULA",
}

/** Format de la valeur resolue par un placeholder */
export enum PlaceholderFormat {
  NUMBER = "NUMBER",
  TEXT = "TEXT",
}

// ---------------------------------------------------------------------------
// Modele — CustomPlaceholder (Sprint 26)
// ---------------------------------------------------------------------------

/**
 * CustomPlaceholder — variable personnalisee utilisable dans les templates de regles d'activites.
 *
 * Deux modes :
 * - MAPPING : le placeholder pointe vers un champ de la base via sourcePath
 * - FORMULA : le placeholder est calcule via une expression mathematique (formula)
 *
 * Ces placeholders sont globaux (pas de siteId) — geres par DKFarm.
 */
export interface CustomPlaceholder {
  id: string;
  /** Cle unique — ex: "poids_moyen", "fcr_actuel" */
  key: string;
  /** Libelle affiche dans l'editeur de regles */
  label: string;
  /** Description de l'usage du placeholder (nullable) */
  description: string | null;
  /** Exemple de valeur affichee dans l'interface */
  example: string;
  /** Mode de resolution */
  mode: PlaceholderMode;
  /** Chemin vers le champ source (mode MAPPING) — ex: "vague.poidsMoyen" */
  sourcePath: string | null;
  /** Expression de calcul (mode FORMULA) — ex: "alimentation / biomasse" */
  formula: string | null;
  /** Format de la valeur resolue */
  format: PlaceholderFormat;
  /** Nombre de decimales pour le format NUMBER */
  decimals: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
