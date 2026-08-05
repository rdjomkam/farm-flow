"use client";

/**
 * src/components/previsions/poste-form-dialog.tsx
 *
 * Dialog de creation d'un PostePrevision — parcours a DEUX TEMPS (ADR-053
 * §16.6/§16.10/§16.12, story A.5, "Design du parcours a deux temps") :
 * l'utilisateur choisit explicitement de RATTACHER une entree existante du
 * referentiel du site, ou d'en CREER une nouvelle — jamais une resolution
 * automatique par similarite de texte (§16.2, aucune fusion silencieuse).
 *
 * Mobile-first (360px d'abord), R5 (`DialogTrigger asChild`), R6 (aucune
 * couleur en dur, classes du design system).
 *
 * `libelle` (etape 2, commune aux deux onglets) reste le texte SCENARIO-LOCAL
 * final, pre-rempli depuis la selection/creation mais toujours editable
 * avant envoi (ADR-053 §16.12, "libelle : requis, jamais derive").
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Search, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { TypePostePrevision } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import { useToast } from "@/components/ui/toast";
import {
  POSTE_REFERENTIEL_ERROR_CODES,
  type CreatePostePrevisionResponseDTO,
  type PosteReferentielOptionDTO,
  type PosteReferentielExistantDetailsDTO,
} from "@/components/previsions/api-types";

interface PosteFormDialogProps {
  scenarioId: string;
  ordreSuivant: number;
  onCreated: (poste: CreatePostePrevisionResponseDTO) => void;
}

type Mode = "RECHERCHER" | "CREER";

export function PosteFormDialog({ scenarioId, ordreSuivant, onCreated }: PosteFormDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const TYPE_LABELS: Record<TypePostePrevision, string> = {
    [TypePostePrevision.LOGISTIQUE]: t("posteForm.types.LOGISTIQUE"),
    [TypePostePrevision.CHARGE_EXPLOITATION]: t("posteForm.types.CHARGE_EXPLOITATION"),
  };
  const { get, post } = usePrevisionsApi();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [mode, setMode] = useState<Mode>("RECHERCHER");

  // Onglet "Rechercher"
  const [referentiel, setReferentiel] = useState<PosteReferentielOptionDTO[]>([]);
  const [referentielChargement, setReferentielChargement] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [posteReferentielId, setPosteReferentielId] = useState<string | null>(null);

  // Onglet "Creer"
  const [nouveauLibelle, setNouveauLibelle] = useState("");

  // Etape 2 (commune)
  const [libelle, setLibelle] = useState("");
  const [libelleTouche, setLibelleTouche] = useState(false);
  const [type, setType] = useState<TypePostePrevision>(TypePostePrevision.CHARGE_EXPLOITATION);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [collision, setCollision] = useState<PosteReferentielExistantDetailsDTO | null>(null);
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  const etape2Visible =
    (mode === "RECHERCHER" && !!posteReferentielId) ||
    (mode === "CREER" && nouveauLibelle.trim().length > 0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReferentielChargement(true);
    (async () => {
      const result = await get<{ data: PosteReferentielOptionDTO[] }>("/api/previsions/postes-referentiel", {
        silentError: true,
        silentLoading: true,
      });
      if (cancelled) return;
      if (result.ok && result.data) setReferentiel(result.data.data ?? []);
      setReferentielChargement(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetForm() {
    setMode("RECHERCHER");
    setRecherche("");
    setPosteReferentielId(null);
    setNouveauLibelle("");
    setLibelle("");
    setLibelleTouche(false);
    setType(TypePostePrevision.CHARGE_EXPLOITATION);
    setError(null);
    setErrorCode(null);
    setCollision(null);
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  function handleSelectEntry(entry: PosteReferentielOptionDTO) {
    setPosteReferentielId(entry.id);
    if (!libelleTouche) setLibelle(entry.libelle);
    setTouched(true);
    setError(null);
    setErrorCode(null);
    setCollision(null);
  }

  function handleNouveauLibelleChange(value: string) {
    setNouveauLibelle(value);
    if (!libelleTouche) setLibelle(value);
    setTouched(true);
  }

  function handleCreerDepuisRecherche() {
    setMode("CREER");
    handleNouveauLibelleChange(recherche);
  }

  function handleLierExistante() {
    if (!collision) return;
    setMode("RECHERCHER");
    setPosteReferentielId(collision.posteReferentielExistant.id);
    setError(null);
    setErrorCode(null);
    setCollision(null);
  }

  async function handleSubmit() {
    if (!libelle.trim()) {
      setError(t("posteForm.errors.libelleRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    setErrorCode(null);
    setCollision(null);
    try {
      const payload =
        mode === "RECHERCHER"
          ? { libelle: libelle.trim(), type, ordre: ordreSuivant, posteReferentielId: posteReferentielId! }
          : {
              libelle: libelle.trim(),
              type,
              ordre: ordreSuivant,
              nouveauPosteReferentielLibelle: nouveauLibelle.trim(),
            };

      const result = await post<CreatePostePrevisionResponseDTO>(
        `/api/previsions/scenarios/${scenarioId}/postes`,
        payload,
        { silentError: true }
      );
      if (result.ok && result.data) {
        if (result.data.reutilise) {
          toast({
            title: t("posteFormDialog.reutiliseNotice", { libelle: result.data.posteReferentiel.libelle }),
            variant: "info",
          });
        }
        onCreated(result.data);
        handleOpenChange(false);
        return;
      }

      const details = result.details as PosteReferentielExistantDetailsDTO | undefined;
      setErrorCode(result.code ?? null);
      switch (result.code) {
        case POSTE_REFERENTIEL_ERROR_CODES.CODE_COLLISION:
          setCollision(details ?? null);
          setError(
            details
              ? t("posteForm.errors.collisionCode", { libelle: details.posteReferentielExistant.libelle })
              : (result.error ?? null)
          );
          break;
        case POSTE_REFERENTIEL_ERROR_CODES.INACTIF:
          // Branche "Rechercher" (defense en profondeur, ne devrait pas
          // survenir : GET /postes-referentiel ne liste que les actifs) vs
          // branche "Creer" (chemin non dormant depuis que
          // POST .../desactiver existe) — deux messages distincts (ADR-053
          // §16.12 "i18n").
          setError(
            mode === "RECHERCHER"
              ? t("posteForm.errors.referentielInactifSelection")
              : t("posteForm.errors.referentielInactifCreation")
          );
          break;
        case POSTE_REFERENTIEL_ERROR_CODES.INTROUVABLE:
          setError(t("posteForm.errors.referentielIntrouvable"));
          break;
        case POSTE_REFERENTIEL_ERROR_CODES.CHAMPS_EXCLUSIFS:
          setError(t("posteForm.errors.champsExclusifs"));
          break;
        case POSTE_REFERENTIEL_ERROR_CODES.CHAMP_REQUIS:
          setError(t("posteForm.errors.champRequis"));
          break;
        default:
          setError(result.error ?? null);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const referentielFiltre = referentiel.filter((entry) =>
    entry.libelle.toLowerCase().includes(recherche.trim().toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4" />
          {t("posteForm.triggerButton")}
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("posteForm.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <Tabs
              value={mode}
              onValueChange={(v) => {
                if (submitting) return;
                setMode(v as Mode);
                setTouched(true);
                setError(null);
                setCollision(null);
              }}
            >
              <TabsList>
                <TabsTrigger value="RECHERCHER" disabled={submitting}>
                  {t("posteForm.mode.search")}
                </TabsTrigger>
                <TabsTrigger value="CREER" disabled={submitting}>
                  {t("posteForm.mode.create")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="RECHERCHER">
                <div className="flex flex-col gap-2">
                  <Input
                    aria-label={t("posteForm.search.placeholder")}
                    placeholder={t("posteForm.search.placeholder")}
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                  />
                  <div className="flex max-h-52 flex-col gap-1 overflow-y-auto">
                    {referentielChargement ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">…</p>
                    ) : referentielFiltre.length === 0 ? (
                      <div className="flex flex-col gap-2 py-3 text-center">
                        <p className="text-xs text-muted-foreground">{t("posteForm.search.empty")}</p>
                        {recherche.trim().length > 0 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCreerDepuisRecherche}
                            className="self-center"
                          >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            {t("posteForm.search.createFromQuery", { recherche: recherche.trim() })}
                          </Button>
                        )}
                      </div>
                    ) : (
                      referentielFiltre.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => handleSelectEntry(entry)}
                          className={`flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left transition-colors ${
                            posteReferentielId === entry.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <span className="text-sm font-medium text-foreground">{entry.libelle}</span>
                          <span className="text-xs text-muted-foreground">
                            {t("posteForm.search.resultCode", { code: entry.code })}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="CREER">
                <div className="flex flex-col gap-2">
                  <Input
                    label={t("posteForm.create.fields.libelle.label")}
                    required
                    value={nouveauLibelle}
                    onChange={(e) => handleNouveauLibelleChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t("posteForm.create.hint")}</p>

                  {collision && (
                    <div
                      role="alert"
                      className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-accent-amber-muted p-3 text-xs text-warning"
                    >
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {t("posteForm.errors.collisionCode", {
                            libelle: collision.posteReferentielExistant.libelle,
                          })}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleLierExistante}
                        className="self-start"
                      >
                        <Search className="h-4 w-4" aria-hidden="true" />
                        {t("posteForm.errors.lierExistante")}
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {etape2Visible && (
              <div className="flex flex-col gap-3 border-t border-border pt-3">
                <Input
                  label={t("posteForm.fields.libelle.label")}
                  required
                  placeholder={t("posteForm.fields.libelle.placeholder")}
                  value={libelle}
                  onChange={(e) => {
                    setLibelle(e.target.value);
                    setLibelleTouche(true);
                    setTouched(true);
                  }}
                  error={!collision ? (error ?? undefined) : undefined}
                />
                <Select
                  value={type}
                  onValueChange={(v) => {
                    setType(v as TypePostePrevision);
                    setTouched(true);
                  }}
                >
                  <SelectTrigger label={t("posteForm.fields.type.label")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TypePostePrevision).map((typeValue) => (
                      <SelectItem key={typeValue} value={typeValue}>
                        {TYPE_LABELS[typeValue]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {errorCode === POSTE_REFERENTIEL_ERROR_CODES.INACTIF && mode === "CREER" && (
              <Link
                href="/previsions/postes-referentiel"
                className="text-xs font-medium text-primary hover:underline"
              >
                {t("posteForm.errors.gererReferentielLink")}
              </Link>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !etape2Visible}>
            {submitting ? t("posteForm.submitting") : t("posteForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
