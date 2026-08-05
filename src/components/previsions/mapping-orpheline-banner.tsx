"use client";

/**
 * src/components/previsions/mapping-orpheline-banner.tsx
 *
 * Bandeau PARTAGE, affiche au niveau de `scenario-detail-client.tsx` (ADR-053
 * §16.7, story A.4) — resume le nombre de cibles `MappingRapprochement`
 * orphelines actives pour le SITE de ce scenario, quel que soit l'onglet
 * ouvert.
 *
 * POURQUOI CE BANDEAU EXISTE (ERR-179/ERR-180) : le filet de detection
 * (`cibleOrpheline`, `detecterCiblesOrphelinesDuMappingActif`) n'etait
 * jusqu'ici visible que dans l'onglet Rapprochement -> sous-onglet Mapping
 * (`rapprochement-mapping-tab.tsx`) — un montant reel accumule sous une
 * cible orpheline disparaissait silencieusement des 4 AUTRES sous-onglets
 * de rapprochement (mensuel, cumule, par vague, top ecarts, tresorerie)
 * sans qu'aucun signal ne le rende visible pour un utilisateur qui ne
 * visite jamais l'onglet d'administration. ERR-180 documente precisement
 * ce risque comme "connu mais documente seulement en commentaire de code" —
 * ce composant est la reponse structurelle : UN SEUL bandeau, au niveau du
 * client de detail (jamais reproduit ligne par ligne dans chaque
 * sous-onglet, §16.7 derniere clause).
 *
 * ADR-053 §16 (story A.4) reduit deja la portee de ce risque pour
 * POSTE_PREVISION (le mapping resout desormais par `PosteReferentiel.id`,
 * un id SITE-scope, jamais casse par un renommage ou la suppression d'un
 * scenario) — mais ne l'elimine pas totalement : la resolution dynamique
 * peut toujours echouer si AUCUN `PostePrevision`/`AlimentPrevision` du
 * scenario COURANT ne correspond a la cible referentiel (cas legitime : ce
 * scenario ne budgetise pas ce poste). Ce bandeau reste donc pertinent
 * apres cette story, pour les deux types de cible.
 *
 * Reutilise la MEME detection deja exposee par la route existante
 * (`GET /api/previsions/mapping-rapprochement?scenarioId=...`,
 * `detecterCiblesOrphelines`) — aucune nouvelle logique de detection,
 * uniquement un resume compte au niveau du scenario affiche.
 *
 * Echec de chargement (reseau) : n'affiche RIEN de trompeur — ni "0 cible
 * orpheline" (faux negatif silencieux, exactement la classe de defaut
 * qu'ERR-171/ERR-179 interdisent), ni le bandeau d'alerte lui-meme (aucune
 * donnee fiable a annoncer). `erreurChargement` est un etat NOMME distinct,
 * affiche separement, jamais confondu avec "aucune cible orpheline".
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import type { MappingRapprochementAvecOrphelinite } from "@/components/previsions/mapping-rapprochement-helpers";

interface MappingOrphelineBannerProps {
  scenarioId: string;
}

export function MappingOrphelineBanner({ scenarioId }: MappingOrphelineBannerProps) {
  const t = useTranslations("previsions");
  const { get } = usePrevisionsApi();

  const [nombreOrphelines, setNombreOrphelines] = useState<number | null>(null);
  const [erreurChargement, setErreurChargement] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNombreOrphelines(null);
    setErreurChargement(false);
    (async () => {
      const result = await get<{ data: MappingRapprochementAvecOrphelinite[] }>(
        `/api/previsions/mapping-rapprochement?scenarioId=${encodeURIComponent(scenarioId)}`,
        { silentError: true, silentLoading: true }
      );
      if (cancelled) return;
      // Garde defensive `result?.` : les tests unitaires qui mockent
      // `usePrevisionsApi` sans mocker explicitement `get` (ce composant
      // n'etant pas leur objet de test) renvoient `undefined` par defaut —
      // jamais confondu avec un vrai echec reseau (`erreurChargement`
      // resterait `false` dans ce cas, silencieusement, ce qui est correct :
      // ce composant n'a rien a signaler pour un contexte qui ne l'exerce
      // pas explicitement).
      if (result?.ok && result.data) {
        setNombreOrphelines(result.data.data.filter((l) => l.cibleOrpheline).length);
      } else if (result) {
        setErreurChargement(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get, scenarioId]);

  if (erreurChargement) {
    return (
      <div
        role="alert"
        className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-accent-amber-muted p-3 text-xs text-warning"
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{t("cibleOrphelineBanner.loadError")}</p>
      </div>
    );
  }

  if (!nombreOrphelines) return null;

  return (
    <div
      role="alert"
      className="mb-3 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>{t("cibleOrphelineBanner.message", { count: nombreOrphelines })}</p>
    </div>
  );
}
