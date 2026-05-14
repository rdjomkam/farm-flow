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
import { StatutVague, TypeReleve } from "@/types";

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

const typeReleveLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biométrie",
  [TypeReleve.MORTALITE]: "Mortalité",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualité eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
  [TypeReleve.RENOUVELLEMENT]: "Renouvellement",
  [TypeReleve.TRI]: "Tri",
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
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 14,
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
    backgroundColor: colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 0,
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
// Composant
// ---------------------------------------------------------------------------

export function RapportVaguePDF({ data }: { data: CreateRapportVaguePDFDTO }) {
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
            <Text style={styles.kpiLabel}>FCR</Text>
            <Text style={styles.kpiValue}>
              {data.kpis.fcr !== null
                ? formatNum(data.kpis.fcr, 2)
                : "—"}
            </Text>
            <Text style={styles.kpiUnit}>kg aliment / kg gain</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>SGR</Text>
            <Text style={styles.kpiValue}>
              {data.kpis.sgr !== null
                ? formatNum(data.kpis.sgr, 2, "%/j")
                : "—"}
            </Text>
            <Text style={styles.kpiUnit}>Croissance journalière</Text>
          </View>
        </View>

        {/* ===================== COÛT DE PRODUCTION ===================== */}
        {data.coutProduction && (
          <>
            <Text style={styles.sectionTitle}>Coût de production</Text>
            <View style={styles.kpisGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Coût total</Text>
                <Text style={styles.kpiValue}>{formatFCFA(data.coutProduction.coutTotal)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Coût / kg</Text>
                <Text style={styles.kpiValue}>{formatFCFA(data.coutProduction.coutParKg)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Prix vente / kg</Text>
                <Text style={styles.kpiValue}>{formatFCFA(data.coutProduction.prixMoyenVenteKg)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Marge / kg</Text>
                <Text style={styles.kpiValue}>{formatFCFA(data.coutProduction.margeParKg)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>ROI</Text>
                <Text style={styles.kpiValue}>{formatNum(data.coutProduction.roi, 1, "%")}</Text>
              </View>
            </View>
          </>
        )}

        {/* ===================== BACS ===================== */}
        {data.bacs.length > 0 && (
          <>
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
          </>
        )}

        {/* ===================== HISTORIQUE DES BACS ===================== */}
        {data.assignationTimeline && data.assignationTimeline.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Historique des bacs</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: 80 }]}>Bac</Text>
              <Text style={[styles.tableHeaderText, { width: 70 }]}>Assigné le</Text>
              <Text style={[styles.tableHeaderText, { width: 70 }]}>Retiré le</Text>
              <Text style={[styles.tableHeaderText, { width: 60 }]}>Volume (L)</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Poissons</Text>
            </View>
            {data.assignationTimeline.map((a, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, { width: 80, fontFamily: "Helvetica-Bold" }]}>{a.nomBac}</Text>
                <Text style={[styles.tableCell, { width: 70 }]}>{formatDate(a.dateAssignation)}</Text>
                <Text style={[styles.tableCell, { width: 70 }]}>{a.dateFin ? formatDate(a.dateFin) : "Actif"}</Text>
                <Text style={[styles.tableCell, { width: 60 }]}>{a.volume ?? "—"}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{a.nombrePoissons ?? "—"}</Text>
              </View>
            ))}
          </>
        )}

        {/* ===================== ÉVOLUTION DU POIDS ===================== */}
        {data.evolutionPoidsTable && data.evolutionPoidsTable.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Évolution du poids</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: 65 }]}>Date</Text>
              <Text style={[styles.tableHeaderText, { width: 45 }]}>Jour</Text>
              <Text style={[styles.tableHeaderText, { width: 70 }]}>Poids (g)</Text>
              <Text style={[styles.tableHeaderText, { width: 70 }]}>Taille (cm)</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Échantillon</Text>
            </View>
            {data.evolutionPoidsTable.map((row, i) => (
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, { width: 65 }]}>{formatDate(row.date)}</Text>
                <Text style={[styles.tableCell, { width: 45 }]}>J{row.jourDepuisDebut}</Text>
                <Text style={[styles.tableCell, { width: 70, fontFamily: "Helvetica-Bold" }]}>{formatNum(row.poidsMoyen, 1)}</Text>
                <Text style={[styles.tableCell, { width: 70 }]}>{formatNum(row.tailleMoyenne, 1)}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{row.echantillon ?? "—"}</Text>
              </View>
            ))}
          </>
        )}

        {/* ===================== MODÈLE DE CROISSANCE (GOMPERTZ) ===================== */}
        {data.gompertz && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Modèle de croissance (Gompertz)</Text>
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
          </>
        )}

        {/* ===================== CALIBRAGES ===================== */}
        {data.calibrageHistory && data.calibrageHistory.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Calibrages ({data.calibrageHistory.length})</Text>
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
          </>
        )}

        {/* ===================== RÉSUMÉ MORTALITÉ ===================== */}
        {data.mortalitySummary && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Résumé mortalité</Text>
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
              <>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Cause</Text>
                  <Text style={[styles.tableHeaderText, { width: 60 }]}>Nombre</Text>
                </View>
                {data.mortalitySummary.topCauses.map((c, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{c.cause}</Text>
                    <Text style={[styles.tableCell, { width: 60 }]}>{c.count}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ===================== RÉSUMÉ ALIMENTATION ===================== */}
        {data.feedingSummary && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Résumé alimentation</Text>
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
              <>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Type</Text>
                  <Text style={[styles.tableHeaderText, { width: 60 }]}>Relevés</Text>
                  <Text style={[styles.tableHeaderText, { width: 70 }]}>Total (kg)</Text>
                </View>
                {data.feedingSummary.typeBreakdown.map((t, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{t.type}</Text>
                    <Text style={[styles.tableCell, { width: 60 }]}>{t.count}</Text>
                    <Text style={[styles.tableCell, { width: 70 }]}>{formatNum(t.totalKg, 1)}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ===================== RÉSUMÉ QUALITÉ EAU ===================== */}
        {data.waterQualitySummary && (data.waterQualitySummary.temperature || data.waterQualitySummary.ph || data.waterQualitySummary.oxygene || data.waterQualitySummary.ammoniac) && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Résumé qualité eau</Text>
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
          </>
        )}

        {/* ===================== CONSOMMATION DE STOCK ===================== */}
        {data.stockConsumption && data.stockConsumption.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Consommation de stock</Text>
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
              <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
                <Text style={[styles.tableCell, { flex: 1, fontFamily: "Helvetica-Bold" }]}>{s.nomProduit}</Text>
                <Text style={[styles.tableCell, { width: 70 }]}>{s.categorie}</Text>
                <Text style={[styles.tableCell, { width: 60 }]}>{formatNum(s.quantite, 1)}</Text>
                <Text style={[styles.tableCell, { width: 50 }]}>{s.unite}</Text>
                {data.coutProduction && (
                  <Text style={[styles.tableCell, { width: 80 }]}>{formatFCFA(s.prixTotal)}</Text>
                )}
              </View>
            ))}
          </>
        )}

        {/* ===================== RELEVÉS ===================== */}
        {data.releves.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
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
                style={[
                  styles.tableRow,
                  i % 2 === 1 ? styles.tableRowAlt : {},
                ]}
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
          </>
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
