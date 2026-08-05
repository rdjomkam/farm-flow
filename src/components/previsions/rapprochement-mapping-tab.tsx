"use client";

/**
 * src/components/previsions/rapprochement-mapping-tab.tsx
 *
 * 5e sous-onglet de `rapprochement-tab.tsx` (Sprint PR3-bis, decision
 * d'emplacement de la pre-analyse section 2) : ecran d'administration du
 * `MappingRapprochement` du site — voir les categories reelles non
 * mappees, en creer un mapping, consulter/modifier le mapping actif.
 *
 * Contrairement aux 4 autres vues de `rapprochement-tab.tsx`, cette vue NE
 * DEPEND D'AUCUN mois selectionne (`MappingRapprochement` est site-scope,
 * pas mensuel) — elle charge ses propres donnees cote client au montage
 * (`GET /api/previsions/mapping-rapprochement` + `.../non-mappees`),
 * jamais via les props pre-calculees de `RapprochementScenarioDTO`.
 *
 * PORTEE (pre-analyse section 2, prerequis de livraison, pas un detail
 * cosmetique) : le mapping s'applique a TOUT LE SITE, pas seulement au
 * scenario actuellement affiche — le bandeau ci-dessous le dit
 * explicitement, TOUJOURS visible, meme si les listes sont vides.
 *
 * CORRECTIF C6 (verification navigateur, sprint PR3-bis-bis) : chaque ligne
 * du mapping actif n'affichait que le TYPE de cible (badge identique pour
 * deux postes differents) — charge desormais aussi `postes`/`aliments` du
 * scenario affiche (meme source que `MappingFormDialog`) pour resoudre et
 * afficher le LIBELLE precis de la cible a cote du badge de type. Cible
 * introuvable dans ce scenario (RISQUE R1) => libelle explicite dedie via
 * `libelleCible`, jamais un id brut, jamais un vide silencieux.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Info, Loader2, Pencil, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Permission, CibleRapprochement } from "@/types";
import type { MappingRapprochement } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { MappingFormDialog } from "@/components/previsions/mapping-form-dialog";
import { libelleCible, libelleSourceCle, libelleSourceType } from "@/components/previsions/mapping-rapprochement-helpers";
import type { CategorieReelleNonMappee } from "@/lib/queries/previsions-rapprochement-mapping";
import type { PostePrevisionDTO, AlimentPrevisionDTO } from "@/components/previsions/api-types";

interface RapprochementMappingTabProps {
  scenarioId: string;
  scenarioNom: string;
  permissions: Permission[];
}

export function RapprochementMappingTab({ scenarioId, scenarioNom, permissions }: RapprochementMappingTabProps) {
  const t = useTranslations("previsions");
  const tStock = useTranslations("stock");
  const tDepenses = useTranslations("depenses");
  const { get } = usePrevisionsApi();
  const peutParametrer = permissions.includes(Permission.PREVISIONS_PARAMETRER);

  const [nonMappees, setNonMappees] = useState<CategorieReelleNonMappee[]>([]);
  const [mappingActif, setMappingActif] = useState<MappingRapprochement[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [postes, setPostes] = useState<PostePrevisionDTO[]>([]);
  const [aliments, setAliments] = useState<AlimentPrevisionDTO[]>([]);
  // CORRECTIF D2 (contre-review PR3-bis) : `postes`/`aliments` peuvent
  // echouer SEULS (le `Promise.all` ci-dessous ne declenche l'erreur
  // globale que si `nonMappees`/`mappingActif` echouent — voulu, l'ecran
  // reste utilisable). Ce flag distingue "cible introuvable dans ce
  // scenario" (donnees chargees, id absent) de "cibles non chargees"
  // (echec reseau isole) — voir `libelleCible`.
  const [ciblesChargees, setCiblesChargees] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [nonMappeesResult, mappingResult, postesResult, alimentsResult] = await Promise.all([
      get<{ data: CategorieReelleNonMappee[] }>("/api/previsions/mapping-rapprochement/non-mappees", {
        silentError: true,
      }),
      get<{ data: MappingRapprochement[]; version: number | null }>("/api/previsions/mapping-rapprochement", {
        silentError: true,
      }),
      get<{ data: PostePrevisionDTO[] }>(`/api/previsions/scenarios/${scenarioId}/postes`, {
        silentError: true,
      }),
      get<{ data: AlimentPrevisionDTO[] }>(`/api/previsions/scenarios/${scenarioId}/aliments`, {
        silentError: true,
      }),
    ]);
    if (nonMappeesResult.ok && nonMappeesResult.data) {
      setNonMappees(nonMappeesResult.data.data ?? []);
    }
    if (mappingResult.ok && mappingResult.data) {
      setMappingActif(mappingResult.data.data ?? []);
      setVersion(mappingResult.data.version ?? null);
    }
    if (postesResult.ok && postesResult.data) setPostes(postesResult.data.data ?? []);
    if (alimentsResult.ok && alimentsResult.data) setAliments(alimentsResult.data.data ?? []);
    setCiblesChargees(postesResult.ok && alimentsResult.ok);
    if (!nonMappeesResult.ok || !mappingResult.ok) {
      setError(t("rapprochementTab.mapping.loadError"));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Le POST renvoie le mapping actif COMPLET de la nouvelle version — on le
   * pose directement (jamais un recalcul local), puis on rafraichit
   * `nonMappees` depuis le serveur (source de verite unique, evite toute
   * derive entre l'etat local et la realite des donnees du site).
   */
  function handleSaved(nouveauMappingActif: MappingRapprochement[]) {
    setMappingActif(nouveauMappingActif);
    setVersion(nouveauMappingActif[0]?.version ?? version);
    fetchAll();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{t("rapprochementTab.mapping.scopeBanner", { scenario: scenarioNom })}</p>
      </div>

      {loading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
        </div>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("rapprochementTab.mapping.nonMappees.title")}</CardTitle>
              <p className="text-xs text-muted-foreground">{t("rapprochementTab.mapping.nonMappees.description")}</p>
            </CardHeader>
            <CardContent>
              {nonMappees.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("rapprochementTab.mapping.nonMappees.empty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {nonMappees.map((c) => (
                    <div
                      key={`${c.sourceType}::${c.sourceCle}`}
                      className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {libelleSourceType(c.sourceType, t)}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {libelleSourceCle(c.sourceType, c.sourceCle, { tDepenses, tStock, tPrevisions: t })}
                        </span>
                      </div>
                      {peutParametrer && (
                        <MappingFormDialog
                          scenarioId={scenarioId}
                          scenarioNom={scenarioNom}
                          source={{ sourceType: c.sourceType, sourceCle: c.sourceCle }}
                          onSaved={handleSaved}
                          trigger={
                            <Button size="sm" variant="outline" className="self-start sm:self-auto">
                              <Plus className="h-4 w-4" aria-hidden="true" />
                              {t("rapprochementTab.mapping.nonMappees.mapButton")}
                            </Button>
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("rapprochementTab.mapping.mappingActif.title")}</CardTitle>
              {version !== null && (
                <p className="text-xs text-muted-foreground">
                  {t("rapprochementTab.mapping.mappingActif.description", { version })}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {mappingActif.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("rapprochementTab.mapping.mappingActif.empty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {mappingActif.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {libelleSourceType(m.sourceType, t)}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {libelleSourceCle(m.sourceType, m.sourceCle, { tDepenses, tStock, tPrevisions: t })}
                        </span>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant={m.cibleType === CibleRapprochement.NON_RAPPROCHE ? "default" : "info"} className="w-fit">
                            {t(`rapprochementTab.mapping.cibleTypes.${m.cibleType}`)}
                          </Badge>
                          {(() => {
                            const libelle = libelleCible(m.cibleType, m.cibleId, { postes, aliments }, { tPrevisions: t, tStock }, ciblesChargees);
                            return libelle ? (
                              <span className="text-xs font-medium text-foreground">{libelle}</span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      {peutParametrer && (
                        <MappingFormDialog
                          scenarioId={scenarioId}
                          scenarioNom={scenarioNom}
                          source={{ sourceType: m.sourceType, sourceCle: m.sourceCle }}
                          existant={{ cibleType: m.cibleType, cibleId: m.cibleId }}
                          onSaved={handleSaved}
                          trigger={
                            <Button size="sm" variant="outline" className="self-start sm:self-auto">
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                              {t("rapprochementTab.mapping.mappingActif.editButton")}
                            </Button>
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
