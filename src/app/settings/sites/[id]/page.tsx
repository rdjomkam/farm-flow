import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession } from "@/lib/auth";
import { getSiteById, getSiteMember } from "@/lib/queries/sites";
import { getSiteRoles } from "@/lib/queries/roles";
import { SiteDetailClient } from "@/components/sites/site-detail-client";
import { Permission } from "@/types";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const site = await getSiteById(id, session.userId);
  if (!site) notFound();

  const currentMember = await getSiteMember(id, session.userId);
  const callerPermissions = (currentMember?.siteRole?.permissions ?? []) as Permission[];
  const canManageMembers = callerPermissions.includes(Permission.MEMBRES_GERER);
  const canManageSite = callerPermissions.includes(Permission.SITE_GERER);

  const siteRolesRaw = await getSiteRoles(id);
  const siteRoles = siteRolesRaw.map((r) => ({
    id: r.id,
    name: r.name,
    permissions: r.permissions as Permission[],
    isSystem: r.isSystem,
    memberCount: r._count.members,
  }));

  const members = site.members.map((m) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    phone: m.user.phone,
    siteRoleId: m.siteRoleId,
    siteRoleName: m.siteRole.name,
    isActive: m.isActive,
    createdAt: m.createdAt,
  }));

  return (
    <>
      <Header title={site.name} />
      <div className="p-4">
        <SiteDetailClient
          site={{
            id: site.id,
            name: site.name,
            address: site.address,
            bacCount: site._count.bacs,
            vagueCount: site._count.vagues,
          }}
          members={members}
          siteRoles={siteRoles}
          currentUserId={session.userId}
          callerPermissions={callerPermissions}
          canManageMembers={canManageMembers}
          canManageSite={canManageSite}
        />
      </div>
    </>
  );
}
