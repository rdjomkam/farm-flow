import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { FactureDetailClient } from "@/components/ventes/facture-detail-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getFactureById } from "@/lib/queries/factures";
import { Permission } from "@/types";

export default async function FactureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.FACTURES_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const facture = await getFactureById(id, session.activeSiteId);

  if (!facture) notFound();

  return (
    <>
      <Header title={facture.numero} />
      <div className="p-4">
        <FactureDetailClient
          facture={JSON.parse(JSON.stringify(facture))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
