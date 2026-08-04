# Pré-analyse Story PR2bis.1 — Internationaliser le module Prévisions — 2026-08-03

## Statut : GO AVEC RÉSERVES

## Résumé
Le constat métier (Prévisions est français en dur, sans accents, seul module non internationalisé
du dépôt) est confirmé. L'obstacle technique invoqué en PR2.3/PR2.4 (36 namespaces figés) est réel
mais **très largement disproportionné** face au coût réel : ~3 lignes à modifier contre 150+ chaînes
à extraire. Le chiffre annoncé (« 4 fichiers sur 34 utilisent next-intl ») est **inexact** : 0 fichier
du module ne consomme next-intl pour son propre contenu — les 4 fichiers qui mentionnent next-intl
sont des tests qui le mockent de façon vestigiale/inutile. Baseline factuelle 100% conforme à
l'attendu (264 fichiers, 7000 tests, 0 échec ; recette 842/842 ; build OK ; `prisma validate` OK).

## Vérifications effectuées

### Inventaire du module Prévisions (fichiers UI porteurs de texte)
25 fichiers `.tsx` (hors tests) affichent du texte : 2 wrappers `page.tsx` (0 chaîne propre, Server
Components qui ne font que réexporter), et 23 fichiers de composants/pages qui portent le texte réel.
Chemins absolus (tous sous `/Users/ronald/project/dkfarm/farm-flow`) :

- `src/app/(farm)/previsions/scenarios/page.tsx`, `src/app/(farm)/previsions/scenarios/[id]/page.tsx`
- `src/components/pages/previsions-scenarios-page.tsx`, `src/components/pages/previsions-scenario-detail-page.tsx`
- `src/components/previsions/{aliment-form-dialog,aliments-tab,apport-form-dialog,apports-tab,charges-tab,journal-form-dialog,journal-tab,parametres-tab,plan-vagues-tab,poste-form-dialog,previsions-mensuelles-tab,rattacher-vague-dialog,repartition-mois-dialog,scenario-detail-client,scenario-form-dialog,scenarios-list-client,scission-dialog,tableau-bord-tab,tresorerie-chart,vague-prevue-form-dialog,valeur-calculee}.tsx`

**Aucun de ces 25 fichiers n'importe `next-intl`** (`useTranslations`/`getTranslations`) — vérifié par
grep exhaustif, 0 résultat. Comptage heuristique des chaînes JSX visibles en dur (regex sur littéraux
`"Xxx ..."` capitalisés d'au moins 4 caractères, sous-estime les libellés courts, placeholders et
messages construits par template literal) : **159 occurrences détectées**, concentrées sur
`parametres-tab.tsx` (20), `scenario-form-dialog.tsx` (20), `tableau-bord-tab.tsx` (20),
`journal-form-dialog.tsx` (12), `previsions-mensuelles-tab.tsx` (10). Cohérent avec le chiffre
« 150+ chaînes » déjà avancé par les deux reviewers dans `docs/sprints/SPRINT-PR2-PREVISIONS.md`
(ligne 382) — c'est un plancher, pas un plafond (aria-label, placeholders, toasts non comptés).

**Le chiffre « 4 fichiers sur 34 utilisent next-intl » (repris de
`docs/sprints/SPRINT-PR2-bis-PREVISIONS.md` ligne 39) est inexact.** Les 4 seuls fichiers du module
qui mentionnent `next-intl` sont des **tests** qui le mockent :
`src/components/previsions/__tests__/{rattacher-vague-dialog,permissions-gating,scission-dialog,scenario-form-dialog}.test.tsx`
(`vi.mock("next-intl", () => ({ useTranslations: () => (key) => key }))`). Vérification faite : les
composants testés (`rattacher-vague-dialog.tsx`, `scission-dialog.tsx`, `scenario-form-dialog.tsx`,
et le composant gaté par `permissions-gating.test.tsx`) n'importent **pas** `next-intl` — le mock est
vestigial, probablement copié-collé d'un autre module de test sans effet réel. **Le compte réel est
donc 0 fichier sur ~25 qui internationalise son propre contenu**, pas 4 sur 34.

### Obstacle technique réel — confirmé mais très surestimé

1. `src/messages/index.ts` exporte `namespaces` : un tableau **littéral** de 36 chaînes (ligne 11).
   Ajouter `"previsions"` en fait un tableau de 37 — **1 ligne**.
