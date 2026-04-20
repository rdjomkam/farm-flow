"use client";

import { memo } from "react";
import Link from "next/link";
import { Calendar, Container, Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatutVague } from "@/types";
import type { VagueSummaryResponse } from "@/types";

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
  const locale = useLocale();
  const statut = vague.statut as StatutVague;

  return (
    <Link href={`/vagues/${vague.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">{vague.code}</CardTitle>
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
        </CardContent>
      </Card>
    </Link>
  );
}

export const VagueCard = memo(VagueCardBase);
