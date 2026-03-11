/**
 * Types miroirs du schema Prisma.
 *
 * Ces types representent les modeles tels qu'ils sont stockes en base.
 * Ils servent de source de verite TypeScript pour le projet.
 *
 * 24 modeles : Site, SiteRole, SiteMember, User, Session, Bac, Vague, Releve, Fournisseur, Produit, MouvementStock, Commande, LigneCommande, ReleveConsommation, Client, Vente, Facture, Paiement, Reproducteur, Ponte, LotAlevins, ConfigAlerte, Notification, Activite
 * 22 enums : Role, Permission, StatutVague, TypeReleve, TypeAliment, CauseMortalite, MethodeComptage, CategorieProduit, UniteStock, TypeMouvement, StatutCommande, StatutFacture, ModePaiement, SexeReproducteur, StatutReproducteur, StatutPonte, StatutLotAlevins, TypeAlerte, StatutAlerte, TypeActivite, StatutActivite, Recurrence
 */

// ---------------------------------------------------------------------------
// Enums — Authentification & Permissions
// ---------------------------------------------------------------------------

/** Role d'un utilisateur */
export enum Role {
  ADMIN = "ADMIN",
  GERANT = "GERANT",
  PISCICULTEUR = "PISCICULTEUR",
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
  KG = "KG",
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
export interface Site {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
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
  /** Volume en litres */
  volume: number;
  /** Nombre de poissons actuellement dans le bac (mis a jour via comptages) */
  nombrePoissons: number | null;
  /** ID de la vague assignee, null si le bac est libre */
  vagueId: string | null;
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

  createdAt: Date;
  updatedAt: Date;

  /** Produits consommes lors de ce releve (present si la query inclut les consommations avec leur produit) */
  consommations?: ReleveConsommationWithRelations[];
}

/** Releve avec ses relations vague et bac chargees */
export interface ReleveWithRelations extends Releve {
  vague: Vague;
  bac: Bac;
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
}

/** Statut du cycle de vie d'une notification */
export enum StatutAlerte {
  ACTIVE = "ACTIVE",
  LUE = "LUE",
  TRAITEE = "TRAITEE",
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
}
