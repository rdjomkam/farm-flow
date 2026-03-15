import { NextRequest, NextResponse } from "next/server";
import { recevoirCommande } from "@/lib/queries/commandes";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { Permission } from "@/types";
import {
  uploadFile,
  validateFile,
  generateFactureKey,
} from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/commandes/[id]/recevoir
 * Réceptionne une commande ENVOYEE : met à jour le stock (mouvements ENTREE) et passe la commande en LIVREE.
 *
 * Accepte JSON (comportement inchangé) ou FormData avec un fichier facture optionnel.
 * Si un fichier est fourni, il est uploadé sur Hetzner et factureUrl est sauvegardé en DB.
 *
 * FormData champs :
 *   - dateLivraison (string, optionnel) — date de livraison ISO
 *   - file (File, optionnel) — facture fournisseur (PDF, JPG, PNG — max 10 Mo)
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.APPROVISIONNEMENT_GERER);
    const { id } = await params;

    // Déterminer le format de la requête (FormData ou JSON)
    const contentType = request.headers.get("content-type") ?? "";
    let dateLivraison: string | undefined;
    let file: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      // FormData — peut contenir un fichier facture
      let formData: FormData;
      try {
        formData = await request.formData();
      } catch {
        return NextResponse.json(
          { status: 400, message: "FormData invalide." },
          { status: 400 }
        );
      }

      const dateLivraisonRaw = formData.get("dateLivraison");
      if (dateLivraisonRaw && typeof dateLivraisonRaw === "string") {
        dateLivraison = dateLivraisonRaw;
      }

      const fileRaw = formData.get("file");
      if (fileRaw instanceof File) {
        file = fileRaw;
      }
    } else {
      // JSON — comportement inchangé (rétro-compatible)
      const body = await request.json().catch(() => ({}));
      if (body.dateLivraison && typeof body.dateLivraison === "string") {
        dateLivraison = body.dateLivraison;
      }
    }

    // Valider la date de livraison si fournie
    if (dateLivraison && isNaN(Date.parse(dateLivraison))) {
      return NextResponse.json(
        { status: 400, message: "La date de livraison n'est pas valide." },
        { status: 400 }
      );
    }

    // Valider le fichier facture si fourni
    if (file) {
      try {
        validateFile({ size: file.size, type: file.type, name: file.name });
      } catch (err) {
        return NextResponse.json(
          { status: 400, message: err instanceof Error ? err.message : "Fichier invalide." },
          { status: 400 }
        );
      }
    }

    // Réceptionner la commande (transaction : mouvements stock + statut LIVREE + dépense auto-créée)
    const { commande, depense } = await recevoirCommande(
      id,
      auth.activeSiteId,
      auth.userId,
      dateLivraison
    );

    // Si un fichier facture est fourni, l'uploader et sauvegarder l'URL
    if (file) {
      try {
        const key = generateFactureKey(id, file.name);
        const buffer = Buffer.from(await file.arrayBuffer());
        await uploadFile(key, buffer, file.type);

        await prisma.commande.updateMany({
          where: { id, siteId: auth.activeSiteId },
          data: { factureUrl: key },
        });
      } catch {
        // En cas d'erreur d'upload, la réception est quand même validée (stock mis à jour)
        // Logguer l'erreur mais ne pas faire échouer la requête
        console.error(`[recevoir] Erreur upload facture pour commande ${id}`);
      }
    }

    return NextResponse.json({ commande, depense });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ status: 401, message: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ status: 403, message: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (message.includes("Impossible")) {
      return NextResponse.json({ status: 409, message }, { status: 409 });
    }
    return NextResponse.json(
      { status: 500, message: "Erreur serveur lors de la reception de la commande." },
      { status: 500 }
    );
  }
}
