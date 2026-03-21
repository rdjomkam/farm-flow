import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { ProduitsListClient } from "@/components/stock/produits-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getProduits } from "@/lib/queries/produits";
import { getFournisseurs } from "@/lib/queries/fournisseurs";
import { Permission } from "@/types";

export default async function ProduitsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.STOCK_VOIR);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("stock");
  const [produits, fournisseurs] = await Promise.all([
    getProduits(session.activeSiteId),
    getFournisseurs(session.activeSiteId),
  ]);

  const fournisseurOptions = fournisseurs.map((f) => ({
    id: f.id,
    nom: f.nom,
  }));

  return (
    <>
      <Header title={t("produits.title")} />
      <div className="p-4">
        <ProduitsListClient
          produits={JSON.parse(JSON.stringify(produits))}
          fournisseurs={fournisseurOptions}
          permissions={permissions}
        />
      </div>
    </>
  );
}
