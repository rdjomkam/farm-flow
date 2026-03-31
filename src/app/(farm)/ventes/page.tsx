import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { VentesListClient } from "@/components/ventes/ventes-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getVentes } from "@/lib/queries/ventes";
import { getClients } from "@/lib/queries/clients";
import { getVagues } from "@/lib/queries/vagues";
import { Permission } from "@/types";

export default async function VentesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const [permissions, t, ventesResult, clients, vaguesResult] = await Promise.all([
    checkPagePermission(session, Permission.VENTES_VOIR),
    getTranslations("ventes"),
    getVentes(session.activeSiteId),
    getClients(session.activeSiteId),
    getVagues(session.activeSiteId),
  ]);
  if (!permissions) return <AccessDenied />;

  const clientOptions = clients.map((c) => ({ id: c.id, nom: c.nom }));
  const vagueOptions = vaguesResult.data.map((v) => ({ id: v.id, code: v.code }));

  return (
    <>
      <Header title={t("ventes.title")} />
      <div className="p-4">
        <VentesListClient
          initialVentes={JSON.parse(JSON.stringify(ventesResult.data))}
          clients={clientOptions}
          vagues={vagueOptions}
          permissions={permissions}
        />
      </div>
    </>
  );
}
