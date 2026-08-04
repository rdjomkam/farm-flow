# Review Sprint PR2 — Module Prévisions (routes API + UI)

**Reviewer :** @code-reviewer
**Sprint :** PR2
**Verdict global : VALIDÉ AVEC RÉSERVES**

Aucune réserve Critique ni Haute non résolue. Aucune réserve bloquante.

---

## Réponse à la question centrale : LE MVP EST LIVRÉ

Le parcours utilisateur du §12 (ADR-053) a été retracé étape par étape dans le code, sans
rupture — chaque étape a un écran, chaque écran a une route API, chaque route a une query.

| Étape | Écran | Route | Query |
|---|---|---|---|
| Activer le module | éditeurs de modules de site | — | `SITE_MODULES_CONFIG` (`PREVISIONS`, 10e entrée) |
| Accéder par la navigation | `farm-sidebar.tsx`, `farm-bottom-nav.tsx` → `/previsions/scenarios` | — | — |
| Créer un scénario | `scenarios-list-client.tsx`, `scenario-form-dialog.tsx` | `POST /api/previsions/scenarios` | `createScenario` (copie automatique des aliments depuis `Produit`) |
| Saisir les paramètres | `parametres-tab.tsx` | `PUT /scenarios/[id]/parametres` | `updateParametresPrevision` |
| Granulométries et répartition | `aliments-tab.tsx`, `aliment-form-dialog.tsx`, `repartition-mois-dialog.tsx` | `POST/PUT aliments`, `PUT aliments/[id]/repartitions` | `createAlimentPrevision`, `replaceRepartitionsMoisAliment` (somme = 100 % bloquante) |
| Plan des vagues prévues | `plan-vagues-tab.tsx`, `vague-prevue-form-dialog.tsx` | `POST /scenarios/[id]/vagues` | `createVaguePrevue` — **création manuelle uniquement** |
| Charges et journal | `charges-tab.tsx`, `journal-tab.tsx` | `POST postes`, `PUT postes/[id]/charges`, `POST/PUT/DELETE journal` | `createPostePrevision`, `upsertChargeMensuelle`, `createJournalDepensePrevue` |
| Apports en capital | `apports-tab.tsx`, `apport-form-dialog.tsx` | `POST scenarios/[id]/apports` | `createApportCapital` |
| Tableau de bord et trésorerie | `tableau-bord-tab.tsx`, `tresorerie-chart.tsx` | `GET /scenarios/[id]/calculer` | `calculerProjectionScenario` |

**Gap réel signalé, non bloquant** : `genererPlanEmpoissonnement` (fonction du moteur, ADR §4,
testée unitairement) n'est appelée par **aucune route ni query**. Le sprint devait permettre de
« générer ou créer » le plan : seule la branche « créer » est livrée. Un exploitant qui veut
planifier 19 vagues sur 21 mois — le cas d'usage de référence de l'ADR §1 — doit ouvrir le
dialogue 19 fois. Ce n'est pas une rupture du parcours, mais un écart d'ergonomie contre le cas
d'usage qui justifie l'existence du module, et une fonction du moteur qui reste du code mort côté
production.

---

## Cohérence transversale

Aucun problème significatif. `api-types.ts` et `projection-types.ts` ne sont **pas** redondants —
le premier décrit la forme brute JSON du fil des routes CRUD (où `Prisma.Decimal.toJSON()`
sérialise en `string`), le second la projection après conversion à la frontière Server→Client, sur
un chemin de données différent ; les deux se citent mutuellement en JSDoc. Conversions `Decimal`
centralisées, formatage centralisé, aucune duplication de logique entre `route-orchestration.ts`
et les composants. La coexistence zod (forme du payload) / validation en query (règles métier,
dans la transaction) est une défense en profondeur assumée, pas une divergence.

---

## Séparation prévisionnel / réel (garantie centrale, ADR §5) : respectée à 100 %

Recherche exhaustive : une seule écriture sur une table du domaine réel, `rattacherVaguePrevue`
(`previsions-vagues.ts`), qui écrit `Vague.vaguePrevueId` — exactement l'exception prévue par la
décision 2. Aucun `create`/`update`/`delete` sur `Depense`, `Vente`, `MouvementStock`. Route de
calcul confirmée en lecture pure.

---

## Intégrité du moteur

Les seuls changements dans `src/lib/previsions/` sont 4 fichiers **nouveaux** (`decimal-io.ts`,
`format-previsions.ts`, `route-orchestration.ts`, `tableau-de-bord-helpers.ts`, tous hors recette)
et de la JSDoc pure dans `aliments.ts` (36 insertions / 1 suppression, 0 ligne exécutable). Aucune
des 12 fonctions couvertes par la recette n'a été modifiée. Recette à **842 / 0 écart** revérifiée
explicitement à chaque story.

---

## Les 3 bugs Haute et ce qu'ils révèlent

Les correctifs sont de bonne qualité. Mais le premier jet de tests ne les a pas attrapés par une
recette : le bug composé n'a été isolé qu'en combinant un test de démonstration ad hoc avec une
investigation manuelle de l'@architect, et la seconde erreur (×1000) a été découverte « au
passage » en creusant la première.

