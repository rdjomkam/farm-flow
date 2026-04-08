# Pré-analyse — UI Reproduction : Incubation + Éclosion + Pré-remplissage Lot

**Date :** 2026-04-08
**Analyste :** @pre-analyst

---

## Statut : GO AVEC RÉSERVES

## Résumé

Les prérequis techniques (API routes, enums, permissions, traductions) sont tous en place. Le build compile sans erreur et les 4904 tests passent. Deux incohérences bloquantes sont détectées : la page liste `/reproduction/incubations` est absente (lien dans la nav brisé), et les composants utilisent `Permission.ALEVINS_MODIFIER` pour les actions de modification alors que les API routes exigent `Permission.INCUBATIONS_GERER`. Un problème de permission secondaire concerne la page `/reproduction/pontes/[id]/completer` qui n'existe pas.

---

## Vérifications effectuées

### API Routes : OK

| Route | Méthode | Fichier | Statut |
|-------|---------|---------|--------|
| `POST /api/reproduction/incubations` | POST | `src/app/api/reproduction/incubations/route.ts` | Présente, `INCUBATIONS_GERER` |
| `PATCH /api/reproduction/incubations/[id]/eclosion` | PATCH | `src/app/api/reproduction/incubations/[id]/eclosion/route.ts` | Présente, `INCUBATIONS_GERER` |
| `GET /api/reproduction/incubations?ponteId=XXX` | GET | `src/app/api/reproduction/incubations/route.ts` | Présente, filtre `ponteId` supporté |

### Enums et Types : OK

| Élément | Fichier | Statut |
|---------|---------|--------|
| `SubstratIncubation` | `src/types/models.ts` ligne 1126 | Présent |
| `StatutIncubation` | `src/types/models.ts` ligne 1138 | Présent (4 valeurs : EN_COURS, ECLOSION_EN_COURS, TERMINEE, ECHOUEE) |
| `StatutPonte` | `src/types/models.ts` ligne 1037 | Présent |
| `Permission.INCUBATIONS_VOIR` | `src/types/models.ts` ligne 71 | Présent |
| `Permission.INCUBATIONS_GERER` | `src/types/models.ts` ligne 72 | Présent |

### Permissions Constants : OK

- `INCUBATIONS_VOIR` et `INCUBATIONS_GERER` dans `PERMISSION_GROUPS.reproduction`
- Item `/reproduction/incubations` mappé à `Permission.INCUBATIONS_VOIR` dans `ITEM_VIEW_PERMISSIONS`
- Rôle Pisciculteur inclut `INCUBATIONS_VOIR`

### Traductions : OK

Toutes les clés utilisées par les composants modifiés sont présentes dans `src/messages/fr/reproduction.json` :

| Clé | Statut |
|-----|--------|
| `incubations.lancerIncubation` | Présente |
| `incubations.lancerIncubationTitle` | Présente |
| `incubations.lancerSuccess` | Présente |
| `incubations.lancerConfirmer` | Présente |
| `incubations.form.substrat` | Présente |
| `incubations.form.temperatureEauC` | Présente |
| `incubations.form.nombreOeufsPlaces` | Présente |
| `incubations.form.dateDebutIncubation` | Présente |
| `incubations.form.dateEclosionPrevue` | Présente |
| `incubations.form.notes` | Présente |
| `incubations.form.notesPlaceholder` | Présente |
| `incubations.substrat.*` (8 valeurs) | Présentes |
| `statuts.incubation.*` (4 valeurs) | Présentes |
| `lots.form.nombreInitialPrefilled` | Présente |
| `lots.form.title` | Présente |

### Patterns R5/R6/Mobile-first : OK

- Tous les `<DialogTrigger asChild>` sont conformes à R5 dans les composants modifiés
- `incubation-detail-client.tsx` utilise `var(--accent-green)`, `var(--accent-amber)`, `var(--accent-blue)` : conforme R6
- `ponte-detail-client.tsx` utilise des classes Tailwind sans couleurs codées en dur : conforme R6
- Tous les champs input et boutons ont `min-h-[44px]` : conforme mobile-first

### Build : OK — aucune erreur

### Tests : 4904/4930 passent (26 todo) — aucun échec

---

## Incohérences trouvées

### 1. Incohérence Permission : `ALEVINS_MODIFIER` vs `INCUBATIONS_GERER` (HAUTE)

**Fichiers concernés :**
- `src/components/reproduction/incubation-detail-client.tsx` ligne 140
- `src/components/reproduction/ponte-detail-client.tsx` ligne 215
- `src/app/api/reproduction/incubations/route.ts` (POST utilise `INCUBATIONS_GERER`)
- `src/app/api/reproduction/incubations/[id]/eclosion/route.ts` (PATCH utilise `INCUBATIONS_GERER`)

