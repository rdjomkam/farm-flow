/**
 * src/app/backoffice/plans/page.tsx
 *
 * Page backoffice — gestion des plans d'abonnement.
 * Server Component — guard checkBackofficeAccess().
 *
 * Story C.7 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 */
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { getPlansAbonnements } from "@/lib/queries/plans-abonnements";
import { PlansAdminList } from "@/components/abonnements/plans-admin-list";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("backoffice.nav");
  return { title: t("plans") };
}

export const dynamic = "force-dynamic";

export default async function BackofficePlansPage() {
  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

  const t = await getTranslations("backoffice");

  const plansRaw = await getPlansAbonnements(true);

  const plans = plansRaw.map((p) => ({
    ...p,
    typePlan: p.typePlan as unknown as import("@/types").TypePlan,
    prixMensuel: p.prixMensuel !== null ? Number(p.prixMensuel) : null,
    prixTrimestriel: p.prixTrimestriel !== null ? Number(p.prixTrimestriel) : null,
    prixAnnuel: p.prixAnnuel !== null ? Number(p.prixAnnuel) : null,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t("pages.plans.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("pages.plans.subtitle", { count: plans.length })}
          </p>
        </div>
      </div>
      <PlansAdminList plans={plans as Parameters<typeof PlansAdminList>[0]["plans"]} />
    </div>
  );
}
