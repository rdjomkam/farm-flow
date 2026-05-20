"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { ArrowLeft, ShoppingCart, Fish, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useVenteService } from "@/services";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface ClientOption {
  id: string;
  nom: string;
}

interface BacOption {
  id: string;
  nom: string;
  nombrePoissons: number;
}

interface VagueOption {
  id: string;
  code: string;
  poissonsDisponibles: number;
  /** Dernier poids moyen (g) constate via BIOMETRIE, null si absent */
  dernierPoidsMoyenG: number | null;
  bacs: BacOption[];
}

interface PrefillData {
  lotAlevinsId: string;
  lotCode?: string;
  quantite?: number;
  poidsTotalKg?: number;
  clientId?: string;
}

interface Props {
  clients: ClientOption[];
  vagues: VagueOption[];
  prefill?: PrefillData;
}

export function VenteFormClient({ clients, vagues, prefill }: Props) {
  const t = useTranslations("ventes");
  const tSections = useTranslations("errors.sections");
  const router = useRouter();
  const queryClient = useQueryClient();
  const venteService = useVenteService();

  const [clientId, setClientId] = useState(prefill?.clientId ?? "");
  const [vagueId, setVagueId] = useState("");
  const [poidsTotalKg, setPoidsTotalKg] = useState(
    prefill?.poidsTotalKg !== undefined ? String(prefill.poidsTotalKg) : ""
  );
  const [prixUnitaireKg, setPrixUnitaireKg] = useState("");
  // Si prefill fournit quantite ET poidsTotalKg (cas lot alevins), pre-deduire
  // le poids moyen unitaire pour preserver le nombre de poissons attendu.
  const prefillPoidsMoyenG =
    prefill?.quantite && prefill.quantite > 0 && prefill.poidsTotalKg && prefill.poidsTotalKg > 0
      ? Math.round((prefill.poidsTotalKg * 1000) / prefill.quantite)
      : null;
  const [poidsMoyenG, setPoidsMoyenG] = useState(
    prefillPoidsMoyenG != null ? String(prefillPoidsMoyenG) : ""
  );
  const [poidsMoyenTouched, setPoidsMoyenTouched] = useState(
    prefillPoidsMoyenG != null
  );
  const [dateCommande, setDateCommande] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");

  // Per-bac deductions state
  const [chooseBacs, setChooseBacs] = useState(false);
  // Map bacId -> quantity string
  const [bacQuantites, setBacQuantites] = useState<Record<string, string>>({});

  const selectedVague = vagues.find((v) => v.id === vagueId);
  const montantTotal =
    (parseFloat(poidsTotalKg) || 0) * (parseFloat(prixUnitaireKg) || 0);

  const autoPoidsMoyenG = selectedVague?.dernierPoidsMoyenG ?? null;
  const effectivePoidsMoyenG = poidsMoyenTouched
    ? parseFloat(poidsMoyenG) || 0
    : autoPoidsMoyenG ?? (parseFloat(poidsMoyenG) || 0);

  const poidsTotalKgNum = parseFloat(poidsTotalKg) || 0;
  const estimatedPoissonsAuto =
    effectivePoidsMoyenG > 0 && poidsTotalKgNum > 0
      ? Math.max(1, Math.round((poidsTotalKgNum * 1000) / effectivePoidsMoyenG))
      : 0;

  // When chooseBacs is enabled, sum bac quantities replaces auto estimate
  const bacDeductionsActive =
    chooseBacs && selectedVague != null && selectedVague.bacs.length > 0;
  const bacDeductionsList = bacDeductionsActive
    ? selectedVague!.bacs
        .map((b) => ({ bacId: b.id, quantite: parseInt(bacQuantites[b.id] ?? "0", 10) || 0 }))
        .filter((d) => d.quantite > 0)
    : [];
  const totalFromBacs = bacDeductionsList.reduce((s, d) => s + d.quantite, 0);
  const estimatedPoissons = bacDeductionsActive ? totalFromBacs : estimatedPoissonsAuto;

  function handleVagueChange(newVagueId: string) {
    setVagueId(newVagueId);
    // Reset bac quantities when vague changes
    setChooseBacs(false);
    setBacQuantites({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !vagueId) return;

    const manualPoidsMoyen = poidsMoyenTouched ? parseFloat(poidsMoyenG) : NaN;

    const result = await venteService.createVente({
      clientId,
      vagueId,
      poidsTotalKg: parseFloat(poidsTotalKg),
      prixUnitaireKg: parseFloat(prixUnitaireKg),
      ...(Number.isFinite(manualPoidsMoyen) && manualPoidsMoyen > 0
        ? { poidsMoyenG: manualPoidsMoyen }
        : {}),
      ...(notes.trim() && { notes: notes.trim() }),
      ...(dateCommande && { dateCommande }),
      ...(bacDeductionsList.length > 0 ? { bacDeductions: bacDeductionsList } : {}),
    });

    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: queryKeys.ventes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      router.push("/ventes");
    }
  }

  // In bac mode, poidsMoyenG is not needed (quantities come from bacs)
  const needsManualPoidsMoyen = !!selectedVague && autoPoidsMoyenG == null && !bacDeductionsActive;
  const manualPoidsMoyenValid =
    !needsManualPoidsMoyen || (parseFloat(poidsMoyenG) || 0) > 0;

  // In bac mode, at least one bac must have a quantity
  const bacModeValid = !bacDeductionsActive || bacDeductionsList.length > 0;

  const isValid =
    clientId &&
    vagueId &&
    parseFloat(poidsTotalKg) > 0 &&
    parseFloat(prixUnitaireKg) > 0 &&
    manualPoidsMoyenValid &&
    bacModeValid;

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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Step 1: Client + Vague */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("ventes.form.clientEtVague")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger label={t("ventes.form.client")} required aria-required="true">
                <SelectValue placeholder={t("ventes.form.clientPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={vagueId} onValueChange={handleVagueChange}>
              <SelectTrigger label={t("ventes.form.vague")} required aria-required="true">
                <SelectValue placeholder={t("ventes.form.vaguePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {vagues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {t("ventes.form.vagueOption", { code: v.code, count: v.poissonsDisponibles })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedVague && (
              <p className="text-xs text-muted-foreground">
                {t("ventes.form.poissonsDisponibles", { count: selectedVague.poissonsDisponibles })}
              </p>
            )}

            <Input
              label={t("ventes.form.dateCommande")}
              type="date"
              value={dateCommande}
              onChange={(e) => setDateCommande(e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Step 2: Quantities */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t("ventes.form.quantitesPrix")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              label={t("ventes.form.poidsTotalKg")}
              type="number"
              min="0.1"
              step="0.1"
              placeholder={t("ventes.form.poidsTotalKgPlaceholder")}
              required
              value={poidsTotalKg}
              onChange={(e) => setPoidsTotalKg(e.target.value)}
            />
            <Input
              label={t("ventes.form.prixUnitaireKg")}
              type="number"
              min="1"
              placeholder={t("ventes.form.prixUnitaireKgPlaceholder")}
              required
              value={prixUnitaireKg}
              onChange={(e) => setPrixUnitaireKg(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <Input
                label={t("ventes.form.poidsMoyenG")}
                type="number"
                min="1"
                step="1"
                placeholder={
                  autoPoidsMoyenG != null
                    ? String(Math.round(autoPoidsMoyenG))
                    : t("ventes.form.poidsMoyenGPlaceholder")
                }
                required={needsManualPoidsMoyen}
                value={poidsMoyenG}
                onChange={(e) => {
                  setPoidsMoyenG(e.target.value);
                  setPoidsMoyenTouched(true);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {autoPoidsMoyenG != null && !poidsMoyenTouched
                  ? t("ventes.form.poidsMoyenAuto", {
                      poids: Math.round(autoPoidsMoyenG),
                    })
                  : needsManualPoidsMoyen
                  ? t("ventes.form.poidsMoyenRequired")
                  : t("ventes.form.poidsMoyenOverride")}
              </p>
              {estimatedPoissons > 0 && (
                <p className="text-xs font-medium text-foreground">
                  {t("ventes.form.estimatedPoissons", { count: estimatedPoissons })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Per-bac deductions (optional) */}
        {selectedVague && selectedVague.bacs.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <button
                type="button"
                className="flex items-center justify-between w-full text-left"
                onClick={() => {
                  setChooseBacs((prev) => !prev);
                  if (chooseBacs) setBacQuantites({});
                }}
                aria-expanded={chooseBacs}
              >
                <div className="flex flex-col gap-0.5">
                  <CardTitle className="text-sm">{t("ventes.form.chooseBacs")}</CardTitle>
                  <p className="text-xs text-muted-foreground font-normal">
                    {t("ventes.form.chooseBacsDesc")}
                  </p>
                </div>
                {chooseBacs ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                )}
              </button>
            </CardHeader>
            {chooseBacs && (
              <CardContent className="flex flex-col gap-3">
                {selectedVague.bacs.map((bac) => (
                  <div key={bac.id} className="flex items-center gap-3">
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium truncate">{bac.nom}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("ventes.form.bacDisponible", { count: bac.nombrePoissons })}
                      </span>
                    </div>
                    <Input
                      aria-label={`${t("ventes.form.bacQuantite")} — ${bac.nom}`}
                      type="number"
                      min="0"
                      max={bac.nombrePoissons}
                      step="1"
                      placeholder="0"
                      value={bacQuantites[bac.id] ?? ""}
                      onChange={(e) =>
                        setBacQuantites((prev) => ({ ...prev, [bac.id]: e.target.value }))
                      }
                      className="w-24 text-right"
                    />
                  </div>
                ))}
                {totalFromBacs > 0 && (
                  <p className="text-xs font-medium text-foreground pt-1 border-t">
                    {t("ventes.form.totalFromBacs", {
                      count: totalFromBacs,
                      nbBacs: bacDeductionsList.length,
                    })}
                  </p>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* Total preview */}
        {montantTotal > 0 && (
          <div className="rounded-lg bg-muted/50 p-4 text-center">
            <p className="text-2xl font-bold">
              {formatNumber(montantTotal)} FCFA
            </p>
            <p className="text-xs text-muted-foreground">{t("ventes.form.montantTotal")}</p>
          </div>
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
