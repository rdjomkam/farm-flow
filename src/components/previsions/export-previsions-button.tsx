"use client";

/**
 * src/components/previsions/export-previsions-button.tsx
 *
 * Bouton "Export" (dropdown Excel / PDF) pour la page détail d'un scénario
 * de prévision — appelle `GET /api/previsions/scenarios/[id]/export`.
 */
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";

interface ExportPrevisionsButtonProps {
  scenarioId: string;
  scenarioNom: string;
}

export function ExportPrevisionsButton({
  scenarioId,
  scenarioNom,
}: ExportPrevisionsButtonProps) {
  const t = useTranslations("previsions");
  const [loading, setLoading] = useState<"excel" | "pdf" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function handleExport(format: "excel" | "pdf") {
    setLoading(format);
    setErreur(null);
    try {
      const res = await fetch(
        `/api/previsions/scenarios/${scenarioId}/export?format=${format}`
      );
      if (!res.ok) {
        throw new Error(`Échec de l'export (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `previsions-${scenarioNom}.${format === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErreur(
        err instanceof Error
          ? err.message
          : "Erreur lors de l'export des prévisions."
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={loading !== null}>
            <Download className="mr-2 h-4 w-4" />
            {loading ? t("export.enCours") : t("export.bouton")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport("excel")}>
            {t("export.excel")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("pdf")}>
            {t("export.pdf")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {erreur && <p className="text-xs text-destructive">{erreur}</p>}
    </div>
  );
}
