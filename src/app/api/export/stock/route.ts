/**
 * GET /api/export/stock
 *
 * Génère et télécharge les mouvements de stock en Excel (.xlsx).
 * Query params : dateFrom?, dateTo?, produitId?, type?
 * Permissions requises : STOCK_VOIR + EXPORT_DONNEES
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/api-utils";
import { genererExcelStock } from "@/lib/export/excel-stock";
import { Permission, TypeMouvement, CategorieProduit, UniteStock } from "@/types";
import type { ExportStockExcelDTO, MouvementExcelRow } from "@/types/export";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(
      request,
      Permission.STOCK_VOIR,
      Permission.EXPORT_DONNEES
    );

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const produitId = searchParams.get("produitId");
    const typeParam = searchParams.get("type");

    // Valider le type de mouvement si fourni
    const type =
      typeParam && Object.values(TypeMouvement).includes(typeParam as TypeMouvement)
        ? (typeParam as TypeMouvement)
        : null;

    // Dates par défaut : 90 derniers jours
    const dateDebutFilter = dateFrom
      ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateFinFilter = dateTo ?? new Date().toISOString().slice(0, 10);

    // Récupérer les mouvements avec leurs relations (select étendu pour categorie)
    const mouvements = await prisma.mouvementStock.findMany({
      where: {
        siteId: auth.activeSiteId,
        ...(produitId && { produitId }),
        ...(type && { type }),
        date: {
          gte: new Date(dateDebutFilter),
          lte: new Date(dateFinFilter),
        },
      },
      include: {
        produit: { select: { id: true, nom: true, categorie: true, unite: true } },
        vague: { select: { code: true } },
        commande: { select: { numero: true } },
      },
      orderBy: { date: "asc" },
    });

    // Construire les lignes Excel
    const rows: MouvementExcelRow[] = mouvements.map((m) => ({
      date: m.date,
      nomProduit: m.produit.nom,
      categorieProduit: m.produit.categorie as CategorieProduit,
      type: m.type as TypeMouvement,
      quantite: m.quantite,
      unite: m.produit.unite as UniteStock,
      prixTotal: m.prixTotal,
      codeVague: m.vague?.code ?? null,
      numeroCommande: m.commande?.numero ?? null,
      notes: null, // MouvementStock n'a pas de champ notes pour l'instant
    }));

    // Construire le DTO
    const dto: ExportStockExcelDTO = {
      siteId: auth.activeSiteId,
      produitId: produitId ?? null,
      type: type ?? null,
      categorie: null, // Non filtré par défaut
      dateDebut: new Date(dateDebutFilter),
      dateFin: new Date(dateFinFilter),
      rows,
    };

    // Générer le fichier Excel
    const buffer = genererExcelStock(dto);
    const uint8 = new Uint8Array(buffer);

    const dateStr = new Date().toISOString().slice(0, 10);
    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="mouvements-stock-${dateStr}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError("GET /api/export/stock", error, "Erreur serveur lors de la generation de l'export du stock.");
  }
}
