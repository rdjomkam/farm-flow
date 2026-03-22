/**
 * src/app/admin/sites/page.tsx
 *
 * Page admin plateforme — liste de tous les sites clients.
 * Server Component — guard SITES_VOIR + isPlatformSite.
 *
 * Story C.2 — Sprint C (ADR-021).
 * R2 : enums importés depuis @/types.
 * R8 : siteId scoped (queries admin-sites).
 */

import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { isPlatformSite } from "@/lib/queries/sites";
import { getAdminSites } from "@/lib/queries/admin-sites";
import { AdminSitesList } from "@/components/admin/sites/admin-sites-list";
import { Permission } from "@/types";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Admin Plateforme — Sites clients" };
}

export const dynamic = "force-dynamic";

export default async function AdminSitesPage() {
  // Auth guard
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Permission guard — SITES_VOIR
  const permissions = await checkPagePermission(session, Permission.SITES_VOIR);
  if (!permissions) redirect("/");

  // Platform guard — cette page est réservée au site plateforme
  if (!session.activeSiteId) redirect("/");
  const isPlat = await isPlatformSite(session.activeSiteId);
  if (!isPlat) redirect("/");

  // Charger la liste initiale (tous les sites, 200 max, non archivés par défaut)
  const initialData = await getAdminSites({ pageSize: 200 });

  return (
    <div className="min-h-screen bg-background">
      <Header title="Sites clients" />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Gestion des sites clients</h1>
          <p className="text-sm text-muted-foreground">
            {initialData.stats.totalActive} site{initialData.stats.totalActive !== 1 ? "s" : ""} actif
            {initialData.stats.totalActive !== 1 ? "s" : ""} sur {initialData.total} au total
          </p>
        </div>
        <AdminSitesList initialData={initialData} />
      </main>
    </div>
  );
}
