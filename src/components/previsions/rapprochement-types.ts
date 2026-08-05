/**
 * src/components/previsions/rapprochement-types.ts
 *
 * DTOs de l'onglet Rapprochement (Sprint PR3, story PR3.7, ADR-053 section
 * 15, §6.4 des exigences fonctionnelles). Miroirs `number`/`string` des
 * types du moteur (`src/lib/previsions/types.ts`,
 * `src/lib/previsions/rapprochement-vagues.ts`) — un `Decimal` ne traverse
 * jamais la frontiere Server -> Client (meme convention que
 * `projection-types.ts`).
 *
 * TOUT calcul de sens/couleur/ecart est deja fait cote serveur (page.tsx,
 * qui appelle exclusivement le moteur `src/lib/previsions/rapprochement*.ts`)
 * — un composant client ne fait QUE lire ces champs deja tranches, jamais
 * une comparaison `>`/`<` refaite localement (ADR-053 section 15.5/15.6,
 * ERR-171).
 */
import type { StatutVaguePrevue } from "@/types";

export type StatutRapprochementDTO = "RAPPROCHE" | "NON_RAPPROCHE" | "SANS_SOURCE_REELLE";
export type SensEcartDTO = "FAVORABLE" | "DEFAVORABLE" | "NEUTRE" | "NON_APPLICABLE";
export type NatureGrandeurDTO = "DEPENSE" | "ENTREE" | "QUANTITE";
export type CouleurEcartDTO = "vert" | "orange" | "rouge" | "neutre";

/** Une ligne de rapprochement (poste/granulometrie/vente/apport x mois) — miroir de `LigneRapprochement`. */
export interface LigneRapprochementDTO {
  id: string;
  moisAbsolu: number;
  libelle: string;
  natureGrandeur: NatureGrandeurDTO;
  prevu: number;
  /** null ssi statutRapprochement === "SANS_SOURCE_REELLE" — jamais 0 dans ce cas (ADR-053 §15.1). */
  reel: number | null;
  statutRapprochement: StatutRapprochementDTO;
  ecartAbsolu: number | null;
  ecartPct: number | null;
  sens: SensEcartDTO;
  couleur: CouleurEcartDTO;
}

/** Agregat prevu/reel (mois ou cumule) — miroir de `AgregatEcart`. */
export interface AgregatEcartDTO {
  totalPrevu: number;
  totalReel: number;
  totalEcartAbsolu: number;
  nombreLignes: number;
  nombreLignesSansSourceReelle: number;
  nombreLignesNonRapprochees: number;
}

/**
 * Unite d'un agregat de rapprochement (Sprint PR3-ter, story C.2) :
 * "MONETAIRE" (DEPENSE/ENTREE, FCFA) ou "QUANTITE" (kg) — determine
 * exclusivement le formatteur applique a l'affichage. Un agregat
 * `AgregatEcartDTO` n'est JAMAIS affiche sans que son unite soit connue
 * du composant qui le rend (jamais un "Total" mixte non etiquete).
 */
export type UniteAgregatDTO = "MONETAIRE" | "QUANTITE";

/** Agregat par poste, enrichi de sens/couleur — miroir de `AgregatPosteComparaison`. */
export interface AgregatPosteDTO extends AgregatEcartDTO {
  cle: string;
  libelle: string;
  natureGrandeur: NatureGrandeurDTO;
  ecartPct: number | null;
  sens: SensEcartDTO;
  couleur: CouleurEcartDTO;
}

/** Comparaison chiffree pour une grandeur de la vue "par vague" — miroir de `ComparaisonChiffree`. */
export interface ComparaisonChiffreeDTO {
  /** null si structurellement indisponible (ex. cout/kg avec biomasse prevue nulle) — jamais 0. */
  prevu: number | null;
  /** null si la vague n'est pas realisee, ou denominateur reel nul — jamais 0. */
  reel: number | null;
  ecartAbsolu: number | null;
  ecartPct: number | null;
  sens: SensEcartDTO;
  couleur: CouleurEcartDTO;
}

