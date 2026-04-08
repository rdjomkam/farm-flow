"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Trash2,
  XCircle,
  Baby,
  FlaskConical,
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
import {
  StatutPonte,
  StatutLotAlevins,
  StatutIncubation,
  Permission,
  CauseEchecPonte,
  TypeHormone,
  QualiteOeufs,
  MethodeExtractionMale,
  MotiliteSperme,
  SubstratIncubation,
} from "@/types";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import { formatNumber, formatDate, formatDateTime, formatXAF } from "@/lib/format";

// ---------------------------------------------------------------------------
// Types locaux — miroir de ce que getPonteById retourne via Prisma
// ---------------------------------------------------------------------------

interface ReproducteurRef {
  id: string;
  code: string;
}

interface LotGeniteurRef {
  id: string;
  code: string;
}

interface IncubationRef {
  id: string;
  code: string;
  statut: string;
  dateDebutIncubation: string;
  nombreOeufsPlaces: number | null;
  nombreLarvesEcloses: number | null;
}

interface LotData {
  id: string;
  code: string;
  nombreInitial: number;
  nombreActuel: number;
  statut: string;
  bac: { id: string; nom: string } | null;
  vagueDestination: { id: string; code: string } | null;
}

interface PonteDetailData {
  id: string;
  code: string;
  datePonte: string;
  statut: string;
  notes: string | null;
  // Geniteurs
  femelleId: string;
  maleId: string | null;
  femelle?: ReproducteurRef;
  male?: ReproducteurRef | null;
  lotGeniteursFemellId: string | null;
  lotGeniteursMaleId: string | null;
  lotGeniteursFemelle?: LotGeniteurRef | null;
  lotGeniteursMale?: LotGeniteurRef | null;
  // Step 1 — Injection
  typeHormone: string | null;
  doseHormone: number | null;
  doseMgKg: number | null;
  coutHormone: number | null;
  heureInjection: string | null;
  temperatureEauC: number | null;
  latenceTheorique: number | null;
  // Step 2 — Stripping
  heureStripping: string | null;
  poidsOeufsPontesG: number | null;
  nombreOeufsEstime: number | null;
  qualiteOeufs: string | null;
  methodeMale: string | null;
  motiliteSperme: string | null;
  // Step 3 — Resultat
  tauxFecondation: number | null;
  tauxEclosion: number | null;
  nombreLarvesViables: number | null;
  coutTotal: number | null;
  // Echec
  causeEchec: string | null;
  // Related data
  incubations?: IncubationRef[];
  lots?: LotData[];
  _count?: { lots: number; incubations: number };
}

