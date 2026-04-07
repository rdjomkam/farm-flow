import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { PlanningClient } from "@/components/planning/planning-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getActivites, getSiteMembers } from "@/lib/queries";
import { getVagues } from "@/lib/queries/vagues";
import { getBacs } from "@/lib/queries/bacs";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function PlanningPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
    const [t, permissions] = await Promise.all([
      getTranslations("planning"),
      checkPagePermission(session, Permission.PLANNING_VOIR),
    ]);
    if (!permissions) return <AccessDenied />;

    // Charger les activites du mois courant et les 2 mois precedents
    const now = new Date();
    const dateDebut = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const dateFin = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    const [activitesResult, vaguesResult, bacsResult, siteMembers] = await Promise.all([
      getActivites(session.activeSiteId, { dateDebut, dateFin }),
      getVagues(session.activeSiteId),
      getBacs(session.activeSiteId),
      getSiteMembers(session.activeSiteId),
    ]);

    const vagueOptions = vaguesResult.data.map((v) => ({ id: v.id, code: v.code }));
    const bacOptions = bacsResult.data.map((b) => ({ id: b.id, nom: b.nom }));
    const memberOptions = siteMembers.map((m) => ({ userId: m.user.id, userName: m.user.name }));

    return (
      <>
        <Header title={t("page.title")} />
        <div className="p-4">
          <PlanningClient
            activites={JSON.parse(JSON.stringify(activitesResult.data))}
            permissions={permissions}
            vagues={vagueOptions}
            bacs={bacOptions}
            members={memberOptions}
          />
        </div>
      </>
    );
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[PlanningPage]", error);
    throw error;
  }
}
