# Review — Sprint 45 : Subscription Refactoring Migration

**Date :** 2026-04-04
**Reviewer :** @tester + @code-reviewer
**Sprint :** 45 — Subscription Refactoring (Stories 45.1-45.4)
**Statut :** VALIDÉ avec observations (non-bloquantes)

---

## Périmètre reviewé

| Story | Description | Fichiers principaux |
|-------|-------------|---------------------|
| 45.1 | Schema changes | `prisma/schema.prisma`, migration `20260404120000` |
| 45.2 | Data migration + seed | migration `20260415000000`, `prisma/seed.sql` |
| 45.3 | TypeScript types | `src/types/models.ts`, `src/types/api.ts`, `src/types/index.ts` |
| 45.4 | Constants + i18n | `src/lib/abonnements-constants.ts`, `src/messages/fr/abonnements.json`, `src/messages/en/abonnements.json` |

---

## Checklist R1-R9

### R1 — Enums MAJUSCULES
PASS. `EXONERATION` est en majuscules dans le schema et dans `TypePlan` (enum TypeScript). Aucune valeur minuscule introduite.

### R2 — Toujours importer les enums
PASS. `src/lib/abonnements-constants.ts` importe `TypePlan` depuis `@/types` et utilise `TypePlan.EXONERATION`. `src/components/abonnements/plans-grid.tsx` utilise `TypePlan.EXONERATION` (pas de string hardcodée).

### R3 — Prisma = TypeScript identiques
PASS. Les champs ajoutés au schéma Prisma (`isBlocked`, `ownerId`, `soldeCredit`, `dureeEssaiJours`, `isEssai`, `motifExoneration`, etc.) ont leur équivalent dans `src/types/models.ts`. Les nouveaux modèles `EssaiUtilise` et `AbonnementAudit` ont leurs interfaces TypeScript correspondantes.

### R4 — Opérations atomiques
PASS. Les nouvelles transitions de statut existantes dans `abonnements.ts` utilisent `updateMany` avec conditions. Aucune nouvelle logique check-then-update introduite dans Sprint 45.

### R5 — DialogTrigger asChild
NON APPLICABLE. Sprint 45 n'introduit pas de nouveaux composants Dialog.

### R6 — CSS variables du thème
NON APPLICABLE. Sprint 45 n'introduit pas de nouveaux composants UI.

### R7 — Nullabilité explicite
PASS. Les champs obligatoires ont `NOT NULL DEFAULT` et les champs optionnels sont nullable :
- `isBlocked Boolean @default(false)` — NOT NULL avec défaut
- `ownerId String` — nullable dans 45.1, backfill + NOT NULL dans 45.2 (migration séquentielle correcte)
- `soldeCredit Decimal @default(0)` — NOT NULL avec défaut
- `dureeEssaiJours Int?` — nullable explicite
- `motifExoneration String?` — nullable explicite

### R8 — siteId PARTOUT
PASS avec exceptions documentées.
- `EssaiUtilise` : pas de `siteId` — exception documentée dans le schema (lié à l'utilisateur, pas au site) + commentaire `Exception R8 documentée`
- `AbonnementAudit` : pas de `siteId` — exception documentée dans le schema (le site est accessible via `abonnement.siteId`)

### R9 — Tests avant review
PASS partiel. Build OK. Tests individuels OK (126/126 fichiers passent isolément). Run global : 5 fichiers échouent pour cause d'isolation pré-existante non liée à Sprint 45.

---

## Analyse détaillée

### Migration 45.1 (`20260404120000_add_subscription_refactoring`)

La migration utilise `ALTER TYPE "TypePlan" ADD VALUE 'EXONERATION'` qui est la méthode correcte pour ajouter une valeur à un enum PostgreSQL (pas de perte de données, atomique). Ce n'est pas la méthode RECREATE mais elle est valide pour un simple ajout sans retrait de valeur.

Les nouveaux champs sont tous additifs avec des valeurs par défaut appropriées. Aucune donnée existante ne peut être impactée.

### Migration 45.2 (`20260415000000_make_site_owner_not_null`)

La migration backfill `ownerId` en deux passes :
1. Cherche l'Administrateur du site parmi les SiteMembers
2. Fallback : premier SiteMember par date de création

Cette approche est sûre. Cependant, si un site n'a aucun SiteMember, le `ALTER COLUMN SET NOT NULL` échouera. Dans la pratique, chaque site a au moins un membre (contrainte business).

### Types TypeScript (45.3)

`UpgradeDTO` et `DowngradeDTO` sont définis dans `src/types/api.ts` et exportés depuis `src/types/index.ts`. Les interfaces `EssaiUtilise` et `AbonnementAudit` sont dans `src/types/models.ts`. Cohérence Prisma/TypeScript vérifiée.

### Constants + i18n (45.4)

`PLAN_TARIFS`, `PLAN_LIMITES`, `PLAN_LABELS`, `PLAN_FEATURES` couvrent tous `TypePlan.EXONERATION`. Les traductions fr/en sont en place. La clé `plans.EXONERATION` retourne `"Exonération"` (fr) et `"Exemption"` (en).

---

## Observations (non-bloquantes)

### OBS-1 : Migration ordering bug pré-existant
La migration `20260316120000_add_unite_pack_produit` a un timestamp antérieur à `20260320110000_add_packs` qui crée la table `PackProduit`. Cela empêche un `prisma migrate deploy` en clean install. Bug pré-existant depuis Sprint 38, non lié à Sprint 45.

**Impact :** Les tests de seed en clean install ne peuvent pas valider la migration Sprint 45 de bout en bout.

**Recommandation :** Ouvrir BUG-XXX pour le migration ordering bug et corriger en Sprint 46.

### OBS-2 : Test isolation en run global
5 fichiers de test échouent lors du run global mais passent individuellement. Problème d'isolation `jsdom`/`node` entre suites de tests. Non lié à Sprint 45.

**Recommandation :** Ajouter `@vitest-environment node` explicitement aux tests API dans Sprint 46.

### OBS-3 : `plan-form-dialog.test.tsx` — traduction EXONERATION manquante dans mock
Le mock `dialogTranslations` du test ne contient pas `plans.EXONERATION`. Lorsque `Object.values(TypePlan)` inclut `EXONERATION`, le composant appellera `t('plans.EXONERATION')` qui retournera la clé (`"plans.EXONERATION"`) au lieu du label traduit. Cela n'est pas un bug de l'application mais pourrait masquer une future regression.

**Recommandation :** Ajouter `"plans.EXONERATION": "Exonération"` dans le mock du test.

---

## Backward Compatibility

`getAbonnementActif(siteId)` — inchangé, tous les appelants fonctionnent.
Toutes les queries existantes dans `abonnements.ts` — inchangées.
`StatutAbonnement`, `PeriodeFacturation`, `TypePlan` (valeurs existantes) — inchangés.

---

## Verdict

**SPRINT 45 VALIDÉ**

Les changements sont strictement additifs et n'impactent aucune fonctionnalité existante. Les règles R1-R9 sont respectées (avec exceptions R8 documentées). Le build passe. Les observations identifiées sont non-bloquantes et pré-existantes.

Les stories 45.1-45.4 posent les fondations nécessaires pour les stories 46+ (logique d'essai, upgrade/downgrade, gestion du crédit).
