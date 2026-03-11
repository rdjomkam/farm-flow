# Review Sprint 12 — Export PDF/Excel + Polish + Navigation

**Reviewer :** @code-reviewer
**Date :** 2026-03-11
**Sprint :** 12

## Fichiers vérifiés

| Catégorie | Fichiers |
|-----------|----------|
| Export PDF | src/lib/export/pdf-facture.tsx, pdf-rapport-vague.tsx, pdf-rapport-financier.tsx |
| Export Excel | src/lib/export/excel-releves.ts, excel-ventes.ts, excel-stock.ts |
| API routes | src/app/api/export/facture/[id]/route.ts, vague/[id]/route.ts, finances/route.ts, releves/route.ts, stock/route.ts, ventes/route.ts |
| UI | src/components/ui/export-button.tsx |
| Navigation | src/components/layout/bottom-nav.tsx, sidebar.tsx, hamburger-menu.tsx |
| Dialogs | src/components/vagues/modifier-vague-dialog.tsx, src/components/releves/modifier-releve-dialog.tsx |
| Types | src/types/export.ts |
| ADR | docs/decisions/006-export-pdf-excel.md |

Stories couvertes : 12.1 (ADR), 12.2 (PDF), 12.3 (Excel), 12.4 (API routes), 12.5 (UI export), 12.6 (navigation), 12.7 (polish), 12.8 (tests).

---

## Checklist R1-R9

| # | Règle | Statut | Observations |
|---|-------|--------|-------------|
| R1 | Enums MAJUSCULES | ✅ OK | `StatutFacture.BROUILLON/ENVOYEE/PAYEE`, `TypeMouvement.ENTREE/SORTIE`, `CategorieProduit.ALIMENT/INTRANT/EQUIPEMENT`, `TypeReleve.*`, `StatutVague.*`, `ModePaiement.*` — tous UPPERCASE sans exception |
| R2 | Importer les enums | ✅ OK | `excel-releves.ts` : `TypeReleve` depuis `@/types`. `excel-ventes.ts` : `StatutFacture`. `excel-stock.ts` : `CategorieProduit, TypeMouvement, UniteStock`. `pdf-facture.tsx` : `StatutFacture, ModePaiement`. `pdf-rapport-vague.tsx` : `StatutVague, TypeReleve`. Toutes les routes API : `Permission.*` depuis `@/types`. Zéro string littérale en dur. |
| R3 | Prisma = TypeScript | ✅ OK | `src/types/export.ts` : DTOs alignés sur les modèles Prisma. `SiteInfoExport.name/address` = `Site.name/address`. `CreateFacturePDFDTO` miroir exact de `Facture` + `Vente` + `Paiement`. `ReleveExcelRow` : tous les champs de `Releve`. |
| R4 | Opérations atomiques | ✅ N/A | Routes export = GET uniquement, pas d'écriture. `PUT /api/releves/[id]` : `updateReleve(siteId, userId, id, data)` atomique (vérifié). |
| R5 | DialogTrigger asChild | ✅ OK | `modifier-vague-dialog.tsx:93` → `<DialogTrigger asChild>`. `modifier-releve-dialog.tsx:242` → `<DialogTrigger asChild>`. `hamburger-menu.tsx:254` → `<SheetTrigger asChild>`. Conformité ARIA assurée. |
| R6 | CSS variables du thème | ⚠️ Exception PDF | `pdf-facture.tsx`, `pdf-rapport-vague.tsx`, `pdf-rapport-financier.tsx` : couleurs hex hardcodées (`"#0d9488"`, `"#1e293b"`, `"#64748b"`…). Exception valide : `@react-pdf/renderer` s'exécute côté serveur Node.js, n'a pas accès aux CSS custom properties du navigateur. Nécessite commentaire explicatif (voir M-1). |
| R7 | Nullabilité explicite | ✅ OK | `export.ts` : `address: string \| null`, `vagueId: string \| null`, `fcr: number \| null`, `dateEcheance: Date \| null`, `logoUrl?: string \| null`. Zéro champ ambigu. |
| R8 | siteId PARTOUT | ✅ OK | Tous les DTOs export ont `siteId: string`. Toutes les 6 routes filtrent sur `auth.activeSiteId`. `ExportRelevesExcelDTO.siteId`, `ExportStockExcelDTO.siteId`, `ExportVentesExcelDTO.siteId`. Audit exhaustif : aucune fuite cross-site possible. |
| R9 | Tests avant review | ✅ OK | 1000/1000 tests passent (95 nouveaux Sprint 12), build production OK (73 pages, 0 erreur TypeScript). Rapport : `docs/tests/rapport-sprint-12.md`. |

