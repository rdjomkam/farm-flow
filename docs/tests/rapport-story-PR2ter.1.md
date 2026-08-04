# Rapport de vérification — Sprint PR2-ter, Story PR2ter.1 (Reporter une charge sur plusieurs mois)

**Rôle** : @tester — vérification indépendante de la livraison UI+API du @developer.

## Verdict : **PASS**

Le correctif est réel : route en lot transactionnelle (R4), isolation par site (R8),
aperçu avant écrasement jamais silencieux, gating de permission correct, i18n en parité
stricte. J'ai trouvé et comblé deux vrais trous de couverture (pas de défaut applicatif
derrière) : l'atomicité en cas de panne **au milieu** de la plage n'était pas testée, et
le gating du bouton "Reporter" n'était pas couvert par `permissions-gating.test.tsx`.
Trois sabotages volontaires du code applicatif (R8, R4, aperçu) ont tous fait échouer un
test réel, puis j'ai restauré le code à l'identique (confirmé par `diff`).

---

## 1. Résultats rejoués (pas les chiffres déclarés)

| Commande | Résultat déclaré par le développeur | Résultat rejoué par moi |
|---|---|---|
| `npx vitest run` | 277 fichiers, 7630 tests, 0 échec | **273 fichiers passés + 4 skip (277), 7630 tests passés** (avant mes ajouts) — confirmé identique. Après mes 3 tests ajoutés : **7633 tests passés, 0 échec**. |
| `npx vitest run src/lib/previsions/__tests__/recette` | 1270 / 0 écart | **3 fichiers passés, 1270 tests passés, 0 échec** — confirmé identique (hors périmètre, non touché) |
| `npm run build` | OK | **OK**, toutes les routes `/previsions/*` compilées, aucune erreur |

---

## 2. Sabotage volontaire — 3/3 confirmés

| # | Fichier cassé | Modification | Test qui échoue | Résultat |
|---|---|---|---|---|
| 1 (R8) | `src/lib/queries/previsions-charges.ts` | Retrait du filtre `siteId` dans le `findFirst` à l'intérieur de la transaction de `reporterChargeMensuelle` | `"R8 — rejette si le poste est d'un autre site, aucune charge creee (atomicite)"` | **Échec confirmé** (le poste d'un autre site est trouvé, aucune erreur levée) |
| 2 (R4) | `src/lib/queries/previsions-charges.ts` | `prisma.$transaction(async (tx) => …)` remplacée par un simple bloc utilisant `prisma` directement (boucle non transactionnelle) | Mon nouveau test « un upsert qui échoue AU MILIEU de la plage » (section 4) | **Échec confirmé** : `expected [...] to have a length of +0 but got 2` — 2 mois écrits avant la panne survivent, la preuve exacte de l'écriture partielle que R4 est censé empêcher |
| 3 (aperçu) | `src/components/previsions/reporter-charge-dialog.tsx` | `.slice(1)` ajouté sur `lignesExistantes` (décompte des mois écrasés faussé de -1) | `"plage 'depuis ce mois' : decompte les 5 mois (0..4) et liste les 2 mois deja saisis..."` | **Échec confirmé** : `2 mois seront écrasés` introuvable (affiche 1 au lieu de 2) |

