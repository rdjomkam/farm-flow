/**
 * Centralized error key constants for i18n-compatible API responses.
 *
 * These keys map to entries in src/messages/{locale}/errors.json.
 * Each key follows the namespace.path format expected by next-intl's
 * useTranslations("errors") hook.
 *
 * Usage in API routes (backward-compatible — always keep the `message` field):
 *   return NextResponse.json(
 *     { message: "Plan introuvable.", errorKey: ErrorKeys.NOT_FOUND_PLAN },
 *     { status: 404 }
 *   );
 *
 * Usage in client components:
 *   import { ApiErrorMessage } from "@/components/ui/api-error-message";
 *   <ApiErrorMessage errorKey={err.errorKey} message={err.message} />
 */
export const ErrorKeys = {
  // Validation
  VALIDATION_REQUIRED: "validation.required",
  VALIDATION_INVALID_VALUE: "validation.invalidValue",
  VALIDATION_FIELD_REQUIRED: "validation.fieldRequired",
  VALIDATION_NO_FIELD_TO_MODIFY: "validation.noFieldToModify",
  VALIDATION_ERRORS: "validation.validationErrors",

  // Not found
  NOT_FOUND_GENERIC: "notFound.generic",
  NOT_FOUND_PLAN: "notFound.plan",
  NOT_FOUND_VAGUE: "notFound.vague",
  NOT_FOUND_BAC: "notFound.bac",
  NOT_FOUND_RELEVE: "notFound.releve",
  NOT_FOUND_CLIENT: "notFound.client",
  NOT_FOUND_USER: "notFound.user",
  NOT_FOUND_MEMBER: "notFound.member",
  NOT_FOUND_SITE: "notFound.site",
  NOT_FOUND_FACTURE: "notFound.facture",
  NOT_FOUND_VENTE: "notFound.vente",
  NOT_FOUND_PRODUIT: "notFound.produit",
  NOT_FOUND_COMMANDE: "notFound.commande",
  NOT_FOUND_FOURNISSEUR: "notFound.fournisseur",

  // Conflict
  CONFLICT_PLAN_TYPE_EXISTS: "conflict.planTypeExists",
  CONFLICT_CANNOT_DEACTIVATE_WITH_SUBSCRIBERS: "conflict.cannotDeactivateWithSubscribers",
  CONFLICT_BAC_ALREADY_ASSIGNED: "conflict.bacAlreadyAssigned",
  CONFLICT_EMAIL_ALREADY_USED: "conflict.emailAlreadyUsed",
  CONFLICT_PHONE_ALREADY_USED: "conflict.phoneAlreadyUsed",

  // Auth
  AUTH_UNAUTHORIZED: "auth.unauthorized",
  AUTH_FORBIDDEN: "auth.forbidden",
  AUTH_NOT_MEMBER: "auth.notMember",
  AUTH_ACCOUNT_DEACTIVATED: "auth.accountDeactivated",
  AUTH_INVALID_CREDENTIALS: "auth.invalidCredentials",

  // Server errors
  SERVER_GENERIC: "server.generic",
  SERVER_UNEXPECTED: "server.unexpected",
  SERVER_GET_VAGUES: "server.getVagues",
  SERVER_CREATE_VAGUE: "server.createVague",
  SERVER_GET_VAGUE: "server.getVague",
  SERVER_UPDATE_VAGUE: "server.updateVague",
  SERVER_GET_BACS: "server.getBacs",
  SERVER_CREATE_BAC: "server.createBac",
  SERVER_GET_BAC: "server.getBac",
  SERVER_UPDATE_BAC: "server.updateBac",
  SERVER_GET_RELEVES: "server.getReleves",
  SERVER_CREATE_RELEVE: "server.createReleve",
  SERVER_GET_RELEVE: "server.getReleve",
  SERVER_UPDATE_RELEVE: "server.updateReleve",
  SERVER_DELETE_RELEVE: "server.deleteReleve",
  SERVER_GET_PLANS: "server.getPlans",
  SERVER_CREATE_PLAN: "server.createPlan",
  SERVER_GET_PLAN: "server.getPlan",
  SERVER_UPDATE_PLAN: "server.updatePlan",
  SERVER_DELETE_PLAN: "server.deletePlan",
  SERVER_LOGIN: "server.login",
  SERVER_REGISTER: "server.register",
  SERVER_LOGOUT: "server.logout",
  SERVER_CHANGE_SITE: "server.changeSite",

  // Quota
  QUOTA_EXCEEDED: "quota.exceeded",
  QUOTA_VAGUES_LIMIT: "quota.vaguesLimit",
  QUOTA_BACS_LIMIT: "quota.bacsLimit",

  // Modules
  INVALID_PLATFORM_MODULE: "validation.invalidPlatformModule",
} as const;

export type ErrorKey = (typeof ErrorKeys)[keyof typeof ErrorKeys];
