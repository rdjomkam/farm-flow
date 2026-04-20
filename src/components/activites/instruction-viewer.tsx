"use client";

/**
 * InstructionViewer — Affichage des instructions d'une activite.
 *
 * Fonctionnalites :
 * - Rendu en step-cards via parseInstructions (pas de Markdown brut)
 * - Section "Produit recommande" si produitRecommandeId est renseigne
 * - Bouton "Marquer comme termine" (CompleterActiviteDialog)
 * - Mobile first : concu pour 360px
 *
 * R2 : imports depuis @/types
 * R5 : DialogTrigger asChild deja respecte dans CompleterActiviteDialog
 * R6 : CSS variables du theme
 */

import { useTranslations, useLocale } from "next-intl";
import { InstructionSteps } from "@/components/activites/instruction-steps";
import Link from "next/link";
import {
  FileText,
  Package,
  AlertTriangle,
  Bot,
  ChevronLeft,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompleterActiviteDialog } from "@/components/planning/completer-activite-dialog";
import { ActiviteComplete } from "@/components/activites/activite-complete";
import { StatutActivite, Permission, TypeActivite, PhaseElevage } from "@/types";
import { RELEVE_COMPATIBLE_TYPES } from "@/types/api";
import type { ActiviteWithRelations } from "@/types";
import { typeActiviteLabels } from "@/lib/labels/activite";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProduitRecommande {
  id: string;
  nom: string;
  unite: string;
  stockActuel?: number;
}

