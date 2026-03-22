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
import { VagueCard } from "./vague-card";
import { StatutVague, Permission } from "@/types";
import type { VagueSummaryResponse, BacResponse } from "@/types";
import { useCreateVague } from "@/hooks/queries/use-vagues-queries";

interface VaguesListClientProps {
  vagues: VagueSummaryResponse[];
  bacsLibres: BacResponse[];
  permissions: Permission[];
}

export function VaguesListClient({ vagues, bacsLibres, permissions }: VaguesListClientProps) {
  const createVagueMutation = useCreateVague();
  const t = useTranslations("vagues");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [nombreInitial, setNombreInitial] = useState("");
  const [poidsMoyenInitial, setPoidsMoyenInitial] = useState("");
  const [origineAlevins, setOrigineAlevins] = useState("");
  const [selectedBacs, setSelectedBacs] = useState<string[]>([]);
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
    setSelectedBacs([]);
    setErrors({});
  }

  function toggleBac(bacId: string) {
    setSelectedBacs((prev) =>
      prev.includes(bacId) ? prev.filter((id) => id !== bacId) : [...prev, bacId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!code.trim()) newErrors.code = t("form.errors.code");
    if (!dateDebut) newErrors.dateDebut = t("form.errors.dateDebut");
    if (!nombreInitial || Number(nombreInitial) <= 0)
      newErrors.nombreInitial = t("form.errors.nombreInitial");
    if (!poidsMoyenInitial || Number(poidsMoyenInitial) <= 0)
      newErrors.poidsMoyenInitial = t("form.errors.poidsMoyenInitial");
    if (selectedBacs.length === 0) newErrors.bacIds = t("form.errors.bacIds");

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    try {
      await createVagueMutation.mutateAsync({
        code: code.trim(),
        dateDebut,
        nombreInitial: Number(nombreInitial),
        poidsMoyenInitial: Number(poidsMoyenInitial),
        origineAlevins: origineAlevins.trim() || undefined,
        bacIds: selectedBacs,
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

              <FormSection title={t("form.sections.bacs.title")} description={t("form.sections.bacs.description")}>
                {bacsLibres.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("form.fields.aucunBacLibre")}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {bacsLibres.map((bac) => (
                      <label
                        key={bac.id}
                        className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          selectedBacs.includes(bac.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBacs.includes(bac.id)}
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
                    ))}
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
