/**
 * src/app/admin/remises/page.tsx
 *
 * Page d'administration des remises et codes promo.
 * Server Component — protégé par REMISES_GERER.
 *
 * Story 35.3 — Sprint 35
 * R2 : enums importés depuis @/types
 * R8 : admin voit remises du site actif + globales
 */
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RemisesListClient } from "@/components/remises/remises-list-client";
import { Permission } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestion des remises — FarmFlow Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminRemisesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await checkPagePermission(session, Permission.REMISES_GERER);
  if (!permissions) {
    redirect("/");
  }

  // R8 : charger les remises du site actif + globales (siteId null)
  const remises = await prisma.remise.findMany({
    where: {
      OR: [
        { siteId: session.activeSiteId },
        { siteId: null }, // globales
      ],
    },
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Convertir les Decimal en number pour le passage au Client Component
  const remisesFormatted = remises.map((r) => ({
    ...r,
    valeur: Number(r.valeur),
    user: r.user,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header title="Gestion des remises" />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
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

        {/* Liste des remises */}
        <RemisesListClient remises={remisesFormatted} />
      </main>
    </div>
  );
}
