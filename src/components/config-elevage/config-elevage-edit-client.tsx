"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfigService } from "@/services";
import type { ConfigElevage } from "@/types";

interface Props {
  config: ConfigElevage;
}

interface Section {
  id: string;
}

const SECTIONS: Section[] = [
  { id: "objectif" },
  { id: "phases" },
  { id: "benchmarks" },
  { id: "qualite-eau" },
  { id: "alertes-mortalite" },
  { id: "tri-biometrie" },
  { id: "densite" },
  { id: "recolte" },
  { id: "gompertz" },
];

function SectionCard({
  titre,
  description,
  isOpen,
  onToggle,
  children,
}: {
  titre: string;
  description: string;
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
          <p className="font-medium text-sm">{titre}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
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
        className="flex h-10 w-full rounded-md bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </div>
  );
}

function OptionalNumericField({
  label,
  name,
  value,
  onChange,
  unit,
  min,
  max,
  step,
  placeholder,
}: {
  label: string;
  name: string;
  value: number | null | undefined;
  onChange: (name: string, val: number | null) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">
        {label}{unit ? <span className="text-muted-foreground ml-1">({unit})</span> : null}
      </label>
      <input
        type="number"
        name={name}
        value={value ?? ""}
        min={min}
        max={max}
        step={step ?? 0.1}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(name, raw === "" ? null : parseFloat(raw) || null);
        }}
        className="flex h-10 w-full rounded-md bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
    </div>
  );
}

