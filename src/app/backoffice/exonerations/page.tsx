/**
 * src/app/backoffice/exonerations/page.tsx
 *
 * Page backoffice — gestion des exonérations (accès gratuits accordés manuellement).
 * Server Component — guard checkBackofficeAccess().
 *
 * Story 51.2 — Sprint 51
 * R2 : enums importés depuis @/types
 */
import { redirect } from "next/navigation";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { prisma } from "@/lib/db";
import { ExonerationsList } from "@/components/backoffice/exonerations-list";
import { ExonerationFormDialog } from "@/components/backoffice/exoneration-form-dialog";
import { Button } from "@/components/ui/button";
import { TypePlan, StatutAbonnement } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exonerations — DKFarm Backoffice",
};

export const dynamic = "force-dynamic";

export default async function BackofficeExonerationsPage() {
  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

  // Récupérer tous les abonnements EXONERATION (tous statuts)
  // R2 : TypePlan.EXONERATION (enum importé)
  const exonerationsRaw = await prisma.abonnement.findMany({
    where: {
      plan: {
        typePlan: TypePlan.EXONERATION,
      },
    },
    include: {
      plan: { select: { id: true, nom: true, typePlan: true } },
      site: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Sérialiser les Decimal et Date pour le passage au Client Component
  const exonerations = exonerationsRaw.map((a) => ({
    ...a,
    dateDebut: a.dateDebut.toISOString(),
    dateFin: a.dateFin.toISOString(),
    dateProchainRenouvellement: a.dateProchainRenouvellement.toISOString(),
    prixPaye: Number(a.prixPaye),
    plan: {
      ...a.plan,
      // ERR-012 : cast enum Prisma → @/types
      typePlan: a.plan.typePlan as unknown as import("@/types").TypePlan,
    },
  }));

  const total = exonerations.length;
  const totalActives = exonerations.filter((e) => (e.statut as string) === StatutAbonnement.ACTIF).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Exonerations
          </h1>
          <p className="text-sm text-muted-foreground">
            Acces gratuits accordes manuellement (partenaires, ONG, projets pilotes).
          </p>
        </div>
        <ExonerationFormDialog
          trigger={
            <Button variant="primary">
              + Nouvelle exoneration
            </Button>
          }
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">{total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Actives
          </p>
          <p className="mt-1 text-2xl font-bold text-success">{totalActives}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 col-span-2 sm:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Annulees / Expirees
          </p>
          <p className="mt-1 text-2xl font-bold text-muted-foreground">
            {total - totalActives}
          </p>
        </div>
      </div>

      {/* Liste des exonérations */}
      <ExonerationsList
        initialItems={exonerations as Parameters<typeof ExonerationsList>[0]["initialItems"]}
      />
    </div>
  );
}
