import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ReproductionPonteDetailClient } from "@/components/reproduction/ponte-detail-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getPonteById } from "@/lib/queries/pontes";
import { Permission } from "@/types";

export default async function ReproductionPonteDetailPage({
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
  const ponte = await getPonteById(id, session.activeSiteId);

  if (!ponte) notFound();

  return (
    <>
      <Header title={ponte.code} />
      <div className="p-4">
        <ReproductionPonteDetailClient
          ponte={JSON.parse(JSON.stringify(ponte))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
