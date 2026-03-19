import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession } from "@/lib/auth";
import { getServerPermissions } from "@/lib/auth/permissions-server";
import { UserCreateForm } from "@/components/users/user-create-form";
import { Permission } from "@/types";

export default async function UserNewPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await getServerPermissions(session);

  const canCreate =
    permissions.includes(Permission.UTILISATEURS_CREER) ||
    permissions.includes(Permission.UTILISATEURS_GERER);

  if (!canCreate) {
    redirect("/users");
  }

  return (
    <>
      <Header title="Nouvel utilisateur" />
      <div className="p-4">
        <div className="mx-auto max-w-lg">
          <UserCreateForm />
        </div>
      </div>
    </>
  );
}
