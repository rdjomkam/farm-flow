# Review : CR-009 — Roles dynamiques par site

**Revieweur :** @code-reviewer
**Date :** 2026-03-10
**Perimetre :** Schema Prisma, migration, types TypeScript, logique permissions, queries, API routes, UI, tests
**Tests rapportes par @tester :** 437/437 passes, build OK
**Verdict : APPROUVE CONDITIONNEL** — 2 problemes importants, 4 mineurs, 3 suggestions

---

## Synthese

La transformation architecturale de CR-009 est solide. Le modele SiteRole remplace correctement l'enum
Role fixe sur SiteMember. La logique d'anti-escalation par sur-ensemble de permissions est correcte et
coherente entre le backend et le client. Tous les fichiers supprimes (permissions route, member-permissions-client)
ont ete retire. Les regles R1-R9 sont majoritairement respectees.

Deux problemes importants requierent correction avant passage en Sprint 9.

---

## Checklist R1-R9

| Regle | Statut | Remarque |
|-------|--------|---------|
| R1 Enums MAJUSCULES | OK | Toutes les valeurs Permission.* en UPPERCASE |
| R2 Import enums | OK | `import { Permission } from "@/types"` partout, aucune string litterale |
| R3 Prisma = TypeScript | OK | SiteRole, SiteMember alignes schema <-> interfaces |
| R4 Ops atomiques | OK | updateMemberSiteRole via updateMany, deleteSiteRole via $transaction |
| R5 DialogTrigger asChild | OK | Present dans member-actions-dialog.tsx et site-detail-client.tsx |
| R6 CSS variables | OK | Aucun code couleur hexa en dur dans les composants concernes |
| R7 Nullabilite | IMPORTANT | Voir item #1 — siteRoleId NOT NULL sans onDelete explicite |
| R8 siteId PARTOUT | OK | SiteRole a siteId FK. Tous les nouveaux modeles ont siteId |
| R9 Tests avant review | OK | 437/437 passes, build OK confirme par @tester |

---

## Problemes importants

### #1 — `onDelete` non explicite dans le schema Prisma

**Fichier :** `prisma/schema.prisma`
**Probleme :** La relation `SiteMember -> SiteRole` ne specifie pas `onDelete: Restrict`. La migration le definit en SQL, mais le schema Prisma reste muet. Une future migration auto-generee pourrait changer ce comportement.
**Correction :** Ajouter `onDelete: Restrict` explicitement.

### #2 — Nom de role en dur dans `deleteSiteRole()`

**Fichier :** `src/lib/queries/roles.ts` (ligne 60)
**Probleme :** `deleteSiteRole()` recherche le role Pisciculteur par nom en dur (`name: "Pisciculteur"`). Viole le principe CR-009 "le backend ne verifie jamais le nom d'un role". Si un admin renomme ce role systeme, la reassignation echouera.
**Correction :** Rechercher le role systeme avec le moins de permissions au lieu de chercher par nom.

---

## Problemes mineurs

### #3 — roles.ts non exporte depuis barrel

**Fichier :** `src/lib/queries/index.ts`
**Probleme :** Les fonctions de `roles.ts` ne sont pas re-exportees depuis le barrel, cassant la convention.

### #4 — Pages roles inutilement "use client"

**Fichiers :** `src/app/sites/[id]/roles/page.tsx`
**Probleme :** Page de lecture seule utilisant "use client" + useEffect au lieu de Server Component.

### #5 — Types `permissions: string[]` au lieu de `Permission[]`

**Fichiers :** `member-actions-dialog.tsx`, `site-detail-client.tsx`
**Probleme :** Double-cast Permission[] -> string[] -> Permission[] dans les props.

### #6 — Garde defensive manquante

**Fichiers :** Routes members manuelles
**Probleme :** Absence de `if (!callerMember.siteRole)` avant l'acces aux permissions.

---

## Suggestions

1. Documenter `Object.values(Permission)` dans `SYSTEM_ROLE_DEFINITIONS`
2. Valider chaque valeur du tableau `permissions` dans POST/PUT roles
3. Extraire `groupLabels`/`permissionLabels` dupliques entre `nouveau/page.tsx` et `[roleId]/page.tsx`

---

## Points positifs

- Architecture SiteRole solide avec `@@unique([siteId, name])` et `@@index([siteId])`
- Anti-escalation rigoureuse (double check dans PUT members, `canAssignRole()` pure et testee)
- Super-admin bypass sans appel DB
- Transactions atomiques dans createSite() et deleteSiteRole()
- Migration de donnees sequencee correctement
- 105 tests CR-009 couvrant nominaux et erreurs
- Nettoyage complet des fichiers/references obsoletes
- Mobile first (cartes empilees, `min-h-[44px]`, `max-w-lg`)
- R5 DialogTrigger asChild correctement applique

---

## Actions requises

| # | Severite | Fichier | Action |
|---|---------|---------|--------|
| 1 | Important | `prisma/schema.prisma` | Ajouter `onDelete: Restrict` sur SiteMember->SiteRole |
| 2 | Important | `src/lib/queries/roles.ts` | Ne pas rechercher le role de fallback par nom en dur |
| 3 | Mineur | `src/lib/queries/index.ts` | Ajouter les exports de roles.ts |
| 4 | Mineur | `src/app/sites/[id]/roles/page.tsx` | Convertir en Server Component |
| 5 | Mineur | `member-actions-dialog.tsx`, `site-detail-client.tsx` | Typer `permissions` en `Permission[]` |
| 6 | Mineur | Routes members manuelles | Ajouter guard `if (!callerMember.siteRole)` |
