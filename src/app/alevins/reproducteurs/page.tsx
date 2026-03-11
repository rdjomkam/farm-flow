import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ReproducteursListClient } from "@/components/alevins/reproducteurs-list-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getReproducteurs } from "@/lib/queries/reproducteurs";
import { Permission } from "@/types";

export default async function ReproducteursPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const reproducteurs = await getReproducteurs(session.activeSiteId);

  return (
    <>
      <Header title="Reproducteurs" />
      <div className="p-4">
        <ReproducteursListClient
          reproducteurs={JSON.parse(JSON.stringify(reproducteurs))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
