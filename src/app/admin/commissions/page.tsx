/**
 * src/app/admin/commissions/page.tsx
 *
 * Page d'administration des commissions et retraits — vue DKFarm.
 * Server Component — protégé par COMMISSIONS_GERER.
 * L'admin voit tous les retraits en attente + historique.
 *
 * Story 34.4 — Sprint 34
 * R2 : enums importés depuis @/types
 * R8 : l'admin voit les commissions de tous les ingénieurs (pas filtré par activeSiteId)
 */
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminRetraitsList } from "@/components/commissions/admin-retraits-list";
import { Permission, StatutPaiementAbo } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestion des commissions — FarmFlow Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminCommissionsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");

  const permissions = await checkPagePermission(session, Permission.COMMISSIONS_GERER);
  if (!permissions) {
    redirect("/");
  }

  // R8 : admin voit tous les retraits — pas de filtre siteId
  const [retraitsDemandes, retraitsTraites] = await Promise.all([
    prisma.retraitPortefeuille.findMany({
      where: { statut: StatutPaiementAbo.EN_ATTENTE },
      include: {
        portefeuille: {
          include: {
            ingenieur: { select: { id: true, name: true, phone: true, email: true } },
          },
        },
        demandeur: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" }, // Plus anciens en premier
    }),
    prisma.retraitPortefeuille.findMany({
      where: {
        statut: {
          in: [StatutPaiementAbo.CONFIRME, StatutPaiementAbo.ECHEC, StatutPaiementAbo.EXPIRE],
        },
      },
      include: {
        portefeuille: {
          include: {
            ingenieur: { select: { id: true, name: true, phone: true, email: true } },
          },
        },
        demandeur: { select: { id: true, name: true } },
        traiteur: { select: { id: true, name: true } },
      },
      orderBy: { dateTraitement: "desc" },
      take: 50, // Limiter l'historique
    }),
  ]);

  // Convertir les Decimal en number
  const retraitsDemandesFormatted = retraitsDemandes.map((r) => ({
    ...r,
    montant: Number(r.montant),
    portefeuille: {
      ...r.portefeuille,
      solde: Number(r.portefeuille.solde),
    },
  }));

  const retraitsTraitesFormatted = retraitsTraites.map((r) => ({
    ...r,
    montant: Number(r.montant),
    portefeuille: {
      ...r.portefeuille,
      solde: Number(r.portefeuille.solde),
    },
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header title="Gestion des commissions" />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Statistiques rapides */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Retraits en attente
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {retraitsDemandes.length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Total à verser
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {new Intl.NumberFormat("fr-CM", {
                style: "currency",
                currency: "XAF",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(
                retraitsDemandes.reduce((sum, r) => sum + Number(r.montant), 0)
              )}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 col-span-2 sm:col-span-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Retraits traités (récents)
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {retraitsTraites.length}
            </p>
          </div>
        </div>

        {/* Liste des retraits */}
        <AdminRetraitsList
          retraitsDemandes={retraitsDemandesFormatted}
          retraitsTraites={retraitsTraitesFormatted}
        />
      </main>
    </div>
  );
}
