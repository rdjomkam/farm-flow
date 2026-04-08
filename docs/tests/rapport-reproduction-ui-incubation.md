# Rapport de tests — UI Reproduction : Incubation + Éclosion + Pré-remplissage Lot

**Date :** 2026-04-08
**Testeur :** @tester
**Story :** UI — Écrans manquants du flux Reproduction (Incubation + Éclosion + Pré-remplissage Lot)

---

## Historique des re-validations

| Date | Motif | Résultat |
|------|-------|----------|
| 2026-04-08 | Validation initiale | PASS |
| 2026-04-08 | Re-validation après corrections P1-P5 du @code-reviewer | PASS |

---

## 1. Résultats des tests automatisés

### Suite Vitest — Re-validation post-corrections P1-P5

| Métrique | Valeur |
|----------|--------|
| Fichiers de test | 150 passés / 150 |
| Tests passés | 4904 |
| Tests todo | 26 |
| Tests échoués | 0 |
| Durée | 19.57s |

**Conclusion : AUCUNE RÉGRESSION détectée.**

### Build de production — Re-validation post-corrections P1-P5

| Étape | Résultat |
|-------|----------|
| `prisma generate` | OK |
| `prisma migrate deploy` | OK (102 migrations, aucune pending) |
| `next build --webpack` | OK — Compiled successfully in 16.1s |
| Pages générées | 163/163 |
| Erreurs TypeScript | 0 |
| Avertissements critiques | 0 (1 warning non-bloquant sur workspace root) |

La route `/reproduction/incubations` apparaît dans la liste des pages générées : **OK**.

---

## 2. Vérifications manuelles du code

### 2.1 Fix permission `ALEVINS_MODIFIER` → `INCUBATIONS_GERER`

| Fichier | Ligne | Avant (pré-analyse) | Après (implémenté) | Statut |
|---------|-------|---------------------|---------------------|--------|
| `src/components/reproduction/incubation-detail-client.tsx` | 140 | `Permission.ALEVINS_MODIFIER` | `Permission.INCUBATIONS_GERER` | CORRIGÉ |
| `src/components/reproduction/ponte-detail-client.tsx` | 215 | `Permission.ALEVINS_MODIFIER` | `Permission.INCUBATIONS_GERER` | CORRIGÉ |

La variable `canModify` dans les deux composants utilise désormais `Permission.INCUBATIONS_GERER`, en cohérence avec les API routes `POST /api/reproduction/incubations` et `PATCH /api/reproduction/incubations/[id]/eclosion`.

### 2.2 Page liste `/reproduction/incubations/page.tsx`

- Fichier créé : `src/app/reproduction/incubations/page.tsx`
- Pattern conforme : Server Component + `getServerSession` + `checkPagePermission` + `listIncubations`
- Permission vérifiée : `Permission.INCUBATIONS_VOIR`
- Redirect session manquante : `/login`
- Redirect site manquant : `/settings/sites`
- Composant client utilisé : `IncubationsListClient` — conforme

### 2.3 Composant liste `incubations-list-client.tsx`

| Vérification | Statut |
|--------------|--------|
| `"use client"` présent | OK |
| Import `StatutIncubation` depuis `@/types` (pas de string literal) | OK (règle R2) |
| Filtrage par tabs (tous / en_cours / eclosion / terminees / echouees) | OK |
| Recherche par code et code ponte | OK |
| Cards mobiles (pas de tableau) | OK — pattern `Card` empilées |
| Navigation au clic vers `/reproduction/incubations/${inc.id}` | OK |
| Aucune couleur codée en dur (CSS variables) | OK (règle R6) |
| Clés de traduction `incubations.card.*` présentes | OK |
| Clés de traduction `incubations.tabs.*` présentes | OK |
| Clés `incubations.count` / `countPlural` / `aucune` / `search` | OK |

### 2.4 Pré-remplissage `nombreInitial` dans `lot-form-client.tsx`

