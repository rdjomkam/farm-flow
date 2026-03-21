import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { FournisseursListClient } from "@/components/stock/fournisseurs-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getFournisseurs } from "@/lib/queries/fournisseurs";
import { Permission } from "@/types";

export default async function FournisseursPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.APPROVISIONNEMENT_VOIR);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("stock");
  const fournisseurs = await getFournisseurs(session.activeSiteId);

  return (
    <>
      <Header title={t("fournisseurs.title")} />
      <div className="p-4">
        <FournisseursListClient
          fournisseurs={JSON.parse(JSON.stringify(fournisseurs))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
