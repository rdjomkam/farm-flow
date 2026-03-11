/**
 * DTOs pour la génération d'exports PDF et Excel.
 *
 * Ces types sont les contrats entre les API routes d'export (/api/export/...)
 * et les helpers de génération (src/lib/export/).
 *
 * Trois catégories d'exports :
 * - PDF : Facture, Rapport Vague, Rapport Financier   → @react-pdf/renderer
 * - Excel : Relevés, Mouvements Stock, Ventes          → xlsx (SheetJS)
 *
 * Règles :
 * - R1 : Enums MAJUSCULES
 * - R2 : Enums importés depuis @/types
 * - R8 : siteId présent dans tous les DTOs de filtres
 * - Aucun `any` — commentaires JSDoc obligatoires
 */

import type {
  StatutFacture,
  ModePaiement,
  TypeReleve,
  TypeAliment,
  CauseMortalite,
  MethodeComptage,
  CategorieProduit,
  TypeMouvement,
  UniteStock,
  StatutVague,
} from "@/types";

// ---------------------------------------------------------------------------
// Types communs
// ---------------------------------------------------------------------------

/**
 * Informations du site piscicole.
 * Inclus dans tous les en-têtes de PDF pour identifier la ferme.
 */
export interface SiteInfoExport {
  /** Nom de la ferme */
  name: string;
  /** Adresse complète (nullable) */
  address: string | null;
  /** URL du logo (chemin relatif ou base64, nullable) */
  logoUrl?: string | null;
}

/**
 * Plage de dates pour les exports filtrés par période.
 */
export interface PeriodeExport {
  /** Date de début de la période (inclusive) */
  dateDebut: Date;
  /** Date de fin de la période (inclusive) */
  dateFin: Date;
}

// ---------------------------------------------------------------------------
// DTOs PDF — Facture
// ---------------------------------------------------------------------------

/**
 * Informations client pour l'en-tête d'une facture PDF.
 */
export interface ClientFacturePDF {
  /** Nom complet du client */
  nom: string;
  /** Email (nullable) */
  email: string | null;
  /** Numéro de téléphone (nullable) */
  telephone: string | null;
  /** Adresse postale (nullable) */
  adresse: string | null;
}

/**
 * Détail d'une ligne de paiement dans la facture PDF.
 */
export interface PaiementFacturePDF {
  /** Montant payé pour ce paiement */
  montant: number;
  /** Mode de paiement utilisé */
  mode: ModePaiement;
  /** Référence du paiement (numéro chèque, ref Mobile Money, etc.) */
  reference: string | null;
  /** Date du paiement */
  date: Date;
}

/**
 * DTO pour générer une facture en PDF.
 *
 * Contient toutes les données nécessaires pour rendre le template facture.
 * Assemblé par la query dans /api/export/facture/[id].
 *
 * Structure du PDF :
 * - En-tête : nom/adresse ferme + N° facture + dates
 * - Section client : coordonnées
 * - Tableau produit : poissons (vague), quantité, poids, prix/kg, total
 * - Totaux : sous-total, montant payé, solde restant
 * - Statut + historique des paiements
 */
export interface CreateFacturePDFDTO {
  /** Informations du site (ferme) pour l'en-tête */
  site: SiteInfoExport;

  // --- Facture ---
  /** Numéro unique de la facture (ex: "FAC-2026-001") */
  numero: string;
  /** Date d'émission de la facture */
  dateEmission: Date;
  /** Date d'échéance (nullable si pas de délai fixé) */
  dateEcheance: Date | null;
  /** Statut actuel de la facture */
  statut: StatutFacture;
  /** Notes internes sur la facture (nullable) */
  notes: string | null;

  // --- Client ---
  /** Coordonnées du client */
  client: ClientFacturePDF;

  // --- Vente associée ---
  /** Numéro unique de la vente (ex: "VTE-2026-001") */
  venteNumero: string;
  /** Code de la vague d'où proviennent les poissons */
  vagueCode: string;
  /** Nombre de poissons vendus */
  quantitePoissons: number;
  /** Poids total en kilogrammes */
  poidsTotalKg: number;
  /** Prix unitaire par kilogramme (en FCFA) */
  prixUnitaireKg: number;
  /** Montant total de la vente (poidsTotalKg × prixUnitaireKg) */
  montantTotal: number;

  // --- Récapitulatif financier ---
  /** Montant total de la facture */
  montantFacture: number;
  /** Somme des paiements déjà enregistrés */
  montantPaye: number;
  /** Solde restant à régler (montantFacture - montantPaye) */
  soldeRestant: number;

  // --- Paiements ---
  /** Historique des paiements enregistrés (peut être vide) */
  paiements: PaiementFacturePDF[];
}

// ---------------------------------------------------------------------------
// DTOs PDF — Rapport Vague
// ---------------------------------------------------------------------------

