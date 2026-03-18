import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/layout/header";
import { getServerSession } from "@/lib/auth";
import { getSiteMember } from "@/lib/queries/sites";
import { getSiteRoles } from "@/lib/queries/roles";
import { Permission } from "@/types";

export default async function SiteRolesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const { id: siteId } = await params;

  const member = await getSiteMember(siteId, session.userId);
  if (!member) notFound();

  const callerPerms = (member.siteRole?.permissions ?? []) as Permission[];
  if (!callerPerms.includes(Permission.SITE_GERER)) {
    redirect(`/settings/sites/${siteId}`);
  }

  const roles = await getSiteRoles(siteId);

  return (
    <>
      <Header title="Roles du site" />
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/settings/sites/${siteId}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au site
          </Link>
          <Link href={`/settings/sites/${siteId}/roles/nouveau`}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nouveau role
            </Button>
          </Link>
        </div>

        {roles.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Shield className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucun role configure.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {roles.map((role) => (
              <Link
                key={role.id}
                href={`/settings/sites/${siteId}/roles/${role.id}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition-colors min-h-[60px]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{role.name}</span>
                    {role.isSystem && (
                      <Badge className="text-xs bg-primary/10 text-primary">
                        Systeme
                      </Badge>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {role.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {role._count.members} membre{role._count.members !== 1 ? "s" : ""}
                    {" · "}
                    {role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
