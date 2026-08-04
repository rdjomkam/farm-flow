# Pré-analyse — Story PR2sex.3 (UI, sprint PR2-sexies)

**Date** : 2026-08-04
**Portée** : ajouter les 9 lignes « Détail par vague — sacs consommés dans le mois » sous la
section « Aliments » de `src/components/previsions/previsions-mensuelles-tab.tsx`.
**Dépendance** : PR2sex.2 (moteur) est `EN COURS` en parallèle — cette pré-analyse décrit
l'**interface attendue**, pas un nom de champ définitif déjà arrêté.

## Statut : GO AVEC RÉSERVES

---

## 1. Cartographie du composant — le patron exact à suivre

Fichier : `src/components/previsions/previsions-mensuelles-tab.tsx` (637 lignes).

- **Une ligne** = un objet `LigneDescriptor` (l.233-241) : `{ id, accessor(m): number, totalMode,
  format, label, formule }`. `accessor` lit un champ de `MoisProjectionDTO` (ou dérive une valeur
  UI-only, ex. `totalEntrees`). Il n'existe **aucun second système** — chaque ligne, statique ou
  dynamique, produit un `LigneDescriptor`.
- **Lignes dynamiques déjà en place** (patron à reproduire à l'identique) : `lignesGranulometrie`
  (l.328-346) construit l'UNION des clés réellement présentes dans `m.sacsParGranulometrie` sur
  tous les mois, dans l'ordre de première apparition, puis mappe chaque clé vers un
  `LigneDescriptor` dont le libellé est paramétré par `tStock('produits.taillesGranule.${g}')`.
  C'est **exactement** le patron à suivre pour les 9 lignes (voir §2 et §4).
- **Une section** = `SectionDescriptor` (l.243-248) : `{ id, title, defaultOpen, lignes:
  LigneDescriptor[] }`. `SECTIONS` (l.413-501) est un tableau **plat, un seul niveau** — 5
  sections aujourd'hui : `resultat` (ouverte), `production`, `aliments`, `entreesDepenses`,
  `ventilations` (repliées). Le rendu (l.560-621) fait `SECTIONS.map(...)`, une `<tbody>` par
  section, une ligne d'en-tête collante (bouton + `aria-expanded`) suivie conditionnellement des
  `<tr>` de `section.lignes`.
- **`totalMode`** (l.218, `"somme" | "derniereValeur"`) et `calculerTotalLigne()` (l.255-261) :
  la règle d'agrégation est **portée par la ligne**, jamais par un `if` sur le nom de la ligne
  dans le rendu (ERR-156). Toute nouvelle ligne doit déclarer son `totalMode` explicitement.
- **`format`** (l.231, `"montant" | "tonnage" | "entier"`) et `formatLigne()` (l.264-275) : même
  discipline — le format est déclaré par la ligne, consommé uniformément.
- **Bouton d'explication §7.4** : `ExplicationLigne` (l.278-295), un `Popover`/`PopoverTrigger
  asChild` (R5 respecté) + `PopoverContent` affichant `l.formule`. Il est rendu **une fois par
  ligne** (pas par cellule — l.185-199 documente pourquoi : la formule est la même pour les 21
  mois, seules les valeurs sources varient), à côté du libellé tronqué dans la cellule collante
  (l.600-603). C'est le seul mécanisme d'explication du fichier — à réutiliser tel quel pour les
  9 nouvelles lignes, une paire `(label, formule)` par ligne, comme `lignesGranulometrie` le fait
  déjà.

**Patron pour le développeur** : construire un `useMemo<LigneDescriptor[]>` nommé par exemple
`lignesDetailParVague` (même style que `lignesGranulometrie`), qui itère sur les positions de
cycle et les granulométries **réellement présentes dans les données** (jamais 3×3 codé en dur —
voir §2 et le sprint : « cycle paramétrable », « aucun 2/3/4 mm codé en dur »), et injecter le
résultat dans `SECTIONS[id="aliments"].lignes` — ou dans un sous-groupe dédié, voir §2.

---

## 2. Le point de conception le plus important — le regroupement (§7.1)

**N actuel dans la section « Aliments »** (l.452-461) : 2 lignes fixes (`besoinAliments`,
`sacsAchat`) + les lignes dynamiques de `lignesGranulometrie` — **3** dans le jeu d'or `EXCEL-V12`
(2 mm/3 mm/4 mm réellement présentes). **N = 5** aujourd'hui. Après ajout des 9 lignes : **14**
lignes dans une section qui n'a, à ce jour, **aucun mécanisme de sous-groupe** — `SectionDescriptor`
est un unique niveau plat.

Important : la section « Aliments » est déjà `defaultOpen: false` (l.455). Le premier écran (§7.1,
compréhension en < 10 s) n'est **pas dégradé** par l'ajout tant que la section reste repliée par
défaut — la vraie question porte sur ce que voit l'utilisateur **une fois qu'il déplie**
« Aliments » : 14 lignes plates, dont 9 très similaires (même grandeur, seuls position × calibre
changent), est précisément « un tableau plat » que le §7.1 qualifie d'échec, même avec des valeurs
justes.

### Options comparées

**(a) Une sous-section repliable dédiée « Détail par mois de cycle », repliée par défaut, nichée
sous « Aliments ».**
Avantage : reflète directement le titre du bloc dans le classeur (« DÉTAIL PAR VAGUE… ») et
l'esprit de la section « Ventilations » (l.476-499, déjà un précédent de « détail au-delà du
premier écran, replié par défaut »). Un seul point d'entrée/sortie visuel, cohérent avec le fait
que ces 9 lignes forment un bloc sémantique unique du classeur (lignes 11-23 contiguës).
Inconvénient : nécessite d'étendre le mécanisme de section à un second niveau (voir ci-dessous).

**(b) Trois sous-sections (une par position de cycle : « 1er mois de cycle », « 2e », « 3e »),
chacune avec ses 3 lignes de granulométrie.**
Avantage : regroupement le plus fin, correspond à la structure `moisCycle1/2/3` du jeu d'or et de
`extract-golden.py` (`prisma/fixtures/previsions/extract-golden.py:299-303`). Inconvénient :
**3 boutons de repli supplémentaires** pour 3 lignes chacun — au vu de la contrainte « cycle
paramétrable » (`dureeCycleMois` peut ne pas valoir 3), le nombre de sous-sections devient lui
aussi dynamique, ce qui est plus de mécanique pour un gain de lisibilité marginal par rapport à
(a) : l'utilisateur qui déplie une sous-section de position doit de toute façon comparer ensuite
avec les 2 autres, donc rouvrir/refermer plusieurs fois — contraire à l'esprit « comprendre en
< 10 s ».

**(c) Un regroupement par granulométrie (2 mm / 3 mm / 4 mm), chacune avec ses 3 positions.**
Avantage : cohérent avec `lignesGranulometrie` déjà présent juste au-dessus dans la même section
(les lignes « dont sacs {granule} (total) » existantes). Inconvénient : même problème que (b) —
nombre de groupes dynamique (granulométries réellement utilisées, potentiellement plus de 3 selon
`TailleGranule`), donc même charge mécanique pour un gain de lisibilité comparable ; par ailleurs,
le classeur lui-même organise le bloc par **position de cycle en premier, granulométrie en second**
(lignes 13-15 = position 1, 17-19 = position 2, 21-23 = position 3) — un regroupement par
granulométrie inverserait cet ordre sans raison métier, rendant plus difficile la relecture
croisée avec le classeur de référence si l'utilisateur (`EXCEL-V12`) veut un jour comparer ligne à
ligne.

### Recommandation : **(a)**, une sous-section unique « Détail par mois de cycle », repliée par
défaut, avec les 9 lignes **à plat mais ordonnées** exactement comme le classeur (position 1 ×
{2,3,4 mm}, position 2 × {2,3,4 mm}, position 3 × {2,3,4 mm}) à l'intérieur.

Justification : (a) est le seul choix qui n'ajoute qu'**un seul** nouveau point de repli (pas un
nombre variable selon `dureeCycleMois` ou le nombre de granulométries), tout en isolant totalement
le bloc « détail, indicatif » du reste de la section « Aliments » (qui, elle, porte les grandeurs
« à acheter », `ceil` — voir §4, la distinction sémantique à ne pas brouiller). C'est aussi le
choix qui demande le moins de mécanique nouvelle : un seul niveau d'imbrication, pas N.

**Coût de rendre le mécanisme imbricable — raisonnable dans ce sprint.** Le mécanisme actuel
(`SectionDescriptor` + `sectionsOuvertes: Record<string, boolean>` + la paire de `<tr>` d'en-tête
l.564-587) est **directement généralisable sans architecture parallèle** :
1. Ajouter un champ optionnel à `SectionDescriptor` (ou créer un type frère minimal,
   `SousSectionDescriptor = { id; title; defaultOpen; lignes: LigneDescriptor[] }`) porté par
   exemple par un champ `section.groupes?: SousSectionDescriptor[]` rendu **après** les `lignes`
   plates de la section parente.
2. `sectionsOuvertes` reste un unique `Record<string, boolean>` — la clé de la sous-section est
   simplement composée (`"aliments.detailParVague"`), aucun état imbriqué à gérer.
3. Extraire la paire de `<tr>` d'en-tête (l.564-587, bouton + `ChevronDown/ChevronRight` +
   cellule `colSpan` `aria-hidden`) dans une petite fonction/component interne partagé, réutilisée
   à l'identique pour le niveau section ET le niveau sous-section — **c'est le point de vigilance
   ERR-157** : la correction post-livraison a précisément établi que ce motif à 2 cellules (une
   collante étroite + une bande `colSpan` non collante) est le seul qui fonctionne pour un en-tête
   sticky dans ce tableau ; toute réimplémentation ad hoc pour le niveau sous-section réintroduirait
   le bug corrigé (`<td colSpan={...}>` seul en `sticky` = disparaît hors écran). **Ne pas
   réécrire ce motif, l'extraire et le réutiliser tel quel.**
4. Les lignes de la sous-section restent des `LigneDescriptor` ordinaires, rendues par le même
   corps de boucle `section.lignes.map(...)` (l.588-618) — aucune divergence de rendu de cellule à
   créer.

C'est une généralisation d'un niveau, pas un second système : même `LigneDescriptor`, même
`calculerTotalLigne`, même `formatLigne`, même `ExplicationLigne`, même motif d'en-tête collant.

---

## 3. `totalMode` — vérification des cumuls de contrôle

Les 9 séries sont des **flux mensuels** (sacs consommés CE mois, pas un état cumulatif) : `"somme"`
est le bon `totalMode`, comme `sacsAchat` et les lignes `sacsGranulometrie` existantes — **pas**
`"derniereValeur"` (réservé à `soldeFCFA`, ERR-156).

Vérifié par lecture des fixtures (`prisma/fixtures/previsions/plan-v12-corrige.json`, clé
`besoinsAliments.detailParVagueSacs.moisCycle1."2mm"`, 21 valeurs) que la somme des 21 mois de
chacune des 9 séries tombe exactement sur les cumuls de contrôle attendus :

| | 2 mm | 3 mm | 4 mm |
|---|---|---|---|
| 1er mois de cycle | 1 543 | 867 | 0 |
| 2e mois de cycle | 385 | 3 471 | 4 820 |
| 3e mois de cycle | 0 | 0 | 7 230 |

`totalMode: "somme"` reproduira donc ces cumuls **si et seulement si** l'`accessor` de chaque
ligne lit bien la bonne clé `(position, granule)` — pas de piège algorithmique côté `totalMode`
lui-même, tout le risque est dans le mapping `accessor` (§5 ci-dessous) et dans la **fidélité de la
projection produite par PR2sex.2** (hors périmètre de cette story).

**Piège ERR-156 à surveiller explicitement pendant le dev** : si un développeur pressé traite ces
9 lignes comme "encore une variante de `sacsGranulometrie`" et copie-colle sans relire
`calculerTotalLigne`, le risque est nul ici (les deux familles de lignes partagent le même
`totalMode`) — mais la vigilance reste db à vérifier que personne n'introduit un `totalMode`
`"derniereValeur"` par erreur de copier-coller depuis `soldeCumule`.

---

## 4. Libellés et unité (§7.4)

Les 9 valeurs sont des **entiers de sacs consommés** (`ROUND`), à distinguer explicitement de
`sacsAchat`/`sacsGranulometrie` (des sacs **à commander**, `ceil`) déjà présents 2 lignes au-dessus
dans la même section. Un libellé qui ne porterait que « Sacs {granule} — mois {k} » sans qualifier
« consommés / indicatif » créerait exactement la confusion que le sprint met en garde contre
(2 lignes voisines affichant des nombres différents pour ce qui ressemble à la même grandeur).

**Précédent direct à réutiliser pour le libellé de position** : `previsions.repartitionDialog.
monthLabel` = **"Mois {count} du cycle"** / EN **"Month {count} of the cycle"**
(`src/messages/fr/previsions.json:282`) — déjà le vocabulaire du module pour une position de
cycle paramétrée par un compteur, jamais un ordinal figé "1er/2e/3e" en dur (cohérent avec la
contrainte « cycle paramétrable », `dureeCycleMois` peut différer de 3).

**Précédent direct à réutiliser pour la granulométrie** : même patron que `sacsGranulometrie`
(`rows.sacsGranulometrie.label` = **"dont sacs {granule} (total)"**), qui réutilise déjà
`tStock('produits.taillesGranule.${g}')` (ADR-053 §12.2.4 : aucun second référentiel de
granulométrie).

**Proposition de clé unique paramétrée** (2 paramètres, `{count}` et `{granule}`), plutôt que 9
clés figées — cohérent avec `sacsGranulometrie` qui est déjà UNE clé pour 3 (voire N) valeurs :

```json
"detailSacsParVague": {
  "label": "Sacs {granule} consommés (indicatif) — mois {count} du cycle",
  "formule": "Sacs {granule} consommés, indicatif (ROUND) — mois {count} du cycle = somme, pour toutes les vagues empoissonnées {count} mois plus tôt, du besoin en aliment {granule} de ce mois, arrondi au sac le plus proche. Distinct de « dont sacs {granule} (total) » ci-dessus, qui est le nombre de sacs À ACHETER (arrondi PAR EXCÈS, ceil) — cette ligne-ci ne doit jamais servir à passer une commande."
}
```

EN :

```json
"detailSacsParVague": {
  "label": "{granule} bags consumed (indicative) — month {count} of the cycle",
  "formule": "Indicative {granule} bags consumed (ROUND) — month {count} of the cycle = sum, across every batch stocked {count} month(s) earlier, of that month's {granule} feed requirement, rounded to the nearest bag. Distinct from \"of which {granule} bags (total)\" above, which is the number of bags TO BUY (rounded UP, ceil) — this line must never be used to place an order."
}
```

Le mot « indicatif » dans le libellé lui-même (pas seulement dans la formule) est volontairement
redondant avec la formule : le libellé est visible en permanence dans la colonne collante, la
formule ne s'affiche qu'au clic sur le bouton d'explication — la distinction doit être visible
**sans** ouvrir le popover.

**Unité dans le libellé** : le mot « Sacs » figure dans le libellé lui-même (même discipline que
`sacsAchat`/`sacsGranulometrie`, qui n'ajoutent pas de suffixe séparé) — cohérent avec le format
`"entier"` déjà utilisé par ces deux lignes voisines (aucune décimale, U+202F, zéros en U+2013,
`classeMontant()` pour le rouge sur négatif — tous déjà génériques dans `format-previsions.ts` et
`formatLigne()`, **aucun nouveau code de formatage requis**).

---

## 5. Bouton d'explication (§7.4)

Patron : réutiliser `ExplicationLigne` tel quel (aucune modification du composant), une paire
`(label, formule)` par `LigneDescriptor`, comme `lignesGranulometrie` le fait déjà (l.335-345).

Contenu de la formule : voir §4 ci-dessus — mentionne explicitement `ROUND`, la position dans le
cycle, et la distinction avec la ligne « à acheter » (`ceil`).

**Libellé de cohorte (liste des vagues concernées) — si le moteur en expose un.** Le sprint
(`docs/sprints/SPRINT-PR2-sexies-PREVISIONS.md`, section PR2sex.2) précise : *« Si un libellé de
cohorte est produit, il liste TOUTES les vagues concernées »* — c'est-à-dire que PR2sex.2 pourrait
exposer, en plus des 9 séries numériques, une liste de codes de vague par `(position, mois)`. Si
c'est le cas, la formule de `ExplicationLigne` **ne peut pas** afficher 21 × 3 listes de vagues
différentes (une par mois, une explication par ligne, pas par cellule — voir §1) — il faudrait soit
(a) ne PAS afficher les codes de vague dans ce composant (rester au niveau formule générique,
laisser le détail vague par vague aux onglets `Granulométries`/`Plan de vagues` déjà existants,
même logique que celle documentée l.185-199 pour les autres lignes), soit (b) si un jour un besoin
UI explicite d'afficher les vagues par mois apparaît, ouvrir une story dédiée plutôt que de la
caser dans PR2sex.3. **Recommandation pour cette story : (a)**, ne pas exposer le libellé de
cohorte dans `ExplicationLigne` — la formule textuelle suffit à satisfaire §7.4 (« d'où vient ce
nombre »), et évite de reproduire, même par erreur d'implémentation UI, le défaut INDEX/MATCH du
classeur (une seule vague affichée) : le risque n'existe que si l'UI tente d'afficher un unique
code de vague par cellule, ce qu'aucun `LigneDescriptor` actuel ne fait.

---

## 6. i18n

`src/messages/fr/previsions.json` et `src/messages/en/previsions.json` comptent **405 clés
chacun** (vérifié par comptage récursif — le sprint mentionne 407, écart mineur documentaire à
signaler au @knowledge-keeper/@status-updater, pas bloquant).

**Clés à ajouter** (parité fr/en stricte) :
- `previsionsMensuellesTab.sections.detailParVague` (titre de la sous-section, §2)
- `previsionsMensuellesTab.rows.detailSacsParVague.label` (paramétrée `{granule}`, `{count}`)
- `previsionsMensuellesTab.rows.detailSacsParVague.formule` (idem)
- éventuellement `previsionsMensuellesTab.sousSectionAria` ou réutilisation de
  `previsionsMensuellesTab.rowAria` existant (l.602) pour l'`aria-label` du bouton de repli de la
  sous-section, si le patron du bouton de section principal (l.573-576, qui utilise `title` +
  contenu visuel, pas d'`aria-label` dédié) est repris tel quel — à confirmer par le développeur
  selon ce qu'exigent les tests d'accessibilité existants (`sectionToggleAria`, mentionné dans la
  review PR2-quinquies comme dette refermée par PR2q.4 — vérifier son usage exact avant d'inventer
  une clé parallèle).

**Clés mortes à supprimer** : confirmé par grep — `page.detailTitle` et `page.backToList`
n'apparaissent **dans aucun fichier `.ts`/`.tsx` du dépôt** (`grep -rn "detailTitle\|backToList"
src/ --include="*.tsx" --include="*.ts"` = 0 résultat hors JSON eux-mêmes), seulement dans les 2
fichiers `previsions.json` (fr l.4-5, en l.4-5). Confirmé mortes, suppression recommandée dans les
deux langues, comme demandé par le sprint et la review PR2-quinquies (réserve #7, Basse, non
bloquante mais explicitement dans le périmètre transverse de ce sprint).

**ERR-144 (dette `src/i18n/request.ts` vs `src/messages/index.ts`)** : n'impacte **pas** cette
story — `previsions` est déjà un namespace existant et chargé des deux côtés (aucun namespace
nouveau à ajouter, seulement des clés à l'intérieur d'un namespace déjà présent dans les deux
listes). Vérifié par grep : `previsions` figure bien dans `src/i18n/request.ts` et
`src/messages/index.ts`. Rien à faire ici, mentionné pour mémoire.

---

## 7. ERR-157 — garanties visuelles

**Ce que jsdom PEUT prouver pour ces 9 lignes** :
- présence des 9 `<tr>` (ou de la sous-section) dans le DOM une fois le groupe ouvert ;
- ordre des lignes (position 1×3, position 2×3, position 3×3) ;
- contenu textuel exact des libellés et des valeurs formatées (`formatEntierPrevision`) ;
- présence du bouton d'explication, son `aria-label`, et le texte de la formule dans le
  `PopoverContent` une fois monté ;
- `aria-expanded` du nouveau bouton de sous-section, cohérent avec l'état ouvert/fermé ;
- non-régression : les 5 sections existantes restent inchangées en structure (déjà testé,
  `previsions-mensuelles-tab.test.tsx:206`).

**Ce que jsdom NE PEUT PAS prouver (ERR-157), à vérifier en Chromium réel à 375 px et 1280 px** :
- que la **nouvelle sous-section** hérite correctement du motif d'en-tête collant à 2 cellules
  (§2, point 3) — c'est le **siège exact** du bug ERR-157/ERR-158 déjà rencontré une fois sur ce
  fichier ; toute divergence, même minime, dans l'extraction du composant d'en-tête partagé
  pourrait réintroduire un `<td colSpan>` seul en `sticky`, invisible en jsdom ;
- que la **colonne collante** (libellés) reste correctement alignée et lisible avec 14 lignes au
  lieu de 5 dans la section « Aliments » désormais plus longue — un tableau plus long ne change
  pas la mécanique `sticky left-0`, mais la longueur accrue augmente la marge d'erreur si un
  développeur touche par erreur `COLONNE_INDICATEUR_CLASSES` ou la structure de cellule pendant le
  dev ;
- que le **fond opaque** (`bg-muted`) du nouvel en-tête de sous-section masque bien les colonnes de
  mois qui défilent dessous (pas de fuite visuelle) ;
- l'absence de débordement horizontal de la **page** (`document.documentElement.scrollWidth ===
  clientWidth`) après ajout de contenu ;
- la troncature réelle des libellés plus longs (`"Sacs 2 mm consommés (indicatif) — Mois 1 du
  cycle"` est sensiblement plus long que les libellés actuels les plus longs de la colonne) à
  375px sous `COLONNE_INDICATEUR_CLASSES` (`w-28`/`max-w-28`) — risque réel que la troncature
  coupe le libellé à un endroit qui rend l'attribut `title` (info-bulle complète) indispensable à
  la compréhension, ce qui est acceptable (le patron existant le fait déjà) mais **doit être
  vérifié visuellement**, pas supposé.

**Recommandation opérationnelle** : la vérification navigateur réel (375 px et 1280 px) doit
explicitement mesurer, comme le rapport EXCEL-V12 de la review PR2-quinquies l'a fait (§1) : la
position de l'en-tête de la nouvelle sous-section à `scrollLeft` 0 et max (doit coïncider avec la
colonne des libellés, jamais dériver), et confirmer par lecture d'écran (ou `elementFromPoint`)
que rien ne devient une bande vide.

