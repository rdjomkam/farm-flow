/**
 * Générateur Excel — Prévisions (scénario)
 *
 * Produit un classeur .xlsx multi-feuilles à partir de la projection
 * complète d'un scénario de prévision :
 *   - "Paramètres" : infos scénario + paramètres + aliments + budget
 *   - "Résultat" : total entrées / dépenses / résultat mensuel / solde cumulé
 *   - "Production" : empoissonné / ventes / alevins à commander
 *   - "Aliments" : besoin total / sacs à acheter / sacs par granulométrie
 *   - "Détail Entrées-Dépenses" : revenus, apports, coûts, charges, investissements, épargne
 *
 * DTO : CreatePrevisionExportDTO (src/types/export.ts)
 */

import * as XLSX from "xlsx";
import type {
  CreatePrevisionExportDTO,
  MoisProjectionExportInfo,
} from "@/types/export";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOIS_COURTS_FR = [
  "janv.",
  "fevr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "aout",
  "sept.",
  "oct.",
  "nov.",
  "dec.",
];

/**
 * Libellé de mois calendaire ("nov. 2026") à partir de `dateDebutPlan` +
 * `moisAbsolu` (0 = `dateDebutPlan`). Même règle que `libelleMoisCalendaire`
 * (`src/lib/previsions/tableau-de-bord-helpers.ts`), reprise ici pour ne pas
 * faire dépendre `lib/export/` de `lib/previsions/`.
 */
