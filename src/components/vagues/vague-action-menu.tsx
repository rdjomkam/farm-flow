"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Plus, Scissors, Pencil, FileText, FileSpreadsheet, XCircle, Container, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { GererBacsDialog } from "./gerer-bacs-dialog";
import { SupprimerVagueDialog } from "./supprimer-vague-dialog";
import { Permission } from "@/types";
import type { BacResponse } from "@/types";
import { useExportService } from "@/services";

interface VagueActionMenuProps {
  vagueId: string;
  vagueCode: string;
  nombreInitial: number;
  poidsMoyenInitial: number;
  origineAlevins: string | null;
  configElevageId: string | null;
  configElevages: { id: string; nom: string }[];
  unitesProduction: { id: string; code: string; nom: string; type: string }[];
  uniteProductionId: string | null;
  poidsObjectifKg: number | null;
  permissions: Permission[];
  isEnCours: boolean;
  canExport: boolean;
  currentBacs?: BacResponse[];
  className?: string;
}

export function VagueActionMenu({
  vagueId,
  vagueCode,
  nombreInitial,
  poidsMoyenInitial,
  origineAlevins,
  configElevageId,
  configElevages,
  unitesProduction,
  uniteProductionId,
  poidsObjectifKg,
  permissions,
  isEnCours,
  canExport,
  currentBacs = [],
  className,
}: VagueActionMenuProps) {
  const router = useRouter();
  const exportService = useExportService();
  const t = useTranslations("vagues");
  const [modifierOpen, setModifierOpen] = useState(false);
  const [cloturerOpen, setCloturerOpen] = useState(false);
  const [gererBacsOpen, setGererBacsOpen] = useState(false);
  const [supprimerOpen, setSupprimerOpen] = useState(false);

  const canModifier = isEnCours && permissions.includes(Permission.VAGUES_MODIFIER);
  const canCalibrage = isEnCours && permissions.includes(Permission.CALIBRAGES_CREER);
  const canCloturer = isEnCours;
  const canGererBacs = isEnCours && permissions.includes(Permission.VAGUES_MODIFIER);
  const canSupprimer = permissions.includes(Permission.VAGUES_MODIFIER);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={`h-9 w-9 p-0${className ? ` ${className}` : ""}`}>
            <MoreVertical className="h-5 w-5" />
            <span className="sr-only">{t("actionMenu.actions")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isEnCours && (
            <DropdownMenuItem onSelect={() => router.push(`/releves/nouveau?vagueId=${vagueId}`)}>
              <Plus className="h-4 w-4" />
              {t("actionMenu.nouveauReleve")}
            </DropdownMenuItem>
          )}
          {canCalibrage && (
            <DropdownMenuItem onSelect={() => router.push(`/vagues/${vagueId}/calibrage/nouveau`)}>
              <Scissors className="h-4 w-4" />
              {t("actionMenu.calibrage")}
            </DropdownMenuItem>
          )}
          {canModifier && (
            <DropdownMenuItem onSelect={() => setModifierOpen(true)}>
              <Pencil className="h-4 w-4" />
              {t("actionMenu.modifier")}
            </DropdownMenuItem>
          )}
          {canGererBacs && (
            <DropdownMenuItem onSelect={() => setGererBacsOpen(true)}>
              <Container className="h-4 w-4" />
              {t("actionMenu.gererBacs")}
            </DropdownMenuItem>
          )}

          {canExport && (isEnCours || canCalibrage || canModifier) && <DropdownMenuSeparator />}

          {canExport && (
            <>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  exportService.vaguePdf(vagueId, vagueCode);
                }}
              >
                <FileText className="h-4 w-4" />
                {t("actionMenu.rapportPdf")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  exportService.vagueReleves(vagueId, vagueCode);
                }}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t("actionMenu.exportReleves")}
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
              {t("actionMenu.cloturer")}
            </DropdownMenuItem>
          )}

          {canSupprimer && <DropdownMenuSeparator />}
          {canSupprimer && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => setSupprimerOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer la vague
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ModifierVagueDialog
        vagueId={vagueId}
        nombreInitial={nombreInitial}
        poidsMoyenInitial={poidsMoyenInitial}
        origineAlevins={origineAlevins}
        configElevageId={configElevageId}
        configElevages={configElevages}
        unitesProduction={unitesProduction}
        uniteProductionId={uniteProductionId}
        poidsObjectifKg={poidsObjectifKg}
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

      <GererBacsDialog
        vagueId={vagueId}
        currentBacs={currentBacs}
        permissions={permissions}
        open={gererBacsOpen}
        onOpenChange={setGererBacsOpen}
      />

      <SupprimerVagueDialog
        vagueId={vagueId}
        vagueCode={vagueCode}
        open={supprimerOpen}
        onOpenChange={setSupprimerOpen}
      />
    </>
  );
}
