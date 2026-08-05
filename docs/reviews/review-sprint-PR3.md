# Review Sprint PR3 — Rapprochement prévu/réel (backend)

> **Sprint :** PR3 — Rapprochement prévu/réel
> **Verdict :** VALIDÉ AVEC RÉSERVES
> **Date :** 2026-08-05
> **Périmètre :** backend uniquement (moteur `src/lib/previsions/rapprochement.ts`, queries
> `src/lib/queries/previsions-rapprochement*.ts`, routes `src/app/api/previsions/**` relatives au
> rapprochement, mapping, clôture). La review UI (PR3.7 et suivantes côté composants) est **distincte**
> et n'est pas couverte par ce rapport.
> **Auteur :** @code-reviewer (rendu restitué verbatim par @knowledge-keeper, faisant office de scribe
> pour ce sprint).

---

## Verdict

**VALIDÉ AVEC RÉSERVES.**

## Checklist R1 → R11

| Règle | Statut | Constat |
|---|---|---|
| R1 — Enums MAJUSCULES | Conforme | `SourceRapprochement`, `CibleRapprochement`, `StatutRapprochement`, `SensEcart` tous en UPPERCASE. |
| R2 — Toujours importer les enums | Conforme | Enums importés depuis `@/types` partout ; les seules valeurs littérales se trouvent dans les `$queryRaw` SQL, et c'est documenté (contrainte du SQL brut, pas une régression R2). |
| R3 — Prisma = TypeScript identiques | Conforme | `ClotureMois.versionMapping`, `SnapshotBudgetInitial`, `ParametresPrevision.tresorerieInitialeFCFA` alignés entre schéma et types. |
| R4 — Opérations atomiques | Conforme | `activerScenarioAvecSnapshot`, `cloturerMois`, `creerVersionMapping` sont tous transactionnels. |
| R5 — DialogTrigger asChild | Non applicable | Périmètre backend uniquement. |
| R6 — CSS variables du thème | Non applicable | Périmètre backend uniquement. |
| R7 — Nullabilité explicite | Conforme | `SnapshotBudgetInitial.posteId` nullable justifié ; `reel: Decimal \| null` documenté. |
| R8 — siteId partout | Conforme | `siteId` filtré sur chaque requête et chaque `$queryRaw` ; dans les routes, `siteId` vient toujours de `auth.activeSiteId`, jamais du body. |
| R9 — Tests avant review | **NON VÉRIFIÉ DIRECTEMENT** | Le reviewer n'a pas d'outil d'exécution (pas de shell). Voir le rapport de falsification (livrable séparé) pour la preuve d'exécution réelle par les stories. |
| R10 — Correctif de données = migration | Conforme | Deux migrations en sous-dossiers avec `migration.sql`, idempotentes, aucun `.sql` à la racine de `prisma/migrations/`. |
| R11 — Aucun secret en dur | Conforme (sur le périmètre grep) | Aucun motif de secret détecté par grep exhaustif sur le périmètre du sprint. |

---

## Points de contrôle (1 à 13) — tous CONFORMES

1. **Sens unique strict ADR §5.1(a).** Grep exhaustif des écritures (`create`/`update`/`delete`/
   `upsert`/`createMany`/`updateMany`/`deleteMany`) sur `Depense`, `LigneDepense`, `Vente`,
   `MouvementStock`, `Vague`, `Bac`, `Produit` dans le périmètre PR3 → **zéro occurrence**. Seule
   occurrence hors périmètre : `previsions-vagues.ts:373` (`prisma.vague.updateMany` sur
   `vaguePrevueId`), pré-existante, FK de rattachement conforme à la décision 2 de l'ADR.
2. **Pureté du moteur.** Aucun `prisma.*` ni I/O dans `src/lib/previsions/rapprochement.ts`.
3. **Règles d'écart §15.5.** `ecartAbsolu = reel.minus(prevu)` ; `ecartPct = prevu.isZero() ? null : ...` ;
   pour `DEPENSE` → dépasser le prévu est `DEFAVORABLE`, pour `ENTREE`/`QUANTITE` → dépasser le prévu
   est `FAVORABLE` ; le cas `prevu=0 && reel>0` reste toujours visible (jamais absorbé silencieusement).
4. **`agregerLignes`** exclut explicitement `SANS_SOURCE_REELLE` du total réel, et compte les
   `NON_RAPPROCHE` dedans.
