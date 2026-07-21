/**
 * Schemas Zod pour la validation du bon de livraison (BonLivraison) — Sprint BL.
 *
 * R3 etendu (leçon SC2/ERR) : Prisma = TypeScript = Zod. Tout nouveau champ
 * du modele BonLivraison doit avoir un schema de validation runtime associe.
 */

import { z } from "zod";
import { base64ImageSchema } from "./common.schema";

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
