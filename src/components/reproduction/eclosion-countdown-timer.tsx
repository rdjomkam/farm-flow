"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { StatutIncubation } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  dateEclosionPrevue: string | Date;
  statut: StatutIncubation | string;
}

interface CountdownState {
  jours: number;
  heures: number;
  minutes: number;
  secondes: number;
  imminente: boolean;
  passee: boolean;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function computeCountdown(target: Date): CountdownState {
  const now = Date.now();
  const diff = target.getTime() - now;

  if (diff <= 0) {
    return { jours: 0, heures: 0, minutes: 0, secondes: 0, imminente: true, passee: true };
  }

  const totalSecondes = Math.floor(diff / 1000);
  const jours = Math.floor(totalSecondes / 86400);
  const heures = Math.floor((totalSecondes % 86400) / 3600);
  const minutes = Math.floor((totalSecondes % 3600) / 60);
  const secondes = totalSecondes % 60;

  return { jours, heures, minutes, secondes, imminente: false, passee: false };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EclosionCountdownTimer — Affiche un compte a rebours jusqu'a l'eclosion prevue.
 *
 * Comportement :
 * - statut EN_COURS + date future : compte a rebours en temps reel (Jh Mm Ss)
 * - statut EN_COURS + date passee : "Eclosion imminente !" en amber
 * - statut TERMINEE : "Eclosion terminee" avec checkmark vert
 * - Autres statuts : rien affiche
 *
 * Mobile-first : grands chiffres lisibles, padding genereux.
 */
export function EclosionCountdownTimer({ dateEclosionPrevue, statut }: Props) {
  const targetDate = new Date(dateEclosionPrevue);

  const [countdown, setCountdown] = useState<CountdownState>(() =>
    computeCountdown(targetDate)
  );

  useEffect(() => {
    if (statut !== StatutIncubation.EN_COURS && statut !== StatutIncubation.ECLOSION_EN_COURS) {
      return;
    }

    // Calcul initial immediat
    setCountdown(computeCountdown(targetDate));

    const interval = setInterval(() => {
      setCountdown(computeCountdown(targetDate));
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateEclosionPrevue, statut]);

  // Eclosion terminee
  if (statut === StatutIncubation.TERMINEE) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[var(--accent-green-muted,#d1fae5)] px-4 py-3">
        <CheckCircle2 className="h-5 w-5 text-[var(--accent-green,#10b981)] shrink-0" />
        <span className="text-sm font-medium text-[var(--accent-green,#10b981)]">
          Eclosion terminee
        </span>
      </div>
    );
  }

  // Statuts non actifs — rien a afficher
  if (statut !== StatutIncubation.EN_COURS && statut !== StatutIncubation.ECLOSION_EN_COURS) {
    return null;
  }

  // Eclosion imminente (date passee)
  if (countdown.imminente) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--accent-amber,#f59e0b)]/40 bg-[var(--accent-amber-muted,#fef3c7)] px-4 py-3">
        <AlertTriangle className="h-5 w-5 text-[var(--accent-amber,#f59e0b)] shrink-0 animate-pulse" />
        <span className="text-sm font-semibold text-[var(--accent-amber,#f59e0b)]">
          Eclosion imminente !
        </span>
      </div>
    );
  }

  // Compte a rebours actif
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Eclosion prevue dans
        </span>
      </div>
      <div className="flex items-end gap-3 justify-center">
        {countdown.jours > 0 && (
          <CountdownBlock value={countdown.jours} unit="j" />
        )}
        <CountdownBlock value={countdown.heures} unit="h" />
        <CountdownBlock value={countdown.minutes} unit="m" />
        <CountdownBlock value={countdown.secondes} unit="s" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function CountdownBlock({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex flex-col items-center min-w-[48px]">
      <span className="text-2xl font-bold tabular-nums leading-none">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-xs text-muted-foreground mt-0.5">{unit}</span>
    </div>
  );
}
