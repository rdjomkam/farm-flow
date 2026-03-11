import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ProduitDetailClient } from "@/components/stock/produit-detail-client";
import { getServerSession } from "@/lib/auth";
import { getProduitById } from "@/lib/queries/produits";
import { getFournisseurs } from "@/lib/queries/fournisseurs";

export default async function ProduitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const { id } = await params;
  const [produit, fournisseurs] = await Promise.all([
    getProduitById(id, session.activeSiteId),
    getFournisseurs(session.activeSiteId),
  ]);

  if (!produit) notFound();

  const fournisseurOptions = fournisseurs.map((f) => ({
    id: f.id,
    nom: f.nom,
  }));

  return (
    <>
      <Header title={produit.nom} />
      <div className="p-4">
        <ProduitDetailClient
          produit={JSON.parse(JSON.stringify(produit))}
          fournisseurs={fournisseurOptions}
        />
      </div>
    </>
  );
}
