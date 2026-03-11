import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { FournisseursListClient } from "@/components/stock/fournisseurs-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getFournisseurs } from "@/lib/queries/fournisseurs";
import { Permission } from "@/types";

export default async function FournisseursPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.APPROVISIONNEMENT_VOIR);
  if (!permissions) return <AccessDenied />;

  const fournisseurs = await getFournisseurs(session.activeSiteId);

  return (
    <>
      <Header title="Fournisseurs" />
      <div className="p-4">
        <FournisseursListClient
          fournisseurs={JSON.parse(JSON.stringify(fournisseurs))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
