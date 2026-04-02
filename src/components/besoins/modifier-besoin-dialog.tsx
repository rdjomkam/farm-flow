"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useDepenseService } from "@/services/depense.service";
import { useStockService } from "@/services/stock.service";
import { VagueRatioEditor, type VagueRatioItem } from "./vague-ratio-editor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProduitOption {
  id: string;
  nom: string;
  unite: string;
  prixUnitaire: number;
}

interface LigneBesoinData {
  id: string;
  designation: string;
  produitId: string | null;
  quantite: number;
  unite: string | null;
  prixEstime: number;
  prixReel: number | null;
  commandeId: string | null;
  produit: { id: string; nom: string; unite: string } | null;
  commande: { id: string; numero: string; statut: string } | null;
}

interface ListeBesoinsEditData {
  id: string;
  titre: string;
  notes: string | null;
  dateLimite: string | null;
  /** Vagues associees avec ratios (multi-vague) */
  vagues?: { id: string; vagueId: string; ratio: number; vague?: { id: string; code: string } | null }[];
  lignes: LigneBesoinData[];
}

interface VagueOption {
  id: string;
  code: string;
}

interface LigneForm {
  id: string;
  designation: string;
  produitId: string;
  quantite: string;
  unite: string;
  prixEstime: string;
}

