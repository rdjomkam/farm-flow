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
import { decodeImageDataUrl } from "@/lib/validation/image-decode";

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
// Pré-validation des images (Sprint PX, ADR-047 D2/D3-a)
// ---------------------------------------------------------------------------

/**
 * Texte exact du mode dégradé (ADR-047 D2), distinct du placeholder
 * « Non renseignée » — affiché quand une image EST présente en base mais
 * n'est pas décodable (données legacy antérieures au durcissement à
 * l'écriture, ou tout autre cas résiduel). Ne jamais faire échouer tout le
 * document pour ce cas : un bon de livraison signé est une pièce
 * contractuelle existante.
 */
const SIGNATURE_ILLISIBLE_TEXT =
  "Signature illisible (fichier image corrompu) — à régénérer auprès de l'administrateur du site";

interface SafeImage {
  image: string | null;
  /** true si une image était présente mais n'a pas pu être décodée. */
  corrupted: boolean;
}

/**
 * Pré-valide une image AVANT qu'elle ne soit injectée dans un composant
 * `<Image>` — donc AVANT tout appel à `renderToBuffer` (protection primaire,
 * ADR-047 D3-a). Toute image non décodable est journalisée (niveau `warn`)
 * puis remplacée par `null` : le composant affiche alors le placeholder
 * dégradé au lieu de transmettre un buffer corrompu à `@react-pdf/png-js`.
 */
