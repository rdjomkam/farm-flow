/**
 * Générateur Excel — Relevés de vague
 *
 * Produit un fichier .xlsx avec une feuille "Relevés" contenant
 * tous les relevés filtrés selon les paramètres fournis.
 *
 * DTO : ExportRelevesExcelDTO (src/types/export.ts)
 */

import * as XLSX from "xlsx";
import type { ExportRelevesExcelDTO, ReleveExcelRow } from "@/types/export";
import { TypeReleve } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateFR(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const typeReleveLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "BIOMETRIE",
  [TypeReleve.MORTALITE]: "MORTALITE",
  [TypeReleve.ALIMENTATION]: "ALIMENTATION",
  [TypeReleve.QUALITE_EAU]: "QUALITE_EAU",
  [TypeReleve.COMPTAGE]: "COMPTAGE",
  [TypeReleve.OBSERVATION]: "OBSERVATION",
};

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/**
 * Génère un Buffer Excel à partir des données de relevés.
 *
 * @param data - DTO contenant les filtres et les lignes de données
 * @returns Buffer prêt à être envoyé en réponse HTTP
 */
export function genererExcelReleves(data: ExportRelevesExcelDTO): Buffer {
  const wb = XLSX.utils.book_new();

  // --- En-têtes ---
  const headers = [
    "Date",
    "Type",
    "Vague",
    "Bac",
    // Biométrie
    "Poids Moyen (g)",
    "Taille Moyenne (cm)",
    "Echantillon",
    // Mortalité
    "Nbr Morts",
    "Cause Mortalité",
    // Alimentation
    "Qté Aliment (kg)",
    "Type Aliment",
    "Fréquence/Jour",
    // Qualité eau
    "Température (°C)",
    "pH",
    "O2 (mg/L)",
    "NH3 (mg/L)",
    // Comptage
    "Nbr Compté",
    "Méthode Comptage",
    // Observation
    "Description",
    // Commun
    "Notes",
  ];

  // --- Lignes ---
  const rows = data.rows.map((r: ReleveExcelRow) => [
    formatDateFR(r.date),
    typeReleveLabels[r.typeReleve] ?? r.typeReleve,
    r.codeVague,
    r.nomBac,
    // Biométrie
    r.poidsMoyen ?? "",
    r.tailleMoyenne ?? "",
    r.echantillonCount ?? "",
    // Mortalité
    r.nombreMorts ?? "",
    r.causeMortalite ?? "",
    // Alimentation
    r.quantiteAliment ?? "",
    r.typeAliment ?? "",
    r.frequenceAliment ?? "",
    // Qualité eau
    r.temperature ?? "",
    r.ph ?? "",
    r.oxygene ?? "",
    r.ammoniac ?? "",
    // Comptage
    r.nombreCompte ?? "",
    r.methodeComptage ?? "",
    // Observation
    r.description ?? "",
    // Commun
    r.notes ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // --- Largeurs de colonnes ---
  ws["!cols"] = [
    { wch: 12 }, // Date
    { wch: 14 }, // Type
    { wch: 14 }, // Vague
    { wch: 12 }, // Bac
    { wch: 14 }, // Poids Moyen
    { wch: 16 }, // Taille Moyenne
    { wch: 11 }, // Echantillon
    { wch: 10 }, // Nbr Morts
    { wch: 18 }, // Cause Mortalité
    { wch: 14 }, // Qté Aliment
    { wch: 14 }, // Type Aliment
    { wch: 12 }, // Fréquence
    { wch: 14 }, // Température
    { wch: 8 },  // pH
    { wch: 10 }, // O2
    { wch: 10 }, // NH3
    { wch: 10 }, // Nbr Compté
    { wch: 16 }, // Méthode
    { wch: 30 }, // Description
    { wch: 30 }, // Notes
  ];

  // --- Métadonnées ---
  ws["!autofilter"] = { ref: `A1:T1` };

  XLSX.utils.book_append_sheet(wb, ws, "Relevés");

  // --- Feuille infos ---
  const infoWs = XLSX.utils.aoa_to_sheet([
    ["Export Relevés — FarmFlow"],
    ["Exporté le", formatDateFR(new Date())],
    ["Période du", formatDateFR(data.dateDebut)],
    ["Période au", formatDateFR(data.dateFin)],
    ["Vague", data.vagueId ?? "Toutes"],
    ["Type de relevé", data.typeReleve ?? "Tous"],
    ["Total lignes", data.rows.length],
  ]);
  XLSX.utils.book_append_sheet(wb, infoWs, "Informations");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
