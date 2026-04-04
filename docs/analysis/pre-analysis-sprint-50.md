# Pré-analyse Sprint 50 — 2026-04-04

## Statut : GO AVEC RÉSERVES

## Résumé
Les prérequis structurels du Sprint 50 (schema Prisma, types TypeScript, DTOs, utilitaires) sont en place depuis Sprint 45. Le fichier `src/lib/abonnements/prorata.ts` n'existe pas encore — c'est l'objet de Story 50.1. Le build Next.js passe sans erreur (hors migration DB bloquée non liée au Sprint 50). Les tests passent à 100 % (3988/3988). Une réserve sur la migration `20260316120000_add_unite_pack_produit` qui est en état FAILED sur la DB locale.

## Vérifications effectuées

### Schema ↔ Types : OK

Tous les champs requis par Sprint 50 sont présents dans `prisma/schema.prisma` (modèle `Abonnement`) :
- `downgradeVersId` : `String?` avec relation `@relation("DowngradeVers")` vers `PlanAbonnement`
- `downgradePeriode` : `PeriodeFacturation?`
- `downgradeRessourcesAGarder` : `Json?`
- `prochainePeriode` : `PeriodeFacturation?`

`src/types/models.ts` reflète exactement ces champs dans l'interface `Abonnement` (lignes 2734-2741). Le type `DowngradeRessourcesAGarder` est défini à la ligne 2697 et exporté dans `src/types/index.ts` (ligne 195).

`User.soldeCredit` existe dans le schema (`Decimal @default(0)`, ligne 923) et est déjà utilisé dans la route `renouveler`.

`isBlocked` est présent sur `Site` (ligne 564), `Bac` (ligne 972), `Vague` (ligne 998) — nécessaire pour `detecterDepassements` (Story 50.1).

### API ↔ Queries : OK

Les DTOs nécessaires sont définis et exportés :
- `UpgradeDTO` — `src/types/api.ts` ligne 2357 — exporté dans `index.ts` ligne 453
- `DowngradeDTO` — `src/types/api.ts` ligne 2366 — exporté dans `index.ts` ligne 454
- `ChangerPeriodeDTO` — `src/types/api.ts` ligne 2375 — exporté dans `index.ts` ligne 455

Les routes suivantes n'existent pas encore (attendues des stories 50.2 et 50.3) :
- `src/app/api/abonnements/[id]/upgrade/route.ts`
- `src/app/api/abonnements/[id]/upgrade/cancel/route.ts`
- `src/app/api/abonnements/[id]/downgrade/route.ts`
- `src/app/api/abonnements/[id]/changer-periode/route.ts`

Pattern de référence à réutiliser pour les nouvelles routes : `src/app/api/abonnements/[id]/renouveler/route.ts` — déjà correctement structuré avec `requirePermission`, `$transaction` R4, `logAbonnementAudit`, `invalidateSubscriptionCaches`.

`logAbonnementAudit` accepte une `action: string` libre — les valeurs `UPGRADE`, `DOWNGRADE`, `DOWNGRADE_ANNULE`, `CHANGEMENT_PERIODE` sont documentées dans le schema (lignes 3119-3120) mais non typées comme enum. Ce comportement est existant et cohérent avec le sprint précédent.

### Utilitaires disponibles pour prorata.ts : OK

Les fonctions et constantes suivantes sont disponibles et exportées :
- `calculerProchaineDate(base: Date, periode: PeriodeFacturation): Date` — `src/lib/abonnements-constants.ts` ligne 233 — calcule la date de fin de période, réutilisable pour `calculerDateFinNouveau`
- `PLAN_TARIFS: Record<TypePlan, Partial<Record<PeriodeFacturation, number | null>>>` — `src/lib/abonnements-constants.ts` ligne 25 — base de calcul du prix nouveau plan
- `PLAN_LIMITES: Record<TypePlan, { limitesSites, limitesBacs, limitesVagues, limitesIngFermes }>` — `src/lib/abonnements-constants.ts` ligne 75 — base de `detecterDepassements`
- `normaliseLimite(valeur: number): number | null` — `src/lib/abonnements/check-quotas.ts` ligne 59 — convertit 999 → null (illimité)
- `getQuotaSites(userId)`, `getQuotasUsage(siteId)` — `src/lib/abonnements/check-quotas.ts` — pour `detecterDepassements`

