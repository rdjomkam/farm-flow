/**
 * Ingénieur layout — route group for engineers (INGENIEUR role).
 * This audience supervises multiple client farms from a hub view.
 *
 * Navigation: IngenieurSidebar (desktop) + IngenieurBottomNav (mobile with FAB) are
 * rendered by AppShell in src/components/layout/app-shell.tsx based on the user's Role.
 * This layout is a thin pass-through; navigation differentiation happens at the shell level.
 */
export default function IngenieurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
