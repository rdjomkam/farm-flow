/**
 * Ingénieur layout — route group for engineers (INGENIEUR role).
 * This audience supervises multiple client farms from a hub view.
 *
 * This is a thin pass-through layout. The root layout (src/app/layout.tsx)
 * already handles providers, fonts, AppShell, and navigation.
 * Navigation differentiation (ingénieur bottom-nav) will happen in Sprint IB.
 */
export default function IngenieurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
