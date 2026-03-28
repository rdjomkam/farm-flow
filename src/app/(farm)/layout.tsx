/**
 * Farm layout — route group for farm owners, managers, and admins.
 * Roles: PISCICULTEUR, GERANT, ADMIN (non-superAdmin)
 *
 * This is a thin pass-through layout. The root layout (src/app/layout.tsx)
 * already handles providers, fonts, AppShell, and navigation.
 * Navigation differentiation will happen in Sprint IB.
 */
export default function FarmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