`calculateDateFin` existe aussi dans `src/lib/abonnements/create-from-pack.ts` ligne 26 mais est locale (non exportée). La fonction `calculerProchaineDate` dans `abonnements-constants.ts` est identique et exportée — à utiliser dans `prorata.ts`.

### Navigation ↔ Permissions : OK

La permission `ABONNEMENTS_GERER` existe dans le schema (ligne 213) et dans `src/types/models.ts` (ligne 105). Les nouvelles routes upgrade/downgrade devront l'utiliser (cohérent avec le pattern existant des routes abonnements).

Le dossier `src/app/(farm)/mon-abonnement/` existe avec `page.tsx` et `renouveler/`. Les dossiers `changer-plan/` et `gerer-ressources/` sont à créer (Stories 50.4 et 50.5).

### Build : OK
- `npx next build --webpack` : SUCCÈS — aucune erreur TypeScript ni de compilation.
- Seul avertissement : Next.js workspace root inference (non bloquant).

### Tests : 3988/3988 passent
- 126 fichiers de test, 3988 tests passés, 26 TODO.
- Aucune régression sur la suite existante.

## Incohérences trouvées

### 1. Migration locale bloquée (non liée au Sprint 50)
**Fichiers :** `prisma/migrations/20260316120000_add_unite_pack_produit/migration.sql`

La migration `20260316120000_add_unite_pack_produit` est en état FAILED sur la DB locale Docker. Elle tente `ALTER TABLE "PackProduit" ADD COLUMN "unite" "UniteStock"` mais la table `PackProduit` n'existe pas (erreur `42P01`). Cela empêche `npm run build` de tourner entièrement car `prisma migrate deploy` échoue.

Ce problème existe avant le Sprint 50 et ne bloque pas les stories 50.x si les développeurs utilisent `npx next build --webpack` directement. Mais `npm run build` reste cassé.

Suggestion : investiguer pourquoi `PackProduit` est absente de la DB locale. Peut-être une migration précédente a-t-elle droppé la table sans recréer la contrainte. À corriger par le @db-specialist hors Sprint 50.

### 2. `calculateDateFin` dupliquée (pattern, non bloquant)
**Fichiers :** `src/lib/abonnements/create-from-pack.ts` (ligne 26, privée) et `src/lib/abonnements-constants.ts` (ligne 233, publique sous le nom `calculerProchaineDate`)

Les deux fonctions font la même chose. Story 50.1 doit utiliser `calculerProchaineDate` depuis `abonnements-constants.ts` pour `calculerDateFinNouveau` — ne pas créer une troisième copie.

### 3. `resolvePlanLimites` utilise un cast `as TypePlan` (violation ERR-031 partielle)
**Fichier :** `src/lib/abonnements/check-quotas.ts` ligne 96

```typescript
const planLimites = PLAN_LIMITES[abonnement.plan.typePlan as TypePlan];
```

Pas d'import explicite de `TypePlan` comme clé, mais le cast `as TypePlan` est la forme correcte selon ERR-031. C'est conforme. Signalé pour mémoire car `prorata.ts` devra appliquer le même pattern pour `PLAN_LIMITES[nouveauPlan.typePlan as TypePlan]`.

## Risques identifiés

### 1. Guard division par zéro dans `calculerCreditRestant` (Story 50.1)
La story spécifie : `joursTotaux === 0` → `creditRestant = prixPaye`. Ce cas correspond à un upgrade le jour même de la souscription. Si ce guard est oublié, une division par zéro produit `NaN` qui se propage silencieusement dans le delta d'upgrade. Le test de non-régression pour ce cas est critique.

