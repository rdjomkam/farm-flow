import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Container, Calendar, Fish, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IndicateursCards } from "@/components/vagues/indicateurs-cards";
import { PoidsChart } from "@/components/vagues/poids-chart";
import { RelevesList } from "@/components/vagues/releves-list";
import { CloturerDialog } from "@/components/vagues/cloturer-dialog";
import { getVagueById } from "@/lib/queries/vagues";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { StatutVague, TypeReleve } from "@/types";
import type { Releve, EvolutionPoidsPoint, IndicateursVague as IndicateursType } from "@/types";

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

export default async function VagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [vague, indicateurs] = await Promise.all([
    getVagueById(id),
    getIndicateursVague(id),
  ]);

  if (!vague) notFound();

  const statut = vague.statut as StatutVague;
  const isEnCours = statut === StatutVague.EN_COURS;

  const defaultIndicateurs: IndicateursType = {
    tauxSurvie: null,
    fcr: null,
    sgr: null,
    biomasse: null,
    poidsMoyen: null,
    tailleMoyenne: null,
    nombreVivants: null,
    totalMortalites: 0,
    totalAliment: 0,
    gainPoids: null,
    joursEcoules: 0,
  };

  // Build chart data from biometrie releves
  const poidsData: EvolutionPoidsPoint[] = vague.releves
    .filter((r) => r.typeReleve === TypeReleve.BIOMETRIE && r.poidsMoyen !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((r) => ({
      date: new Date(r.date).toISOString(),
      poidsMoyen: r.poidsMoyen!,
      jour: Math.floor(
        (new Date(r.date).getTime() - vague.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

  return (
    <>
      <Header title={vague.code}>
        {isEnCours && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/releves/nouveau?vagueId=${vague.id}`}>
                <Plus className="h-4 w-4" />
                Relevé
              </Link>
            </Button>
            <CloturerDialog vagueId={vague.id} vagueCode={vague.code} />
          </div>
        )}
      </Header>

      <div className="flex flex-col gap-4 p-4">
        {/* Info section */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-3">
            <Badge variant={statutVariants[statut]}>{statutLabels[statut]}</Badge>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(vague.dateDebut).toLocaleDateString("fr-FR")}
              {vague.dateFin && ` — ${new Date(vague.dateFin).toLocaleDateString("fr-FR")}`}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Fish className="h-3.5 w-3.5" />
              {vague.nombreInitial} alevins ({vague.poidsMoyenInitial}g)
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Container className="h-3.5 w-3.5" />
              {vague.bacs.length} bac{vague.bacs.length > 1 ? "s" : ""}
              {vague.bacs.length > 0 && (
                <span className="ml-1">
                  ({vague.bacs.map((b) => b.nom).join(", ")})
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Indicateurs */}
        <IndicateursCards indicateurs={indicateurs ?? defaultIndicateurs} />

        {/* Chart */}
        <PoidsChart data={poidsData} />

        {/* Relevés */}
        <RelevesList releves={vague.releves as unknown as Releve[]} />

        {/* Retour */}
        <div className="pb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/vagues">
              <ArrowLeft className="h-4 w-4" />
              Retour aux vagues
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
