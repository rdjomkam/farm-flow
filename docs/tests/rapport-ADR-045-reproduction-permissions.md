# Rapport de Test — ADR-045 : Permissions Reproduction Granulaires

**Date :** 2026-04-07
**Testeur :** @tester
**Contexte :** Vérification post-implémentation ADR-045 — 9 nouvelles permissions reproduction, restructuration navigation, mise à jour des API routes.

---

## Résumé exécutif

| Etape | Résultat |
|-------|---------|
| `npm run build` | SUCCES — 0 erreur, compilation en 23.2s |
| `npx vitest run` (avant fix) | 5 echecs dans 4 fichiers sur 150 |
| `npx vitest run` (après fix) | 4904 passes, 0 echec, 150 fichiers |

---

## Build

```
✓ Compiled successfully in 23.2s
✓ Generating static pages using 11 workers (161/161) in 1122.5ms
```

Aucune erreur TypeScript. Toutes les routes reproduction sont présentes dans le build :
- `/reproduction`
- `/reproduction/geniteurs`
- `/reproduction/pontes`
- `/reproduction/lots`
- `/reproduction/incubations`
- `/reproduction/planning`

---

## Tests — Etat initial (avant corrections)

### Echec 1 — `permissions.test.ts` — Pisciculteur a exactement 8 permissions
- **Cause :** ADR-045 a ajouté 5 permissions de lecture reproduction au rôle Pisciculteur dans `SYSTEM_ROLE_DEFINITIONS` (ALEVINS_VOIR, GENITEURS_VOIR, PONTES_VOIR, LOTS_ALEVINS_VOIR, INCUBATIONS_VOIR). Le test attendait 8, la réalité est 13.
- **Nature :** Test périmé (test outdated) — le code de production est correct.
- **Fichier :** `src/__tests__/permissions.test.ts` ligne 187-188

### Echec 2 — `permissions.test.ts` — les 16 groupes attendus incluent 'alevins'
- **Cause :** ADR-045 a renommé le groupe `alevins` en `reproduction` dans `PERMISSION_GROUPS` de `src/lib/permissions-constants.ts`. Le test vérifie `toContain("alevins")` alors que la clé est maintenant `"reproduction"`.
- **Nature :** Test périmé — le code de production est correct.
- **Fichier :** `src/__tests__/permissions.test.ts` ligne 279

### Echec 3 — `reproduction-planning.test.ts` — appelle requirePermission avec ALEVINS_VOIR
- **Cause :** ADR-045 a mis à jour la route `/api/reproduction/planning` pour utiliser `Permission.PLANNING_REPRODUCTION_VOIR` à la place de `Permission.ALEVINS_VOIR`. Le test vérifiait l'ancienne permission.
- **Nature :** Test périmé — le code de production est correct.
- **Fichier :** `src/__tests__/api/reproduction-planning.test.ts` ligne 296-306

### Echec 4 — `sprint54-component-patterns.test.ts` — Fish est utilisé pour le nav item reproducteurs
- **Cause :** ADR-045 a changé le label de navigation du nav item avec l'icône Fish de `"reproducteurs"` à `"geniteurs"` dans `farm-sidebar.tsx`. Le test cherchait la chaîne `"reproducteurs"`.
- **Nature :** Test périmé — le code de production est correct.
- **Fichier :** `src/__tests__/ui/sprint54-component-patterns.test.ts` ligne 237-240

### Echec 5 — `auth/password.test.ts` — retourne false pour un mot de passe incorrect
- **Cause :** Echec intermittent en exécution parallèle (timeout bcrypt). Lorsque le fichier est exécuté seul, tous les 5 tests passent en 2.26s.
- **Nature :** Faux positif dû à la contention de ressources lors du run complet.
- **Fichier :** `src/__tests__/auth/password.test.ts`

---

## Corrections apportées

### Fichier 1 : `src/__tests__/permissions.test.ts`

1. Description du test Pisciculteur mise à jour : `"a exactement 8 permissions"` → `"a exactement 13 permissions (8 de base + 5 reproduction lecture ADR-045)"`
2. Valeur attendue `toHaveLength(8)` → `toHaveLength(13)`
3. Nouveau test ajouté : `"a les 5 permissions de reproduction en lecture seule (ADR-045)"` vérifiant ALEVINS_VOIR, GENITEURS_VOIR, PONTES_VOIR, LOTS_ALEVINS_VOIR, INCUBATIONS_VOIR
4. `expect(groupNames).toContain("alevins")` → `expect(groupNames).toContain("reproduction")`

### Fichier 2 : `src/__tests__/api/reproduction-planning.test.ts`

- Description et assertion de permission mises à jour : `Permission.ALEVINS_VOIR` → `Permission.PLANNING_REPRODUCTION_VOIR`

