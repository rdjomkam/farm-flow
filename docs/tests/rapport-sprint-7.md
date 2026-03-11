# Rapport de tests — Sprint 7 (Multi-tenancy)

**Date :** 2026-03-09
**Testeur :** @tester
**Vitest :** v4.0.18
**Resultat global :** 278 tests PASSES / 0 echec
**Build :** OK (Next.js 16.1.6 Turbopack)

---

## Synthese

| Categorie | Fichier | Tests | Statut |
|-----------|---------|-------|--------|
| Unit — Permissions | `permissions.test.ts` | 33 | PASS |
| API — Sites & Membres | `api/sites.test.ts` | 30 | PASS |
| API — Bacs (mis a jour) | `api/bacs.test.ts` | 13 | PASS |
| API — Vagues (mis a jour) | `api/vagues.test.ts` | 26 | PASS |
| API — Releves (mis a jour) | `api/releves.test.ts` | 31 | PASS |
| API — Auth Protection (mis a jour) | `api/auth-protection.test.ts` | 12 | PASS |
| Non-regression — Auth | `api/auth.test.ts` | 26 | PASS |
| Non-regression — Calculs | `calculs.test.ts` | 42 | PASS |
| Non-regression — Password | `auth/password.test.ts` | 5 | PASS |
| Non-regression — Session | `auth/session.test.ts` | 12 | PASS |
| Non-regression — UI Responsive | `ui/responsive.test.tsx` | 14 | PASS |
| Non-regression — UI Releves Form | `ui/releves-form.test.tsx` | 6 | PASS |
| Non-regression — UI Bacs Page | `ui/bacs-page.test.tsx` | 10 | PASS |
| Non-regression — UI Vagues Page | `ui/vagues-page.test.tsx` | 18 | PASS |
| **TOTAL** | **14 fichiers** | **278** | **PASS** |

---

## Nouveaux tests Sprint 7 (73 tests)

### 1. Tests unitaires — Permissions (33 tests)

Tests de `src/lib/permissions.ts` :

- **DEFAULT_PERMISSIONS** (7 tests)
  - ADMIN a 25 permissions (toutes)
  - GERANT a 23 permissions (sans SITE_GERER et MEMBRES_GERER)
  - PISCICULTEUR a 6 permissions de base
  - Chaque role contient ses permissions attendues

- **CAN_GRANT_PERMISSIONS** (5 tests)
  - ADMIN peut accorder toutes les permissions
  - GERANT ne peut accorder que les permissions PISCICULTEUR
  - PISCICULTEUR ne peut rien accorder (tableau vide)

- **PERMISSION_GROUPS** (6 tests)
  - 8 groupes definis
  - Chaque permission apparait dans exactement un groupe

- **ForbiddenError** (4 tests)
  - Status 403
  - Name "ForbiddenError"
  - Instanceof Error

- **requirePermission** (11 tests)
  - Retourne AuthContext avec activeSiteId, siteRole, permissions
  - Lance AuthError si pas de session
  - Lance ForbiddenError si pas la permission requise
  - Lance ForbiddenError si pas membre du site actif

### 2. Tests API — Sites & Membres (30 tests)

Tests de toutes les routes Sprint 7 :

- **GET /api/sites** (2 tests)
  - Retourne la liste des sites de l'utilisateur
  - 401 sans session

- **POST /api/sites** (2 tests)
  - Cree un site, le createur devient ADMIN
  - 400 si nom manquant

- **GET /api/sites/[id]** (2 tests)
  - Retourne le detail du site avec ses membres
  - 404 si site introuvable

- **PUT /api/sites/[id]** (3 tests)
  - Modifie le site avec permission SITE_GERER
  - 403 sans permission SITE_GERER
  - 403 si pas membre du site

- **POST /api/sites/[id]/members** (6 tests)
  - Ajoute un membre avec role et permissions par defaut
  - 403 si PISCICULTEUR tente de gerer les membres
  - 403 si GERANT tente d'ajouter un ADMIN (anti-escalade)
  - 404 si utilisateur inexistant
  - 409 si utilisateur deja membre
  - 400 si role invalide

- **PUT /api/sites/[id]/members/[userId]** (3 tests)
  - Change le role et reinitialise les permissions
  - 403 si modification de son propre role
  - 403 si GERANT tente de promouvoir a ADMIN (anti-escalade)

- **DELETE /api/sites/[id]/members/[userId]** (4 tests)
  - Retire un membre du site
  - 403 si tentative de se retirer soi-meme
  - 403 si GERANT tente de retirer un ADMIN
  - 404 si membre introuvable

