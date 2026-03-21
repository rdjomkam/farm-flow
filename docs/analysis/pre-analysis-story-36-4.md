# Pré-analyse Story 36.4 — Gestion des limites de plan (quotas)
**Date :** 2026-03-21
**Sprint :** 36

## Statut : GO AVEC RÉSERVES

## Résumé
La dépendance Story 32.4 est FAIT. Les prérequis structurels (modèle PlanAbonnement avec
limitesBacs/limitesVagues/limitesSites, constante PLAN_LIMITES, getAbonnementActif, check-subscription)
sont tous en place. Deux réserves mineures à prendre en compte avant le développement.

---

## Vérifications effectuées

### 1. Dépendance Story 32.4 : OK

Story 32.4 (Middleware restriction abonnement expiré) est marquée `FAIT` dans
`docs/sprints/SPRINTS-SUBSCRIPTIONS.md`. La route
`src/app/api/abonnements/statut-middleware/route.ts` est présente et fonctionnelle.
`src/lib/abonnements/check-subscription.ts` exporte `getSubscriptionStatus`, `isSubscriptionValid`,
`isReadOnlyMode`, `isBlocked`.

### 2. Modèle PlanAbonnement (limites) : OK

Dans `prisma/schema.prisma`, le modèle `PlanAbonnement` contient :
- `limitesSites Int @default(1)`
- `limitesBacs  Int @default(3)`
- `limitesVagues Int @default(1)`

L'interface TypeScript `PlanAbonnement` dans `src/types/models.ts` (lignes 2350-2352)
est en miroir exact — R3 respectée.

### 3. Constante PLAN_LIMITES : EXISTE DÉJÀ

`src/lib/abonnements-constants.ts` exporte déjà `PLAN_LIMITES` (lignes 70-119) avec les
valeurs pour tous les TypePlan :
- DECOUVERTE : limitesBacs=3, limitesVagues=1, limitesSites=1
- ENTREPRISE : limitesBacs=999, limitesVagues=999 (quasi-illimité)
- ELEVEUR / PROFESSIONNEL : valeurs intermédiaires

La story demande de traiter ENTREPRISE comme "illimité (null)". La constante utilise 999
comme valeur numérique pour représenter l'illimité. Le développeur devra choisir une
convention cohérente dans `check-quotas.ts` : soit utiliser la valeur 999 comme seuil
"illimité", soit la re-mapper vers `null`. La convention doit être documentée.

### 4. Routes POST /api/bacs et POST /api/vagues : OK, PRÊTES À ÊTRE MODIFIÉES

`src/app/api/bacs/route.ts` : route POST standard, utilise `requirePermission()`,
appelle `createBac(auth.activeSiteId, data)`. Aucun guard de quota existant.

`src/app/api/vagues/route.ts` : même structure, appelle `createVague(auth.activeSiteId, data)`.
Aucun guard de quota existant.

Les deux routes suivent le même pattern — la vérification quota s'insère au même endroit
dans les deux, après `requirePermission()` et avant la validation des champs.

### 5. Pages bacs et vagues : OK, COMPOSANT À INJECTER

`src/app/bacs/page.tsx` : Server Component, appelle `getBacs(session.activeSiteId)`, passe
`bacs` à `<BacsListClient>`. Le composant `<QuotasUsageBar>` peut être inséré entre
`<Header>` et `<BacsListClient>`.

`src/app/vagues/page.tsx` : même structure, passe données à `<VaguesListClient>`. Même
emplacement d'injection.

Les deux pages ont accès à `session.activeSiteId` — paramètre nécessaire pour appeler
`getQuotasUsage(siteId)`.

### 6. Dossier src/lib/abonnements/ : UN SEUL FICHIER

`src/lib/abonnements/` contient uniquement `check-subscription.ts`. Le fichier
`check-quotas.ts` à créer va dans ce même dossier — cohérent avec le pattern existant.

### 7. Dossier src/components/subscription/ : UN SEUL COMPOSANT

`src/components/subscription/` contient uniquement `subscription-banner.tsx`. Le composant
`quotas-usage-bar.tsx` à créer va dans ce même dossier.

---

## Incohérences / Réserves

### Réserve 1 — Convention "illimité" : 999 vs null

