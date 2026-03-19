import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { getServerSession } from "@/lib/auth";
import { listUsers } from "@/lib/queries/users-admin";
import { UsersListClient } from "@/components/users/users-list-client";
import { Permission } from "@/types";
import { getServerPermissions } from "@/lib/auth/permissions-server";
import { Plus } from "lucide-react";

export default async function UsersPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await getServerPermissions(session);

  const canView =
    permissions.includes(Permission.UTILISATEURS_VOIR) ||
    permissions.includes(Permission.UTILISATEURS_GERER);

  if (!canView) {
    redirect("/");
  }

  const canCreate =
    permissions.includes(Permission.UTILISATEURS_CREER) ||
    permissions.includes(Permission.UTILISATEURS_GERER);

  const { users, total } = await listUsers({ page: 1, limit: 100 });

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    globalRole: u.globalRole,
    isActive: u.isActive,
    isSystem: u.isSystem,
    siteCount: u.siteCount,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <>
      <Header title="Utilisateurs">
        {canCreate && (
          <Button asChild size="sm">
            <Link href="/users/nouveau">
              <Plus className="h-4 w-4" />
              Ajouter
            </Link>
          </Button>
        )}
      </Header>
      <div className="p-4">
        <p className="mb-4 text-sm text-muted-foreground">
          {total} utilisateur{total !== 1 ? "s" : ""} au total
        </p>
        <UsersListClient users={serializedUsers} currentUserId={session.userId} />
      </div>
    </>
  );
}
