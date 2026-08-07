/**
 * Générateur PDF — Prévisions (scénario)
 *
 * Document A4 paysage : une page de prélude (identité du scénario,
 * paramètres, granulométries, budget) puis des pages de données où
 * TOUS les indicateurs (Résultat, Production, Aliments, Entrées-Dépenses)
 * apparaissent sur chaque page, découpés en tranches de 7 mois.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
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

function moisLabel(dateDebutPlan: Date, moisAbsolu: number): string {
  const date = new Date(
    dateDebutPlan.getFullYear(),
    dateDebutPlan.getMonth() + moisAbsolu,
    1
  );
  return `${MOIS_COURTS_FR[date.getMonth()]} ${date.getFullYear()}`;
}

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

const MOIS_PAR_PAGE = 7;

function decouperEnTranches<T>(items: T[], taille: number): T[][] {
  if (items.length === 0) return [[]];
  const tranches: T[][] = [];
  for (let i = 0; i < items.length; i += taille) {
    tranches.push(items.slice(i, i + taille));
  }
  return tranches;
}

interface LigneIndicateur {
  libelle: string;
  accessor: (m: MoisProjectionExportInfo) => number;
  agregation?: "somme" | "dernier";
}

interface SectionIndicateurs {
  titre: string;
  lignes: LigneIndicateur[];
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
  sectionBg: "#e2e8f0",
  success: "#16a34a",
  danger: "#dc2626",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: colors.dark,
    backgroundColor: "#ffffff",
    padding: 30,
    paddingBottom: 50,
  },
  header: {
    marginBottom: 14,
    paddingBottom: 10,
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
    fontSize: 9,
    color: colors.muted,
  },
  headerMeta: {
    alignItems: "flex-end",
  },
  metaText: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 1,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    marginBottom: 8,
    marginTop: 14,
  },
  kvTable: { marginBottom: 4 },
  kvRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
  },
  kvLabel: { flex: 2, fontSize: 8, color: colors.muted },
  kvValue: { flex: 2, fontSize: 8, fontFamily: "Helvetica-Bold" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    color: colors.dark,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    textAlign: "right",
  },
  tableHeaderLabel: {
    color: colors.dark,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.sectionBg,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: colors.dark,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
  },
  colLabel: { flex: 2.4, fontSize: 7, paddingLeft: 6 },
  colValue: { flex: 1, fontSize: 7, textAlign: "right" },
  colValueTotal: { flex: 1, fontSize: 7, textAlign: "right", fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopStyle: "solid",
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: colors.muted },
});

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function Footer({ siteName }: { siteName: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>FarmFlow — {siteName} — Export Prévisions</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function PageHeader({
  titre,
  sousTitre,
  dateExport,
}: {
  titre: string;
  sousTitre: string;
  dateExport: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerFlex}>
        <View>
          <Text style={styles.title}>{titre}</Text>
          <Text style={styles.subtitle}>{sousTitre}</Text>
        </View>
        <View style={styles.headerMeta}>
          <Text style={styles.metaText}>Généré le {formatDate(dateExport)}</Text>
        </View>
      </View>
    </View>
  );
}

/** Page de données : TOUTES les sections d'indicateurs, pour une tranche de mois. */
function TableauCompletPage({
  data,
  dateDebutPlan,
  tranche,
  trancheIndex,
  totalTranches,
  sections,
}: {
  data: CreatePrevisionExportDTO;
  dateDebutPlan: Date;
  tranche: MoisProjectionExportInfo[];
  trancheIndex: number;
  totalTranches: number;
  sections: SectionIndicateurs[];
}) {
  const estDerniereTranche = trancheIndex === totalTranches - 1;
  const periodeLabel = `Mois ${tranche[0].moisAbsolu + 1}–${tranche[tranche.length - 1].moisAbsolu + 1} sur ${data.projection.horizonMois}`;

  return (
    <Page size="A4" orientation="landscape" style={styles.page} wrap>
      <PageHeader
        titre={data.scenario.nom}
        sousTitre={`${periodeLabel} — ${data.siteName}`}
        dateExport={data.exportDate}
      />

      {/* En-tête colonnes */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderLabel, { flex: 2.4 }]}>Indicateur</Text>
        {tranche.map((m) => (
          <Text key={m.moisAbsolu} style={[styles.tableHeaderText, { flex: 1 }]}>
            {moisLabel(dateDebutPlan, m.moisAbsolu)}
          </Text>
        ))}
        {estDerniereTranche && (
          <Text style={[styles.tableHeaderText, { flex: 1 }]}>TOTAL</Text>
        )}
      </View>

      {/* Toutes les sections empilées */}
      {sections.map((section) => (
        <View key={section.titre}>
          {/* Bandeau de section */}
          <View style={styles.sectionHeaderRow} wrap={false}>
            <Text style={styles.sectionHeaderText}>{section.titre}</Text>
          </View>

          {/* Lignes d'indicateurs */}
          {section.lignes.map((ligne, i) => {
            const valeurs = tranche.map((m) => ligne.accessor(m));
            let total: number | null = null;
            if (estDerniereTranche) {
              const toutesValeurs = data.projection.mois.map((m) => ligne.accessor(m));
              total =
                ligne.agregation === "dernier"
                  ? (toutesValeurs[toutesValeurs.length - 1] ?? 0)
                  : toutesValeurs.reduce((s, v) => s + v, 0);
            }
            return (
              <View key={i} style={styles.tableRow} wrap={false}>
                <Text style={styles.colLabel}>{ligne.libelle}</Text>
                {valeurs.map((v, j) => (
                  <Text
                    key={j}
                    style={[styles.colValue, { color: v < 0 ? colors.danger : colors.dark }]}
                  >
                    {fmtNum(v)}
                  </Text>
                ))}
                {estDerniereTranche && total !== null && (
                  <Text
                    style={[styles.colValueTotal, { color: total < 0 ? colors.danger : colors.dark }]}
                  >
                    {fmtNum(total)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ))}

      <Footer siteName={data.siteName} />
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export function PrevisionPDF({ data }: { data: CreatePrevisionExportDTO }) {
  const dateDebutPlan = new Date(data.scenario.dateDebutPlan);
  const tranches = decouperEnTranches(data.projection.mois, MOIS_PAR_PAGE);

  const granulometries = Array.from(
    new Set(data.projection.mois.flatMap((m) => Object.keys(m.sacsParGranulometrie)))
  ).sort();

  const sections: SectionIndicateurs[] = [
    {
      titre: "Résultat",
      lignes: [
        { libelle: "Total entrées (FCFA)", accessor: (m) => m.revenusFCFA + m.apportsFCFA },
        { libelle: "Total dépenses (FCFA)", accessor: (m) => m.depensesFCFA },
        { libelle: "Résultat mensuel (FCFA)", accessor: (m) => m.resultatFCFA },
        { libelle: "Solde cumulé (FCFA)", accessor: (m) => m.soldeFCFA, agregation: "dernier" },
      ],
    },
    {
      titre: "Production",
      lignes: [
        { libelle: "Empoissonné (kg)", accessor: (m) => m.empoissonneKg },
        { libelle: "Ventes (kg)", accessor: (m) => m.ventesKg },
        { libelle: "Alevins à commander", accessor: (m) => m.alevinsACommanderNb },
      ],
    },
    {
      titre: "Aliments",
      lignes: [
        { libelle: "Besoin total (kg)", accessor: (m) => m.besoinAlimentsTotalKg },
        { libelle: "Sacs à acheter", accessor: (m) => m.sacsAlimentsTotal },
        ...granulometries.map((g) => ({
          libelle: `Sacs ${g}`,
          accessor: (m: MoisProjectionExportInfo) => m.sacsParGranulometrie[g] ?? 0,
        })),
      ],
    },
    {
      titre: "Entrées & Dépenses détaillées",
      lignes: [
        { libelle: "Revenus (FCFA)", accessor: (m) => m.revenusFCFA },
        { libelle: "Apports (FCFA)", accessor: (m) => m.apportsFCFA },
        { libelle: "Coût aliments (FCFA)", accessor: (m) => m.coutAlimentsFCFA },
        { libelle: "Coût alevins (FCFA)", accessor: (m) => m.coutAlevinsFCFA },
        { libelle: "Charges réparties (FCFA)", accessor: (m) => m.baseRepartitionFCFA },
        { libelle: "Investissements (FCFA)", accessor: (m) => m.investissementsFCFA },
        { libelle: "Épargne conseillée (FCFA)", accessor: (m) => m.epargneFCFA },
      ],
    },
  ];

  return (
    <Document title={`Prévisions — ${data.scenario.nom}`} author="FarmFlow">
      {/* ===================== PAGE 1 — PRÉLUDE ===================== */}
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <PageHeader
          titre={`PRÉVISIONS — ${data.scenario.nom}`}
          sousTitre={data.siteName}
          dateExport={data.exportDate}
        />

        <Text style={styles.sectionTitle}>Scénario</Text>
        <View style={styles.kvTable}>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Code</Text>
            <Text style={styles.kvValue}>{data.scenario.code}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Statut</Text>
            <Text style={styles.kvValue}>{data.scenario.statut}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Date de début du plan</Text>
            <Text style={styles.kvValue}>{formatDate(data.scenario.dateDebutPlan)}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Durée de cycle</Text>
            <Text style={styles.kvValue}>{data.scenario.dureeCycleMois} mois</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Horizon</Text>
            <Text style={styles.kvValue}>{data.projection.horizonMois} mois</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Paramètres</Text>
        <View style={styles.kvTable}>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Effectif alevins / vague</Text>
            <Text style={styles.kvValue}>{data.parametres.effectifAlevinsParVague}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Poids moyen initial / objectif</Text>
            <Text style={styles.kvValue}>
              {data.parametres.poidsMoyenInitialG} g / {data.parametres.poidsObjectifG} g
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Prix alevin / kg vente</Text>
            <Text style={styles.kvValue}>
              {formatMontant(data.parametres.prixAlevinUnitaireFCFA)} / {formatMontant(data.parametres.prixVenteKgFCFA)}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Bacs simultanés cible</Text>
            <Text style={styles.kvValue}>{data.parametres.nombreBacsSimultanesCible}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Taux épargne</Text>
            <Text style={styles.kvValue}>{data.parametres.tauxEpargnePct} %</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Trésorerie initiale</Text>
            <Text style={styles.kvValue}>{formatMontant(data.parametres.tresorerieInitialeFCFA)}</Text>
          </View>
        </View>

        {data.aliments.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Granulométries</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderLabel, { flex: 2 }]}>Libellé</Text>
              <Text style={[styles.tableHeaderLabel, { flex: 1 }]}>Taille</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Poids sac (kg)</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Prix sac (FCFA)</Text>
            </View>
            {data.aliments.map((a, i) => (
              <View key={i} style={styles.tableRow} wrap={false}>
                <Text style={[styles.colLabel, { flex: 2, paddingLeft: 0 }]}>{a.libelle}</Text>
                <Text style={[styles.colValue, { flex: 1, textAlign: "left" }]}>
                  {a.tailleGranule}
                </Text>
                <Text style={[styles.colValue, { flex: 1 }]}>{a.poidsSacKg}</Text>
                <Text style={[styles.colValue, { flex: 1 }]}>{fmtNum(a.prixSacFCFA)}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Budget total du plan</Text>
        <View style={styles.kvTable}>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Coûts de production</Text>
            <Text style={styles.kvValue}>
              {formatMontant(data.projection.budget.totalCoutsProductionFCFA)}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Charges hors production</Text>
            <Text style={styles.kvValue}>
              {formatMontant(data.projection.budget.totalChargesHorsProductionFCFA)}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Apports</Text>
            <Text style={styles.kvValue}>
              {formatMontant(data.projection.budget.totalApportsFCFA)}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvLabel}>Budget total</Text>
            <Text style={styles.kvValue}>
              {formatMontant(data.projection.budget.budgetTotalFCFA)}
            </Text>
          </View>
          {data.projection.pointBas && (
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Point bas de trésorerie</Text>
              <Text style={[styles.kvValue, { color: colors.danger }]}>
                {formatMontant(data.projection.pointBas.pointBasFCFA)} —{" "}
                {moisLabel(dateDebutPlan, data.projection.pointBas.moisAbsolu)}
              </Text>
            </View>
          )}
        </View>

        <Footer siteName={data.siteName} />
      </Page>

      {/* ===================== PAGES DE DONNÉES ===================== */}
      {/* Chaque page = TOUS les indicateurs pour une tranche de ≤7 mois */}
      {tranches.map((tranche, i) => (
        <TableauCompletPage
          key={i}
          data={data}
          dateDebutPlan={dateDebutPlan}
          tranche={tranche}
          trancheIndex={i}
          totalTranches={tranches.length}
          sections={sections}
        />
      ))}
    </Document>
  );
}

export function generatePrevisionPDF(data: CreatePrevisionExportDTO): Promise<Buffer> {
  return renderToBuffer(<PrevisionPDF data={data} />);
}
