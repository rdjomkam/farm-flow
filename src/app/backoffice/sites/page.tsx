/**
 * src/app/backoffice/sites/page.tsx
 *
 * Page backoffice — liste de tous les sites clients.
 * Server Component — guard checkBackofficeAccess().
 *
 * Story C.6 — ADR-022 Backoffice
 */

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { getAdminSites } from "@/lib/queries/admin-sites";
import { BackofficeSitesList } from "@/components/backoffice/backoffice-sites-list";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("backoffice.nav");
  return { title: t("sites") };
}

export const dynamic = "force-dynamic";

export default async function BackofficeSitesPage() {
  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

  const t = await getTranslations("backoffice");

  const initialData = await getAdminSites({ pageSize: 200 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{t("pages.sites.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("pages.sites.subtitle", { active: initialData.stats.totalActive, total: initialData.total })}
        </p>
      </div>
      <BackofficeSitesList initialData={initialData} />
    </div>
  );
}
