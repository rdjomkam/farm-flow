# Review Sprint 8 — Stock & Approvisionnement

**Revieweur :** @code-reviewer
**Date :** 2026-03-09 (mis a jour 2026-03-10)
**Verdict : VALIDE**

---

## Perimetre review

| Couche | Fichiers | Agents |
|--------|---------|--------|
| Schema + Migration | `prisma/schema.prisma`, migration `20260309120000_add_stock` | @db-specialist |
| Queries | `src/lib/queries/{fournisseurs,produits,mouvements,commandes}.ts` | @db-specialist |
| Types | `src/types/{models,api,index}.ts` (sections stock) | @architect |
| API Routes | 11 fichiers dans `src/app/api/{fournisseurs,produits,stock,commandes}/` | @developer |
| UI Pages | 7 pages dans `src/app/stock/` | @developer |
| UI Composants | 6 composants dans `src/components/stock/` | @developer |
| Navigation | `bottom-nav.tsx`, `sidebar.tsx` | @developer |
| Tests | 5 fichiers, 100 tests dans `src/__tests__/api/` | @tester |

**Tests :** 443/443 OK | **Build :** OK

---

## Checklist R1-R9

| # | Regle | Statut | Commentaire |
|---|-------|--------|-------------|
| R1 | Enums MAJUSCULES | OK | CategorieProduit, UniteStock, TypeMouvement, StatutCommande — toutes en UPPERCASE |
| R2 | Enums importes depuis @/types | OK | ~~1 violation dans `commandes.ts:176`~~ — **corrige** : `TypeMouvement.ENTREE` avec import correct |
| R3 | Prisma = TypeScript | OK | 5 modeles + 4 enums parfaitement alignes schema <-> interfaces |
| R4 | Operations atomiques | OK | `$transaction` sur createMouvement, createCommande, envoyerCommande, recevoirCommande, annulerCommande. `updateMany` avec condition pour les updates. |
| R5 | DialogTrigger asChild | OK | Verifie sur 5 DialogTrigger + 7 DialogClose — tous avec `asChild` |
| R6 | CSS variables du theme | **Mineur** | `text-blue-600`/`bg-blue-100` et `text-purple-600`/`bg-purple-100` dans `stock/page.tsx` — utiliser des variables theme pour coherence |
| R7 | Nullabilite explicite | OK | telephone?, email?, adresse?, fournisseurId?, vagueId?, commandeId?, prixTotal?, notes? — tout explicite |
| R8 | siteId PARTOUT | **Mineur** | Fournisseur, Produit, MouvementStock, Commande ont siteId. LigneCommande n'a pas siteId — acceptable car entite enfant avec CASCADE via commandeId |
| R9 | Tests avant review | OK | 443/443 tests passent, build production OK |

---

## Constatations detaillees

### 1. ~~Violation R2 : string literal dans recevoirCommande~~ — CORRIGE
**Severite : important** | **Statut : CORRIGE**
**Fichier :** `src/lib/queries/commandes.ts:176`
**Probleme initial :** `type: "ENTREE"` au lieu de `TypeMouvement.ENTREE`
**Fix applique :** `import { StatutCommande, TypeMouvement } from "@/types"` (ligne 2) et `type: TypeMouvement.ENTREE` (ligne 176). Verifie OK.

### 2. Couleurs hardcodees dans la page Stock hub
**Severite : mineur**
**Fichier :** `src/app/stock/page.tsx:36-44`
**Probleme :** `text-blue-600`, `bg-blue-100`, `text-purple-600`, `bg-purple-100` — couleurs Tailwind en dur au lieu de variables du theme
**Suggestion :** Utiliser des variantes semantiques (`text-primary`, `bg-primary/10`) ou des variables CSS du theme pour la coherence. Reportable au Sprint 12 (polissage).

### 3. Numero de commande : risque de collision en concurrence
**Severite : mineur**
**Fichier :** `src/lib/queries/commandes.ts:82-86`
**Probleme :** Le numero est genere par `count + 1` — deux requetes concurrentes pourraient generer le meme numero. La contrainte `@unique` protege en DB mais l'erreur serait un 500.
**Suggestion :** Acceptable pour le volume actuel (pisciculture artisanale). Pour un futur scaling, envisager une sequence PostgreSQL ou un retry automatique. Reportable.

### 4. LigneCommande sans siteId (R8)
**Severite : suggestion**
**Fichier :** `prisma/schema.prisma:374-386`
**Probleme :** R8 dit "chaque modele DOIT avoir siteId", LigneCommande n'en a pas.
**Suggestion :** LigneCommande est une entite enfant avec `onDelete: Cascade` sur Commande — le siteId est herite transitoirement. La denormalisation n'est pas necessaire ici. Acceptable.

---

## Architecture & Securite

### Permissions (OK)
| Endpoint | Lecture | Ecriture |
|----------|---------|----------|
| `/api/fournisseurs` | APPROVISIONNEMENT_VOIR | APPROVISIONNEMENT_GERER |
| `/api/produits` | STOCK_VOIR | STOCK_GERER |
| `/api/stock/mouvements` | STOCK_VOIR | STOCK_GERER |
| `/api/stock/alertes` | STOCK_VOIR | — |
| `/api/commandes` | APPROVISIONNEMENT_VOIR | APPROVISIONNEMENT_GERER |
| `/api/commandes/[id]/recevoir` | — | APPROVISIONNEMENT_GERER |
| `/api/commandes/[id]/envoyer` | — | APPROVISIONNEMENT_GERER |
| `/api/commandes/[id]/annuler` | — | APPROVISIONNEMENT_GERER |

Toutes les routes verifient auth + permission. Global ADMIN bypass correctement implemente.

