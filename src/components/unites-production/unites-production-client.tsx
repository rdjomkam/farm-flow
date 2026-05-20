"use client";

import { useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Building2,
  ArrowRight,
  Plus,
  Fish,
  TrendingUp,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TypeUniteProduction } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UniteData {
  id: string;
  code: string;
  nom: string;
  type: string;
  description: string | null;
  isActive: boolean;
  _count?: {
    vagues: number;
    depenses: number;
    transfertsSortants: number;
    transfertsEntrants: number;
  };
}

interface TransfertData {
  id: string;
  code: string;
  date: string;
  nombrePoissons: number;
  poidsMoyenG: number | null;
  prixUnitaire: number;
  prixBase: string;
  montantTotal: number;
  description: string | null;
  uniteSource: { id: string; code: string; nom: string; type: string };
  uniteDestination: { id: string; code: string; nom: string; type: string };
  lotAlevins: { id: string; code: string } | null;
  vagueDestination: { id: string; code: string } | null;
}

interface LotAlevinsRef {
  id: string;
  code: string;
}

interface VagueRef {
  id: string;
  code: string;
}

interface Props {
  unites: UniteData[];
  transferts: TransfertData[];
  lotsAlevins: LotAlevinsRef[];
  vaguesEnCours: VagueRef[];
  canManage: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMontant(montant: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(Math.round(montant)) + " FCFA";
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Unite Form Dialog
// ---------------------------------------------------------------------------

function UniteFormDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("unites-production");
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [type, setType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCode("");
    setNom("");
    setType("");
    setDescription("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !nom.trim() || !type) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/unites-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          nom: nom.trim(),
          type,
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur lors de la creation");
      }
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("unitesProduction.create")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogBody>
            <div className="space-y-4 py-2">
              <FormSection title={t("unitesProduction.form.code")}>
                <Input
                  label={t("unitesProduction.form.code")}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t("unitesProduction.form.codePlaceholder")}
                  autoCapitalize="characters"
                />
              </FormSection>

              <FormSection title={t("unitesProduction.form.nom")}>
                <Input
                  label={t("unitesProduction.form.nom")}
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder={t("unitesProduction.form.nomPlaceholder")}
                />
              </FormSection>

              <FormSection title={t("unitesProduction.form.type")}>
                <Select value={type} onValueChange={setType} required>
                  <SelectTrigger label={t("unitesProduction.form.type")} required>
                    <SelectValue placeholder={t("unitesProduction.form.typePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TypeUniteProduction.REPRODUCTION}>
                      {t("unitesProduction.types.REPRODUCTION")}
                    </SelectItem>
                    <SelectItem value={TypeUniteProduction.GROSSISSEMENT}>
                      {t("unitesProduction.types.GROSSISSEMENT")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormSection>

              <FormSection title={t("unitesProduction.form.description")}>
                <Textarea
                  label={t("unitesProduction.form.description")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("unitesProduction.form.descriptionPlaceholder")}
                  rows={3}
                />
              </FormSection>

              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="submit" disabled={loading || !code.trim() || !nom.trim() || !type} className="w-full sm:w-auto">
              {loading ? "..." : t("unitesProduction.form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Transfert Form Dialog
// ---------------------------------------------------------------------------

function TransfertFormDialog({
  open,
  onOpenChange,
  unites,
  lotsAlevins,
  vaguesEnCours,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unites: UniteData[];
  lotsAlevins: LotAlevinsRef[];
  vaguesEnCours: VagueRef[];
  onSuccess: () => void;
}) {
  const t = useTranslations("unites-production");

  const [uniteSourceId, setUniteSourceId] = useState("");
  const [uniteDestinationId, setUniteDestinationId] = useState("");
  const [nombrePoissons, setNombrePoissons] = useState("");
  const [poidsMoyenG, setPoidsMoyenG] = useState("");
  const [prixUnitaire, setPrixUnitaire] = useState("");
  const [prixBase, setPrixBase] = useState("PAR_POISSON");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lotAlevinsId, setLotAlevinsId] = useState("");
  const [vagueDestinationId, setVagueDestinationId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeUnites = unites.filter((u) => u.isActive);

  const destinationUnites = useMemo(
    () => activeUnites.filter((u) => u.id !== uniteSourceId),
    [activeUnites, uniteSourceId]
  );

  const montantTotalPreview = useMemo(() => {
    const np = parseFloat(nombrePoissons);
    const pu = parseFloat(prixUnitaire);
    const pm = parseFloat(poidsMoyenG);
    if (isNaN(np) || isNaN(pu) || np <= 0 || pu <= 0) return null;
    if (prixBase === "PAR_KG") {
      if (isNaN(pm) || pm <= 0) return null;
      return (np * pm / 1000) * pu;
    }
    return np * pu;
  }, [nombrePoissons, prixUnitaire, poidsMoyenG, prixBase]);

  function reset() {
    setUniteSourceId("");
    setUniteDestinationId("");
    setNombrePoissons("");
    setPoidsMoyenG("");
    setPrixUnitaire("");
    setPrixBase("PAR_POISSON");
    setDate(new Date().toISOString().slice(0, 10));
    setLotAlevinsId("");
    setVagueDestinationId("");
    setDescription("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const np = parseFloat(nombrePoissons);
    const pu = parseFloat(prixUnitaire);
    if (!uniteSourceId || !uniteDestinationId || isNaN(np) || isNaN(pu)) return;

    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        uniteSourceId,
        uniteDestinationId,
        nombrePoissons: np,
        prixUnitaire: pu,
        prixBase,
        date,
      };
      if (poidsMoyenG) body.poidsMoyenG = parseFloat(poidsMoyenG);
      if (lotAlevinsId) body.lotAlevinsId = lotAlevinsId;
      if (vagueDestinationId) body.vagueDestinationId = vagueDestinationId;
      if (description.trim()) body.description = description.trim();

      const res = await fetch("/api/transferts-internes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de la creation");
      }
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  const locale = useLocale();
  const isValid =
    !!uniteSourceId &&
    !!uniteDestinationId &&
    parseFloat(nombrePoissons) > 0 &&
    parseFloat(prixUnitaire) > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("transferts.create")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <DialogBody>
            <div className="space-y-4 py-2">
              {/* Unites */}
              <FormSection title={t("transferts.form.uniteSource")}>
                <Select
                  value={uniteSourceId}
                  onValueChange={(v) => {
                    setUniteSourceId(v);
                    if (uniteDestinationId === v) setUniteDestinationId("");
                  }}
                  required
                >
                  <SelectTrigger label={t("transferts.form.uniteSource")} required>
                    <SelectValue placeholder={t("transferts.form.uniteSourcePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUnites.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nom} ({u.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormSection>

              <FormSection title={t("transferts.form.uniteDestination")}>
                <Select
                  value={uniteDestinationId}
                  onValueChange={setUniteDestinationId}
                  required
                  disabled={!uniteSourceId}
                >
                  <SelectTrigger label={t("transferts.form.uniteDestination")} required>
                    <SelectValue placeholder={t("transferts.form.uniteDestinationPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationUnites.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.nom} ({u.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormSection>

              {/* Poissons & poids */}
              <FormSection title={t("transferts.form.nombrePoissons")}>
                <Input
                  label={t("transferts.form.nombrePoissons")}
                  type="number"
                  min={1}
                  required
                  value={nombrePoissons}
                  onChange={(e) => setNombrePoissons(e.target.value)}
                  placeholder="0"
                />
                <Input
                  label={t("transferts.form.poidsMoyenG")}
                  type="number"
                  min={0}
                  step={0.1}
                  value={poidsMoyenG}
                  onChange={(e) => setPoidsMoyenG(e.target.value)}
                  placeholder="0"
                />
              </FormSection>

              {/* Prix */}
              <FormSection title={t("transferts.form.prixUnitaire")}>
                <Select value={prixBase} onValueChange={setPrixBase}>
                  <SelectTrigger label={t("transferts.form.prixBase")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAR_POISSON">
                      {t("transferts.form.prixBasePAR_POISSON")}
                    </SelectItem>
                    <SelectItem value="PAR_KG">
                      {t("transferts.form.prixBasePAR_KG")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  label={t("transferts.form.prixUnitaire")}
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  value={prixUnitaire}
                  onChange={(e) => setPrixUnitaire(e.target.value)}
                  placeholder="0"
                />
              </FormSection>

              {/* Montant preview */}
              {montantTotalPreview !== null && (
                <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">
                    {t("transferts.form.montantTotal")}
                  </span>
                  <span className="text-base font-bold text-primary">
                    {formatMontant(montantTotalPreview, locale)}
                  </span>
                </div>
              )}

              {/* Date */}
              <FormSection title={t("transferts.form.date")}>
                <Input
                  label={t("transferts.form.date")}
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </FormSection>

              {/* Optional: lot alevins */}
              {lotsAlevins.length > 0 && (
                <FormSection title={t("transferts.form.lotAlevins")}>
                  <Select value={lotAlevinsId} onValueChange={setLotAlevinsId}>
                    <SelectTrigger label={t("transferts.form.lotAlevins")}>
                      <SelectValue placeholder={t("transferts.form.lotAlevinsPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {lotsAlevins.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormSection>
              )}

              {/* Optional: vague destination */}
              {vaguesEnCours.length > 0 && (
                <FormSection title={t("transferts.form.vagueDestination")}>
                  <Select value={vagueDestinationId} onValueChange={setVagueDestinationId}>
                    <SelectTrigger label={t("transferts.form.vagueDestination")}>
                      <SelectValue placeholder={t("transferts.form.vagueDestinationPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {vaguesEnCours.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormSection>
              )}

              {/* Description */}
              <FormSection title={t("transferts.form.description")}>
                <Textarea
                  label={t("transferts.form.description")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("transferts.form.descriptionPlaceholder")}
                  rows={2}
                />
              </FormSection>

              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button
              type="submit"
              disabled={loading || !isValid}
              className="w-full sm:w-auto"
            >
              {loading ? "..." : t("transferts.form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Unite Card
// ---------------------------------------------------------------------------

function UniteCard({ unite }: { unite: UniteData }) {
  const t = useTranslations("unites-production");
  const isReproduction = unite.type === TypeUniteProduction.REPRODUCTION;

  return (
    <Card className={unite.isActive ? "" : "opacity-60"}>
      <CardContent className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight truncate">{unite.nom}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{unite.code}</p>
          </div>
          <Badge variant={isReproduction ? "info" : "en_cours"}>
            {t(`unitesProduction.types.${unite.type as TypeUniteProduction}`)}
          </Badge>
        </div>

        {/* Description */}
        {unite.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{unite.description}</p>
        )}

        {/* Counts */}
        {unite._count && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Fish className="h-3.5 w-3.5 shrink-0" />
              <span>
                {unite._count.vagues} {t("unitesProduction.detail.vagues").toLowerCase()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span>
                {unite._count.depenses} {t("unitesProduction.detail.depenses").toLowerCase()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              <span>
                {unite._count.transfertsSortants} {t("unitesProduction.detail.transfertsSortants").toLowerCase()}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              <span>
                {unite._count.transfertsEntrants} {t("unitesProduction.detail.transfertsEntrants").toLowerCase()}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Transfert Card
// ---------------------------------------------------------------------------

function TransfertCard({ transfert }: { transfert: TransfertData }) {
  const t = useTranslations("unites-production");
  const locale = useLocale();

  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm">{transfert.code}</p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(transfert.date, locale)}</span>
          </div>
        </div>

        {/* Source -> Destination */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{t("transferts.card.de")}</span>
            <span className="text-sm font-medium">{transfert.uniteSource.nom}</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-4" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{t("transferts.card.vers")}</span>
            <span className="text-sm font-medium">{transfert.uniteDestination.nom}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm">
            <Fish className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {t("transferts.card.poissons", { count: transfert.nombrePoissons })}
            </span>
          </div>
          <span className="font-semibold text-sm">
            {formatMontant(transfert.montantTotal, locale)}
          </span>
        </div>

        {/* Optional refs */}
        <div className="flex flex-wrap gap-1.5">
          {transfert.lotAlevins && (
            <Badge variant="default" className="text-xs">
              {transfert.lotAlevins.code}
            </Badge>
          )}
          {transfert.vagueDestination && (
            <Badge variant="info" className="text-xs">
              {transfert.vagueDestination.code}
            </Badge>
          )}
        </div>

        {/* Description */}
        {transfert.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{transfert.description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function UnitesProductionClient({
  unites,
  transferts,
  lotsAlevins,
  vaguesEnCours,
  canManage,
}: Props) {
  const t = useTranslations("unites-production");
  const router = useRouter();
  const [uniteDialogOpen, setUniteDialogOpen] = useState(false);
  const [transfertDialogOpen, setTransfertDialogOpen] = useState(false);

  function handleSuccess() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Tabs defaultValue="unites">
        <TabsList className="w-full">
          <TabsTrigger value="unites">
            {t("unitesProduction.title")} ({unites.length})
          </TabsTrigger>
          <TabsTrigger value="transferts">
            {t("transferts.title")} ({transferts.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Unites */}
        <TabsContent value="unites">
          <div className="flex flex-col gap-4">
            {canManage && (
              <div className="flex justify-end">
                <Button size="sm" className="gap-1.5" onClick={() => setUniteDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  {t("unitesProduction.create")}
                </Button>
              </div>
            )}

            {unites.length === 0 ? (
              <EmptyState
                icon={<Building2 className="h-8 w-8" />}
                title={t("unitesProduction.empty")}
                description={t("unitesProduction.emptyDesc")}
                action={
                  canManage ? (
                    <Button size="sm" onClick={() => setUniteDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      {t("unitesProduction.create")}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {unites.map((u) => (
                  <UniteCard key={u.id} unite={u} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Transferts */}
        <TabsContent value="transferts">
          <div className="flex flex-col gap-4">
            {canManage && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={unites.filter((u) => u.isActive).length < 2}
                  onClick={() => setTransfertDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  {t("transferts.create")}
                </Button>
              </div>
            )}

            {transferts.length === 0 ? (
              <EmptyState
                icon={<ArrowRight className="h-8 w-8" />}
                title={t("transferts.empty")}
                description={t("transferts.emptyDesc")}
                action={
                  canManage && unites.filter((u) => u.isActive).length >= 2 ? (
                    <Button size="sm" onClick={() => setTransfertDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      {t("transferts.create")}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {transferts.map((tr) => (
                  <TransfertCard key={tr.id} transfert={tr} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs — rendered outside Tabs to avoid portal issues */}
      {canManage && (
        <>
          <UniteFormDialog
            open={uniteDialogOpen}
            onOpenChange={setUniteDialogOpen}
            onSuccess={handleSuccess}
          />
          <TransfertFormDialog
            open={transfertDialogOpen}
            onOpenChange={setTransfertDialogOpen}
            unites={unites}
            lotsAlevins={lotsAlevins}
            vaguesEnCours={vaguesEnCours}
            onSuccess={handleSuccess}
          />
        </>
      )}
    </div>
  );
}
