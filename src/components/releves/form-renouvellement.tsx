"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/ui/form-section";
import { useEffect } from "react";

interface FormRenouvellementProps {
  values: {
    pourcentageRenouvellement: string;
    volumeRenouvele: string;
  };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
  /** Volume du bac en litres (optionnel) — permet la conversion bidirectionnelle */
  bacVolumeLitres?: number | null;
}

/**
 * Formulaire pour les releves de renouvellement d'eau.
 *
 * Affiche deux champs :
 * - pourcentageRenouvellement : % du volume du bac renouvelee (0-100)
 * - volumeRenouvele : volume en litres renouvele
 *
 * Si bacVolumeLitres est connu, les deux champs sont lies :
 * modifier l'un met a jour l'autre automatiquement.
 *
 * Au moins un des deux champs est requis.
 */
export function FormRenouvellement({
  values,
  onChange,
  errors,
  bacVolumeLitres,
}: FormRenouvellementProps) {
  const t = useTranslations("releves");
  const hasVolume = bacVolumeLitres != null && bacVolumeLitres > 0;

  function handlePctChange(rawValue: string) {
    onChange("pourcentageRenouvellement", rawValue);
    if (hasVolume && rawValue !== "") {
      const pct = Number(rawValue);
      if (!isNaN(pct) && pct >= 0 && pct <= 100) {
        const vol = (pct / 100) * bacVolumeLitres!;
        onChange("volumeRenouvele", String(Math.round(vol)));
      }
    }
  }

  function handleVolChange(rawValue: string) {
    onChange("volumeRenouvele", rawValue);
    if (hasVolume && rawValue !== "") {
      const vol = Number(rawValue);
      if (!isNaN(vol) && vol > 0) {
        const pct = (vol / bacVolumeLitres!) * 100;
        onChange("pourcentageRenouvellement", String(Math.round(pct * 10) / 10));
      }
    }
  }

  return (
    <FormSection
      title={t("form.renouvellement.title")}
      description={t("form.renouvellement.description")}
    >
      <Input
        id="pourcentageRenouvellement"
        label={t("form.renouvellement.pourcentage")}
        type="number"
        min="0"
        max="100"
        step="0.1"
        placeholder="Ex : 30"
        value={values.pourcentageRenouvellement}
        onChange={(e) => handlePctChange(e.target.value)}
        error={errors.pourcentageRenouvellement}
      />
      <Input
        id="volumeRenouvele"
        label={hasVolume ? t("form.renouvellement.volumeAvecBac", { volume: bacVolumeLitres }) : t("form.renouvellement.volume")}
        type="number"
        min="1"
        step="1"
        placeholder={hasVolume ? `Ex : ${Math.round(bacVolumeLitres! * 0.3)}` : "Ex : 300"}
        value={values.volumeRenouvele}
        onChange={(e) => handleVolChange(e.target.value)}
        error={errors.volumeRenouvele}
      />
      {!errors.pourcentageRenouvellement && !errors.volumeRenouvele && (
        <p className="text-xs text-muted-foreground">
          {t("form.renouvellement.hint")}
          {hasVolume && t("form.renouvellement.hintLinked")}
        </p>
      )}
    </FormSection>
  );
}
