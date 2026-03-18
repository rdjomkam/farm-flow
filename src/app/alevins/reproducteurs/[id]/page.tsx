import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ReproducteurDetailClient } from "@/components/alevins/reproducteur-detail-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getReproducteurById } from "@/lib/queries/reproducteurs";
import { Permission } from "@/types";

export default async function ReproducteurDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const reproducteur = await getReproducteurById(id, session.activeSiteId);

  if (!reproducteur) notFound();

  return (
    <>
      <Header title={reproducteur.code} />
      <div className="p-4">
        <ReproducteurDetailClient
          reproducteur={JSON.parse(JSON.stringify(reproducteur))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
