"use client";

import { memo } from "react";
import Link from "next/link";
import { Calendar, Container, Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatutVague, TypeVague } from "@/types";
import type { VagueSummaryResponse } from "@/types";
import { formatNum } from "@/lib/format";

const statutVariants: Record<StatutVague, "en_cours" | "terminee" | "annulee"> = {
  [StatutVague.EN_COURS]: "en_cours",
  [StatutVague.TERMINEE]: "terminee",
  [StatutVague.ANNULEE]: "annulee",
};

interface VagueCardProps {
  vague: VagueSummaryResponse;
}

function VagueCardBase({ vague }: VagueCardProps) {
  const t = useTranslations("vagues");
  const td = useTranslations("dashboard.hero");
  const locale = useLocale();
  const statut = vague.statut as StatutVague;

  const biomasseVivante = vague.biomasse ?? 0;
  const totalVendu = vague.totalVenduKg ?? 0;
  const totalProduction = biomasseVivante + totalVendu;
  const hasObjectif = vague.poidsObjectifKg != null && vague.poidsObjectifKg > 0;
  const pctObjectif = hasObjectif
    ? Math.min(100, Math.round((totalProduction / (vague.poidsObjectifKg as number)) * 100))
    : 0;
  const hasVentes = totalVendu > 0;
  const pctVendu = hasVentes && totalProduction > 0
    ? Math.round((totalVendu / totalProduction) * 100)
    : 0;

  return (
    <Link href={`/vagues/${vague.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-base truncate">{vague.code}</CardTitle>
            {vague.type === TypeVague.PRE_GROSSISSEMENT ? (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-secondary/20 text-secondary-foreground border border-secondary/30">
                PRE
              </span>
            ) : (
              <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                GROS
              </span>
            )}
          </div>
          <Badge variant={statutVariants[statut]}>{t(`statuts.${statut}`)}</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{new Date(vague.dateDebut).toLocaleDateString(locale)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>J{vague.joursEcoules}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Container className="h-3.5 w-3.5" />
              <span>{vague.nombreBacs > 1 ? t("card.bacs", { count: vague.nombreBacs }) : t("card.bac", { count: vague.nombreBacs })}</span>
            </div>
            <div className="text-muted-foreground">
              <span>{t("card.alevins", { count: vague.nombreInitial })}</span>
            </div>
          </div>

          {/* Progress: Production vs objectif */}
          {hasObjectif && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{td("objectifLabel")}</span>
                <span>
                  {formatNum(totalProduction, 1)} / {formatNum(vague.poidsObjectifKg ?? 0, 0)} kg
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-green transition-all"
                  style={{ width: `${pctObjectif}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 text-right">{pctObjectif}%</p>
            </div>
          )}

          {/* Progress: Vendu / Production totale */}
          {hasVentes && totalProduction > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{td("ventesLabel")}</span>
                <span>
                  {formatNum(totalVendu, 1)} / {formatNum(totalProduction, 1)} kg
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, pctVendu)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 text-right">{pctVendu}%</p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

export const VagueCard = memo(VagueCardBase);
