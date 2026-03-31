/**
 * Schemas Zod communs — date, pagination, consommations.
 *
 * Centralise les schemas partages entre les routes POST, PUT, PATCH des releves.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Date
// ---------------------------------------------------------------------------

/**
 * Schema pour une date optionnelle de releve.
 * Accepte une chaine ISO 8601 (avec ou sans composante horaire), rejette les dates futures.
 * Compatible avec les formats "2026-03-01" et "2026-03-01T12:00:00.000Z".
 */
export const releveDateSchema = z
  .string()
  .refine(
    (val) => {
      const d = new Date(val);
      return !isNaN(d.getTime());
    },
    { message: "Date invalide (format ISO 8601 attendu)." }
  )
  .refine(
    (val) => new Date(val) <= new Date(),
    { message: "La date du releve ne peut pas etre dans le futur." }
  )
  .optional();

/**
 * Schema pour une date optionnelle lors d'un PUT/PATCH.
 * Meme regles que releveDateSchema mais avec des messages adaptes au contexte de modification.
 */
export const updateDateSchema = z
  .string()
  .refine(
    (val) => {
      const d = new Date(val);
      return !isNaN(d.getTime());
    },
    { message: "La date fournie est invalide." }
  )
  .refine(
    (val) => new Date(val) <= new Date(),
    { message: "La date ne peut pas etre dans le futur." }
  )
  .optional();

// ---------------------------------------------------------------------------
// Consommations
// ---------------------------------------------------------------------------

export const consommationItemSchema = z.object({
  produitId: z.string().min(1, "L'identifiant du produit est obligatoire."),
  quantite: z.number().positive("La quantite doit etre superieure a 0."),
});

export const consommationsSchema = z
  .array(consommationItemSchema)
  .optional();

export type ConsommationItem = z.infer<typeof consommationItemSchema>;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const paginationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : 0))
    .pipe(z.number().int().min(0)),
});

// ---------------------------------------------------------------------------
// Champs texte communs avec limites de longueur
// ---------------------------------------------------------------------------

export const notesSchema = z.string().max(2000, "Les notes ne peuvent pas depasser 2000 caracteres.").optional().nullable();

export const descriptionSchema = z
  .string()
  .trim()
  .min(1, "La description ne peut pas etre vide.")
  .max(2000, "La description ne peut pas depasser 2000 caracteres.");

export const raisonSchema = z
  .string()
  .trim()
  .min(5, "La raison doit contenir au moins 5 caracteres.")
  .max(500, "La raison ne peut pas depasser 500 caracteres.");
