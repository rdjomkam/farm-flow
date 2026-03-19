import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getServerSession } from "@/lib/auth";
import { getServerPermissions } from "@/lib/auth/permissions-server";
import { getUserAdminDetail, getUserMemberships } from "@/lib/queries/users-admin";
import { UserProfileTab } from "@/components/users/user-profile-tab";
import { UserSecurityTab } from "@/components/users/user-security-tab";
import { UserMembershipsTab } from "@/components/users/user-memberships-tab";
import { Permission } from "@/types";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await getServerPermissions(session);

  const canView =
    permissions.includes(Permission.UTILISATEURS_VOIR) ||
    permissions.includes(Permission.UTILISATEURS_GERER);

  if (!canView) {
    redirect("/");
  }

  const { id } = await params;
  const user = await getUserAdminDetail(id);
  if (!user) notFound();

  const memberships = await getUserMemberships(id);

  const serializedMemberships = memberships.map((m) => ({
    id: m.id,
    siteId: m.siteId,
    siteName: m.siteName,
    siteRoleId: m.siteRoleId,
    siteRoleName: m.siteRoleName,
    isActive: m.isActive,
    joinedAt: m.createdAt.toISOString(),
  }));

  return (
    <>
      <Header title={user.name} />
      <div className="p-4">
        <Tabs defaultValue="profil">
          <TabsList>
            <TabsTrigger value="profil">Profil</TabsTrigger>
            <TabsTrigger value="securite">Securite</TabsTrigger>
            <TabsTrigger value="sites">
              Sites ({serializedMemberships.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profil">
            <div className="mt-4">
              <UserProfileTab
                user={{
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  phone: user.phone,
                  globalRole: user.globalRole,
                  isActive: user.isActive,
                  isSystem: user.isSystem,
                }}
                callerPermissions={permissions}
              />
            </div>
          </TabsContent>

          <TabsContent value="securite">
            <div className="mt-4">
              <UserSecurityTab
                userId={user.id}
                userName={user.name}
                userRole={user.globalRole}
                isActive={user.isActive}
                isSystem={user.isSystem}
                callerPermissions={permissions}
              />
            </div>
          </TabsContent>

          <TabsContent value="sites">
            <div className="mt-4">
              <UserMembershipsTab memberships={serializedMemberships} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
