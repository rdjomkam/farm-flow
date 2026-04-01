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
import { TypeAliment, ComportementAlimentaire } from "@/types";

const TAUX_REFUS_OPTIONS = [
  { value: "0", label: "0" },
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
] as const;

interface FormAlimentationProps {
  values: {
    quantiteAliment: string;
    typeAliment: string;
    frequenceAliment: string;
    tauxRefus?: string;
    comportementAlim?: string;
  };
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
        required
        value={values.quantiteAliment}
        onChange={(e) => onChange("quantiteAliment", e.target.value)}
        error={errors.quantiteAliment}
      />
      <Select value={values.typeAliment} onValueChange={(v) => onChange("typeAliment", v)}>
        <SelectTrigger label={t("form.alimentation.typeAliment")} required error={errors.typeAliment}>
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
        required
        value={values.frequenceAliment}
        onChange={(e) => onChange("frequenceAliment", e.target.value)}
        error={errors.frequenceAliment}
      />

      {/* Taux de refus */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-foreground">
          {t("form.alimentation.tauxRefus.label")}
        </span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("form.alimentation.tauxRefus.label")}>
          {TAUX_REFUS_OPTIONS.map((opt) => {
            const checked = (values.tauxRefus ?? "") === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex h-12 min-w-[80px] flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors ${
                  checked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:border-primary/50"
                }`}
              >
                <input
                  type="radio"
                  name="tauxRefus"
                  value={opt.value}
                  checked={checked}
                  onChange={() => onChange("tauxRefus", opt.value)}
                  className="sr-only"
                />
                {t(`form.alimentation.tauxRefus.${opt.value}` as Parameters<typeof t>[0])}
              </label>
            );
          })}
        </div>
      </div>

      {/* Comportement alimentaire */}
      <Select
        value={values.comportementAlim ?? ""}
        onValueChange={(v) => onChange("comportementAlim", v)}
      >
        <SelectTrigger label={t("form.alimentation.comportementAlim.label")}>
          <SelectValue placeholder={t("form.alimentation.typeAlimentPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {Object.values(ComportementAlimentaire).map((val) => (
            <SelectItem key={val} value={val}>
              {t(`form.alimentation.comportementAlim.${val}` as Parameters<typeof t>[0])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
