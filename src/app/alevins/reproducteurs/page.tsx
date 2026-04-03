import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { ReproducteursListClient } from "@/components/alevins/reproducteurs-list-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getReproducteurs } from "@/lib/queries/reproducteurs";
import { Permission } from "@/types";

export default async function ReproducteursPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const reproducteursResult = await getReproducteurs(session.activeSiteId);
  const t = await getTranslations("alevins.page");

  return (
    <>
      <Header title={t("reproducteurs")} />
      <div className="p-4">
        <ReproducteursListClient
          reproducteurs={JSON.parse(JSON.stringify(reproducteursResult.data))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