2. `src/__tests__/integration/i18n-completeness.test.ts` ligne 210 :
   `expect(namespaces).toHaveLength(36)` — assertion littérale. **1 ligne à changer en 37.**
3. Le même fichier ligne 238 (`chaque namespace enregistre correspond a un fichier JSON charge`)
   itère sur `namespaces` (donc sur les 37) et exige que `namespaceFiles[ns]` existe avec `.fr`/`.en`
   définis. **Obligatoire** : ajouter les imports `frPrevisions`/`enPrevisions` (2 lignes, comme les
   35 autres) et l'entrée `previsions: { fr: ..., en: ... }` dans la map `namespaceFiles` (1 ligne).
   Sans ça, le test échoue immédiatement dès l'ajout du namespace au registre.
4. **Obstacle réel non anticipé par PR2.3/PR2.4, plus dangereux que le premier** :
   `src/i18n/request.ts` ligne 43 (`loadMessages`) porte **une troisième liste de namespaces,
   dupliquée et déjà désynchronisée** de `src/messages/index.ts` (elle contient `blockedResource`,
   `maintenance`, `unites-production`, absents de `namespaces`, et rien ne les rapproche par un test —
   aucun test du dépôt ne compare les deux listes). C'est le point de chargement réel des messages
   au runtime (`getRequestConfig`) : si `"previsions"` est ajouté à `src/messages/index.ts` mais
   **oublié** dans ce tableau-ci, `useTranslations("previsions")` échouera silencieusement au rendu
   (namespace absent de `messages`, comportement dépendant de la config next-intl : fallback ou
   `MISSING_MESSAGE`) — **sans qu'aucun test ne le détecte**, car `loadMessages()` n'est couvert par
   aucun test du dépôt. C'est le vrai risque de régression silencieuse de cette story, plus sérieux
   que l'assertion `toHaveLength(36)`.

**Conclusion sur l'obstacle** : réel (3 points de registre distincts, 1 non testé et déjà en dérive),
mais strictement d'ordre configuration — aucun obstacle architectural (pas de problème Server/Client
Component, pas de chargement sélectif par route qui interdirait un namespace supplémentaire). Le
contournement en dur pour 30 fichiers était disproportionné, comme déjà écrit par les deux reviewers
dans `SPRINT-PR2-PREVISIONS.md`.

### Test de complétude fr/en — comportement exact

`src/__tests__/integration/i18n-completeness.test.ts` compare bien les clés **récursivement, par
égalité stricte** (`extractKeys` aplati en notation pointée, `expect(enKeys).toEqual(frKeys)`), mais
**ce test ne couvrira PAS automatiquement le nouveau namespace `previsions`** pour la parité stricte
fr/en : les blocs `describe` de parité (lignes 252-332) et d'interpolation (338-542) itèrent sur une
**liste figée de 15 noms** (`common, format, navigation, permissions, abonnements, settings,
analytics, vagues, releves, stock, ventes, alevins, users, commissions, errors`) — pas sur
`namespaces` en entier. Ce défaut est **préexistant** : les 21 namespaces déjà ajoutés après le
sprint 42 (`admin`, `alertes`, `bacs`, `dashboard`, `sites`, etc.) ne bénéficient déjà d'aucune
parité stricte automatique dans ce fichier — seul le bloc « couverture globale » (lignes 701-731,
qui boucle sur `namespaces` en entier) vérifie non-vide / ≥5 clés / total ≥2500, sans comparer fr à
en clé par clé. **Conséquence pour la story** : ajouter `previsions` au registre suffit pour les
checks génériques, mais pour obtenir une vraie garantie de parité stricte fr/en sur le nouveau
namespace, il faut soit l'ajouter aux 3 listes figées de la section 2, soit (mieux, hors périmètre de
cette story mais à signaler) refactorer ces `describe` pour boucler sur `namespaces` au lieu d'une
liste recopiée à la main — la même dette structurelle qui explique pourquoi 21 namespaces existants
ne sont déjà pas couverts.

### Patron de référence à appliquer (module `vagues`)

- Route `src/app/(farm)/vagues/page.tsx` : simple `export { default } from "@/components/pages/vagues-page"`.
- `src/components/pages/vagues-page.tsx` (Server Component) : `import { getTranslations } from "next-intl/server"`,
  puis `await getTranslations("vagues")`, résultat passé en props aux Client Components enfants (pas
  de re-fetch de traductions côté client pour du texte déjà résolu côté serveur).
