# Review Sprint 17 — Besoins + Workflow

**Verdict :** VALIDE
**Reviewer :** @code-reviewer
**Date :** 2026-03-16

---

## Checklist R1-R9

| Règle | Statut | Note |
|-------|--------|------|
| R1 — Enums MAJUSCULES | OK | StatutBesoins : SOUMISE, APPROUVEE, TRAITEE, CLOTUREE, REJETEE — toutes en UPPERCASE |
| R2 — Import enums | OK | `import { StatutBesoins } from "@/types"` dans tous les fichiers — aucun string literal |
| R3 — Prisma = TypeScript identiques | OK | Champs ListeBesoins et LigneBesoin dans schema.prisma == interfaces dans models.ts |
| R4 — Opérations atomiques | OK | `createListeBesoins`, `approuverBesoins`, `rejeterBesoins`, `traiterBesoins`, `cloturerBesoins`, `deleteListeBesoins` utilisent tous `$transaction` |
| R5 — DialogTrigger asChild | OK | Tous les boutons trigger dans `besoins-detail-client.tsx` utilisent `asChild` (3 dialogs : approuver/rejeter, traiter, clôturer) |
| R6 — CSS variables du thème | OK | `text-primary`, `text-muted-foreground`, `text-destructive` — pas de couleurs en dur |
| R7 — Nullabilité explicite | OK | `valideurId`, `vagueId`, `montantReel`, `motifRejet`, `prixReel`, `commandeId` déclarés nullable dès le schéma |
| R8 — siteId PARTOUT | OK | `ListeBesoins` a `siteId` (FK Site, NOT NULL). `LigneBesoin` est scoped via `listeBesoinsId` — même pattern que `LigneCommande` |
| R9 — Tests avant review | OK | 1146/1146 tests passent, build OK |

---

## Vérification fonctionnelle

### Transitions workflow
La carte des transitions valides est définie dans `TRANSITIONS_VALIDES` :
- SOUMISE → APPROUVEE | REJETEE
- APPROUVEE → TRAITEE
- TRAITEE → CLOTUREE
- CLOTUREE → (rien)
- REJETEE → (rien)

La fonction `verifierTransition()` lève une erreur `Transition invalide` pour toute transition non prévue — testée avec 3 cas invalides.

### Groupement par fournisseur dans traiterBesoins
La logique groupe les lignes COMMANDE par `fournisseur.id` (lu via `ligne.produit.fournisseur`). Une `Commande` BROUILLON est créée par groupe. Le `commandeId` est lié sur chaque `LigneBesoin`. Si `produit.fournisseur` est null, le fallback `dto.fournisseurId` est utilisé — sinon la ligne est ignorée pour les commandes.

### Dépense liée au traitement
`traiterBesoins` crée automatiquement une `Depense` (catégorie AUTRE, montantEstime, listeBesoinsId) — liaison bidirectionnelle confirmée.

### Calcul montantEstime
`createListeBesoins` et `updateListeBesoins` calculent `montantEstime = SUM(quantite × prixEstime)` via `calculerMontantEstime()` — fonction pure, facile à tester.

### Calcul montantReel
`cloturerBesoins` met à jour `prixReel` par ligne puis recalcule `montantReel = SUM(quantite × (prixReel ?? prixEstime))` — les lignes sans prixReel fourni utilisent prixEstime comme fallback.

### Permissions vérifiées sur toutes les routes
- `GET /api/besoins` → BESOINS_SOUMETTRE
- `POST /api/besoins` → BESOINS_SOUMETTRE
- `GET /api/besoins/[id]` → BESOINS_SOUMETTRE
- `PUT /api/besoins/[id]` → BESOINS_SOUMETTRE
- `DELETE /api/besoins/[id]` → BESOINS_SOUMETTRE
- `POST /api/besoins/[id]/approuver` → BESOINS_APPROUVER
- `POST /api/besoins/[id]/rejeter` → BESOINS_APPROUVER
- `POST /api/besoins/[id]/traiter` → BESOINS_TRAITER
- `POST /api/besoins/[id]/cloturer` → BESOINS_TRAITER

### siteId filtré sur toutes les queries
Toutes les queries Prisma incluent `siteId` dans le `where` — pas de fuite inter-sites.

---

## Observations mineures

### M1 — LigneBesoin sans siteId direct
`LigneBesoin` n'a pas de `siteId` direct, comme `LigneCommande`. La sécurité est assurée par la relation `listeBesoinsId → ListeBesoins.siteId`. Ce pattern est cohérent avec le reste du projet.

### M2 — Dépense catégorie AUTRE dans traiterBesoins
La dépense auto-créée lors du traitement utilise `categorieDepense: "AUTRE"` car une liste peut contenir des articles de catégories mixtes. Acceptable pour MVP — peut être affiné en Sprint 18.

### M3 — fournisseurId INCONNU ignoré
Si `produit.fournisseur` est null et aucun `dto.fournisseurId` n'est fourni, la ligne est ignorée dans la génération de commandes (pas d'erreur). Acceptable — les lignes LIBRE traitent ce cas.

---

## Fichiers créés/modifiés

**Schéma :**
- `prisma/schema.prisma` — enum StatutBesoins ; modèles ListeBesoins + LigneBesoin ; relations inverses sur Site, User, Vague, Commande, Produit, Depense
- `prisma/migrations/20260316100000_add_besoins/migration.sql`
- `prisma/seed.sql` — 3 listes de besoins + 8 lignes

**Types :**
- `src/types/models.ts` — enum StatutBesoins + interfaces ListeBesoins, ListeBesoinsWithRelations, LigneBesoin, LigneBesoinWithRelations ; Depense.listeBesoinsId ajouté
- `src/types/api.ts` — DTOs Sprint 17 (CreateListeBesoinsDTO, UpdateListeBesoinsDTO, etc.)
- `src/types/index.ts` — barrel exports

**Queries :**
- `src/lib/queries/besoins.ts` (nouveau)

**API routes :**
- `src/app/api/besoins/route.ts` (nouveau)
- `src/app/api/besoins/[id]/route.ts` (nouveau)
- `src/app/api/besoins/[id]/approuver/route.ts` (nouveau)
- `src/app/api/besoins/[id]/rejeter/route.ts` (nouveau)
- `src/app/api/besoins/[id]/traiter/route.ts` (nouveau)
- `src/app/api/besoins/[id]/cloturer/route.ts` (nouveau)

**UI :**
- `src/app/besoins/page.tsx` (nouveau)
- `src/app/besoins/[id]/page.tsx` (nouveau)
- `src/app/besoins/nouveau/page.tsx` (nouveau)
- `src/components/besoins/besoins-list-client.tsx` (nouveau)
- `src/components/besoins/besoins-detail-client.tsx` (nouveau)
- `src/components/besoins/besoins-form-client.tsx` (nouveau)

**Tests :**
- `src/__tests__/api/besoins.test.ts` (nouveau — 25 tests)
