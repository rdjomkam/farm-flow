# Pré-analyse Sprint 52 — Cleanup migration + retrait fallback
**Date :** 2026-04-04
**Analyste :** @pre-analyst

## Statut : GO AVEC RÉSERVES

## Résumé
Le sprint 52 a un périmètre clair mais l'impact est plus large que les 3 fichiers listés dans la story 52.2. On dénombre 12 fichiers sources (hors generated, tests, docs) qui devront être modifiés. Le point bloquant principal : `creerNotificationSiAbsente` dans `src/lib/alertes.ts` exige un `siteId` en premier paramètre — ce champ disparaît de `Abonnement`. Il faudra résoudre le siteId par une autre voie (via `userId → site`) pour ne pas casser `rappels-abonnement.ts`. La story 52.2 sous-estime ce point.

---

## Vérifications effectuées

### Schema — état actuel

`Abonnement.siteId` est `String NOT NULL` avec FK `Site` (relation `AbonnementsSite`).
`PaiementAbonnement.siteId` est `String NOT NULL` avec FK `Site` (relation `PaiementsAboSite`).
Les deux modèles ont un `@@index([siteId])`.
Le modèle `AbonnementAudit` n'a pas de `siteId` — exception documentée dans le schéma (commentaire JSDoc).

La story 52.1 prévoit deux étapes : rendre nullable d'abord, puis supprimer. C'est le bon ordre pour une migration sans downtime (ERR-001 + approche standard).

### Fichiers impactés — inventaire complet

#### Story 52.1 — Schema uniquement

| Fichier | Changement |
|---------|-----------|
| `prisma/schema.prisma` | Rendre `Abonnement.siteId` nullable, puis supprimer le champ + relation + index. Idem `PaiementAbonnement.siteId`. |
| `prisma/seed.sql` | Les INSERT de `Abonnement` et `PaiementAbonnement` passent `"siteId"` dans les colonnes — à supprimer après la migration finale. |

#### Story 52.2 — Code (12 fichiers source)

**`src/types/models.ts`**
- `interface Abonnement` : supprimer `siteId: string` (ligne 2715)
- `interface PaiementAbonnement` : supprimer `siteId: string` (ligne 2804) et le commentaire R8

**`src/lib/queries/abonnements.ts`**
- `createAbonnement(siteId, userId, ...)` : supprimer le paramètre `siteId` et le champ `siteId` dans `prisma.abonnement.create`
- `getAbonnementById(id, siteId?)` : supprimer le paramètre optionnel `siteId` et le filtre `...(siteId && { siteId })` (ligne 115)
- `getEssaisExpires()` : inclut `site: { select: ... }` via l'include — si la relation `site` disparaît du modèle, cet include sera invalide
- `AppliquerDowngradeResult.details[].siteId` dans le type retour de `abonnement-lifecycle.ts` (voir ci-dessous)

**`src/lib/queries/paiements-abonnements.ts`**
- `createPaiementAbonnement(data)` : supprimer `siteId: string` du type d'entrée et `siteId: data.siteId` dans `prisma.paiementAbonnement.create` (ligne 29)

**`src/lib/services/billing.ts`**
- Paramètre `siteId: string` dans `initierPaiement(abonnementId, userId, siteId, params)` — supprimer le paramètre et l'appel `createPaiementAbonnement({ ..., siteId })` (lignes 65, 110-116)
- Le commentaire JSDoc `@param siteId` à supprimer (lignes 59-70)

**`src/lib/services/rappels-abonnement.ts`**
- Ligne 130 : `creerNotificationSiAbsente(abonnement.siteId, abonnement.userId, ...)` — `abonnement.siteId` n'existera plus. **Bloquant : nécessite une solution alternative** (voir Risques ci-dessous).
- Ligne 140 : message de log `siteId=${abonnement.siteId}` — à supprimer ou remplacer.

**`src/lib/services/abonnement-lifecycle.ts`**
- Ligne 232-238 : `select { id, siteId, planId, userId, ... }` sur `prisma.abonnement.findMany` — supprimer `siteId` du select
- Lignes 271-282 : type du paramètre `abonnement` dans `_appliquerUnDowngrade` inclut `siteId: string` — à supprimer
- Lignes 326, 330, 364, 370 : `where: { siteId: abonnement.siteId }` — filtre Prisma légitime sur Bac/Vague, mais **utilise `abonnement.siteId` qui n'existera plus**. Il faudra trouver le siteId autrement (charger le site du userId, ou depuis la FK `userId → site.ownerId → site.id`).
- Ligne 380 : `siteId: abonnement.siteId` dans `tx.abonnement.create` — à supprimer
- Lignes 199, 274, 416 : `siteId` dans le type `AppliquerDowngradeResult.details[]` et dans le retour — à supprimer ou à obtenir via `userId`

