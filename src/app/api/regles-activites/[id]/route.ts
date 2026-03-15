import { NextRequest, NextResponse } from "next/server";
import {
  getRegleActiviteById,
  updateRegleActivite,
  deleteRegleActivite,
} from "@/lib/queries/regles-activites";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { TypeActivite, TypeDeclencheur, Permission } from "@/types";
import type { UpdateRegleActiviteDTO } from "@/types";

type Params = { params: Promise<{ id: string }> };

const VALID_TYPE_ACTIVITE = Object.values(TypeActivite);
const VALID_TYPE_DECLENCHEUR = Object.values(TypeDeclencheur);

/**
 * GET /api/regles-activites/[id]
 * Retourne le detail d'une regle d'activite.
 *
 * Accessible pour les regles du site actif ET les regles globales (siteId=null).
 * Permission : PLANNING_VOIR
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);
    const { id } = await params;

    const regle = await getRegleActiviteById(id, auth.activeSiteId);
    if (!regle) {
      return NextResponse.json(
        { status: 404, message: "Regle d'activite introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(regle);
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
        message:
          "Erreur serveur lors de la recuperation de la regle d'activite.",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/regles-activites/[id]
 * Met a jour une regle d'activite existante.
 *
 * Les regles globales (siteId=null) sont en lecture seule pour les utilisateurs
 * de site. Seul un ADMIN DKFarm peut les modifier directement via Prisma Studio.
 * Permission : GERER_REGLES_ACTIVITES
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(
      request,
      Permission.GERER_REGLES_ACTIVITES
    );
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (
      body.typeActivite !== undefined &&
      !VALID_TYPE_ACTIVITE.includes(body.typeActivite as TypeActivite)
    ) {
      errors.push({
        field: "typeActivite",
        message: `Valeurs valides : ${VALID_TYPE_ACTIVITE.join(", ")}`,
      });
    }

    if (
      body.typeDeclencheur !== undefined &&
      !VALID_TYPE_DECLENCHEUR.includes(body.typeDeclencheur as TypeDeclencheur)
    ) {
      errors.push({
        field: "typeDeclencheur",
        message: `Valeurs valides : ${VALID_TYPE_DECLENCHEUR.join(", ")}`,
      });
    }

    if (
      body.titreTemplate !== undefined &&
      (typeof body.titreTemplate !== "string" || !body.titreTemplate.trim())
    ) {
      errors.push({
        field: "titreTemplate",
        message: "Le titre template ne peut pas etre vide.",
      });
    }

    if (
      body.priorite !== undefined &&
      (typeof body.priorite !== "number" ||
        body.priorite < 1 ||
        body.priorite > 10)
    ) {
      errors.push({
        field: "priorite",
        message: "La priorite doit etre un entier entre 1 et 10.",
      });
    }

    if (
      body.intervalleJours !== undefined &&
      (typeof body.intervalleJours !== "number" || body.intervalleJours <= 0)
    ) {
      errors.push({
        field: "intervalleJours",
        message: "intervalleJours doit etre un entier positif.",
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: UpdateRegleActiviteDTO = {
      ...(body.nom !== undefined && { nom: body.nom.trim() }),
      ...(body.description !== undefined && {
        description: body.description?.trim() || undefined,
      }),
      ...(body.typeActivite !== undefined && {
        typeActivite: body.typeActivite as TypeActivite,
      }),
      ...(body.typeDeclencheur !== undefined && {
        typeDeclencheur: body.typeDeclencheur as TypeDeclencheur,
      }),
      ...(body.intervalleJours !== undefined && {
        intervalleJours: body.intervalleJours,
      }),
      ...(body.jourDeclenchement !== undefined && {
        jourDeclenchement: body.jourDeclenchement,
      }),
      ...(body.seuilDeclencheur !== undefined && {
        seuilDeclencheur: body.seuilDeclencheur,
      }),
      ...(body.comparaison !== undefined && {
        comparaison: body.comparaison,
      }),
      ...(body.titreTemplate !== undefined && {
        titreTemplate: body.titreTemplate.trim(),
      }),
      ...(body.instructionsTemplate !== undefined && {
        instructionsTemplate: body.instructionsTemplate?.trim() || undefined,
      }),
      ...(body.produitRecommandeId !== undefined && {
        produitRecommandeId: body.produitRecommandeId,
      }),
      ...(body.quantiteRecommandee !== undefined && {
        quantiteRecommandee: body.quantiteRecommandee,
      }),
      ...(body.priorite !== undefined && { priorite: body.priorite }),
      ...(body.phasesCibles !== undefined && {
        phasesCibles: body.phasesCibles,
      }),
      ...(body.debutJour !== undefined && { debutJour: body.debutJour }),
      ...(body.finJour !== undefined && { finJour: body.finJour }),
      ...(body.cooldownJours !== undefined && {
        cooldownJours: body.cooldownJours,
      }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    };

    const regle = await updateRegleActivite(id, auth.activeSiteId, data);
    return NextResponse.json(regle);
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
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (
      message.includes("globales") ||
      message.includes("inferieure ou egale")
    ) {
      return NextResponse.json({ status: 403, message }, { status: 403 });
    }
    return NextResponse.json(
      {
        status: 500,
        message:
          "Erreur serveur lors de la mise a jour de la regle d'activite.",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/regles-activites/[id]
 * Supprime une regle d'activite.
 *
 * Interdit pour les regles globales DKFarm (siteId=null).
 * Permission : GERER_REGLES_ACTIVITES
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(
      request,
      Permission.GERER_REGLES_ACTIVITES
    );
    const { id } = await params;

    const result = await deleteRegleActivite(id, auth.activeSiteId);
    return NextResponse.json(result);
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
    const message =
      error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return NextResponse.json({ status: 404, message }, { status: 404 });
    }
    if (message.includes("globales")) {
      return NextResponse.json({ status: 403, message }, { status: 403 });
    }
    return NextResponse.json(
      {
        status: 500,
        message:
          "Erreur serveur lors de la suppression de la regle d'activite.",
      },
      { status: 500 }
    );
  }
}
