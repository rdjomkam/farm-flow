/**
 * Schemas Zod pour la validation des releves par type.
 *
 * Source de verite unique pour la validation de chaque type de releve.
 * Utilise par les routes POST /api/releves, PUT et PATCH /api/releves/[id].
 *
 * Bornes validees :
 * - pH : [0, 14]
 * - temperature : [0, 50] °C
 * - oxygene : [0, 20] mg/L
 * - ammoniac : [0, 10] mg/L
 *
 * Limites de longueur :
 * - notes : 2000 caracteres
 * - description : 2000 caracteres
 * - raison : 500 caracteres
 */

import { z } from "zod";
import {
  TypeReleve,
  CauseMortalite,
  TypeAliment,
  MethodeComptage,
  ComportementAlimentaire,
} from "@/types";
import { notesSchema, consommationsSchema, releveDateSchema, updateDateSchema } from "./common.schema";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const TAUX_REFUS_VALIDES = [0, 10, 25, 50] as const;

// ---------------------------------------------------------------------------
// Schemas par type de releve (champs specifiques)
// ---------------------------------------------------------------------------

export const biometrieFieldsSchema = z.object({
  poidsMoyen: z.number().positive("Le poids moyen est obligatoire et doit etre superieur a 0."),
  tailleMoyenne: z.number().positive("La taille moyenne doit etre superieure a 0.").nullable().optional(),
  echantillonCount: z
    .number()
    .int("Le nombre d'echantillons doit etre un entier.")
    .positive("Le nombre d'echantillons est obligatoire et doit etre un entier superieur a 0."),
});

export const mortaliteFieldsSchema = z.object({
  nombreMorts: z
    .number()
    .int("Le nombre de morts doit etre un entier.")
    .min(0, "Le nombre de morts est obligatoire et doit etre un entier positif ou nul."),
  causeMortalite: z.nativeEnum(CauseMortalite, {
    message: `La cause de mortalite est obligatoire. Valeurs acceptees : ${Object.values(CauseMortalite).join(", ")}.`,
  }),
});

export const alimentationFieldsSchema = z.object({
  quantiteAliment: z.number().positive("La quantite d'aliment est obligatoire et doit etre superieure a 0."),
  typeAliment: z.nativeEnum(TypeAliment, {
    message: `Le type d'aliment est obligatoire. Valeurs acceptees : ${Object.values(TypeAliment).join(", ")}.`,
  }),
  frequenceAliment: z
    .number()
    .int("La frequence doit etre un entier.")
    .positive("La frequence d'alimentation est obligatoire et doit etre un entier superieur a 0."),
  tauxRefus: z
    .union([z.literal(0), z.literal(10), z.literal(25), z.literal(50)])
    .optional()
    .nullable(),
  comportementAlim: z
    .nativeEnum(ComportementAlimentaire, {
      message: `Le comportement alimentaire doit etre : ${Object.values(ComportementAlimentaire).join(", ")}.`,
    })
    .optional()
    .nullable(),
});

export const qualiteEauFieldsSchema = z.object({
  temperature: z
    .number()
    .min(0, "La temperature doit etre >= 0°C.")
    .max(50, "La temperature doit etre <= 50°C.")
    .optional()
    .nullable(),
  ph: z
    .number()
    .min(0, "Le pH doit etre >= 0.")
    .max(14, "Le pH doit etre <= 14.")
    .optional()
    .nullable(),
  oxygene: z
    .number()
    .min(0, "L'oxygene dissous doit etre >= 0 mg/L.")
    .max(20, "L'oxygene dissous doit etre <= 20 mg/L.")
    .optional()
    .nullable(),
  ammoniac: z
    .number()
    .min(0, "L'ammoniac doit etre >= 0 mg/L.")
    .max(10, "L'ammoniac doit etre <= 10 mg/L.")
    .optional()
    .nullable(),
});

export const comptageFieldsSchema = z.object({
  nombreCompte: z
    .number()
    .int("Le nombre compte doit etre un entier.")
    .min(0, "Le nombre compte est obligatoire et doit etre un entier positif ou nul."),
  methodeComptage: z.nativeEnum(MethodeComptage, {
    message: `La methode de comptage est obligatoire. Valeurs acceptees : ${Object.values(MethodeComptage).join(", ")}.`,
  }),
});

export const observationFieldsSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "La description est obligatoire pour une observation.")
    .max(2000, "La description ne peut pas depasser 2000 caracteres."),
});

