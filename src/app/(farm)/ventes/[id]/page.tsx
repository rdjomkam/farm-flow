import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { VenteDetailClient } from "@/components/ventes/vente-detail-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getVenteById } from "@/lib/queries/ventes";
import { getClients } from "@/lib/queries/clients";
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

  const [vente, clients, vagues] = await Promise.all([
    getVenteById(id, activeSiteId),
    getClients(activeSiteId),
    prisma.vague.findMany({
      where: {
        siteId: activeSiteId,
        statut: { not: StatutVague.ANNULEE },
      },
      include: {
        bacs: { select: { nombrePoissons: true } },
      },
      orderBy: { dateDebut: "desc" },
    }),
  ]);

  if (!vente) notFound();

  const clientOptions = clients.map((c) => ({ id: c.id, nom: c.nom }));
  const vagueOptions = vagues.map((v) => ({
    id: v.id,
    code: v.code,
    poissonsDisponibles: v.bacs.reduce(
      (sum, bac) => sum + (bac.nombrePoissons ?? 0),
      0
    ),
  }));

  return (
    <>
      <Header title={vente.numero} />
      <div className="p-4">
        <VenteDetailClient
          vente={JSON.parse(JSON.stringify(vente))}
          permissions={permissions}
          clients={clientOptions}
          vagues={vagueOptions}
        />
      </div>
    </>
  );
}
