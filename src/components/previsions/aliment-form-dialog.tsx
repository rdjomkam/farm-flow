"use client";

/**
 * src/components/previsions/aliment-form-dialog.tsx
 *
 * Dialog de creation d'un calibre previsionnel (`AlimentPrevision`) ET de son
 * unique article (`AlimentArticlePrevision`), dans le MEME geste (ADR-053
 * §12.6 : "creer un calibre cree son article dans le meme geste") — un seul
 * appel a la route transactionnelle POST
 * /api/previsions/scenarios/[id]/aliments, jamais deux appels distincts.
 *
 * `tailleGranule` est desormais un SELECTEUR OBLIGATOIRE sur l'enum
 * `TailleGranule` (jamais une chaine libre) — c'est l'identite du calibre
 * (ADR-053 §12.1/§12.3). `produitId` est optionnel, choisi dans le catalogue
 * `Produit` du site (categorie ALIMENT) pour permettre le rapprochement
 * prevu/reel de PR3.
 *
 * La part d'approvisionnement (`partApprovisionnementPct`) n'apparait PAS
 * ici : elle vaut 100% implicitement, ecrite par le serveur (ADR-053 §12.6).
 *
 * Pas de PUT sur le calibre lui-meme cote API (PR2.2) — une fois cree, seule
 * la repartition mensuelle reste modifiable (`RepartitionMoisDialog`), et un
 * second article s'ajoute via une action secondaire distincte
 * (`AlimentArticleFormDialog`).
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus } from "lucide-react";
import { TailleGranule } from "@/types";
import type { Produit } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import type { AlimentPrevisionDTO } from "@/components/previsions/api-types";

const AUCUN_PRODUIT = "__aucun__";

interface AlimentFormDialogProps {
  scenarioId: string;
  ordreSuivant: number;
  onCreated: (aliment: AlimentPrevisionDTO) => void;
  /** Calibres deja utilises dans ce scenario — exclus des options (contrainte @@unique([scenarioId, tailleGranule]), ADR-053 §12.3). */
  taillesGranuleUtilisees?: TailleGranule[];
}

export function AlimentFormDialog({
  scenarioId,
  ordreSuivant,
  onCreated,
  taillesGranuleUtilisees = [],
}: AlimentFormDialogProps) {
  const t = useTranslations("previsions");
  const tStock = useTranslations("stock");
  const tCommon = useTranslations("common");
  const { post, get } = usePrevisionsApi();
  const [open, setOpen] = useState(false);
  const [tailleGranule, setTailleGranule] = useState<TailleGranule | "">("");
  const [libelle, setLibelle] = useState("");
  const [poidsSacKg, setPoidsSacKg] = useState("");
  const [prixSacFCFA, setPrixSacFCFA] = useState("");
  const [sacsParTonneStandard, setSacsParTonneStandard] = useState("");
  const [produitId, setProduitId] = useState<string>(AUCUN_PRODUIT);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

  const optionsTailleGranule = Object.values(TailleGranule).filter(
    (v) => !taillesGranuleUtilisees.includes(v)
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const result = await get<{ data: Produit[] }>("/api/produits?categorie=ALIMENT&limit=200", {
        silentError: true,
        silentLoading: true,
      });
      if (!cancelled && result?.ok && result.data) {
        setProduits(result.data.data ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetForm() {
    setTailleGranule("");
    setLibelle("");
    setPoidsSacKg("");
    setPrixSacFCFA("");
    setSacsParTonneStandard("");
    setProduitId(AUCUN_PRODUIT);
    setErrors({});
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) resetForm();
  }

  function handleSelectProduit(id: string) {
    setProduitId(id);
    setTouched(true);
    if (id === AUCUN_PRODUIT) return;
    const produit = produits.find((p) => p.id === id);
    if (!produit) return;
    // Best-effort : ne pre-remplit que les champs encore vides — jamais une
    // ecriture silencieuse qui ecraserait une saisie deja faite par
    // l'utilisateur.
    if (!libelle.trim()) setLibelle(produit.nom);
    if (!poidsSacKg.trim() && produit.contenance !== null) setPoidsSacKg(String(produit.contenance));
    if (!prixSacFCFA.trim()) setPrixSacFCFA(String(produit.prixUnitaire));
    if (!tailleGranule && produit.tailleGranule) setTailleGranule(produit.tailleGranule);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!tailleGranule) next.tailleGranule = t("alimentForm.errors.tailleGranuleRequired");
    if (!libelle.trim()) next.libelle = t("alimentForm.errors.libelleRequired");
    if (!poidsSacKg.trim() || Number(poidsSacKg) <= 0) next.poidsSacKg = t("alimentForm.errors.poidsSacKgPositive");
    if (!prixSacFCFA.trim()) next.prixSacFCFA = t("alimentForm.errors.required");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await post<AlimentPrevisionDTO>(`/api/previsions/scenarios/${scenarioId}/aliments`, {
        tailleGranule,
        sacsParTonneStandard: sacsParTonneStandard.trim() ? Number(sacsParTonneStandard) : null,
        ordre: ordreSuivant,
        article: {
          libelle: libelle.trim(),
          poidsSacKg: Number(poidsSacKg),
          prixSacFCFA: Number(prixSacFCFA),
          produitId: produitId === AUCUN_PRODUIT ? null : produitId,
        },
      });
      if (result.ok && result.data) {
        onCreated(result.data);
        handleOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto">
          <Plus className="h-4 w-4" />
          {t("alimentForm.triggerButton")}
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("alimentForm.dialogTitle")}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-3">
            <Select
              value={tailleGranule}
              onValueChange={(v) => {
                setTailleGranule(v as TailleGranule);
                setTouched(true);
              }}
            >
              <SelectTrigger
                label={t("alimentForm.fields.tailleGranule.label")}
                required
                error={errors.tailleGranule}
              >
                <SelectValue placeholder={t("alimentForm.fields.tailleGranule.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {optionsTailleGranule.map((val) => (
                  <SelectItem key={val} value={val}>
                    {tStock(`produits.taillesGranule.${val}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              label={t("alimentForm.fields.libelle.label")}
              required
              placeholder={t("alimentForm.fields.libelle.placeholder")}
              value={libelle}
              onChange={(e) => {
                setLibelle(e.target.value);
                setTouched(true);
              }}
              error={errors.libelle}
            />
            <Select value={produitId} onValueChange={handleSelectProduit}>
              <SelectTrigger label={t("alimentForm.fields.produitId.label")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUN_PRODUIT}>{t("alimentForm.fields.produitId.none")}</SelectItem>
                {produits.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              label={t("alimentForm.fields.poidsSacKg.label")}
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              required
              value={poidsSacKg}
              onChange={(e) => {
                setPoidsSacKg(e.target.value);
                setTouched(true);
              }}
              error={errors.poidsSacKg}
            />
            <Input
              label={t("alimentForm.fields.prixSacFCFA.label")}
              type="number"
              inputMode="decimal"
              min={0}
              required
              value={prixSacFCFA}
              onChange={(e) => {
                setPrixSacFCFA(e.target.value);
                setTouched(true);
              }}
              error={errors.prixSacFCFA}
            />
            <Input
              label={t("alimentForm.fields.sacsParTonneStandard.label")}
              type="number"
              inputMode="decimal"
              min={0.1}
              step={0.1}
              value={sacsParTonneStandard}
              onChange={(e) => {
                setSacsParTonneStandard(e.target.value);
                setTouched(true);
              }}
              hint={t("alimentForm.fields.sacsParTonneStandard.hint")}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("alimentForm.submitting") : t("alimentForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
