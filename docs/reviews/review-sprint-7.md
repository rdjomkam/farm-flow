# Review Sprint 7 — Multi-tenancy

**Date :** 2026-03-09
**Reviewer :** @code-reviewer
**Sprint :** 7
**Verdict : VALIDE**

---

## Resume

Le Sprint 7 implemente l'architecture multi-tenancy avec isolation des donnees par site. L'approche row-level avec `siteId` sur chaque modele (R8) est correctement appliquee. Toutes les queries existantes (bacs, vagues, releves, indicateurs, dashboard) ont ete modifiees pour filtrer par `siteId`. Un systeme de permissions granulaires (25 permissions, 3 roles, anti-escalade) est en place. La migration est non-destructive (7 etapes). 278 tests passent avec 0 regression. Build OK.

---

## Fichiers revus (30+ fichiers)

### Schema et migration

| Fichier | Story |
|---------|-------|
| `prisma/schema.prisma` (modif) | 7.2 — Site, SiteMember, siteId sur Bac/Vague/Releve, Session.activeSiteId |
| `prisma/migrations/20260309092300_add_multi_tenancy/migration.sql` | 7.2 — Migration 7 etapes non-destructive |
| `prisma/seed.sql` (modif) | 7.9 — Sites, membres, donnees de test multi-site |

### Types TypeScript

| Fichier | Story |
|---------|-------|
| `src/types/models.ts` (modif) | 7.3 — Site, SiteMember, SiteMemberWithRelations, SiteWithMembers, siteId sur Bac/Vague/Releve |
| `src/types/auth.ts` (modif) | 7.3 — AuthContext, CreateSiteDTO, UpdateSiteDTO, SwitchSiteDTO, AddMemberDTO, UpdateMemberDTO |
| `src/types/index.ts` (modif) | 7.3 — Barrel exports pour nouveaux types |

### Permissions et auth

| Fichier | Story |
|---------|-------|
| `src/lib/permissions.ts` | 7.3 — requirePermission(), ForbiddenError, AuthContext |
| `src/lib/permissions-constants.ts` | 7.3 — DEFAULT_PERMISSIONS, CAN_GRANT_PERMISSIONS, PERMISSION_GROUPS |
| `src/lib/auth/session.ts` (modif) | 7.7 — activeSiteId dans getSession/requireAuth |
| `src/middleware.ts` (modif) | 7.7 — NO_SITE_ROUTES, NO_SITE_API_PREFIXES |

### Queries

| Fichier | Story |
|---------|-------|
| `src/lib/queries/sites.ts` | 7.4 — 9 fonctions : getUserSites, getSiteById, createSite, updateSite, addMember, removeMember, updateMemberRole, updateMemberPermissions, getSiteMember |
| `src/lib/queries/bacs.ts` (modif) | 7.4 — 6 fonctions, toutes avec siteId |
| `src/lib/queries/vagues.ts` (modif) | 7.4 — 5 fonctions, toutes avec siteId |
| `src/lib/queries/releves.ts` (modif) | 7.4 — 3 fonctions, toutes avec siteId |
| `src/lib/queries/indicateurs.ts` (modif) | 7.4 — getIndicateursVague(siteId, vagueId) |
| `src/lib/queries/dashboard.ts` (modif) | 7.4 — getDashboardData(siteId) |

### API routes — existantes modifiees

| Fichier | Story |
|---------|-------|
| `src/app/api/bacs/route.ts` (modif) | 7.6 — requirePermission(BACS_GERER) + auth.activeSiteId |
| `src/app/api/vagues/route.ts` (modif) | 7.6 — requirePermission(VAGUES_VOIR/VAGUES_CREER) |
| `src/app/api/vagues/[id]/route.ts` (modif) | 7.6 — requirePermission(VAGUES_VOIR/VAGUES_MODIFIER) |
| `src/app/api/releves/route.ts` (modif) | 7.6 — requirePermission(RELEVES_VOIR/RELEVES_CREER) |

### API routes — nouvelles

| Fichier | Story |
|---------|-------|
| `src/app/api/sites/route.ts` | 7.5 — GET (mes sites) + POST (creer un site) |
| `src/app/api/sites/[id]/route.ts` | 7.5 — GET (detail) + PUT (modifier, SITE_GERER) |
| `src/app/api/sites/[id]/members/route.ts` | 7.5 — GET (lister membres) + POST (ajouter, anti-escalade) |
| `src/app/api/sites/[id]/members/[userId]/route.ts` | 7.5 — PUT (changer role, anti-escalade) + DELETE (retirer) |
| `src/app/api/sites/[id]/members/[userId]/permissions/route.ts` | 7.5 — PUT (modifier permissions, CAN_GRANT_PERMISSIONS) |
| `src/app/api/auth/site/route.ts` | 7.5 — PUT (changer site actif) |

