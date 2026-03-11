import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { FacturesListClient } from "@/components/ventes/factures-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getFactures } from "@/lib/queries/factures";
import { Permission } from "@/types";

export default async function FacturesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.FACTURES_VOIR);
  if (!permissions) return <AccessDenied />;

  const factures = await getFactures(session.activeSiteId);

  return (
    <>
      <Header title="Factures" />
      <div className="p-4">
        <FacturesListClient
          factures={JSON.parse(JSON.stringify(factures))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
