/**
 * Farm layout — route group for farm owners, managers, and admins.
 * Roles: PISCICULTEUR, GERANT, ADMIN (non-superAdmin)
 *
 * Navigation: FarmSidebar (desktop) + FarmBottomNav (mobile) are rendered by
 * AppShell in src/components/layout/app-shell.tsx based on the user's Role.
 * This layout is a thin pass-through; navigation is role-aware at the shell level.
 */
export default function FarmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