/**
 * Indicateurs calculés d'une vague pour le rapport PDF.
 */
export interface KPIsVaguePDF {
  /** Taux de survie en pourcentage (0-100) */
  tauxSurvie: number;
  /** Food Conversion Ratio — kg aliment / kg gain */
  fcr: number | null;
  /** Specific Growth Rate — % de croissance journalière */
  sgr: number | null;
  /** Biomasse totale estimée en kilogrammes */
  biomasseTotale: number | null;
  /** Poids moyen final en grammes (dernier relevé biométrie) */
  poidsMoyenFinal: number | null;
  /** Nombre de poissons actuellement en vie */
  nombreActuel: number;
}

/**
 * Résumé d'un bac pour le rapport vague.
 */
export interface BacRapportPDF {
  /** Nom du bac */
  nom: string;
  /** Volume en litres */
  volume: number;
  /** Nombre de poissons dans le bac (nullable) */
  nombrePoissons: number | null;
}

/**
 * Ligne de relevé dans le tableau du rapport vague.
 * Inclut les champs clés selon le type de relevé.
 */
export interface ReleveRapportPDF {
  /** Date du relevé */
  date: Date;
  /** Type de relevé */
  typeReleve: TypeReleve;
  /** Nom du bac concerné */
  nomBac: string;
  // --- Champs clés (un seul groupe rempli selon typeReleve) ---
  /** Poids moyen en grammes (BIOMETRIE) */
  poidsMoyen: number | null;
  /** Taille moyenne en cm (BIOMETRIE) */
  tailleMoyenne: number | null;
  /** Nombre de morts (MORTALITE) */
  nombreMorts: number | null;
  /** Cause de mortalité (MORTALITE) */
  causeMortalite: CauseMortalite | null;
  /** Quantité d'aliment en kg (ALIMENTATION) */
  quantiteAliment: number | null;
  /** Température de l'eau en °C (QUALITE_EAU) */
  temperature: number | null;
  /** pH de l'eau (QUALITE_EAU) */
  ph: number | null;
  /** Nombre de poissons comptés (COMPTAGE) */
  nombreCompte: number | null;
  /** Notes libres */
  notes: string | null;
}

/**
 * Point de données pour le graphique d'évolution du poids moyen.
 */
export interface EvolutionPoidsExport {
  /** Date du relevé biométrie */
  date: Date;
  /** Poids moyen en grammes */
  poidsMoyen: number;
}

/**
 * DTO pour générer un rapport de vague en PDF.
 *
 * Structure du PDF :
 * - En-tête : code vague, site, période
 * - KPIs : taux de survie, FCR, SGR, biomasse, poids moyen final
 * - Liste des bacs avec volumes et effectifs
 * - Tableau des relevés (date, type, bac, données clés)
 * - Graphique évolution poids (optionnel — Phase 2)
 */
export interface CreateRapportVaguePDFDTO {
  /** Informations du site (ferme) pour l'en-tête */
  site: SiteInfoExport;

  // --- Vague ---
  /** Code unique de la vague */
  code: string;
  /** Date de mise en eau */
  dateDebut: Date;
  /** Date de clôture (null si vague encore en cours) */
  dateFin: Date | null;
  /** Statut actuel de la vague */
  statut: StatutVague;
  /** Nombre initial d'alevins au démarrage */
  nombreInitial: number;
  /** Poids moyen des alevins au démarrage (en grammes) */
  poidsMoyenInitial: number;
  /** Provenance des alevins (nullable) */
  origineAlevins: string | null;

  // --- KPIs calculés ---
  /** Indicateurs zootechniques calculés à partir des relevés */
  kpis: KPIsVaguePDF;

  // --- Bacs ---
  /** Liste des bacs assignés à cette vague */
  bacs: BacRapportPDF[];

  // --- Relevés ---
  /** Tableau de tous les relevés de la vague (triés par date ASC) */
  releves: ReleveRapportPDF[];

  // --- Graphique (optionnel) ---
  /**
   * Points de données pour le graphique d'évolution du poids moyen.
   * Tableau vide si aucun relevé biométrie disponible.
   */
  evolutionPoids: EvolutionPoidsExport[];
}

// ---------------------------------------------------------------------------
// DTOs PDF — Rapport Financier
// ---------------------------------------------------------------------------

/**
 * KPIs financiers globaux pour la période couverte.
 */
export interface KPIsFinanciersPDF {
  /** Total des revenus de ventes (en FCFA) */
  revenusTotal: number;
  /** Total des coûts (aliments + intrants + équipements) (en FCFA) */
  coutsTotal: number;
  /** Marge brute = revenus - coûts (en FCFA) */
  margeNette: number;
  /** Taux de marge = margeNette / revenusTotal × 100 */
  tauxMarge: number;
}

