/**
 * Calculs biologiques pour le module Reproduction (ADR-044 §6.2).
 *
 * Fonctions pures — pas d'effet de bord, pas d'appel Prisma.
 */

// ---------------------------------------------------------------------------
// Table de latence théorique (température → heures jusqu'au stripping)
// Source : littérature Clarias gariepinus + pratique piscicole camerounaise
// ---------------------------------------------------------------------------

/** Point de référence dans la table de latence */
interface LatencePoint {
  tempC: number;
  heures: number;
}

/**
 * Table de correspondance température (°C) → latence théorique (heures).
 * Valeurs de référence pour Clarias gariepinus.
 * Points : 20°C→24h, 22°C→20h, 25°C→14h, 27°C→12h, 30°C→10h
 */
const LATENCE_TABLE: LatencePoint[] = [
  { tempC: 20, heures: 24 },
  { tempC: 22, heures: 20 },
  { tempC: 25, heures: 14 },
  { tempC: 27, heures: 12 },
  { tempC: 30, heures: 10 },
];

/**
 * Retourne la latence théorique en heures pour une température d'eau donnée.
 *
 * Interpole linéairement entre les points de la table.
 * En dehors des bornes (< 20°C ou > 30°C), retourne la valeur aux extrêmes.
 *
 * @param temperatureEauC - Température de l'eau en degrés Celsius
 * @returns Latence théorique en heures (entier arrondi)
 */
export function getLatenceTheoriqueH(temperatureEauC: number): number {
  // En dessous du minimum — extrapoler avec la valeur du premier point
  if (temperatureEauC <= LATENCE_TABLE[0].tempC) {
    return LATENCE_TABLE[0].heures;
  }

  // Au dessus du maximum — extrapoler avec la valeur du dernier point
  const last = LATENCE_TABLE[LATENCE_TABLE.length - 1];
  if (temperatureEauC >= last.tempC) {
    return last.heures;
  }

  // Trouver les deux points encadrants pour interpolation
  for (let i = 0; i < LATENCE_TABLE.length - 1; i++) {
    const lower = LATENCE_TABLE[i];
    const upper = LATENCE_TABLE[i + 1];

    if (temperatureEauC >= lower.tempC && temperatureEauC <= upper.tempC) {
      // Interpolation linéaire : h = h_lower + (temp - temp_lower) * (h_upper - h_lower) / (temp_upper - temp_lower)
      const ratio = (temperatureEauC - lower.tempC) / (upper.tempC - lower.tempC);
      const heures = lower.heures + ratio * (upper.heures - lower.heures);
      return Math.round(heures);
    }
  }

  // Ne devrait jamais arriver (couvert par les garde-fous au-dessus)
  return LATENCE_TABLE[0].heures;
}

/**
 * Estime le nombre d'oeufs à partir du poids total des oeufs pondus.
 *
 * Facteur de conversion : 750 oeufs/gramme (fécondité Clarias gariepinus).
 *
 * @param poidsOeufsPontesG - Poids total des oeufs en grammes
 * @returns Estimation du nombre d'oeufs (entier)
 */
export function estimerNombreOeufs(poidsOeufsPontesG: number): number {
  return Math.round(poidsOeufsPontesG * 750);
}

// ---------------------------------------------------------------------------
// Durée d'incubation selon température (ADR-044 §6.3)
// ---------------------------------------------------------------------------

/**
 * Table de correspondance température (°C) → durée d'incubation (heures).
 * Points : 20°C→40h, 22°C→36h, 25°C→30h, 27°C→25h, 30°C→22h
 */
const INCUBATION_TABLE: LatencePoint[] = [
  { tempC: 20, heures: 40 },
  { tempC: 22, heures: 36 },
  { tempC: 25, heures: 30 },
  { tempC: 27, heures: 25 },
  { tempC: 30, heures: 22 },
];

/**
 * Retourne la durée théorique d'incubation en heures pour une température donnée.
 *
 * @param temperatureEauC - Température de l'eau en degrés Celsius
 * @returns Durée d'incubation en heures (entier arrondi)
 */
export function getDureeIncubationH(temperatureEauC: number): number {
  if (temperatureEauC <= INCUBATION_TABLE[0].tempC) {
    return INCUBATION_TABLE[0].heures;
  }
  const last = INCUBATION_TABLE[INCUBATION_TABLE.length - 1];
  if (temperatureEauC >= last.tempC) {
    return last.heures;
  }
  for (let i = 0; i < INCUBATION_TABLE.length - 1; i++) {
    const lower = INCUBATION_TABLE[i];
    const upper = INCUBATION_TABLE[i + 1];
    if (temperatureEauC >= lower.tempC && temperatureEauC <= upper.tempC) {
      const ratio = (temperatureEauC - lower.tempC) / (upper.tempC - lower.tempC);
      const heures = lower.heures + ratio * (upper.heures - lower.heures);
      return Math.round(heures);
    }
  }
  return INCUBATION_TABLE[0].heures;
}
