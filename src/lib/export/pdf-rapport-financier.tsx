/**
 * Template PDF — Rapport Financier
 *
 * Sections : KPIs, Détail des coûts, Dépenses (paiement),
 * Ventes par vague, Créances clients, Top clients, Évolution mensuelle.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { CreateRapportFinancierPDFDTO } from "@/types/export";

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

function fmtNum(n: number): string {
  const s = Math.round(n).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatMontant(n: number): string {
  return fmtNum(n) + " FCFA";
}

function formatPct(n: number): string {
  return n.toFixed(1) + " %";
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
  warning: "#d97706",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: colors.dark,
    backgroundColor: "#ffffff",
    padding: 40,
    paddingBottom: 60,
  },
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
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginBottom: 8,
    marginTop: 18,
  },
  // KPIs
  kpisGrid: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  kpiCard: {
    width: "30%",
    backgroundColor: colors.lightBg,
    borderRadius: 4,
    padding: 10,
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 7,
    color: colors.muted,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  kpiValue: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginBottom: 2,
  },
  kpiSub: {
    fontSize: 8,
    color: colors.muted,
  },
  // Tableau
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
  tableCellBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  // Summary row
  tableSummary: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 2,
    borderTopColor: colors.dark,
    borderTopStyle: "solid",
    backgroundColor: colors.lightBg,
  },
  // Column widths
  colVague: { flex: 2 },
  colKg: { flex: 1, textAlign: "right" },
  colNbVentes: { flex: 1, textAlign: "right" },
  colMontant: { flex: 2, textAlign: "right" },
  colClient: { flex: 3 },
  colAchats: { flex: 1, textAlign: "right" },
  colTotal: { flex: 2, textAlign: "right" },
  colMois: { flex: 2 },
  colRevenus: { flex: 2, textAlign: "right" },
  colCouts: { flex: 2, textAlign: "right" },
  colMarge: { flex: 2, textAlign: "right" },
  // Cost detail columns
  colCoutType: { flex: 1 },
  colCoutLabel: { flex: 3 },
  colCoutMontant: { flex: 2, textAlign: "right" },
  colCoutPct: { flex: 1, textAlign: "right" },
  // Creances columns
  colCreanceClient: { flex: 3 },
  colCreanceTotal: { flex: 2, textAlign: "right" },
  colCreancePaye: { flex: 2, textAlign: "right" },
  colCreanceReste: { flex: 2, textAlign: "right" },
  // Monthly matrix
  matrixMoisCol: { width: 70 },
  matrixCatCol: { flex: 1, textAlign: "right" },
  matrixTotalCol: { width: 80, textAlign: "right" },
  // Monthly detail
  colDetailDate: { width: 55 },
  colDetailDesc: { flex: 3 },
  colDetailCat: { flex: 2 },
  colDetailType: { width: 45 },
  colDetailMontant: { flex: 2, textAlign: "right" },
  moisGroupHeader: {
    flexDirection: "row" as const,
    backgroundColor: "#f1f5f9",
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 10,
  },
  moisGroupTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    flex: 1,
  },
  moisGroupTotal: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    textAlign: "right" as const,
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
});

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function RapportFinancierPDF({
  data,
}: {
  data: CreateRapportFinancierPDFDTO;
}) {
  const {
    kpis,
    ventesParVague,
    topClients,
    evolutionMensuelle,
    coutsDetail,
    creancesClients,
    depensesSummary,
    coutsParMois,
    coutsDetailParMois,
  } = data;

  // Matrix aggregation for the summary table
  const moisTotals: Record<string, number> = {};
  const categorieTotals: Record<string, number> = {};
  const grid: Record<string, Record<string, number>> = {};
  let grandTotal = 0;

  for (const l of coutsParMois.lignes) {
    grid[l.mois] = grid[l.mois] || {};
    grid[l.mois][l.categorie] = (grid[l.mois][l.categorie] || 0) + l.montant;
    moisTotals[l.mois] = (moisTotals[l.mois] || 0) + l.montant;
    categorieTotals[l.categorie] = (categorieTotals[l.categorie] || 0) + l.montant;
    grandTotal += l.montant;
  }

  const catCols = coutsParMois.categories;
  const moisRows = coutsParMois.moisList;

  return (
    <Document title="Rapport Financier" author="FarmFlow">
      <Page size="A4" style={styles.page} wrap>
        {/* ===================== EN-TÊTE ===================== */}
        <View style={styles.header}>
          <View style={styles.headerFlex}>
            <View>
              <Text style={styles.title}>RAPPORT FINANCIER</Text>
              <Text style={styles.subtitle}>{data.site.name}</Text>
            </View>
            <View style={styles.headerMeta}>
              <Text style={styles.metaText}>
                Du {formatDate(data.periode.dateDebut)}
              </Text>
              <Text style={styles.metaText}>
                au {formatDate(data.periode.dateFin)}
              </Text>
            </View>
          </View>
        </View>

        {/* ===================== KPIs GLOBAUX ===================== */}
        <Text style={styles.sectionTitle}>Indicateurs globaux</Text>
        <View style={styles.kpisGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Revenus</Text>
            <Text style={styles.kpiValue}>{formatMontant(kpis.revenusTotal)}</Text>
            <Text style={styles.kpiSub}>Total des ventes</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Coûts</Text>
            <Text style={[styles.kpiValue, { color: colors.danger }]}>
              {formatMontant(kpis.coutsTotal)}
            </Text>
            <Text style={styles.kpiSub}>Stock + dépenses</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Marge brute</Text>
            <Text
              style={[
                styles.kpiValue,
                { color: kpis.margeNette >= 0 ? colors.success : colors.danger },
              ]}
            >
              {formatMontant(kpis.margeNette)}
            </Text>
            <Text style={styles.kpiSub}>
              Taux : {formatPct(kpis.tauxMarge)}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Encaissements</Text>
            <Text style={[styles.kpiValue, { color: colors.success }]}>
              {formatMontant(kpis.encaissements)}
            </Text>
            <Text style={styles.kpiSub}>Paiements reçus</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Créances</Text>
            <Text style={[styles.kpiValue, { color: colors.warning }]}>
              {formatMontant(kpis.creances)}
            </Text>
            <Text style={styles.kpiSub}>Reste à encaisser</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Dépenses impayées</Text>
            <Text style={[styles.kpiValue, { color: colors.warning }]}>
              {formatMontant(depensesSummary.impayees)}
            </Text>
            <Text style={styles.kpiSub}>
              sur {formatMontant(depensesSummary.total)} total
            </Text>
          </View>
        </View>

        {/* ===================== DÉTAIL DES COÛTS ===================== */}
        {coutsDetail.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Détail des coûts ({coutsDetail.length} postes)
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colCoutType]}>Type</Text>
              <Text style={[styles.tableHeaderText, styles.colCoutLabel]}>Poste</Text>
              <Text style={[styles.tableHeaderText, styles.colCoutMontant]}>Montant</Text>
              <Text style={[styles.tableHeaderText, styles.colCoutPct]}>%</Text>
            </View>
            {coutsDetail.map((ligne, i) => {
              const pct = kpis.coutsTotal > 0
                ? ((ligne.montant / kpis.coutsTotal) * 100).toFixed(1)
                : "0";
              return (
                <View
                  key={i}
                  style={[styles.tableRow]}
                  wrap={false}
                >
                  <Text style={[styles.tableCell, styles.colCoutType, { color: colors.muted }]}>
                    {ligne.type === "stock" ? "Stock" : "Dépense"}
                  </Text>
                  <Text style={[styles.tableCell, styles.colCoutLabel]}>
                    {ligne.label}
                  </Text>
                  <Text style={[styles.tableCellBold, styles.colCoutMontant]}>
                    {formatMontant(ligne.montant)}
                  </Text>
                  <Text style={[styles.tableCell, styles.colCoutPct, { color: colors.muted }]}>
                    {pct}%
                  </Text>
                </View>
              );
            })}
            <View style={styles.tableSummary} wrap={false}>
              <Text style={[styles.tableCellBold, styles.colCoutType]} />
              <Text style={[styles.tableCellBold, styles.colCoutLabel]}>TOTAL</Text>
              <Text style={[styles.tableCellBold, styles.colCoutMontant]}>
                {formatMontant(kpis.coutsTotal)}
              </Text>
              <Text style={[styles.tableCellBold, styles.colCoutPct]}>100%</Text>
            </View>
          </>
        )}

        {/* ===================== COÛTS PAR MOIS × CATÉGORIE (SYNTHÈSE) ===================== */}
        {moisRows.length > 0 && catCols.length > 0 && (
          <>
            <Text style={styles.sectionTitle} break>
              Synthèse mensuelle des coûts
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.matrixMoisCol]}>Mois</Text>
              {catCols.map((cat) => (
                <Text key={cat} style={[styles.tableHeaderText, styles.matrixCatCol]}>
                  {cat.length > 12 ? cat.slice(0, 11) + "…" : cat}
                </Text>
              ))}
              <Text style={[styles.tableHeaderText, styles.matrixTotalCol]}>Total</Text>
            </View>
            {moisRows.map((mois, i) => {
              const [annee, moisNum] = mois.split("-");
              const moisLabel = new Date(
                parseInt(annee),
                parseInt(moisNum) - 1,
                1
              ).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
              return (
                <View
                  key={mois}
                  style={[styles.tableRow]}
                  wrap={false}
                >
                  <Text style={[styles.tableCellBold, styles.matrixMoisCol]}>
                    {moisLabel}
                  </Text>
                  {catCols.map((cat) => (
                    <Text key={cat} style={[styles.tableCell, styles.matrixCatCol]}>
                      {(grid[mois]?.[cat] ?? 0) > 0
                        ? fmtNum(grid[mois][cat])
                        : "—"}
                    </Text>
                  ))}
                  <Text style={[styles.tableCellBold, styles.matrixTotalCol]}>
                    {fmtNum(moisTotals[mois] ?? 0)}
                  </Text>
                </View>
              );
            })}
            <View style={styles.tableSummary} wrap={false}>
              <Text style={[styles.tableCellBold, styles.matrixMoisCol]}>TOTAL</Text>
              {catCols.map((cat) => (
                <Text key={cat} style={[styles.tableCellBold, styles.matrixCatCol]}>
                  {fmtNum(categorieTotals[cat] ?? 0)}
                </Text>
              ))}
              <Text style={[styles.tableCellBold, styles.matrixTotalCol]}>
                {fmtNum(grandTotal)}
              </Text>
            </View>
          </>
        )}

        {/* ===================== DÉTAIL CONCRET DES COÛTS PAR MOIS ===================== */}
        {coutsDetailParMois.moisList.length > 0 && (
          <>
            <Text style={styles.sectionTitle} break>
              Détail des dépenses par mois
            </Text>
            {coutsDetailParMois.moisList.map((mois) => {
              const lignes = coutsDetailParMois.lignesParMois[mois] ?? [];
              if (lignes.length === 0) return null;
              const [annee, moisNum] = mois.split("-");
              const moisLabel = new Date(
                parseInt(annee),
                parseInt(moisNum) - 1,
                1
              ).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
              const totalMois = lignes.reduce((s, l) => s + l.montant, 0);
              return (
                <View key={mois}>
                  <View style={styles.moisGroupHeader} wrap={false}>
                    <Text style={styles.moisGroupTitle}>
                      {moisLabel} ({lignes.length} ligne{lignes.length > 1 ? "s" : ""})
                    </Text>
                    <Text style={styles.moisGroupTotal}>
                      {formatMontant(totalMois)}
                    </Text>
                  </View>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.colDetailDate]}>Date</Text>
                    <Text style={[styles.tableHeaderText, styles.colDetailDesc]}>Description</Text>
                    <Text style={[styles.tableHeaderText, styles.colDetailCat]}>Catégorie</Text>
                    <Text style={[styles.tableHeaderText, styles.colDetailType]}>Type</Text>
                    <Text style={[styles.tableHeaderText, styles.colDetailMontant]}>Montant</Text>
                  </View>
                  {lignes.map((l, i) => (
                    <View
                      key={i}
                      style={[styles.tableRow]}
                      wrap={false}
                    >
                      <Text style={[styles.tableCell, styles.colDetailDate]}>
                        {l.date.slice(5)}
                      </Text>
                      <Text style={[styles.tableCell, styles.colDetailDesc]}>
                        {l.description}
                      </Text>
                      <Text style={[styles.tableCell, styles.colDetailCat, { color: colors.muted }]}>
                        {l.categorie}
                      </Text>
                      <Text style={[styles.tableCell, styles.colDetailType, { color: colors.muted }]}>
                        {l.type === "stock" ? "Stock" : "Dép."}
                      </Text>
                      <Text style={[styles.tableCellBold, styles.colDetailMontant]}>
                        {formatMontant(l.montant)}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </>
        )}

        {/* ===================== VENTES PAR VAGUE ===================== */}
        {ventesParVague.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Ventes par vague ({ventesParVague.length} vague
              {ventesParVague.length > 1 ? "s" : ""})
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colVague]}>Vague</Text>
              <Text style={[styles.tableHeaderText, styles.colKg]}>Qté (kg)</Text>
              <Text style={[styles.tableHeaderText, styles.colNbVentes]}>Ventes</Text>
              <Text style={[styles.tableHeaderText, styles.colMontant]}>Montant</Text>
            </View>
            {ventesParVague.map((v, i) => (
              <View
                key={i}
                style={[styles.tableRow]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colVague]}>
                  {v.codeVague}
                </Text>
                <Text style={[styles.tableCell, styles.colKg]}>
                  {v.quantiteTotaleKg.toFixed(1)} kg
                </Text>
                <Text style={[styles.tableCell, styles.colNbVentes]}>
                  {v.nombreVentes}
                </Text>
                <Text style={[styles.tableCellBold, styles.colMontant]}>
                  {formatMontant(v.montantTotal)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* ===================== CRÉANCES CLIENTS ===================== */}
        {creancesClients.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Créances clients ({creancesClients.length} client
              {creancesClients.length > 1 ? "s" : ""})
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colCreanceClient]}>Client</Text>
              <Text style={[styles.tableHeaderText, styles.colCreanceTotal]}>Total dû</Text>
              <Text style={[styles.tableHeaderText, styles.colCreancePaye]}>Payé</Text>
              <Text style={[styles.tableHeaderText, styles.colCreanceReste]}>Reste</Text>
            </View>
            {creancesClients.map((c, i) => (
              <View
                key={i}
                style={[styles.tableRow]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colCreanceClient]}>
                  {c.nomClient}
                </Text>
                <Text style={[styles.tableCell, styles.colCreanceTotal]}>
                  {formatMontant(c.totalVentes)}
                </Text>
                <Text style={[styles.tableCell, styles.colCreancePaye, { color: colors.success }]}>
                  {formatMontant(c.totalPaye)}
                </Text>
                <Text style={[styles.tableCellBold, styles.colCreanceReste, { color: colors.danger }]}>
                  {formatMontant(c.resteARegler)}
                </Text>
              </View>
            ))}
            <View style={styles.tableSummary} wrap={false}>
              <Text style={[styles.tableCellBold, styles.colCreanceClient]}>TOTAL</Text>
              <Text style={[styles.tableCellBold, styles.colCreanceTotal]}>
                {formatMontant(creancesClients.reduce((s, c) => s + c.totalVentes, 0))}
              </Text>
              <Text style={[styles.tableCellBold, styles.colCreancePaye, { color: colors.success }]}>
                {formatMontant(creancesClients.reduce((s, c) => s + c.totalPaye, 0))}
              </Text>
              <Text style={[styles.tableCellBold, styles.colCreanceReste, { color: colors.danger }]}>
                {formatMontant(creancesClients.reduce((s, c) => s + c.resteARegler, 0))}
              </Text>
            </View>
          </>
        )}

        {/* ===================== TOP CLIENTS ===================== */}
        {topClients.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Top clients ({topClients.length})
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colClient]}>Client</Text>
              <Text style={[styles.tableHeaderText, styles.colAchats]}>Achats</Text>
              <Text style={[styles.tableHeaderText, styles.colTotal]}>Total</Text>
            </View>
            {topClients.map((c, i) => (
              <View
                key={i}
                style={[styles.tableRow]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colClient]}>
                  {i + 1}. {c.nomClient}
                </Text>
                <Text style={[styles.tableCell, styles.colAchats]}>
                  {c.nombreAchats}
                </Text>
                <Text style={[styles.tableCellBold, styles.colTotal]}>
                  {formatMontant(c.montantTotal)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* ===================== ÉVOLUTION MENSUELLE ===================== */}
        {evolutionMensuelle.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Évolution mensuelle ({evolutionMensuelle.length} mois)
            </Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.colMois]}>Mois</Text>
              <Text style={[styles.tableHeaderText, styles.colRevenus]}>Revenus</Text>
              <Text style={[styles.tableHeaderText, styles.colCouts]}>Coûts</Text>
              <Text style={[styles.tableHeaderText, styles.colMarge]}>Marge</Text>
            </View>
            {evolutionMensuelle.map((m, i) => {
              const [annee, moisNum] = m.mois.split("-");
              const moisLabel = new Date(
                parseInt(annee),
                parseInt(moisNum) - 1,
                1
              ).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
              return (
                <View
                  key={i}
                  style={[styles.tableRow]}
                  wrap={false}
                >
                  <Text style={[styles.tableCell, styles.colMois]}>
                    {moisLabel}
                  </Text>
                  <Text style={[styles.tableCell, styles.colRevenus]}>
                    {formatMontant(m.revenus)}
                  </Text>
                  <Text style={[styles.tableCell, styles.colCouts]}>
                    {formatMontant(m.couts)}
                  </Text>
                  <Text
                    style={[
                      styles.tableCellBold,
                      styles.colMarge,
                      {
                        color: m.marge >= 0 ? colors.success : colors.danger,
                      },
                    ]}
                  >
                    {formatMontant(m.marge)}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {/* ===================== FOOTER ===================== */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            FarmFlow — {data.site.name} — Rapport Financier
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

export function renderRapportFinancierPDF(data: CreateRapportFinancierPDFDTO): Promise<Buffer> {
  return renderToBuffer(<RapportFinancierPDF data={data} />);
}