### Tests Sprint 7

| Fichier | Tests |
|---------|-------|
| `src/__tests__/permissions.test.ts` | 28 tests (DEFAULT_PERMISSIONS, CAN_GRANT_PERMISSIONS, PERMISSION_GROUPS, ForbiddenError, requirePermission) |
| `src/__tests__/api/sites.test.ts` | 35 tests (sites CRUD, membres, roles, permissions, anti-escalade, switch site) |

### Architecture

| Fichier | Story |
|---------|-------|
| `docs/decisions/004-multi-tenancy.md` | 7.1 — ADR complet (strategie, modeles, migration, permissions, anti-escalade) |

---

## Verification R8 : siteId PARTOUT

**Objectif principal du sprint. Resultat : CONFORME.**

### Schema Prisma

| Modele | siteId | FK | Index |
|--------|--------|-----|-------|
| Bac | `String NOT NULL` | `Site` | `@@index([siteId])` |
| Vague | `String NOT NULL` | `Site` | `@@index([siteId])` |
| Releve | `String NOT NULL` | `Site` | `@@index([siteId])` |
| Site | — (est la source) | — | — |
| SiteMember | `String NOT NULL` | `Site` (CASCADE) | `@@index([siteId])` |
| Session | `activeSiteId String?` | `Site` (SET NULL) | `@@index([activeSiteId])` |

### Queries — audit exhaustif

| Fichier | Fonction | siteId filtre | Verdict |
|---------|----------|---------------|---------|
| `bacs.ts` | `getBacs(siteId)` | `where: { siteId }` | OK |
| `bacs.ts` | `getBacById(id, siteId)` | `where: { id, siteId }` | OK |
| `bacs.ts` | `createBac(siteId, data)` | `data: { siteId }` | OK |
| `bacs.ts` | `getBacsLibres(siteId)` | `where: { siteId, vagueId: null }` | OK |
| `bacs.ts` | `assignerBac(bacId, vagueId, siteId)` | `where: { id, siteId, vagueId: null }` | OK |
| `bacs.ts` | `libererBac(bacId, siteId)` | `where: { id, siteId }` | OK |
| `vagues.ts` | `getVagues(siteId, filters?)` | `where: { siteId }` | OK |
| `vagues.ts` | `getVagueById(id, siteId)` | `where: { id, siteId }` | OK |
| `vagues.ts` | `createVague(siteId, data)` | Bacs: `where: { in, siteId }`, Vague: `data: { siteId }`, Assign: `where: { in, siteId }` | OK |
| `vagues.ts` | `cloturerVague(id, siteId)` | `where: { id, siteId }`, bacs: `where: { vagueId, siteId }` | OK |
| `vagues.ts` | `updateVague(id, siteId, data)` | `findFirst: { id, siteId }`, bacs: `where: { in, siteId }` | OK |
| `releves.ts` | `getReleves(siteId, filters)` | `where: { siteId }` | OK |
| `releves.ts` | `createReleve(siteId, data)` | Bac: `where: { id, siteId }`, Vague: `where: { id, siteId }`, Releve: `data: { siteId }` | OK |
| `releves.ts` | `getRelevesByType(siteId, vagueId, type)` | `where: { siteId, vagueId, typeReleve }` | OK |
| `indicateurs.ts` | `getIndicateursVague(siteId, vagueId)` | `where: { id, siteId }` | OK |
| `dashboard.ts` | `getDashboardData(siteId)` | 3 requetes paralleles, toutes `where: { siteId }` | OK |
| `sites.ts` | `getUserSites(userId)` | Via membership: `members: { some: { userId } }` | OK |
| `sites.ts` | `getSiteById(siteId, userId)` | `where: { id, members: { some: { userId } } }` | OK |
| `sites.ts` | `createSite(data, userId, perms)` | Transaction: create Site + SiteMember | OK |
| `sites.ts` | `updateSite(siteId, data)` | `where: { id: siteId }` | OK |
| `sites.ts` | `addMember(siteId, userId, ...)` | `data: { siteId }` | OK |
| `sites.ts` | `removeMember(siteId, userId)` | `where: { siteId, userId }` | OK |
| `sites.ts` | `updateMemberRole(siteId, userId, role)` | `where: { siteId, userId }` | OK |
| `sites.ts` | `updateMemberPermissions(siteId, userId, perms)` | `where: { siteId, userId }` | OK |
| `sites.ts` | `getSiteMember(siteId, userId)` | `where: { userId_siteId: { userId, siteId } }` | OK |

