/**
 * src/app/api/webhooks/smobilpay/route.ts
 *
 * Route webhook Smobilpay/Maviance — reçoit les callbacks de paiement.
 *
 * IMPORTANT : Cette route est PUBLIQUE (pas d'authentification utilisateur).
 * La sécurité repose sur la vérification de signature HMAC-SHA256.
 *
 * ADR-016 : Idempotence + vérification signature obligatoire
 * Story 31.3 — Sprint 31
 *
 * Retourne TOUJOURS 200 même en cas d'erreur interne :
 * Smobilpay retentera si on retourne un code d'erreur, provoquant des doubles traitements.
 *
 * R2 : Utiliser StatutPaiementAbo.CONFIRME depuis "@/types"
 */

import { NextRequest, NextResponse } from "next/server";
import { getPaymentGateway } from "@/lib/payment/factory";
import {
  getPaiementByReference,
  confirmerPaiement,
} from "@/lib/queries/paiements-abonnements";
import { activerAbonnement } from "@/lib/queries/abonnements";
import { calculerEtCreerCommission } from "@/lib/services/commissions";
import { prisma } from "@/lib/db";
import { FournisseurPaiement, StatutAbonnement, StatutPaiementAbo } from "@/types";

// ---------------------------------------------------------------------------
// POST /api/webhooks/smobilpay
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Étape 1 : lire le body brut (AVANT tout parsing — nécessaire pour HMAC)
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (readError) {
    console.error("[webhook/smobilpay] Impossible de lire le body :", readError);
    // Retourner 200 pour éviter les retries Smobilpay
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Étape 2 : récupérer la signature depuis les headers
  const signature =
    request.headers.get("x-smobilpay-signature") ??
    request.headers.get("x-maviance-signature") ??
    "";

  // Étape 3 : vérification de signature (AVANT toute action DB)
  const gateway = getPaymentGateway(FournisseurPaiement.SMOBILPAY);
  const signatureValide = gateway.verifySignature(rawBody, signature);

  if (!signatureValide) {
    // Signature invalide — rejeter avec 401
    console.warn("[webhook/smobilpay] Signature invalide — requête rejetée");
    return NextResponse.json(
      { error: "Signature invalide" },
      { status: 401 }
    );
  }

  // Étape 4 : parser le payload et traiter le webhook
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch (parseError) {
    console.error("[webhook/smobilpay] Body JSON invalide :", parseError);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Étape 5 : appeler processWebhook pour extraire referenceExterne + statut
  let referenceExterne: string;
  let statut: StatutPaiementAbo;

  try {
    const result = await gateway.processWebhook({
      referenceExterne: String(payload.payToken ?? payload.referenceExterne ?? ""),
      statut: String(payload.status ?? payload.statut ?? ""),
      signature,
      rawBody,
      headers: Object.fromEntries(request.headers.entries()),
    });

    if (!result.success || !result.referenceExterne || !result.statut) {
      console.warn("[webhook/smobilpay] processWebhook retourne success=false");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    referenceExterne = result.referenceExterne;
    statut = result.statut;
  } catch (processError) {
    console.error("[webhook/smobilpay] Erreur processWebhook :", processError);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Étape 6 : vérifier l'idempotence (paiement déjà traité ?)
  try {
    const paiementExistant = await getPaiementByReference(referenceExterne);

    if ((paiementExistant?.statut as string) === StatutPaiementAbo.CONFIRME) {
      // Déjà confirmé — ignorer silencieusement (idempotence ADR-016)
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Étape 7 : appliquer la transition de statut
    if (statut === StatutPaiementAbo.CONFIRME) {
      // Utiliser les fonctions de query Sprint 30 qui gèrent correctement les enums (R2)
      // Appel séquentiel : confirmerPaiement puis activerAbonnement
      await confirmerPaiement(referenceExterne);

      // Récupérer l'abonnementId pour activer l'abonnement
      const paiementApresConfirm = await getPaiementByReference(referenceExterne);

      if (paiementApresConfirm?.abonnementId) {
        // R4 : activerAbonnement via updateMany conditionnel
        await activerAbonnement(paiementApresConfirm.abonnementId);

        // Sprint 34 : calculer et créer la commission ingénieur si applicable
        // Fire-and-forget : ne pas bloquer le webhook si erreur commission
        calculerEtCreerCommission(
          paiementApresConfirm.abonnementId,
          paiementApresConfirm.id,
          paiementApresConfirm.siteId
        ).catch((commissionError) => {
          console.error(
            "[webhook/smobilpay] Erreur commission (non-bloquant) :",
            commissionError instanceof Error ? commissionError.message : "Erreur inconnue"
          );
        });
      }
    } else if (
      statut === StatutPaiementAbo.ECHEC ||
      statut === StatutPaiementAbo.EXPIRE
    ) {
      // Marquer le paiement comme échoué/expiré (R4 : updateMany)
      // R2 : utiliser StatutPaiementAbo depuis "@/types"
      await prisma.paiementAbonnement.updateMany({
        where: {
          referenceExterne,
          statut: {
            in: [StatutPaiementAbo.EN_ATTENTE, StatutPaiementAbo.INITIE],
          },
        },
        data: { statut },
      });
    }
    // Autres statuts ignorés (EN_ATTENTE, INITIE → pas d'action nécessaire)
  } catch (dbError) {
    // Erreur interne — logger sans exposer les détails
    console.error(
      `[webhook/smobilpay] Erreur DB pour référence ${referenceExterne} :`,
      dbError instanceof Error ? dbError.message : "Erreur inconnue"
    );
    // Retourner 200 pour éviter les retries Smobilpay qui aggraveraient la situation
    return NextResponse.json({ received: true }, { status: 200 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// Seul POST est accepté sur cette route
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Méthode non autorisée" }, { status: 405 });
}
