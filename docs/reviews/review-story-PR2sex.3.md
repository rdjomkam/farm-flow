# Review de story — PR2sex.3 (UI, sprint PR2-sexies)

**Reviewer** : @code-reviewer
**Date** : 2026-08-04
**Limite assumée (R9)** : pas d'outil shell. Aucune commande rejouée — appui sur les sorties rejouées et rapportées par @tester (`docs/tests/rapport-story-PR2sex.3.md`), croisées avec une lecture directe et complète du code (`previsions-mensuelles-tab.tsx` intégral, le fichier de test intégral, les deux fichiers i18n intégraux, `projection-types.ts`).

## Verdict : VALIDÉ AVEC RÉSERVES

Aucune réserve Critique ni Haute. Le refactor (extraction `EnTeteRepliable`/`LigneRow`) préserve strictement le motif ERR-157, le mécanisme de regroupement (`groupes?: SousSectionDescriptor[]`) généralise le système existant sans en créer un second, aucune granulométrie ni position de cycle n'est codée en dur, la distinction ROUND/ceil (ERR-161) est levée à deux niveaux (libellé visible + formule), et la parité i18n est stricte.

### 1. ERR-157 — motif à 2 cellules, préservé à la lettre
Lu ligne à ligne dans `src/components/previsions/previsions-mensuelles-tab.tsx:303-341` (`EnTeteRepliable`) : cellule collante **étroite** (`COLONNE_INDICATEUR_CLASSES`, jamais de `colSpan`), fond **opaque** `bg-muted` (pas `bg-muted/60`) — l.319 ; bande `colSpan={nbColonnesRestantes}` séparée, non collante, `aria-hidden="true"`, sans texte — l.338 ; réutilisée **à l'identique** pour le niveau section (l.748-753) et le niveau sous-section (l.770-775), aucune réimplémentation ad hoc.
Le test dédié `previsions-mensuelles-tab.test.tsx:579-600` vérifie que la sous-section produit exactement 2 `<td>`, que la cellule collante n'a pas de `colspan`, et que la bande de fond porte le bon `colSpan` et aucun texte — le test structurel le plus proche possible d'une garantie ERR-157 en jsdom.
Vérification Chromium réelle par @tester (§1 du rapport de test) : bounding box de l'en-tête « Détail par mois de cycle » identique à `scrollLeft=0` et `scrollLeft` max, à 375 px (`x=25,y=642`) et à 1280 px (`x=277,y=604`), fond `rgb(241,245,249)` opaque, `elementFromPoint` renvoie le libellé (pas une bande vide). C'est une preuve, pas une hypothèse — le point de vigilance n°1 est levé.

### 2. Un seul système, pas deux
`SectionDescriptor.groupes?: SousSectionDescriptor[]` (l.257-264) est un type frère minimal (pas de `defaultOpen` dupliqué — commentaire l.244-250), rendu après les `lignes` plates de la section parente, dans le même `<tbody>` (l.759-782). `sectionsOuvertes` reste un `Record<string, boolean>` unique avec clé composée (`"aliments.detailParVague"`, l.428, l.766). `LigneRow`, `calculerTotalLigne`, `formatLigne`, `ExplicationLigne` partagés sans branche par niveau. Aucune duplication entre rendu de section et de sous-section.

### 3. Aucune position de cycle ni granulométrie en dur
`detailPositionsEtGranules` (l.485-501) calcule l'union réelle des positions (`Object.keys(m.detailParVagueSacs)`) et des granulométries sur tous les mois — grep sur `1,2,3`/`"2mm"`/`"3mm"`/`"4mm"` : aucune occurrence. Tests adverses ajoutés par @tester (cycle à 4 positions, cycle à 1 position, l.394-458) exercent réellement la garantie.

### 4. ERR-161 — distinction consommés (ROUND) vs à commander (ceil)
Le libellé porte « indicatif » visible en permanence, sans ouvrir le popover (`fr/previsions.json:669` : `"Sacs {granule} consommés (indicatif) — Mois {count} du cycle"`). La formule (`fr/previsions.json:670`) nomme explicitement `ROUND`, cite la ligne voisine « dont sacs {granule} (total) » par son nom exact, et précise « arrondi PAR EXCÈS, ceil ». Testé (l.377-391) : `ROUND`, `À ACHETER`, `arrondi PAR EXCÈS, ceil` présents dans le texte rendu. Le risque n°1 d'incompréhension est désamorcé à deux niveaux, pas seulement en commentaire de code.

### 5. §7.4 — caractères Unicode et discipline de format
`formatEntierPrevision`/`formatLigne` réutilisés sans modification : zéro en `–` (U+2013), séparateur via `Intl.NumberFormat` (U+202F vérifié par @tester au niveau point de code). Les 9 lignes utilisent `format: "entier"` — aucune décimale. Unité (« Sacs ») portée uniquement par le libellé (testé l.507-526). Bouton d'explication sur chacune des 9 lignes. Négatifs via `classeMontant()` générique, aucun nouveau code couleur.

