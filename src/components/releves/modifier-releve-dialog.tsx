"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { queryKeys } from "@/lib/query-keys";
import { useTranslations } from "next-intl";
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
import { TypeReleve, CauseMortalite, TypeAliment, MethodeComptage, CategorieProduit, Permission } from "@/types";
import type { Releve } from "@/types";
import { ConsommationFields } from "@/components/releves/consommation-fields";
import type { ConsommationLine, ProduitOption } from "@/components/releves/consommation-fields";
import { useReleveService } from "@/services";

interface ModifierReleveDialogProps {
  releve: Releve;
  /** Liste des produits disponibles pour les consommations (ALIMENT + INTRANT) */
  produits?: ProduitOption[];
  permissions: Permission[];
}

export function ModifierReleveDialog({ releve, produits = [], permissions }: ModifierReleveDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const releveService = useReleveService();
  const t = useTranslations("releves");
  const type = releve.typeReleve as TypeReleve;
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Raison obligatoire (ADR-014) — premier champ visible
  const [raison, setRaison] = useState("");

  // Date du releve (modifiable)
  const formatDatetime = (d: string | Date) => {
    const dt = new Date(d);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };
  const [releveDate, setReleveDate] = useState(formatDatetime(releve.date));
  const now = new Date();
  const todayDatetime = (() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  })();

  // Type-specific fields
  const [poidsMoyen, setPoidsMoyen] = useState(String(releve.poidsMoyen ?? ""));
  const [tailleMoyenne, setTailleMoyenne] = useState(String(releve.tailleMoyenne ?? ""));
  const [echantillonCount, setEchantillonCount] = useState(String(releve.echantillonCount ?? ""));
  const [nombreMorts, setNombreMorts] = useState(String(releve.nombreMorts ?? ""));
  const [causeMortalite, setCauseMortalite] = useState(releve.causeMortalite ?? "");
  const [quantiteAliment, setQuantiteAliment] = useState(String(releve.quantiteAliment ?? ""));
  const [typeAliment, setTypeAliment] = useState(releve.typeAliment ?? "");
  const [frequenceAliment, setFrequenceAliment] = useState(String(releve.frequenceAliment ?? ""));
  const [temperature, setTemperature] = useState(String(releve.temperature ?? ""));
  const [ph, setPh] = useState(String(releve.ph ?? ""));
  const [oxygene, setOxygene] = useState(String(releve.oxygene ?? ""));
  const [ammoniac, setAmmoniac] = useState(String(releve.ammoniac ?? ""));
  const [nombreCompte, setNombreCompte] = useState(String(releve.nombreCompte ?? ""));
  const [methodeComptage, setMethodeComptage] = useState(releve.methodeComptage ?? "");
  const [description, setDescription] = useState(releve.description ?? "");
  const [pourcentageRenouvellement, setPourcentageRenouvellement] = useState(String(releve.pourcentageRenouvellement ?? ""));
  const [volumeRenouvele, setVolumeRenouvele] = useState(String(releve.volumeRenouvele ?? ""));
  const [nombreRenouvellements, setNombreRenouvellements] = useState(String(releve.nombreRenouvellements ?? 1));
  const [notes, setNotes] = useState(releve.notes ?? "");

  // Types de releve qui supportent les consommations
  const typesAvecConsommations = [TypeReleve.ALIMENTATION, TypeReleve.MORTALITE, TypeReleve.QUALITE_EAU];
  const categorieConsommation = type === TypeReleve.ALIMENTATION ? CategorieProduit.ALIMENT : CategorieProduit.INTRANT;

  const [consommationLignes, setConsommationLignes] = useState<ConsommationLine[]>(
    releve.consommations?.map((c) => ({
      produitId: c.produitId,
      quantite: String(c.quantite),
    })) ?? []
  );

  function resetForm() {
    setRaison("");
    setReleveDate(formatDatetime(releve.date));
    setPoidsMoyen(String(releve.poidsMoyen ?? ""));
    setTailleMoyenne(String(releve.tailleMoyenne ?? ""));
    setEchantillonCount(String(releve.echantillonCount ?? ""));
    setNombreMorts(String(releve.nombreMorts ?? ""));
    setCauseMortalite(releve.causeMortalite ?? "");
    setQuantiteAliment(String(releve.quantiteAliment ?? ""));
    setTypeAliment(releve.typeAliment ?? "");
    setFrequenceAliment(String(releve.frequenceAliment ?? ""));
    setTemperature(String(releve.temperature ?? ""));
    setPh(String(releve.ph ?? ""));
    setOxygene(String(releve.oxygene ?? ""));
    setAmmoniac(String(releve.ammoniac ?? ""));
    setNombreCompte(String(releve.nombreCompte ?? ""));
    setMethodeComptage(releve.methodeComptage ?? "");
    setDescription(releve.description ?? "");
    setPourcentageRenouvellement(String(releve.pourcentageRenouvellement ?? ""));
    setVolumeRenouvele(String(releve.volumeRenouvele ?? ""));
    setNombreRenouvellements(String(releve.nombreRenouvellements ?? 1));
    setNotes(releve.notes ?? "");
    setConsommationLignes(
      releve.consommations?.map((c) => ({
        produitId: c.produitId,
        quantite: String(c.quantite),
      })) ?? []
    );
    setErrors({});
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};

    // Validation de la raison (obligatoire, min 5)
    if (!raison.trim() || raison.trim().length < 5) {
      errs.raison = t("modify.raison.error");
    }

    switch (type) {
      case TypeReleve.BIOMETRIE:
        if (!poidsMoyen || Number(poidsMoyen) <= 0) errs.poidsMoyen = t("modify.errors.poidsMoyen");
        if (tailleMoyenne && Number(tailleMoyenne) <= 0) errs.tailleMoyenne = t("modify.errors.tailleMoyenne");
        if (!echantillonCount || Number(echantillonCount) <= 0 || !Number.isInteger(Number(echantillonCount)))
          errs.echantillonCount = t("modify.errors.echantillonCount");
        break;
      case TypeReleve.MORTALITE:
        if (nombreMorts === "" || Number(nombreMorts) < 0 || !Number.isInteger(Number(nombreMorts)))
          errs.nombreMorts = t("modify.errors.nombreMorts");
        if (!causeMortalite) errs.causeMortalite = t("modify.errors.causeMortalite");
        break;
      case TypeReleve.ALIMENTATION:
        if (!quantiteAliment || Number(quantiteAliment) <= 0) errs.quantiteAliment = t("modify.errors.quantiteAliment");
        if (!typeAliment) errs.typeAliment = t("modify.errors.typeAliment");
        if (!frequenceAliment || Number(frequenceAliment) <= 0 || !Number.isInteger(Number(frequenceAliment)))
          errs.frequenceAliment = t("modify.errors.frequenceAliment");
        break;
      case TypeReleve.COMPTAGE:
        if (!nombreCompte || Number(nombreCompte) <= 0 || !Number.isInteger(Number(nombreCompte)))
          errs.nombreCompte = t("modify.errors.nombreCompte");
        if (!methodeComptage) errs.methodeComptage = t("modify.errors.methodeComptage");
        break;
      case TypeReleve.OBSERVATION:
        if (!description.trim()) errs.description = t("modify.errors.description");
        break;
      case TypeReleve.RENOUVELLEMENT: {
        const hasPct = pourcentageRenouvellement !== "" && pourcentageRenouvellement != null;
        const hasVol = volumeRenouvele !== "" && volumeRenouvele != null;
        if (!hasPct && !hasVol) errs.pourcentageRenouvellement = t("form.errors.renouvellementRequis");
        if (hasPct && (Number(pourcentageRenouvellement) < 0 || Number(pourcentageRenouvellement) > 100))
          errs.pourcentageRenouvellement = t("form.errors.pourcentageRange");
        if (hasVol && Number(volumeRenouvele) <= 0)
          errs.volumeRenouvele = t("form.errors.volumePositif");
        const n = Number(nombreRenouvellements);
        if (nombreRenouvellements !== "" && (!Number.isInteger(n) || n < 1 || n > 20))
          errs.nombreRenouvellements = t("form.errors.nombreRenouvellementMin");
        break;
      }
      // QUALITE_EAU: all fields optional
    }
    return errs;
  }

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = { raison: raison.trim() };

    // Inclure la date seulement si elle a change — convert to ISO for correct UTC
    if (releveDate && releveDate !== formatDatetime(releve.date)) {
      body.date = new Date(releveDate).toISOString();
    }

    if (notes.trim()) body.notes = notes.trim();
    else body.notes = null;

    switch (type) {
      case TypeReleve.BIOMETRIE:
        body.poidsMoyen = Number(poidsMoyen);
        body.tailleMoyenne = tailleMoyenne ? Number(tailleMoyenne) : null;
        body.echantillonCount = Number(echantillonCount);
        break;
      case TypeReleve.MORTALITE:
        body.nombreMorts = Number(nombreMorts);
        body.causeMortalite = causeMortalite;
        break;
      case TypeReleve.ALIMENTATION:
        body.quantiteAliment = Number(quantiteAliment);
        body.typeAliment = typeAliment;
        body.frequenceAliment = Number(frequenceAliment);
        break;
      case TypeReleve.QUALITE_EAU:
        if (temperature) body.temperature = Number(temperature);
        if (ph) body.ph = Number(ph);
        if (oxygene) body.oxygene = Number(oxygene);
        if (ammoniac) body.ammoniac = Number(ammoniac);
        break;
      case TypeReleve.COMPTAGE:
        body.nombreCompte = Number(nombreCompte);
        body.methodeComptage = methodeComptage;
        break;
      case TypeReleve.OBSERVATION:
        body.description = description.trim();
        break;
      case TypeReleve.RENOUVELLEMENT:
        if (pourcentageRenouvellement !== "") body.pourcentageRenouvellement = Number(pourcentageRenouvellement);
        if (volumeRenouvele !== "") body.volumeRenouvele = Number(volumeRenouvele);
        body.nombreRenouvellements = Number(nombreRenouvellements) || 1;
        break;
    }

    if (typesAvecConsommations.includes(type)) {
      body.consommations = consommationLignes
        .filter((l) => l.produitId && l.quantite && parseFloat(l.quantite) > 0)
        .map((l) => ({ produitId: l.produitId, quantite: parseFloat(l.quantite) }));
    }

    return body;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setErrors({});

    const result = await releveService.update(releve.id, buildBody() as unknown as { raison: string; [key: string]: unknown });

    if (result.ok) {
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.releves.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      router.refresh();
    }
  }

  if (!permissions.includes(Permission.RELEVES_MODIFIER)) return null;

  const raisonLength = raison.trim().length;
  const raisonValid = raisonLength >= 5 && raisonLength <= 500;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("modify.title")}</DialogTitle>
          <DialogDescription>
            {t("modify.description", { type: t(`types.${type}`) })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Section 1 — Raison obligatoire (EN PREMIER, ADR-014) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`raison-${releve.id}`} className="text-sm font-medium text-foreground">
              {t("modify.raison.label")} <span className="text-danger">{t("modify.raison.required")}</span>
            </label>
            <textarea
              id={`raison-${releve.id}`}
              className={`min-h-[88px] w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                errors.raison ? "border-danger" : "border-border"
              }`}
              maxLength={500}
              placeholder={t("modify.raison.placeholder")}
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
            />
            <div className="flex items-center justify-between">
              {errors.raison ? (
                <p className="text-xs text-danger">{errors.raison}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {raisonValid ? t("modify.raison.valid") : t("modify.raison.min")}
                </p>
              )}
              <span className={`text-xs ${raisonLength > 500 ? "text-danger" : "text-muted-foreground"}`}>
                {raisonLength}/500
              </span>
            </div>
          </div>

          {/* Section 2 — Date du releve */}
          <Input
            id={`date-${releve.id}`}
            label={t("modify.dateLabel")}
            type="datetime-local"
            max={todayDatetime}
            value={releveDate}
            onChange={(e) => setReleveDate(e.target.value)}
            error={errors.date}
          />

          {/* Section 3 — Champs du type de releve */}
          {type === TypeReleve.BIOMETRIE && (
            <>
              <Input
                id={`poidsMoyen-${releve.id}`}
                label={t("modify.fields.poidsMoyen")}
                type="number"
                min="0.1"
                step="0.1"
                value={poidsMoyen}
                onChange={(e) => setPoidsMoyen(e.target.value)}
                error={errors.poidsMoyen}
              />
              <Input
                id={`tailleMoyenne-${releve.id}`}
                label={t("modify.fields.tailleMoyenne")}
                type="number"
                min="0.1"
                step="0.1"
                value={tailleMoyenne}
                onChange={(e) => setTailleMoyenne(e.target.value)}
                error={errors.tailleMoyenne}
              />
              <Input
                id={`echantillonCount-${releve.id}`}
                label={t("modify.fields.echantillonCount")}
                type="number"
                min="1"
                value={echantillonCount}
                onChange={(e) => setEchantillonCount(e.target.value)}
                error={errors.echantillonCount}
              />
            </>
          )}

          {type === TypeReleve.MORTALITE && (
            <>
              <Input
                id={`nombreMorts-${releve.id}`}
                label={t("modify.fields.nombreMorts")}
                type="number"
                min="0"
                value={nombreMorts}
                onChange={(e) => setNombreMorts(e.target.value)}
                error={errors.nombreMorts}
              />
              <Select value={causeMortalite} onValueChange={setCauseMortalite}>
                <SelectTrigger label={t("modify.causeLabel")} error={errors.causeMortalite}>
                  <SelectValue placeholder={t("modify.causePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CauseMortalite).map((c) => (
                    <SelectItem key={c} value={c}>{t(`form.mortalite.causes.${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {type === TypeReleve.ALIMENTATION && (
            <>
              <Input
                id={`quantiteAliment-${releve.id}`}
                label={t("modify.fields.quantiteAliment")}
                type="number"
                min="0.1"
                step="0.1"
                value={quantiteAliment}
                onChange={(e) => setQuantiteAliment(e.target.value)}
                error={errors.quantiteAliment}
              />
              <Select value={typeAliment} onValueChange={setTypeAliment}>
                <SelectTrigger label={t("modify.typeAlimentLabel")} error={errors.typeAliment}>
                  <SelectValue placeholder={t("modify.typeAlimentPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TypeAliment).map((tp) => (
                    <SelectItem key={tp} value={tp}>{t(`form.alimentation.types.${tp}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id={`frequenceAliment-${releve.id}`}
                label={t("modify.fields.frequenceAliment")}
                type="number"
                min="1"
                value={frequenceAliment}
                onChange={(e) => setFrequenceAliment(e.target.value)}
                error={errors.frequenceAliment}
              />
            </>
          )}

          {type === TypeReleve.QUALITE_EAU && (
            <>
              <Input
                id={`temperature-${releve.id}`}
                label={t("modify.fields.temperature")}
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
              <Input
                id={`ph-${releve.id}`}
                label={t("modify.fields.ph")}
                type="number"
                step="0.1"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
              />
              <Input
                id={`oxygene-${releve.id}`}
                label={t("modify.fields.oxygene")}
                type="number"
                step="0.1"
                value={oxygene}
                onChange={(e) => setOxygene(e.target.value)}
              />
              <Input
                id={`ammoniac-${releve.id}`}
                label={t("modify.fields.ammoniac")}
                type="number"
                step="0.01"
                value={ammoniac}
                onChange={(e) => setAmmoniac(e.target.value)}
              />
            </>
          )}

          {type === TypeReleve.COMPTAGE && (
            <>
              <Input
                id={`nombreCompte-${releve.id}`}
                label={t("modify.fields.nombreCompte")}
                type="number"
                min="1"
                value={nombreCompte}
                onChange={(e) => setNombreCompte(e.target.value)}
                error={errors.nombreCompte}
              />
              <Select value={methodeComptage} onValueChange={setMethodeComptage}>
                <SelectTrigger label={t("modify.methodeLabel")} error={errors.methodeComptage}>
                  <SelectValue placeholder={t("modify.methodePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(MethodeComptage).map((m) => (
                    <SelectItem key={m} value={m}>{t(`form.comptage.methodes.${m}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {type === TypeReleve.OBSERVATION && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`description-${releve.id}`} className="text-sm font-medium text-foreground">
                {t("modify.descriptionLabel")}
              </label>
              <textarea
                id={`description-${releve.id}`}
                className="min-h-[88px] w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {errors.description && <p className="text-sm text-danger">{errors.description}</p>}
            </div>
          )}

          {type === TypeReleve.RENOUVELLEMENT && (
            <>
              <Input
                id={`pourcentageRenouvellement-${releve.id}`}
                label={t("form.renouvellement.pourcentage")}
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={pourcentageRenouvellement}
                onChange={(e) => setPourcentageRenouvellement(e.target.value)}
                error={errors.pourcentageRenouvellement}
              />
              <Input
                id={`volumeRenouvele-${releve.id}`}
                label={t("form.renouvellement.volume")}
                type="number"
                min="1"
                step="1"
                value={volumeRenouvele}
                onChange={(e) => setVolumeRenouvele(e.target.value)}
                error={errors.volumeRenouvele}
              />
              <Input
                id={`nombreRenouvellements-${releve.id}`}
                label={t("modify.fields.nombreRenouvellements")}
                type="number"
                min="1"
                max="20"
                step="1"
                value={nombreRenouvellements}
                onChange={(e) => setNombreRenouvellements(e.target.value)}
                error={errors.nombreRenouvellements}
              />
            </>
          )}

          {/* Consommations de produits */}
          {typesAvecConsommations.includes(type) && produits.length > 0 && (
            <ConsommationFields
              lignes={consommationLignes}
              onChange={setConsommationLignes}
              produits={produits}
              categorie={categorieConsommation}
              optional
            />
          )}

          {/* Notes (commun a tous les types) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`notes-${releve.id}`} className="text-sm font-medium text-foreground">
              {t("modify.notesLabel")}
            </label>
            <textarea
              id={`notes-${releve.id}`}
              className="min-h-[66px] w-full rounded-lg border border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t("modify.cancel")}
            </Button>
            <Button type="submit" disabled={!raisonValid}>
              {t("modify.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
