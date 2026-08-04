# Review de sprint — PR2-quinquies

**Verdict global : VALIDÉ AVEC RÉSERVES.** Aucune réserve Critique ni Haute.

## Méthode

Vérification par lecture directe du code, pas seulement des rapports :
`previsions-mensuelles-tab.tsx` (intégral, correctif compris), `ui/popover.tsx`, `ventilations.ts`,
`charges.ts`, les tests de ces fichiers, `previsions.json` fr/en, `schema.prisma` (`PalierRemise`),
`_shared.ts` (`PREVISIONS_STATUS_MAP`), grep exhaustif sur `module-nav-items`, les 5 rapports du
sprint, le fichier de sprint intégral, la review PR2-bis. **Limite assumée** : le reviewer n'a pas
d'outil d'exécution ; il ne s'appuie sur les sorties `vitest`/`build` que via les 3 rapports @tester,
mutuellement cohérents (1270→1482→1904, 0 écart ; 7880→8313→8323 tests).

## 1. Correctif post-livraison — VALIDÉ

Le défaut : les en-têtes de section étaient un `<td colSpan={mois.length + 2}>` en `sticky left-0` ;
une cellule occupant déjà toute la largeur n'a aucune marge pour s'épingler (mesuré : titre à
`left = -1331` pour un conteneur commençant à 264, soit 1595 px hors écran, les 5 en-têtes devenant
des bandes grises vides). Le correctif réutilise **exactement** le mécanisme déjà en place pour les
lignes d'indicateurs : cellule collante étroite (`sticky left-0 z-10 border-r bg-muted`, fond
**opaque**) + bande de fond non collante en `colSpan={mois.length + 1}` avec `aria-hidden="true"`
(cellule sans texte ni contrôle, rien d'utile masqué). `z-10` cohérent sur les trois familles de
cellules collantes. `aria-expanded` et le nom accessible du bouton préservés. R6 respecté (aucune
couleur hex). Les deux correctifs cosmétiques (`text-left` sur le bouton mobile, cause correctement
identifiée comme le style UA par défaut ; `collisionPadding = 16` sur `PopoverContent`) sont minimaux
et localisés. **Sur le composant partagé `popover.tsx`** : seuls 2 fichiers importent
`PopoverContent` dans tout le dépôt, tous deux dans le module Prévisions — le risque « affecte tous
les popovers » est **actuellement théorique**. Le choix d'un défaut global est défendable (un
popover collé au bord est un défaut générique de la primitive Radix, pas une particularité du
module) et reste surchargeable. Réserve mineure non bloquante : la prochaine équipe qui ajoute un
popover ailleurs hérite de ce défaut sans l'avoir choisi ; le JSDoc actuel le documente, ce qui
suffit.

**Vérification de rendu réel du correctif (Chromium, scénario `EXCEL-V12`)** : le titre de section
est mesuré à `265 → 717` à `scrollLeft` 0, 804, 1608 et max — **identique à la colonne des
libellés**, jamais déplacé (contre `-1331` avant correctif), pour les 5 sections. Fond
`rgb(241, 245, 249)` sans canal alpha, donc réellement opaque ; aucun chiffre de mois ne transparaît.
`elementFromPoint` renvoie le bouton de section à 15 %, 40 %, 60 % et 85 % de la largeur de la
cellule. En 375 px : les 5 boutons mobiles sont alignés à gauche, texte débutant à `x = 55` pour
tous, « VENTILATIONS » passant sur 2 lignes sans se recentrer ; marge du popover portée à 16 px
(`right = 359` dans un viewport de 375, contre 375 auparavant).

## 2. Cohérence d'ensemble

`previsions-mensuelles-tab.tsx` a été touché par 4 stories en séquence rapprochée plus le correctif :
**aucune incohérence de style ni mécanisme parallèle**. Un seul système de description de ligne
traverse les 5 sections sans exception (les lignes de ventilation ont exactement la même forme que
les lignes statiques) ; un seul système de section repliable pour desktop et mobile ; aucun code
mort — chaque story a soit ajouté des champs consommés immédiatement, soit refermé une dette de la
précédente (`sectionToggleAria`). Le seul doublon est volontaire, documenté et testé (le filtre de
répartition).

## 3. La leçon centrale du sprint — une classe entière de garanties hors de portée de jsdom

