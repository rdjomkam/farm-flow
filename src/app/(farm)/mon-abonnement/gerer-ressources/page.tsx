/**
 * src/app/(farm)/mon-abonnement/gerer-ressources/page.tsx
 *
 * Page de gestion des ressources bloquées (après downgrade).
 * Permet de voir quelles ressources ont été bloquées et de les débloquer/supprimer.
 * Server Component.
 *
 * Story 50.4 — Sprint 50
 * R8 : siteId obligatoire
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { Permission } from "@/types";
import { prisma } from "@/lib/db";
import { GererRessourcesClient } from "@/components/abonnements/gerer-ressources-client";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("abonnements");
  return {
    title: t("gererRessources.pageTitle"),
  };
}

export const dynamic = "force-dynamic";

export default async function GererRessourcesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ABONNEMENTS_GERER);
  if (!permissions) redirect("/mon-abonnement");

  const t = await getTranslations("abonnements");

  // Charger les ressources bloquées du site
  const [bacsBloqués, vaguesBloquées] = await Promise.all([
    prisma.bac.findMany({
      where: { siteId: session.activeSiteId, isBlocked: true },
      select: { id: true, nom: true, createdAt: true },
      orderBy: { nom: "asc" },
    }),
    prisma.vague.findMany({
      where: { siteId: session.activeSiteId, isBlocked: true },
      select: { id: true, code: true, statut: true, createdAt: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const nbBloques = bacsBloqués.length + vaguesBloquées.length;

  return (
    <div className="min-h-screen bg-background">
      <Header title={t("gererRessources.blockedResources")} />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Link
          href="/mon-abonnement"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          {t("gererRessources.backToSubscription")}
        </Link>
        {nbBloques === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="font-medium text-foreground mb-1">{t("gererRessources.noBlockedResources")}</p>
            <p className="text-sm text-muted-foreground">
              {t("gererRessources.allResourcesActive")}
            </p>
          </div>
        ) : (
          <GererRessourcesClient
            siteId={session.activeSiteId}
            bacs={bacsBloqués.map((b) => ({
              id: b.id,
              nom: b.nom,
              blockedAt: b.createdAt,
            }))}
            vagues={vaguesBloquées.map((v) => ({
              id: v.id,
              nom: v.code,
              statut: v.statut as string,
              blockedAt: v.createdAt,
            }))}
          />
        )}
      </main>
    </div>
  );
}
