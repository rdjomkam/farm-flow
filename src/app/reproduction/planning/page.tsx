import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { ReproductionPlanningClient } from "@/components/reproduction/reproduction-planning-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { Permission } from "@/types";

export default async function ReproductionPlanningPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("reproduction.planning");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-4">
        <ReproductionPlanningClient />
      </div>
    </>
  );
}
