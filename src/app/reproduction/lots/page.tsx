import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { LotsListClient } from "@/components/reproduction/lots-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { listLots } from "@/lib/queries/lots-alevins";
import { Permission } from "@/types";

export default async function ReproductionLotsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("reproduction.lots");

  const result = await listLots(session.activeSiteId, { limit: 50 });

  return (
    <>
      <Header title={t("title")} />
      <div className="p-4">
        <LotsListClient
          lots={JSON.parse(JSON.stringify(result.data))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
