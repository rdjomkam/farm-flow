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
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { getPlansAbonnements } from "@/lib/queries/plans-abonnements";
import { PlansAdminList } from "@/components/abonnements/plans-admin-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plans",
};

export const dynamic = "force-dynamic";

export default async function BackofficePlansPage() {
  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

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
          <h1 className="text-xl font-bold text-foreground">Plans d&apos;abonnement</h1>
          <p className="text-sm text-muted-foreground">
            {plans.length} plan{plans.length > 1 ? "s" : ""} au total
          </p>
        </div>
      </div>
      <PlansAdminList plans={plans as Parameters<typeof PlansAdminList>[0]["plans"]} />
    </div>
  );
}
