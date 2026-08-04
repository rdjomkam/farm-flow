# Pré-analyse — Story PR2oct.4 (UI) — Sprint PR2-octies

## Statut : **NO-GO EN L'ÉTAT** (dépendance non satisfaite) — voir Verdict

## Résumé
La chaîne UI est claire et bornée à deux composants (`vague-prevue-form-dialog.tsx`,
`parametres-tab.tsx`) plus leurs types/validation/routes/queries. Mais **le brief affirme que
PR2oct.2 est FAIT — c'est faux** : `docs/TASKS.md:7880` marque PR2oct.2 `EN COURS`, et PR2oct.3
`docs/TASKS.md:7881` est encore `TODO`. Vérification directe du code : `prisma/schema.prisma`
porte bien les deux colonnes (lignes 4451, 4602) et la migration
`20260805090000_add_vague_prevue_alevins_achetes` est appliquée, mais **aucune des couches
suivantes n'existe encore** : `src/types/models.ts` (aucune occurrence de `alevinsAchetes`),
`src/lib/queries/previsions-vagues.ts` (aucune occurrence), `src/lib/queries/previsions-scenarios.ts`
(aucune occurrence), `src/lib/validation/previsions.schema.ts` (aucune occurrence),
`src/components/previsions/api-types.ts` (aucune occurrence). Le moteur (PR2oct.3) n'a pas non
plus commencé. La story UI ne peut pas être livrée en amont de ces couches sans un formulaire qui
écrit dans le vide (champ envoyé par le payload, silencieusement absorbé par les schémas zod
actuels qui n'ont pas ce champ — `z.object` non-strict par défaut ignore les clés inconnues,
vérifié : aucun des schémas de `previsions.schema.ts` n'utilise `.strict()`).

## 1. Le formulaire d'édition d'une `VaguePrevue`

**Fichier : `src/components/previsions/vague-prevue-form-dialog.tsx`.** Patron de champ déjà en
place pour les 4 champs existants (`code`, `dateStockagePrevue`, `effectifAlevinsPrevu`,
`poidsMoyenInitialG`, lignes 170-216) : composant `Input` (`src/components/ui/input.tsx`) piloté
par un `useState` par champ, `onChange` qui met à jour l'état **et** `setTouched(true)` (garde de
fermeture, R5-adjacent), erreur affichée via la prop `error`. **Aucun booléen n'est déjà présent
dans ce dialogue** — il faut importer un nouveau patron.

Le seul patron « checkbox de formulaire métier » du dépôt (le composant `ui/` n'a ni `Switch` ni
`Checkbox` — confirmé, `ls src/components/ui/` ne renvoie aucun de ces deux noms) est celui de
`src/components/config-elevage/config-elevage-form-client.tsx:469-488` :
```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input type="checkbox" checked={form.isDefault} onChange={(e) => handleBoolean("isDefault", e.target.checked)}
         className="rounded border-input" />
  <span className="text-sm">{t("fields.profilParDefaut")}</span>
</label>
```
`border-input` est une classe Tailwind mappée sur une variable CSS du thème (R6 respectée, pas de
couleur en dur). Ce patron doit être répliqué, **pas** le toggle de
`src/components/backoffice/feature-flag-toggle.tsx:204-222` (bouton `role="switch"` avec animation
translate-x) : ce dernier est pensé pour un flag admin isolé avec confirmation, hors registre d'un
champ de formulaire multi-champs comme celui-ci — introduire un deuxième style de booléen dans le
même module (le premier étant le futur checkbox du formulaire vague/paramètres) créerait une
incohérence visuelle sans bénéfice.

**Insertion proposée** : juste après le bloc `poidsMoyenInitialG` (ligne 216), dans le même
`<div className="flex flex-col gap-3">` (lignes 169-217) — un champ de plus dans la liste
verticale, cohérent avec le style empilé mobile-first déjà en place.

## 2. Écran des paramètres du scénario

**Fichier : `src/components/previsions/parametres-tab.tsx`.** Deux mécanismes coexistent ici, à ne
pas confondre :

