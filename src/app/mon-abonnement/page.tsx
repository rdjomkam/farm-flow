/**
 * src/app/mon-abonnement/page.tsx
 *
 * Page de gestion de l'abonnement actuel du promoteur.
 * Server Component — charge l'abonnement actif + historique des paiements.
 * Protégé par ABONNEMENTS_VOIR.
 *
 * Story 33.3 — Sprint 33
 * R2 : enums importés depuis @/types
 * R6 : CSS variables du thème
 */
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getAbonnementActif, getAbonnementById } from "@/lib/queries/abonnements";
import { AbonnementActuelCard } from "@/components/abonnements/abonnement-actuel-card";
import { PaiementsHistoryList } from "@/components/abonnements/paiements-history-list";
import { Permission } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon Abonnement — FarmFlow",
};

export const dynamic = "force-dynamic";

export default async function MonAbonnementPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ABONNEMENTS_VOIR);
  if (!permissions) {
    redirect("/");
  }

  // Charger l'abonnement actif (inclut plan)
  const abonnementActif = await getAbonnementActif(session.activeSiteId);

  // Charger les paiements si un abonnement actif existe
  let paiements: import("@/types").PaiementAbonnement[] = [];
  if (abonnementActif) {
    const detail = await getAbonnementById(abonnementActif.id, session.activeSiteId);
    paiements = (detail?.paiements ?? []).map((p) => ({
      ...p,
      montant: Number(p.montant),
    })) as import("@/types").PaiementAbonnement[];
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Mon Abonnement" />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <AbonnementActuelCard
          abonnement={abonnementActif
            ? ({
                ...abonnementActif,
                prixPaye: Number(abonnementActif.prixPaye),
                // Convertion Prisma Decimal → number (R3)
                // Convertion Prisma TypePlan → @/types TypePlan (même valeurs UPPERCASE — R1)
                statut: abonnementActif.statut as unknown as import("@/types").StatutAbonnement,
                periode: abonnementActif.periode as unknown as import("@/types").PeriodeFacturation,
                plan: {
                  ...abonnementActif.plan,
                  typePlan: abonnementActif.plan.typePlan as unknown as import("@/types").TypePlan,
                  prixMensuel: abonnementActif.plan.prixMensuel !== null ? Number(abonnementActif.plan.prixMensuel) : null,
                  prixTrimestriel: abonnementActif.plan.prixTrimestriel !== null ? Number(abonnementActif.plan.prixTrimestriel) : null,
                  prixAnnuel: abonnementActif.plan.prixAnnuel !== null ? Number(abonnementActif.plan.prixAnnuel) : null,
                },
              } as import("@/types").AbonnementWithPlan)
            : null}
        />
        {paiements.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">
              Historique des paiements
            </h2>
            <PaiementsHistoryList paiements={paiements} />
          </div>
        )}
        {!abonnementActif && (
          <div className="text-center py-10">
            <p className="text-muted-foreground text-sm">
              Vous n&apos;avez pas d&apos;abonnement actif.
            </p>
            <a
              href="/tarifs"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium min-h-[44px] transition-colors hover:bg-primary/90"
            >
              Voir les plans
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
