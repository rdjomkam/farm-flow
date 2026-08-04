# Pré-analyse — Sprint PR2-ter, Story PR2ter.2 — 2026-08-03

Deux bugs de cycle de vie des dialogues du module Prévisions (BUGFIX, pas une story de feature).

## Statut : GO AVEC RÉSERVES

Le fix est bien scopé, mais **le point 5 (non-régression) est le vrai risque** : aucun test
existant ne couvre ni le clic extérieur, ni la réouverture d'un dialogue après fermeture — les deux
scénarios exacts des bugs. Le harnais (jsdom + Testing Library + `next-intl` mocké) est capable de
les couvrir, mais rien de comparable n'existe aujourd'hui dans le dépôt : il faudra l'écrire de zéro,
avec au moins un polyfill (`hasPointerCapture`/`scrollIntoView`, déjà précédenté pour Radix Select)
et probablement un contournement pour le clic hors dialogue sous jsdom (Radix écoute `pointerdown`
sur `document`, jsdom ne l'implémente que partiellement).

---

## 1. Diagnostic de cause racine du Bug B — prouvé par lecture du code

**Fichier :** `src/components/previsions/scenario-form-dialog.tsx`

Mécanisme exact, dans l'ordre :

1. **`ScenarioFormDialog` est monté une seule fois, de façon statique**, dans
   `src/components/previsions/scenarios-list-client.tsx:62` :
   `<ScenarioFormDialog onCreated={(s) => setScenarios((prev) => [s, ...prev])} />` — pas de
   montage/démontage conditionnel par le parent. Le composant React qui possède le `useState<FormState>`
   (ligne 97) ne se démonte donc **jamais** entre deux ouvertures du dialogue : seul l'état interne
   `open` (Radix) bascule, le composant propriétaire de `form` reste le même toute la vie de la page.
2. **Tous les champs sont des inputs contrôlés** (`value={form.code}`, etc., lignes 172-334) — ce
   n'est donc **pas** un bug `defaultValue`/non-contrôlé, **pas** un problème de `key` React
   manquante sur `DialogContent` (il n'y en a jamais eu besoin), **pas** un `useEffect` d'hydratation
   qui append (il n'y a **aucun** `useEffect` dans ce fichier), et **pas** un `reset()` de
   react-hook-form mal placé — react-hook-form n'est pas utilisé ici, le commentaire d'en-tête
   (lignes 8-10) le confirme explicitement : « pas de react-hook-form/zod côté client dans ce dépôt ».
3. **`setForm(EMPTY_STATE)` n'est appelé qu'à un seul endroit : dans la branche de succès de
   `handleSubmit`** (ligne 145), après un POST réussi. Aucun autre chemin de fermeture ne réinitialise
   `form` :
   - Le bouton Annuler (ligne 339) : `onClick={() => setOpen(false)}` — pas de reset.
   - `onOpenChange={setOpen}` (ligne 154) — c'est la fonction appelée par Radix sur clic extérieur
     ET sur Échap (`onEscapeKeyDown`) : les deux ne font que `setOpen(false)`, jamais de reset.
4. **Conséquence directe et suffisante à elle seule** : à la réouverture, les inputs contrôlés
   se réaffichent immédiatement avec l'ancien `form` (pas vide). Ce n'est **pas un bug de rendu
   invisible** — le formulaire est visuellement déjà rempli avec les anciennes valeurs à la
   réouverture. La **concaténation littérale** (`EXCEL-V12EXCEL-V12`) n'est donc pas produite par le
   code React lui-même (aucune ligne du composant ne fait de concaténation de chaîne sur les champs
   texte) : c'est la conséquence, côté DOM/utilisateur, du fait de retaper/coller la même valeur dans
   un champ déjà pré-rempli sans sélectionner-tout au préalable — le navigateur insère au niveau du
   curseur dans un `<input>` contrôlé qui contient déjà `"EXCEL-V12"`. Le bug applicatif à corriger
   est donc bien **« l'état ne se réinitialise sur aucun chemin de fermeture autre que le succès »**
   — pas une subtilité de rendu, de `key`, ou de hooks. C'est la conjonction de deux faits, tous
   deux nécessaires et suffisants : (a) le composant propriétaire du state ne se démonte jamais entre
   deux ouvertures, et (b) aucun reset n'existe sur les chemins Annuler/clic extérieur/Échap.

**Fix minimal et suffisant** : dans `handleOpenChange(next: boolean)`, appeler `setForm(EMPTY_STATE)`
(+ `setErrors({})`) chaque fois que `next === false`, quelle que soit la cause de fermeture — exactement
le patron déjà démontré dans `generer-plan-dialog.tsx` (voir section 2, ligne 76-79), pas une
invention.

---

## 2. Inventaire exhaustif des 10 dialogues

Confirmé : la liste des 10 est bien exhaustive dans `src/components/previsions/` — `ls
src/components/previsions/*.tsx` ne fait apparaître **aucun** autre fichier `*-dialog.tsx` que les
10 cités. Aucun dialogue supplémentaire du module n'existe.

| Dialogue | Bug A (clic extérieur / Échap ferme sans avertir) | Bug B (pas de reset à la fermeture) | Preuve (ligne de code) |
|---|---|---|---|
| `scenario-form-dialog.tsx` | **Oui** | **Oui** | L.154 `onOpenChange={setOpen}` (aucun `onInteractOutside`) ; reset uniquement L.145 (succès), Annuler L.339 sans reset |
| `aliment-form-dialog.tsx` | **Oui** | **Oui** | L.84 `onOpenChange={setOpen}` ; reset uniquement L.71-76 (succès), Annuler L.134 sans reset |
| `vague-prevue-form-dialog.tsx` | **Oui** | **Oui** | L.79 `onOpenChange={setOpen}` ; reset uniquement L.66-71 (succès), Annuler L.127 sans reset |
| `poste-form-dialog.tsx` | **Oui** | **Oui** | L.78 `onOpenChange={setOpen}` ; reset uniquement L.68-70 (succès), Annuler L.114 sans reset |
| `apport-form-dialog.tsx` | **Oui** | **Oui** | L.85 `onOpenChange={setOpen}` ; reset uniquement L.73-77 (succès), Annuler L.123 sans reset |
| `journal-form-dialog.tsx` | **Oui** | **Oui, aggravé** | L.93 `onOpenChange={setOpen}` ; **aucun reset même en cas de succès** (L.82-86 : `onSaved(...)`, `setOpen(false)`, `setError(null)` — jamais `setDate("")`/`setLibelle("")`/etc.). L'instance « nouvelle ligne » (`journal-tab.tsx:47`) est statique — la réouverture après une création réussie réaffiche déjà les valeurs de la création précédente |
| `repartition-mois-dialog.tsx` | **Oui** | **Oui (variante sans concaténation)** | L.87 `<DialogTrigger asChild>{trigger}</DialogTrigger>` sur `onOpenChange={setOpen}` (L.86) ; `valeurs` initialisé une seule fois par lazy `useState` (L.51-57) à partir des `repartitions` du moment du **premier** montage — jamais réinitialisé sur Annuler (L.136) ni sur clic extérieur. Une saisie abandonnée puis la réouverture réaffiche l'édition abandonnée, pas la valeur enregistrée. Pas de concaténation car chaque `onChange` (L.127-129) remplace intégralement la valeur du mois — le symptôme visible serait une valeur résiduelle, pas un doublement de chaîne |
| `generer-plan-dialog.tsx` | **Oui (partiel — champ court, peu d'impact)** | **Non — patron de référence** | L.68-74 `reset()` + L.76-79 `handleOpenChange` : `if (!next) reset()` — appelé sur **tout** chemin de fermeture (Annuler L.211, succès L.114-115, et implicitement clic extérieur/Échap via `onOpenChange={handleOpenChange}` L.125). Bug A reste présent techniquement (pas de garde `onInteractOutside`) mais le formulaire ne fait qu'1-2 champs et aucune écriture n'a eu lieu avant la confirmation — impact pratique bien moindre |
| `scission-dialog.tsx` | **Oui** | **Oui (variante)** | L.132 `<Dialog open onOpenChange={onOpenChange}>` (aucun `onInteractOutside`) ; `lignes` réinitialisées seulement quand `parent.id !== derniereCibleId` (L.77-81) — càd seulement au changement de **cible**, jamais à la réouverture de la **même** cible après un Annuler. Composant monté statiquement dans `plan-vagues-tab.tsx:221`, `parent` bascule entre `null` et l'objet cible |
| `rattacher-vague-dialog.tsx` | **Oui** | **Oui (impact faible — un seul champ Select)** | L.93 `onOpenChange={setOpen}` ; `setVagueId("")` seulement en cas de succès (L.84), pas sur Annuler (L.131) ni clic extérieur. Un seul champ `Select` (pas de saisie libre) — pas de risque de concaténation, juste une pré-sélection résiduelle |

**Aucun autre dialogue du module n'existe en dehors de ces 10** (confirmé par `ls`).

Point notable pour le @developer : **`generer-plan-dialog.tsx` est déjà le patron correct pour
Bug B** (`if (!next) reset()` dans `onOpenChange`) — le fix des 9 autres dialogues doit répliquer
exactement ce patron, pas en inventer un nouveau.

---

## 3. Arbitrage du Bug A

**Recherche exhaustive dans le dépôt** (`grep -rn` sur `src/components` et `src/app`) :
- `onInteractOutside` : **0 occurrence**
- `onPointerDownOutside` : **0 occurrence**
- `onEscapeKeyDown` : **0 occurrence**
- `modal={false}` / `modal:false` : **0 occurrence**
- `isDirty` : 2 occurrences (`admin-site-modules-editor.tsx`, `backoffice-site-modules-editor.tsx`)
  — mais **sans rapport avec un Dialog** : ce sont des pages d'édition inline, `isDirty` ne sert qu'à
  activer/désactiver un bouton Enregistrer, pas à bloquer une fermeture.
- Composant `AlertDialog` : **n'existe pas dans le dépôt** (`find src -iname "*alert-dialog*"` ne
  retourne rien) et `@radix-ui/react-alert-dialog` **n'est pas une dépendance** de `package.json`
  (seuls `@radix-ui/react-dialog` et `@radix-ui/react-select` y figurent).
- Aucun usage de `confirm()` natif du navigateur lié à la fermeture d'un dialogue — les 2 seuls
  usages (`config-elevage-list-client.tsx`, `placeholders-client.tsx`) confirment une **suppression**,
  jamais un abandon de saisie.

**Verdict : il n'existe aucun patron établi dans ce dépôt pour ce problème — tout est à inventer.**
Mais entre les deux options proposées, celle à retenir est **(a) `onInteractOutside`/`onPointerDownOutside`
+ `preventDefault()` conditionné à un `isDirty` local**, pour trois raisons factuelles, pas une
préférence stylistique :
1. **Coût zéro en dépendances** : `onInteractOutside` est une prop déjà exposée par
   `@radix-ui/react-dialog@1.1.15` (déjà installé) sur `DialogPrimitive.Content` — il suffit de la
   faire remonter à travers le wrapper `DialogContent` (`src/components/ui/dialog.tsx`), qui utilise
   déjà `forwardRef` + spread de `...props` (L.30-53) : `onInteractOutside` passera donc déjà
   au primitive Radix sans modification du wrapper. Aucune nouvelle dépendance à ajouter.
2. **(b) demanderait `@radix-ui/react-alert-dialog`**, une dépendance absente, ET un second Dialog
   imbriqué (anti-patron Radix : les dialogues modaux imbriqués posent des problèmes de focus-trap
   documentés) — un coût et un risque bien plus élevés pour un cas dont la solution native existe déjà.
3. Cohérent avec ADR-053 (moteur découplé, discipline de code plutôt que mécanisme lourd) et avec
   l'esprit R6/R5 du dépôt : réutiliser le primitive existant plutôt qu'ajouter une pièce d'UI neuve.

**Échap doit être couvert de façon identique**, pas seulement le clic extérieur : `onEscapeKeyDown`
présente exactement le même risque de perte silencieuse (Radix appelle `onOpenChange(false)` de la
même façon pour les deux événements), et rien dans le code actuel ne les distingue déjà. Traiter l'un
sans l'autre laisserait un trou identique par un chemin différent.

**Portée du guard** : conditionner `preventDefault()` à un `isDirty` calculé localement par
dialogue (ex. `Object.values(form).some((v) => v !== EMPTY_STATE[...])` ou plus simple, un flag
`touched` mis à `true` au premier `onChange`) — ne bloquer la fermeture que si l'utilisateur a
commencé à saisir, jamais sur un dialogue encore vierge (sinon on réintroduit une friction inutile
sur le cas nominal « ouvrir puis fermer sans rien taper »).

---

## 4. Composant partagé ou 10 corrections dupliquées ?

**Recommandation : NE PAS créer un `FormDialog` générique qui restructurerait les 10 composants.**
Créer en revanche **un petit hook partagé, pas un wrapper de composant**, ex.
`src/hooks/use-dialog-close-guard.ts`, exposant une fonction qui prend `isDirty: boolean` et retourne
les deux handlers `{ onInteractOutside, onEscapeKeyDown }` à spreader sur `<DialogContent>`.

Justification du refus d'un `FormDialog` générique :
- Les 10 dialogues n'ont **pas** une forme homogène : `scenario-form-dialog`/`aliment-form-dialog`/etc.
  possèdent leur propre `useState<string>` par champ (pas un objet `form` uniforme — cf.
  `poste-form-dialog`/`apport-form-dialog` avec des champs `Select` typés enum, pas des strings) ;
  `scission-dialog` et `generer-plan-dialog` gèrent un flux **multi-étapes** ou une liste dynamique
  de lignes ; `scission-dialog` n'a même pas de `DialogTrigger` (contrôle externe via `parent`/
  `onOpenChange`, cf. commentaire L.12-16 du fichier) ; `journal-form-dialog` et
  `repartition-mois-dialog` prennent un `trigger: React.ReactNode` en prop plutôt qu'un bouton
  interne. Un wrapper générique devrait absorber toutes ces variations ou les répliquer en props —
  ce qui revient à un composant aussi complexe que ce qu'il remplace.
- **10 fichiers déjà validés en review (PR2/PR2-bis, R5 confirmé partout)** : les toucher tous via un
  refactor structurel (changer leur JSX racine pour un wrapper commun) multiplie le risque de
  régression sur des composants qui fonctionnent par ailleurs correctement, pour un bug qui ne
  touche que le cycle de vie de fermeture/réouverture — un problème strictement localisé.
- Le patron correct existe **déjà** dans le dépôt (`generer-plan-dialog.tsx`, `if (!next) reset()`)
  — le fix est une réplication ciblée de 3-5 lignes par dialogue (ajouter/étendre `handleOpenChange`
  + spreader les 2 handlers du hook sur `DialogContent`), pas une réécriture.

Le hook partagé évite quand même la duplication du **texte i18n de la garde** (message d'avertissement
si applicable — voir section 6, pas de confirmation modale requise avec l'option (a) retenue, donc
pas de nouvelle chaîne visible nécessaire pour le clic extérieur/Échap lui-même, seulement le blocage
silencieux du `preventDefault()` — à confirmer avec le PM/l'architecte si un feedback visuel minimal
est souhaité, ex. un toast "Formulaire non enregistré" — hors périmètre strict du diagnostic mais à
trancher avant l'implémentation).

---

## 5. Stratégie de test de non-régression — POINT LE PLUS RISQUÉ

**Harnais existant** : `@testing-library/react@16.3.2` + `@testing-library/user-event@14.6.1` +
`jsdom@28.1.0`, sous Vitest 4, environnement `@vitest-environment jsdom` par fichier (pas global —
`vitest.config.ts` a `environment: "node"` par défaut, chaque fichier de test de composant porte son
propre commentaire `// @vitest-environment jsdom`).

**Fichiers de test existants pour ces dialogues** (`src/components/previsions/__tests__/`) :
- `scenario-form-dialog.test.tsx` : 1 seul test, sur le texte d'aide contextuelle (ERR-141/142) —
  **aucune couverture du cycle ouverture/fermeture/réouverture**.
- `rattacher-vague-dialog.test.tsx` : couvre l'ouverture (`fireEvent.click`), la sélection Radix
  Select, R5 — **aucun test de fermeture par clic extérieur, Échap, ou réouverture**.
- `scission-dialog.test.tsx` : à vérifier au moment du fix, non lu en détail ici, mais son sujet
  déclaré (scission) suggère la même absence de couverture cycle de vie.
- **Aucun fichier `__tests__` n'existe pour les 7 autres dialogues** (`aliment-form-dialog`,
  `vague-prevue-form-dialog`, `poste-form-dialog`, `apport-form-dialog`, `journal-form-dialog`,
  `repartition-mois-dialog`, `generer-plan-dialog`) — zéro test dédié à ce jour.

**Le mock `next-intl` en place fonctionne** pour ce type de test : `scenario-form-dialog.test.tsx` et
`rattacher-vague-dialog.test.tsx` mockent déjà `next-intl` en résolvant les vraies clés depuis
`src/messages/fr/{previsions,common}.json` (pas un pass-through `key => key`) — directement
réutilisable pour les nouveaux tests de cycle de vie.

**Faisabilité du scénario « ouvrir → saisir → fermer → rouvrir → vérifier champs vides » sous jsdom :**
- **Ouvrir** : déjà prouvé faisable (`user.click`/`fireEvent.click` sur le trigger, contenu du
  Dialog trouvé via `screen.getByRole`/`getByText` malgré le `Portal` — Testing Library interroge
  `document.body`, pas le `container` local, donc les Portals Radix ne posent pas de problème ici).
- **Saisir** : `user.type(input, "valeur")` — standard, aucun piège connu.
- **Fermer par le bouton Annuler** : trivial (`fireEvent.click`/`user.click` sur un bouton normal).
- **Fermer par Échap** : `await user.keyboard('{Escape}')` — bien supporté par `user-event`, aucun
  piège connu, c'est un événement clavier standard.
- **Fermer par clic extérieur — le vrai piège.** Radix écoute `pointerdown` sur `document` pour son
  `DismissableLayer`. Deux risques concrets :
  1. **`user-event` v14 simule des séquences `PointerEvent` complètes** (`pointerdown`/`pointerup`/
     `click`) — mais **`jsdom` n'implémente qu'une version partielle de `PointerEvent`** selon les
     versions ; `rattacher-vague-dialog.test.tsx` a déjà dû polyfiller `hasPointerCapture`/
     `setPointerCapture`/`releasePointerCapture`/`scrollIntoView` (L.58-69) pour faire fonctionner
     un simple clic d'ouverture de `@radix-ui/react-select` — **le même risque existe pour tout clic
     géré par le `DismissableLayer` de Radix Dialog**, à vérifier expérimentalement plutôt qu'à
     supposer réglé.
  2. Cliquer un élément hors du contenu du dialogue nécessite de cibler un nœud du DOM qui est
     réellement en dehors du `DialogPrimitive.Content` **et** cliquable sous jsdom sans hériter
     `pointer-events: none` — `document.body` convient normalement, mais il faut vérifier qu'aucune
     classe `pointer-events-none` n'est appliquée dynamiquement par Radix pendant l'état ouvert
     (le dépôt a déjà un ERR documenté sur les conflits `pointer-events`/z-index avec l'overlay
     décoratif — pas le même sujet, mais un signal que ce point mérite une vérification explicite,
     pas une supposition).
  3. **Animations Radix (`data-[state=open]:animate-in`, etc.)** : sans polyfill CSS/`getComputedStyle`
     réel sous jsdom, ces classes n'ont aucun effet — pas un piège ici (contrairement à un test e2e
     réel), mais à ne pas négliger si un jour ces tests migrent vers Playwright.
- **Vérifier les champs vides à la réouverture** : trivial une fois la réouverture obtenue — relire
  les mêmes `input` par `getByLabelText`/`getByRole` et vérifier `.value === ""`.

**Conclusion sur ce point** : le scénario est réalisable, mais **doit être vérifié expérimentalement
dès la première tentative d'implémentation** (pas supposé fonctionner par analogie avec le polyfill
Select) — si le clic extérieur simulé ne déclenche pas `onPointerDownOutside`/`onInteractOutside`
sous jsdom malgré le polyfill, un test alternatif plus direct reste possible : appeler
`fireEvent(dialogContentElement, new Event("pointerdown", ...))` en ciblant explicitement
`document.body`, ou tester le comportement de plus bas niveau (appeler directement le handler
`onInteractOutside` passé en prop, sans dépendre de la simulation d'événement réelle de Radix) —
cette dernière option est un repli acceptable si la simulation d'événement échoue, car elle teste
quand même que le handler existe et fait bien `preventDefault()` quand `isDirty`.

---

## 6. Fichiers à créer / modifier

**À créer :**
- `src/hooks/use-dialog-close-guard.ts` (hook partagé, section 4) — nouvelle logique, aucun `any`,
  typé strictement.
- `src/hooks/__tests__/use-dialog-close-guard.test.ts` (test unitaire du hook, isolé du DOM).
- Un test de cycle de vie par dialogue dans `src/components/previsions/__tests__/` pour les 7
  dialogues sans fichier de test existant : `aliment-form-dialog.test.tsx`,
  `vague-prevue-form-dialog.test.tsx`, `poste-form-dialog.test.tsx`, `apport-form-dialog.test.tsx`,
  `journal-form-dialog.test.tsx`, `repartition-mois-dialog.test.tsx`, `generer-plan-dialog.test.tsx`
  (ce dernier pour couvrir/documenter que Bug B y est déjà absent — test de non-régression sur le
  patron de référence, pas un fix).

**À modifier (fix Bug A + Bug B) :**
- `src/components/previsions/scenario-form-dialog.tsx`
- `src/components/previsions/aliment-form-dialog.tsx`
- `src/components/previsions/vague-prevue-form-dialog.tsx`
- `src/components/previsions/poste-form-dialog.tsx`
- `src/components/previsions/apport-form-dialog.tsx`
- `src/components/previsions/journal-form-dialog.tsx`
- `src/components/previsions/repartition-mois-dialog.tsx`
- `src/components/previsions/scission-dialog.tsx`
- `src/components/previsions/rattacher-vague-dialog.tsx`
- `src/components/previsions/generer-plan-dialog.tsx` (Bug A seulement — ajouter le guard
  `onInteractOutside`/`onEscapeKeyDown` pour cohérence, même si l'impact pratique y est faible ;
  Bug B n'y est pas présent, ne pas y toucher sur ce plan)

**À modifier (tests existants, si le comportement observable change) :**
- `src/components/previsions/__tests__/scenario-form-dialog.test.tsx` (étendre)
- `src/components/previsions/__tests__/rattacher-vague-dialog.test.tsx` (étendre)
- `src/components/previsions/__tests__/scission-dialog.test.tsx` (étendre — vérifier son contenu
  actuel avant de l'étendre, non relu en détail dans cette pré-analyse)

**i18n (rappel de contrainte)** : si une confirmation visible (ex. message d'erreur/aide expliquant
pourquoi le dialogue ne se ferme pas) est ajoutée suite au point 4, elle doit avoir des clés dans
`src/messages/fr/previsions.json` **et** `src/messages/en/previsions.json`, parité stricte (299 clés
actuellement selon la review PR2-bis — vérifier le nouveau total après ajout), accents français
corrects, aucune chaîne en dur dans le JSX.

**Ne pas toucher** : `src/lib/previsions/*`, tout ce qui touche au rapprochement/reprévision/exports
— hors périmètre absolu rappelé par la story.

---

## 7. Verdict GO / NO-GO

**GO AVEC RÉSERVES.**

Risques identifiés, dans l'ordre de sévérité pour la suite du sprint :
1. **Risque principal (section 5)** : la faisabilité du test « clic extérieur » sous jsdom n'est
   pas garantie a priori — un repli existe (tester le handler directement plutôt que la simulation
   d'événement complète), mais il faut le découvrir en écrivant le test, pas en le supposant acquis
   avant de commencer le développement.
2. **Risque de règle produit non tranchée** : le point 4 laisse ouverte la question d'un feedback
   visuel (toast/texte) quand la fermeture est bloquée — un blocage totalement silencieux (l'
   utilisateur clique dehors, rien ne se passe visuellement, aucune explication) peut être perçu
   comme un bug d'un autre genre (« le bouton fermer ne marche pas »). Recommandation : à défaut
   d'une confirmation modale (écartée en section 3), prévoir au minimum un indice visuel léger
   (légère secousse du dialogue, ou toast bref) — à trancher explicitement avant l'implémentation,
   pas laissé à l'appréciation du developer en cours de code.
3. **Risque de duplication de fix oublié** : 9 dialogues à corriger de façon identique — un test de
   non-régression par dialogue (section 6) est nécessaire précisément parce que rien ne garantit
   qu'un correctif appliqué à la main sur 9 fichiers soit appliqué de façon rigoureusement identique
   partout sans un test qui le vérifie fichier par fichier.

Prérequis avant de commencer : aucun bloquant technique — build et tests sont au vert (voir ci-dessous),
le patron de référence existe déjà dans le code (`generer-plan-dialog.tsx`), aucune dépendance à
ajouter.

---

## Build & Tests — chiffres exacts rejoués

- `npm run build` : **OK**, aucune erreur, toutes les routes (dont `/previsions/*`) compilées.
- `npx vitest run` : **267 fichiers de test (263 passés + 4 skippés), 7487 tests passés, 0 échec**
  (19 skipped, 26 todo, total déclaré 7532) — exactement la base de référence attendue par la story.
