import { redirect } from "next/navigation";
import Link from "next/link";
import { Settings, Plus } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";
import { getConfigsElevage } from "@/lib/queries/config-elevage";
import { ConfigElevageListClient } from "@/components/config-elevage/config-elevage-list-client";
import { Button } from "@/components/ui/button";

export default async function ConfigElevagedPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.DASHBOARD_VOIR);
  if (!permissions) return <AccessDenied />;

  const configs = await getConfigsElevage(session.activeSiteId);

  return (
    <>
      <Header title="Profils de configuration">
        <Settings className="h-5 w-5 text-muted-foreground" />
      </Header>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Gerez les profils de configuration d&apos;elevage de votre site. Chaque profil
            definit les benchmarks, les seuils d&apos;alerte et les parametres d&apos;alimentation.
          </p>
          <Link href="/settings/config-elevage/nouveau">
            <Button size="sm" className="ml-4 shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau profil
            </Button>
          </Link>
        </div>
        <ConfigElevageListClient configs={JSON.parse(JSON.stringify(configs))} />
      </div>
    </>
  );
}
