"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { ConfigElevage } from "@/types";

interface Props {
  config: ConfigElevage;
}

interface Section {
  id: string;
  titre: string;
  description: string;
}

const SECTIONS: Section[] = [
  { id: "objectif", titre: "Objectif de production", description: "Poids cible, duree du cycle, taux de survie attendu" },
  { id: "phases", titre: "Phases de croissance", description: "Seuils de poids pour chaque phase (en grammes)" },
  { id: "benchmarks", titre: "Benchmarks de performance", description: "Seuils FCR, SGR, survie, densite, mortalite" },
  { id: "qualite-eau", titre: "Qualite de l'eau", description: "Seuils pH, temperature, oxygene, ammoniac, nitrite" },
  { id: "alertes-mortalite", titre: "Alertes mortalite", description: "Seuils de mortalite quotidienne" },
  { id: "tri-biometrie", titre: "Tri et Biometrie", description: "Frequences et parametres de tri et de biometrie" },
  { id: "densite", titre: "Densite d'elevage", description: "Poissons maximum par m³" },
  { id: "recolte", titre: "Recolte", description: "Poids minimum pour recolte partielle" },
];

function SectionCard({
  section,
  isOpen,
  onToggle,
  children,
}: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/30 transition-colors text-left"
        onClick={onToggle}
      >
        <div>
          <p className="font-medium text-sm">{section.titre}</p>
          <p className="text-xs text-muted-foreground">{section.description}</p>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {isOpen && <div className="p-4 border-t border-border bg-card">{children}</div>}
    </div>
  );
}

