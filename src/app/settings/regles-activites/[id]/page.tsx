import { redirect, notFound } from "next/navigation";
import { Settings } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";
import { getRegleActiviteById } from "@/lib/queries/regles-activites";
import { getCustomPlaceholders } from "@/lib/queries/custom-placeholders";
import { RegleDetailClient } from "@/components/regles-activites/regle-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RegleActiviteDetailPage({ params }: Props) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.REGLES_ACTIVITES_VOIR
  );
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const [regle, customPlaceholders] = await Promise.all([
    getRegleActiviteById(id, session.activeSiteId),
    getCustomPlaceholders(true),
  ]);
  if (!regle) notFound();

  return (
    <>
      <Header title={regle.nom}>
        <Settings className="h-5 w-5 text-muted-foreground" />
      </Header>
      <div className="p-4 pb-24">
        <RegleDetailClient
          regle={JSON.parse(JSON.stringify(regle))}
          canManage={permissions.includes(Permission.GERER_REGLES_ACTIVITES)}
          canManageGlobal={permissions.includes(Permission.GERER_REGLES_GLOBALES)}
          customPlaceholders={JSON.parse(JSON.stringify(customPlaceholders))}
        />
      </div>
    </>
  );
}
