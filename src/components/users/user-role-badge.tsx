import { Role } from "@/types";

interface UserRoleBadgeProps {
  role: Role;
  className?: string;
}

const ROLE_CONFIG: Record<Role, { label: string; colorClass: string }> = {
  [Role.ADMIN]: {
    label: "Administrateur global",
    colorClass: "bg-red-100 text-red-700 border-red-200",
  },
  [Role.GERANT]: {
    label: "Gerant",
    colorClass: "bg-orange-100 text-orange-700 border-orange-200",
  },
  [Role.PISCICULTEUR]: {
    label: "Pisciculteur",
    colorClass: "bg-green-100 text-green-700 border-green-200",
  },
  [Role.INGENIEUR]: {
    label: "Ingenieur",
    colorClass: "bg-blue-100 text-blue-700 border-blue-200",
  },
};

export function UserRoleBadge({ role, className }: UserRoleBadgeProps) {
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG[Role.PISCICULTEUR];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.colorClass} ${className ?? ""}`}
    >
      {config.label}
    </span>
  );
}