### 2. Atomicité R4 pour l'upgrade immédiat (Story 50.2)
Quand `delta <= 0`, l'upgrade doit être exécuté immédiatement : annuler l'ancien abonnement ET créer le nouveau ET mettre à jour `User.soldeCredit` dans la même `$transaction`. ERR-016 et ERR-014 documentent exactement ce pattern. Ne pas séparer ces 3 opérations.

### 3. CRON downgrade : re-validation des sélections (Story 50.6)
`downgradeRessourcesAGarder` est stocké en Json. Entre l'enregistrement du downgrade et son application par le CRON, l'utilisateur peut avoir supprimé des ressources mentionnées dans la sélection. Le CRON doit ignorer silencieusement les IDs invalides (ressources déjà supprimées) et bloquer les nouvelles ressources créées après la sélection si elles dépassent les nouvelles limites. Ce cas est documenté dans la story (Story 50.6, critères d'acceptation) mais constitue un risque d'oubli lors de l'implémentation.

### 4. `downgradeRessourcesAGarder` champ Json Prisma — cast requis (ERR-007)
Lors de l'update Prisma pour enregistrer `downgradeRessourcesAGarder`, il faudra caster avec `as Prisma.InputJsonValue` (ERR-007). Ce cast doit être appliqué dans la route `POST /api/abonnements/[id]/downgrade`.

### 5. Enum Prisma vs @/types pour `StatutAbonnement` (ERR-008)
Les nouvelles routes upgrade/downgrade liront des `Abonnement` depuis Prisma et compareront leur `statut`. Utiliser `(abonnement.statut as string) === StatutAbonnement.ACTIF` ou les fonctions de query qui abstraient le type Prisma généré (ERR-008).

## Prérequis manquants

1. `src/lib/abonnements/prorata.ts` — n'existe pas encore (objet de Story 50.1, c'est normal).
2. `src/app/api/abonnements/[id]/upgrade/route.ts` — n'existe pas encore (Story 50.2).
3. `src/app/api/abonnements/[id]/upgrade/cancel/route.ts` — n'existe pas encore (Story 50.2).
4. `src/app/api/abonnements/[id]/downgrade/route.ts` — n'existe pas encore (Story 50.3).
5. `src/app/api/abonnements/[id]/changer-periode/route.ts` — n'existe pas encore (Story 50.3).
6. `src/app/(farm)/mon-abonnement/changer-plan/page.tsx` — n'existe pas encore (Story 50.4).
7. `src/components/abonnements/upgrade-checkout-form.tsx` — n'existe pas encore (Story 50.4).
8. `src/components/abonnements/downgrade-resource-selector.tsx` — n'existe pas encore (Story 50.5).
9. `src/app/(farm)/mon-abonnement/gerer-ressources/page.tsx` — n'existe pas encore (Story 50.5).

Tous ces fichiers sont des livrables du sprint — leur absence est attendue.

## Recommandation

GO — commencer le Sprint 50.

Les fondations schema, types et utilitaires sont en place. La migration locale bloquée (`20260316120000`) ne concerne pas les stories 50.x et ne bloque pas le développement (le build Next.js seul passe). Les tests sont à 100 %.

Points d'attention prioritaires pour les développeurs :
- Story 50.1 (`prorata.ts`) : implémenter le guard div/0 et le guard `prixPaye=0` avant tout autre calcul.
- Story 50.2 : upgrade immédiat (delta ≤ 0) dans une seule `$transaction` (R4 — ERR-016).
- Story 50.3 : cast `as Prisma.InputJsonValue` pour `downgradeRessourcesAGarder` (ERR-007).
- Story 50.6 : le CRON doit re-valider les IDs de `downgradeRessourcesAGarder` au moment de l'exécution.
