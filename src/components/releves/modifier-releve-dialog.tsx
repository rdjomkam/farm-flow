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
import { useToast } from "@/components/ui/toast";
import { TypeReleve, CauseMortalite, TypeAliment, MethodeComptage, CategorieProduit, Permission } from "@/types";
import type { Releve } from "@/types";
import { ConsommationFields } from "@/components/releves/consommation-fields";
import type { ConsommationLine, ProduitOption } from "@/components/releves/consommation-fields";

const typeLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biométrie",
  [TypeReleve.MORTALITE]: "Mortalité",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualité eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
};

const causeLabels: Record<CauseMortalite, string> = {
  [CauseMortalite.MALADIE]: "Maladie",
  [CauseMortalite.QUALITE_EAU]: "Qualité eau",
  [CauseMortalite.STRESS]: "Stress",
  [CauseMortalite.PREDATION]: "Prédation",
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
  [MethodeComptage.ECHANTILLONNAGE]: "Échantillonnage",
};

interface ModifierReleveDialogProps {
  releve: Releve;
  /** Liste des produits disponibles pour les consommations (ALIMENT + INTRANT) */
  produits?: ProduitOption[];
  permissions: Permission[];
}

export function ModifierReleveDialog({ releve, produits = [], permissions }: ModifierReleveDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const type = releve.typeReleve as TypeReleve;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // Types de releve qui supportent les consommations de produits
  const typesAvecConsommations = [TypeReleve.ALIMENTATION, TypeReleve.MORTALITE, TypeReleve.QUALITE_EAU];
  const categorieConsommation = type === TypeReleve.ALIMENTATION ? CategorieProduit.ALIMENT : CategorieProduit.INTRANT;

  const [consommationLignes, setConsommationLignes] = useState<ConsommationLine[]>(
    releve.consommations?.map((c) => ({
      produitId: c.produitId,
      quantite: String(c.quantite),
    })) ?? []
  );

  function resetForm() {
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
    switch (type) {
      case TypeReleve.BIOMETRIE:
        if (!poidsMoyen || Number(poidsMoyen) <= 0) errs.poidsMoyen = "Supérieur à 0.";
        if (!tailleMoyenne || Number(tailleMoyenne) <= 0) errs.tailleMoyenne = "Supérieur à 0.";
        if (!echantillonCount || Number(echantillonCount) <= 0 || !Number.isInteger(Number(echantillonCount)))
          errs.echantillonCount = "Entier supérieur à 0.";
        break;
      case TypeReleve.MORTALITE:
        if (nombreMorts === "" || Number(nombreMorts) < 0 || !Number.isInteger(Number(nombreMorts)))
          errs.nombreMorts = "Entier positif ou zéro.";
        if (!causeMortalite) errs.causeMortalite = "Sélectionnez une cause.";
        break;
      case TypeReleve.ALIMENTATION:
        if (!quantiteAliment || Number(quantiteAliment) <= 0) errs.quantiteAliment = "Supérieur à 0.";
        if (!typeAliment) errs.typeAliment = "Sélectionnez un type.";
        if (!frequenceAliment || Number(frequenceAliment) <= 0 || !Number.isInteger(Number(frequenceAliment)))
          errs.frequenceAliment = "Entier supérieur à 0.";
        break;
      case TypeReleve.COMPTAGE:
        if (!nombreCompte || Number(nombreCompte) <= 0 || !Number.isInteger(Number(nombreCompte)))
          errs.nombreCompte = "Entier supérieur à 0.";
        if (!methodeComptage) errs.methodeComptage = "Sélectionnez une méthode.";
        break;
      case TypeReleve.OBSERVATION:
        if (!description.trim()) errs.description = "La description est obligatoire.";
        break;
      // QUALITE_EAU: all fields optional
    }
    return errs;
  }

  function buildBody(): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (notes.trim()) body.notes = notes.trim();
    else body.notes = null;

    switch (type) {
      case TypeReleve.BIOMETRIE:
        body.poidsMoyen = Number(poidsMoyen);
        body.tailleMoyenne = Number(tailleMoyenne);
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

    // Inclure les consommations pour les types qui les supportent
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

    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch(`/api/releves/${releve.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: data.message || "Erreur lors de la modification.", variant: "error" });
        return;
      }
      toast({ title: "Relevé modifié !", variant: "success" });
      setOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Erreur réseau.", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!permissions.includes(Permission.RELEVES_MODIFIER)) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le relevé</DialogTitle>
          <DialogDescription>
            Type : {typeLabels[type]}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Type-specific fields */}
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
                label="Nombre d'échantillons"
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
                min="1"
                value={nombreMorts}
                onChange={(e) => setNombreMorts(e.target.value)}
                error={errors.nombreMorts}
              />
              <Select value={causeMortalite} onValueChange={setCauseMortalite}>
                <SelectTrigger label="Cause de mortalité" error={errors.causeMortalite}>
                  <SelectValue placeholder="Sélectionnez..." />
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
                label="Quantité d'aliment (kg)"
                type="number"
                min="0.1"
                step="0.1"
                value={quantiteAliment}
                onChange={(e) => setQuantiteAliment(e.target.value)}
                error={errors.quantiteAliment}
              />
              <Select value={typeAliment} onValueChange={setTypeAliment}>
                <SelectTrigger label="Type d'aliment" error={errors.typeAliment}>
                  <SelectValue placeholder="Sélectionnez..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(TypeAliment).map((t) => (
                    <SelectItem key={t} value={t}>{alimentLabels[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                id={`frequenceAliment-${releve.id}`}
                label="Fréquence (fois/jour)"
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
                label="Température (°C)"
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
                label="Oxygène dissous (mg/L)"
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
                <SelectTrigger label="Méthode de comptage" error={errors.methodeComptage}>
                  <SelectValue placeholder="Sélectionnez..." />
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

          {/* Consommations de produits (pour ALIMENTATION, MORTALITE, QUALITE_EAU) */}
          {typesAvecConsommations.includes(type) && produits.length > 0 && (
            <ConsommationFields
              lignes={consommationLignes}
              onChange={setConsommationLignes}
              produits={produits}
              categorie={categorieConsommation}
              optional
            />
          )}

          {/* Notes (common to all types) */}
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
            <Button type="submit" disabled={submitting}>
              {submitting ? "Modification..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