- Composants Client (`src/components/vagues/vague-card.tsx` et similaires) : `"use client"` +
  `import { useTranslations, useLocale } from "next-intl"` + `const t = useTranslations("vagues")`.
  Un composant peut consommer **plusieurs namespaces** simultanément (`vague-card.tsx` utilise à la
  fois `useTranslations("vagues")` et `useTranslations("dashboard.hero")`).
- Interpolation : `{count}`, `{code}`, `{poids}` etc. dans les JSON, cf. `vagues.card.bac`,
  `vagues.detail.alevins`, `vagues.form.close.title` — vérifié par des tests dédiés dans
  `i18n-completeness.test.ts`.
- Enums traduits via des objets de mapping `Record<Enum, string>` où la valeur est une **clé i18n**,
  pas le texte — résolue ensuite par `t(cléConstruite)`, cf. `statutVariants` dans `vague-card.tsx`
  (ici pour un variant Badge, mais le même principe s'applique à un enum → clé i18n comme
  `getModuleNavKey` dans `plan-form-dialog.tsx`, sujet justement à ERR-134).

Le patron à appliquer pour Prévisions : créer `src/messages/fr/previsions.json` et
`src/messages/en/previsions.json`, les enregistrer aux 3 points de registre ci-dessus (`messages/index.ts`,
`i18n/request.ts`, `i18n-completeness.test.ts`), puis convertir chacun des 23 fichiers de composants
avec `useTranslations("previsions")` (Client) ou `getTranslations("previsions")` (les 2 `page.tsx`
sont déjà de purs réexports Server, aucun changement nécessaire dessus au-delà de vérifier
qu'aucune chaîne ne s'y cache — vérifié : 0 chaîne).

### Dette annexe — `getModuleNavKey()` / `adminCommissions` / `adminRemises`

**Vérifié : c'est corrigé, contrairement à ce que dit encore `ERR-134` dans
`docs/knowledge/ERRORS-AND-FIXES.md`.** Les clés `modules.adminCommissions` et `modules.adminRemises`
existent bien dans `src/messages/fr/navigation.json` et `src/messages/en/navigation.json` (section
`modules`), avec des valeurs distinctes en fr/en (« Gestion des commissions » / « Commission
management », « Gestion des remises » / « Discount management ») — confirmé par lecture directe des
deux fichiers. La note de clôture PR2.5 (« traitée en best-effort ») et la review PR2 (réserve 5,
« traitée ») sont donc **exactes**. **Mais `ERR-134` (ligne 678-708 de
`docs/knowledge/ERRORS-AND-FIXES.md`) décrit toujours ce bug comme non corrigé (« Fix : Aucun — hors
périmètre... »)** — entrée à faire corriger par le `@knowledge-keeper` : elle documente un état
antérieur à PR2.5, aujourd'hui faux.

### Risques de régression — tests qui casseront

Recherche exhaustive de `getByText`/`getByRole(..., { name })`/`toHaveTextContent` avec du texte
français en dur dans `src/components/previsions/__tests__/` : **8 fichiers sur 11** contiennent au
moins une assertion sur une chaîne française littérale qui deviendra une clé i18n :

- `src/components/previsions/__tests__/valeur-calculee.test.tsx` — "Coefficient standard", "Poids par sac", "Voir le detail du calcul" (x6), "Expliquer le cout aliment total de V1"
- `src/components/previsions/__tests__/aliments-tab.test.tsx` — "Mois 1", "Mois 2", `Expliquer la repartition mensuelle de ${...}` (x2)
- `src/components/previsions/__tests__/scission-dialog.test.tsx` — "Scinder V7", "Confirmer la scission" (x8), "Ajouter une vague fille" (x2), "Annuler"
- `src/components/previsions/__tests__/charges-tab.test.tsx` — "Expliquer le total du mois" (x2)
- `src/components/previsions/__tests__/permissions-gating.test.tsx` — "Rattacher une vague reelle", "Scinder", "Annuler", "Ajouter", "Enregistrer", "Ajouter un poste|Nouveau poste" (nombreuses occurrences)
- `src/components/previsions/__tests__/rattacher-vague-dialog.test.tsx` — "Rattacher une vague reelle" (x3), "Rattacher" (x7), "Conflit générique.", "Autre conflit.", "Permission refusee.", "Erreur interne."
- `src/components/previsions/__tests__/scenario-form-dialog.test.tsx` — "/nouveau scenario/i"
- `src/components/previsions/__tests__/erreur-projection-fallback.test.tsx` — "Calcul de la projection indisponible" (x2), "Aucune donnee sur ce scenario...", "Hors horizon du plan...", "Aucune donnee a afficher pour ce scenario."

