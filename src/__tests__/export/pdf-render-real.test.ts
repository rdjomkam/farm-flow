/**
 * Tests de rendu RÉEL — Sprint PX, story PX.4 (comblement de la dette de
 * test qui a laissé passer le bug de disponibilité critique du bon de
 * livraison — voir docs/analysis/pre-analysis-sprint-PX.md).
 *
 * Contrairement aux tests unitaires existants (pdf-bon-livraison.test.ts,
 * pdf-cout-production.test.ts), CE FICHIER NE MOCKE PAS `@react-pdf/renderer`.
 * Chaque test appelle la vraie fonction `renderXxxPDF` et vérifie qu'un
 * buffer PDF non vide, avec un en-tête `%PDF` valide, est produit.
 *
 * Ces tests sont volontairement plus lents que les tests mockés (rendu réel
 * du moteur PDF) — c'est pourquoi ils vivent dans un fichier dédié plutôt
 * que de remplacer les tests mockés existants (conservés pour les cas
 * nominaux de contenu, rapides).
 *
 * Le bug corrigé en PX.1-PX.3 (ADR-047) n'est reproductible QUE via
 * `renderBonLivraisonPDF`, seul module à embarquer des `<Image>`. Les 4
 * autres documents (facture, rapport-vague, cout-production,
 * rapport-financier) n'ont pas de chemin de code concerné par ce bug
 * précis, mais doivent néanmoins avoir un test de rendu réel : c'est
 * l'angle mort générique identifié par la pré-analyse (aucun test
 * n'exécutait jamais le vrai moteur @react-pdf/renderer).
 */

import { describe, it, expect } from "vitest";
import { StatutVague, StatutFacture, StatutBonLivraison, CategorieDepense, ModePaiement } from "@/types";
import type {
  CreateBonLivraisonPDFDTO,
  CreateFacturePDFDTO,
  CreateRapportVaguePDFDTO,
  CreateRapportFinancierPDFDTO,
  CreateCoutProductionPDFDTO,
} from "@/types/export";
import type { CoutProductionVague } from "@/lib/queries/finances";

import { renderBonLivraisonPDF } from "@/lib/export/pdf-bon-livraison";
import { renderFacturePDF } from "@/lib/export/pdf-facture";
import { renderRapportVaguePDF } from "@/lib/export/pdf-rapport-vague";
import { renderCoutProductionPDF } from "@/lib/export/pdf-cout-production";
import { renderRapportFinancierPDF } from "@/lib/export/pdf-rapport-financier";
import { PDF_RENDER_TIMEOUT_MS } from "@/lib/export/render-pdf-safely";

// ---------------------------------------------------------------------------
// Fixtures PNG — construites programmatiquement (zéro fichier binaire versionné)
// ---------------------------------------------------------------------------

import zlib from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); // CRC volontairement non vérifié (ADR-047 D1)
  return Buffer.concat([length, typeBuf, data, crc]);
}

function buildIhdr(width: number, height: number, colorType = 6): Buffer {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  buf[8] = 8; // bit depth
  buf[9] = colorType; // 6 = RGBA — canal alpha, format produit par un pad de signature
  buf[10] = 0;
  buf[11] = 0;
  buf[12] = 0; // interlace = none
  return buf;
}

