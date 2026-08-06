# Review — Story sélection explicite des produits ALIMENT à la création d'un scénario Prévisions (ADR-053 §18)

**Reviewer** : @code-reviewer
**Périmètre revu** : `getProduitsAlimentairesEligibles` et `validerProduitIdsEligibles` (`src/lib/queries/previsions-scenarios.ts`), la route GET dédiée, le schéma Zod (`previsions.schema.ts`), les DTOs (`src/components/previsions/api-types.ts`), le composant de formulaire (`scenario-form-dialog.tsx`), l'i18n fr/en, et 6 fichiers de tests.
**Méthode** : lecture directe de la query, de la route GET, du schéma Zod, des DTOs, du composant, de l'i18n fr/en et des 6 fichiers de tests. Le reviewer n'a pas pu exécuter vitest/tsc/build/git diff (pas d'outil shell) ; ces contrôles ont été refaits ensuite par @developer et sont conformes (voir section « Confirmations mécaniques » ci-dessous).

## Verdict : **VALIDÉ**

La réserve MINEURE K a été levée. Les remarques H et J restent non bloquantes, à traiter dans un futur sprint.

## A. Point unique de vérité — CONFORME

`evaluerEligibiliteProduitAlimentairePrevision` (`src/types/api.ts:825-838`) est l'unique définition (tailleGranule non nul + contenance strictement positive), utilisée par `getProduitsAlimentairesEligibles` (`previsions-scenarios.ts:156`), `validerProduitIdsEligibles` (`:386`) et les tests. Aucune réécriture à la main ailleurs. Le chemin de saisie manuelle (`poidsSacKg: z.number().positive()`, `previsions.schema.ts:195/226`) est aligné sur le seuil `contenance > 0`.

## B. Garde serveur en second rideau — CONFORME

`validerProduitIdsEligibles` (`:359-405`) rejette d'abord les ids hors appartenance (introuvable / hors site / hors catégorie / inactif), puis les ids trouvés mais non éligibles, en nommant produit + raison. Atteignable indépendamment de l'UI (couvert par les tests DB-gated « règle 3 »).

## C. Transaction unique — CONFORME

Validation en lecture seule **avant** `prisma.$transaction` (`:229-231`) ; toutes les écritures restent dans la même transaction. Aucun état intermédiaire créé-puis-copié.

## D. Compatibilité `produitIds` absent — CONFORME

`:465-468` : `produitIds === undefined ? produitsTries : produitsTries.filter(...)`. `undefined` et `[]` sont deux branches strictement distinctes — le piège central de la story (ERR-173 : absent / vide / rempli) est correctement évité. Prouvé par `previsions-scenarios.test.ts:397-418`.

## E. Cast `tailleGranule as TailleGranule` — CONFORME

Le garde `sansTailleGranule` (`:472-480`) précède toujours le cast (`:484`), position inchangée, commentaire justificatif (nominal typing Prisma/miroir).

## F. Produits invalides toujours visibles — CONFORME

Ni la route GET ni le composant ne les élimine ; commentaires explicites ERR-173/ERR-185 à `previsions-scenarios.ts:129-131`.

## G. `nombreCalibresAlimentsCrees` toujours présent — CONFORME

`number` non optionnel (`api-types.ts:99`), alimenté par `_count.aliments`, jamais `?? 0` : `0` explicite reste distinguable d'un champ non chargé.

## H. Emplacement de la fonction pure dans `src/types/api.ts` — REMARQUE

Précédent existant (`parsePaginationQuery`), aucun risque de bundling (fonction pure sans dépendance serveur, le client n'importe que le type et l'enum). Acceptable en l'état, **dette légère** : un fichier `types/` qui héberge des règles métier exécutables perd sa promesse et invite à la duplication. Migration suggérée vers `src/lib/previsions/eligibilite.ts` dans un futur sprint, pas dans cette story.

## I. i18n fr/en — CONFORME

Parité clé à clé (`scenarioForm.produits.*`, `raisons.*`, `calibresCreesZeroBanner`, `next`/`back`), accents corrects, aucun code d'enum brut affiché (test dédié vérifie que `TAILLE_GRANULE_MANQUANTE`/`CONTENANCE_MANQUANTE` ne fuient pas dans le DOM).

## J. Mobile-first / R5 / R6 / a11y — CONFORME, réserve mineure

Cartes empilées, pas de tableau ; `DialogTrigger asChild` (`:261`) ; toutes les couleurs mappées à des variables CSS du thème. MINEUR : `<input type="checkbox">` brut plutôt qu'une primitive Radix — pas de régression (aucun composant Checkbox Radix dans `src/components/ui/`), fonctionnellement accessible (`htmlFor`/`id`, `disabled` natif).

## K. Cohérence ADR — MINEUR, CORRIGÉ

La relation Prisma réelle est `aliments` (`prisma/schema.prisma:4394`), pas `alimentsPrevision`. Le code était correct ; le commentaire `api-types.ts:95` et l'ADR-053 (§18.5b l.4255, §18.6 l.4404-4406) recopiaient le mauvais nom. **Corrigé par @developer**, vérifié : plus aucune occurrence de `_count.alimentsPrevision` dans le dépôt.

## L. Qualité des tests — CONFORME

Falsification complète : 6 règles backend + 9 points UI, chaque mutation faisant tomber au moins un test ; masquer les produits invalides fait tomber 5 tests sur 9. Tests DB-gated conformes à ADR-052 §6 (`requireDatabaseUrl()`, `beforeAll` conservant l'erreur, `throw` bruyant si base injoignable — jamais de skip muet, cleanup en `finally`), entrée d'allowlist présente avec justification (`db-gated-allowlist.ts:97-107`). Preuve d'échec bruyant : avec `DATABASE_URL` pointant vers une base injoignable → **6 failed / 6 tests**, message `MESSAGE_DB_INJOIGNABLE`, `cause: ECONNREFUSED`.

## Confirmations mécaniques (refaites par @developer après la review)

- `npx tsc --noEmit` = 178, zéro en production ; `scripts/typecheck-budget.sh` : 178 == 178 ✅
- `npm run build` : OK
- `set -a && source .env && set +a && npx vitest run` : 346 fichiers / 9 803 tests / 26 todo / 0 skip / 0 échec
- `git diff --stat src/lib/previsions/` : **sortie vide** — le moteur de calcul n'a pas bougé
- Intégrité EXCEL-V12 avant/après identiques : 1 scénario / 19 VaguePrevue / 602 500 / 3 AlimentPrevision / 4 PalierRemise / ApportCapital 30 000 000 / JournalDepensePrevue 34 400 000 / 4 PosteReferentiel actifs / 4 PostePrevision / 0 MappingRapprochement

## Conclusion

**Verdict : VALIDÉ** (la réserve MINEURE K a été levée ; H et J restent des remarques non bloquantes pour un futur sprint).