---

## 8. État de base — vérifié réellement

- `npx vitest run` : **281 fichiers passés / 5 skipped (286 total)**, **8333 tests passés / 21
  skipped / 26 todo (8380 total)**, **0 échec**. Conforme à la base annoncée par le sprint
  (« 286 fichiers, 8333 tests hors DB-gated »).
- `npx vitest run src/lib/previsions/__tests__/recette` : **1904 tests / 0 écart** (3 fichiers de
  recette) — confirme que PR2sex.2 (en cours) n'a pas encore ajouté les nouveaux tests de recette
  pour les 9 séries (attendu, cohérent avec son statut `EN COURS`).
- `npm run build` : **OK** (exit 0), toutes les routes compilées, aucune erreur TypeScript ni de
  build.
- Vérification SQL en lecture seule (`SELECT` uniquement) sur le scénario `EXCEL-V12`
  (`ScenarioPrevision.id = cmsdnypml0000n4ekuadykn0f`) : **19 vagues, 602 500 alevins, 3 apports**
  — confirme les compteurs attendus, aucune écriture effectuée.

**Tests susceptibles de casser / à surveiller pendant le dev** (dans
`src/components/previsions/__tests__/previsions-mensuelles-tab.test.tsx`) :
- l.206, « la section Résultat est dépliée par défaut, les 4 autres sont repliées » — **ne casse
  pas** avec l'option (a) recommandée (le nombre de sections top-level reste 5 ; une sous-section
  imbriquée n'entre pas dans ce compte), mais **casserait** avec les options (b)/(c) si elles
  étaient implémentées comme des sections top-level supplémentaires plutôt que des sous-sections —
  argument de plus en faveur de (a).
