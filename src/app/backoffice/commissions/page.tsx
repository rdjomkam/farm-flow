/**
 * src/app/backoffice/commissions/page.tsx
 *
 * Page backoffice — gestion des commissions et retraits.
 * Server Component — guard checkBackofficeAccess().
 *
 * Story C.7 — ADR-022 Backoffice
 * R2 : enums importes depuis @/types
 */
import { redirect } from "next/navigation";
import { checkBackofficeAccess } from "@/lib/auth/backoffice";
import { prisma } from "@/lib/db";
import { AdminRetraitsList } from "@/components/commissions/admin-retraits-list";
import { StatutPaiementAbo } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Commissions",
};

export const dynamic = "force-dynamic";

export default async function BackofficeCommissionsPage() {
  const session = await checkBackofficeAccess();
  if (!session) redirect("/login");

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
      orderBy: { createdAt: "asc" },
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
      take: 50,
    }),
  ]);

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
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Gestion des commissions</h1>
        <p className="text-sm text-muted-foreground">Retraits et portefeuilles des ingenieurs</p>
      </div>

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
            Total a verser
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
            Retraits traites (recents)
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {retraitsTraites.length}
          </p>
        </div>
      </div>

      <AdminRetraitsList
        retraitsDemandes={retraitsDemandesFormatted}
        retraitsTraites={retraitsTraitesFormatted}
      />
    </div>
  );
}
