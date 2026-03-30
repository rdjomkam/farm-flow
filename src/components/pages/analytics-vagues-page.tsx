import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { VaguesComparisonClient } from "@/components/analytics/vagues-comparison-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagues } from "@/lib/queries/vagues";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function AnalyticsVaguesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
    const permissions = await checkPagePermission(session, Permission.VAGUES_VOIR);
    if (!permissions) return <AccessDenied />;

    // Charger toutes les vagues du site (EN_COURS et TERMINEE) pour le selecteur
    const vagues = await getVagues(session.activeSiteId);

    return (
      <>
        <Header title="Comparaison vagues" />
        <VaguesComparisonClient vagues={vagues} />
      </>
    );
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[AnalyticsVaguesPage]", error);
    throw error;
  }
}
