"use client";

/**
 * FabReleve — Floating Action Button pour créer un relevé rapide.
 *
 * Comportement :
 * 1. Si pas de site actif (activeSiteId null) → toast "Selectionnez un site d'abord"
 * 2. Si site actif mais aucune vague EN_COURS → toast "Aucune vague active sur ce site"
 * 3. Si vague trouvée → redirect vers /releves/nouveau?vagueId=[id]
 *
 * La dernière vague utilisée est mémorisée en localStorage (lastVagueId)
 * pour éviter un appel API supplémentaire au prochain clic.
 *
 * Sprint ID — Story ID.2
 * R6 : CSS variables du thème
 * Mobile-first : touch target 56px+
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { StatutVague } from "@/types";

const LAST_VAGUE_KEY = "lastVagueId";

interface FabReleveProps {
  /** ID du site actif dans la session (null = mode hub multi-fermes) */
  activeSiteId: string | null;
  className?: string;
}

export function FabReleve({ activeSiteId, className }: FabReleveProps) {
  const t = useTranslations("layout");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    // Cas 1 : pas de site sélectionné (mode hub multi-fermes)
    if (!activeSiteId) {
      toast({
        title: t("fab.toasts.selectionnezSite.title"),
        description: t("fab.toasts.selectionnezSite.description"),
        variant: "info",
      });
      return;
    }

    setLoading(true);

    try {
      // Tenter de lire la dernière vague depuis localStorage
      const lastVagueId =
        typeof window !== "undefined"
          ? window.localStorage.getItem(LAST_VAGUE_KEY)
          : null;

      if (lastVagueId) {
        // Vérifier que cette vague est toujours EN_COURS
        const res = await fetch(`/api/vagues/${lastVagueId}`);
        if (res.ok) {
          const data = await res.json() as {
            vague?: { id: string; statut: string };
          };
          if (data.vague?.statut === StatutVague.EN_COURS) {
            router.push(`/releves/nouveau?vagueId=${lastVagueId}`);
            return;
          }
        }
        // Vague expirée ou introuvable — on efface le cache
        window.localStorage.removeItem(LAST_VAGUE_KEY);
      }

      // Appel API pour trouver la première vague EN_COURS du site actif (session)
      const res = await fetch("/api/vagues?statut=EN_COURS");
      if (!res.ok) throw new Error(tCommon("errors.networkError"));

      const data = await res.json() as { data?: Array<{ id: string }> };
      const vagues = data.data ?? [];

      if (vagues.length === 0) {
        toast({
          title: t("fab.toasts.aucuneVague.title"),
          description: t("fab.toasts.aucuneVague.description"),
          variant: "info",
        });
        return;
      }

      const vagueId = vagues[0].id;

      // Mémoriser pour la prochaine fois
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LAST_VAGUE_KEY, vagueId);
      }

      router.push(`/releves/nouveau?vagueId=${vagueId}`);
    } catch {
      toast({
        title: t("fab.toasts.erreur.title"),
        description: t("fab.toasts.erreur.description"),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [activeSiteId, router, t, toast]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label={t("fab.ariaLabel")}
      className={cn(
        // Taille : 56px+ pour touch target mobile
        "flex h-14 w-14 items-center justify-center rounded-full shadow-lg",
        // Couleur : primary gradient via CSS variable
        "bg-primary text-primary-foreground",
        // États
        "transition-all hover:opacity-90 active:scale-95",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100",
        // Élévation au-dessus de la nav bar
        "-translate-y-3",
        className
      )}
    >
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
      ) : (
        <Plus className="h-7 w-7" strokeWidth={2.5} />
      )}
    </button>
  );
}
