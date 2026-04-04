/**
 * src/app/tarifs/page.tsx
 *
 * Page publique de présentation des plans tarifaires.
 * Server Component — accessible sans authentification.
 * Mobile-first : 1 colonne à 360px, 2 tablette, 4 desktop.
 *
 * Story 33.1 — Sprint 33
 * R6 : CSS variables du thème (pas de couleurs hardcodées)
 */
import { PlansGrid } from "@/components/abonnements/plans-grid";
import { PlanComparaisonTable } from "@/components/abonnements/plan-comparaison-table";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getServerSession } from "@/lib/auth";
import { getAbonnementActifPourSite } from "@/lib/queries/abonnements";
import { getPlansAbonnements } from "@/lib/queries/plans-abonnements";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import type { PlanAbonnement } from "@/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata");
  return {
    title: t("tarifs"),
    description: t("tarifsDescription"),
  };
}

// Pas de cache : les prix peuvent changer
export const dynamic = "force-dynamic";

export default async function TarifsPage() {
  const t = await getTranslations("abonnements.tarifs");

  // BUG-023 fix: appel direct à la query au lieu de fetch self-API
  const rawPlans = await getPlansAbonnements();
  // Sérialiser les Decimal Prisma en number pour le Client Component
  const plans: PlanAbonnement[] = rawPlans.map((p) => ({
    ...p,
    prixMensuel: p.prixMensuel != null ? Number(p.prixMensuel) : null,
    prixTrimestriel: p.prixTrimestriel != null ? Number(p.prixTrimestriel) : null,
    prixAnnuel: p.prixAnnuel != null ? Number(p.prixAnnuel) : null,
  })) as PlanAbonnement[];

  // Vérifier si l'utilisateur est connecté et quel est son abonnement actif
  const session = await getServerSession();
  // abonnementActif est le retour Prisma brut — on ne caste pas pour éviter les erreurs de type
  let abonnementActif: Awaited<ReturnType<typeof getAbonnementActifPourSite>> = null;
  if (session?.activeSiteId) {
    try {
      abonnementActif = await getAbonnementActifPourSite(session.activeSiteId);
    } catch {
      // Silencieux — pas bloquant
    }
  }

  return (
    <main className="min-h-screen bg-background relative pt-[env(safe-area-inset-top)]">
      {/* Language switcher — top-right */}
      <div className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3 z-10">
        <LanguageSwitcher />
      </div>

      {/* Hero */}
      <section className="bg-card border-b border-border py-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base max-w-xl mx-auto">
            {t("heroSubtitle")}
          </p>
        </div>
      </section>

      {/* Grille des plans */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <PlansGrid plans={plans} abonnementActifPlanId={abonnementActif?.planId ?? null} />
        </div>
      </section>

      {/* Tableau de comparaison (desktop uniquement) */}
      <section className="hidden lg:block py-8 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
            {t("comparisonTitle")}
          </h2>
          <PlanComparaisonTable plans={plans} />
        </div>
      </section>
    </main>
  );
}
