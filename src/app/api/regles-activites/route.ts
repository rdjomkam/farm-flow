import { NextRequest, NextResponse } from "next/server";
import {
  getReglesActivites,
  createRegleActivite,
} from "@/lib/queries/regles-activites";
import { AuthError } from "@/lib/auth";
import { requirePermission, ForbiddenError } from "@/lib/permissions";
import { ActionRegle, SeveriteAlerte, TypeActivite, TypeDeclencheur, OperateurCondition, LogiqueCondition, Permission } from "@/types";
import { validateTemplatePlaceholders, SEUIL_TYPES_FIREDONCE, VALID_ACTION_PAYLOAD_TYPES } from "@/lib/regles-activites-constants";
import type { CreateRegleActiviteDTO, RegleActiviteFilters } from "@/types";

const VALID_OPERATEUR = Object.values(OperateurCondition);
const VALID_LOGIQUE = Object.values(LogiqueCondition);

const VALID_TYPE_ACTIVITE = Object.values(TypeActivite);
const VALID_TYPE_DECLENCHEUR = Object.values(TypeDeclencheur);
const VALID_ACTION_REGLE = Object.values(ActionRegle);
const VALID_SEVERITE = Object.values(SeveriteAlerte);

const SEUIL_TYPES = SEUIL_TYPES_FIREDONCE;

