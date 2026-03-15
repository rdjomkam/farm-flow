# Review Sprint 16 — Dépenses base

**Verdict :** VALIDE
**Reviewer :** @code-reviewer
**Date :** 2026-03-15

---

## Checklist R1-R9

| Règle | Statut | Note |
|-------|--------|------|
| R1 — Enums MAJUSCULES | OK | CategorieDepense, StatutDepense, FrequenceRecurrence — toutes en UPPERCASE |
| R2 — Import enums | OK | `import { StatutDepense, CategorieDepense } from "@/types"` partout — aucun string literal |
| R3 — Prisma = TypeScript identiques | OK | Champs dans schema.prisma == interfaces Depense / PaiementDepense dans models.ts |
| R4 — Opérations atomiques | OK | `createDepense`, `ajouterPaiementDepense`, `recevoirCommande` utilisent `$transaction` |
| R5 — DialogTrigger asChild | OK | Tous les boutons trigger dans les dialogs (`depense-detail-client.tsx`) utilisent `asChild` |
| R6 — CSS variables du thème | OK | `text-primary`, `text-warning`, `text-muted-foreground` — pas de couleurs en dur |
| R7 — Nullabilité explicite | OK | `dateEcheance`, `factureUrl`, `commandeId`, `vagueId` déclarés nullable dès le schéma |
| R8 — siteId PARTOUT | OK | `Depense` et `PaiementDepense` ont tous deux `siteId` (FK Site, NOT NULL) |
| R9 — Tests avant review | OK | 1121/1121 tests passent, build OK |

---

## Vérification fonctionnelle

### Pattern paiement partiel
Le pattern `ajouterPaiementDepense` est identique à `ajouterPaiement` de `factures.ts` :
- Vérification statut (refuse PAYEE)
- Calcul `resteAPayer` avec rejet si surpaiement
- Création paiement en transaction
- Agrégation SUM pour recalculer `montantPaye`
- Auto-mise à jour statut (NON_PAYEE → PAYEE_PARTIELLEMENT → PAYEE)

### Anti-doublon auto-création dépense
Dans `recevoirCommande` : vérification `await tx.depense.findFirst({ where: { commandeId } })` avant création — si dépense existe, pas de création.

### Permissions vérifiées sur toutes les routes
- `GET /api/depenses` → DEPENSES_VOIR
- `POST /api/depenses` → DEPENSES_CREER
- `GET /api/depenses/[id]` → DEPENSES_VOIR
- `PUT /api/depenses/[id]` → DEPENSES_CREER
- `DELETE /api/depenses/[id]` → DEPENSES_CREER
- `POST /api/depenses/[id]/paiements` → DEPENSES_PAYER
- `POST/GET/DELETE /api/depenses/[id]/upload` → DEPENSES_CREER / DEPENSES_VOIR

### siteId filtré sur toutes les queries
Toutes les queries Prisma incluent `siteId` dans le `where` — pas de fuite de données inter-sites.

---

## Observations mineures

### M1 — Retour API `recevoirCommande` changé (non-breaking pour l'UI)
La route `/api/commandes/[id]/recevoir` retourne maintenant `{ commande, depense }` au lieu de `commande` directement. Les tests Sprint 15 ont été mis à jour. L'UI (`commande-detail-client.tsx`) utilise ce nouveau format — vérifier qu'aucun consommateur externe ne s'attend à l'ancien format.

### M2 — `FrequenceRecurrence` défini mais non utilisé en Sprint 16
L'enum `FrequenceRecurrence` (MENSUEL, TRIMESTRIEL, ANNUEL) est ajouté au schéma mais n'est pas encore utilisé dans `Depense`. Il sera utilisé en Sprint 17 (Besoins) pour les dépenses récurrentes. Acceptable d'avance.

### M3 — Catégorie dominante basée sur le montant, fallback ALIMENT
Dans `recevoirCommande`, la catégorie dominante est choisie par montant total des lignes. Si toutes les lignes ont le même montant, c'est le premier de l'Object.entries qui gagne (ordre non garanti). Acceptable pour le cas nominal, mais pourrait être raffiné.

---

## Fichiers créés/modifiés

**Schéma :**
- `prisma/schema.prisma` — enums CategorieDepense, StatutDepense, FrequenceRecurrence ; 6 nouvelles permissions ; modèles Depense + PaiementDepense ; relations inverses
- `prisma/migrations/20260315110000_add_depenses/migration.sql`
- `prisma/seed.sql` — 5 dépenses + 4 paiements

**Types :**
- `src/types/models.ts` — enums + interfaces Depense, PaiementDepense
- `src/types/api.ts` — DTOs CreateDepenseDTO, UpdateDepenseDTO, DepenseFilters, CreatePaiementDepenseDTO
- `src/types/index.ts` — barrel exports

**Queries :**
- `src/lib/queries/depenses.ts` (nouveau)
- `src/lib/queries/commandes.ts` (modifié — auto-création dépense + nouveau retour)

**API routes :**
- `src/app/api/depenses/route.ts` (nouveau)
- `src/app/api/depenses/[id]/route.ts` (nouveau)
- `src/app/api/depenses/[id]/paiements/route.ts` (nouveau)
- `src/app/api/depenses/[id]/upload/route.ts` (nouveau)
- `src/app/api/commandes/[id]/recevoir/route.ts` (modifié)

**UI :**
- `src/app/depenses/page.tsx` (nouveau)
- `src/app/depenses/[id]/page.tsx` (nouveau)
- `src/app/depenses/nouvelle/page.tsx` (nouveau)
- `src/components/depenses/depenses-list-client.tsx` (nouveau)
- `src/components/depenses/depense-detail-client.tsx` (nouveau)
- `src/components/depenses/depense-form-client.tsx` (nouveau)

**Permissions :**
- `src/lib/permissions-constants.ts` — groupe `depenses` ajouté à PERMISSION_GROUPS

**Tests :**
- `src/__tests__/api/depenses.test.ts` (nouveau — 19 tests)
- `src/__tests__/api/commandes.test.ts` (mis à jour — 2 tests)
- `src/__tests__/api/commandes-facture.test.ts` (mis à jour — 1 test)
- `src/__tests__/permissions.test.ts` (mis à jour — 2 tests)