---

## Vérification Auth + Permissions + siteId

| Route | `requirePermission` | Permissions | Filtre siteId |
|-------|--------------------|-----------|--------------:|
| `GET /api/export/facture/[id]` | ✅ | `FACTURES_VOIR` + `EXPORT_DONNEES` | `getFactureById(id, auth.activeSiteId)` |
| `GET /api/export/vague/[id]` | ✅ | `VAGUES_VOIR` + `EXPORT_DONNEES` | `getVagueById(id, auth.activeSiteId)` |
| `GET /api/export/finances` | ✅ | `FINANCES_VOIR` + `EXPORT_DONNEES` | `getResumeFinancier(auth.activeSiteId, …)` |
| `GET /api/export/releves` | ✅ | `RELEVES_VOIR` + `EXPORT_DONNEES` | `getReleves(auth.activeSiteId, filters)` |
| `GET /api/export/stock` | ✅ | `STOCK_VOIR` + `EXPORT_DONNEES` | `{siteId: auth.activeSiteId}` dans findMany |
| `GET /api/export/ventes` | ✅ | `VENTES_VOIR` + `EXPORT_DONNEES` | `getVentes(auth.activeSiteId, …)` |

Pattern double-permission cohérent sur toutes les routes. `EXPORT_DONNEES` est en `PERMISSION_GROUPS.general` → accordé par défaut à Admin et Gérant, non accordé à Pisciculteur. Correct.

---

## Mobile-first — Vérification touch targets

| Composant | Classe | Taille effective | Conforme 44px |
|-----------|--------|-----------------|:-------------:|
| `ExportButton` | `min-h-[44px]` | 44 px | ✅ |
| `BottomNav` liens | `min-h-[56px]` | 56 px | ✅ |
| `SheetContent` bouton close | `min-h-[44px] min-w-[44px]` | 44 × 44 px | ✅ |
| `SheetTrigger` (hamburger) | `h-9 w-9` | 36 × 36 px | ⚠️ voir M-2 |
| `DialogTrigger` modifier-vague | Bouton standard Radix | ≥ 44 px | ✅ |

---

## Vérification bug fixes Sprint 12

| Référence | Description | Fichier vérifié | Statut |
|-----------|-------------|-----------------|--------|
| BUG-002 | Préfixe +237 automatique | `src/lib/auth/phone.ts` + login/register routes | ✅ CLOS |
| BUG-003 | Hydration mismatch navigateur | `src/app/layout.tsx:46` | ✅ CLOS |
| BUG-005 | Overflow horizontal mobile | `src/components/layout/app-shell.tsx` | ✅ CLOS |
| I1 | PUT releves 500 → 409 stock insuffisant | `src/app/api/releves/[id]/route.ts:171-177` | ✅ VÉRIFIÉ |
| I2 | GET releves sans console.error | `src/app/api/releves/route.ts:41` | ✅ VÉRIFIÉ |
| M4 | Dialog trigger 32 px → 44 px | `modifier-releve-dialog.tsx:242` | ✅ VÉRIFIÉ |
| M5 | Switch POST releves sans default | `src/app/api/releves/route.ts` | ✅ VÉRIFIÉ |
| S3 | Toast sans accents | `modifier-releve-dialog.tsx:228` | ✅ VÉRIFIÉ |

