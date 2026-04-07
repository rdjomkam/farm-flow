"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useApi } from "@/hooks/use-api";
import { PhaseLot } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ordered phases — SORTI is terminal, not clickable as next phase */
const PHASE_ORDER: PhaseLot[] = [
  PhaseLot.INCUBATION,
  PhaseLot.LARVAIRE,
  PhaseLot.NURSERIE,
  PhaseLot.ALEVINAGE,
  PhaseLot.SORTI,
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LotPhaseStepperProps {
  lotId: string;
  currentPhase: PhaseLot;
  /** Whether the user has permission to advance the phase */
  canModify: boolean;
  /** Called after a successful phase change */
  onPhaseChange: () => void;
  /** Controlled open state for the confirmation dialog */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LotPhaseStepper({
  lotId,
  currentPhase,
  canModify,
  onPhaseChange,
  open,
  onOpenChange,
}: LotPhaseStepperProps) {
  const t = useTranslations("reproduction.lots");
  const { call } = useApi();

  const [selectedPhase, setSelectedPhase] = useState<PhaseLot | null>(null);
  const [loading, setLoading] = useState(false);

  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  const phaseLabels: Record<PhaseLot, string> = {
    [PhaseLot.INCUBATION]: t("phases.INCUBATION"),
    [PhaseLot.LARVAIRE]: t("phases.LARVAIRE"),
    [PhaseLot.NURSERIE]: t("phases.NURSERIE"),
    [PhaseLot.ALEVINAGE]: t("phases.ALEVINAGE"),
    [PhaseLot.SORTI]: t("phases.SORTI"),
    [PhaseLot.PERDU]: t("phases.PERDU"),
  };

  function handlePhaseClick(phase: PhaseLot, index: number) {
    if (!canModify) return;
    if (index <= currentIndex) return; // can't go backward
    if (phase === PhaseLot.SORTI) return; // use the Sortir button instead
    setSelectedPhase(phase);
    onOpenChange(true);
  }

  async function handleConfirm() {
    if (!selectedPhase) return;
    setLoading(true);
    const result = await call(
      `/api/reproduction/lots/${lotId}/phase`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: selectedPhase }),
      },
      { successMessage: t("stepper.successMessage") }
    );
    setLoading(false);
    if (result.ok) {
      onOpenChange(false);
      setSelectedPhase(null);
      onPhaseChange();
    }
  }

  function handleDialogClose(isOpen: boolean) {
    if (!isOpen) {
      setSelectedPhase(null);
    }
    onOpenChange(isOpen);
  }

  return (
    <>
      {/* Visual stepper */}
      <div className="w-full overflow-x-auto -mx-4 px-4">
        <div className="flex items-center min-w-max gap-0">
          {PHASE_ORDER.map((phase, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isNext = index === currentIndex + 1 && phase !== PhaseLot.SORTI;
            const isClickable = canModify && isNext;

            return (
              <div key={phase} className="flex items-center">
                {/* Step circle */}
                <button
                  type="button"
                  onClick={() => handlePhaseClick(phase, index)}
                  disabled={!isClickable}
                  aria-label={`${phaseLabels[phase]}${isClickable ? ` — ${t("stepper.avancerVers")}` : ""}`}
                  className={[
                    "flex flex-col items-center gap-1 px-2",
                    isClickable
                      ? "cursor-pointer hover:opacity-80 transition-opacity"
                      : "cursor-default",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : isCurrent
                          ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                          : isNext
                            ? "border-2 border-primary text-primary"
                            : "border-2 border-muted text-muted-foreground bg-background",
                    ].join(" ")}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={[
                      "text-xs text-center max-w-[60px] leading-tight",
                      isCurrent
                        ? "text-primary font-semibold"
                        : isCompleted
                          ? "text-muted-foreground"
                          : isNext
                            ? "text-primary"
                            : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {phaseLabels[phase]}
                  </span>
                </button>

                {/* Connector line */}
                {index < PHASE_ORDER.length - 1 && (
                  <div
                    className={[
                      "h-0.5 w-6 flex-shrink-0 transition-colors",
                      index < currentIndex ? "bg-primary" : "bg-muted",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("stepper.changerPhaseTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {selectedPhase
              ? t("stepper.confirmPhaseChange", {
                  phase: phaseLabels[selectedPhase],
                })
              : ""}
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="min-h-[44px]">
                {t("stepper.annuler")}
              </Button>
            </DialogClose>
            <Button
              onClick={handleConfirm}
              disabled={loading || !selectedPhase}
              className="min-h-[44px]"
            >
              {loading ? t("stepper.loading") : t("stepper.confirmer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
