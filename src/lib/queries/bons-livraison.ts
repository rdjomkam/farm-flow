/**
 * Queries pour le bon de livraison (BonLivraison) — Sprint BL, Story BL.3.
 *
 * Un bon de livraison est cree a partir d'une vente EN_PREPARATION (relation
 * 1:1) et doit etre SIGNE avant que la vente puisse passer LIVREE (guard
 * dans `cloturerVente`, voir src/lib/queries/ventes.ts).
 */

import { prisma } from "@/lib/db";
import { generateNextNumero } from "./numero-utils";
import { ValidationError } from "@/lib/errors";
import { StatutBonLivraison, StatutVente } from "@/types";
import type {
  SignerBonLivraisonDTO,
  BlocPaiementBonLivraison,
} from "@/types";

/** Include standard pour un bon de livraison (detail) */
const BON_LIVRAISON_INCLUDE = {
  vente: {
    include: {
      client: true,
    },
  },
  user: { select: { id: true, name: true } },
} as const;

// ---------------------------------------------------------------------------
// createBonLivraison
// ---------------------------------------------------------------------------

/**
 * Cree un bon de livraison a partir d'une vente.
 *
 * Regles metier :
 * 1. La vente doit exister et appartenir au site
 * 2. La vente doit etre au statut EN_PREPARATION
 * 3. Idempotent : si un BL existe deja pour cette vente, on le retourne
 *    tel quel (pas d'erreur, pas de doublon — relation 1:1 unique en base)
 */
export async function createBonLivraison(
  siteId: string,
  userId: string,
  venteId: string
) {
  return prisma.$transaction(async (tx) => {
    const vente = await tx.vente.findFirst({
      where: { id: venteId, siteId },
      include: { bonLivraison: { select: { id: true } } },
    });
    if (!vente) throw new Error("Vente introuvable");

    // Idempotent : un BL existe deja pour cette vente -> le retourner
    if (vente.bonLivraison) {
      return tx.bonLivraison.findUniqueOrThrow({
        where: { id: vente.bonLivraison.id },
        include: BON_LIVRAISON_INCLUDE,
      });
    }

    if (vente.statut !== StatutVente.EN_PREPARATION) {
      throw new ValidationError(
        "Le bon de livraison ne peut etre cree que pour une vente en preparation."
      );
    }

    const numero = await generateNextNumero(tx, "bonLivraison", "BL", siteId);

    // Prisma 7 prisma-client: split write + include into two calls
    const created = await tx.bonLivraison.create({
      data: {
        numero,
        venteId,
        statut: StatutBonLivraison.BROUILLON,
        userId,
        siteId,
      },
    });

    return tx.bonLivraison.findUniqueOrThrow({
      where: { id: created.id },
      include: BON_LIVRAISON_INCLUDE,
    });
  });
}

// ---------------------------------------------------------------------------
// getBonLivraisonByVente
// ---------------------------------------------------------------------------

/**
 * Recupere le bon de livraison d'une vente avec le bloc paiement calcule
 * (total vente / paye a ce jour / reste a payer).
 *
 * Source du "paye" : Facture.montantPaye si une facture est liee a la vente,
 * sinon 0 (aucun paiement possible sans facture).
 */
export async function getBonLivraisonByVente(siteId: string, venteId: string) {
  const vente = await prisma.vente.findFirst({
    where: { id: venteId, siteId },
    include: {
      client: true,
      facture: { select: { id: true, montantPaye: true } },
      bonLivraison: { include: BON_LIVRAISON_INCLUDE },
      lignes: {
        include: {
          vague: { select: { code: true } },
          bac: { select: { nom: true } },
        },
      },
    },
  });
  if (!vente) throw new Error("Vente introuvable");

  if (!vente.bonLivraison) {
    return null;
  }

  const totalVente = vente.montantTotal;
  const paye = vente.facture ? vente.facture.montantPaye : 0;
  const resteAPayer = Math.max(0, totalVente - paye);

  const blocPaiement: BlocPaiementBonLivraison = {
    totalVente,
    paye,
    resteAPayer,
  };

  return {
    bonLivraison: vente.bonLivraison,
    vente,
    blocPaiement,
  };
}

// ---------------------------------------------------------------------------
// getBonLivraisonForPDF
// ---------------------------------------------------------------------------

/** Include pour la generation du PDF : lignes vente + assets promoteur du site */
const BON_LIVRAISON_PDF_INCLUDE = {
  vente: {
    include: {
      client: true,
      facture: { select: { id: true, montantPaye: true } },
      lignes: {
        include: {
          vague: { select: { code: true } },
          bac: { select: { nom: true } },
          lotAlevins: { select: { code: true } },
        },
      },
    },
  },
  user: { select: { id: true, name: true } },
  site: {
    select: {
      name: true,
      address: true,
      signaturePromoteur: true,
      cachet: true,
    },
  },
} as const;

/**
 * Recupere un bon de livraison par son id (avec toutes les donnees
 * necessaires au rendu PDF : lignes vente, bloc paiement, assets site).
 * Retourne `null` si introuvable ou si le BL n'appartient pas au site.
 */
export async function getBonLivraisonForPDF(siteId: string, id: string) {
  const bonLivraison = await prisma.bonLivraison.findFirst({
    where: { id, siteId },
    include: BON_LIVRAISON_PDF_INCLUDE,
  });
  if (!bonLivraison) return null;

  const totalVente = bonLivraison.vente.montantTotal;
  const paye = bonLivraison.vente.facture
    ? bonLivraison.vente.facture.montantPaye
    : 0;
  const resteAPayer = Math.max(0, totalVente - paye);

  const blocPaiement: BlocPaiementBonLivraison = {
    totalVente,
    paye,
    resteAPayer,
  };

  return { bonLivraison, blocPaiement };
}

// ---------------------------------------------------------------------------
// signerBonLivraison
// ---------------------------------------------------------------------------

/**
 * Signe un bon de livraison (client + livreur).
 *
 * Regles metier :
 * 1. Le BL doit exister et appartenir au site
 * 2. Le BL doit etre BROUILLON ou EN_ATTENTE_SIGNATURE (pas deja SIGNE)
 * 3. Transaction atomique (R4) : statut -> SIGNE, signeLe = now, signatures persistees
 */
export async function signerBonLivraison(
  siteId: string,
  userId: string,
  bonLivraisonId: string,
  dto: SignerBonLivraisonDTO
) {
  return prisma.$transaction(async (tx) => {
    const bonLivraison = await tx.bonLivraison.findFirst({
      where: { id: bonLivraisonId, siteId },
    });
    if (!bonLivraison) throw new Error("Bon de livraison introuvable");

    if (bonLivraison.statut === StatutBonLivraison.SIGNE) {
      throw new ValidationError("Ce bon de livraison est deja signe.");
    }

    // R4 : operation atomique — updateMany avec conditions plutot que check-then-update
    const result = await tx.bonLivraison.updateMany({
      where: {
        id: bonLivraisonId,
        siteId,
        statut: { not: StatutBonLivraison.SIGNE },
      },
      data: {
        statut: StatutBonLivraison.SIGNE,
        signatureClient: dto.signatureClient,
        signataireClientNom: dto.signataireClientNom,
        signatureLivreur: dto.signatureLivreur,
        signeLe: new Date(),
      },
    });

    if (result.count === 0) {
      throw new ValidationError("Ce bon de livraison est deja signe.");
    }

    // Prisma 7 prisma-client: split write + include into two calls
    return tx.bonLivraison.findUniqueOrThrow({
      where: { id: bonLivraisonId },
      include: BON_LIVRAISON_INCLUDE,
    });
  });
}