---

## Issues identifiées

### I-1 — `nombreVentes: 0` hardcodé dans rapport financier PDF — BLOQUANT release v2

**Fichier :** `src/app/api/export/finances/route.ts:81`

**Cause racine :** Le type `RentabiliteVague` (retourné par `getRentabiliteParVague`) ne contient pas de champ `nombreVentes` — il expose uniquement `revenus`, `couts`, `marge`, `roi`, `poidsTotalVendu`. Le commentaire "calculé depuis les agrégats" est inexact : la valeur est une constante 0.

**Impact :** Le tableau "Ventes par vague" du PDF financier affiche systématiquement 0 ventes par vague. Donnée fausse dans un document officiel.

**Correction attendue :** Enrichir `getRentabiliteParVague` avec un `_count` des ventes, ou récupérer séparément le nombre de ventes par vague.

### M-1 — Exception R6 non documentée dans les templates PDF (Basse)

**Fichiers :** `pdf-facture.tsx:58`, `pdf-rapport-vague.tsx:58`, `pdf-rapport-financier.tsx:44`

Ajouter un commentaire expliquant que `@react-pdf/renderer` s'exécute côté serveur Node.js et ne peut pas résoudre les CSS custom properties.

### M-2 — SheetTrigger (hamburger) sous les 44 px (Basse)

**Fichier :** `src/components/layout/hamburger-menu.tsx:255`

Remplacer `h-9 w-9` par `h-11 w-11` (44 px).

### M-3 — Label "Releve" sans accent dans bottom-nav.tsx (Basse)

**Fichier :** `src/components/layout/bottom-nav.tsx:40, 54`

"Releve" → "Relevé"

### M-4 — Double requête DB dans /api/export/releves (Basse)

**Fichier :** `src/app/api/export/releves/route.ts:44-61`

Optimiser en une seule requête avec les bons `include` dans `getReleves`.

---

## Points positifs

- **Architecture export** : Séparation claire DTOs / générateurs / routes API
- **Double-permission** sur toutes les routes export
- **Templates PDF professionnels** : En-têtes, tableaux zebra, badges colorés, footers paginés
- **Navigation modulaire** : Sidebar + HamburgerMenu avec groupes repliables, filtrage par permissions
- **ExportButton** : Gestion complète fetch → blob → download, feedback utilisateur, cleanup mémoire
- **DTOs export.ts** : 557 lignes, 100% documentées JSDoc, zéro `any`, nullabilité explicite
- **1 000 tests** : 95 nouveaux Sprint 12 couvrant les 6 routes export

---

## Résultat final

| Critère | Résultat |
|---------|----------|
| Tests | ✅ 1000/1000 (36 fichiers, 0 échec) |
| Build | ✅ OK (73 pages, 0 erreur TypeScript) |
| R1-R9 | ✅ (sauf R6 exception PDF documentée) |
| Bug fixes | ✅ Tous vérifiés et clos |
| Issues bloquantes | 1 (I-1 : nombreVentes: 0) |
| Issues mineures | 4 (M-1 à M-4) |

## Verdict : CONDITIONNEL

### Correction bloquante avant release v2
- [ ] I-1 : `nombreVentes: 0` dans `src/app/api/export/finances/route.ts:81`

### Corrections reportables (polish post-release)
- [ ] M-1 : Commentaire CSS vars dans les 3 fichiers PDF
- [ ] M-2 : `h-9 w-9` → `h-11 w-11` dans hamburger-menu.tsx
- [ ] M-3 : "Releve" → "Relevé" dans bottom-nav.tsx
- [ ] M-4 : Optimiser double requête dans /api/export/releves

---

Review produite par @code-reviewer — 2026-03-11
