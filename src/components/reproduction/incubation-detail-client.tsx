"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FlaskConical,
  Baby,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
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
import { useApi } from "@/hooks/use-api";
import { StatutIncubation, SubstratIncubation, Permission } from "@/types";
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
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function statutBadgeClass(statut: string): string {
  if (statut === StatutIncubation.EN_COURS) return "bg-[var(--accent-green-muted)] text-[var(--accent-green)]";
  if (statut === StatutIncubation.ECLOSION_EN_COURS) return "bg-[var(--accent-amber-muted)] text-[var(--accent-amber)]";
  if (statut === StatutIncubation.TERMINEE) return "bg-[var(--accent-blue-muted)] text-[var(--accent-blue)]";
  return "bg-destructive/10 text-destructive";
}

const STATUT_LABELS: Record<string, string> = {
  [StatutIncubation.EN_COURS]: "En cours",
  [StatutIncubation.ECLOSION_EN_COURS]: "Eclosion en cours",
  [StatutIncubation.TERMINEE]: "Terminee",
  [StatutIncubation.ECHOUEE]: "Echouee",
};

const SUBSTRAT_LABELS: Record<string, string> = {
  [SubstratIncubation.RACINES_PISTIA]: "Racines de pistia",
  [SubstratIncubation.JACINTHES_EAU]: "Jacinthes d'eau",
  [SubstratIncubation.PLATEAU_PERFORE]: "Plateau perfore",
  [SubstratIncubation.EPONGE_PONTE]: "Eponge ponte",
  [SubstratIncubation.BROSSES_FLOTTANTES]: "Brosses flottantes",
  [SubstratIncubation.KAKABAN]: "Kakaban",
  [SubstratIncubation.FOND_BETON]: "Fond beton",
  [SubstratIncubation.AUTRE]: "Autre",
};

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

