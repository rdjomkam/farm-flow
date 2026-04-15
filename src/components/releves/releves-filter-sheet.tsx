"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { TypeReleve, StatutVague, CauseMortalite, MethodeComptage } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SheetClose } from "@/components/ui/sheet";
import { ALL_VALUE } from "@/lib/releve-search-params";
import type { ReleveSearchParams } from "@/lib/releve-search-params";

interface BacOption {
  id: string;
  nom: string;
}

interface VagueOption {
  id: string;
  code: string;
  statut: StatutVague;
}

interface ProduitAlimentOption {
  id: string;
  nom: string;
  unite: string;
}


/** Composant interne pour une paire de champs min/max */
function RangeInputs({
  label,
  unit,
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  step = "any",
}: {
  label: string;
  unit?: string;
  minValue: string;
  maxValue: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
  step?: string;
}) {
  const tRange = useTranslations("common.placeholders");
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        {label}
        {unit && <span className="text-xs font-normal text-muted-foreground ml-1">({unit})</span>}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step={step}
          value={minValue}
          onChange={(e) => onMinChange(e.target.value)}
          placeholder={tRange("min")}
          className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="text-sm text-muted-foreground shrink-0">–</span>
        <input
          type="number"
          min="0"
          step={step}
          value={maxValue}
          onChange={(e) => onMaxChange(e.target.value)}
          placeholder={tRange("max")}
          className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );
}

interface Props {
  current: ReleveSearchParams;
  vagues: VagueOption[];
  onApply: (params: Partial<ReleveSearchParams>) => void;
  onClear: () => void;
  activeCount: number;
}

