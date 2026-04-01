import { TypeReleve } from "@/types";
import type { TypedFormFields } from "@/hooks/use-releve-form";

/** Retourne un objet d'erreurs clé→message. Vide = formulaire valide. */
export function validateReleveForm(
  vagueId: string,
  bacId: string,
  typeReleve: string,
  fields: TypedFormFields,
  t: (key: string) => string
): Record<string, string> {
  const errs: Record<string, string> = {};
  if (!vagueId) errs.vagueId = t("form.errors.vagueId");
  if (!bacId) errs.bacId = t("form.errors.bacId");
  if (!typeReleve) errs.typeReleve = t("form.errors.typeReleve");

  if (fields.typeReleve === TypeReleve.BIOMETRIE) {
    if (!fields.poidsMoyen || Number(fields.poidsMoyen) <= 0)
      errs.poidsMoyen = t("form.errors.poidsMoyen");
    if (fields.tailleMoyenne && Number(fields.tailleMoyenne) <= 0)
      errs.tailleMoyenne = t("form.errors.tailleMoyenne");
    if (!fields.echantillonCount || Number(fields.echantillonCount) <= 0)
      errs.echantillonCount = t("form.errors.echantillonCount");
  }
  if (fields.typeReleve === TypeReleve.MORTALITE) {
    if (fields.nombreMorts == null || fields.nombreMorts === "" || Number(fields.nombreMorts) < 0)
      errs.nombreMorts = t("form.errors.nombreMorts");
    if (!fields.causeMortalite) errs.causeMortalite = t("form.errors.causeMortalite");
  }
  if (fields.typeReleve === TypeReleve.ALIMENTATION) {
    if (!fields.quantiteAliment || Number(fields.quantiteAliment) <= 0)
      errs.quantiteAliment = t("form.errors.quantiteAliment");
    if (!fields.typeAliment) errs.typeAliment = t("form.errors.typeAliment");
    if (!fields.frequenceAliment || Number(fields.frequenceAliment) <= 0)
      errs.frequenceAliment = t("form.errors.frequenceAliment");
  }
  if (fields.typeReleve === TypeReleve.COMPTAGE) {
    if (fields.nombreCompte == null || fields.nombreCompte === "" || Number(fields.nombreCompte) < 0)
      errs.nombreCompte = t("form.errors.nombreCompte");
    if (!fields.methodeComptage) errs.methodeComptage = t("form.errors.methodeComptage");
  }
  if (fields.typeReleve === TypeReleve.OBSERVATION) {
    if (!fields.description?.trim()) errs.description = t("form.errors.description");
  }
  if (fields.typeReleve === TypeReleve.RENOUVELLEMENT) {
    const hasPct = fields.pourcentageRenouvellement !== "" && fields.pourcentageRenouvellement !== undefined;
    const hasVol = fields.volumeRenouvele !== "" && fields.volumeRenouvele !== undefined;
    if (!hasPct && !hasVol) {
      errs.pourcentageRenouvellement = t("form.errors.renouvellementRequis");
    }
    if (hasPct && (Number(fields.pourcentageRenouvellement) < 0 || Number(fields.pourcentageRenouvellement) > 100)) {
      errs.pourcentageRenouvellement = t("form.errors.pourcentageRange");
    }
    if (hasVol && Number(fields.volumeRenouvele) <= 0) {
      errs.volumeRenouvele = t("form.errors.volumePositif");
    }
    if (fields.nombreRenouvellements !== undefined && fields.nombreRenouvellements !== "") {
      const n = Number(fields.nombreRenouvellements);
      if (!Number.isInteger(n) || n < 1 || n > 20) {
        errs.nombreRenouvellements = t("form.errors.nombreRenouvellementMin");
      }
    }
  }
  return errs;
}
