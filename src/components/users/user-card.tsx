"use client";

import Link from "next/link";
import { UserRoleBadge } from "./user-role-badge";
import { Role } from "@/types";
import { useTranslations } from "next-intl";

interface UserSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  globalRole: Role;
  isActive: boolean;
  isSystem: boolean;
  siteCount: number;
  createdAt: string;
}

interface UserCardProps {
  user: UserSummary;
}

const ROLE_AVATAR_COLOR: Record<Role, string> = {
  [Role.ADMIN]: "bg-red-500",
  [Role.GERANT]: "bg-orange-500",
  [Role.PISCICULTEUR]: "bg-green-500",
  [Role.INGENIEUR]: "bg-blue-500",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserCard({ user }: UserCardProps) {
  const t = useTranslations("users");
  const avatarColor = ROLE_AVATAR_COLOR[user.globalRole] ?? "bg-gray-500";
  const initials = getInitials(user.name);

  return (
    <Link
      href={`/users/${user.id}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted active:bg-muted/80"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor}`}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-foreground">{user.name}</p>
            {/* Active status dot */}
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${user.isActive ? "bg-green-500" : "bg-gray-400"}`}
              title={user.isActive ? t("list.actif") : t("list.desactive")}
            />
          </div>
          {user.email && (
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          )}
          {user.phone && (
            <p className="truncate text-sm text-muted-foreground">{user.phone}</p>
          )}
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <UserRoleBadge role={user.globalRole} />
        <span className="text-xs text-muted-foreground">
          {user.siteCount === 1
            ? t("list.sites", { count: user.siteCount })
            : t("list.sitesPlural", { count: user.siteCount })}{" "}
          &bull;{" "}
          {user.isActive ? t("list.actif") : t("list.desactive")}
        </span>
      </div>
    </Link>
  );
}