La story demande `null` pour signifier illimité sur ENTREPRISE. Mais `PLAN_LIMITES` utilise
`999`. `check-quotas.ts` devra soit :
- Considérer que `>= 999` signifie illimité (ne pas bloquer)
- Ou exposer une logique de mapping interne

La décision doit être cohérente avec ce que `PLAN_LIMITES` expose déjà (les tests dans
`src/__tests__/lib/abonnements-constants.test.ts` vérifient que ENTREPRISE = 999, pas null).
Recommandation : dans `check-quotas.ts`, utiliser un seuil interne `ILLIMITE_SEUIL = 999`
et traiter `>= ILLIMITE_SEUIL` comme "pas de blocage" — sans changer PLAN_LIMITES.

### Réserve 2 — Source des limites : DB ou constante ?

Deux sources donnent les limites par plan :
- `PLAN_LIMITES` (constante dans `abonnements-constants.ts`) — source statique
- `abonnement.plan.limitesBacs` (champ DB sur `PlanAbonnement`) — source dynamique

La story indique "Plan DECOUVERTE : limites strictes (3 bacs, 1 vague, 1 site)". Ces valeurs
correspondent exactement aux deux sources. Mais en cas de divergence future, laquelle prime ?

Recommandation : `getQuotasUsage(siteId)` doit récupérer les limites depuis la DB via
`getAbonnementActif(siteId).plan.limitesBacs` (pas depuis `PLAN_LIMITES`) — la DB est la
source de vérité pour les plans actifs (les plans peuvent évoluer sans recompilation).
`PLAN_LIMITES` reste utilisable pour l'affichage statique sur `/tarifs`.

---

## Risques identifiés

### Risque 1 — ERR-008 (enum conflict) dans check-quotas.ts

`getAbonnementActif()` retourne un objet Prisma dont `plan.typePlan` est de type
`prisma/enums.TypePlan`, pas `@/types.TypePlan`. Si `check-quotas.ts` compare avec
`TypePlan.DECOUVERTE` importé de `@/types`, appliquer le pattern ERR-008 :
`(plan.typePlan as string) === TypePlan.DECOUVERTE`.

### Risque 2 — Comptage des vagues : quelle portée ?

La story dit "1 vague" pour DECOUVERTE. Faut-il compter toutes les vagues (tous statuts) ou
seulement les vagues EN_COURS ? Un site DECOUVERTE peut avoir 1 vague terminée et vouloir en
créer une nouvelle — est-ce bloqué ?
Recommandation : compter uniquement les vagues `EN_COURS` pour les quotas actifs. À confirmer
avec le PM avant implémentation.

---

## Prérequis vérifiés — TOUS SATISFAITS

- Story 32.4 : FAIT
- `PlanAbonnement.limitesBacs/limitesVagues/limitesSites` : présent dans schema + types
- `PLAN_LIMITES` : existe dans `src/lib/abonnements-constants.ts`
- `getAbonnementActif(siteId)` : disponible dans `src/lib/queries/abonnements.ts`
- `src/lib/abonnements/` : dossier existant, pattern clair
- `src/components/subscription/` : dossier existant, pattern clair
- Pages bacs et vagues : Server Components avec `session.activeSiteId` disponible

---

## Fichiers à créer

| Fichier | Action |
|---------|--------|
| `src/lib/abonnements/check-quotas.ts` | CRÉER |
| `src/components/subscription/quotas-usage-bar.tsx` | CRÉER |

## Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/app/api/bacs/route.ts` | Ajouter vérification quota dans POST (après requirePermission) |
| `src/app/api/vagues/route.ts` | Ajouter vérification quota dans POST (après requirePermission) |
| `src/app/bacs/page.tsx` | Injecter `<QuotasUsageBar siteId={session.activeSiteId}>` |
| `src/app/vagues/page.tsx` | Injecter `<QuotasUsageBar siteId={session.activeSiteId}>` |

---

## Recommandation

GO — avec deux points à clarifier avant de coder :

1. Convention "illimité" : utiliser `>= 999` comme seuil interne dans `check-quotas.ts`
   (ne pas modifier `PLAN_LIMITES`).
2. Portée du comptage vagues : compter seulement les vagues `EN_COURS` (recommandé).
