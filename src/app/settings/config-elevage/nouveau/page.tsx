import { redirect } from "next/navigation";
import { Settings } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission, Role } from "@/types";
import { getConfigsElevage } from "@/lib/queries/config-elevage";
import { ConfigElevageFormClient } from "@/components/config-elevage/config-elevage-form-client";

export default async function ConfigElevageNouveauPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.SITE_GERER);
  if (!permissions) return <AccessDenied />;

  // PISCICULTEUR = lecture seule
  if (session.role === Role.PISCICULTEUR) return <AccessDenied />;

  // Charger les profils existants pour le select de template
  const templates = await getConfigsElevage(session.activeSiteId);

  return (
    <>
      <Header title="Nouveau profil de configuration">
        <Settings className="h-5 w-5 text-muted-foreground" />
      </Header>
      <div className="p-4">
        <ConfigElevageFormClient templates={JSON.parse(JSON.stringify(templates))} />
      </div>
    </>
  );
}
