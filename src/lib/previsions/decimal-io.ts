/**
 * src/lib/previsions/decimal-io.ts
 *
 * Utilitaire PARTAGE de conversion `Decimal` pour le module Previsions
 * (Sprint PR2, story PR2.1 — pre-analyse, section "Le point le plus
 * important : la serialisation des Decimal").
 *
 * Trois representations distinctes circulent dans ce module :
 *   1. `Prisma.Decimal` — copie VENDOREE de decimal.js, reexportee depuis
 *      `@prisma/client/runtime/client` (src/generated/prisma/internal/
 *      prismaNamespace.ts:62). Ce N'EST PAS la meme instance de module que
 *      `decimal.js@10.6.0` declare en dependance directe et configure par
 *      `./decimal-config.ts` (`Decimal.set({ precision: 20, rounding: ... })`
 *      ne s'applique PAS a `Prisma.Decimal`).
 *   2. `decimal.js` du moteur (`./decimal-config.ts`) — ce que consomment
 *      toutes les fonctions pures de `src/lib/previsions/*.ts`.
 *   3. `number` TS/JSON — convention constante du depot pour tout `Decimal`
 *      Prisma mappe en TypeScript (`src/types/models.ts`), et donc la forme
 *      attendue a la frontiere API.
 *
 * Regle de conversion (tranchee par la pre-analyse PR2.1, a ne jamais
 * contourner) :
 * - `Prisma.Decimal -> decimal.js moteur` : TOUJOURS via `.toString()`
 *   (`prismaDecimalToEngine`), jamais via un detour par `.toNumber()`
 *   (reintroduirait le binaire flottant que le choix Decimal visait a
 *   eviter, ADR-053 decision 5).
 * - `Prisma.Decimal -> number` (frontiere API/JSON) : `.toNumber()`
 *   explicite (`decimalToNumber`) — c'est le point faible identifie dans
 *   `src/lib/queries/commissions.ts` (`getPortefeuille`), qui laisse fuiter
 *   des `Decimal` bruts jusqu'a `NextResponse.json` : ce module ne doit
 *   JAMAIS reproduire cette fuite. Reserve aux queries qui alimentent une
 *   route API (PR2.2) — PAS a `chargerScenarioPourMoteur`, qui reste
 *   interne et alimente le moteur, jamais le JSON.
 * - Le sens inverse (`decimal.js moteur -> ecriture Prisma`) est transparent
 *   cote Prisma Client (accepte `string`/`number`/`DecimalJsLike` en entree
 *   d'un champ `Decimal`) : aucune fonction dediee necessaire ici, passer
 *   directement l'instance `decimal.js` (ou son `.toString()`) a `data: {...}`.
 *
 * Reference : docs/analysis/pre-analysis-story-PR2.1.md,
 * docs/decisions/ADR-053-module-previsions.md.
 */
import type { Prisma } from "@/generated/prisma/client";
import { Decimal } from "./decimal-config";

/**
 * Convertit un `Prisma.Decimal` en `Decimal` du moteur (`decimal.js`), via
 * `.toString()` — jamais `.toNumber()` (perte de precision binaire).
 */
export function prismaDecimalToEngine(value: Prisma.Decimal): Decimal;
export function prismaDecimalToEngine(value: Prisma.Decimal | null): Decimal | null;
export function prismaDecimalToEngine(value: Prisma.Decimal | null): Decimal | null {
  if (value === null || value === undefined) return null;
  return new Decimal(value.toString());
}

/**
 * Convertit un `Prisma.Decimal` en `number` JS — reserve a la frontiere
 * API/JSON (jamais au chargement du moteur, cf. en-tete de ce fichier).
 */
export function decimalToNumber(value: Prisma.Decimal): number;
export function decimalToNumber(value: Prisma.Decimal | null): number | null;
export function decimalToNumber(value: Prisma.Decimal | null): number | null {
  if (value === null || value === undefined) return null;
  return value.toNumber();
}