/**
 * Ligne du tableau "Ventes par vague" dans le rapport financier.
 */
export interface VenteParVaguePDF {
  /** Code de la vague */
  codeVague: string;
  /** Quantité totale vendue en kg */
  quantiteTotaleKg: number;
  /** Montant total des ventes pour cette vague (en FCFA) */
  montantTotal: number;
  /** Nombre de ventes enregistrées */
  nombreVentes: number;
}

/**
 * Ligne du tableau "Top clients" dans le rapport financier.
 */
export interface TopClientPDF {
  /** Nom du client */
  nomClient: string;
  /** Montant total de ses achats sur la période (en FCFA) */
  montantTotal: number;
  /** Nombre total d'achats (ventes) sur la période */
  nombreAchats: number;
}

/**
 * Ligne du tableau "Évolution mensuelle" dans le rapport financier.
 */
export interface EvolutionMensuellePDF {
  /** Mois au format "YYYY-MM" (ex: "2026-01") */
  mois: string;
  /** Revenus du mois (en FCFA) */
  revenus: number;
  /** Coûts du mois (en FCFA) */
  couts: number;
  /** Marge du mois = revenus - coûts (en FCFA) */
  marge: number;
}

/**
 * DTO pour générer le rapport financier en PDF.
 *
 * Structure du PDF :
 * - En-tête : site, période couverte
 * - KPIs globaux : revenus, coûts, marge, taux de marge
 * - Tableau ventes par vague
 * - Top 5 clients (ou moins)
 * - Évolution mensuelle (tableau revenus/coûts/marge par mois)
 */
export interface CreateRapportFinancierPDFDTO {
  /** Informations du site (ferme) pour l'en-tête */
  site: SiteInfoExport;

  /** Période couverte par le rapport */
  periode: PeriodeExport;

  /** KPIs financiers globaux sur la période */
  kpis: KPIsFinanciersPDF;

  /** Détail des ventes groupées par vague (trié par montant DESC) */
  ventesParVague: VenteParVaguePDF[];

  /** Top clients par montant total (max 10 entrées) */
  topClients: TopClientPDF[];

  /** Évolution mensuelle des revenus, coûts et marge */
  evolutionMensuelle: EvolutionMensuellePDF[];
}

// ---------------------------------------------------------------------------
// DTOs Excel — Relevés
// ---------------------------------------------------------------------------

/**
 * Ligne de données pour l'export Excel des relevés.
 * Correspond à une ligne dans la feuille "Relevés".
 * Tous les champs spécifiques sont nullable selon le typeReleve.
 */
export interface ReleveExcelRow {
  /** Date du relevé (format FR : dd/mm/yyyy dans l'export) */
  date: Date;
  /** Type de relevé */
  typeReleve: TypeReleve;
  /** Code de la vague */
  codeVague: string;
  /** Nom du bac */
  nomBac: string;
  // --- Biométrie ---
  /** Poids moyen en grammes (BIOMETRIE uniquement) */
  poidsMoyen: number | null;
  /** Taille moyenne en cm (BIOMETRIE uniquement) */
  tailleMoyenne: number | null;
  /** Taille de l'échantillon biométrique (BIOMETRIE uniquement) */
  echantillonCount: number | null;
  // --- Mortalité ---
  /** Nombre de poissons morts (MORTALITE uniquement) */
  nombreMorts: number | null;
  /** Cause de mortalité (MORTALITE uniquement) */
  causeMortalite: CauseMortalite | null;
  // --- Alimentation ---
  /** Quantité d'aliment distribuée en kg (ALIMENTATION uniquement) */
  quantiteAliment: number | null;
  /** Type d'aliment utilisé (ALIMENTATION uniquement) */
  typeAliment: TypeAliment | null;
  /** Fréquence d'alimentation par jour (ALIMENTATION uniquement) */
  frequenceAliment: number | null;
  // --- Qualité eau ---
  /** Température de l'eau en °C (QUALITE_EAU uniquement) */
  temperature: number | null;
  /** pH de l'eau (QUALITE_EAU uniquement) */
  ph: number | null;
  /** Oxygène dissous en mg/L (QUALITE_EAU uniquement) */
  oxygene: number | null;
  /** Ammoniac en mg/L (QUALITE_EAU uniquement) */
  ammoniac: number | null;
  // --- Comptage ---
  /** Nombre de poissons comptés (COMPTAGE uniquement) */
  nombreCompte: number | null;
  /** Méthode de comptage utilisée (COMPTAGE uniquement) */
  methodeComptage: MethodeComptage | null;
  // --- Observation ---
  /** Description de l'observation (OBSERVATION uniquement) */
  description: string | null;
  // --- Commun ---
  /** Notes libres */
  notes: string | null;
}