- **PUT /api/sites/[id]/members/[userId]/permissions** (5 tests)
  - Modifie les permissions d'un membre
  - 403 si modification de ses propres permissions
  - 403 si GERANT tente d'accorder FINANCES_VOIR (anti-escalade)
  - 400 si permissions n'est pas un tableau
  - 400 si permission invalide

- **PUT /api/auth/site** (3 tests)
  - Change le site actif pour la session
  - 403 si pas membre du site cible
  - 400 si siteId manquant

---

## Tests mis a jour pour Sprint 7 (modifications)

### 3. API Bacs — Migration requirePermission (13 tests)

Mise a jour de tous les tests pour utiliser `requirePermission` au lieu de `requireAuth` :
- Mock `@/lib/permissions` avec `requirePermission` et `ForbiddenError`
- Mock `@/lib/auth` avec `AuthError` uniquement
- Ajout test "passe le siteId a getBacs"
- Verification que `createBac` recoit `siteId` en premier argument

### 4. API Vagues — Migration requirePermission (26 tests)

- Toutes les assertions de query verifient le siteId en premier argument
- Tests GET detail : `getVagueById(id, siteId)` et `getIndicateursVague(siteId, id)`
- Tests PUT : `updateVague(id, siteId, data)`
- Ajout test "passe le siteId a getVagues"

### 5. API Releves — Migration requirePermission (31 tests)

- Verification `getReleves(siteId, filters)` et `createReleve(siteId, data)`
- Messages d'erreur alignes avec le code source (sans accents)

### 6. API Auth Protection — Ajout tests 403 (12 tests, +6 nouveaux)

- 6 tests existants : 401 sans authentification (GET/POST bacs, vagues, releves)
- 6 tests nouveaux : 403 sans permission (GET/POST bacs, vagues, releves)
- Mock `requirePermission` pour lancer ForbiddenError

---

## Couverture des regles metier Sprint 7

| Regle | Testee | Fichier |
|-------|--------|---------|
| R8 — siteId PARTOUT | Oui | bacs, vagues, releves (siteId en premier arg) |
| requirePermission remplace requireAuth | Oui | tous les tests API |
| Anti-escalade role | Oui | sites.test.ts (GERANT ne peut pas ajouter ADMIN) |
| Anti-escalade permissions | Oui | sites.test.ts (GERANT ne peut pas accorder FINANCES_VOIR) |
| Interdiction auto-modification | Oui | sites.test.ts (propre role, propres permissions) |
| Isolation multi-tenant | Oui | siteId filtre dans toutes les queries |
| Changement site actif | Oui | auth/site (verification membership) |
| DEFAULT_PERMISSIONS par role | Oui | permissions.test.ts (ADMIN/GERANT/PISCICULTEUR) |
| CAN_GRANT_PERMISSIONS | Oui | permissions.test.ts + sites.test.ts |

---

## Non-regression

| Sprint | Tests | Statut |
|--------|-------|--------|
| Phase 1 (calculs, UI) | 90 | PASS |
| Sprint 6 (auth) | 43 | PASS |
| Sprint 7 (nouveau) | 73 | PASS |
| Sprint 7 (mis a jour) | 72 | PASS |
| **Total** | **278** | **PASS** |

---

## Problemes rencontres et solutions

### 1. vi.mock hoisting et TDZ (Temporal Dead Zone)
- **Probleme :** Les factories de `vi.mock()` sont hissees avant les declarations `const`, causant `ReferenceError: Cannot access before initialization`
- **Solution :** Utilisation de `vi.hoisted()` pour declarer les variables mock avant le hoisting
- **Fichier impacte :** `sites.test.ts`

### 2. Migration requireAuth → requirePermission
- **Probleme :** Les tests API existants echouaient car les routes utilisent maintenant `requirePermission` au lieu de `requireAuth`
- **Solution :** Remplacement du mock `@/lib/auth` par le mock `@/lib/permissions` avec `requirePermission` et `ForbiddenError`
- **Fichiers impactes :** `bacs.test.ts`, `vagues.test.ts`, `releves.test.ts`, `auth-protection.test.ts`

### 3. siteId en premier argument des queries
- **Probleme :** Toutes les fonctions de query prennent maintenant `siteId` en premier argument
- **Solution :** Mise a jour de toutes les assertions `toHaveBeenCalledWith` pour inclure `"site-1"` en premier

---

## Recommandations

1. **Tests d'isolation inter-sites** : Ajouter des tests d'integration avec base de donnees pour verifier que les donnees du site A ne sont jamais accessibles depuis le site B
2. **Tests middleware** : Le middleware de session/siteId n'a pas de tests unitaires dedies
3. **Tests UI sites** : Les pages UI de gestion des sites (site-selector, pages membres) n'ont pas encore de tests
