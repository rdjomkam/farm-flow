/**
 * src/app/backoffice/layout.tsx
 *
 * Layout du backoffice DKFarm.
 * Server Component — guard checkBackofficeAccess().
 * Redirige vers /login si non authentifie ou non super-admin.
 *
 * Story C.1 — ADR-022 Backoffice
 */

import { redirect } from "next/navigation";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { BackofficeSidebar } from "@/components/backoffice/backoffice-sidebar";
import { BackofficeHeader } from "@/components/backoffice/backoffice-header";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "DKFarm Backoffice",
    template: "%s | DKFarm Backoffice",
  },
};

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard — super-admin requis
  const session = await checkBackofficeAccess();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Sidebar desktop */}
      <BackofficeSidebar />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        <BackofficeHeader userName={session.name} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