- Lors du changement de `ponteId`, appel à `fetchIncubationForPonte()` pour récupérer `nombreLarvesViables ?? nombreLarvesEcloses`
- Si valeur trouvée, pré-remplissage de `nombreInitial` + flag `nombreInitialPrefilled = true`
- Modification manuelle du champ remet `nombreInitialPrefilled` à `false`
- Message informatif affiché si pré-rempli : clé `nombreInitialPrefilled` présente dans les traductions
- Validation du champ conservée (requis, entier positif)

### 2.5 Conformité règles R1-R9

| Règle | Vérification | Statut |
|-------|--------------|--------|
| R1 — Enums MAJUSCULES | `StatutIncubation.EN_COURS`, `.ECLOSION_EN_COURS`, `.TERMINEE`, `.ECHOUEE` | OK |
| R2 — Import enums | `import { StatutIncubation, Permission } from "@/types"` | OK |
| R3 — Prisma = TypeScript | Interface `IncubationListItem` miroir du retour `listIncubations` | OK |
| R5 — DialogTrigger asChild | Non applicable dans ces fichiers (listes sans dialog) | N/A |
| R6 — CSS variables | `bg-accent-blue-muted`, `text-accent-green`, `var(--...)` — pas de hex en dur | OK |
| R8 — siteId | `listIncubations(session.activeSiteId, ...)` — siteId transmis | OK |
| R9 — Tests avant review | Vitest 4904/4904 + build OK | OK |

---

## 3. Problèmes résiduels identifiés

### 3.1 Page `/reproduction/pontes/[id]/completer` absente (MOYENNE — connu)

Signalé dans la pré-analyse (incohérence 3). Les boutons "Compléter" des étapes de ponte pointent vers une page inexistante. Ce problème **préexiste** à ce sprint et n'a pas été introduit par les modifications actuelles. La pré-analyse recommande de différer ce point.

**Statut :** Connu, hors scope de ce sprint.

### 3.2 `geniteur-detail-client.tsx` — `ALEVINS_MODIFIER` encore présent (BASSE — hors scope)

Le composant `geniteur-detail-client.tsx` utilise encore `Permission.ALEVINS_MODIFIER` (lignes 380 et 598). Ces lignes concernent les actions sur les géniteurs (modification, utilisation de mâles), pas les incubations. Ce n'est pas une régression introduite par ce sprint.

**Statut :** Connu, hors scope de ce sprint.

---

## 4. Vérification des corrections P1-P5 du @code-reviewer

Les corrections suivantes ont été apportées par le @developer suite à la review :

| Correction | Description | Vérification |
|-----------|-------------|--------------|
| P1 | CSS classes arbitraires → classes utilitaires Tailwind | Build OK, 0 erreur TypeScript |
| P2 | i18n ajouté dans `incubation-detail-client.tsx` (~30 textes traduits) | Build OK |
| P3 | Textes hardcodés corrigés dans `ponte-detail-client.tsx` | Build OK |
| P4 | Lien retour corrigé | Build OK |
| P5 | Paramètre `permissions` utilisé dans `incubations-list-client.tsx` | Build OK |

Aucune des corrections n'a introduit de régression. La suite de tests reste à 4904/4904 passes.

---

## 5. Conclusion

### PASS — Re-validation confirmée

Toutes les implémentations requises par la story sont en place et conformes, corrections P1-P5 incluses :

1. La permission `canModify` dans `incubation-detail-client.tsx` et `ponte-detail-client.tsx` utilise `INCUBATIONS_GERER` — incohérence bloquante de la pré-analyse CORRIGÉE.
2. La page liste `/reproduction/incubations` est créée et accessible depuis la navigation — 404 CORRIGÉE.
3. Le composant `IncubationsListClient` est fonctionnel, mobile-first, conforme R1-R9.
4. Le pré-remplissage `nombreInitial` dans `lot-form-client.tsx` est implémenté avec indicateur visuel.
5. Corrections P1-P5 du @code-reviewer appliquées sans régression.
6. Aucune régression sur les 4904 tests existants.
7. Build de production réussi sans erreur TypeScript (163/163 pages).
