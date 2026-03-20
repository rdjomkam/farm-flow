"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
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

const typeLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biometrie",
  [TypeReleve.MORTALITE]: "Mortalite",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualite eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
  [TypeReleve.RENOUVELLEMENT]: "Renouvellement",
};

const causeLabels: Record<CauseMortalite, string> = {
  [CauseMortalite.MALADIE]: "Maladie",
  [CauseMortalite.QUALITE_EAU]: "Qualite eau",
  [CauseMortalite.STRESS]: "Stress",
  [CauseMortalite.PREDATION]: "Predation",
  [CauseMortalite.CANNIBALISME]: "Cannibalisme",
  [CauseMortalite.INCONNUE]: "Inconnue",
  [CauseMortalite.AUTRE]: "Autre",
};

const alimentLabels: Record<TypeAliment, string> = {
  [TypeAliment.ARTISANAL]: "Artisanal",
  [TypeAliment.COMMERCIAL]: "Commercial",
  [TypeAliment.MIXTE]: "Mixte",
};

const comptageLabels: Record<MethodeComptage, string> = {
  [MethodeComptage.DIRECT]: "Direct",
  [MethodeComptage.ESTIMATION]: "Estimation",
  [MethodeComptage.ECHANTILLONNAGE]: "Echantillonnage",
};

interface ModifierReleveDialogProps {
  releve: Releve;
  /** Liste des produits disponibles pour les consommations (ALIMENT + INTRANT) */
  produits?: ProduitOption[];
  permissions: Permission[];
}

