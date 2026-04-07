import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { Permission } from "@/types";
import { uploadFile,
  deleteFile,
  getSignedUrl,
  validateFile,
  generateStorageKey,
  extractFileNameFromKey } from "@/lib/storage";
import { apiError, handleApiError } from "@/lib/api-utils";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/commandes/[id]/facture
 * Upload une facture fournisseur (PDF, JPG, PNG — max 10 Mo) sur la commande.
 * La commande doit exister et appartenir au site actif de l'utilisateur.
 * Si une facture existait déjà, elle est remplacée (ancien fichier supprimé).
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;

    // Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return apiError(400, "Le corps de la requête doit être un FormData avec un champ 'file'.");
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return apiError(400, "Champ 'file' manquant dans le FormData.");
    }

    // Validation côté serveur (MIME + taille)
    try {
      validateFile({ size: file.size, type: file.type, name: file.name });
    } catch (err) {
      return apiError(400, err instanceof Error ? err.message : "Fichier invalide.");
    }

    // Vérifier que la commande appartient au site
    const commande = await prisma.commande.findFirst({
      where: { id, siteId: auth.activeSiteId },
      select: { id: true, factureUrl: true },
    });

    if (!commande) {
      return apiError(404, "Commande introuvable.");
    }

    // Supprimer l'ancienne facture si elle existe
    if (commande.factureUrl) {
      try {
        await deleteFile(commande.factureUrl);
      } catch {
        // Ignorer les erreurs de suppression de l'ancien fichier (peut déjà être supprimé)
      }
    }

    // Upload le nouveau fichier
    const key = generateStorageKey(auth.activeSiteId, "factures", id, file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadFile(key, buffer, file.type);

    // Sauvegarder la clé S3 en base
    await prisma.commande.updateMany({
      where: { id, siteId: auth.activeSiteId },
      data: { factureUrl: key },
    });

    // Générer une signed URL pour la réponse
    const url = await getSignedUrl(key);

    return NextResponse.json(
      { url, fileName: extractFileNameFromKey(key) },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError("POST /api/commandes/[id]/facture", error, "Erreur serveur.");
  }
}

/**
 * GET /api/commandes/[id]/facture
 * Retourne une signed URL (expire après 1h) pour accéder à la facture.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_VOIR);
    const { id } = await params;

    const commande = await prisma.commande.findFirst({
      where: { id, siteId: auth.activeSiteId },
      select: { id: true, factureUrl: true },
    });

    if (!commande) {
      return apiError(404, "Commande introuvable.");
    }

    if (!commande.factureUrl) {
      return apiError(404, "Aucune facture attachée à cette commande.");
    }

    const url = await getSignedUrl(commande.factureUrl);
    const fileName = extractFileNameFromKey(commande.factureUrl);

    return NextResponse.json({ url, fileName });
  } catch (error) {
    return handleApiError("GET /api/commandes/[id]/facture", error, "Erreur serveur.");
  }
}

/**
 * DELETE /api/commandes/[id]/facture
 * Supprime la facture : supprime le fichier sur Hetzner + met factureUrl à null en DB.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;

    const commande = await prisma.commande.findFirst({
      where: { id, siteId: auth.activeSiteId },
      select: { id: true, factureUrl: true },
    });

    if (!commande) {
      return apiError(404, "Commande introuvable.");
    }

    if (!commande.factureUrl) {
      return apiError(404, "Aucune facture attachée à cette commande.");
    }

    // Supprimer le fichier sur Hetzner
    await deleteFile(commande.factureUrl);

    // Mettre factureUrl à null en base
    await prisma.commande.updateMany({
      where: { id, siteId: auth.activeSiteId },
      data: { factureUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError("DELETE /api/commandes/[id]/facture", error, "Erreur serveur.");
  }
}
