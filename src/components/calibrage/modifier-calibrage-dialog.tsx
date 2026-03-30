"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import type { CalibrageWithRelations, PatchCalibrageBody } from "@/types";
import { useCalibrageService } from "@/services";

function toLocalDatetimeString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}


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
  const t = useTranslations("calibrage.modifierDialog");
  const queryClient = useQueryClient();
  const calibrageService = useCalibrageService();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Raison obligatoire (ADR-015) — premier champ
  const [raison, setRaison] = useState("");

  // Champs modifiables
  const [nombreMorts, setNombreMorts] = useState(String(calibrage.nombreMorts));
  const [notes, setNotes] = useState(calibrage.notes ?? "");
  const [calibrageDate, setCalibrageDate] = useState(() => toLocalDatetimeString(new Date(calibrage.date)));

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
    setCalibrageDate(toLocalDatetimeString(new Date(calibrage.date)));
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
      errs.raison = t("erreurs.raisonRequise");
    }

    if (nombreMorts === "" || Number(nombreMorts) < 0 || !Number.isInteger(Number(nombreMorts))) {
      errs.nombreMorts = t("erreurs.mortsEntier");
    }

    if (modifierGroupes) {
      if (groupes.length === 0) {
        errs.groupes = t("auMoinsUnGroupe");
      }
      groupes.forEach((g, i) => {
        if (!g.categorie) errs[`groupes_${i}_categorie`] = t("erreurs.groupeCategorie");
        if (!g.destinationBacId) errs[`groupes_${i}_bacId`] = t("erreurs.groupeBac");
        if (!g.nombrePoissons || Number(g.nombrePoissons) <= 0 || !Number.isInteger(Number(g.nombrePoissons))) {
          errs[`groupes_${i}_nombrePoissons`] = t("erreurs.groupePoissons");
        }
        if (!g.poidsMoyen || Number(g.poidsMoyen) <= 0) {
          errs[`groupes_${i}_poidsMoyen`] = t("erreurs.groupePoids");
        }
      });

      if (!conservationOk) {
        errs.conservation = t("erreurs.conservationNonRespectee", { total: totalActuel, source: totalSource });
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
      date: new Date(calibrageDate).toISOString(),
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
      (body as unknown) as PatchCalibrageBody
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
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Section 1 — Raison obligatoire (EN PREMIER) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="calib-raison" className="text-sm font-medium text-foreground">
              {t("raisonLabel")}
            </label>
            <textarea
              id="calib-raison"
              className={`min-h-[88px] w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                errors.raison ? "border-danger" : "border-border"
              }`}
              maxLength={500}
              placeholder={t("raisonPlaceholder")}
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
            />
            <div className="flex items-center justify-between">
              {errors.raison ? (
                <p className="text-xs text-danger">{errors.raison}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {raisonValid ? t("raisonValide") : t("raisonMinimum")}
                </p>
              )}
              <span className={`text-xs ${raisonLength > 500 ? "text-danger" : "text-muted-foreground"}`}>
                {raisonLength}/500
              </span>
            </div>
          </div>

          {/* Section 2 — Date et heure du calibrage */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="calib-date" className="text-sm font-medium text-foreground">
              {t("dateHeure")}
            </label>
            <input
              id="calib-date"
              type="datetime-local"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              value={calibrageDate}
              onChange={(e) => setCalibrageDate(e.target.value)}
            />
          </div>

          {/* Section 3 — Nombre de morts */}
          <Input
            id="calib-nombreMorts"
            label={t("nombreMortalites")}
            type="number"
            min="0"
            value={nombreMorts}
            onChange={(e) => setNombreMorts(e.target.value)}
            error={errors.nombreMorts}
          />

          {/* Section 4 — Groupes (toggle) */}
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border"
                checked={modifierGroupes}
                onChange={(e) => setModifierGroupes(e.target.checked)}
              />
              <span className="text-sm font-medium text-foreground">{t("modifierGroupes")}</span>
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
                    <span>{t("conservationPoissons")}</span>
                  </div>
                  <p className="text-xs">
                    {t("totalSource", { count: totalSource })}
                  </p>
                  <p className="text-xs">
                    {t("totalGroupes", { groupes: totalGroupes, morts: Number(nombreMorts) || 0, total: totalActuel })}
                    {!conservationOk && (
                      <span className="ml-1">
                        {t("ecart", { ecart: `${totalActuel - totalSource > 0 ? "+" : ""}${totalActuel - totalSource}` })}
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
                      <span className="text-xs font-medium text-muted-foreground">{t("groupeLabel", { index: i + 1 })}</span>
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
                          label={t("categorie")}
                          error={errors[`groupes_${i}_categorie`]}
                        >
                          <SelectValue placeholder="Selectionnez..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CategorieCalibrage).map((c) => (
                            <SelectItem key={c} value={c}>{t(`categorieOptions.${c}` as "categorieOptions.PETIT")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={g.destinationBacId}
                        onValueChange={(v) => updateGroupe(i, "destinationBacId", v)}
                      >
                        <SelectTrigger
                          label={t("bacDestination")}
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
                        label={t("nombrePoissons")}
                        type="number"
                        min="1"
                        value={g.nombrePoissons}
                        onChange={(e) => updateGroupe(i, "nombrePoissons", e.target.value)}
                        error={errors[`groupes_${i}_nombrePoissons`]}
                      />

                      <Input
                        label={t("poidsMoyen")}
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={g.poidsMoyen}
                        onChange={(e) => updateGroupe(i, "poidsMoyen", e.target.value)}
                        error={errors[`groupes_${i}_poidsMoyen`]}
                      />

                      <Input
                        label={t("tailleMoyenne")}
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
                  {t("ajouterGroupe")}
                </Button>
              </div>
            )}
          </div>

          {/* Section 5 — Notes */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="calib-notes" className="text-sm font-medium text-foreground">
              {t("notes")}
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
              {t("annuler")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {t("enregistrer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
