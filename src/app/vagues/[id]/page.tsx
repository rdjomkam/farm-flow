import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Container, Calendar, Fish, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import { IndicateursCards } from "@/components/vagues/indicateurs-cards";
import { PoidsChart } from "@/components/vagues/poids-chart";
import { RelevesList } from "@/components/vagues/releves-list";
import { CloturerDialog } from "@/components/vagues/cloturer-dialog";
import { ModifierVagueDialog } from "@/components/vagues/modifier-vague-dialog";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagueById } from "@/lib/queries/vagues";
import { getIndicateursVague } from "@/lib/queries/indicateurs";
import { prisma } from "@/lib/db";
import { StatutVague, TypeReleve, CategorieProduit, Permission } from "@/types";
import type { Releve, EvolutionPoidsPoint, IndicateursVague as IndicateursType } from "@/types";
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
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.VAGUES_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const [vague, indicateurs, produitsDb] = await Promise.all([
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
      <Header title={vague.code} />
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
        {isEnCours && (
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/releves/nouveau?vagueId=${vague.id}`}>
                <Plus className="h-4 w-4" />
                Relevé
              </Link>
            </Button>
            <ModifierVagueDialog
              vagueId={vague.id}
              nombreInitial={vague.nombreInitial}
              poidsMoyenInitial={vague.poidsMoyenInitial}
              origineAlevins={vague.origineAlevins}
              permissions={permissions}
            />
            <CloturerDialog vagueId={vague.id} vagueCode={vague.code} />
          </>
        )}
        {permissions.includes(Permission.EXPORT_DONNEES) && (
          <div className="flex gap-2 ml-auto">
            <ExportButton
              href={`/api/export/vague/${vague.id}`}
              filename={`rapport-vague-${vague.code}.pdf`}
              label="Rapport PDF"
              variant="outline"
            />
            <ExportButton
              href={`/api/export/releves?vagueId=${vague.id}`}
              filename={`releves-${vague.code}.xlsx`}
              label="Export relevés"
              variant="outline"
            />
          </div>
        )}
      </div>

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
        </section>

        {/* Indicateurs */}
        <IndicateursCards indicateurs={indicateurs ?? defaultIndicateurs} />

        {/* Chart */}
        <PoidsChart data={poidsData} />

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