export function ConfigElevageEditClient({ config }: Props) {
  const t = useTranslations("config-elevage");
  const router = useRouter();
  const configService = useConfigService();
  const [form, setForm] = useState<ConfigElevage>({ ...config });
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["objectif"]));

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

  const handleOptionalNumeric = (name: string, val: number | null) => {
    setForm((prev) => ({ ...prev, [name]: val }));
  };

  const handleBoolean = (name: string, val: boolean) => {
    setForm((prev) => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await configService.updateConfig(config.id, form as any);
    if (result.ok) {
      router.push("/settings/config-elevage");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nom et description */}
      <div className="space-y-3">
        <Input
          label={t("fields.nomDuProfil")}
          value={form.nom}
          onChange={(e) => setForm((prev) => ({ ...prev, nom: e.target.value }))}
          required
        />
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("fields.description")}</label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value || null }))}
            className="flex min-h-[80px] w-full rounded-md bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={t("fields.descriptionPlaceholder")}
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
            <span className="text-sm">{t("fields.profilParDefaut")}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => handleBoolean("isActive", e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">{t("fields.actif")}</span>
          </label>
        </div>
      </div>

      {/* Sections repliables */}
      <div className="space-y-2">
        {SECTIONS.map((section) => {
          const sectionTitles: Record<string, string> = {
            objectif: t("sections.objectifProduction"),
            phases: t("sections.phasesCroissance"),
            benchmarks: t("sections.benchmarksPerformance"),
            "qualite-eau": t("sections.qualiteEau"),
            "alertes-mortalite": t("sections.alertesMortalite"),
            "tri-biometrie": t("sections.triEtBiometrie"),
            densite: t("sections.densiteElevage"),
            recolte: t("sections.recolte"),
            gompertz: t("sections.modeleGompertz"),
          };
          const sectionDescs: Record<string, string> = {
            objectif: t("sections.objectifProductionDesc"),
            phases: t("sections.phasesCroissanceDesc"),
            benchmarks: t("sections.benchmarksPerformanceDesc"),
            "qualite-eau": t("sections.qualiteEauDesc"),
            "alertes-mortalite": t("sections.alertesMortaliteDesc"),
            "tri-biometrie": t("sections.triEtBiometrieDesc"),
            densite: t("sections.densiteElevageDesc"),
            recolte: t("sections.recolteDesc"),
            gompertz: t("sections.modeleGompertzDesc"),
          };
          return (
          <SectionCard
            key={section.id}
            titre={sectionTitles[section.id] ?? section.id}
            description={sectionDescs[section.id] ?? ""}
            isOpen={openSections.has(section.id)}
            onToggle={() => toggleSection(section.id)}
          >
            {section.id === "objectif" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumericField label={t("fields.poidsObjectif")} name="poidsObjectif" value={form.poidsObjectif} onChange={handleNumeric} unit="g" min={100} max={5000} step={50} />
                <NumericField label={t("fields.dureeEstimee")} name="dureeEstimeeCycle" value={form.dureeEstimeeCycle} onChange={handleNumeric} unit="jours" min={30} max={365} step={1} />
                <NumericField label={t("fields.survieObjectif")} name="tauxSurvieObjectif" value={form.tauxSurvieObjectif} onChange={handleNumeric} unit="%" min={50} max={100} step={1} />
              </div>
            )}
            {section.id === "phases" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumericField label={t("fields.acclimatationFin")} name="seuilAcclimatation" value={form.seuilAcclimatation} onChange={handleNumeric} unit="g" min={5} max={50} step={1} />
                <NumericField label={t("fields.croissanceDebutFin")} name="seuilCroissanceDebut" value={form.seuilCroissanceDebut} onChange={handleNumeric} unit="g" min={20} max={100} step={1} />
                <NumericField label={t("fields.juvenileFin")} name="seuilJuvenile" value={form.seuilJuvenile} onChange={handleNumeric} unit="g" min={50} max={300} step={5} />
                <NumericField label={t("fields.grossissementFin")} name="seuilGrossissement" value={form.seuilGrossissement} onChange={handleNumeric} unit="g" min={150} max={600} step={10} />
                <NumericField label={t("fields.finitionFin")} name="seuilFinition" value={form.seuilFinition} onChange={handleNumeric} unit="g" min={300} max={1500} step={25} />
              </div>
            )}
            {section.id === "benchmarks" && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t("benchmarks.fcrTitle")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label={t("fields.fcrExcellentMax")} name="fcrExcellentMax" value={form.fcrExcellentMax} onChange={handleNumeric} min={0.5} max={3} step={0.1} />
                    <NumericField label={t("fields.fcrBonMax")} name="fcrBonMax" value={form.fcrBonMax} onChange={handleNumeric} min={0.5} max={3} step={0.1} />
                    <NumericField label={t("fields.fcrAcceptableMax")} name="fcrAcceptableMax" value={form.fcrAcceptableMax} onChange={handleNumeric} min={0.5} max={5} step={0.1} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t("benchmarks.sgrTitle")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label={t("fields.sgrExcellentMin")} name="sgrExcellentMin" value={form.sgrExcellentMin} onChange={handleNumeric} min={0.5} max={5} step={0.1} />
                    <NumericField label={t("fields.sgrBonMin")} name="sgrBonMin" value={form.sgrBonMin} onChange={handleNumeric} min={0.5} max={5} step={0.1} />
                    <NumericField label={t("fields.sgrAcceptableMin")} name="sgrAcceptableMin" value={form.sgrAcceptableMin} onChange={handleNumeric} min={0.1} max={3} step={0.1} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t("benchmarks.survieTitle")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label={t("fields.survieExcellentMin")} name="survieExcellentMin" value={form.survieExcellentMin} onChange={handleNumeric} unit="%" min={50} max={100} step={1} />
                    <NumericField label={t("fields.survieBonMin")} name="survieBonMin" value={form.survieBonMin} onChange={handleNumeric} unit="%" min={50} max={100} step={1} />
                    <NumericField label={t("fields.survieAcceptableMin")} name="survieAcceptableMin" value={form.survieAcceptableMin} onChange={handleNumeric} unit="%" min={40} max={100} step={1} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t("benchmarks.densiteTitle")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label={t("fields.densiteExcellentMax")} name="densiteExcellentMax" value={form.densiteExcellentMax} onChange={handleNumeric} min={1} max={50} step={1} />
                    <NumericField label={t("fields.densiteBonMax")} name="densiteBonMax" value={form.densiteBonMax} onChange={handleNumeric} min={1} max={100} step={1} />
                    <NumericField label={t("fields.densiteAcceptableMax")} name="densiteAcceptableMax" value={form.densiteAcceptableMax} onChange={handleNumeric} min={1} max={200} step={1} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t("benchmarks.mortaliteTitle")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label={t("fields.mortaliteExcellentMax")} name="mortaliteExcellentMax" value={form.mortaliteExcellentMax} onChange={handleNumeric} unit="%" min={0} max={20} step={0.5} />
                    <NumericField label={t("fields.mortaliteBonMax")} name="mortaliteBonMax" value={form.mortaliteBonMax} onChange={handleNumeric} unit="%" min={0} max={30} step={0.5} />
                    <NumericField label={t("fields.mortaliteAcceptableMax")} name="mortaliteAcceptableMax" value={form.mortaliteAcceptableMax} onChange={handleNumeric} unit="%" min={0} max={50} step={1} />
                  </div>
                </div>
              </div>
            )}
            {section.id === "qualite-eau" && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t("qualiteEau.phLabel")}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <NumericField label={t("fields.phMinLethal")} name="phMin" value={form.phMin} onChange={handleNumeric} min={4} max={9} step={0.1} />
                    <NumericField label={t("fields.phMaxLethal")} name="phMax" value={form.phMax} onChange={handleNumeric} min={6} max={14} step={0.1} />
                    <NumericField label={t("fields.phOptimalMin")} name="phOptimalMin" value={form.phOptimalMin} onChange={handleNumeric} min={5} max={9} step={0.1} />
                    <NumericField label={t("fields.phOptimalMax")} name="phOptimalMax" value={form.phOptimalMax} onChange={handleNumeric} min={6} max={10} step={0.1} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t("qualiteEau.temperatureLabel")}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <NumericField label={t("fields.temperatureMinLethal")} name="temperatureMin" value={form.temperatureMin} onChange={handleNumeric} unit="°C" min={10} max={30} step={0.5} />
                    <NumericField label={t("fields.temperatureMaxLethal")} name="temperatureMax" value={form.temperatureMax} onChange={handleNumeric} unit="°C" min={25} max={45} step={0.5} />
                    <NumericField label={t("fields.temperatureOptimalMin")} name="temperatureOptimalMin" value={form.temperatureOptimalMin} onChange={handleNumeric} unit="°C" min={18} max={32} step={0.5} />
                    <NumericField label={t("fields.temperatureOptimalMax")} name="temperatureOptimalMax" value={form.temperatureOptimalMax} onChange={handleNumeric} unit="°C" min={22} max={38} step={0.5} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t("qualiteEau.ammoniacLabel")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <NumericField label={t("fields.ammoniacLethal")} name="ammoniacMax" value={form.ammoniacMax} onChange={handleNumeric} min={0.1} max={2} step={0.05} />
                    <NumericField label={t("fields.ammoniacAlerte")} name="ammoniacAlerte" value={form.ammoniacAlerte} onChange={handleNumeric} min={0.01} max={1} step={0.01} />
                    <NumericField label={t("fields.ammoniacOptimal")} name="ammoniacOptimal" value={form.ammoniacOptimal} onChange={handleNumeric} min={0.001} max={0.5} step={0.01} />
                  </div>
                </div>
              </div>
            )}
            {section.id === "alertes-mortalite" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumericField label={t("fields.alerteMortaliteQuotidienne")} name="mortaliteQuotidienneAlerte" value={form.mortaliteQuotidienneAlerte} onChange={handleNumeric} unit="%" min={0.1} max={10} step={0.1} />
                <NumericField label={t("fields.critiqueMortaliteQuotidienne")} name="mortaliteQuotidienneCritique" value={form.mortaliteQuotidienneCritique} onChange={handleNumeric} unit="%" min={0.5} max={20} step={0.1} />
                <NumericField label={t("fields.fcrAlerteMax")} name="fcrAlerteMax" value={form.fcrAlerteMax} onChange={handleNumeric} min={1} max={5} step={0.1} />
                <NumericField label={t("fields.stockJoursAlerte")} name="stockJoursAlerte" value={form.stockJoursAlerte} onChange={handleNumeric} unit="jours" min={1} max={30} step={1} />
              </div>
            )}
            {section.id === "tri-biometrie" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumericField label={t("fields.triPoidsMin")} name="triPoidsMin" value={form.triPoidsMin} onChange={handleNumeric} unit="g" min={1} max={100} step={1} />
                <NumericField label={t("fields.triPoidsMax")} name="triPoidsMax" value={form.triPoidsMax} onChange={handleNumeric} unit="g" min={50} max={500} step={5} />
                <NumericField label={t("fields.triIntervalle")} name="triIntervalleJours" value={form.triIntervalleJours} onChange={handleNumeric} unit="jours" min={7} max={60} step={1} />
                <NumericField label={t("fields.biometrieDebut")} name="biometrieIntervalleDebut" value={form.biometrieIntervalleDebut} onChange={handleNumeric} unit="jours" min={3} max={30} step={1} />
                <NumericField label={t("fields.biometrieFin")} name="biometrieIntervalleFin" value={form.biometrieIntervalleFin} onChange={handleNumeric} unit="jours" min={7} max={30} step={1} />
                <NumericField label={t("fields.echantillonBiometrie")} name="biometrieEchantillonPct" value={form.biometrieEchantillonPct} onChange={handleNumeric} unit="%" min={5} max={30} step={1} />
              </div>
            )}
            {section.id === "densite" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumericField label={t("fields.densiteMax")} name="densiteMaxPoissonsM3" value={form.densiteMaxPoissonsM3} onChange={handleNumeric} unit="poissons/m³" min={10} max={300} step={5} />
                <NumericField label={t("fields.densiteOptimale")} name="densiteOptimalePoissonsM3" value={form.densiteOptimalePoissonsM3} onChange={handleNumeric} unit="poissons/m³" min={5} max={200} step={5} />
                <NumericField label={t("fields.changementEauPct")} name="eauChangementPct" value={form.eauChangementPct} onChange={handleNumeric} unit="%" min={10} max={100} step={5} />
                <NumericField label={t("fields.changementEauFrequence")} name="eauChangementIntervalleJours" value={form.eauChangementIntervalleJours} onChange={handleNumeric} unit="jours" min={1} max={14} step={1} />
              </div>
            )}
            {section.id === "recolte" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <NumericField label={t("fields.poidsMinRecoltePartielle")} name="recoltePartiellePoidsSeuil" value={form.recoltePartiellePoidsSeuil} onChange={handleNumeric} unit="g" min={100} max={2000} step={50} />
                <NumericField label={t("fields.arretAlimentAvantRecolte")} name="recolteJeuneAvantJours" value={form.recolteJeuneAvantJours} onChange={handleNumeric} unit="jours" min={0} max={7} step={1} />
              </div>
            )}
            {section.id === "gompertz" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <OptionalNumericField
                    label={t("fields.gompertzWInfDefault")}
                    name="gompertzWInfDefault"
                    value={form.gompertzWInfDefault}
                    onChange={handleOptionalNumeric}
                    unit="g"
                    min={100}
                    max={3000}
                    step={10}
                    placeholder="ex: 1200"
                  />
                  <OptionalNumericField
                    label={t("fields.gompertzKDefault")}
                    name="gompertzKDefault"
                    value={form.gompertzKDefault}
                    onChange={handleOptionalNumeric}
                    min={0.005}
                    max={0.2}
                    step={0.001}
                    placeholder="ex: 0.018"
                  />
                  <OptionalNumericField
                    label={t("fields.gompertzTiDefault")}
                    name="gompertzTiDefault"
                    value={form.gompertzTiDefault}
                    onChange={handleOptionalNumeric}
                    unit="jours"
                    min={0}
                    max={300}
                    step={1}
                    placeholder="ex: 95"
                  />
                </div>
                <NumericField
                  label={t("fields.gompertzMinPoints")}
                  name="gompertzMinPoints"
                  value={form.gompertzMinPoints}
                  onChange={handleNumeric}
                  min={3}
                  max={20}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  {t("gompertz.hint")}
                </p>
              </div>
            )}
          </SectionCard>
          );
        })}
      </div>

      {/* Boutons d'action */}
      <div className="flex gap-3 pt-4 sticky bottom-0 pb-4">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => router.push("/settings/config-elevage")}
        >
          {t("form.annuler")}
        </Button>
        <Button type="submit" className="flex-1">
          {t("form.enregistrer")}
        </Button>
      </div>
    </form>
  );
}
