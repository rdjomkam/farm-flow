import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { VenteDetailClient } from "@/components/ventes/vente-detail-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getVenteById } from "@/lib/queries/ventes";
import { Permission } from "@/types";

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
  const vente = await getVenteById(id, session.activeSiteId);

  if (!vente) notFound();

  return (
    <>
      <Header title={vente.numero} />
      <div className="p-4">
        <VenteDetailClient
          vente={JSON.parse(JSON.stringify(vente))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
