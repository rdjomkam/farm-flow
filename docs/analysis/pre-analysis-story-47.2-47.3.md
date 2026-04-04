# Pré-analyse Stories 47.2 et 47.3 — 2026-04-04

## Statut : GO AVEC RÉSERVES

## Résumé
Les prérequis Sprint 46 (`invalidateSubscriptionCaches`, `logAbonnementAudit`, `User.soldeCredit`) sont tous présents et fonctionnels. Les fichiers cibles existent avec du code cohérent. Quatre incohérences ont été identifiées : deux dans le code existant à corriger dans cette story, deux dans la spécification à clarifier avant d'implémenter.

---

## Vérifications effectuées

### Prérequis Sprint 46 : OK

- `invalidateSubscriptionCaches(userId)` — présent dans `src/lib/abonnements/invalidate-caches.ts`, signature correcte, invalide `subscription-${userId}` + `subscription-site-${siteId}` pour chaque site owned.
- `logAbonnementAudit(abonnementId, action, userId, metadata?)` — présent dans `src/lib/queries/abonnements.ts` ligne 257, exporté via `src/lib/queries/index.ts`.
- `User.soldeCredit Decimal @default(0)` — présent dans `prisma/schema.prisma` ligne 923.
- `AbonnementAudit` model — présent dans le schéma.

### Schema Abonnement : POINT D'ATTENTION

Le modèle `Abonnement` dans le schéma a `siteId String` (non nullable, FK obligatoire). La story 47.2 demande de "supprimer le paramètre siteId de `createAbonnement()`" et de "lier l'abonnement au userId sans siteId". Mais le schéma exige toujours `siteId` — ce champ ne peut pas être omis tant que le Sprint 52 (cleanup migration) n'a pas rendu `siteId` nullable ou supprimé.

Implication : la story 47.2 doit résoudre `siteId` depuis `auth.activeSiteId` pour le passer à Prisma, même si la route "conceptuellement" n'en dépend plus. Supprimer siteId du paramètre de `createAbonnement()` sans migration schéma est impossible.

### Webhooks : OK (presque)

- `src/app/api/webhooks/smobilpay/route.ts` — utilise déjà `invalidateSubscriptionCaches(paiementApresConfirm.abonnement.userId)`. Conforme à 47.3.
- `src/app/api/webhooks/manuel/route.ts` — utilise déjà `invalidateSubscriptionCaches(abonnement.userId)`. Conforme à 47.3.

Les deux webhooks sont déjà adaptés au user-level. La story 47.3 pour ces deux fichiers est déjà implémentée.

### billing.ts : PROBLÈME

La fonction `initierPaiement` vérifie ownership via `getAbonnementById(abonnementId, siteId)` (ligne 67). Cette vérification doit être adaptée au user-level selon 47.3 : vérifier que l'abonnement appartient à `userId`, pas à `siteId`.

La query `getAbonnementById` accepte un `siteId?` optionnel (ligne 111 de `abonnements.ts`). Pour adapter billing.ts au user-level, il faut soit :
a. Ajouter un filtre `userId` dans `getAbonnementById` (champ existant dans le modèle), ou
b. Passer `userId` à la place de `siteId` et adapter la query.

### rappels-abonnement.ts : POINT D'ATTENTION

Le service utilise `abonnement.siteId` dans deux endroits :
1. Ligne 130 : `creerNotificationSiAbsente(abonnement.siteId, abonnement.userId, ...)` — siteId est un paramètre de cette fonction. Si `creerNotificationSiAbsente` requiert le siteId, il ne peut pas être supprimé.
2. Ligne 143 (log) : `siteId=${abonnement.siteId}` — dans le message d'erreur, pas un problème bloquant.

