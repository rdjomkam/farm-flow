"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

interface FormQualiteEauProps {
  values: { temperature: string; ph: string; oxygene: string; ammoniac: string };
  onChange: (field: string, value: string) => void;
}

export function FormQualiteEau({ values, onChange }: FormQualiteEauProps) {
  const t = useTranslations("releves");

  return (
    <>
      <Input
        id="temperature"
        label={t("form.qualiteEau.temperature")}
        type="number"
        step="0.1"
        value={values.temperature}
        onChange={(e) => onChange("temperature", e.target.value)}
      />
      <Input
        id="ph"
        label={t("form.qualiteEau.ph")}
        type="number"
        step="0.01"
        min="0"
        max="14"
        value={values.ph}
        onChange={(e) => onChange("ph", e.target.value)}
      />
      <Input
        id="oxygene"
        label={t("form.qualiteEau.oxygene")}
        type="number"
        step="0.1"
        value={values.oxygene}
        onChange={(e) => onChange("oxygene", e.target.value)}
      />
      <Input
        id="ammoniac"
        label={t("form.qualiteEau.ammoniac")}
        type="number"
        step="0.01"
        value={values.ammoniac}
        onChange={(e) => onChange("ammoniac", e.target.value)}
      />
    </>
  );
}
