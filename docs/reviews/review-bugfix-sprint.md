# Review Sprint Bugfix — Corrections avant Sprint 9

**Date :** 2026-03-10
**Revieweur :** @code-reviewer
**Statut :** CONDITIONNEL — VALIDE apres correction de I1 et I2

## Perimetre

Sprint Bugfix complet : 6 stories (BF-01 a BF-06) corrigeant 5 bugs (BUG-011, BUG-013, BUG-014, BUG-015, BUG-016) detectes pendant les sprints 7 et 8.

## Checklist R1-R9

| # | Regle | Statut | Notes |
|---|-------|--------|-------|
| R1 | Enums MAJUSCULES | OK | TypeMouvement.SORTIE, CategorieProduit.ALIMENT, CategorieProduit.INTRANT |
| R2 | Toujours importer les enums | OK | `import { Permission } from "@/types"` dans permissions-constants.ts, role-form-labels.ts, releves-list.tsx |
| R3 | Prisma = TypeScript identiques | OK | `consommations?: ReleveConsommationWithRelations[]` aligne avec l'include Prisma |
| R4 | Operations atomiques | OK | `updateReleve` utilise `prisma.$transaction` pour le delta stock complet |
| R5 | DialogTrigger asChild | OK | modifier-releve-dialog.tsx ligne 239, member-actions-dialog.tsx |
| R6 | CSS variables du theme | OK | `bg-muted`, `text-muted-foreground`, `border-border` — pas de couleurs en dur |
| R7 | Nullabilite explicite | OK | `consommations?` optionnel sur Releve, `produits` prop optionnelle |
| R8 | siteId PARTOUT | OK | Filtre siteId dans getVagueById, getReleveById, updateReleve (transaction), produit.findMany |
| R9 | Tests avant review | OK | 636 tests, 27 fichiers, 0 echecs, build OK |

---

## BF-01 — BUG-011 : Migration consommations + error logging

**Verdict : CONDITIONNEL — 1 important, 1 mineur**

- Migration `20260309150000_add_releve_consommation` correctement appliquee (table `ReleveConsommation` + colonne `MouvementStock.releveId`)
- FK correctes : CASCADE sur releveId, SET NULL sur MouvementStock.releveId, RESTRICT sur produitId
- `console.error("[POST /api/releves] Error:", error)` present dans le catch block du POST
- Tests non-regression ajoutes : POST releve avec consommations → 201, sans consommations → 201, stock insuffisant → 409

### I2 — GET /api/releves manque console.error dans le catch block

**Severite : Important**
**Fichier :** `src/app/api/releves/route.ts` lignes 40-51

Le catch block du handler GET ne contient pas de `console.error`. En cas d'erreur 500 sur le GET, aucune trace n'est produite en logs serveur, rendant le debug impossible. Le POST a ete corrige (BUG-011), mais le GET n'a pas recu le meme traitement.

**Fix requis :** Ajouter `console.error("[GET /api/releves] Error:", error);` au debut du catch block GET.

### M5 — Switch sans clause default dans POST releves

**Severite : Mineur**
**Fichier :** `src/app/api/releves/route.ts` lignes 252-304

Le switch sur `body.typeReleve` n'a pas de clause `default`. Si un nouveau type est ajoute a l'enum `TypeReleve` sans etre ajoute au switch, `dto` reste non assignee sans erreur compile-time. Ajouter `default: throw new Error(...)` pour securiser.

---

## BF-02 — BUG-016 : Affichage et modification des consommations

**Verdict : CONDITIONNEL — 1 important, 3 mineurs, 2 suggestions**

### Corrections verifiees

| Fichier | Correction | Statut |
|---------|-----------|--------|
| `src/lib/queries/vagues.ts` | `getVagueById` inclut `consommations: { include: { produit: true } }` | OK |
| `src/lib/queries/releves.ts` | `getReleveById` inclut `produit` dans les consommations | OK |
| `src/lib/queries/releves.ts` | `updateReleve` gere le delta stock en transaction atomique (R4) | OK |
| `src/types/models.ts` | `consommations?: ReleveConsommationWithRelations[]` sur Releve | OK |
| `src/types/api.ts` | `UpdateReleveDTO.consommations?: CreateReleveConsommationDTO[]` | OK |
| `src/components/vagues/releves-list.tsx` | Affiche produits consommes sous chaque releve | OK |
| `src/app/api/releves/[id]/route.ts` | PUT valide et passe les consommations | OK |
| `src/components/releves/modifier-releve-dialog.tsx` | Charge les consommations existantes dans le formulaire | OK |
| `src/app/vagues/[id]/page.tsx` | Fetche produits ALIMENT+INTRANT avec siteId | OK |

