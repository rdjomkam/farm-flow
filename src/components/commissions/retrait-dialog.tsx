"use client";
/**
 * src/components/commissions/retrait-dialog.tsx
 *
 * Dialog de demande de retrait du portefeuille.
 * Montant max = solde disponible, numéro de téléphone, fournisseur.
 * Récapitulatif avant confirmation.
 *
 * Story 34.3 — Sprint 34
 * R5 : DialogTrigger asChild
 * R6 : CSS variables du thème
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FournisseurPaiement } from "@/types";
import { useTranslations } from "next-intl";

interface RetraitDialogProps {
  soldeDisponible: number;
}

const FOURNISSEURS = [
  { value: FournisseurPaiement.MTN_MOMO, label: "MTN Mobile Money" },
  { value: FournisseurPaiement.ORANGE_MONEY, label: "Orange Money" },
  { value: FournisseurPaiement.SMOBILPAY, label: "Smobilpay" },
];

function formatXAF(amount: number) {
  return new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RetraitDialog({ soldeDisponible }: RetraitDialogProps) {
  const t = useTranslations("commissions");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [montant, setMontant] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [fournisseur, setFournisseur] = useState<FournisseurPaiement>(
    FournisseurPaiement.MTN_MOMO
  );

  function handleReset() {
    setStep("form");
    setError(null);
    setMontant("");
    setPhoneNumber("");
    setFournisseur(FournisseurPaiement.MTN_MOMO);
  }

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) handleReset();
  }

  function handleNext() {
    setError(null);
    const montantNum = Number(montant);
    if (!montant || isNaN(montantNum) || montantNum <= 0) {
      setError(t("retraits.dialog.errors.montantInvalide"));
      return;
    }
    if (montantNum < 5000) {
      setError(t("retraits.dialog.errors.montantMinimum"));
      return;
    }
    if (montantNum > soldeDisponible) {
      setError(t("retraits.dialog.errors.montantDepasse", { amount: formatXAF(soldeDisponible) }));
      return;
    }
    if (!phoneNumber.trim()) {
      setError(t("retraits.dialog.errors.telephoneRequis"));
      return;
    }
    setStep("confirm");
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/portefeuille/retrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          montant: Number(montant),
          phoneNumber: phoneNumber.trim(),
          fournisseur,
        }),
      });
      const data = await response.json() as { status?: number; message?: string };
      if (!response.ok) {
        setError(data.message ?? t("retraits.dialog.errors.erreurRetrait"));
        setStep("form");
        return;
      }
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.commissions.all });
    } catch {
      setError(t("retraits.dialog.errors.erreurReseau"));
      setStep("form");
    } finally {
      setLoading(false);
    }
  }

  const fournisseurLabel = FOURNISSEURS.find((f) => f.value === fournisseur)?.label ?? fournisseur;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* R5 : DialogTrigger asChild */}
      <DialogTrigger asChild>
        <button
          className="w-full mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
          type="button"
        >
          {t("portefeuille.demanderRetrait")}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-sm mx-auto">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("retraits.dialog.title")}</DialogTitle>
              <DialogDescription>
                {t("retraits.dialog.soldeDisponible", { amount: formatXAF(soldeDisponible) })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  {error}
                </p>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="montant-retrait">
                  {t("retraits.dialog.montant")}
                </label>
                <input
                  id="montant-retrait"
                  type="number"
                  min={5000}
                  max={soldeDisponible}
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder={t("retraits.dialog.montantPlaceholder")}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="phone-retrait">
                  {t("retraits.dialog.telephone")}
                </label>
                <input
                  id="phone-retrait"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t("retraits.dialog.telephonePlaceholder")}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="fournisseur-retrait">
                  {t("retraits.dialog.fournisseur")}
                </label>
                <select
                  id="fournisseur-retrait"
                  value={fournisseur}
                  onChange={(e) => setFournisseur(e.target.value as FournisseurPaiement)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {FOURNISSEURS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                {t("retraits.dialog.annuler")}
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                {t("retraits.dialog.suivant")}
              </button>
            </DialogFooter>
          </>
        )}

        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("retraits.dialog.confirmTitle")}</DialogTitle>
              <DialogDescription>
                {t("retraits.dialog.confirmDescription")}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  {error}
                </p>
              )}
              <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("retraits.dialog.confirmMontant")}</span>
                  <span className="font-semibold text-foreground">{formatXAF(Number(montant))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("retraits.dialog.confirmNumero")}</span>
                  <span className="font-medium text-foreground">{phoneNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("retraits.dialog.confirmVia")}</span>
                  <span className="font-medium text-foreground">{fournisseurLabel}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("retraits.dialog.virementInfo")}
              </p>
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={() => setStep("form")}
                disabled={loading}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                {t("retraits.dialog.retour")}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? t("retraits.dialog.envoi") : t("retraits.dialog.confirmer")}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
