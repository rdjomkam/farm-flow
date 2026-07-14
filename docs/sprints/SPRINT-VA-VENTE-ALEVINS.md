# Sprint VA — Vente d'Alevins depuis vague PG

**Statut** : ✅ SIGNÉ — APPROVED_WITH_FOLLOWUPS
**Lancé le** : 2026-06-29
**Clôturé le** : 2026-06-29
**Source** : `/goal` — besoin métier : liquider les reliquats d'une vague PG comme alevins

## Objectif

Permettre à un pisciculteur de vendre les poissons restants d'une vague `PRE_GROSSISSEMENT` directement comme alevins, avec option d'auto-clôture. Réutilise `Vente`+`LigneVente`, guard CS.3 déjà compatible.

## Stories

| Story | Sujet | Commit | Verdict |
|-------|-------|--------|---------|
| VA.1+2+3 | Schema `origineType` + query `createVenteAlevinsDepuisVague` + route API | `a7eed06` | APPROVED |
| VA.5 | Client système « Nurserie interne » (isSysteme + seed + delete guard) | `fe13e35` | OK |
| VA.4 | Dialog UI `vente-alevins-dialog.tsx` + intégration `VagueActionMenu` + i18n | `4d63bb4` | APPROVED |
| VA.6 | Tests + review R1-R9 | (ce commit) | APPROVED_WITH_FOLLOWUPS |

## Tests

- **6/6 verts** — `src/lib/queries/__tests__/vente-alevins-vague.test.ts`
  - Vente valide (Vente ALEVINS_PG + LigneVente + relevés + AssignationBac décrémentés)
  - Stock insuffisant → rejet
  - Vague non PRE_GROSSISSEMENT → ValidationError
  - Vague non EN_COURS → ValidationError
  - Auto-clôture (bacs vidés → TERMINEE)
  - Guard invariant cassé → ConservationError + rollback

## Checklist R1-R9

| Règle | Statut | Détail |
|-------|--------|--------|
| R1 | ✓ | `OrigineVente { GROSSISSEMENT, ALEVINS_REPRODUCTION, ALEVINS_PG }` MAJUSCULES |
| R2 | ✓ | Imports d'enums via `@/types` partout |
| R3 | ✓ | `Vente.origineType` ↔ `OrigineVente`, `Client.isSysteme` ↔ TS aligné + migrations appliquées |
| R4 | ✓ | Transaction unique, guard à la fin (1 nit : `getTransfertDestBacIds` utilise le prisma global — hérité CS.2) |
| R5 | N/A | Dialog entièrement contrôlé (pas de trigger interne) |
| R6 | ✓ | Classes Tailwind sémantiques, pas de couleur en dur |
| R7 | ✓ | Optionnels explicites (`depenses?`, `autoCloture?`, `notes?`) |
| R8 | ✓ | `siteId` partout sur toutes les queries et modèles |
| R9 | ✓ | 6/6 tests verts, tsc clean, build OK |

## Followups (non-bloquants)

| Priorité | Action |
|----------|--------|
| 🔴 Haute | **Seed prod « Nurserie interne » sur sites existants** — la fonction `createSite` (VA.5) auto-crée le client pour les nouveaux sites, mais les sites déjà en prod n'en ont pas. Script à exécuter manuellement : `prisma/data-fixes/VA5-seed-nurserie-interne.sql` |
| 🟠 Moyenne | Test manuel mobile 360px du dialog (3 inputs numériques par ligne bac) |
| 🟡 Basse | `getTransfertDestBacIds` accepter `tx` optionnel pour respecter strictement R4 |
| 🟡 Basse | `deleteVente` : remplacer string `"VENTE"` par `TypeReleve.VENTE` (dette technique pré-existante) |
| 🟡 Basse | Étendre `conservation-flow.spec.ts` E2E avec scénario vente d'alevins depuis PG |

## Fonctionnalité disponible en prod (après deploy Coolify)

Sur une vague `PRE_GROSSISSEMENT` en cours, menu action → « **Vendre restants comme alevins** » :
- Sélection client (« Nurserie interne » système en premier)
- Table par bac : quantité, poids moyen, prix /kg
- Total calculé en temps réel
- Case « Clôturer la vague après validation »
- Dépenses optionnelles inline
- Guard CS.3 valide l'invariant
