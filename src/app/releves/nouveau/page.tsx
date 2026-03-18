import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ReleveFormClient } from "@/components/releves/releve-form-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagues } from "@/lib/queries/vagues";
import { getProduits } from "@/lib/queries/produits";
import { StatutVague, Permission } from "@/types";

export default async function NouveauRelevePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.RELEVES_CREER);
  if (!permissions) return <AccessDenied />;

  const [vaguesRaw, produitsRaw] = await Promise.all([
    getVagues(session.activeSiteId, { statut: StatutVague.EN_COURS }),
    getProduits(session.activeSiteId),
  ]);

  const vagues = vaguesRaw.map((v) => ({
    id: v.id,
    code: v.code,
  }));

  const produits = produitsRaw.map((p) => ({
    id: p.id,
    nom: p.nom,
    categorie: p.categorie,
    unite: p.unite,
    stockActuel: p.stockActuel,
  }));

  return (
    <>
      <Header title="Nouveau releve" />
      <div className="p-4">
        <ReleveFormClient vagues={vagues} produits={produits} />
      </div>
    </>
  );
}
