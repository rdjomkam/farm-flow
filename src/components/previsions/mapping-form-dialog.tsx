"use client";

/**
 * src/components/previsions/mapping-form-dialog.tsx
 *
 * Dialog de creation/edition d'une ligne de `MappingRapprochement` (Sprint
 * PR3-bis, stories PR3bis.4/PR3bis.5, ADR-053 section 3.9).
 *
 * PIEGE CENTRAL (pre-analyse section 1, "PIEGE CENTRAL") : `POST
 * /api/previsions/mapping-rapprochement` est un REMPLACEMENT EN BLOC — il
 * n'existe AUCUNE route d'ajout unitaire. `handleSubmit` relit donc TOUJOURS
 * le mapping actif COMPLET juste avant de soumettre (jamais une copie
 * potentiellement perimee recue en props), y fusionne la ligne courante
 * (ajout ou remplacement par cle `sourceType`+`sourceCle`), puis POSTe le
 * tableau entier. Un POST partiel desactiverait silencieusement toutes les
 * autres lignes actives du site (`creerVersionMapping`,
 * `previsions-rapprochement-mapping.ts:101-104`, `updateMany({actif:false})`
 * sur TOUT le site avant de creer la nouvelle version).
 *
 * RISQUE R1 (pre-analyse section 4) : `cibleId` d'un mapping SITE-scope
 * reference une entite SCENARIO-scope (`PostePrevision`/`AlimentPrevision`).
 * La liste de cibles n'est peuplee QUE depuis le scenario actuellement
 * affiche (`scenarioId`), et un avertissement explicite le dit — mitigation
 * documentaire requise par la pre-analyse, pas un correctif structurel (hors
 * perimetre de ce sprint).
 *
 * CORRECTIF C1 (review + verification navigateur, sprint PR3-bis-bis) : en
 * edition, si `existant.cibleId` n'appartient a AUCUNE des cibles chargees
 * (le mapping vise un `PostePrevision`/`AlimentPrevision` d'un AUTRE
 * scenario que celui affiche), le `Select` Radix retombe sur son placeholder
 * "Choisir…" — l'administrateur croit alors qu'aucune cible n'est
 * selectionnee, en choisit une autre, et ECRASE SILENCIEUSEMENT la cible
 * existante d'un autre scenario. `cibleActuelleHorsScenario` detecte ce cas
 * et rend la situation explicite par un bandeau distinct de
 * `scenarioWarning` (celui-ci prevu pour la SAISIE future, celui-la pour
 * l'ETAT actuel du formulaire) + une option de repli desactivee dans la
 * liste.
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { CibleRapprochement, SourceRapprochement } from "@/types";
import type { MappingRapprochement } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import { libelleSourceCle, libelleSourceType } from "@/components/previsions/mapping-rapprochement-helpers";
import type { PostePrevisionDTO, AlimentPrevisionDTO } from "@/components/previsions/api-types";

interface MappingFormDialogProps {
  scenarioId: string;
  scenarioNom: string;
  source: { sourceType: SourceRapprochement; sourceCle: string };
  /** Ligne existante — presence => mode edition (source affichee mais non modifiable). */
  existant?: { cibleType: CibleRapprochement; cibleId: string | null };
  trigger: React.ReactNode;
  /** Le mapping actif COMPLET renvoye par le POST (nouvelle version) — le parent remplace son etat avec cette valeur, ne recalcule rien. */
  onSaved: (mappingActif: MappingRapprochement[]) => void;
}

const CIBLES_AVEC_ID = [CibleRapprochement.POSTE_PREVISION, CibleRapprochement.ALIMENT_PREVISION];