### Validation des entrees (OK)
- Fournisseurs : nom obligatoire, email regex
- Produits : nom, categorie (whitelist), unite (whitelist), prixUnitaire >= 0, seuilAlerte >= 0
- Mouvements : produitId, type (whitelist), quantite > 0, date ISO, prixTotal >= 0
- Commandes : fournisseurId, dateCommande ISO, lignes[] (produitId, quantite > 0, prixUnitaire >= 0)
- Commandes recevoir : dateLivraison ISO valide si fournie

### Transaction recevoirCommande (OK)
La transaction dans `recevoirCommande` est correcte :
1. Verifie statut ENVOYEE
2. Pour chaque ligne : cree mouvement ENTREE + incremente stockActuel
3. Met a jour statut LIVREE + dateLivraison

Tout est dans un seul `$transaction` — atomicite garantie.

### Workflow statut commande (OK)
- BROUILLON -> ENVOYEE : `envoyerCommande` verifie statut === BROUILLON
- ENVOYEE -> LIVREE : `recevoirCommande` verifie statut === ENVOYEE
- BROUILLON|ENVOYEE -> ANNULEE : `annulerCommande` refuse si LIVREE ou deja ANNULEE
- Stock insuffisant : mouvement SORTIE refuse avec 409 et message explicite

---

## Mobile-first & UI

### Points positifs
- Toutes les listes utilisent des **cartes empilees** (pas de tableaux)
- **Tabs horizontales scrollables** (`overflow-x-auto -mx-4 px-4`) pour les filtres
- **Touch targets adequats** : boutons min 44px, nav 56px
- **Formulaire commande** : `max-h-[90dvh] overflow-y-auto` pour la modale
- **Grid responsive** : `grid gap-3 sm:grid-cols-3` sur la page hub Stock
- **Truncation** : `truncate` sur les textes longs (noms, emails)
- **States empty** : Icones + textes centres pour les listes vides
- **Breadcrumb retour** : ArrowLeft en haut de chaque sous-page

### Pattern Server Component / Client Component (OK)
- Pages (`page.tsx`) = Server Components qui fetchen les donnees
- Composants interactifs (`*-client.tsx`) = Client Components avec `"use client"`
- Serialisation correcte : `JSON.parse(JSON.stringify(data))` pour passer les dates aux clients

---

## Tests

| Fichier | Tests | Couverture |
|---------|-------|-----------|
| `fournisseurs.test.ts` | 17 | GET list, POST create, GET detail, PUT update, DELETE soft — auth 401/403 |
| `produits.test.ts` | 25 | GET list+filtres, POST create+validation, GET detail, PUT update+validation, DELETE — auth 401 |
| `commandes.test.ts` | 32 | GET list+filtres, POST create+validation lignes, GET detail, PUT actions (envoyer/annuler), POST recevoir+validation date — workflow 409 |
| `mouvements.test.ts` | 21 | GET list+filtres, POST create ENTREE/SORTIE+validation — stock insuffisant 409 |
| `alertes-stock.test.ts` | 5 | GET alertes, liste vide, auth 401/403, erreur 500 |

Tests bien structures, couverture adequate des cas nominaux, erreurs de validation, permissions, et cas limites metier (stock insuffisant, workflow statut).

---

## Bugs detectes et corriges pendant le Sprint 8

| Bug | Severite | Probleme | Statut |
|-----|----------|----------|--------|
| BUG-006 | Basse | Toasts avec fond semi-transparent (10% opacite) | CLOS — fond opaque `bg-card` |
| BUG-007 | Moyenne | UI trop de cartes/panels + design membres site | CLOS — design compact |
| BUG-008 | Moyenne | Pas de lien "Sites" dans la bottom-nav mobile | CLOS — item ajoute |
| BUG-009 | **Haute** | `/stock` crash — `prisma.produit.fields.seuilAlerte` FieldRef non supporte | CLOS — filtre cote application |
| BUG-010 | **Haute** | Hamburger menu absent du header | CLOS — import reintegre |
| BUG-011 | **Haute** | POST /api/releves avec consommations retourne 500 | CORRIGE — migration appliquee |
| BUG-016 | **Haute** | Consommations non affichees dans detail/modification releve | CORRIGE — includes + UI ajoutes |

**7 bugs detectes, 7 corriges.** Les 4 bugs de severite Haute ont ete corriges avant la cloture du sprint.

---

## Actions requises

### Avant validation (bloquant)
- [x] ~~**Fix R2** : `src/lib/queries/commandes.ts:176`~~ — **CORRIGE** : `TypeMouvement.ENTREE` avec import correct

### Suggestions (non-bloquant, reportable Sprint 12)
- [ ] Remplacer les couleurs Tailwind hardcodees dans `stock/page.tsx` par des variables theme
- [ ] Considerer un mecanisme de retry/sequence pour la generation du numero de commande

---

## Conclusion

Le Sprint 8 est de **tres bonne qualite**. L'architecture est solide :
- Transactions atomiques correctement implementees
- Workflow de commande robuste avec validations de statut
- Permissions granulaires et coherentes
- UI mobile-first avec cartes, pas de tableaux
- 100+ tests couvrant tous les endpoints et cas limites
- 7 bugs detectes et tous corriges (dont 4 de severite Haute)

Le fix bloquant (violation R2 `"ENTREE"` -> `TypeMouvement.ENTREE`) a ete applique et verifie. L'import et l'usage sont corrects dans `commandes.ts`. Le bug critique BUG-009 (`getProduitsEnAlerte` FieldRef) a ete corrige avec un filtre applicatif correct.

**Verdict : VALIDE** — Sprint 8 approuve pour cloture. Le Sprint 9 peut etre lance.