export function ModifierReleveDialog({ releve, produits = [], permissions }: ModifierReleveDialogProps) {
  const router = useRouter();
  const releveService = useReleveService();
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
      errs.raison = "La raison doit contenir au moins 5 caracteres.";
    }

    switch (type) {
      case TypeReleve.BIOMETRIE:
        if (!poidsMoyen || Number(poidsMoyen) <= 0) errs.poidsMoyen = "Superieur a 0.";
        if (tailleMoyenne && Number(tailleMoyenne) <= 0) errs.tailleMoyenne = "Superieur a 0.";
        if (!echantillonCount || Number(echantillonCount) <= 0 || !Number.isInteger(Number(echantillonCount)))
          errs.echantillonCount = "Entier superieur a 0.";
        break;
      case TypeReleve.MORTALITE:
        if (nombreMorts === "" || Number(nombreMorts) < 0 || !Number.isInteger(Number(nombreMorts)))
          errs.nombreMorts = "Entier positif ou zero.";
        if (!causeMortalite) errs.causeMortalite = "Selectionnez une cause.";
        break;
      case TypeReleve.ALIMENTATION:
        if (!quantiteAliment || Number(quantiteAliment) <= 0) errs.quantiteAliment = "Superieur a 0.";
        if (!typeAliment) errs.typeAliment = "Selectionnez un type.";
        if (!frequenceAliment || Number(frequenceAliment) <= 0 || !Number.isInteger(Number(frequenceAliment)))
          errs.frequenceAliment = "Entier superieur a 0.";
        break;
      case TypeReleve.COMPTAGE:
        if (!nombreCompte || Number(nombreCompte) <= 0 || !Number.isInteger(Number(nombreCompte)))
          errs.nombreCompte = "Entier superieur a 0.";
        if (!methodeComptage) errs.methodeComptage = "Selectionnez une methode.";
        break;
      case TypeReleve.OBSERVATION:
        if (!description.trim()) errs.description = "La description est obligatoire.";
        break;
      // QUALITE_EAU: all fields optional
    }
    return errs;
  }

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = { raison: raison.trim() };

    // Inclure la date seulement si elle a change
    if (releveDate && releveDate !== formatDatetime(releve.date)) {
      body.date = releveDate;
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
          <DialogTitle>Modifier le releve</DialogTitle>
          <DialogDescription>
            Type : {typeLabels[type]} — Toutes les modifications sont tracees pour l&apos;audit.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Section 1 — Raison obligatoire (EN PREMIER, ADR-014) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`raison-${releve.id}`} className="text-sm font-medium text-foreground">
              Raison de la modification <span className="text-danger">*</span>
            </label>
            <textarea
              id={`raison-${releve.id}`}
              className={`min-h-[88px] w-full rounded-lg border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                errors.raison ? "border-danger" : "border-border"
              }`}
              maxLength={500}
              placeholder="Ex : Erreur de lecture de la balance lors de la pesee"
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

          {/* Section 2 — Date du releve */}
          <Input
            id={`date-${releve.id}`}
            label="Date du releve"
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
                label="Poids moyen (g)"
                type="number"
                min="0.1"
                step="0.1"
                value={poidsMoyen}
                onChange={(e) => setPoidsMoyen(e.target.value)}
                error={errors.poidsMoyen}
              />
              <Input
                id={`tailleMoyenne-${releve.id}`}
                label="Taille moyenne (cm)"
                type="number"
                min="0.1"
                step="0.1"
                value={tailleMoyenne}
                onChange={(e) => setTailleMoyenne(e.target.value)}
                error={errors.tailleMoyenne}
              />
              <Input
                id={`echantillonCount-${releve.id}`}
                label="Nombre d'echantillons"
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
                label="Nombre de morts"
                type="number"
                min="0"
                value={nombreMorts}
                onChange={(e) => setNombreMorts(e.target.value)}
                error={errors.nombreMorts}
              />
              <Select value={causeMortalite} onValueChange={setCauseMortalite}>
                <SelectTrigger label="Cause de mortalite" error={errors.causeMortalite}>
                  <SelectValue placeholder="Selectionnez..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CauseMortalite).map((c) => (
                    <SelectItem key={c} value={c}>{causeLabels[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {type === TypeReleve.ALIMENTATION && (
            <>
              <Input
                id={`quantiteAliment-${releve.id}`}
                label="Quantite d'aliment (kg)"
                type="number"
                min="0.1"
                step="0.1"
                value={quantiteAliment}
                onChange={(e) => setQuantiteAliment(e.target.value)}
                error={errors.quantiteAliment}
              />
              <Select value={typeAliment} onValueChange={setTypeAliment}>
                <SelectTrigger label="Type d'aliment" error={errors.typeAliment}>
                  <SelectValue placeholder="Selectionnez..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TypeAliment).map((t) => (
                    <SelectItem key={t} value={t}>{alimentLabels[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id={`frequenceAliment-${releve.id}`}
                label="Frequence (fois/jour)"
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
                label="Temperature (C)"
                type="number"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
              />
              <Input
                id={`ph-${releve.id}`}
                label="pH"
                type="number"
                step="0.1"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
              />
              <Input
                id={`oxygene-${releve.id}`}
                label="Oxygene dissous (mg/L)"
                type="number"
                step="0.1"
                value={oxygene}
                onChange={(e) => setOxygene(e.target.value)}
              />
              <Input
                id={`ammoniac-${releve.id}`}
                label="Ammoniac (mg/L)"
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
                label="Nombre de poissons"
                type="number"
                min="1"
                value={nombreCompte}
                onChange={(e) => setNombreCompte(e.target.value)}
                error={errors.nombreCompte}
              />
              <Select value={methodeComptage} onValueChange={setMethodeComptage}>
                <SelectTrigger label="Methode de comptage" error={errors.methodeComptage}>
                  <SelectValue placeholder="Selectionnez..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(MethodeComptage).map((m) => (
                    <SelectItem key={m} value={m}>{comptageLabels[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {type === TypeReleve.OBSERVATION && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`description-${releve.id}`} className="text-sm font-medium text-foreground">
                Description
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
              Notes (optionnel)
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
              Annuler
            </Button>
            <Button type="submit" disabled={!raisonValid}>
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