- Les 15 champs numériques (`CHAMPS` ligne 35-45 + `CHAMPS_TRANSPORT` ligne 47-54) sont pilotés par
  une **boucle générique** (`values: Record<string, string>`, conversion `Number(raw)` uniforme à
  l'enregistrement, ligne 173-177). **`alevinsAchetesParDefaut` ne peut PAS rejoindre cette boucle**
  : c'est un booléen, la boucle produit `Number(raw)` pour chaque clé sans exception. Il faut un
  état séparé (`const [alevinsAchetesParDefaut, setAlevinsAchetesParDefaut] = useState(...)`,
  initialisé depuis `scenario.parametres?.alevinsAchetesParDefaut ?? false`) et l'ajouter
  explicitement au corps du `PUT` dans `handleSaveParametres` (ligne 169-189) — sinon silencieusement
  jamais envoyé.
- Le patron visuel à réutiliser est celui de `config-elevage-form-client.tsx` (section 1), inséré
  dans la même `FormSection` que `CHAMPS` (ligne 281-306) — proposition : juste après la boucle
  `CHAMPS.map`, avant la fermeture de `</FormSection>` (ligne 306), pour rester dans la section
  « Paramètres du scénario » (titre `t("parametresTab.sectionTitle")`) et non dans la section
  Transport, qui n'a pas de rapport métier avec ce drapeau.
- `disabled={!peutParametrer}` doit s'appliquer à la checkbox exactement comme aux `Input`
  existants (ligne 292, 319) — la permission `PREVISIONS_PARAMETRER` gouverne ce champ au même titre
  que les autres.

### Cohabitation avec `prixAlevinUnitaireFCFA`

**Tranché par l'ADR-053 §14.4 (`docs/decisions/ADR-053-module-previsions.md:2078-2105`) et confirmé
par la pré-analyse PR2oct.2 (§3) : `prixAlevinUnitaireFCFA` reste TOUJOURS saisi, affiché, éditable
— jamais masqué, jamais désactivé, quelle que soit la valeur du drapeau.** Il n'existe **aucun**
patron « champ informatif mais inapplicable » dans ce fichier ni ailleurs dans
`src/components/previsions/` (recherché : aucun `disabled={...inapplicable...}` conditionné par un
autre champ, aucun état "grisé mais visible" dans ce module). Le seul mécanisme d'information
contextuelle existant est le `hint` de `Input` (`CHAMPS_AVEC_HINT`, ligne 85-89, déjà utilisé pour
`margeSecuriteAlevinsPct`, `nombreBacsSimultanesCible`, `tauxEpargnePct` — un texte d'aide sous le
champ, jamais un état désactivé). **Décision proposée pour cette story** : ajouter
`prixAlevinUnitaireFCFA` à `CHAMPS_AVEC_HINT` avec un hint expliquant que ce prix ne s'applique
qu'aux vagues dont le drapeau « Alevins achetés » est actif — cohérent avec le patron existant,
sans complexité supplémentaire, et sans jamais désactiver le champ (ce qui violerait §14.4
explicitement). **Ne pas** inventer un style visuel « grisé » pour ce champ : ce serait un nouveau
patron pour un seul champ, alors que l'ADR interdit précisément l'impression que le champ est
inapplicable.

## 3. Chaîne complète bout en bout — maillons à modifier

Ordre : formulaire → validation zod → route API → query → Prisma.

**Chaîne VaguePrevue (création/édition, un seul booléen `alevinsAchetes`) :**
1. `src/components/previsions/vague-prevue-form-dialog.tsx` — état + champ + payload
   (`handleSubmit`, ligne 106-150 : ajouter `alevinsAchetes` au `payload` ligne 110-115).
2. `src/components/previsions/api-types.ts:148-160` (`VaguePrevueListItemDTO`) — **maillon qui filtre
   en silence aujourd'hui** : ce type ne porte pas `alevinsAchetes`. TypeScript n'empêchera pas la
   route de répondre avec le champ (elle retourne l'objet Prisma brut, cf. §8.1 de la story
   PR2oct.2), mais tout code qui lit `vaguePrevue.alevinsAchetes` sur ce type échouera à la
   compilation tant que le DTO n'est pas étendu.
3. `src/lib/validation/previsions.schema.ts:230-239` (`createVaguePrevueSchema`,
   `updateVaguePrevueSchema`) — **absent aujourd'hui**. `z.object` n'étant pas `.strict()` dans ce
   fichier (vérifié, aucune occurrence de `.strict()` dans tout le fichier), un payload contenant
   `alevinsAchetes` sans que le schéma le déclare serait **silencieusement dépouillé par zod**
   (`z.object(...).parse()` ignore les clés non déclarées par défaut) avant même d'atteindre la
   query — c'est le maillon-piège le plus dangereux de la chaîne : aucune erreur, le champ
   disparaît juste.
4. `src/app/api/previsions/scenarios/[id]/vagues/route.ts` (POST) et
   `src/app/api/previsions/vagues-prevues/[id]/route.ts` (PUT) — **aucune modification attendue** :
   ces routes sont de purs relais (`parsed.data` transmis tel quel aux queries, lignes 54-57 et
   54-57 respectivement) — une fois le schéma zod étendu, le champ traverse sans changement de
   route.
5. `src/lib/queries/previsions-vagues.ts` — **absent aujourd'hui, silent-drop confirmé** :
   `CreateVaguePrevueDTO` (ligne 61-66), `UpdateVaguePrevueDTO` (76-81), `ScissionVaguePrevueDTO`
   (83-88) n'ont pas le champ ; `createVaguePrevue` construit `data: {...}` en énumérant
   explicitement chaque champ (ligne 181-192) — un champ absent de cette énumération n'est **jamais
   écrit**, même si `data.alevinsAchetes` existe côté DTO ; `updateVaguePrevue` fait de même via
   spreads conditionnels (ligne 216-225). Ce fichier appartient au périmètre SCHEMA (PR2oct.2) selon
   sa propre pré-analyse (§8), pas à cette story UI — **prérequis bloquant, pas un détail**.
6. `prisma.vaguePrevue.create`/`updateMany` — une fois 5. fait, Prisma écrit la colonne (déjà en
   base, migration appliquée).

**Chaîne ParametresPrevision (défaut `alevinsAchetesParDefaut`) :**
1. `src/components/previsions/parametres-tab.tsx` — état séparé + checkbox + ajout au corps du PUT
   (§2 ci-dessus).
2. `src/components/previsions/api-types.ts:34-53` (`ParametresPrevisionDTO`) — absent, même défaut
   qu'au point 2 ci-dessus.
3. `src/lib/validation/previsions.schema.ts:58-80` (`parametresPrevisionCreateSchema`, dont
   `updateParametresPrevisionSchema` dérive par `.partial()` ligne 92) — absent, même piège de
   silent-drop zod que ci-dessus.
4. `src/app/api/previsions/scenarios/[id]/parametres/route.ts` — relais pur, aucune modification
   attendue une fois 3. fait.
5. `src/lib/queries/previsions-scenarios.ts` — **absent aujourd'hui, ET absent de la pré-analyse
   PR2oct.2 (§8 de ce document ne le liste pas)** : c'est une lacune de la pré-analyse précédente,
   à signaler explicitement au @knowledge-keeper. `ParametresPrevisionCreateDTO` (ligne ~53),
   `UpdateParametresPrevisionDTO` (ligne 72-...) n'ont pas le champ ; `createScenario` (ligne 142,
   écriture explicite ligne 191) et `updateParametresPrevision` (ligne 364, écriture conditionnelle
   ligne 396-398) filtrent en silence de la même façon que `previsions-vagues.ts`. **Ce fichier doit
   être ajouté au périmètre de PR2oct.2 (ou couvert explicitement par PR2oct.3), sinon la story UI
   pousse un champ qui n'atteint jamais la base même une fois le schéma zod corrigé.**
