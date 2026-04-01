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
import { MethodeComptage } from "@/types";

interface FormComptageProps {
  values: { nombreCompte: string; methodeComptage: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

export function FormComptage({ values, onChange, errors }: FormComptageProps) {
  const t = useTranslations("releves");

  return (
    <>
      <Input
        id="nombreCompte"
        label={t("form.comptage.nombreCompte")}
        type="number"
        min="0"
        required
        value={values.nombreCompte}
        onChange={(e) => onChange("nombreCompte", e.target.value)}
        error={errors.nombreCompte}
      />
      <Select value={values.methodeComptage} onValueChange={(v) => onChange("methodeComptage", v)}>
        <SelectTrigger label={t("form.comptage.methodeComptage")} required error={errors.methodeComptage}>
          <SelectValue placeholder={t("form.comptage.methodePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {Object.values(MethodeComptage).map((m) => (
            <SelectItem key={m} value={m}>
              {t(`form.comptage.methodes.${m}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
