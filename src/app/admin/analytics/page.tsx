/**
 * src/app/admin/analytics/page.tsx
 *
 * Page admin plateforme — dashboard KPIs analytics.
 * Server Component — guard ANALYTICS_PLATEFORME + isPlatformSite.
 *
 * Story E.1 — Sprint E (ADR-021).
 * R2 : enums importes depuis @/types.
 * R8 : acces reserve au site plateforme uniquement.
 */

import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { isPlatformSite } from "@/lib/queries/sites";
import { getPlatformKPIs } from "@/lib/queries/admin-analytics";
import { AdminAnalyticsDashboard } from "@/components/admin/analytics/admin-analytics-dashboard";
import { Permission } from "@/types";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Admin Plateforme — Analytics" };
}

// ISR 5 minutes
export const revalidate = 300;

export default async function AdminAnalyticsPage() {
  // Auth guard
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Permission guard — ANALYTICS_PLATEFORME
  const permissions = await checkPagePermission(session, Permission.ANALYTICS_PLATEFORME);
  if (!permissions) redirect("/");

  // Platform guard — cette page est reservee au site plateforme
  if (!session.activeSiteId) redirect("/");
  const isPlat = await isPlatformSite(session.activeSiteId);
  if (!isPlat) redirect("/");

  // Charger les KPIs initiaux
  const initialKPIs = await getPlatformKPIs();

  return (
    <div className="min-h-screen bg-background">
      <Header title="Analytics Plateforme" />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Analytics Plateforme</h1>
          <p className="text-sm text-muted-foreground">
            KPIs consolides de toute la plateforme DKFarm
          </p>
        </div>
        <AdminAnalyticsDashboard initialKPIs={initialKPIs} />
      </main>
    </div>
  );
}