interface Props {
  ponte: PonteDetailData;
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

function statutPonteBadgeClass(statut: string): string {
  if (statut === StatutPonte.EN_COURS) return "bg-accent-green-muted text-accent-green";
  if (statut === StatutPonte.TERMINEE) return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
}

function statutIncubationBadgeClass(statut: string): string {
  if (statut === StatutIncubation.EN_COURS) return "bg-accent-green-muted text-accent-green";
  if (statut === StatutIncubation.ECLOSION_EN_COURS)
    return "bg-accent-amber-muted text-accent-amber";
  if (statut === StatutIncubation.TERMINEE) return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
}

function statutLotBadgeClass(statut: string): string {
  if (statut === StatutLotAlevins.EN_INCUBATION) return "bg-accent-amber-muted text-accent-amber";
  if (statut === StatutLotAlevins.EN_ELEVAGE) return "bg-accent-green-muted text-accent-green";
  if (statut === StatutLotAlevins.TRANSFERE) return "bg-accent-blue-muted text-accent-blue";
  return "bg-accent-red-muted text-accent-red";
}

// ---------------------------------------------------------------------------
// Workflow step completion checks
// ---------------------------------------------------------------------------

function isStep1Complete(ponte: PonteDetailData): boolean {
  return Boolean(ponte.typeHormone || ponte.doseHormone || ponte.heureInjection);
}

function isStep2Complete(ponte: PonteDetailData): boolean {
  return Boolean(ponte.heureStripping);
}

function isStep3Complete(ponte: PonteDetailData): boolean {
  return (
    ponte.statut === StatutPonte.TERMINEE ||
    ponte.tauxFecondation !== null ||
    ponte.nombreLarvesViables !== null
  );
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

export function ReproductionPonteDetailClient({ ponte, permissions }: Props) {
  const t = useTranslations("reproduction");
  const router = useRouter();
  const { call } = useApi();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [echecOpen, setEchecOpen] = useState(false);
  const [selectedCauseEchec, setSelectedCauseEchec] = useState<string>("");

  // Lancer incubation dialog state
  const [incubationOpen, setIncubationOpen] = useState(false);
  const [incubationSubstrat, setIncubationSubstrat] = useState<string>("");
  const [incubationTemp, setIncubationTemp] = useState<string>("");
  const [incubationNbOeufs, setIncubationNbOeufs] = useState<string>("");
  const [incubationDateDebut, setIncubationDateDebut] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [incubationDateEclosionPrevue, setIncubationDateEclosionPrevue] = useState<string>("");
  const [incubationNotes, setIncubationNotes] = useState<string>("");
  const [incubationLoading, setIncubationLoading] = useState(false);

  const canModifyPonte = permissions.includes(Permission.PONTES_GERER);
  const canLancerIncubation = permissions.includes(Permission.INCUBATIONS_GERER);
  const canDelete = permissions.includes(Permission.ALEVINS_SUPPRIMER);

  const hasLinkedData =
    (ponte._count?.lots ?? 0) > 0 || (ponte._count?.incubations ?? 0) > 0;

  const statutPonteLabels: Record<StatutPonte, string> = {
    [StatutPonte.EN_COURS]: t("pontes.statuts.EN_COURS"),
    [StatutPonte.TERMINEE]: t("pontes.statuts.TERMINEE"),
    [StatutPonte.ECHOUEE]: t("pontes.statuts.ECHOUEE"),
  };

  const statutIncubationLabels: Record<StatutIncubation, string> = {
    [StatutIncubation.EN_COURS]: t("statuts.incubation.EN_COURS"),
    [StatutIncubation.ECLOSION_EN_COURS]: t("statuts.incubation.ECLOSION_EN_COURS"),
    [StatutIncubation.TERMINEE]: t("statuts.incubation.TERMINEE"),
    [StatutIncubation.ECHOUEE]: t("statuts.incubation.ECHOUEE"),
  };

  const statutLotLabels: Record<StatutLotAlevins, string> = {
    [StatutLotAlevins.EN_INCUBATION]: t("lots.statuts.EN_INCUBATION"),
    [StatutLotAlevins.EN_ELEVAGE]: t("lots.statuts.EN_ELEVAGE"),
    [StatutLotAlevins.TRANSFERE]: t("lots.statuts.TRANSFERE"),
    [StatutLotAlevins.PERDU]: t("lots.statuts.PERDU"),
  };

  const causeEchecLabels: Record<CauseEchecPonte, string> = {
    [CauseEchecPonte.STRIPPING_TROP_PRECOCE]: t("pontes.causeEchec.STRIPPING_TROP_PRECOCE"),
    [CauseEchecPonte.STRIPPING_TROP_TARDIF]: t("pontes.causeEchec.STRIPPING_TROP_TARDIF"),
    [CauseEchecPonte.SPERME_NON_VIABLE]: t("pontes.causeEchec.SPERME_NON_VIABLE"),
    [CauseEchecPonte.CONTAMINATION_EAU]: t("pontes.causeEchec.CONTAMINATION_EAU"),
    [CauseEchecPonte.FEMELLE_NON_MATURE]: t("pontes.causeEchec.FEMELLE_NON_MATURE"),
    [CauseEchecPonte.HORMONE_INSUFFISANTE]: t("pontes.causeEchec.HORMONE_INSUFFISANTE"),
    [CauseEchecPonte.TEMPERATURE_INADAPTEE]: t("pontes.causeEchec.TEMPERATURE_INADAPTEE"),
    [CauseEchecPonte.MANIPULATION_EXCESSIVE]: t("pontes.causeEchec.MANIPULATION_EXCESSIVE"),
    [CauseEchecPonte.AUTRE]: t("pontes.causeEchec.AUTRE"),
  };

  async function handleDelete() {
    const result = await call<{ message: string }>(
      `/api/reproduction/pontes/${ponte.id}`,
      { method: "DELETE" },
      { successMessage: t("pontes.detail.deleteSuccess") }
    );
    if (result.ok) {
      router.push("/reproduction/pontes");
    } else {
      setDeleteOpen(false);
    }
  }

  async function handleMarkEchec() {
    if (!selectedCauseEchec) return;
    const result = await call(
      `/api/reproduction/pontes/${ponte.id}/echec`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ causeEchec: selectedCauseEchec }),
      },
      { successMessage: t("pontes.detail.echecSuccess") }
    );
    if (result.ok) {
      setEchecOpen(false);
      router.refresh();
    }
  }

  async function handleLancerIncubation() {
    if (!incubationSubstrat || !incubationDateDebut) return;
    setIncubationLoading(true);
    const body: Record<string, unknown> = {
      ponteId: ponte.id,
      substrat: incubationSubstrat,
      dateDebutIncubation: new Date(incubationDateDebut).toISOString(),
    };
    if (incubationTemp.trim()) body.temperatureEauC = parseFloat(incubationTemp);
    if (incubationNbOeufs.trim()) body.nombreOeufsPlaces = parseInt(incubationNbOeufs, 10);
    if (incubationDateEclosionPrevue)
      body.dateEclosionPrevue = new Date(incubationDateEclosionPrevue).toISOString();
    if (incubationNotes.trim()) body.notes = incubationNotes.trim();

    const result = await call<{ id: string }>(
      "/api/reproduction/incubations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { successMessage: t("incubations.lancerSuccess") }
    );
    setIncubationLoading(false);

    if (result.ok && result.data?.id) {
      setIncubationOpen(false);
      router.push(`/reproduction/incubations/${result.data.id}`);
    }
  }

  const step1Done = isStep1Complete(ponte);
  const step2Done = isStep2Complete(ponte);
  const step3Done = isStep3Complete(ponte);
  const isEchouee = ponte.statut === StatutPonte.ECHOUEE;
  const isEnCours = ponte.statut === StatutPonte.EN_COURS;

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto pb-8">
      {/* Back link */}
      <Link
        href="/reproduction/pontes"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("pontes.backToReproduction")}
      </Link>

      {/* Header: code + statut + date */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">{ponte.code}</h1>
          <p className="text-sm text-muted-foreground">{formatDate(ponte.datePonte)}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium shrink-0 ${statutPonteBadgeClass(ponte.statut)}`}
        >
          {statutPonteLabels[ponte.statut as StatutPonte] ?? ponte.statut}
        </span>
      </div>

      {/* Echec banner */}
      {isEchouee && ponte.causeEchec && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
          <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {t("pontes.detail.echecTitle")}
            </p>
            <p className="text-sm text-destructive/80 mt-0.5">
              {causeEchecLabels[ponte.causeEchec as CauseEchecPonte] ?? ponte.causeEchec}
            </p>
          </div>
        </div>
      )}

      {/* Geniteurs section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("pontes.detail.informations")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-0">
          <InfoRow
            label={
              ponte.lotGeniteursFemellId
                ? t("pontes.detail.lotFemelle")
                : t("pontes.detail.femelle")
            }
            value={
              ponte.lotGeniteursFemelle ? (
                <Link
                  href={`/reproduction/geniteurs/${ponte.lotGeniteursFemelle.id}`}
                  className="text-primary hover:underline"
                >
                  {ponte.lotGeniteursFemelle.code}
                </Link>
              ) : ponte.femelle ? (
                <Link
                  href={`/alevins/reproducteurs/${ponte.femelle.id}`}
                  className="text-primary hover:underline"
                >
                  {ponte.femelle.code}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
          <InfoRow
            label={
              ponte.lotGeniteursMaleId
                ? t("pontes.detail.lotMale")
                : t("pontes.detail.male")
            }
            value={
              ponte.lotGeniteursMale ? (
                <Link
                  href={`/reproduction/geniteurs/${ponte.lotGeniteursMale.id}`}
                  className="text-primary hover:underline"
                >
                  {ponte.lotGeniteursMale.code}
                </Link>
              ) : ponte.male ? (
                <Link
                  href={`/alevins/reproducteurs/${ponte.male.id}`}
                  className="text-primary hover:underline"
                >
                  {ponte.male.code}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
        </CardContent>
      </Card>

      {/* Workflow / Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("pontes.detail.workflow.titre")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-0 pt-2">
          {/* Step 1 — Injection */}
          <WorkflowStep
            stepNumber={1}
            title={t("pontes.detail.workflow.etape1")}
            done={step1Done}
            isEchouee={isEchouee}
          >
            {step1Done && (
              <div className="flex flex-col gap-0 mt-2 rounded-lg bg-muted/30 px-3 py-2">
                {ponte.typeHormone && (
                  <InfoRow
                    label={t("pontes.detail.injection.hormone")}
                    value={
                      Object.values(TypeHormone).includes(ponte.typeHormone as TypeHormone)
                        ? t(`pontes.hormone.${ponte.typeHormone as TypeHormone}`)
                        : ponte.typeHormone
                    }
                  />
                )}
                {ponte.doseHormone !== null && (
                  <InfoRow
                    label={t("pontes.detail.injection.dose")}
                    value={`${ponte.doseHormone} ${t("pontes.detail.injection.mlUnit")}`}
                  />
                )}
                {ponte.doseMgKg !== null && (
                  <InfoRow
                    label={t("pontes.detail.injection.doseMgKg")}
                    value={`${ponte.doseMgKg} mg/kg`}
                  />
                )}
                {ponte.coutHormone !== null && (
                  <InfoRow
                    label={t("pontes.detail.injection.coutHormone")}
                    value={formatXAF(ponte.coutHormone)}
                  />
                )}
                {ponte.heureInjection && (
                  <InfoRow
                    label={t("pontes.detail.injection.heureInjection")}
                    value={formatDateTime(ponte.heureInjection)}
                  />
                )}
                {ponte.temperatureEauC !== null && (
                  <InfoRow
                    label={t("pontes.detail.injection.temperatureEau")}
                    value={`${ponte.temperatureEauC} ${t("pontes.detail.injection.degresUnit")}`}
                  />
                )}
                {ponte.latenceTheorique !== null && (
                  <InfoRow
                    label={t("pontes.detail.injection.latenceTheorique")}
                    value={`${ponte.latenceTheorique} ${t("pontes.detail.injection.heuresUnit")}`}
                  />
                )}
              </div>
            )}
            {!step1Done && !isEchouee && (
              <Link
                href={`/reproduction/pontes/${ponte.id}/completer?step=1`}
                className="mt-2 inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                {t("pontes.detail.completer")}
              </Link>
            )}
          </WorkflowStep>

          <StepConnector />

          {/* Step 2 — Stripping */}
          <WorkflowStep
            stepNumber={2}
            title={t("pontes.detail.workflow.etape2")}
            done={step2Done}
            isEchouee={isEchouee}
          >
            {step2Done && (
              <div className="flex flex-col gap-0 mt-2 rounded-lg bg-muted/30 px-3 py-2">
                {ponte.heureStripping && (
                  <InfoRow
                    label={t("pontes.detail.stripping.heureStripping")}
                    value={formatDateTime(ponte.heureStripping)}
                  />
                )}
                {ponte.poidsOeufsPontesG !== null && (
                  <InfoRow
                    label={t("pontes.detail.stripping.poidsOeufs")}
                    value={`${ponte.poidsOeufsPontesG} ${t("pontes.detail.stripping.grammesUnit")}`}
                  />
                )}
                {ponte.nombreOeufsEstime !== null && (
                  <InfoRow
                    label={t("pontes.detail.stripping.nombreOeufsEstime")}
                    value={formatNumber(ponte.nombreOeufsEstime)}
                  />
                )}
                {ponte.qualiteOeufs && (
                  <InfoRow
                    label={t("pontes.detail.stripping.qualiteOeufs")}
                    value={
                      Object.values(QualiteOeufs).includes(ponte.qualiteOeufs as QualiteOeufs)
                        ? t(`pontes.qualiteOeufs.${ponte.qualiteOeufs as QualiteOeufs}`)
                        : ponte.qualiteOeufs
                    }
                  />
                )}
                {ponte.methodeMale && (
                  <InfoRow
                    label={t("pontes.detail.stripping.methodeMale")}
                    value={
                      Object.values(MethodeExtractionMale).includes(
                        ponte.methodeMale as MethodeExtractionMale
                      )
                        ? t(`pontes.methodeMale.${ponte.methodeMale as MethodeExtractionMale}`)
                        : ponte.methodeMale
                    }
                  />
                )}
                {ponte.motiliteSperme && (
                  <InfoRow
                    label={t("pontes.detail.stripping.motiliteSperme")}
                    value={
                      Object.values(MotiliteSperme).includes(
                        ponte.motiliteSperme as MotiliteSperme
                      )
                        ? t(`pontes.motilite.${ponte.motiliteSperme as MotiliteSperme}`)
                        : ponte.motiliteSperme
                    }
                  />
                )}
              </div>
            )}
            {!step2Done && !isEchouee && (
              <Link
                href={`/reproduction/pontes/${ponte.id}/completer?step=2`}
                className="mt-2 inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                {t("pontes.detail.completer")}
              </Link>
            )}
          </WorkflowStep>

          <StepConnector />

          {/* Step 3 — Resultat */}
          <WorkflowStep
            stepNumber={3}
            title={t("pontes.detail.workflow.etape3")}
            done={step3Done}
            isEchouee={isEchouee}
          >
            {step3Done && (
              <div className="flex flex-col gap-0 mt-2 rounded-lg bg-muted/30 px-3 py-2">
                {ponte.tauxFecondation !== null && (
                  <InfoRow
                    label={t("pontes.detail.resultat.tauxFecondation")}
                    value={`${ponte.tauxFecondation} ${t("pontes.detail.resultat.pourcentUnit")}`}
                  />
                )}
                {ponte.tauxEclosion !== null && (
                  <InfoRow
                    label={t("pontes.detail.resultat.tauxEclosion")}
                    value={`${ponte.tauxEclosion} ${t("pontes.detail.resultat.pourcentUnit")}`}
                  />
                )}
                {ponte.nombreLarvesViables !== null && (
                  <InfoRow
                    label={t("pontes.detail.resultat.larvesViables")}
                    value={formatNumber(ponte.nombreLarvesViables)}
                  />
                )}
                {ponte.coutTotal !== null && (
                  <InfoRow
                    label={t("pontes.detail.resultat.coutTotal")}
                    value={formatXAF(ponte.coutTotal)}
                  />
                )}
              </div>
            )}
            {!step3Done && !isEchouee && (
              <Link
                href={`/reproduction/pontes/${ponte.id}/completer?step=3`}
                className="mt-2 inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                {t("pontes.detail.completer")}
              </Link>
            )}
          </WorkflowStep>
        </CardContent>
      </Card>

      {/* Notes */}
      {ponte.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("pontes.detail.notes")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{ponte.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Incubations liees */}
      <div>
        <div className="pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              {t("pontes.detail.incubations")}
              {ponte.incubations && ponte.incubations.length > 0 && (
                <span className="text-muted-foreground font-normal text-sm">
                  ({ponte.incubations.length})
                </span>
              )}
            </h3>
            {canLancerIncubation && !isEchouee && step2Done && (
              <Dialog open={incubationOpen} onOpenChange={setIncubationOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="min-h-[44px] gap-1">
                    <FlaskConical className="h-4 w-4" />
                    {t("incubations.lancerIncubation")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("incubations.lancerIncubationTitle")}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-3 py-2">
                    {/* Substrat */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        {t("incubations.form.substrat")} <span className="text-destructive">*</span>
                      </label>
                      <Select value={incubationSubstrat} onValueChange={setIncubationSubstrat}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("incubations.form.substratPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(SubstratIncubation).map((s) => (
                            <SelectItem key={s} value={s}>
                              {t(`incubations.substrat.${s}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Temperature eau */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        {t("incubations.form.temperatureEauC")}
                      </label>
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        placeholder="Ex: 28"
                        value={incubationTemp}
                        onChange={(e) => setIncubationTemp(e.target.value)}
                        className="min-h-[44px]"
                      />
                    </div>
                    {/* Nombre oeufs places */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        {t("incubations.form.nombreOeufsPlaces")}
                      </label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Ex: 10000"
                        value={incubationNbOeufs}
                        onChange={(e) => setIncubationNbOeufs(e.target.value)}
                        className="min-h-[44px]"
                      />
                    </div>
                    {/* Date debut incubation */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        {t("incubations.form.dateDebutIncubation")} <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={incubationDateDebut}
                        onChange={(e) => setIncubationDateDebut(e.target.value)}
                      />
                    </div>
                    {/* Date eclosion prevue */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        {t("incubations.form.dateEclosionPrevue")}
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={incubationDateEclosionPrevue}
                        onChange={(e) => setIncubationDateEclosionPrevue(e.target.value)}
                      />
                    </div>
                    {/* Notes */}
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium">
                        {t("incubations.form.notes")}
                      </label>
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                        placeholder={t("incubations.form.notesPlaceholder")}
                        value={incubationNotes}
                        onChange={(e) => setIncubationNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline" disabled={incubationLoading}>
                        {t("geniteurs.form.annuler")}
                      </Button>
                    </DialogClose>
                    <Button
                      onClick={handleLancerIncubation}
                      disabled={incubationLoading || !incubationSubstrat || !incubationDateDebut}
                    >
                      {incubationLoading ? t("pontes.form.actions.loading") : t("incubations.lancerConfirmer")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        <div>
          {!ponte.incubations || ponte.incubations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("pontes.detail.aucuneIncubation")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {ponte.incubations.map((inc) => (
                <Link key={inc.id} href={`/reproduction/incubations/${inc.id}`}>
                  <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{inc.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(inc.dateDebutIncubation)}
                        {inc.nombreOeufsPlaces !== null &&
                          ` — ${formatNumber(inc.nombreOeufsPlaces)} oeufs`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutIncubationBadgeClass(inc.statut)}`}
                      >
                        {statutIncubationLabels[inc.statut as StatutIncubation] ?? inc.statut}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lots d'alevins */}
      <div>
        <div className="pb-2">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Baby className="h-4 w-4" />
            {t("pontes.detail.lotsAlevins")}
            {ponte.lots && ponte.lots.length > 0 && (
              <span className="text-muted-foreground font-normal text-sm">
                ({ponte.lots.length})
              </span>
            )}
          </h3>
        </div>
        <div>
          {!ponte.lots || ponte.lots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("pontes.detail.aucunLot")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {ponte.lots.map((lot) => (
                <Link key={lot.id} href={`/alevins/lots/${lot.id}`}>
                  <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium text-sm">{lot.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {lot.nombreActuel}/{lot.nombreInitial} alevins
                        {lot.bac && ` — Bac : ${lot.bac.nom}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statutLotBadgeClass(lot.statut)}`}
                      >
                        {statutLotLabels[lot.statut as StatutLotAlevins] ?? lot.statut}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {(canModifyPonte || canDelete) && (
        <div className="flex flex-col gap-3 pt-2">
          {/* Marquer comme echouee */}
          {canModifyPonte && isEnCours && (
            <Dialog open={echecOpen} onOpenChange={setEchecOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full min-h-[44px]">
                  <AlertTriangle className="h-4 w-4 mr-2 text-destructive" />
                  {t("pontes.detail.marquerEchouee")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("pontes.detail.marquerEchoueeTitle")}</DialogTitle>
                </DialogHeader>
                <div className="py-2">
                  <Select value={selectedCauseEchec} onValueChange={setSelectedCauseEchec}>
                    <SelectTrigger label={t("pontes.detail.causeEchec")}>
                      <SelectValue placeholder={t("pontes.detail.causeEchecPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(CauseEchecPonte).map((cause) => (
                        <SelectItem key={cause} value={cause}>
                          {causeEchecLabels[cause]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t("geniteurs.form.annuler")}</Button>
                  </DialogClose>
                  <Button
                    variant="danger"
                    onClick={handleMarkEchec}
                    disabled={!selectedCauseEchec}
                  >
                    {t("pontes.detail.marquerEchoueeConfirm")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Supprimer — uniquement si aucune incubation ni lot lie */}
          {canDelete && !hasLinkedData && (
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full min-h-[44px]">
                  <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                  {t("pontes.detail.supprimerPonte")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("pontes.detail.supprimerPonte")}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground py-2">
                  {t("pontes.detail.confirmDelete", { code: ponte.code })}
                </p>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">{t("geniteurs.form.annuler")}</Button>
                  </DialogClose>
                  <Button variant="danger" onClick={handleDelete}>
                    {t("geniteurs.form.supprimer")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkflowStep sub-component
// ---------------------------------------------------------------------------

interface WorkflowStepProps {
  stepNumber: number;
  title: string;
  done: boolean;
  isEchouee: boolean;
  children?: React.ReactNode;
}

function WorkflowStep({ stepNumber, title, done, isEchouee, children }: WorkflowStepProps) {
  return (
    <div className="flex gap-3">
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-accent-green" />
        ) : isEchouee ? (
          <XCircle className="h-5 w-5 text-destructive" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {String(stepNumber).padStart(2, "0")}
          </span>
          <p className="text-sm font-medium">{title}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function StepConnector() {
  return <div className="ml-[9px] w-0.5 h-4 bg-border my-0.5" />;
}
