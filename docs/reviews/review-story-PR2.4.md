# Review Story PR2.4 — Module Prévisions (Vue Prévisions mensuelle et tableau de bord)

**Reviewer :** @code-reviewer
**Sprint :** PR2
**Story :** PR2.4 — Vue Prévisions mensuelle et tableau de bord
**Verdict global : VALIDÉ AVEC RÉSERVES**

Aucun finding Critique ni Haute. Aucun bug de calcul, aucun `NaN`, aucun chiffre inventé.

Périmètre revu en lecture intégrale : `src/lib/previsions/tableau-de-bord-helpers.ts`,
`src/components/previsions/projection-types.ts`, `tresorerie-chart.tsx`, `tableau-bord-tab.tsx`,
`previsions-mensuelles-tab.tsx`, le diff de `src/components/pages/previsions-scenario-detail-page.tsx`
et `scenario-detail-client.tsx`, les 3 fichiers de test livrés, **et les fonctions du moteur que ces
écrans prétendent expliquer** (`route-orchestration.ts`, `charges.ts`, `tresorerie.ts`, `plan.ts`),
afin de vérifier la véracité des formules affichées.

---

## Points conformes vérifiés

- **Correctif du repli « projection vide » : réel et lisible.** L'exception de
  `calculerProjectionScenario` est capturée, son message propagé via une prop `erreurProjection`
  distincte, et les deux onglets affichent un état dédié (« Calcul de la projection indisponible » +
  message réel + note « ce n'est pas une absence réelle ») **avant** de retomber sur les messages
  d'état vide. Le test exerce les deux branches et vérifie l'absence croisée des messages. Un tableau
  de bord vide ne peut plus se faire passer pour « tout est à zéro ». Point mineur acceptable : les 4
  cartes secondaires n'ont pas de message individuel, mais la bannière couvre explicitement
  l'ensemble du bandeau.
- **`calculerTresorerieActuelle`** : jamais de `0` en substitut d'un état hors horizon. Les trois
  branches (`avant_horizon`, `apres_horizon`, `disponible`) sont mutuellement exclusives, les deux
  premières renvoient `null`. Testé sur 8 cas dont le point bas négatif du jeu d'or (−6 334 704 FCFA,
  novembre 2026). Le libellé UI (« Trésorerie projetée — [mois] », et la formule explicite « PAS un
  solde réel constaté... une lecture de la projection ») ne laisse jamais croire à un solde bancaire
  réel. Conforme à l'ADR §5.1 et §8.1.
- **Graphique** : `Math.max(...soldes, 0)` et `Math.min(...soldes, 0)` forcent l'inclusion de zéro,
  puis la branche `maxSolde <= 0` court-circuite avant tout risque de division par zéro (série plate
  à zéro : offset 0, jamais `0/0`). Aucun `NaN` possible. Les 7 cas dégénérés sont réellement
  exercés, le SVG `<defs>/<linearGradient>/<stop>` n'étant pas mocké. `ReferenceLine y={0}` toujours
  présente.
- **R6** : aucune couleur en dur dans les 5 fichiers. L'occurrence suspecte signalée par la review de
  PR2.3 n'existe plus sous cette forme.
- **Vérification croisée des 8 formules du tableau mensuel contre le code réel du moteur** : 7 sur 8
  conformes (revenus, coût aliments, charges réparties, investissements, dépenses totales, apports,
  solde cumulé). La 8e est fausse — voir finding 1.
- Le compromis « explication par colonne » (8 popovers au lieu de 168) est jugé un bon arbitrage : la
  formule d'une colonne ne varie pas d'un mois à l'autre, seules les valeurs varient.
- **Formats** : `formatXAF` jamais appelé dans le périmètre.
- **Server/Client** : la page reste un Server Component async appelant le moteur directement, jamais
  un `fetch` vers sa propre route ; aucun `Decimal` ne traverse la frontière ; Recharts chargé via
  `next/dynamic({ ssr: false })`.
- **Bandeau** : 6 indicateurs, les 2 prioritaires en `border-2` coloré et `text-xl` contre `text-xs`
  pour les 4 secondaires — dominance visuelle réelle.
