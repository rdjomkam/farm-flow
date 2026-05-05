"use client";

import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";

interface FormTriProps {
  values: { description: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

/**
 * Formulaire pour un releve de type TRI (tri par taille des alevins).
 * Le champ description est obligatoire.
 * La bannière du lot d'alevins est affichée dans releve-form-fields.tsx (LotAlevinsBanner).
 */
export function FormTri({ values, onChange, errors }: FormTriProps) {
  const t = useTranslations("releves");

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        id="description"
        label={t("form.tri.description")}
        rows={4}
        placeholder={t("form.tri.placeholder")}
        required
        value={values.description}
        onChange={(e) => onChange("description", e.target.value)}
        error={errors.description}
      />
    </div>
  );
}
