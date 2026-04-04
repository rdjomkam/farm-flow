/**
 * src/app/mon-abonnement/renouveler/page.tsx
 *
 * Redirection vers le checkout pour le renouvellement de l'abonnement actif.
 * Server Component.
 *
 * Story 33.3 — Sprint 33
 */
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import { getAbonnementActifPourSite } from "@/lib/queries/abonnements";

export default async function RenouvelerPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const abonnement = await getAbonnementActifPourSite(session.activeSiteId);

  if (!abonnement) {
    redirect("/tarifs");
  }

  redirect(`/checkout?planId=${abonnement.planId}&renouvellement=true`);
}
