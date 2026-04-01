"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FormSection } from "@/components/ui/form-section";
import { FormBiometrie } from "./form-biometrie";
import { FormMortalite } from "./form-mortalite";
import { FormAlimentation } from "./form-alimentation";
import { FormQualiteEau } from "./form-qualite-eau";
import { FormComptage } from "./form-comptage";
import { FormObservation } from "./form-observation";
import { FormRenouvellement } from "./form-renouvellement";
import { ConsommationFields } from "./consommation-fields";
import type { ConsommationLine, ProduitOption } from "./consommation-fields";
import { TypeReleve, CategorieProduit } from "@/types";
import type { BacResponse } from "@/types";
import type { TypedFormFields } from "@/hooks/use-releve-form";

// Sub-components wrapped with React.memo for performance
const MemoFormBiometrie = React.memo(FormBiometrie);
const MemoFormMortalite = React.memo(FormMortalite);
const MemoFormAlimentation = React.memo(FormAlimentation);
const MemoFormQualiteEau = React.memo(FormQualiteEau);
const MemoFormComptage = React.memo(FormComptage);
const MemoFormObservation = React.memo(FormObservation);
const MemoFormRenouvellement = React.memo(FormRenouvellement);
const MemoConsommationFields = React.memo(ConsommationFields);

interface ReleveTypeSectionsProps {
  fields: TypedFormFields;
  errors: Record<string, string>;
  consommations: ConsommationLine[];
  produits: ProduitOption[];
  bacs: BacResponse[];
  bacId: string;
  uniteAliment?: string;
  updateField: (field: string, value: string) => void;
  onConsommationsChange: (lignes: ConsommationLine[]) => void;
}

export function ReleveTypeSections({
  fields,
  errors,
  consommations,
  produits,
  bacs,
  bacId,
  uniteAliment,
  updateField,
  onConsommationsChange,
}: ReleveTypeSectionsProps) {
  const t = useTranslations("releves");
  const selectedBac = bacs.find((b) => b.id === bacId) ?? null;

  if (fields.typeReleve === TypeReleve.BIOMETRIE) {
    return (
      <FormSection title={t("form.sections.biometrie.title")} description={t("form.sections.biometrie.description")}>
        <MemoFormBiometrie
          values={{ poidsMoyen: fields.poidsMoyen, tailleMoyenne: fields.tailleMoyenne, echantillonCount: fields.echantillonCount }}
          onChange={updateField}
          errors={errors}
        />
      </FormSection>
    );
  }

  if (fields.typeReleve === TypeReleve.MORTALITE) {
    return (
      <>
        <FormSection title={t("form.sections.mortalite.title")} description={t("form.sections.mortalite.description")}>
          <MemoFormMortalite
            values={{ nombreMorts: fields.nombreMorts, causeMortalite: fields.causeMortalite }}
            onChange={updateField}
            errors={errors}
          />
        </FormSection>
        <FormSection title={t("form.sections.consommationStock.title")} description={t("form.sections.consommationStock.descriptionIntrant")}>
          <MemoConsommationFields
            lignes={consommations}
            onChange={onConsommationsChange}
            produits={produits}
            categorie={CategorieProduit.INTRANT}
            optional
          />
        </FormSection>
      </>
    );
  }

  if (fields.typeReleve === TypeReleve.ALIMENTATION) {
    return (
      <>
        <FormSection title={t("form.sections.alimentation.title")} description={t("form.sections.alimentation.description")}>
          <MemoFormAlimentation
            values={{
              quantiteAliment: fields.quantiteAliment,
              typeAliment: fields.typeAliment,
              frequenceAliment: fields.frequenceAliment,
              tauxRefus: fields.tauxRefus,
              comportementAlim: fields.comportementAlim,
            }}
            onChange={updateField}
            errors={errors}
            uniteAliment={uniteAliment}
          />
        </FormSection>
        <FormSection title={t("form.sections.consommationStock.title")} description={t("form.sections.consommationStock.descriptionAliment")}>
          <MemoConsommationFields
            lignes={consommations}
            onChange={onConsommationsChange}
            produits={produits}
            categorie={CategorieProduit.ALIMENT}
          />
        </FormSection>
      </>
    );
  }

  if (fields.typeReleve === TypeReleve.QUALITE_EAU) {
    return (
      <>
        <FormSection title={t("form.sections.qualiteEau.title")} description={t("form.sections.qualiteEau.description")}>
          <MemoFormQualiteEau
            values={{ temperature: fields.temperature, ph: fields.ph, oxygene: fields.oxygene, ammoniac: fields.ammoniac }}
            onChange={updateField}
          />
        </FormSection>
        <FormSection title={t("form.sections.consommationStock.title")} description={t("form.sections.consommationStock.descriptionIntrant")}>
          <MemoConsommationFields
            lignes={consommations}
            onChange={onConsommationsChange}
            produits={produits}
            categorie={CategorieProduit.INTRANT}
            optional
          />
        </FormSection>
      </>
    );
  }

  if (fields.typeReleve === TypeReleve.COMPTAGE) {
    return (
      <FormSection title={t("form.sections.comptage.title")} description={t("form.sections.comptage.description")}>
        <MemoFormComptage
          values={{ nombreCompte: fields.nombreCompte, methodeComptage: fields.methodeComptage }}
          onChange={updateField}
          errors={errors}
        />
      </FormSection>
    );
  }

  if (fields.typeReleve === TypeReleve.OBSERVATION) {
    return (
      <FormSection title={t("form.sections.observation.title")} description={t("form.sections.observation.description")}>
        <MemoFormObservation
          values={{ description: fields.description }}
          onChange={updateField}
          errors={errors}
        />
      </FormSection>
    );
  }

  if (fields.typeReleve === TypeReleve.RENOUVELLEMENT) {
    return (
      <MemoFormRenouvellement
        values={{
          pourcentageRenouvellement: fields.pourcentageRenouvellement,
          volumeRenouvele: fields.volumeRenouvele,
          nombreRenouvellements: fields.nombreRenouvellements,
        }}
        onChange={updateField}
        errors={errors}
        bacVolumeLitres={selectedBac?.volume ?? null}
      />
    );
  }

  return null;
}
