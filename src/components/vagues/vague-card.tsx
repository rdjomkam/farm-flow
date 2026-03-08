import Link from "next/link";
import { Calendar, Container, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatutVague } from "@/types";
import type { VagueSummaryResponse } from "@/types";

const statutLabels: Record<StatutVague, string> = {
  [StatutVague.EN_COURS]: "En cours",
  [StatutVague.TERMINEE]: "Terminée",
  [StatutVague.ANNULEE]: "Annulée",
};

const statutVariants: Record<StatutVague, "en_cours" | "terminee" | "annulee"> = {
  [StatutVague.EN_COURS]: "en_cours",
  [StatutVague.TERMINEE]: "terminee",
  [StatutVague.ANNULEE]: "annulee",
};

interface VagueCardProps {
  vague: VagueSummaryResponse;
}

export function VagueCard({ vague }: VagueCardProps) {
  const statut = vague.statut as StatutVague;

  return (
    <Link href={`/vagues/${vague.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">{vague.code}</CardTitle>
          <Badge variant={statutVariants[statut]}>{statutLabels[statut]}</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{new Date(vague.dateDebut).toLocaleDateString("fr-FR")}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>J{vague.joursEcoules}</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Container className="h-3.5 w-3.5" />
              <span>{vague.nombreBacs} bac{vague.nombreBacs > 1 ? "s" : ""}</span>
            </div>
            <div className="text-muted-foreground">
              <span>{vague.nombreInitial} alevins</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
