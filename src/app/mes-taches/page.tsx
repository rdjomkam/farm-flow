import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { MesTachesClient } from "@/components/planning/mes-taches-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getMyTasks, marquerActivitesEnRetard } from "@/lib/queries";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function MesTachesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.PLANNING_VOIR);
  if (!permissions) return <AccessDenied />;

  // Update overdue activities before loading
  await marquerActivitesEnRetard(session.activeSiteId);

  const tasks = await getMyTasks(session.activeSiteId, session.userId);

  return (
    <>
      <Header title="Mes taches" />
      <div className="p-4">
        <MesTachesClient
          activites={JSON.parse(JSON.stringify(tasks))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
