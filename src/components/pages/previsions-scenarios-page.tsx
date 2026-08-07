import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getScenarios } from "@/lib/queries/previsions-scenarios";
import { Permission, StatutScenarioPrevision } from "@/types";
import { ScenariosListClient } from "@/components/previsions/scenarios-list-client";
import type { ScenarioPrevisionSummaryDTO } from "@/components/previsions/api-types";

/**
 * Page Server — liste des scenarios de prevision (module Previsions, Sprint
 * PR2, story PR2.3). Suit le patron `vagues-page.tsx` : Server Component
 * async, verifie la permission de lecture minimale, charge directement via
 * les queries Prisma (jamais un fetch vers sa propre API depuis le Server
 * Component), passe les donnees + permissions en props au Client Component.
 */
export default async function PrevisionsScenariosPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.PREVISIONS_VOIR);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("previsions");
  const { data } = await getScenarios(session.activeSiteId);

  const scenarios: ScenarioPrevisionSummaryDTO[] = data.map((s) => ({
    id: s.id,
    code: s.code,
    nom: s.nom,
    description: s.description,
    dureeCycleMois: s.dureeCycleMois,
    dateDebutPlan: s.dateDebutPlan.toISOString(),
    statut: s.statut as StatutScenarioPrevision,
    userId: s.userId,
    siteId: s.siteId,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    scenarioParentId: s.scenarioParentId ?? null,
    scenarioParent: null,
  }));

  return (
    <>
      <Header title={t("page.title")} />
      <div className="p-4 md:p-6">
        <ScenariosListClient initialScenarios={scenarios} permissions={permissions} />
      </div>
    </>
  );
}