Le bug d'en-tête invisible a traversé un cycle complet @developer → @tester → @code-reviewer sans
être vu, et n'a été trouvé qu'en navigateur réel. En passant le §7.4 en revue garantie par garantie :
**au moins 4 des 7 sont structurellement invérifiables en jsdom** — colonne collante, en-tête de
section collant, collision de popover, absence de débordement horizontal de la page — auxquelles
s'ajoute la troncature des libellés (dépend du calcul de largeur réel). Parmi les 3 restantes, seuls
les formats numériques sont prouvés de bout en bout ; la garantie « négatifs en rouge » n'est
vérifiée qu'au niveau du **nom de classe posé**, jamais de la couleur rendue (un mauvais mappage de
`text-danger` dans le thème resterait invisible). Le test ajouté par le correctif énonce lui-même
cette limite en commentaire — la discipline la plus saine possible après coup, mais qui confirme
l'ampleur du trou. **Recommandation, à ouvrir formellement** : un test Chromium **récurrent** (pas
une vérification ad hoc déclenchée après signalement utilisateur) pour au moins la colonne collante
et l'en-tête de section, les deux garanties déjà prises en défaut une fois. Sévérité **Moyenne**,
non bloquante pour ce sprint.

## 4. Duplication du filtre `calculerBaseRepartition` — CONFIRMÉE

Lu côte à côte : `charges.ts:105-120` et `ventilations.ts:152-171` portent le même prédicat, réécrit
indépendamment (la seconde version étant la négation exacte de la première). Mitigation réelle : le
test « piège 2 » appelle `calculerBaseRepartition` réellement importée et compare — toute divergence
future serait détectée, **à condition que ce test continue d'être exécuté et que son assertion ne
soit jamais affaiblie**. **Non bloquant pour clore ce sprint ; bloquant avant toute story PR3 qui
modifierait la définition de `base_repartition` dans `charges.ts`** — une telle story devrait
extraire un prédicat partagé exporté **avant** de modifier `charges.ts`, pas après avoir découvert la
divergence en production.

## 5. Statut des réserves de PR2-bis

(1) `PalierRemise.seuilSacs` : **inchangée**, `schema.prisma` identique, aucune story de ce sprint
n'a touché ce modèle ; reste bloquante avant toute story de remise multi-granulométrie.
(2) Gouvernance : **reste soldée** (voir §6).
(3) et (4) : déjà soldées par PR2-bis.
(5) check-then-write R4 dans `previsions-vagues.ts` : **inchangée**, fichier non modifié par ce
sprint.
(6) mapping HTTP par sous-chaîne : **inchangée**, toujours 6 entrées exactes, aucune 7e ajoutée.
(7) `module-nav-items.ts` : **toujours mort**, seul référencé par un test de nettoyage.
(8) 1 entrée de navigation : non concernée.
Clés i18n mortes `page.detailTitle`/`page.backToList` : **toujours présentes dans les deux langues**,
ni aggravées ni soldées. `sectionToggleAria` : créée par PR2q.3, signalée par sa review, **soldée
dans la foulée par PR2q.4** — dette refermée immédiatement plutôt que traînée.

## 6. Gouvernance — réserve soldée

Grep exhaustif de la voix à la première personne (`j'ai`, `je`, `nous avons`) dans le fichier de
sprint : **négatif**. La narration est à la troisième personne (« Étape @db-specialist —
TERMINÉE », « le @developer a… »), critère même qu'avait utilisé la review PR2-bis. Nuance
signalée honnêtement : ce fichier contient des notes de clôture bien plus détaillées que celui de
PR2-bis (numéros de ligne, chiffres de recette) ; c'est cohérent avec le mandat (le @status-updater
transcrit ce qui lui est relayé), mais le reviewer n'a pas d'accès `git blame` pour confirmer
l'auteur des commits — jugement fondé sur le style seul. Un contrôle ponctuel de l'historique par
le @project-manager suffirait à clore ce doute résiduel. Non bloquant.

## 7. Périmètre — respecté

Lignes 11-23 absentes (grep négatif) ; `extract-golden.py` et fixtures inchangés ; moteur non
modifié hors PR2q.2. **Nuance de formulation** : PR2q.4 a créé un fichier neuf,
`src/lib/previsions/ventilations.ts`, sous un chemin que le texte du sprint réservait littéralement
à PR2q.2. Dans l'esprit ce n'est pas une violation (aucune fonction du moteur modifiée, fichier pur
et testé indépendamment, son propre en-tête revendique de ne pas faire partie du moteur recetté) — à
clarifier dans la formulation des prochains sprints (« le moteur recetté » plutôt que « le
répertoire `src/lib/previsions/` »), **pas à corriger rétroactivement**.

