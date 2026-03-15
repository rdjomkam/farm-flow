import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { InstructionViewer } from "@/components/activites/instruction-viewer";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getActiviteById, getProduitById } from "@/lib/queries";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

/**
 * Page detail d'une activite — /mes-taches/[id]
 *
 * Server Component : charge l'activite et le produit recommande,
 * puis passe les donnees au composant client InstructionViewer.
 *
 * R8 : toutes les queries filtrent par siteId (activeSiteId).
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ActiviteDetailPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.PLANNING_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;

  // Charger l'activite en verifiant l'appartenance au site (R8)
  const activite = await getActiviteById(session.activeSiteId, id);
  if (!activite) notFound();

  // Charger le produit recommande si renseigne (R8 : siteId passe en 2e argument)
  let produitRecommande: {
    id: string;
    nom: string;
    unite: string;
    stockActuel: number;
  } | null = null;

  if (activite.produitRecommandeId) {
    const produit = await getProduitById(activite.produitRecommandeId, session.activeSiteId);
    if (produit) {
      produitRecommande = {
        id: produit.id,
        nom: produit.nom,
        unite: produit.unite,
        stockActuel: produit.stockActuel,
      };
    }
  }

  // Serialiser pour eviter les erreurs de serialisation Next.js (dates → JSON)
  const activiteSerialized = JSON.parse(JSON.stringify(activite));

  return (
    <>
      <Header title="Detail de l'activite" />
      <div className="p-4">
        <InstructionViewer
          activite={activiteSerialized}
          produitRecommande={produitRecommande}
          permissions={permissions}
        />
      </div>
    </>
  );
}
