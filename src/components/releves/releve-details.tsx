"use client";

import { memo } from "react";
import { useTranslations } from "next-intl";
import { TypeReleve } from "@/types";
import type { Releve } from "@/types";

/**
 * Affiche le detail d'un releve selon son type.
 * Composant extrait de releves-list.tsx pour etre partage avec releves-global-list.tsx.
 */
export const ReleveDetails = memo(function ReleveDetails({ releve }: { releve: Releve }) {
  const t = useTranslations("releves");
  const type = releve.typeReleve as TypeReleve;

  switch (type) {
    case TypeReleve.BIOMETRIE:
      return (
        <div className="text-sm text-muted-foreground">
          {t("details.poids", { value: releve.poidsMoyen ?? 0 })}
          {releve.tailleMoyenne != null ? ` | ${t("details.taille", { value: releve.tailleMoyenne })}` : ""}
          {" | "}
          {t("details.ech", { count: releve.echantillonCount ?? 0 })}
        </div>
      );
    case TypeReleve.MORTALITE:
      return (
        <div className="text-sm text-muted-foreground">
          {(releve.nombreMorts ?? 0) > 1
            ? t("details.morts", { count: releve.nombreMorts ?? 0 })
            : t("details.mort", { count: releve.nombreMorts ?? 0 })}
          {" — "}
          {releve.causeMortalite}
        </div>
      );
    case TypeReleve.ALIMENTATION:
      return (
        <div className="text-sm text-muted-foreground">
          {releve.quantiteAliment}kg ({releve.typeAliment}) |{" "}
          {t("details.xParJour", { count: releve.frequenceAliment ?? 0 })}
        </div>
      );
    case TypeReleve.QUALITE_EAU:
      return (
        <div className="text-sm text-muted-foreground">
          {releve.temperature != null && `T: ${releve.temperature}°C `}
          {releve.ph != null && `pH: ${releve.ph} `}
          {releve.oxygene != null && `O₂: ${releve.oxygene}mg/L `}
          {releve.ammoniac != null && `NH₃: ${releve.ammoniac}mg/L`}
        </div>
      );
    case TypeReleve.COMPTAGE:
      return (
        <div className="text-sm text-muted-foreground">
          {t("details.poissons", { count: releve.nombreCompte ?? 0 })} ({releve.methodeComptage})
        </div>
      );
    case TypeReleve.OBSERVATION:
      return (
        <div className="text-sm text-muted-foreground">{releve.description}</div>
      );
    case TypeReleve.RENOUVELLEMENT: {
      const passages = releve.nombreRenouvellements ?? 1;
      const pct = releve.pourcentageRenouvellement;
      const vol = releve.volumeRenouvele;

      if (pct != null && passages > 1) {
        const totalPct = Math.round(pct * passages * 10) / 10;
        const totalVol = vol != null ? Math.round(vol * passages) : null;
        return (
          <div className="text-sm text-muted-foreground">
            {pct}% × {passages} = {totalPct}%
            {totalVol != null ? ` (${totalVol} L)` : ""}
          </div>
        );
      }
      if (pct != null) {
        return (
          <div className="text-sm text-muted-foreground">
            {pct}%{vol != null ? ` (${vol} L)` : ""}
          </div>
        );
      }
      if (vol != null && passages > 1) {
        return (
          <div className="text-sm text-muted-foreground">
            {vol} L × {passages} = {Math.round(vol * passages)} L
          </div>
        );
      }
      if (vol != null) {
        return <div className="text-sm text-muted-foreground">{vol} L</div>;
      }
      return (
        <div className="text-sm text-muted-foreground">{t("details.renouvellement")}</div>
      );
    }
  }
});
