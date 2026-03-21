/**
 * src/app/mon-portefeuille/page.tsx
 *
 * Page tableau de bord des commissions ingénieur.
 * Server Component — charge le portefeuille + commissions.
 * Protégé par PORTEFEUILLE_VOIR.
 *
 * Story 34.3 — Sprint 34
 * R2 : enums importés depuis @/types
 * R6 : CSS variables du thème
 */
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getPortefeuille, getCommissionsIngenieur } from "@/lib/queries/commissions";
import { PortefeuilleSummary } from "@/components/commissions/portefeuille-summary";
import { CommissionsList } from "@/components/commissions/commissions-list";
import { RetraitsList } from "@/components/commissions/retraits-list";
import { Permission } from "@/types";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata");
  return { title: t("monPortefeuille") };
}

export const dynamic = "force-dynamic";

export default async function MonPortefeuillePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.PORTEFEUILLE_VOIR);
  if (!permissions) {
    redirect("/");
  }

  // Charger le portefeuille + commissions récentes
  const { portefeuille, commissionsRecentes } = await getPortefeuille(session.userId);

  // Charger toutes les commissions pour la liste
  const commissions = await getCommissionsIngenieur(session.userId);

  // Données du portefeuille avec valeurs par défaut
  const solde = portefeuille ? Number(portefeuille.solde) : 0;
  const soldePending = portefeuille ? Number(portefeuille.soldePending) : 0;
  const totalGagne = portefeuille ? Number(portefeuille.totalGagne) : 0;
  const totalPaye = portefeuille ? Number(portefeuille.totalPaye) : 0;
  const retraits = portefeuille?.retraits ?? [];

  // Mapper les commissions pour le composant (Decimal → number)
  const commissionsFormatted = commissions.map((c) => ({
    ...c,
    montant: Number(c.montant),
    taux: Number(c.taux),
    siteClient: c.siteClient as { id: string; name: string } | undefined,
    abonnement: c.abonnement as { plan?: { nom: string } } | undefined,
  }));

  // Mapper les retraits pour le composant
  const retraitsFormatted = retraits.map((r) => ({
    ...r,
    montant: Number(r.montant),
  }));

  void commissionsRecentes; // Données disponibles pour futur usage (graphique)

  return (
    <div className="min-h-screen bg-background">
      <Header title="Mon Portefeuille" />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Résumé financier */}
        <PortefeuilleSummary
          solde={solde}
          soldePending={soldePending}
          totalGagne={totalGagne}
          totalPaye={totalPaye}
        />

        {/* Historique des commissions */}
        <section>
          <h2 className="text-base font-semibold text-foreground mb-3">
            Mes commissions
          </h2>
          {commissionsFormatted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune commission pour le moment.
            </p>
          ) : (
            <CommissionsList commissions={commissionsFormatted} />
          )}
        </section>

        {/* Historique des retraits */}
        {retraitsFormatted.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">
              Historique des retraits
            </h2>
            <RetraitsList retraits={retraitsFormatted} />
          </section>
        )}
      </main>
    </div>
  );
}
