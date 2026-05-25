/**
 * Template PDF — Coût de Production par Vague
 *
 * Génère un rapport détaillé du coût de production d'une vague :
 * résumé financier, coûts par catégorie, détail alimentation,
 * dépenses directes, dépenses multi-vagues, dépenses récurrentes, ventes.
 *
 * DTO : CreateCoutProductionPDFDTO (src/types/export.ts)
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { CreateCoutProductionPDFDTO } from "@/types/export";
import { StatutVague, CategorieDepense } from "@/types";
import { generatePdfInsights } from "./pdf-cout-production-insights";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatNumPDF(n: number): string {
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return n < 0 ? "-" + formatted : formatted;
}

function formatMontant(n: number): string {
  return formatNumPDF(n) + " FCFA";
}

function formatMontantNullable(n: number | null): string {
  if (n === null) return "—";
  return formatNumPDF(n) + " FCFA";
}

function formatPct(ratio: number): string {
  return (ratio * 100).toFixed(2) + " %";
}

function formatRoi(roi: number | null): string {
  if (roi === null) return "—";
  return roi.toFixed(2) + " %";
}

function labelStatut(statut: StatutVague): string {
  switch (statut) {
    case StatutVague.EN_COURS:
      return "En cours";
    case StatutVague.TERMINEE:
      return "Terminée";
    case StatutVague.ANNULEE:
      return "Annulée";
    default:
      return statut;
  }
}

function labelCategorie(categorie: CategorieDepense | "MULTI_VAGUE"): string {
  switch (categorie) {
    case CategorieDepense.ALIMENT:
      return "Alimentation";
    case CategorieDepense.INTRANT:
      return "Intrants";
    case CategorieDepense.EQUIPEMENT:
      return "Équipements";
    case CategorieDepense.ELECTRICITE:
      return "Électricité";
    case CategorieDepense.EAU:
      return "Eau";
    case CategorieDepense.LOYER:
      return "Loyer";
    case CategorieDepense.SALAIRE:
      return "Salaires";
    case CategorieDepense.TRANSPORT:
      return "Transport";
    case CategorieDepense.VETERINAIRE:
      return "Vétérinaire";
    case CategorieDepense.REPARATION:
      return "Réparation";
    case CategorieDepense.INVESTISSEMENT:
      return "Investissement";
    case CategorieDepense.AUTRE:
      return "Autres";
    case "MULTI_VAGUE":
      return "Coûts partagés";
    default:
      return categorie;
  }
}

// ---------------------------------------------------------------------------
// Couleurs & Styles
// ---------------------------------------------------------------------------

const colors = {
  primary: "#0d9488",
  dark: "#1e293b",
  muted: "#64748b",
  border: "#e2e8f0",
  lightBg: "#f8fafc",
  success: "#16a34a",
  danger: "#dc2626",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: colors.dark,
    backgroundColor: "#ffffff",
    padding: 40,
  },
  // En-tête
  header: {
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    borderBottomStyle: "solid",
  },
  headerFlex: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: colors.muted,
    marginBottom: 1,
  },
  headerMeta: {
    alignItems: "flex-end",
  },
  metaText: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 1,
  },
  statutBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginTop: 4,
  },
  // Section titre
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginBottom: 8,
    marginTop: 18,
  },
  // KPIs / Résumé
  kpisGrid: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  kpiCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: colors.lightBg,
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: {
    fontSize: 7,
    color: colors.muted,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginBottom: 1,
  },
  // Tableau
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: colors.dark,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
  },
  tableCell: {
    fontSize: 8,
  },
  // Formule
  formuleBox: {
    backgroundColor: colors.lightBg,
    borderRadius: 4,
    padding: 10,
  },
  formuleText: {
    fontSize: 8,
    color: colors.dark,
    marginBottom: 3,
  },
  formuleTotal: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginTop: 4,
  },
  // Colonnes — catégories
  colCat: { flex: 3 },
  colCatMontant: { flex: 2, textAlign: "right" },
  colCatPct: { flex: 1, textAlign: "right" },
  colCatKg: { flex: 2, textAlign: "right" },
  // Colonnes — aliments
  colAlProduit: { flex: 3 },
  colAlQte: { flex: 1, textAlign: "right" },
  colAlPrix: { flex: 2, textAlign: "right" },
  colAlTotal: { flex: 2, textAlign: "right" },
  // Colonnes — dépenses directes
  colDepDate: { flex: 2 },
  colDepDesc: { flex: 4 },
  colDepCat: { flex: 2 },
  colDepMontant: { flex: 2, textAlign: "right" },
  // Colonnes — dépenses multi-vagues
  colMvDesc: { flex: 4 },
  colMvTotal: { flex: 2, textAlign: "right" },
  colMvRatio: { flex: 1, textAlign: "right" },
  colMvPart: { flex: 2, textAlign: "right" },
  // Colonnes — dépenses récurrentes
  colRecDesc: { flex: 3 },
  colRecPaye: { flex: 2, textAlign: "right" },
  colRecRatio: { flex: 1, textAlign: "right" },
  colRecPart: { flex: 2, textAlign: "right" },
  colRecMois: { flex: 1, textAlign: "right" },
  // Colonnes — ventes
  colVClient: { flex: 3 },
  colVQte: { flex: 1, textAlign: "right" },
  colVPoids: { flex: 2, textAlign: "right" },
  colVMontant: { flex: 2, textAlign: "right" },
  colVDate: { flex: 2 },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopStyle: "solid",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: colors.muted,
  },
  // Insight block
  insightBox: {
    backgroundColor: "#f0fdfa",
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  insightText: {
    fontSize: 8,
    color: "#115e59",
    lineHeight: 1.5,
    marginBottom: 2,
  },
});

// ---------------------------------------------------------------------------
// InsightBlock — bloc d'analyse contextuelle
// ---------------------------------------------------------------------------

function InsightBlock({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <View style={styles.insightBox} wrap={false}>
      {lines.map((line, i) => (
        <Text key={i} style={styles.insightText}>
          {line}
        </Text>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

// Colonnes — parents imputés
const styles2 = StyleSheet.create({
  colParentVague: { flex: 3 },
  colParentDate: { flex: 2 },
  colParentNb: { flex: 1, textAlign: "right" },
  colParentRatio: { flex: 1, textAlign: "right" },
  colParentCout: { flex: 2, textAlign: "right" },
  colParentImpute: { flex: 2, textAlign: "right" },
  noteBox: {
    backgroundColor: "#fef9c3",
    borderLeftWidth: 3,
    borderLeftColor: "#ca8a04",
    borderRadius: 3,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 8,
    marginTop: 4,
  },
  noteText: {
    fontSize: 8,
    color: "#713f12",
    lineHeight: 1.4,
  },
});

export function CoutProductionPDF({ data }: { data: CreateCoutProductionPDFDTO }) {
  const { coutProduction: cp, site, dateGeneration } = data;
  const { vague, resume, coutParCategorie, detailAliments, depensesDirectes, depensesMultiVagues, depensesRecurrentes, ventes, formule } = cp;
  const coutsParents = cp.coutsParents;
  const cycleComplet = cp.cycleComplet;

  // Generate insights with safe fallback
  let insights: ReturnType<typeof generatePdfInsights>;
  try {
    insights = generatePdfInsights(cp);
  } catch {
    insights = { executive: [], production: [], couts: [], alimentation: [], rentabilite: [], ventes: [] };
  }

  return (
    <Document title="Rapport Coût de Production" author="FarmFlow">
      <Page size="A4" style={styles.page}>

        {/* ===================== EN-TÊTE ===================== */}
        <View style={styles.header}>
          <View style={styles.headerFlex}>
            <View>
              <Text style={styles.title}>COÛT DE PRODUCTION</Text>
              <Text style={styles.subtitle}>{site.name}</Text>
              {site.address && (
                <Text style={styles.subtitle}>{site.address}</Text>
              )}
              <Text style={styles.statutBadge}>
                Vague {vague.code} — {labelStatut(vague.statut)}
              </Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.metaText}>
                Début : {formatDate(vague.dateDebut)}
              </Text>
              {vague.dateFin && (
                <Text style={styles.metaText}>
                  Fin : {formatDate(vague.dateFin)}
                </Text>
              )}
              <Text style={styles.metaText}>
                Durée : {vague.dureeJours} jour{vague.dureeJours > 1 ? "s" : ""}
              </Text>
              <Text style={[styles.metaText, { marginTop: 4 }]}>
                Généré le {formatDate(dateGeneration)}
              </Text>
            </View>
          </View>
        </View>

        {/* ===================== NOTE CYCLE COMPLET ===================== */}
        {coutsParents && coutsParents.coutTotalImpute > 0 && (
          <View style={styles2.noteBox}>
            <Text style={styles2.noteText}>
              Rapport incluant les coûts pré-grossissement imputés des vagues parentes ({coutsParents.details.length} vague{coutsParents.details.length > 1 ? "s" : ""} parente{coutsParents.details.length > 1 ? "s" : ""}). Les KPIs « Cycle complet » intègrent ces coûts additionnels.
            </Text>
          </View>
        )}

        {/* ===================== RÉSUMÉ EXÉCUTIF ===================== */}
        <InsightBlock lines={insights.executive} />

        {/* ===================== RÉSUMÉ ===================== */}
        <Text style={styles.sectionTitle}>Résumé financier</Text>
        <View style={styles.kpisGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Coût total</Text>
            <Text style={[styles.kpiValue, { color: colors.danger }]}>
              {formatMontant(resume.coutTotal)}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Revenus</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {formatMontant(resume.revenus)}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Marge</Text>
            <Text
              style={[
                styles.kpiValue,
                { color: resume.marge >= 0 ? colors.success : colors.danger },
              ]}
            >
              {formatMontant(resume.marge)}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>ROI</Text>
            <Text
              style={[
                styles.kpiValue,
                { color: resume.roi !== null && resume.roi >= 0 ? colors.success : colors.danger },
              ]}
            >
              {formatRoi(resume.roi)}
            </Text>
          </View>
        </View>
        <View style={[styles.kpisGrid, { marginTop: 8 }]}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Coût / kg</Text>
            <Text style={styles.kpiValue}>
              {formatMontantNullable(resume.coutParKg)}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Prix moyen vente / kg</Text>
            <Text style={styles.kpiValue}>
              {formatMontantNullable(resume.prixMoyenVenteKg)}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Marge / kg</Text>
            <Text
              style={[
                styles.kpiValue,
                {
                  color:
                    resume.margeParKg !== null && resume.margeParKg >= 0
                      ? colors.success
                      : colors.danger,
                },
              ]}
            >
              {formatMontantNullable(resume.margeParKg)}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Biomasse estimée</Text>
            <Text style={styles.kpiValue}>
              {resume.biomasseKg !== null ? formatNumPDF(Math.round(resume.biomasseKg * 10) / 10) + " kg" : "—"}
            </Text>
          </View>
        </View>

        {/* KPIs cycle complet (si includeParents) */}
        {cycleComplet && coutsParents && coutsParents.coutTotalImpute > 0 && (
          <View style={[styles.kpisGrid, { marginTop: 8 }]}>
            <View style={[styles.kpiCard, { backgroundColor: "#fef3c7" }]}>
              <Text style={styles.kpiLabel}>Coût total cycle complet</Text>
              <Text style={[styles.kpiValue, { color: colors.danger }]}>
                {formatMontant(cycleComplet.coutTotalCycleComplet)}
              </Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: "#fef3c7" }]}>
              <Text style={styles.kpiLabel}>Marge cycle complet</Text>
              <Text style={[styles.kpiValue, { color: cycleComplet.margesCycleComplet >= 0 ? colors.success : colors.danger }]}>
                {formatMontant(cycleComplet.margesCycleComplet)}
              </Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: "#fef3c7" }]}>
              <Text style={styles.kpiLabel}>ROI cycle complet</Text>
              <Text style={[styles.kpiValue, { color: cycleComplet.roiCycleComplet !== null && cycleComplet.roiCycleComplet >= 0 ? colors.success : colors.danger }]}>
                {formatRoi(cycleComplet.roiCycleComplet)}
              </Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: "#fef3c7" }]}>
              <Text style={styles.kpiLabel}>Coûts pré-gross. imputés</Text>
              <Text style={[styles.kpiValue, { color: colors.muted }]}>
                {formatMontant(coutsParents.coutTotalImpute)}
              </Text>
            </View>
          </View>
        )}

        {/* Insight production */}
        <InsightBlock lines={insights.production} />

        {/* ===================== COÛTS PAR CATÉGORIE ===================== */}
        {coutParCategorie.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Coûts par catégorie</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colCat]}>Catégorie</Text>
              <Text style={[styles.tableHeaderText, styles.colCatMontant]}>Montant</Text>
              <Text style={[styles.tableHeaderText, styles.colCatPct]}>%</Text>
              <Text style={[styles.tableHeaderText, styles.colCatKg]}>Par kg</Text>
            </View>
            {coutParCategorie.map((c, i) => (
              <View
                key={i}
                style={[styles.tableRow]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colCat]}>
                  {labelCategorie(c.categorie)}
                </Text>
                <Text style={[styles.tableCell, styles.colCatMontant, { fontFamily: "Helvetica-Bold" }]}>
                  {formatMontant(c.montant)}
                </Text>
                <Text style={[styles.tableCell, styles.colCatPct]}>
                  {c.pourcentage.toFixed(1)} %
                </Text>
                <Text style={[styles.tableCell, styles.colCatKg]}>
                  {c.parKg !== null ? formatMontant(c.parKg) : "—"}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Insight coûts */}
        {coutParCategorie.length > 0 && <InsightBlock lines={insights.couts} />}

        {/* ===================== COÛTS PRÉ-GROSSISSEMENT IMPUTÉS ===================== */}
        {coutsParents && coutsParents.details.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Coûts pré-grossissement imputés ({coutsParents.details.length} vague{coutsParents.details.length > 1 ? "s" : ""} parente{coutsParents.details.length > 1 ? "s" : ""})
            </Text>
            <Text style={{ fontSize: 7, color: colors.muted, marginBottom: 6 }}>
              ratio = poissons transférés / nombreInitial du parent · coût imputé = (coût parent + coûts amont) × ratio
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles2.colParentVague]}>Vague parente</Text>
              <Text style={[styles.tableHeaderText, styles2.colParentDate]}>Transfert</Text>
              <Text style={[styles.tableHeaderText, styles2.colParentNb]}>Poissons</Text>
              <Text style={[styles.tableHeaderText, styles2.colParentRatio]}>Ratio</Text>
              <Text style={[styles.tableHeaderText, styles2.colParentCout]}>Coût parent</Text>
              <Text style={[styles.tableHeaderText, styles2.colParentImpute]}>Coût imputé</Text>
            </View>
            {coutsParents.details.map((d, i) => (
              <View key={i} style={[styles.tableRow]} wrap={false}>
                <Text style={[styles.tableCell, styles2.colParentVague]}>{d.vagueParentCode}</Text>
                <Text style={[styles.tableCell, styles2.colParentDate]}>{formatDate(d.dateTransfert)}</Text>
                <Text style={[styles.tableCell, styles2.colParentNb]}>{d.nombrePoissons}</Text>
                <Text style={[styles.tableCell, styles2.colParentRatio]}>{(d.ratio * 100).toFixed(1)} %</Text>
                <Text style={[styles.tableCell, styles2.colParentCout]}>{formatMontant(d.parentCoutTotal)}</Text>
                <Text style={[styles.tableCell, styles2.colParentImpute, { fontFamily: "Helvetica-Bold" }]}>
                  {formatMontant(d.coutImpute)}
                </Text>
              </View>
            ))}
            <View style={[styles.tableRow, { backgroundColor: "#fef9c3" }]} wrap={false}>
              <Text style={[styles.tableCell, styles2.colParentVague, { fontFamily: "Helvetica-Bold" }]}>Total imputé</Text>
              <Text style={[styles.tableCell, styles2.colParentDate]} />
              <Text style={[styles.tableCell, styles2.colParentNb]} />
              <Text style={[styles.tableCell, styles2.colParentRatio]} />
              <Text style={[styles.tableCell, styles2.colParentCout]} />
              <Text style={[styles.tableCell, styles2.colParentImpute, { fontFamily: "Helvetica-Bold", color: colors.danger }]}>
                {formatMontant(coutsParents.coutTotalImpute)}
              </Text>
            </View>
          </>
        )}

        {/* ===================== DÉTAIL ALIMENTATION ===================== */}
        {detailAliments.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Détail alimentation ({detailAliments.length} produit{detailAliments.length > 1 ? "s" : ""})
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colAlProduit]}>Produit</Text>
              <Text style={[styles.tableHeaderText, styles.colAlQte]}>Qté</Text>
              <Text style={[styles.tableHeaderText, styles.colAlPrix]}>Prix unit.</Text>
              <Text style={[styles.tableHeaderText, styles.colAlTotal]}>Total</Text>
            </View>
            {detailAliments.map((a, i) => (
              <View
                key={i}
                style={[styles.tableRow]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colAlProduit]}>{a.produit}</Text>
                <Text style={[styles.tableCell, styles.colAlQte]}>{a.quantite}</Text>
                <Text style={[styles.tableCell, styles.colAlPrix]}>
                  {formatMontant(a.prixUnitaire)}
                </Text>
                <Text style={[styles.tableCell, styles.colAlTotal, { fontFamily: "Helvetica-Bold" }]}>
                  {formatMontant(a.total)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Insight alimentation */}
        {detailAliments.length > 0 && <InsightBlock lines={insights.alimentation} />}

        {/* ===================== DÉPENSES DIRECTES ===================== */}
        {depensesDirectes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Dépenses directes ({depensesDirectes.length})
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colDepDate]}>Date</Text>
              <Text style={[styles.tableHeaderText, styles.colDepDesc]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.colDepCat]}>Catégorie</Text>
              <Text style={[styles.tableHeaderText, styles.colDepMontant]}>Montant</Text>
            </View>
            {depensesDirectes.map((d, i) => (
              <View
                key={i}
                style={[styles.tableRow]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colDepDate]}>
                  {formatDate(d.date)}
                </Text>
                <Text style={[styles.tableCell, styles.colDepDesc]}>{d.description}</Text>
                <Text style={[styles.tableCell, styles.colDepCat]}>
                  {labelCategorie(d.categorie)}
                </Text>
                <Text style={[styles.tableCell, styles.colDepMontant, { fontFamily: "Helvetica-Bold" }]}>
                  {formatMontant(d.montant)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* ===================== DÉPENSES MULTI-VAGUES ===================== */}
        {depensesMultiVagues.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Dépenses multi-vagues ({depensesMultiVagues.length})
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colMvDesc]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.colMvTotal]}>Total</Text>
              <Text style={[styles.tableHeaderText, styles.colMvRatio]}>Ratio</Text>
              <Text style={[styles.tableHeaderText, styles.colMvPart]}>Part allouée</Text>
            </View>
            {depensesMultiVagues.map((m, i) => (
              <View
                key={i}
                style={[styles.tableRow]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colMvDesc]}>{m.description}</Text>
                <Text style={[styles.tableCell, styles.colMvTotal]}>
                  {formatMontant(m.montantTotal)}
                </Text>
                <Text style={[styles.tableCell, styles.colMvRatio]}>
                  {formatPct(m.ratio)}
                </Text>
                <Text style={[styles.tableCell, styles.colMvPart, { fontFamily: "Helvetica-Bold" }]}>
                  {formatMontant(m.montantImpute)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* ===================== DÉPENSES RÉCURRENTES ===================== */}
        {depensesRecurrentes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Dépenses récurrentes ({depensesRecurrentes.length})
            </Text>
            <Text style={{ fontSize: 7, color: colors.muted, marginBottom: 6 }}>
              Ratio = (jours × poissons initiaux) / total toutes vagues
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colRecDesc]}>Description</Text>
              <Text style={[styles.tableHeaderText, styles.colRecPaye]}>Payé</Text>
              <Text style={[styles.tableHeaderText, styles.colRecRatio]}>Ratio moy.</Text>
              <Text style={[styles.tableHeaderText, styles.colRecPart]}>Part allouée</Text>
              <Text style={[styles.tableHeaderText, styles.colRecMois]}>Mois</Text>
            </View>
            {depensesRecurrentes.map((r, i) => (
              <View key={i} wrap={false}>
                <View
                  style={[styles.tableRow]}
                >
                  <Text style={[styles.tableCell, styles.colRecDesc]}>{r.description}</Text>
                  <Text style={[styles.tableCell, styles.colRecPaye]}>
                    {formatMontant(r.montantPayeTotal)}
                  </Text>
                  <Text style={[styles.tableCell, styles.colRecRatio]}>
                    {formatPct(r.ratioMoyen)}
                  </Text>
                  <Text style={[styles.tableCell, styles.colRecPart, { fontFamily: "Helvetica-Bold" }]}>
                    {formatMontant(r.montantImpute)}
                  </Text>
                  <Text style={[styles.tableCell, styles.colRecMois]}>
                    {r.moisCouverts}
                  </Text>
                </View>
                {r.ratioDetail.map((rd) => (
                  <View key={rd.mois} style={{ paddingLeft: 12, paddingVertical: 2, paddingRight: 8, backgroundColor: "#ffffff" }}>
                    <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: colors.muted, marginBottom: 1 }}>
                      {rd.mois}
                    </Text>
                    {rd.vagues.map((v) => (
                      <View key={v.code} style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: 6 }}>
                        <Text style={{ fontSize: 7, color: colors.muted }}>{v.code}</Text>
                        <Text style={{ fontSize: 7, color: colors.muted }}>
                          {v.jours}j × {formatNumPDF(v.nombreInitial)} = {formatNumPDF(v.poids)}
                        </Text>
                      </View>
                    ))}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: 6, borderTopWidth: 0.5, borderTopColor: colors.border, borderTopStyle: "solid", marginTop: 1, paddingTop: 1 }}>
                      <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: colors.dark }}>Cette vague</Text>
                      <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: colors.dark }}>
                        {formatNumPDF(rd.poidsCible)} / {formatNumPDF(rd.totalPoids)} = {(rd.ratio * 100).toFixed(1)} %
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* ===================== VENTES ===================== */}
        {ventes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Ventes ({ventes.length})
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colVClient]}>Client</Text>
              <Text style={[styles.tableHeaderText, styles.colVPoids]}>Poids (kg)</Text>
              <Text style={[styles.tableHeaderText, styles.colVMontant]}>Montant</Text>
              <Text style={[styles.tableHeaderText, styles.colVDate]}>Date</Text>
            </View>
            {ventes.map((v, i) => (
              <View
                key={i}
                style={[styles.tableRow]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colVClient]}>{v.client}</Text>
                <Text style={[styles.tableCell, styles.colVPoids]}>
                  {v.poidsKg.toFixed(2)} kg
                </Text>
                <Text style={[styles.tableCell, styles.colVMontant, { fontFamily: "Helvetica-Bold" }]}>
                  {formatMontant(v.montant)}
                </Text>
                <Text style={[styles.tableCell, styles.colVDate]}>
                  {formatDate(v.date)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Insight ventes */}
        {ventes.length > 0 && <InsightBlock lines={insights.ventes} />}

        {/* Insight rentabilité */}
        <InsightBlock lines={insights.rentabilite} />

        {/* ===================== FORMULE ===================== */}
        <Text style={styles.sectionTitle}>Formule de calcul</Text>
        <View style={styles.formuleBox}>
          <Text style={styles.formuleText}>
            Aliments : {formatMontant(formule.coutAliments)}
          </Text>
          <Text style={styles.formuleText}>
            + Dépenses directes : {formatMontant(formule.coutDepensesDirectes)}
          </Text>
          <Text style={styles.formuleText}>
            + Dépenses multi-vagues : {formatMontant(formule.coutMultiVagues)}
          </Text>
          <Text style={styles.formuleText}>
            + Dépenses récurrentes : {formatMontant(formule.coutRecurrents)}
          </Text>
          <Text style={styles.formuleTotal}>
            = Coût total : {formatMontant(formule.coutTotal)}
          </Text>
          {formule.coutParKg !== null && formule.biomasseKg !== null && (
            <Text style={[styles.formuleText, { marginTop: 4 }]}>
              Coût par kg (biomasse estimée : {formatNumPDF(Math.round(formule.biomasseKg * 10) / 10)} kg) : {formatMontant(formule.coutParKg)}
            </Text>
          )}
        </View>

        {/* ===================== FOOTER ===================== */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            FarmFlow — {site.name} — Coût de production — Vague {vague.code}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

/**
 * Génère le buffer PDF pour un rapport de coût de production.
 * Utilise JSX natif (fichier .tsx) pour éviter les problèmes de type avec createElement.
 */
export function renderCoutProductionPDF(data: CreateCoutProductionPDFDTO): Promise<Buffer> {
  return renderToBuffer(<CoutProductionPDF data={data} />);
}
