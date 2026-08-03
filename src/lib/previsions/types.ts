/**
 * Types internes du moteur de calcul du module Previsions.
 *
 * Ces types sont VOLONTAIREMENT distincts des interfaces miroirs de
 * `src/types/models.ts` (story PR1.2) : la convention constante du depot
 * mirroire un `Decimal` Prisma en `number` cote types applicatifs, alors
 * que le moteur (ADR-053 section 4, "Typage numerique") travaille
 * exclusivement en `Decimal` pour tout montant, poids en kg, ou nombre de
 * sacs fractionnaire. La frontiere de conversion `number` (types
 * applicatifs / Prisma) <-> `Decimal` (moteur) est assumee explicitement a
 * la charge de la couche API/queries qui appellera ce moteur (hors
 * perimetre PR1.3, cf. story) — jamais laissee implicite a l'interieur du
 * moteur lui-meme.
 *
 * Ces interfaces ne portent que les champs strictement necessaires au
 * calcul (pas de miroir 1:1 des modeles Prisma) : c'est ce qui garantit
 * l'absence d'I/O (aucune de ces interfaces ne force a charger un modele
 * Prisma complet pour appeler une fonction du moteur).
 */
import { Decimal } from "./decimal-config";

/**
 * Une ligne de repartition mensuelle (%) pour un AlimentPrevision donne
 * (miroir partiel de RepartitionMoisAliment, ADR-053 section 3.5).
 */
export interface RepartitionMoisInput {
  /** 1..dureeCycleMois — jamais un index 0-based (ADR-053 section 3.5) */
  moisCycle: number;
  /** 0..100 */
  pourcentage: Decimal;
}

/**
 * Un aliment previsionnel (granulometrie), tel que consomme par
 * `calculerBesoinAlimentMensuel` (aliments.ts).
 */
export interface AlimentPrevisionCalcInput {
  /** alimentPrevisionId — tracabilite du resultat uniquement, jamais lu comme FK (le moteur ne fait pas d'I/O) */
  id: string;
  poidsSacKg: Decimal;
  /**
   * Besoin total (kg) de cette granulometrie sur un cycle complet d'une
   * VaguePrevue.
   *
   * GAP DE MODELE signale au rapport de la story PR1.3 : ni le schema
   * Prisma (AlimentPrevision, ADR-053 section 3.5) ni le texte de l'ADR
   * ne specifient de champ ni de formule pour deriver cette valeur depuis
   * la biomasse prevue / un taux d'alimentation par phase de poids. Elle
   * est donc traitee ici comme une ENTREE explicite du moteur (calculee
   * en amont, par la couche API/queries ou fournie par les fixtures de
   * recette PR1.4) plutot que recalculee silencieusement a l'interieur du
   * moteur avec une formule non verifiee par la pre-analyse.
   */
  besoinTotalCycleKg: Decimal;
  repartitions: RepartitionMoisInput[];
}

/**
 * Un palier de remise volume, dans son ordre d'evaluation explicite
 * (miroir partiel de PalierRemise, ADR-053 section 3.4).
 */
export interface PalierRemiseInput {
  /** ordre d'evaluation explicite — jamais deduit d'un tri implicite sur seuilSacs */
  ordre: number;
  seuilSacs: Decimal;
  pourcentageRemise: Decimal;
}