- **Mobile 360px** : navigation mois par mois réelle, boutons avec `aria-label` et bornes `disabled`
  correctes, tableau brut réservé à `md:block`.

---

## Checklist R1-R11

| Règle | Statut | Note |
|-------|--------|------|
| R1 (enums MAJUSCULES) | ✅ | |
| R2 (import enums) | ✅ | |
| R3 (Prisma=TS) | N/A | |
| R4 (opérations atomiques) | N/A | périmètre lecture seule |
| R5 (DialogTrigger asChild) | ✅ | `PopoverTrigger asChild` |
| R6 (CSS variables du thème) | ✅ | |
| R7 (nullabilité) | ✅ | |
| R8 (siteId) | ✅ | |
| R9 (tests avant review) | ✅ | |
| R10 (correctif de données = migration) | N/A | |
| R11 (aucun secret en dur) | ✅ | |

---

## Tableau des findings

| # | Sévérité | Fichier | Emplacement | Description |
|---|----------|---------|--------------|--------------|
| 1 | **Moyenne** | `src/components/previsions/previsions-mensuelles-tab.tsx` | ~65, formule de la colonne « Coût alevins » | L'explication affirme que `effectifAlevinsPrevu` inclut déjà la marge de sécurité de mortalité (`margeSecuriteAlevinsPct`), alors que le moteur ne consomme **jamais** ce champ : `plan.ts` copie `effectifAlevinsParVague` brut, et `route-orchestration.ts` multiplie cet effectif brut par le prix unitaire. Recherche exhaustive : `margeSecuriteAlevinsPct` n'est référencé dans aucun fichier du moteur. C'est un champ saisi, validé et affiché, mais jamais lu par le calcul. Un exploitant qui lit ce tooltip croira que la mortalité est couverte dans le nombre d'alevins commandé, alors qu'elle ne l'est pas. Le gap moteur est antérieur à PR2.4, mais **le texte qui l'affirme à tort est bien un ajout de PR2.4**. **À corriger avant clôture.** |
| 2 | Basse | `previsions-mensuelles-tab.tsx` | fichier | Tableau mensuel sans `ValeurCalculee` par cellule — compromis jugé raisonnable et confirmé. |
| 3 | Basse | `tableau-de-bord-helpers.ts` | `libelleMoisCalendaire` | Libellé abrégé (« nov. 2026 ») plutôt qu'en toutes lettres. Aucune forme n'est prescrite littéralement. |
| 4 | Jugement, à tracer | PR2.3 + PR2.4 | — | i18n : le module atteint 24 fichiers sans convention i18n (20 de PR2.3 + 4 de PR2.4). La review **confirme et aggrave** le jugement de PR2.3 : la dette s'étend story après story sans être bornée, alors que le coût de la correction (un 37e namespace + une assertion de longueur) reste strictement inférieur au coût cumulé engagé. Recommandation réitérée : un item de backlog unique et chiffré, référencé par toutes les stories du module. |
| 5 | Info | `tableau-bord-tab.tsx` | grille secondaire | `grid-cols-2` dès 360px pour les 4 cartes secondaires — dense mais sans débordement ; à surveiller si un libellé plus long est ajouté. |

Aucun de ces findings n'est de sévérité Critique ou Haute.

---

## Verdict

**VALIDÉ AVEC RÉSERVES.** Aucun finding Critique ni Haute. Le finding 1 (sévérité Moyenne) doit être
corrigé avant clôture de la story : le tooltip de la colonne « Coût alevins » affirme à tort que la
marge de sécurité de mortalité est déjà incluse dans l'effectif d'alevins prévu, alors qu'aucun
fichier du moteur ne lit `margeSecuriteAlevinsPct` — soit corriger le texte pour refléter le
comportement réel, soit faire consommer le champ par le moteur si c'était l'intention produit. Les
findings 2, 3 et 5 sont non bloquants. Le point 4 (i18n) est un jugement architectural à tracer en
backlog, non bloquant pour ce sprint.

---

## Note d'outillage

Ce rapport a été rédigé par le @code-reviewer, qui ne disposait que des outils Read/Glob/Grep
(aucun outil d'écriture), et persisté dans ce fichier par le @knowledge-keeper.