interface Props {
  liste: ListeBesoinsEditData;
  onSuccess: (updated: ListeBesoinsEditData) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genId() {
  return Math.random().toString(36).slice(2);
}

function formatMontant(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function toLigneForm(l: LigneBesoinData): LigneForm {
  return {
    id: genId(),
    designation: l.designation,
    produitId: l.produitId ?? "",
    quantite: String(l.quantite),
    unite: l.unite ?? "",
    prixEstime: String(l.prixEstime),
  };
}

function emptyLigne(): LigneForm {
  return {
    id: genId(),
    designation: "",
    produitId: "",
    quantite: "",
    unite: "",
    prixEstime: "",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ModifierBesoinDialog({ liste, onSuccess }: Props) {
  const depenseService = useDepenseService();
  const stockService = useStockService();
  const t = useTranslations("besoins");

  const [open, setOpen] = useState(false);
  const [produits, setProduits] = useState<ProduitOption[]>([]);
  const [produitsLoading, setProduitsLoading] = useState(false);
  const [vagues, setVaguesOptions] = useState<VagueOption[]>([]);

  // Form state — initialise depuis la liste courante
  const [titre, setTitre] = useState(liste.titre);
  const [notes, setNotes] = useState(liste.notes ?? "");
  const [dateLimite, setDateLimite] = useState(
    liste.dateLimite ? new Date(liste.dateLimite).toISOString().split("T")[0] : ""
  );
  const [vaguesRatios, setVaguesRatios] = useState<VagueRatioItem[]>(
    (liste.vagues ?? [])
      .filter((lbv) => lbv.vague != null)
      .map((lbv) => ({ vagueId: lbv.vagueId, ratio: lbv.ratio }))
  );
  const [lignes, setLignes] = useState<LigneForm[]>(
    liste.lignes.length > 0 ? liste.lignes.map(toLigneForm) : [emptyLigne()]
  );
  const [validationError, setValidationError] = useState("");

  const montantEstime = lignes.reduce((acc, l) => {
    const q = parseFloat(l.quantite) || 0;
    const p = parseFloat(l.prixEstime) || 0;
    return acc + q * p;
  }, 0);

  function addLigne() {
    setLignes((prev) => [...prev, emptyLigne()]);
  }

  function removeLigne(id: string) {
    setLignes((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLigne(id: string, field: keyof LigneForm, value: string) {
    setLignes((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const updated = { ...l, [field]: value };
        // Si produit selectionne, auto-fill designation, unite, prixEstime
        if (field === "produitId" && value) {
          const produit = produits.find((p) => p.id === value);
          if (produit) {
            updated.designation = produit.nom;
            updated.unite = produit.unite;
            updated.prixEstime = String(produit.prixUnitaire);
          }
        }
        return updated;
      })
    );
  }

  async function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      // Re-initialiser les valeurs quand on rouvre le dialog
      setTitre(liste.titre);
      setNotes(liste.notes ?? "");
      setDateLimite(
        liste.dateLimite ? new Date(liste.dateLimite).toISOString().split("T")[0] : ""
      );
      setVaguesRatios(
        (liste.vagues ?? [])
          .filter((lbv) => lbv.vague != null)
          .map((lbv) => ({ vagueId: lbv.vagueId, ratio: lbv.ratio }))
      );
      setLignes(liste.lignes.length > 0 ? liste.lignes.map(toLigneForm) : [emptyLigne()]);
      setValidationError("");
      // Charger les produits et les vagues si pas encore charges
      if (produits.length === 0) {
        setProduitsLoading(true);
        const [produitsResult, vaguesResult] = await Promise.all([
          stockService.listProduits(),
          fetch("/api/vagues?limit=200").then((r) => r.json()).catch(() => null),
        ]);
        if (produitsResult.ok && produitsResult.data) {
          setProduits(produitsResult.data.data as ProduitOption[]);
        }
        if (vaguesResult?.data) {
          setVaguesOptions(
            (vaguesResult.data as Array<{ id: string; code: string }>).map((v) => ({
              id: v.id,
              code: v.code,
            }))
          );
        }
        setProduitsLoading(false);
      }
    }
  }

  async function handleSubmit() {
    // Validation legere
    if (!titre.trim()) {
      setValidationError(t("modifierDialog.erreurs.titreRequis"));
      return;
    }
    if (lignes.length === 0) {
      setValidationError(t("modifierDialog.erreurs.auMoinsUneLigne"));
      return;
    }
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      if (!l.designation.trim()) {
        setValidationError(
          t("modifierDialog.erreurs.designationRequise", { index: i + 1 })
        );
        return;
      }
      if (!l.quantite || parseFloat(l.quantite) <= 0) {
        setValidationError(
          t("modifierDialog.erreurs.quantitePositive", { index: i + 1 })
        );
        return;
      }
      if (l.prixEstime === "" || parseFloat(l.prixEstime) < 0) {
        setValidationError(
          t("modifierDialog.erreurs.prixPositif", { index: i + 1 })
        );
        return;
      }
    }

    setValidationError("");

    const result = await depenseService.updateBesoin(liste.id, {
      titre: titre.trim(),
      vagues: vaguesRatios.length > 0 ? vaguesRatios : [],
      notes: notes.trim() || null,
      dateLimite: dateLimite || null,
      lignes: lignes.map((l) => ({
        designation: l.designation.trim(),
        produitId: l.produitId || undefined,
        quantite: parseFloat(l.quantite),
        unite: l.unite.trim() || undefined,
        prixEstime: parseFloat(l.prixEstime) || 0,
      })),
    });

    if (result.ok && result.data) {
      setOpen(false);
      onSuccess(result.data as unknown as ListeBesoinsEditData);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("modifierDialog.trigger")}
        </Button>
      </DialogTrigger>

      <DialogContent className="md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("modifierDialog.title")}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4 py-2">
          {/* Titre */}
          <div>
            <label className="text-sm font-medium">
              {t("modifierDialog.titreLabel")}{" "}
              <span className="text-destructive">*</span>
            </label>
            <Input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder={t("form.titrePlaceholder")}
              className="mt-1"
            />
          </div>

          {/* Date limite */}
          <div>
            <label className="text-sm font-medium">{t("modifierDialog.dateLimite")}</label>
            <p className="text-xs text-muted-foreground mb-1">
              {t("modifierDialog.dateLimiteHint")}
            </p>
            <Input
              type="date"
              value={dateLimite}
              onChange={(e) => setDateLimite(e.target.value)}
              className="mt-1"
            />
            {dateLimite && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline mt-1"
                onClick={() => setDateLimite("")}
              >
                {t("modifierDialog.supprimerDate")}
              </button>
            )}
          </div>

          {/* Vagues associees */}
          <div>
            <VagueRatioEditor
              vagues={vagues}
              value={vaguesRatios}
              onChange={setVaguesRatios}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium">{t("modifierDialog.notes")}</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("modifierDialog.notesPlaceholder")}
              rows={2}
              className="mt-1"
            />
          </div>

          {/* Lignes de besoin */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                {t("modifierDialog.lignesTitle")}{" "}
                <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground">
                {t("modifierDialog.lignesCount", { count: lignes.length })}
              </span>
            </div>

            <div className="space-y-3">
              {lignes.map((l, idx) => (
                <Card key={l.id}>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-medium">
                        {t("modifierDialog.ligneLabel", { index: idx + 1 })}
                      </p>
                      {lignes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-6 px-1.5"
                          onClick={() => removeLigne(l.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">
                        {t("modifierDialog.produit")}
                      </label>
                      <Select
                        value={l.produitId || "none"}
                        onValueChange={(v) =>
                          updateLigne(l.id, "produitId", v === "none" ? "" : v)
                        }
                      >
                        <SelectTrigger className="mt-0.5 h-9 text-sm w-full">
                          <SelectValue
                            placeholder={
                              produitsLoading
                                ? t("modifierDialog.produitChargement")
                                : t("modifierDialog.produitPlaceholder")
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("modifierDialog.produitAucun")}</SelectItem>
                          {produits.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nom}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">
                        {t("modifierDialog.designation")}{" "}
                        <span className="text-destructive">*</span>
                      </label>
                      <Input
                        value={l.designation}
                        onChange={(e) => updateLigne(l.id, "designation", e.target.value)}
                        placeholder={t("modifierDialog.designationPlaceholder")}
                        className="mt-0.5 h-9 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">
                          {t("modifierDialog.quantite")}{" "}
                          <span className="text-destructive">*</span>
                        </label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={l.quantite}
                          onChange={(e) => updateLigne(l.id, "quantite", e.target.value)}
                          placeholder="0"
                          className="mt-0.5 h-9 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">{t("modifierDialog.unite")}</label>
                        <Input
                          value={l.unite}
                          onChange={(e) => updateLigne(l.id, "unite", e.target.value)}
                          placeholder={t("modifierDialog.unitePlaceholder")}
                          className="mt-0.5 h-9 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">
                        {t("modifierDialog.prixEstime")}{" "}
                        <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={l.prixEstime}
                        onChange={(e) => updateLigne(l.id, "prixEstime", e.target.value)}
                        placeholder="0"
                        className="mt-0.5 h-9 text-sm"
                      />
                    </div>

                    {l.quantite && l.prixEstime && (
                      <p className="text-xs text-muted-foreground text-right">
                        {t("modifierDialog.sousTotal")}{" "}
                        <span className="font-medium text-foreground">
                          {formatMontant(
                            (parseFloat(l.quantite) || 0) * (parseFloat(l.prixEstime) || 0)
                          )}{" "}
                          FCFA
                        </span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={addLigne}
            >
              <Plus className="h-4 w-4 mr-1" />
              {t("modifierDialog.ajouterLigne")}
            </Button>

            {/* Total estime */}
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm font-medium">{t("modifierDialog.totalEstime")}</span>
              <span className="text-base font-bold">{formatMontant(montantEstime)} FCFA</span>
            </div>
          </div>

          {/* Validation error */}
          {validationError && (
            <p className="text-sm text-destructive bg-destructive/10 rounded p-2">
              {validationError}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">
              {t("modifierDialog.annuler")}
            </Button>
          </DialogClose>
          <Button variant="primary" onClick={handleSubmit}>
            {t("modifierDialog.enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