Seuls 3 fichiers de test sur 11 (`parametres-tab.test.tsx`, `journal-form-dialog`/`journal-tab` — pas
de fichier de test dédié trouvé, `poste-form-dialog`/`vague-prevue-form-dialog`/`apport-form-dialog`
— pas de fichier de test dédié) ne présentent pas ce risque, faute de test dédié existant. C'est le
**principal coût caché** de cette story : chaque conversion de chaîne en dur en clé i18n doit
s'accompagner de la mise à jour de l'assertion de test correspondante (remplacer la chaîne littérale
par le mock `next-intl` habituel — `useTranslations: () => (key) => key` — et asserter sur la clé,
pas sur le texte), sous peine de casser 8 fichiers de tests existants.

### Build : OK
`npm run build` (prisma generate + migrate deploy + `next build --webpack`) : succès, aucune erreur,
routes `/previsions/scenarios` et `/previsions/scenarios/[id]` bien buildées en dynamique (ƒ).

### Tests : 7000/7000 passent (264 fichiers, 19 skip, 26 todo)
`npx vitest run` : **260 fichiers passés + 4 skip = 264**, **7000 tests passés + 19 skip + 26 todo =
7045** — conforme exactement à la baseline annoncée. Recette moteur
`npx vitest run src/lib/previsions/__tests__/recette` : **842/842**, conforme. `npx prisma validate` :
schéma valide.

## Incohérences trouvées
1. Chiffre erroné propagé de PR2.3 → PR2.4 → sprint PR2bis (« 4 fichiers sur 34 utilisent next-intl ») —
   le compte réel est 0/25 (les 4 fichiers cités sont des tests qui mockent `next-intl` sans que le
   composant testé l'importe). Sans conséquence sur le travail à faire (30 fichiers restent à
   internationaliser dans les deux cas), mais fausse la mesure de départ — à corriger dans le
   compte-rendu final de la story plutôt que de le recopier tel quel.
2. `docs/knowledge/ERRORS-AND-FIXES.md`, ERR-134 : décrit `modules.adminCommissions`/`adminRemises`
   comme non corrigées alors qu'elles le sont depuis PR2.5 — entrée à mettre à jour par le
   `@knowledge-keeper`.
3. `src/i18n/request.ts` (`loadMessages`, ligne 43) porte une liste de namespaces dupliquée et déjà
   désynchronisée de `src/messages/index.ts` (`namespaces`) — 3 entrées présentes dans l'un et pas
   l'autre (`blockedResource`, `maintenance`, `unites-production`), sans aucun test qui les
   rapproche. Risque direct pour cette story si `"previsions"` est ajouté à un registre et oublié
   dans l'autre — signalé aussi comme dette structurelle à consigner par le `@knowledge-keeper`
   (indépendamment de la story courante).
4. Les blocs de parité stricte fr/en de `i18n-completeness.test.ts` (describe blocks lignes 252 et
   294) itèrent sur une liste figée de 15 namespaces, pas sur `namespaces` entier — 21 namespaces
   existants (et `previsions` après cette story, sauf ajout manuel) échappent à la vérification
   stricte automatique de parité de clés. Dette structurelle préexistante, hors périmètre strict de
   cette story mais aggravée par chaque nouveau namespace qui ne l'intègre pas.

## Risques identifiés
1. **Oubli du registre `src/i18n/request.ts`** (risque le plus concret) : composant qui appelle
   `useTranslations("previsions")` sans que `"previsions"` figure dans `loadMessages()` → namespace
   vide au runtime, aucun test ne le détecte, régression uniquement visible manuellement en dev/prod.
   Mitigation : ajouter un test explicite qui compare `namespaces` (de `messages/index.ts`) au
   tableau de `loadMessages` (extraction par regex ou export du tableau), ou fusionner les deux
   sources en une seule constante partagée — recommandé mais optionnel pour cette story si le temps
   presse ; au minimum, checklist manuelle explicite dans la story.
2. **8 fichiers de tests component à mettre à jour en parallèle de l'extraction**, sous peine de
   fausses régressions qui masqueraient un vrai problème derrière un bruit de 30+ assertions
   cassées. Mitigation : traiter test et composant dans le même commit logique, fichier par fichier.
