"use client";

/**
 * src/components/abonnements/gerer-ressources-client.tsx
 *
 * Composant client pour la gestion des ressources bloquées après un downgrade.
 * Affiche les bacs et vagues bloqués avec la possibilité de les débloquer.
 *
 * Story 50.4 — Sprint 50
 * R6 : CSS variables du thème
 * Mobile-first (360px)
 *
 * Note : le déblocage n'est disponible que si le quota du plan actuel le permet.
 * Pour débloquer, l'utilisateur doit upgrader son plan ou supprimer d'autres ressources.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Lock, Unlock, Loader2, AlertCircle, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BacBloque {
  id: string;
  nom: string;
  blockedAt: Date;
}

interface VagueBloquee {
  id: string;
  nom: string;
  statut: string;
  blockedAt: Date;
}

interface GererRessourcesClientProps {
  siteId: string;
  bacs: BacBloque[];
  vagues: VagueBloquee[];
}

// ---------------------------------------------------------------------------
// GererRessourcesClient
// ---------------------------------------------------------------------------

export function GererRessourcesClient({
  siteId,
  bacs,
  vagues,
}: GererRessourcesClientProps) {
  const router = useRouter();
  const t = useTranslations("abonnements");
  const locale = useLocale();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDebloquer = async (type: "bac" | "vague", id: string) => {
    setLoading(id);
    setError(null);

    try {
      const endpoint = type === "bac" ? `/api/bacs/${id}` : `/api/vagues/${id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: false }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.message?.includes("quota") || data.code === "QUOTA_DEPASSE") {
          throw new Error(t("gererRessources.quotaReached"));
        }
        throw new Error(data.message ?? t("gererRessources.unlockError"));
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.unknownError"));
    } finally {
      setLoading(null);
    }
  };

  const nbBloques = bacs.length + vagues.length;

  return (
    <div className="space-y-5">
      {/* En-tête informatif */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {nbBloques > 1
                ? t("gererRessources.blockedCountPlural", { count: nbBloques })
                : t("gererRessources.blockedCount", { count: nbBloques })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("gererRessources.blockedExplanation")}
            </p>
          </div>
        </div>
      </div>

      {/* Bouton d'upgrade */}
      <Link href="/mon-abonnement/changer-plan">
        <Button variant="outline" className="w-full min-h-[44px]">
          <ArrowUp className="mr-2 h-4 w-4" />
          {t("gererRessources.upgradeToUnlock")}
        </Button>
      </Link>

      {/* Erreur globale */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section Bacs bloqués */}
      {bacs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("gererRessources.blockedTanksTitle", { count: bacs.length })}
          </h2>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {bacs.map((bac) => (
              <div key={bac.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {bac.nom}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("gererRessources.blockedOn", {
                        date: bac.blockedAt.toLocaleDateString(locale),
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDebloquer("bac", bac.id)}
                  disabled={loading === bac.id}
                  className="shrink-0 min-h-[36px] text-primary hover:text-primary"
                >
                  {loading === bac.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Unlock className="mr-1 h-3.5 w-3.5" />
                      {t("gererRessources.unlock")}
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section Vagues bloquées */}
      {vagues.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("gererRessources.blockedWavesTitle", { count: vagues.length })}
          </h2>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {vagues.map((vague) => (
              <div key={vague.id} className="flex items-center justify-between px-4 py-3 gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {vague.nom}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("gererRessources.waveBlockedStatus", {
                        statut: vague.statut,
                        date: vague.blockedAt.toLocaleDateString(locale),
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDebloquer("vague", vague.id)}
                  disabled={loading === vague.id}
                  className="shrink-0 min-h-[36px] text-primary hover:text-primary"
                >
                  {loading === vague.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Unlock className="mr-1 h-3.5 w-3.5" />
                      {t("gererRessources.unlock")}
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