**25 fonctions verifiees. AUCUN oubli de filtre siteId.** L'isolation des donnees entre sites est garantie au niveau query.

---

## Verification des permissions

### requirePermission() — flow correct

```
1. requireAuth(request) → session (userId, role, activeSiteId)
2. Si activeSiteId null → ForbiddenError "Aucun site actif"
3. Si globalRole === ADMIN → bypass membership, retourne toutes les permissions
4. Charge SiteMember pour (activeSiteId, userId)
5. Si pas membre ou inactif → ForbiddenError "Pas membre"
6. Verifie chaque permission requise dans member.permissions
7. Retourne AuthContext complet
```

### DEFAULT_PERMISSIONS — correct

| Role | Nombre | Detail |
|------|--------|--------|
| ADMIN | 25 | Toutes les permissions |
| GERANT | 23 | Toutes sauf SITE_GERER et MEMBRES_GERER |
| PISCICULTEUR | 6 | VAGUES_VOIR, RELEVES_VOIR, RELEVES_CREER, BACS_GERER, DASHBOARD_VOIR, ALERTES_VOIR |

### Anti-escalade — correct

| Regle | Implementation | Fichier |
|-------|---------------|---------|
| GERANT ne peut pas ajouter un ADMIN | `callerRole !== Role.ADMIN && targetRole === Role.ADMIN` | `members/route.ts:96` |
| GERANT ne peut pas promouvoir en ADMIN | `newRole === Role.ADMIN && callerRole !== Role.ADMIN` | `members/[userId]/route.ts:63` |
| Seul ADMIN modifie un ADMIN | `targetMember.role === Role.ADMIN && callerRole !== Role.ADMIN` | `members/[userId]/route.ts:59` |
| Pas de self-modification role | `targetUserId === session.userId` → 403 | `members/[userId]/route.ts:67` |
| Pas de self-modification perms | `targetUserId === session.userId` → 403 | `permissions/route.ts:62` |
| CAN_GRANT_PERMISSIONS | ADMIN: tout, GERANT: perms PISCICULTEUR, PISCICULTEUR: rien | `permissions/route.ts:72` |

### Routes — mapping permissions correct

| Route | Methode | Permission |
|-------|---------|------------|
| `/api/bacs` | GET | BACS_GERER |
| `/api/bacs` | POST | BACS_GERER |
| `/api/vagues` | GET | VAGUES_VOIR |
| `/api/vagues` | POST | VAGUES_CREER |
| `/api/vagues/[id]` | GET | VAGUES_VOIR |
| `/api/vagues/[id]` | PUT | VAGUES_MODIFIER |
| `/api/releves` | GET | RELEVES_VOIR |
| `/api/releves` | POST | RELEVES_CREER |
| `/api/sites` | GET/POST | requireAuth (pas de permission specifique — correct) |
| `/api/sites/[id]` | GET | requireAuth + membership |
| `/api/sites/[id]` | PUT | requireAuth + SITE_GERER |
| `/api/sites/[id]/members` | GET | requireAuth + membership |
| `/api/sites/[id]/members` | POST | requireAuth + MEMBRES_GERER |
| `/api/sites/[id]/members/[userId]` | PUT | requireAuth + MEMBRES_GERER |
| `/api/sites/[id]/members/[userId]` | DELETE | requireAuth + MEMBRES_GERER |
| `/api/sites/[id]/members/[userId]/permissions` | PUT | requireAuth + MEMBRES_GERER + CAN_GRANT |
| `/api/auth/site` | PUT | requireAuth (site switch) |

---

## Migration

La migration `20260309092300_add_multi_tenancy` est en 7 etapes :

1. **Creer Site + SiteMember** — tables avec PK, FK, indexes
2. **Site par defaut** — `INSERT "default-site" / "Ferme principale"` + tous les users comme ADMIN avec 25 permissions
3. **Ajouter siteId nullable** — `ALTER TABLE ... ADD COLUMN "siteId" TEXT` sur Bac, Vague, Releve
4. **Migrer les donnees** — `UPDATE ... SET "siteId" = 'default-site' WHERE "siteId" IS NULL`
5. **Rendre NOT NULL** — `ALTER TABLE ... ALTER COLUMN "siteId" SET NOT NULL`
6. **Session.activeSiteId** — `ALTER TABLE "Session" ADD COLUMN "activeSiteId" TEXT`
7. **Index et FK** — siteId indexes sur Bac/Vague/Releve/Session, contraintes FK