6. `prisma.parametresPrevision.create`/`update` — une fois 5. fait, écrit la colonne.

**Chaîne scission (`scinderVaguePrevue`)** : `ScissionVaguePrevueDTO`
(`previsions-vagues.ts:83-88`) et `scinderVaguePrevueSchema`
(`previsions.schema.ts:241-244`, dérivé de `createVaguePrevueSchema`) n'exposent pas
`alevinsAchetes` en saisie — cohérent avec le patron déjà en place pour `dureeCycleMoisFigee` (copié
depuis le parent, jamais resaisi par l'utilisateur, cf. JSDoc `previsions-vagues.ts:236-247`). **Le
drapeau doit être copié depuis le parent côté query** (`scinderVaguePrevue`, ligne 249-299,
écriture ligne 273-286), **pas exposé dans `scission-dialog.tsx`** — cohérent avec la pré-analyse
PR2oct.2 (§2) qui tranche déjà ce point. Aucune modification UI attendue sur
`src/components/previsions/scission-dialog.tsx` pour cette story.

## 4. Affichage en lecture seule

**Exigé par la story** (« visible ») : le champ doit apparaître dans le formulaire d'édition
lui-même en mode édition (`existant` fourni, `vague-prevue-form-dialog.tsx`) — c'est déjà couvert
par §1 (le même `Input`/checkbox sert la création et l'édition, patron déjà en place pour les 4
champs existants qui n'ont pas de composant de lecture seule dédié). C'est suffisant pour satisfaire
« visible et modifiable ».

**Bonus hors périmètre strict, mais peu coûteux et cohérent avec l'existant** : la carte de chaque
`VaguePrevue` dans `src/components/previsions/plan-vagues-tab.tsx:180-198` affiche déjà un `Badge`
de statut et l'effectif — un second `Badge` (« Alevins achetés » / « Production interne ») y serait
cohérent visuellement (même patron `Badge variant=...`, ligne 184) mais **n'est pas demandé
explicitement par la story** et n'est couvert par aucun test existant. Décision : **ne pas l'exiger
du @developer** dans le périmètre GO de cette story ; le signaler comme amélioration possible.

**Hors périmètre confirmé, à ne pas faire dans cette story** : export PDF/Excel du module Prévisions
— recherché, **aucun export PDF/Excel n'existe pour ce module** (`grep -rl` sur
`src/components/previsions/` et `src/app/api/previsions/` ne renvoie aucun fichier `export`/`pdf`/
`excel`) : le point 4 de la consigne (« export PDF/Excel ») est sans objet, ce module n'a pas encore
cette fonctionnalité, quel que soit le sprint.

## 5. i18n

**Fichiers : `src/messages/fr/previsions.json` et `src/messages/en/previsions.json`.** Namespace
confirmé (`vaguePrevueForm` et `parametresTab` y vivent déjà, lignes 346+ et 117+ respectivement
dans les deux fichiers). Convention de clés observée : `fields.<champ>.label` (et `.placeholder`
pour les champs texte), `errors.<nom>` pour les messages de validation client.

**Test de complétude existant et pertinent** :
`src/__tests__/integration/i18n-completeness.test.ts` — le namespace `previsions` est explicitement
dans la liste couverte (JSDoc lignes 1-16, imports `frPrevisions`/`enPrevisions` présents plus loin
dans le fichier) : ce test **échouera** si une clé est ajoutée dans un seul des deux fichiers
(parité stricte fr/en) ou si une valeur est vide. `src/__tests__/i18n/messages.test.ts` est un
second filet (structure générale des messages) — à vérifier par le @tester mais moins spécifique.

**Clés à ajouter, proposition (accents corrects) :**

Dans `vaguePrevueForm.fields` (fr / en) :
```json
"alevinsAchetes": {
  "label": "Alevins achetés"      // fr
}
```
```json
"alevinsAchetes": {
  "label": "Purchased fingerlings"  // en
}
```

Dans `parametresTab.fields` (fr / en), avec un `hint` cohérent avec §2 :
```json
"alevinsAchetesParDefaut": {
  "label": "Alevins achetés par défaut",
  "hint": "S'applique à chaque nouvelle vague planifiée ; modifiable ensuite vague par vague."
}
```
```json
"alevinsAchetesParDefaut": {
  "label": "Purchased fingerlings by default",
  "hint": "Applied to each newly planned batch; editable afterwards on a per-batch basis."
}
```
Et le hint proposé en §2 pour `prixAlevinUnitaireFCFA` (à ajouter à `CHAMPS_AVEC_HINT`) :
```json
"prixAlevinUnitaireFCFA": { "hint": "Appliqué uniquement aux vagues dont « Alevins achetés » est actif." }
```
```json
"prixAlevinUnitaireFCFA": { "hint": "Applied only to batches with \"Purchased fingerlings\" enabled." }
```
(`prixAlevinUnitaireFCFA.label` existe déjà — seule la clé `hint` est nouvelle, à ajouter au même
niveau que `label`, cf. patron `margeSecuriteAlevinsPct` existant dans les deux fichiers.)

## 6. Tests UI existants sur ces écrans

- `src/components/previsions/__tests__/vague-prevue-form-dialog.test.tsx` — couvre les bugs A/B
  (garde de fermeture, réinitialisation du code). **Aucun test ne casse** par un ajout additif de
  champ (aucune assertion sur le nombre de champs rendus ou sur le payload exact envoyé au delà des
  4 champs actuels — vérifié par lecture, lignes 70-176).
- `src/components/previsions/__tests__/parametres-tab.test.tsx` — couvre le signalement des
  paramètres non lus par le moteur (`margeSecuriteAlevinsPct`, `nombreBacsSimultanesCible`), les
  paliers, la saisie décimale. **Aucun test ne casse** par l'ajout d'un champ supplémentaire au
  même titre — mais ce fichier est le bon endroit pour ajouter un test analogue à celui de la ligne
  81-95 (« signale que ... ») vérifiant que le hint de `prixAlevinUnitaireFCFA` est bien rendu, et
  un test de soumission (`handleSaveParametres`) vérifiant que `alevinsAchetesParDefaut` est bien
  inclus dans le corps du PUT.
- `src/__tests__/integration/i18n-completeness.test.ts` et `src/__tests__/i18n/messages.test.ts` —
  cf. §5, à rejouer, pas à modifier.

Aucun test existant sur `plan-vagues-tab.tsx` ni `scission-dialog.tsx` ne référence les 4 champs
actuels de façon exhaustive au point de casser sur un ajout de badge optionnel (§4) — si le
@developer choisit d'ajouter le badge bonus, vérifier
`src/components/previsions/__tests__/plan-vagues-tab.test.tsx` pour d'éventuelles assertions sur le
nombre exact de `Badge` par carte.

## 7. ERR-157 — ce qu'exige cette erreur

`docs/knowledge/ERRORS-AND-FIXES.md:3431-3475` (ERR-157) établit qu'un test `jsdom`/Testing Library
**ne peut prouver aucune garantie de mise en page réellement rendue** (position `sticky`,
collision, débordement horizontal, couleur/opacité effective) — seule la structure du DOM (texte,
rôle ARIA, attributs) est vérifiable par ce harnais, par construction. Pour cette story, le risque
concret est plus modeste que le cas d'origine (pas de colonne collante ici), mais le principe
s'applique quand même à deux points précis introduits par cette story :
- La nouvelle checkbox dans `vague-prevue-form-dialog.tsx` doit être vérifiée en **navigateur réel**
  (Chromium) à 360px (mobile-first, cf. CLAUDE.md) pour confirmer que la cible tactile est
  utilisable (le patron `config-elevage-form-client.tsx` n'a pas de contrainte `min-h-[44px]`
  explicite sur le `<label>` — à vérifier visuellement que la zone cliquable reste confortable au
  doigt, pas seulement que le DOM contient un `<input type="checkbox">`).
- Le `hint` ajouté sur `prixAlevinUnitaireFCFA` (§2, §5) doit être vérifié à l'écran : `jsdom` peut
  confirmer que le texte du hint est présent et lié par `aria-describedby` (comme le test existant
  ligne 138-146 de `parametres-tab.test.tsx` le fait déjà pour le premier palier), mais **pas** qu'il
  reste lisible/non tronqué à 360px à côté d'un champ numérique dont la largeur est contrainte par
  le composant `Input`.

**Ce que le @tester devra faire concrètement** : après l'implémentation, ouvrir les deux écrans en
Chromium réel (pas seulement `npx vitest run`) à 375px et 768px minimum, capturer que la checkbox et
son libellé sont visibles et cliquables sans chevauchement, que le hint de
`prixAlevinUnitaireFCFA` reste lisible sous le champ, et documenter cette vérification dans le
rapport de test — un test jsdom vert ne suffit pas à clore la story, exactement le motif d'ERR-157.

## 8. Fichiers à modifier

**Prérequis bloquants, hors périmètre @developer de PR2oct.4, à obtenir de PR2oct.2/PR2oct.3
d'abord (voir Verdict) :**
- `src/types/models.ts` — `VaguePrevue.alevinsAchetes: boolean`,
  `ParametresPrevision.alevinsAchetesParDefaut: boolean` (PR2oct.2).
- `src/lib/queries/previsions-vagues.ts` — DTOs + `createVaguePrevue`/`updateVaguePrevue`/
  `scinderVaguePrevue`/`genererPlanVaguesPrevues` (PR2oct.2, déjà listé par sa propre pré-analyse §8).
- `src/lib/queries/previsions-scenarios.ts` — DTOs + `createScenario`/`updateParametresPrevision`
  (**gap non couvert par la pré-analyse PR2oct.2, à ajouter à son périmètre ou signaler à PR2oct.3**).
- `src/lib/previsions/route-orchestration.ts`, `src/lib/queries/previsions-scenario-loader.ts` —
  moteur (PR2oct.3).

**Fichiers à modifier par le @developer de PR2oct.4, une fois les prérequis ci-dessus FAIT :**
1. `src/lib/validation/previsions.schema.ts` — `alevinsAchetes: z.boolean().optional()` dans
   `createVaguePrevueSchema` (ligne 230-235) ; `alevinsAchetesParDefaut: z.boolean().optional()`
   dans `parametresPrevisionCreateSchema` (ligne 58-80). *(Ce maillon pourrait relever de PR2oct.2/
   PR2oct.3 selon la répartition finale du @project-manager — à confirmer, mais son absence bloque
   la story UI quel que soit le porteur.)*
2. `src/components/previsions/api-types.ts` — ajout du champ dans `VaguePrevueListItemDTO`
   (ligne 148-160) et `ParametresPrevisionDTO` (ligne 34-53).
3. `src/components/previsions/vague-prevue-form-dialog.tsx` — état, champ checkbox, payload
   (§1, §3).
4. `src/components/previsions/parametres-tab.tsx` — état séparé, checkbox, corps du PUT, entrée
   `prixAlevinUnitaireFCFA` dans `CHAMPS_AVEC_HINT` (§2, §3).
5. `src/messages/fr/previsions.json` et `src/messages/en/previsions.json` — clés listées §5.

**Fichiers de test pour le @tester :**
1. `src/components/previsions/__tests__/vague-prevue-form-dialog.test.tsx` — nouveau test :
   soumission inclut `alevinsAchetes` dans le payload, valeur par défaut correcte en création
   (copiée serveur, donc pas testable client sans mock — vérifier plutôt que la case reflète
   `existant.alevinsAchetes` en mode édition).
2. `src/components/previsions/__tests__/parametres-tab.test.tsx` — nouveau test : `handleSaveParametres`
   inclut `alevinsAchetesParDefaut` ; hint de `prixAlevinUnitaireFCFA` rendu et lié par
   `aria-describedby` (même patron que ligne 138-146).
3. `src/__tests__/integration/i18n-completeness.test.ts` — à rejouer (pas à modifier), doit rester
   vert avec les nouvelles clés.
4. Vérification navigateur réel — §7, à consigner dans le rapport de test, pas seulement
   `npx vitest run`.

## Verdict

**NO-GO en l'état actuel du dépôt** — pas un problème de conception UI (la conception ci-dessus est
prête à être implémentée dès que ses prérequis le sont), mais une dépendance factuelle non
satisfaite :