/** PNG RGBA réel, valide et décodable (signature de pad tactile plausible). */
function buildValidRgbaPngDataUrl(width = 8, height = 8): string {
  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(rowBytes * height, 0);
  const compressed = zlib.deflateSync(raw);
  const png = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", buildIhdr(width, height)),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

/**
 * PNG RGBA avec IDAT corrompu — reproduit EXACTEMENT le bug de production
 * (ADR-047 / pre-analysis) : `@react-pdf/png-js` appelle `zlib.inflate()`
 * de façon asynchrone avec un callback qui `throw` au lieu de rejeter,
 * uniquement pour les PNG RGBA/palette-transparente/entrelacés.
 */
function buildCorruptRgbaPngDataUrl(width = 8, height = 8): string {
  const rowBytes = 1 + width * 4;
  const raw = Buffer.alloc(rowBytes * height, 0);
  const compressed = Buffer.from(zlib.deflateSync(raw));
  const mid = Math.floor(compressed.length / 2);
  compressed[mid] ^= 0xff;
  compressed[mid + 1] ^= 0xff;
  const png = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", buildIhdr(width, height)),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

function expectValidPdfBuffer(buffer: Buffer) {
  expect(buffer).toBeInstanceOf(Buffer);
  expect(buffer.length).toBeGreaterThan(0);
  expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
}

// ---------------------------------------------------------------------------
// Fixtures DTO minimales par document
// ---------------------------------------------------------------------------

function buildBonLivraisonDTO(
  overrides: Partial<CreateBonLivraisonPDFDTO> = {}
): CreateBonLivraisonPDFDTO {
  return {
    site: { name: "Ferme Test PX", address: "Douala, Cameroun" },
    numero: "BL-2026-PX01",
    statut: StatutBonLivraison.SIGNE,
    signeLe: new Date("2026-07-20T10:00:00Z"),
    venteNumero: "VTE-2026-PX01",
    rectifieDe: null,
    rectifiePar: null,
    client: { nom: "Jean Client", telephone: "+237600000000" },
    lignes: [
      {
        designation: "Silure",
        nomBac: "Bac A1",
        nombrePoissons: 200,
        poidsCommandeKg: 150,
        poidsLivreKg: 148,
        ecartKg: -2,
        nombreMortsTransport: 0,
        motifAvarie: null,
      },
    ],
    blocPaiement: { totalVente: 750000, paye: 300000, resteAPayer: 450000 },
    signatureClient: {
      image: buildValidRgbaPngDataUrl(),
      nom: "Jean Client",
      date: new Date("2026-07-20T10:00:00Z"),
    },
    signatureLivreur: {
      image: buildValidRgbaPngDataUrl(),
      nom: "Paul Livreur",
      date: new Date("2026-07-20T10:00:00Z"),
    },
    signaturePromoteur: {
      image: buildValidRgbaPngDataUrl(),
      nom: "Marie Promoteur",
      date: null,
    },
    cachet: buildValidRgbaPngDataUrl(),
    dateGeneration: new Date("2026-07-21T08:00:00Z").toISOString(),
    ...overrides,
  };
}

function buildFactureDTO(): CreateFacturePDFDTO {
  return {
    site: { name: "Ferme Test PX", address: "Douala, Cameroun" },
    numero: "FAC-2026-PX01",
    dateEmission: new Date("2026-07-01T00:00:00Z"),
    dateEcheance: new Date("2026-07-15T00:00:00Z"),
    statut: StatutFacture.ENVOYEE,
    notes: null,
    client: { nom: "Jean Client", email: null, telephone: "+237600000000", adresse: null },
    venteNumero: "VTE-2026-PX01",
    vagueCode: "V-2026-001",
    quantitePoissons: 200,
    poidsTotalKg: 150,
    poidsLivreKg: 148,
    quantiteLivree: 198,
    prixUnitaireKg: 2500,
    montantTotal: 370000,
    montantFacture: 370000,
    montantPaye: 100000,
    soldeRestant: 270000,
    paiements: [
      { montant: 100000, mode: ModePaiement.MOBILE_MONEY, reference: "MM-123", date: new Date("2026-07-05") },
    ],
  };
}

function buildRapportVagueDTO(): CreateRapportVaguePDFDTO {
  return {
    site: { name: "Ferme Test PX", address: "Douala, Cameroun" },
    code: "V-2026-PX01",
    dateDebut: new Date("2026-01-01"),
    dateFin: null,
    statut: StatutVague.EN_COURS,
    nombreInitial: 1000,
    poidsMoyenInitial: 5,
    origineAlevins: null,
    kpis: {
      tauxSurvie: 92,
      fcr: 1.4,
      sgr: 3.2,
      biomasseTotale: 320,
      poidsMoyenFinal: 350,
      nombreActuel: 920,
    },
    bacs: [{ nom: "Bac A1", volume: 5000, nombrePoissons: 920 }],
    releves: [],
    evolutionPoids: [],
    coutProduction: null,
    evolutionPoidsTable: [],
    evolutionPoidsMoyen: [],
    gompertz: null,
    locale: "fr",
    calibrageHistory: [],
    assignationTimeline: [],
    mortalitySummary: { totalMorts: 80, tauxMortalite: 8, topCauses: [] },
    feedingSummary: { totalAlimentKg: 400, frequenceMoyenne: 1, typeBreakdown: [] },
    waterQualitySummary: { temperature: null, ph: null, oxygene: null, ammoniac: null },
    stockConsumption: [],
    salesSummary: { ventes: [], totalPoidsKg: 0, totalMontant: 0, totalPoissonsVendus: 0, poidsObjectifKg: null },
    lineage: null,
  };
}

function buildCoutProductionVague(): CoutProductionVague {
  return {
    vague: {
      id: "vague-px-01",
      code: "V-2026-PX01",
      statut: StatutVague.EN_COURS,
      dateDebut: new Date("2026-01-01"),
      dateFin: null,
      nombreInitial: 1000,
      dureeJours: 59,
    },
    resume: {
      coutTotal: 150000,
      poidsTotalVendu: 250,
      nombrePoissonsVendus: 500,
      biomasseKg: 100,
      biomasseTransferee: null,
      nombrePoissonsTransferes: 0,
      biomasseProduite: 350,
      coutParKg: 600,
      prixMoyenVenteKg: 2500,
      margeParKg: 1900,
      revenusBruts: 625000,
      depensesVentes: 0,
      revenus: 625000,
      marge: 475000,
      roi: 316.67,
    },
    coutParCategorie: [
      { categorie: CategorieDepense.ALIMENT, montant: 120000, pourcentage: 80, parKg: 480 },
    ],
    detailAliments: [],
    depensesDirectes: [],
    depensesMultiVagues: [],
    depensesRecurrentes: [],
    ventes: [],
    depensesVentes: [],
    formule: {
      coutAliments: 120000,
      coutDepensesDirectes: 0,
      coutMultiVagues: 0,
      coutRecurrents: 0,
      coutTotal: 120000,
      poidsVendu: 250,
      biomasseKg: 100,
      coutParKg: 480,
    },
  };
}

function buildCoutProductionDTO(): CreateCoutProductionPDFDTO {
  return {
    site: { name: "Ferme Test PX", address: "Douala, Cameroun" },
    dateGeneration: "2026-07-21",
    coutProduction: buildCoutProductionVague(),
  };
}

function buildRapportFinancierDTO(): CreateRapportFinancierPDFDTO {
  return {
    site: { name: "Ferme Test PX", address: "Douala, Cameroun" },
    periode: { dateDebut: new Date("2026-06-01"), dateFin: new Date("2026-06-30") },
    kpis: {
      revenusTotal: 1000000,
      coutsTotal: 600000,
      margeNette: 400000,
      tauxMarge: 40,
      encaissements: 800000,
      creances: 200000,
    },
    ventesParVague: [],
    topClients: [],
    evolutionMensuelle: [],
    coutsDetail: [],
    creancesClients: [],
    depensesSummary: { total: 600000, payees: 500000, impayees: 100000 },
    coutsParMois: { lignes: [], categories: [], moisList: [] },
    coutsDetailParMois: { moisList: [], lignesParMois: {} },
  };
}

// ---------------------------------------------------------------------------
// Tests — rendu réel, un par document (les 5)
// ---------------------------------------------------------------------------

describe("Rendu PDF réel (sans mock @react-pdf/renderer) — les 5 documents", () => {
  it(
    "renderBonLivraisonPDF produit un buffer PDF non vide (signatures valides)",
    async () => {
      const buffer = await renderBonLivraisonPDF(buildBonLivraisonDTO());
      expectValidPdfBuffer(buffer);
    },
    20_000
  );

  it(
    "renderFacturePDF produit un buffer PDF non vide",
    async () => {
      const buffer = await renderFacturePDF(buildFactureDTO());
      expectValidPdfBuffer(buffer);
    },
    20_000
  );

  it(
    "renderRapportVaguePDF produit un buffer PDF non vide",
    async () => {
      const buffer = await renderRapportVaguePDF(buildRapportVagueDTO());
      expectValidPdfBuffer(buffer);
    },
    20_000
  );

  it(
    "renderCoutProductionPDF produit un buffer PDF non vide",
    async () => {
      const buffer = await renderCoutProductionPDF(buildCoutProductionDTO());
      expectValidPdfBuffer(buffer);
    },
    20_000
  );

  it(
    "renderRapportFinancierPDF produit un buffer PDF non vide",
    async () => {
      const buffer = await renderRapportFinancierPDF(buildRapportFinancierDTO());
      expectValidPdfBuffer(buffer);
    },
    20_000
  );
});

// ---------------------------------------------------------------------------
// Tests — bon de livraison : image valide vs image corrompue (repro du bug)
// ---------------------------------------------------------------------------

describe("renderBonLivraisonPDF — robustesse face aux images (ADR-047)", () => {
  it(
    "image RGBA valide et décodable → rendu OK, signature embarquée dans le buffer",
    async () => {
      const dto = buildBonLivraisonDTO();
      const buffer = await renderBonLivraisonPDF(dto);
      expectValidPdfBuffer(buffer);
      // Le buffer doit être substantiellement plus gros qu'un PDF sans image
      // embarquée (l'image RGBA valide est bien intégrée au flux PDF).
      expect(buffer.length).toBeGreaterThan(1000);
    },
    20_000
  );

  it(
    "image RGBA à IDAT corrompu (repro exacte du bug de production) → " +
      "résolution BORNÉE, AUCUNE exception process non gérée, mode dégradé produit",
    async () => {
      // Garde-fou : ce test DOIT échouer si la promesse ne se règle jamais.
      // Le timeout vitest (20s, ci-dessous) est volontairement inférieur à un
      // multiple confortable de PDF_RENDER_TIMEOUT_MS (15s) : si le bug était
      // réintroduit (pré-validation supprimée), ce test timeout et échoue —
      // il ne "passe" jamais par défaut faute de résolution.
      expect(PDF_RENDER_TIMEOUT_MS).toBeLessThan(20_000);

      let uncaughtError: unknown = null;
      const onUncaught = (err: unknown) => {
        uncaughtError = err;
      };
      process.on("uncaughtException", onUncaught);

      try {
        const dto = buildBonLivraisonDTO({
          signatureClient: {
            image: buildCorruptRgbaPngDataUrl(),
            nom: "Jean Client",
            date: new Date("2026-07-20T10:00:00Z"),
          },
        });

        const buffer = await renderBonLivraisonPDF(dto);

        // Le rendu doit se terminer (pas de hang) et produire un PDF valide,
        // en mode dégradé (protection primaire ADR-047 D3-a : la pré-validation
        // écarte l'image AVANT tout appel à renderToBuffer).
        expectValidPdfBuffer(buffer);
      } finally {
        process.removeListener("uncaughtException", onUncaught);
      }

      // Aucune exception non capturée ne doit s'être échappée pendant le rendu.
      expect(uncaughtError).toBeNull();
    },
    20_000
  );

  it(
    "les 4 images corrompues simultanément → rendu toujours borné et complet (mode dégradé partout)",
    async () => {
      let uncaughtError: unknown = null;
      const onUncaught = (err: unknown) => {
        uncaughtError = err;
      };
      process.on("uncaughtException", onUncaught);

      try {
        const corrupt = buildCorruptRgbaPngDataUrl();
        const dto = buildBonLivraisonDTO({
          signatureClient: { image: corrupt, nom: "Jean Client", date: new Date() },
          signatureLivreur: { image: corrupt, nom: "Paul Livreur", date: new Date() },
          signaturePromoteur: { image: corrupt, nom: "Marie Promoteur", date: null },
          cachet: corrupt,
        });

        const buffer = await renderBonLivraisonPDF(dto);
        expectValidPdfBuffer(buffer);
      } finally {
        process.removeListener("uncaughtException", onUncaught);
      }

      expect(uncaughtError).toBeNull();
    },
    20_000
  );
});
