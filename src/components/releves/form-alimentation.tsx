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
import { TypeAliment } from "@/types";

interface FormAlimentationProps {
  values: { quantiteAliment: string; typeAliment: string; frequenceAliment: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
  uniteAliment?: string;
}

export function FormAlimentation({ values, onChange, errors, uniteAliment }: FormAlimentationProps) {
  const t = useTranslations("releves");

  return (
    <>
      <Input
        id="quantiteAliment"
        label={t("form.alimentation.quantiteAliment", { unite: uniteAliment ?? "kg" })}
        type="number"
        min="0.01"
        step="0.01"
        value={values.quantiteAliment}
        onChange={(e) => onChange("quantiteAliment", e.target.value)}
        error={errors.quantiteAliment}
      />
      <Select value={values.typeAliment} onValueChange={(v) => onChange("typeAliment", v)}>
        <SelectTrigger label={t("form.alimentation.typeAliment")} error={errors.typeAliment}>
          <SelectValue placeholder={t("form.alimentation.typeAlimentPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {Object.values(TypeAliment).map((tp) => (
            <SelectItem key={tp} value={tp}>
              {t(`form.alimentation.types.${tp}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id="frequenceAliment"
        label={t("form.alimentation.frequenceAliment")}
        type="number"
        min="1"
        value={values.frequenceAliment}
        onChange={(e) => onChange("frequenceAliment", e.target.value)}
        error={errors.frequenceAliment}
      />
    </>
  );
}
