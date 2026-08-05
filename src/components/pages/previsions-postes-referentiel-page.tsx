import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { listerPostesReferentielAdmin } from "@/lib/queries/previsions-postes-referentiel";
import { Permission } from "@/types";
import { PostesReferentielAdminClient } from "@/components/previsions/postes-referentiel-admin-client";
import type { PosteReferentielDTO } from "@/components/previsions/api-types";

/**
 * Page Server — administration du referentiel des postes de charges
 * (ADR-053 §16.12, story A.5, "Emplacement dans la navigation").
 *
 * Nouvelle page TOP-LEVEL (pas un onglet de `/previsions/scenarios/[id]`) :
 * `PosteReferentiel` est SITE-scope, decouple a dessein du cycle de vie de
 * tout scenario (§16.2, §16.5) — le placer comme onglet d'un scenario
 * particulier laisserait croire qu'il est propre a ce scenario.
 *
 * Permission : `PREVISIONS_PARAMETRER` (pas `PREVISIONS_VOIR`) — administrer
 * le referentiel est un paramétrage de structure, la meme famille d'action
 * que la creation d'un `PostePrevision`.
 */
export default async function PrevisionsPostesReferentielPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.PREVISIONS_PARAMETRER);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("previsions");
  const entries = await listerPostesReferentielAdmin(session.activeSiteId);

  const postesReferentiel: PosteReferentielDTO[] = entries.map((entry) => ({
    id: entry.id,
    siteId: entry.siteId,
    code: entry.code,
    libelle: entry.libelle,
    actif: entry.actif,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }));

  return (
    <>
      <Header title={t("posteReferentielAdmin.pageTitle")} />
      <div className="p-4 md:p-6">
        <p className="mb-4 text-sm text-muted-foreground">{t("posteReferentielAdmin.pageDescription")}</p>
        <PostesReferentielAdminClient initialEntries={postesReferentiel} />
      </div>
    </>
  );
}
