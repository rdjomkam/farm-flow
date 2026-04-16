"use client";

/**
 * FeedingRecommendation — Carte de recommandations d'alimentation (Story S16-4).
 *
 * Affiche les details calcules d'une activite d'alimentation :
 *   - Quantite quotidienne en grammes (conversion KG→g, EC-14.4)
 *   - Taille de granule recommandee
 *   - Frequence de distribution (repas/jour)
 *   - Stock restant du produit recommande + jours estimes avant rupture
 *   - Calcul par bac si plusieurs bacs avec tailles differentes (EC-4.5)
 *
 * Le composant est "use client" car il gere l'etat d'expansion des bacs.
 */

import { useState } from "react";
import {
  Utensils,
  Package,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { UniteStock, PhaseElevage } from "@/types";
import { convertirUniteStock } from "@/lib/calculs";
import { FREQUENCES_PAR_PHASE } from "@/lib/activity-engine/feeding";
import type { BacFeedingRecommendation } from "@/lib/activity-engine/feeding";

// ---------------------------------------------------------------------------
// Derivation depuis la phase d'elevage (quand les valeurs calculees ne sont pas disponibles)
// ---------------------------------------------------------------------------
// FREQUENCES_PAR_PHASE est importé depuis @/lib/activity-engine/feeding — source unique.

/** Tailles de granule recommandees par phase (fallback si taille exacte non disponible) */
const GRANULE_PAR_PHASE: Record<string, string> = {
  [PhaseElevage.ACCLIMATATION]: "1.2mm",
  [PhaseElevage.CROISSANCE_DEBUT]: "1.5-2mm",
  [PhaseElevage.JUVENILE]: "2-3mm",
  [PhaseElevage.GROSSISSEMENT]: "4-6mm",
  [PhaseElevage.FINITION]: "6-9mm",
  [PhaseElevage.PRE_RECOLTE]: "6-9mm",
};

// ---------------------------------------------------------------------------
// Types des props
// ---------------------------------------------------------------------------

/**
 * Donnees de stock d'un produit recommande.
 * Separees de ActiviteWithRelations car la query de base n'inclut pas stockActuel.
 */
export interface ProduitStockInfo {
  id: string;
  nom: string;
  unite: UniteStock;
  stockActuel: number;
  /** Unite d'achat optionnelle (ex: SACS) */
  uniteAchat?: UniteStock | null;
  /** Contenance en unite de base si uniteAchat defini */
  contenance?: number | null;
}

export interface FeedingRecommendationProps {
  /**
   * Quantite recommandee stockee sur l'activite (dans l'unite du produit).
   * Peut etre en KG ou GRAMME selon le produit.
   */
  quantiteRecommandee: number | null;
  /**
   * Taille de granule recommandee (ex: "2-3mm").
   * Provient de phaseElevage + detecterPhase.
   */
  tailleGranule: string | null;
  /**
   * Nombre de repas par jour recommandes.
   */
  frequence: number | null;
  /**
   * Phase d'elevage courante (pour affichage contextuel).
   */
  phaseElevage: string | null;
  /**
   * Poids moyen utilise pour le calcul (en grammes).
   */
  poidsMoyenUtilise: number | null;
  /**
   * Nombre de vivants utilise pour le calcul.
   */
  nombreVivantsUtilise: number | null;
  /**
   * True si le poids a ete projete via SGR (biometrie > 7 jours).
   */
  estProjete?: boolean;
  /**
   * Informations de stock du produit recommande.
   * Null si pas de produit recommande ou stock non disponible.
   */
  produitStock: ProduitStockInfo | null;
  /**
   * Recommandations par bac (EC-4.5 : plusieurs bacs avec tailles differentes).
   * Si null ou vide, affichage global seulement.
   */
  parBac?: BacFeedingRecommendation[] | null;
}

// ---------------------------------------------------------------------------
// Labels phases (removed — now using i18n via stock.json produits.phases)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers de formatage
// ---------------------------------------------------------------------------

/**
 * Convertit une quantite en KG vers grammes pour l'affichage (EC-14.4).
 * Si l'unite est deja GRAMME, retourne directement.
 * Si l'unite est SACS, utilise la contenance.
 */
function formatQuantiteEnGrammes(
  quantite: number,
  unite: UniteStock,
  contenance?: number | null
): { valeur: number; label: string } {
  if (unite === UniteStock.GRAMME) {
    return { valeur: quantite, label: `${Math.round(quantite)} g` };
  }

  const quantiteEnGrammes = convertirUniteStock(
    quantite,
    unite,
    UniteStock.GRAMME,
    contenance ?? 25
  );

  if (quantiteEnGrammes == null) {
    return { valeur: quantite, label: `${quantite} ${unite}` };
  }

  if (quantiteEnGrammes >= 1000) {
    return {
      valeur: quantiteEnGrammes,
      label: `${(quantiteEnGrammes / 1000).toFixed(2)} kg (${Math.round(quantiteEnGrammes)} g)`,
    };
  }

  return { valeur: quantiteEnGrammes, label: `${Math.round(quantiteEnGrammes)} g` };
}

/**
 * Calcule les jours de stock estimes avant rupture.
 * quantiteStockEnGrammes / quantiteJournaliereEnGrammes
 */
function calculerJoursStock(
  stockActuel: number,
  uniteStock: UniteStock,
  quantiteJournaliereGrammes: number,
  contenanceSac?: number | null
): number | null {
  if (quantiteJournaliereGrammes <= 0) return null;

  const stockEnGrammes = convertirUniteStock(
    stockActuel,
    uniteStock,
    UniteStock.GRAMME,
    contenanceSac ?? 25
  );

  if (stockEnGrammes == null || stockEnGrammes < 0) return null;

  return Math.floor(stockEnGrammes / quantiteJournaliereGrammes);
}

/**
 * Classe CSS de couleur pour les jours de stock.
 */
function getJoursStockColor(jours: number): string {
  if (jours <= 3) return "text-danger";
  if (jours <= 7) return "text-warning";
  return "text-success";
}

// ---------------------------------------------------------------------------
// Sous-composant : ligne metrique
// ---------------------------------------------------------------------------

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  hint?: string;
}