1. `docs/TASKS.md:7880` marque **PR2oct.2 `EN COURS`**, pas `FAIT` comme l'affirme le brief de cette
   story. Vérifié par grep direct : `src/types/models.ts`, `src/lib/queries/previsions-vagues.ts`,
   `src/lib/validation/previsions.schema.ts`, `src/components/previsions/api-types.ts` ne contiennent
   **aucune** occurrence de `alevinsAchetes`/`alevinsAchetesParDefaut` — seuls
   `prisma/schema.prisma` et la migration SQL portent déjà le champ.
2. `docs/TASKS.md:7881` marque **PR2oct.3 `TODO`** — le moteur n'a pas commencé.
3. Un gap supplémentaire, non couvert par la pré-analyse PR2oct.2 : `src/lib/queries/previsions-scenarios.ts`
   (chaîne `ParametresPrevision`) n'est mentionné nulle part comme périmètre SCHEMA — à ajouter
   explicitement, sinon `alevinsAchetesParDefaut` resterait un champ mort même une fois PR2oct.2
   « FAIT » selon sa propre définition de portée.

**Recommandation** : ne pas démarrer l'implémentation UI avant que (a) PR2oct.2 couvre explicitement
`previsions-scenarios.ts` en plus de `previsions-vagues.ts` et passe `FAIT`, et (b) au minimum le
schéma zod (`previsions.schema.ts`) soit étendu — que ce soit livré par PR2oct.2, PR2oct.3, ou en
tête de PR2oct.4 elle-même (à trancher par le @project-manager, mais explicitement, pas par défaut).
Une fois ces couches en place, la conception documentée ici (§1-§8) est directement actionnable sans
nouvelle pré-analyse.
