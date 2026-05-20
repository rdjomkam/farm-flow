import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagues } from "@/lib/queries/vagues";
import { getCommandes } from "@/lib/queries/commandes";
import { Permission, StatutCommande } from "@/types";
import { DepenseFormClient } from "@/components/depenses/depense-form-client";
import { prisma } from "@/lib/db";

export default async function NouvelleDepensePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.DEPENSES_CREER
  );
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("depenses.page");

  const [vaguesResult, commandesResult, unitesProduction] = await Promise.all([
    getVagues(session.activeSiteId),
    getCommandes(session.activeSiteId),
    prisma.uniteProduction.findMany({
      where: { siteId: session.activeSiteId, isActive: true },
      select: { id: true, code: true, nom: true, type: true },
      orderBy: { nom: "asc" },
    }),
  ]);

  // Seules les commandes LIVREES sans depense associee (displayed as optional link)
  const commandesLivrees = commandesResult.data.filter(
    (c) => c.statut === StatutCommande.LIVREE
  );

  return (
    <>
      <Header title={t("newExpense")} />
      <DepenseFormClient
        vagues={vaguesResult.data.map((v) => ({ id: v.id, code: v.code }))}
        commandesLivrees={commandesLivrees.map((c) => ({
          id: c.id,
          numero: c.numero,
          montantTotal: c.montantTotal,
        }))}
        unitesProduction={unitesProduction}
      />
    </>
  );
}