function moisLabel(dateDebutPlan: Date, moisAbsolu: number): string {
  const date = new Date(
    dateDebutPlan.getFullYear(),
    dateDebutPlan.getMonth() + moisAbsolu,
    1
  );
  return `${MOIS_COURTS_FR[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateFR(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Construit une ligne de tableau [libellé, ...valeurs mensuelles, total]
 * pour une feuille de données. `agregation` détermine comment le total est
 * calculé : "somme" pour un flux (ex. revenus), "dernier" pour un cumulatif
 * (ex. solde cumulé, déjà la valeur de fin d'horizon).
 */
function ligneMensuelle(
  libelle: string,
  mois: MoisProjectionExportInfo[],
  accessor: (m: MoisProjectionExportInfo) => number,
  agregation: "somme" | "dernier" = "somme"
): (string | number)[] {
  const valeurs = mois.map((m) => accessor(m));
  const total =
    agregation === "dernier"
      ? (valeurs[valeurs.length - 1] ?? 0)
      : valeurs.reduce((s, v) => s + v, 0);
  return [libelle, ...valeurs, total];
}

function enTetesMois(mois: MoisProjectionExportInfo[], dateDebutPlan: Date): string[] {
  return ["Indicateur", ...mois.map((m) => moisLabel(dateDebutPlan, m.moisAbsolu)), "TOTAL"];
}

function largeurColonnes(nbMois: number, largeurLabel = 30): XLSX.ColInfo[] {
  return [{ wch: largeurLabel }, ...Array(nbMois).fill({ wch: 12 }), { wch: 14 }];
}

// ---------------------------------------------------------------------------
// Fonction principale
// ---------------------------------------------------------------------------

/**
 * Génère un Buffer Excel (.xlsx) à partir de la projection complète d'un
 * scénario de prévision.
 */
export async function generatePrevisionExcel(
  data: CreatePrevisionExportDTO
): Promise<Buffer> {
  const wb = XLSX.utils.book_new();
  const dateDebutPlan = new Date(data.scenario.dateDebutPlan);
  const mois = data.projection.mois;

  // --- Feuille "Paramètres" ---
  const parametresRows: (string | number)[][] = [
    ["Export Prévisions — FarmFlow"],
    [],
    ["Site", data.siteName],
    ["Scénario", data.scenario.nom],
    ["Code", data.scenario.code],
    ["Statut", data.scenario.statut],
    ["Date de début du plan", formatDateFR(data.scenario.dateDebutPlan)],
    ["Durée de cycle (mois)", data.scenario.dureeCycleMois],
    ["Horizon (mois)", data.projection.horizonMois],
    ["Date d'export", formatDateFR(data.exportDate)],
    [],
    ["Paramètres", "Valeur"],
    ["Effectif alevins / vague", data.parametres.effectifAlevinsParVague],
    ["Marge sécurité alevins (%)", data.parametres.margeSecuriteAlevinsPct],
    ["Poids moyen initial (g)", data.parametres.poidsMoyenInitialG],
    ["Poids objectif (g)", data.parametres.poidsObjectifG],
    ["Prix alevin unitaire (FCFA)", data.parametres.prixAlevinUnitaireFCFA],
    ["Prix vente / kg (FCFA)", data.parametres.prixVenteKgFCFA],
    ["Bacs simultanés cible", data.parametres.nombreBacsSimultanesCible],
    ["Fréquence stockage (mois)", data.parametres.frequenceStockageMois],
    ["Taux épargne (%)", data.parametres.tauxEpargnePct],
    ["Trésorerie initiale (FCFA)", data.parametres.tresorerieInitialeFCFA],
    [],
    ["Granulométries", "", "", ""],
    ["Libellé", "Taille granule", "Poids sac (kg)", "Prix sac (FCFA)"],
    ...data.aliments.map((a) => [a.libelle, a.tailleGranule, a.poidsSacKg, a.prixSacFCFA]),
    [],
    ["Budget total du plan", "Valeur (FCFA)"],
    ["Coûts de production", data.projection.budget.totalCoutsProductionFCFA],
    ["Charges hors production", data.projection.budget.totalChargesHorsProductionFCFA],
    ["Apports", data.projection.budget.totalApportsFCFA],
    ["Budget total", data.projection.budget.budgetTotalFCFA],
  ];
  if (data.projection.pointBas) {
    parametresRows.push(
      [],
      ["Point bas de trésorerie", "Valeur"],
      ["Montant (FCFA)", data.projection.pointBas.pointBasFCFA],
      ["Mois", moisLabel(dateDebutPlan, data.projection.pointBas.moisAbsolu)]
    );
  }
  const wsParametres = XLSX.utils.aoa_to_sheet(parametresRows);
  wsParametres["!cols"] = [{ wch: 26 }, { wch: 20 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsParametres, "Paramètres");

  // --- Feuille "Résultat" ---
  const resultatRows = [
    enTetesMois(mois, dateDebutPlan),
    ligneMensuelle("Total entrées", mois, (m) => m.revenusFCFA + m.apportsFCFA),
    ligneMensuelle("Total dépenses", mois, (m) => m.depensesFCFA),
    ligneMensuelle("Résultat mensuel", mois, (m) => m.resultatFCFA),
    ligneMensuelle("Solde cumulé", mois, (m) => m.soldeFCFA, "dernier"),
  ];
  const wsResultat = XLSX.utils.aoa_to_sheet(resultatRows);
  wsResultat["!cols"] = largeurColonnes(mois.length);
  XLSX.utils.book_append_sheet(wb, wsResultat, "Résultat");

  // --- Feuille "Production" ---
  const productionRows = [
    enTetesMois(mois, dateDebutPlan),
    ligneMensuelle("Empoissonné (kg)", mois, (m) => m.empoissonneKg),
    ligneMensuelle("Ventes (kg)", mois, (m) => m.ventesKg),
    ligneMensuelle("Alevins à commander", mois, (m) => m.alevinsACommanderNb),
  ];
  const wsProduction = XLSX.utils.aoa_to_sheet(productionRows);
  wsProduction["!cols"] = largeurColonnes(mois.length);
  XLSX.utils.book_append_sheet(wb, wsProduction, "Production");

  // --- Feuille "Aliments" ---
  const granulometries = Array.from(
    new Set(mois.flatMap((m) => Object.keys(m.sacsParGranulometrie)))
  ).sort();
  const alimentsRows = [
    enTetesMois(mois, dateDebutPlan),
    ligneMensuelle("Besoin total (kg)", mois, (m) => m.besoinAlimentsTotalKg),
    ligneMensuelle("Sacs à acheter", mois, (m) => m.sacsAlimentsTotal),
    ...granulometries.map((g) =>
      ligneMensuelle(`Sacs ${g}`, mois, (m) => m.sacsParGranulometrie[g] ?? 0)
    ),
  ];
  const wsAliments = XLSX.utils.aoa_to_sheet(alimentsRows);
  wsAliments["!cols"] = largeurColonnes(mois.length);
  XLSX.utils.book_append_sheet(wb, wsAliments, "Aliments");

  // --- Feuille "Détail Entrées-Dépenses" ---
  const detailRows = [
    enTetesMois(mois, dateDebutPlan),
    ligneMensuelle("Revenus", mois, (m) => m.revenusFCFA),
    ligneMensuelle("Apports", mois, (m) => m.apportsFCFA),
    ligneMensuelle("Coût aliments", mois, (m) => m.coutAlimentsFCFA),
    ligneMensuelle("Coût alevins", mois, (m) => m.coutAlevinsFCFA),
    ligneMensuelle("Charges réparties", mois, (m) => m.baseRepartitionFCFA),
    ligneMensuelle("Investissements", mois, (m) => m.investissementsFCFA),
    ligneMensuelle("Épargne conseillée", mois, (m) => m.epargneFCFA),
  ];
  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail["!cols"] = largeurColonnes(mois.length);
  XLSX.utils.book_append_sheet(wb, wsDetail, "Détail Entrées-Dépenses");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
