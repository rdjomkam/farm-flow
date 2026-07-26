/**
 * SU.12 — Audit READ-ONLY des doublons (siteId, numero/code) avant/après la
 * migration de la contrainte d'unicité de globale vers composite par site.
 *
 * Contexte (voir docs/analysis/pre-analysis-sprint-SU-3.md, section
 * « Incohérences trouvées » item 4) : les champs `numero`/`code` des modèles
 * ci-dessous étaient contraints par un `@unique` GLOBAL dans Prisma, alors
 * que le calcul de la séquence (`generateNextNumero`, src/lib/queries/numero-utils.ts)
 * est scopé par `siteId` (+ année pour la plupart, + sexe pour LotGeniteurs).
 * Deux sites distincts généraient donc systématiquement le même numéro
 * (ex. `FAC-2026-001`) dès leur première création de l'année — une collision
 * déterministe, pas une simple race condition.
 *
 * La migration `20260726174843_numero_unique_par_site` remplace le `@unique`
 * global par `@@unique([siteId, numero])` (ou `[siteId, code]`) pour les
 * 9 familles concernées :
 *   Facture, Depense, Commande, Vente, BonLivraison, ListeBesoins,
 *   Ponte (code), Incubation (code), LotGeniteurs (code).
 *
 * SU.13 — `LotAlevins.code` présentait exactement le même double défaut
 * (race condition hors transaction + `@unique` global) mais avait été omis
 * de SU.3/SU.12. La migration
 * `20260726212515_lotalevins_code_unique_par_site` applique le même correctif
 * à cette 10e famille — voir docs/analysis/pre-analysis-sprint-SU-numero.md
 * (item D).
 *
 * STATUT (ADR-050 §4.1, story MG.5) : cet audit N'EST PAS un prérequis
 * bloquant avant le déploiement des migrations `20260726174843_numero_unique_par_site`
 * et `20260726212515_lotalevins_code_unique_par_site` — c'est un outil de
 * diagnostic OPTIONNEL. Raison, contre-intuitive à premiere lecture : un
 * index composite `(siteId, numero)`/`(siteId, code)` est strictement PLUS
 * PERMISSIF que l'ancien `@unique` global sur `numero`/`code` seul (il
 * autorise tout ce que l'ancien autorisait, plus des combinaisons
 * supplémentaires inter-sites). Si l'ancienne contrainte globale interdisait
 * déjà tout doublon de `numero`/`code` tous sites confondus, alors il ne peut
 * *a fortiori* pas exister de doublon `(siteId, numero/code)` sur une base
 * qui sort de cette contrainte — ces migrations ne peuvent donc
 * structurellement pas échouer sur un `CREATE UNIQUE INDEX` pour cause de
 * doublons de données. Voir ADR-050 §4.1 pour le raisonnement complet.
 *
 * Ce script conserve néanmoins une utilité résiduelle réelle, non bloquante :
 *   1. Détecter une dérive de schéma non documentée (ERR-038) — le seul
 *      scénario qui ferait échouer `CREATE UNIQUE INDEX` serait que l'unique
 *      global sur `numero`/`code` ait déjà été retiré ou contourné hors
 *      migration Prisma (hotfix manuel, script de dev). Cet audit reste le
 *      seul moyen de le vérifier empiriquement contre une base réelle.
 *   2. Servir de contrôle avant l'introduction de futures familles de
 *      numérotation scopées par site — toute nouvelle famille `numero`/`code`
 *      migrant un jour d'un `@unique` global vers un composite bénéficierait
 *      du même raisonnement logique, mais relancer cet audit reste un filet
 *      de sécurité peu coûteux, en particulier si le contexte de départ
 *      diffère (ex. une contrainte partant déjà d'un état composite plus
 *      étroit, où le raisonnement de l'ADR-050 §4.1 ne s'appliquerait plus).
 *
 * Voir ADR-050 (docs/decisions/ADR-050-sort-des-scripts-audit.md) pour la
 * décision complète, y compris le sort de l'emplacement canonique des
 * scripts d'audit (`scripts/audits/`, story MG.6 — ce fichier n'a pas encore
 * été déplacé).
 *
 * STRICTEMENT READ-ONLY : aucun UPDATE/INSERT/DELETE n'est jamais émis. Les
 * doublons détectés sont uniquement listés — la remédiation (renommage
 * manuel d'un des deux numéros en doublon) est une décision séparée.
 *
 * Utilise `pg` (node-postgres, déjà une dépendance) en accès direct plutôt
 * que le PrismaClient généré : le générateur Prisma 7 "prisma-client"
 * produit du code ESM (`import.meta.url`) qui échoue sous tsx/CJS (voir
 * MEMORY.md « Prisma 7 + ESM Issue » et ERR-003 dans
 * docs/knowledge/ERRORS-AND-FIXES.md). Un simple SELECT en lecture seule ne
 * justifie pas de contourner ce problème connu.
 *
 * Usage DEV (Docker, port 8432 par défaut — voir .env DATABASE_URL) :
 *   source ~/.nvm/nvm.sh && nvm use 22
 *   npx tsx scripts/audits/su12-audit-doublons-numero.ts
 *
 * Usage PROD (Prisma Postgres) — À LANCER MANUELLEMENT PAR L'UTILISATEUR,
 * jamais depuis cet agent sans autorisation explicite. Diagnostic optionnel
 * (voir STATUT ci-dessus, ADR-050 §4.1) — utile en cas de doute sur une
 * dérive de schéma (ERR-038), pas requis pour que la migration de contrainte
 * réussisse :
 *   DATABASE_URL="<url-de-prod>" npx tsx scripts/audits/su12-audit-doublons-numero.ts
 *
 * Code de sortie :
 *   0 = aucun doublon détecté sur les 10 familles
 *   1 = au moins un doublon (siteId, numero/code) détecté — signale une
 *       dérive de schéma inattendue (ERR-038) à investiguer ; ne bloque pas
 *       à lui seul le déploiement des migrations de contrainte composite
 *       (voir STATUT ci-dessus, ADR-050 §4.1)
 *   2 = erreur d'exécution du script (connexion DB, etc.)
 */

