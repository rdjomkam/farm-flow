"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  FlaskConical,
  Baby,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  ChevronRight,
} from "lucide-react";
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
import { StatutIncubation, SubstratIncubation, StatutLotAlevins, Permission } from "@/types";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { EclosionCountdownTimer } from "./eclosion-countdown-timer";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface PonteRef {
  id: string;
  code: string;
  datePonte: string;
  statut: string;
}

interface TraitementData {
  id: string;
  produit: string;
  concentration: string;
  dureeMinutes: number;
  heure: string;
  notes: string | null;
}

interface LotAlevinsData {
  id: string;
  code: string;
  nombreInitial: number;
  nombreActuel: number;
  phase: string;
  statut: string;
  createdAt: string;
}

interface IncubationDetailData {
  id: string;
  code: string;
  ponteId: string;
  substrat: string;
  temperatureEauC: number | null;
  dureeIncubationH: number | null;
  dateDebutIncubation: string;
  dateEclosionPrevue: string | null;
  dateEclosionReelle: string | null;
  nombreOeufsPlaces: number | null;
  nombreLarvesEcloses: number | null;
  tauxEclosion: number | null;
  nombreDeformes: number | null;
  nombreLarvesViables: number | null;
  notesRetrait: string | null;
  statut: string;
  notes: string | null;
  ponte?: PonteRef | null;
  traitements?: TraitementData[];
  lotAlevins?: LotAlevinsData[];
  _count?: { traitements: number; lotAlevins: number };
}

interface Props {
  incubation: IncubationDetailData;
  permissions: Permission[];
  produits: { id: string; nom: string }[];
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function statutBadgeClass(statut: string): string {
  if (statut === StatutIncubation.EN_COURS) return "bg-accent-green-muted text-accent-green";
  if (statut === StatutIncubation.ECLOSION_EN_COURS) return "bg-accent-amber-muted text-accent-amber";
  if (statut === StatutIncubation.TERMINEE) return "bg-accent-blue-muted text-accent-blue";
  return "bg-destructive/10 text-destructive";
}

function statutLotBadgeClass(statut: string): string {
  if (statut === StatutLotAlevins.EN_INCUBATION) return "bg-accent-blue-muted text-accent-blue";
  if (statut === StatutLotAlevins.EN_ELEVAGE) return "bg-accent-green-muted text-accent-green";
  if (statut === StatutLotAlevins.TRANSFERE) return "bg-muted text-muted-foreground";
  return "bg-accent-red-muted text-accent-red";
}

// ---------------------------------------------------------------------------
// InfoRow helper
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1 border-b border-border last:border-0">
      <span className="text-muted-foreground text-sm shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IncubationDetailClient({ incubation, permissions, produits }: Props) {
  const t = useTranslations("reproduction");
  const router = useRouter();
  const { call } = useApi();

  const canModify = permissions.includes(Permission.INCUBATIONS_GERER);

  // Traitement form state
  const [traitementOpen, setTraitementOpen] = useState(false);
  const [traitementProduit, setTraitementProduit] = useState("");
  const [traitementConcentration, setTraitementConcentration] = useState("");
  const [traitementDuree, setTraitementDuree] = useState("");
  const [traitementHeure, setTraitementHeure] = useState("");
  const [traitementNotes, setTraitementNotes] = useState("");
  const [traitementLoading, setTraitementLoading] = useState(false);

  // Eclosion form state
  const [eclosionOpen, setEclosionOpen] = useState(false);
  const [eclosionLarves, setEclosionLarves] = useState("");
  const [eclosionDeformes, setEclosionDeformes] = useState("");
  const [eclosionDate, setEclosionDate] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [eclosionNotes, setEclosionNotes] = useState("");
  const [eclosionLoading, setEclosionLoading] = useState(false);

