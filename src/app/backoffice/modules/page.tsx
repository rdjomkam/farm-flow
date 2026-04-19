/**
 * src/app/backoffice/modules/page.tsx
 *
 * Page backoffice — registre des modules.
 * Server Component — guard checkBackofficeAccess().
 *
 * Story C.7 — ADR-022 Backoffice
 */
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { prisma } from "@/lib/db";
import { AdminModulesList } from "@/components/admin/modules/admin-modules-list";
import type { AdminModulesListResponse, ModuleDefinitionResponse } from "@/types";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("backoffice.nav");
  return { title: t("modules") };
}

export const dynamic = "force-dynamic";

export default async function BackofficeModulesPage() {
  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

  const t = await getTranslations("backoffice");

  let initialData: AdminModulesListResponse = { modules: [] };
  try {
    const rawModules = await prisma.moduleDefinition.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });

    const siteCountRows = await prisma.$queryRaw<{ module: string; count: bigint }[]>`
      SELECT unnest("enabledModules") as module, COUNT(*) as count
      FROM "Site"
      WHERE "deletedAt" IS NULL
      GROUP BY module
    `;
    const siteCountMap = new Map(siteCountRows.map((r) => [r.module, Number(r.count)]));

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
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{t("pages.modules.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("pages.modules.subtitle", { count: initialData.modules.length })}
        </p>
      </div>
      <AdminModulesList initialData={initialData} />
    </div>
  );
}
