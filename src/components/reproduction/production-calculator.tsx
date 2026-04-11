"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator } from "lucide-react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OEUFS_PAR_GRAMME = 750; // average eggs per gram
const TAUX_ECLOSION_DEFAULT = 0.7; // 70% hatching rate
const BAC_CAPACITY = 500; // estimated fingerlings per bac
const WEEKS_PER_PHASE = 3; // approximate weeks from ponte to fingerlings

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductionCalculator() {
  const t = useTranslations("reproduction.planning.calculateur");

  // Inputs
  const [cible, setCible] = useState<number>(1000);
  const [tauxSurvie, setTauxSurvie] = useState<number>(50);
  const [poidsOeufsParFemelle, setPoidsOeufsParFemelle] = useState<number>(200);
  const [malesParPonte, setMalesParPonte] = useState<number>(1);

  // Calculated results
  const results = useMemo(() => {
    const survie = Math.min(Math.max(tauxSurvie, 1), 100) / 100;
    const oeufsParFemelle = poidsOeufsParFemelle * OEUFS_PAR_GRAMME;
    const larvesParPonte = oeufsParFemelle * TAUX_ECLOSION_DEFAULT;
    const alevinsParPonte = larvesParPonte * survie;

    if (alevinsParPonte <= 0) {
      return null;
    }

    const pontesNecessaires = Math.ceil(cible / alevinsParPonte);
    const femellesNecessaires = pontesNecessaires;
    const malesNecessaires = Math.ceil(pontesNecessaires * malesParPonte);
    const surfaceEstimee = Math.ceil(cible / BAC_CAPACITY);
    const dureeEstimee = WEEKS_PER_PHASE;

    return {
      pontesNecessaires,
      femellesNecessaires,
      malesNecessaires,
      surfaceEstimee,
      dureeEstimee,
      alevinsParPonte: Math.round(alevinsParPonte),
    };
  }, [cible, tauxSurvie, poidsOeufsParFemelle, malesParPonte]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="w-5 h-5 text-primary" aria-hidden="true" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="flex flex-col gap-4">
            {/* Cible */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="calc-cible">
                {t("cible")}
              </label>
              <input
                id="calc-cible"
                type="number"
                min={1}
                step={100}
                value={cible}
                onChange={(e) =>
                  setCible(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-11"
              />
            </div>

            {/* Taux de survie */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="calc-survie">
                {t("tauxSurvie")}
                <span className="ml-2 text-primary font-semibold">
                  {tauxSurvie}%
                </span>
              </label>
              <input
                id="calc-survie"
                type="range"
                min={1}
                max={100}
                step={1}
                value={tauxSurvie}
                onChange={(e) => setTauxSurvie(parseInt(e.target.value, 10))}
                className="w-full h-2 accent-primary cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Poids oeufs par femelle */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="calc-oeufs">
                {t("oeufsParFemelle")}
              </label>
              <input
                id="calc-oeufs"
                type="number"
                min={1}
                step={10}
                value={poidsOeufsParFemelle}
                onChange={(e) =>
                  setPoidsOeufsParFemelle(
                    Math.max(1, parseInt(e.target.value, 10) || 1)
                  )
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-11"
              />
              <p className="text-xs text-muted-foreground">
                {(poidsOeufsParFemelle * OEUFS_PAR_GRAMME).toLocaleString(
                  "fr-FR"
                )}{" "}
                {t("oeufsEstimesHint", { rate: OEUFS_PAR_GRAMME })}
              </p>
            </div>

            {/* Males par ponte */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="calc-males">
                {t("malesParPonte")}
              </label>
              <input
                id="calc-males"
                type="number"
                min={1}
                step={1}
                value={malesParPonte}
                onChange={(e) =>
                  setMalesParPonte(
                    Math.max(1, parseInt(e.target.value, 10) || 1)
                  )
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-11"
              />
            </div>
          </div>

          {/* Results */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t("resultats")}
            </h4>

            {results ? (
              <div className="grid grid-cols-1 gap-3">
                <ResultRow
                  label={t("pontesNecessaires")}
                  value={results.pontesNecessaires.toString()}
                  highlight
                />
                <ResultRow
                  label={t("femellesNecessaires")}
                  value={results.femellesNecessaires.toString()}
                />
                <ResultRow
                  label={t("malesNecessaires")}
                  value={results.malesNecessaires.toString()}
                />
                <ResultRow
                  label={t("surfaceEstimee")}
                  value={`${results.surfaceEstimee} bac${results.surfaceEstimee > 1 ? "s" : ""}`}
                />
                <ResultRow
                  label={t("dureeEstimee")}
                  value={`~${results.dureeEstimee} sem.`}
                />
                <div className="mt-2 rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
                  {t("baseLabel")}{" "}
                  <strong>
                    {results.alevinsParPonte.toLocaleString("fr-FR")}
                  </strong>{" "}
                  {t("alevinsParPonteLabel")}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("parametresInvalides")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Helper sub-component
// ---------------------------------------------------------------------------

function ResultRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-semibold tabular-nums ${highlight ? "text-primary text-base" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
