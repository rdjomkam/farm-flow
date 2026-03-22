/**
 * src/app/backoffice/abonnements/page.tsx
 *
 * Page backoffice — gestion des abonnements de tous les sites.
 * Server Component — guard checkBackofficeAccess().
 *
 * Story C.7 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 */
import { redirect } from "next/navigation";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { prisma } from "@/lib/db";
import { AbonnementsAdminList } from "@/components/abonnements/abonnements-admin-list";
import { StatutAbonnement } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Abonnements",
};

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 20;

interface BackofficeAbonnementsPageProps {
  searchParams: Promise<{
    page?: string;
    statut?: string;
    planId?: string;
  }>;
}

export default async function BackofficeAbonnementsPage({ searchParams }: BackofficeAbonnementsPageProps) {
  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_LIMIT;

  const validStatuts = Object.values(StatutAbonnement);
  const statutFilter = params.statut && validStatuts.includes(params.statut as StatutAbonnement)
    ? (params.statut as StatutAbonnement)
    : undefined;
  const planIdFilter = params.planId ?? undefined;

  const [abonnementsRaw, total] = await Promise.all([
    prisma.abonnement.findMany({
      where: {
        ...(statutFilter && { statut: statutFilter }),
        ...(planIdFilter && { planId: planIdFilter }),
      },
      include: {
        plan: true,
        site: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_LIMIT,
    }),
    prisma.abonnement.count({
      where: {
        ...(statutFilter && { statut: statutFilter }),
        ...(planIdFilter && { planId: planIdFilter }),
      },
    }),
  ]);

  const plansRaw = await prisma.planAbonnement.findMany({
    where: { isActif: true },
    select: { id: true, nom: true, typePlan: true },
    orderBy: { typePlan: "asc" },
  });

  const plans = plansRaw.map((p) => ({
    ...p,
    typePlan: p.typePlan as unknown as import("@/types").TypePlan,
  }));

  const abonnements = abonnementsRaw.map((a) => ({
    ...a,
    prixPaye: Number(a.prixPaye),
    plan: {
      ...a.plan,
      prixMensuel: a.plan.prixMensuel !== null ? Number(a.plan.prixMensuel) : null,
      prixTrimestriel: a.plan.prixTrimestriel !== null ? Number(a.plan.prixTrimestriel) : null,
      prixAnnuel: a.plan.prixAnnuel !== null ? Number(a.plan.prixAnnuel) : null,
    },
  }));

  const totalPages = Math.ceil(total / PAGE_LIMIT);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground">Tous les abonnements</h1>
          <p className="text-sm text-muted-foreground">{total} abonnement{total > 1 ? "s" : ""} au total</p>
        </div>
      </div>
      <AbonnementsAdminList
        abonnements={abonnements as Parameters<typeof AbonnementsAdminList>[0]["abonnements"]}
        plans={plans}
        currentPage={page}
        totalPages={totalPages}
        total={total}
        currentStatut={statutFilter ?? null}
        currentPlanId={planIdFilter ?? null}
      />
    </div>
  );
}
