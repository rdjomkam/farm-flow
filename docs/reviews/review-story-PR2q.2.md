# Review Story PR2q.2 (SCHEMA) — Modèle à deux niveaux calibre → articles

**Reviewer :** @code-reviewer
**Sprint :** PR2-quater
**Verdict : VALIDÉ AVEC RÉSERVES**

Le schéma et la migration livrés par @db-specialist sont de bonne qualité technique et respectent scrupuleusement le piège ERR-140 (le point le plus dangereux de cette story). Les réserves portent sur un point de procédure qu'il ne faut pas laisser se banaliser, et sur une case de vérification non close.

## Ce qui est correct (vérifié par lecture directe, pas par confiance dans le rapport)

- **Ordre des opérations — piège ERR-140 évité.** Dans `prisma/migrations/20260803160000_aliment_prevision_calibre_article/migration.sql` : les deux garde-fous (`DO $$ ... RAISE EXCEPTION`) s'exécutent en tête, puis `CREATE TABLE "AlimentArticlePrevision"`, puis l'`INSERT ... SELECT` (lignes 93-110, qui lit encore `ap."produitId"`, `ap."libelle"`, `ap."poidsSacKg"`, `ap."prixSacFCFA"`, `ap."sacsParTonneUnitaire"`), et **seulement ensuite** `DROP CONSTRAINT`/`DROP INDEX`/`DROP COLUMN` (lignes 116-125). L'ordre est correct — aucun risque de perte silencieuse de données.
- **Garde-fous conformes à la section 12.2.5.** Les deux `RAISE EXCEPTION` nomment bien les lignes fautives (`id`, `scenarioId` pour le `NULL` ; `scenarioId`, `tailleGranule`, liste d'`ids` pour la collision), pas un simple comptage — exigence explicite de l'ADR respectée à la lettre.
- **PK conservée.** Confirmé par lecture : aucune modification de `AlimentPrevision.id`, l'`INSERT` réutilise `ap."id"` comme `alimentCalibrePrevisionId` de la nouvelle ligne article. Aucun remap de FK sur `RepartitionMoisAliment` ni `AlimentParVaguePrevue` — cohérent avec §12.2.2.
- **Mapping champ par champ conforme à la section 12.3** : `libelle`, `poidsSacKg`, `prixSacFCFA`, `produitId`, `sacsParTonneUnitaire` descendent à l'article ; `tailleGranule`, `sacsParTonneStandard`, `ordre` restent au calibre ; `partApprovisionnementPct` initialisée en dur à `100` pour les lignes migrées (ligne 105).
- **R1/R7/R8** respectés : `tailleGranule` `NOT NULL` commenté explicitement comme décision R7 ; `sacsParTonneStandard` et `produitId` nullables et commentés ; `siteId` présent avec relation `Site` sur `AlimentArticlePrevision`, indexé (`alimentCalibrePrevisionId`, `siteId`, `produitId`) ; `@@unique([scenarioId, tailleGranule])` posé après le garde-fou correspondant.
- **`prisma/seed.sql`** : ordre des `DELETE` respecte les FK (`AlimentArticlePrevision` avant `AlimentPrevision` ; `AlimentParVaguePrevue`/`RepartitionMoisAliment` avant `AlimentPrevision`).
- **Fixtures `prisma/fixtures/previsions/*.json` non modifiées** — vérifié par lecture directe du contenu.
- **Idempotence sur base vide** correctement raisonnée et documentée en tête de fichier.

## Réserves (par ordre de sévérité)

**1. [Moyenne — procédure] Le nettoyage manuel `docker exec psql` de la ligne résiduelle `tailleGranule = NULL`.**
Le garde-fou a fait exactement son travail : détecter une donnée réelle non conforme. Mais la réponse — supprimer la ligne à la main via `psql`, puis `prisma migrate resolve --rolled-back` et rejouer — n'est tracée nulle part : ni commentaire dans la migration, ni `docs/bugs/`. R10 vise littéralement la production, donc ce n'est pas une violation au sens strict — la base Docker locale n'est pas la production. Mais c'est la seule base de dev **partagée par tous les agents et toutes les stories du projet** : une ligne orpheline qui y traîne peut être le symptôme d'un bug réel d'une story antérieure, pas un artefact anodin. La supprimer silencieusement sans consigner d'où elle vient est précisément le geste que R10 cherche à éliminer par principe, même hors de son périmètre littéral — et c'est le genre de pratique qui se normalise si personne ne la nomme. Point positif à créditer : le refus de contourner le garde-fou anti-agent-IA de `prisma migrate reset` est la bonne discipline.
**Recommandation** : consigner l'origine de cette ligne résiduelle ; un script d'audit en lecture seule (`scripts/audits/`, catégorie légitime R10/ADR-049) aurait dû investiguer *avant* suppression plutôt qu'un `DELETE` ad hoc.

**2. [Basse] R9 non formellement clos pour cette story.** La preuve d'un `migrate deploy` propre sur base fraîche manque pour cette story SCHEMA isolée. `npm run build` cassé à ce stade est attendu et acquis (PR2q.3/PR2q.4 à venir).

## Non applicables (hors périmètre SCHEMA)

R2, R4, R5, R6 : sans objet (pas de code TS/UI livré ici). R3 : les miroirs TypeScript ne sont pas encore alignés, mais c'est le périmètre explicite de PR2q.3, pas un défaut de PR2q.2.

## Fichiers revus

- `prisma/schema.prisma` (lignes 4448-4534)
- `prisma/migrations/20260803160000_aliment_prevision_calibre_article/migration.sql`
- `prisma/seed.sql` (lignes 55-82)
- `prisma/fixtures/previsions/plan-v12-corrige.json`
- `docs/decisions/ADR-053-module-previsions.md` (section 12 intégrale)
- `docs/knowledge/ERRORS-AND-FIXES.md` (ERR-140)