function safeSignatureImage(
  raw: string | null,
  context: { numero: string; champ: string }
): SafeImage {
  if (!raw) return { image: null, corrupted: false };

  const result = decodeImageDataUrl(raw);
  if (result.ok) return { image: raw, corrupted: false };

  console.warn(
    `[pdf-bon-livraison] Image non décodable pour le BL ${context.numero} (champ: ${context.champ})${
      result.reason ? ` — ${result.reason}` : ""
    }.`
  );
  return { image: null, corrupted: true };
}

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
  avarieMention: {
    color: colors.warning,
    fontSize: 7.5,
    marginTop: 2,
  },
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
  // Mode dégradé — image présente mais non décodable (Sprint PX, ADR-047 D2).
  // Visuellement distinct du placeholder « Non renseignée » (fond ambre,
  // texte orange) pour qu'un lecteur du document comprenne sans ambiguïté
  // qu'une signature existait mais n'a pas pu être restituée.
  signaturePlaceholderCorrupted: {
    width: "100%",
    height: 60,
    marginBottom: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.warning,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  signaturePlaceholderCorruptedText: {
    fontSize: 6.5,
    color: colors.warning,
    textAlign: "center",
  },
  cachetCorruptedBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 50,
    height: 50,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.warning,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  cachetCorruptedText: {
    fontSize: 5.5,
    color: colors.warning,
    textAlign: "center",
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
  // Mention rectificatif (BF.7c)
  rectificatifBanner: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: colors.warning,
    borderStyle: "solid",
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
  },
  rectificatifTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.warning,
    marginBottom: 3,
  },
  rectificatifMotif: {
    fontSize: 9,
    color: colors.dark,
  },
  // Filigrane bon annulé (BF.7c)
  // Volontairement NI `fixed` NI plus large que la page : le document tient sur
  // une seule page, et un bloc `fixed` qui déborde est un risque connu de boucle
  // de pagination dans react-pdf. Texte coupé en deux lignes courtes pour tenir
  // sans retour à la ligne automatique.
  watermark: {
    position: "absolute",
    top: 330,
    left: 0,
    right: 0,
    transform: "rotate(-35deg)",
    textAlign: "center",
  },
  watermarkText: {
    fontSize: 68,
    fontFamily: "Helvetica-Bold",
    color: colors.danger,
    opacity: 0.22,
  },
  watermarkSub: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: colors.danger,
    opacity: 0.22,
  },
});

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function SignatureBlock({
  title,
  image,
  imageCorrupted = false,
  nom,
  date,
  overlayImage,
  overlayCorrupted = false,
}: {
  title: string;
  image: string | null;
  /** true si une image était présente en base mais non décodable (Sprint PX). */
  imageCorrupted?: boolean;
  nom: string | null;
  date: Date | null;
  /** Image superposée en coin (ex: cachet superposé à la signature promoteur) */
  overlayImage?: string | null;
  /** true si le cachet était présent en base mais non décodable (Sprint PX). */
  overlayCorrupted?: boolean;
}) {
  const overlayNode = overlayImage ? (
    <Image src={overlayImage} style={styles.cachetImage} />
  ) : overlayCorrupted ? (
    <View style={styles.cachetCorruptedBadge}>
      <Text style={styles.cachetCorruptedText}>Cachet illisible</Text>
    </View>
  ) : null;

  return (
    <View style={styles.signatureBox}>
      <Text style={styles.signatureBoxTitle}>{title}</Text>
      {image ? (
        <View style={{ position: "relative" }}>
          <Image src={image} style={styles.signatureImage} />
          {overlayNode}
        </View>
      ) : imageCorrupted ? (
        <View style={styles.signaturePlaceholderCorrupted}>
          <Text style={styles.signaturePlaceholderCorruptedText}>
            {SIGNATURE_ILLISIBLE_TEXT}
          </Text>
          {overlayNode}
        </View>
      ) : (
        <View style={styles.signaturePlaceholder}>
          <Text style={styles.signaturePlaceholderText}>
            {overlayImage || overlayCorrupted ? "Cachet uniquement" : "Non renseignée"}
          </Text>
          {overlayNode}
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

  // Pré-validation des 4 images AVANT tout <Image> / renderToBuffer
  // (protection primaire, ADR-047 D3-a). Toute image non décodable bascule
  // en mode dégradé (placeholder distinct), sans faire échouer le document.
  const signatureClientSafe = safeSignatureImage(data.signatureClient.image, {
    numero: data.numero,
    champ: "signatureClient",
  });
  const signatureLivreurSafe = safeSignatureImage(data.signatureLivreur.image, {
    numero: data.numero,
    champ: "signatureLivreur",
  });
  const signaturePromoteurSafe = safeSignatureImage(data.signaturePromoteur.image, {
    numero: data.numero,
    champ: "signaturePromoteur",
  });
  const cachetSafe = safeSignatureImage(data.cachet, {
    numero: data.numero,
    champ: "cachet",
  });

  return (
    <Document title={`Bon de livraison ${data.numero}`} author="FarmFlow">
      <Page size="A4" style={styles.page}>
        {/* ===================== FILIGRANE — BON ANNULÉ (BF.7c) ===================== */}
        {data.rectifiePar && (
          <View style={styles.watermark}>
            <Text style={styles.watermarkText}>ANNULÉ</Text>
            <Text style={styles.watermarkSub}>
              Remplacé par {data.rectifiePar.numero}
            </Text>
          </View>
        )}

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

        {/* ===================== MENTION RECTIFICATIF (BF.7c) ===================== */}
        {data.rectifieDe && (
          <View style={styles.rectificatifBanner}>
            <Text style={styles.rectificatifTitle}>
              Annule et remplace le {data.rectifieDe.bon.numero}
              {data.rectifieDe.bon.signeLe
                ? ` du ${formatDate(data.rectifieDe.bon.signeLe)}`
                : ""}
            </Text>
            {data.rectifieDe.motif && (
              <Text style={styles.rectificatifMotif}>
                Motif : {data.rectifieDe.motif}
              </Text>
            )}
          </View>
        )}

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
                  {ligne.nombreMortsTransport > 0 && (
                    <Text style={[styles.tableCell, styles.avarieMention]}>
                      dont {ligne.nombreMortsTransport} mort
                      {ligne.nombreMortsTransport > 1 ? "s" : ""} en transport
                      {ligne.motifAvarie ? ` — ${ligne.motifAvarie}` : ""}
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
            image={signatureClientSafe.image}
            imageCorrupted={signatureClientSafe.corrupted}
            nom={data.signatureClient.nom}
            date={data.signatureClient.date}
          />
          <SignatureBlock
            title="Le livreur"
            image={signatureLivreurSafe.image}
            imageCorrupted={signatureLivreurSafe.corrupted}
            nom={data.signatureLivreur.nom}
            date={data.signatureLivreur.date}
          />
          <SignatureBlock
            title="Le promoteur"
            image={signaturePromoteurSafe.image}
            imageCorrupted={signaturePromoteurSafe.corrupted}
            nom={data.signaturePromoteur.nom}
            date={null}
            overlayImage={cachetSafe.image}
            overlayCorrupted={cachetSafe.corrupted}
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
