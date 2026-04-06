"use client";

import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { KNOWN_PLACEHOLDERS } from "@/lib/regles-activites-constants";
import { InstructionSteps } from "@/components/activites/instruction-steps";

// ---------------------------------------------------------------------------
// Sample data — valeurs fictives realistes pour l'apercu
// ---------------------------------------------------------------------------

const STATIC_PREVIEW_SAMPLE: Record<string, string> = Object.fromEntries(
  KNOWN_PLACEHOLDERS.map((p) => [p.key, p.example])
);

const PLACEHOLDER_REGEX = /\{(\w+)\}/g;

/**
 * Resout les placeholders d'un template avec les valeurs d'exemple.
 * Les placeholders inconnus affichent "[donnee non disponible]".
 * Resolution client-side, pas d'appel API.
 */
function resolvePreviewTemplate(
  template: string,
  customSamples: Record<string, string> = {}
): string {
  const allSamples = { ...STATIC_PREVIEW_SAMPLE, ...customSamples };
  return template.replace(PLACEHOLDER_REGEX, (_match, key: string) => {
    return allSamples[key] ?? "[donnee non disponible]";
  });
}

// ---------------------------------------------------------------------------
// Composant TemplatePreview
// ---------------------------------------------------------------------------

interface TemplatePreviewProps {
  titreTemplate: string;
  descriptionTemplate: string;
  instructionsTemplate: string;
  /** Custom placeholders for preview (optional) */
  customPlaceholders?: { key: string; example: string }[];
}

/**
 * Affiche un apercu en temps reel des templates resolus avec des donnees fictives.
 *
 * - Resolution client-side avec regex miroir de template-engine.ts
 * - Placeholders inconnus : "[donnee non disponible]"
 * - Instructions : rendu via InstructionSteps (numerotees, bullets)
 * - Mise a jour en temps reel (props reactives)
 */
export function TemplatePreview({
  titreTemplate,
  descriptionTemplate,
  instructionsTemplate,
  customPlaceholders = [],
}: TemplatePreviewProps) {
  const t = useTranslations("settings");
  // Build custom samples from custom placeholders
  const customSamples: Record<string, string> = {};
  for (const cp of customPlaceholders) {
    customSamples[cp.key] = cp.example;
  }

  const resolvedTitre = titreTemplate
    ? resolvePreviewTemplate(titreTemplate, customSamples)
    : "(aucun titre)";
  const resolvedDescription = descriptionTemplate
    ? resolvePreviewTemplate(descriptionTemplate, customSamples)
    : null;
  const resolvedInstructions = instructionsTemplate
    ? resolvePreviewTemplate(instructionsTemplate, customSamples)
    : null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Eye className="h-4 w-4" />
        Apercu (donnees exemple)
      </div>

      {/* Titre resolu */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">{t("rules.detail.templateTitle")}</p>
        <p className="text-sm font-medium text-foreground bg-card rounded-md px-3 py-2 border border-border">
          {resolvedTitre}
        </p>
      </div>

      {/* Description resolue */}
      {resolvedDescription && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t("rules.detail.templateDescription")}</p>
          <p className="text-sm text-foreground bg-card rounded-md px-3 py-2 border border-border">
            {resolvedDescription}
          </p>
        </div>
      )}

      {/* Instructions resolues */}
      {resolvedInstructions && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">{t("rules.detail.templateInstructions")}</p>
          <div className="bg-card rounded-md px-3 py-3 border border-border">
            <InstructionSteps text={resolvedInstructions} />
          </div>
        </div>
      )}

      {/* Avertissement donnees fictives */}
      <p className="text-xs text-muted-foreground italic">
        Les valeurs affichees sont fictives. Les valeurs reelles sont calculees lors de la generation.
      </p>
    </div>
  );
}
