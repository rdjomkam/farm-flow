"use client";

/**
 * src/components/previsions/rapprochement-non-rapproche.tsx
 *
 * Bac "Non rapproche" (ADR-053 section 5, story PR3.7) — TOUJOURS rendu,
 * meme vide : "le bac Non rapproche est VISIBLE, compte dans le total
 * reel, jamais silencieusement absent. S'il est vide, dis-le explicitement
 * plutot que de masquer la section". Reutilise `RapprochementLignesListe`
 * (memes colonnes) mais sans ligne "Total" propre — ces lignes sont deja
 * comptees dans les totaux du mois affiches par la vue mensuelle
 * (`totalMoisMonetaireParMois`/`totalMoisQuantiteParMois`, Sprint PR3-ter
 * story C.2, calcules par `agregerParMois` sur les lignes deja partitionnees
 * par nature — moteur pur, jamais resomme ici).
 */
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RapprochementLignesListe } from "@/components/previsions/rapprochement-lignes-liste";
import type { LigneRapprochementDTO } from "@/components/previsions/rapprochement-types";

export function RapprochementNonRapproche({ lignes }: { lignes: LigneRapprochementDTO[] }) {
  const t = useTranslations("previsions");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t("rapprochementTab.nonRapproche.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("rapprochementTab.nonRapproche.description")}</p>
      </CardHeader>
      <CardContent>
        <RapprochementLignesListe lignes={lignes} emptyLabel={t("rapprochementTab.nonRapproche.empty")} />
      </CardContent>
    </Card>
  );
}
