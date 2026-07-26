/**
 * PX.5 — Audit READ-ONLY des images (signatures / cachet) stockées en base.
 *
 * Contexte (voir ADR-047, docs/analysis/pre-analysis-sprint-PX.md) : un PNG
 * RGBA dont le flux IDAT est corrompu, stocké dans une des 4 colonnes
 * ci-dessous, bloque indéfiniment `renderToBuffer()` lors de la génération
 * du PDF du bon de livraison (promesse jamais réglée + uncaught exception
 * process-level, cf. @react-pdf/png-js). PX.1 a durci l'écriture (Zod) et
 * PX.2 a durci la lecture (mode dégradé), mais des données legacy déjà en
 * base (avant ce durcissement) peuvent encore porter une image corrompue.
 *
 * Ce script produit un CONSTAT, rien de plus :
 *   - Colonnes auditées : BonLivraison.signatureClient, signatureLivreur,
 *                          Site.signaturePromoteur, Site.cachet
 *   - Réutilise `decodeImageDataUrl()` de src/lib/validation/image-decode.ts
 *     (PX.1) — AUCUNE réimplémentation du décodage.
 *   - STRICTEMENT READ-ONLY : aucun UPDATE/INSERT/DELETE n'est jamais émis.
 *     Si des lignes corrompues sont détectées, elles sont uniquement
 *     listées dans le rapport — la remédiation (re-demander la signature,
 *     ou nettoyer le champ à NULL) est une décision manuelle séparée,
 *     hors scope de ce script.
 *   - Pagination (LIMIT/OFFSET) pour ne jamais charger toute la table en
 *     mémoire d'un coup : ces colonnes contiennent des data URLs de
 *     ~16 à 28 Ko chacune.
 *   - Utilise `pg` (node-postgres, déjà une dépendance du projet) en accès
 *     direct plutôt que le PrismaClient généré : le générateur Prisma 7
 *     "prisma-client" produit du code ESM (`import.meta.url`) qui échoue
 *     sous tsx/CJS (voir MEMORY.md « Prisma 7 + ESM Issue » et ERR-003).
 *     Un simple SELECT en lecture seule ne justifie pas de contourner ce
 *     problème connu — `pg` est direct, fiable, et suffisant ici.
 *
 * Usage DEV (Docker, port 8432 par défaut — voir .env DATABASE_URL) :
 *   source ~/.nvm/nvm.sh && nvm use 22
 *   npx tsx scripts/data-fixes/px-audit-signatures-corrompues.ts
 *
 * Usage PROD (Prisma Postgres) — À LANCER MANUELLEMENT PAR L'UTILISATEUR,
 * jamais depuis cet agent sans autorisation explicite :
 *   DATABASE_URL="<url-de-prod>" npx tsx scripts/data-fixes/px-audit-signatures-corrompues.ts
 *
 * Code de sortie :
 *   0 = tout est décodable (ou aucune ligne à inspecter)
 *   1 = au moins une image non décodable détectée
 *   2 = erreur d'exécution du script (connexion DB, etc.)
 */

import { Pool } from "pg";
import { decodeImageDataUrl } from "../../src/lib/validation/image-decode";

const PAGE_SIZE = 100;

interface AuditRow {
  table: string;
  identifiant: string;
  champ: string;
}

interface AuditResult extends AuditRow {
  decodable: boolean;
  format: string | null;
  tailleOctets: number;
  reason?: string;
}

export function dataUrlByteSize(dataUrl: string): number {
  // Taille approximative en octets du payload binaire réel (après décodage
  // base64), pas la taille de la chaîne data URL elle-même.
  const commaIndex = dataUrl.indexOf(",");
  const base64Payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const padding = (base64Payload.match(/=*$/)?.[0].length ?? 0);
  return Math.max(0, Math.floor((base64Payload.length * 3) / 4) - padding);
}

export function auditValue(row: AuditRow, value: string): AuditResult {
  const result = decodeImageDataUrl(value);
  return {
    ...row,
    decodable: result.ok,
    format: result.format,
    tailleOctets: dataUrlByteSize(value),
    reason: result.reason,
  };
}

/**
 * Pagine sur BonLivraison (signatureClient, signatureLivreur) via LIMIT/OFFSET,
 * ordonné par id pour une pagination stable. Ne SELECT que les colonnes
 * nécessaires (jamais SELECT *).
 */
