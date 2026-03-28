import { redirect } from "next/navigation";
import { Variable } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";
import { PlaceholdersClient } from "@/components/regles-activites/placeholders-client";

export default async function PlaceholdersPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.REGLES_ACTIVITES_VOIR
  );
  if (!permissions) return <AccessDenied />;

  const canManage = permissions.includes(Permission.GERER_REGLES_GLOBALES);

  return (
    <>
      <Header title="Placeholders personnalises">
        <Variable className="h-5 w-5 text-muted-foreground" />
      </Header>
      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Definissez des placeholders personnalises utilisables dans les
          templates de regles. Les placeholders sont globaux et disponibles pour
          tous les sites.
        </p>
        <PlaceholdersClient canManage={canManage} />
      </div>
    </>
  );
}
