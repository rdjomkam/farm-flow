"use client";

/**
 * VenteAlevinsDialog — Sprint VA (Story VA.4)
 *
 * Dialog "Vendre restants comme alevins" — permet de vendre les poissons
 * restants d'une vague PRE_GROSSISSEMENT comme alevins (client interne ou externe).
 * Reutilise l'infrastructure Vente/LigneVente (origineType = ALEVINS_PG).
 *
 * POST /api/vagues/[vagueId]/vente-alevins
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { CategorieDepense, Permission } from "@/types";
import type { CreateVenteAlevinsDepuisVagueDTO, DepenseVenteInput } from "@/types";
import { formatNum } from "@/lib/format";

interface VenteAlevinsDialogBac {
  id: string;
  nom: string;
  vivants: number;
  poidsMoyenSuggere: number;
}

interface VenteAlevinsDialogClient {
  id: string;
  nom: string;
  isSysteme: boolean;
}

interface VenteAlevinsDialogProps {
  vagueId: string;
  vagueCode: string;
  bacs: VenteAlevinsDialogBac[];
  clients: VenteAlevinsDialogClient[];
  permissions: Permission[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface LigneState {
  bacId: string;
  bacNom: string;
  vivants: number;
  quantite: string;
  poidsMoyenG: string;
  prixUnitaireKg: string;
}

interface DepenseState {
  description: string;
  categorieDepense: CategorieDepense;
  montantTotal: string;
}

const DEPENSE_CATEGORIES: CategorieDepense[] = [
  CategorieDepense.TRANSPORT,
  CategorieDepense.INTRANT,
  CategorieDepense.EQUIPEMENT,
  CategorieDepense.AUTRE,
];

export function VenteAlevinsDialog({
  vagueId,
  vagueCode,
  bacs,
  clients,
  permissions,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: VenteAlevinsDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations("vagues.venteAlevins");

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const canAutoCloture = permissions.includes(Permission.VAGUES_MODIFIER);

  function buildInitialLignes(): LigneState[] {
    return bacs.map((b) => ({
      bacId: b.id,
      bacNom: b.nom,
      vivants: b.vivants,
      quantite: "",
      poidsMoyenG: b.poidsMoyenSuggere > 0 ? String(b.poidsMoyenSuggere) : "",
      prixUnitaireKg: "",
    }));
  }

  const [clientId, setClientId] = useState<string>("");
  const [dateCommande, setDateCommande] = useState(() => new Date().toISOString().slice(0, 10));
  const [lignes, setLignes] = useState<LigneState[]>(buildInitialLignes);
  const [autoCloture, setAutoCloture] = useState(false);
  const [depensesOpen, setDepensesOpen] = useState(false);
  const [depenses, setDepenses] = useState<DepenseState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setClientId("");
    setDateCommande(new Date().toISOString().slice(0, 10));
    setLignes(buildInitialLignes());
    setAutoCloture(false);
    setDepensesOpen(false);
    setDepenses([]);
    setError(null);
    setFieldErrors({});
  }

  function updateLigne(bacId: string, patch: Partial<LigneState>) {
    setLignes((prev) => prev.map((l) => (l.bacId === bacId ? { ...l, ...patch } : l)));
    setFieldErrors({});
  }

  function addDepense() {
    setDepenses((prev) => [
      ...prev,
      { description: "", categorieDepense: CategorieDepense.TRANSPORT, montantTotal: "" },
    ]);
  }

  function updateDepense(index: number, patch: Partial<DepenseState>) {
    setDepenses((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function removeDepense(index: number) {
    setDepenses((prev) => prev.filter((_, i) => i !== index));
  }

  const lignesActives = lignes.filter((l) => Number(l.quantite) > 0);

  const total = lignesActives.reduce((sum, l) => {
    const qte = Number(l.quantite) || 0;
    const poids = Number(l.poidsMoyenG) || 0;
    const prix = Number(l.prixUnitaireKg) || 0;
    return sum + (qte * poids) / 1000 * prix;
  }, 0);

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!clientId) {
      errs.clientId = t("errors.noClient");
    }

    if (lignesActives.length === 0) {
      errs.lignes = t("errors.noLigne");
    }

    for (const l of lignes) {
      const qte = Number(l.quantite) || 0;
      if (qte <= 0) continue;
      if (qte > l.vivants) {
        errs[`quantite-${l.bacId}`] = t("errors.quantiteExcede");
      }
      const poids = Number(l.poidsMoyenG) || 0;
      if (poids <= 0) {
        errs[`poids-${l.bacId}`] = t("errors.poidsInvalide");
      }
      const prix = Number(l.prixUnitaireKg);
      if (isNaN(prix) || prix < 0) {
        errs[`prix-${l.bacId}`] = t("errors.poidsInvalide");
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    const body: CreateVenteAlevinsDepuisVagueDTO = {
      vagueId,
      clientId,
      dateCommande: new Date(dateCommande).toISOString(),
      lignes: lignesActives.map((l) => ({
        bacId: l.bacId,
        nombrePoissons: Number(l.quantite),
        poidsMoyenG: Number(l.poidsMoyenG),
        prixUnitaireKg: Number(l.prixUnitaireKg),
      })),
      autoCloture: canAutoCloture ? autoCloture : false,
    };

    if (depenses.length > 0) {
      const validDepenses = depenses.filter(
        (d) => d.description.trim() !== "" && Number(d.montantTotal) > 0
      );
      if (validDepenses.length > 0) {
        body.depenses = validDepenses.map(
          (d): DepenseVenteInput => ({
            description: d.description.trim(),
            categorieDepense: d.categorieDepense,
            montantTotal: Number(d.montantTotal),
          })
        );
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/vagues/${vagueId}/vente-alevins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        let message: string = data.error ?? data.message ?? t("errors.generic");
        if (data.details?.ecart != null) {
          message += ` (${t("errors.ecart", { ecart: data.details.ecart })})`;
        }
        setError(message);
        return;
      }

      toast({ title: t("success"), variant: "success" });
      setOpen(false);
      resetForm();
      router.refresh();
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  const isValid = clientId !== "" && lignesActives.length > 0 && dateCommande !== "";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle", { code: vagueCode })}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <DialogBody>
            <div className="flex flex-col gap-4 pb-2">
              {/* Client */}
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger
                  label={t("clientLabel")}
                  required
                  error={fieldErrors.clientId}
                >
                  <SelectValue placeholder={t("clientPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        {c.nom}
                        {c.isSysteme && (
                          <Badge variant="info" className="ml-1">
                            {t("clientSysteme")}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Date commande */}
              <Input
                id="dateCommande"
                label={t("dateLabel")}
                type="date"
                value={dateCommande}
                onChange={(e) => setDateCommande(e.target.value)}
                required
              />

              {/* Table bacs */}
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">{t("tableHeaders.bac")}</h3>
                {fieldErrors.lignes && (
                  <p className="text-sm text-destructive">{fieldErrors.lignes}</p>
                )}
                {lignes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("errors.noLigne")}</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {lignes.map((l) => (
                      <li
                        key={l.bacId}
                        className="flex flex-col gap-2 rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{l.bacNom}</span>
                          <span className="text-xs text-muted-foreground">
                            {t("tableHeaders.vivants")}: {l.vivants}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            id={`quantite-${l.bacId}`}
                            label={t("tableHeaders.quantite")}
                            type="number"
                            min="0"
                            max={l.vivants}
                            step="1"
                            value={l.quantite}
                            onChange={(e) => updateLigne(l.bacId, { quantite: e.target.value })}
                            error={fieldErrors[`quantite-${l.bacId}`]}
                          />
                          <Input
                            id={`poids-${l.bacId}`}
                            label={t("tableHeaders.poidsMoyen")}
                            type="number"
                            min="0"
                            step="0.1"
                            value={l.poidsMoyenG}
                            onChange={(e) => updateLigne(l.bacId, { poidsMoyenG: e.target.value })}
                            error={fieldErrors[`poids-${l.bacId}`]}
                          />
                          <Input
                            id={`prix-${l.bacId}`}
                            label={t("tableHeaders.prixKg")}
                            type="number"
                            min="0"
                            step="1"
                            value={l.prixUnitaireKg}
                            onChange={(e) => updateLigne(l.bacId, { prixUnitaireKg: e.target.value })}
                            error={fieldErrors[`prix-${l.bacId}`]}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Auto-cloture */}
              <label
                className={`flex items-center gap-2 text-sm ${
                  canAutoCloture ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={autoCloture}
                  disabled={!canAutoCloture}
                  onChange={(e) => setAutoCloture(e.target.checked)}
                />
                {t("autoClotureLabel")}
              </label>

              {/* Depenses collapsible */}
              <div className="rounded-lg border border-border">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold"
                  onClick={() => setDepensesOpen((v) => !v)}
                >
                  {t("depensesTitle")}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${depensesOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {depensesOpen && (
                  <div className="flex flex-col gap-2 border-t border-border p-3">
                    {depenses.map((d, i) => (
                      <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-2">
                        <div className="flex items-center justify-between gap-2">
                          <Input
                            placeholder={t("depenseDescriptionPlaceholder")}
                            value={d.description}
                            onChange={(e) => updateDepense(i, { description: e.target.value })}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 shrink-0 text-destructive"
                            onClick={() => removeDepense(i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            min="0"
                            placeholder="Montant"
                            value={d.montantTotal}
                            onChange={(e) => updateDepense(i, { montantTotal: e.target.value })}
                          />
                          <Select
                            value={d.categorieDepense}
                            onValueChange={(v) => updateDepense(i, { categorieDepense: v as CategorieDepense })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPENSE_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addDepense}>
                      <Plus className="h-4 w-4" />
                      {t("depensesTitle")}
                    </Button>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
                <span className="text-sm font-medium">{t("totalLabel")}</span>
                <span className="text-base font-semibold">{formatNum(total, 0)} FCFA</span>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              {t("cancelButton")}
            </Button>
            <Button type="submit" disabled={loading || !isValid} className="min-h-[44px]">
              {loading ? "..." : t("confirmButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
