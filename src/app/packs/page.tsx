import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PacksListClient } from "@/components/packs/packs-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getPacks } from "@/lib/queries/packs";
import { Permission } from "@/types";

export default async function PacksPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.DASHBOARD_VOIR);
  if (!permissions) return <AccessDenied />;

  const packs = await getPacks(session.activeSiteId);

  return (
    <>
      <Header title="Packs" />
      <div className="p-4">
        <PacksListClient
          packs={JSON.parse(JSON.stringify(packs))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
