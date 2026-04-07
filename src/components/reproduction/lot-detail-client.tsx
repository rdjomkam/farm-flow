"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Fish,
  GitBranch,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { PhaseLot, StatutLotAlevins, DestinationLot, Permission } from "@/types";
import { LotPhaseStepper } from "./lot-phase-stepper";
import { LotSplitDialog } from "./lot-split-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BacInfo {
  id: string;
  nom: string;
  volume?: number;
}

interface PonteInfo {
  id: string;
  code: string;
  datePonte?: string;
  statut?: string;
  femelle?: { id: string; code: string; sexe: string } | null;
  male?: { id: string; code: string; sexe: string } | null;
}

interface IncubationInfo {
  id: string;
  code: string;
  statut: string;
  dateDebutIncubation?: string;
  nombreLarvesViables?: number | null;
}

interface SousLotSummary {
  id: string;
  code: string;
  phase: string;
  nombreActuel: number;
  nombreInitial: number;
  statut: string;
  bacId: string | null;
  bac?: { id: string; nom: string } | null;
}

interface ParentLotSummary {
  id: string;
  code: string;
  phase: string;
  nombreActuel: number;
  statut: string;
}

interface ReleveSummary {
  id: string;
  date: string;
  typeReleve: string;
  notes: string | null;
}

interface VagueInfo {
  id: string;
  code: string;
}

export interface LotDetailData {
  id: string;
  code: string;
  phase: string;
  statut: string;
  nombreInitial: number;
  nombreActuel: number;
  poidsMoyen: number | null;
  ageJours: number;
  dateDebutPhase: string;
  poidsObjectifG: number | null;
  nombreDeformesRetires: number;
  destinationSortie: string | null;
  notes: string | null;
  createdAt: string;
  parentLotId: string | null;
  incubationId: string | null;
  ponte?: PonteInfo | null;
  bac?: BacInfo | null;
  vagueDestination?: VagueInfo | null;
  incubation?: IncubationInfo | null;
  parentLot?: ParentLotSummary | null;
  sousLots?: SousLotSummary[];
  releves?: ReleveSummary[];
}

