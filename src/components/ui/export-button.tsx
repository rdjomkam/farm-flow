"use client";

/**
 * ExportButton — Bouton de téléchargement de fichier d'export.
 *
 * Gère l'appel fetch → blob → download automatique via useApi.download.
 * Mobile-first : taille minimale 44px, variant outline par défaut.
 *
 * Usage :
 * <ExportButton href="/api/export/facture/123" filename="facture-FAC-2026-001.pdf" label="Télécharger PDF" />
 */

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";

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
  const { download } = useApi();

  async function handleExport() {
    await download(href, filename);
  }

  return (
    <Button
      variant={variant}
      onClick={handleExport}
      className={`min-h-[44px] ${className}`}
      aria-label={label}
    >
      {icon ?? <Download className="h-4 w-4" />}
      <span className="ml-1.5">{label}</span>
    </Button>
  );
}