  const isEnCours =
    incubation.statut === StatutIncubation.EN_COURS ||
    incubation.statut === StatutIncubation.ECLOSION_EN_COURS;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleAddTraitement() {
    if (!traitementProduit.trim() || !traitementConcentration.trim() || !traitementDuree) return;

    setTraitementLoading(true);
    const result = await call(
      `/api/reproduction/incubations/${incubation.id}/traitements`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produit: traitementProduit.trim(),
          concentration: traitementConcentration.trim(),
          dureeMinutes: parseInt(traitementDuree, 10),
          heure: traitementHeure ? new Date(traitementHeure).toISOString() : undefined,
          notes: traitementNotes.trim() || undefined,
        }),
      },
      { successMessage: t("incubations.detail.traitementSuccess") }
    );
    setTraitementLoading(false);

    if (result.ok) {
      setTraitementOpen(false);
      setTraitementProduit("");
      setTraitementConcentration("");
      setTraitementDuree("");
      setTraitementHeure("");
      setTraitementNotes("");
      router.refresh();
    }
  }

  async function handleDeleteTraitement(traitementId: string) {
    const result = await call(
      `/api/reproduction/incubations/${incubation.id}/traitements/${traitementId}`,
      { method: "DELETE" },
      { successMessage: t("incubations.detail.traitementSupprime") }
    );
    if (result.ok) {
      router.refresh();
    }
  }

  async function handleRecordEclosion() {
    if (!eclosionLarves || !eclosionDate) return;

    setEclosionLoading(true);
    const result = await call(
      `/api/reproduction/incubations/${incubation.id}/eclosion`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombreLarvesEcloses: parseInt(eclosionLarves, 10),
          nombreDeformes: eclosionDeformes ? parseInt(eclosionDeformes, 10) : undefined,
          dateEclosionReelle: new Date(eclosionDate).toISOString(),
          notes: eclosionNotes.trim() || undefined,
        }),
      },
      { successMessage: t("incubations.detail.eclosionSuccess") }
    );
    setEclosionLoading(false);

    if (result.ok) {
      setEclosionOpen(false);
      setEclosionNotes("");
      router.refresh();
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto pb-8">
      {/* Back link */}
      <Link
        href="/reproduction/incubations"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("incubations.backToReproduction")}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{incubation.code}</h1>
          {incubation.ponte && (
            <Link
              href={`/reproduction/pontes/${incubation.ponte.id}`}
              className="text-sm text-primary hover:underline"
            >
              {t("incubations.detail.ponte")} : {incubation.ponte.code}
            </Link>
          )}
          <p className="text-sm text-muted-foreground">
            {t("incubations.card.debut")} : {formatDate(incubation.dateDebutIncubation)}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium shrink-0 ${statutBadgeClass(incubation.statut)}`}
        >
          {t(`statuts.incubation.${incubation.statut as StatutIncubation}`) ?? incubation.statut}
        </span>
      </div>

      {/* Countdown timer */}
      {incubation.dateEclosionPrevue && (
        <EclosionCountdownTimer
          dateEclosionPrevue={incubation.dateEclosionPrevue}
          statut={incubation.statut as StatutIncubation}
        />
      )}

      {/* Info generales */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            {t("incubations.detail.informations")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-0">
          <InfoRow
            label={t("incubations.detail.substrat")}
            value={t(`incubations.substrat.${incubation.substrat as SubstratIncubation}`) ?? incubation.substrat}
          />
          {incubation.temperatureEauC !== null && (
            <InfoRow
              label={t("incubations.detail.temperature")}
              value={`${incubation.temperatureEauC} ${t("incubations.detail.degresUnit")}`}
            />
          )}
          {incubation.dureeIncubationH !== null && (
            <InfoRow
              label={t("incubations.detail.duree")}
              value={`${incubation.dureeIncubationH} ${t("incubations.detail.heuresUnit")}`}
            />
          )}
          {incubation.nombreOeufsPlaces !== null && (
            <InfoRow
              label={t("incubations.detail.oeufsPlaces")}
              value={formatNumber(incubation.nombreOeufsPlaces)}
            />
          )}
          {incubation.dateEclosionPrevue && (
            <InfoRow
              label={t("incubations.detail.eclosionPrevue")}
              value={formatDateTime(incubation.dateEclosionPrevue)}
            />
          )}
          {incubation.dateEclosionReelle && (
            <InfoRow
              label={t("incubations.detail.eclosionReelle")}
              value={formatDateTime(incubation.dateEclosionReelle)}
            />
          )}
        </CardContent>
      </Card>

      {/* Resultats (si eclosion enregistree) */}
      {incubation.statut === StatutIncubation.TERMINEE && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent-green" />
              {t("incubations.detail.resultats")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0">
            {incubation.nombreLarvesEcloses !== null && (
              <InfoRow
                label={t("incubations.detail.larvesEcloses")}
                value={formatNumber(incubation.nombreLarvesEcloses)}
              />
            )}
            {incubation.nombreDeformes !== null && (
              <InfoRow
                label={t("incubations.detail.deformes")}
                value={formatNumber(incubation.nombreDeformes)}
              />
            )}
            {incubation.nombreLarvesViables !== null && (
              <InfoRow
                label={t("incubations.detail.larvesViables")}
                value={
                  <span className="font-bold text-accent-green">
                    {formatNumber(incubation.nombreLarvesViables)}
                  </span>
                }
              />
            )}
            {incubation.tauxEclosion !== null && (
              <InfoRow
                label={t("incubations.detail.tauxEclosion")}
                value={`${incubation.tauxEclosion.toFixed(1)} ${t("incubations.detail.pourcentUnit")}`}
              />
            )}
            {incubation.notesRetrait && (
              <InfoRow label={t("incubations.detail.notesRetrait")} value={incubation.notesRetrait} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Traitements */}
      <div>
        <div className="pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("incubations.detail.traitements")}
              {incubation.traitements && incubation.traitements.length > 0 && (
                <span className="text-muted-foreground font-normal text-sm">
                  ({incubation.traitements.length})
                </span>
              )}
            </h3>
            {canModify && isEnCours && (
              <Dialog open={traitementOpen} onOpenChange={setTraitementOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="min-h-[44px] gap-1">
                    <Plus className="h-4 w-4" />
                    {t("incubations.detail.ajouterTraitement")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("incubations.detail.traitementTitre")}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-3 py-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        {t("incubations.detail.produit")} <span className="text-destructive">*</span>
                      </label>
                      <Select value={traitementProduit} onValueChange={setTraitementProduit}>
                        <SelectTrigger className="min-h-[44px]">
                          <SelectValue placeholder={t("incubations.detail.produitPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {produits.map((p) => (
                            <SelectItem key={p.id} value={p.nom}>{p.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        {t("incubations.detail.concentration")} <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder={t("incubations.detail.concentrationPlaceholder")}
                        value={traitementConcentration}
                        onChange={(e) => setTraitementConcentration(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        {t("incubations.detail.dureeMinutes")} <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder={t("incubations.detail.dureeMinutesPlaceholder")}
                        value={traitementDuree}
                        onChange={(e) => setTraitementDuree(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        {t("incubations.detail.heure")}
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={traitementHeure}
                        onChange={(e) => setTraitementHeure(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">{t("incubations.detail.notes")}</label>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        placeholder={t("incubations.detail.notesPlaceholder")}
                        value={traitementNotes}
                        onChange={(e) => setTraitementNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" disabled={traitementLoading}>
                        {t("geniteurs.form.annuler")}
                      </Button>
                    </DialogClose>
                    <Button
                      onClick={handleAddTraitement}
                      disabled={
                        traitementLoading ||
                        !traitementProduit.trim() ||
                        !traitementConcentration.trim() ||
                        !traitementDuree
                      }
                    >
                      {traitementLoading ? t("incubations.detail.enregistrement") : t("incubations.detail.ajouterTraitement")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        <div>
          {!incubation.traitements || incubation.traitements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("incubations.detail.aucunTraitement")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {incubation.traitements.map((traitement) => (
                <div
                  key={traitement.id}
                  className="flex items-start justify-between gap-2 rounded-lg px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{traitement.produit}</p>
                    <p className="text-xs text-muted-foreground">
                      {traitement.concentration} — {traitement.dureeMinutes} {t("incubations.detail.minutesUnit")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(traitement.heure)}
                    </p>
                    {traitement.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">{traitement.notes}</p>
                    )}
                  </div>
                  {canModify && (
                    <button
                      onClick={() => handleDeleteTraitement(traitement.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      aria-label={t("incubations.detail.supprimerTraitement")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lots d'alevins issus */}
      {incubation.lotAlevins && incubation.lotAlevins.length > 0 && (
        <div>
          <div className="pb-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Baby className="h-4 w-4" />
              {t("incubations.detail.lotsAlevins")}
              <span className="text-muted-foreground font-normal text-sm">
                ({incubation.lotAlevins.length})
              </span>
            </h3>
          </div>
          <div>
            <div className="flex flex-col gap-2">
              {incubation.lotAlevins.map((lot) => (
                <Link key={lot.id} href={`/alevins/lots/${lot.id}`}>
                  <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{lot.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(lot.nombreActuel)} / {formatNumber(lot.nombreInitial)} {t("incubations.card.larves")}
                        — {lot.phase}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutLotBadgeClass(lot.statut)}`}>
                        {t(`lots.statuts.${lot.statut}`) ?? lot.statut}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {incubation.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("incubations.detail.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{incubation.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Action : Enregistrer eclosion */}
      {canModify && isEnCours && (
        <Dialog open={eclosionOpen} onOpenChange={setEclosionOpen}>
          <DialogTrigger asChild>
            <Button className="w-full min-h-[44px]">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {t("incubations.detail.enregistrerEclosion")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("incubations.detail.eclosionTitre")}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  {t("incubations.detail.nombreLarvesEcloses")} <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={t("incubations.detail.nombreLarvesEclosesPlaceholder")}
                  value={eclosionLarves}
                  onChange={(e) => setEclosionLarves(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  {t("incubations.detail.nombreDeformes")}
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={t("incubations.detail.nombreDeformesPlaceholder")}
                  value={eclosionDeformes}
                  onChange={(e) => setEclosionDeformes(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  {t("incubations.detail.dateEclosionReelle")} <span className="text-destructive">*</span>
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={eclosionDate}
                  onChange={(e) => setEclosionDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  {t("incubations.detail.notes")}
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  placeholder={t("incubations.detail.notesPlaceholder")}
                  value={eclosionNotes}
                  onChange={(e) => setEclosionNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={eclosionLoading}>
                  {t("geniteurs.form.annuler")}
                </Button>
              </DialogClose>
              <Button
                onClick={handleRecordEclosion}
                disabled={eclosionLoading || !eclosionLarves || !eclosionDate}
              >
                {eclosionLoading ? t("incubations.detail.enregistrement") : t("incubations.detail.confirmerEclosion")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