**Verdict : Migration non-destructive, donnees existantes preservees, FK correctes (RESTRICT sur donnees, CASCADE sur SiteMember, SET NULL sur Session.activeSiteId).**

---

## Points positifs

1. **Isolation complete** — Chaque query filtre par siteId. Aucun oubli sur les 25 fonctions verifiees. Un utilisateur ne peut voir que les donnees de son site actif.

2. **Pattern uniforme** — Toutes les queries prennent `siteId` en premier parametre. Convention claire et facile a auditer pour les futurs sprints.

3. **Anti-escalade solide** — 6 regles implementees pour empecher l'escalade de privileges (GERANT → ADMIN, self-modification, CAN_GRANT_PERMISSIONS). Bien testees.

4. **Permissions granulaires** — 25 permissions en 8 groupes, avec defaults par role. Structure extensible pour les sprints 8-12. `PERMISSION_GROUPS` facilite l'affichage UI.

5. **ForbiddenError distinct d'AuthError** — 403 vs 401, gestion propre dans tous les catch blocks.

6. **Migration robuste** — 7 etapes non-destructives. Insertion du site par defaut avec `gen_random_uuid()`. Toutes les donnees existantes migrees vers "Ferme principale".

7. **requirePermission() bien concu** — Bypass ADMIN global (pas de requete SiteMember), verification membership + permissions en un seul appel, retourne AuthContext enrichi.

8. **Transactions dans createSite** — Site + SiteMember atomiques via `$transaction`. Le createur devient ADMIN avec toutes les permissions.

9. **Middleware adapte** — `NO_SITE_ROUTES` et `NO_SITE_API_PREFIXES` permettent l'acces a `/sites` et `/select-site` sans site actif. Commentaire expliquant pourquoi le middleware ne peut pas verifier activeSiteId (Edge runtime, pas de DB).

10. **PERMISSION_GROUPS couvre exactement 25 permissions sans doublon** — Verifie par test unitaire (`allGroupedPerms.length === ALL_PERMISSIONS.length`).

11. **ADR 004 complet et de qualite** — Justification du row-level vs schema-based, detail migration, flow requireAuth etendu, anti-escalade, impact sur les routes, wireframes mobile.

12. **Tests complets** — 28 tests permissions (unitaires) + 35 tests API sites (integration) couvrent tous les cas : succes, 400 validation, 401 auth, 403 permissions/anti-escalade, 404 introuvable, 409 conflit.

---

## Checklist R1-R9

| Regle | Statut | Detail |
|-------|--------|--------|
| R1 — Enums MAJUSCULES | OK | Role: ADMIN, GERANT, PISCICULTEUR. Permission: 25 valeurs UPPERCASE. |
| R2 — Import enums | OK | `import { Role, Permission } from "@/types"` dans toutes les routes et lib. `Permission.VAGUES_VOIR`, jamais de string en dur. |
| R3 — Prisma = TS | OK | Site, SiteMember alignes 1:1. siteId: String (Prisma) = string (TS). permissions: Permission[] (les deux). |
| R4 — Operations atomiques | OK | `updateMany` avec conditions dans bacs (assignerBac, libererBac), members (updateMemberRole, updateMemberPermissions, removeMember). `$transaction` dans createSite et createVague. |
| R5 — DialogTrigger asChild | N/A | Pas de Dialog dans Sprint 7. |
| R6 — CSS variables | N/A | Pas de nouveaux composants UI revus dans ce sprint (Story 7.8 UI non incluse dans les fichiers fournis). |
| R7 — Nullabilite explicite | OK | `activeSiteId String?` sur Session (nullable — pas encore selectionne). `siteId String NOT NULL` sur Bac/Vague/Releve. `address String?` sur Site. |
| R8 — siteId PARTOUT | **OK** | **Objectif principal du sprint. 25 fonctions auditees, toutes filtrent par siteId. Voir tableau d'audit ci-dessus.** |
| R9 — Tests avant review | OK | 278 tests passes, 0 echec. Build OK. |

---

## Securite — Checklist

