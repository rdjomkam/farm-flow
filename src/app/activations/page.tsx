import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { ActivationsListClient } from "@/components/packs/activations-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getPackActivations } from "@/lib/queries/packs";
import { Permission } from "@/types";

export default async function ActivationsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ACTIVER_PACKS);
  if (!permissions) return <AccessDenied />;

  const activations = await getPackActivations(session.activeSiteId);
  const t = await getTranslations("packs.page");

  return (
    <>
      <Header title={t("activations")} />
      <div className="p-4">
        <ActivationsListClient
          activations={JSON.parse(JSON.stringify(activations))}
        />
      </div>
    </>
  );
}
