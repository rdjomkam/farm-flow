# Pré-analyse Sprint 48 — 2026-04-04

## Statut : GO AVEC RÉSERVES

## Résumé
Les 4 stories du Sprint 48 sont des stories UI pures sans migration de schéma ni nouvelle route API. Le build de production est bloqué par l'absence de la base de données distante (prod inaccessible au moment de l'analyse), mais la compilation TypeScript ne produit aucune erreur sur les fichiers sources. Les tests passent intégralement (126 fichiers, 3988 tests). Trois réserves majeures sont identifiées : (1) `isOwner` n'existe pas dans `UserSession` et doit être dérivé côté Server Component ; (2) `soldeCredit` vit sur `User` et n'est pas chargé dans la page `/mon-abonnement` — requête supplémentaire requise ; (3) `VagueSummaryResponse` et `SiteData` ne portent pas `isBlocked` — à ajouter pour Story 48.4.

---

## Vérifications effectuées

### Schema ↔ Types : PROBLÈMES PARTIELS
- `isBlocked` est présent dans le schéma Prisma sur les modèles : `Site`, `Bac`, `Vague`.
- `BacResponse` (`src/types/api.ts`) inclut `isBlocked: boolean` — OK.
- `VagueSummaryResponse` (`src/types/api.ts` ligne 267) ne contient PAS `isBlocked` — manquant.
- `SiteData` dans `SitesListClient` (`src/components/sites/sites-list-client.tsx`) ne contient PAS `isBlocked` — manquant.
- Le mapping dans `src/components/pages/vagues-page.tsx` (lignes 33-51) ne propage pas `isBlocked` depuis Prisma vers le type DTO.
- `soldeCredit` est dans `User` (Prisma + `src/types/models.ts:395`) mais absent de `UserSession` (`src/types/auth.ts:23`).

### API ↔ Queries : OK
- `POST /api/sites` vérifie déjà l'abonnement (`getSubscriptionStatus`) et le quota (`getQuotaSites`) — retourne 402/403 selon le cas.
- `getQuotaSites(userId)` existe dans `src/lib/abonnements/check-quotas.ts`.
- `getQuotasUsageWithCounts(siteId)` pour `QuotasUsageBar` existe et fonctionne.

### Navigation ↔ Permissions : OK
- La page `/mon-abonnement` est protégée par `Permission.ABONNEMENTS_VOIR`.
- La page `/settings/sites` filtre via `session.role === Role.ADMIN` pour `canCreate`.