Cause structurelle : le moteur pur est recetté contre le jeu d'or, mais `route-orchestration.ts`
**ne l'est pas** — et c'est précisément cette zone non recettée qui a produit les 3 bugs Haute du
sprint.

**Recommandation actionnable** : étendre `__tests__/recette/` pour comparer la sortie de
`calculerProjectionScenario` elle-même aux séries mensuelles du jeu d'or, au moins sur
`besoinTotalCycleKg` et sur l'application de `sacsSaisis` — les deux points de défaillance réels.

Voir capitalisation : ERR-142 dans `docs/knowledge/ERRORS-AND-FIXES.md`.

---

## Réserves de PR1

- Réserve 6 (homonymie `sacsCalcules`) traitée avant PR2.2 comme exigé.
- Réserve 5 (`modules.adminCommissions`/`adminRemises`) traitée en best-effort dans PR2.5, les
  deux clés existent en fr et en avec des valeurs identiques à `common.json`.
- **Réserve 4 (« 14 modèles » vs 13) : résolue** — le texte actuel de l'ADR §8.3 dit bien
  « 13 nouveaux modèles Prisma », aucune occurrence de « 14 » ne subsiste. Corrigée
  vraisemblablement en marge de l'amendement §11, sans être annoncée — à acter explicitement ici
  pour que cette clôture ne reste pas invisible.

---

## Périmètre

Aucun débordement PR3. Aucune trace applicative de `MappingRapprochement` / `ClotureMois` en
dehors des modèles Prisma posés par PR1. Aucune vue de comparaison, reprévision glissante, export
ni clôture.

---

## Checklist R1-R11

| Règle | Statut | Note |
|-------|--------|------|
| R1 (enums MAJUSCULES) | ✅ | |
| R2 (import enums) | ✅ | |
| R3 (Prisma=TS) | ✅ | |
| R4 (opérations atomiques) | ✅ avec réserves mineures | 2-3 check-then-write résiduels de sévérité Basse dans les queries |
| R5 (DialogTrigger asChild) | ✅ | |
| R6 (CSS variables du thème) | ✅ | |
| R7 (nullabilité) | ✅ | `sacsParTonneStandard Decimal?` nullable avec rejet 422 documenté plutôt qu'une valeur par défaut inventée — exemplaire |
| R8 (siteId) | ✅ | |
| R9 (tests avant review) | ✅ | |
| R10 (correctif de données = migration) | ✅ | |
| R11 (aucun secret en dur) | ✅ | |

Aucun `any` introduit.

---

## Tableau des réserves (priorisées, aucune bloquante)

| # | Sévérité | Réserve | Traitement recommandé |
|---|----------|---------|------------------------|
| 1 | Moyenne, avant PR3 | Dette i18n — 24 fichiers sans `next-intl`, seul module du dépôt dans ce cas, s'aggrave story après story | Ticket de backlog unique et chiffré, avant que PR3 n'étende encore le périmètre |
| 2 | Moyenne, gouvernance | `docs/sprints/*.md` édité directement par les développeurs, en violation systématique de `docs/PROCESSES.md` | Décision explicite du PM avant PR3 : formaliser ou faire respecter. Le statu quo — règle énoncée, violée systématiquement, jamais révisée — est la pire des trois options |
| 3 | Moyenne | `margeSecuriteAlevinsPct` inerte | Trancher avant la prochaine story touchant `plan.ts` : consommation par le moteur, ou champ informatif assumé signalé dans l'UI de saisie |
| 4 | Basse à Moyenne selon usage | `genererPlanEmpoissonnement` non câblée | Prioriser selon le retour utilisateur réel |
| 5 | Basse | 2-3 check-then-write résiduels (R4 strict) dans les queries de PR2.1 | À corriger au prochain passage sur ces fichiers |
| 6 | Basse | Mapping HTTP par sous-chaîne de message, fragile à une reformulation de `validation.ts` | Typer en `ValidationError` **avant** toute story qui retouche `validation.ts`, pas après |
| 7 | Basse | `module-nav-items.ts` mort, enrichi par habitude à chaque module | Story de nettoyage + amendement de l'ADR-053 §6 qui le désigne encore comme cible |
| 8 | Info | 1 entrée de navigation au lieu de 5 (§7.3) | Réévaluer si des routes adressables par URL apparaissent |
| 9 | Cosmétique, clôturée | ADR §8.3 « 14 modèles » (réserve 4 de PR1) | Déjà résolue dans le texte actuel |

Problèmes Critique : aucun. Haute : aucun non résolu (les 3 bugs Haute détectés en cours de sprint
ont été corrigés avant cette review — voir section dédiée ci-dessus et ERR-142).

---

## Verdict

**VALIDÉ AVEC RÉSERVES.** Aucune réserve bloquante avant merge. La réserve la plus actionnable
pour PR3 est la recette de `route-orchestration.ts` (voir « Les 3 bugs Haute et ce qu'ils
révèlent ») : c'est la zone qui a produit 100 % des bugs Haute de ce sprint alors que le moteur
qu'elle appelle était intégralement recetté. Les autres réserves suivent le calendrier normal de
PR3.
