import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { CommandeDetailClient } from "@/components/stock/commande-detail-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getCommandeById } from "@/lib/queries/commandes";
import { Permission } from "@/types";

export default async function CommandeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.APPROVISIONNEMENT_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const commande = await getCommandeById(id, session.activeSiteId);

  if (!commande) notFound();

  return (
    <>
      <Header title={commande.numero} />
      <div className="p-4">
        <CommandeDetailClient
          commande={JSON.parse(JSON.stringify(commande))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