- l.263, « ouvrir la section Aliments révèle le détail par granulométrie (dynamique, pas codé en
  dur) » — ce test devra probablement être étendu (pas cassé) pour couvrir aussi la nouvelle
  sous-section une fois qu'elle est dépliée.
- l.322, « chaque section (pas seulement Résultat) suit la même structure à 2 cellules » — ce test
  vérifie précisément le motif ERR-157/ERR-158 sur les 5 sections existantes ; il devra être étendu
  pour couvrir aussi la nouvelle sous-section (c'est la garantie structurelle jsdom-vérifiable, cf.
  §7) — omettre cette extension laisserait la nouvelle sous-section hors de la seule protection que
  jsdom peut offrir contre une régression du motif d'en-tête.

---

## Récapitulatif des risques et prérequis

1. **Interface attendue de PR2sex.2 (moteur), non encore arrêtée** — le composant a besoin d'un
   champ sur `MoisProjectionDTO` (`src/components/previsions/projection-types.ts`) de la forme
   approximative `Record<number, Record<string, number>>` (clé externe = position de cycle `k`,
   clé interne = code `TailleGranule` tel que `sacsParGranulometrie` l'utilise déjà, ex. `"G1"` —
   **pas** les clés brutes `"2mm"/"3mm"` du fixture JSON, qui sont un artefact d'extraction, cf.
   `sacsParGranulometrie` déjà en `TailleGranule`). Tant que ce nom de champ n'est pas figé par
   PR2sex.2, le développeur PR2sex.3 doit coder l'`accessor` contre une interface qu'il documente
   lui-même en commentaire (comme cette pré-analyse le fait), prête à être renommée en un seul
   endroit dès que PR2sex.2 se stabilise — **ne pas commencer le rendu final avant que PR2sex.2
   soit au moins en `REVIEW`**, pour éviter un renommage de champ traversant deux stories en
   parallèle sans coordination.
