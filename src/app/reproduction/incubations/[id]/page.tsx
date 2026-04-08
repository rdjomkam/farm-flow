import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { IncubationDetailClient } from "@/components/reproduction/incubation-detail-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getIncubationById } from "@/lib/queries/incubations";
import { getProduits } from "@/lib/queries/produits";
import { Permission, CategorieProduit } from "@/types";

export default async function IncubationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const [incubation, { data: produits }] = await Promise.all([
    getIncubationById(id, session.activeSiteId),
    getProduits(session.activeSiteId, { categorie: CategorieProduit.INTRANT }),
  ]);

  if (!incubation) notFound();

  return (
    <>
      <Header title={incubation.code} />
      <div className="p-4">
        <IncubationDetailClient
          incubation={JSON.parse(JSON.stringify(incubation))}
          permissions={permissions}
          produits={produits.map((p) => ({ id: p.id, nom: p.nom }))}
        />
      </div>
    </>
  );
}