**`src/app/api/abonnements/route.ts`**
- Ligne 184 : `siteId: auth.activeSiteId` dans `tx.abonnement.create` — à supprimer

**`src/app/api/abonnements/essai/route.ts`**
- Ligne 81 : `siteId: auth.activeSiteId` dans `tx.abonnement.create` — à supprimer

**`src/app/api/abonnements/[id]/upgrade/route.ts`**
- Lignes 166, 199 : `siteId: auth.activeSiteId` dans `tx.abonnement.create` — à supprimer

**`src/app/api/abonnements/[id]/renouveler/route.ts`**
- Ligne 127 : `siteId: auth.activeSiteId` dans `tx.abonnement.create` — à supprimer

**`src/app/api/backoffice/exonerations/route.ts`**
- Ligne 155 : `siteId` dans `tx.abonnement.create` — à supprimer. La variable `siteId` locale (résolue depuis le body) peut aussi être retirée du flow.

**`src/app/api/webhooks/manuel/route.ts`**
- Ligne 86-87 : `select: { siteId: true, planId: true, userId: true }` puis ligne 94 `applyPlanModules(abonnement.siteId, abonnement.planId)` — le select `siteId` sera invalide. `applyPlanModules` exige un `siteId` : il faudra le résoudre depuis `abonnement.userId → site.ownerId → site.id` (voir Risques).

**`src/lib/abonnements/create-from-pack.ts`**
- Lignes 108-113 : `findFirst({ where: { siteId, ... } })` — filtre sur `Abonnement.siteId` qui n'existera plus. La logique de détection d'abonnement existant devra passer à `userId`.
- Lignes 144-158, 165-179 : `siteId` dans `tx.abonnement.create` — à supprimer.

**`src/lib/queries/provisioning.ts`**
- Ligne 485-487 : `tx.abonnement.create({ data: { siteId: clientSite.id, ... } })` — à supprimer.

### Fichiers avec `getAbonnementById(id, siteId?)` — impact indirect

Le paramètre `siteId?` dans `getAbonnementById` est utilisé dans 6 routes :
- `src/app/api/abonnements/[id]/route.ts` — `getAbonnementById(id, auth.activeSiteId)` (ligne 26)
- `src/app/api/abonnements/[id]/paiements/route.ts` — deux appels (lignes 31, 59)
- `src/app/api/abonnements/[id]/annuler/route.ts` — ligne 33
- `src/app/api/abonnements/[id]/convertir-essai/route.ts` — ligne 54
- `src/app/api/abonnements/[id]/downgrade/route.ts` — lignes 42, 206
- `src/app/api/abonnements/[id]/upgrade/route.ts` — ligne 52

Ces routes utilisent `siteId` pour filtrer l'ownership. Après suppression, le filtre devra passer à `userId`. La story 52.2 ne mentionne pas explicitement ces 6 routes mais elles seront impactées par le changement de signature de `getAbonnementById`.

### Alias `getAbonnementActifParSite` — à supprimer

`src/lib/queries/abonnements.ts` expose `getAbonnementActifParSite` marqué `@deprecated` avec `// À supprimer au Sprint 52`. Ce nettoyage est dans le périmètre de 52.2.

### `resolvePlanLimites` — fallback DECOUVERTE

`src/lib/abonnements/check-quotas.ts` lignes 91-101 : `resolvePlanLimites` retourne les limites `TypePlan.DECOUVERTE` si `abonnement` est `null` (aucun abonnement actif). La story 52.2 demande de transformer ce comportement en erreur explicite. Impact sur :
- `getQuotasUsage` et `getQuotasUsageWithCounts` — doivent propager l'erreur si pas d'abonnement
- `getQuotaSites` — idem
- Tous les appelants de ces fonctions (routes `/api/bacs`, `/api/vagues`) devront gérer l'erreur

### Tests impactés

- `src/__tests__/api/paiements-abonnements.test.ts` ligne 151 : mock avec `abonnement: { id: "abo-1", siteId: "site-1", ... }` — à mettre à jour (ERR-017 : mettre à jour les mocks en même temps que le code)
- `src/__tests__/lib/check-subscription.test.ts` lignes 210, 254 : descriptions de test mentionnent "via siteId" mais ne testent pas le champ directement — à vérifier lors de la modif
- `src/__tests__/lib/check-quotas.test.ts` ligne 245 : test du fallback DECOUVERTE — devra être reécrit en test d'erreur

---

## Incohérences trouvées

