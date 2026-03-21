import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PacksListClient } from "@/components/packs/packs-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getPacks } from "@/lib/queries/packs";
import { getPlansAbonnements } from "@/lib/queries/plans-abonnements";
import { Permission } from "@/types";

export default async function PacksPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.DASHBOARD_VOIR);
  if (!permissions) return <AccessDenied />;

  const [packs, plans] = await Promise.all([
    getPacks(session.activeSiteId),
    getPlansAbonnements(),
  ]);

  return (
    <>
      <Header title="Packs" />
      <div className="p-4">
        <PacksListClient
          packs={JSON.parse(JSON.stringify(packs))}
          permissions={permissions}
          plans={plans.map((p) => ({ id: p.id, nom: p.nom, typePlan: p.typePlan }))}
        />
      </div>
    </>
  );
}