async function* iterateBonLivraisonPages(pool: Pool) {
  let offset = 0;
  for (;;) {
    const { rows } = await pool.query<{
      id: string;
      numero: string;
      signatureClient: string | null;
      signatureLivreur: string | null;
    }>(
      `SELECT id, numero, "signatureClient", "signatureLivreur"
       FROM "BonLivraison"
       WHERE "signatureClient" IS NOT NULL OR "signatureLivreur" IS NOT NULL
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, offset]
    );
    if (rows.length === 0) return;
    yield rows;
    if (rows.length < PAGE_SIZE) return;
    offset += PAGE_SIZE;
  }
}

/**
 * Pagine sur Site (signaturePromoteur, cachet) via LIMIT/OFFSET.
 */
async function* iterateSitePages(pool: Pool) {
  let offset = 0;
  for (;;) {
    const { rows } = await pool.query<{
      id: string;
      name: string;
      signaturePromoteur: string | null;
      cachet: string | null;
    }>(
      `SELECT id, name, "signaturePromoteur", "cachet"
       FROM "Site"
       WHERE "signaturePromoteur" IS NOT NULL OR "cachet" IS NOT NULL
       ORDER BY id
       LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, offset]
    );
    if (rows.length === 0) return;
    yield rows;
    if (rows.length < PAGE_SIZE) return;
    offset += PAGE_SIZE;
  }
}

function printRow(r: AuditResult): void {
  const statut = r.decodable ? "OUI" : "NON";
  const format = r.format ?? "inconnu";
  const tailleKo = (r.tailleOctets / 1024).toFixed(1);
  const base = `${r.table} | ${r.identifiant} | ${r.champ} | décodable=${statut} | format=${format} | taille=${tailleKo} Ko`;
  if (!r.decodable && r.reason) {
    console.log(`${base} | raison="${r.reason}"`);
  } else {
    console.log(base);
  }
}

async function main(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERREUR : DATABASE_URL n'est pas défini dans l'environnement.");
    return 2;
  }

  const pool = new Pool({ connectionString: databaseUrl });

  const results: AuditResult[] = [];

  try {
    console.log("=== PX.5 — Audit read-only des signatures/cachet (STRICTEMENT LECTURE SEULE) ===");
    console.log(`Cible : ${maskDatabaseUrl(databaseUrl)}`);
    console.log("");

    console.log("--- BonLivraison.signatureClient / signatureLivreur ---");
    for await (const page of iterateBonLivraisonPages(pool)) {
      for (const bl of page) {
        if (bl.signatureClient) {
          const r = auditValue(
            { table: "BonLivraison", identifiant: `${bl.id} (${bl.numero})`, champ: "signatureClient" },
            bl.signatureClient
          );
          results.push(r);
          printRow(r);
        }
        if (bl.signatureLivreur) {
          const r = auditValue(
            { table: "BonLivraison", identifiant: `${bl.id} (${bl.numero})`, champ: "signatureLivreur" },
            bl.signatureLivreur
          );
          results.push(r);
          printRow(r);
        }
      }
    }

    console.log("");
    console.log("--- Site.signaturePromoteur / cachet ---");
    for await (const page of iterateSitePages(pool)) {
      for (const site of page) {
        if (site.signaturePromoteur) {
          const r = auditValue(
            { table: "Site", identifiant: `${site.id} (${site.name})`, champ: "signaturePromoteur" },
            site.signaturePromoteur
          );
          results.push(r);
          printRow(r);
        }
        if (site.cachet) {
          const r = auditValue(
            { table: "Site", identifiant: `${site.id} (${site.name})`, champ: "cachet" },
            site.cachet
          );
          results.push(r);
          printRow(r);
        }
      }
    }

    const nonDecodables = results.filter((r) => !r.decodable);

    console.log("");
    console.log("=== RÉSUMÉ ===");
    console.log(`Total inspecté      : ${results.length}`);
    console.log(`Total non décodable : ${nonDecodables.length}`);

    if (nonDecodables.length > 0) {
      console.log("");
      console.log("Lignes NON décodables (aucune action automatique — remédiation manuelle séparée) :");
      for (const r of nonDecodables) {
        printRow(r);
      }
      return 1;
    }

    console.log("Toutes les images inspectées sont décodables.");
    return 0;
  } finally {
    await pool.end();
  }
}

/** Masque le mot de passe dans l'URL affichée dans les logs. */
function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "***";
    return parsed.toString();
  } catch {
    return "(URL non parseable — masquée par précaution)";
  }
}

/**
 * Ne lance `main()` que si ce fichier est exécuté directement (`npx tsx
 * px-audit-signatures-corrompues.ts`), jamais quand il est importé comme
 * module (ex. par un test vitest qui importe `auditValue`/`dataUrlByteSize`
 * pour un test sans connexion DB — voir scripts/data-fixes/__tests__/).
 */
const isMainModule = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`;
  } catch {
    return false;
  }
})();

if (isMainModule) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error("ERREUR inattendue pendant l'audit :", err instanceof Error ? err.message : err);
      process.exitCode = 2;
    });
}
