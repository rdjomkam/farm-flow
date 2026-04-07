import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { PontesListClient } from "@/components/reproduction/pontes-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { listPontes } from "@/lib/queries/pontes";
import { Permission } from "@/types";

export default async function ReproductionPontesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("reproduction.pontes");

  const result = await listPontes(session.activeSiteId);

  return (
    <>
      <Header title={t("title")} />
      <div className="p-4">
        <PontesListClient pontes={JSON.parse(JSON.stringify(result.data))} />
      </div>
    </>
  );
}