export function MappingFormDialog({
  scenarioId,
  scenarioNom,
  source,
  existant,
  trigger,
  onSaved,
}: MappingFormDialogProps) {
  const t = useTranslations("previsions");
  const tStock = useTranslations("stock");
  const tDepenses = useTranslations("depenses");
  const tCommon = useTranslations("common");
  const { get, post } = usePrevisionsApi();

  const [open, setOpen] = useState(false);
  const [cibleType, setCibleType] = useState<CibleRapprochement>(existant?.cibleType ?? CibleRapprochement.NON_RAPPROCHE);
  const [cibleId, setCibleId] = useState<string>(existant?.cibleId ?? "");
  const [postes, setPostes] = useState<PostePrevisionDTO[]>([]);
  const [aliments, setAliments] = useState<AlimentPrevisionDTO[]>([]);
  // CORRECTIF D1 (contre-review PR3-bis) : `chargementCibles` n'est plus un
  // booleen pilote par setState (qui laissait une fenetre de rendu, au tout
  // premier montage, ou `open === true` mais l'effet ci-dessous n'avait pas
  // encore commite `true` — pendant cette fenetre, `postes`/`aliments`
  // etaient vides et `cibleActuelleHorsScenario`/`cibleListeVide` pouvaient
  // a tort s'evaluer a `true`). Il est desormais DERIVE : on retient
  // uniquement le `scenarioId` pour lequel `postes`/`aliments` ont ete
  // charges avec succes ; le chargement est en cours si et seulement si le
  // dialog est ouvert et que cette valeur ne correspond pas (encore) au
  // `scenarioId` courant — vrai synchronement des le premier rendu ou`open`
  // devient `true`, sans aucune fenetre intermediaire. A dialog ferme (ou
  // jamais ouvert), `open` est `false` => `chargementCibles` est toujours
  // `false` (pas d'etat bloque a `true`, pas de spinner fantome).
  const [cibleDataScenarioId, setCibleDataScenarioId] = useState<string | null>(null);
  const chargementCibles = open && cibleDataScenarioId !== scenarioId;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  const exigeCibleId = CIBLES_AVEC_ID.includes(cibleType);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const [postesResult, alimentsResult] = await Promise.all([
        get<{ data: PostePrevisionDTO[] }>(`/api/previsions/scenarios/${scenarioId}/postes`, {
          silentError: true,
          silentLoading: true,
        }),
        get<{ data: AlimentPrevisionDTO[] }>(`/api/previsions/scenarios/${scenarioId}/aliments`, {
          silentError: true,
          silentLoading: true,
        }),
      ]);
      if (cancelled) return;
      if (postesResult?.ok && postesResult.data) setPostes(postesResult.data.data ?? []);
      if (alimentsResult?.ok && alimentsResult.data) setAliments(alimentsResult.data.data ?? []);
      // Marque ce `scenarioId` comme charge (que les deux appels aient
      // reussi ou non) : voir D2 ci-dessous — `chargementCibles` ne doit
      // pas rester bloque a `true` indefiniment en cas d'echec reseau isole.
      setCibleDataScenarioId(scenarioId);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scenarioId]);

  // CORRECTIF C1 : la cible ACTUELLE du formulaire (pas encore modifiee par
  // l'utilisateur) n'appartient a aucune des cibles chargees pour ce
  // scenario => elle appartient a un AUTRE scenario. Ne se declenche que
  // pour la valeur d'origine (`existant.cibleId`), jamais apres un choix
  // volontaire de l'utilisateur (une cible fraichement choisie est toujours
  // dans la liste puisqu'elle en est issue).
  const listePertinente =
    cibleType === CibleRapprochement.POSTE_PREVISION
      ? postes
      : cibleType === CibleRapprochement.ALIMENT_PREVISION
        ? aliments
        : [];
  const cibleActuelleHorsScenario =
    exigeCibleId &&
    !chargementCibles &&
    !!existant?.cibleId &&
    cibleId === existant.cibleId &&
    cibleType === existant.cibleType &&
    !listePertinente.some((item) => item.id === cibleId);
  // CORRECTIF C2 : cable la cle i18n `fields.cibleId.empty` (auparavant
  // morte) — distincte du cas ci-dessus, elle couvre l'absence totale
  // d'options pour ce `cibleType` dans ce scenario.
  const cibleListeVide = exigeCibleId && !chargementCibles && !cibleActuelleHorsScenario && listePertinente.length === 0;

  function resetForm() {
    setCibleType(existant?.cibleType ?? CibleRapprochement.NON_RAPPROCHE);
    setCibleId(existant?.cibleId ?? "");
    setError(null);
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  async function handleSubmit() {
    if (exigeCibleId && !cibleId) {
      setError(t("rapprochementTab.mapping.form.errors.cibleIdRequired"));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Relecture FRAICHE du mapping actif complet — jamais une copie
      // potentiellement perimee (voir en-tete de fichier, "PIEGE CENTRAL").
      const mappingActuel = await get<{ data: MappingRapprochement[] }>(
        "/api/previsions/mapping-rapprochement"
      );
      if (!mappingActuel.ok || !mappingActuel.data) {
        setError(t("rapprochementTab.mapping.loadError"));
        return;
      }

      const nouvelleLigne = {
        sourceType: source.sourceType,
        sourceCle: source.sourceCle,
        cibleType,
        cibleId: exigeCibleId ? cibleId : null,
      };

      const lignes = mappingActuel.data.data
        .filter((l) => !(l.sourceType === source.sourceType && l.sourceCle === source.sourceCle))
        .map((l) => ({
          sourceType: l.sourceType,
          sourceCle: l.sourceCle,
          cibleType: l.cibleType,
          cibleId: l.cibleId,
        }));
      lignes.push(nouvelleLigne);

      const result = await post<{ data: MappingRapprochement[] }>(
        "/api/previsions/mapping-rapprochement",
        { lignes }
      );
      if (result.ok && result.data) {
        onSaved(result.data.data);
        handleOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>
            {existant ? t("rapprochementTab.mapping.form.dialogTitleEdit") : t("rapprochementTab.mapping.form.dialogTitleCreate")}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("rapprochementTab.mapping.form.sourceLabel")}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {libelleSourceType(source.sourceType, t)} — {libelleSourceCle(source.sourceType, source.sourceCle, { tDepenses, tStock, tPrevisions: t })}
              </p>
            </div>

            <Select
              value={cibleType}
              onValueChange={(v) => {
                setCibleType(v as CibleRapprochement);
                setCibleId("");
                setTouched(true);
              }}
            >
              <SelectTrigger label={t("rapprochementTab.mapping.form.fields.cibleType.label")} required>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(CibleRapprochement).map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`rapprochementTab.mapping.cibleTypes.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {exigeCibleId && (
              <>
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                  {t("rapprochementTab.mapping.form.scenarioWarning", { scenario: scenarioNom })}
                </div>
                {cibleActuelleHorsScenario && (
                  <div role="alert" className="rounded-lg border border-warning/40 bg-accent-amber-muted p-3 text-xs text-warning">
                    {t("rapprochementTab.mapping.form.cibleHorsScenarioWarning", { scenario: scenarioNom })}
                  </div>
                )}
                <Select
                  value={cibleId}
                  onValueChange={(v) => {
                    setCibleId(v);
                    setTouched(true);
                  }}
                >
                  <SelectTrigger
                    label={t("rapprochementTab.mapping.form.fields.cibleId.label")}
                    required
                    error={error ?? undefined}
                  >
                    <SelectValue placeholder={t("rapprochementTab.mapping.form.fields.cibleId.placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {cibleActuelleHorsScenario && (
                      <SelectItem value={cibleId} disabled>
                        {t("rapprochementTab.mapping.form.fields.cibleId.horsScenario")}
                      </SelectItem>
                    )}
                    {cibleType === CibleRapprochement.POSTE_PREVISION &&
                      postes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.libelle}
                        </SelectItem>
                      ))}
                    {cibleType === CibleRapprochement.ALIMENT_PREVISION &&
                      aliments.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {tStock(`produits.taillesGranule.${a.tailleGranule}`)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {cibleListeVide && (
                  <p className="text-xs text-muted-foreground">{t("rapprochementTab.mapping.form.fields.cibleId.empty")}</p>
                )}
              </>
            )}

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              {t("rapprochementTab.mapping.form.versioningNote")}
            </div>

            {error && !exigeCibleId && <p className="text-sm text-danger">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? t("rapprochementTab.mapping.form.submitting")
              : existant
                ? t("rapprochementTab.mapping.form.submitEdit")
                : t("rapprochementTab.mapping.form.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
