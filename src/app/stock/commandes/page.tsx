import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { CommandesListClient } from "@/components/stock/commandes-list-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getCommandes } from "@/lib/queries/commandes";
import { getFournisseurs } from "@/lib/queries/fournisseurs";
import { getProduits } from "@/lib/queries/produits";
import { Permission } from "@/types";

export default async function CommandesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const t = await getTranslations("stock");
  const permissions = await checkPagePermission(session, Permission.APPROVISIONNEMENT_VOIR);
  if (!permissions) return <AccessDenied />;

  const [commandes, fournisseurs, produits] = await Promise.all([
    getCommandes(session.activeSiteId),
    getFournisseurs(session.activeSiteId),
    getProduits(session.activeSiteId),
  ]);

  const fournisseurOptions = fournisseurs.map((f) => ({
    id: f.id,
    nom: f.nom,
  }));

  const produitOptions = produits.map((p) => ({
    id: p.id,
    nom: p.nom,
    unite: p.unite,
    uniteAchat: p.uniteAchat,
    contenance: p.contenance,
    prixUnitaire: p.prixUnitaire,
  }));

  return (
    <>
      <Header title={t("commandes.title")} />
      <div className="p-4">
        <CommandesListClient
          commandes={JSON.parse(JSON.stringify(commandes))}
          fournisseurs={fournisseurOptions}
          produits={produitOptions}
          permissions={permissions}
        />
      </div>
    </>
  );
}
