import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/permissions";
import { CategorieDepense, Permission, StatutDepense } from "@/types";
import { prisma } from "@/lib/db";
import { generateNextNumero } from "@/lib/queries/numero-utils";
import { apiError, handleApiError } from "@/lib/api-utils";

const VALID_CATEGORIES = Object.values(CategorieDepense);

/**
 * GET /api/ventes/[id]/depenses
 * Liste les depenses liees a une vente.
 *
 * Permission : DEPENSES_VOIR
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_VOIR);
    const { id } = await params;

    // Verifier que la vente existe et appartient au site
    const vente = await prisma.vente.findFirst({
      where: { id, siteId: auth.activeSiteId },
      select: { id: true },
    });
    if (!vente) return apiError(404, "Vente introuvable");

    const depenses = await prisma.depense.findMany({
      where: { venteId: id, siteId: auth.activeSiteId },
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ data: depenses });
  } catch (error) {
    return handleApiError(
      "GET /api/ventes/[id]/depenses",
      error,
      "Erreur lors de la recuperation des depenses de la vente."
    );
  }
}

/**
 * POST /api/ventes/[id]/depenses
 * Cree une depense liee a une vente specifique.
 *
 * Permission : DEPENSES_CREER
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, Permission.DEPENSES_CREER);
    const { id } = await params;

    // Verifier que la vente existe et appartient au site
    const vente = await prisma.vente.findFirst({
      where: { id, siteId: auth.activeSiteId },
      select: { id: true },
    });
    if (!vente) return apiError(404, "Vente introuvable");

    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.description || typeof body.description !== "string" || body.description.trim() === "") {
      errors.push({ field: "description", message: "La description est obligatoire." });
    }

    if (
      !body.categorieDepense ||
      !VALID_CATEGORIES.includes(body.categorieDepense as CategorieDepense)
    ) {
      errors.push({
        field: "categorieDepense",
        message: `La categorie est obligatoire. Valeurs valides : ${VALID_CATEGORIES.join(", ")}`,
      });
    }

    if (
      body.montantTotal === undefined ||
      typeof body.montantTotal !== "number" ||
      body.montantTotal <= 0
    ) {
      errors.push({
        field: "montantTotal",
        message: "Le montant total doit etre un nombre positif.",
      });
    }

    if (
      !body.date ||
      typeof body.date !== "string" ||
      isNaN(Date.parse(body.date))
    ) {
      errors.push({
        field: "date",
        message: "La date est obligatoire (format ISO 8601).",
      });
    }

    if (errors.length > 0) {
      return apiError(400, "Erreurs de validation", { errors });
    }

    const montantTotal: number = body.montantTotal;
    const montantPaye: number =
      typeof body.montantPaye === "number" ? body.montantPaye : 0;

    // Calculer le statut initial selon montantPaye
    let statut: StatutDepense;
    if (montantPaye >= montantTotal) {
      statut = StatutDepense.PAYEE;
    } else if (montantPaye > 0) {
      statut = StatutDepense.PAYEE_PARTIELLEMENT;
    } else {
      statut = StatutDepense.NON_PAYEE;
    }

    const depense = await prisma.$transaction(async (tx) => {
      const numero = await generateNextNumero(tx, "depense", "DEP", auth.activeSiteId);

      const created = await tx.depense.create({
        data: {
          numero,
          description: body.description.trim(),
          categorieDepense: body.categorieDepense as CategorieDepense,
          montantTotal,
          montantPaye,
          statut,
          date: new Date(body.date),
          dateEcheance: body.dateEcheance ? new Date(body.dateEcheance) : null,
          venteId: id,
          // vagueId reste null (XOR avec venteId)
          vagueId: null,
          notes: body.notes?.trim() ?? null,
          userId: auth.userId,
          siteId: auth.activeSiteId,
        },
      });

      return tx.depense.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          user: { select: { id: true, name: true } },
          vente: { select: { id: true, numero: true } },
        },
      });
    });

    return NextResponse.json(depense, { status: 201 });
  } catch (error) {
    return handleApiError(
      "POST /api/ventes/[id]/depenses",
      error,
      "Erreur lors de la creation de la depense."
    );
  }
}