1. **`creerNotificationSiAbsente` requiert `siteId` comme premier paramètre (signature non modifiable facilement)**
   Fichiers : `src/lib/alertes.ts` (ligne 79), `src/lib/services/rappels-abonnement.ts` (ligne 130)
   `rappels-abonnement.ts` passe `abonnement.siteId` à `creerNotificationSiAbsente`. Après suppression de `Abonnement.siteId`, il faudra soit (a) charger le site depuis `abonnement.userId` (requête additionnelle), soit (b) modifier la signature de `creerNotificationSiAbsente` pour accepter `userId` seulement. La story 52.2 ne mentionne pas ce fichier dans ses fichiers impactés.

2. **`appliquerDowngradeProgramme` utilise `abonnement.siteId` pour filtrer Bac et Vague**
   Fichier : `src/lib/services/abonnement-lifecycle.ts` lignes 326, 330, 364, 370, 380, 416
   Le downgrade filtre `bac.siteId` et `vague.siteId` via `abonnement.siteId`. Après suppression, il faut récupérer le siteId du site associé à l'utilisateur. Le lien `userId → site.ownerId → site.id` n'est pas trivial (un userId peut avoir plusieurs sites). La story 52.2 ne mentionne pas ce fichier dans ses fichiers impactés.

3. **`applyPlanModules(abonnement.siteId, ...)` dans le webhook manuel**
   Fichier : `src/app/api/webhooks/manuel/route.ts` ligne 94
   `applyPlanModules` prend un `siteId` comme premier argument. Après suppression de `Abonnement.siteId`, le webhook devra résoudre le siteId autrement. La story 52.2 ne mentionne pas ce fichier.

4. **`create-from-pack.ts` détecte l'abonnement existant via `siteId`**
   Fichier : `src/lib/abonnements/create-from-pack.ts` lignes 108-113
   Le `findFirst` cherche un abonnement ACTIF par `siteId`. Après suppression, la recherche devra se faire par `userId`. Cette sémantique est différente : un user peut avoir plusieurs sites, l'abonnement est au niveau user. La story 52.2 ne mentionne pas ce fichier.

5. **`provisioning.ts` crée un abonnement avec `siteId`**
   Fichier : `src/lib/queries/provisioning.ts` ligne 487
   La story 52.2 ne mentionne pas ce fichier dans ses fichiers impactés.

6. **`getEssaisExpires()` inclut la relation `site`**
   Fichier : `src/lib/queries/abonnements.ts` lignes 282-284
   L'include `site: { select: { id, name } }` sera invalide si la relation `Site ↔ Abonnement` est supprimée du schéma. À supprimer ou remplacer par un join via `user.sites`.

7. **Interface `Abonnement` dans `src/types/models.ts` inclut `siteId`**
   La story 52.2 identifie correctement ce fichier. `PaiementAbonnement` aussi.

8. **`seed.sql` — INSERT avec colonne `siteId`**
   Fichier : `prisma/seed.sql` lignes 2455-2456, 2466
   Les INSERT de `Abonnement` et `PaiementAbonnement` passent `"siteId"` — à supprimer après la migration finale. Non mentionné dans la story.

---

## Risques identifiés

1. **Résolution du siteId pour les services qui en ont toujours besoin**
   Impact : Haute
   `creerNotificationSiAbsente`, `applyPlanModules`, `appliquerDowngradeProgramme` ont besoin d'un `siteId` pour fonctionner, mais il ne sera plus disponible via `abonnement.siteId`. Le remplacement logique est `userId → site.ownerId`, mais un utilisateur peut posséder plusieurs sites. Il faudra décider : (a) envoyer la notification à tous les sites de l'user, (b) charger le premier site actif, ou (c) modifier `creerNotificationSiAbsente` pour fonctionner sans `siteId`. Ce choix architectural doit être documenté avant de coder.
   Mitigation : Documenter la décision dans l'ADR-020 avant de commencer la story 52.2.

2. **Les 6 routes `getAbonnementById(id, siteId)` perdent leur vérification d'ownership**
   Impact : Haute (sécurité)
   Ces routes utilisent `siteId` pour s'assurer que l'abonnement appartient au site actif (isolation multi-tenant). Après suppression, elles devront vérifier `abonnement.userId === auth.userId` à la place. Si ce changement est oublié, n'importe quel utilisateur authentifié pourrait lire l'abonnement d'un autre user.
   Mitigation : Remplacer systématiquement le filtre `siteId` par `userId` dans `getAbonnementById` ET dans chaque route appelante.

