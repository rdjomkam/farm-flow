import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { VaguesListClient } from "@/components/vagues/vagues-list-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { QuotasUsageBar } from "@/components/subscription/quotas-usage-bar";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagues } from "@/lib/queries/vagues";
import { getBacsLibres } from "@/lib/queries/bacs";
import { StatutVague, Permission, TypeSystemeBac } from "@/types";
import type { VagueSummaryResponse, BacResponse } from "@/types";

export default async function VaguesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.VAGUES_VOIR);
  if (!permissions) return <AccessDenied />;

  const [vaguesRaw, bacsLibresRaw] = await Promise.all([
    getVagues(session.activeSiteId),
    getBacsLibres(session.activeSiteId),
  ]);

  const vagues: VagueSummaryResponse[] = vaguesRaw.map((v) => {
    const now = v.dateFin ?? new Date();
    const joursEcoules = Math.floor(
      (now.getTime() - v.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      id: v.id,
      code: v.code,
      dateDebut: v.dateDebut,
      dateFin: v.dateFin,
      statut: v.statut as StatutVague,
      nombreInitial: v.nombreInitial,
      poidsMoyenInitial: v.poidsMoyenInitial,
      origineAlevins: v.origineAlevins,
      nombreBacs: v._count.bacs,
      joursEcoules,
      createdAt: v.createdAt,
    };
  });

  const bacsLibres: BacResponse[] = bacsLibresRaw.map((b) => ({
    id: b.id,
    nom: b.nom,
    volume: b.volume,
    nombrePoissons: b.nombrePoissons,
    nombreInitial: b.nombreInitial,
    poidsMoyenInitial: b.poidsMoyenInitial,
    typeSysteme: (b.typeSysteme as TypeSystemeBac | null) ?? null,
    vagueId: b.vagueId,
    siteId: b.siteId,
    vagueCode: null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  }));

  return (
    <>
      <Header title="Vagues" />
      <div className="px-4 pt-4">
        <QuotasUsageBar siteId={session.activeSiteId} />
      </div>
      <VaguesListClient vagues={vagues} bacsLibres={bacsLibres} permissions={permissions} />
    </>
  );
}
