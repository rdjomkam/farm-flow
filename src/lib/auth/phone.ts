/**
 * Normalise un numero de telephone camerounais vers le format international +237XXXXXXXXX.
 *
 * Accepte :
 *  - "6XXXXXXXX" ou "2XXXXXXXX" (9 chiffres locaux)
 *  - "237XXXXXXXXX" (sans +)
 *  - "+237XXXXXXXXX" (format complet)
 *  - Avec ou sans espaces / tirets
 *
 * Retourne le format canonique "+237XXXXXXXXX" ou null si invalide.
 */
export function normalizePhone(input: string): string | null {
  // Strip spaces, dashes, dots, parentheses
  const cleaned = input.replace(/[\s\-().]/g, "");

  let digits: string;

  if (cleaned.startsWith("+237")) {
    digits = cleaned.slice(4);
  } else if (cleaned.startsWith("00237")) {
    digits = cleaned.slice(5);
  } else if (cleaned.startsWith("237") && cleaned.length === 12) {
    digits = cleaned.slice(3);
  } else {
    digits = cleaned;
  }

  // Must be exactly 9 digits starting with 6 or 2
  if (/^[62]\d{8}$/.test(digits)) {
    return `+237${digits}`;
  }

  return null;
}
