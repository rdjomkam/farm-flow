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
 *
 * Sprint PR3-ter, story A.2 : le `GET` du mapping actif porte desormais
 * `?scenarioId=` — chaque ligne renvoyee est augmentee de `cibleOrpheline`
 * (filet de securite NON NEGOCIABLE, story A.1/A.3 : un mapping dont la
 * cible resolue n'existe PAS dans le scenario COURANT doit se voir, jamais
 * s'evaporer dans un total silencieux). DISTINCT de `libelleCible`
 * ("cibleIntrouvable"/"cibleNonChargee", qui distinguent une absence reelle
 * d'un simple echec de chargement du FORMULAIRE d'edition, ERR-177/ERR-178)
 * et DISTINCT de `NON_RAPPROCHE` (ERR-173 : une source reelle sans AUCUN
 * mapping actif) — un mapping ORPHELIN existe bel et bien, mais sa cible
 * resolue est morte.
 *
 * ADR-053 §16, story A.4 : `postes` charge desormais `GET
 * /api/previsions/postes-referentiel` (SITE-scope) au lieu de `GET
 * /scenarios/[id]/postes` (SCENARIO-scope) — `cibleId` d'un mapping
 * `POSTE_PREVISION` porte desormais un `PosteReferentiel.id`, le meme scope
 * que la liste chargee ici (fini le defaut ERR-179 ou une cible resolue
 * dans un AUTRE scenario que celui affiche etait a tort signalee
 * "introuvable"). `libelleCible` (helpers) compare toujours `p.id ===
 * cibleId`, inchange — seule la SOURCE de la liste `postes` change.
 *
 * Sprint PR3-ter, story C.3 : `GET ?version=N` existait deja (Sprint PR3,
 * story PR3.6) mais restait totalement INUTILISE — cet ecran n'affichait
 * QUE la version active, jamais l'historique (ERR-174 : une route livree,
 * testee, jamais consommee). Ajoute un selecteur de version
 * (`versionsDisponibles`, `GET .../versions`) : la version ACTIVE (la plus
 * recente) reste PLEINEMENT editable (creation/modification, memes
 * controles qu'avant cette story) ; toute version PASSEE selectionnee
 * s'affiche en LECTURE SEULE STRICTE (ADR-053 §6.2 : « changer un mapping
 * ne doit pas reecrire l'historique des ecarts figes » — un ecran qui
 * permettrait de modifier une version passee violerait cette garantie a la
 * racine) : aucun bouton d'edition, aucune carte "categories non mappees"
 * (creer un mapping cree TOUJOURS une nouvelle version active, ce qui
 * n'aurait aucun sens pendant qu'on consulte une version figee). Un bandeau
 * dedie indique explicitement quelle version est consultee et si elle est
 * active ou non — jamais une ambiguite silencieuse entre "je regarde
 * l'etat actuel" et "je regarde un instantane passe".
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, ExternalLink, History, Info, Loader2, Pencil, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Permission, CibleRapprochement } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { MappingFormDialog } from "@/components/previsions/mapping-form-dialog";
import {
  libelleCible,
  libelleSourceCle,
  libelleSourceType,
  type MappingRapprochementAvecOrphelinite,
} from "@/components/previsions/mapping-rapprochement-helpers";
import type { CategorieReelleNonMappee } from "@/lib/queries/previsions-rapprochement-mapping";
import type { PosteReferentielOptionDTO, AlimentPrevisionDTO } from "@/components/previsions/api-types";

