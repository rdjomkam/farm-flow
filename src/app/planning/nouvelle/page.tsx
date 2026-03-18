import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { NouvelleActiviteForm } from "@/components/planning/nouvelle-activite-form";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagues } from "@/lib/queries/vagues";
import { getBacs } from "@/lib/queries/bacs";
import { getSiteMembers } from "@/lib/queries/sites";
import { AccessDenied } from "@/components/ui/access-denied";
import { Permission } from "@/types";

export default async function NouvelleActivitePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.PLANNING_GERER);
  if (!permissions) return <AccessDenied />;

  const [vagues, bacs, siteMembers] = await Promise.all([
    getVagues(session.activeSiteId),
    getBacs(session.activeSiteId),
    getSiteMembers(session.activeSiteId),
  ]);

  const vagueOptions = vagues.map((v) => ({ id: v.id, code: v.code }));
  const bacOptions = bacs.map((b) => ({ id: b.id, nom: b.nom }));
  const memberOptions = siteMembers.map((m) => ({ userId: m.user.id, userName: m.user.name }));

  return (
    <>
      <Header title="Nouvelle activite" />
      <div className="p-4">
        <NouvelleActiviteForm vagues={vagueOptions} bacs={bacOptions} members={memberOptions} />
      </div>
    </>
  );
}
