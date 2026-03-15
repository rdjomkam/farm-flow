import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import {
  uploadFile,
  deleteFile,
  getSignedUrl,
  validateFile,
  generateFactureKey,
  extractFileNameFromKey,
} from "@/lib/storage";

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
      return NextResponse.json(
        { status: 400, message: "Le corps de la requête doit être un FormData avec un champ 'file'." },
        { status: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { status: 400, message: "Champ 'file' manquant dans le FormData." },
        { status: 400 }
      );
    }

    // Validation côté serveur (MIME + taille)
    try {
      validateFile({ size: file.size, type: file.type, name: file.name });
    } catch (err) {
      return NextResponse.json(
        { status: 400, message: err instanceof Error ? err.message : "Fichier invalide." },
        { status: 400 }
      );
    }

    // Vérifier que la commande appartient au site
    const commande = await prisma.commande.findFirst({
      where: { id, siteId: auth.activeSiteId },
      select: { id: true, factureUrl: true },
    });

    if (!commande) {
      return NextResponse.json(
        { status: 404, message: "Commande introuvable." },
        { status: 404 }
      );
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
    const key = generateFactureKey(id, file.name);
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
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}

/**
 * GET /api/commandes/[id]/facture
 * Retourne une signed URL (expire après 1h) pour accéder à la facture.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;

    const commande = await prisma.commande.findFirst({
      where: { id, siteId: auth.activeSiteId },
      select: { id: true, factureUrl: true },
    });

    if (!commande) {
      return NextResponse.json(
        { status: 404, message: "Commande introuvable." },
        { status: 404 }
      );
    }

    if (!commande.factureUrl) {
      return NextResponse.json(
        { status: 404, message: "Aucune facture attachée à cette commande." },
        { status: 404 }
      );
    }

    const url = await getSignedUrl(commande.factureUrl);
    const fileName = extractFileNameFromKey(commande.factureUrl);

    return NextResponse.json({ url, fileName });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json({ status: 500, message }, { status: 500 });
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
      return NextResponse.json(
        { status: 404, message: "Commande introuvable." },
        { status: 404 }
      );
    }

    if (!commande.factureUrl) {
      return NextResponse.json(
        { status: 404, message: "Aucune facture attachée à cette commande." },
        { status: 404 }
      );
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
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json({ status: 500, message }, { status: 500 });
  }
}
