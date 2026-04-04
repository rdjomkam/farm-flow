# Pre-analyse Story 47.1 — API quota checks bacs/vagues/sites + messages adaptes au role

**Date :** 2026-04-04
**Sprint :** 47

## Statut : GO AVEC RESERVES

## Resume

Les trois routes cibles existent et ont deja un mecanisme de quota partiel. Les prerequis
du Sprint 46 (`getAbonnementActifPourSite`, `getQuotaSites`, `isBlocked` dans le schema) sont
tous en place. La story peut demarrer, mais trois points doivent etre explicitement traites
par le developpeur.

---

## Verifications effectuees

### Schema — isBlocked et ownerId : OK

Les trois champs cibles existent dans le schema Prisma :

- `Site.isBlocked Boolean @default(false)` (ligne 564)
- `Bac.isBlocked Boolean @default(false)` (ligne 972)
- `Vague.isBlocked Boolean @default(false)` (ligne 998)
- `Site.ownerId String` (ligne 559) avec relation `User @relation("SiteOwner")`

### Prerequisites Sprint 46 : OK

- `getAbonnementActifPourSite(siteId)` : present dans `src/lib/queries/abonnements.ts` (ligne 54)
- `getQuotaSites(userId)` : present dans `src/lib/abonnements/check-quotas.ts` (ligne 174)
- `getAbonnementActif(userId)` : present dans `src/lib/queries/abonnements.ts` (ligne 29)
- `normaliseLimite` et `isQuotaAtteint` : presents dans `src/lib/abonnements/check-quotas.ts`
- `PLAN_LIMITES` : present dans `src/lib/abonnements-constants`

### Etat des routes cibles

**POST /api/bacs** (`src/app/api/bacs/route.ts`) :

