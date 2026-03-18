"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Plus, Scissors, Pencil, FileText, FileSpreadsheet, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ModifierVagueDialog } from "./modifier-vague-dialog";
import { CloturerDialog } from "./cloturer-dialog";
import { useToast } from "@/components/ui/toast";
import { Permission } from "@/types";

interface VagueActionMenuProps {
  vagueId: string;
  vagueCode: string;
  nombreInitial: number;
  poidsMoyenInitial: number;
  origineAlevins: string | null;
  permissions: Permission[];
  isEnCours: boolean;
  canExport: boolean;
  className?: string;
}

export function VagueActionMenu({
  vagueId,
  vagueCode,
  nombreInitial,
  poidsMoyenInitial,
  origineAlevins,
  permissions,
  isEnCours,
  canExport,
  className,
}: VagueActionMenuProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [modifierOpen, setModifierOpen] = useState(false);
  const [cloturerOpen, setCloturerOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  async function handleExport(href: string, filename: string, setLoading: (v: boolean) => void) {
    setLoading(true);
    try {
      const res = await fetch(href);
      if (!res.ok) {
        let errorMsg = "Erreur lors de l'export";
        try {
          const data = await res.json();
          errorMsg = data.error ?? data.message ?? errorMsg;
        } catch { /* ignore */ }
        toast({ title: errorMsg, variant: "error" });
        return;
      }
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

  const canModifier = isEnCours && permissions.includes(Permission.VAGUES_MODIFIER);
  const canCalibrage = isEnCours && permissions.includes(Permission.CALIBRAGES_CREER);
  const canCloturer = isEnCours;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={`h-9 w-9 p-0${className ? ` ${className}` : ""}`}>
            <MoreVertical className="h-5 w-5" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isEnCours && (
            <DropdownMenuItem onSelect={() => router.push(`/releves/nouveau?vagueId=${vagueId}`)}>
              <Plus className="h-4 w-4" />
              Nouveau relevé
            </DropdownMenuItem>
          )}
          {canCalibrage && (
            <DropdownMenuItem onSelect={() => router.push(`/vagues/${vagueId}/calibrage/nouveau`)}>
              <Scissors className="h-4 w-4" />
              Calibrage
            </DropdownMenuItem>
          )}
          {canModifier && (
            <DropdownMenuItem onSelect={() => setModifierOpen(true)}>
              <Pencil className="h-4 w-4" />
              Modifier
            </DropdownMenuItem>
          )}

          {canExport && (isEnCours || canCalibrage || canModifier) && <DropdownMenuSeparator />}

          {canExport && (
            <>
              <DropdownMenuItem
                disabled={exportingPdf}
                onSelect={(e) => {
                  e.preventDefault();
                  handleExport(
                    `/api/export/vague/${vagueId}`,
                    `rapport-vague-${vagueCode}.pdf`,
                    setExportingPdf
                  );
                }}
              >
                {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Rapport PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={exportingExcel}
                onSelect={(e) => {
                  e.preventDefault();
                  handleExport(
                    `/api/export/releves?vagueId=${vagueId}`,
                    `releves-${vagueCode}.xlsx`,
                    setExportingExcel
                  );
                }}
              >
                {exportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Export relevés
              </DropdownMenuItem>
            </>
          )}

          {canCloturer && (canExport || isEnCours || canCalibrage || canModifier) && <DropdownMenuSeparator />}

          {canCloturer && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setCloturerOpen(true)}
            >
              <XCircle className="h-4 w-4" />
              Clôturer
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ModifierVagueDialog
        vagueId={vagueId}
        nombreInitial={nombreInitial}
        poidsMoyenInitial={poidsMoyenInitial}
        origineAlevins={origineAlevins}
        permissions={permissions}
        open={modifierOpen}
        onOpenChange={setModifierOpen}
      />

      <CloturerDialog
        vagueId={vagueId}
        vagueCode={vagueCode}
        open={cloturerOpen}
        onOpenChange={setCloturerOpen}
      />
    </>
  );
}
