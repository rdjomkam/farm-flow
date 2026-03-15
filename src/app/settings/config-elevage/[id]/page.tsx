import { redirect, notFound } from "next/navigation";
import { Settings } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";
import { getConfigElevageById } from "@/lib/queries/config-elevage";
import { ConfigElevageEditClient } from "@/components/config-elevage/config-elevage-edit-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ConfigElevageEditPage({ params }: Props) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.DASHBOARD_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const config = await getConfigElevageById(id, session.activeSiteId);
  if (!config) notFound();

  return (
    <>
      <Header title={`Modifier : ${config.nom}`}>
        <Settings className="h-5 w-5 text-muted-foreground" />
      </Header>
      <div className="p-4">
        <ConfigElevageEditClient config={JSON.parse(JSON.stringify(config))} />
      </div>
    </>
  );
}
