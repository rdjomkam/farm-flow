"use client";

/**
 * src/components/previsions/valeur-calculee.tsx
 *
 * Composant transverse — exigence d'ergonomie §7.4 (ADR-053), non
 * negociable : "tout chiffre calcule est explicable". Remplace la barre de
 * formule d'Excel pour un utilisateur qui vient d'un tableur : un clic (ou
 * un focus clavier) ouvre un Popover qui liste, EN LANGAGE COURANT, les
 * valeurs sources du calcul — jamais un simple "calcule automatiquement".
 *
 * Livrable transverse construit AVANT les ecrans (pre-analyse PR2.3 §2,
 * point 4) : reutilise par tous les ecrans de PR2.3 (sacs calcules, cout,
 * revenu prevu) et par PR2.4 (tableau de bord, vue mensuelle).
 *
 * Distinction visuelle saisie/calcul (§7.4, volet 1) : ce composant rend un
 * conteneur NEUTRE (texte `text-muted-foreground`, aucune bordure
 * `border-input`) — jamais un `<Input readOnly>`, pour qu'aucune ambiguite
 * ne subsiste avec un champ saisissable (`Input`/`Select` gardent leur
 * bordure standard, cf. pre-analyse §2 point 3).
 */
import { useTranslations } from "next-intl";
import { Calculator } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ExplicationValeurCalculee {
  /** Libelle en langage courant d'une valeur source (ex. "Nombre de sacs") */
  label: string;
  /** Valeur source deja formatee pour l'affichage (ex. "285 sacs") */
  valeur: string;
}

export interface ValeurCalculeeProps {
  /** Valeur affichee (deja formatee — formatMontantPrevision, etc.) */
  value: React.ReactNode;
  /**
   * Formule en langage courant (ex. "Cout aliment = sacs x poids par sac x
   * prix par kg, remise de palier appliquee") — jamais "calcule
   * automatiquement" seul (exigence §7.4 explicite).
   */
  formule: string;
  /** Valeurs sources qui entrent dans le calcul, en langage courant */
  explication: ExplicationValeurCalculee[];
  /** Classe additionnelle sur la valeur affichee (ex. text-danger pour un negatif) */
  className?: string;
  /** Libelle accessible du bouton d'explication (ex. "Expliquer le cout aliment") */
  ariaLabel?: string;
}

/**
 * ValeurCalculee — affiche une valeur non editable, visuellement neutre,
 * avec un bouton d'explication accessible au clic ET au clavier (Radix
 * Popover gere focus/Echap/clic-exterieur nativement).
 */
export function ValeurCalculee({
  value,
  formule,
  explication,
  className,
  ariaLabel,
}: ValeurCalculeeProps) {
  const t = useTranslations("previsions");
  const resolvedAriaLabel = ariaLabel ?? t("valeurCalculee.defaultAriaLabel");
  if (process.env.NODE_ENV !== "production") {
    if (!formule.trim()) {
      console.warn(
        "[ValeurCalculee] `formule` est vide — l'exigence d'explicabilite (§7.4) exige une formule en langage courant, jamais une chaine vide."
      );
    }
    if (explication.length === 0) {
      console.warn(
        "[ValeurCalculee] `explication` est vide — aucune valeur source n'est listee, le detail du calcul ne peut pas etre explique."
      );
    }
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-muted-foreground",
        className
      )}
    >
      <span className="font-medium text-foreground">{value}</span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={resolvedAriaLabel}
            className={cn(
              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
              "text-muted-foreground hover:bg-card hover:text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <Calculator className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent>
          <p className="text-sm font-semibold text-foreground">{formule}</p>
          <ul className="mt-2 space-y-1">
            {explication.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{e.label}</span>
                <span className="font-medium text-foreground">{e.valeur}</span>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </span>
  );
}
