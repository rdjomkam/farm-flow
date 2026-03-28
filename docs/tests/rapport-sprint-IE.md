# Rapport de Tests — Sprint IE
**Date :** 2026-03-28
**Sprint :** IE — ADR-ingenieur-interface (Interface Ingénieur vs Farm split)
**Auteur :** @tester

---

## Résumé

| Indicateur | Valeur |
|------------|--------|
| Nouveaux tests écrits | 122 |
| Nouveaux tests passants | 122 / 122 |
| Suite complète tests | 3294 passants / 1 échoué (pré-existant) |
| Build production | OK |

---

## Nouveaux fichiers de tests

### 1. `src/__tests__/middleware/proxy-redirect.test.ts` — 30 tests

Couvre la logique de redirection basée sur le rôle dans `src/proxy.ts`.

| Groupe | Tests | Résultat |
|--------|-------|---------|
| Routes publiques (/login, /register, /api/auth/) | 3 | PASS |
| Absence de session → redirect /login | 3 | PASS |
| Absence de session → 401 JSON pour /api/ | 3 | PASS |
| INGENIEUR — redirections | 5 | PASS |
| Non-INGENIEUR — blocage routes ingenieur-only | 10 | PASS |
| Routes API — exclues de la logique rôle | 3 | PASS |
| Route /backoffice — exclue de la logique rôle | 1 | PASS |
| Sous-chemins — logique de préfixe | 2 | PASS |

**Points clés validés :**
- INGENIEUR à `/` → redirect vers `/monitoring`
- INGENIEUR à `/monitoring`, `/mon-portefeuille` → passe (pas de boucle)
- PISCICULTEUR/ADMIN/GERANT à `/monitoring` → redirect vers `/`
- API routes jamais interceptées par la logique de rôle
- Sans cookie → redirect `/login` (pages) ou 401 JSON (API)
- `/backoffice` non soumis à la logique de rôle

### 2. `src/__tests__/ui/ingenieur-nav.test.ts` — 24 tests

Couvre la logique de navigation de l'espace ingénieur (sans DOM — tests purs).

| Groupe | Tests | Résultat |
|--------|-------|---------|
| Structure des 5 slots bottom nav | 7 | PASS |
| Filtrage par permission | 5 | PASS |
| Sheet items | 4 | PASS |
| Sidebar groupes | 8 | PASS |

**Points clés validés :**
- Bottom nav définie avec exactement 5 slots
- FAB (+Relevé) en position centrale (index 2)
- Tâches gate par `DASHBOARD_VOIR`, FAB par `RELEVES_CREER`, Clients par `MONITORING_CLIENTS`
- Accueil et Menu toujours visibles
- Groupe Monitoring gate par `MONITORING_CLIENTS`
- Groupe Stock gate par `STOCK_VOIR` + module `INTRANTS`

### 3. `src/__tests__/ui/farm-nav.test.ts` — 31 tests

Couvre la logique de navigation de l'espace farm (sans DOM — tests purs).

| Groupe | Tests | Résultat |
|--------|-------|---------|
| Structure des 5 slots bottom nav | 6 | PASS |
| Filtrage par permission | 5 | PASS |
| Sheet items | 4 | PASS |
| Sidebar groupes | 9 | PASS |
| Différence farm vs ingénieur | 3 | PASS |
| Cas limites (sans modules ni permissions) | 4 | PASS |

**Points clés validés :**
- Bottom nav a 5 slots : Accueil, Ma ferme, Finances, Messages, Menu
- Finances masqué sans `FINANCES_VOIR` ET sans module `VENTES`
- Groupe Finances sidebar gate par `FINANCES_VOIR` + `SiteModule.VENTES`
- La nav farm ne contient pas de groupe Monitoring (réservé ingénieur)
- La nav ingénieur n'a pas de slot Finances direct

### 4. `src/__tests__/route-boundaries.test.ts` — 37 tests

Vérifie les frontières de routes par inspection du filesystem.

| Groupe | Tests | Résultat |
|--------|-------|---------|
| Routes farm-exclusives dans (farm)/ | 6 | PASS |
| Routes farm-exclusives absentes de (ingenieur)/ | 6 | PASS |
| Routes ingénieur-exclusives dans (ingenieur)/ | 3 | PASS |
| Routes ingénieur-exclusives absentes de (farm)/ | 3 | PASS |
| Packs et activations dans (ingenieur)/ | 2 | PASS |
| Settings — sous-routes par espace | 7 | PASS |
| Route groups layout.tsx présent | 2 | PASS |
| Routes partagées dans (farm)/ | 6 | PASS |
| Cohérence middleware/FS | 2 | PASS |

**Points clés validés :**
- `/finances`, `/ventes`, `/factures`, `/clients`, `/mon-abonnement`, `/users` existent dans `(farm)/` et pas dans `(ingenieur)/`
- `/monitoring`, `/mon-portefeuille`, `/mes-taches` existent dans `(ingenieur)/` et pas dans `(farm)/`
- `(ingenieur)/settings/` contient `regles-activites/` et `config-elevage/`
- `(farm)/settings/` contient `alertes/` et `sites/`
- Pas de routes settings mal placées entre les deux espaces
- Les deux route groups ont leur `layout.tsx`

---

## Bogue pré-existant (non imputable au Sprint IE)

| Fichier | Test | Statut |
|---------|------|--------|
| `src/__tests__/api/vagues.test.ts` | PUT /api/vagues/[id] > ajoute des bacs a une vague | FAIL (pré-existant) |

Ce test échoue à cause d'un mock `updateVague` qui ne reçoit pas les paramètres attendus (`addBacIds`). Ce bug est antérieur au Sprint IE et ne fait pas partie du périmètre de ce sprint.

---

## Build production

```
✓ Compiled successfully in 12.9s
✓ Generating static pages using 11 workers (138/138)
```

Build entièrement propre, aucune erreur TypeScript ni de compilation.

---

## Couverture des règles R1-R9

| Règle | Vérification |
|-------|-------------|
| R1 — Enums MAJUSCULES | Tests utilisent `Permission.MONITORING_CLIENTS`, `SiteModule.VENTES` etc. |
| R2 — Importer les enums | `import { Permission, SiteModule } from "@/types"` partout |
| R9 — Tests avant review | `npx vitest run` + `npm run build` exécutés — OK |

---

## Décisions techniques

- **Tests nav sans DOM** : Les composants nav sont "use client" avec des hooks Next.js qui ne s'exécutent pas en Node. Les tests valident la logique de filtrage des items (fonctions pures) plutôt que le rendu DOM, évitant des mocks complexes de `usePathname`, `useRouter`, `useTranslations`.
- **Middleware mock fetch** : L'appel à `/api/abonnements/statut-middleware` dans le proxy est mocké pour retourner `{ ok: false }` (fail open), permettant de tester uniquement la logique de redirection par rôle.
- **Tests filesystem** : Les frontières de routes sont vérifiées directement via `existsSync`, ce qui est plus fiable et rapide que le parsing AST des pages Next.js.
