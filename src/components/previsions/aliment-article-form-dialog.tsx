"use client";

/**
 * src/components/previsions/aliment-article-form-dialog.tsx
 *
 * Dialog d'ajout d'un SECOND (ou N-ieme) article a un calibre d'aliment
 * previsionnel existant — action SECONDAIRE explicite (ADR-053 §12.6),
 * jamais visible au meme niveau que la creation du calibre. C'est le SEUL
 * moment ou la part d'approvisionnement (`partApprovisionnementPct`) devient
 * visible et saisissable, pour TOUS les articles du calibre (celui deja
 * existant inclus, dont la part passe de 100% implicite a une valeur
 * explicite que l'utilisateur doit desormais repartir).
 *
 * Un seul appel API : POST /api/previsions/aliments/[id]/articles, avec la
 * repartition COMPLETE de tous les articles (existants + nouveau) — jamais
 * un appel par article.
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
import type { Produit } from "@/types";
import { usePrevisionsApi } from "@/hooks/use-previsions-api";
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard";
import type { AlimentArticlePrevisionDTO, AlimentPrevisionDTO } from "@/components/previsions/api-types";

const AUCUN_PRODUIT = "__aucun__";
const TOLERANCE_SOMME = 0.001;

interface AlimentArticleFormDialogProps {
  alimentPrevisionId: string;
  calibreLabel: string;
  articlesExistants: AlimentArticlePrevisionDTO[];
  onSaved: (aliment: AlimentPrevisionDTO) => void;
  trigger?: React.ReactNode;
}

export function AlimentArticleFormDialog({
  alimentPrevisionId,
  calibreLabel,
  articlesExistants,
  onSaved,
  trigger,
}: AlimentArticleFormDialogProps) {
  const t = useTranslations("previsions");
  const tCommon = useTranslations("common");
  const { post, get } = usePrevisionsApi();
  const [open, setOpen] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [poidsSacKg, setPoidsSacKg] = useState("");
  const [prixSacFCFA, setPrixSacFCFA] = useState("");
  const [produitId, setProduitId] = useState<string>(AUCUN_PRODUIT);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [nouvellePart, setNouvellePart] = useState("");
  const [partsExistantes, setPartsExistantes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const { onInteractOutside, onEscapeKeyDown } = useDialogCloseGuard(touched);

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
    setLibelle("");
    setPoidsSacKg("");
    setPrixSacFCFA("");
    setProduitId(AUCUN_PRODUIT);
    setNouvellePart("");
    const parts: Record<string, string> = {};
    for (const a of articlesExistants) parts[a.id] = String(Number(a.partApprovisionnementPct));
    setPartsExistantes(parts);
    setErrors({});
    setTouched(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    resetForm();
  }

  function sommeParts(): number {
    const existantes = Object.values(partsExistantes).reduce((sum, v) => sum + (Number(v) || 0), 0);
    return existantes + (Number(nouvellePart) || 0);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!libelle.trim()) next.libelle = t("alimentArticleForm.errors.libelleRequired");
    if (!poidsSacKg.trim() || Number(poidsSacKg) <= 0)
      next.poidsSacKg = t("alimentArticleForm.errors.poidsSacKgPositive");
    if (!prixSacFCFA.trim()) next.prixSacFCFA = t("alimentArticleForm.errors.required");
    if (!nouvellePart.trim()) next.nouvellePart = t("alimentArticleForm.errors.required");
    if (Math.abs(sommeParts() - 100) > TOLERANCE_SOMME) {
      next.somme = t("alimentArticleForm.errors.sumMustBe100");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const repartition = [
        ...articlesExistants.map((a) => ({
          articleId: a.id,
          partApprovisionnementPct: Number(partsExistantes[a.id]),
        })),
        { partApprovisionnementPct: Number(nouvellePart) },
      ];
      const result = await post<AlimentPrevisionDTO>(
        `/api/previsions/aliments/${alimentPrevisionId}/articles`,
        {
          nouvelArticle: {
            libelle: libelle.trim(),
            poidsSacKg: Number(poidsSacKg),
            prixSacFCFA: Number(prixSacFCFA),
            produitId: produitId === AUCUN_PRODUIT ? null : produitId,
          },
          repartition,
        }
      );
      if (result.ok && result.data) {
        onSaved(result.data);
        handleOpenChange(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const somme = sommeParts();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4" />
            {t("alimentArticleForm.triggerButton")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent onInteractOutside={onInteractOutside} onEscapeKeyDown={onEscapeKeyDown}>
        <DialogHeader>
          <DialogTitle>{t("alimentArticleForm.dialogTitle", { calibre: calibreLabel })}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                {t("alimentArticleForm.existingArticlesTitle")}
              </p>
              {articlesExistants.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">{a.libelle}</span>
                  <Input
                    aria-label={t("alimentArticleForm.fields.partApprovisionnementPct.label") + " — " + a.libelle}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    className="w-24"
                    value={partsExistantes[a.id] ?? ""}
                    onChange={(e) => {
                      setPartsExistantes((prev) => ({ ...prev, [a.id]: e.target.value }));
                      setTouched(true);
                    }}
                  />
                </div>
              ))}
            </div>

            <Input
              label={t("alimentArticleForm.fields.libelle.label")}
              required
              placeholder={t("alimentArticleForm.fields.libelle.placeholder")}
              value={libelle}
              onChange={(e) => {
                setLibelle(e.target.value);
                setTouched(true);
              }}
              error={errors.libelle}
            />
            <Select
              value={produitId}
              onValueChange={(v) => {
                setProduitId(v);
                setTouched(true);
              }}
            >
              <SelectTrigger label={t("alimentArticleForm.fields.produitId.label")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUN_PRODUIT}>{t("alimentArticleForm.fields.produitId.none")}</SelectItem>
                {produits.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              label={t("alimentArticleForm.fields.poidsSacKg.label")}
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
              label={t("alimentArticleForm.fields.prixSacFCFA.label")}
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
              label={t("alimentArticleForm.fields.partApprovisionnementPct.label")}
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              required
              value={nouvellePart}
              onChange={(e) => {
                setNouvellePart(e.target.value);
                setTouched(true);
              }}
              error={errors.nouvellePart}
            />

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2">
              <span className="text-sm text-muted-foreground">{t("alimentArticleForm.sumLabel")}</span>
              <span className={Math.abs(somme - 100) <= TOLERANCE_SOMME ? "text-success" : "text-danger"}>
                {t("alimentArticleForm.sumValue", { value: Math.round(somme * 10) / 10 })}
              </span>
            </div>
            {errors.somme && (
              <p role="alert" aria-live="polite" className="text-sm text-danger">
                {errors.somme}
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting}>
            {tCommon("buttons.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t("alimentArticleForm.submitting") : t("alimentArticleForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
