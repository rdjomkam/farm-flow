/**
 * Labels partagés pour les types d'activite.
 *
 * Source unique de vérité — importé par activite-card.tsx et instruction-viewer.tsx.
 * R2 : clés issues de l'enum TypeActivite, jamais de string literals.
 */

import { TypeActivite } from "@/types";

export const typeActiviteLabels: Record<TypeActivite, string> = {
  [TypeActivite.ALIMENTATION]: "Alimentation",
  [TypeActivite.BIOMETRIE]: "Biometrie",
  [TypeActivite.QUALITE_EAU]: "Qualite eau",
  [TypeActivite.COMPTAGE]: "Comptage",
  [TypeActivite.NETTOYAGE]: "Nettoyage",
  [TypeActivite.TRAITEMENT]: "Traitement",
  [TypeActivite.RECOLTE]: "Recolte",
  [TypeActivite.TRI]: "Tri",
  [TypeActivite.MEDICATION]: "Medication",
  [TypeActivite.AUTRE]: "Autre",
};
