import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ActiviteListClient } from "@/components/activites/activite-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getAllMyTasks, marquerActivitesEnRetard } from "@/lib/queries";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function MesTachesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.DASHBOARD_VOIR);
  if (!permissions) return <AccessDenied />;

  // Marquer les activites en retard avant le chargement
  await marquerActivitesEnRetard(session.activeSiteId);

  // Charger toutes les activites assignees (tous statuts) pour les filtres client
  const tasks = await getAllMyTasks(session.activeSiteId, session.userId);

  return (
    <>
      <Header title="Mes taches" />
      <div className="p-4">
        <ActiviteListClient
          activites={JSON.parse(JSON.stringify(tasks))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
