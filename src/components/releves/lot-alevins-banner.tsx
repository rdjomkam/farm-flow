"use client";

import { Fish } from "lucide-react";
import { useTranslations } from "next-intl";

interface LotAlevinsBannerProps {
  /** Code du lot d'alevins (ex: "LOT-2026-001") */
  lotCode: string;
}

/**
 * Bannière affichée en haut du formulaire de relevé en mode lot d'alevins.
 * Remplace l'ancien affichage inline dans form-tri.tsx.
 */
export function LotAlevinsBanner({ lotCode }: LotAlevinsBannerProps) {
  const t = useTranslations("releves");

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
      <Fish className="h-4 w-4 text-primary shrink-0" />
      <p className="text-sm font-medium text-primary">
        {t("form.sections.identification.lotAlevinsBanner", { code: lotCode })}
      </p>
    </div>
  );
}
