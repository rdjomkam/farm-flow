"use client";

/**
 * ExportButton — Bouton de téléchargement de fichier d'export.
 *
 * Gère l'appel fetch → blob → download automatique.
 * Mobile-first : taille minimale 44px, variant outline par défaut.
 *
 * Usage :
 * <ExportButton href="/api/export/facture/123" filename="facture-FAC-2026-001.pdf" label="Télécharger PDF" />
 */

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ExportButtonProps {
  /** URL de l'API d'export */
  href: string;
  /** Nom du fichier à télécharger */
  filename: string;
  /** Label du bouton */
  label?: string;
  /** Variant du bouton (default: outline) */
  variant?: "outline" | "primary" | "ghost";
  /** Classes CSS supplémentaires */
  className?: string;
  /** Icône optionnelle (avant le label) */
  icon?: React.ReactNode;
}

export function ExportButton({
  href,
  filename,
  label = "Exporter",
  variant = "outline",
  className = "",
  icon,
}: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleExport() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(href);

      if (!res.ok) {
        let errorMsg = "Erreur lors de l'export";
        try {
          const data = await res.json();
          errorMsg = data.error ?? data.message ?? errorMsg;
        } catch {
          // Ignore JSON parse error
        }
        toast({ title: errorMsg, variant: "error" });
        return;
      }

      // Créer un blob et déclencher le téléchargement
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: `${filename} téléchargé`, variant: "success" });
    } catch {
      toast({ title: "Erreur réseau lors de l'export", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      onClick={handleExport}
      disabled={loading}
      className={`min-h-[44px] ${className}`}
      aria-label={loading ? "Export en cours..." : label}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        icon ?? <Download className="h-4 w-4" />
      )}
      <span className="ml-1.5">{loading ? "Export..." : label}</span>
    </Button>
  );
}
