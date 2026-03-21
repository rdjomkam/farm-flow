"use client";

import { useState, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Lock, Eye, EyeOff } from "lucide-react";

interface PinSetupDialogProps {
  open: boolean;
  onComplete: (pin: string) => void;
}

export function PinSetupDialog({ open, onComplete }: PinSetupDialogProps) {
  const [step, setStep] = useState<"create" | "confirm">("create");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePinChange = (value: string, setter: (v: string) => void) => {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setter(digits);
    setError("");
  };

  const handleNext = () => {
    if (pin.length !== 6) {
      setError("Le PIN doit contenir 6 chiffres");
      return;
    }
    setStep("confirm");
    setConfirmPin("");
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  };

  const handleConfirm = async () => {
    if (confirmPin !== pin) {
      setError("Les PINs ne correspondent pas");
      setConfirmPin("");
      return;
    }
    setLoading(true);
    try {
      await onComplete(pin);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Lock className="h-6 w-6 text-primary" />
            </div>

            <Dialog.Title className="text-lg font-semibold text-center">
              {step === "create"
                ? "Créer votre PIN de sécurité"
                : "Confirmer votre PIN"}
            </Dialog.Title>

            <Dialog.Description className="text-sm text-gray-500 text-center">
              {step === "create"
                ? "Ce PIN protège vos données hors ligne. Choisissez 6 chiffres."
                : "Saisissez à nouveau votre PIN pour confirmer."}
            </Dialog.Description>

            <div className="relative w-full">
              <input
                ref={inputRef}
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={step === "create" ? pin : confirmPin}
                onChange={(e) =>
                  handlePinChange(
                    (e.target as HTMLInputElement).value,
                    step === "create" ? setPin : setConfirmPin
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    step === "create" ? handleNext() : handleConfirm();
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="······"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPin ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex w-full gap-3">
              {step === "confirm" && (
                <button
                  onClick={() => {
                    setStep("create");
                    setConfirmPin("");
                    setError("");
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Retour
                </button>
              )}
              <button
                onClick={step === "create" ? handleNext : handleConfirm}
                disabled={
                  loading ||
                  (step === "create" ? pin.length !== 6 : confirmPin.length !== 6)
                }
                className="flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading
                  ? "Chiffrement en cours..."
                  : step === "create"
                    ? "Suivant"
                    : "Confirmer"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
