import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { VenteDetailClient } from "@/components/ventes/vente-detail-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getVenteById } from "@/lib/queries/ventes";
import { getClients } from "@/lib/queries/clients";
import { getHistoriqueBonsLivraison } from "@/lib/queries/bons-livraison";
import { prisma } from "@/lib/db";
import { Permission, StatutVague } from "@/types";

export default async function VenteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.VENTES_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const activeSiteId = session.activeSiteId;

  const [vente, clients, vagues, bonLivraisonHistorique] = await Promise.all([
    getVenteById(id, activeSiteId),
    getClients(activeSiteId),
    prisma.vague.findMany({
      where: {
        siteId: activeSiteId,
        statut: { not: StatutVague.ANNULEE },
      },
      include: {
        // ADR-043 Phase 3: lire le stock de poissons depuis AssignationBac
        assignations: {
          where: { dateFin: null },
          select: { nombreActuel: true },
        },
      },
      orderBy: { dateDebut: "desc" },
    }),
    // BF.7b — historique des BL rectifies (non actifs) de cette vente, pour
    // affichage dans VenteDetailClient. getVenteById (BF.6b/BF.7a) n'expose
    // que le BL actif ; l'historique passe par son propre helper (R8).
    getHistoriqueBonsLivraison(activeSiteId, id),
  ]);

  if (!vente) notFound();

  const clientOptions = clients.map((c) => ({ id: c.id, nom: c.nom }));
  const vagueOptions = vagues.map((v) => ({
    id: v.id,
    code: v.code,
    poissonsDisponibles: v.assignations.reduce(
      (sum, a) => sum + (a.nombreActuel ?? 0),
      0
    ),
  }));

  return (
    <>
      <Header title={vente.numero} />
      <div className="p-4">
        <VenteDetailClient
          vente={{
            ...JSON.parse(JSON.stringify(vente)),
            bonLivraisonHistorique: JSON.parse(JSON.stringify(bonLivraisonHistorique)),
          }}
          permissions={permissions}
          clients={clientOptions}
          vagues={vagueOptions}
          currentUserName={session.name}
        />
      </div>
    </>
  );
}
