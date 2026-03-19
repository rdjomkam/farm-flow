import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface MembershipItem {
  id: string;
  siteId: string;
  siteName: string;
  siteRoleId: string;
  siteRoleName: string;
  isActive: boolean;
  joinedAt: string;
}

interface UserMembershipsTabProps {
  memberships: MembershipItem[];
}

export function UserMembershipsTab({ memberships }: UserMembershipsTabProps) {
  if (memberships.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-10 text-center">
        <p className="text-sm font-medium text-muted-foreground">Aucun site</p>
        <p className="text-xs text-muted-foreground">
          Cet utilisateur n'est membre d'aucun site.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {memberships.length} site{memberships.length !== 1 ? "s" : ""}
      </p>

      {memberships.map((m) => (
        <div
          key={m.id}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-foreground">{m.siteName}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                {m.siteRoleName}
              </span>
              <span
                className={`flex items-center gap-1 text-xs font-medium ${m.isActive ? "text-green-700" : "text-gray-500"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${m.isActive ? "bg-green-500" : "bg-gray-400"}`}
                />
                {m.isActive ? "Actif" : "Inactif"}
              </span>
            </div>
          </div>

          <Link
            href={`/settings/sites/${m.siteId}`}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Gerer ce site
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      ))}
    </div>
  );
}
