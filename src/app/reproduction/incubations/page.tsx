import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { IncubationsListClient } from "@/components/reproduction/incubations-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { listIncubations } from "@/lib/queries/incubations";
import { Permission } from "@/types";

export default async function ReproductionIncubationsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.INCUBATIONS_VOIR
  );
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("reproduction.incubations");

  const result = await listIncubations(session.activeSiteId, { limit: 50 });

  return (
    <>
      <Header title={t("title")} />
      <div className="p-4">
        <IncubationsListClient
          incubations={JSON.parse(JSON.stringify(result.data))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
