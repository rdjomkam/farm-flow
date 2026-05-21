"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import {
  ArrowLeft,
  ShoppingCart,
  Fish,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// Card imports removed — form uses flat sections instead
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useVenteService } from "@/services";
import { ErrorBoundary } from "@/components/ui/error-boundary";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientOption {
  id: string;
  nom: string;
}

interface VagueOption {
  id: string;
  code: string;
}

interface UniteOption {
  id: string;
  code: string;
  nom: string;
  type: "REPRODUCTION" | "GROSSISSEMENT";
}

interface LotAlevinsOption {
  id: string;
  code: string;
  nombreActuel: number;
  poidsMoyen: number | null;
  phase: string;
  ponteCode: string;
}

interface PrefillData {
  lotAlevinsId: string;
  lotCode?: string;
  quantite?: number;
  poidsTotalKg?: number;
  clientId?: string;
}

interface BacEntry {
  bacId: string;
  nom: string;
  /** Nombre de poissons actuellement disponibles dans le bac */
  nombrePoissons: number;
  /** Bac selectionne pour cette vente */
  selected: boolean;
  /** Poids total preleve depuis ce bac (saisie utilisateur) */
  poidsTotalKg: string;
  /** Poids moyen unitaire en grammes (auto-rempli depuis biometrie) */
  poidsMoyenG: string;
  /** True si poidsMoyenG a ete auto-rempli depuis la derniere biometrie */
  poidsMoyenAutoFilled: boolean;
  /** Date de la derniere biometrie (null si aucune) */
  biometryDate: Date | null;
  /** Nombre de jours depuis la derniere biometrie (null si aucune) */
  biometryDaysAgo: number | null;
}

interface VagueSource {
  /** ID de la vague selectionnee (vide si non encore choisie) */
  vagueId: string;
  bacs: BacEntry[];
  loading: boolean;
}

/** Ligne alevin pour vente reproduction */
interface AlevinsLigne {
  lotAlevinsId: string;
  nombrePoissons: string;
}

