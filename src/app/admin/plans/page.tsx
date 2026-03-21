/**
 * src/app/admin/plans/page.tsx
 *
 * Page d'administration des plans d'abonnement.
 * Server Component — protégé par PLANS_GERER.
 * Affiche tous les plans (actifs et inactifs).
 *
 * Story 38.1 — Sprint 38
 * R2 : enums importés depuis @/types
 * R8 : PlanAbonnement est global (pas de siteId — exception ADR-020)
 * ERR-012 : cast enums Prisma → @/types via `as unknown as TypePlan`
 */
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getPlansAbonnements } from "@/lib/queries/plans-abonnements";
import { PlansAdminList } from "@/components/abonnements/plans-admin-list";
import { Permission } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestion des plans — FarmFlow Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await checkPagePermission(session, Permission.PLANS_GERER);
  if (!permissions) {
    redirect("/");
  }

  // Charger tous les plans y compris inactifs (includeInactif = true)
  const plansRaw = await getPlansAbonnements(true);

  // ERR-012 : sérialiser les Decimal + caster les enums Prisma → @/types
  const plans = plansRaw.map((p) => ({
    ...p,
    // Caster l'enum TypePlan Prisma → TypePlan @/types (valeurs UPPERCASE identiques — R1)
    typePlan: p.typePlan as unknown as import("@/types").TypePlan,
    // Sérialiser les champs Decimal Prisma → number (non serialisable en JSON)
    prixMensuel: p.prixMensuel !== null ? Number(p.prixMensuel) : null,
    prixTrimestriel: p.prixTrimestriel !== null ? Number(p.prixTrimestriel) : null,
    prixAnnuel: p.prixAnnuel !== null ? Number(p.prixAnnuel) : null,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header title="Gestion des plans" />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">Plans d&apos;abonnement</h1>
            <p className="text-sm text-muted-foreground">
              {plans.length} plan{plans.length > 1 ? "s" : ""} au total
            </p>
          </div>
        </div>
        <PlansAdminList plans={plans as Parameters<typeof PlansAdminList>[0]["plans"]} />
      </main>
    </div>
  );
}