function MetricRow({ icon, label, value, valueClass, hint }: MetricRowProps) {
  return (
    <div className="flex items-start justify-between gap-2 py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
        <span className="shrink-0 text-muted-foreground/70">{icon}</span>
        <span className="text-xs">{label}</span>
        {hint && (
          <span className="text-xs text-muted-foreground/50 italic truncate hidden sm:inline">
            ({hint})
          </span>
        )}
      </div>
      <span className={["text-xs font-semibold shrink-0", valueClass ?? "text-foreground"].join(" ")}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sous-composant : carte bac (EC-4.5)
// ---------------------------------------------------------------------------

interface BacCardProps {
  bac: BacFeedingRecommendation;
}

function BacCard({ bac }: BacCardProps) {
  const tStock = useTranslations("stock");
  const tActivites = useTranslations("activites");
  const quantiteGrammesLabel =
    bac.recommendation.quantiteGrammes >= 1000
      ? `${(bac.recommendation.quantiteGrammes / 1000).toFixed(2)} kg`
      : `${bac.recommendation.quantiteGrammes} g`;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-foreground">{bac.bacNom}</p>
        {bac.recommendation.estProjete && (
          <span className="text-xs text-warning flex items-center gap-1">
            <Info className="h-3 w-3" />
            {tActivites("feeding.poidsProjete")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <div>
          <p className="text-xs text-muted-foreground">{tActivites("feeding.quantity")}</p>
          <p className="text-sm font-bold text-primary">{quantiteGrammesLabel}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{tActivites("feeding.granule")}</p>
          <p className="text-sm font-medium">{tStock(`produits.taillesGranule.${bac.recommendation.tailleGranule}` as any) || bac.recommendation.tailleGranule}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{tActivites("feeding.mealsPerDay")}</p>
          <p className="text-sm font-medium">{bac.recommendation.frequence}x</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{tActivites("feeding.avgWeight")}</p>
          <p className="text-sm font-medium">{bac.recommendation.poidsMoyenUtilise} g</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">
            {bac.nombreVivants} poissons · taux {bac.recommendation.tauxUtilise}%/j
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function FeedingRecommendation({
  quantiteRecommandee,
  tailleGranule,
  frequence,
  phaseElevage,
  poidsMoyenUtilise,
  nombreVivantsUtilise,
  estProjete = false,
  produitStock,
  parBac,
}: FeedingRecommendationProps) {
  const tStock = useTranslations("stock");
  const tActivites = useTranslations("activites");
  const [showParBac, setShowParBac] = useState(false);

  // Donnees insuffisantes
  if (quantiteRecommandee == null && parBac == null) {
    return (
      <div className="mt-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-3">
        <p className="text-xs text-muted-foreground text-center">
          {tActivites("feeding.donneesInsuffisantes")}
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Calculs
  // ---------------------------------------------------------------------------

  // Derive tailleGranule depuis phaseElevage si non fournie directement
  const tailleGranuleEffective =
    tailleGranule ??
    (phaseElevage != null ? GRANULE_PAR_PHASE[phaseElevage] ?? null : null);

  // Derive frequence depuis phaseElevage si non fournie directement
  // Cast PhaseElevage necessaire : phaseElevage est string | null dans les props (valeur DB)
  const frequenceEffective =
    frequence ??
    (phaseElevage != null ? FREQUENCES_PAR_PHASE[phaseElevage as PhaseElevage] ?? null : null);

  // Unite du produit (KG par defaut pour les aliments)
  const uniteStockProduit = produitStock?.unite ?? UniteStock.KG;

  // Quantite en grammes pour affichage (EC-14.4)
  const quantiteDisplay =
    quantiteRecommandee != null
      ? formatQuantiteEnGrammes(
          quantiteRecommandee,
          uniteStockProduit,
          produitStock?.contenance
        )
      : null;

  // Quantite par repas (en grammes)
  const quantiteParRepasLabel =
    quantiteDisplay != null && frequenceEffective != null && frequenceEffective > 0
      ? `${Math.round(quantiteDisplay.valeur / frequenceEffective)} g / repas`
      : null;

  // Jours de stock estimes
  const joursStock =
    produitStock != null && quantiteDisplay != null && quantiteDisplay.valeur > 0
      ? calculerJoursStock(
          produitStock.stockActuel,
          produitStock.unite,
          quantiteDisplay.valeur,
          produitStock.contenance
        )
      : null;

  // Label stock avec conversion unite d'affichage
  const stockLabel =
    produitStock != null
      ? produitStock.uniteAchat
        ? `${produitStock.stockActuel} ${produitStock.uniteAchat}`
        : `${produitStock.stockActuel} ${produitStock.unite}`
      : null;

  // Plusieurs bacs avec tailles differentes (EC-4.5)
  const hasMultiBac = parBac != null && parBac.length > 1;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
      {/* En-tete */}
      <div className="flex items-center gap-1.5 mb-3">
        <Utensils className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs font-semibold text-primary">
          {tActivites("feeding.recommandationAlimentation")}
        </p>
        {estProjete && (
          <span className="ml-auto flex items-center gap-1 text-xs text-warning">
            <Info className="h-3 w-3" />
            {tActivites("feeding.poidsProjeteSGR")}
          </span>
        )}
      </div>

      {/* Badge phase */}
      {phaseElevage && (
        <div className="mb-3">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {tStock(`produits.phases.${phaseElevage}` as any) || phaseElevage}
          </span>
        </div>
      )}

      {/* Quantite principale — mise en valeur */}
      {quantiteDisplay != null && (
        <div className="mb-3 rounded-md bg-card/80 px-3 py-2.5 text-center">
          <p className="text-xs text-muted-foreground mb-0.5">{tActivites("feeding.dailyQuantity")}</p>
          <p className="text-xl font-bold text-primary leading-tight">
            {quantiteDisplay.label}
          </p>
          {quantiteParRepasLabel && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {quantiteParRepasLabel}
            </p>
          )}
        </div>
      )}

      {/* Metriques : granule, frequence, poids, vivants */}
      <div className="flex flex-col">
        {tailleGranuleEffective && (
          <MetricRow
            icon={<Package className="h-3.5 w-3.5" />}
            label={tActivites("feeding.granuleSize")}
            value={tStock(`produits.taillesGranule.${tailleGranuleEffective}` as any) || tailleGranuleEffective}
          />
        )}

        {frequenceEffective != null && (
          <MetricRow
            icon={<Clock className="h-3.5 w-3.5" />}
            label={tActivites("feeding.frequence")}
            value={`${frequenceEffective} repas / jour`}
          />
        )}

        {poidsMoyenUtilise != null && (
          <MetricRow
            icon={<span className="text-xs font-bold">~</span>}
            label={tActivites("feeding.avgWeightFull")}
            value={`${poidsMoyenUtilise} g`}
            hint={estProjete ? "projete" : undefined}
          />
        )}

        {nombreVivantsUtilise != null && (
          <MetricRow
            icon={<span className="text-xs">🐟</span>}
            label={tActivites("feeding.poissons")}
            value={formatNumber(nombreVivantsUtilise)}
          />
        )}
      </div>

      {/* Stock produit recommande */}
      {produitStock != null && (
        <div
          className={[
            "mt-3 rounded-md px-3 py-2",
            joursStock != null && joursStock <= 3
              ? "bg-danger/10 border border-danger/30"
              : "bg-muted/40",
          ].join(" ")}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {produitStock.nom}
              </p>
              <p className="text-xs text-muted-foreground">
                Stock: {stockLabel ?? "—"}
              </p>
            </div>

            {joursStock != null ? (
              <div className="text-right shrink-0">
                <p
                  className={[
                    "text-sm font-bold",
                    getJoursStockColor(joursStock),
                  ].join(" ")}
                >
                  {joursStock} j
                </p>
                <p className="text-xs text-muted-foreground">{tActivites("feeding.beforeStockout")}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground shrink-0">{tActivites("feeding.stockUnknown")}</p>
            )}
          </div>

          {joursStock != null && joursStock <= 3 && (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>{tActivites("feeding.criticalStock")}</span>
            </div>
          )}

          {joursStock != null && joursStock > 3 && joursStock <= 7 && (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>{tActivites("feeding.lowStock")}</span>
            </div>
          )}
        </div>
      )}

      {/* Section multi-bacs (EC-4.5) */}
      {hasMultiBac && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowParBac((v) => !v)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <span>
              {tActivites("feeding.detailParBac", { count: parBac!.length })}
            </span>
            {showParBac ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showParBac && (
            <div className="mt-2 flex flex-col gap-2">
              {parBac!.map((bac) => (
                <BacCard key={bac.bacId} bac={bac} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
