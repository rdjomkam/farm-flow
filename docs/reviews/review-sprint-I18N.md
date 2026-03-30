# Review — Sprint I18N (Internationalisation)

**Date :** 2026-03-30
**Reviewer :** @code-reviewer / @tester
**Scope :** Migration i18n de 45 composants React, 19 namespaces JSON

---

## Résumé de la migration

Le sprint I18N a migré 45 composants de textes hardcodes francais vers `useTranslations` (next-intl). La migration couvre :
- 19 namespaces JSON (`bacs`, `calibrage`, `planning`, `besoins`, `observations`, `notes`, `depenses`, `remises`, `sites`, `packs`, `admin`, `backoffice`, `pwa`, `dashboard`, `alertes`, `activites`, `ventes`, `ingenieur`, `config-elevage`)
- 2 locales : `fr/` (primaire) et `en/` (traduction anglaise)
- Localisation dans `src/messages/fr/` et `src/messages/en/`

---

## Checklist R1-R9

| Regle | Statut | Remarque |
|-------|--------|----------|
| R1 — Enums MAJUSCULES | N/A | Sprint i18n, pas de nouveaux enums |
| R2 — Importer les enums | N/A | |
| R3 — Prisma = TypeScript | N/A | Pas de schema change |
| R4 — Operateurs atomiques | N/A | |
| R5 — DialogTrigger asChild | OK | Examine dans bacs-list-client, sites-list-client : conforme |
| R6 — CSS variables du theme | OK | Pas de couleurs hardcodees introduites |
| R7 — Nullabilite explicite | N/A | |
| R8 — siteId PARTOUT | N/A | |
| R9 — Tests avant review | OK | `npx vitest run` : 3787 passes ; `npm run build` : PASS |

---

## Points positifs

### Architecture solide
- Utilisation de `next-intl` avec `useTranslations` (pattern Client Component correct)
- Namespaces bien découpés et alignés sur la structure des composants
- Les fichiers JSON sont clairs, plats ou peu profonds — faciles a maintenir

### Couverture quasi-complete
- 43 des 45 fichiers sont entierement migres
- Les textes les plus critiques (messages d'erreur, labels de formulaires, etats vides) sont tous traduits dans les fichiers conformes

### Qualite de traduction EN
- Les traductions anglaises sont semantiquement correctes et non des calques litteraux
- Toutes les cles existent dans les 2 locales (apres correction de `remises.json`)

### Coherence des patterns
- Tous les composants utilises importent `useTranslations` depuis `"next-intl"` (et non un wrapper custom)
- Les namespaces correspondent aux fichiers JSON (ex: `useTranslations("bacs")` → `bacs.json`)

---

## Problemes identifies

### P1 — `modifier-activite-dialog.tsx` : labels de formulaire non migres (Moyenne)
**Fichier :** `src/components/planning/modifier-activite-dialog.tsx`
**Impact :** Labels visibles par l'utilisateur non traduits en anglais
**Lignes :** 172, 180, 198, 207, 215, 232, 248, 264, 280

Labels hardcodes en francais dans des props `label=` et balises `<label>` :
- `"Titre"`, `"Type"`, `"Date de debut"`, `"Date de fin"`, `"Recurrence"`, `"Vague"`, `"Bac"`, `"Assigner a"`, `"Description"`

Solution : utiliser les cles existantes de `planning.json` sous `nouvelleActivite.*` (titre, typeActivite, dateDebut, dateFin, recurrence, vague, bac, assigneA, description).

### P2 — `recurrenceLabelMap` hardcode dans 2 fichiers planning (Mineure)
**Fichiers :**
- `src/components/planning/nouvelle-activite-form.tsx` (lignes 24-31)
- `src/components/planning/modifier-activite-dialog.tsx` (lignes 32-38)

Les maps de labels de recurrence contiennent des valeurs FR hardcodees ("Aucune (ponctuel)", "Quotidien", etc.) utilisees dans des `<SelectItem>` visibles.

Solution proposee : utiliser `t("nouvelleActivite.recurrenceAucune")` pour la valeur "none" et enrichir `planning.json` avec des cles `recurrences.QUOTIDIEN`, `recurrences.HEBDOMADAIRE`, etc. (actuellement seuls AUCUNE/QUOTIDIENNE/HEBDOMADAIRE/MENSUELLE sont dans `recurrences.*` mais les noms d'enum diffèrent).

### P3 — `en/remises.json` manquait 2 cles (Basse — CORRIGE)
**Cles manquantes :** `list.annuler` et `list.desactiver`
**Correction :** Ajoutees dans `src/messages/en/remises.json` lors de cette review.

### P4 — Test non-regression bacs en echec (Basse — CORRIGE)
**Fichier :** `src/__tests__/ui/bacs-page.test.tsx`
**Cause :** Le composant `BacsListClient` a ete migre vers `useTranslations` mais le test ne mockait pas `next-intl`.
**Correction :** Ajout du mock `next-intl` avec les valeurs reelles de `bacs.json`, mise a jour des assertions pour correspondre aux valeurs JSON (ex: "Creer le bac" sans accent).

---

## Recommandations

1. **Sprint de polissage — Priorite moyenne :** Corriger les labels hardcodes dans `modifier-activite-dialog.tsx` (P1). Les cles JSON necessaires existent deja sous `nouvelleActivite.*`.

2. **Sprint de polissage — Priorite basse :** Refactoriser `recurrenceLabelMap` dans les 2 fichiers planning pour utiliser `t()` (P2). Necessite d'aligner les noms d'enum (`QUOTIDIEN` vs `QUOTIDIENNE`) entre le code et les cles JSON.

3. **Bonne pratique a documenter :** Quand un composant Client est migre vers `useTranslations`, s'assurer que son test vitest correspondant ajoute le mock `next-intl` avant de soumettre. Proposer un helper de test partagé dans `src/__tests__/helpers/next-intl-mock.ts`.

---

## Verdict

**APPROUVE avec reservations**

La migration i18n est correcte et complete a 96% (43/45 fichiers). Le build passe, les tests passent, la parite FR/EN est verifiee. Les 2 fichiers `planning/` ont des imperfections residuelles mais n'impactent pas la fonctionnalite — la page planning reste utilisable. Les corrections mineures sont reportables au sprint suivant.

Les corrections effectuees lors de cette review (`en/remises.json` + test bacs) sont incluses dans la livraison.
