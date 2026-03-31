import { NextRequest, NextResponse } from "next/server";
import {
  getRegleActiviteById,
  updateRegleActivite,
  deleteRegleActivite,
} from "@/lib/queries/regles-activites";
import { apiError } from "@/lib/api-utils";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { ActionRegle, SeveriteAlerte, TypeActivite, TypeDeclencheur, OperateurCondition, LogiqueCondition, Permission } from "@/types";
import { validateTemplatePlaceholders, VALID_ACTION_PAYLOAD_TYPES } from "@/lib/regles-activites-constants";
import type { UpdateRegleActiviteDTO } from "@/types";

const VALID_OPERATEUR_PUT = Object.values(OperateurCondition);
const VALID_LOGIQUE_PUT = Object.values(LogiqueCondition);
const VALID_TYPE_DECLENCHEUR_PUT = Object.values(TypeDeclencheur);
const VALID_ACTION_REGLE_PUT = Object.values(ActionRegle);
const VALID_SEVERITE_PUT = Object.values(SeveriteAlerte);

type Params = { params: Promise<{ id: string }> };

const VALID_TYPE_ACTIVITE = Object.values(TypeActivite);
const VALID_TYPE_DECLENCHEUR = Object.values(TypeDeclencheur);

/**
 * GET /api/regles-activites/[id]
 * Retourne le detail d'une regle d'activite avec _count.activites.
 *
 * Accessible pour les regles du site actif ET les regles globales (siteId=null).
 * Permission : REGLES_ACTIVITES_VOIR
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.REGLES_ACTIVITES_VOIR);
    const { id } = await params;

    const regle = await getRegleActiviteById(id, auth.activeSiteId);
    if (!regle) {
      return apiError(404, "Regle d'activite introuvable.");
    }

    return NextResponse.json({ regle });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, error.message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, error.message);
    }
    console.error("[GET /api/regles-activites/[id]]", error);
    return apiError(500, "Erreur serveur lors de la recuperation de la regle d'activite.");
  }
}

/**
 * PUT /api/regles-activites/[id]
 * Met a jour une regle d'activite site-specifique.
 *
 * Les regles globales (siteId=null) ne peuvent pas etre modifiees via API.
 * Valide les templates avec validateTemplatePlaceholders() — log warning si inconnu.
 * Permission : GERER_REGLES_ACTIVITES
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.GERER_REGLES_ACTIVITES);
    const { id } = await params;
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // --- Optional field validations ---
    if (body.typeActivite !== undefined && !VALID_TYPE_ACTIVITE.includes(body.typeActivite as TypeActivite)) {
      errors.push({
        field: "typeActivite",
        message: `Valeur invalide. Valeurs valides : ${VALID_TYPE_ACTIVITE.join(", ")}`,
      });
    }

    if (body.typeDeclencheur !== undefined && !VALID_TYPE_DECLENCHEUR.includes(body.typeDeclencheur as TypeDeclencheur)) {
      errors.push({
        field: "typeDeclencheur",
        message: `Valeur invalide. Valeurs valides : ${VALID_TYPE_DECLENCHEUR.join(", ")}`,
      });
    }

    if (
      body.titreTemplate !== undefined &&
      (typeof body.titreTemplate !== "string" || body.titreTemplate.trim().length < 5 || body.titreTemplate.length > 200)
    ) {
      errors.push({
        field: "titreTemplate",
        message: "Le titre template doit contenir entre 5 et 200 caracteres.",
      });
    }

    if (
      body.priorite !== undefined &&
      (typeof body.priorite !== "number" || !Number.isInteger(body.priorite) || body.priorite < 1 || body.priorite > 10)
    ) {
      errors.push({
        field: "priorite",
        message: "La priorite doit etre un entier entre 1 et 10.",
      });
    }

    if (
      body.intervalleJours !== undefined &&
      (typeof body.intervalleJours !== "number" || !Number.isInteger(body.intervalleJours) || body.intervalleJours <= 0)
    ) {
      errors.push({
        field: "intervalleJours",
        message: "intervalleJours doit etre un entier strictement positif.",
      });
    }

    if (
      body.conditionValeur !== undefined &&
      body.conditionValeur2 !== undefined &&
      typeof body.conditionValeur === "number" &&
      typeof body.conditionValeur2 === "number" &&
      body.conditionValeur2 <= body.conditionValeur
    ) {
      errors.push({
        field: "conditionValeur2",
        message: "conditionValeur2 doit etre superieure a conditionValeur.",
      });
    }

    if (
      body.description !== undefined &&
      (typeof body.description !== "string" || body.description.length > 500)
    ) {
      errors.push({ field: "description", message: "La description ne doit pas depasser 500 caracteres." });
    }

    if (
      body.descriptionTemplate !== undefined &&
      (typeof body.descriptionTemplate !== "string" || body.descriptionTemplate.length > 500)
    ) {
      errors.push({ field: "descriptionTemplate", message: "Le template de description ne doit pas depasser 500 caracteres." });
    }

    if (
      body.instructionsTemplate !== undefined &&
      (typeof body.instructionsTemplate !== "string" || body.instructionsTemplate.length > 5000)
    ) {
      errors.push({ field: "instructionsTemplate", message: "Le template d'instructions ne doit pas depasser 5000 caracteres." });
    }

    if (body.logique !== undefined && !VALID_LOGIQUE_PUT.includes(body.logique as LogiqueCondition)) {
      errors.push({ field: "logique", message: `Valeur invalide. Valeurs valides : ${VALID_LOGIQUE_PUT.join(", ")}` });
    }

    // --- actionType & notification fields validation ---
    if (body.actionType !== undefined && !VALID_ACTION_REGLE_PUT.includes(body.actionType as ActionRegle)) {
      errors.push({
        field: "actionType",
        message: `Valeur invalide. Valeurs valides : ${VALID_ACTION_REGLE_PUT.join(", ")}`,
      });
    }

    if (body.actionType !== undefined) {
      const actionTypeValue = body.actionType as ActionRegle;
      const needsNotification = actionTypeValue === ActionRegle.NOTIFICATION || actionTypeValue === ActionRegle.LES_DEUX;
      if (needsNotification) {
        if (body.severite !== undefined && !VALID_SEVERITE_PUT.includes(body.severite as SeveriteAlerte)) {
          errors.push({ field: "severite", message: `Valeur invalide. Valeurs valides : ${VALID_SEVERITE_PUT.join(", ")}` });
        }
        if (body.severite === undefined || body.severite === null) {
          errors.push({ field: "severite", message: "severite est requis pour les actions NOTIFICATION et LES_DEUX." });
        }
        if (!body.titreNotificationTemplate || typeof body.titreNotificationTemplate !== "string" || body.titreNotificationTemplate.trim().length < 5) {
          errors.push({ field: "titreNotificationTemplate", message: "titreNotificationTemplate est requis (min 5 caracteres) pour les actions NOTIFICATION et LES_DEUX." });
        }
      }
    }

    if (body.severite !== undefined && body.severite !== null && !VALID_SEVERITE_PUT.includes(body.severite as SeveriteAlerte)) {
      errors.push({ field: "severite", message: `Valeur invalide. Valeurs valides : ${VALID_SEVERITE_PUT.join(", ")}` });
    }

    if (body.titreNotificationTemplate !== undefined && body.titreNotificationTemplate !== null) {
      if (typeof body.titreNotificationTemplate !== "string" || body.titreNotificationTemplate.length > 200) {
        errors.push({ field: "titreNotificationTemplate", message: "titreNotificationTemplate ne doit pas depasser 200 caracteres." });
      }
    }

    if (body.descriptionNotificationTemplate !== undefined && body.descriptionNotificationTemplate !== null) {
      if (typeof body.descriptionNotificationTemplate !== "string" || body.descriptionNotificationTemplate.length > 500) {
        errors.push({ field: "descriptionNotificationTemplate", message: "descriptionNotificationTemplate ne doit pas depasser 500 caracteres." });
      }
    }

    if (body.actionPayloadType !== undefined && body.actionPayloadType !== null && body.actionPayloadType !== "") {
      if (!VALID_ACTION_PAYLOAD_TYPES.includes(body.actionPayloadType as typeof VALID_ACTION_PAYLOAD_TYPES[number])) {
        errors.push({
          field: "actionPayloadType",
          message: `Valeur invalide. Valeurs valides : ${VALID_ACTION_PAYLOAD_TYPES.join(", ")} (ou null pour aucune action).`,
        });
      }
    }

    if (body.conditions !== undefined) {
      if (!Array.isArray(body.conditions)) {
        errors.push({ field: "conditions", message: "conditions doit etre un tableau." });
      } else {
        body.conditions.forEach((c: unknown, idx: number) => {
          const cond = c as Record<string, unknown>;
          if (!cond.typeDeclencheur || !VALID_TYPE_DECLENCHEUR_PUT.includes(cond.typeDeclencheur as TypeDeclencheur)) {
            errors.push({ field: `conditions[${idx}].typeDeclencheur`, message: "typeDeclencheur invalide." });
          }
          if (!cond.operateur || !VALID_OPERATEUR_PUT.includes(cond.operateur as OperateurCondition)) {
            errors.push({ field: `conditions[${idx}].operateur`, message: "operateur invalide." });
          }
          if (cond.conditionValeur !== null && cond.conditionValeur !== undefined && typeof cond.conditionValeur !== "number") {
            errors.push({ field: `conditions[${idx}].conditionValeur`, message: "conditionValeur doit etre un nombre ou null." });
          }
          if (cond.conditionValeur2 !== null && cond.conditionValeur2 !== undefined && typeof cond.conditionValeur2 !== "number") {
            errors.push({ field: `conditions[${idx}].conditionValeur2`, message: "conditionValeur2 doit etre un nombre ou null." });
          }
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Donnees invalides.", errors },
        { status: 400 }
      );
    }

    // --- Validate template placeholders (warn only, never reject) ---
    const templates = [
      body.titreTemplate,
      body.descriptionTemplate,
      body.instructionsTemplate,
    ].filter((t): t is string => typeof t === "string" && t.length > 0);

    for (const template of templates) {
      const { valid, unknown } = validateTemplatePlaceholders(template);
      if (!valid) {
        console.warn(
          `[PUT /api/regles-activites/${id}] Placeholders inconnus dans le template: ${unknown.join(", ")}`
        );
      }
    }

    const data: UpdateRegleActiviteDTO = {
      ...(body.nom !== undefined && { nom: (body.nom as string).trim() }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.typeActivite !== undefined && { typeActivite: body.typeActivite as TypeActivite }),
      ...(body.typeDeclencheur !== undefined && { typeDeclencheur: body.typeDeclencheur as TypeDeclencheur }),
      ...(body.conditionValeur !== undefined && { conditionValeur: body.conditionValeur }),
      ...(body.conditionValeur2 !== undefined && { conditionValeur2: body.conditionValeur2 }),
      ...(body.phaseMin !== undefined && { phaseMin: body.phaseMin }),
      ...(body.phaseMax !== undefined && { phaseMax: body.phaseMax }),
      ...(body.intervalleJours !== undefined && { intervalleJours: body.intervalleJours }),
      ...(body.titreTemplate !== undefined && { titreTemplate: (body.titreTemplate as string).trim() }),
      ...(body.descriptionTemplate !== undefined && { descriptionTemplate: body.descriptionTemplate }),
      ...(body.instructionsTemplate !== undefined && { instructionsTemplate: body.instructionsTemplate }),
      ...(body.priorite !== undefined && { priorite: body.priorite }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.logique !== undefined && { logique: body.logique as LogiqueCondition }),
      ...(body.conditions !== undefined && { conditions: body.conditions }),
      // Sprint 29 — actionType & notification fields
      ...(body.actionType !== undefined && { actionType: body.actionType as ActionRegle }),
      ...(body.severite !== undefined && { severite: body.severite as SeveriteAlerte }),
      ...(body.titreNotificationTemplate !== undefined && { titreNotificationTemplate: body.titreNotificationTemplate }),
      ...(body.descriptionNotificationTemplate !== undefined && { descriptionNotificationTemplate: body.descriptionNotificationTemplate }),
      ...("actionPayloadType" in body && { actionPayloadType: body.actionPayloadType ?? null }),
    };

    const regle = await updateRegleActivite(id, auth.activeSiteId, data, {
      allowGlobal: auth.permissions.includes(Permission.GERER_REGLES_GLOBALES),
    });
    if (!regle) {
      return apiError(404, "Regle d'activite introuvable.");
    }

    return NextResponse.json({ regle });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, (error as Error).message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, (error as Error).message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    if (message.includes("globales DKFarm")) {
      return apiError(403, message);
    }
    if (message.includes("phaseMin") || message.includes("inferieure ou egale")) {
      return apiError(400, message);
    }
    console.error("[PUT /api/regles-activites/[id]]", error);
    return apiError(500, "Erreur serveur lors de la mise a jour de la regle d'activite.");
  }
}

/**
 * DELETE /api/regles-activites/[id]
 * Supprime une regle d'activite site-specifique.
 *
 * Retourne 409 si la regle est globale (siteId=null) ou si des activites sont liees.
 * Retourne 404 si la regle n'existe pas ou appartient a un autre site.
 * Permission : GERER_REGLES_ACTIVITES
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePermission(request, Permission.GERER_REGLES_ACTIVITES);
    const { id } = await params;

    const result = await deleteRegleActivite(id, auth.activeSiteId);

    if ("error" in result) {
      if (result.error === "global") {
        return apiError(409, "Les regles globales DKFarm ne peuvent pas etre supprimees. Desactivez-la plutot.");
      }
      if (result.error === "linked") {
        return apiError(409, "Impossible de supprimer cette regle : des activites y sont liees.");
      }
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(401, (error as Error).message);
    }
    if (error instanceof ForbiddenError) {
      return apiError(403, (error as Error).message);
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("introuvable")) {
      return apiError(404, message);
    }
    console.error("[DELETE /api/regles-activites/[id]]", error);
    return apiError(500, "Erreur serveur lors de la suppression de la regle d'activite.");
  }
}
