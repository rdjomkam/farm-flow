import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { FacturesListClient } from "@/components/ventes/factures-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getFactures } from "@/lib/queries/factures";
import { Permission } from "@/types";

export default async function FacturesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.FACTURES_VOIR);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("ventes");
  const { data: factures } = await getFactures(session.activeSiteId);

  return (
    <>
      <Header title={t("factures.title")} />
      <div className="p-4">
        <FacturesListClient
          initialFactures={JSON.parse(JSON.stringify(factures))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
