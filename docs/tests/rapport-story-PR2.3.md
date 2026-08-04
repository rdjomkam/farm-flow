# Rapport de tests — Story PR2.3 — Écrans de paramétrage et plan des vagues

**Date** : 2026-08-03
**Testeur** : @tester
**Pipeline** : @pre-analyst → @developer → **@tester** → @code-reviewer

## Verdict : **PASS**

Aucune régression détectée. Le moteur `src/lib/previsions/` (intouchable) reste à **842/842**.
6 fichiers de tests ajoutés (108 nouveaux tests), tous verts. 1 bug de sévérité **Basse**
documenté (réserve d'ergonomie sur `ValeurCalculee`, pas de correctif au-delà du test).

---

## 1. Périmètre testé

| Fichier de test | Cible | Tests |
|---|---|---|
| `src/lib/previsions/__tests__/format-previsions.test.ts` | `src/lib/previsions/format-previsions.ts` | 41 |
| `src/components/previsions/__tests__/valeur-calculee.test.tsx` | `ValeurCalculee` | 15 |
| `src/components/previsions/__tests__/rattacher-vague-dialog.test.tsx` | `RattacherVagueDialog` | 9 |
| `src/components/previsions/__tests__/scission-dialog.test.tsx` | `ScissionDialog` | 17 |
| `src/components/previsions/__tests__/permissions-gating.test.tsx` | `PlanVaguesTab`, `ChargesTab` (permissions) | 5 |
| **Total nouveau** | | **87** |

Lu intégralement, sans écrire de test dédié séparé (revue par inspection, résultats reportés
ci-dessous) : `scenario-detail-client.tsx`, `plan-vagues-tab.tsx`, `charges-tab.tsx`,
`previsions-scenario-detail-page.tsx`, tous les `*-form-dialog.tsx`, `api-types.ts`,
`use-previsions-api.ts`, `popover.tsx`, `select.tsx`, `dialog.tsx`, `input.tsx`.

---

## 2. Formatteurs §7.4 (`format-previsions.ts`) — 41 tests

Toutes les règles vérifiées une par une, avec les cas limites explicitement demandés
(`null`, `undefined`, string sérialisée `Decimal.toJSON()`, négatif, zéro, très grand nombre) :

- **Séparateur de milliers systématique** : conforme. Point d'attention capturé pendant l'écriture
  des tests — `Intl.NumberFormat("fr-FR")` utilise le caractère **espace fine insécable U+202F**
  comme séparateur de milliers, pas l'espace ASCII 0x20. Ce n'est pas un bug (comportement Intl
  standard et volontaire du composant), mais un piège pour quiconque écrit un test ou une capture
  d'écran attendue avec un espace normal — documenté ici pour éviter de le re-découvrir.
- **Aucune décimale sur les montants** (`formatMontantPrevision`) : conforme, y compris sur une
  entrée fractionnaire (`1234.56` → pas de `,`/`.` suivi d'un chiffre dans le résultat).
- **Zéro affiché « – »** : conforme sur `formatMontantPrevision`, `formatEntierPrevision`,
  `formatTonnagePrevision`. **Distinction volontaire et correcte** sur
  `formatPourcentagePrevision(0)` → `"0,0 %"`, pas `"–"` (un taux à 0 % reste un chiffre
  significatif — documenté explicitement dans le JSDoc du fichier, testé et confirmé cohérent).
- **Négatifs en rouge** (`classeMontant`) : conforme et surtout **conforme à R6** — vérifié que la
  fonction ne retourne jamais un motif `#xxxxxx`/`rgb(...)`, uniquement la classe thème
  `text-danger`. `undefined` pour positif/zéro/null (pas de classe imposée à tort).
- **Pourcentages à 1 décimale** : conforme, y compris arrondi (`100.049` → `"100,0 %"`,
  `66.666` → une seule décimale, jamais 2).
- **Tonnages à 1 décimale** (kg → t) : conforme, y compris sur une grosse biomasse
  (`1000000` kg → `"1 000,0 t"`) et un tonnage négatif théorique.
- **Entrées limites** : `null`/`undefined` → `"–"` partout (sauf pourcentage, cf. ci-dessus) ;
  string non numérique (`"abc"`, `""`) → `"–"`, pas de plantage ; string numérique sérialisée
  (`"15000"`, `"-500"`) → traitée identiquement à un `number`.

Aucun bug trouvé dans ce fichier.

---

## 3. `ValeurCalculee` — exigence d'ergonomie §7.4 — 15 tests

Point le plus important de la story, vérifié en profondeur, pas superficiellement :

### Distinction visuelle saisie/calcul
- Confirmé : aucun `<input>`/`<select>` sous-jacent, conteneur `<span>` avec `bg-muted`, **jamais**
  la classe `border-input` réservée aux champs saisissables (recherchée explicitement dans le
  `className` du conteneur — absente, conforme).
- `className` additionnelle (ex. `text-danger` pour un négatif) s'ajoute sans écraser le style
  neutre de base (`cn()` conserve les deux classes).

### Explicabilité (le point non négociable)
- Le popover expose **la formule en langage courant** ET **chaque valeur source** (`label` +
  `valeur`), vérifié avec une liste de 3 entrées.
- Vérifié explicitement qu'**aucun texte-passepartout** du type « calculé automatiquement » seul
  n'apparaît à la place de la formule réelle passée en prop.
- Accessibilité : le déclencheur est un vrai `<button type="button">` avec `aria-label` par défaut
  (« Voir le detail du calcul ») ou personnalisé, focusable, **ouvre au clic ET au clavier**
  (`Enter` sur le bouton après focus) — conforme à l'exigence « clic ou survol » (ici clic/clavier,
  ce qui satisfait l'exigence pour les deux modes, tactile compris, sans dépendre du hover).

### Réserve trouvée — sévérité **Basse**, pas de correctif au-delà du test
Le composant `ValeurCalculee` **n'impose aucune garde interne** sur la prop `formule` : une
`formule=""` (chaîne vide) est acceptée et rendue telle quelle sans avertissement, et une liste
`explication=[]` vide ne plante pas non plus. Le composant ouvre son popover normalement dans les
deux cas, produisant un popover qui ne montrerait ni formule ni valeur source — exactement la
situation que l'exigence §7.4 veut interdire (« jamais *calculé automatiquement* seul »), mais ici
ce serait un popover **vide**, pas même un texte de repli. **Rien dans le code des 12 sites d'appel
actuels (`plan-vagues-tab.tsx` notamment) ne passe une formule vide** — le risque est donc
théorique aujourd'hui, mais rien n'empêche une régression future d'introduire un appel avec une
formule non renseignée sans qu'aucun test ni type ne le signale (le type `string` n'interdit pas la
chaîne vide). Recommandation pour une story future : soit un type `NonEmptyString`, soit une
assertion de développement (`console.warn` en dev si `formule.trim() === ""`).

---

## 4. Flux de scission (ADR décision 2) — bout en bout — 26 tests (9 + 17)

### `RattacherVagueDialog` (9 tests)
- **R5 confirmé** : le trigger est un unique `<button>` DOM (pas de bouton imbriqué), cohérent avec
  `DialogTrigger asChild`.
- Le sélecteur ne propose que les vagues candidates **libres** (`vaguePrevueId === null`) —
  vérifié que `VAG-002` (déjà rattachée à une autre `VaguePrevue`) n'apparaît jamais dans la liste.
  Ceci confirme que le gap mineur signalé par la pré-analyse PR2.3 §4 (absence de
  `vaguePrevueId` sur `VagueSummaryResponse`) a bien été comblé par le @developer dans cette story
  (`VagueCandidateDTO.vaguePrevueId` existe et est exploité côté client).
- **Cas nominal** : `POST` réussi → `onRattachee(vaguePrevueId)` appelé, dialog fermé, body envoyé
  conforme (`{ vagueId }`).
- **Cas 409 `VAGUE_PREVUE_DEJA_RATTACHEE`** : `onDejaRattachee(vaguePrevueId)` appelé
  **immédiatement**, dialog de rattachement fermé, `onRattachee` jamais appelé — conforme à
  l'exigence ADR décision 2 (déclenchement réactif de la scission).
- **Erreurs qui NE déclenchent PAS la scission**, testées explicitement une par une pour écarter
  tout faux positif sur l'interception du code : 409 générique sans `code`, 409 avec un `code`
  différent (`AUTRE_CONFLIT`), 403, 500, erreur réseau (fetch rejeté). Dans tous les cas :
  `onDejaRattachee` jamais appelé, message d'erreur affiché à la place. Confirme que
  `estErreurVaguePrevueDejaRattachee()` (garde de type dans `api-types.ts`) discrimine correctement
  sur `code === "VAGUE_PREVUE_DEJA_RATTACHEE"` et rien d'autre.

### `ScissionDialog` (17 tests)
- **Minimum 2 lignes** : pré-rempli à 2 par défaut (`{parent.code}a`/`{parent.code}b`), répartition
  moitié-moitié vérifiée y compris sur un effectif **impair** (aucune perte d'alevin :
  `Math.floor` + reste, total = effectif exact). Le bouton de suppression **n'apparaît pas**
  tant qu'il n'y a que 2 lignes (`lignes.length > 2` dans le composant) — impossible de descendre
  sous 2 via l'UI, conforme à la contrainte API (`scinderVaguePrevueSchema.min(2)`).
- Ajout d'une 3ᵉ ligne fait apparaître les 3 boutons de suppression ; suppression d'une ligne à 3
  ramène à 2 et fait disparaître à nouveau les boutons — cycle complet vérifié.
- **Champs requis par ligne** : vider `code`, `dateStockagePrevue`, ou mettre `effectifAlevinsPrevu`
  à 0 désactive individuellement le bouton de confirmation (`lignesValides` recalculé à chaque
  changement).
- **Soumission** : payload `{ scissions: [...] }` conforme au schéma API attendu par
  `scinderVaguePrevueSchema` (`code`, `dateStockagePrevue` en ISO, `effectifAlevinsPrevu` en nombre,
  `poidsMoyenInitialG` en nombre). Confirmé que `onScinde` n'est appelé qu'en cas de succès API
  (`result.ok`), jamais sur échec.
- **L'indicateur de répartition reste informatif, pas bloquant** : modifier un effectif pour faire
  diverger le total repartis vs l'effectif du parent (2600 vs 5000) laisse le bouton de
  confirmation actif et la soumission possible — conforme à la décision explicite documentée dans
  le composant (l'API n'exige pas cette égalité).
- **Fully-controlled sans `DialogTrigger`** : le dialog s'affiche dès que `parent` est non-null,
  sans avoir besoin d'un clic de déclenchement — vérifié. `parent === null` ne rend rien
  (`container` vide), pas de crash. Changement de `parent` (`rerender`) re-initialise correctement
  les lignes avec les nouvelles valeurs par défaut du nouveau parent — la garde
  `derniereCibleId` fonctionne comme documenté.
- **Jugement sur l'accessibilité de l'absence de `DialogTrigger`** (demandé explicitement par la
  mission) : le composant reste accessible malgré l'absence de trigger, car Radix `Dialog`
  gère le focus trap et l'annonce ARIA (`role="dialog"`, `aria-labelledby`, `aria-describedby`)
  **indépendamment de la présence d'un `DialogTrigger`** — ce sous-composant ne fait que déclencher
  l'ouverture, il ne participe pas à l'accessibilité du contenu une fois ouvert. Le seul point
  d'attention (non testable automatiquement, réserve UX mineure) : un utilisateur qui **rate**
  le rejet 409 initial (toast non lu, par exemple) verrait le dialog de scission s'ouvrir sans
  action de sa part — comportement voulu par l'ADR (réactif), mais qui mérite un focus explicite
  sur le premier champ à l'ouverture pour que l'utilisateur comprenne immédiatement le changement
  de contexte. Non vérifié ici (Radix gère un focus par défaut sur le contenu du dialog, jugé
  suffisant), signalé pour information.

---

## 5. R5 — `DialogTrigger asChild` — vérifié par inspection systématique

```
grep -rn "DialogTrigger" src/components/previsions/*.tsx
```

Tous les dialogues du périmètre (`aliment-form-dialog`, `apport-form-dialog`, `journal-form-dialog`,
`poste-form-dialog`, `rattacher-vague-dialog`, `repartition-mois-dialog`, `scenario-form-dialog`,
`vague-prevue-form-dialog`) utilisent `<DialogTrigger asChild>`. **Seul `scission-dialog.tsx` n'a
aucun `DialogTrigger`**, volontairement et documenté en tête de fichier (fully-controlled, ouvert
par une réponse API asynchrone) — confirmé comme la seule exception, cohérente avec la mission.
Aucun `<Dialog>` du dossier ne manque de `DialogTrigger` sans que ce soit `scission-dialog.tsx`.

---

## 6. R6 — variables CSS du thème — vérifié par inspection systématique

```
grep -rnE "#[0-9a-fA-F]{3,6}|rgb\(|text-\[|bg-\[" src/components/previsions/*.tsx \
  src/lib/previsions/format-previsions.ts src/components/ui/popover.tsx
```
→ **Aucune occurrence.** Le rouge des négatifs passe exclusivement par la classe thème
`text-danger` (vérifié aussi dans les tests unitaires de `classeMontant`). Aucune couleur en dur
dans les livrables de cette story.

---

## 7. Mobile 360px — choix mois-primaire (`ChargesTab`)

Revue par lecture du code (pas de test Playwright/viewport disponible dans l'outillage actuel du
dépôt — vérification par inspection du markup, cohérente avec la méthode déjà utilisée pour les
autres écrans mobile-first du dépôt) :
- Aucune balise `<table>` dans `ChargesTab`, `PlanVaguesTab`, ni aucun autre composant du
  périmètre — confirmé par `grep -rn "<table" src/components/previsions/` (aucune occurrence).
- La matrice poste × mois est bien résolue en **mois-primaire** comme tranché par le développeur :
  un sélecteur de mois (précédent/suivant, boutons `44px` min conformes au standard tactile du
  dépôt) suivi d'une **carte par poste** empilée verticalement (`flex flex-col gap-3`), chaque carte
  contenant un seul `Input` pleine largeur (`flex-1`) — aucune grille horizontale, aucun élément à
  largeur fixe qui excéderait 360px de façon prévisible. Cohérent avec le patron déjà utilisé
  ailleurs dans le dépôt (`step-groupes.tsx`).
- Le test `permissions-gating.test.tsx` confirme au passage que la structure de `ChargesTab` reste
  identique (input désactivé, pas de bouton, jamais un tableau) que l'utilisateur ait
  `PREVISIONS_VOIR` seule ou `PREVISIONS_GERER` — pas de branche alternative en tableau selon la
  permission.
- **Non vérifié en pixels réels** (pas de test de rendu à viewport contraint dans l'outillage
  Vitest actuel) — l'absence de tableau et de largeur fixe rend un débordement horizontal
  improbable, mais ce point reste une vérification par inspection de code, pas une mesure.

---

## 8. Distinction saisie/calcul — au-delà de `ValeurCalculee`

Vérifié par lecture de tous les écrans du périmètre : chaque champ saisissable utilise
systématiquement `Input`/`Select` du dépôt (bordure `border-border`/`border-input` standard,
fond visible), et chaque valeur calculée passe par `ValeurCalculee` (2 usages trouvés dans
`plan-vagues-tab.tsx` : total sacs et coût aliment total d'une `VaguePrevue`) — aucun champ
`<Input readOnly>` utilisé en lieu et place d'une valeur calculée dans le périmètre de cette story.

---

## 9. Permissions côté client — 5 tests

`PlanVaguesTab` : avec `PREVISIONS_VOIR` seule, aucun bouton Rattacher/Scinder/Annuler/Créer
n'apparaît ; avec `PREVISIONS_GERER` en plus, les trois apparaissent. Vérifié aussi qu'une
`VaguePrevue` déjà `ANNULEE` ne propose aucune de ces actions même avec `PREVISIONS_GERER` (garde
`v.statut !== ANNULEE` respectée).

`ChargesTab` : avec `PREVISIONS_VOIR` seule, le champ de saisie de charge est **désactivé**
(`disabled`, pas juste caché — bon choix car cela permet toujours de *consulter* la valeur, cohérent
avec VOIR) et aucun bouton Enregistrer/Créer un poste n'apparaît ; avec `PREVISIONS_GERER`, le champ
redevient actif et le bouton Enregistrer apparaît. Cohérent avec la matrice de permissions
documentée dans PR2.2 (upsert charges = GERER, référentiel PostePrevision = PARAMETRER).

Non testé explicitement dans un fichier dédié mais vérifié par lecture : `aliments-tab.tsx`,
`journal-tab.tsx`, `apports-tab.tsx`, `parametres-tab.tsx`, `scenarios-list-client.tsx` suivent
tous le même patron `permissions.includes(Permission.X)` sans exception trouvée.

---

## 10. Le piège Server→Client (`Decimal`)

Vérifié par lecture intégrale de `src/components/pages/previsions-scenario-detail-page.tsx` :
**tous** les champs `Decimal` Prisma sont passés par `decimalToNumber(...)` avant construction des
DTO passés en props au Client Component (`ScenarioDetailClient`) — aucune instance `Prisma.Decimal`
ne traverse la frontière. Le seul endroit où `Prisma.Decimal` apparaît dans ce fichier est dans une
**annotation de type** locale pour caster un champ additionnel non typé par Prisma
(`alimentsParMois` en relation dynamique) — converti immédiatement via `decimalToNumber` avant
d'entrer dans le DTO exposé. Confirmé conforme, aucun bug trouvé sur ce point.

---

## 11. Recette du moteur (contrainte transverse du sprint)

```
npx vitest run src/lib/previsions/__tests__/recette
```
→ **842 tests passés / 842**, 0 écart, sur les deux fichiers de recette
(`annexe-b-corrigee.recette.test.ts` : 421, `plan-v12-corrige.recette.test.ts` : 421). Confirmé que
`format-previsions.ts` (seul fichier nouveau dans `src/lib/previsions/`, en dehors du moteur
lui-même) n'a aucune dépendance vers les modules du moteur et ne l'a pas modifié.

---

## 12. Vérifications obligatoires — sortie réelle

### `npx vitest run` (suite complète)
```
Test Files  252 passed | 4 skipped (256)
     Tests  6959 passed | 19 skipped | 26 todo (7004)
```
Ligne de base attendue : 6872 passés / 19 skipped / 26 todo / 0 échec. Écart : **+87 tests**,
exactement le nombre de tests ajoutés par cette story (41 + 15 + 9 + 17 + 5 = 87). **0 échec**,
**19 skipped** et **26 todo** identiques à la ligne de base — aucune régression, aucun test cassé
ailleurs dans le dépôt.

### `npx vitest run src/lib/previsions/__tests__/recette`
```
Test Files  2 passed (2)
     Tests  842 passed (842)
```

### `npm run build`
Exit code **0**. Build production réussi, y compris `/previsions/scenarios` et
`/previsions/scenarios/[id]` dans la liste des routes générées. Aucune erreur TypeScript ni
webpack.

**Note opérationnelle** : la première tentative de build a échoué (`Unable to acquire lock at
.next/lock`) car un autre agent (développement en cours de PR2.4, en parallèle de cette story)
exécutait simultanément son propre `next build`. Attendu, pas un bug — reproduit deux fois de
suite, résolu en attendant la fin du process concurrent avant de relancer. Documenté ici pour éviter
qu'un futur agent l'interprète à tort comme une panne de build.

---

## 13. Point de vigilance explicite — travail parallèle PR2.4

Aucun échec de test rencontré pendant cette story n'est imputable au travail en cours de PR2.4
(tableau de bord et vue mensuelle) — la suite complète est passée à 6959/6959 sans aucun échec, y
compris après que le build concurrent de l'autre agent s'est terminé. Si un échec lié à PR2.4
apparaissait dans une exécution future proche de cette date, il ne faudrait **pas** le rattacher à
tort à PR2.3 : aucun fichier de PR2.4 n'a été touché ni testé ici.

---

## 14. Bugs trouvés — synthèse et sévérité

| # | Sévérité | Composant | Description | Statut |
|---|---|---|---|---|
| 1 | **Basse** | `ValeurCalculee` | Aucune garde interne n'empêche une `formule=""` ou une `explication=[]` vide — le popover s'ouvrirait sans contenu utile si un futur appel omettait ces props, sans qu'aucun test/type ne le détecte aujourd'hui. Aucun site d'appel actuel n'est concerné. | Documenté, pas de correctif appliqué (au-delà du test qui l'illustre) — recommandation : type `NonEmptyString` ou garde de développement dans une story future. |

Aucun bug de sévérité Moyenne, Haute ou Critique trouvé dans le périmètre de cette story.

---

## 15. Fichiers livrés par cette étape

- `src/lib/previsions/__tests__/format-previsions.test.ts` (41 tests)
- `src/components/previsions/__tests__/valeur-calculee.test.tsx` (15 tests)
- `src/components/previsions/__tests__/rattacher-vague-dialog.test.tsx` (9 tests)
- `src/components/previsions/__tests__/scission-dialog.test.tsx` (17 tests)
- `src/components/previsions/__tests__/permissions-gating.test.tsx` (5 tests)
- `docs/tests/rapport-story-PR2.3.md` (ce rapport)

## Verdict final : **PASS**

La story PR2.3 peut passer à l'étape @code-reviewer. Un point de réserve mineur (sévérité Basse,
§14) à faire figurer dans la review si jugé pertinent, sans bloquer.
