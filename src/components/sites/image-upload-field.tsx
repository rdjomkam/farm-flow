"use client";

import { useRef, useState } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_WIDTH = 600;
/** Limite alignee sur base64ImageOptionalSchema (500KB de data URL) */
const MAX_DATA_URL_LENGTH = 500_000;

interface ImageUploadFieldProps {
  label: string;
  helpText?: string;
  value: string | null;
  onChange: (value: string | null) => Promise<void> | void;
  emptyLabel: string;
  removeLabel: string;
  uploadLabel: string;
  errorTooLarge: string;
  errorInvalidType: string;
}

/**
 * Resize une image via canvas si sa largeur depasse MAX_WIDTH, puis retourne
 * une data URL PNG. Permet de limiter le poids des signatures/cachets.
 */
async function fileToResizedDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image invalide"));
    image.src = dataUrl;
  });

  if (img.width <= MAX_WIDTH) {
    return dataUrl;
  }

  const scale = MAX_WIDTH / img.width;
  const canvas = document.createElement("canvas");
  canvas.width = MAX_WIDTH;
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/**
 * Champ d'upload d'image (signature, cachet) avec preview, redimensionnement
 * canvas cote client et suppression. Utilise pour les documents du site
 * (Sprint BL — bons de livraison).
 */
export function ImageUploadField({
  label,
  helpText,
  value,
  onChange,
  emptyLabel,
  removeLabel,
  uploadLabel,
  errorTooLarge,
  errorInvalidType,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError(errorInvalidType);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setLoading(true);
    try {
      const resized = await fileToResizedDataUrl(file);
      if (resized.length > MAX_DATA_URL_LENGTH) {
        setError(errorTooLarge);
        return;
      }
      await onChange(resized);
    } catch {
      setError(errorInvalidType);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setLoading(true);
    try {
      await onChange(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}

      <div className="flex items-center gap-3 flex-wrap">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt={label}
            className="h-16 w-auto max-w-[160px] rounded border border-border object-contain bg-background p-1"
          />
        ) : (
          <div className="flex h-16 w-32 items-center justify-center rounded border border-dashed border-border text-xs text-muted-foreground">
            {emptyLabel}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            id={`upload-${label}`}
            onChange={handleFileSelect}
            disabled={loading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={loading}
            onClick={() => inputRef.current?.click()}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            {uploadLabel}
          </Button>
          {value && (
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
          )}
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
