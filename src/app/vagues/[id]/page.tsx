import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Container, Calendar, Fish, Scissors } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IndicateursCards } from "@/components/vagues/indicateurs-cards";
import { PoidsChart } from "@/components/vagues/poids-chart";
import { RelevesList } from "@/components/vagues/releves-list";
import { VagueActionMenu } from "@/components/vagues/vague-action-menu";
import { AccessDenied } from "@/components/ui/access-denied";
import { CalibragesList } from "@/components/calibrage/calibrages-list";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagueById } from "@/lib/queries/vagues";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { getCalibrages } from "@/lib/queries/calibrages";
import { prisma } from "@/lib/db";
import { computeVivantsByBac } from "@/lib/calculs";
import { StatutVague, TypeReleve, CategorieProduit, Permission } from "@/types";
import type { Releve, EvolutionPoidsPoint, IndicateursVague as IndicateursType, CalibrageWithRelations } from "@/types";
import type { ProduitOption } from "@/components/releves/consommation-fields";

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
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.VAGUES_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const [vague, indicateurs, produitsDb, calibragesDb] = await Promise.all([
    getVagueById(id, session.activeSiteId),
    getIndicateursVague(session.activeSiteId, id),
    prisma.produit.findMany({
      where: {
        siteId: session.activeSiteId,
        isActive: true,
        categorie: { in: [CategorieProduit.ALIMENT, CategorieProduit.INTRANT] },
      },
      select: { id: true, nom: true, categorie: true, unite: true, stockActuel: true },
      orderBy: { nom: "asc" },
    }),
    getCalibrages(session.activeSiteId, { vagueId: id }),
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

  // Build chart data from biometrie releves — aggregate by date (weighted avg across bacs)
  const vivantsByBac = computeVivantsByBac(vague.bacs, vague.releves, vague.nombreInitial);
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
  const poidsData: EvolutionPoidsPoint[] = Array.from(groupedByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, releves]) => {
      let sumWeighted = 0;
      let sumWeights = 0;
      for (const r of releves) {
        const weight = (r.bacId ? vivantsByBac.get(r.bacId) : undefined) ?? 1;
        sumWeighted += r.poidsMoyen! * weight;
        sumWeights += weight;
      }
      const dateObj = new Date(dateKey + "T00:00:00");
      return {
        date: dateObj.toISOString(),
        poidsMoyen: Math.round((sumWeighted / sumWeights) * 100) / 100,
        jour: Math.floor(
          (dateObj.getTime() - vague.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
        ),
      };
    });

  return (
    <>
      <Header title={vague.code} />

      <div className="flex flex-col gap-4 p-4 min-w-0 overflow-hidden">
        {/* Info section */}
        <section className="flex flex-wrap items-center gap-2 border-b border-border pb-3 min-w-0">
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
          <div className="flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            <Container className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {vague.bacs.length} bac{vague.bacs.length > 1 ? "s" : ""}
              {vague.bacs.length > 0 && ` (${vague.bacs.map((b) => b.nom).join(", ")})`}
            </span>
          </div>
          {(isEnCours || permissions.includes(Permission.EXPORT_DONNEES)) && (
            <VagueActionMenu
              vagueId={vague.id}
              vagueCode={vague.code}
              nombreInitial={vague.nombreInitial}
              poidsMoyenInitial={vague.poidsMoyenInitial}
              origineAlevins={vague.origineAlevins}
              permissions={permissions}
              isEnCours={isEnCours}
              canExport={permissions.includes(Permission.EXPORT_DONNEES)}
              className="ml-auto"
            />
          )}
        </section>

        {/* Indicateurs */}
        <IndicateursCards indicateurs={indicateurs ?? defaultIndicateurs} />

        {/* Chart */}
        <PoidsChart data={poidsData} />

        {/* Calibrages */}
        {permissions.includes(Permission.CALIBRAGES_VOIR) && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Calibrages</h2>
              {isEnCours && permissions.includes(Permission.CALIBRAGES_CREER) && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/vagues/${vague.id}/calibrage/nouveau`}>
                    <Scissors className="h-4 w-4" />
                    Nouveau
                  </Link>
                </Button>
              )}
            </div>
            <CalibragesList calibrages={calibragesDb as CalibrageWithRelations[]} limit={2} vagueId={vague.id} />
          </section>
        )}

        {/* Relevés */}
        <RelevesList
          releves={vague.releves as Releve[]}
          produits={produitsDb.map((p) => ({
            id: p.id,
            nom: p.nom,
            categorie: p.categorie,
            unite: p.unite,
            stockActuel: p.stockActuel,
          } satisfies ProduitOption))}
          permissions={permissions}
          limit={2}
          vagueId={vague.id}
        />

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
