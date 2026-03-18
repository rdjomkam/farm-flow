import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { MouvementsListClient } from "@/components/stock/mouvements-list-client";
import { ExportButton } from "@/components/ui/export-button";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getMouvements } from "@/lib/queries/mouvements";
import { getProduits } from "@/lib/queries/produits";
import { getVagues } from "@/lib/queries/vagues";
import { Permission } from "@/types";

export default async function MouvementsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.STOCK_VOIR);
  if (!permissions) return <AccessDenied />;

  const [mouvements, produits, vagues] = await Promise.all([
    getMouvements(session.activeSiteId),
    getProduits(session.activeSiteId),
    getVagues(session.activeSiteId),
  ]);

  const produitOptions = produits.map((p) => ({
    id: p.id,
    nom: p.nom,
    unite: p.unite,
  }));

  const vagueOptions = vagues.map((v) => ({
    id: v.id,
    code: v.code,
  }));

  const canExport = permissions.includes(Permission.EXPORT_DONNEES);

  return (
    <>
      <Header title="Mouvements">
        {canExport && (
          <ExportButton
            href="/api/export/stock"
            filename={`mouvements-stock-${new Date().toISOString().slice(0, 10)}.xlsx`}
            label="Excel"
            variant="outline"
          />
        )}
      </Header>
      <div className="p-4">
        <MouvementsListClient
          mouvements={JSON.parse(JSON.stringify(mouvements))}
          produits={produitOptions}
          vagues={vagueOptions}
          permissions={permissions}
        />
      </div>
    </>
  );
}
