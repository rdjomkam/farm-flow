/**
 * Template PDF — Rapport Financier
 *
 * Génère un rapport financier mensuel/trimestriel pour un site :
 * KPIs globaux, ventes par vague, top clients, évolution mensuelle.
 *
 * DTO : CreateRapportFinancierPDFDTO (src/types/export.ts)
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
import { formatNumber } from "@/lib/format";

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

function formatMontant(n: number): string {
  return formatNumber(n) + " FCFA";
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
  // Section titre
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 16,
  },
  // KPIs
  kpisGrid: {
    flexDirection: "row",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.lightBg,
    borderRadius: 4,
    padding: 10,
    borderTopWidth: 3,
    borderTopColor: colors.primary,
    borderTopStyle: "solid",
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
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
  },
  tableRowAlt: {
    backgroundColor: colors.lightBg,
  },
  tableCell: {
    fontSize: 8,
  },
  // Ventes par vague colonnes
  colVague: { flex: 2 },
  colKg: { flex: 1, textAlign: "right" },
  colNbVentes: { flex: 1, textAlign: "right" },
  colMontant: { flex: 2, textAlign: "right" },
  // Top clients colonnes
  colClient: { flex: 3 },
  colAchats: { flex: 1, textAlign: "right" },
  colTotal: { flex: 2, textAlign: "right" },
  // Évolution mensuelle colonnes
  colMois: { flex: 2 },
  colRevenus: { flex: 2, textAlign: "right" },
  colCouts: { flex: 2, textAlign: "right" },
  colMarge: { flex: 2, textAlign: "right" },
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
  const { kpis, ventesParVague, topClients, evolutionMensuelle } = data;

  return (
    <Document title="Rapport Financier" author="FarmFlow">
      <Page size="A4" style={styles.page}>
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
        <Text style={styles.sectionTitle}>KPIs globaux</Text>
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
            <Text style={styles.kpiSub}>Aliments + intrants</Text>
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
        </View>

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
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
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
                <Text
                  style={[
                    styles.tableCell,
                    styles.colMontant,
                    { fontFamily: "Helvetica-Bold" },
                  ]}
                >
                  {formatMontant(v.montantTotal)}
                </Text>
              </View>
            ))}
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
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.tableCell, styles.colClient]}>
                  {i + 1}. {c.nomClient}
                </Text>
                <Text style={[styles.tableCell, styles.colAchats]}>
                  {c.nombreAchats}
                </Text>
                <Text
                  style={[
                    styles.tableCell,
                    styles.colTotal,
                    { fontFamily: "Helvetica-Bold" },
                  ]}
                >
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
              ).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); // locale-specific month display, not a number format
              return (
                <View
                  key={i}
                  style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
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
                      styles.tableCell,
                      styles.colMarge,
                      {
                        fontFamily: "Helvetica-Bold",
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

/**
 * Génère le buffer PDF pour un rapport financier.
 * Utilise JSX natif (fichier .tsx) pour éviter les problèmes de type avec createElement.
 */
export function renderRapportFinancierPDF(data: CreateRapportFinancierPDFDTO): Promise<Buffer> {
  return renderToBuffer(<RapportFinancierPDF data={data} />);
}