interface Props {
  lot: LotDetailData;
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function phaseBadgeClass(phase: string): string {
  switch (phase) {
    case PhaseLot.INCUBATION:
      return "bg-accent-blue-muted text-accent-blue";
    case PhaseLot.LARVAIRE:
      return "bg-accent-purple-muted text-accent-purple";
    case PhaseLot.NURSERIE:
      return "bg-accent-amber-muted text-accent-amber";
    case PhaseLot.ALEVINAGE:
      return "bg-accent-green-muted text-accent-green";
    case PhaseLot.SORTI:
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statutBadgeClass(statut: string): string {
  switch (statut) {
    case StatutLotAlevins.EN_INCUBATION:
      return "bg-accent-blue-muted text-accent-blue";
    case StatutLotAlevins.EN_ELEVAGE:
      return "bg-accent-green-muted text-accent-green";
    case StatutLotAlevins.TRANSFERE:
      return "bg-muted text-muted-foreground";
    case StatutLotAlevins.PERDU:
      return "bg-accent-red-muted text-accent-red";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LotDetailClient({ lot, permissions }: Props) {
  const t = useTranslations("reproduction.lots");
  const router = useRouter();
  const { call } = useApi();

  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [sortieDialogOpen, setSortieDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);

  // Sortie form state
  const [destination, setDestination] = useState<string>("");
  const [sortieNotes, setSortieNotes] = useState("");

  const canModify = permissions.includes(Permission.ALEVINS_MODIFIER);
  const canDelete = permissions.includes(Permission.ALEVINS_SUPPRIMER);

  const phaseLabels: Record<string, string> = {
    [PhaseLot.INCUBATION]: t("phases.INCUBATION"),
    [PhaseLot.LARVAIRE]: t("phases.LARVAIRE"),
    [PhaseLot.NURSERIE]: t("phases.NURSERIE"),
    [PhaseLot.ALEVINAGE]: t("phases.ALEVINAGE"),
    [PhaseLot.SORTI]: t("phases.SORTI"),
  };

  const statutLabels: Record<string, string> = {
    [StatutLotAlevins.EN_INCUBATION]: t("statuts.EN_INCUBATION"),
    [StatutLotAlevins.EN_ELEVAGE]: t("statuts.EN_ELEVAGE"),
    [StatutLotAlevins.TRANSFERE]: t("statuts.TRANSFERE"),
    [StatutLotAlevins.PERDU]: t("statuts.PERDU"),
  };

  const destinationLabels: Record<string, string> = {
    [DestinationLot.VENTE_ALEVINS]: t("destinations.VENTE_ALEVINS"),
    [DestinationLot.TRANSFERT_GROSSISSEMENT]: t("destinations.TRANSFERT_GROSSISSEMENT"),
    [DestinationLot.TRANSFERT_INTERNE]: t("destinations.TRANSFERT_INTERNE"),
    [DestinationLot.REFORMAGE]: t("destinations.REFORMAGE"),
  };

  const typeReleveLabels: Record<string, string> = {
    biometrie: t("releveTypes.biometrie"),
    mortalite: t("releveTypes.mortalite"),
    alimentation: t("releveTypes.alimentation"),
    qualite_eau: t("releveTypes.qualite_eau"),
    comptage: t("releveTypes.comptage"),
    observation: t("releveTypes.observation"),
    tri: t("releveTypes.tri"),
  };

  const survieRate =
    lot.nombreInitial > 0
      ? (lot.nombreActuel / lot.nombreInitial) * 100
      : 100;

  const hasActiveSousLots = (lot.sousLots ?? []).some(
    (sl) =>
      sl.statut !== StatutLotAlevins.TRANSFERE &&
      sl.statut !== StatutLotAlevins.PERDU
  );

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  async function handleDelete() {
    const result = await call(
      `/api/reproduction/lots/${lot.id}`,
      { method: "DELETE" },
      { successMessage: t("detail.deleteSuccess") }
    );
    if (result.ok) {
      router.push("/reproduction/lots");
    } else {
      setDeleteDialogOpen(false);
    }
  }

  async function handleSortie() {
    if (!destination) return;
    const result = await call(
      `/api/reproduction/lots/${lot.id}/sortie`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destinationSortie: destination,
          dateTransfert: new Date().toISOString(),
          notes: sortieNotes.trim() || undefined,
        }),
      },
      { successMessage: t("detail.sortieSuccess") }
    );
    if (result.ok) {
      setSortieDialogOpen(false);
      router.refresh();
    }
  }

  function handlePhaseChange() {
    setPhaseDialogOpen(false);
    router.refresh();
  }

  function handleSplitSuccess() {
    setSplitDialogOpen(false);
    router.refresh();
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      <Link
        href="/reproduction/lots"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("detail.backToLots")}
      </Link>

      {/* Header: code + badges + action buttons */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${phaseBadgeClass(lot.phase)}`}
          >
            {phaseLabels[lot.phase] ?? lot.phase}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium ${statutBadgeClass(lot.statut)}`}
          >
            {statutLabels[lot.statut] ?? lot.statut}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canModify && lot.phase !== PhaseLot.SORTI && (
            <>
              {/* Changer phase */}
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setPhaseDialogOpen(true)}
              >
                {t("detail.changerPhase")}
              </Button>

              {/* Fractionner */}
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => setSplitDialogOpen(true)}
              >
                <GitBranch className="h-4 w-4 mr-1" aria-hidden="true" />
                {t("detail.fractionner")}
              </Button>

              {/* Sortir */}
              <Dialog open={sortieDialogOpen} onOpenChange={setSortieDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="min-h-[44px]">
                    <LogOut className="h-4 w-4 mr-1" aria-hidden="true" />
                    {t("detail.sortir")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("detail.sortirTitle")}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">
                        {t("detail.destinationLabel")}
                      </label>
                      <Select value={destination} onValueChange={setDestination}>
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder={t("detail.destinationPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(DestinationLot).map((d) => (
                            <SelectItem key={d} value={d}>
                              {destinationLabels[d] ?? d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium">
                        {t("detail.notesLabel")}
                      </label>
                      <textarea
                        className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder={t("detail.notesPlaceholder")}
                        value={sortieNotes}
                        onChange={(e) => setSortieNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" className="min-h-[44px]">
                        {t("detail.annuler")}
                      </Button>
                    </DialogClose>
                    <Button
                      onClick={handleSortie}
                      disabled={!destination}
                      className="min-h-[44px]"
                    >
                      {t("detail.confirmerSortie")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {canDelete && (
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] text-destructive hover:text-destructive"
                  disabled={hasActiveSousLots}
                  title={hasActiveSousLots ? t("detail.deleteBlockedHint") : undefined}
                >
                  <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" />
                  {t("detail.supprimer")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("detail.supprimerTitle")}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground py-2">
                  {t("detail.confirmDelete", { code: lot.code })}
                </p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" className="min-h-[44px]">
                      {t("detail.annuler")}
                    </Button>
                  </DialogClose>
                  <Button
                    variant="danger"
                    onClick={handleDelete}
                    className="min-h-[44px]"
                  >
                    {t("detail.confirmerSuppression")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("stats.nombreActuel")}</p>
            <p className="text-xl font-bold mt-1">{lot.nombreActuel}</p>
            <p className="text-xs text-muted-foreground">/ {lot.nombreInitial}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("stats.survie")}</p>
            <p
              className={`text-xl font-bold mt-1 ${survieRate < 50 ? "text-accent-red" : survieRate < 70 ? "text-accent-amber" : "text-accent-green"}`}
            >
              {survieRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("stats.poidsMoyen")}</p>
            <p className="text-xl font-bold mt-1">
              {lot.poidsMoyen !== null ? `${lot.poidsMoyen}g` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{t("stats.age")}</p>
            <p className="text-xl font-bold mt-1">
              {lot.ageJours} {t("stats.joursUnit")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Phase stepper */}
      <LotPhaseStepper
        lotId={lot.id}
        currentPhase={lot.phase as PhaseLot}
        canModify={canModify && lot.phase !== PhaseLot.SORTI}
        onPhaseChange={handlePhaseChange}
        open={phaseDialogOpen}
        onOpenChange={setPhaseDialogOpen}
      />

      {/* Informations générales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.informations")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("detail.code")}</span>
            <span className="font-medium">{lot.code}</span>
          </div>
          {lot.bac && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("detail.bac")}</span>
              <span className="font-medium">{lot.bac.nom}</span>
            </div>
          )}
          {lot.poidsObjectifG !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("detail.poidsObjectif")}</span>
              <span className="font-medium">{lot.poidsObjectifG}g</span>
            </div>
          )}
          {lot.nombreDeformesRetires > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("detail.deformes")}</span>
              <span className="font-medium">{lot.nombreDeformesRetires}</span>
            </div>
          )}
          {lot.notes && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground">{t("detail.notes")}</span>
              <span className="text-foreground">{lot.notes}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Origine section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.origine")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {/* Ponte */}
          {lot.ponte && (
            <Link
              href={`/reproduction/pontes/${lot.ponte.id}`}
              className="flex items-center justify-between hover:text-primary transition-colors"
            >
              <span className="text-muted-foreground">{t("detail.ponte")}</span>
              <span className="flex items-center gap-1 font-medium">
                {lot.ponte.code}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          )}

          {/* Incubation */}
          {lot.incubation && (
            <Link
              href={`/reproduction/incubations/${lot.incubation.id}`}
              className="flex items-center justify-between hover:text-primary transition-colors"
            >
              <span className="text-muted-foreground">{t("detail.incubation")}</span>
              <span className="flex items-center gap-1 font-medium">
                {lot.incubation.code}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          )}

          {/* Parent lot */}
          {lot.parentLot && (
            <Link
              href={`/reproduction/lots/${lot.parentLot.id}`}
              className="flex items-center justify-between hover:text-primary transition-colors"
            >
              <span className="text-muted-foreground">{t("detail.parentLot")}</span>
              <span className="flex items-center gap-1 font-medium">
                {lot.parentLot.code}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          )}

          {/* Vague destination */}
          {lot.vagueDestination && (
            <Link
              href={`/vagues/${lot.vagueDestination.id}`}
              className="flex items-center justify-between hover:text-primary transition-colors"
            >
              <span className="text-muted-foreground">{t("detail.vagueDestination")}</span>
              <span className="flex items-center gap-1 font-medium">
                {lot.vagueDestination.code}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          )}

          {/* Destination sortie */}
          {lot.destinationSortie && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("detail.destinationSortie")}</span>
              <span className="font-medium">{destinationLabels[lot.destinationSortie] ?? lot.destinationSortie}</span>
            </div>
          )}

          {!lot.ponte && !lot.incubation && !lot.parentLot && !lot.vagueDestination && !lot.destinationSortie && (
            <p className="text-muted-foreground text-center py-2">{t("detail.aucuneOrigine")}</p>
          )}
        </CardContent>
      </Card>

      {/* Sous-lots */}
      {(lot.sousLots ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("detail.sousLots")} ({lot.sousLots!.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {lot.sousLots!.map((sl) => (
              <Link
                key={sl.id}
                href={`/reproduction/lots/${sl.id}`}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-sm">{sl.code}</span>
                  <span className="text-xs text-muted-foreground">
                    {sl.nombreActuel}/{sl.nombreInitial} {t("card.poissons")}
                    {sl.bac && ` — ${sl.bac.nom}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${phaseBadgeClass(sl.phase)}`}
                  >
                    {phaseLabels[sl.phase] ?? sl.phase}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Relevés */}
      {(lot.releves ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("detail.releves")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {lot.releves!.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between p-3 rounded-lg border border-border text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {typeReleveLabels[r.typeReleve] ?? r.typeReleve}
                  </span>
                  {r.notes && (
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {r.notes}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(r.date).toLocaleDateString("fr-FR")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state for relevés */}
      {(lot.releves ?? []).length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <Fish className="h-10 w-10 text-muted-foreground mb-3" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("detail.aucunReleve")}</p>
          </CardContent>
        </Card>
      )}

      {/* Split dialog */}
      <LotSplitDialog
        lot={lot}
        open={splitDialogOpen}
        onOpenChange={setSplitDialogOpen}
        onSuccess={handleSplitSuccess}
      />
    </div>
  );
}
