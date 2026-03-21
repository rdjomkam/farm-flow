import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Calendar, Weight, HeartPulse, Container } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatutVague } from "@/types";
import type { VagueDashboardSummary } from "@/types";

const statutVariants: Record<StatutVague, "en_cours" | "terminee" | "annulee"> = {
  [StatutVague.EN_COURS]: "en_cours",
  [StatutVague.TERMINEE]: "terminee",
  [StatutVague.ANNULEE]: "annulee",
};

interface VagueSummaryCardProps {
  vague: VagueDashboardSummary;
  index?: number;
}

export async function VagueSummaryCard({ vague, index = 0 }: VagueSummaryCardProps) {
  const t = await getTranslations("vagues");

  return (
    <Link href={`/vagues/${vague.id}`}>
      <Card
        interactive
        className="animate-fade-in-up opacity-0"
        style={{ animationDelay: `${index * 80}ms` }}
      >
        <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">{vague.code}</CardTitle>
          <Badge variant={statutVariants[vague.statut]}>
            {t(`statuts.${vague.statut as "EN_COURS" | "TERMINEE" | "ANNULEE"}`)}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>J{vague.joursEcoules}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Container className="h-3.5 w-3.5" />
              <span>
                {vague.nombreBacs > 1
                  ? t("card.bacs", { count: vague.nombreBacs })
                  : t("card.bac", { count: vague.nombreBacs })}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Weight className="h-3.5 w-3.5 text-accent-blue" />
              <span className="font-medium">
                {vague.biomasse !== null ? `${vague.biomasse} kg` : "\u2014"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <HeartPulse className="h-3.5 w-3.5 text-success" />
              <span className="font-medium">
                {vague.tauxSurvie !== null ? `${vague.tauxSurvie}%` : "\u2014"}
              </span>
            </div>
          </div>
          {vague.poidsMoyen !== null && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("indicateurs.poidsMoyen")} : {vague.poidsMoyen} g
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
