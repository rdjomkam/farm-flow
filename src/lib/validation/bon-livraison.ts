/**
 * Schemas Zod pour la validation du bon de livraison (BonLivraison) — Sprint BL.
 *
 * R3 etendu (leçon SC2/ERR) : Prisma = TypeScript = Zod. Tout nouveau champ
 * du modele BonLivraison doit avoir un schema de validation runtime associe.
 */

import { z } from "zod";
import { base64ImageSchema, flexibleDateSchema } from "./common.schema";

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

/** Corps de la requete POST /api/ventes/[id]/bon-livraison (creation) */
export const createBonLivraisonSchema = z.object({
  venteId: z.string().min(1, "L'identifiant de la vente est obligatoire."),
});

export type CreateBonLivraisonInput = z.infer<typeof createBonLivraisonSchema>;

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

/** Nom du signataire cote client — obligatoire, non vide, taille raisonnable */
export const signataireClientNomSchema = z
  .string()
  .trim()
  .min(1, "Le nom du signataire est obligatoire.")
  .max(100, "Le nom du signataire ne peut pas depasser 100 caracteres.");

/** Corps de la requete POST /api/bons-livraison/[id]/signer */
export const signerBonLivraisonSchema = z.object({
  signatureClient: base64ImageSchema,
  signataireClientNom: signataireClientNomSchema,
  signatureLivreur: base64ImageSchema,
});

export type SignerBonLivraisonInput = z.infer<typeof signerBonLivraisonSchema>;

// ---------------------------------------------------------------------------
// Quantites livrees (Sprint BF)
// ---------------------------------------------------------------------------

/** Une ligne de quantite livree saisie sur le bon de livraison, avant signature */
export const enregistrerQuantiteLigneBonLivraisonSchema = z.object({
  ligneVenteId: z.string().min(1, "L'identifiant de la ligne de vente est obligatoire."),
  /**
   * Poids reellement livre (kg). 0 permis — un client peut refuser toute une
   * ligne a la livraison.
   */
  poidsLivreKg: z.number().min(0, "Le poids livre ne peut pas etre negatif."),
  nombreMortsTransport: z
    .number()
    .int("Le nombre de morts en transport doit etre un entier.")
    .min(0, "Le nombre de morts en transport ne peut pas etre negatif.")
    .optional()
    .default(0),
  motifAvarie: z
    .string()
    .trim()
    .max(500, "Le motif de l'avarie ne peut pas depasser 500 caracteres.")
    .nullable()
    .optional(),
});

export type EnregistrerQuantiteLigneBonLivraisonInput = z.infer<
  typeof enregistrerQuantiteLigneBonLivraisonSchema
>;

/**
 * Corps de la requete pour enregistrer les quantites livrees d'un bon de
 * livraison, avant signature (ecran 1 du flux — Sprint BF).
 */
export const enregistrerQuantitesBonLivraisonSchema = z.object({
  /**
   * Accepte les deux formats produits par l'UI : date simple issue d'un
   * `<input type="date">` ("2026-07-26") et ISO datetime complet. Reutilise
   * le pattern commun (voir common.schema.ts) plutot qu'une contrainte
   * `.datetime()` stricte qui rejette le format simple (BUG-BF-1). Pas de
   * contrainte "futur" ici (contrairement a updateDateSchema) : voir
   * flexibleDateSchema.
   */
  dateLivraison: flexibleDateSchema,
  lignes: z
    .array(enregistrerQuantiteLigneBonLivraisonSchema)
    .min(1, "Au moins une ligne de quantite livree est requise."),
});

export type EnregistrerQuantitesBonLivraisonInput = z.infer<
  typeof enregistrerQuantitesBonLivraisonSchema
>;

// ---------------------------------------------------------------------------
// Rectificatif (Sprint BF phase 2)
// ---------------------------------------------------------------------------

/**
 * Motif de rectification — obligatoire. Un BL signe est un document immuable ;
 * on exige de savoir *pourquoi* il est annule et remplace (pratique comptable
 * de l'avoir sur facture).
 */
export const motifRectificationSchema = z
  .string()
  .trim()
  .min(5, "Le motif de rectification doit contenir au moins 5 caracteres.")
  .max(500, "Le motif de rectification ne peut pas depasser 500 caracteres.");

/** Corps de la requete de creation d'un bon de livraison rectificatif */
export const creerBonLivraisonRectificatifSchema = z.object({
  bonLivraisonOrigineId: z
    .string()
    .min(1, "L'identifiant du bon de livraison a rectifier est obligatoire."),
  motifRectification: motifRectificationSchema,
});

export type CreerBonLivraisonRectificatifInput = z.infer<
  typeof creerBonLivraisonRectificatifSchema
>;
