import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PackDetailClient } from "@/components/packs/pack-detail-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getPackById } from "@/lib/queries/packs";
import { getProduits } from "@/lib/queries/produits";
import { getConfigsElevage } from "@/lib/queries/config-elevage";
import { getPlansAbonnements } from "@/lib/queries/plans-abonnements";
import { Permission } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PackDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.DASHBOARD_VOIR);
  if (!permissions) return <AccessDenied />;

  const [pack, produitsResult, configs, plans] = await Promise.all([
    getPackById(id, session.activeSiteId),
    getProduits(session.activeSiteId),
    getConfigsElevage(session.activeSiteId),
    getPlansAbonnements(true),
  ]);

  if (!pack) notFound();

  const produitOptions = produitsResult.data.map((p) => ({
    id: p.id,
    nom: p.nom,
    categorie: p.categorie,
    unite: p.unite,
    stockActuel: p.stockActuel,
  }));

  const configOptions = configs.map((c) => ({ id: c.id, nom: c.nom }));
  const planOptions = plans.map((p) => ({ id: p.id, nom: p.nom }));

  return (
    <>
      <Header title={pack.nom} />
      <div className="p-4">
        <PackDetailClient
          pack={JSON.parse(JSON.stringify(pack))}
          produits={produitOptions}
          configElevages={configOptions}
          plans={planOptions}
          permissions={permissions}
        />
      </div>
    </>
  );
}
