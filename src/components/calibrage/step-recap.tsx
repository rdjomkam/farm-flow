"use client";

import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { FishLoader } from "@/components/ui/fish-loader";
import { CategorieCalibrage } from "@/types";
import type { BacResponse } from "@/types";
import type { GroupeForm } from "./calibrage-form-client";

const categorieBadgeVariants: Record<
  CategorieCalibrage,
  "default" | "info" | "en_cours" | "terminee" | "warning" | "annulee"
> = {
  [CategorieCalibrage.PETIT]: "default",
  [CategorieCalibrage.MOYEN]: "info",
  [CategorieCalibrage.GROS]: "en_cours",
  [CategorieCalibrage.TRES_GROS]: "terminee",
};

interface StepRecapProps {
  bacs: BacResponse[];
  selectedBacIds: string[];
  groupes: GroupeForm[];
  nombreMorts: string;
  notes: string;
  date: string;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function StepRecap({
  bacs,
  selectedBacIds,
  groupes,
  nombreMorts,
  notes,
  date,
  onBack,
  onSubmit,
  submitting,
}: StepRecapProps) {
  const t = useTranslations("calibrage.stepRecap");
  const locale = useLocale();
  const sourceBacs = bacs.filter((b) => selectedBacIds.includes(b.id));
  const totalSourcePoissons = sourceBacs.reduce(
    (sum, b) => sum + (b.nombrePoissons ?? 0),
    0
  );
  const totalGroupePoissons = groupes.reduce(
    (sum, g) => sum + (Number(g.nombrePoissons) || 0),
    0
  );
  const morts = Number(nombreMorts) || 0;
  const isBalanced = totalGroupePoissons + morts === totalSourcePoissons;

  function getBacNom(bacId: string) {
    return bacs.find((b) => b.id === bacId)?.nom ?? bacId;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("description")}
        </p>
      </div>

      {/* Bacs sources */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">{t("bacsSources")}</h3>
        <div className="flex flex-col gap-2">
          {sourceBacs.map((bac) => (
            <div
              key={bac.id}
              className="flex items-center justify-between text-sm"
            >
              <span>{bac.nom}</span>
              <span className="text-muted-foreground">
                {t("poissons", { count: bac.nombrePoissons ?? 0 })}
              </span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex items-center justify-between text-sm font-semibold">
            <span>{t("total")}</span>
            <span>{t("poissons", { count: totalSourcePoissons })}</span>
          </div>
        </div>
      </section>

      {/* Groupes */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">{t("groupesRedistribution")}</h3>
        <div className="flex flex-col gap-3">
          {groupes.map((g, i) => (
            <div
              key={i}
              className="rounded-lg bg-surface-2 p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <Badge
                  variant={
                    categorieBadgeVariants[g.categorie as CategorieCalibrage] ??
                    "default"
                  }
                >
                  {t(`categorieOptions.${g.categorie}` as "categorieOptions.PETIT") ?? g.categorie}
                </Badge>
                <span className="text-sm font-semibold">
                  {t("poissons", { count: Number(g.nombrePoissons) })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {getBacNom(g.destinationBacId)} — {g.poidsMoyen} g
                {g.tailleMoyenne ? ` — ${g.tailleMoyenne} cm` : ""}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Date du calibrage */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">{t("dateCalibrage")}</h3>
        <p className="text-sm font-semibold">
          {new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(date))}
        </p>
      </section>

      {/* Mortalite */}
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">{t("mortalite")}</h3>
        <p className="text-sm">
          <span className="text-muted-foreground">{t("mortsConstates")} : </span>
          <span className="font-semibold">{morts}</span>
        </p>
        {notes && (
          <p className="text-sm mt-2">
            <span className="text-muted-foreground">{t("notesMortalite")} : </span>
            {notes}
          </p>
        )}
      </section>

      {/* Validation conservation */}
      {isBalanced && (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <p className="text-sm text-success font-medium">
            {t("conservationValidee")} : {totalSourcePoissons} = {totalGroupePoissons}{" "}
            + {morts}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
          className="flex-1"
        >
          {t("retour")}
        </Button>
        <Button
          type="button"
          onClick={onSubmit}
          disabled={!isBalanced || submitting}
          className="flex-1"
        >
          {submitting ? <><FishLoader size="sm" /> {t("enregistrement")}</> : t("confirmer")}
        </Button>
      </div>
    </div>
  );
}