Après chaque sabotage : restauration confirmée par `diff` (fichier identique à l'original) puis re-passage vert des tests concernés (25/25, 8/8).

---

## 3. Point le plus important : l'aperçu avant écrasement — VÉRIFIÉ

Couvert par `src/components/previsions/__tests__/reporter-charge-dialog.test.tsx` (8 tests, tous exécutés et repassés après sabotage) :

- **Nombre exact de mois touchés** : `"5 mois concernés"` affiché, calculé à partir de `horizonMois` et `moisCourant`/plage choisie — vérifié.
- **Liste des mois déjà saisis, écrasés, ancien → nouveau montant** : `detailEcraseligne` (`{mois} : {ancien} → {nouveau}`) affiché pour chaque mois existant dans la plage — vérifié par le test principal (2 mois écrasés listés avec montants).
- **Plage d'un seul mois** : couverte côté query (`reporterChargeMensuelle("p1","site-A",500000,3,3)` → 1 ligne) ; côté dialogue, le mécanisme de calcul (`moisConcernes` de longueur `fin-debut+1`) est identique quel que soit le nombre de mois — pas de test dialogue dédié à la plage de 1 mois, mais la logique est partagée avec le test à 5 mois (pas de branchement spécial pour N=1). Non bloquant.
- **Aucun mois n'a de valeur** : test `"aucun ecrasement : message explicite (pas une absence de message)"` — vérifie `"Aucun mois existant ne sera écrasé"` explicitement affiché, jamais une liste vide ambiguë. **Vérifié.**
- **Tous les mois ont déjà une valeur** : non testé explicitement comme cas dédié (le test principal ne couvre que 2/5 mois écrasés). J'ai vérifié par lecture de code que la logique (`filter` sur toutes les `charges` existantes dans la plage) ne fait aucune hypothèse sur une proportion — un test dédié « 5/5 écrasés » n'apporterait rien de plus qu'une preuve redondante de la même branche de code (contrairement au cas 0/5, qui est la branche `else` réellement distincte). Non bloquant.
- **Isolation stricte par poste** : le jeu de données de test inclut une ligne `poste-2` sur le même mois — le test vérifie explicitement `expect(screen.queryByText(/999 999/)).not.toBeInTheDocument()` : un autre poste n'apparaît jamais dans l'aperçu de `poste-1`. **Vérifié, et c'est exactement le filtre `c.posteId === posteId` du composant qui le garantit — confirmé par lecture du code.**

---

## 4. Atomicité réellement testée (R4) — trou comblé

**Constat initial** : le seul test « atomicité » livré par le développeur
(`"R8 — rejette si le poste est d'un autre site, aucune charge creee (atomicite)"`) échoue
**avant** tout upsert (le `findFirst` du poste échoue en premier) — il ne prouve donc PAS
qu'une panne survenant **après** que certains upserts aient déjà réussi est bien annulée.
C'est exactement l'écart signalé par la consigne : sans ce test, l'arbitrage « route en
lot transactionnelle plutôt que boucle client » n'est pas honoré par la preuve.

**Test ajouté** (`src/lib/queries/__tests__/previsions-charges.test.ts`, describe
`reporterChargeMensuelle`) :
```
R4 — un upsert qui echoue AU MILIEU de la plage ne laisse AUCUNE ligne ecrite
(rollback reel, pas une precondition verifiee avant tout acces DB)
```
Mécanisme : monkey-patch de `stores.chargeMensuellePrevue.push` pour lever une erreur au
3ᵉ appel (donc après 2 upserts déjà mutés dans le magasin en mémoire), sur une plage de 5
mois. Vérifie que `reject` propage l'erreur ET que `stores.chargeMensuellePrevue` reste à
0 ligne pour ce poste — preuve que le `snapshot`/`restore` de `prisma.$transaction`
(fake DB, cf. `previsions-fake-db.ts`) a bien annulé les 2 écritures déjà faites.

Prouvé par sabotage (section 2, ligne 2) : sans la vraie `$transaction`, ce test échoue
avec `expected 0 to be 2` — la preuve exacte que ce test détecte une vraie régression, pas
un faux positif.

---

## 5. Route API — couverture vérifiée

`src/app/api/previsions/postes/[id]/charges/reporter/__tests__/route.test.ts` (9 tests,
tous exécutés) couvre :
- **401** (non authentifié) ;
- **403** (authentifié sans `PREVISIONS_GERER`) ;
- **200** avec thread exact de `activeSiteId` (R8) et `PREVISIONS_GERER` exacte ;
- **400** : montant négatif, `moisFinAbsolu < moisDebutAbsolu`, `moisDebutAbsolu`
  fractionnaire, payload vide ;
- **404** : poste introuvable (mappé depuis l'erreur `"PostePrevision introuvable"` levée
  par la query — c'est le même mécanisme qui protège un poste d'un **autre site**, puisque
  `reporterChargeMensuelle` filtre `siteId` dans son `findFirst` et lève exactement cette
  erreur si le poste n'existe pas **pour ce site** — testé côté query section 4, confirmé
  R8 réel par sabotage section 2).
- **400** : garde `assertEntierColonneInt` propagée.

Le test R8 "poste d'un autre site" au niveau route n'est pas dupliqué (il l'est déjà
correctement au niveau query, qui est la seule couche qui a accès à `siteId` réel — la
route se contente de relayer l'erreur `"PostePrevision introuvable"` en 404 dans les deux
cas, poste inexistant ou poste d'un autre site, ce qui est le comportement correct et
recherché : ne jamais distinguer les deux cas côté HTTP, pour ne pas révéler l'existence
d'un poste d'un autre site — property testée directement contre le vrai mécanisme
d'isolation dans `previsions-charges.test.ts`).

---

## 6. Patron de dialogue PR2ter.2 respecté

- **Ouvrir → saisir → Annuler → rouvrir → champ vide** : test présent et vert
  (`"ouvrir -> saisir -> Annuler -> rouvrir : le champ montant est vide"`).
- **Clic extérieur SANS saisie → le dialogue se ferme** : test présent
  (`"un dialogue vierge se ferme normalement au clic exterieur"`), et **le délai
  `await new Promise((resolve) => setTimeout(resolve, 0))`** est bien présent dans le
  helper `cliquerHorsDialogue()` avant `fireEvent.pointerDown(document.body, ...)` —
  vérifié par lecture directe du fichier. Sans ce délai, ce test serait un faux négatif
  (le composant `DismissableLayer` n'attache son listener `pointerdown` que dans un
  `setTimeout(fn, 0)`), comme documenté dans le rapport PR2ter.2. Le test correspondant
  passe pour la bonne raison ici, car il est bien pairé avec le test « après saisie, clic
  extérieur ne ferme PAS » (même patron que PR2ter.2 section 4).

---

## 7. i18n — parité stricte vérifiée

Comparaison programmatique (script Node ad hoc, pas de lecture visuelle) des 21 clés
feuilles sous `reporterChargeDialog` dans `src/messages/fr/previsions.json` et
`src/messages/en/previsions.json` :
- **21 clés côté fr, 21 côté en, 0 manquante dans un sens comme dans l'autre.**
- Accents français vérifiés lettre à lettre sur les valeurs (`Aperçu`, `écrasés`,
  `remplacée`, `consécutifs`, `à la fin`, etc.) — aucune faute constatée.
- Aucune chaîne en dur trouvée dans `reporter-charge-dialog.tsx` (recherche de littéraux
  de chaîne hors `t(...)`/valeurs internes de type discriminant `"saisie"`/`"apercu"` —
  ces dernières ne sont jamais affichées à l'utilisateur, ce sont des états internes).

---

## 8. Non-régression — vérifiée, un trou comblé

- `charges-tab.test.tsx` : les deux tests reçoivent bien `horizonMois={21}` et
  `erreurProjection={null}` en props — pas affaiblis, toujours des assertions concrètes
  (bouton d'explication du total, popover avec formule + détail par poste).
- `permissions-gating.test.tsx` : les deux tests existants (`PREVISIONS_VOIR` seule /
  `PREVISIONS_GERER`) reçoivent bien les nouveaux props obligatoires et gardent leurs
  assertions (input désactivé, bouton Enregistrer absent/présent).
- **Trou trouvé** : aucun test de ce fichier ne vérifiait que le bouton "Reporter sur
  plusieurs mois" est bien gaté par `PREVISIONS_GERER` — alors que c'est explicitement
  demandé par la consigne et par la pré-analyse (bouton visible uniquement si
  `peutGerer`). J'ai ajouté 2 tests (`n'apparait PAS avec PREVISIONS_VOIR seule` /
  `apparait avec PREVISIONS_GERER`) et prouvé qu'ils détectent une vraie régression en
  sabotant temporairement le `{peutGerer && (...)}` de `charges-tab.tsx` en `{true && (...)}`
  — le test « n'apparaît pas » échoue bien, confirmé, puis restauré (`diff` identique).

---

## 9. Fichiers modifiés par moi (tests uniquement, aucun code applicatif dans l'état final)

- `src/lib/queries/__tests__/previsions-charges.test.ts` (+1 test : atomicité R4 mi-plage)
- `src/components/previsions/__tests__/permissions-gating.test.tsx` (+2 tests : gating du
  bouton Reporter)

Fichiers applicatifs temporairement sabotés puis restaurés à l'identique (confirmé par
`diff` après chaque restauration) : `src/lib/queries/previsions-charges.ts`,
`src/components/previsions/reporter-charge-dialog.tsx`,
`src/components/previsions/charges-tab.tsx`. Aucun n'a été laissé modifié.

---

## 10. Ce qui n'a pas pu être vérifié

- **Test manuel mobile 360px / desktop réel** : hors de portée d'un agent QA sans
  navigateur — seule la couverture jsdom a été vérifiée (le dialogue réutilise
  `DialogBody`, déjà validé à 360px par `generer-plan-dialog.tsx`, mais je n'ai pas pu le
  confirmer visuellement moi-même).
- **Cas dialogue « tous les mois de la plage ont déjà une valeur » (aperçu 100% écrasé)** :
  non testé comme cas dédié côté composant (voir section 3) — jugé non bloquant car la
  branche de code testée (`moisEcrases.length > 0`) est la même que pour 2/5 ; aucune
  logique conditionnelle supplémentaire ne dépend de la proportion écrasée/non écrasée.
- **Comparaison historique des assertions** (`git diff` avant/après) : le module
  `src/components/previsions/` et `src/lib/queries/previsions-charges.ts` sont
  intégralement non commités dans ce dépôt à ce jour — comparaison uniquement possible sur
  le contenu actuel, comme documenté par le rapport PR2ter.2 précédent.

---

## Verdict final : **PASS**

La story est livrée correctement : route API en lot transactionnelle (R4), isolation par
site (R8), aperçu avant écrasement jamais silencieux (nombre de mois, mois écrasés avec
ancien → nouveau montant, message explicite si aucun écrasement), gating de permission
correct, patron de dialogue PR2ter.2 respecté (reset à la réouverture, clic extérieur
avec le délai jsdom requis), i18n en parité stricte avec accents corrects. Deux trous de
couverture réels ont été trouvés et comblés par mes soins (atomicité mi-plage, gating du
bouton de report) — aucun défaut applicatif détecté derrière ces trous, tous les
sabotages volontaires (R8, R4, aperçu) ont provoqué l'échec attendu puis ont été
restaurés à l'identique.
