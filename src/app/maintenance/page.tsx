/**
 * src/app/maintenance/page.tsx
 *
 * Page de maintenance globale de la plateforme DKFarm.
 * Server Component — toujours accessible (dans la whitelist du middleware).
 *
 * Affiche :
 * - Titre "Plateforme en maintenance"
 * - Message de maintenance personnalise (si present dans FeatureFlag.value.message)
 * - Date de debut et date de fin prevue (si disponibles)
 * - Lien vers le backoffice si l'utilisateur est super-admin
 *
 * Mobile-first, centre, CSS variables du theme (R6).
 * ADR-maintenance-mode
 */

import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { WrenchIcon } from "lucide-react";
import Link from "next/link";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import type { MaintenanceStatusResponse } from "@/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("maintenance");
  return { title: t("metadataTitle") };
}

// Desactiver le cache statique — la page doit refleter l'etat courant
export const dynamic = "force-dynamic";

async function getMaintenanceStatus(): Promise<MaintenanceStatusResponse> {
  try {
    const { prisma } = await import("@/lib/db");
    const flag = await prisma.featureFlag.findUnique({
      where: { key: "MAINTENANCE_MODE" },
      select: { enabled: true, value: true },
    });

    if (!flag || !flag.enabled) {
      return { maintenanceMode: false, message: null, estimatedEnd: null };
    }

    const value = (flag.value as Record<string, unknown> | null) ?? null;
    return {
      maintenanceMode: true,
      message: typeof value?.message === "string" ? value.message : null,
      estimatedEnd:
        typeof value?.estimatedEnd === "string" ? value.estimatedEnd : null,
    };
  } catch {
    return { maintenanceMode: false, message: null, estimatedEnd: null };
  }
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function MaintenancePage() {
  const t = await getTranslations("maintenance");
  const locale = await getLocale();
  const [status, session] = await Promise.all([
    getMaintenanceStatus(),
    checkBackofficeAccess(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12 text-center">
      {/* Icon */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-warning/10 text-warning">
        <WrenchIcon className="h-10 w-10" aria-hidden="true" />
      </div>

      {/* Title */}
      <h1 className="mb-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t("title")}
      </h1>

      {/* Message */}
      <p className="mb-6 max-w-md text-base text-muted-foreground sm:text-lg">
        {status.message ?? t("defaultMessage")}
      </p>

      {/* Dates */}
      {status.estimatedEnd && (
        <div className="mb-6 rounded-lg border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{t("estimatedEnd")} : </span>
          {formatDate(status.estimatedEnd, locale)}
        </div>
      )}

      {/* Instructions */}
      <p className="mb-8 max-w-sm text-sm text-muted-foreground">
        {t("instructions")}
      </p>

      {/* Lien backoffice pour super-admin */}
      {session && (
        <Link
          href="/backoffice/feature-flags"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("disableMaintenanceLink")}
        </Link>
      )}
    </div>
  );
}
