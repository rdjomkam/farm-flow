"use client";

import { Role } from "@/types";
import { useTranslations } from "next-intl";

interface UserRoleBadgeProps {
  role: Role;
  className?: string;
}

const ROLE_COLOR_CLASS: Record<Role, string> = {
  [Role.ADMIN]: "bg-accent-red-muted text-accent-red border-accent-red/30",
  [Role.GERANT]: "bg-accent-orange-muted text-accent-orange border-accent-orange/30",
  [Role.PISCICULTEUR]: "bg-accent-green-muted text-accent-green border-accent-green/30",
  [Role.INGENIEUR]: "bg-accent-blue-muted text-accent-blue border-accent-blue/30",
};

export function UserRoleBadge({ role, className }: UserRoleBadgeProps) {
  const t = useTranslations("users");
  const colorClass = ROLE_COLOR_CLASS[role] ?? ROLE_COLOR_CLASS[Role.PISCICULTEUR];
  const label = t(`roles.${role}` as Parameters<typeof t>[0]);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorClass} ${className ?? ""}`}
    >
      {label}
    </span>
  );
}