/**
 * DTO pour exporter les relevés en Excel (.xlsx).
 *
 * Feuille générée : "Relevés"
 * Colonnes : voir `ReleveExcelRow`
 *
 * Paramètres de filtrage passés via les query params de GET /api/export/releves
 */
export interface ExportRelevesExcelDTO {
  /** ID du site — obligatoire (R8) */
  siteId: string;
  /** Filtrer par vague spécifique (nullable = toutes les vagues) */
  vagueId: string | null;
  /** Filtrer par bac spécifique (nullable = tous les bacs) */
  bacId: string | null;
  /** Filtrer par type de relevé (nullable = tous les types) */
  typeReleve: TypeReleve | null;
  /** Date de début de la période (inclusive) */
  dateDebut: Date;
  /** Date de fin de la période (inclusive) */
  dateFin: Date;
  /** Lignes de données pré-récupérées de la base */
  rows: ReleveExcelRow[];
}

// ---------------------------------------------------------------------------
// DTOs Excel — Mouvements de Stock
// ---------------------------------------------------------------------------

/**
 * Ligne de données pour l'export Excel des mouvements de stock.
 * Correspond à une ligne dans la feuille "Mouvements Stock".
 */
export interface MouvementExcelRow {
  /** Date du mouvement (format FR dans l'export) */
  date: Date;
  /** Nom du produit */
  nomProduit: string;
  /** Catégorie du produit */
  categorieProduit: CategorieProduit;
  /** Type de mouvement (ENTREE ou SORTIE) */
  type: TypeMouvement;
  /** Quantité mouvementée */
  quantite: number;
  /** Unité de mesure */
  unite: UniteStock;
  /** Prix total du mouvement en FCFA (nullable si non renseigné) */
  prixTotal: number | null;
  /** Code de la vague associée si sortie aliment (nullable) */
  codeVague: string | null;
  /** Numéro de la commande associée si entrée livraison (nullable) */
  numeroCommande: string | null;
  /** Notes libres (nullable) */
  notes: string | null;
}

/**
 * DTO pour exporter les mouvements de stock en Excel (.xlsx).
 *
 * Feuille générée : "Mouvements Stock"
 * Colonnes : voir `MouvementExcelRow`
 *
 * Paramètres de filtrage passés via les query params de GET /api/export/stock
 */
export interface ExportStockExcelDTO {
  /** ID du site — obligatoire (R8) */
  siteId: string;
  /** Filtrer par produit spécifique (nullable = tous les produits) */
  produitId: string | null;
  /** Filtrer par type de mouvement (nullable = ENTREE + SORTIE) */
  type: TypeMouvement | null;
  /** Filtrer par catégorie de produit (nullable = toutes catégories) */
  categorie: CategorieProduit | null;
  /** Date de début de la période (inclusive) */
  dateDebut: Date;
  /** Date de fin de la période (inclusive) */
  dateFin: Date;
  /** Lignes de données pré-récupérées de la base */
  rows: MouvementExcelRow[];
}

// ---------------------------------------------------------------------------
// DTOs Excel — Ventes
// ---------------------------------------------------------------------------

/**
 * Ligne de données pour l'export Excel des ventes.
 * Correspond à une ligne dans la feuille "Ventes".
 */
export interface VenteExcelRow {
  /** Numéro unique de la vente (ex: "VTE-2026-001") */
  numero: string;
  /** Date de la vente */
  date: Date;
  /** Nom du client */
  nomClient: string;
  /** Code de la vague d'où proviennent les poissons */
  codeVague: string;
  /** Nombre de poissons vendus */
  quantitePoissons: number;
  /** Poids total en kg */
  poidsTotalKg: number;
  /** Prix de vente par kg (en FCFA) */
  prixUnitaireKg: number;
  /** Montant total de la vente (en FCFA) */
  montantTotal: number;
  /** Statut de la facture associée (nullable si pas encore facturé) */
  statutFacture: StatutFacture | null;
  /** Notes libres (nullable) */
  notes: string | null;
}

/**
 * DTO pour exporter les ventes en Excel (.xlsx).
 *
 * Feuille générée : "Ventes"
 * Colonnes : voir `VenteExcelRow`
 *
 * Paramètres de filtrage passés via les query params de GET /api/export/ventes
 */
export interface ExportVentesExcelDTO {
  /** ID du site — obligatoire (R8) */
  siteId: string;
  /** Filtrer par client spécifique (nullable = tous les clients) */
  clientId: string | null;
  /** Filtrer par vague spécifique (nullable = toutes les vagues) */
  vagueId: string | null;
  /** Date de début de la période (inclusive) */
  dateDebut: Date;
  /** Date de fin de la période (inclusive) */
  dateFin: Date;
  /** Lignes de données pré-récupérées de la base */
  rows: VenteExcelRow[];
}
