"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Pencil, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { CategorieCalibrage, Permission } from "@/types";
import type { CalibrageWithRelations } from "@/types";
import { useCalibrageService } from "@/services";

const categorieLabels: Record<CategorieCalibrage, string> = {
  [CategorieCalibrage.PETIT]: "Petit",
  [CategorieCalibrage.MOYEN]: "Moyen",
  [CategorieCalibrage.GROS]: "Gros",
  [CategorieCalibrage.TRES_GROS]: "Tres gros",
};

interface GroupeEditForm {
  categorie: string;
  destinationBacId: string;
  nombrePoissons: string;
  poidsMoyen: string;
  tailleMoyenne: string;
}

interface BacOption {
  id: string;
  nom: string;
}

interface ModifierCalibrageDialogProps {
  calibrage: CalibrageWithRelations;
  bacs: BacOption[];
  permissions: Permission[];
}

export function ModifierCalibrageDialog({
  calibrage,
  bacs,
  permissions,
}: ModifierCalibrageDialogProps) {
  const queryClient = useQueryClient();
  const calibrageService = useCalibrageService();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Raison obligatoire (ADR-015) — premier champ
  const [raison, setRaison] = useState("");

  // Champs modifiables
  const [nombreMorts, setNombreMorts] = useState(String(calibrage.nombreMorts));
  const [notes, setNotes] = useState(calibrage.notes ?? "");

  // Toggle "modifier les groupes"
  const [modifierGroupes, setModifierGroupes] = useState(false);
  const [groupes, setGroupes] = useState<GroupeEditForm[]>(
    calibrage.groupes.map((g) => ({
      categorie: g.categorie,
      destinationBacId: g.destinationBacId,
      nombrePoissons: String(g.nombrePoissons),
      poidsMoyen: String(g.poidsMoyen),
      tailleMoyenne: g.tailleMoyenne != null ? String(g.tailleMoyenne) : "",
    }))
  );

  // Total source (invariant de conservation)
  const totalSource =
    calibrage.groupes.reduce((sum, g) => sum + g.nombrePoissons, 0) +
    calibrage.nombreMorts;

  // Total courant (conservation en temps reel)
  const totalGroupes = groupes.reduce(
    (sum, g) => sum + (Number(g.nombrePoissons) || 0),
    0
  );
  const totalActuel = totalGroupes + (Number(nombreMorts) || 0);
  const conservationOk = totalActuel === totalSource;

  function resetForm() {
    setRaison("");
    setNombreMorts(String(calibrage.nombreMorts));
    setNotes(calibrage.notes ?? "");
    setModifierGroupes(false);
    setGroupes(
      calibrage.groupes.map((g) => ({
        categorie: g.categorie,
        destinationBacId: g.destinationBacId,
        nombrePoissons: String(g.nombrePoissons),
        poidsMoyen: String(g.poidsMoyen),
        tailleMoyenne: g.tailleMoyenne != null ? String(g.tailleMoyenne) : "",
      }))
    );
    setErrors({});
  }

  function addGroupe() {
    setGroupes([
      ...groupes,
      { categorie: "", destinationBacId: "", nombrePoissons: "", poidsMoyen: "", tailleMoyenne: "" },
    ]);
  }

  function removeGroupe(idx: number) {
    setGroupes(groupes.filter((_, i) => i !== idx));
  }

  function updateGroupe(idx: number, field: keyof GroupeEditForm, value: string) {
    const updated = [...groupes];
    updated[idx] = { ...updated[idx], [field]: value };
    setGroupes(updated);
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    const raisonTrimmed = raison.trim();
    if (!raisonTrimmed || raisonTrimmed.length < 5) {
      errs.raison = "La raison doit contenir au moins 5 caracteres.";
    }

    if (nombreMorts === "" || Number(nombreMorts) < 0 || !Number.isInteger(Number(nombreMorts))) {
      errs.nombreMorts = "Entier positif ou zero.";
    }

    if (modifierGroupes) {
      if (groupes.length === 0) {
        errs.groupes = "Au moins un groupe est requis.";
      }
      groupes.forEach((g, i) => {
        if (!g.categorie) errs[`groupes_${i}_categorie`] = "Categorie requise.";
        if (!g.destinationBacId) errs[`groupes_${i}_bacId`] = "Bac requis.";
        if (!g.nombrePoissons || Number(g.nombrePoissons) <= 0 || !Number.isInteger(Number(g.nombrePoissons))) {
          errs[`groupes_${i}_nombrePoissons`] = "Entier > 0.";
        }
        if (!g.poidsMoyen || Number(g.poidsMoyen) <= 0) {
          errs[`groupes_${i}_poidsMoyen`] = "Valeur > 0.";
        }
      });

      if (!conservationOk) {
        errs.conservation = `Conservation non respectee. Total : ${totalActuel} / ${totalSource}`;
      }
    }

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setErrors({});

    const body: Record<string, unknown> = {
      raison: raison.trim(),
      nombreMorts: Number(nombreMorts),
      notes: notes.trim() || null,
    };

    if (modifierGroupes) {
      body.groupes = groupes.map((g) => ({
        categorie: g.categorie,
        destinationBacId: g.destinationBacId,
        nombrePoissons: Number(g.nombrePoissons),
        poidsMoyen: Number(g.poidsMoyen),
        ...(g.tailleMoyenne ? { tailleMoyenne: Number(g.tailleMoyenne) } : {}),
      }));
    }

    const result = await calibrageService.update(
      calibrage.id,
      body as unknown as Parameters<typeof calibrageService.update>[1]
    );

    if (result.ok) {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
    }
  }

  const hasPermission =
    permissions.includes(Permission.CALIBRAGES_MODIFIER) ||
    permissions.includes(Permission.CALIBRAGES_CREER);

  if (!hasPermission) return null;

  const raisonLength = raison.trim().length;
  const raisonValid = raisonLength >= 5 && raisonLength <= 500;
  const canSubmit = raisonValid && (!modifierGroupes || conservationOk);

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-1.5" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le calibrage</DialogTitle>
          <DialogDescription>
            Toutes les modifications sont tracees pour l&apos;audit.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Section 1 — Raison obligatoire (EN PREMIER) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="calib-raison" className="text-sm font-medium text-foreground">
              Raison de la modification <span className="text-danger">*</span>
            </label>
            <textarea
              id="calib-raison"
              className={`min-h-[88px] w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                errors.raison ? "border-danger" : "border-border"
              }`}
              maxLength={500}
              placeholder="Ex : Erreur de comptage des mortalites lors du calibrage"
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
            />
            <div className="flex items-center justify-between">
              {errors.raison ? (
                <p className="text-xs text-danger">{errors.raison}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {raisonValid ? "Raison valide." : "Minimum 5 caracteres."}
                </p>
              )}
              <span className={`text-xs ${raisonLength > 500 ? "text-danger" : "text-muted-foreground"}`}>
                {raisonLength}/500
              </span>
            </div>
          </div>

          {/* Section 2 — Nombre de morts */}
          <Input
            id="calib-nombreMorts"
            label="Nombre de mortalites"
            type="number"
            min="0"
            value={nombreMorts}
            onChange={(e) => setNombreMorts(e.target.value)}
            error={errors.nombreMorts}
          />

          {/* Section 3 — Groupes (toggle) */}
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border"
                checked={modifierGroupes}
                onChange={(e) => setModifierGroupes(e.target.checked)}
              />
              <span className="text-sm font-medium text-foreground">Modifier les groupes de redistribution</span>
            </label>

            {modifierGroupes && (
              <div className="flex flex-col gap-3 pl-2 border-l-2 border-border">
                {/* Indicateur de conservation */}
                <div className={`rounded-lg p-3 text-sm ${
                  conservationOk
                    ? "bg-success/10 border border-success/30 text-success"
                    : "bg-danger/10 border border-danger/30 text-danger"
                }`}>
                  <div className="flex items-center gap-2 font-medium mb-1">
                    {conservationOk ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span>Conservation des poissons</span>
                  </div>
                  <p className="text-xs">
                    Total source : <strong>{totalSource}</strong> poissons
                  </p>
                  <p className="text-xs">
                    Groupes : <strong>{totalGroupes}</strong> + Morts : <strong>{Number(nombreMorts) || 0}</strong> = <strong>{totalActuel}</strong>
                    {!conservationOk && (
                      <span className="ml-1">
                        (ecart : {totalActuel - totalSource > 0 ? "+" : ""}{totalActuel - totalSource})
                      </span>
                    )}
                  </p>
                </div>

                {errors.groupes && (
                  <p className="text-xs text-danger">{errors.groupes}</p>
                )}
                {errors.conservation && (
                  <p className="text-xs text-danger">{errors.conservation}</p>
                )}

                {/* Liste des groupes */}
                {groupes.map((g, i) => (
                  <div key={i} className="rounded-lg border border-border bg-background p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Groupe {i + 1}</span>
                      {groupes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-danger"
                          onClick={() => removeGroupe(i)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Select
                        value={g.categorie}
                        onValueChange={(v) => updateGroupe(i, "categorie", v)}
                      >
                        <SelectTrigger
                          label="Categorie"
                          error={errors[`groupes_${i}_categorie`]}
                        >
                          <SelectValue placeholder="Selectionnez..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CategorieCalibrage).map((c) => (
                            <SelectItem key={c} value={c}>{categorieLabels[c]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={g.destinationBacId}
                        onValueChange={(v) => updateGroupe(i, "destinationBacId", v)}
                      >
                        <SelectTrigger
                          label="Bac destination"
                          error={errors[`groupes_${i}_bacId`]}
                        >
                          <SelectValue placeholder="Selectionnez..." />
                        </SelectTrigger>
                        <SelectContent>
                          {bacs.map((b) => (
                            <SelectItem key={b.id} value={b.id}>{b.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        label="Nombre poissons"
                        type="number"
                        min="1"
                        value={g.nombrePoissons}
                        onChange={(e) => updateGroupe(i, "nombrePoissons", e.target.value)}
                        error={errors[`groupes_${i}_nombrePoissons`]}
                      />

                      <Input
                        label="Poids moyen (g)"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={g.poidsMoyen}
                        onChange={(e) => updateGroupe(i, "poidsMoyen", e.target.value)}
                        error={errors[`groupes_${i}_poidsMoyen`]}
                      />

                      <Input
                        label="Taille moyenne (cm, optionnel)"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={g.tailleMoyenne}
                        onChange={(e) => updateGroupe(i, "tailleMoyenne", e.target.value)}
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addGroupe}
                  className="self-start"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Ajouter un groupe
                </Button>
              </div>
            )}
          </div>

          {/* Section 4 — Notes */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="calib-notes" className="text-sm font-medium text-foreground">
              Notes (optionnel)
            </label>
            <textarea
              id="calib-notes"
              className="min-h-[66px] w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
