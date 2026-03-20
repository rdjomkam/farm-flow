"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Waves } from "lucide-react";
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
import { useVagueService } from "@/services";

interface VaguesListClientProps {
  vagues: VagueSummaryResponse[];
  bacsLibres: BacResponse[];
  permissions: Permission[];
}

export function VaguesListClient({ vagues, bacsLibres, permissions }: VaguesListClientProps) {
  const router = useRouter();
  const vagueService = useVagueService();
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

    if (!code.trim()) newErrors.code = "Le code est obligatoire.";
    if (!dateDebut) newErrors.dateDebut = "La date de début est obligatoire.";
    if (!nombreInitial || Number(nombreInitial) <= 0)
      newErrors.nombreInitial = "Le nombre initial doit être supérieur à 0.";
    if (!poidsMoyenInitial || Number(poidsMoyenInitial) <= 0)
      newErrors.poidsMoyenInitial = "Le poids moyen doit être supérieur à 0.";
    if (selectedBacs.length === 0) newErrors.bacIds = "Sélectionnez au moins un bac.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    const result = await vagueService.create({
      code: code.trim(),
      dateDebut,
      nombreInitial: Number(nombreInitial),
      poidsMoyenInitial: Number(poidsMoyenInitial),
      origineAlevins: origineAlevins.trim() || undefined,
      bacIds: selectedBacs,
    });

    if (result.ok) {
      setDialogOpen(false);
      resetForm();
      router.refresh();
    }
  }

  function renderVagueGrid(items: VagueSummaryResponse[]) {
    if (items.length === 0) {
      return (
        <EmptyState
          icon={<Waves className="h-7 w-7" />}
          title="Aucune vague"
          description="Aucune vague ne correspond a ce filtre."
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
          {vagues.length} vague{vagues.length > 1 ? "s" : ""}
        </h2>
        {permissions.includes(Permission.VAGUES_CREER) && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nouvelle vague
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle vague</DialogTitle>
              <DialogDescription>
                Créez un nouveau lot de poissons à suivre.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <FormSection title="Identification" description="Code et date de la vague">
                <Input
                  id="code"
                  label="Code de la vague"
                  placeholder="Ex : VAGUE-2026-001"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  error={errors.code}
                />
                <Input
                  id="dateDebut"
                  label="Date de mise en eau"
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  error={errors.dateDebut}
                />
              </FormSection>

              <FormSection title="Population initiale" description="Informations sur les alevins">
                <Input
                  id="nombreInitial"
                  label="Nombre d'alevins"
                  type="number"
                  min="1"
                  value={nombreInitial}
                  onChange={(e) => setNombreInitial(e.target.value)}
                  error={errors.nombreInitial}
                />
                <Input
                  id="poidsMoyenInitial"
                  label="Poids moyen initial (g)"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={poidsMoyenInitial}
                  onChange={(e) => setPoidsMoyenInitial(e.target.value)}
                  error={errors.poidsMoyenInitial}
                />
                <Input
                  id="origineAlevins"
                  label="Origine des alevins (optionnel)"
                  placeholder="Ex : Écloserie locale"
                  value={origineAlevins}
                  onChange={(e) => setOrigineAlevins(e.target.value)}
                />
              </FormSection>

              <FormSection title="Bacs" description="Sélectionnez les bacs à assigner">
                {bacsLibres.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucun bac libre disponible.
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
                  Annuler
                </Button>
                <Button type="submit">
                  Créer la vague
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
              En cours ({enCours.length})
            </TabsTrigger>
            <TabsTrigger value="terminee">
              Terminées ({terminees.length})
            </TabsTrigger>
            <TabsTrigger value="annulee">
              Annulées ({annulees.length})
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