2. **Regroupement §7.1** : implémenter l'option (a), sous-section unique repliée par défaut,
   réutilisant le motif d'en-tête à 2 cellules existant (extraction, pas réécriture).
3. **Écart de comptage i18n (405 vs 407 annoncé par le sprint)** : mineur, à signaler au
   @status-updater/@knowledge-keeper, non bloquant pour cette story.

---

## Plan numéroté pour le @developer

1. Attendre (ou coordonner explicitement avec) la stabilisation du champ exposé par PR2sex.2 sur
   `MoisProjectionResult`/`MoisProjectionDTO` avant l'intégration finale ; en attendant, développer
   contre une interface locale documentée en commentaire (nom provisoire acceptable, à renommer en
   un seul endroit).
2. Étendre `SectionDescriptor` avec un champ optionnel `groupes?: SousSectionDescriptor[]` (type
   frère minimal de `SectionDescriptor`, sans `title`/`defaultOpen` dupliqués inutilement) ; étendre
   `sectionsOuvertes` avec une clé composée (`"aliments.detailParVague"`).
3. Extraire la paire de `<tr>` d'en-tête de section (l.564-587) dans une petite fonction/component
   interne réutilisable, appelée pour le niveau section ET pour le nouveau niveau sous-section —
   ne jamais réimplémenter le motif à 2 cellules (colonne collante étroite + bande `colSpan`
   `aria-hidden` non collante).