La query `prisma.abonnement.findMany` inclut le champ `siteId` dans le résultat (c'est un champ non nullable du modèle). Le siteId reste disponible et utilisable.

### Route POST /api/abonnements : INCOHÉRENCE

La route actuelle passe `auth.activeSiteId` à `createAbonnement()` (ligne 159) et utilise `auth.activeSiteId` dans `verifierRemiseApplicable`. La garde-fou 409 (vérifier si un `EN_ATTENTE_PAIEMENT` existe pour ce user) est absente — c'est la modification centrale de 47.2.

L'appel à `logAbonnementAudit` est absent des deux routes de mutation (POST et renouveler). C'est à implémenter.

### Route POST /api/abonnements/[id]/renouveler : INCOHÉRENCE

La logique de déduction de `User.soldeCredit` est absente. Deux points à implémenter :
1. Lire `user.soldeCredit` avant de calculer `prixFinal`
2. Déduire atomiquement (ne pas dépasser 0) et mettre à jour `user.soldeCredit` en DB

La déduction doit être atomique avec la création de l'abonnement (R4) : si la transaction échoue, le crédit ne doit pas être consommé. Attention à l'erreur ERR-016 (race condition check-then-update).

### Erreurs connues (ERRORS-AND-FIXES.md) à surveiller

- ERR-031 (R2 : accès PLAN_TARIFS via cast) : la route `renouveler` ligne 85 contient `PLAN_TARIFS[plan.typePlan as keyof typeof PLAN_TARIFS]` — violation R2 déjà présente dans le code existant. Pas à corriger dans cette story (hors scope 47.2) mais à noter.
- ERR-016 (R4 race condition) : la déduction de `soldeCredit` + création abonnement doit être dans `$transaction`.

---

## Incohérences trouvées

1. **`createAbonnement()` — siteId non supprimable sans migration schéma**
   - Fichiers : `src/lib/queries/abonnements.ts` + `prisma/schema.prisma`
   - `Abonnement.siteId` est `String` (NOT NULL) dans le schéma. La story demande de supprimer le paramètre siteId de `createAbonnement()`, ce qui est impossible sans rendre le champ nullable (Sprint 45.1 avait prévu de le garder pour la compatibilité ascendante).
   - Suggestion : garder `siteId` dans `createAbonnement()` pour Sprint 47, le supprimer en Sprint 52. Clarifier avec @architect.

2. **Garde-fou 409 absent dans `POST /api/abonnements`**
   - Fichier : `src/app/api/abonnements/route.ts`
   - Aucune vérification de l'existence d'un `EN_ATTENTE_PAIEMENT` pour ce userId. Le check doit utiliser `userId` (pas `siteId`) et être dans une `$transaction` avec la création (ERR-016).

3. **`logAbonnementAudit` absent des deux routes de mutation**
   - Fichiers : `src/app/api/abonnements/route.ts`, `src/app/api/abonnements/[id]/renouveler/route.ts`
   - Les deux routes effectuent des mutations (création d'abonnement) sans appeler `logAbonnementAudit`.

4. **`billing.ts` — ownership check via siteId au lieu de userId**
   - Fichier : `src/lib/services/billing.ts` ligne 67 : `getAbonnementById(abonnementId, siteId)`
   - Pour le user-level, la vérification doit être `getAbonnementById(abonnementId)` + vérifier `abonnement.userId === userId`. La query `getAbonnementById` doit accepter un filtre `userId` optionnel.

5. **`rappels-abonnement.ts` — `creerNotificationSiAbsente` requiert siteId**
   - Fichier : `src/lib/services/rappels-abonnement.ts` ligne 130
   - `siteId` reste nécessaire comme paramètre de `creerNotificationSiAbsente`. Tant que `Abonnement.siteId` existe dans le schéma, ce n'est pas un problème — le siteId est disponible sur l'abonnement. Aucune modification nécessaire pour 47.3.

6. **Webhooks déjà adaptés — travail partiellement fait**
   - Fichiers : `src/app/api/webhooks/smobilpay/route.ts`, `src/app/api/webhooks/manuel/route.ts`
   - Les deux routes utilisent déjà `invalidateSubscriptionCaches(userId)`. Les tâches webhooks de 47.3 sont déjà terminées. Confirmer et cocher, mais ne pas re-modifier ces fichiers.

---

## Risques identifiés

1. **Race condition sur le garde-fou 409 (ERR-016)**
   - Impact : deux requêtes POST simultanées peuvent toutes deux passer le check `EN_ATTENTE_PAIEMENT` et créer deux abonnements en attente.
   - Mitigation : encapsuler `count(EN_ATTENTE_PAIEMENT) + create` dans `prisma.$transaction`.

2. **Déduction `soldeCredit` non atomique**
   - Impact : si la création de l'abonnement échoue après la déduction du crédit, le crédit est perdu.
   - Mitigation : lire `user.soldeCredit`, calculer le montant déduit, et effectuer `user.update + abonnement.create` dans la même `$transaction`.

3. **Violation R2 existante dans `/renouveler` (ERR-031)**
   - `PLAN_TARIFS[plan.typePlan as keyof typeof PLAN_TARIFS]` ligne 85 de `renouveler/route.ts`.
   - Impact : si `TypePlan` change, TypeScript ne détecte pas la régression.
   - Mitigation : corriger dans cette story puisque le fichier est modifié de toute façon.

---

## Prérequis manquants

- Story 46.4 (Test + Review Sprint 46) est en `TODO`. Avant de démarrer 47.2, vérifier que 46.1-46.3 passent les tests (`npx vitest run`). Les dépendances fonctionnelles (invalidateSubscriptionCaches, logAbonnementAudit) sont présentes dans le code mais non testées formellement.

---

## Recommandation

GO avec les réserves suivantes à résoudre pendant l'implémentation :

1. Ne pas supprimer `siteId` de `createAbonnement()` — conserver le paramètre, le résoudre depuis `auth.activeSiteId` dans la route. Documenter que la suppression est pour Sprint 52.
2. Implémenter le garde-fou 409 dans `prisma.$transaction` (count + create atomiques).
3. Implémenter `logAbonnementAudit` dans les deux routes POST.
4. Adapter `billing.ts` : vérifier `abonnement.userId === userId` au lieu de passer `siteId` à `getAbonnementById`.
5. Ne pas modifier les webhooks (déjà conformes).
6. Corriger la violation R2 sur `PLAN_TARIFS` dans `renouveler/route.ts` puisque le fichier est modifié.
