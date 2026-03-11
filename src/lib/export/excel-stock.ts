/**
 * Générateur Excel — Mouvements de Stock
 *
 * Produit un fichier .xlsx avec une feuille "Mouvements Stock"
 * contenant tous les mouvements filtrés selon les paramètres.
 *
 * DTO : ExportStockExcelDTO (src/types/export.ts)
 */

import * as XLSX from "xlsx";
import type { ExportStockExcelDTO, MouvementExcelRow } from "@/types/export";
import { CategorieProduit, TypeMouvement, UniteStock } from "@/types";

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

const categorieLabels: Record<CategorieProduit, string> = {
  [CategorieProduit.ALIMENT]: "Aliment",
  [CategorieProduit.INTRANT]: "Intrant",
  [CategorieProduit.EQUIPEMENT]: "Équipement",
};

const typeMouvLabels: Record<TypeMouvement, string> = {
  [TypeMouvement.ENTREE]: "ENTRÉE",
  [TypeMouvement.SORTIE]: "SORTIE",
};

const uniteLabels: Record<UniteStock, string> = {
  [UniteStock.KG]: "kg",
  [UniteStock.LITRE]: "litre",
  [UniteStock.UNITE]: "unité",
  [UniteStock.SACS]: "sacs",
};

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/**
 * Génère un Buffer Excel à partir des données de mouvements de stock.
 *
 * @param data - DTO contenant les filtres et les lignes de données
 * @returns Buffer prêt à être envoyé en réponse HTTP
 */
export function genererExcelStock(data: ExportStockExcelDTO): Buffer {
  const wb = XLSX.utils.book_new();

  // --- En-têtes ---
  const headers = [
    "Date",
    "Produit",
    "Catégorie",
    "Type",
    "Quantité",
    "Unité",
    "Prix Total (FCFA)",
    "Vague",
    "N° Commande",
    "Notes",
  ];

  // --- Lignes ---
  const rows = data.rows.map((r: MouvementExcelRow) => [
    formatDateFR(r.date),
    r.nomProduit,
    categorieLabels[r.categorieProduit] ?? r.categorieProduit,
    typeMouvLabels[r.type] ?? r.type,
    r.quantite,
    uniteLabels[r.unite] ?? r.unite,
    r.prixTotal ?? "",
    r.codeVague ?? "",
    r.numeroCommande ?? "",
    r.notes ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // --- Largeurs de colonnes ---
  ws["!cols"] = [
    { wch: 12 }, // Date
    { wch: 22 }, // Produit
    { wch: 12 }, // Catégorie
    { wch: 10 }, // Type
    { wch: 10 }, // Quantité
    { wch: 8 },  // Unité
    { wch: 18 }, // Prix Total
    { wch: 14 }, // Vague
    { wch: 16 }, // N° Commande
    { wch: 30 }, // Notes
  ];

  ws["!autofilter"] = { ref: "A1:J1" };

  XLSX.utils.book_append_sheet(wb, ws, "Mouvements Stock");

  // --- Feuille résumé par type ---
  const totalEntrees = data.rows
    .filter((r) => r.type === TypeMouvement.ENTREE)
    .reduce((sum, r) => sum + (r.prixTotal ?? 0), 0);
  const totalSorties = data.rows
    .filter((r) => r.type === TypeMouvement.SORTIE)
    .reduce((sum, r) => sum + (r.prixTotal ?? 0), 0);

  const resumeWs = XLSX.utils.aoa_to_sheet([
    ["Résumé — Mouvements de stock"],
    [],
    ["Export FarmFlow", formatDateFR(new Date())],
    ["Période du", formatDateFR(data.dateDebut)],
    ["Période au", formatDateFR(data.dateFin)],
    [],
    ["", "Nb mouvements", "Valeur totale (FCFA)"],
    [
      "Entrées",
      data.rows.filter((r) => r.type === TypeMouvement.ENTREE).length,
      totalEntrees,
    ],
    [
      "Sorties",
      data.rows.filter((r) => r.type === TypeMouvement.SORTIE).length,
      totalSorties,
    ],
    ["Total", data.rows.length, totalEntrees + totalSorties],
  ]);

  resumeWs["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, resumeWs, "Résumé");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
