# Pré-analyse Sprint 51 — Backoffice Exonération
**Date :** 2026-04-04
**Analyste :** @pre-analyst

## Statut : GO AVEC RÉSERVES

## Résumé
L'infrastructure backoffice est en place et prête. Le chemin API correct est `/api/backoffice/exonerations` (pas `/api/admin/`). Deux incohérences mineures à adresser avant de coder : le chemin UI dans la story (dit `(ingenieur)/admin/` alors que le backoffice vit sous `/backoffice/`) et l'absence d'un DTO TypeScript dédié `CreateExonerationDTO`. Aucun prérequis bloquant — Sprint 47 est FAIT.

---

## Vérifications effectuées

### Schema ↔ Types : OK

- `TypePlan.EXONERATION` existe dans `prisma/schema.prisma` (enum TypePlan) et dans `src/types/models.ts`.
- `Abonnement.motifExoneration String?` existe dans le schéma Prisma et est reflété dans l'interface TypeScript `Abonnement` (`motifExoneration: string | null`).
- `PLAN_LIMITES[TypePlan.EXONERATION]` est défini dans `src/lib/abonnements-constants.ts` avec des limites généreuses (999 sites, 999 bacs, 999 vagues).
- `PLAN_TARIFS[TypePlan.EXONERATION]` est défini (mensuel = 0, autres périodes null).
- `PLAN_LABELS[TypePlan.EXONERATION]` est défini.
- `AbonnementAudit.action` est de type `String` (pas un enum) — l'action `"EXONERATION"` est mentionnée en commentaire dans le schéma. Pas d'enum TypeScript correspondant, ce qui est cohérent avec l'usage des autres actions (string literal).
- `User.isSuperAdmin Boolean` existe dans le schéma.

### API ↔ Queries ↔ Auth : OK

- Pattern `requireSuperAdmin(request)` bien établi dans `src/lib/auth/backoffice.ts`. Il lit `isSuperAdmin` depuis la DB (ADR-022 — jamais depuis le cookie).
- `logAbonnementAudit(abonnementId, action, userId, metadata?)` est disponible dans `src/lib/queries/abonnements.ts`.
- `activerAbonnement(id)` est disponible pour passer un abonnement en ACTIF.
- Aucune function `creerExoneration` ou `annulerAbonnement` n'existe dans les queries — la route devra créer l'abonnement directement (comme `createAbonnement`) ou via une nouvelle query dédiée.
- `createAbonnement()` dans `src/lib/queries/abonnements.ts` prend un `siteId` en premier paramètre. Pour EXONERATION, le siteId doit être fourni ou la fonction devra être contournée — à clarifier (voir Risques).

### Navigation ↔ Structure backoffice : PROBLÈME

- Le backoffice vit sous `/backoffice/` (route group App Router : `src/app/backoffice/`).
- La Story 51.2 indique `src/app/(ingenieur)/admin/exonerations/page.tsx` comme chemin possible — ce chemin n'existe pas et ne correspond pas à l'architecture backoffice établie.
- Le chemin correct est `src/app/backoffice/exonerations/page.tsx`, cohérent avec `/backoffice/abonnements/`, `/backoffice/plans/`, etc.
- La sidebar backoffice (`src/components/backoffice/backoffice-sidebar.tsx`) n'a pas de lien "Exonérations". Il faudra l'ajouter.
- Le fichier i18n `src/messages/fr/backoffice.json` n'a pas de clé `nav.exonerations`. Il faudra l'ajouter.

### Chemin API : PROBLÈME

- Tous les endpoints backoffice existants sont sous `/api/backoffice/` (plans, sites, modules, feature-flags, analytics).
- La Story 51.1 indique `src/app/api/admin/exonerations/route.ts` — ce chemin serait incohérent avec le reste du backoffice.
- Le chemin correct est `src/app/api/backoffice/exonerations/route.ts` et `src/app/api/backoffice/exonerations/[id]/route.ts`.

