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
import { getServerSession } from "@/lib/auth";
import { getAbonnementActif } from "@/lib/queries/abonnements";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarifs — FarmFlow",
  description: "Découvrez nos plans tarifaires pour la gestion de votre ferme piscicole.",
};

// Pas de cache : les prix peuvent changer
export const dynamic = "force-dynamic";

export default async function TarifsPage() {
  // Charger les plans publics depuis l'API
  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  let plans: import("@/types").PlanAbonnement[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/plans?public=true`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      plans = data.plans ?? [];
    }
  } catch {
    // Fallback silencieux — la page s'affiche sans plans si l'API est indisponible
  }

  // Vérifier si l'utilisateur est connecté et quel est son abonnement actif
  const session = await getServerSession();
  // abonnementActif est le retour Prisma brut — on ne caste pas pour éviter les erreurs de type
  let abonnementActif: Awaited<ReturnType<typeof getAbonnementActif>> = null;
  if (session?.activeSiteId) {
    try {
      abonnementActif = await getAbonnementActif(session.activeSiteId);
    } catch {
      // Silencieux — pas bloquant
    }
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-card border-b border-border py-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">
            Choisissez votre plan
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base max-w-xl mx-auto">
            Gérez votre ferme piscicole efficacement. Commencez gratuitement,
            évoluez selon vos besoins.
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
            Comparaison détaillée
          </h2>
          <PlanComparaisonTable plans={plans} />
        </div>
      </section>
    </main>
  );
}
