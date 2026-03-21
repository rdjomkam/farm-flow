/**
 * src/app/abonnement-expire/page.tsx
 *
 * Page affichée quand l'abonnement du site est EXPIRE ou SUSPENDU.
 * Le middleware redirige automatiquement vers cette page pour les statuts EXPIRE.
 * Pour SUSPENDU, l'utilisateur peut y accéder manuellement.
 *
 * Selon le statut :
 *   - EN_GRACE  : "Votre abonnement a expiré, vous avez encore N jours"
 *   - SUSPENDU  : "Votre compte est en mode lecture seule"
 *   - EXPIRE    : "Votre compte est suspendu"
 *   - null      : Message générique
 *
 * Story 36.3 — Sprint 36
 * R2 : enums importés depuis @/types
 * R6 : CSS variables du thème
 * Mobile first (360px)
 */
import { getServerSession } from "@/lib/auth/session";
import { getSubscriptionStatus } from "@/lib/abonnements/check-subscription";
import { StatutAbonnement } from "@/types";
import { prisma } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common.metadata");
  return { title: t("abonnementExpire") };
}

export default async function AbonnementExpirePage() {
  const t = await getTranslations("abonnements.expire");
  const session = await getServerSession();

  // Charger le statut d'abonnement si une session est présente
  let statut: StatutAbonnement | null = null;
  let daysRemaining: number | null = null;
  let lastPlanId: string | null = null;

  if (session?.activeSiteId) {
    const status = await getSubscriptionStatus(session.activeSiteId);
    statut = status.statut;
    daysRemaining = status.daysRemaining;

    // Récupérer le planId du dernier abonnement pour le lien de renouvellement
    const lastAbonnement = await prisma.abonnement.findFirst({
      where: { siteId: session.activeSiteId },
      orderBy: { createdAt: "desc" },
      select: { planId: true },
    });
    lastPlanId = lastAbonnement?.planId ?? null;
  }

  // Construire le message selon le statut
  // R2 : comparaison via StatutAbonnement.EN_GRACE, etc.
  const isEnGrace = (statut as string) === StatutAbonnement.EN_GRACE;
  const isSuspendu = (statut as string) === StatutAbonnement.SUSPENDU;
  const isExpire = (statut as string) === StatutAbonnement.EXPIRE;

  const renewalUrl = lastPlanId
    ? `/checkout?planId=${lastPlanId}&renouvellement=true`
    : "/tarifs";

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        {/* Icone */}
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "color-mix(in srgb, var(--destructive) 15%, transparent)" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8"
              style={{ color: "var(--destructive)" }}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>

        {/* Titre et message */}
        <div className="text-center mb-8">
          {isEnGrace ? (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-3">
                {t("graceTitle")}
              </h1>
              <p className="text-base text-muted-foreground">
                {t.rich("graceMessage", {
                  daysRemaining: daysRemaining ?? "?",
                  plural: daysRemaining !== 1 ? "s" : "",
                  days: (chunks) => (
                    <span className="font-semibold" style={{ color: "var(--warning, hsl(38 92% 50%))" }}>
                      {chunks}
                    </span>
                  ),
                })}
              </p>
            </>
          ) : isSuspendu ? (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-3">
                {t("suspendedTitle")}
              </h1>
              <p className="text-base text-muted-foreground">
                {t("suspendedMessage")}
              </p>
            </>
          ) : isExpire ? (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-3">
                {t("expiredTitle")}
              </h1>
              <p className="text-base text-muted-foreground">
                {t("expiredMessage")}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-3">
                {t("inactiveTitle")}
              </h1>
              <p className="text-base text-muted-foreground">
                {t("inactiveMessage")}
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {/* Bouton principal : Renouveler */}
          <Link
            href={renewalUrl}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-6 py-4 text-base font-semibold transition-opacity hover:opacity-90 active:opacity-80"
            style={{
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            {t("renewButton")}
          </Link>

          {/* Bouton secondaire : Voir les plans */}
          <Link
            href="/tarifs"
            className="w-full flex items-center justify-center gap-2 rounded-lg border px-6 py-4 text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="12" x2="15" y2="12" />
              <line x1="9" y1="15" x2="12" y2="15" />
            </svg>
            {t("viewPlansButton")}
          </Link>
        </div>

        {/* Contact support */}
        <div
          className="mt-8 rounded-lg p-4 text-sm"
          style={{
            backgroundColor: "var(--muted)",
            color: "var(--muted-foreground)",
          }}
        >
          <p className="font-medium text-foreground mb-1">{t("helpTitle")}</p>
          <p>
            {t.rich("helpMessage", {
              email: (chunks) => (
                <a
                  href="mailto:support@farmflow.cm"
                  className="underline underline-offset-2 hover:opacity-80"
                  style={{ color: "var(--primary)" }}
                >
                  {chunks}
                </a>
              ),
              phone: (chunks) => (
                <a
                  href="tel:+237600000000"
                  className="underline underline-offset-2 hover:opacity-80"
                  style={{ color: "var(--primary)" }}
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      </div>
    </main>
  );
}