### Fichier 3 : `src/__tests__/ui/sprint54-component-patterns.test.ts`

- Description et assertion du nav item Fish mise à jour : `"reproducteurs"` → `"geniteurs"`

---

## Vérifications de cohérence ADR-045

### Permissions dans les API routes

Vérification que `ALEVINS_GERER`, `ALEVINS_MODIFIER`, `ALEVINS_CREER`, `ALEVINS_SUPPRIMER` ont été remplacés par les permissions granulaires dans les routes API :

| Fichier API | Permission après ADR-045 | Statut |
|-------------|--------------------------|--------|
| `api/reproduction/lots/route.ts` | `LOTS_ALEVINS_GERER` | CORRECT |
| `api/reproduction/lots/[id]/route.ts` | `LOTS_ALEVINS_GERER` | CORRECT |
| `api/reproduction/lots/[id]/sortie/route.ts` | `LOTS_ALEVINS_GERER` | CORRECT |
| `api/reproduction/lots/[id]/phase/route.ts` | `LOTS_ALEVINS_GERER` | CORRECT |
| `api/reproduction/lots/[id]/split/route.ts` | `LOTS_ALEVINS_GERER` | CORRECT |
| `api/reproduction/pontes/[id]/resultat/route.ts` | `PONTES_GERER` (commentaire doc ancien) | CORRECT (runtime) |
| `api/reproduction/pontes/[id]/stripping/route.ts` | `PONTES_GERER` (commentaire doc ancien) | CORRECT (runtime) |
| `api/reproduction/pontes/[id]/echec/route.ts` | `PONTES_GERER` (commentaire doc ancien) | CORRECT (runtime) |
| `api/lots-alevins/route.ts` | `LOTS_ALEVINS_GERER` | CORRECT |
| `api/lots-alevins/[id]/route.ts` | `LOTS_ALEVINS_GERER` | CORRECT |
| `api/lots-alevins/[id]/transferer/route.ts` | `LOTS_ALEVINS_GERER` | CORRECT |

Note : 3 fichiers de routes pontes contiennent encore `ALEVINS_MODIFIER` dans leur commentaire JSDoc mais pas dans le code runtime — c'est cosmétique uniquement, aucun impact fonctionnel.

### Navigation

| Composant | Groupe reproduction | Permissions par item | Statut |
|-----------|--------------------|--------------------|--------|
| `farm-sidebar.tsx` | Groupe `reproduction` avec 6 items | Gate : `Permission.ALEVINS_VOIR` | CORRECT |
| `farm-bottom-nav.tsx` | Sheet reproduction avec 5 items | GENITEURS_VOIR, PONTES_VOIR, LOTS_ALEVINS_VOIR, PLANNING_REPRODUCTION_VOIR | CORRECT |

### PERMISSION_GROUPS

Le groupe `alevins` a bien été renommé en `reproduction` et contient :
- Gate de module : `ALEVINS_VOIR`
- Géniteurs : `GENITEURS_VOIR`, `GENITEURS_GERER`
- Pontes : `PONTES_VOIR`, `PONTES_GERER`
- Lots Alevins : `LOTS_ALEVINS_VOIR`, `LOTS_ALEVINS_GERER`
- Incubations : `INCUBATIONS_VOIR`, `INCUBATIONS_GERER`
- Planning Reproduction : `PLANNING_REPRODUCTION_VOIR`
- Legacy (soft-deprecated) : `ALEVINS_GERER`, `ALEVINS_CREER`, `ALEVINS_MODIFIER`, `ALEVINS_SUPPRIMER`

### SYSTEM_ROLE_DEFINITIONS — Pisciculteur

Rôle Pisciculteur mis à jour avec 5 permissions de lecture reproduction :
- `ALEVINS_VOIR` (gate module)
- `GENITEURS_VOIR`
- `PONTES_VOIR`
- `LOTS_ALEVINS_VOIR`
- `INCUBATIONS_VOIR`

---

## Résultat final

```
Test Files  150 passed (150)
      Tests  4904 passed | 26 todo (4930)
   Duration  ~30s
```

**Conclusion : ADR-045 est correctement implémenté. Le build et tous les tests passent.**

Les 4 fichiers de tests modifiés reflètent désormais fidèlement les nouvelles permissions granulaires.

---

## Recommandation post-vérification

Les commentaires JSDoc dans 3 routes pontes (`resultat`, `stripping`, `echec`) mentionnent encore `ALEVINS_MODIFIER`. Il est recommandé de les mettre à jour pour référencer `PONTES_GERER`, mais il s'agit d'un point purement cosmétique sans impact fonctionnel (priorité basse).
