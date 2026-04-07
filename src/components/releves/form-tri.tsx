"use client";

import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";

interface FormTriProps {
  values: { description: string; lotAlevinsId: string };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}

/**
 * Formulaire pour un releve de type TRI (tri par taille des alevins).
 * Le champ description est obligatoire.
 * Le champ lotAlevinsId est pre-rempli si l'utilisateur arrive depuis la page d'un lot.
 */
export function FormTri({ values, onChange, errors }: FormTriProps) {
  const t = useTranslations("releves");

  return (
    <div className="flex flex-col gap-3">
      {values.lotAlevinsId && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
          <p className="text-xs text-primary font-medium">
            {t("form.fields.lotAlevins")} : {values.lotAlevinsId}
          </p>
        </div>
      )}
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