### 6. §7.1 — lisibilité en moins de 10 secondes
« Aliments » reste `defaultOpen: false` et le sous-groupe (l.638-644) est lui-même replié par défaut — l'écran initial n'est dégradé à aucun niveau. Une fois ouverts, les 9 lignes sont isolées du reste. C'est la seule option (parmi les 3 comparées en pré-analyse §2) n'ajoutant qu'un seul point de repli plutôt qu'un nombre variable selon `dureeCycleMois`. Jugement honnête : un tableau plat de 14 lignes aurait été un échec §7.1, évité ici par l'isolement en sous-groupe.

### 7. i18n
Parité stricte fr/en confirmée par lecture intégrale (406 clés annoncées par @tester ; recomptage non refait faute d'outil, structure identique clé par clé sur `previsionsMensuellesTab`). `page.detailTitle`/`page.backToList` absents des deux fichiers (grep `src/` = 0). Accents corrects (« Détail par mois de cycle », « consommés », « À ACHETER », « arrondi PAR EXCÈS »). Aucune chaîne en dur. `sectionToggleAria` n'existe plus du tout (grep négatif) — aucune clé orpheline.

### 8. R5/R6, accessibilité
`PopoverTrigger asChild` inchangé (l.347) — R5 OK. Aucune couleur hex en dur (grep négatif) — R6 OK (seule valeur `rgba(...)` = ombre portée, motif déjà accepté en PR2-quinquies). `aria-expanded` aux deux niveaux, `aria-hidden="true"` sur la bande non interactive.

### 9. Solidité de la vérification Chromium
Méthode sérieuse : mesures chiffrées (bounding box à `scrollLeft` 0/max, deux largeurs), couleur de fond calculée (pas seulement classe posée), `elementFromPoint` pour prouver qu'un vrai libellé occupe le point testé, colonne Total lue à l'écran et rapprochée du jeu d'or (1 543/867/– puis 385/3 471/4 820). Le piège rencontré (`.overflow-x-auto` partagé avec la liste d'onglets, faux négatif initial) est documenté et corrigé, ce qui renforce la crédibilité du rapport.
Non couvert, déclaré par @tester : position 3 du cumul (0/0/7 230) non capturée en pixels ; collision du popover à 375 px non ré-exercée pour ces 9 lignes ; rendu tactile non simulable sans émulation dédiée.

### 10. Flakiness — dette à ouvrir, hors périmètre
@tester mesure sur 2 passages une instabilité plus large que rapportée par le @developer (8 fichiers/19 tests contre 4/6) — tous dans des `*-form-dialog.test.tsx`, tous des timeouts (pas des divergences d'assertion), tous verts en isolation (47/47). Aucun ne touche `previsions-mensuelles-tab.tsx`. Dette de fiabilité de la suite, pas un défaut de cette story — mérite un signalement formel au @project-manager, car l'écart entre observations (19 vs 6) suggère que la flakiness varie d'une exécution à l'autre.

### 11. `any`, types, Server Components, secrets
Aucun `any` (grep négatif). `"use client"` nécessaire, `useState`/`useMemo` déjà présents avant cette story. Aucun secret (R11).

## Réserves priorisées

| # | Sévérité | Réserve | Fichier | Bloquant ? |
|---|---|---|---|---|
| 1 | Moyenne — signalement | Flakiness `*-form-dialog.test.tsx` plus large (8 fichiers/19 tests) qu'annoncé (4/6) — à ouvrir formellement comme dette de fiabilité | hors périmètre PR2sex.3 | Non |
| 2 | Basse | Position 3 du cumul (0/0/7 230) non capturée en pixels réels | `previsions-mensuelles-tab.tsx` | Non |
| 3 | Basse | Collision du popover non re-testée pour les 9 nouvelles lignes à 375 px | `previsions-mensuelles-tab.tsx`, `ui/popover.tsx` | Non |
| 4 | Basse | Rendu tactile réel non simulé (limite outillage déjà actée) | `previsions-mensuelles-tab.tsx` | Non |
| 5 | Basse | Écart mineur de comptage i18n (405 pré-analyse vs 406 confirmé) | `src/messages/{fr,en}/previsions.json` | Non |
| 6 | Info | Module non committé en git — empêche un `git diff` strict de non-régression ; mitigé par lecture exhaustive du fichier de test | — | Non |

## Verdict final
**VALIDÉ AVEC RÉSERVES.** Le refactor risqué est le point le mieux couvert de la story : préservation vérifiée par lecture, par test jsdom dédié, et par mesure Chromium réelle chiffrée à deux largeurs — aucune régression ERR-157. Le mécanisme de sous-section généralise l'existant sans duplication. La distinction ROUND/ceil est levée de façon lisible dans l'UI. Aucune valeur en dur. Réserves toutes Basses ou une Moyenne de signalement hors périmètre — aucune ne bloque la clôture.
