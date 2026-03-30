"use client";

import { useState } from "react";
import { Plus, Waves } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormSection } from "@/components/ui/form-section";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { VagueCard } from "./vague-card";
import { StatutVague, Permission } from "@/types";
import type { VagueSummaryResponse, BacResponse, BacStockingEntry } from "@/types";
import { useCreateVague, useVaguesList } from "@/hooks/queries/use-vagues-queries";

interface VaguesListClientProps {
  vagues: VagueSummaryResponse[];
  bacsLibres: BacResponse[];
  permissions: Permission[];
  configElevages: { id: string; nom: string }[];
}

export function VaguesListClient({ vagues: initialVagues, bacsLibres, permissions, configElevages }: VaguesListClientProps) {
  const createVagueMutation = useCreateVague();
  const { data: vagues = initialVagues } = useVaguesList(undefined, { initialData: initialVagues });
  const t = useTranslations("vagues");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [nombreInitial, setNombreInitial] = useState("");
  const [poidsMoyenInitial, setPoidsMoyenInitial] = useState("");
  const [origineAlevins, setOrigineAlevins] = useState("");
  const [configElevageId, setConfigElevageId] = useState("");
  const [selectedBacs, setSelectedBacs] = useState<string[]>([]);
  // distribution: bacId -> nombrePoissons string (kept as string for input binding)
  const [distributionMap, setDistributionMap] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const enCours = vagues.filter((v) => v.statut === StatutVague.EN_COURS);
  const terminees = vagues.filter((v) => v.statut === StatutVague.TERMINEE);
  const annulees = vagues.filter((v) => v.statut === StatutVague.ANNULEE);

  function resetForm() {
    setCode("");
    setDateDebut("");
    setNombreInitial("");
    setPoidsMoyenInitial("");
    setOrigineAlevins("");
    setConfigElevageId("");
    setSelectedBacs([]);
    setDistributionMap({});
    setErrors({});
  }

  function toggleBac(bacId: string) {
    setSelectedBacs((prev) => {
      if (prev.includes(bacId)) {
        // remove from distribution too
        setDistributionMap((dm) => {
          const next = { ...dm };
          delete next[bacId];
          return next;
        });
        return prev.filter((id) => id !== bacId);
      }
      return [...prev, bacId];
    });
  }

  function handleDistributionChange(bacId: string, value: string) {
    setDistributionMap((prev) => ({ ...prev, [bacId]: value }));
  }

  function distributeEvenly() {
    const total = Number(nombreInitial);
    if (!total || total <= 0 || selectedBacs.length === 0) return;
    const base = Math.floor(total / selectedBacs.length);
    const remainder = total % selectedBacs.length;
    const next: Record<string, string> = {};
    selectedBacs.forEach((id, i) => {
      next[id] = String(base + (i === 0 ? remainder : 0));
    });
    setDistributionMap(next);
  }

  // Derived: sum of all distribution values for selected bacs
  const totalDistribue = selectedBacs.reduce((sum, id) => {
    const v = Number(distributionMap[id]);
    return sum + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    const nombreInitialNum = Number(nombreInitial);

    if (!code.trim()) newErrors.code = t("form.errors.code");
    if (!dateDebut) newErrors.dateDebut = t("form.errors.dateDebut");
    if (!nombreInitial || nombreInitialNum <= 0)
      newErrors.nombreInitial = t("form.errors.nombreInitial");
    if (!poidsMoyenInitial || Number(poidsMoyenInitial) <= 0)
      newErrors.poidsMoyenInitial = t("form.errors.poidsMoyenInitial");
    if (!configElevageId) newErrors.configElevageId = t("form.errors.configElevageRequired");
    if (selectedBacs.length === 0) {
      newErrors.bacIds = t("form.errors.bacIds");
    } else {
      // Validate each selected bac has a valid distribution
      const hasIncomplete = selectedBacs.some((id) => {
        const v = Number(distributionMap[id]);
        return !Number.isInteger(v) || v <= 0;
      });
      if (hasIncomplete) {
        newErrors.bacIds = t("form.errors.distributionIncomplete");
      } else if (totalDistribue !== nombreInitialNum) {
        newErrors.bacIds = t("form.errors.distributionDesequilibree", {
          total: totalDistribue,
          nombreInitial: nombreInitialNum,
        });
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    const bacDistribution: BacStockingEntry[] = selectedBacs.map((bacId) => ({
      bacId,
      nombrePoissons: Number(distributionMap[bacId]),
    }));

    try {
      await createVagueMutation.mutateAsync({
        code: code.trim(),
        dateDebut,
        nombreInitial: nombreInitialNum,
        poidsMoyenInitial: Number(poidsMoyenInitial),
        origineAlevins: origineAlevins.trim() || undefined,
        configElevageId,
        bacDistribution,
      });
      setDialogOpen(false);
      resetForm();
    } catch {
      // Error already handled by useApi toast
    }
  }

  function renderVagueGrid(items: VagueSummaryResponse[]) {
    if (items.length === 0) {
      return (
        <EmptyState
          icon={<Waves className="h-7 w-7" />}
          title={t("list.emptyTitle")}
          description={t("list.emptyDescription")}
        />
      );
    }
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((v) => (
          <VagueCard key={v.id} vague={v} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-base font-semibold">
          {vagues.length > 1 ? t("list.countPlural", { count: vagues.length }) : t("list.count", { count: vagues.length })}
        </h2>
        {permissions.includes(Permission.VAGUES_CREER) && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              {t("list.newButton")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("form.create.title")}</DialogTitle>
              <DialogDescription>
                {t("form.create.description")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormSection title={t("form.sections.identification.title")} description={t("form.sections.identification.description")}>
                <Input
                  id="code"
                  label={t("form.fields.code")}
                  placeholder={t("form.fields.codePlaceholder")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  error={errors.code}
                />
                <Input
                  id="dateDebut"
                  label={t("form.fields.dateDebut")}
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  error={errors.dateDebut}
                />
              </FormSection>

              <FormSection title={t("form.sections.population.title")} description={t("form.sections.population.description")}>
                <Input
                  id="nombreInitial"
                  label={t("form.fields.nombreInitial")}
                  type="number"
                  min="1"
                  value={nombreInitial}
                  onChange={(e) => setNombreInitial(e.target.value)}
                  error={errors.nombreInitial}
                />
                <Input
                  id="poidsMoyenInitial"
                  label={t("form.fields.poidsMoyenInitial")}
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={poidsMoyenInitial}
                  onChange={(e) => setPoidsMoyenInitial(e.target.value)}
                  error={errors.poidsMoyenInitial}
                />
                <Input
                  id="origineAlevins"
                  label={t("form.fields.origineAlevins")}
                  placeholder={t("form.fields.origineAlevinsFr")}
                  value={origineAlevins}
                  onChange={(e) => setOrigineAlevins(e.target.value)}
                />
              </FormSection>

              <FormSection title={t("form.fields.configElevage")}>
                <Select value={configElevageId} onValueChange={setConfigElevageId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("form.fields.configElevagePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {configElevages.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.configElevageId && (
                  <p className="text-sm text-danger">{errors.configElevageId}</p>
                )}
              </FormSection>

              <FormSection title={t("form.sections.bacs.title")} description={t("form.sections.bacs.description")}>
                {bacsLibres.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("form.fields.aucunBacLibre")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {bacsLibres.map((bac) => {
                      const isSelected = selectedBacs.includes(bac.id);
                      return (
                        <div key={bac.id} className="flex flex-col gap-1">
                          <label
                            className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleBac(bac.id)}
                              className="h-4 w-4 accent-primary"
                            />
                            <div>
                              <span className="font-medium">{bac.nom}</span>
                              <span className="ml-1 text-muted-foreground">
                                ({bac.volume}L)
                              </span>
                            </div>
                          </label>
                          {isSelected && (
                            <input
                              type="number"
                              min="1"
                              step="1"
                              placeholder={t("form.distribution.placeholder")}
                              value={distributionMap[bac.id] ?? ""}
                              onChange={(e) => handleDistributionChange(bac.id, e.target.value)}
                              className="w-full rounded-md bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                              required
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Distribution summary — shown when at least one bac is selected */}
                {selectedBacs.length > 0 && Number(nombreInitial) > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {t("form.distribution.totalLabel", {
                          total: totalDistribue,
                          nombreInitial: Number(nombreInitial),
                        })}
                      </p>
                      <button
                        type="button"
                        onClick={distributeEvenly}
                        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        {t("form.distribution.repartirButton")}
                      </button>
                    </div>
                    {totalDistribue < Number(nombreInitial) && totalDistribue > 0 && (
                      <p className="text-xs text-warning">
                        {t("form.distribution.warningManquant", {
                          diff: Number(nombreInitial) - totalDistribue,
                        })}
                      </p>
                    )}
                    {totalDistribue > Number(nombreInitial) && (
                      <p className="text-xs text-danger">
                        {t("form.distribution.warningExcedent", {
                          diff: totalDistribue - Number(nombreInitial),
                        })}
                      </p>
                    )}
                    {totalDistribue === Number(nombreInitial) && totalDistribue > 0 && (
                      <p className="text-xs text-success">
                        {t("form.distribution.equilibre")}
                      </p>
                    )}
                  </div>
                )}

                {errors.bacIds && (
                  <p className="text-sm text-danger">{errors.bacIds}</p>
                )}
              </FormSection>

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDialogOpen(false)}
                >
                  {t("form.cancel")}
                </Button>
                <Button type="submit">
                  {t("form.create.submit")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="p-4">
        <Tabs defaultValue="en_cours">
          <TabsList>
            <TabsTrigger value="en_cours">
              {t("list.tabs.enCours", { count: enCours.length })}
            </TabsTrigger>
            <TabsTrigger value="terminee">
              {t("list.tabs.terminees", { count: terminees.length })}
            </TabsTrigger>
            <TabsTrigger value="annulee">
              {t("list.tabs.annulees", { count: annulees.length })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="en_cours">
            {renderVagueGrid(enCours)}
          </TabsContent>
          <TabsContent value="terminee">
            {renderVagueGrid(terminees)}
          </TabsContent>
          <TabsContent value="annulee">
            {renderVagueGrid(annulees)}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