4. Créer `lignesDetailParVague` (`useMemo`), même patron que `lignesGranulometrie` : itérer sur les
   positions de cycle réellement présentes dans les données (jamais 1..3 codé en dur) × les
   granulométries réellement présentes (union des clés, même patron que `lignesGranulometrie`),
   dans l'ordre du classeur (position croissante, puis granulométrie dans l'ordre déjà utilisé par
   `lignesGranulometrie`).
5. Ajouter la sous-section « Détail par mois de cycle » (`defaultOpen: false`) dans
   `SECTIONS[id="aliments"].groupes`, contenant `lignesDetailParVague`.
6. Ajouter les clés i18n `previsionsMensuellesTab.sections.detailParVague`,
   `previsionsMensuellesTab.rows.detailSacsParVague.{label,formule}` dans `fr` et `en` (voir
   propositions §4), en réutilisant `tStock('produits.taillesGranule.${g}')` pour le nom de
   granulométrie — jamais un second référentiel.
7. Supprimer `page.detailTitle` et `page.backToList` dans `src/messages/fr/previsions.json` et
   `src/messages/en/previsions.json` (confirmées mortes par grep).
8. Étendre les tests existants de `previsions-mensuelles-tab.test.tsx` (l.263, l.322) pour couvrir
   la nouvelle sous-section, plus des tests dédiés : ordre des 9 lignes, `totalMode: "somme"`
   reproduisant les cumuls de contrôle (1543/867/0 · 385/3471/4820 · 0/0/7230) une fois le champ
   moteur disponible, format entier (U+202F, U+2013, pas de décimale), bouton d'explication présent
   sur les 9 lignes avec mention « consommés/indicatif ».
9. Vérification manuelle en Chromium réel à 375 px et 1280 px (ERR-157) : position de l'en-tête de
   la nouvelle sous-section à `scrollLeft` 0/max (doit coïncider avec la colonne des libellés),
   absence de débordement de page, lisibilité de la colonne collante avec 14 lignes dans la section
   « Aliments » déployée.
10. `npx vitest run` (attendu ≥ 8333 tests, 0 échec) et `npm run build` avant de considérer la
    story terminée.

