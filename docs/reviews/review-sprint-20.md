# Review — Sprint 20 : Packs & Provisioning Automatise

**Date :** 2026-03-15
**Reviewer :** @code-reviewer
**Sprint :** 20

---

## Perimetre de la review

Sprint 20 ajoute le systeme de "Packs" — des kits de demarrage preconfigures que DKFarm vend a ses clients pisciculteurs. L'activation d'un pack declenche un provisioning transactionnel automatique qui cree toutes les entites necessaires au client.

### Fichiers modifies ou crees

**Schema / DB :**
- `prisma/schema.prisma` — 6 nouveaux enums, 3 nouveaux modeles (Pack, PackProduit, PackActivation), Bac.volume nullable
- `prisma/migrations/20260320100000_add_phase3_enums/`
- `prisma/migrations/20260320110000_add_packs/`
- `prisma/seed.sql` — 3 packs + 9 PackProduits

**Types TypeScript :**
- `src/types/models.ts` — Role.INGENIEUR, 6 nouvelles permissions, TypeActivite.TRI/MEDICATION, StatutActivation, Pack*, PackActivation*
- `src/types/api.ts` — DTOs Sprint 20
- `src/types/index.ts` — Nouveaux exports
- `src/types/export.ts` — Bac.volume nullable
- `src/types/calculs.ts` — Bac.volume nullable

**API Routes :**
- `src/app/api/packs/route.ts`
- `src/app/api/packs/[id]/route.ts`
- `src/app/api/packs/[id]/produits/route.ts`
- `src/app/api/packs/[id]/activer/route.ts`
- `src/app/api/activations/route.ts`

**Logique metier :**
- `src/lib/queries/packs.ts` — CRUD Pack + PackProduit + lectures PackActivation
- `src/lib/queries/provisioning.ts` — Transaction atomique (10 etapes)
- `src/lib/analytics.ts` — Bac.volume nullable
- `src/lib/permissions-constants.ts` — 3 nouveaux groupes

**UI :**
- `src/components/packs/packs-list-client.tsx`
- `src/components/packs/pack-detail-client.tsx`
- `src/components/packs/pack-activer-client.tsx`
- `src/components/packs/activations-list-client.tsx`
- Pages : `/packs`, `/packs/[id]`, `/packs/[id]/activer`, `/activations`

**Corrections impact :**
- `src/components/layout/hamburger-menu.tsx` — Role.INGENIEUR
- `src/components/layout/user-menu.tsx` — Role.INGENIEUR
- `src/components/planning/mes-taches-client.tsx` — TypeActivite.TRI/MEDICATION
- `src/components/planning/planning-client.tsx` — TypeActivite.TRI/MEDICATION

**Tests :**
- `src/__tests__/api/packs.test.ts` — 31 tests

---

## Checklist R1-R9

### R1 — Enums MAJUSCULES
- [x] `StatutActivation` : ACTIVE, EXPIREE, SUSPENDUE — correct
- [x] `Role.INGENIEUR` — correct
- [x] `TypeActivite.TRI`, `TypeActivite.MEDICATION` — correct

### R2 — Imports enums
- [x] `import { StatutActivation } from "@/types"` utilise partout
- [x] `import { StatutVague, TypeMouvement, StatutActivation } from "@/types"` dans provisioning.ts

### R3 — Prisma = TypeScript identiques
- [x] Pack model : tous les champs alignes entre schema.prisma et models.ts
- [x] PackActivation : code @unique, statut StatutActivation — correct
- [x] `TxClient` utilise `Parameters<Parameters<typeof prisma.$transaction>[0]>[0]` — idiome correct

### R4 — Operations atomiques
- [x] `activerPack()` utilise une seule transaction Prisma couvrant 10 operations
- [x] Si une operation echoue, toutes les creations sont annulees (atomicite EC-2.3)
- [x] Anti-double-activation (EC-2.1) verifie DANS la transaction

### R5 — DialogTrigger asChild
- [x] `packs-list-client.tsx` : `<DialogTrigger asChild>` correctement utilise
- [x] `pack-detail-client.tsx` : `<DialogTrigger asChild>` sur le bouton Ajouter

### R6 — CSS variables
- [x] Aucune couleur hardcodee dans les nouveaux composants

### R7 — Nullabilite explicite
- [x] `Bac.volume` : `Float?` — nullable cote Prisma et `number | null` cote TypeScript
- [x] `clientSiteAddress` : `String?` — optionnel explicitement
- [x] `dateExpiration` : nullable

### R8 — siteId PARTOUT
- [x] `Pack.siteId` : present
- [x] `PackActivation.siteId` (vendeur) + `clientSiteId` (client) : les deux presentes
- [x] `PackProduit` : pas de siteId direct mais rattache a Pack (conforme EC-F05 : pas d'@unique sur clientSiteId)

### R9 — Tests avant review
- [x] `npx vitest run` : 1206/1206 passes
- [x] `npm run build` : succes

---

## Points specifiques

### EC-2.1 Anti-double-activation
Verifiee par `checkDoubleActivation()` qui cherche un user par phone puis une activation ACTIVE pour ce pack+user. Correct.

### EC-2.3 Atomicite
La transaction couvre : site, roles, user, member, configElevage copie, vague, bac, produits copies, mouvements, packActivation, mise a jour vague. Si n'importe quelle etape echoue, tout est annule.

### EC-2.4 Bac.volume nullable
`Bac.volume = null` lors du provisioning. Le client renseignera le volume plus tard. Correct.

### EC-2.5 Code ACT-YYYY-NNN
Le compteur par annee avec gestion overflow (> 999 utilise le nombre tel quel) est correctement implemente.

### F-03 System user
`getSystemUserId()` cherche d'abord `isSystem=true`, fallback sur premier admin du site vendeur. Pattern correct.

### F-05 Pas d'@unique sur clientSiteId
Verifiee dans schema.prisma — aucune contrainte @unique sur `PackActivation.clientSiteId`. Un site client peut avoir plusieurs activations.

### F-14 Produits copies
`activerPack()` cree des nouvelles instances Produit avec `fournisseurId: null` pour chaque produit du pack. Les produits DKFarm ne sont pas references directement.

---

## Problemes identifies et corriges

1. **TxClient type** — Prisma transaction parameter type utilise correctement via `Parameters<Parameters<typeof prisma.$transaction>[0]>[0]`
2. **Toast variant** — `"destructive"` n'existe pas dans ce projet, corrige en `"error"`
3. **Button variant** — `"default"` n'existe pas, corrige en `"primary"`
4. **StatutActivation cast** — `activation.statut as StatutActivation` necessaire pour aligner les types Prisma generes et les types TypeScript custom

---

## Statut : VALIDE

Sprint 20 valide. Toutes les stories sont implementees et testees.

| Story | Statut |
|-------|--------|
| 20.1 — Schema Prisma Phase 3 enums | FAIT |
| 20.2 — Schema Pack + migrations | FAIT |
| 20.3 — Types TypeScript Pack | FAIT |
| 20.4 — Permissions + system user + ADR | FAIT |
| 20.5 — Queries CRUD Pack | FAIT |
| 20.6 — API Routes Pack + provisioning | FAIT |
| 20.7 — UI Admin Packs | FAIT |
| 20.8 — Seed data Packs | FAIT |
| 20.9 — Tests + Review | FAIT |
