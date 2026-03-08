/**
 * Types miroirs du schema Prisma.
 *
 * Ces types representent les modeles tels qu'ils sont stockes en base.
 * Ils servent de source de verite TypeScript pour le projet.
 *
 * 3 modeles : Bac, Vague, Releve
 * 5 enums : StatutVague, TypeReleve, TypeAliment, CauseMortalite, MethodeComptage
 */

// ---------------------------------------------------------------------------
// Enums
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
// Modeles
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
}

/** Releve avec ses relations vague et bac chargees */
export interface ReleveWithRelations extends Releve {
  vague: Vague;
  bac: Bac;
}