**Description :** Les boutons "Lancer l'incubation" et "Enregistrer l'éclosion" sont conditionnés à `Permission.ALEVINS_MODIFIER` (legacy), alors que les API routes qu'ils appellent exigent `Permission.INCUBATIONS_GERER`. Un utilisateur avec `ALEVINS_MODIFIER` mais sans `INCUBATIONS_GERER` verra les boutons mais obtiendra une erreur 403 en les utilisant. Un utilisateur avec `INCUBATIONS_GERER` mais sans `ALEVINS_MODIFIER` ne verra pas les boutons alors qu'il y a accès API.

**Suggestion de fix :** Dans les deux composants, remplacer `Permission.ALEVINS_MODIFIER` par `Permission.INCUBATIONS_GERER` pour la logique `canModify` concernant les actions incubation/éclosion.

### 2. Page liste `/reproduction/incubations` absente (HAUTE)

**Fichiers concernés :**
- `src/app/reproduction/incubations/` — seul `[id]/page.tsx` existe, pas de `page.tsx` racine
- `src/components/layout/farm-sidebar.tsx` ligne 124 — lien `/reproduction/incubations` dans la nav

**Description :** La navigation latérale pointe vers `/reproduction/incubations` mais cette page n'existe pas. Le clic sur "Incubations" dans le menu produit une page 404.

**Suggestion de fix :** Créer `src/app/reproduction/incubations/page.tsx` avec la liste des incubations (Server Component + composant client de filtrage, pattern identique à `/reproduction/pontes/page.tsx`).

### 3. Page `/reproduction/pontes/[id]/completer` absente (MOYENNE)

**Fichiers concernés :**
- `src/components/reproduction/ponte-detail-client.tsx` lignes 485, 560, 607 — liens vers `/reproduction/pontes/${ponte.id}/completer?step=1|2|3`
- `src/app/reproduction/pontes/[id]/` — dossier contient uniquement `page.tsx` et `loading.tsx`

**Description :** Dans la vue détail d'une ponte, les boutons "Compléter" des étapes 1, 2, 3 pointent vers une page inexistante. Ce problème existait avant les modifications de l'architecte (non introduit par ce sprint).

**Suggestion de fix :** Créer `src/app/reproduction/pontes/[id]/completer/page.tsx` avec un formulaire multi-étapes (step via `searchParams`). Peut être scopé dans un sprint séparé.

---

## Risques identifiés

### 1. Confusion ALEVINS_MODIFIER / INCUBATIONS_GERER en production

Les rôles ont été migrés par l'ADR-045. `ALEVINS_MODIFIER` est déclaré soft-deprecated dans `permissions-constants.ts`. En production, des utilisateurs avec seulement `INCUBATIONS_GERER` (sans l'ancien `ALEVINS_MODIFIER`) ne verront pas les boutons d'action sur incubation/éclosion. Ce cas est probable dès qu'un administrateur crée un rôle custom avec les nouvelles permissions granulaires.

**Impact :** Fonctionnalité inaccessible pour les rôles créés après la migration ADR-045.
**Mitigation :** Corriger avant la mise en production (fix simple, 2 lignes).

### 2. Expérience utilisateur brisée sur la nav Incubations

Le lien "Incubations" dans la sidebar pointe vers une 404. Un utilisateur naviguant vers le module Incubations se retrouve bloqué.

**Impact :** Module entier inaccessible depuis la nav.
**Mitigation :** La page détail `/reproduction/incubations/[id]` est accessible depuis la ponte, mais la liste consolidée manque.

---

## Prérequis manquants

1. **Créer `src/app/reproduction/incubations/page.tsx`** — page liste des incubations (bloquant pour la nav)
2. **Corriger la permission `canModify` dans `incubation-detail-client.tsx` et `ponte-detail-client.tsx`** — utiliser `INCUBATIONS_GERER` au lieu de `ALEVINS_MODIFIER`

---

## Recommandation

**GO — Implémenter avec correction immédiate de 2 points bloquants.**

Les composants modifiés par l'architecte (`ponte-detail-client.tsx`, `incubation-detail-client.tsx`, `lot-form-client.tsx`) sont fonctionnels, bien structurés, compilent sans erreur et respectent les patterns R5/R6/mobile-first. Le flux complet Incubation + Éclosion + Pré-remplissage Lot est opérationnel côté API et composants.

Le @developer doit, dans cet ordre :
1. Corriger `canModify` dans `incubation-detail-client.tsx` (ligne 140 : `INCUBATIONS_GERER`)
2. Corriger `canModify` dans `ponte-detail-client.tsx` (ligne 215 : `INCUBATIONS_GERER` pour la partie incubation)
3. Créer la page liste `src/app/reproduction/incubations/page.tsx`
4. La page `completer` de ponte peut être différée à un sprint suivant — elle ne bloque pas le flux principal de cette story.
