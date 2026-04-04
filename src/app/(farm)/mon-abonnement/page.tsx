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
import { getAbonnementActifPourSite, getAbonnementById } from "@/lib/queries/abonnements";
import { AbonnementActuelCard } from "@/components/abonnements/abonnement-actuel-card";
import { PaiementsHistoryList } from "@/components/abonnements/paiements-history-list";
import { QuotasUsageBar } from "@/components/subscription/quotas-usage-bar";
import { Permission } from "@/types";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata");
  return { title: t("monAbonnement") };
}

export const dynamic = "force-dynamic";

export default async function MonAbonnementPage() {
  const t = await getTranslations("abonnements");
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ABONNEMENTS_VOIR);
  if (!permissions) {
    redirect("/");
  }

  // Charger l'abonnement actif + soldeCredit utilisateur en parallèle
  const [abonnementActif, userData] = await Promise.all([
    getAbonnementActifPourSite(session.activeSiteId),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { soldeCredit: true },
    }),
  ]);

  const soldeCredit = userData?.soldeCredit ? Number(userData.soldeCredit) : 0;

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
      <Header title={t("monAbonnement.title")} />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Solde de crédit disponible */}
        {soldeCredit > 0 && (
          <div className="rounded-lg border bg-card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t("monAbonnement.soldeCredit")}</p>
              <p className="text-xs text-muted-foreground">{t("monAbonnement.soldeCreditDesc")}</p>
            </div>
            <span className="text-lg font-bold text-primary">
              {soldeCredit.toLocaleString("fr-FR", { style: "currency", currency: "XAF", minimumFractionDigits: 0 })}
            </span>
          </div>
        )}

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
        {/* Utilisation des quotas */}
        <QuotasUsageBar siteId={session.activeSiteId} />

        {paiements.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-3">
              {t("monAbonnement.paymentHistory")}
            </h2>
            <PaiementsHistoryList paiements={paiements} />
          </div>
        )}
        {!abonnementActif && (
          <div className="text-center py-10">
            <p className="text-muted-foreground text-sm">
              {t("monAbonnement.noSubscription")}
            </p>
            <a
              href="/tarifs"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium min-h-[44px] transition-colors hover:bg-primary/90"
            >
              {t("monAbonnement.viewPlans")}
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