### Build : NON ÉVALUABLE
`npm run build` échoue à l'étape `prisma migrate deploy` avec `P1001: Can't reach database server at 72.61.187.32:5432` (base prod inaccessible). La compilation TypeScript `tsc --noEmit` sur les fichiers `src/` (hors tests) ne produit aucune erreur.

### Tests : 3988/3988 passent (126 fichiers)
`npx vitest run` : 126 passed, 0 failed, 26 todo. Des erreurs TypeScript préexistantes dans certains fichiers de test (`permissions.test.ts`, `analytics-aliments.test.tsx`, `farm-nav.test.ts`) sont signalées par `tsc --noEmit` mais n'affectent pas l'exécution Vitest.

---

## Analyse par story

### Story 48.1 — Déplacer QuotasUsageBar + afficher soldeCredit

- `QuotasUsageBar` est rendu dans `src/components/pages/vagues-page.tsx` (ligne 73) et `src/components/pages/bacs-page.tsx` (ligne 26). La story demande de le retirer de `vagues-page.tsx` uniquement et de l'ajouter dans `src/app/(farm)/mon-abonnement/page.tsx`.
- La page `/mon-abonnement` est un Server Component — compatible avec `QuotasUsageBar` (qui est lui aussi un Server Component async).
- `soldeCredit` est sur le modèle `User` mais absent de `UserSession`. La page `/mon-abonnement` devra faire une requête additionnelle : `prisma.user.findUnique({ where: { id: session.userId }, select: { soldeCredit: true } })`.
- Les libellés dans `QuotasUsageBar` sont en strings hardcodées françaises (non i18n) — acceptable si pas d'exigence EN sur ce sprint.

### Story 48.2 — Messages d'erreur adaptés au rôle (owner vs employé)

- `UserSession` ne contient pas de champ `isOwner`. La distinction owner/employé doit être dérivée par une requête : `prisma.site.findFirst({ where: { id: activeSiteId, ownerId: userId } })`.
- `session.role === Role.ADMIN` n'est pas un proxy exact : un ADMIN peut être membre sans être propriétaire du site actif.
- `src/messages/fr/errors.json` (section `quota`) ne contient pas de clé pour "Mettez à niveau votre plan" ou "Contactez le propriétaire". Les clés suivantes sont à créer dans `errors.json` (fr + en) :
  - `quota.upgradeOwner`
  - `quota.contactOwner`
- Le hook `useApi` (`src/hooks/use-api.ts`) affiche un toast générique avec le message brut de l'API — il ne discrimine pas selon le code 402. Pour adapter le message au rôle, la logique doit être dans le composant appelant (`SitesListClient`, `BacsListClient`, `VaguesListClient`) qui intercepte `ok === false` et vérifie `isOwner` pour choisir le message affiché.

### Story 48.3 — Flow création de site avec vérification abonnement

- Il n'existe pas de page `/sites/nouveau`. La création de site se fait dans un `Dialog` inline dans `SitesListClient` (`src/components/sites/sites-list-client.tsx`).
- La vérification abonnement/quota est déjà faite côté API (retour 402/403). Il n'y a pas de vérification préventive côté UI avant d'ouvrir le Dialog.
- La story demande une redirection vers `/tarifs?returnUrl=/sites/nouveau`. Deux approches possibles :
  - (A) Créer une page dédiée `/sites/nouveau` et intercepter la vérification quota avant d'afficher le formulaire.
  - (B) Adapter `SitesListClient` pour intercepter l'erreur 402/403 après la tentative de création et proposer la redirection.
- La page `/tarifs` existe (`src/app/tarifs/page.tsx`) mais ne gère pas `returnUrl` actuellement.
- `canCreate` dans `src/app/(farm)/settings/sites/page.tsx` est déterminé uniquement par `session.role === Role.ADMIN`, sans vérification du quota de sites disponible.

### Story 48.4 — UI ressources bloquées (badge cadenas, grisé, dialog upgrade)

- Le composant `BlockedResourceOverlay` n'existe pas dans le codebase — à créer.
- `BacResponse.isBlocked` est disponible dans `BacsListClient` — OK.
- `VagueSummaryResponse` ne contient pas `isBlocked` : il faut (1) ajouter le champ au type dans `src/types/api.ts`, (2) ajouter le champ au mapping dans `src/components/pages/vagues-page.tsx` ligne ~45.
- `SiteData` dans `SitesListClient` ne contient pas `isBlocked` : il faut (1) ajouter le champ au `getUserSites` query select, (2) l'inclure dans le mapping de `src/app/(farm)/settings/sites/page.tsx`.
- Le pattern d'overlay existant le plus proche est `LoadingOverlay` (`src/components/ui/loading-overlay.tsx`) — utilise `fixed inset-0` pour couvrir toute la page. `BlockedResourceOverlay` devra être en `relative` ou `absolute` pour ne couvrir qu'une carte.
- La dialog Radix est le pattern établi (R5 : `DialogTrigger asChild`) — à réutiliser pour le dialog upgrade.

---

## Incohérences trouvées

1. **`VagueSummaryResponse` sans `isBlocked`** — Le champ `isBlocked` existe sur le modèle Prisma `Vague` mais n'est pas dans `VagueSummaryResponse` (`src/types/api.ts:267`) ni dans le mapping de `src/components/pages/vagues-page.tsx`. Fichiers à modifier pour Story 48.4 : `src/types/api.ts`, `src/components/pages/vagues-page.tsx`.

2. **`SiteData` sans `isBlocked`** — Le champ `isBlocked` existe sur le modèle Prisma `Site` mais `SiteData` dans `SitesListClient` ne l'expose pas. La query `getUserSites` ne le sélectionne pas. Fichiers à modifier pour Story 48.4 : `src/lib/queries/sites.ts`, `src/app/(farm)/settings/sites/page.tsx`, `src/components/sites/sites-list-client.tsx`.

3. **`soldeCredit` absent de `UserSession`** — Le champ est sur `User` mais pas dans la session. La page `/mon-abonnement` devra faire une requête supplémentaire pour l'afficher (Story 48.1). Fichier concerné : `src/app/(farm)/mon-abonnement/page.tsx`.

4. **Clés i18n manquantes pour Story 48.2** — `src/messages/fr/errors.json` section `quota` ne contient pas les clés pour les messages différenciés par rôle. Fichiers concernés : `src/messages/fr/errors.json`, `src/messages/en/errors.json`.

5. **R6 dans `QuotasUsageBar`** — Le composant utilise `bg-amber-500` (ligne 83, état 80% de quota) — violation de ERR-019/R6. À corriger lors du déplacement du composant. Fichier : `src/components/subscription/quotas-usage-bar.tsx`.

---

## Risques identifiés

1. **Dérivation `isOwner` sans champ de session (Story 48.2)** — Chaque Server Component ou composant qui doit adapter le message au rôle doit soit recevoir `isOwner` comme prop (depuis la page), soit le dériver lui-même. Ajouter `isOwner` à `UserSession` est une modification globale avec des impacts potentiels sur tous les composants qui utilisent la session. La solution recommandée est de passer `isOwner` comme prop boolean depuis les Server Components pages. Impact : +1 requête DB par page concernée.

2. **Régression sur la création de site (Story 48.3)** — `SitesListClient` gère actuellement la création dans un Dialog inline. Refactoriser vers une page `/sites/nouveau` déplacera la logique de création. Risque de régression sur le flow existant (Dialog + switch site automatique). Mitigation : conserver le Dialog comme fallback ou bien tester le nouveau flow en isolation.

3. **Ajout de `isBlocked` aux types DTO (Story 48.4)** — Modifier `VagueSummaryResponse` et `SiteData` peut nécessiter la mise à jour des tests existants (`vagues-page.test.tsx`, `bacs-page.test.tsx`, etc.) qui construisent des fixtures de ces types. ERR-017 : après modification d'un type DTO, relancer `npx vitest run` immédiatement.

---

## Prérequis manquants

1. **Décision de design Story 48.3** — Avant de coder : page `/sites/nouveau` dédiée (avec returnUrl) ou interception des erreurs API dans le Dialog existant ? Cette décision impacte le volume de travail et la surface de régression.

2. **Clés i18n Stories 48.2** — Ajouter dans `src/messages/fr/errors.json` et `src/messages/en/errors.json` (section `quota`) :
   ```json
   "upgradeOwner": "Mettez à niveau votre plan pour créer davantage de ressources.",
   "contactOwner": "Contactez le propriétaire du site pour augmenter les quotas."
   ```

3. **Correction R6 dans `QuotasUsageBar`** — Remplacer `bg-amber-500` par une classe de thème avant de placer le composant sur de nouvelles pages.

---

## Recommandation

GO. Stories 48.1, 48.2, et 48.4 peuvent démarrer. Story 48.3 nécessite une décision de design préalable sur l'architecture du flow (page dédiée vs Dialog). Corriger la violation R6 dans `QuotasUsageBar` en même temps que Story 48.1. Ajouter les clés i18n en même temps que Story 48.2. Faire un `npx vitest run` après chaque modification de type DTO (Story 48.4) pour détecter les régressions de fixtures de test.
