"use client";

/**
 * ActiviteComplete — Bouton "Terminer avec un releve" pour les activites
 * dont le type correspond a un type de releve (ALIMENTATION, BIOMETRIE,
 * QUALITE_EAU, COMPTAGE).
 *
 * Redirige vers /releves/nouveau avec les query params pre-remplis :
 * - activiteId : ID de l'activite
 * - vagueId    : ID de la vague liee a l'activite
 * - bacId      : ID du bac lie (si disponible)
 * - typeReleve : type de releve correspondant au typeActivite
 *
 * R2 : enums importes depuis @/types
 * R5 : pas de Dialog ici — lien direct vers le formulaire
 * R6 : CSS variables du theme
 */

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypeActivite, StatutActivite, TypeReleve } from "@/types";
import { ACTIVITE_RELEVE_TYPE_MAP, RELEVE_COMPATIBLE_TYPES } from "@/types/api";
import type { ActiviteWithRelations } from "@/types";

// ---------------------------------------------------------------------------
// Labels des types de releve pour l'affichage
// R2 : clés issues de l'enum TypeReleve — jamais de string literals
// ---------------------------------------------------------------------------

const typeReleveLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biometrie",
  [TypeReleve.MORTALITE]: "Mortalite",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualite eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActiviteCompleteProps {
  activite: ActiviteWithRelations;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

/**
 * Bouton "Terminer avec un releve" — visible uniquement si :
 * 1. L'activite est PLANIFIEE ou EN_RETARD
 * 2. Le typeActivite a un mapping vers un TypeReleve (ACTIVITE_RELEVE_TYPE_MAP)
 *
 * En cliquant, l'utilisateur est redirige vers /releves/nouveau avec les
 * params pre-remplis (activiteId, vagueId, bacId, typeReleve).
 * Le formulaire de releve lie ensuite automatiquement le releve a l'activite.
 */
export function ActiviteComplete({ activite }: ActiviteCompleteProps) {
  const isActionable =
    activite.statut === StatutActivite.PLANIFIEE ||
    activite.statut === StatutActivite.EN_RETARD;

  const isReleveCompatible = RELEVE_COMPATIBLE_TYPES.includes(
    activite.typeActivite as TypeActivite
  );

  const mappedReleveType =
    ACTIVITE_RELEVE_TYPE_MAP[activite.typeActivite as TypeActivite];

  // N'afficher le bouton que si toutes les conditions sont reunies
  if (!isActionable || !isReleveCompatible || !mappedReleveType) {
    return null;
  }

  // Construire l'URL de redirection vers le formulaire de releve pre-rempli
  const params = new URLSearchParams();
  params.set("activiteId", activite.id);
  if (activite.vagueId) params.set("vagueId", activite.vagueId);
  if (activite.bacId) params.set("bacId", activite.bacId);
  params.set("typeReleve", mappedReleveType);

  const href = `/releves/nouveau?${params.toString()}`;
  const releveLabel = typeReleveLabels[mappedReleveType] ?? mappedReleveType;

  return (
    <Button asChild size="sm" className="gap-1.5 w-full sm:w-auto">
      <Link href={href}>
        <ClipboardCheck className="h-3.5 w-3.5" />
        Terminer avec un releve ({releveLabel})
      </Link>
    </Button>
  );
}
