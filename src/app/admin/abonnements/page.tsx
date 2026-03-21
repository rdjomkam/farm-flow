/**
 * src/app/admin/abonnements/page.tsx
 *
 * Page d'administration des abonnements — tous les sites.
 * Server Component — protégé par ABONNEMENTS_GERER.
 * Pagination côté serveur (?page=N&limit=20).
 *
 * Story 33.4 — Sprint 33
 * R2 : enums importés depuis @/types
 * R8 : l'admin voit tous les abonnements (pas filtré par activeSiteId)
 */
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AbonnementsAdminList } from "@/components/abonnements/abonnements-admin-list";
import { Permission, StatutAbonnement } from "@/types";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata");
  return { title: t("adminAbonnements") };
}

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 20;

interface AdminAbonnementsPageProps {
  searchParams: Promise<{
    page?: string;
    statut?: string;
    planId?: string;
  }>;
}

export default async function AdminAbonnementsPage({ searchParams }: AdminAbonnementsPageProps) {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await checkPagePermission(session, Permission.ABONNEMENTS_GERER);
  if (!permissions) {
    redirect("/");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const skip = (page - 1) * PAGE_LIMIT;

  const validStatuts = Object.values(StatutAbonnement);
  const statutFilter = params.statut && validStatuts.includes(params.statut as StatutAbonnement)
    ? (params.statut as StatutAbonnement)
    : undefined;
  const planIdFilter = params.planId ?? undefined;

  // R8 : admin voit tous les abonnements — pas de filtre siteId
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

  // Charger la liste des plans pour les filtres
  const plansRaw = await prisma.planAbonnement.findMany({
    where: { isActif: true },
    select: { id: true, nom: true, typePlan: true },
    orderBy: { typePlan: "asc" },
  });
  // Convertir TypePlan Prisma → TypePlan @/types (même valeurs string UPPERCASE — R1)
  const plans = plansRaw.map((p) => ({
    ...p,
    typePlan: p.typePlan as unknown as import("@/types").TypePlan,
  }));

  // Sérialiser les Decimal
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
    <div className="min-h-screen bg-background">
      <Header title="Gestion des abonnements" />
      <main className="max-w-6xl mx-auto px-4 py-6">
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
      </main>
    </div>
  );
}
