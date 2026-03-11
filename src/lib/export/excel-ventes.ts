/**
 * Générateur Excel — Ventes
 *
 * Produit un fichier .xlsx avec une feuille "Ventes" contenant
 * toutes les ventes filtrées selon les paramètres fournis.
 *
 * DTO : ExportVentesExcelDTO (src/types/export.ts)
 */

import * as XLSX from "xlsx";
import type { ExportVentesExcelDTO, VenteExcelRow } from "@/types/export";
import { StatutFacture } from "@/types";

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

const statutFactureLabels: Record<StatutFacture, string> = {
  [StatutFacture.BROUILLON]: "Brouillon",
  [StatutFacture.ENVOYEE]: "Envoyée",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "Payée partiellement",
  [StatutFacture.PAYEE]: "Payée",
  [StatutFacture.ANNULEE]: "Annulée",
};

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/**
 * Génère un Buffer Excel à partir des données de ventes.
 *
 * @param data - DTO contenant les filtres et les lignes de données
 * @returns Buffer prêt à être envoyé en réponse HTTP
 */
export function genererExcelVentes(data: ExportVentesExcelDTO): Buffer {
  const wb = XLSX.utils.book_new();

  // --- En-têtes ---
  const headers = [
    "N° Vente",
    "Date",
    "Client",
    "Vague",
    "Qté Poissons",
    "Poids Total (kg)",
    "Prix/kg (FCFA)",
    "Montant Total (FCFA)",
    "Statut Facture",
    "Notes",
  ];

  // --- Lignes ---
  const rows = data.rows.map((r: VenteExcelRow) => [
    r.numero,
    formatDateFR(r.date),
    r.nomClient,
    r.codeVague,
    r.quantitePoissons,
    r.poidsTotalKg,
    r.prixUnitaireKg,
    r.montantTotal,
    r.statutFacture
      ? (statutFactureLabels[r.statutFacture] ?? r.statutFacture)
      : "Non facturé",
    r.notes ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // --- Largeurs de colonnes ---
  ws["!cols"] = [
    { wch: 16 }, // N° Vente
    { wch: 12 }, // Date
    { wch: 22 }, // Client
    { wch: 14 }, // Vague
    { wch: 13 }, // Qté Poissons
    { wch: 16 }, // Poids Total
    { wch: 15 }, // Prix/kg
    { wch: 20 }, // Montant Total
    { wch: 20 }, // Statut Facture
    { wch: 30 }, // Notes
  ];

  ws["!autofilter"] = { ref: "A1:J1" };

  XLSX.utils.book_append_sheet(wb, ws, "Ventes");

  // --- Feuille résumé ---
  const totalMontant = data.rows.reduce((sum, r) => sum + r.montantTotal, 0);
  const totalPoidsKg = data.rows.reduce((sum, r) => sum + r.poidsTotalKg, 0);
  const totalPoissons = data.rows.reduce((sum, r) => sum + r.quantitePoissons, 0);
  const prixMoyenKg =
    totalPoidsKg > 0
      ? Math.round(totalMontant / totalPoidsKg)
      : 0;

  const ventesParStatut = Object.values(StatutFacture).map((s) => {
    const count = data.rows.filter((r) => r.statutFacture === s).length;
    return [statutFactureLabels[s], count];
  });

  const resumeWs = XLSX.utils.aoa_to_sheet([
    ["Résumé — Ventes"],
    [],
    ["Export FarmFlow", formatDateFR(new Date())],
    ["Période du", formatDateFR(data.dateDebut)],
    ["Période au", formatDateFR(data.dateFin)],
    [],
    ["Indicateurs", "Valeur"],
    ["Nombre de ventes", data.rows.length],
    ["Poissons vendus", totalPoissons],
    ["Poids total (kg)", totalPoidsKg.toFixed(1)],
    ["Montant total (FCFA)", totalMontant],
    ["Prix moyen /kg (FCFA)", prixMoyenKg],
    [],
    ["Statut facture", "Nb ventes"],
    ...ventesParStatut,
    [
      "Non facturé",
      data.rows.filter((r) => !r.statutFacture).length,
    ],
  ]);

  resumeWs["!cols"] = [{ wch: 24 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, resumeWs, "Résumé");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
