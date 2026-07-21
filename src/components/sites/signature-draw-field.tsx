"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignaturePad, type SignaturePadHandle } from "@/components/ui/signature-pad";

interface SignatureDrawFieldProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => Promise<void> | void;
  removeLabel: string;
  drawLabel: string;
  redrawLabel: string;
  saveLabel: string;
}

/**
 * Champ de signature dessinee au pad tactile (canvas), utilise pour la
 * signature du promoteur dans Reglages -> Site -> Documents.
 *
 * - Si une signature existe : preview sans cadre + bouton "Redessiner"
 *   (rouvre le pad) + bouton supprimer.
 * - Sinon : pad affiche directement avec Effacer (integre au SignaturePad)
 *   et Enregistrer (sauvegarde le PNG base64 via onChange).
 */
export function SignatureDrawField({
  label,
  value,
  onChange,
  removeLabel,
  drawLabel,
  redrawLabel,
  saveLabel,
}: SignatureDrawFieldProps) {
  const tButtons = useTranslations("common.buttons");
  const padRef = useRef<SignaturePadHandle>(null);
  const [drawing, setDrawing] = useState(!value);
  const [isEmpty, setIsEmpty] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    const dataUrl = padRef.current?.toDataURL();
    if (!dataUrl) return;
    setLoading(true);
    try {
      await onChange(dataUrl);
      setDrawing(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setLoading(true);
    try {
      await onChange(null);
      setDrawing(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>

      {!drawing && value ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="h-16 w-auto max-w-[220px] object-contain"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setDrawing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {redrawLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 text-danger"
              disabled={loading}
              onClick={handleRemove}
            >
              <X className="h-3.5 w-3.5" />
              {removeLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 w-full">
          <SignaturePad ref={padRef} onChangeEmpty={setIsEmpty} className="w-full" />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={isEmpty || loading}
              onClick={handleSave}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Pencil className="h-3.5 w-3.5" />
              )}
              {saveLabel}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDrawing(false)}
                disabled={loading}
              >
                {tButtons("cancel")}
              </Button>
            )}
          </div>
          {!value && <p className="text-xs text-muted-foreground">{drawLabel}</p>}
        </div>
      )}
    </div>
  );
}
