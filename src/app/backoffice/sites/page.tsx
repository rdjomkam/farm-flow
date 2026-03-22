/**
 * src/app/backoffice/sites/page.tsx
 *
 * Page backoffice — liste de tous les sites clients.
 * Server Component — guard checkBackofficeAccess().
 *
 * Story C.6 — ADR-022 Backoffice
 */

import { redirect } from "next/navigation";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { getAdminSites } from "@/lib/queries/admin-sites";
import { BackofficeSitesList } from "@/components/backoffice/backoffice-sites-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sites",
};

export const dynamic = "force-dynamic";

export default async function BackofficeSitesPage() {
  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

  const initialData = await getAdminSites({ pageSize: 200 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Gestion des sites clients</h1>
        <p className="text-sm text-muted-foreground">
          {initialData.stats.totalActive} site{initialData.stats.totalActive !== 1 ? "s" : ""} actif
          {initialData.stats.totalActive !== 1 ? "s" : ""} sur {initialData.total} au total
        </p>
      </div>
      <BackofficeSitesList initialData={initialData} />
    </div>
  );
}
