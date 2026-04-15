import { getTranslations } from "next-intl/server";
import { TypeSystemeBac } from "@/types";
import { getStatutDensite, type StatutDensite } from "@/lib/density-thresholds";

interface BacDensiteBadgeProps {
  densiteKgM3: number | null;
  typeSysteme: TypeSystemeBac | null;
  /** Seuils (alerte et critique) pour le type de systeme courant */
  seuilAlerte?: number;
  seuilCritique?: number;
  /** Taille du texte — sm (defaut) ou xs */
  size?: "sm" | "xs";
}

const STATUT_STYLES: Record<StatutDensite, { bg: string; text: string }> = {
  OK: {
    bg: "bg-accent-green-muted",
    text: "text-accent-green",
  },
  ALERTE: {
    bg: "bg-accent-amber-muted",
    text: "text-accent-amber",
  },
  CRITIQUE: {
    bg: "bg-accent-red-muted",
    text: "text-accent-red",
  },
  INCONNU: {
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
};

/**
 * Badge coloré affichant la densité d'un bac.
 *
 * Couleurs :
 * - Vert (OK) : densite sous le seuil d'alerte
 * - Orange (ALERTE) : densite entre alerte et critique
 * - Rouge (CRITIQUE) : densite au-dessus du seuil critique
 * - Gris (INCONNU) : densite non calculable (volume ou biometrie manquante)
 *
 * Mobile-first — badge compact adapte aux cartes de bac.
 */
export async function BacDensiteBadge({
  densiteKgM3,
  typeSysteme,
  seuilAlerte,
  seuilCritique,
  size = "sm",
}: BacDensiteBadgeProps) {
  const t = await getTranslations("bacs.densite");
  // Construire une config partielle si des seuils explicites sont passes
  const configOverride =
    seuilAlerte != null || seuilCritique != null
      ? {
          densiteBacBetonAlerte: seuilAlerte,
          densiteBacBetonCritique: seuilCritique,
          densiteEtangAlerte: seuilAlerte,
          densiteEtangCritique: seuilCritique,
          densiteRasAlerte: seuilAlerte,
          densiteRasCritique: seuilCritique,
        }
      : undefined;

  const statut = getStatutDensite(densiteKgM3, typeSysteme, configOverride);
  const styles = STATUT_STYLES[statut];

  const textSize = size === "xs" ? "text-xs" : "text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${textSize} ${styles.bg} ${styles.text}`}
      title={
        densiteKgM3 != null
          ? t("titleTooltip", { value: densiteKgM3.toFixed(1) })
          : t("nonCalculable")
      }
    >
      {densiteKgM3 != null ? (
        <>
          <span>{densiteKgM3.toFixed(1)}</span>
          <span className="opacity-70">kg/m³</span>
        </>
      ) : (
        <span>{t(statut)}</span>
      )}
    </span>
  );
}