export const renouvellementFieldsSchema = z
  .object({
    pourcentageRenouvellement: z
      .number()
      .min(0, "Le pourcentage de renouvellement doit etre >= 0.")
      .max(100, "Le pourcentage de renouvellement doit etre <= 100.")
      .optional()
      .nullable(),
    volumeRenouvele: z
      .number()
      .positive("Le volume renouvele doit etre superieur a 0.")
      .optional()
      .nullable(),
    nombreRenouvellements: z
      .number()
      .int("Le nombre de passages doit etre un entier.")
      .min(1, "Le nombre de passages doit etre >= 1.")
      .max(20, "Le nombre de passages doit etre <= 20.")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => data.pourcentageRenouvellement != null || data.volumeRenouvele != null,
    {
      message: "Au moins un champ est obligatoire : pourcentageRenouvellement ou volumeRenouvele.",
      path: ["pourcentageRenouvellement"],
    }
  );

// ---------------------------------------------------------------------------
// Champs communs pour la creation
// ---------------------------------------------------------------------------

const createBaseSchema = z.object({
  typeReleve: z.nativeEnum(TypeReleve, {
    message: `Type de releve invalide. Valeurs acceptees : ${Object.values(TypeReleve).join(", ")}.`,
  }),
  vagueId: z.string().min(1, "L'identifiant de la vague est obligatoire."),
  bacId: z.string().min(1, "L'identifiant du bac est obligatoire."),
  notes: notesSchema,
  consommations: consommationsSchema,
  date: releveDateSchema,
  activiteId: z.string().trim().min(1, "L'identifiant d'activite doit etre une chaine non vide.").optional().nullable(),
});

// ---------------------------------------------------------------------------
// Schemas de creation discrimines par typeReleve
// ---------------------------------------------------------------------------

export const createBiometrieSchema = createBaseSchema.extend({
  typeReleve: z.literal(TypeReleve.BIOMETRIE),
}).merge(biometrieFieldsSchema);

export const createMortaliteSchema = createBaseSchema.extend({
  typeReleve: z.literal(TypeReleve.MORTALITE),
}).merge(mortaliteFieldsSchema);

export const createAlimentationSchema = createBaseSchema.extend({
  typeReleve: z.literal(TypeReleve.ALIMENTATION),
}).merge(alimentationFieldsSchema);

export const createQualiteEauSchema = createBaseSchema
  .extend({ typeReleve: z.literal(TypeReleve.QUALITE_EAU) })
  .merge(qualiteEauFieldsSchema);

export const createComptageSchema = createBaseSchema.extend({
  typeReleve: z.literal(TypeReleve.COMPTAGE),
}).merge(comptageFieldsSchema);

export const createObservationSchema = createBaseSchema.extend({
  typeReleve: z.literal(TypeReleve.OBSERVATION),
}).merge(observationFieldsSchema);

export const createRenouvellementSchema = createBaseSchema
  .extend({ typeReleve: z.literal(TypeReleve.RENOUVELLEMENT) })
  .and(renouvellementFieldsSchema);

/**
 * Schema discrimine union pour la creation d'un releve.
 * Utiliser avec .safeParse() depuis la route POST.
 */
export const createReleveSchema = z.discriminatedUnion("typeReleve", [
  createBiometrieSchema,
  createMortaliteSchema,
  createAlimentationSchema,
  createQualiteEauSchema,
  createComptageSchema,
  createObservationSchema,
]);

// ---------------------------------------------------------------------------
// Schemas de mise a jour (PUT / PATCH) — champs tous optionnels
// ---------------------------------------------------------------------------

/**
 * Schema pour PUT /api/releves/[id].
 * Tous les champs metier sont optionnels.
 * Les champs structurels (typeReleve, vagueId, bacId, siteId) sont exclus.
 */
export const updateReleveSchema = z.object({
  date: updateDateSchema,
  notes: notesSchema,
  consommations: consommationsSchema,
  // Biometrie
  poidsMoyen: z.number().positive("Le poids moyen doit etre superieur a 0.").optional(),
  tailleMoyenne: z.number().positive("La taille moyenne doit etre superieure a 0.").nullable().optional(),
  echantillonCount: z
    .number()
    .int()
    .positive("Le nombre d'echantillons doit etre un entier superieur a 0.")
    .optional(),
  // Mortalite
  nombreMorts: z
    .number()
    .int()
    .min(0, "Le nombre de morts doit etre un entier positif ou nul.")
    .optional(),
  causeMortalite: z
    .nativeEnum(CauseMortalite, {
      message: `Valeurs acceptees : ${Object.values(CauseMortalite).join(", ")}.`,
    })
    .optional(),
  // Alimentation
  quantiteAliment: z.number().positive("La quantite d'aliment doit etre superieure a 0.").optional(),
  typeAliment: z
    .nativeEnum(TypeAliment, {
      message: `Valeurs acceptees : ${Object.values(TypeAliment).join(", ")}.`,
    })
    .optional(),
  frequenceAliment: z
    .number()
    .int()
    .positive("La frequence doit etre un entier superieur a 0.")
    .optional(),
  tauxRefus: z
    .union([z.literal(0), z.literal(10), z.literal(25), z.literal(50)])
    .optional()
    .nullable(),
  comportementAlim: z
    .nativeEnum(ComportementAlimentaire, {
      message: `Le comportement alimentaire doit etre : ${Object.values(ComportementAlimentaire).join(", ")}.`,
    })
    .optional()
    .nullable(),
  // Qualite eau avec bornes
  temperature: z
    .number()
    .min(0, "La temperature doit etre >= 0°C.")
    .max(50, "La temperature doit etre <= 50°C.")
    .optional()
    .nullable(),
  ph: z
    .number()
    .min(0, "Le pH doit etre >= 0.")
    .max(14, "Le pH doit etre <= 14.")
    .optional()
    .nullable(),
  oxygene: z
    .number()
    .min(0, "L'oxygene dissous doit etre >= 0 mg/L.")
    .max(20, "L'oxygene dissous doit etre <= 20 mg/L.")
    .optional()
    .nullable(),
  ammoniac: z
    .number()
    .min(0, "L'ammoniac doit etre >= 0 mg/L.")
    .max(10, "L'ammoniac doit etre <= 10 mg/L.")
    .optional()
    .nullable(),
  // Comptage
  nombreCompte: z
    .number()
    .int()
    .min(0, "Le nombre compte doit etre un entier positif ou nul.")
    .optional(),
  methodeComptage: z
    .nativeEnum(MethodeComptage, {
      message: `Valeurs acceptees : ${Object.values(MethodeComptage).join(", ")}.`,
    })
    .optional(),
  // Observation
  description: z
    .string()
    .trim()
    .min(1, "La description ne peut pas etre vide.")
    .max(2000, "La description ne peut pas depasser 2000 caracteres.")
    .optional(),
  // Renouvellement
  pourcentageRenouvellement: z
    .number()
    .min(0, "Le pourcentage doit etre >= 0.")
    .max(100, "Le pourcentage doit etre <= 100.")
    .optional()
    .nullable(),
  volumeRenouvele: z.number().positive("Le volume doit etre superieur a 0.").optional().nullable(),
  nombreRenouvellements: z
    .number()
    .int()
    .min(1, "Le nombre de renouvellements doit etre >= 1.")
    .max(20, "Le nombre de renouvellements doit etre <= 20.")
    .optional()
    .nullable(),
});

/**
 * Schema pour PATCH /api/releves/[id].
 * Identique au updateReleveSchema, mais avec raison obligatoire.
 * Les champs structurels non modifiables (id, vagueId, bacId, siteId, typeReleve, userId, createdAt)
 * doivent etre verifies separement avant parsing.
 */
export const patchReleveSchema = updateReleveSchema.extend({
  raison: z
    .string()
    .trim()
    .min(5, "La raison doit contenir au moins 5 caracteres.")
    .max(500, "La raison ne peut pas depasser 500 caracteres."),
});

// ---------------------------------------------------------------------------
// Helpers — conversion ZodError → tableau d'erreurs API
// ---------------------------------------------------------------------------

import { ZodError } from "zod";

export interface ValidationFieldError {
  field: string;
  message: string;
}

/**
 * Convertit une ZodError en tableau de { field, message } pour les reponses API.
 * Compatible Zod v4 (issues) et Zod v3 (errors).
 */
export function zodErrorToFieldErrors(error: ZodError): ValidationFieldError[] {
  // Zod v4 uses .issues, Zod v3 uses .errors
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const issues: Array<{ path: (string | number)[]; message: string }> = (error as any).issues ?? (error as any).errors ?? [];
  return issues.map((issue) => ({
    field: issue.path.join(".") || "_",
    message: issue.message,
  }));
}

// ---------------------------------------------------------------------------
// Exports des types inferres
// ---------------------------------------------------------------------------

export type CreateBiometrieInput = z.infer<typeof createBiometrieSchema>;
export type CreateMortaliteInput = z.infer<typeof createMortaliteSchema>;
export type CreateAlimentationInput = z.infer<typeof createAlimentationSchema>;
export type CreateQualiteEauInput = z.infer<typeof createQualiteEauSchema>;
export type CreateComptageInput = z.infer<typeof createComptageSchema>;
export type CreateObservationInput = z.infer<typeof createObservationSchema>;
export type UpdateReleveInput = z.infer<typeof updateReleveSchema>;
export type PatchReleveInput = z.infer<typeof patchReleveSchema>;
