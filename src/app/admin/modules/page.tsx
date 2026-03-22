/**
 * src/app/admin/modules/page.tsx
 *
 * Page admin plateforme — registre des modules.
 * Server Component — guard SITES_GERER + isPlatformSite.
 *
 * Story E.2 — Sprint E (ADR-021).
 * R2 : enums importes depuis @/types.
 * R8 : acces reserve au site plateforme uniquement.
 */

import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { isPlatformSite } from "@/lib/queries/sites";
import { prisma } from "@/lib/db";
import { AdminModulesList } from "@/components/admin/modules/admin-modules-list";
import { Permission } from "@/types";
import type { AdminModulesListResponse, ModuleDefinitionResponse } from "@/types";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Admin Plateforme — Registre des modules" };
}

export const dynamic = "force-dynamic";

export default async function AdminModulesPage() {
  // Auth guard
  const session = await getServerSession();
  if (!session) redirect("/login");

  // Permission guard — SITES_GERER
  const permissions = await checkPagePermission(session, Permission.SITES_GERER);
  if (!permissions) redirect("/");

  // Platform guard — cette page est reservee au site plateforme
  if (!session.activeSiteId) redirect("/");
  const isPlat = await isPlatformSite(session.activeSiteId);
  if (!isPlat) redirect("/");

  // Charger les modules via Prisma + stats calculees
  let initialData: AdminModulesListResponse = { modules: [] };
  try {
    const rawModules = await prisma.moduleDefinition.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });

    // siteCount via unnest() PostgreSQL
    const siteCountRows = await prisma.$queryRaw<{ module: string; count: bigint }[]>`
      SELECT unnest("enabledModules") as module, COUNT(*) as count
      FROM "Site"
      WHERE "deletedAt" IS NULL
      GROUP BY module
    `;
    const siteCountMap = new Map(siteCountRows.map((r) => [r.module, Number(r.count)]));

    // planCount via unnest() PostgreSQL
    const planCountRows = await prisma.$queryRaw<{ module: string; count: bigint }[]>`
      SELECT unnest("modulesInclus") as module, COUNT(*) as count
      FROM "PlanAbonnement"
      WHERE "isActif" = true
      GROUP BY module
    `;
    const planCountMap = new Map(planCountRows.map((r) => [r.module, Number(r.count)]));

    const modules: ModuleDefinitionResponse[] = rawModules.map((m) => ({
      id: m.id,
      key: m.key,
      label: m.label,
      description: m.description,
      iconName: m.iconName,
      sortOrder: m.sortOrder,
      level: m.level as "site" | "platform",
      dependsOn: m.dependsOn,
      isVisible: m.isVisible,
      isActive: m.isActive,
      category: m.category,
      siteCount: siteCountMap.get(m.key) ?? 0,
      planCount: planCountMap.get(m.key) ?? 0,
    }));

    initialData = { modules };
  } catch {
    // Le composant gere l'etat vide
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Registre des modules" />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Registre des modules</h1>
          <p className="text-sm text-muted-foreground">
            {initialData.modules.length} module
            {initialData.modules.length !== 1 ? "s" : ""} enregistre
            {initialData.modules.length !== 1 ? "s" : ""}
          </p>
        </div>
        <AdminModulesList initialData={initialData} />
      </main>
    </div>
  );
}
