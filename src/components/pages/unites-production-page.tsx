import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getUnitesProduction } from "@/lib/queries/unites-production";
import { getTransfertsInternes } from "@/lib/queries/transferts-internes";
import { Permission, StatutVague } from "@/types";
import { prisma } from "@/lib/db";
import { UnitesProductionClient } from "@/components/unites-production/unites-production-client";

export default async function UnitesProductionPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
    const [t, permissions] = await Promise.all([
      getTranslations("unites-production"),
      checkPagePermission(session, Permission.FINANCES_VOIR),
    ]);
    if (!permissions) return <AccessDenied />;

    const siteId = session.activeSiteId;

    const [unitesResult, transfertsResult, lotsAlevins, vaguesEnCours] =
      await Promise.all([
        getUnitesProduction(siteId),
        getTransfertsInternes(siteId),
        prisma.lotAlevins.findMany({
          where: { siteId },
          select: { id: true, code: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.vague.findMany({
          where: { siteId, statut: StatutVague.EN_COURS },
          select: { id: true, code: true },
          orderBy: { dateDebut: "desc" },
        }),
      ]);

    const canManage = permissions.includes(Permission.FINANCES_GERER);

    return (
      <>
        <Header title={t("unitesProduction.title")} />
        <UnitesProductionClient
          unites={JSON.parse(JSON.stringify(unitesResult))}
          transferts={JSON.parse(JSON.stringify(transfertsResult.data))}
          lotsAlevins={JSON.parse(JSON.stringify(lotsAlevins))}
          vaguesEnCours={JSON.parse(JSON.stringify(vaguesEnCours))}
          canManage={canManage}
        />
      </>
    );
  } catch (error: unknown) {
    const digest =
      error instanceof Error && "digest" in error
        ? (error as Record<string, unknown>).digest
        : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[UnitesProductionPage]", error);
    throw error;
  }
}
