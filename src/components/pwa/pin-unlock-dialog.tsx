"use client";

import { useState, useRef, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Lock, AlertTriangle } from "lucide-react";

interface PinUnlockDialogProps {
  open: boolean;
  onUnlock: (
    pin: string
  ) => Promise<{
    success: boolean;
    lockoutUntil?: number;
    wiped?: boolean;
    retryAfter?: number;
  }>;
  onForgotPin: () => void;
}

export function PinUnlockDialog({
  open,
  onUnlock,
  onForgotPin,
}: PinUnlockDialogProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState("");
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [retryRemaining, setRetryRemaining] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Lockout countdown
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = lockoutUntil - Date.now();
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutRemaining("");
        setError("");
        return;
      }
      const minutes = Math.ceil(remaining / 60_000);
      setLockoutRemaining(`${minutes} min`);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // Exponential delay countdown
  useEffect(() => {
    if (!retryAfter) return;
    const interval = setInterval(() => {
      const remaining = retryAfter - Date.now();
      if (remaining <= 0) {
        setRetryAfter(null);
        setRetryRemaining("");
        return;
      }
      const seconds = Math.ceil(remaining / 1000);
      setRetryRemaining(`${seconds}s`);
    }, 200);
    return () => clearInterval(interval);
  }, [retryAfter]);

  const handleSubmit = async () => {
    if (pin.length !== 6 || lockoutUntil || retryAfter) return;
    setLoading(true);
    setError("");

    try {
      const result = await onUnlock(pin);
      if (result.wiped) {
        setError(
          "Trop de tentatives. Données effacées. Reconnectez-vous en ligne."
        );
        return;
      }
      if (result.lockoutUntil) {
        setLockoutUntil(result.lockoutUntil);
        setError("Trop de tentatives.");
        setPin("");
        return;
      }
      if (result.retryAfter) {
        setRetryAfter(result.retryAfter);
        setError("PIN incorrect");
        setPin("");
        return;
      }
      if (!result.success) {
        setError("PIN incorrect");
        setPin("");
        if (inputRef.current) inputRef.current.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-6 shadow-xl">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Lock className="h-6 w-6 text-primary" />
            </div>

            <Dialog.Title className="text-lg font-semibold">
              Session verrouillée
            </Dialog.Title>

            <Dialog.Description className="text-sm text-muted-foreground text-center">
              Saisissez votre PIN pour déverrouiller
            </Dialog.Description>

            {lockoutUntil ? (
              <div className="flex items-center gap-2 rounded-lg bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Verrouillé pendant {lockoutRemaining}</span>
              </div>
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    const digits = (e.target as HTMLInputElement).value
                      .replace(/\D/g, "")
                      .slice(0, 6);
                    setPin(digits);
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                  className="w-full rounded-lg border border-border px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="······"
                  autoFocus
                  disabled={loading}
                />

                {error && <p className="text-sm text-danger">{error}</p>}

                {retryAfter && retryRemaining && (
                  <p className="text-sm text-warning">
                    Patientez {retryRemaining} avant de réessayer
                  </p>
                )}

                <button
                  onClick={handleSubmit}
                  disabled={loading || pin.length !== 6 || !!retryAfter}
                  className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Vérification..." : "Déverrouiller"}
                </button>
              </>
            )}

            <button
              onClick={onForgotPin}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              PIN oublié ? (les données locales seront effacées)
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
