import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { LotsAlevinsListClient } from "@/components/alevins/lots-list-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getLotsAlevins } from "@/lib/queries/lots-alevins";
import { getPontes } from "@/lib/queries/pontes";
import { Permission } from "@/types";

export default async function AlevinsLotsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const [lots, pontes] = await Promise.all([
    getLotsAlevins(session.activeSiteId),
    getPontes(session.activeSiteId),
  ]);

  const ponteOptions = pontes.map((p) => ({ id: p.id, code: p.code }));

  return (
    <>
      <Header title="Lots d'alevins" />
      <div className="p-4">
        <LotsAlevinsListClient
          lots={JSON.parse(JSON.stringify(lots))}
          pontes={ponteOptions}
          permissions={permissions}
        />
      </div>
    </>
  );
}
