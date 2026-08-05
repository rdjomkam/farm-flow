# Review Sprint PR3-ter — Portée du mapping, trésorerie à trois séries, reprévision glissante

**Reviewer :** @code-reviewer (Read/Glob/Grep uniquement, aucun outil d'exécution — R9 non vérifié directement, voir section dédiée)
**Sprint :** PR3-ter
**Périmètre revu :** Story A (portée du mapping), Story B (trésorerie à 3 séries + reprévision glissante), Story C.1/C.2/C.3/C.4 (réserves mineures)

## Constats numérotés

### Majeur #1 — Aucun livrable de pré-analyse ni de rapport de test/falsification n'est présent dans le dépôt pour ce sprint
Fichiers concernés : `docs/analysis/` (aucun `pre-analysis-sprint-PR3-ter*`), `docs/tests/` (aucun `rapport-falsification-sprint-PR3-ter.md`). Contrairement à PR3 et PR3-bis, aucun de ces deux documents n'existe au moment de cette review. Le code source contient une documentation en tête de fichier très détaillée qui fait office de pré-analyse distribuée, et les fichiers de test contiennent des commentaires de falsification précis. Mais ERR-172 est explicite : la seule preuve disponible est une falsification chiffrée systématique, documentée dans un rapport dédié, produite avant qu'un sprint sans jeu d'or ne soit considéré comme terminé — pas après coup, sur demande. Sans ce document consolidé, le reviewer ne peut pas vérifier les comptages de falsification ; il ne peut que constater que les tests sont structurés pour discriminer, pas que la falsification a réellement été exécutée et chiffrée.
Impact : le sprint ne peut pas être clos sans ce document — exigence ADR-053 §15.6 point 3, pas une formalité.
Correctif attendu : produire `docs/tests/rapport-falsification-sprint-PR3-ter.md` avant clôture, avec le détail par mutation (règle cassée, assertions tombées, restauration vérifiée), sur le format de `rapport-falsification-sprint-PR3.md`.

### Majeur #2 — La correction de portée du mapping reste à moitié faite, honnêtement documentée ; le filet de sécurité est la seule protection sur la moitié POSTE_PREVISION
Fichiers : `src/lib/queries/previsions-rapprochement.ts:124-129, 202-203`, `src/lib/queries/previsions-mapping-orphelins.ts:124-129`.
La moitié `AlimentPrevision` est réellement corrigée par une clé métier stable (`tailleGranule`, résolution dynamique). La moitié `PostePrevision` reste un `cibleId` littéral, site-scopé contre une cible scénario-scopée — non corrigée, documentée explicitement en trois endroits. Le report est honnête au sens où : (1) le filet `cibleOrpheline` couvre les deux types de cible via `TYPES_CIBLE_AVEC_RESOLUTION` (`previsions-mapping-orphelins.ts:91-94`) ; (2) le moteur `reconcilierPrevuEtReel` (`src/lib/previsions/rapprochement.ts:310-322`) continue toutefois, pour `POSTE_PREVISION`, d'accumuler le montant sous une clé jamais relue. Le filet ne corrige pas le défaut à la source : il le signale à l'écran d'administration (badge, `rapprochement-mapping-tab.tsx:359-367`), mais un exploitant qui ne visite jamais cet écran continuera de voir un total réel silencieusement amputé.
Correctif attendu : aucun changement de code exigé pour ce sprint (report acté). Mais le rapport de clôture doit reprendre explicitement l'avertissement de `previsions-rapprochement.ts:124-129`, pas seulement « filet de sécurité livré » — sinon ce risque connu redevient invisible à la prochaine review.

### Moyenne #3 — Aucun test ne prouve explicitement la composition détection + moteur
Fichier : `src/lib/queries/__tests__/previsions-mapping-orphelins.test.ts`. Le filet est testé isolément, le moteur est testé isolément (PR3), mais la composition des deux (« le filet détecte exactement le cas où le moteur ferait disparaître un montant, ni plus ni moins ») ne semble pas prouvée par un test unique. C'est ce que SPRINT-PR3-TER.md exige pour A.4.
Impact : risque de faux positifs, ou pire, d'un cas réel non couvert.
Correctif attendu : un test d'intégration qui construit un mapping orphelin, appelle `calculerRapprochementScenario` (le vrai pipeline), et vérifie conjointement (a) que la ligne est signalée et (b) que le montant réel correspondant est absent du total du moteur. À vérifier dans `previsions-mapping-orphelins-integration.test.ts` avant clôture, pas supposé.

### Mineure #4 — Immuabilité de SnapshotBudgetInitial tenue par convention, non mécanisée
Fichier : `src/lib/queries/previsions-snapshot-budget.ts`. Aucun appel `snapshotBudgetInitial.update/delete/upsert` n'existe dans `src/` hors code généré — garantie correcte aujourd'hui, mais reposant sur la discipline de revue, pas sur un test. Même défaut méthodologique qu'ERR-165.
Correctif attendu (backlog, non bloquant) : un test méta qui échoue si `snapshotBudgetInitial.update`/`.delete`/`.upsert` apparaît dans `src/` hors `src/generated/`.

### Mineure #5 — Le gap de test admis par le @tester est réel, correctement circonscrit, non dissimulé
Fichier : `src/lib/queries/__tests__/previsions-tresorerie-trois-series-integration.test.ts`, test (d2). Il prouve l'immuabilité de la reprévision glissante face à un changement de mapping après clôture, mais ne réplique pas la preuve pour `series[m].reelFCFA`. Ce champ dépend de `calculerRapprochementScenario` → `getMappingResoluParMois`, dont l'immuabilité est déjà prouvée au niveau inférieur ; la composition dans `getTresorerieTroisSeries` est un pur report de valeur.
Verdict sur cet aveu : acceptable. Re-tester une couche passe-plat produirait un test qui passe dans les deux cas (ERR-160). À surveiller si une logique de résolution de mapping est un jour ajoutée dans `previsions-tresorerie-trois-series.ts`.
Correctif attendu (mineur) : ajouter une assertion `reelFCFA` avant/après changement de mapping dans (d2), pour lever l'ambiguïté.

### Observation #6 — §6.2 tient, avec une nuance sur les mappings pré-A.3
Le changement de format `cibleId` est protégé par : (1) 0 ligne `MappingRapprochement` en base (aucune migration R10 nécessaire) ; (2) le schéma Zod rejette explicitement l'ancien format brut plutôt que de le tolérer silencieusement. `parseCibleAlimentPrevision` reste tolérante en lecture. `ClotureMois.versionMapping`/`resoudreVersionMappingPourMois` sont inchangés par ce sprint.

### Observation #7 — Moteur pur intact, sous réserve de l'absence d'outil git
Grep exhaustif de `PR3-ter`/`PR3ter` dans `src/lib/previsions/` : aucune occurrence. Les nouveaux modules vivent dans un dossier frère `src/lib/previsions-presentation/`. Le reviewer ne peut pas exclure une modification sans trace de commentaire, faute de `git diff` — à confirmer par le @tester.

### Observation #8 — Franchise de la série RÉEL : bien visible, pas noyée
`tresorerie-tab.tsx:57-64` : caveat affiché en permanence, en haut de l'onglet, avant le graphique, jamais dans une infobulle. Quand `budgetInitialDisponible = false`, un second encart dit explicitement qu'il s'agit d'une absence de figeage et non d'un budget nul (`tresorerie-tab.tsx:66-75`) ; le composant n'envoie la clé `budgetInitial` à Recharts que si `budgetInitialDisponible === true`.

## Checklist R1 → R11

| Règle | Statut | Constat |
|---|---|---|
| R1 — Enums MAJUSCULES | Conforme | `StatutRapprochement`, `SensEcart`, `SourceMoisReprevision` en UPPERCASE ou format discriminé explicite. |
| R2 — Toujours importer les enums | Conforme | `TailleGranule`, `CibleRapprochement`, `SourceRapprochement` importés depuis `@/types` ; aucune chaîne littérale hors SQL brut. |
| R3 — Prisma = TypeScript identiques | Conforme | Pas de modification de schéma ce sprint. |
| R4 — Opérations atomiques | Conforme | Aucune nouvelle écriture sur le domaine réel ni sur `SnapshotBudgetInitial`/`ClotureMois`. |
| R5 — DialogTrigger asChild | Conforme | `mapping-form-dialog.tsx:344`. |
| R6 — Variables CSS du thème | Conforme | `tresorerie-trois-series-chart.tsx` : `var(--success)`, `var(--danger)`, `var(--warning)`, `var(--primary)`, `var(--accent-blue)`, `var(--muted-foreground)`, `var(--border)` — aucune couleur en dur. |
| R7 — Nullabilité explicite | Conforme | `budgetInitialFCFA: Decimal \| null` distingué de `0` à chaque niveau (query, route, DTO, UI). |
| R8 — siteId partout | Conforme | `getTresorerieTroisSeries` lit `auth.activeSiteId`, jamais le body ; test d'isolation site (e). |
| R9 — Tests avant review | NON VÉRIFIÉ DIRECTEMENT, DOCUMENT MANQUANT | Voir Majeur #1. |
| R10 — Correctif de données = migration | Conforme (sans objet) | Aucune donnée corrigée ; aucun `.sql` de correctif introduit. |
| R11 — Aucun secret en dur | Conforme (sur le périmètre lu) | Aucun motif rencontré ; vérification non exhaustive. |

## Verdict global

**VALIDÉ SOUS RÉSERVE.**

Le travail livré est d'une qualité inhabituellement élevée sur le plan de la discipline architecturale : chaque décision délicate (portée du mapping, format composé, immuabilité du gel, distinction PRÉVISION ACTUALISÉE / Reprévision, distinction `NON_RAPPROCHE`/`SANS_SOURCE_REELLE`/`cibleOrpheline`) est documentée à l'endroit exact où elle s'applique. Le moteur protégé n'a laissé aucune trace de modification. Le caveat de franchise sur la série RÉEL est visible et non négociable à l'écran. R1-R8, R10, R11 conformes sur le périmètre lu.

Réserves, par ordre de priorité :
1. (Majeur #1) Aucun rapport de falsification consolidé dans `docs/tests/` — exigence ADR-053 §15.6 point 3 et ERR-172. La clôture ne peut être actée avant que ce document existe.
2. (Majeur #2) Le report de la correction structurelle `POSTE_PREVISION` doit être répété explicitement dans le rapport de clôture, pas seulement dans les commentaires de code.
3. (Moyenne #3) Vérifier — pas supposer — que la composition détection + moteur est prouvée.
4. (Observation #7) Confirmer par `git diff --stat src/lib/previsions/` qu'aucune ligne du dossier protégé n'a changé.

Les réserves mineures (#4, #5) et l'observation #6 sont à porter en backlog, non bloquantes.

## Ce qui reste ouvert et doit être porté en backlog

- Correction structurelle de `MappingRapprochement.cibleId` pour `POSTE_PREVISION` (ADR-053 §3.9, story A.4 hors périmètre) — `PostePrevision.libelle` reste un texte libre sans clé métier stable ; tant qu'aucune clé stable n'existe, le filet `cibleOrpheline` reste la seule protection, jamais un correctif à la source.
- Test méta anti-régression sur l'immuabilité de `SnapshotBudgetInitial` (Mineure #4).
- Complément de test (d2) avec assertion sur `reelFCFA` (Mineure #5).
- Décalage `MODULE_NAV` (ADR-053 §15.7/15.8e) — déjà acté hors périmètre, non aggravé par ce sprint.
- Défaut trouvé par la vérification navigateur, même famille qu'ERR-176 : `src/components/ventes/vente-detail-client.tsx:818` affiche `{d.statut}` (enum brut, « PAYEE ») au lieu de `tDepenses(\`statuts.${d.statut}\`)`, dans la carte « Dépenses associées » du détail vente, visible à 375 px et 1280 px.

## Ce que la review n'a pas pu vérifier

- Exécution réelle de `npx vitest run`, `npm run build`, `npx prisma migrate deploy` — aucun outil shell.
- `git diff` sur `src/lib/previsions/` — vérifié uniquement par grep textuel.
- Rendu navigateur réel à 375 px et 1280 px (ERR-157) — pas d'outil de capture ; seule la structure Tailwind du JSX a été vérifiée.
- Lecture ligne à ligne intégrale de `previsions-mapping-orphelins-integration.test.ts`, `previsions-vue-rapprochement-partition.test.ts`, `tresorerie-trois-series-chart.test.tsx`, `mapping-rapprochement-helpers.test.ts`.
- Vérification exhaustive des clés i18n C.2 au niveau de chaque composant de rendu du §6.

**Références :** ADR-053 §3.9, §6.2, §6.4, §6.5, §15 (entière), CLAUDE.md R1-R11, ERR-116, ERR-157, ERR-160, ERR-172, ERR-173, ERR-174 à ERR-178, `docs/sprints/SPRINT-PR3-TER.md`, `docs/reviews/review-sprint-PR3.md`, `docs/reviews/review-sprint-PR3-bis.md`.
