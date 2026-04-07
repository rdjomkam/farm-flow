import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { IncubationDetailClient } from "@/components/reproduction/incubation-detail-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getIncubationById } from "@/lib/queries/incubations";
import { Permission } from "@/types";

export default async function IncubationDetailPage({
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
  const incubation = await getIncubationById(id, session.activeSiteId);

  if (!incubation) notFound();

  return (
    <>
      <Header title={incubation.code} />
      <div className="p-4">
        <IncubationDetailClient
          incubation={JSON.parse(JSON.stringify(incubation))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
