import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Permission } from "@/types";
import { BesoinsFormClient } from "@/components/besoins/besoins-form-client";

export default async function NouvelleListeBesoinsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.BESOINS_SOUMETTRE
  );
  if (!permissions) return <AccessDenied />;

  // Charger les vagues actives et produits pour les selects
  const [vagues, produits] = await Promise.all([
    prisma.vague.findMany({
      where: { siteId: session.activeSiteId, statut: "EN_COURS" },
      select: { id: true, code: true },
      orderBy: { dateDebut: "desc" },
    }),
    prisma.produit.findMany({
      where: { siteId: session.activeSiteId, isActive: true },
      select: { id: true, nom: true, unite: true, prixUnitaire: true },
      orderBy: { nom: "asc" },
    }),
  ]);

  return (
    <>
      <Header title="Nouvelle Liste de Besoins" />
      <BesoinsFormClient
        vagues={JSON.parse(JSON.stringify(vagues))}
        produits={JSON.parse(JSON.stringify(produits))}
      />
    </>
  );
}
