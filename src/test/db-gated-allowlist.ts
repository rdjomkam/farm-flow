/**
 * Allowlist des tests d'intégration DB-gated — ADR-052 §3.4.
 *
 * Une entrée par OCCURRENCE de `describe.runIf`/`skipIf`/`*.skip` (pas une
 * entrée par fichier — `su12-numero-unique-constraint.test.ts` en compte
 * deux, une par bloc `describe.runIf`).
 *
 * Chaque entrée doit porter une `justification` non vide décrivant la
 * ressource externe réelle en jeu (moteur Postgres — SAVEPOINT, transaction,
 * contrainte unique — jamais une justification générique du type « test
 * lent » ou « pratique »). Le test méta
 * (`src/__tests__/meta/db-gated-tests-registry.test.ts`) vérifie que
 * `justification.length` dépasse un seuil minimal pour empêcher une entrée
 * ajoutée à la hâte sans explication.
 *
 * Étendre cette allowlist doit être visiblement plus pénible que d'écrire un
 * test qui n'a pas besoin d'être gated (mock au lieu d'intégration réelle) —
 * c'est le comportement par défaut souhaité : un test devrait rester mocké
 * sauf s'il prouve un comportement du moteur DB lui-même.
 */
export interface DbGatedAllowlistEntry {
  /** Chemin relatif à la racine du dépôt. */
  file: string;
  /** Motif littéral de la ligne source (après trim), tel qu'il apparaît réellement dans le fichier. */
  linePattern: string;
  /** Pourquoi ce gate est légitime : quelle ressource externe réelle, quelle garantie prouvée. */
  justification: string;
  /** Référence ADR justifiant l'existence de ce gate. */
  adr: string;
}