### I1 — PUT /api/releves/[id] retourne 500 au lieu de 409 pour stock insuffisant

**Severite : Important**
**Fichier :** `src/app/api/releves/[id]/route.ts` lignes 161-178

Le catch block du PUT ne discrimine pas l'erreur "Stock insuffisant" :
- POST `/api/releves` (route.ts ligne 323) : `message.includes("Stock insuffisant")` → retourne **409**
- PUT `/api/releves/[id]` (route.ts ligne 175) : tombe dans le handler generique → retourne **500** avec message opaque "Erreur serveur lors de la mise a jour du releve."

Le test `releves.test.ts` (ligne 1008) valide ce 500 comme comportement attendu, mais c'est une regression fonctionnelle : l'utilisateur qui modifie les consommations et depasse le stock recoit un message generique incomprehensible au lieu de l'erreur precise.

**Fix requis :** Ajouter un check `message.includes("Stock insuffisant")` avant le handler 500, retournant 409 avec le message original (alignement avec le POST).

### M1 — Reponse PUT sans consommations

**Severite : Mineur**
**Fichier :** `src/lib/queries/releves.ts` ligne 216-219

`updateReleve` retourne le resultat de `tx.releve.update` sans `include: { consommations: { include: { produit: true } } }`. Le `ModifierReleveDialog` fait `router.refresh()` ce qui masque le probleme, mais la reponse brute de l'API est incomplete. Impact nul aujourd'hui mais fragile.

### M2 — deleteMany SORTIE trop large

**Severite : Mineur**
**Fichier :** `src/lib/queries/releves.ts` lignes 241-247

Le `deleteMany` supprime TOUS les mouvements SORTIE lies au `releveId`, pas seulement ceux crees par les consommations. Si un autre processus attache des mouvements manuels au meme releve (cas hypothetique), ils seraient supprimes. Acceptable pour le MVP, a documenter.

### M3 — Consommations invisibles si produits vides

**Severite : Mineur**
**Fichier :** `src/components/releves/modifier-releve-dialog.tsx` ligne 422

Si `produits.length === 0` (tous les produits desactives), la section ConsommationFields n'est pas renderisee. Les consommations existantes restent attachees silencieusement — l'utilisateur ne peut ni les voir ni les supprimer dans le dialog.

### S1 — Inconsistance labels unite

**Severite : Suggestion**
**Fichier :** `src/components/vagues/releves-list.tsx` ligne 140

`c.produit.unite.toLowerCase()` produit "kg", "litre", "unite", "sacs". Le composant `consommation-fields.tsx` utilise un map `uniteLabels` qui produit des labels plus propres. Aligner pour coherence.

### S2 — Pas de test d'integration pour delta stock

**Severite : Suggestion**

`updateReleve` contient une logique transactionnelle complexe (delete mouvements → restore stock → create consommations → decrement stock) mais les tests mockent la couche queries. Un test d'integration exercant la transaction reelle serait utile.

---

## BF-03 — BUG-013 : Fix layout permissions dialog mobile

**Verdict : OK**

### Corrections verifiees

| Element | Implementation | Statut |
|---------|---------------|--------|
| Navigation interne | Vue "main" / "permissions" avec state local | OK |
| Conteneur scrollable | `flex-1 min-h-0 overflow-y-auto` (remplace `max-h-[60vh]`) | OK |
| Bouton retour en bas | `mt-auto pt-3` | OK |
| Permissions groupees | `PERMISSION_GROUPS` de `permissions-constants.ts` avec labels francais | OK |
| Accessibilite mobile | Items 44px minimum (`min-h-[44px]`) | OK |
| R2 respect | `import { Permission } from "@/types"` | OK |
| R5 respect | Dialog primitives correctement utilises | OK |
| R6 respect | `bg-muted`, `text-muted-foreground`, `border-border` via CSS variables | OK |

Le composant `dialog.tsx` est bien configure en mobile-first : plein ecran (`inset-0`) sur mobile, centre avec `max-w-lg` sur desktop.