## 8. Recette — vrai gain de couverture, pas du gonflage

Vérification de non-tautologie sur un échantillon **choisi par le reviewer**, non mis en avant par
les rapports : le bloc `ventilerApportsParType` de `ventilations.test.ts:55-107`. La valeur attendue
du test « jeu d'or » est bien lue depuis le JSON (`fixture.resultats.apportsCapital[moisAbsolu]`),
jamais recalculée, avec un commentaire honnête précisant que seul le total est une vraie donnée du
jeu d'or. Le test synthétique à 2 types construit ses propres attentes — légitime et documenté : il
exerce une branche que le jeu d'or ne peut structurellement pas exercer. Chaque palier de progression
(1270 → 1482 → 1904) correspond à une série de fixture réellement nouvelle, pas à une répétition
paramétrée de la même assertion.

## 9. Checklist R1-R11 consolidée

R1, R2, R5, R6, R7, R10, R11 : OK. R3 : OK. R4 : OK pour le nouveau code (aucune écriture Prisma
nouvelle), réserve 5 de PR2-bis inchangée. R8 : non applicable (aucun nouveau modèle). R9 :
**partiellement vérifié** — confirmé par les 3 rapports @tester avec sorties réellement rejouées,
mais non ré-exécuté par le reviewer faute d'outil shell. Aucun `any` introduit.

## 10. Ce qui reste non couvert, explicitement

Lignes 11-23 du classeur (exclusion assumée, `extract-golden.py` non étendu) ; partition
CAPITAL/CREDIT des apports et détail poste par poste (absents du classeur, validés seulement par
tests synthétiques) ; composante `apportsFCFA` de « Total des entrées » (aucune ligne d'apport en
saisie dans `entreesModele` des deux fixtures — la dérivation n'est rapprochée qu'en dégénérant à
`revenusFCFA`) ; instabilité *flaky* de 7 fichiers, non reproduite en 3 exécutions, ni confirmée ni
infirmée ; garanties visuelles §7.4 invérifiables en jsdom.

## Tableau des réserves priorisées

| # | Sévérité | Réserve | Bloquant avant PR3 ? |
|---|---|---|---|
| 1 | Moyenne — hérité, inchangé | `PalierRemise.seuilSacs` scopé par scénario | **Oui**, avant toute story touchant aux remises multi-granulométrie |
| 2 | Moyenne — confirmée | Duplication du filtre `calculerBaseRepartition` entre `charges.ts` et `ventilations.ts` | Non pour clore ; **oui avant toute story modifiant `base_repartition` dans `charges.ts`** |
| 3 | Moyenne — nouvelle | Garanties visuelles §7.4 hors de portée de jsdom (sticky × 2, collision popover, débordement, troncature) | Non, mais recommandé avant d'accumuler davantage de mise en page non vérifiable |
| 4 | Basse — hérité | check-then-write résiduels R4 dans `previsions-vagues.ts` | Non |
| 5 | Basse — hérité | Mapping HTTP par sous-chaîne (6 entrées) | Non, mais avant la prochaine story touchant `validation.ts`/`_shared.ts` |
| 6 | Basse — hérité | `module-nav-items.ts` toujours mort | Non |
| 7 | Basse cosmétique — hérité | 2 clés i18n mortes (`page.detailTitle`/`page.backToList`) | Non |
| 8 | Info — nouvelle | `ventilations.ts` sous un chemin réservé à la lettre à PR2q.2 | Non — clarifier la formulation |
| 9 | Info — nouvelle | `collisionPadding=16` par défaut sur un composant partagé à 2 consommateurs | Non |

## Verdict final

**VALIDÉ AVEC RÉSERVES.** Les 4 stories et le correctif post-livraison sont chacun de bonne qualité,
avec des preuves vérifiables (cassage volontaire puis restauration checksum-identique à 3 reprises
indépendantes, non-tautologie confirmée par lecture des fixtures, parité i18n par script, mesures
Chromium chiffrées) plutôt que de simples déclarations. La nouveauté du sprint est double : une
réserve Moyenne confirmée (duplication du filtre) et une réserve Moyenne à ouvrir (garanties
visuelles invérifiables en jsdom, révélée par un bug ayant traversé un cycle complet). Aucune ne
bloque la clôture ; toutes deux méritent un arbitrage avant que PR3 ne s'appuie dessus.

**Évolution mesurée** : recette du moteur 1270 → 1482 → **1904 tests, 0 écart** ; suite complète
7668 → **8326 tests, 0 échec**.