export function RelevesFilterSheet({
  current,
  vagues,
  onApply,
  onClear,
  activeCount,
}: Props) {
  const t = useTranslations("releves");
  const tCommon = useTranslations("common");

  // Etat local du sheet : les modifications ne s'appliquent qu'au clic "Appliquer"
  const [localVagueId, setLocalVagueId] = useState(current.vagueId ?? ALL_VALUE);
  const [localBacId, setLocalBacId] = useState(current.bacId ?? ALL_VALUE);
  const [localType, setLocalType] = useState(current.typeReleve ?? ALL_VALUE);
  const [localDateFrom, setLocalDateFrom] = useState(current.dateFrom ?? "");
  const [localDateTo, setLocalDateTo] = useState(current.dateTo ?? "");
  const [localModifie, setLocalModifie] = useState(current.modifie === "true");

  // Filtres specifiques BIOMETRIE
  const [localPoidsMoyenMin, setLocalPoidsMoyenMin] = useState(current.poidsMoyenMin ?? "");
  const [localPoidsMoyenMax, setLocalPoidsMoyenMax] = useState(current.poidsMoyenMax ?? "");
  const [localTailleMoyenneMin, setLocalTailleMoyenneMin] = useState(current.tailleMoyenneMin ?? "");
  const [localTailleMoyenneMax, setLocalTailleMoyenneMax] = useState(current.tailleMoyenneMax ?? "");

  // Filtres specifiques MORTALITE
  const [localCauseMortalite, setLocalCauseMortalite] = useState(current.causeMortalite ?? ALL_VALUE);
  const [localNombreMortsMin, setLocalNombreMortsMin] = useState(current.nombreMortsMin ?? "");
  const [localNombreMortsMax, setLocalNombreMortsMax] = useState(current.nombreMortsMax ?? "");

  // Filtres specifiques ALIMENTATION
  const [localProduitId, setLocalProduitId] = useState(current.produitId ?? ALL_VALUE);
  const [localFrequenceAlimentMin, setLocalFrequenceAlimentMin] = useState(current.frequenceAlimentMin ?? "");
  const [localFrequenceAlimentMax, setLocalFrequenceAlimentMax] = useState(current.frequenceAlimentMax ?? "");

  // Produits alimentaires charges dynamiquement pour le filtre ALIMENTATION
  const [produits, setProduits] = useState<ProduitAlimentOption[]>([]);
  const [produitsLoading, setProduitsLoading] = useState(false);

  // Filtres specifiques QUALITE_EAU
  const [localTemperatureMin, setLocalTemperatureMin] = useState(current.temperatureMin ?? "");
  const [localTemperatureMax, setLocalTemperatureMax] = useState(current.temperatureMax ?? "");
  const [localPhMin, setLocalPhMin] = useState(current.phMin ?? "");
  const [localPhMax, setLocalPhMax] = useState(current.phMax ?? "");

  // Filtres specifiques COMPTAGE
  const [localMethodeComptage, setLocalMethodeComptage] = useState(current.methodeComptage ?? ALL_VALUE);

  // Filtres specifiques OBSERVATION
  const [localDescriptionSearch, setLocalDescriptionSearch] = useState(current.descriptionSearch ?? "");

  // Filtres specifiques RENOUVELLEMENT
  const [localPourcentageMin, setLocalPourcentageMin] = useState(current.pourcentageMin ?? "");
  const [localPourcentageMax, setLocalPourcentageMax] = useState(current.pourcentageMax ?? "");

  // Bacs charges dynamiquement selon la vague selectionnee
  const [bacs, setBacs] = useState<BacOption[]>([]);
  const [bacsLoading, setBacsLoading] = useState(false);

  // Synchroniser avec les filtres actuels quand ils changent (retour navigateur)
  useEffect(() => {
    setLocalVagueId(current.vagueId ?? ALL_VALUE);
    setLocalBacId(current.bacId ?? ALL_VALUE);
    setLocalType(current.typeReleve ?? ALL_VALUE);
    setLocalDateFrom(current.dateFrom ?? "");
    setLocalDateTo(current.dateTo ?? "");
    setLocalModifie(current.modifie === "true");
    // Filtres specifiques
    setLocalPoidsMoyenMin(current.poidsMoyenMin ?? "");
    setLocalPoidsMoyenMax(current.poidsMoyenMax ?? "");
    setLocalTailleMoyenneMin(current.tailleMoyenneMin ?? "");
    setLocalTailleMoyenneMax(current.tailleMoyenneMax ?? "");
    setLocalCauseMortalite(current.causeMortalite ?? ALL_VALUE);
    setLocalNombreMortsMin(current.nombreMortsMin ?? "");
    setLocalNombreMortsMax(current.nombreMortsMax ?? "");
    setLocalProduitId(current.produitId ?? ALL_VALUE);
    setLocalFrequenceAlimentMin(current.frequenceAlimentMin ?? "");
    setLocalFrequenceAlimentMax(current.frequenceAlimentMax ?? "");
    setLocalTemperatureMin(current.temperatureMin ?? "");
    setLocalTemperatureMax(current.temperatureMax ?? "");
    setLocalPhMin(current.phMin ?? "");
    setLocalPhMax(current.phMax ?? "");
    setLocalMethodeComptage(current.methodeComptage ?? ALL_VALUE);
    setLocalDescriptionSearch(current.descriptionSearch ?? "");
    setLocalPourcentageMin(current.pourcentageMin ?? "");
    setLocalPourcentageMax(current.pourcentageMax ?? "");
  }, [current]);

  // Charger les bacs quand la vague locale change
  useEffect(() => {
    if (!localVagueId || localVagueId === ALL_VALUE) {
      setBacs([]);
      setLocalBacId(ALL_VALUE);
      return;
    }
    setBacsLoading(true);
    fetch(`/api/bacs/by-vague-releves?vagueId=${localVagueId}`)
      .then((r) => r.json())
      .then((d: { data?: BacOption[] }) => {
        setBacs(d.data ?? []);
      })
      .catch(() => setBacs([]))
      .finally(() => setBacsLoading(false));
  }, [localVagueId]);

  // Charger les produits alimentaires au montage (une seule fois)
  useEffect(() => {
    setProduitsLoading(true);
    fetch("/api/produits/aliment-releve")
      .then((r) => r.json())
      .then((d: { data?: ProduitAlimentOption[] }) => {
        setProduits(d.data ?? []);
      })
      .catch(() => setProduits([]))
      .finally(() => setProduitsLoading(false));
  }, []);

  function handleVagueChange(value: string) {
    setLocalVagueId(value);
    setLocalBacId(ALL_VALUE); // reset bac quand vague change
  }

  /** Quand le type change, reinitialiser tous les filtres specifiques */
  function handleTypeChange(value: string) {
    setLocalType(value);
    // Reset BIOMETRIE
    setLocalPoidsMoyenMin("");
    setLocalPoidsMoyenMax("");
    setLocalTailleMoyenneMin("");
    setLocalTailleMoyenneMax("");
    // Reset MORTALITE
    setLocalCauseMortalite(ALL_VALUE);
    setLocalNombreMortsMin("");
    setLocalNombreMortsMax("");
    // Reset ALIMENTATION
    setLocalProduitId(ALL_VALUE);
    setLocalFrequenceAlimentMin("");
    setLocalFrequenceAlimentMax("");
    // Reset QUALITE_EAU
    setLocalTemperatureMin("");
    setLocalTemperatureMax("");
    setLocalPhMin("");
    setLocalPhMax("");
    // Reset COMPTAGE
    setLocalMethodeComptage(ALL_VALUE);
    // Reset OBSERVATION
    setLocalDescriptionSearch("");
    // Reset RENOUVELLEMENT
    setLocalPourcentageMin("");
    setLocalPourcentageMax("");
  }

  function handleApply() {
    const base: Partial<ReleveSearchParams> = {
      vagueId: localVagueId !== ALL_VALUE ? localVagueId : undefined,
      bacId: localBacId !== ALL_VALUE ? localBacId : undefined,
      typeReleve: localType !== ALL_VALUE ? localType : undefined,
      dateFrom: localDateFrom || undefined,
      dateTo: localDateTo || undefined,
      modifie: localModifie ? "true" : undefined,
    };

    // Filtres specifiques selon le type selectionne
    if (localType === TypeReleve.BIOMETRIE) {
      if (localPoidsMoyenMin) base.poidsMoyenMin = localPoidsMoyenMin;
      if (localPoidsMoyenMax) base.poidsMoyenMax = localPoidsMoyenMax;
      if (localTailleMoyenneMin) base.tailleMoyenneMin = localTailleMoyenneMin;
      if (localTailleMoyenneMax) base.tailleMoyenneMax = localTailleMoyenneMax;
    }
    if (localType === TypeReleve.MORTALITE) {
      if (localCauseMortalite !== ALL_VALUE) base.causeMortalite = localCauseMortalite;
      if (localNombreMortsMin) base.nombreMortsMin = localNombreMortsMin;
      if (localNombreMortsMax) base.nombreMortsMax = localNombreMortsMax;
    }
    if (localType === TypeReleve.ALIMENTATION) {
      if (localFrequenceAlimentMin) base.frequenceAlimentMin = localFrequenceAlimentMin;
      if (localFrequenceAlimentMax) base.frequenceAlimentMax = localFrequenceAlimentMax;
    }
    // produitId est independant du type car il filtre via ReleveConsommation
    if (localProduitId !== ALL_VALUE) base.produitId = localProduitId;
    if (localType === TypeReleve.QUALITE_EAU) {
      if (localTemperatureMin) base.temperatureMin = localTemperatureMin;
      if (localTemperatureMax) base.temperatureMax = localTemperatureMax;
      if (localPhMin) base.phMin = localPhMin;
      if (localPhMax) base.phMax = localPhMax;
    }
    if (localType === TypeReleve.COMPTAGE) {
      if (localMethodeComptage !== ALL_VALUE) base.methodeComptage = localMethodeComptage;
    }
    if (localType === TypeReleve.OBSERVATION) {
      if (localDescriptionSearch) base.descriptionSearch = localDescriptionSearch;
    }
    if (localType === TypeReleve.RENOUVELLEMENT) {
      if (localPourcentageMin) base.pourcentageMin = localPourcentageMin;
      if (localPourcentageMax) base.pourcentageMax = localPourcentageMax;
    }

    onApply(base);
  }

  const showTypeSpecific = localType !== ALL_VALUE;

  return (
    <div className="flex flex-col h-full">

      {/* Header fixe — safe area top avec bouton fermeture integre */}
      <div
        className="shrink-0 flex items-center justify-between px-4 border-b border-border"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <h2 className="text-base font-semibold">{t("global.filtres.titre")}</h2>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              {t("global.filtres.effacer")}
            </button>
          )}
          <SheetClose asChild>
            <button
              type="button"
              className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
            >
              <X className="h-5 w-5" />
              <span className="sr-only">{tCommon("buttons.close")}</span>
            </button>
          </SheetClose>
        </div>
      </div>

      {/* Corps scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">

        {/* Vague */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("global.filtres.vague")}</label>
          <Select value={localVagueId} onValueChange={handleVagueChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("global.filtres.toutesVagues")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t("global.filtres.toutesVagues")}</SelectItem>
              {vagues.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bac — desactive si pas de vague selectionnee */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("global.filtres.bac")}</label>
          <Select
            value={localBacId}
            onValueChange={setLocalBacId}
            disabled={localVagueId === ALL_VALUE || bacsLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  localVagueId === ALL_VALUE
                    ? t("form.fields.bacSelectVagueFirst")
                    : bacsLoading
                    ? tCommon("loading.text")
                    : t("global.filtres.tousBacs")
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t("global.filtres.tousBacs")}</SelectItem>
              {bacs.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Type de releve */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("global.filtres.type")}</label>
          <Select value={localType} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("global.filtres.tousTyes")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>{t("global.filtres.tousTyes")}</SelectItem>
              {Object.values(TypeReleve).map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`types.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtres specifiques au type — conditionnel */}
        {showTypeSpecific && (
          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("global.filtres.filtresSpecifiques", { type: t(`types.${localType as TypeReleve}`) })}
            </p>

            {/* BIOMETRIE */}
            {localType === TypeReleve.BIOMETRIE && (
              <>
                <RangeInputs
                  label={t("global.filtres.poidsMoyen")}
                  unit="g"
                  minValue={localPoidsMoyenMin}
                  maxValue={localPoidsMoyenMax}
                  onMinChange={setLocalPoidsMoyenMin}
                  onMaxChange={setLocalPoidsMoyenMax}
                  step="0.1"
                />
                <RangeInputs
                  label={t("global.filtres.tailleMoyenne")}
                  unit="cm"
                  minValue={localTailleMoyenneMin}
                  maxValue={localTailleMoyenneMax}
                  onMinChange={setLocalTailleMoyenneMin}
                  onMaxChange={setLocalTailleMoyenneMax}
                  step="0.1"
                />
              </>
            )}

            {/* MORTALITE */}
            {localType === TypeReleve.MORTALITE && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">{t("form.mortalite.causeMortalite")}</label>
                  <Select value={localCauseMortalite} onValueChange={setLocalCauseMortalite}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("global.filtres.toutesCauses")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>{t("global.filtres.toutesCauses")}</SelectItem>
                      {Object.values(CauseMortalite).map((cause) => (
                        <SelectItem key={cause} value={cause}>
                          {t(`form.mortalite.causes.${cause}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <RangeInputs
                  label={t("global.filtres.nombreMorts")}
                  minValue={localNombreMortsMin}
                  maxValue={localNombreMortsMax}
                  onMinChange={setLocalNombreMortsMin}
                  onMaxChange={setLocalNombreMortsMax}
                  step="1"
                />
              </>
            )}

            {/* ALIMENTATION */}
            {localType === TypeReleve.ALIMENTATION && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">{t("global.filtres.produitAlimentaire")}</label>
                  <Select
                    value={localProduitId}
                    onValueChange={setLocalProduitId}
                    disabled={produitsLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={produitsLoading ? tCommon("loading.text") : t("global.filtres.tousProduits")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>{t("global.filtres.tousProduits")}</SelectItem>
                      {produits.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <RangeInputs
                  label={t("global.filtres.frequenceAlimentation")}
                  unit="fois/j"
                  minValue={localFrequenceAlimentMin}
                  maxValue={localFrequenceAlimentMax}
                  onMinChange={setLocalFrequenceAlimentMin}
                  onMaxChange={setLocalFrequenceAlimentMax}
                  step="0.5"
                />
              </>
            )}

            {/* QUALITE_EAU */}
            {localType === TypeReleve.QUALITE_EAU && (
              <>
                <RangeInputs
                  label={t("global.filtres.temperature")}
                  unit="°C"
                  minValue={localTemperatureMin}
                  maxValue={localTemperatureMax}
                  onMinChange={setLocalTemperatureMin}
                  onMaxChange={setLocalTemperatureMax}
                  step="0.1"
                />
                <RangeInputs
                  label={t("form.qualiteEau.ph")}
                  minValue={localPhMin}
                  maxValue={localPhMax}
                  onMinChange={setLocalPhMin}
                  onMaxChange={setLocalPhMax}
                  step="0.1"
                />
              </>
            )}

            {/* COMPTAGE */}
            {localType === TypeReleve.COMPTAGE && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t("form.comptage.methodeComptage")}</label>
                <Select value={localMethodeComptage} onValueChange={setLocalMethodeComptage}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("global.filtres.toutesMethodes")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_VALUE}>{t("global.filtres.toutesMethodes")}</SelectItem>
                    {Object.values(MethodeComptage).map((m) => (
                      <SelectItem key={m} value={m}>
                        {t(`form.comptage.methodes.${m}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* OBSERVATION */}
            {localType === TypeReleve.OBSERVATION && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">{t("global.filtres.rechercheDescription")}</label>
                <input
                  type="text"
                  value={localDescriptionSearch}
                  onChange={(e) => setLocalDescriptionSearch(e.target.value)}
                  placeholder='Ex : "stress", "coloration"...'
                  className="h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {/* RENOUVELLEMENT */}
            {localType === TypeReleve.RENOUVELLEMENT && (
              <RangeInputs
                label={t("global.filtres.pourcentageRenouvele")}
                unit="%"
                minValue={localPourcentageMin}
                maxValue={localPourcentageMax}
                onMinChange={setLocalPourcentageMin}
                onMaxChange={setLocalPourcentageMax}
                step="1"
              />
            )}
          </div>
        )}

        {/* Periode */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t("global.filtres.periode")}</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-5">{t("global.filtres.du")}</span>
            <input
              type="date"
              value={localDateFrom}
              onChange={(e) => setLocalDateFrom(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-5">{t("global.filtres.au")}</span>
            <input
              type="date"
              value={localDateTo}
              onChange={(e) => setLocalDateTo(e.target.value)}
              className="flex-1 min-w-0 h-10 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Modifies seulement */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={localModifie}
            onChange={(e) => setLocalModifie(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span className="text-sm">{t("global.filtres.modifie")}</span>
        </label>

      </div>

      {/* Footer fixe — safe area bottom + safe area right (landscape) */}
      <div
        className="shrink-0 flex gap-2 px-4 pt-3 border-t border-border"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <button
          type="button"
          onClick={onClear}
          className="flex-1 h-10 rounded-md border border-border bg-background text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
        >
          {t("global.filtres.effacer")}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {activeCount > 0
            ? t("global.filtres.appliquer", { count: activeCount })
            : t("global.filtres.appliquerSimple")}
        </button>
      </div>

    </div>
  );
}