| Critere | Statut | Detail |
|---------|--------|--------|
| Isolation des donnees | OK | Toutes les queries filtrent par siteId. Aucun acces cross-site possible. |
| Verification de membership | OK | `getSiteMember` verifie membership active avant toute operation sur un site. |
| Anti-escalade de privileges | OK | 6 regles implementees et testees. CAN_GRANT_PERMISSIONS bloque un GERANT de s'accorder SITE_GERER/MEMBRES_GERER. |
| Protection self-modification | OK | Impossible de modifier son propre role ou ses propres permissions. |
| ADMIN global bypass | OK | `session.role === Role.ADMIN` bypass la membership check avec toutes les permissions. Correct car ADMIN global = super-admin. |
| 401 vs 403 | OK | AuthError → 401, ForbiddenError → 403. Distinction propre dans tous les handlers. |
| Pas de fuite de donnees | OK | Les reponses API ne retournent que les champs necessaires (userId, name, email, phone, role, permissions). Pas de passwordHash. |
| Session.activeSiteId en DB | OK | Stocke cote serveur, pas manipulable par le client (ADR 004 Section 4). |
| updateMany atomique | OK | Site switch via `session.updateMany({ where: { sessionToken } })` — pas de race condition. |

---

## Problemes

### Mineur

#### M1 — AuthContext duplique entre permissions.ts et auth.ts

**Fichiers :** `src/lib/permissions.ts:17-26`, `src/types/auth.ts:42-55`
**Probleme :** L'interface `AuthContext` est definie deux fois : une dans `src/lib/permissions.ts` et une dans `src/types/auth.ts`. Les deux sont identiques mais c'est un risque de desynchronisation.
**Suggestion :** Supprimer la definition dans `permissions.ts` et importer depuis `@/types`. L'interface dans `auth.ts` est la source de verite du barrel export.

#### M2 — Cast `as Role` dans les routes membres

**Fichiers :** `src/app/api/sites/[id]/members/[userId]/route.ts:55,95`, `src/lib/permissions.ts:90-91`
**Probleme :** `callerMember.role as Role` et `member.role as Role` / `member.permissions as Permission[]`. Si Prisma genere correctement les types, ces casts sont inutiles et masquent un eventuel desalignement.
**Suggestion :** Verifier le type retourne par Prisma et supprimer les casts si possible. Reportable.

#### M3 — createSite utilise `"ADMIN" as Role` en dur

**Fichier :** `src/lib/queries/sites.ts:55`
**Probleme :** `role: "ADMIN" as Role` au lieu de `role: Role.ADMIN` (R2 — toujours importer les enums). Le `as Role` cast masque le fait que c'est un string literal.
**Suggestion :** Utiliser `Role.ADMIN` directement. Necessite `import { Role } from "@/types"` (deja present dans le fichier). Fix trivial.

---

### Suggestions

#### S1 — GERANT avec MEMBRES_GERER peut ajouter un GERANT

**Fichier :** `src/app/api/sites/[id]/members/route.ts:94-98`
**Detail :** L'anti-escalade empeche un GERANT d'ajouter un ADMIN, mais un GERANT avec MEMBRES_GERER peut ajouter un autre GERANT. C'est un choix de design acceptable, mais a valider avec le product owner. Un GERANT pourrait theoriquement ajouter un GERANT qui a plus de permissions que lui (puisque les permissions GERANT par defaut sont 23).
**Impact :** Faible. Les permissions sont initialisees au default du role (23 pour GERANT), donc le nouveau GERANT n'a pas plus que le role standard. Et CAN_GRANT_PERMISSIONS bloque la modification ulterieure des permissions au-dela de PISCICULTEUR.

#### S2 — updateSite ne verifie pas membership dans la query

**Fichier :** `src/lib/queries/sites.ts:65-73`
**Detail :** `updateSite` fait `where: { id: siteId }` sans verifier le siteId dans la query elle-meme. La verification se fait dans la route handler (`getSiteMember` + permission check). C'est correct architecturalement (separation responsabilites), mais un appel direct a `updateSite` sans verification prealable pourrait modifier un site arbitraire. Pattern acceptable pour l'usage actuel.

---

## Verdict : VALIDE

Le Sprint 7 (Multi-tenancy) est **valide**. L'objectif principal — **R8 : siteId PARTOUT** — est atteint :

- **25 fonctions de query** auditees, toutes filtrent par siteId
- **Aucun oubli** d'isolation de donnees
- **Permissions granulaires** (25 permissions, 3 roles) avec anti-escalade robuste
- **Migration non-destructive** en 7 etapes
- **278 tests**, 0 echec, build OK

Les items Mineur (M1-M3) et Suggestions (S1-S2) sont reportables aux sprints suivants sans impact sur la validation.

**Chiffres finaux :** 278 tests, 0 echec, build OK, 30+ fichiers revus.
