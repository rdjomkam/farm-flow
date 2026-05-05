import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { ReleveFormClient } from "@/components/releves/releve-form-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagues } from "@/lib/queries/vagues";
import { getProduits } from "@/lib/queries/produits";
import { getBacs } from "@/lib/queries/bacs";
import { getLotAlevinsById } from "@/lib/queries/lots-alevins";
import { StatutVague, Permission } from "@/types";

export default async function NouveauRelevePage({
  searchParams,
}: {
  searchParams: Promise<{ lotAlevinsId?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.RELEVES_CREER);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("releves");
  const { lotAlevinsId } = await searchParams;

  if (lotAlevinsId) {
    // Mode lot d'alevins : charger le lot + tous les bacs du site
    const [lot, produitsResult, bacsResult] = await Promise.all([
      getLotAlevinsById(lotAlevinsId, session.activeSiteId),
      getProduits(session.activeSiteId),
      getBacs(session.activeSiteId),
    ]);

    if (!lot) redirect("/reproduction/lots");

    const produits = produitsResult.data.map((p) => ({
      id: p.id,
      nom: p.nom,
      categorie: p.categorie,
      unite: p.unite,
      stockActuel: p.stockActuel,
    }));

    const lotAlevins = {
      id: lot.id,
      code: lot.code,
      bacId: lot.bacId,
    };

    return (
      <>
        <Header title={t("page.nouveau")} />
        <div className="p-4">
          <ReleveFormClient
            vagues={[]}
            produits={produits}
            lotAlevins={lotAlevins}
            bacsDuSite={bacsResult.data}
          />
        </div>
      </>
    );
  }

  // Mode normal : charger les vagues en cours
  const [vaguesResult, produitsResult] = await Promise.all([
    getVagues(session.activeSiteId, { statut: StatutVague.EN_COURS }),
    getProduits(session.activeSiteId),
  ]);

  const vagues = vaguesResult.data.map((v) => ({
    id: v.id,
    code: v.code,
  }));

  const produits = produitsResult.data.map((p) => ({
    id: p.id,
    nom: p.nom,
    categorie: p.categorie,
    unite: p.unite,
    stockActuel: p.stockActuel,
  }));

  return (
    <>
      <Header title={t("page.nouveau")} />
      <div className="p-4">
        <ReleveFormClient vagues={vagues} produits={produits} />
      </div>
    </>
  );
}
