import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { Header } from "@/components/layout/header";
import { AlertesConfigClient } from "@/components/alertes/alertes-config-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getConfigAlertes } from "@/lib/queries";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function SettingsAlertesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALERTES_CONFIGURER);
  if (!permissions) return <AccessDenied />;

  const configs = await getConfigAlertes(session.activeSiteId, session.userId);

  return (
    <>
      <Header title="Configuration des alertes">
        <Settings className="h-5 w-5 text-muted-foreground" />
      </Header>
      <div className="p-4">
        <p className="text-sm text-muted-foreground mb-4">
          Configurez les alertes automatiques pour votre site. Les alertes activees
          genereront des notifications dans la cloche de notification.
        </p>
        <AlertesConfigClient configs={JSON.parse(JSON.stringify(configs))} />
      </div>
    </>
  );
}
