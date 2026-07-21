/**
 * Template PDF — Bon de livraison (Sprint BL, story BL.5)
 *
 * Utilise @react-pdf/renderer pour générer un bon de livraison signé en
 * format A4. Rendu côté serveur via renderToBuffer() dans
 * /api/export/bon-livraison/[id].
 *
 * DTO : CreateBonLivraisonPDFDTO (src/types/export.ts)
 */

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { CreateBonLivraisonPDFDTO } from "@/types/export";
import { StatutBonLivraison } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtNum(n: number): string {
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return n < 0 ? "-" + s : s;
}

function formatMontant(n: number): string {
  return fmtNum(n) + " FCFA";
}

function fmtKg(n: number | null): string {
  if (n === null) return "—";
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
}

const statutLabels: Record<StatutBonLivraison, string> = {
  [StatutBonLivraison.BROUILLON]: "BROUILLON",
  [StatutBonLivraison.EN_ATTENTE_SIGNATURE]: "EN ATTENTE DE SIGNATURE",
  [StatutBonLivraison.SIGNE]: "SIGNÉ",
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
  blTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginBottom: 4,
  },
  blNumero: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginBottom: 6,
  },
  blDate: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 2,
  },
  statutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: "flex-end",
    backgroundColor: "#dcfce7",
  },
  statutText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    color: colors.success,
  },
  // Section client
  clientSection: {
    backgroundColor: colors.lightBg,
    padding: 14,
    borderRadius: 4,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
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
  // Tableau des lignes livrées
  tableSection: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  tableHeaderText: {
    color: colors.dark,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
  },
  colDesignation: { flex: 3 },
  colPoissons: { flex: 1, textAlign: "right" },
  colPoidsCmd: { flex: 1.4, textAlign: "right" },
  colPoidsLivre: { flex: 1.4, textAlign: "right" },
  colEcart: { flex: 1.2, textAlign: "right" },
  tableCell: { fontSize: 9 },
  // Bloc paiement
  totauxSection: {
    alignItems: "flex-end",
    marginBottom: 24,
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
  totauxLabel: {
    fontSize: 9,
    color: colors.muted,
  },
  totauxValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  soldeDue: {
    backgroundColor: "#fef3c7",
    borderBottomWidth: 0,
  },
  soldeSolde: {
    backgroundColor: colors.primary,
    borderBottomWidth: 0,
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
  soldeLabelLight: {
    fontSize: 9,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
  },
  soldeValueLight: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  // Signatures
  signaturesSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 10,
  },
  signatureBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 8,
    minHeight: 130,
  },
  signatureBoxTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  signatureImage: {
    width: "100%",
    height: 60,
    objectFit: "contain",
    marginBottom: 6,
  },
  cachetImage: {
    width: 50,
    height: 50,
    objectFit: "contain",
    position: "absolute",
    right: 6,
    bottom: 6,
  },
  signaturePlaceholder: {
    width: "100%",
    height: 60,
    marginBottom: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  signaturePlaceholderText: {
    fontSize: 7,
    color: colors.muted,
  },
  signatureName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  signatureDate: {
    fontSize: 8,
    color: colors.muted,
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
// Sous-composants
// ---------------------------------------------------------------------------

function SignatureBlock({
  title,
  image,
  nom,
  date,
  overlayImage,
}: {
  title: string;
  image: string | null;
  nom: string | null;
  date: Date | null;
  /** Image superposée en coin (ex: cachet superposé à la signature promoteur) */
  overlayImage?: string | null;
}) {
  return (
    <View style={styles.signatureBox}>
      <Text style={styles.signatureBoxTitle}>{title}</Text>
      {image ? (
        <View style={{ position: "relative" }}>
          <Image src={image} style={styles.signatureImage} />
          {overlayImage && <Image src={overlayImage} style={styles.cachetImage} />}
        </View>
      ) : (
        <View style={styles.signaturePlaceholder}>
          <Text style={styles.signaturePlaceholderText}>
            {overlayImage ? "Cachet uniquement" : "Non renseignée"}
          </Text>
          {overlayImage && <Image src={overlayImage} style={styles.cachetImage} />}
        </View>
      )}
      {nom && <Text style={styles.signatureName}>{nom}</Text>}
      {date && <Text style={styles.signatureDate}>Le {formatDate(date)}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function BonLivraisonPDF({ data }: { data: CreateBonLivraisonPDFDTO }) {
  const { blocPaiement } = data;
  const entierementPaye = blocPaiement.resteAPayer <= 0;

  return (
    <Document title={`Bon de livraison ${data.numero}`} author="FarmFlow">
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
            <Text style={styles.blTitle}>BON DE LIVRAISON</Text>
            <Text style={styles.blNumero}>{data.numero}</Text>
            <Text style={styles.blDate}>
              Livraison : {formatDate(data.signeLe)}
            </Text>
            <Text style={styles.blDate}>Vente : {data.venteNumero}</Text>
            <View style={styles.statutBadge}>
              <Text style={styles.statutText}>{statutLabels[data.statut]}</Text>
            </View>
          </View>
        </View>

        {/* ===================== CLIENT ===================== */}
        <View style={styles.clientSection}>
          <Text style={styles.sectionTitle}>Livré à</Text>
          <Text style={styles.clientName}>{data.client.nom}</Text>
          {data.client.telephone && (
            <Text style={styles.clientDetail}>Tél : {data.client.telephone}</Text>
          )}
        </View>

        {/* ===================== TABLEAU LIGNES LIVRÉES ===================== */}
        <View style={styles.tableSection}>
          <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
            Détail de la livraison
          </Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colDesignation]}>
              Désignation
            </Text>
            <Text style={[styles.tableHeaderText, styles.colPoissons]}>
              Poissons
            </Text>
            <Text style={[styles.tableHeaderText, styles.colPoidsCmd]}>
              Poids commandé
            </Text>
            <Text style={[styles.tableHeaderText, styles.colPoidsLivre]}>
              Poids livré
            </Text>
            <Text style={[styles.tableHeaderText, styles.colEcart]}>
              Écart
            </Text>
          </View>
          {data.lignes.map((ligne, i) => {
            const ecartColor =
              ligne.ecartKg === null
                ? colors.muted
                : ligne.ecartKg < 0
                  ? colors.danger
                  : ligne.ecartKg > 0
                    ? colors.success
                    : colors.muted;
            return (
              <View key={i} style={styles.tableRow}>
                <View style={styles.colDesignation}>
                  <Text style={styles.tableCell}>{ligne.designation}</Text>
                  {ligne.nomBac && (
                    <Text style={[styles.tableCell, { color: colors.muted, fontSize: 8 }]}>
                      Bac : {ligne.nomBac}
                    </Text>
                  )}
                </View>
                <Text style={[styles.tableCell, styles.colPoissons]}>
                  {ligne.nombrePoissons}
                </Text>
                <Text style={[styles.tableCell, styles.colPoidsCmd]}>
                  {fmtKg(ligne.poidsCommandeKg)}
                </Text>
                <Text style={[styles.tableCell, styles.colPoidsLivre, { fontFamily: "Helvetica-Bold" }]}>
                  {fmtKg(ligne.poidsLivreKg)}
                </Text>
                <Text style={[styles.tableCell, styles.colEcart, { color: ecartColor }]}>
                  {ligne.ecartKg === null
                    ? "—"
                    : `${ligne.ecartKg > 0 ? "+" : ""}${fmtKg(ligne.ecartKg)}`}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ===================== BLOC PAIEMENT ===================== */}
        <View style={styles.totauxSection}>
          <View style={styles.totauxCard}>
            <View style={styles.totauxRow}>
              <Text style={styles.totauxLabel}>Total vente</Text>
              <Text style={styles.totauxValue}>
                {formatMontant(blocPaiement.totalVente)}
              </Text>
            </View>
            <View style={styles.totauxRow}>
              <Text style={styles.totauxLabel}>Payé à ce jour</Text>
              <Text style={[styles.totauxValue, { color: colors.success }]}>
                {formatMontant(blocPaiement.paye)}
              </Text>
            </View>
            {entierementPaye ? (
              <View style={[styles.totauxRow, styles.soldeSolde]}>
                <Text style={styles.soldeLabelLight}>Entièrement payé</Text>
                <Text style={styles.soldeValueLight}>✓</Text>
              </View>
            ) : (
              <View style={[styles.totauxRow, styles.soldeDue]}>
                <Text style={styles.soldeLabel}>Reste à payer</Text>
                <Text style={styles.soldeValue}>
                  {formatMontant(blocPaiement.resteAPayer)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ===================== SIGNATURES ===================== */}
        <View style={styles.signaturesSection}>
          <SignatureBlock
            title="Le client"
            image={data.signatureClient.image}
            nom={data.signatureClient.nom}
            date={data.signatureClient.date}
          />
          <SignatureBlock
            title="Le livreur"
            image={data.signatureLivreur.image}
            nom={data.signatureLivreur.nom}
            date={data.signatureLivreur.date}
          />
          <SignatureBlock
            title="Le promoteur"
            image={data.signaturePromoteur.image}
            nom={data.signaturePromoteur.nom}
            date={null}
            overlayImage={data.cachet}
          />
        </View>

        {/* ===================== FOOTER ===================== */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.site.name} — Document généré par FarmFlow le {formatDate(data.dateGeneration)}
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
 * Génère le buffer PDF pour un bon de livraison.
 * Utilise JSX natif (fichier .tsx) pour éviter les problèmes de type avec createElement.
 */
export function renderBonLivraisonPDF(
  data: CreateBonLivraisonPDFDTO
): Promise<Buffer> {
  return renderToBuffer(<BonLivraisonPDF data={data} />);
}
