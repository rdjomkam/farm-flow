"use client";

/**
 * src/components/abonnements/checkout-form.tsx
 *
 * Formulaire de souscription en 3 étapes.
 * Client Component — gère l'état des étapes, le polling et les appels API.
 *
 * Étape 1 : Sélection de la période + code promo
 * Étape 2 : Mode de paiement + numéro de téléphone
 * Étape 3 : Confirmation et attente (polling statut paiement)
 *
 * Story 33.2 — Sprint 33
 * R2 : enums importés depuis @/types
 * R5 : pas de Dialog dans les étapes
 * R6 : CSS variables du thème
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Loader2, AlertCircle, Phone, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TypePlan,
  PeriodeFacturation,
  FournisseurPaiement,
  StatutPaiementAbo,
} from "@/types";
import type { PlanAbonnement } from "@/types";
import {
  PLAN_TARIFS,
  PLAN_LABELS,
  PERIODE_LABELS,
  FOURNISSEUR_LABELS,
  calculerMontantRemise,
} from "@/lib/abonnements-constants";
import { formatXAF, formatXAFOrFree } from "@/lib/format";

interface CheckoutFormProps {
  plan: PlanAbonnement;
  isRenouvellement: boolean;
}

type Etape = 1 | 2 | 3;

interface RemiseInfo {
  id: string;
  nom: string;
  code: string;
  valeur: number;
  estPourcentage: boolean;
}

// Périodes disponibles pour ce plan
function getPeriodesDisponibles(plan: PlanAbonnement): PeriodeFacturation[] {
  return ([
    PeriodeFacturation.MENSUEL,
    PeriodeFacturation.TRIMESTRIEL,
    PeriodeFacturation.ANNUEL,
  ] as PeriodeFacturation[]).filter((p) => {
    const tarif = PLAN_TARIFS[plan.typePlan]?.[p];
    return tarif !== undefined && tarif !== null;
  });
}

// Format téléphone Cameroun +237 6XX XX XX XX
function isValidPhone(phone: string): boolean {
  const normalized = phone.replace(/\s/g, "");
  return /^\+2376[5-9]\d{7}$/.test(normalized) || /^6[5-9]\d{7}$/.test(normalized);
}

// Barre de progression des étapes
function StepProgress({ etape, t }: { etape: Etape; t: ReturnType<typeof useTranslations> }) {
  const steps = [
    { num: 1, label: t("checkoutForm.stepPlanPeriod") },
    { num: 2, label: t("checkoutForm.stepPayment") },
    { num: 3, label: t("checkoutForm.stepConfirmation") },
  ];
  return (
    <ol
      className="flex items-center gap-2 mb-6"
      role="list"
      aria-label="Étapes du paiement"
    >
      {steps.map((step, i) => (
        <li
          key={step.num}
          role="listitem"
          aria-current={step.num === etape ? "step" : undefined}
          className="flex items-center flex-1"
        >
          <div className="flex flex-col items-center flex-1">
            <div
              className={[
                "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors",
                step.num < etape
                  ? "bg-success text-white"
                  : step.num === etape
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}
              aria-label={`Étape ${step.num}: ${step.label}${step.num === etape ? " (étape en cours)" : step.num < etape ? " (terminée)" : ""}`}
            >
              {step.num < etape ? <Check className="h-4 w-4" /> : step.num}
            </div>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{step.label}</p>
          </div>
          {i < steps.length - 1 && (
            <div
              className={[
                "h-0.5 flex-1 mx-1 transition-colors",
                step.num < etape ? "bg-success" : "bg-muted",
              ].join(" ")}
              aria-hidden="true"
            />
          )}
        </li>
      ))}
    </ol>
  );
}

export function CheckoutForm({ plan, isRenouvellement }: CheckoutFormProps) {
  const router = useRouter();
  const t = useTranslations("abonnements");
  const [etape, setEtape] = useState<Etape>(1);

  // Étape 1
  const periodesDisponibles = getPeriodesDisponibles(plan);
  const [periode, setPeriode] = useState<PeriodeFacturation>(
    periodesDisponibles[0] ?? PeriodeFacturation.MENSUEL
  );
  const [codePromo, setCodePromo] = useState("");
  const [remise, setRemise] = useState<RemiseInfo | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Étape 2
  const [fournisseur] = useState<FournisseurPaiement>(FournisseurPaiement.SMOBILPAY);
  const [telephone, setTelephone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Étape 3
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paiementId, setPaiementId] = useState<string | null>(null);
  const [statutPaiement, setStatutPaiement] = useState<StatutPaiementAbo | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingCountRef = useRef(0);

  // Calcul du prix
  const tarifBase = PLAN_TARIFS[plan.typePlan]?.[periode] ?? 0;
  const prixFinal = remise
    ? calculerMontantRemise(tarifBase, {
        ...remise,
        dateDebut: new Date(),
        dateFin: null,
        limiteUtilisations: null,
        nombreUtilisations: 0,
        isActif: true,
        siteId: null,
        userId: "",
        planId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "EARLY_ADOPTER" as import("@/types").TypeRemise,
      })
    : tarifBase;

  // Vérification du code promo avec debounce
  const verifierPromo = useCallback(async (code: string) => {
    if (!code.trim()) {
      setRemise(null);
      setPromoError(null);
      return;
    }
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await fetch(`/api/remises/verifier?code=${encodeURIComponent(code.trim())}`);
      const data = await res.json();
      if (data.valide && data.remise) {
        setRemise(data.remise);
        setPromoError(null);
      } else {
        setRemise(null);
        setPromoError(data.message ?? t("checkoutForm.promoInvalid"));
      }
    } catch {
      setRemise(null);
      setPromoError(t("errors.promoVerificationFailed"));
    } finally {
      setPromoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      verifierPromo(codePromo);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [codePromo, verifierPromo]);

  // Nettoyage du polling au unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Validation étape 2
  function validerTelephone(): boolean {
    if (!telephone.trim()) {
      setPhoneError(t("checkoutForm.phoneRequired"));
      return false;
    }
    if (!isValidPhone(telephone)) {
      setPhoneError(t("checkoutForm.phoneInvalid"));
      return false;
    }
    setPhoneError(null);
    return true;
  }

  // Souscription — Étape 3
  async function souscire() {
    if (!validerTelephone()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/abonnements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.id,
          periode,
          fournisseur,
          phoneNumber: telephone.trim(),
          remiseCode: remise?.code ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message ?? t("checkoutForm.subscriptionError"));
        setLoading(false);
        return;
      }

      const pid = data.paiement?.paiementId;
      if (!pid) {
        setError(t("errors.paymentInitFailed"));
        setLoading(false);
        return;
      }

      setPaiementId(pid);
      setStatutPaiement(data.paiement.statut as StatutPaiementAbo);
      setEtape(3);

      // Démarrer le polling
      lancerPolling(pid);
    } catch {
      setError(t("errors.networkErrorPayment"));
    } finally {
      setLoading(false);
    }
  }

  function lancerPolling(pid: string) {
    pollingCountRef.current = 0;
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      pollingCountRef.current += 1;

      // Arrêt après 10 tentatives (50s)
      if (pollingCountRef.current >= 10) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setStatutPaiement(StatutPaiementAbo.ECHEC);
        return;
      }

      try {
        const res = await fetch(`/api/paiements/${pid}/verifier`);
        const data = await res.json();
        const statut = data.statut as StatutPaiementAbo;
        setStatutPaiement(statut);

        if (statut === StatutPaiementAbo.CONFIRME) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setTimeout(() => router.push("/mon-abonnement"), 1500);
        } else if (statut === StatutPaiementAbo.ECHEC || statut === StatutPaiementAbo.EXPIRE) {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // Continuer le polling en cas d'erreur réseau temporaire
      }
    }, 5000);
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // --- RENDU ---

  if (etape === 1) {
    return (
      <div>
        <StepProgress etape={1} t={t} />

        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          {/* Plan sélectionné */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {t("checkoutForm.selectedPlan")}
            </p>
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex-1">
                <p className="font-semibold text-foreground">{t(PLAN_LABELS[plan.typePlan])}</p>
                {plan.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Sélection de la période */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {t("changerPlan.billingPeriod")}
            </p>
            <div className="grid gap-2">
              {periodesDisponibles.map((p) => {
                const tarif = PLAN_TARIFS[plan.typePlan]?.[p] ?? 0;
                return (
                  <label
                    key={p}
                    className={[
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors min-h-[52px]",
                      periode === p
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="periode"
                      value={p}
                      checked={periode === p}
                      onChange={() => setPeriode(p)}
                      className="text-primary"
                    />
                    <div className="flex-1 flex justify-between items-center">
                      <span className="font-medium text-sm text-foreground">
                        {t(PERIODE_LABELS[p])}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formatXAFOrFree(tarif)}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Code promo */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {t("checkoutForm.promoCode")}
            </p>
            <div className="relative">
              <Input
                type="text"
                placeholder={t("checkoutForm.promoPlaceholder")}
                value={codePromo}
                onChange={(e) => setCodePromo(e.target.value.toUpperCase())}
                className="pr-10"
              />
              {promoLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {promoError && (
              <p className="text-xs text-danger mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {promoError}
              </p>
            )}
            {remise && (
              <p className="text-xs text-success mt-1 flex items-center gap-1">
                <Check className="h-3 w-3" />
                {remise.nom} — {remise.estPourcentage ? `${remise.valeur}% ${t("checkoutForm.discount")}` : `${formatXAF(remise.valeur)} ${t("checkoutForm.discount")}`}
              </p>
            )}
          </div>

          {/* Récapitulatif prix */}
          {remise && tarifBase > 0 && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("checkoutForm.basePrice")}</span>
                <span className="line-through text-muted-foreground">{formatXAFOrFree(tarifBase)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">{t("checkoutForm.reduction")}</span>
                <span className="text-success">-{formatXAF(tarifBase - prixFinal)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-success/20">
                <span className="text-foreground">{t("checkoutForm.total")}</span>
                <span className="text-foreground">{formatXAFOrFree(prixFinal)}</span>
              </div>
            </div>
          )}

          <Button
            className="w-full min-h-[44px]"
            onClick={() => {
              setEtape(2);
              scrollTop();
            }}
          >
            {t("checkoutForm.continue")}
          </Button>
        </div>
      </div>
    );
  }

  if (etape === 2) {
    return (
      <div>
        <StepProgress etape={2} t={t} />

        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          {/* Résumé */}
          <div className="bg-muted/40 rounded-lg p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("checkoutForm.plan")}</span>
              <span className="font-medium text-foreground">{t(PLAN_LABELS[plan.typePlan])}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">{t("checkoutForm.period")}</span>
              <span className="font-medium text-foreground">{t(PERIODE_LABELS[periode])}</span>
            </div>
            <div className="flex justify-between text-sm mt-1 pt-1 border-t border-border">
              <span className="font-medium text-foreground">{t("checkoutForm.total")}</span>
              <span className="font-bold text-foreground">{formatXAFOrFree(prixFinal)}</span>
            </div>
          </div>

          {/* Fournisseur de paiement */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {t("checkoutForm.paymentMode")}
            </p>
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm text-foreground">
                  {t(FOURNISSEUR_LABELS[fournisseur])}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("checkoutForm.securePayment")}
                </p>
              </div>
            </div>
          </div>

          {/* Numéro de téléphone */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {t("checkoutForm.mobileMoneyPhone")}
            </p>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="+237 6XX XX XX XX"
                value={telephone}
                onChange={(e) => {
                  setTelephone(e.target.value);
                  setPhoneError(null);
                }}
                className="pl-10"
                autoComplete="tel"
              />
            </div>
            {phoneError && (
              <p className="text-xs text-danger mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {phoneError}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {t("checkoutForm.phoneFormatHint")}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 min-h-[44px]"
              onClick={() => {
                setEtape(1);
                scrollTop();
              }}
            >
              {t("checkoutForm.back")}
            </Button>
            <Button
              className="flex-1 min-h-[44px]"
              onClick={() => {
                if (validerTelephone()) {
                  souscire();
                }
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t("checkoutForm.initiating")}
                </>
              ) : (
                t("checkoutForm.payNow")
              )}
            </Button>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Étape 3 — Confirmation et attente
  const isConfirme = statutPaiement === StatutPaiementAbo.CONFIRME;
  const isEchec =
    statutPaiement === StatutPaiementAbo.ECHEC ||
    statutPaiement === StatutPaiementAbo.EXPIRE;
  const isEnAttente =
    !isConfirme &&
    !isEchec &&
    (statutPaiement === StatutPaiementAbo.INITIE ||
      statutPaiement === StatutPaiementAbo.EN_ATTENTE ||
      loading);

  return (
    <div>
      <StepProgress etape={3} t={t} />

      <div className="bg-card border border-border rounded-xl p-6 text-center space-y-4">
        {isConfirme && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success/15 mx-auto">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{t("checkoutForm.paymentConfirmedTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("checkoutForm.subscriptionActive")}
            </p>
          </>
        )}

        {isEchec && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-danger/15 mx-auto">
              <AlertCircle className="h-8 w-8 text-danger" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{t("checkoutForm.paymentFailedTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("checkoutForm.paymentFailed")}
            </p>
            <Button
              className="w-full min-h-[44px]"
              onClick={() => {
                setEtape(2);
                setStatutPaiement(null);
                setPaiementId(null);
                setError(null);
                scrollTop();
              }}
            >
              {t("checkoutForm.retry")}
            </Button>
          </>
        )}

        {isEnAttente && (
          <>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/15 mx-auto">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{t("checkoutForm.paymentPendingTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("checkoutForm.paymentPendingDesc")}
            </p>
            <div className="bg-muted/50 rounded-lg p-3 text-left">
              <p className="text-xs text-muted-foreground">{t("checkoutForm.phoneNumberLabel")}</p>
              <p className="font-medium text-sm text-foreground">{telephone}</p>
              <p className="text-xs text-muted-foreground mt-2">{t("checkoutForm.amountLabel")}</p>
              <p className="font-bold text-sm text-foreground">{formatXAFOrFree(prixFinal)}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("checkoutForm.pollingStatus", { count: pollingCountRef.current })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
