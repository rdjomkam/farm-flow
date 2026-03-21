"use client";

import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";

interface FormObservationProps {
  values: { description: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function FormObservation({ values, onChange, errors }: FormObservationProps) {
  const t = useTranslations("releves");

  return (
    <Textarea
      id="description"
      label={t("form.observation.description")}
      rows={4}
      placeholder={t("form.observation.placeholder")}
      value={values.description}
      onChange={(e) => onChange("description", e.target.value)}
      error={errors.description}
    />
  );
}
