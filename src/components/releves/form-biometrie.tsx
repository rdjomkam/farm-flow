"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

interface FormBiometrieProps {
  values: { poidsMoyen: string; tailleMoyenne: string; echantillonCount: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function FormBiometrie({ values, onChange, errors }: FormBiometrieProps) {
  const t = useTranslations("releves");

  return (
    <>
      <Input
        id="poidsMoyen"
        label={t("form.biometrie.poidsMoyen")}
        type="number"
        min="0.1"
        step="0.1"
        required
        value={values.poidsMoyen}
        onChange={(e) => onChange("poidsMoyen", e.target.value)}
        error={errors.poidsMoyen}
      />
      <Input
        id="tailleMoyenne"
        label={t("form.biometrie.tailleMoyenne")}
        type="number"
        min="0.1"
        step="0.1"
        value={values.tailleMoyenne}
        onChange={(e) => onChange("tailleMoyenne", e.target.value)}
        error={errors.tailleMoyenne}
      />
      <Input
        id="echantillonCount"
        label={t("form.biometrie.echantillonCount")}
        type="number"
        min="1"
        value={values.echantillonCount}
        onChange={(e) => onChange("echantillonCount", e.target.value)}
        error={errors.echantillonCount}
      />
    </>
  );
}