3. **Volume (23 fichiers, ~160+ chaînes minimum)** en une seule story : risque d'erreur de copier-
   coller (accents, majuscules de début de phrase) et de namespace mal choisi (clé qui devrait être
   dans `common` plutôt que dupliquée dans `previsions`, ex. "Annuler"/"Enregistrer" génériques déjà
   probablement présents dans `common.json` — à vérifier avant de dupliquer).
4. **Accents corrects** : le texte actuel est sans accents (ASCII pur) — la conversion en clé i18n
   est l'occasion de corriger l'orthographe en même temps que d'extraire, double changement dans le
   même diff (texte + mécanisme) — augmente la surface de revue mais c'est explicitement demandé par
   la story (« accents français corrects »).

## Prérequis manquants
Aucun bloquant. Recommandé mais non bloquant : ajouter, dans la story ou en tâche de suivi immédiate,
un test de cohérence entre `src/messages/index.ts` (`namespaces`) et `src/i18n/request.ts`
(`loadMessages`) pour fermer le risque #1 ci-dessus avant qu'il ne se matérialise silencieusement.

## Proposition de découpage (si 23 fichiers en une passe est jugé trop risqué)

Ordre suggéré, avec `npm run build` + `npx vitest run src/components/previsions` +
`npx vitest run src/__tests__/integration/i18n-completeness.test.ts` entre chaque lot :

1. **Lot 0 — Fondations** : créer `src/messages/{fr,en}/previsions.json` (structure de clés vide/
   minimale), enregistrer `"previsions"` dans les 3 registres (`messages/index.ts`,
   `i18n/request.ts`, `i18n-completeness.test.ts` — au minimum la `toHaveLength(37)` et la map
   `namespaceFiles`). Build + tests verts avant de toucher un seul composant.
2. **Lot 1 — Pages liste/détail + navigation interne** : `previsions-scenarios-page.tsx`,
   `previsions-scenario-detail-page.tsx`, `scenarios-list-client.tsx`, `scenario-detail-client.tsx`,
   `scenario-form-dialog.tsx` (+ mise à jour de son test).
3. **Lot 2 — Paramètres et aliments** : `parametres-tab.tsx`, `aliments-tab.tsx`,
   `aliment-form-dialog.tsx`, `repartition-mois-dialog.tsx` (+ tests `aliments-tab.test.tsx`,
   `parametres-tab.test.tsx`).
4. **Lot 3 — Plan des vagues et scission/rattachement** : `plan-vagues-tab.tsx`,
   `vague-prevue-form-dialog.tsx`, `rattacher-vague-dialog.tsx`, `scission-dialog.tsx` (+ tests
   `rattacher-vague-dialog.test.tsx`, `scission-dialog.test.tsx`, `permissions-gating.test.tsx`).
5. **Lot 4 — Charges, journal, apports** : `charges-tab.tsx`, `poste-form-dialog.tsx`,
   `journal-tab.tsx`, `journal-form-dialog.tsx`, `apports-tab.tsx`, `apport-form-dialog.tsx` (+ test
   `charges-tab.test.tsx`).
6. **Lot 5 — Tableau de bord et trésorerie** : `tableau-bord-tab.tsx`, `tresorerie-chart.tsx`,
   `previsions-mensuelles-tab.tsx`, `valeur-calculee.tsx` (+ tests
   `erreur-projection-fallback.test.tsx`, `previsions-mensuelles-tab.test.tsx`,
   `tresorerie-chart.test.tsx`, `valeur-calculee.test.tsx`).

## Recommandation
**GO**, avec les réserves suivantes à intégrer explicitement dans la story avant de la clore :
1. Ajouter un test (même minimal) qui empêche `src/messages/index.ts` et `src/i18n/request.ts` de se
   désynchroniser à nouveau (risque #1 ci-dessus) — la story ne doit pas se contenter d'ajouter
   `"previsions"` aux deux endroits à la main sans filet.
2. Mettre à jour les 8 fichiers de tests component identifiés en même temps que les composants
   qu'ils couvrent, pas après coup.
3. Signaler au `@knowledge-keeper` la correction d'`ERR-134` (déjà résolu, entrée obsolète) et la
   désynchronisation `messages/index.ts` / `i18n/request.ts` (dette structurelle indépendante de
   cette story, à consigner séparément).
4. Corriger, dans le compte-rendu de clôture de la story, le chiffre « 4 fichiers sur 34 utilisent
   next-intl » en « 0 fichier sur 25 » pour ne pas propager une mesure erronée une troisième fois.
