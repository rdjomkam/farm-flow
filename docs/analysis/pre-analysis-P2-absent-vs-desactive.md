# Pré-analyse P2 — `rapprochement-mapping-tab.tsx` confond « absent » et « désactivé »

**Statut : GO (vers l'arbitrage architecte)**

## Résumé

Le défaut est réel, localisé, et déjà entouré de garde-fous côté permissions. Le
« modèle » (`mapping-form-dialog.tsx`) résout la distinction en rebasculant sur
`GET /api/previsions/postes-referentiel/admin` (`PREVISIONS_PARAMETRER`), route
et permission qui existent déjà et sont déjà consommées par ce dialog — mais ce
dialog n'est monté que pour les utilisateurs `peutParametrer`. `rapprochement-
mapping-tab.tsx`, lui, est monté pour **tout** utilisateur `PREVISIONS_VOIR`
(gate au niveau page, pas au niveau du composant). Un rebranchement naïf sur la
même route casserait donc bien les lecteurs seuls — confirmé au niveau code, pas
seulement au niveau intention documentée dans l'ADR. Aucune donnée en base de
dev EXCEL-V12 ne permet de reproduire le cas « désactivé » sans écriture
(interdite) : les 4 `PosteReferentiel` sont tous actifs.

## 1. État exact du code

### `rapprochement-mapping-tab.tsx` — comportement actuel

- Charge les cibles `POSTE_PREVISION` via `GET /api/previsions/postes-referentiel`
  (route **actifs seulement**, permission `PREVISIONS_VOIR`) —
  `src/components/previsions/rapprochement-mapping-tab.tsx:143-145`.
- Résolution du libellé de cible : `libelleCible(...)` —
  `src/components/previsions/rapprochement-mapping-tab.tsx:373`.
- Dans `libelleCible` (`src/components/previsions/mapping-rapprochement-helpers.ts:164-189`),
  pour `POSTE_PREVISION` : si `cibles.postes.find(p => p.id === cibleId)` échoue —
  ce qui arrive aussi bien pour un id qui n'existe nulle part que pour un id
  d'une entrée désactivée, puisque la liste chargée exclut déjà les inactifs —
  le code renvoie (lignes 176-178) :
  - `t("rapprochementTab.mapping.cibleNonChargee")` si `ciblesChargees === false`
    (échec réseau isolé, cf. CORRECTIF D2), sinon
  - `t("rapprochementTab.mapping.cibleIntrouvable")` — **le même texte, que la
    cible n'existe nulle part OU qu'elle existe mais soit désactivée.**
- Clés i18n concernées (`src/messages/{fr,en}/previsions.json:907-909`) :
  - fr : `"cibleIntrouvable": "Cible introuvable"`, `"cibleNonChargee": "Cible non chargée"`
  - en : `"cibleIntrouvable": "Target not found"`, `"cibleNonChargee": "Target not loaded"`
  - Aucune des deux ne distingue « désactivée ».

### `mapping-form-dialog.tsx` — modèle déjà appliqué (réserve R2, story PR2non.2)

- Bascule le fetch des postes sur `GET /api/previsions/postes-referentiel/admin`
  (toutes entrées, actives ET inactives) au lieu de la route actifs-seuls —
  `src/components/previsions/mapping-form-dialog.tsx:199` (appel), en-tête
  `:42-59` (justification).
- `postesActifs = postes.filter(p => p.actif)` reste la **seule** liste
  proposable pour un **nouveau** rattachement (`:269`) — la désactivation
  continue de bloquer tout nouveau lien (ADR-053 §16.12 Arbitrage 2).
- Statut de la cible **existante** dérivé de la liste complète (`:285-302`) :
  `"absente"` (aucune entrée, quel que soit `actif`) vs `"desactivee"` (entrée
  trouvée, `actif === false`) — deux clés i18n distinctes,
  `cibleReferentielAbsenteWarning` et `cibleReferentielDesactiveeWarning`
  (rendu `:467-476`), cette dernière incluant le libellé réel de l'entrée
  désactivée.
- Ce dialog n'est monté (`DialogTrigger`) que si `peutParametrer` est vrai
  côté `rapprochement-mapping-tab.tsx` (`:312` et `:391`) — même permission
  que la route `/admin` qu'il consomme : aucun élargissement d'accès net pour
  ce composant précis.

## 2. Cartographie routes ↔ permissions

| Route | Filtre | Permission | Fichier |
|---|---|---|---|
| `GET /api/previsions/postes-referentiel` | `actif: true` uniquement | `PREVISIONS_VOIR` | `src/app/api/previsions/postes-referentiel/route.ts:23` |
| `GET /api/previsions/postes-referentiel/admin` | Tous (actifs + inactifs) | `PREVISIONS_PARAMETRER` | `src/app/api/previsions/postes-referentiel/admin/route.ts:26` |
| `PATCH /api/previsions/postes-referentiel/[id]` | — | `PREVISIONS_PARAMETRER` | `src/app/api/previsions/postes-referentiel/[id]/route.ts` |
| `POST .../[id]/desactiver` | — | `PREVISIONS_PARAMETRER` | `src/app/api/previsions/postes-referentiel/[id]/desactiver/route.ts` |
| `POST .../[id]/reactiver` | — | `PREVISIONS_PARAMETRER` | `src/app/api/previsions/postes-referentiel/[id]/reactiver/route.ts` |

- La page hôte de `rapprochement-mapping-tab.tsx` (`/previsions/scenarios/[id]`,
  onglet Rapprochement → Mapping) est gatée uniquement sur `PREVISIONS_VOIR` :
  `checkPagePermission(session, Permission.PREVISIONS_VOIR)` —
  `src/components/pages/previsions-scenario-detail-page.tsx:79`. Le composant
  reçoit `permissions` en prop et n'utilise `PREVISIONS_PARAMETRER` que pour
  conditionner l'affichage de boutons (`peutParametrer`), jamais pour
  restreindre le montage du composant lui-même — un utilisateur `PREVISIONS_VOIR`
  seul monte donc bien tout le composant, y compris son `fetchAll()`.
- **Confirmation de « un rebranchement naïf produirait un 403 »** : si
  `fetchAll()` (`rapprochement-mapping-tab.tsx:143-145`) était rebranché sur
  `/admin`, la requête passerait par `requirePermission(request,
  Permission.PREVISIONS_PARAMETRER)` — `src/app/api/previsions/postes-
  referentiel/admin/route.ts:26` — qui lève une erreur HTTP 403 pour tout
  utilisateur n'ayant pas cette permission (`src/lib/permissions.ts`,
  `requirePermission`, chemin non-ADMIN qui vérifie l'ensemble `required`
  contre les permissions du membership actif). L'appel utilise
  `silentError: true` (`:143`), donc l'écran ne crashe pas, mais
  `postesResult.ok` reste `false` pour ces utilisateurs — `ciblesChargees`
  (`:161`) resterait alors `false` **en permanence** pour eux, ce qui ferait
  retomber **toute** cible `POSTE_PREVISION`, y compris les cas parfaitement
  valides, sur `cibleNonChargee` plutôt que d'afficher le libellé réel — une
  régression strictement pire que le défaut actuel (P2 lui-même ne casse
  jamais l'affichage nominal, seulement le sous-cas désactivé).
- Aucun rôle documenté de l'ADR-053 §6 n'a `PREVISIONS_PARAMETRER` sans avoir
  aussi `PREVISIONS_VOIR` (relation d'inclusion dans un seul sens) — donc le
  risque est asymétrique : tout utilisateur `PREVISIONS_PARAMETRER` a déjà
  accès à `/admin`, mais l'inverse est faux, et c'est cette direction qui
  casse.

## 3. Périmètre de données de la route admin

`listerPostesReferentielAdmin` (`src/lib/queries/previsions-postes-
referentiel.ts:54-88`) renvoie, par entrée : `id, siteId, code, libelle, actif,
createdAt, updatedAt, nbPostesRattaches, nbMappingsRattaches`
(`PosteReferentielDTO`, `src/components/previsions/api-types.ts:237-260`).

- **Aucun montant financier** n'est exposé (le référentiel ne porte que le
  libellé/statut d'un poste, jamais ses charges — celles-ci vivent sur
  `PostePrevision`/`ChargeMensuelle`, non touchées par cette route).
- Ce qui est exposé **en plus** de `actif` par rapport à un enrichissement
  minimal : `code` (slug interne, traçabilité Arbitrage 1 ADR-053 §16.12 —
  jamais affiché dans `rapprochement-mapping-tab.tsx` aujourd'hui),
  `createdAt`/`updatedAt`, et surtout **deux compteurs d'usage
  site-wide** (`nbPostesRattaches`, `nbMappingsRattaches`) calculés par deux
  requêtes SQL supplémentaires (`_count` relationnel + `groupBy`,
  `previsions-postes-referentiel.ts:67-78`) — un coût de requête et une
  surface d'information (« combien de scénarios/mappings du site utilisent ce
  poste ») qui dépassent strictement le besoin de P2 (distinguer
  absent/désactivé n'exige que `actif`, pas ces compteurs).
- Un enrichissement minimal (piste (a) du prompt) devrait donc, pour rester
  fidèle au principe déjà appliqué dans ce module (« le filtrage sur `actif`
  est une décision explicite par appelant, jamais un défaut implicite » —
  commentaire de `listerPostesReferentielAdmin`), soit réutiliser la route
  `/admin` telle quelle (accepter d'exposer `code`/compteurs à qui a déjà
  `PREVISIONS_PARAMETRER` — sans objet ici puisque c'est justement le
  problème), soit introduire une nouvelle fonction/route qui ne renvoie que
  `{ id, actif }` (ou `{ id, actif, libelle }`) filtrée sur `PREVISIONS_VOIR`.

## 4. Tests existants

- `src/components/previsions/__tests__/rapprochement-mapping-tab.test.tsx`
  (632 lignes, 100 % vert) — **aucune** occurrence de `PosteReferentiel.actif
  = false` : les seules occurrences de `actif: false` dans ce fichier
  (lignes 522, 589) portent sur `MappingRapprochement.actif` (bit de version,
  sans rapport avec le référentiel). **Aucun test ne couvre le sous-cas
  « cible `POSTE_PREVISION` désactivée » pour ce composant** — trou de
  couverture confirmé, cohérent avec le fait que le défaut n'a jamais été
  corrigé ici.
- `src/components/previsions/__tests__/mapping-form-dialog.test.tsx`
  (553 lignes) — couvre explicitement la distinction absente/désactivée
  (commentaire `:283-298`, « PR2non.2 (falsification, comble ERR-189) »),
  vérifie l'appel à `/admin` (`:292`) et que l'entrée désactivée n'est jamais
  proposée comme nouvelle cible (`:296-298`).
- `src/components/previsions/__tests__/mapping-rapprochement-helpers.test.ts`
  (102 lignes) — teste `libelleCible` mais uniquement sur les cas « trouvé »
  / « introuvable » / « non chargé » avec une liste `postes` déjà filtrée
  côté appelant ; ne teste jamais un objet `actif` sur les entrées passées
  (le type `CiblesDisponibles.postes` — `mapping-rapprochement-helpers.ts:126-130`
  — ne porte même pas de champ `actif` aujourd'hui).
- Suite complète scoping ces 3 fichiers rejouée : `45/45` tests verts,
  0 échec (`npx vitest run` ciblé, 2026-08-06).
- Routes : `src/app/api/previsions/postes-referentiel/__tests__/route.test.ts`
  et `.../__tests__/admin-route.test.ts` couvrent les deux routes
  séparément, y compris la permission de chacune (403 attendu si absente).

## 5. Clés i18n concernées

Namespace `previsions`, `src/messages/{fr,en}/previsions.json`, section
`rapprochementTab.mapping.*` :

- Existantes et **conflatées** aujourd'hui : `cibleIntrouvable` (:907),
  `cibleNonChargee` (:908) — les deux sont déjà présentes en fr **et** en.
- Existantes côté `mapping-form-dialog` (modèle) et potentiellement
  réutilisables/dupliquables selon la piste retenue :
  `form.cibleReferentielAbsenteWarning`, `form.cibleReferentielDesactiveeWarning`
  (accepte `{ libelle }`) — à vérifier qu'elles couvrent le bon registre
  (« warning » dans un formulaire d'édition vs texte de statut dans une liste
  en lecture) avant réutilisation telle quelle.

## 6. Pistes évaluables (non tranchées — pour l'architecte)

**(a) Enrichir une route de lecture existante ou nouvelle d'un état minimal
`actif`, sans exposer `code`/compteurs/dates.**
Coût : une nouvelle fonction de query (ou un paramètre `champsMinimal` sur
l'existante) + une nouvelle route, ou un DTO allégé sur la route `/admin`
existante réutilisée mais **gatée différemment** (voir (b)). Risque : si la
route reste `PREVISIONS_PARAMETRER`, le problème persiste pour les lecteurs
seuls ; si elle passe à `PREVISIONS_VOIR`, elle expose l'existence d'entrées
désactivées (information de paramétrage) à des lecteurs seuls — à trancher si
c'est acceptable au regard de la philosophie déjà actée en §16.12
(« le filtrage sur `actif` reste circonscrit à (a) `GET /postes-referentiel`
... et (b) au get-or-create » — ce texte visait un autre besoin, mais pose
déjà que exposer le statut `actif` n'est pas neutre).

**(b) Une permission de lecture distincte** (ex. réutiliser `PREVISIONS_VOIR`
sur une route dédiée qui ne renvoie que `{ id, actif }`, sans nouvelle valeur
d'enum `Permission` — dans l'esprit de la décision déjà prise en §16.12 pour
`GET /postes-referentiel` : « `PREVISIONS_VOIR`, inchangé »). C'est
techniquement la piste (a) avec une décision de gate explicite : ne PAS créer
`PREVISIONS_REFERENTIEL` (ADR-053 §16.12 l'a déjà écarté pour un besoin
proche : « fragmenterait sans bénéfice un périmètre déjà couvert »).

**(c) Renoncer à la distinction pour un lecteur seul, mais cesser d'affirmer
« introuvable » quand l'état réel est indéterminé** (cf. ERR-173, « ne jamais
combler le troisième cas par un raccourci qui ment » — même famille de
principe, appliqué ici à un état non trois mais deux, faute de donnée
disponible). Coût quasi nul : un lecteur `PREVISIONS_VOIR` sans
`PREVISIONS_PARAMETRER` continuerait de charger uniquement
`/postes-referentiel` (actifs) ; toute cible non trouvée dans cette liste
afficherait un texte honnête du type « État indéterminé » (ni « introuvable »
ni « désactivé » affirmés à tort) plutôt que `cibleIntrouvable`, qui aujourd'hui
ment implicitement en laissant croire que la cible n'existe nulle part. Un
utilisateur `PREVISIONS_PARAMETRER` (donc déjà capable d'ouvrir
`MappingFormDialog`, qui, lui, sait) verrait la distinction précise directement
en éditant la ligne. Risque : deux registres différents pour deux permissions
dans le même composant (déjà le cas aujourd'hui avec `peutParametrer` pour
les boutons) — cohérent avec l'existant, pas une nouveauté structurelle.

Aucune de ces trois pistes n'est favorisée ici : c'est un arbitrage de
permissions/exposition d'information, matière de l'étape @architect suivante,
pas de la pré-analyse.

## 7. Verdict

**GO** pour passer à l'arbitrage architecte. Faits établis, sans ambiguïté :
- Le défaut est réel et précisément localisé (2 lignes,
  `mapping-rapprochement-helpers.ts:176-178`).
- Le risque de 403 documenté par le sprint précédent est confirmé au niveau
  code (permission de la route `/admin`, montage du composant indépendant de
  `PREVISIONS_PARAMETRER`) — ce n'est pas une prudence excessive, c'est un
  risque réel démontré.
- La base de dev EXCEL-V12 ne permet aucune vérification manuelle du cas
  désactivé sans écriture (interdite) — toute validation de la piste retenue
  devra passer par des tests automatisés avec des fixtures dédiées
  (`actif: false` simulé), jamais par une manipulation de EXCEL-V12.
- Aucun blocage technique (build/tests) : suite ciblée 45/45 verte.

Aucun prérequis manquant. La décision à prendre est strictement un arbitrage
produit/sécurité (quelle piste (a)/(b)/(c), et si (a)/(b), quelle forme de DTO
minimal et quelle permission), pas un travail d'investigation supplémentaire.
