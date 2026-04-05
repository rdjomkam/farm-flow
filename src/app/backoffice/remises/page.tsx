/**
 * src/app/backoffice/remises/page.tsx
 *
 * Page backoffice — gestion des remises et codes promo (globaux).
 * Server Component — guard checkBackofficeAccess().
 * L'admin backoffice voit toutes les remises (globales + par site).
 *
 * Story C.7 — ADR-022 Backoffice
 */
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { prisma } from "@/lib/db";
import { RemisesListClient } from "@/components/remises/remises-list-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Remises",
};

export const dynamic = "force-dynamic";

export default async function BackofficeRemisesPage() {
  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

  const t = await getTranslations("backoffice");

  // Admin backoffice voit TOUTES les remises (globales + par site)
  const remises = await prisma.remise.findMany({
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const remisesFormatted = remises.map((r) => ({
    ...r,
    valeur: Number(r.valeur),
    user: r.user,
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t("pages.remises.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("pages.remises.subtitle")}</p>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Remises actives
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {remises.filter((r) => r.isActif).length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Total utilisations
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {remises.reduce((sum, r) => sum + r.nombreUtilisations, 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Remises globales
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {remises.filter((r) => r.siteId === null).length}
          </p>
        </div>
      </div>

      <RemisesListClient remises={remisesFormatted} />
    </div>
  );
}
