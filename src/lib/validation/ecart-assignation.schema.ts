/**
 * Schemas Zod pour la persistance/consultation des ecarts de conservation
 * toleres par le guard verifyAssignationInvariant — ADR-048 (Sprint SU, story SU.2).
 *
 * R3 etendu (Prisma = TypeScript = Zod) : tout champ du modele
 * EcartAssignationConstate a un schema de validation runtime associe.
 * R2 : l'enum ContexteDetectionEcart est importe depuis @/types, jamais
 * ecrit en dur.
 *
 * Ces schemas anticipent une route API de consultation (`getBacsEnDerive`)
 * qui n'est pas requise dans ce sprint (cf. ADR-048 section 9 — UI hors
 * perimetre SU.2) mais sera necessaire des qu'un ecran l'exposera.
 */

import { z } from "zod";
import { ContexteDetectionEcart } from "@/types";

// ---------------------------------------------------------------------------
// Options de persistance (parametre optionnel de verifyAssignationInvariant)
// ---------------------------------------------------------------------------

/** Valeurs de l'enum ContexteDetectionEcart, utilisees comme z.nativeEnum. */
export const contexteDetectionEcartSchema = z.nativeEnum(ContexteDetectionEcart);

/**
 * Options optionnelles passees au guard pour attribuer une detection d'ecart
 * a un acteur et un contexte. Les deux champs sont optionnels : le guard
 * doit rester utilisable par des call sites non encore migres (ADR-048
 * section 5/8.6).
 */
export const persisterEcartOptionsSchema = z.object({
  userId: z.string().min(1).optional(),
  contexte: contexteDetectionEcartSchema.optional(),
});

export type PersisterEcartOptionsInput = z.infer<typeof persisterEcartOptionsSchema>;

// ---------------------------------------------------------------------------
// Requete "bacs en derive" — GET /api/bacs/en-derive (route future)
// ---------------------------------------------------------------------------

/** Query params attendus pour lister les bacs en derive d'un site. */
export const getBacsEnDeriveQuerySchema = z.object({
  siteId: z.string().min(1, "L'identifiant du site est obligatoire."),
});

export type GetBacsEnDeriveQueryInput = z.infer<typeof getBacsEnDeriveQuerySchema>;

/**
 * Forme d'un element de reponse de getBacsEnDerive — miroir de l'interface
 * TypeScript BacEnDerive (src/types/models.ts). Sert de garde-fou si la
 * query est un jour exposee telle quelle via une route API (validation de
 * sortie, ex. tests de contrat).
 */
export const bacEnDeriveSchema = z.object({
  bacId: z.string(),
  bacNom: z.string(),
  vagueId: z.string(),
  vagueCode: z.string(),
  ecart: z.number().int(),
  premiereDetectionLe: z.date(),
  derniereDetectionLe: z.date(),
  dernierContexte: contexteDetectionEcartSchema,
});

export type BacEnDeriveOutput = z.infer<typeof bacEnDeriveSchema>;