interface InstructionViewerProps {
  activite: ActiviteWithRelations;
  produitRecommande?: ProduitRecommande | null;
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function InstructionViewer({
  activite,
  produitRecommande,
  permissions,
}: InstructionViewerProps) {
  const t = useTranslations("activites");
  const locale = useLocale();
  const canComplete =
    permissions.includes(Permission.PLANNING_GERER) &&
    (activite.statut === StatutActivite.PLANIFIEE ||
      activite.statut === StatutActivite.EN_RETARD);

  const isTerminee = activite.statut === StatutActivite.TERMINEE;
  const isAnnulee = activite.statut === StatutActivite.ANNULEE;
  const isEnRetard = activite.statut === StatutActivite.EN_RETARD;
  const typeLabel =
    typeActiviteLabels[activite.typeActivite as TypeActivite] ??
    activite.typeActivite;

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Retour vers la liste */}
      <div>
        <Link
          href="/mes-taches"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("instructionViewer.mesTaches")}
        </Link>
      </div>

      {/* En-tete activite */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold leading-snug break-words">
              {activite.titre}
            </h2>
            {activite.description && (
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {activite.description}
              </p>
            )}
          </div>

          {/* Statut badge */}
          <div className="shrink-0">
            {isTerminee && (
              <Badge variant="terminee">{t("instructionViewer.statuts.TERMINEE")}</Badge>
            )}
            {isAnnulee && (
              <Badge variant="annulee">{t("instructionViewer.statuts.ANNULEE")}</Badge>
            )}
            {isEnRetard && (
              <Badge variant="default">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {t("instructionViewer.statuts.EN_RETARD")}
              </Badge>
            )}
            {activite.statut === StatutActivite.PLANIFIEE && (
              <Badge variant="en_cours">{t("instructionViewer.statuts.PLANIFIEE")}</Badge>
            )}
          </div>
        </div>

        {/* Meta : type, vague, bac, date */}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">{typeLabel}</span>

          {activite.vague && (
            <span className="rounded-full bg-muted px-2 py-0.5">
              {activite.vague.code}
            </span>
          )}
          {activite.bac && (
            <span className="rounded-full bg-muted px-2 py-0.5">
              {activite.bac.nom}
            </span>
          )}

          {activite.phaseElevage && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              {t(`phases.${activite.phaseElevage as PhaseElevage}`)}
            </span>
          )}

          {activite.isAutoGenerated && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-purple/10 px-2 py-0.5 text-accent-purple">
              <Bot className="h-3 w-3" />
              {t("instructionViewer.badges.auto")}
            </span>
          )}
        </div>

        {/* Date */}
        <p className="mt-2 text-xs text-muted-foreground">
          {new Date(activite.dateDebut).toLocaleDateString(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {/* Conseil IA */}
      {activite.conseilIA && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-start gap-2.5">
            <Info className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-warning mb-1">
                {t("instructionViewer.sections.conseilIA")}
              </p>
              <p className="text-sm text-warning leading-relaxed">
                {activite.conseilIA}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions detaillees (Markdown) */}
      {activite.instructionsDetaillees ? (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-sm font-semibold text-foreground">
              {t("instructionViewer.sections.instructions")}
            </h3>
          </div>
          <InstructionSteps text={activite.instructionsDetaillees} />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              {t("instructionViewer.sections.aucuneInstruction")}
            </p>
          </div>
        </div>
      )}

      {/* Produit recommande */}
      {produitRecommande && activite.produitRecommandeId && (
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-sm font-semibold text-foreground">
              {t("instructionViewer.sections.produitRecommande")}
            </h3>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {produitRecommande.nom}
              </p>
              {activite.quantiteRecommandee != null && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t("instructionViewer.sections.quantiteRecommandee")}{" "}
                  <span className="font-semibold text-foreground">
                    {activite.quantiteRecommandee} {produitRecommande.unite}
                  </span>
                </p>
              )}
              {produitRecommande.stockActuel != null && (
                <p
                  className={[
                    "text-xs mt-1",
                    activite.quantiteRecommandee != null &&
                    produitRecommande.stockActuel < activite.quantiteRecommandee
                      ? "text-danger font-medium"
                      : "text-muted-foreground",
                  ].join(" ")}
                >
                  {t("instructionViewer.sections.stockActuel")} {produitRecommande.stockActuel}{" "}
                  {produitRecommande.unite}
                  {activite.quantiteRecommandee != null &&
                    produitRecommande.stockActuel <
                      activite.quantiteRecommandee && (
                      <span className="ml-1 inline-flex items-center gap-0.5">
                        <AlertTriangle className="h-3 w-3" />
                        {t("instructionViewer.sections.stockInsuffisant")}
                      </span>
                    )}
                </p>
              )}
            </div>

            {/* Lien vers le stock */}
            <Link
              href={`/stock/${produitRecommande.id}`}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/70 transition-colors min-h-[44px]"
            >
              {t("instructionViewer.sections.voirStock")}
            </Link>
          </div>
        </div>
      )}

      {/* Note de completion (si terminee) */}
      {isTerminee && activite.noteCompletion && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-4">
          <p className="text-xs font-semibold text-success mb-1">
            {t("instructionViewer.sections.noteCompletion")}
          </p>
          <p className="text-sm text-success leading-relaxed">
            {activite.noteCompletion}
          </p>
          {activite.dateTerminee && (
            <p className="text-xs text-success/70 mt-1.5">
              {t("instructionViewer.sections.termineeLe")}{" "}
              {new Date(activite.dateTerminee).toLocaleDateString(locale, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      )}

      {/* Bouton "Marquer comme termine" — bien visible, pleine largeur sur mobile */}
      {canComplete && (
        <div className="sticky bottom-4 mt-2">
          <div className="rounded-xl border bg-card p-4 shadow-lg shadow-black/5">
            <p className="text-xs text-muted-foreground mb-3 text-center">
              {t("instructionViewer.sections.questionCompletion")}
            </p>
            {/* Pour les types avec releve : bouton "Terminer avec un releve" en premier */}
            {RELEVE_COMPATIBLE_TYPES.includes(activite.typeActivite as TypeActivite) ? (
              <div className="flex flex-col gap-2">
                {/* R5 : ActiviteComplete utilise Button asChild avec Link */}
                <ActiviteComplete activite={activite} />
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{t("instructionViewer.sections.ou")}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {/* Option secondaire : lier un releve existant */}
                <CompleterActiviteDialog activite={activite} />
              </div>
            ) : (
              <div className="flex justify-center">
                {/* R5 : CompleterActiviteDialog utilise DialogTrigger asChild */}
                <CompleterActiviteDialog activite={activite} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