/** Valeur sentinelle du `Select` pour "version active" — distincte de toute valeur numerique reelle. */
const VERSION_ACTIVE_SENTINEL = "actif";

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
  const [mappingAffiche, setMappingAffiche] = useState<MappingRapprochementAvecOrphelinite[]>([]);
  const [version, setVersion] = useState<number | null>(null);
  const [postes, setPostes] = useState<PosteReferentielOptionDTO[]>([]);
  const [aliments, setAliments] = useState<AlimentPrevisionDTO[]>([]);
  // CORRECTIF D2 (contre-review PR3-bis) : `postes`/`aliments` peuvent
  // echouer SEULS (le `Promise.all` ci-dessous ne declenche l'erreur
  // globale que si `nonMappees`/`mappingAffiche` echouent — voulu, l'ecran
  // reste utilisable). Ce flag distingue "cible introuvable dans ce
  // scenario" (donnees chargees, id absent) de "cibles non chargees"
  // (echec reseau isole) — voir `libelleCible`.
  const [ciblesChargees, setCiblesChargees] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Story C.3 (PR3-ter) : `null` = "version active" (editable, comportement
  // IDENTIQUE a avant cette story) ; un nombre = version PASSEE selectionnee
  // (lecture seule stricte, ADR-053 §6.2). `versionsDisponibles` (triees
  // decroissant, la premiere est TOUJOURS la version active — `version`
  // n'augmente jamais que par increment de 1 a chaque `creerVersionMapping`,
  // jamais reassignee a une valeur plus ancienne).
  const [versionsDisponibles, setVersionsDisponibles] = useState<number[]>([]);
  const [versionSelectionnee, setVersionSelectionnee] = useState<number | null>(null);
  const versionActive = versionsDisponibles[0] ?? null;
  const consultationHistorique = versionSelectionnee !== null && versionSelectionnee !== versionActive;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const urlMapping =
      versionSelectionnee === null
        ? `/api/previsions/mapping-rapprochement?scenarioId=${encodeURIComponent(scenarioId)}`
        : `/api/previsions/mapping-rapprochement?scenarioId=${encodeURIComponent(scenarioId)}&version=${versionSelectionnee}`;
    const [nonMappeesResult, mappingResult, postesResult, alimentsResult, versionsResult] = await Promise.all([
      get<{ data: CategorieReelleNonMappee[] }>("/api/previsions/mapping-rapprochement/non-mappees", {
        silentError: true,
      }),
      get<{ data: MappingRapprochementAvecOrphelinite[]; version: number | null }>(urlMapping, {
        silentError: true,
      }),
      get<{ data: PosteReferentielOptionDTO[] }>(`/api/previsions/postes-referentiel`, {
        silentError: true,
      }),
      get<{ data: AlimentPrevisionDTO[] }>(`/api/previsions/scenarios/${scenarioId}/aliments`, {
        silentError: true,
      }),
      get<{ data: number[] }>("/api/previsions/mapping-rapprochement/versions", { silentError: true }),
    ]);
    if (nonMappeesResult.ok && nonMappeesResult.data) {
      setNonMappees(nonMappeesResult.data.data ?? []);
    }
    if (mappingResult.ok && mappingResult.data) {
      setMappingAffiche(mappingResult.data.data ?? []);
      setVersion(mappingResult.data.version ?? null);
    }
    if (postesResult.ok && postesResult.data) setPostes(postesResult.data.data ?? []);
    if (alimentsResult.ok && alimentsResult.data) setAliments(alimentsResult.data.data ?? []);
    if (versionsResult.ok && versionsResult.data) setVersionsDisponibles(versionsResult.data.data ?? []);
    setCiblesChargees(postesResult.ok && alimentsResult.ok);
    if (!nonMappeesResult.ok || !mappingResult.ok) {
      setError(t("rapprochementTab.mapping.loadError"));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, versionSelectionnee]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /**
   * Le POST renvoie le mapping actif COMPLET de la nouvelle version, MAIS
   * SANS l'augmentation `cibleOrpheline` (route POST, jamais `?scenarioId=`)
   * — on le pose quand meme directement le temps du rafraichissement
   * (jamais de recalcul local de l'orphelinite, qui serait une
   * reimplementation cote UI, ERR-171), puis `fetchAll()` (source de verite
   * unique) restaure l'augmentation correcte depuis le serveur.
   *
   * Story C.3 : un enregistrement cree TOUJOURS une nouvelle version ACTIVE
   * — `versionSelectionnee` est explicitement remis a `null` (revient sur la
   * version active), jamais laisse pointer sur une version desormais
   * depassee par la creation.
   */
  function handleSaved(nouveauMappingActif: MappingRapprochementAvecOrphelinite[]) {
    setMappingAffiche(nouveauMappingActif);
    setVersion(nouveauMappingActif[0]?.version ?? version);
    setVersionSelectionnee(null);
    fetchAll();
  }

  const optionsVersion = useMemo(
    () =>
      versionsDisponibles.map((v) => ({
        value: String(v),
        estActive: v === versionActive,
      })),
    [versionsDisponibles, versionActive]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{t("rapprochementTab.mapping.scopeBanner", { scenario: scenarioNom })}</p>
      </div>

      {peutParametrer && (
        <Link
          href="/previsions/postes-referentiel"
          className="inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
        >
          {t("rapprochementTab.mapping.gererReferentielLink")}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}

      {/* Story C.3 (PR3-ter) : selecteur de version — toujours visible des qu'au
          moins une version existe, meme pendant le chargement d'une nouvelle
          selection (jamais masque, pour ne pas faire disparaitre le controle
          sous les yeux de l'utilisateur qui vient de l'utiliser). */}
      {versionsDisponibles.length > 0 && (
        <div className="max-w-xs">
          <Select
            value={versionSelectionnee === null ? VERSION_ACTIVE_SENTINEL : String(versionSelectionnee)}
            onValueChange={(v) => setVersionSelectionnee(v === VERSION_ACTIVE_SENTINEL ? null : Number(v))}
          >
            <SelectTrigger label={t("rapprochementTab.mapping.versionSelectorLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={VERSION_ACTIVE_SENTINEL}>
                {t("rapprochementTab.mapping.versionActiveOption", { version: versionActive ?? "" })}
              </SelectItem>
              {optionsVersion
                .filter((o) => !o.estActive)
                .map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {t("rapprochementTab.mapping.versionHistoriqueOption", { version: o.value })}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Bandeau explicite de lecture seule (ADR-053 §6.2 : une version passee
          ne se modifie pas) — indique SANS AMBIGUITE quelle version est
          consultee et qu'elle N'EST PAS la version active. */}
      {consultationHistorique && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-accent-blue/40 bg-accent-blue-muted p-3 text-xs text-accent-blue"
        >
          <History className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            {t("rapprochementTab.mapping.consultationHistoriqueBanner", {
              version: versionSelectionnee ?? "",
              versionActive: versionActive ?? "",
            })}
          </p>
        </div>
      )}

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
          {/* La carte "categories non mappees" n'a de sens QUE pour la version
              active : mapper une categorie cree TOUJOURS une nouvelle version
              active (jamais une modification de la version consultee) — la
              masquer pendant la consultation d'une version passee evite de
              suggerer une action qui n'agirait de toute facon jamais sur ce
              qui est affiche a l'ecran. */}
          {!consultationHistorique && (
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
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {consultationHistorique
                  ? t("rapprochementTab.mapping.mappingHistorique.title")
                  : t("rapprochementTab.mapping.mappingActif.title")}
              </CardTitle>
              {version !== null && (
                <p className="text-xs text-muted-foreground">
                  {consultationHistorique
                    ? t("rapprochementTab.mapping.mappingHistorique.description", { version })
                    : t("rapprochementTab.mapping.mappingActif.description", { version })}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {mappingAffiche.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("rapprochementTab.mapping.mappingActif.empty")}
                </p>
              ) : (
                <div className="space-y-2">
                  {mappingAffiche.map((m) => (
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
                        {m.cibleOrpheline && (
                          <div
                            role="alert"
                            className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-danger/40 bg-danger/10 p-2 text-xs text-danger"
                          >
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{t("rapprochementTab.mapping.cibleOrpheline")}</span>
                          </div>
                        )}
                      </div>
                      {/* Lecture seule stricte pour une version passee (ADR-053 §6.2) :
                          jamais de bouton d'edition, quelle que soit la permission. */}
                      {peutParametrer && !consultationHistorique && (
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