export const DB_GATED_ALLOWLIST: DbGatedAllowlistEntry[] = [
  {
    file: "src/lib/queries/__tests__/bd0-savepoint-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve que le SAVEPOINT + ROLLBACK TO SAVEPOINT posé par createReleve désavorte " +
      "réellement une transaction Postgres après une vraie erreur SQL (42P01) survenant " +
      "dans calculerEcartsParBac — un mock ne peut pas reproduire l'état 'transaction " +
      "aborted' (25P02) d'un vrai moteur Postgres (ERR-113/ERR-115).",
    adr: "ADR-052",
  },
  {
    file: "src/lib/queries/__tests__/bd0-savepoint-integration-persister-origin.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve que la sonde canary (SELECT 1) détecte une transaction Postgres empoisonnée " +
      "même quand l'erreur SQL survient à l'intérieur de persisterEcartConstate, qui avale " +
      "ses propres erreurs sans jamais les relancer en JS — nécessite un vrai moteur " +
      "Postgres pour observer cet état, impossible à simuler par un mock (ERR-114).",
    adr: "ADR-052",
  },
  {
    file: "src/lib/queries/__tests__/bons-livraison-transaction-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve un rollback réel de signerBonLivraison contre une vraie transaction Postgres " +
      "(aucun effet partiel après un rejet réel de verifyAssignationInvariant) et le " +
      "verrouillage réel de lignes lors d'une double signature concurrente — comportement " +
      "du moteur, structurellement non prouvable par un mock de $transaction.",
    adr: "ADR-052",
  },
  // 2 entrées distinctes, une par bloc `describe.runIf`, ADR-052 §3.4 — ne pas fusionner.
  {
    file: "scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve que la contrainte d'unicité composite (siteId, numero) est réellement " +
      "appliquée par le moteur Postgres (violation 23505 sur INSERT dupliqué au sein d'un " +
      "même site, acceptation du même numero sur deux sites distincts) — pas seulement " +
      "simulée côté Prisma.",
    adr: "ADR-052",
  },
  {
    file: "scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Vérifie via pg_indexes (catalogue système Postgres réel) que chacune des 10 tables " +
      "migrées SU.12/SU.13 expose bien un index unique composite (siteId, numero|code) et " +
      "qu'aucun index unique global résiduel ne subsiste sur le champ seul — introspection " +
      "du moteur, sans équivalent mockable significatif.",
    adr: "ADR-052",
  },
  {
    file: "src/lib/queries/__tests__/previsions-int-fractional-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve empiriquement (story PR2.1) le comportement RÉEL du client Prisma face à une " +
      "valeur fractionnaire écrite dans une colonne Int (AlimentParVaguePrevue.sacsCalcules/ " +
      "sacsSaisis) : troncature silencieuse (Math.trunc, pas de rejet), différent du driver " +
      "pg nu (rejet 22P02) — un mock ne peut pas reproduire cette divergence réelle entre le " +
      "client Prisma et Postgres, seul un vrai aller-retour le révèle (bug documenté dans " +
      "docs/tests/rapport-story-PR2.1.md).",
    adr: "ADR-052",
  },
  {
    file: "src/lib/queries/__tests__/previsions-scenarios-copie-produits-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve contre un vrai schéma Postgres (contrainte NOT NULL réelle sur " +
      "AlimentPrevision) le chemin nominal de création de scénario sur un site avec des " +
      "Produit ALIMENT actifs — régression PR2-quater où tx.alimentPrevision.create() " +
      "omettait un champ requis (500 systématique) : un mock JS (previsions-fake-db.ts) " +
      "n'applique aucune contrainte NOT NULL et ne peut jamais faire échouer un create() " +
      "auquel il manque un champ requis, seul un vrai Prisma Client contre un vrai " +
      "Postgres peut exercer cette validation. Couvre aussi le rollback complet " +
      "(ScenarioPrevision + ParametresPrevision + AlimentPrevision + " +
      "AlimentArticlePrevision) quand un Produit ALIMENT actif n'a pas de tailleGranule.",
    adr: "ADR-052",
  },
  {
    file: "src/lib/queries/__tests__/previsions-rapprochement-mapping-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve contre un vrai schéma Postgres (contrainte réelle " +
      "@@unique([siteId, version, sourceType, sourceCle]) et transaction Prisma réelle " +
      "updateMany+createMany) le versionnement de MappingRapprochement (ADR-053 §3.9/§15.3, " +
      "Sprint PR3 story PR3.3) : v1 reste lisible ET INCHANGÉE après création de v2, " +
      "getMappingActif ne renvoie que la version courante — un mock JS n'exerce ni la " +
      "contrainte d'unicité ni l'atomicité de la transaction.",
    adr: "ADR-053",
  },
  {
    file: "src/lib/queries/__tests__/previsions-rapprochement-mapping-non-mappees-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve contre un vrai schéma Postgres (JOIN MouvementStock/Produit + COALESCE sur " +
      "tailleGranule via $queryRaw) le correctif de la review du sprint PR3 (Moyenne #2, " +
      "docs/reviews/review-sprint-PR3.md) : getCategoriesReellesNonMappees couvre désormais " +
      "SourceRapprochement.MOUVEMENT_STOCK au même titre que DEPENSE_CATEGORIE/" +
      "PRODUIT_CATEGORIE/VENTE, avec la même sémantique de clé que " +
      "getSortiesAlimentReellesParGranulometrie (COALESCE(tailleGranule::text,'INCONNU'), " +
      "filtre type=SORTIE et catégorie=ALIMENT) — un mock JS n'exerce ni le JOIN SQL réel " +
      "ni le COALESCE, et ne peut prouver par falsification (ERR-172, aucun jeu d'or pour " +
      "le rapprochement) que la détection discrimine bien MOUVEMENT_STOCK inclus/exclu.",
    adr: "ADR-053",
  },
  {
    file: "src/lib/queries/__tests__/previsions-snapshot-budget-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve contre un vrai schéma Postgres (contrainte réelle @@unique([scenarioId, " +
      "moisAbsolu, posteId, categorie]) et transaction Prisma réelle) le gel transactionnel " +
      "du SnapshotBudgetInitial à l'activation d'un scénario (ADR-053 §15.2, Sprint PR3 " +
      "story PR3.3) : le snapshot et le passage à ACTIF sont écrits dans la MÊME " +
      "transaction, une seconde tentative d'activation est refusée (409) et NE MODIFIE " +
      "PAS le snapshot déjà figé même si les données sources ont été éditées entre-temps " +
      "— un mock JS n'exerce ni la contrainte d'unicité ni l'atomicité réelle.",
    adr: "ADR-053",
  },
  {
    file: "src/lib/queries/__tests__/previsions-rapprochement-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve contre un vrai schéma Postgres les agrégations SQL brutes du rapprochement " +
      "prévu/réel (ADR-053 §5/§15, Sprint PR3 story PR3.5) : GROUP BY + EXTRACT(YEAR/MONTH) " +
      "sur Depense/Vente/MouvementStock, JOIN LigneDepense→Produit pour le bucket " +
      "GRANULOMETRIE_INCONNUE, et surtout l'immuabilité réelle d'un mois clôturé (lecture " +
      "de ClotureMois.versionMapping figée en base malgré la création d'une nouvelle " +
      "version active de MappingRapprochement ensuite, contrainte @@unique réelle sur le " +
      "versionnement) — un mock JS ne peut exercer ni un vrai GROUP BY/JOIN SQL, ni la " +
      "contrainte d'unicité versionnée, ni la persistance réelle de la clôture.",
    adr: "ADR-053",
  },
  {
    file: "src/lib/queries/__tests__/previsions-tresorerie-trois-series-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve contre un vrai schéma Postgres l'assemblage de la vue trésorerie à 3 séries " +
      "(ADR-053 §6.5/§15.1(b)/§15.2, Sprint PR3-ter story B.3) : le GEL du BUDGET INITIAL " +
      "dans SnapshotBudgetInitial résiste réellement à une édition post-activation d'une " +
      "ChargeMensuellePrevue en place (transaction d'activation déjà écrite en base), la " +
      "REPRÉVISION GLISSANTE bascule sur le REEL uniquement pour un mois réellement " +
      "CLÔTURÉ (ClotureMois créé en base, contrainte @@unique([scenarioId, moisAbsolu])) " +
      "et le netting du RÉEL agrège de vraies lignes Depense via $queryRaw/GROUP BY — un " +
      "mock JS ne peut ni exercer une vraie transaction d'activation atomique, ni une " +
      "vraie contrainte de clôture, ni un vrai GROUP BY SQL.",
    adr: "ADR-053",
  },
  {
    file: "src/lib/queries/__tests__/previsions-cloture-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve contre un vrai schéma Postgres (contrainte réelle @@unique([scenarioId, " +
      "moisAbsolu]) et transaction Prisma réelle lecture-version-active + create) le " +
      "figeage de ClotureMois.versionMapping à la clôture d'un mois (ADR-053 §3.10/§15.3, " +
      "Sprint PR3 story PR3.6) : la version figée à la clôture reste inchangée même après " +
      "création d'une nouvelle version du mapping, une seconde clôture du même mois est " +
      "refusée (409), une clôture hors de l'horizon du plan est refusée (422), et " +
      "l'isolation siteId du mapping actif est vérifiée entre deux sites — un mock JS " +
      "n'exerce ni la contrainte d'unicité ni l'atomicité de la transaction.",
    adr: "ADR-053",
  },
  {
    file: "src/lib/queries/__tests__/previsions-vagues-couts-reels-integration.test.ts",
    linePattern:
      'describe.runIf(requireDatabaseUrl())("PR3.7 — previsions-vagues-couts-reels : agregation reelle par vague", () => {',
    justification:
      "Prouve contre un vrai schéma Postgres les deux agrégations SQL brutes ($queryRaw, " +
      "SUM, GROUP BY, IN (...) via Prisma.join) de getCoutsReelsParVagues (ADR-053 §15, " +
      "Sprint PR3 story PR3.7, onglet Rapprochement — vue par vague) : plusieurs lignes de " +
      "Depense/Vente pour la même Vague s'agrègent correctement (SUM réel), une Vague sans " +
      "aucun mouvement ressort quand même avec des totaux à 0 (jamais absente), et le " +
      "filtre siteId (R8) isole deux sites — un mock JS ne peut prouver qu'un vrai GROUP " +
      "BY/SUM Postgres agrège correctement plusieurs lignes réelles pour une même vague.",
    adr: "ADR-053",
  },
  {
    file: "src/lib/queries/__tests__/previsions-rapprochement-aliment-scope-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve contre un vrai schéma Postgres la correction structurelle de la portée du " +
      "mapping ALIMENT_PREVISION (Sprint PR3-ter, story A.3, ADR-053 §3.9) : deux " +
      "ScenarioPrevision réels du même site, chacun avec son propre AlimentPrevision " +
      "auto-copié (contrainte réelle @@unique([scenarioId, tailleGranule]), " +
      "copierAlimentsPrevisionDepuisProduits exécuté en vraie transaction Prisma à la " +
      "création du scénario) ; un mapping composé avec l'id du scénario A doit se résoudre " +
      "dynamiquement, à la lecture, vers l'AlimentPrevision du scénario B — reproduisant " +
      "exactement la disparition silencieuse de montant prouvée par la pré-analyse — un mock " +
      "JS ne peut ni exercer la contrainte d'unicité réelle par scénario, ni prouver que la " +
      "copie automatique à la création produit deux id distincts pour la même tailleGranule.",
    adr: "ADR-053",
  },
  {
    file: "src/lib/queries/__tests__/previsions-mapping-orphelins-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve contre un vrai schéma Postgres le filet de sécurité non négociable de " +
      "détection de cible orpheline (Sprint PR3-ter, story A.1, ADR-053 §3.9) : un mapping " +
      "actif réel, en base, ciblant un PostePrevision.id du scénario A, doit être signalé " +
      "cibleOrpheline=true quand évalué contre un second ScenarioPrevision réel du même " +
      "site qui ne porte pas ce poste (chargerScenarioPourMoteur exécute 7 requêtes Prisma " +
      "réelles), et cibleOrpheline=false contre le scénario d'origine — un mock JS ne peut " +
      "prouver que la résolution fonctionne contre des données cross-scénario réellement " +
      "persistées.",
    adr: "ADR-053",
  },
  {
    file: "src/lib/queries/__tests__/previsions-postes-referentiel-admin-integration.test.ts",
    linePattern: "describe.runIf(requireDatabaseUrl())(",
    justification:
      "Prouve contre un vrai schéma Postgres les trois cas métier exigés par le chef de " +
      "projet pour la story A.5 (ADR-053 §16.12) : renommerPosteReferentiel/" +
      "desactiverPosteReferentiel (updateMany + conditions réelles), la contrainte " +
      "@@unique([siteId, code]) qui bloque un nouveau rattachement à une entrée désactivée, " +
      "et le pipeline complet calculerRapprochementScenario (agrégations SQL réelles) qui " +
      "doit rester stable avant/après renommage et laisser les PostePrevision/" +
      "MappingRapprochement existants intacts après désactivation — un mock JS ne peut " +
      "prouver ni la contrainte d'unicité réelle, ni que les agrégations SQL produisent le " +
      "même résultat après un UPDATE réel en base.",
    adr: "ADR-053",
  },
];
