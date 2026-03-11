# Rapport de tests — CR-009 Dynamic Roles

**Date :** 2026-03-10
**Auteur :** @tester
**Sprint :** 7 (post-review, correction CR-009)

---

## Contexte

CR-009 a remplace le `Role` enum statique sur `SiteMember` par un modele `SiteRole` dynamique.
Les consequences majeures pour les tests :

- `SiteMember` n'a plus `role` ni `permissions` plats — il a `siteRoleId` (FK) et `siteRole` (objet imbrique)
- `DEFAULT_PERMISSIONS` et `CAN_GRANT_PERMISSIONS` supprimes — remplaces par `SYSTEM_ROLE_DEFINITIONS` et `canAssignRole()`
- `AuthContext` utilise `siteRoleId` et `siteRoleName` au lieu de `siteRole: Role`
- `PUT /api/auth/site` retourne `siteRole: { id, name, permissions }` (objet, pas string)
- `POST /api/sites` appelle `createSite(data, userId)` sans 3e argument permissions
- Route `PUT /api/sites/[id]/members/[userId]/permissions` supprimee
- Nouvelles routes CRUD : `GET/POST /api/sites/[id]/roles` et `GET/PUT/DELETE /api/sites/[id]/roles/[roleId]`

---

## Fichiers modifies

| Fichier | Action |
|---------|--------|
| `src/__tests__/permissions.test.ts` | Reecriture complete |
| `src/__tests__/api/sites.test.ts` | Reecriture complete + ~20 nouveaux tests roles |
| `src/__tests__/api/auth-protection.test.ts` | Verifie sans modification (inchange) |

---

## Resultats des tests

### Suite complete

```
Test Files : 20 passed (20)
Tests      : 437 passed (437)
Duree      : ~2.85s
```

### Detail par fichier cible

#### `src/__tests__/permissions.test.ts` — 48 tests passes

| Suite | Tests |
|-------|-------|
| SYSTEM_ROLE_DEFINITIONS | 11 |
| canAssignRole (anti-escalation) | 11 |
| PERMISSION_GROUPS | 8 |
| ForbiddenError | 5 |
| requirePermission | 13 |

**Points couverts :**
- `SYSTEM_ROLE_DEFINITIONS` contient 3 definitions (Administrateur, Gerant, Pisciculteur)
- Administrateur = 27 permissions (toutes)
- Gerant = 25 permissions (sans SITE_GERER ni MEMBRES_GERER)
- Pisciculteur = 6 permissions exactement
- `canAssignRole()` : sur-ensemble requis, cas limites (vide, egal, partiel)
- `PERMISSION_GROUPS` : 8 groupes, 27 permissions, zero doublon
- `ForbiddenError` : status 403, name, message, instanceof
- `requirePermission()` : bypass ADMIN global, siteRole imbrique, siteRoleId/siteRoleName dans AuthContext

#### `src/__tests__/api/sites.test.ts` — 57 tests passes

| Suite | Tests |
|-------|-------|
| GET /api/sites | 2 |
| POST /api/sites | 3 |
| GET /api/sites/[id] | 2 |
| PUT /api/sites/[id] | 3 |
| GET /api/sites/[id]/members | 1 |
| POST /api/sites/[id]/members | 6 |
| PUT /api/sites/[id]/members/[userId] | 7 |
| DELETE /api/sites/[id]/members/[userId] | 5 |
| PUT /api/auth/site | 4 |
| GET /api/sites/[id]/roles | 4 |
| POST /api/sites/[id]/roles | 5 |
| GET /api/sites/[id]/roles/[roleId] | 3 |
| PUT /api/sites/[id]/roles/[roleId] | 6 |
| DELETE /api/sites/[id]/roles/[roleId] | 5 |

**Points couverts :**
- `POST /api/sites` : `createSite(data, userId)` sans permissions (CR-009)
- `GET /api/sites/[id]` : reponse avec `siteRoleId`/`siteRoleName` au lieu de `role`
- `POST /api/sites/[id]/members` : body `siteRoleId`, getSiteRoleById, canAssignRole
- `PUT /api/sites/[id]/members/[userId]` : double anti-escalation (target actuel + nouveau role)
- `DELETE /api/sites/[id]/members/[userId]` : anti-escalation via siteRole.permissions
- `PUT /api/auth/site` : `siteRole` est un objet `{id, name, permissions}` pas un string
- Roles CRUD complet : liste, creation, detail, modification, suppression
- Roles systeme non-supprimables (409), non-renommables (400)
- Anti-escalation dans POST/PUT roles via canAssignRole
- Conflict sur nom duplique (P2002 → 409)

#### `src/__tests__/api/auth-protection.test.ts` — 12 tests passes (inchange)

Verifie que les routes /api/bacs, /api/vagues, /api/releves retournent 401 et 403 correctement.
Ce fichier ne depend pas des APIs CR-009 et n'a pas ete modifie.

---

## Probleme resolu pendant les tests

**Symptome :** Le test "retourne 404 si le role cible n'existe pas" dans `PUT /api/sites/[id]/members/[userId]`
retournait 403 au lieu de 404 lors de l'execution en sequence (mais passait en isolation).

**Cause racine :** `vi.clearAllMocks()` efface l'historique des appels mais pas les queues de
`mockReturnValueOnce` / `mockResolvedValueOnce`. Les valeurs residuelles de tests precedents contaminaient
l'etat du mock `mockCanAssignRole` (qui avait un `false` residuel dans sa queue).

**Correctif :** Utiliser `vi.resetAllMocks()` (au lieu de `vi.clearAllMocks()`) dans le `beforeEach` du
describe `PUT /api/sites/[id]/members/[userId]`. `resetAllMocks` efface a la fois l'historique ET les
implementations/queues, garantissant un etat propre entre chaque test.

---

## Build

```
npm run build : OK (0 erreurs TypeScript)
Seul avertissement : Next.js workspace root (non lie a CR-009)
```

---

## Regles R1-R9 verifiees

| Regle | Statut |
|-------|--------|
| R1 Enums MAJUSCULES | OK — Permission.SITE_GERER etc. |
| R2 Import enums | OK — `import { Permission } from "@/types"` |
| R3 Prisma=TypeScript | OK — siteRole imbrique conforme schema |
| R4 Ops atomiques | OK — updateMemberSiteRole |
| R5 DialogTrigger asChild | N/A (tests API/unitaires) |
| R6 CSS variables | N/A |
| R7 Nullabilite | OK — siteRole nullable gere |
| R8 siteId PARTOUT | OK — tous les roles queries incluent siteId |
| R9 Tests avant review | OK — 437/437 passes, build OK |
