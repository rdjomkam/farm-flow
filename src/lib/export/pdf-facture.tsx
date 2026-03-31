/**
 * Template PDF — Facture
 *
 * Utilise @react-pdf/renderer pour générer une facture en format A4.
 * Rendu côté serveur via renderToBuffer() dans /api/export/facture/[id].
 *
 * DTO : CreateFacturePDFDTO (src/types/export.ts)
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { CreateFacturePDFDTO } from "@/types/export";
import { StatutFacture, ModePaiement } from "@/types";
import { formatNumber } from "@/lib/format";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMontant(n: number): string {
  return formatNumber(n) + " FCFA";
}

const statutLabels: Record<StatutFacture, string> = {
  [StatutFacture.BROUILLON]: "BROUILLON",
  [StatutFacture.ENVOYEE]: "ENVOYÉE",
  [StatutFacture.PAYEE_PARTIELLEMENT]: "PAYÉE PARTIELLEMENT",
  [StatutFacture.PAYEE]: "PAYÉE",
  [StatutFacture.ANNULEE]: "ANNULÉE",
};

const modeLabels: Record<ModePaiement, string> = {
  [ModePaiement.ESPECES]: "Espèces",
  [ModePaiement.MOBILE_MONEY]: "Mobile Money",
  [ModePaiement.VIREMENT]: "Virement bancaire",
  [ModePaiement.CHEQUE]: "Chèque",
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const colors = {
  primary: "#0d9488",
  dark: "#1e293b",
  muted: "#64748b",
  border: "#e2e8f0",
  lightBg: "#f8fafc",
  success: "#16a34a",
  warning: "#d97706",
  danger: "#dc2626",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.dark,
    backgroundColor: "#ffffff",
    padding: 40,
  },
  // En-tête
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    borderBottomStyle: "solid",
  },
  headerLeft: {
    flex: 1,
  },
  siteName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 4,
  },
  siteAddress: {
    fontSize: 9,
    color: colors.muted,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  factureTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginBottom: 4,
  },
  factureNumero: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 6,
  },
  factureDate: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 2,
  },
  // Statut badge
  statutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: "flex-end",
  },
  statutText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  // Section client
  clientSection: {
    backgroundColor: colors.lightBg,
    padding: 14,
    borderRadius: 4,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  clientName: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  clientDetail: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 1,
  },
  // Tableau des produits
  tableSection: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 0,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
  },
  tableRowAlt: {
    backgroundColor: colors.lightBg,
  },
  colDesignation: { flex: 3 },
  colQte: { flex: 1, textAlign: "right" },
  colPrix: { flex: 2, textAlign: "right" },
  colTotal: { flex: 2, textAlign: "right" },
  tableCell: { fontSize: 9 },
  // Totaux
  totauxSection: {
    alignItems: "flex-end",
    marginBottom: 20,
  },
  totauxCard: {
    width: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  totauxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
  },
  totauxRowLast: {
    borderBottomWidth: 0,
  },
  totauxLabel: {
    fontSize: 9,
    color: colors.muted,
  },
  totauxValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  totauxRowHighlight: {
    backgroundColor: colors.primary,
  },
  totauxLabelLight: {
    fontSize: 9,
    color: "#ffffff",
  },
  totauxValueLight: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  soldeDue: {
    backgroundColor: "#fef3c7",
  },
  soldeLabel: {
    fontSize: 9,
    color: colors.warning,
    fontFamily: "Helvetica-Bold",
  },
  soldeValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.warning,
  },
  // Paiements
  paiementsSection: {
    marginBottom: 20,
  },
  paiementRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
  },
  paiementLabel: {
    fontSize: 9,
    color: colors.muted,
  },
  paiementMontant: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.success,
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
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: colors.muted,
  },
});

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function FacturePDF({ data }: { data: CreateFacturePDFDTO }) {
  const soldeRestant = data.montantFacture - data.montantPaye;

  const statutColors: Record<StatutFacture, { bg: string; text: string }> = {
    [StatutFacture.BROUILLON]: { bg: "#e2e8f0", text: colors.muted },
    [StatutFacture.ENVOYEE]: { bg: "#dbeafe", text: "#1d4ed8" },
    [StatutFacture.PAYEE_PARTIELLEMENT]: { bg: "#fef3c7", text: colors.warning },
    [StatutFacture.PAYEE]: { bg: "#dcfce7", text: colors.success },
    [StatutFacture.ANNULEE]: { bg: "#fee2e2", text: colors.danger },
  };

  const sc = statutColors[data.statut];

  return (
    <Document title={`Facture ${data.numero}`} author="FarmFlow">
      <Page size="A4" style={styles.page}>
        {/* ===================== EN-TÊTE ===================== */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.siteName}>{data.site.name}</Text>
            {data.site.address && (
              <Text style={styles.siteAddress}>{data.site.address}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.factureTitle}>FACTURE</Text>
            <Text style={styles.factureNumero}>{data.numero}</Text>
            <Text style={styles.factureDate}>
              Émission : {formatDate(data.dateEmission)}
            </Text>
            {data.dateEcheance && (
              <Text style={styles.factureDate}>
                Échéance : {formatDate(data.dateEcheance)}
              </Text>
            )}
            <View
              style={[
                styles.statutBadge,
                { backgroundColor: sc.bg },
              ]}
            >
              <Text style={[styles.statutText, { color: sc.text }]}>
                {statutLabels[data.statut]}
              </Text>
            </View>
          </View>
        </View>

        {/* ===================== CLIENT ===================== */}
        <View style={styles.clientSection}>
          <Text style={styles.sectionTitle}>Facturé à</Text>
          <Text style={styles.clientName}>{data.client.nom}</Text>
          {data.client.telephone && (
            <Text style={styles.clientDetail}>
              Tél : {data.client.telephone}
            </Text>
          )}
          {data.client.email && (
            <Text style={styles.clientDetail}>
              Email : {data.client.email}
            </Text>
          )}
          {data.client.adresse && (
            <Text style={styles.clientDetail}>{data.client.adresse}</Text>
          )}
        </View>

        {/* ===================== TABLEAU PRODUITS ===================== */}
        <View style={styles.tableSection}>
          <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
            Détail de la vente
          </Text>
          {/* Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDesignation]}>
              Désignation
            </Text>
            <Text style={[styles.tableHeaderText, styles.colQte]}>
              Qté (kg)
            </Text>
            <Text style={[styles.tableHeaderText, styles.colPrix]}>
              Prix/kg
            </Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>
              Total
            </Text>
          </View>
          {/* Ligne produit */}
          <View style={styles.tableRow}>
            <View style={styles.colDesignation}>
              <Text style={styles.tableCell}>
                Silures — Vague {data.vagueCode}
              </Text>
              <Text style={[styles.tableCell, { color: colors.muted, fontSize: 8 }]}>
                {data.quantitePoissons} poissons · {data.venteNumero}
              </Text>
            </View>
            <Text style={[styles.tableCell, styles.colQte]}>
              {data.poidsTotalKg} kg
            </Text>
            <Text style={[styles.tableCell, styles.colPrix]}>
              {formatNumber(data.prixUnitaireKg)} F
            </Text>
            <Text style={[styles.tableCell, styles.colTotal, { fontFamily: "Helvetica-Bold" }]}>
              {formatMontant(data.montantTotal)}
            </Text>
          </View>
        </View>

        {/* ===================== TOTAUX ===================== */}
        <View style={styles.totauxSection}>
          <View style={styles.totauxCard}>
            {/* Sous-total */}
            <View style={styles.totauxRow}>
              <Text style={styles.totauxLabel}>Sous-total</Text>
              <Text style={styles.totauxValue}>
                {formatMontant(data.montantFacture)}
              </Text>
            </View>
            {/* Montant payé */}
            <View style={styles.totauxRow}>
              <Text style={styles.totauxLabel}>Montant payé</Text>
              <Text style={[styles.totauxValue, { color: colors.success }]}>
                {formatMontant(data.montantPaye)}
              </Text>
            </View>
            {/* Solde */}
            {soldeRestant > 0 ? (
              <View style={[styles.totauxRow, styles.totauxRowLast, styles.soldeDue]}>
                <Text style={styles.soldeLabel}>Solde à régler</Text>
                <Text style={styles.soldeValue}>{formatMontant(soldeRestant)}</Text>
              </View>
            ) : (
              <View style={[styles.totauxRow, styles.totauxRowLast, styles.totauxRowHighlight]}>
                <Text style={styles.totauxLabelLight}>Entièrement payé</Text>
                <Text style={styles.totauxValueLight}>✓</Text>
              </View>
            )}
          </View>
        </View>

        {/* ===================== PAIEMENTS ===================== */}
        {data.paiements.length > 0 && (
          <View style={styles.paiementsSection}>
            <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
              Historique des paiements
            </Text>
            {data.paiements.map((p, i) => (
              <View key={i} style={styles.paiementRow}>
                <View>
                  <Text style={styles.paiementLabel}>
                    {modeLabels[p.mode] ?? p.mode}
                  </Text>
                  <Text style={[styles.paiementLabel, { fontSize: 8 }]}>
                    {formatDate(p.date)}
                    {p.reference ? ` — ${p.reference}` : ""}
                  </Text>
                </View>
                <Text style={styles.paiementMontant}>
                  {formatMontant(p.montant)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ===================== NOTES ===================== */}
        {data.notes && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{ fontSize: 9, color: colors.muted, fontStyle: "italic" }}>
              {data.notes}
            </Text>
          </View>
        )}

        {/* ===================== FOOTER ===================== */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.site.name} — Document généré par FarmFlow
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
 * Génère le buffer PDF pour une facture.
 * Utilise JSX natif (fichier .tsx) pour éviter les problèmes de type avec createElement.
 */
export function renderFacturePDF(data: CreateFacturePDFDTO): Promise<Buffer> {
  return renderToBuffer(<FacturePDF data={data} />);
}