/**
 * GET /api/regles-activites
 * Liste les regles d'activite accessibles pour le site actif.
 *
 * Query params :
 *   - isActive        : "true" | "false"
 *   - typeDeclencheur : TypeDeclencheur
 *   - typeActivite    : TypeActivite
 *   - scope           : "global" | "site" | "all" (defaut "all")
 *
 * Permission : REGLES_ACTIVITES_VOIR
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.REGLES_ACTIVITES_VOIR);
    const { searchParams } = new URL(request.url);

    const filters: RegleActiviteFilters = {};

    const typeActivite = searchParams.get("typeActivite");
    if (typeActivite && VALID_TYPE_ACTIVITE.includes(typeActivite as TypeActivite)) {
      filters.typeActivite = typeActivite as TypeActivite;
    }

    const typeDeclencheur = searchParams.get("typeDeclencheur");
    if (typeDeclencheur && VALID_TYPE_DECLENCHEUR.includes(typeDeclencheur as TypeDeclencheur)) {
      filters.typeDeclencheur = typeDeclencheur as TypeDeclencheur;
    }

    const isActiveParam = searchParams.get("isActive");
    if (isActiveParam === "true") filters.isActive = true;
    if (isActiveParam === "false") filters.isActive = false;

    // Determine siteId and includeGlobal from scope param
    const scope = searchParams.get("scope") ?? "all";
    let siteId: string | null | undefined;

    if (scope === "global") {
      siteId = null; // regles globales seulement
    } else if (scope === "site") {
      siteId = auth.activeSiteId;
      filters.includeGlobal = false;
    } else {
      // "all" : regles site + globales (defaut)
      siteId = auth.activeSiteId;
      filters.includeGlobal = true;
    }

    const regles = await getReglesActivites(siteId, filters);

    return NextResponse.json({ regles, total: regles.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("[GET /api/regles-activites]", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la recuperation des regles d'activite." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/regles-activites
 * Cree une nouvelle regle d'activite specifique au site actif.
 * siteId = session.activeSiteId (jamais null — regles globales sont seed-only).
 *
 * Permission : GERER_REGLES_ACTIVITES
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, Permission.GERER_REGLES_ACTIVITES);
    const body = await request.json();
    const errors: { field: string; message: string }[] = [];

    // --- Required fields ---
    if (!body.nom || typeof body.nom !== "string" || body.nom.trim().length < 3 || body.nom.length > 100) {
      errors.push({
        field: "nom",
        message: "Le nom de la regle est obligatoire (3 a 100 caracteres).",
      });
    }

    if (!body.typeActivite || !VALID_TYPE_ACTIVITE.includes(body.typeActivite as TypeActivite)) {
      errors.push({
        field: "typeActivite",
        message: `Le type d'activite est obligatoire. Valeurs valides : ${VALID_TYPE_ACTIVITE.join(", ")}`,
      });
    }

    // typeDeclencheur: optional if conditions are provided (derive from first condition)
    if (!body.typeDeclencheur && Array.isArray(body.conditions) && body.conditions.length > 0) {
      const firstCond = body.conditions[0] as Record<string, unknown>;
      if (firstCond.typeDeclencheur && VALID_TYPE_DECLENCHEUR.includes(firstCond.typeDeclencheur as TypeDeclencheur)) {
        body.typeDeclencheur = firstCond.typeDeclencheur;
      }
    }
    if (!body.typeDeclencheur || !VALID_TYPE_DECLENCHEUR.includes(body.typeDeclencheur as TypeDeclencheur)) {
      errors.push({
        field: "typeDeclencheur",
        message: `Le type de declencheur est obligatoire (ou sera derive de la premiere condition). Valeurs valides : ${VALID_TYPE_DECLENCHEUR.join(", ")}`,
      });
    }

    if (
      !body.titreTemplate ||
      typeof body.titreTemplate !== "string" ||
      body.titreTemplate.trim().length < 5 ||
      body.titreTemplate.length > 200
    ) {
      errors.push({
        field: "titreTemplate",
        message: "Le titre template est obligatoire (5 a 200 caracteres).",
      });
    }

    // --- Conditional required fields ---
    // Only validate legacy conditionValeur / intervalleJours if no compound conditions are provided
    const hasConditions = Array.isArray(body.conditions) && body.conditions.length > 0;

    if (
      !hasConditions &&
      body.typeDeclencheur &&
      SEUIL_TYPES.includes(body.typeDeclencheur as TypeDeclencheur)
    ) {
      if (body.conditionValeur === undefined || typeof body.conditionValeur !== "number") {
        errors.push({
          field: "conditionValeur",
          message: "conditionValeur est requis pour les declencheurs de type SEUIL_* et FCR_ELEVE.",
        });
      }
    }

    if (!hasConditions && body.typeDeclencheur === TypeDeclencheur.RECURRENT) {
      if (
        body.intervalleJours === undefined ||
        typeof body.intervalleJours !== "number" ||
        !Number.isInteger(body.intervalleJours) ||
        body.intervalleJours <= 0
      ) {
        errors.push({
          field: "intervalleJours",
          message: "intervalleJours est requis et doit etre un entier strictement positif pour le type RECURRENT.",
        });
      }
    }

    // --- Optional field validations ---
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
      body.priorite !== undefined &&
      (typeof body.priorite !== "number" || !Number.isInteger(body.priorite) || body.priorite < 1 || body.priorite > 10)
    ) {
      errors.push({
        field: "priorite",
        message: "La priorite doit etre un entier entre 1 et 10.",
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

    // --- actionType validation ---
    if (body.actionType !== undefined && !VALID_ACTION_REGLE.includes(body.actionType as ActionRegle)) {
      errors.push({
        field: "actionType",
        message: `Valeur invalide. Valeurs valides : ${VALID_ACTION_REGLE.join(", ")}`,
      });
    }

    const actionTypeValue: ActionRegle = (body.actionType as ActionRegle) ?? ActionRegle.ACTIVITE;
    const needsNotification = actionTypeValue === ActionRegle.NOTIFICATION || actionTypeValue === ActionRegle.LES_DEUX;

    if (needsNotification) {
      if (!body.severite || !VALID_SEVERITE.includes(body.severite as SeveriteAlerte)) {
        errors.push({
          field: "severite",
          message: `severite est requis pour les actions NOTIFICATION et LES_DEUX. Valeurs : ${VALID_SEVERITE.join(", ")}`,
        });
      }
      if (!body.titreNotificationTemplate || typeof body.titreNotificationTemplate !== "string" || body.titreNotificationTemplate.trim().length < 5 || body.titreNotificationTemplate.length > 200) {
        errors.push({
          field: "titreNotificationTemplate",
          message: "titreNotificationTemplate est requis (5 a 200 caracteres) pour les actions NOTIFICATION et LES_DEUX.",
        });
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
          `[POST /api/regles-activites] Placeholders inconnus dans le template: ${unknown.join(", ")}`
        );
      }
    }

    // --- Validate conditions if present ---
    if (body.logique !== undefined && !VALID_LOGIQUE.includes(body.logique as LogiqueCondition)) {
      errors.push({ field: "logique", message: `Valeur invalide. Valeurs valides : ${VALID_LOGIQUE.join(", ")}` });
    }

    if (body.conditions !== undefined) {
      if (!Array.isArray(body.conditions)) {
        errors.push({ field: "conditions", message: "conditions doit etre un tableau." });
      } else {
        body.conditions.forEach((c: unknown, idx: number) => {
          const cond = c as Record<string, unknown>;
          if (!cond.typeDeclencheur || !VALID_TYPE_DECLENCHEUR.includes(cond.typeDeclencheur as TypeDeclencheur)) {
            errors.push({ field: `conditions[${idx}].typeDeclencheur`, message: "typeDeclencheur invalide." });
          }
          if (!cond.operateur || !VALID_OPERATEUR.includes(cond.operateur as OperateurCondition)) {
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

    const data: CreateRegleActiviteDTO = {
      nom: body.nom.trim(),
      ...(body.description !== undefined && { description: body.description }),
      typeActivite: body.typeActivite as TypeActivite,
      typeDeclencheur: body.typeDeclencheur as TypeDeclencheur,
      ...(body.conditionValeur !== undefined && { conditionValeur: body.conditionValeur }),
      ...(body.conditionValeur2 !== undefined && { conditionValeur2: body.conditionValeur2 }),
      ...(body.phaseMin !== undefined && { phaseMin: body.phaseMin }),
      ...(body.phaseMax !== undefined && { phaseMax: body.phaseMax }),
      ...(body.intervalleJours !== undefined && { intervalleJours: body.intervalleJours }),
      titreTemplate: body.titreTemplate.trim(),
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

    const regle = await createRegleActivite(auth.activeSiteId, auth.userId, data);

    return NextResponse.json({ regle }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: (error as Error).message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: (error as Error).message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Erreur serveur.";
    if (message.includes("phaseMin") || message.includes("inferieure ou egale")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("[POST /api/regles-activites]", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la creation de la regle d'activite." },
      { status: 500 }
    );
  }
}
