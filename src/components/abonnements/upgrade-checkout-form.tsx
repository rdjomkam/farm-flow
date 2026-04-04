"use client";

/**
 * src/components/abonnements/upgrade-checkout-form.tsx
 *
 * Formulaire de paiement pour l'upgrade de plan.
 * Affiche le calcul prorata et initie le paiement.
 *
 * Story 50.6 — Sprint 50
 * R2 : enums importés depuis @/types
 * R5 : DialogTrigger asChild
 * R6 : CSS variables du thème
 * Mobile-first (360px)
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, TrendingUp, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FournisseurPaiement, PeriodeFacturation, TypePlan } from "@/types";
import type { PlanAbonnement } from "@/types";
import {
  PLAN_TARIFS,
  PLAN_LABELS,
  PERIODE_LABELS,
  FOURNISSEUR_LABELS,
} from "@/lib/abonnements-constants";
import { calculerCreditRestant, calculerDeltaUpgrade } from "@/lib/abonnements/prorata";
import { formatXAF } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpgradeCheckoutFormProps {
  /** Abonnement actuel */
  abonnementActuel: {
    id: string;
    planId: string;
    periode: PeriodeFacturation;
    prixPaye: number;
    dateDebut: Date;
    dateFin: Date;
    plan: PlanAbonnement;
  };
  /** Nouveau plan cible */
  nouveauPlan: PlanAbonnement;
  /** Période sélectionnée pour le nouveau plan */
  periode: PeriodeFacturation;
  /** Solde crédit actuel de l'utilisateur */
  soldeCreditActuel: number;
}

// ---------------------------------------------------------------------------
// UpgradeCheckoutForm
// ---------------------------------------------------------------------------

export function UpgradeCheckoutForm({
  abonnementActuel,
  nouveauPlan,
  periode,
  soldeCreditActuel,
}: UpgradeCheckoutFormProps) {
  const router = useRouter();
  const t = useTranslations("abonnements");
  const [fournisseur, setFournisseur] = useState<FournisseurPaiement>(
    FournisseurPaiement.MTN_MOMO
  );
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Calculer le prorata
  const aujourdhui = new Date();
  const creditProrata = calculerCreditRestant(
    abonnementActuel.prixPaye,
    abonnementActuel.dateDebut,
    abonnementActuel.dateFin,
    aujourdhui
  );

  // Calculer le prix du nouveau plan
  // R2/ERR-031 : cast as TypePlan
  const tarifsNouveauPlan = PLAN_TARIFS[nouveauPlan.typePlan as TypePlan];
  const prixNouveauPlan = (tarifsNouveauPlan?.[periode] ?? 0) as number;

  const delta = calculerDeltaUpgrade(creditProrata, prixNouveauPlan, soldeCreditActuel);
  const upgradeGratuit = delta.montantAPayer === 0;

  const FOURNISSEURS_DISPONIBLES = [
    FournisseurPaiement.MTN_MOMO,
    FournisseurPaiement.ORANGE_MONEY,
    FournisseurPaiement.SMOBILPAY,
  ];

  const handleUpgrade = async () => {
    if (!upgradeGratuit && !phoneNumber.trim()) {
      setError(t("upgradeForm.phoneRequired"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/abonnements/${abonnementActuel.id}/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nouveauPlanId: nouveauPlan.id,
          periode,
          fournisseur: upgradeGratuit ? undefined : fournisseur,
          phoneNumber: upgradeGratuit ? undefined : phoneNumber.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message ?? t("upgradeForm.upgradeError"));
      }

      setSuccess(true);

      // Rediriger vers la page abonnement après 2s
      setTimeout(() => {
        router.push("/mon-abonnement");
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("upgradeForm.unknownError"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">{t("upgradeForm.upgradeSuccess")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {upgradeGratuit
              ? t("upgradeForm.upgradeFreeSuccess")
              : t("upgradeForm.upgradePaidSuccess")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Résumé du calcul prorata */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" />
          {t("upgradeForm.summaryTitle")}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{t("upgradeForm.currentPlan")}</span>
            <span className="font-medium text-foreground">
              {PLAN_LABELS[abonnementActuel.plan.typePlan as TypePlan]}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t("upgradeForm.newPlan")}</span>
            <span className="font-medium text-foreground">
              {PLAN_LABELS[nouveauPlan.typePlan as TypePlan]}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t("upgradeForm.period")}</span>
            <span className="font-medium text-foreground">
              {PERIODE_LABELS[periode]}
            </span>
          </div>

          <hr className="border-border" />

          <div className="flex justify-between text-muted-foreground">
            <span>{t("upgradeForm.newPlanPrice")}</span>
            <span className="font-medium text-foreground">
              {formatXAF(prixNouveauPlan)}
            </span>
          </div>
          {creditProrata > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("upgradeForm.prorataCredit")}</span>
              <span className="font-medium text-success">
                -{formatXAF(creditProrata)}
              </span>
            </div>
          )}
          {soldeCreditActuel > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("upgradeForm.creditBalance")}</span>
              <span className="font-medium text-success">
                -{formatXAF(Math.min(soldeCreditActuel, prixNouveauPlan - creditProrata))}
              </span>
            </div>
          )}

          <hr className="border-border" />

          <div className="flex justify-between text-base font-semibold">
            <span className="text-foreground">
              {upgradeGratuit ? t("upgradeForm.amountDue") : t("upgradeForm.amountToPay")}
            </span>
            <span className={upgradeGratuit ? "text-primary" : "text-foreground"}>
              {upgradeGratuit ? t("upgradeForm.free") : formatXAF(delta.montantAPayer)}
            </span>
          </div>

          {upgradeGratuit && delta.creditRestant > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t("upgradeForm.creditAfterUpgrade")}</span>
              <span className="font-medium text-success">
                {formatXAF(delta.creditRestant)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Formulaire de paiement (uniquement si montant > 0) */}
      {!upgradeGratuit && (
        <div className="space-y-4">
          {/* Sélection du fournisseur */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t("upgradeForm.paymentMode")}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {FOURNISSEURS_DISPONIBLES.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFournisseur(f)}
                  className={[
                    "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                    fournisseur === f
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:bg-muted/50",
                  ].join(" ")}
                >
                  {FOURNISSEUR_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Numéro de téléphone */}
          <div className="space-y-2">
            <label
              htmlFor="phone-upgrade"
              className="block text-sm font-medium text-foreground"
            >
              {t("upgradeForm.mobileMoneyNumber")}
            </label>
            <Input
              id="phone-upgrade"
              type="tel"
              placeholder="6XXXXXXXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="min-h-[44px]"
              autoComplete="tel"
            />
            <p className="text-xs text-muted-foreground">
              {t("upgradeForm.phoneFormat")}
            </p>
          </div>
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bouton de confirmation */}
      <Button
        type="button"
        onClick={handleUpgrade}
        disabled={loading || (!upgradeGratuit && !phoneNumber.trim())}
        className="w-full min-h-[44px]"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("upgradeForm.processing")}
          </>
        ) : upgradeGratuit ? (
          t("upgradeForm.confirmFreeUpgrade")
        ) : (
          t("upgradeForm.payAmount", { amount: formatXAF(delta.montantAPayer) })
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {upgradeGratuit
          ? t("upgradeForm.upgradeEffectiveNow")
          : t("upgradeForm.paymentRequestSent")}
      </p>
    </div>
  );
}
