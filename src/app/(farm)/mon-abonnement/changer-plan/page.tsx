/**
 * src/app/(farm)/mon-abonnement/changer-plan/page.tsx
 *
 * Page de changement de plan (upgrade / downgrade).
 * Server Component — charge l'abonnement actif, le catalogue des plans et les ressources du site.
 * Protégé par ABONNEMENTS_GERER.
 *
 * Story 50.6 — Sprint 50
 * R2 : enums importés depuis @/types
 * R6 : CSS variables du thème
 * Mobile-first (360px)
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getAbonnementActifPourSite } from "@/lib/queries/abonnements";
import { getPlansAbonnements } from "@/lib/queries/plans-abonnements";
import { ChangerPlanClient } from "@/components/abonnements/changer-plan-client";
import { Permission } from "@/types";
import { prisma } from "@/lib/db";
import type { PlanAbonnement } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changer de plan",
};

export const dynamic = "force-dynamic";

export default async function ChangerPlanPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ABONNEMENTS_GERER);
  if (!permissions) redirect("/mon-abonnement");

  // Charger l'abonnement actif
  const abonnementActif = await getAbonnementActifPourSite(session.activeSiteId);
  if (!abonnementActif) redirect("/tarifs");

  // Charger les plans disponibles
  const rawPlans = await getPlansAbonnements();
  const plans: PlanAbonnement[] = rawPlans.map((p) => ({
    ...p,
    prixMensuel: p.prixMensuel != null ? Number(p.prixMensuel) : null,
    prixTrimestriel: p.prixTrimestriel != null ? Number(p.prixTrimestriel) : null,
    prixAnnuel: p.prixAnnuel != null ? Number(p.prixAnnuel) : null,
  })) as PlanAbonnement[];

  // Charger le solde crédit de l'utilisateur
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { soldeCredit: true },
  });
  const soldeCreditActuel = Number(user?.soldeCredit ?? 0);

  // Charger les ressources du site (pour le sélecteur de downgrade)
  const [bacs, vagues] = await Promise.all([
    prisma.bac.findMany({
      where: { siteId: session.activeSiteId, isBlocked: false },
      select: { id: true, nom: true, isBlocked: true },
      orderBy: { nom: "asc" },
    }),
    prisma.vague.findMany({
      where: { siteId: session.activeSiteId },
      select: { id: true, code: true, statut: true, isBlocked: true },
      orderBy: { code: "asc" },
    }),
  ]);

  // Sérialiser l'abonnement actif (Prisma Decimal → number, enums → cast)
  const abonnementSerialise = {
    ...abonnementActif,
    prixPaye: Number(abonnementActif.prixPaye),
    statut: abonnementActif.statut as unknown as import("@/types").StatutAbonnement,
    periode: abonnementActif.periode as unknown as import("@/types").PeriodeFacturation,
    plan: {
      ...abonnementActif.plan,
      typePlan: abonnementActif.plan.typePlan as unknown as import("@/types").TypePlan,
      prixMensuel: abonnementActif.plan.prixMensuel != null
        ? Number(abonnementActif.plan.prixMensuel)
        : null,
      prixTrimestriel: abonnementActif.plan.prixTrimestriel != null
        ? Number(abonnementActif.plan.prixTrimestriel)
        : null,
      prixAnnuel: abonnementActif.plan.prixAnnuel != null
        ? Number(abonnementActif.plan.prixAnnuel)
        : null,
    },
  } as import("@/types").AbonnementWithPlan;

  return (
    <div className="min-h-screen bg-background">
      <Header title="Changer de plan" />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Link
          href="/mon-abonnement"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          ← Retour a mon abonnement
        </Link>
        <ChangerPlanClient
          abonnement={abonnementSerialise}
          plans={plans}
          siteId={session.activeSiteId}
          soldeCreditActuel={soldeCreditActuel}
          bacs={bacs}
          vagues={vagues.map((v) => ({
            id: v.id,
            nom: v.code,
            statut: v.statut as string,
            isBlocked: v.isBlocked,
          }))}
        />
      </main>
    </div>
  );
}
