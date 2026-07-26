/**
 * Schemas Zod communs — date, pagination, consommations.
 *
 * Centralise les schemas partages entre les routes POST, PUT, PATCH des releves.
 */

import { z } from "zod";
import { isDecodableImage } from "./image-decode";

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

/**
 * Schema pour une date optionnelle acceptant les deux formats produits par
 * un `<input type="date">` ("2026-07-26") et un ISO datetime complet
 * ("2026-07-26T12:00:00.000Z"). Contrairement a `releveDateSchema` /
 * `updateDateSchema`, aucune contrainte "pas dans le futur" n'est appliquee :
 * une date/heure de livraison saisie le jour meme peut techniquement tomber
 * quelques heures apres l'instant de la requete cote serveur (BUG-BF-1).
 */
export const flexibleDateSchema = z
  .string()
  .refine(
    (val) => {
      const d = new Date(val);
      return !isNaN(d.getTime());
    },
    { message: "Date invalide (format ISO 8601 attendu)." }
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

// ---------------------------------------------------------------------------
// Images base64 (signatures, cachet, etc.) — Sprint BL
// ---------------------------------------------------------------------------

/**
 * Schema pour une image PNG/JPEG encodee en base64 (data URL), avec limite
 * de taille raisonnable pour eviter les abus (~500KB en base64, soit environ
 * 375KB de donnees binaires reelles). Utilise pour les signatures du bon de
 * livraison ainsi que la signature du promoteur et le cachet du site.
 *
 * Sprint PX (ADR-047, D1) — durcissement anti-DoS : deux controles ajoutes
 * en plus du prefixe/de la taille :
 * 1. Allowlist stricte de MIME (`image/png`, `image/jpeg`, `image/jpg`) —
 *    WEBP/GIF/SVG et tout autre format sont rejetes explicitement (SVG en
 *    particulier presente un risque XSS/XXE, cf. ADR-047).
 * 2. Decodage reel via `isDecodableImage()` (zlib natif, zero nouvelle
 *    dependance) — protege contre le bug de `@react-pdf/png-js` qui bloque
 *    indefiniment (et peut faire planter le worker Node) le rendu PDF quand
 *    un PNG RGBA porte un flux IDAT corrompu. Voir ADR-047 pour le detail.
 */
export const base64ImageSchema = z
  .string()
  .refine(
    (val) => /^data:image\/(png|jpe?g);base64,/i.test(val),
    "Format d'image non supporté (PNG ou JPEG uniquement)."
  )
  .refine(
    (val) => val.length <= 500_000,
    "L'image est trop volumineuse (500KB maximum)."
  )
  .refine(isDecodableImage, "Image illisible ou corrompue.");

/** Variante nullable/optionnelle — pour les champs modifiables ou supprimables. */
export const base64ImageOptionalSchema = base64ImageSchema.optional().nullable();