Deux points additionnels detectes :

### M4 — Bouton trigger dialog 32px (accessibilite mobile)

**Severite : Mineur**
**Fichier :** `src/components/sites/member-actions-dialog.tsx` ligne 135

Le bouton trigger du dialog (`h-8 w-8` = 32px) est en dessous du seuil WCAG 2.5.5 de 44px pour les cibles tactiles. Les items de permissions a l'interieur du dialog respectent bien `min-h-[44px]`, mais le point d'entree lui-meme est trop petit.

### S3 — Messages toast sans accents

**Severite : Suggestion**
**Fichier :** `src/components/sites/member-actions-dialog.tsx` lignes 92, 95, 98

Les messages toast sont en francais sans accents : "Role modifie" au lieu de "Role modifie", "Membre retire" au lieu de "Membre retire", "Erreur reseau" au lieu de "Erreur reseau". La convention CLAUDE.md exige du francais correct pour l'UI.

---

## BF-04 — BUG-014 : Verification fix changement de site actif

**Verdict : VERIFIE**

Client Prisma genere a jour. `SiteRole.ts` et `SiteMember.ts` contiennent les relations. 443 tests passent au moment de la verification, 636 tests passent apres les ajouts du Sprint 9.

---

## BF-05 — BUG-015 : Verification fix badge role mobile

**Verdict : VERIFIE**

Badge deplace sous l'email dans `site-detail-client.tsx` avec `text-xs mt-1 w-fit`. Build OK.

---

## BF-06 — Tests de non-regression

**Verdict : OK**

| Metrique | Valeur |
|----------|--------|
| Tests totaux | 636 |
| Fichiers de test | 27 |
| Echecs | 0 |
| Build production | OK |

Tests ajoutes pour BUG-016 :
- GET /api/releves/[id] avec consommations + produit
- PUT /api/releves/[id] avec consommations valides → 200
- PUT /api/releves/[id] avec consommations vides → 200
- PUT /api/releves/[id] avec stock insuffisant → 500 (devrait etre 409 — voir I1)
- PUT /api/releves/[id] avec consommations non-tableau → 400
- PUT /api/releves/[id] avec champs structurels immutables → 400

---

## Build

```
npx vitest run — 636 tests, 27 files, 0 failures
npm run build — OK (Turbopack)
```

---

## Resume des problemes

| # | Bug | Severite | Probleme | Action |
|---|-----|----------|----------|--------|
| I1 | BF-02 | Important | PUT /api/releves/[id] retourne 500 au lieu de 409 pour stock insuffisant | @developer : aligner avec POST |
| I2 | BF-01 | Important | GET /api/releves manque console.error dans le catch block | @developer : ajouter console.error |
| M1 | BF-02 | Mineur | Reponse PUT sans consommations | Reportable Sprint 12 |
| M2 | BF-02 | Mineur | deleteMany SORTIE potentiellement trop large | Documenter |
| M3 | BF-02 | Mineur | Consommations invisibles si produits vides | Reportable Sprint 12 |
| S1 | BF-02 | Suggestion | unite.toLowerCase() vs uniteLabels | Sprint 12 polish |
| S2 | BF-02 | Suggestion | Pas de test integration delta stock | Sprint 12 |
| M4 | BF-03 | Mineur | Bouton trigger dialog 32px au lieu de 44px | Sprint 12 polish |
| M5 | BF-01 | Mineur | Switch sans default dans POST releves | Sprint 12 polish |
| S3 | BF-03 | Suggestion | Messages toast sans accents (langue UI) | Sprint 12 polish |
| S4 | BF-01 | Suggestion | Pas de contrainte unique sur (releveId, produitId) dans ReleveConsommation | A evaluer |

---

## Verdict

Sprint Bugfix est globalement bien implemente. Les 5 bugs sont corriges, les tests de non-regression sont en place, et les regles R1-R9 sont respectees.

**CONDITIONNEL** — Deux problemes importants doivent etre corriges avant validation finale :
- **I1** : PUT `/api/releves/[id]` retourne 500 au lieu de 409 pour stock insuffisant
- **I2** : GET `/api/releves` manque `console.error` dans le catch block

Les mineurs (M1-M5) et suggestions (S1-S4) sont reportables au Sprint 12.