function NumericField({
  label,
  name,
  value,
  onChange,
  unit,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (name: string, val: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">
        {label}{unit ? <span className="text-muted-foreground ml-1">({unit})</span> : null}
      </label>
      <input
        type="number"
        name={name}
        value={value}
        min={min}
        max={max}
        step={step ?? 0.1}
        onChange={(e) => onChange(name, parseFloat(e.target.value) || 0)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </div>
  );
}

export function ConfigElevageEditClient({ config }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<ConfigElevage>({ ...config });
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["objectif"]));
  const [submitting, setSubmitting] = useState(false);

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNumeric = (name: string, val: number) => {
    setForm((prev) => ({ ...prev, [name]: val }));
  };

  const handleBoolean = (name: string, val: boolean) => {
    setForm((prev) => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/config-elevage/${config.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        toast({ title: "Erreur", description: data.message, variant: "error" });
        return;
      }
      toast({ title: "Profil mis a jour", description: "Les modifications ont ete enregistrees." });
      router.push("/settings/config-elevage");
    } catch {
      toast({ title: "Erreur", description: "Erreur lors de la mise a jour.", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nom et description */}
      <div className="space-y-3">
        <Input
          label="Nom du profil"
          value={form.nom}
          onChange={(e) => setForm((prev) => ({ ...prev, nom: e.target.value }))}
          required
        />
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Description (optionnel)</label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value || null }))}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Description du profil..."
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => handleBoolean("isDefault", e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Profil par defaut</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => handleBoolean("isActive", e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Actif</span>
          </label>
        </div>
      </div>

      {/* Sections repliables */}
      <div className="space-y-2">
        {SECTIONS.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            isOpen={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          >
            {section.id === "objectif" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumericField label="Poids objectif" name="poidsObjectif" value={form.poidsObjectif} onChange={handleNumeric} unit="g" min={100} max={5000} step={50} />
                <NumericField label="Duree estimee" name="dureeEstimeeCycle" value={form.dureeEstimeeCycle} onChange={handleNumeric} unit="jours" min={30} max={365} step={1} />
                <NumericField label="Survie objectif" name="tauxSurvieObjectif" value={form.tauxSurvieObjectif} onChange={handleNumeric} unit="%" min={50} max={100} step={1} />
              </div>
            )}
            {section.id === "phases" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumericField label="Acclimatation (fin)" name="seuilAcclimatation" value={form.seuilAcclimatation} onChange={handleNumeric} unit="g" min={5} max={50} step={1} />
                <NumericField label="Croissance debut (fin)" name="seuilCroissanceDebut" value={form.seuilCroissanceDebut} onChange={handleNumeric} unit="g" min={20} max={100} step={1} />
                <NumericField label="Juvenile (fin)" name="seuilJuvenile" value={form.seuilJuvenile} onChange={handleNumeric} unit="g" min={50} max={300} step={5} />
                <NumericField label="Grossissement (fin)" name="seuilGrossissement" value={form.seuilGrossissement} onChange={handleNumeric} unit="g" min={150} max={600} step={10} />
                <NumericField label="Finition (fin)" name="seuilFinition" value={form.seuilFinition} onChange={handleNumeric} unit="g" min={300} max={1500} step={25} />
              </div>
            )}
            {section.id === "benchmarks" && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">FCR (plus bas = meilleur)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label="Excellent &lt;" name="fcrExcellentMax" value={form.fcrExcellentMax} onChange={handleNumeric} min={0.5} max={3} step={0.1} />
                    <NumericField label="Bon &lt;" name="fcrBonMax" value={form.fcrBonMax} onChange={handleNumeric} min={0.5} max={3} step={0.1} />
                    <NumericField label="Acceptable &lt;" name="fcrAcceptableMax" value={form.fcrAcceptableMax} onChange={handleNumeric} min={0.5} max={5} step={0.1} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">SGR %/j (plus haut = meilleur)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label="Excellent &gt;" name="sgrExcellentMin" value={form.sgrExcellentMin} onChange={handleNumeric} min={0.5} max={5} step={0.1} />
                    <NumericField label="Bon &gt;" name="sgrBonMin" value={form.sgrBonMin} onChange={handleNumeric} min={0.5} max={5} step={0.1} />
                    <NumericField label="Acceptable &gt;" name="sgrAcceptableMin" value={form.sgrAcceptableMin} onChange={handleNumeric} min={0.1} max={3} step={0.1} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Survie % (plus haut = meilleur)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label="Excellent &gt;" name="survieExcellentMin" value={form.survieExcellentMin} onChange={handleNumeric} unit="%" min={50} max={100} step={1} />
                    <NumericField label="Bon &gt;" name="survieBonMin" value={form.survieBonMin} onChange={handleNumeric} unit="%" min={50} max={100} step={1} />
                    <NumericField label="Acceptable &gt;" name="survieAcceptableMin" value={form.survieAcceptableMin} onChange={handleNumeric} unit="%" min={40} max={100} step={1} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Densite poissons/m³ (plus bas = meilleur)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label="Excellent &lt;" name="densiteExcellentMax" value={form.densiteExcellentMax} onChange={handleNumeric} min={1} max={50} step={1} />
                    <NumericField label="Bon &lt;" name="densiteBonMax" value={form.densiteBonMax} onChange={handleNumeric} min={1} max={100} step={1} />
                    <NumericField label="Acceptable &lt;" name="densiteAcceptableMax" value={form.densiteAcceptableMax} onChange={handleNumeric} min={1} max={200} step={1} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Mortalite cumulative % (plus bas = meilleur)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label="Excellent &lt;" name="mortaliteExcellentMax" value={form.mortaliteExcellentMax} onChange={handleNumeric} unit="%" min={0} max={20} step={0.5} />
                    <NumericField label="Bon &lt;" name="mortaliteBonMax" value={form.mortaliteBonMax} onChange={handleNumeric} unit="%" min={0} max={30} step={0.5} />
                    <NumericField label="Acceptable &lt;" name="mortaliteAcceptableMax" value={form.mortaliteAcceptableMax} onChange={handleNumeric} unit="%" min={0} max={50} step={1} />
                  </div>
                </div>
              </div>
            )}
            {section.id === "qualite-eau" && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">pH</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <NumericField label="Min lethal" name="phMin" value={form.phMin} onChange={handleNumeric} min={4} max={9} step={0.1} />
                    <NumericField label="Max lethal" name="phMax" value={form.phMax} onChange={handleNumeric} min={6} max={14} step={0.1} />
                    <NumericField label="Optimal min" name="phOptimalMin" value={form.phOptimalMin} onChange={handleNumeric} min={5} max={9} step={0.1} />
                    <NumericField label="Optimal max" name="phOptimalMax" value={form.phOptimalMax} onChange={handleNumeric} min={6} max={10} step={0.1} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Temperature (°C)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <NumericField label="Min lethal" name="temperatureMin" value={form.temperatureMin} onChange={handleNumeric} unit="°C" min={10} max={30} step={0.5} />
                    <NumericField label="Max lethal" name="temperatureMax" value={form.temperatureMax} onChange={handleNumeric} unit="°C" min={25} max={45} step={0.5} />
                    <NumericField label="Optimal min" name="temperatureOptimalMin" value={form.temperatureOptimalMin} onChange={handleNumeric} unit="°C" min={18} max={32} step={0.5} />
                    <NumericField label="Optimal max" name="temperatureOptimalMax" value={form.temperatureOptimalMax} onChange={handleNumeric} unit="°C" min={22} max={38} step={0.5} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Ammoniac (mg/L)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label="Lethal" name="ammoniacMax" value={form.ammoniacMax} onChange={handleNumeric} min={0.1} max={2} step={0.05} />
                    <NumericField label="Alerte" name="ammoniacAlerte" value={form.ammoniacAlerte} onChange={handleNumeric} min={0.01} max={1} step={0.01} />
                    <NumericField label="Optimal" name="ammoniacOptimal" value={form.ammoniacOptimal} onChange={handleNumeric} min={0.001} max={0.5} step={0.01} />
                  </div>
                </div>
              </div>
            )}
            {section.id === "alertes-mortalite" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumericField label="Alerte mortalite quotidienne" name="mortaliteQuotidienneAlerte" value={form.mortaliteQuotidienneAlerte} onChange={handleNumeric} unit="%" min={0.1} max={10} step={0.1} />
                <NumericField label="Critique mortalite quotidienne" name="mortaliteQuotidienneCritique" value={form.mortaliteQuotidienneCritique} onChange={handleNumeric} unit="%" min={0.5} max={20} step={0.1} />
                <NumericField label="FCR alerte max" name="fcrAlerteMax" value={form.fcrAlerteMax} onChange={handleNumeric} min={1} max={5} step={0.1} />
                <NumericField label="Stock jours restants (alerte)" name="stockJoursAlerte" value={form.stockJoursAlerte} onChange={handleNumeric} unit="jours" min={1} max={30} step={1} />
              </div>
            )}
            {section.id === "tri-biometrie" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumericField label="Tri poids min" name="triPoidsMin" value={form.triPoidsMin} onChange={handleNumeric} unit="g" min={1} max={100} step={1} />
                <NumericField label="Tri poids max" name="triPoidsMax" value={form.triPoidsMax} onChange={handleNumeric} unit="g" min={50} max={500} step={5} />
                <NumericField label="Tri intervalle" name="triIntervalleJours" value={form.triIntervalleJours} onChange={handleNumeric} unit="jours" min={7} max={60} step={1} />
                <NumericField label="Biometrie debut" name="biometrieIntervalleDebut" value={form.biometrieIntervalleDebut} onChange={handleNumeric} unit="jours" min={3} max={30} step={1} />
                <NumericField label="Biometrie fin" name="biometrieIntervalleFin" value={form.biometrieIntervalleFin} onChange={handleNumeric} unit="jours" min={7} max={30} step={1} />
                <NumericField label="Echantillon biometrie" name="biometrieEchantillonPct" value={form.biometrieEchantillonPct} onChange={handleNumeric} unit="%" min={5} max={30} step={1} />
              </div>
            )}
            {section.id === "densite" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumericField label="Densite max" name="densiteMaxPoissonsM3" value={form.densiteMaxPoissonsM3} onChange={handleNumeric} unit="poissons/m³" min={10} max={300} step={5} />
                <NumericField label="Densite optimale" name="densiteOptimalePoissonsM3" value={form.densiteOptimalePoissonsM3} onChange={handleNumeric} unit="poissons/m³" min={5} max={200} step={5} />
                <NumericField label="Changement eau %" name="eauChangementPct" value={form.eauChangementPct} onChange={handleNumeric} unit="%" min={10} max={100} step={5} />
                <NumericField label="Changement eau frequence" name="eauChangementIntervalleJours" value={form.eauChangementIntervalleJours} onChange={handleNumeric} unit="jours" min={1} max={14} step={1} />
              </div>
            )}
            {section.id === "recolte" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumericField label="Poids min recolte partielle" name="recoltePartiellePoidsSeuil" value={form.recoltePartiellePoidsSeuil} onChange={handleNumeric} unit="g" min={100} max={2000} step={50} />
                <NumericField label="Arret aliment avant recolte" name="recolteJeuneAvantJours" value={form.recolteJeuneAvantJours} onChange={handleNumeric} unit="jours" min={0} max={7} step={1} />
              </div>
            )}
          </SectionCard>
        ))}
      </div>

      {/* Boutons d'action */}
      <div className="flex gap-3 pt-4 sticky bottom-0 bg-background pb-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.push("/settings/config-elevage")}
        >
          Annuler
        </Button>
        <Button type="submit" className="flex-1" disabled={submitting}>
          {submitting ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
