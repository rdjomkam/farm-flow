/**
 * src/app/backoffice/feature-flags/page.tsx
 *
 * Page de gestion des feature flags — backoffice super-admin.
 * Server Component — guard checkBackofficeAccess().
 *
 * ADR-maintenance-mode
 */

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { FeatureFlagsList } from "@/components/backoffice/feature-flags-list";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("backoffice.nav");
  return { title: t("featureFlags") };
}

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

  const t = await getTranslations("backoffice.featureFlags");

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <FeatureFlagsList />
    </div>
  );
}