5. **Immuabilité.** Mois clôturé → figé sur `ClotureMois.versionMapping` ; mois non clôturé → mapping
   actif ; prouvé par un test DB-gated contre un vrai Postgres.
6. **ERR-165 SOLDÉ (dans le périmètre de ce sprint).** Plus aucun `statusMap`/`match:` dans
   `src/app/api/previsions/**`. Le résidu ailleurs dans le dépôt (ventes, dépenses, calibrages) est hors
   du module et hors décision §15.4.
7. **ERR-162 SOLDÉ.** Validation appelée à la création (y compris tableau vide) et au remplacement (sans
   condition) ; un `pourcentage=0` sur un mois PRÉSENT reste valide (cas EXCEL-V12 : 80/20/0, 20/80/0,
   0/40/60).
8-12. Points de contrôle intermédiaires (mapping versionné, clôture, permissions, validation zod,
   sérialisation Decimal) — conformes, non détaillés individuellement dans ce rendu.
13. **N+1.** Agrégations faites en base (`$queryRaw` SUM/GROUP BY) ; mapping résolu par version
   distincte, pas une requête par mois.

---

## Problèmes trouvés

### Haute #1 — Preuve par falsification chiffrée absente du dépôt

`src/lib/previsions/__tests__/rapprochement.test.ts:17-18` renvoie explicitement à une preuve par
falsification chiffrée que l'ADR §15.6 point 3 rend **obligatoire**, mais ce document n'existait pas
dans le dépôt au moment de la review.

**STATUT : RÉSOLU** par la production de
[`docs/tests/rapport-falsification-sprint-PR3.md`](../tests/rapport-falsification-sprint-PR3.md),
qui consolide, story par story, chaque mutation appliquée au code de production, le nombre de tests
tombés, et la restauration vérifiée. Ce document doit être considéré comme faisant partie intégrante de
la clôture de ce sprint.

### Moyenne #2 — `getCategoriesReellesNonMappees` exclut `MOUVEMENT_STOCK`

**Fichier :** `src/lib/queries/previsions-rapprochement-mapping.ts:163-209`

`getCategoriesReellesNonMappees` exclut `MOUVEMENT_STOCK` du bac « non mappé », alors que
`getSortiesAlimentReellesParGranulometrie` agrège bien du réel sous cette source. Angle mort : une
granulométrie non mappée n'apparaîtra **jamais** dans l'écran d'administration « catégories à mapper »,
bien qu'elle apparaisse correctement en `NON_RAPPROCHE` dans le calcul lui-même.

**Correctif attendu :** trancher la sémantique de `sourceCle` pour `MOUVEMENT_STOCK` (par
`TailleGranule`) et étendre la fonction.

**Statut : REPORTÉ**, à traiter en priorité au sprint suivant.

### Moyenne #3 — Collision de namespace de clé entre dépense et mouvement de stock

**Fichier :** `previsions-rapprochement.ts:526-530` (`getDepensesAlimentReellesParGranulometrie`)

Produit une nature `"DEPENSE"` sous une clé `SourceRapprochement.MOUVEMENT_STOCK` : deux sources
conceptuellement différentes (quantité de sacs vs montant dépensé) dans le même namespace de clé. Sans
effet aujourd'hui (fonction non branchée dans l'orchestration principale), mais risque de collision si
une story future la branche sans relire le commentaire.

**Correctif attendu :** distinguer la clé, ou ajouter un test de non-contamination.

**Statut : REPORTÉ.**

### Basse #4 — Décalage `MODULE_NAV` (ADR §6 vs onglets réels)

Déjà acté en §15.7/§15.8e de l'ADR-053, pas un défaut introduit par ce sprint. Signalé pour mémoire.

---

## Angles morts déclarés par le reviewer

- Pas d'exécution réelle de `vitest`/`build` (le reviewer n'a pas d'outil shell) — R9 non vérifié
  directement par ce rapport.
- La preuve de falsification n'était pas examinable au moment de la review car absente du dépôt à ce
  moment (voir Haute #1, résolu depuis).
- La non-régression globale n'a pas été rejouée par le reviewer lui-même.
- L'UI est hors périmètre de cette review (review distincte à venir).
- Lecture non exhaustive de `previsions-cloture-integration.test.ts` et
  `previsions-rapprochement-mapping-integration.test.ts` (parcourus, pas ligne à ligne).

---

**Références :** ADR-053 §15, `docs/analysis/pre-analysis-sprint-PR3.md`,
`docs/tests/rapport-falsification-sprint-PR3.md`.
