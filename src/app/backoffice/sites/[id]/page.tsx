/**
 * src/app/backoffice/sites/[id]/page.tsx
 *
 * Page backoffice — detail d'un site client.
 * Server Component — guard checkBackofficeAccess().
 *
 * Story C.6 — ADR-022 Backoffice
 */

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { getAdminSiteById } from "@/lib/queries/admin-sites";
import { BackofficeSiteDetailClient } from "@/components/backoffice/backoffice-site-detail-client";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const site = await getAdminSiteById(id);
  return { title: site ? site.name : "Site introuvable" };
}

export const dynamic = "force-dynamic";

export default async function BackofficeSiteDetailPage({ params }: Props) {
  const { id } = await params;

  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

  const site = await getAdminSiteById(id);
  if (!site) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <Link
        href="/backoffice/sites"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux sites
      </Link>

      <BackofficeSiteDetailClient site={site} />
    </div>
  );
}
