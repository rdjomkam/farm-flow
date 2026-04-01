"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CauseMortalite } from "@/types";

interface FormMortaliteProps {
  values: { nombreMorts: string; causeMortalite: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function FormMortalite({ values, onChange, errors }: FormMortaliteProps) {
  const t = useTranslations("releves");

  return (
    <>
      <Input
        id="nombreMorts"
        label={t("form.mortalite.nombreMorts")}
        type="number"
        min="0"
        required
        value={values.nombreMorts}
        onChange={(e) => onChange("nombreMorts", e.target.value)}
        error={errors.nombreMorts}
      />
      <Select value={values.causeMortalite} onValueChange={(v) => onChange("causeMortalite", v)}>
        <SelectTrigger label={t("form.mortalite.causeMortalite")} required error={errors.causeMortalite}>
          <SelectValue placeholder={t("form.mortalite.causePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {Object.values(CauseMortalite).map((c) => (
            <SelectItem key={c} value={c}>
              {t(`form.mortalite.causes.${c}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