import { Pool } from "pg";

interface TableSpec {
  table: string;
  field: "numero" | "code";
}

// Les 9 familles concernées par SU.12 (voir docs/analysis/pre-analysis-sprint-SU-3.md)
// + LotAlevins (SU.13), pour un total de 10 familles auditées.
const TABLES: TableSpec[] = [
  { table: "Facture", field: "numero" },
  { table: "Depense", field: "numero" },
  { table: "Commande", field: "numero" },
  { table: "Vente", field: "numero" },
  { table: "BonLivraison", field: "numero" },
  { table: "ListeBesoins", field: "numero" },
  { table: "Ponte", field: "code" },
  { table: "Incubation", field: "code" },
  { table: "LotGeniteurs", field: "code" },
  { table: "LotAlevins", field: "code" },
];

export interface DoublonRow {
  table: string;
  field: "numero" | "code";
  siteId: string;
  valeur: string;
  count: number;
  ids: string[];
}

/**
 * Requête GROUP BY siteId, <field> HAVING count(*) > 1 pour une table donnée.
 * Retourne aussi les `id` en conflit (array_agg) pour faciliter la remédiation
 * manuelle sans requête supplémentaire.
 */
export async function findDoublons(
  pool: Pool,
  spec: TableSpec
): Promise<DoublonRow[]> {
  const fieldIdent = `"${spec.field}"`;
  const query = `
    SELECT "siteId", ${fieldIdent} AS valeur, count(*)::int AS count,
           array_agg(id ORDER BY id) AS ids
    FROM "${spec.table}"
    GROUP BY "siteId", ${fieldIdent}
    HAVING count(*) > 1
    ORDER BY "siteId", valeur
  `;
  const { rows } = await pool.query<{
    siteId: string;
    valeur: string;
    count: number;
    ids: string[];
  }>(query);

  return rows.map((r) => ({
    table: spec.table,
    field: spec.field,
    siteId: r.siteId,
    valeur: r.valeur,
    count: r.count,
    ids: r.ids,
  }));
}

function printDoublon(d: DoublonRow): void {
  console.log(
    `${d.table}.${d.field} | siteId=${d.siteId} | valeur="${d.valeur}" | occurrences=${d.count} | ids=[${d.ids.join(", ")}]`
  );
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

async function main(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERREUR : DATABASE_URL n'est pas défini dans l'environnement.");
    return 2;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const allDoublons: DoublonRow[] = [];

  try {
    console.log(
      "=== SU.12 — Audit read-only des doublons (siteId, numero/code) (STRICTEMENT LECTURE SEULE) ==="
    );
    console.log(`Cible : ${maskDatabaseUrl(databaseUrl)}`);
    console.log("");

    for (const spec of TABLES) {
      console.log(`--- ${spec.table}.${spec.field} ---`);
      const doublons = await findDoublons(pool, spec);
      if (doublons.length === 0) {
        console.log("  Aucun doublon.");
      } else {
        for (const d of doublons) {
          printDoublon(d);
          allDoublons.push(d);
        }
      }
      console.log("");
    }

    console.log("=== RÉSUMÉ ===");
    console.log(`Total groupes en doublon détectés : ${allDoublons.length}`);

    if (allDoublons.length > 0) {
      console.log("");
      console.log(
        "AU MOINS UN DOUBLON DÉTECTÉ — ne pas déployer/appliquer la contrainte " +
          "@@unique([siteId, numero|code]) tant que ces lignes ne sont pas " +
          "dédupliquées manuellement (renommage d'un des numéros en conflit)."
      );
      return 1;
    }

    console.log(
      "Aucun doublon (siteId, numero/code) détecté sur les 10 familles auditées. " +
        "La contrainte composite peut être appliquée en toute sécurité."
    );
    return 0;
  } finally {
    await pool.end();
  }
}

/**
 * Ne lance `main()` que si ce fichier est exécuté directement (`npx tsx
 * su12-audit-doublons-numero.ts`), jamais quand il est importé comme module
 * (ex. par un test vitest qui importe `findDoublons` pour un test avec un
 * mock de pool, sans connexion DB réelle).
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