- Quota check PRESENT dans `$transaction` (R4 respecte, atomique)
- Message d'erreur unique : code 402, texte generique "Passez a un plan superieur"
- Pas de check `isBlocked` sur le bac ni sur le site
- Pas de differenciation owner/employe dans le message d'erreur
- Pattern de quota : `PLAN_LIMITES as Record<string, ...>` — violation R2/ERR-031 (cast
  `as Record<string, ...>` au lieu d'utiliser `as TypePlan`)

**POST /api/vagues** (`src/app/api/vagues/route.ts`) :

- Quota check PRESENT dans `$transaction` (R4 respecte, atomique)
- Message d'erreur unique : code 402, texte generique "Passez a un plan superieur"
- Pas de check `isBlocked` sur la vague ni sur le site
- Pas de differenciation owner/employe dans le message d'erreur
- Meme violation R2/ERR-031 que `/api/bacs` : cast `as Record<string, ...>` sur PLAN_LIMITES

**POST /api/sites** (`src/app/api/sites/route.ts`) :

- PAS de quota check present
- Auth : `requireAuth` + check `session.role !== Role.ADMIN` (pas `requirePermission`)
- Pas de differenciation owner/employe
- Pas de check `isBlocked` sur le site en cours de creation (via quota utilisateur)
- La creation passe par `createSite(data, session.userId)` dans `src/lib/queries/sites.ts`

### Helper isOwner : ABSENT

La fonction `isOwner(userId, siteId)` n'existe pas encore dans le codebase. Elle doit etre
creee. La logique consiste a interroger `site.ownerId === userId`. La query de base est
disponible : `prisma.site.findUnique({ where: { id: siteId }, select: { ownerId: true } })`.

---

## Incoherences trouvees

### 1. Violation R2/ERR-031 deja presente dans /api/bacs et /api/vagues

**Fichiers :** `src/app/api/bacs/route.ts` lignes 114-115, `src/app/api/vagues/route.ts` lignes 186-187

```typescript
// Pattern actuel (violation) :
const typePlan = abonnement.plan.typePlan as string;
const planLimites = (PLAN_LIMITES as Record<string, ...>)[typePlan];

// Pattern correct (R2 + ERR-031) :
const planLimites = PLAN_LIMITES[abonnement.plan.typePlan as TypePlan];
```

Cette violation est deja dans le code existant. La story 47.1 devra soit la corriger en
passant (recommande), soit ne pas l'aggraver. Le developpeur doit en etre conscient.

### 2. isBlocked verifie dans check-quotas mais pas dans les routes POST

`getQuotasUsageWithCounts` dans `check-quotas.ts` exclut les ressources bloquees des
comptages (`where: { isBlocked: false }`), ce qui est correct pour les compteurs. Mais aucune
route ne rejette explicitement une creation sur une ressource dont `site.isBlocked = true`.
La story 47.1 doit ajouter ce check en entree de chaque POST.

### 3. Conflit de nom : fonction isBlocked dans check-subscription.ts

`src/lib/abonnements/check-subscription.ts` exporte deja une fonction `isBlocked(statut)`.
Le helper `isOwner` peut introduire une confusion si le developpeur nomme son helper de
verification du flag `Site.isBlocked` avec le meme nom. Il faut soit nommer le nouveau
helper `isSiteBlocked(siteId)` ou verifier directement le champ dans la transaction.

---

## Risques identifies

### 1. Double appel a getAbonnementActifPourSite (performance / ERR-029)

Les routes `/api/bacs` et `/api/vagues` appellent deja `getAbonnementActifPourSite` dans
la `$transaction`. Si le developpeur ajoute un appel externe a `isOwner` qui fait lui-meme
un `prisma.site.findUnique`, il y aura deux requetes sur `Site`. Recommandation : charger
`site.ownerId` et `site.isBlocked` en une seule requete dans la transaction, en remplacement
de l'appel a `getAbonnementActifPourSite` qui ne retourne que l'abonnement.

Alternative propre : charger site, ownerId, isBlocked ET abonnement en parallele dans la
transaction pour minimiser les allers-retours DB.

### 2. getAbonnementActifPourSite est mis en cache (unstable_cache) — incompatible $transaction

`getAbonnementActifPourSite` utilise `unstable_cache` (Next.js cache). Appeler une fonction
cachee a l'interieur d'une `$transaction` Prisma ne casse pas la transaction, mais le
resultat vient du cache et non du tx. C'est deja le cas dans le code existant — le risque
est connu et accepte pour la lecture de l'abonnement. Ne pas etendre ce pattern a d'autres
donnees critiques (ex: `site.isBlocked` doit etre lu sans cache dans la transaction).

### 3. Route POST /api/sites utilise requireAuth au lieu de requirePermission

La route `/api/sites` utilise `requireAuth` + check manuel `Role.ADMIN`, pas
`requirePermission`. La story devra soit maintenir ce pattern soit le migrer vers
`requirePermission` avec une permission dediee. Un changement de pattern introduit un
risque de regression sur la gestion des acces.

### 4. Regression potentielle sur les tests existants (ERR-017)

Les routes `/api/bacs` et `/api/vagues` ont probablement des tests. Tout changement du flow
interne de la `$transaction` (ajout de check `site.isBlocked`, changement du message
d'erreur) peut casser les mocks existants. Le developpeur doit relancer `npx vitest run`
apres chaque modification de route.

---

## Prerequis manquants

1. **Helper `isOwner(userId, siteId)` a creer** — n'existe pas encore. A placer dans
   `src/lib/abonnements/check-quotas.ts` ou un nouveau fichier dedié.

2. **Localisation du userId courant dans les routes /api/bacs et /api/vagues** — `auth`
   retourne `auth.userId` et `auth.activeSiteId`. Le `userId` est disponible via
   `auth.userId` (a verifier selon le type retourne par `requirePermission`).

---

## Synthese par route

| Route | Quota check | isBlocked check | Message role-aware | isOwner helper |
|-------|-------------|-----------------|-------------------|----------------|
| POST /api/bacs | PRESENT (R4 OK) | ABSENT | ABSENT | ABSENT |
| POST /api/vagues | PRESENT (R4 OK) | ABSENT | ABSENT | ABSENT |
| POST /api/sites | ABSENT | ABSENT | ABSENT | ABSENT |

---

## Recommandation

GO. Les prerequis Sprint 46 sont en place, les routes existent, la structure de transaction
est deja correcte pour bacs et vagues. Le developpeur doit :

1. Creer le helper `isOwner(userId, siteId)` (requete simple, pas de cache).
2. Ajouter le check `site.isBlocked` en entree des trois routes POST, en lisant le champ
   directement depuis Prisma (sans cache) dans la transaction ou avant elle.
3. Remplacer les messages d'erreur 402 par des messages differenties selon `isOwner`.
4. Ajouter le quota check complet dans POST /api/sites via `getQuotaSites(userId)`.
5. Corriger la violation R2/ERR-031 sur les casts `as Record<string, ...>` en passant par
   `as TypePlan` (correction opportuniste recommandee car les lignes concernees sont de toute
   facon modifiees).
6. Relancer `npx vitest run` apres chaque route pour detecter les regressions de mocks (ERR-017).
