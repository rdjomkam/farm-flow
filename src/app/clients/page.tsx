import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { ClientsListClient } from "@/components/ventes/clients-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getClients } from "@/lib/queries/clients";
import { Permission } from "@/types";

export default async function ClientsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const [permissions, t, clients] = await Promise.all([
    checkPagePermission(session, Permission.CLIENTS_VOIR),
    getTranslations("ventes"),
    getClients(session.activeSiteId),
  ]);
  if (!permissions) return <AccessDenied />;

  return (
    <>
      <Header title={t("clients.title")} />
      <div className="p-4">
        <ClientsListClient
          initialClients={clients}
          permissions={permissions}
        />
      </div>
    </>
  );
}