/** Une ligne de la vue "par vague" — libelle de cohorte complet (code prevu + code reel si rattachee). */
export interface VagueRapprochementRowDTO {
  vaguePrevueId: string;
  codePrevu: string;
  statut: StatutVaguePrevue;
  vagueReelleId: string | null;
  codeReel: string | null;
  /** false = non realisee : tous les champs `reel` ci-dessous valent null, jamais 0. */
  realisee: boolean;
  coutComplet: ComparaisonChiffreeDTO;
  marge: ComparaisonChiffreeDTO;
  coutAuKg: ComparaisonChiffreeDTO;
}

/**
 * Rapprochement complet d'un scenario, pre-calcule cote serveur pour TOUT
 * l'horizon (comme `projection`, story PR2.4) — le selecteur de mois cote
 * client n'index que dans ces structures deja pretes, aucune recomposition.
 */
export interface RapprochementScenarioDTO {
  horizonMois: number;
  dateDebutPlan: string;
  /** [0..horizonMois-1] — vide si la projection est vide (erreurProjection). */
  moisDisponibles: number[];
  /** Vue mensuelle : une entree par mois, la liste COMPLETE des lignes de ce mois (tous statuts confondus). */
  lignesParMois: Record<number, LigneRapprochementDTO[]>;
  /**
   * Ligne "Total" de la vue mensuelle — agregat des lignes MONETAIRES
   * (DEPENSE/ENTREE, FCFA) UNIQUEMENT de ce mois (Sprint PR3-ter, story
   * C.2) : ne mélange JAMAIS un montant FCFA avec une quantite kg.
   */
  totalMoisMonetaireParMois: Record<number, AgregatEcartDTO>;
  /** Ligne "Total" de la vue mensuelle — agregat des lignes QUANTITE (kg) UNIQUEMENT de ce mois (story C.2), disjoint du total monetaire. */
  totalMoisQuantiteParMois: Record<number, AgregatEcartDTO>;
  /** Bac "Non rapproche" (ADR-053 section 5) — TOUJOURS present (tableau vide si aucune categorie non rapprochee ce mois), jamais absent. */
  nonRapprocheParMois: Record<number, LigneRapprochementDTO[]>;
  /** Vue cumulee — total des lignes MONETAIRES (FCFA) UNIQUEMENT, depuis le debut de l'horizon jusqu'a (et y compris) ce mois (story C.2). */
  cumuleGlobalMonetaireParMois: Record<number, AgregatEcartDTO>;
  /** Vue cumulee — total des lignes QUANTITE (kg) UNIQUEMENT, memes bornes que `cumuleGlobalMonetaireParMois` (story C.2). */
  cumuleGlobalQuantiteParMois: Record<number, AgregatEcartDTO>;
  /** Vue cumulee, detail par poste — memes bornes que `cumuleGlobalMonetaireParMois` (chaque poste est de nature homogene). */
  cumuleParPosteParMois: Record<number, AgregatPosteDTO[]>;
  /** Vue "Top ecarts" — les 5 lignes MONETAIRES (FCFA) de plus grand |ecartAbsolu| de ce mois (story C.2), jamais triees contre une ligne QUANTITE. */
  topEcartsMonetaireParMois: Record<number, LigneRapprochementDTO[]>;
  /** Vue "Top ecarts" — les 5 lignes QUANTITE (kg) de plus grand |ecartAbsolu| de ce mois (story C.2), classement DISJOINT du classement monetaire. */
  topEcartsQuantiteParMois: Record<number, LigneRapprochementDTO[]>;
  /** Vue "par vague" — une ligne par VaguePrevue du scenario, tous mois confondus (cout complet du cycle). */
  vagues: VagueRapprochementRowDTO[];
  /** Instant ISO du calcul serveur — l'onglet doit afficher explicitement que le "reel" reflete cet instant, jamais une photo figee (ADR-053 §5.1(b)). */
  calculeLe: string;
}
