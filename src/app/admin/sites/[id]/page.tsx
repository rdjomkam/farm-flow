/**
 * src/app/admin/sites/[id]/page.tsx
 *
 * Page admin plateforme — détail d'un site client.
 * Server Component — guard SITES_VOIR + isPlatformSite.
 * 404 si le site n'est pas trouvé.
 *
 * Story C.3 — Sprint C (ADR-021).
 * R2 : enums importés depuis @/types.
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { isPlatformSite } from "@/lib/queries/sites";
import { getAdminSiteById } from "@/lib/queries/admin-sites";
import { AdminSiteDetailClient } from "@/components/admin/sites/admin-site-detail-client";
import { Permission } from "@/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const site = await getAdminSiteById(id);
  return { title: site ? `Admin — ${site.name}` : "Site introuvable" };
}

export const dynamic = "force-dynamic";

export default async function AdminSiteDetailPage({ params }: Props) {
  const { id } = await params;

  // Auth guard
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Permission guard — SITES_VOIR
  const permissions = await checkPagePermission(session, Permission.SITES_VOIR);
  if (!permissions) redirect("/");

  // Platform guard
  if (!session.activeSiteId) redirect("/");
  const isPlat = await isPlatformSite(session.activeSiteId);
  if (!isPlat) redirect("/");

  // Charger le détail du site
  const site = await getAdminSiteById(id);
  if (!site) notFound();

  return (
    <div className="min-h-screen bg-background">
      <Header title={site.name} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Breadcrumb */}
        <Link
          href="/admin/sites"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux sites
        </Link>

        <AdminSiteDetailClient site={site} />
      </main>
    </div>
  );
}