### Composants admin existants : OK

- `src/components/backoffice/` contient les composants du backoffice DKFarm.
- `src/components/admin/` contient des composants similaires (ancienne structure ou doublons) — les nouveaux composants pour Sprint 51 doivent aller dans `src/components/backoffice/` pour rester cohérents avec les composants existants (sidebar, header, etc.).
- La Story 51.2 pointe vers `src/components/admin/exoneration-form-dialog.tsx` — à mettre dans `src/components/backoffice/` à la place.

### DTOs TypeScript : PROBLÈME MINEUR

- Aucun `CreateExonerationDTO` n'existe dans `src/types/api.ts`. Il faudra le créer (ou coder la validation inline comme le fait `/api/backoffice/plans/route.ts`).
- La Story ne mentionne pas explicitement la création d'un DTO dans `src/types/api.ts` ni son export dans `src/types/index.ts`.

### Build : NON VÉRIFIÉ
(Aucun nouveau fichier à ce stade — build courant supposé OK depuis Sprint 47 FAIT)

### Tests : NON VÉRIFIÉ
(Aucun test lié à l'exonération avant ce sprint)

---

## Incohérences trouvées

### 1. Chemin API incorrect dans la Story 51.1
**Fichier story :** `docs/sprints/SPRINTS-SUBSCRIPTIONS-REFACTORING.md` (ligne 843-844)
**Problème :** La story indique `src/app/api/admin/exonerations/route.ts`. Tous les endpoints backoffice existants sont sous `/api/backoffice/`.
**Fix :** Créer `src/app/api/backoffice/exonerations/route.ts` et `src/app/api/backoffice/exonerations/[id]/route.ts`.

### 2. Chemin UI incorrect dans la Story 51.2
**Fichier story :** ligne 867
**Problème :** La story suggère `src/app/(ingenieur)/admin/exonerations/page.tsx`. Le route group `(ingenieur)` existe mais ne contient que les pages ingénieur (portefeuille, monitoring, settings). Le backoffice DKFarm vit sous `src/app/backoffice/`.
**Fix :** Créer `src/app/backoffice/exonerations/page.tsx`.

### 3. Composants dans le mauvais dossier (Story 51.2)
**Problème :** La story pointe vers `src/components/admin/exoneration-form-dialog.tsx` et `src/components/admin/exonerations-list.tsx`. Les composants backoffice sont dans `src/components/backoffice/`.
**Fix :** Créer `src/components/backoffice/exoneration-form-dialog.tsx` et `src/components/backoffice/exonerations-list.tsx`.

### 4. Sidebar backoffice non mise à jour
**Fichier :** `src/components/backoffice/backoffice-sidebar.tsx`
**Problème :** Aucun lien vers `/backoffice/exonerations` dans `NAV_ITEM_DEFS`.
**Fix :** Ajouter un item `{ href: "/backoffice/exonerations", labelKey: "exonerations", icon: ShieldOff }` et la clé i18n correspondante dans `src/messages/fr/backoffice.json` (`nav.exonerations`).

### 5. `createAbonnement()` prend un siteId — ambigüité pour EXONERATION
**Fichier :** `src/lib/queries/abonnements.ts` (ligne 133)
**Problème :** `createAbonnement(siteId, userId, data, ...)` requiert un `siteId`. Or, la Story 51.1 dit que l'exonération est créée avec `{ userId, motif, dateFin? }` — pas de siteId dans le body. L'exonération est user-level (ADR-020 Sprint 47 a migré vers user-level), mais `Abonnement.siteId` est encore `NOT NULL` dans le schéma (prévu pour être rendu nullable au Sprint 52).
**Fix :** La route de création d'exonération doit soit (a) créer l'abonnement via Prisma directement avec un siteId placeholder ou (b) utiliser le premier site actif de l'utilisateur comme siteId. Option recommandée : documenter explicitement la décision dans la route. Si siteId sera supprimé au Sprint 52 (Story 52.1), une valeur placeholder peut être utilisée temporairement, mais c'est un debt technique à signaler.

---

## Risques identifiés

### Risque 1 — `Abonnement.siteId` encore obligatoire
**Impact :** La route `POST /api/backoffice/exonerations` ne peut pas créer un abonnement sans `siteId` tant que Sprint 52 n'a pas rendu ce champ nullable.
**Mitigation :** Utiliser le `siteId` du premier site actif de l'utilisateur visé, ou créer un site "virtuel" pour l'exonération. Décision à documenter dans le code.

### Risque 2 — `dateFin` avec valeur "permanente" (2099-12-31)
**Impact :** La Story dit "Si `dateFin` non fourni → permanent (2099-12-31)". La fonction `calculerProchaineDate` calcule `dateProchainRenouvellement` mais pour un abonnement permanent, ce champ n'a pas de sens.
**Mitigation :** Mettre `dateProchainRenouvellement = dateFin = 2099-12-31` pour les exonérations permanentes. Le CRON de renouvellement ne se déclenchera pas avant 2099. À documenter dans le code.

### Risque 3 — Période de facturation pour EXONERATION
**Impact :** `Abonnement.periode` est `NOT NULL` dans le schéma mais `PLAN_TARIFS[TypePlan.EXONERATION]` n'a que `MENSUEL: 0` (les autres périodes sont null). La route doit fixer la période à `MENSUEL` par défaut.
**Mitigation :** Hardcoder `periode: PeriodeFacturation.MENSUEL` lors de la création d'une exonération.

### Risque 4 — Pas de query `annulerAbonnementAdmin()` dédiée
**Impact :** La route `DELETE /api/backoffice/exonerations/[id]` doit passer l'abonnement en `ANNULE`. La route existante `POST /api/abonnements/[id]/annuler` vérifie `auth.activeSiteId` (multi-tenant, R8). Une route backoffice ne peut pas utiliser ce pattern.
**Mitigation :** La route backoffice passe directement l'abonnement en ANNULE via `prisma.abonnement.updateMany()` avec guard `motifExoneration IS NOT NULL` (pour ne pas annuler un abonnement normal par erreur). Pattern atomique R4 requis.

---

## Prérequis manquants

1. Ajouter la clé i18n `nav.exonerations` dans `src/messages/fr/backoffice.json` et `src/messages/en/backoffice.json` avant de créer la sidebar entry (ou dans le même commit).
2. Décider du traitement du `siteId` pour les exonérations (voir Risque 1) et documenter la décision avant d'implémenter la route.

---

## Éléments corrects à réutiliser directement

- `requireSuperAdmin(request)` depuis `src/lib/auth/backoffice.ts` — pattern établi, fonctionnel.
- `checkBackofficeAccess()` pour le Server Component page.tsx.
- `logAbonnementAudit(abonnementId, "EXONERATION", userId, { motif })` — function disponible.
- Structure de page backoffice : `src/app/backoffice/abonnements/page.tsx` est le modèle exact à suivre.
- Structure de route API backoffice : `src/app/api/backoffice/plans/route.ts` est le modèle exact (requireSuperAdmin + validation + apiError).
- `AuthError` / `ForbiddenError` catch pattern dans les routes.
- `PLAN_LIMITES[TypePlan.EXONERATION]` et `PLAN_TARIFS[TypePlan.EXONERATION]` sont déjà définis.

---

## Recommandation

GO avec correction des chemins avant implémentation :
- Les chemins dans la story (`/api/admin/`, `(ingenieur)/admin/`, `src/components/admin/`) doivent tous être remplacés par leurs équivalents sous `/api/backoffice/`, `src/app/backoffice/`, et `src/components/backoffice/`.
- La décision sur le `siteId` temporaire (Risque 1) doit être prise et documentée dans un commentaire de code avant de créer la route.
- Les clés i18n sidebar (`nav.exonerations`) doivent être ajoutées dans le même commit que la sidebar update.
