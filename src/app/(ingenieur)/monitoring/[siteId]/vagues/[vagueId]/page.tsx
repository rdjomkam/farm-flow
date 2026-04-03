import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Fish, Container } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/ui/access-denied";
import { IndicateursCards } from "@/components/vagues/indicateurs-cards";
import { PoidsChart } from "@/components/vagues/poids-chart";
import { RelevesList } from "@/components/vagues/releves-list";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getClientIngenieurDetail } from "@/lib/queries/ingenieur";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { prisma } from "@/lib/db";
import { Permission, StatutVague, TypeReleve } from "@/types";
import type { Releve, EvolutionPoidsPoint, IndicateursVague as IndicateursType } from "@/types";


const statutVariants: Record<StatutVague, "en_cours" | "terminee" | "annulee"> = {
  [StatutVague.EN_COURS]: "en_cours",
  [StatutVague.TERMINEE]: "terminee",
  [StatutVague.ANNULEE]: "annulee",
};

export default async function IngenieurVagueDetailPage({
  params,
}: {
  params: Promise<{ siteId: string; vagueId: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.MONITORING_CLIENTS);
  if (!permissions) return <AccessDenied />;

  const { siteId: clientSiteId, vagueId } = await params;

  // Verify the client site belongs to this ingenieur
  const clientSummary = await getClientIngenieurDetail(session.activeSiteId, clientSiteId);
  if (!clientSummary) notFound();

  // Fetch vague with releves and bacs
  const vague = await prisma.vague.findFirst({
    where: { id: vagueId, siteId: clientSiteId },
    include: {
      releves: {
        orderBy: { date: "asc" },
      },
      bacs: { select: { id: true, nom: true, nombrePoissons: true } },
    },
  });

  if (!vague) notFound();

  const indicateurs = await getIndicateursVague(clientSiteId, vagueId);
  const tVagues = await getTranslations("vagues");
  const tIngenieur = await getTranslations("ingenieur");

  const statut = vague.statut as StatutVague;

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

  // Build chart data from biometrie releves — aggregate by date (weighted avg across bacs)
  const bacsMap = new Map(vague.bacs.map((b) => [b.id, b]));
  const biometries = vague.releves.filter(
    (r) => r.typeReleve === TypeReleve.BIOMETRIE && r.poidsMoyen !== null
  );
  const groupedByDate = new Map<string, typeof biometries>();
  for (const r of biometries) {
    const key = new Date(r.date).toISOString().slice(0, 10);
    const group = groupedByDate.get(key);
    if (group) group.push(r);
    else groupedByDate.set(key, [r]);
  }

  // Build observation map: jour -> weighted average poidsMoyen
  const HORIZON_PREDICTION_JOURS = 120;
  const vagueStartMs = vague.dateDebut.getTime();

  const observationByJour = new Map<number, number>();
  for (const [dateKey, releves] of groupedByDate) {
    let sumWeighted = 0;
    let sumWeights = 0;
    for (const r of releves) {
      const bac = r.bacId ? bacsMap.get(r.bacId) : undefined;
      const weight = bac?.nombrePoissons ?? 1;
      sumWeighted += r.poidsMoyen! * weight;
      sumWeights += weight;
    }
    const dateMs = new Date(dateKey + "T00:00:00").getTime();
    const jour = Math.floor((dateMs - vagueStartMs) / 86400000);
    observationByJour.set(jour, Math.round((sumWeighted / sumWeights) * 100) / 100);
  }

  // Dense dataset: one point per day from J0 to max(120, dernierJour+30)
  const dernierJourObserve = observationByJour.size > 0
    ? Math.max(...observationByJour.keys())
    : 0;
  const joursHorizon = Math.max(HORIZON_PREDICTION_JOURS, dernierJourObserve + 30);

  const poidsData: EvolutionPoidsPoint[] = [];
  for (let j = 0; j <= joursHorizon; j++) {
    const obs = observationByJour.get(j) ?? null;
    poidsData.push({
      date: new Date(vagueStartMs + j * 86400000).toISOString(),
      poidsMoyen: obs,
      jour: j,
      isPrediction: obs === null && j > dernierJourObserve,
    });
  }

  return (
    <>
      <Header title={vague.code}>
        <Link href={`/monitoring/${clientSiteId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">{tIngenieur("monitoring.back")}</span>
          </Button>
        </Link>
      </Header>

      <div className="flex flex-col gap-4 p-4 min-w-0 overflow-hidden">
        {/* Info section */}
        <section className="flex flex-wrap items-center gap-2 border-b border-border pb-3 min-w-0">
          <Badge variant={statutVariants[statut]}>{tVagues(`statuts.${statut}`)}</Badge>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(vague.dateDebut).toLocaleDateString("fr-FR")}
            {vague.dateFin && ` — ${new Date(vague.dateFin).toLocaleDateString("fr-FR")}`}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Fish className="h-3.5 w-3.5" />
            {vague.nombreInitial} alevins ({vague.poidsMoyenInitial}g)
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            <Container className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {vague.bacs.length} bac{vague.bacs.length > 1 ? "s" : ""}
              {vague.bacs.length > 0 && ` (${vague.bacs.map((b) => b.nom).join(", ")})`}
            </span>
          </div>
        </section>

        {/* Indicateurs */}
        <IndicateursCards indicateurs={indicateurs ?? defaultIndicateurs} />

        {/* Chart */}
        <PoidsChart data={poidsData} />

        {/* Releves (read-only: empty permissions array disables edit actions) */}
        <RelevesList
          releves={vague.releves as unknown as Releve[]}
          permissions={[]}
        />

        {/* Retour */}
        <div className="pb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/monitoring/${clientSiteId}`}>
              <ArrowLeft className="h-4 w-4" />
              {tIngenieur("monitoring.back")}
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