3. **Migration en deux étapes — risque de désynchro entre nullable et suppression**
   Impact : Moyenne
   La story préconise "rendre nullable d'abord, puis supprimer". Si la migration nullable est déployée mais que le code n'est pas mis à jour avant la migration de suppression, la FK reste active (RESTRICT) et les INSERT existants continueront à fonctionner. Mais si le code est mis à jour (sans passer siteId) avant que la migration nullable soit appliquée, les INSERT Prisma échoueront avec NOT NULL.
   Mitigation : Appliquer la migration nullable en premier, déployer le code qui ne passe plus siteId, puis appliquer la migration de suppression. ERR-002 s'applique ici.

4. **`resolvePlanLimites` sans fallback — sites existants sans abonnement**
   Impact : Haute
   Si un site n'a pas d'abonnement actif (ex. : pendant le backlog Sprint 52 en dev), `getQuotasUsage` lèvera une erreur au lieu de retourner des limites. Les routes `/api/bacs` et `/api/vagues` devront gérer ce cas. En production, tout site doit avoir un abonnement (ACTIF, EN_GRACE ou au moins DECOUVERTE via seed). En dev, les seeds existants créent 2 abonnements (`abo_site_01` et `abo_client_01`).
   Mitigation : S'assurer que le seed.sql crée des abonnements valides pour tous les sites de test avant de supprimer le fallback.

5. **Tests cassés silencieusement (ERR-017)**
   Impact : Haute
   `paiements-abonnements.test.ts` mock un objet avec `abonnement.siteId`. Si le type `Abonnement` est mis à jour mais pas le mock, le test continue à passer (TypeScript accepte les objets avec des champs supplémentaires). Le risque est l'inverse : si le mock est cassé par le changement de type, le test échoue en build. Relancer `npx vitest run` après chaque changement.

---

## Prérequis manquants

1. **Décision architecturale sur le remplacement de `siteId` dans les services dépendants**
   `creerNotificationSiAbsente`, `applyPlanModules` et `appliquerDowngradeProgramme` doivent savoir comment obtenir un `siteId` sans `abonnement.siteId`. Cette décision doit être prise et documentée (ADR-020 ou note dans la story) avant de coder 52.2. Sans cela, les développeurs prendront des décisions incohérentes sur ces 3 services.

2. **Périmètre de 52.2 à élargir**
   La story 52.2 liste 3 fichiers (`check-quotas.ts`, `queries/abonnements.ts`, `types/models.ts`). Le périmètre réel est de 12 fichiers. Le @project-manager doit mettre à jour la story avec la liste complète avant assignation.

---

## Récapitulatif — fichiers à modifier

**Story 52.1 (schema uniquement) :**
- `/Users/ronald/project/dkfarm/farm-flow/prisma/schema.prisma`
- `/Users/ronald/project/dkfarm/farm-flow/prisma/seed.sql`

**Story 52.2 (code) :**
- `/Users/ronald/project/dkfarm/farm-flow/src/types/models.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/abonnements.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/paiements-abonnements.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/services/billing.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/services/rappels-abonnement.ts` (non listé dans la story)
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/services/abonnement-lifecycle.ts` (non listé dans la story)
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/abonnements/check-quotas.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/abonnements/create-from-pack.ts` (non listé dans la story)
- `/Users/ronald/project/dkfarm/farm-flow/src/lib/queries/provisioning.ts` (non listé dans la story)
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/abonnements/route.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/abonnements/essai/route.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/abonnements/[id]/upgrade/route.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/abonnements/[id]/renouveler/route.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/abonnements/[id]/route.ts` (ownership check)
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/abonnements/[id]/paiements/route.ts` (ownership check)
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/abonnements/[id]/annuler/route.ts` (ownership check)
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/abonnements/[id]/convertir-essai/route.ts` (ownership check)
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/abonnements/[id]/downgrade/route.ts` (ownership check)
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/backoffice/exonerations/route.ts`
- `/Users/ronald/project/dkfarm/farm-flow/src/app/api/webhooks/manuel/route.ts` (non listé dans la story)
- Tests : `src/__tests__/api/paiements-abonnements.test.ts`, `src/__tests__/lib/check-quotas.test.ts`

---

## Recommandation

GO AVEC RÉSERVES.

La story 52.1 est autonome et peut commencer immédiatement — migration schema uniquement, impact limité.

La story 52.2 ne peut pas commencer avant résolution du prérequis 1 (décision sur le remplacement de `siteId` dans les services dépendants). Le périmètre de 52.2 doit être élargi à 20 fichiers. Corriger le périmètre dans le backlog avant d'assigner. Les 5 fichiers non listés (`rappels-abonnement.ts`, `abonnement-lifecycle.ts`, `create-from-pack.ts`, `provisioning.ts`, `webhooks/manuel/route.ts`) et les 6 routes d'ownership sont des omissions bloquantes si elles ne sont pas traitées dans le même sprint.
