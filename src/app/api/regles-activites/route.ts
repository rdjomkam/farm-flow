import { NextRequest, NextResponse } from "next/server";
import {
  getReglesActivites,
  createRegleActivite,
} from "@/lib/queries/regles-activites";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { TypeActivite, TypeDeclencheur, Permission } from "@/types";
import type { CreateRegleActiviteDTO, RegleActiviteFilters } from "@/types";

const VALID_TYPE_ACTIVITE = Object.values(TypeActivite);
const VALID_TYPE_DECLENCHEUR = Object.values(TypeDeclencheur);

/**
 * GET /api/regles-activites
 * Liste les regles d'activite du site actif + les regles globales.
 *
 * Query params : typeActivite, typeDeclencheur, isActive
 * Permission : PLANNING_VOIR
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.PLANNING_VOIR);
    const { searchParams } = new URL(request.url);

    const filters: RegleActiviteFilters = {};

    const typeActivite = searchParams.get("typeActivite");
    if (
      typeActivite &&
      VALID_TYPE_ACTIVITE.includes(typeActivite as TypeActivite)
    ) {
      filters.typeActivite = typeActivite as TypeActivite;
    }

    const typeDeclencheur = searchParams.get("typeDeclencheur");
    if (
      typeDeclencheur &&
      VALID_TYPE_DECLENCHEUR.includes(typeDeclencheur as TypeDeclencheur)
    ) {
      filters.typeDeclencheur = typeDeclencheur as TypeDeclencheur;
    }

    const isActive = searchParams.get("isActive");
    if (isActive === "true") filters.isActive = true;
    if (isActive === "false") filters.isActive = false;

    const regles = await getReglesActivites(auth.activeSiteId, filters);

    return NextResponse.json({ regles, total: regles.length });
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
        message: "Erreur serveur lors de la recuperation des regles d'activite.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/regles-activites
 * Cree une nouvelle regle d'activite pour le site actif.
 *
 * Permission : GERER_REGLES_ACTIVITES
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(
      request,
      Permission.GERER_REGLES_ACTIVITES
    );
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    if (!body.nom || typeof body.nom !== "string" || !body.nom.trim()) {
      errors.push({
        field: "nom",
        message: "Le nom de la regle est obligatoire.",
      });
    }

    if (
      !body.typeActivite ||
      !VALID_TYPE_ACTIVITE.includes(body.typeActivite as TypeActivite)
    ) {
      errors.push({
        field: "typeActivite",
        message: `Le type d'activite est obligatoire. Valeurs valides : ${VALID_TYPE_ACTIVITE.join(", ")}`,
      });
    }

    if (
      !body.typeDeclencheur ||
      !VALID_TYPE_DECLENCHEUR.includes(body.typeDeclencheur as TypeDeclencheur)
    ) {
      errors.push({
        field: "typeDeclencheur",
        message: `Le type de declencheur est obligatoire. Valeurs valides : ${VALID_TYPE_DECLENCHEUR.join(", ")}`,
      });
    }

    if (
      !body.titreTemplate ||
      typeof body.titreTemplate !== "string" ||
      !body.titreTemplate.trim()
    ) {
      errors.push({
        field: "titreTemplate",
        message: "Le titre template est obligatoire.",
      });
    }

    // Validate type-specific required fields
    if (body.typeDeclencheur === TypeDeclencheur.RECURRENT) {
      if (
        body.intervalleJours === undefined ||
        typeof body.intervalleJours !== "number" ||
        body.intervalleJours <= 0
      ) {
        errors.push({
          field: "intervalleJours",
          message:
            "intervalleJours est requis et doit etre un entier positif pour un declencheur RECURRENT.",
        });
      }
    }

    if (
      body.typeDeclencheur &&
      [
        TypeDeclencheur.SEUIL_POIDS,
        TypeDeclencheur.SEUIL_QUALITE,
        TypeDeclencheur.SEUIL_MORTALITE,
        TypeDeclencheur.FCR_ELEVE,
      ].includes(body.typeDeclencheur as TypeDeclencheur)
    ) {
      if (
        body.seuilDeclencheur === undefined ||
        typeof body.seuilDeclencheur !== "number"
      ) {
        errors.push({
          field: "seuilDeclencheur",
          message:
            "seuilDeclencheur est requis pour les declencheurs de type SEUIL_* et FCR_ELEVE.",
        });
      }
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

    if (errors.length > 0) {
      return NextResponse.json(
        { status: 400, message: "Erreurs de validation", errors },
        { status: 400 }
      );
    }

    const data: CreateRegleActiviteDTO = {
      nom: body.nom.trim(),
      description: body.description?.trim() || undefined,
      typeActivite: body.typeActivite as TypeActivite,
      typeDeclencheur: body.typeDeclencheur as TypeDeclencheur,
      intervalleJours: body.intervalleJours ?? undefined,
      jourDeclenchement: body.jourDeclenchement ?? undefined,
      seuilDeclencheur: body.seuilDeclencheur ?? undefined,
      comparaison: body.comparaison ?? undefined,
      titreTemplate: body.titreTemplate.trim(),
      instructionsTemplate: body.instructionsTemplate?.trim() || undefined,
      produitRecommandeId: body.produitRecommandeId || undefined,
      quantiteRecommandee: body.quantiteRecommandee ?? undefined,
      priorite: body.priorite ?? undefined,
      phasesCibles: body.phasesCibles ?? undefined,
      debutJour: body.debutJour ?? undefined,
      finJour: body.finJour ?? undefined,
      cooldownJours: body.cooldownJours ?? undefined,
      isActive: body.isActive ?? undefined,
    };

    const regle = await createRegleActivite(
      auth.activeSiteId,
      auth.userId,
      data
    );
    return NextResponse.json(regle, { status: 201 });
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
    if (message.includes("inferieure ou egale")) {
      return NextResponse.json({ status: 400, message }, { status: 400 });
    }
    return NextResponse.json(
      {
        status: 500,
        message: "Erreur serveur lors de la creation de la regle d'activite.",
      },
      { status: 500 }
    );
  }
}