export function IncubationDetailClient({ incubation, permissions }: Props) {
  const router = useRouter();
  const { call } = useApi();

  const canModify = permissions.includes(Permission.ALEVINS_MODIFIER);

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
      { successMessage: "Traitement ajoute avec succes." }
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
      { successMessage: "Traitement supprime." }
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
        }),
      },
      { successMessage: "Eclosion enregistree avec succes." }
    );
    setEclosionLoading(false);

    if (result.ok) {
      setEclosionOpen(false);
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
        href="/reproduction/pontes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        Reproduction
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
              Ponte : {incubation.ponte.code}
            </Link>
          )}
          <p className="text-sm text-muted-foreground">
            Debut : {formatDate(incubation.dateDebutIncubation)}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium shrink-0 ${statutBadgeClass(incubation.statut)}`}
        >
          {STATUT_LABELS[incubation.statut] ?? incubation.statut}
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
            Informations d'incubation
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-0">
          <InfoRow
            label="Substrat"
            value={SUBSTRAT_LABELS[incubation.substrat] ?? incubation.substrat}
          />
          {incubation.temperatureEauC !== null && (
            <InfoRow
              label="Temperature eau"
              value={`${incubation.temperatureEauC} °C`}
            />
          )}
          {incubation.dureeIncubationH !== null && (
            <InfoRow
              label="Duree d'incubation"
              value={`${incubation.dureeIncubationH} h`}
            />
          )}
          {incubation.nombreOeufsPlaces !== null && (
            <InfoRow
              label="Oeufs places"
              value={formatNumber(incubation.nombreOeufsPlaces)}
            />
          )}
          {incubation.dateEclosionPrevue && (
            <InfoRow
              label="Eclosion prevue"
              value={formatDateTime(incubation.dateEclosionPrevue)}
            />
          )}
          {incubation.dateEclosionReelle && (
            <InfoRow
              label="Eclosion reelle"
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
              <CheckCircle2 className="h-4 w-4 text-[var(--accent-green)]" />
              Resultats d'eclosion
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0">
            {incubation.nombreLarvesEcloses !== null && (
              <InfoRow
                label="Larves ecloses"
                value={formatNumber(incubation.nombreLarvesEcloses)}
              />
            )}
            {incubation.nombreDeformes !== null && (
              <InfoRow
                label="Deformes"
                value={formatNumber(incubation.nombreDeformes)}
              />
            )}
            {incubation.nombreLarvesViables !== null && (
              <InfoRow
                label="Larves viables"
                value={
                  <span className="font-bold text-[var(--accent-green)]">
                    {formatNumber(incubation.nombreLarvesViables)}
                  </span>
                }
              />
            )}
            {incubation.tauxEclosion !== null && (
              <InfoRow
                label="Taux d'eclosion"
                value={`${incubation.tauxEclosion.toFixed(1)} %`}
              />
            )}
            {incubation.notesRetrait && (
              <InfoRow label="Notes retrait substrat" value={incubation.notesRetrait} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Traitements */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Traitements
              {incubation.traitements && incubation.traitements.length > 0 && (
                <span className="text-muted-foreground font-normal text-sm">
                  ({incubation.traitements.length})
                </span>
              )}
            </CardTitle>
            {canModify && isEnCours && (
              <Dialog open={traitementOpen} onOpenChange={setTraitementOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="min-h-[44px] gap-1">
                    <Plus className="h-4 w-4" />
                    Ajouter
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajouter un traitement</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-3 py-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        Produit <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Ex: Bleu de methylene"
                        value={traitementProduit}
                        onChange={(e) => setTraitementProduit(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        Concentration <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Ex: 0.1 mg/L"
                        value={traitementConcentration}
                        onChange={(e) => setTraitementConcentration(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        Duree (minutes) <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Ex: 30"
                        value={traitementDuree}
                        onChange={(e) => setTraitementDuree(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        Heure d'application (optionnel)
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={traitementHeure}
                        onChange={(e) => setTraitementHeure(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">Notes (optionnel)</label>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        placeholder="Observations..."
                        value={traitementNotes}
                        onChange={(e) => setTraitementNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" disabled={traitementLoading}>
                        Annuler
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
                      {traitementLoading ? "Enregistrement..." : "Ajouter"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!incubation.traitements || incubation.traitements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucun traitement enregistre
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {incubation.traitements.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t.produit}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.concentration} — {t.dureeMinutes} min
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(t.heure)}
                    </p>
                    {t.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 italic">{t.notes}</p>
                    )}
                  </div>
                  {canModify && (
                    <button
                      onClick={() => handleDeleteTraitement(t.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      aria-label="Supprimer le traitement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lots d'alevins issus */}
      {incubation.lotAlevins && incubation.lotAlevins.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Baby className="h-4 w-4" />
              Lots d'alevins issus
              <span className="text-muted-foreground font-normal text-sm">
                ({incubation.lotAlevins.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {incubation.lotAlevins.map((lot) => (
                <Link key={lot.id} href={`/alevins/lots/${lot.id}`}>
                  <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{lot.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(lot.nombreActuel)} / {formatNumber(lot.nombreInitial)} larves
                        — Phase : {lot.phase}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{lot.statut}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {incubation.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notes</CardTitle>
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
              Enregistrer l'eclosion
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enregistrer l'eclosion</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  Nombre de larves ecloses <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Ex: 5000"
                  value={eclosionLarves}
                  onChange={(e) => setEclosionLarves(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  Nombre de deformes (optionnel)
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Ex: 120"
                  value={eclosionDeformes}
                  onChange={(e) => setEclosionDeformes(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  Date et heure d'eclosion reelle <span className="text-destructive">*</span>
                </label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={eclosionDate}
                  onChange={(e) => setEclosionDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={eclosionLoading}>
                  Annuler
                </Button>
              </DialogClose>
              <Button
                onClick={handleRecordEclosion}
                disabled={eclosionLoading || !eclosionLarves || !eclosionDate}
              >
                {eclosionLoading ? "Enregistrement..." : "Confirmer l'eclosion"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
