/**
 * src/app/checkout/page.tsx
 *
 * Page checkout — souscription à un plan.
 * Server Component — vérifie auth, charge le plan depuis query param planId.
 * Redirige vers /connexion si non connecté.
 *
 * Story 33.2 — Sprint 33
 * R2 : enums importés depuis @/types
 * R6 : CSS variables du thème
 */
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { getPlanAbonnementById } from "@/lib/queries/plans-abonnements";
import { CheckoutForm } from "@/components/abonnements/checkout-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout — FarmFlow",
};

interface CheckoutPageProps {
  searchParams: Promise<{ planId?: string; renouvellement?: string }>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const session = await getServerSession();
  const params = await searchParams;

  if (!session) {
    const redirect_url = params.planId
      ? `/connexion?redirect=/checkout?planId=${params.planId}`
      : "/connexion?redirect=/checkout";
    redirect(redirect_url);
  }

  if (!session.activeSiteId) {
    redirect("/settings/sites");
  }

  const { planId } = params;

  if (!planId) {
    redirect("/tarifs");
  }

  const plan = await getPlanAbonnementById(planId);

  if (!plan || !plan.isActif) {
    redirect("/tarifs");
  }

  const isRenouvellement = params.renouvellement === "true";

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {isRenouvellement ? "Renouveler votre abonnement" : "Choisir un plan"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complétez les étapes ci-dessous pour activer votre abonnement.
          </p>
        </div>
        <CheckoutForm
          plan={plan as import("@/types").PlanAbonnement}
          isRenouvellement={isRenouvellement}
        />
      </div>
    </main>
  );
}
