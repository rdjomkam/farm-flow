/**
 * Template PDF — Rapport de Vague
 *
 * Génère un rapport complet d'une vague de grossissement :
 * KPIs, liste des bacs, tableau des relevés, évolution poids.
 *
 * DTO : CreateRapportVaguePDFDTO (src/types/export.ts)
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { CreateRapportVaguePDFDTO } from "@/types/export";
import { StatutVague, TypeReleve, CategorieDepense } from "@/types";
import { generateRapportVagueInsights } from "./pdf-rapport-vague-insights";
import { generatePdfInsights } from "./pdf-cout-production-insights";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "En cours";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatNum(n: number | null | undefined, decimals = 1, suffix = ""): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(decimals) + (suffix ? ` ${suffix}` : "");
}

function formatFCFA(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(Math.round(n));
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (n < 0 ? "-" : "") + s + " FCFA";
}

function formatMontant(n: number): string {
  const abs = Math.abs(Math.round(n));
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (n < 0 ? "-" : "") + s + " FCFA";
}

function formatMontantNullable(n: number | null): string {
  if (n === null) return "—";
  return formatMontant(n);
}

function formatPct(ratio: number): string {
  return (ratio * 100).toFixed(2) + " %";
}

function labelCategorie(categorie: CategorieDepense | "MULTI_VAGUE"): string {
  switch (categorie) {
    case CategorieDepense.ALIMENT: return "Alimentation";
    case CategorieDepense.INTRANT: return "Intrants";
    case CategorieDepense.EQUIPEMENT: return "Équipements";
    case CategorieDepense.ELECTRICITE: return "Électricité";
    case CategorieDepense.EAU: return "Eau";
    case CategorieDepense.LOYER: return "Loyer";
    case CategorieDepense.SALAIRE: return "Salaires";
    case CategorieDepense.TRANSPORT: return "Transport";
    case CategorieDepense.VETERINAIRE: return "Vétérinaire";
    case CategorieDepense.REPARATION: return "Réparation";
    case CategorieDepense.INVESTISSEMENT: return "Investissement";
    case CategorieDepense.AUTRE: return "Autres";
    case "MULTI_VAGUE": return "Coûts partagés";
    default: return String(categorie);
  }
}

const typeReleveLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biométrie",
  [TypeReleve.MORTALITE]: "Mortalité",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualité eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
  [TypeReleve.RENOUVELLEMENT]: "Renouvellement",
  [TypeReleve.TRI]: "Tri",
  [TypeReleve.VENTE]: "Vente",
};

const statutLabels: Record<StatutVague, string> = {
  [StatutVague.EN_COURS]: "En cours",
  [StatutVague.TERMINEE]: "Terminée",
  [StatutVague.ANNULEE]: "Annulée",
};

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
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: colors.muted,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  statutText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  // Section titre
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginBottom: 8,
    marginTop: 16,
  },
  // KPIs
  kpisGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  kpiCard: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: colors.lightBg,
    borderRadius: 4,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kpiLabel: {
    fontSize: 7,
    color: colors.muted,
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
  },
  kpiUnit: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 1,
  },
  // Bacs
  bacsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  bacChip: {
    backgroundColor: colors.lightBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    minWidth: 100,
  },
  bacNom: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 1,
  },
  bacDetail: {
    fontSize: 8,
    color: colors.muted,
  },
  // Tableau relevés
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 6,
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
  // Stat grid for water quality
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    minWidth: "22%",
    backgroundColor: colors.lightBg,
    borderRadius: 4,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    fontSize: 7,
    color: colors.muted,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  statKey: {
    fontSize: 7,
    color: colors.muted,
  },
  statValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  // Info card (for Gompertz)
  infoCard: {
    backgroundColor: colors.lightBg,
    borderRadius: 4,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid" as const,
  },
  infoLabel: {
    fontSize: 8,
    color: colors.muted,
  },
  infoValue: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  // Empty state
  emptyText: {
    fontSize: 8,
    color: colors.muted,
    fontStyle: "italic",
    marginBottom: 8,
  },
  colDate: { width: 55 },
  colType: { width: 60 },
  colBac: { width: 60 },
  colData: { flex: 1 },
  colNotes: { flex: 1 },
  // Coût de production — catégories
  colCat: { flex: 3 },
  colCatMontant: { flex: 2, textAlign: "right" as const },
  colCatPct: { flex: 1, textAlign: "right" as const },
  colCatKg: { flex: 2, textAlign: "right" as const },
  // Coût de production — aliments
  colAlProduit: { flex: 3 },
  colAlQte: { flex: 1, textAlign: "right" as const },
  colAlPrix: { flex: 2, textAlign: "right" as const },
  colAlTotal: { flex: 2, textAlign: "right" as const },
  // Coût de production — dépenses directes
  colDepDate: { flex: 2 },
  colDepDesc: { flex: 4 },
  colDepCat: { flex: 2 },
  colDepMontant: { flex: 2, textAlign: "right" as const },
  // Coût de production — dépenses multi-vagues
  colMvDesc: { flex: 4 },
  colMvTotal: { flex: 2, textAlign: "right" as const },
  colMvRatio: { flex: 1, textAlign: "right" as const },
  colMvPart: { flex: 2, textAlign: "right" as const },
  // Coût de production — dépenses récurrentes
  colRecDesc: { flex: 3 },
  colRecPaye: { flex: 2, textAlign: "right" as const },
  colRecRatio: { flex: 1, textAlign: "right" as const },
  colRecPart: { flex: 2, textAlign: "right" as const },
  colRecMois: { flex: 1, textAlign: "right" as const },
  // Coût de production — ventes
  colVClient: { flex: 3 },
  colVPoids: { flex: 2, textAlign: "right" as const },
  colVMontant: { flex: 2, textAlign: "right" as const },
  colVDate: { flex: 2 },
  // Formule de calcul
  formuleBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    padding: 10,
  },
  formuleText: {
    fontSize: 8,
    color: "#1e293b",
    marginBottom: 3,
  },
  formuleTotal: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold" as const,
    color: "#0d9488",
    marginTop: 4,
  },
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
// Helpers de données relevés
// ---------------------------------------------------------------------------

function getReleveDataText(r: CreateRapportVaguePDFDTO["releves"][number]): string {
  switch (r.typeReleve) {
    case TypeReleve.BIOMETRIE:
      return [
        r.poidsMoyen !== null && `${r.poidsMoyen}g`,
        r.tailleMoyenne !== null && `${r.tailleMoyenne}cm`,
      ]
        .filter(Boolean)
        .join(" / ") || "—";
    case TypeReleve.MORTALITE:
      return r.nombreMorts !== null
        ? `${r.nombreMorts} morts${r.causeMortalite ? ` (${r.causeMortalite})` : ""}`
        : "—";
    case TypeReleve.ALIMENTATION:
      return r.quantiteAliment !== null ? `${r.quantiteAliment} kg aliment` : "—";
    case TypeReleve.QUALITE_EAU:
      return [
        r.temperature !== null && `${r.temperature}°C`,
        r.ph !== null && `pH ${r.ph}`,
      ]
        .filter(Boolean)
        .join(" / ") || "—";
    case TypeReleve.COMPTAGE:
      return r.nombreCompte !== null ? `${r.nombreCompte} poissons` : "—";
    case TypeReleve.OBSERVATION:
      return r.notes ? r.notes.slice(0, 50) : "—";
    default:
      return "—";
  }
}

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

export function RapportVaguePDF({ data }: { data: CreateRapportVaguePDFDTO }) {
  // Generate insights with safe fallback
  let insights: ReturnType<typeof generateRapportVagueInsights>;
  try {
    insights = generateRapportVagueInsights(data);
  } catch {
    insights = { executive: [], zootechnique: [], croissance: [], mortalite: [], alimentation: [], ventes: [], rentabilite: [] };
  }

  const statutColors: Record<
    StatutVague,
    { bg: string; text: string }
  > = {
    [StatutVague.EN_COURS]: { bg: "#dbeafe", text: "#1d4ed8" },
    [StatutVague.TERMINEE]: { bg: "#dcfce7", text: colors.success },
    [StatutVague.ANNULEE]: { bg: "#fee2e2", text: "#dc2626" },
  };

  const sc = statutColors[data.statut];

  return (
    <Document
      title={`Rapport Vague ${data.code}`}
      author="FarmFlow"
    >
      <Page size="A4" style={styles.page}>
        {/* ===================== EN-TÊTE ===================== */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>RAPPORT DE VAGUE</Text>
              <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: colors.dark }}>
                {data.code}
              </Text>
              <Text style={styles.subtitle}>{data.site.name}</Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.metaText}>
                Début : {formatDate(data.dateDebut)}
              </Text>
              <Text style={styles.metaText}>
                Fin : {data.dateFin ? formatDate(data.dateFin) : "En cours"}
              </Text>
              <Text style={styles.metaText}>
                Effectif initial : {data.nombreInitial} poissons
              </Text>
              <Text style={styles.metaText}>
                Poids initial : {data.poidsMoyenInitial}g/poisson
              </Text>
              {data.origineAlevins && (
                <Text style={styles.metaText}>
                  Origine : {data.origineAlevins}
                </Text>
              )}
              <View style={[styles.statutBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.statutText, { color: sc.text }]}>
                  {statutLabels[data.statut]}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Résumé exécutif */}
        <InsightBlock lines={insights.executive} />

        {/* ===================== KPIs ===================== */}
        <Text style={styles.sectionTitle}>Indicateurs zootechniques</Text>
        <View style={styles.kpisGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Taux de survie</Text>
            <Text style={styles.kpiValue}>
              {formatNum(data.kpis.tauxSurvie, 1, "%")}
            </Text>
            <Text style={styles.kpiUnit}>
              {data.kpis.nombreActuel} poissons actuels
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Biomasse totale</Text>
            <Text style={styles.kpiValue}>
              {data.kpis.biomasseTotale !== null
                ? formatNum(data.kpis.biomasseTotale, 1, "kg")
                : "—"}
            </Text>
            <Text style={styles.kpiUnit}>Estimée</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Poids moyen final</Text>
            <Text style={styles.kpiValue}>
              {data.kpis.poidsMoyenFinal !== null
                ? formatNum(data.kpis.poidsMoyenFinal, 0, "g")
                : "—"}
            </Text>
            <Text style={styles.kpiUnit}>Dernière biométrie</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>
              {data.locale === "en" ? "FCR" : "TCA"}
            </Text>
            <Text style={styles.kpiValue}>
              {data.kpis.fcr !== null
                ? formatNum(data.kpis.fcr, 2)
                : "—"}
            </Text>
            <Text style={styles.kpiUnit}>
              {data.locale === "en" ? "kg feed / kg gain" : "kg aliment / kg gain"}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>
              {data.locale === "en" ? "SGR" : "TCS"}
            </Text>
            <Text style={styles.kpiValue}>
              {data.kpis.sgr !== null
                ? formatNum(data.kpis.sgr, 2, "%/j")
                : "—"}
            </Text>
            <Text style={styles.kpiUnit}>
              {data.locale === "en" ? "Daily growth rate" : "Croissance journalière"}
            </Text>
          </View>
        </View>

        {/* Insight zootechnique */}
        <InsightBlock lines={insights.zootechnique} />

        {/* ===================== COÛT DE PRODUCTION (COMPLET) ===================== */}
        {data.coutProduction && (() => {
          const cp = data.coutProduction!;
          const { resume, coutParCategorie, detailAliments, depensesDirectes, depensesMultiVagues, depensesRecurrentes, ventes, formule } = cp;
          let cpInsights: ReturnType<typeof generatePdfInsights>;
          try { cpInsights = generatePdfInsights(cp); } catch { cpInsights = { executive: [], production: [], couts: [], alimentation: [], rentabilite: [], ventes: [] }; }
          return (
            <>
              <Text style={styles.sectionTitle} break>Coût de production</Text>

              {/* KPIs résumé financier */}
              <View style={styles.kpisGrid}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Coût total</Text>
                  <Text style={[styles.kpiValue, { color: colors.danger }]}>{formatMontant(resume.coutTotal)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Revenus</Text>
                  <Text style={[styles.kpiValue, { color: colors.success }]}>{formatMontant(resume.revenus)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Marge</Text>
                  <Text style={[styles.kpiValue, { color: resume.marge >= 0 ? colors.success : colors.danger }]}>{formatMontant(resume.marge)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>ROI</Text>
                  <Text style={[styles.kpiValue, { color: resume.roi !== null && resume.roi >= 0 ? colors.success : colors.danger }]}>
                    {resume.roi !== null ? resume.roi.toFixed(2) + " %" : "—"}
                  </Text>
                </View>
              </View>
              <View style={[styles.kpisGrid, { marginTop: 6 }]}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Coût / kg</Text>
                  <Text style={styles.kpiValue}>{formatMontantNullable(resume.coutParKg)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Prix moyen vente / kg</Text>
                  <Text style={styles.kpiValue}>{formatMontantNullable(resume.prixMoyenVenteKg)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Marge / kg</Text>
                  <Text style={[styles.kpiValue, { color: resume.margeParKg !== null && resume.margeParKg >= 0 ? colors.success : colors.danger }]}>
                    {formatMontantNullable(resume.margeParKg)}
                  </Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Biomasse estimée</Text>
                  <Text style={styles.kpiValue}>{resume.biomasseKg !== null ? formatNum(resume.biomasseKg, 1, "kg") : "—"}</Text>
                </View>
              </View>

              {/* Insight production */}
              <InsightBlock lines={cpInsights.production} />

              {/* Bilan production */}
              {(resume.biomasseProduite !== null || resume.poidsTotalVendu > 0) && (
                <View style={[styles.kpisGrid, { marginTop: 8 }]}>
                  {resume.biomasseProduite !== null && (
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Biomasse produite</Text>
                      <Text style={styles.kpiValue}>{formatNum(resume.biomasseProduite, 1, "kg")}</Text>
                      <Text style={styles.kpiUnit}>vivante + vendue</Text>
                    </View>
                  )}
                  <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Biomasse vendue</Text>
                    <Text style={styles.kpiValue}>{formatNum(resume.poidsTotalVendu, 1, "kg")}</Text>
                  </View>
                  {resume.biomasseKg !== null && (
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiLabel}>Biomasse vivante</Text>
                      <Text style={styles.kpiValue}>{formatNum(resume.biomasseKg, 1, "kg")}</Text>
                      <Text style={styles.kpiUnit}>restante en bassin</Text>
                    </View>
                  )}
                  <View style={styles.kpiCard}>
                    <Text style={styles.kpiLabel}>Poissons vendus</Text>
                    <Text style={styles.kpiValue}>{resume.nombrePoissonsVendus}</Text>
                  </View>
                </View>
              )}

              {/* Répartition par catégorie */}
              {coutParCategorie.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Coûts par catégorie</Text>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.colCat]}>Catégorie</Text>
                    <Text style={[styles.tableHeaderText, styles.colCatMontant]}>Montant</Text>
                    <Text style={[styles.tableHeaderText, styles.colCatPct]}>%</Text>
                    <Text style={[styles.tableHeaderText, styles.colCatKg]}>Par kg</Text>
                  </View>
                  {coutParCategorie.map((c, i) => (
                    <View key={i} style={styles.tableRow} wrap={false}>
                      <Text style={[styles.tableCell, styles.colCat]}>{labelCategorie(c.categorie)}</Text>
                      <Text style={[styles.tableCell, styles.colCatMontant, { fontFamily: "Helvetica-Bold" }]}>{formatMontant(c.montant)}</Text>
                      <Text style={[styles.tableCell, styles.colCatPct]}>{c.pourcentage.toFixed(1)} %</Text>
                      <Text style={[styles.tableCell, styles.colCatKg]}>{c.parKg !== null ? formatMontant(c.parKg) : "—"}</Text>
                    </View>
                  ))}
                  <InsightBlock lines={cpInsights.couts} />
                </>
              )}

              {/* Détail alimentation */}
              {detailAliments.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 14 }]}>
                    Détail alimentation ({detailAliments.length} produit{detailAliments.length > 1 ? "s" : ""})
                  </Text>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.colAlProduit]}>Produit</Text>
                    <Text style={[styles.tableHeaderText, styles.colAlQte]}>Qté</Text>
                    <Text style={[styles.tableHeaderText, styles.colAlPrix]}>Prix unit.</Text>
                    <Text style={[styles.tableHeaderText, styles.colAlTotal]}>Total</Text>
                  </View>
                  {detailAliments.map((a, i) => (
                    <View key={i} style={styles.tableRow} wrap={false}>
                      <Text style={[styles.tableCell, styles.colAlProduit]}>{a.produit}</Text>
                      <Text style={[styles.tableCell, styles.colAlQte]}>{a.quantite}</Text>
                      <Text style={[styles.tableCell, styles.colAlPrix]}>{formatMontant(a.prixUnitaire)}</Text>
                      <Text style={[styles.tableCell, styles.colAlTotal, { fontFamily: "Helvetica-Bold" }]}>{formatMontant(a.total)}</Text>
                    </View>
                  ))}
                  <InsightBlock lines={cpInsights.alimentation} />
                </>
              )}

              {/* Dépenses directes */}
              {depensesDirectes.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Dépenses directes ({depensesDirectes.length})</Text>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.colDepDate]}>Date</Text>
                    <Text style={[styles.tableHeaderText, styles.colDepDesc]}>Description</Text>
                    <Text style={[styles.tableHeaderText, styles.colDepCat]}>Catégorie</Text>
                    <Text style={[styles.tableHeaderText, styles.colDepMontant]}>Montant</Text>
                  </View>
                  {depensesDirectes.map((d, i) => (
                    <View key={i} style={styles.tableRow} wrap={false}>
                      <Text style={[styles.tableCell, styles.colDepDate]}>{formatDate(d.date)}</Text>
                      <Text style={[styles.tableCell, styles.colDepDesc]}>{d.description}</Text>
                      <Text style={[styles.tableCell, styles.colDepCat]}>{labelCategorie(d.categorie)}</Text>
                      <Text style={[styles.tableCell, styles.colDepMontant, { fontFamily: "Helvetica-Bold" }]}>{formatMontant(d.montant)}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Dépenses multi-vagues */}
              {depensesMultiVagues.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Dépenses multi-vagues ({depensesMultiVagues.length})</Text>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.colMvDesc]}>Description</Text>
                    <Text style={[styles.tableHeaderText, styles.colMvTotal]}>Total</Text>
                    <Text style={[styles.tableHeaderText, styles.colMvRatio]}>Ratio</Text>
                    <Text style={[styles.tableHeaderText, styles.colMvPart]}>Part allouée</Text>
                  </View>
                  {depensesMultiVagues.map((m, i) => (
                    <View key={i} style={styles.tableRow} wrap={false}>
                      <Text style={[styles.tableCell, styles.colMvDesc]}>{m.description}</Text>
                      <Text style={[styles.tableCell, styles.colMvTotal]}>{formatMontant(m.montantTotal)}</Text>
                      <Text style={[styles.tableCell, styles.colMvRatio]}>{formatPct(m.ratio)}</Text>
                      <Text style={[styles.tableCell, styles.colMvPart, { fontFamily: "Helvetica-Bold" }]}>{formatMontant(m.montantImpute)}</Text>
                    </View>
                  ))}
                </>
              )}

              {/* Dépenses récurrentes */}
              {depensesRecurrentes.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Dépenses récurrentes ({depensesRecurrentes.length})</Text>
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
                      <View style={styles.tableRow}>
                        <Text style={[styles.tableCell, styles.colRecDesc]}>{r.description}</Text>
                        <Text style={[styles.tableCell, styles.colRecPaye]}>{formatMontant(r.montantPayeTotal)}</Text>
                        <Text style={[styles.tableCell, styles.colRecRatio]}>{formatPct(r.ratioMoyen)}</Text>
                        <Text style={[styles.tableCell, styles.colRecPart, { fontFamily: "Helvetica-Bold" }]}>{formatMontant(r.montantImpute)}</Text>
                        <Text style={[styles.tableCell, styles.colRecMois]}>{r.moisCouverts}</Text>
                      </View>
                      {r.ratioDetail.map((rd) => (
                        <View key={rd.mois} style={{ paddingLeft: 12, paddingVertical: 2, paddingRight: 8 }}>
                          <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: colors.muted, marginBottom: 1 }}>{rd.mois}</Text>
                          {rd.vagues.map((v) => (
                            <View key={v.code} style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: 6 }}>
                              <Text style={{ fontSize: 7, color: colors.muted }}>{v.code}</Text>
                              <Text style={{ fontSize: 7, color: colors.muted }}>{v.jours}j × {v.nombreInitial} = {v.poids}</Text>
                            </View>
                          ))}
                          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: 6, borderTopWidth: 0.5, borderTopColor: colors.border, borderTopStyle: "solid", marginTop: 1, paddingTop: 1 }}>
                            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: colors.dark }}>Cette vague</Text>
                            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: colors.dark }}>{rd.poidsCible} / {rd.totalPoids} = {(rd.ratio * 100).toFixed(1)} %</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                </>
              )}

              {/* Ventes (depuis le rapport coût de production) */}
              {ventes.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Ventes ({ventes.length})</Text>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.colVClient]}>Client</Text>
                    <Text style={[styles.tableHeaderText, styles.colVPoids]}>Poids (kg)</Text>
                    <Text style={[styles.tableHeaderText, styles.colVMontant]}>Montant</Text>
                    <Text style={[styles.tableHeaderText, styles.colVDate]}>Date</Text>
                  </View>
                  {ventes.map((v, i) => (
                    <View key={i} style={styles.tableRow} wrap={false}>
                      <Text style={[styles.tableCell, styles.colVClient]}>{v.client}</Text>
                      <Text style={[styles.tableCell, styles.colVPoids]}>{v.poidsKg.toFixed(2)} kg</Text>
                      <Text style={[styles.tableCell, styles.colVMontant, { fontFamily: "Helvetica-Bold" }]}>{formatMontant(v.montant)}</Text>
                      <Text style={[styles.tableCell, styles.colVDate]}>{formatDate(v.date)}</Text>
                    </View>
                  ))}
                  <InsightBlock lines={cpInsights.ventes} />
                </>
              )}

              {/* Rentabilité */}
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Rentabilité</Text>
              <View style={styles.kpisGrid}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Coûts totaux</Text>
                  <Text style={[styles.kpiValue, { color: colors.danger }]}>{formatMontant(resume.coutTotal)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Revenus</Text>
                  <Text style={[styles.kpiValue, { color: colors.success }]}>{formatMontant(resume.revenus)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Marge brute</Text>
                  <Text style={[styles.kpiValue, { color: resume.marge >= 0 ? colors.success : colors.danger }]}>{formatMontant(resume.marge)}</Text>
                </View>
              </View>
              <InsightBlock lines={cpInsights.rentabilite} />

              {/* Formule de calcul */}
              <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Formule de calcul</Text>
              <View style={styles.formuleBox}>
                <Text style={styles.formuleText}>Aliments : {formatMontant(formule.coutAliments)}</Text>
                <Text style={styles.formuleText}>+ Dépenses directes : {formatMontant(formule.coutDepensesDirectes)}</Text>
                <Text style={styles.formuleText}>+ Dépenses multi-vagues : {formatMontant(formule.coutMultiVagues)}</Text>
                <Text style={styles.formuleText}>+ Dépenses récurrentes : {formatMontant(formule.coutRecurrents)}</Text>
                <Text style={styles.formuleTotal}>= Coût total : {formatMontant(formule.coutTotal)}</Text>
                {formule.coutParKg !== null && formule.biomasseKg !== null && (
                  <Text style={[styles.formuleText, { marginTop: 4 }]}>
                    Coût par kg (biomasse estimée : {formatNum(formule.biomasseKg, 1, "kg")}) : {formatMontant(formule.coutParKg)}
                  </Text>
                )}
              </View>

              {/* Insight global rentabilité du rapport coût */}
              <InsightBlock lines={cpInsights.executive} />
            </>
          );
        })()}

        {/* Insight rentabilité (rapport vague) */}
        {data.coutProduction && <InsightBlock lines={insights.rentabilite} />}

        {/* ===================== BACS ===================== */}
        {data.bacs.length > 0 && (
          <View wrap={false} break>
            <Text style={styles.sectionTitle}>
              Bacs ({data.bacs.length})
            </Text>
            <View style={styles.bacsRow}>
              {data.bacs.map((bac, i) => (
                <View key={i} style={styles.bacChip}>
                  <Text style={styles.bacNom}>{bac.nom}</Text>
                  <Text style={styles.bacDetail}>
                    {bac.volume} L
                    {bac.nombrePoissons !== null
                      ? ` · ${bac.nombrePoissons} poissons`
                      : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ===================== HISTORIQUE DES BACS ===================== */}
        {data.assignationTimeline && data.assignationTimeline.length > 0 && (
          <View break>
            <Text style={styles.sectionTitle}>Historique des bacs</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: 70 }]}>Bac</Text>
              <Text style={[styles.tableHeaderText, { width: 65 }]}>Assigné le</Text>
              <Text style={[styles.tableHeaderText, { width: 60 }]}>Retiré le</Text>
              <Text style={[styles.tableHeaderText, { width: 50 }]}>Vol. (L)</Text>
              <Text style={[styles.tableHeaderText, { width: 50 }]}>Initial</Text>
              <Text style={[styles.tableHeaderText, { width: 50 }]}>Actuel</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Morts</Text>
            </View>
            {data.assignationTimeline.map((a, i) => (
              <View key={i} style={[styles.tableRow]} wrap={false}>
                <Text style={[styles.tableCell, { width: 70, fontFamily: "Helvetica-Bold" }]}>{a.nomBac}</Text>
                <Text style={[styles.tableCell, { width: 65 }]}>{formatDate(a.dateAssignation)}</Text>
                <Text style={[styles.tableCell, { width: 60 }]}>{a.dateFin ? formatDate(a.dateFin) : "Actif"}</Text>
                <Text style={[styles.tableCell, { width: 50 }]}>{a.volume ?? "—"}</Text>
                <Text style={[styles.tableCell, { width: 50 }]}>{a.nombrePoissons ?? "—"}</Text>
                <Text style={[styles.tableCell, { width: 50 }]}>{a.nombrePoissonsCourant ?? "—"}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{a.mortalites > 0 ? a.mortalites : "—"}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ===================== ÉVOLUTION DU POIDS PAR BAC ===================== */}
        {data.evolutionPoidsTable && data.evolutionPoidsTable.length > 0 && (
          <View break>
            <Text style={styles.sectionTitle}>Évolution du poids par bac</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: 65 }]}>Date</Text>
              <Text style={[styles.tableHeaderText, { width: 35 }]}>Jour</Text>
              <Text style={[styles.tableHeaderText, { width: 65 }]}>Bac</Text>
              <Text style={[styles.tableHeaderText, { width: 60 }]}>Poids (g)</Text>
              <Text style={[styles.tableHeaderText, { width: 60 }]}>Taille (cm)</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Échantillon</Text>
            </View>
            {data.evolutionPoidsTable.map((row, i) => (
              <View key={i} style={[styles.tableRow]} wrap={false}>
                <Text style={[styles.tableCell, { width: 65 }]}>{formatDate(row.date)}</Text>
                <Text style={[styles.tableCell, { width: 35 }]}>J{row.jourDepuisDebut}</Text>
                <Text style={[styles.tableCell, { width: 65 }]}>{row.nomBac}</Text>
                <Text style={[styles.tableCell, { width: 60, fontFamily: "Helvetica-Bold" }]}>{formatNum(row.poidsMoyen, 1)}</Text>
                <Text style={[styles.tableCell, { width: 60 }]}>{formatNum(row.tailleMoyenne, 1)}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{row.echantillon ?? "—"}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ===================== POIDS MOYEN PONDÉRÉ + GOMPERTZ ===================== */}
        {data.evolutionPoidsMoyen && data.evolutionPoidsMoyen.length > 0 && (
          <View break>
            <Text style={styles.sectionTitle}>Poids moyen pondéré (tous bacs)</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: 65 }]}>Date</Text>
              <Text style={[styles.tableHeaderText, { width: 35 }]}>Jour</Text>
              <Text style={[styles.tableHeaderText, { width: 70 }]}>Mesuré (g)</Text>
              {data.gompertz && (
                <>
                  <Text style={[styles.tableHeaderText, { width: 70 }]}>Gompertz (g)</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Écart (g)</Text>
                </>
              )}
              {!data.gompertz && (
                <Text style={[styles.tableHeaderText, { flex: 1 }]}></Text>
              )}
            </View>
            {data.evolutionPoidsMoyen.map((row, i) => (
              <View key={i} style={[styles.tableRow]} wrap={false}>
                <Text style={[styles.tableCell, { width: 65 }]}>{formatDate(row.date)}</Text>
                <Text style={[styles.tableCell, { width: 35 }]}>J{row.jourDepuisDebut}</Text>
                <Text style={[styles.tableCell, { width: 70, fontFamily: "Helvetica-Bold" }]}>{formatNum(row.poidsMoyenMesure, 1)}</Text>
                {data.gompertz && (
                  <>
                    <Text style={[styles.tableCell, { width: 70 }]}>{formatNum(row.poidsPreditGompertz, 1)}</Text>
                    <Text style={[styles.tableCell, { flex: 1, color: row.ecart !== null && row.ecart < 0 ? "#dc2626" : "#16a34a" }]}>
                      {row.ecart !== null ? (row.ecart >= 0 ? "+" : "") + formatNum(row.ecart, 1) : "—"}
                    </Text>
                  </>
                )}
                {!data.gompertz && (
                  <Text style={[styles.tableCell, { flex: 1 }]}></Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Insight croissance */}
        <InsightBlock lines={insights.croissance} />

        {/* ===================== MODÈLE DE CROISSANCE (GOMPERTZ) ===================== */}
        {data.gompertz && (
          <View wrap={false} break>
            <Text style={styles.sectionTitle}>Modèle de croissance (Gompertz)</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Confiance</Text>
                <Text style={styles.infoValue}>{data.gompertz.confidenceLevel}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>R²</Text>
                <Text style={styles.infoValue}>{formatNum(data.gompertz.r2, 4)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>RMSE</Text>
                <Text style={styles.infoValue}>{formatNum(data.gompertz.rmse, 2, "g")}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Poids asymptotique (W∞)</Text>
                <Text style={styles.infoValue}>{formatNum(data.gompertz.wInfinity, 0, "g")}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Taux de croissance (k)</Text>
                <Text style={styles.infoValue}>{formatNum(data.gompertz.k, 4)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Point d&apos;inflexion (ti)</Text>
                <Text style={styles.infoValue}>J{formatNum(data.gompertz.ti, 0)}</Text>
              </View>
              {data.gompertz.targetWeight && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Poids cible</Text>
                  <Text style={styles.infoValue}>{formatNum(data.gompertz.targetWeight, 0, "g")}</Text>
                </View>
              )}
              {data.gompertz.predictedHarvestDate && (
                <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.infoLabel}>Date de récolte prédite</Text>
                  <Text style={[styles.infoValue, { color: colors.primary }]}>{data.gompertz.predictedHarvestDate}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ===================== CALIBRAGES ===================== */}
        {data.calibrageHistory && data.calibrageHistory.length > 0 && (
          <View break>
            <Text style={styles.sectionTitle}>Calibrages ({data.calibrageHistory.length})</Text>
            {data.calibrageHistory.map((cal, ci) => (
              <View key={ci} style={[styles.infoCard, { marginBottom: 6 }]} wrap={false}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{formatDate(cal.date)}</Text>
                  <Text style={{ fontSize: 8, color: colors.muted }}>{cal.totalRedistribue} poissons redistribués{cal.nombreMorts > 0 ? ` · ${cal.nombreMorts} morts` : ""}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                  {cal.groupes.map((g, gi) => (
                    <View key={gi} style={[styles.bacChip, { minWidth: 80 }]}>
                      <Text style={styles.bacNom}>{g.categorie}</Text>
                      <Text style={styles.bacDetail}>{g.nombrePoissons} poissons{g.poidsMoyen ? ` · ${g.poidsMoyen}g` : ""}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ===================== RÉSUMÉ MORTALITÉ ===================== */}
        {data.mortalitySummary && (
          <View wrap={false} break>
            <Text style={styles.sectionTitle}>Résumé mortalité</Text>
            <View style={styles.kpisGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total morts</Text>
                <Text style={styles.kpiValue}>{data.mortalitySummary.totalMorts}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Taux de mortalité</Text>
                <Text style={styles.kpiValue}>{formatNum(data.mortalitySummary.tauxMortalite, 1, "%")}</Text>
              </View>
            </View>
            {data.mortalitySummary.topCauses.length > 0 && (
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Cause</Text>
                  <Text style={[styles.tableHeaderText, { width: 60 }]}>Nombre</Text>
                </View>
                {data.mortalitySummary.topCauses.map((c, i) => (
                  <View key={i} style={[styles.tableRow]} wrap={false}>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{c.cause}</Text>
                    <Text style={[styles.tableCell, { width: 60 }]}>{c.count}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Insight mortalité */}
        {data.mortalitySummary && <InsightBlock lines={insights.mortalite} />}

        {/* Insight ventes (rapport vague) — visible si pas de section coût de production */}
        {!data.coutProduction && data.salesSummary && <InsightBlock lines={insights.ventes} />}

        {/* ===================== RÉSUMÉ ALIMENTATION ===================== */}
        {data.feedingSummary && (
          <View wrap={false} break>
            <Text style={styles.sectionTitle}>Résumé alimentation</Text>
            <View style={styles.kpisGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total aliment</Text>
                <Text style={styles.kpiValue}>{formatNum(data.feedingSummary.totalAlimentKg, 1, "kg")}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Fréquence moyenne</Text>
                <Text style={styles.kpiValue}>{data.feedingSummary.frequenceMoyenne !== null ? `${formatNum(data.feedingSummary.frequenceMoyenne, 1)}x/jour` : "—"}</Text>
              </View>
            </View>
            {data.feedingSummary.typeBreakdown.length > 0 && (
              <View>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Type</Text>
                  <Text style={[styles.tableHeaderText, { width: 60 }]}>Relevés</Text>
                  <Text style={[styles.tableHeaderText, { width: 70 }]}>Total (kg)</Text>
                </View>
                {data.feedingSummary.typeBreakdown.map((t, i) => (
                  <View key={i} style={[styles.tableRow]} wrap={false}>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{t.type}</Text>
                    <Text style={[styles.tableCell, { width: 60 }]}>{t.count}</Text>
                    <Text style={[styles.tableCell, { width: 70 }]}>{formatNum(t.totalKg, 1)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Insight alimentation */}
        {data.feedingSummary && <InsightBlock lines={insights.alimentation} />}

        {/* ===================== RÉSUMÉ QUALITÉ EAU ===================== */}
        {data.waterQualitySummary && (data.waterQualitySummary.temperature || data.waterQualitySummary.ph || data.waterQualitySummary.oxygene || data.waterQualitySummary.ammoniac) && (
          <View wrap={false} break>
            <Text style={styles.sectionTitle}>Résumé qualité eau</Text>
            <View style={styles.statGrid}>
              {data.waterQualitySummary.temperature && (
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Température (°C)</Text>
                  <View style={styles.statRow}><Text style={styles.statKey}>Min</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.temperature.min, 1)}</Text></View>
                  <View style={styles.statRow}><Text style={styles.statKey}>Moy</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.temperature.avg, 1)}</Text></View>
                  <View style={styles.statRow}><Text style={styles.statKey}>Max</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.temperature.max, 1)}</Text></View>
                </View>
              )}
              {data.waterQualitySummary.ph && (
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>pH</Text>
                  <View style={styles.statRow}><Text style={styles.statKey}>Min</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.ph.min, 1)}</Text></View>
                  <View style={styles.statRow}><Text style={styles.statKey}>Moy</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.ph.avg, 1)}</Text></View>
                  <View style={styles.statRow}><Text style={styles.statKey}>Max</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.ph.max, 1)}</Text></View>
                </View>
              )}
              {data.waterQualitySummary.oxygene && (
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Oxygène (mg/L)</Text>
                  <View style={styles.statRow}><Text style={styles.statKey}>Min</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.oxygene.min, 1)}</Text></View>
                  <View style={styles.statRow}><Text style={styles.statKey}>Moy</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.oxygene.avg, 1)}</Text></View>
                  <View style={styles.statRow}><Text style={styles.statKey}>Max</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.oxygene.max, 1)}</Text></View>
                </View>
              )}
              {data.waterQualitySummary.ammoniac && (
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Ammoniac (mg/L)</Text>
                  <View style={styles.statRow}><Text style={styles.statKey}>Min</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.ammoniac.min, 2)}</Text></View>
                  <View style={styles.statRow}><Text style={styles.statKey}>Moy</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.ammoniac.avg, 2)}</Text></View>
                  <View style={styles.statRow}><Text style={styles.statKey}>Max</Text><Text style={styles.statValue}>{formatNum(data.waterQualitySummary.ammoniac.max, 2)}</Text></View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ===================== CONSOMMATION DE STOCK ===================== */}
        {data.stockConsumption && data.stockConsumption.length > 0 && (
          <View break>
            <Text style={styles.sectionTitle}>Consommation de stock</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Produit</Text>
              <Text style={[styles.tableHeaderText, { width: 70 }]}>Catégorie</Text>
              <Text style={[styles.tableHeaderText, { width: 60 }]}>Quantité</Text>
              <Text style={[styles.tableHeaderText, { width: 50 }]}>Unité</Text>
              {data.coutProduction && (
                <Text style={[styles.tableHeaderText, { width: 80 }]}>Coût</Text>
              )}
            </View>
            {data.stockConsumption.map((s, i) => (
              <View key={i} style={[styles.tableRow]} wrap={false}>
                <Text style={[styles.tableCell, { flex: 1, fontFamily: "Helvetica-Bold" }]}>{s.nomProduit}</Text>
                <Text style={[styles.tableCell, { width: 70 }]}>{s.categorie}</Text>
                <Text style={[styles.tableCell, { width: 60 }]}>{formatNum(s.quantite, 1)}</Text>
                <Text style={[styles.tableCell, { width: 50 }]}>{s.unite}</Text>
                {data.coutProduction && (
                  <Text style={[styles.tableCell, { width: 80 }]}>{formatFCFA(s.prixTotal)}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* ===================== RELEVÉS ===================== */}
        {data.releves.length > 0 && (
          <View break>
            <Text style={styles.sectionTitle}>
              Relevés ({data.releves.length})
            </Text>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colDate]}>Date</Text>
              <Text style={[styles.tableHeaderText, styles.colType]}>Type</Text>
              <Text style={[styles.tableHeaderText, styles.colBac]}>Bac</Text>
              <Text style={[styles.tableHeaderText, styles.colData]}>Données</Text>
              <Text style={[styles.tableHeaderText, styles.colNotes]}>Notes</Text>
            </View>
            {data.releves.map((r, i) => (
              <View
                key={i}
                style={styles.tableRow}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colDate]}>
                  {formatDate(r.date)}
                </Text>
                <Text style={[styles.tableCell, styles.colType]}>
                  {typeReleveLabels[r.typeReleve]}
                </Text>
                <Text style={[styles.tableCell, styles.colBac]}>
                  {r.nomBac}
                </Text>
                <Text style={[styles.tableCell, styles.colData]}>
                  {getReleveDataText(r)}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.colNotes,
                    { color: colors.muted },
                  ]}
                >
                  {r.notes ? r.notes.slice(0, 120) : "—"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ===================== FOOTER ===================== */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            FarmFlow — {data.site.name} — Vague {data.code}
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
 * Génère le buffer PDF pour un rapport de vague.
 * Utilise JSX natif (fichier .tsx) pour éviter les problèmes de type avec createElement.
 */
export function renderRapportVaguePDF(data: CreateRapportVaguePDFDTO): Promise<Buffer> {
  return renderToBuffer(<RapportVaguePDF data={data} />);
}