interface Props {
  clients: ClientOption[];
  vagues: VagueOption[];
  unites: UniteOption[];
  lotsAlevins: LotAlevinsOption[];
  prefill?: PrefillData;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeFishCount(poidsTotalKg: string, poidsMoyenG: string): number {
  const weight = parseFloat(poidsTotalKg);
  const avgG = parseFloat(poidsMoyenG);
  if (weight > 0 && avgG > 0) {
    return Math.max(1, Math.round((weight * 1000) / avgG));
  }
  return 0;
}

function computeSourceWeight(source: VagueSource): number {
  return source.bacs
    .filter((b) => b.selected)
    .reduce((s, b) => s + (parseFloat(b.poidsTotalKg) || 0), 0);
}

function computeSourceFish(source: VagueSource): number {
  return source.bacs
    .filter((b) => b.selected)
    .reduce((s, b) => s + computeFishCount(b.poidsTotalKg, b.poidsMoyenG), 0);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VenteFormClient({ clients, vagues, unites, lotsAlevins, prefill }: Props) {
  const t = useTranslations("ventes");
  const tSections = useTranslations("errors.sections");
  const router = useRouter();
  const queryClient = useQueryClient();
  const venteService = useVenteService();

  // --- Unite de production (step 0) ---
  const [uniteProductionId, setUniteProductionId] = useState("");
  const selectedUnite = unites.find((u) => u.id === uniteProductionId);
  const isReproduction = selectedUnite?.type === "REPRODUCTION";

  // --- Card 1: Client & Price ---
  const [clientId, setClientId] = useState(prefill?.clientId ?? "");
  const [prixUnitaireKg, setPrixUnitaireKg] = useState("");
  const [dateCommande, setDateCommande] = useState(todayIso);
  const [notes, setNotes] = useState("");

  // --- Card 2a: Fish sources for GROSSISSEMENT (dynamic, repeatable) ---
  const [sources, setSources] = useState<VagueSource[]>([
    { vagueId: "", bacs: [], loading: false },
  ]);

  // --- Card 2b: Alevin lots for REPRODUCTION ---
  const [alevinsLignes, setAlevinsLignes] = useState<AlevinsLigne[]>([
    { lotAlevinsId: "", nombrePoissons: "" },
  ]);

  // --- Computed totals (GROSSISSEMENT) ---
  const totalWeight = sources.reduce(
    (s, src) => s + computeSourceWeight(src),
    0
  );
  const totalFish = sources.reduce((s, src) => s + computeSourceFish(src), 0);
  const totalAmount = isReproduction
    ? alevinsLignes.reduce((s, l) => s + (parseInt(l.nombrePoissons, 10) || 0), 0) * (parseFloat(prixUnitaireKg) || 0)
    : totalWeight * (parseFloat(prixUnitaireKg) || 0);

  // --- Computed totals (REPRODUCTION) ---
  const totalAlevins = alevinsLignes.reduce(
    (s, l) => s + (parseInt(l.nombrePoissons, 10) || 0),
    0
  );

  // ---------------------------------------------------------------------------
  // Source management
  // ---------------------------------------------------------------------------

  const addSource = () => {
    setSources((prev) => [...prev, { vagueId: "", bacs: [], loading: false }]);
  };

  const removeSource = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSource = useCallback(
    (index: number, updater: (s: VagueSource) => VagueSource) => {
      setSources((prev) =>
        prev.map((s, i) => (i === index ? updater(s) : s))
      );
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Vague selection → load bacs from API
  // ---------------------------------------------------------------------------

  async function handleVagueSelect(sourceIndex: number, vagueId: string) {
    updateSource(sourceIndex, (s) => ({
      ...s,
      vagueId,
      bacs: [],
      loading: true,
    }));

    try {
      const res = await fetch(`/api/vagues/${vagueId}/bacs-biometry`);
      if (!res.ok) throw new Error("API error");
      const data: {
        bacs: {
          bacId: string;
          nom: string;
          nombrePoissons: number;
          dernierPoidsMoyenG: number | null;
          derniereBiometrieDate: string | null;
        }[];
      } = await res.json();

      const today = new Date();
      const bacs: BacEntry[] = data.bacs.map((b) => {
        const biometryDate = b.derniereBiometrieDate
          ? new Date(b.derniereBiometrieDate)
          : null;
        const biometryDaysAgo = biometryDate
          ? Math.floor(
              (today.getTime() - biometryDate.getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null;
        return {
          bacId: b.bacId,
          nom: b.nom,
          nombrePoissons: b.nombrePoissons,
          selected: false,
          poidsTotalKg: "",
          poidsMoyenG:
            b.dernierPoidsMoyenG != null
              ? String(Math.round(b.dernierPoidsMoyenG))
              : "",
          poidsMoyenAutoFilled: b.dernierPoidsMoyenG != null,
          biometryDate,
          biometryDaysAgo,
        };
      });

      updateSource(sourceIndex, (s) => ({ ...s, vagueId, bacs, loading: false }));
    } catch {
      updateSource(sourceIndex, (s) => ({ ...s, loading: false }));
    }
  }

  // ---------------------------------------------------------------------------
  // Bac entry updaters
  // ---------------------------------------------------------------------------

  function toggleBac(sourceIndex: number, bacId: string) {
    updateSource(sourceIndex, (s) => ({
      ...s,
      bacs: s.bacs.map((b) =>
        b.bacId === bacId ? { ...b, selected: !b.selected } : b
      ),
    }));
  }

  function updateBacField(
    sourceIndex: number,
    bacId: string,
    field: "poidsTotalKg" | "poidsMoyenG",
    value: string
  ) {
    updateSource(sourceIndex, (s) => ({
      ...s,
      bacs: s.bacs.map((b) =>
        b.bacId === bacId
          ? {
              ...b,
              [field]: value,
              // If user manually edits poidsMoyenG, it's no longer auto-filled
              ...(field === "poidsMoyenG" ? { poidsMoyenAutoFilled: false } : {}),
            }
          : b
      ),
    }));
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const selectedVagueIds = sources
    .filter((s) => s.vagueId !== "")
    .map((s) => s.vagueId);

  const hasAtLeastOneSelectedBac = sources.some((s) =>
    s.bacs.some(
      (b) =>
        b.selected &&
        parseFloat(b.poidsTotalKg) > 0
    )
  );

  const hasAtLeastOneAlevinsLigne = alevinsLignes.some(
    (l) => l.lotAlevinsId !== "" && parseInt(l.nombrePoissons, 10) > 0
  );

  const isValid = isReproduction
    ? clientId !== "" &&
      parseFloat(prixUnitaireKg) > 0 &&
      uniteProductionId !== "" &&
      hasAtLeastOneAlevinsLigne
    : clientId !== "" &&
      parseFloat(prixUnitaireKg) > 0 &&
      hasAtLeastOneSelectedBac;

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    if (isReproduction) {
      // Reproduction: vente d'alevins
      const lignes = alevinsLignes
        .filter((l) => l.lotAlevinsId !== "" && parseInt(l.nombrePoissons, 10) > 0)
        .map((l) => ({
          lotAlevinsId: l.lotAlevinsId,
          nombrePoissons: parseInt(l.nombrePoissons, 10),
        }));

      if (lignes.length === 0) return;

      const result = await venteService.createVenteRaw({
        typeVente: "alevins",
        clientId,
        prixUnitaire: parseFloat(prixUnitaireKg),
        uniteProductionId,
        lignes,
        ...(notes.trim() && { notes: notes.trim() }),
        ...(dateCommande && { dateCommande }),
      });

      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
        router.push("/ventes");
      }
    } else {
      // Grossissement: vente classique
      const lignes = sources.flatMap((source) =>
        source.bacs
          .filter((b) => b.selected && parseFloat(b.poidsTotalKg) > 0)
          .map((b) => ({
            vagueId: source.vagueId,
            bacId: b.bacId,
            poidsTotalKg: parseFloat(b.poidsTotalKg),
            ...(!b.poidsMoyenAutoFilled && parseFloat(b.poidsMoyenG) > 0
              ? { poidsMoyenG: parseFloat(b.poidsMoyenG) }
              : {}),
          }))
      );

      if (lignes.length === 0) return;

      const result = await venteService.createVente({
        clientId,
        prixUnitaireKg: parseFloat(prixUnitaireKg),
        uniteProductionId: uniteProductionId || undefined,
        lignes,
        ...(notes.trim() && { notes: notes.trim() }),
        ...(dateCommande && { dateCommande }),
      });

      if (result.ok) {
        queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
        router.push("/ventes");
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ErrorBoundary section={tSections("saleForm")}>
      <div className="flex flex-col gap-4">
        <Link
          href="/ventes"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("ventes.form.back")}
        </Link>

        {/* Banner: pre-filled from lot alevins */}
        {prefill?.lotAlevinsId && (
          <div className="flex items-start gap-3 rounded-lg border border-accent-green-muted bg-accent-green-muted/30 p-3">
            <Fish className="h-5 w-5 text-accent-green mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-0.5 text-sm">
              <span className="font-medium text-accent-green">
                {prefill.lotCode
                  ? t("ventes.form.prefillFromLotWithCode", { code: prefill.lotCode })
                  : t("ventes.form.prefillFromLot")}
              </span>
              <Link
                href={`/reproduction/lots/${prefill.lotAlevinsId}`}
                className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
              >
                {t("ventes.form.viewLotAlevins")}
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>

          {/* Section 0: Unite de production selector */}
          {unites.length > 0 && (
            <section className="flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {t("ventes.form.uniteProduction")}
              </p>
              <Select value={uniteProductionId} onValueChange={(val) => {
                setUniteProductionId(val);
                // Reset sources when switching unit type
                setSources([{ vagueId: "", bacs: [], loading: false }]);
                setAlevinsLignes([{ lotAlevinsId: "", nombrePoissons: "" }]);
              }}>
                <SelectTrigger label={t("ventes.form.uniteProduction")} required>
                  <SelectValue placeholder={t("ventes.form.uniteProductionPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {unites.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nom} ({u.type === "REPRODUCTION" ? t("ventes.form.typeReproduction") : t("ventes.form.typeGrossissement")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          )}

          {/* Section 1: Client & Price — flat, no card */}
          <section className="flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {t("ventes.form.clientEtPrix")}
            </p>

            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger label={t("ventes.form.client")} required aria-required="true">
                <SelectValue placeholder={t("ventes.form.clientPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              label={isReproduction ? t("ventes.form.prixUnitaireAlevin") : t("ventes.form.prixUnitaireKg")}
              type="number"
              min="1"
              placeholder={isReproduction ? t("ventes.form.prixUnitaireAlevinPlaceholder") : t("ventes.form.prixUnitaireKgPlaceholder")}
              required
              value={prixUnitaireKg}
              onChange={(e) => setPrixUnitaireKg(e.target.value)}
            />

            <Input
              label={t("ventes.form.dateCommande")}
              type="date"
              value={dateCommande}
              onChange={(e) => setDateCommande(e.target.value)}
            />
          </section>

          {/* Section 2a: Fish Sources for GROSSISSEMENT */}
          {!isReproduction && (
            <section className="flex flex-col gap-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {t("ventes.form.sources")}
              </p>

              {sources.map((source, sourceIndex) => (
                <SourceBlock
                  key={sourceIndex}
                  source={source}
                  sourceIndex={sourceIndex}
                  vagues={vagues}
                  selectedVagueIds={selectedVagueIds}
                  canRemove={sources.length > 1}
                  onVagueSelect={(vagueId) => handleVagueSelect(sourceIndex, vagueId)}
                  onToggleBac={(bacId) => toggleBac(sourceIndex, bacId)}
                  onUpdateBacField={(bacId, field, value) =>
                    updateBacField(sourceIndex, bacId, field, value)
                  }
                  onRemove={() => removeSource(sourceIndex)}
                  t={t}
                />
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={addSource}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("ventes.form.addSource")}
              </Button>
            </section>
          )}

          {/* Section 2b: Alevin lots for REPRODUCTION */}
          {isReproduction && (
            <section className="flex flex-col gap-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {t("ventes.form.sourcesAlevins")}
              </p>

              {alevinsLignes.map((ligne, idx) => {
                const selectedLotIds = alevinsLignes.filter((_, i) => i !== idx).map((l) => l.lotAlevinsId);
                const availableLots = lotsAlevins.filter(
                  (l) => l.id === ligne.lotAlevinsId || !selectedLotIds.includes(l.id)
                );
                const selectedLot = lotsAlevins.find((l) => l.id === ligne.lotAlevinsId);

                return (
                  <div key={idx} className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-primary/70 tracking-wide">
                        {t("ventes.form.lotLabel")} #{idx + 1}
                      </p>
                      {alevinsLignes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          onClick={() => setAlevinsLignes((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={t("ventes.form.removeSource")}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          {t("ventes.form.removeSource")}
                        </Button>
                      )}
                    </div>

                    <Select
                      value={ligne.lotAlevinsId}
                      onValueChange={(val) =>
                        setAlevinsLignes((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, lotAlevinsId: val } : l))
                        )
                      }
                    >
                      <SelectTrigger label={t("ventes.form.lotAlevins")} required>
                        <SelectValue placeholder={t("ventes.form.lotAlevinsPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLots.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.code} — {l.nombreActuel} alevins ({l.phase})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedLot && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{t("ventes.form.lotDisponible", { count: selectedLot.nombreActuel })}</span>
                        {selectedLot.poidsMoyen && (
                          <span>· {selectedLot.poidsMoyen}g {t("ventes.form.avgWeight")}</span>
                        )}
                        <span>· {t("ventes.form.lotPonte")}: {selectedLot.ponteCode}</span>
                      </div>
                    )}

                    <Input
                      label={t("ventes.form.nombreAlevins")}
                      type="number"
                      min="1"
                      max={selectedLot?.nombreActuel}
                      placeholder={t("ventes.form.nombreAlevinsPlaceholder")}
                      required
                      value={ligne.nombrePoissons}
                      onChange={(e) =>
                        setAlevinsLignes((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, nombrePoissons: e.target.value } : l))
                        )
                      }
                    />

                    {selectedLot && parseInt(ligne.nombrePoissons, 10) > selectedLot.nombreActuel && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t("ventes.form.stockInsuffisant")}
                      </p>
                    )}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  setAlevinsLignes((prev) => [...prev, { lotAlevinsId: "", nombrePoissons: "" }])
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("ventes.form.addLotAlevins")}
              </Button>
            </section>
          )}

          {/* Summary — GROSSISSEMENT */}
          {!isReproduction && totalWeight > 0 && (
            <section className="rounded-lg bg-muted/40 px-4 py-3 flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("ventes.form.totalWeight")}</span>
                <span className="font-medium">{totalWeight.toFixed(2)} kg</span>
              </div>
              {totalFish > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("ventes.form.totalFish")}</span>
                  <span className="font-medium">≈ {totalFish}</span>
                </div>
              )}
              {totalAmount > 0 && (
                <div className="flex justify-between items-baseline text-sm border-t border-muted pt-2 mt-1">
                  <span className="font-semibold">{t("ventes.form.totalAmount")}</span>
                  <span className="text-2xl font-bold">{formatNumber(totalAmount)} FCFA</span>
                </div>
              )}

              {/* Per-vague breakdown */}
              {sources.some(
                (s) => s.vagueId && computeSourceWeight(s) > 0
              ) && (
                <div className="border-t border-muted pt-2 mt-1 flex flex-col gap-1">
                  {sources
                    .filter((s) => s.vagueId && computeSourceWeight(s) > 0)
                    .map((s) => {
                      const vagueCode =
                        vagues.find((v) => v.id === s.vagueId)?.code ?? s.vagueId;
                      const w = computeSourceWeight(s);
                      const f = computeSourceFish(s);
                      return (
                        <p key={s.vagueId} className="text-xs text-muted-foreground">
                          {t("ventes.form.sourceSubtotal", {
                            weight: w.toFixed(2),
                            fish: f,
                          })}{" "}
                          — {vagueCode}
                        </p>
                      );
                    })}
                </div>
              )}
            </section>
          )}

          {/* Summary — REPRODUCTION */}
          {isReproduction && totalAlevins > 0 && (
            <section className="rounded-lg bg-muted/40 px-4 py-3 flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("ventes.form.totalAlevins")}</span>
                <span className="font-medium">{formatNumber(totalAlevins)}</span>
              </div>
              {totalAmount > 0 && (
                <div className="flex justify-between items-baseline text-sm border-t border-muted pt-2 mt-1">
                  <span className="font-semibold">{t("ventes.form.totalAmount")}</span>
                  <span className="text-2xl font-bold">{formatNumber(totalAmount)} FCFA</span>
                </div>
              )}
            </section>
          )}

          {/* Notes */}
          <Textarea
            label={t("ventes.form.notes")}
            placeholder={t("ventes.form.notesPlaceholder")}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />

          <Button
            type="submit"
            disabled={!isValid}
            className="w-full min-h-[48px]"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            {t("ventes.form.submit")}
          </Button>
        </form>
      </div>
    </ErrorBoundary>
  );
}

// ---------------------------------------------------------------------------
// SourceBlock sub-component
// ---------------------------------------------------------------------------

interface SourceBlockProps {
  source: VagueSource;
  sourceIndex: number;
  vagues: VagueOption[];
  selectedVagueIds: string[];
  canRemove: boolean;
  onVagueSelect: (vagueId: string) => void;
  onToggleBac: (bacId: string) => void;
  onUpdateBacField: (
    bacId: string,
    field: "poidsTotalKg" | "poidsMoyenG",
    value: string
  ) => void;
  onRemove: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, params?: Record<string, any>) => string;
}

function SourceBlock({
  source,
  sourceIndex,
  vagues,
  selectedVagueIds,
  canRemove,
  onVagueSelect,
  onToggleBac,
  onUpdateBacField,
  onRemove,
  t,
}: SourceBlockProps) {
  const sourceWeight = computeSourceWeight(source);
  const sourceFish = computeSourceFish(source);

  // Vagues available for this source: all vagues minus those already selected in OTHER sources
  const availableVagues = vagues.filter(
    (v) =>
      v.id === source.vagueId ||
      !selectedVagueIds.includes(v.id) ||
      source.vagueId === v.id
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header row: source label + remove — no border, just a tinted label */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-primary/70 tracking-wide">
          Lot #{sourceIndex + 1}
        </p>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label={t("ventes.form.removeSource")}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {t("ventes.form.removeSource")}
          </Button>
        )}
      </div>

      {/* Vague selector */}
      <Select value={source.vagueId} onValueChange={onVagueSelect}>
        <SelectTrigger label={t("ventes.form.vague")} required>
          <SelectValue placeholder={t("ventes.form.selectVague")} />
        </SelectTrigger>
        <SelectContent>
          {availableVagues.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Loading state */}
      {source.loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("ventes.form.loadingBacs")}
        </div>
      )}

      {/* No bacs */}
      {!source.loading &&
        source.vagueId !== "" &&
        source.bacs.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("ventes.form.noBacsInVague")}
          </p>
        )}

      {/* Bac list — flat toggle rows, no outer wrapper */}
      {!source.loading && source.bacs.length > 0 && (
        <div className="flex flex-col gap-2">
          {source.bacs.map((bac) => {
            const isStale =
              bac.biometryDate === null ||
              bac.biometryDaysAgo === null ||
              bac.biometryDaysAgo > 1;
            const fishCount = computeFishCount(bac.poidsTotalKg, bac.poidsMoyenG);

            return (
              <div
                key={bac.bacId}
                className={`rounded-lg px-3 py-2.5 flex flex-col gap-2 transition-colors ${
                  bac.selected
                    ? "bg-primary/5"
                    : "bg-muted/30"
                }`}
              >
                {/* Bac toggle header */}
                <button
                  type="button"
                  className="flex items-center gap-3 w-full text-left"
                  onClick={() => onToggleBac(bac.bacId)}
                  aria-pressed={bac.selected}
                >
                  {/* Custom checkbox */}
                  <span
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      bac.selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    }`}
                    aria-hidden="true"
                  >
                    {bac.selected && (
                      <svg
                        viewBox="0 0 12 12"
                        fill="none"
                        className="h-3 w-3"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </span>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium">{bac.nom}</span>
                    <span className="text-xs text-muted-foreground">
                      {bac.nombrePoissons} poissons disponibles
                    </span>
                  </div>
                </button>

                {/* Bac warning badges (always visible) */}
                {isStale && (
                  <div className="flex items-start gap-1.5 ml-8">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-xs text-amber-600">
                      {bac.biometryDate === null
                        ? t("ventes.form.noBiometry")
                        : t("ventes.form.staleBiometry", {
                            days: bac.biometryDaysAgo,
                          })}
                    </p>
                  </div>
                )}

                {/* Bac weight + avg weight inputs (only when selected) */}
                {bac.selected && (
                  <div className="flex flex-col gap-2 ml-8">
                    <Input
                      label={t("ventes.form.weightTaken")}
                      type="number"
                      min="0.01"
                      step="0.1"
                      placeholder="Ex: 12.5"
                      required
                      value={bac.poidsTotalKg}
                      onChange={(e) =>
                        onUpdateBacField(bac.bacId, "poidsTotalKg", e.target.value)
                      }
                    />
                    <Input
                      label={t("ventes.form.avgWeight")}
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Ex: 850"
                      value={bac.poidsMoyenG}
                      onChange={(e) =>
                        onUpdateBacField(bac.bacId, "poidsMoyenG", e.target.value)
                      }
                    />
                    {fishCount > 0 && (
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("ventes.form.estimatedFish", { count: fishCount })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Source subtotal */}
      {sourceWeight > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("ventes.form.sourceSubtotal", {
            weight: sourceWeight.toFixed(2),
            fish: sourceFish,
          })}
        </p>
      )}
    </div>
  );
}
