import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  uploadFile,
  validateFile,
  generateFactureKey,
  deleteFile,
  getSignedUrl,
  extractFileNameFromKey,
} from "@/lib/storage";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/depenses/[id]/upload
 * Upload ou remplace la facture d'une depense sur Hetzner Object Storage.
 *
 * Body : FormData avec champ "file" (PDF, JPG, PNG — max 10 Mo)
 * Retourne : { url, fileName } (URL presignee, expire apres 1h)
 *
 * Si une facture existe deja, l'ancienne est supprimee de S3.
 *
 * Permission : DEPENSES_CREER
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_CREER);
    const { id } = await params;

    // Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { status: 400, message: "FormData invalide." },
        { status: 400 }
      );
    }

    const fileRaw = formData.get("file");
    if (!(fileRaw instanceof File)) {
      return NextResponse.json(
        { status: 400, message: "Le champ 'file' est obligatoire." },
        { status: 400 }
      );
    }

    // Validate file
    try {
      validateFile({ size: fileRaw.size, type: fileRaw.type, name: fileRaw.name });
    } catch (err) {
      return NextResponse.json(
        {
          status: 400,
          message: err instanceof Error ? err.message : "Fichier invalide.",
        },
        { status: 400 }
      );
    }

    // Verify depense belongs to site
    const depense = await prisma.depense.findFirst({
      where: { id, siteId: auth.activeSiteId },
      select: { id: true, factureUrl: true },
    });

    if (!depense) {
      return NextResponse.json(
        { status: 404, message: "Depense introuvable." },
        { status: 404 }
      );
    }

    // Delete old file if exists
    if (depense.factureUrl) {
      try {
        await deleteFile(depense.factureUrl);
      } catch {
        // Non-fatal: old file may already be gone
        console.error(`[depense/upload] Erreur suppression ancienne facture ${depense.factureUrl}`);
      }
    }

    // Upload new file
    const key = generateFactureKey(`dep-${id}`, fileRaw.name);
    const buffer = Buffer.from(await fileRaw.arrayBuffer());
    await uploadFile(key, buffer, fileRaw.type);

    // Save key in DB
    await prisma.depense.updateMany({
      where: { id, siteId: auth.activeSiteId },
      data: { factureUrl: key },
    });

    // Generate signed URL for immediate display
    const url = await getSignedUrl(key);
    const fileName = extractFileNameFromKey(key);

    return NextResponse.json({ url, fileName }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de l'upload de la facture.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/depenses/[id]/upload
 * Recupere une URL presignee pour acceder a la facture d'une depense.
 *
 * Permission : DEPENSES_VOIR
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_VOIR);
    const { id } = await params;

    const depense = await prisma.depense.findFirst({
      where: { id, siteId: auth.activeSiteId },
      select: { id: true, factureUrl: true },
    });

    if (!depense) {
      return NextResponse.json(
        { status: 404, message: "Depense introuvable." },
        { status: 404 }
      );
    }

    if (!depense.factureUrl) {
      return NextResponse.json(
        { status: 404, message: "Aucune facture associee a cette depense." },
        { status: 404 }
      );
    }

    const url = await getSignedUrl(depense.factureUrl);
    const fileName = extractFileNameFromKey(depense.factureUrl);

    return NextResponse.json({ url, fileName });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la recuperation de la facture.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/depenses/[id]/upload
 * Supprime la facture d'une depense de S3 et efface l'URL en DB.
 *
 * Permission : DEPENSES_CREER
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_CREER);
    const { id } = await params;

    const depense = await prisma.depense.findFirst({
      where: { id, siteId: auth.activeSiteId },
      select: { id: true, factureUrl: true },
    });

    if (!depense) {
      return NextResponse.json(
        { status: 404, message: "Depense introuvable." },
        { status: 404 }
      );
    }

    if (!depense.factureUrl) {
      return NextResponse.json(
        { status: 404, message: "Aucune facture associee a cette depense." },
        { status: 404 }
      );
    }

    // Delete from S3
    await deleteFile(depense.factureUrl);

    // Clear URL in DB
    await prisma.depense.updateMany({
      where: { id, siteId: auth.activeSiteId },
      data: { factureUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { status: 401, message: error.message },
        { status: 401 }
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { status: 403, message: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la suppression de la facture.",
      },
      { status: 500 }
    );
  }
}
