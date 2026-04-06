# Rapport QA — ADR-034 : Page /releves avec filtrage global

**Date :** 2026-04-06
**Testeur :** @tester
**Scope :** Verification de l'implementation ADR-034 (page /releves standalone + filtres)

---

## 1. Build check

**Commande :** `npm run build`
**Resultat :** PASS — Build compile sans erreur TypeScript ni erreur Next.js

Routes generees et presentes dans le build :
- `/releves` (page standalone)
- `/releves/nouveau` (redirection vers formulaire)

Aucune route residuelle dans `src/app/releves/` (repertoire supprime correctement).

---

## 2. Tests existants (regression)

**Commande :** `npx vitest run`
**Resultat :**
- 125 fichiers de test passes
- 4216 tests passes
- 9 fichiers en echec / 30 tests en echec

**Ces echecs sont tous pre-existants** et n'ont aucun lien avec ADR-034 :
- `abonnements-statut-middleware.test.ts` — mock `getSubscriptionStatusForSite` manquant
- `permissions.test.ts` — compte de permissions (47 attendus, compte different)
- `bacs.test.ts` / `quota-enforcement.test.ts` — code `NO_SUBSCRIPTION` vs `QUOTA_DEPASSE`
- `vagues.test.ts` / `vagues-distribution.test.ts` — mocks Prisma
- `check-subscription.test.ts` — comportement null
- `feed-analytics-fournisseurs.test.ts` — `calibrages` undefined sur mock
- `proxy-redirect.test.ts` — subscription API fetch echoue en contexte test

Aucune regression introduite par ADR-034.

---

## 3. Nouveaux tests ADR-034

**Fichier :** `src/__tests__/lib/releve-search-params.test.ts`
**Commande :** `npx vitest run src/__tests__/lib/releve-search-params.test.ts`
**Resultat :** 27/27 tests PASS

### Couverture

| Fonction | Cas testes |
|----------|------------|
| `parseReleveSearchParams` | Valeurs par defaut, chaque TypeReleve valide, typeReleve invalide, sentinelle ALL_VALUE, modifie true/false/autre, offset numerique, offset invalide/negatif, vagueId/bacId, chaines vides -> undefined, dateFrom/dateTo, limite RELEVES_PAGE_LIMIT |
| `countActiveFilters` | 0 filtres, chaque filtre individuel, sentinelle ALL_VALUE ignoree, modifie=false ignore, tous les 6 filtres simultanement |
| `formatDateChip` | Date standard, zero-padding jour et mois, date invalide -> chaine brute |

---

## 4. Verification structurelle des fichiers implementes

| Fichier | Statut |
|---------|--------|
| `src/app/(farm)/releves/page.tsx` | Present |
| `src/app/(farm)/releves/loading.tsx` | Present |
| `src/app/(farm)/releves/nouveau/page.tsx` | Present |
| `src/app/releves/` (ancien repertoire) | Supprime |
| `src/components/releves/releve-details.tsx` | Present — composant partage extrait |
| `src/components/releves/releves-filter-bar.tsx` | Present |
| `src/components/releves/releves-filter-sheet.tsx` | Present |
| `src/components/releves/releves-active-filters.tsx` | Present |
| `src/components/releves/releves-global-list.tsx` | Present |
| `src/components/releves/load-more-button.tsx` | Present |
| `src/components/releves/delete-releve-button-global.tsx` | Present |
| `src/lib/releve-search-params.ts` | Present |
| `src/app/api/releves/route.ts` | Param `modifie` present (ligne 61) |
| `src/app/api/bacs/route.ts` | Param `vagueId` present (lignes 21-36) |
| `src/messages/fr/releves.json` | Present (322 lignes) |
| `src/messages/en/releves.json` | Present (322 lignes) |

---

## 5. Fix applique par le testeur

**Probleme :** `src/components/vagues/releves-list.tsx` contenait encore un composant `ReleveDetails` local identique au composant partage extrait dans ADR-034.

**Fix :** Remplacement de la definition locale par un import depuis `@/components/releves/releve-details.tsx`. L'import `memo` (qui n'etait utilise que pour ReleveDetails) a ete retire des imports React.

**Impact :** Aucun changement fonctionnel — le composant partage est identique. Elimination de la duplication de code conformement a l'intention d'ADR-034.

---

## 6. Conclusion

| Critere R9 | Resultat |
|------------|----------|
| `npx vitest run` — pas de regression | PASS |
| `npm run build` — compile sans erreur | PASS |
| Nouveaux tests ecrits pour le code introduit | PASS (27 tests) |
| Ancien repertoire de route supprime | PASS |
| Composant partage correctement utilise | PASS (apres fix) |

**Verdict : PRET POUR REVIEW**
