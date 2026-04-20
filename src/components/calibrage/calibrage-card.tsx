"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scissors, Fish, AlertTriangle } from "lucide-react";
import type { CalibrageWithRelations } from "@/types";

interface CalibrageCardProps {
  calibrage: CalibrageWithRelations;
}

export function CalibrageCard({ calibrage }: CalibrageCardProps) {
  const t = useTranslations("calibrage");
  const locale = useLocale();
  const totalPoissons = calibrage.groupes.reduce(
    (sum, g) => sum + g.nombrePoissons,
    0
  );

  return (
    <Link href={`/vagues/${calibrage.vagueId}/calibrage/${calibrage.id}`}>
      <Card className="hover:border-primary/30 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="font-semibold text-sm">
                {t("card.title")}{" "}
                {new Date(calibrage.date).toLocaleDateString(locale, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {(calibrage as { modifie?: boolean }).modifie && (
                <Badge variant="warning">{t("card.modified")}</Badge>
              )}
              <Badge variant="info">
                {calibrage.groupes.length > 1
                  ? t("card.groupes", { count: calibrage.groupes.length })
                  : t("card.groupe", { count: calibrage.groupes.length })}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            {calibrage.groupes.map((g, i) => (
              <Badge key={i} variant="default">
                {t(`categories.${g.categorie}` as Parameters<typeof t>[0]) ??
                  g.categorie}
                : {g.nombrePoissons}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Fish className="h-3 w-3" />
              {t("detail.poissonsRedistribues", { count: totalPoissons })}
            </span>
            {calibrage.nombreMorts > 0 && (
              <span className="flex items-center gap-1 text-danger">
                <AlertTriangle className="h-3 w-3" />
                {calibrage.nombreMorts > 1
                  ? t("detail.mortsConstates", { count: calibrage.nombreMorts })
                  : t("detail.mortConstates", { count: calibrage.nombreMorts })}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            {t("detail.byUser", { name: calibrage.user.name })}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
