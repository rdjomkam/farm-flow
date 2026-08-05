# Pré-analyse Sprint PR3-bis — « L'écran d'administration du mapping » — 2026-08-05

## Statut : GO AVEC RÉSERVES

## Résumé
Le backend nécessaire existe déjà intégralement (GET mapping actif/par version, POST création de
nouvelle version, GET catégories non mappées couvrant les 4 sources y compris les granulométries
depuis la review PR3 Moyenne #2). Aucune capacité API n'est à créer : PR3-bis est un sprint **UI
pur** (+ tests). Le seul point structurant à trancher avant codage est l'emplacement (sous-onglet
du 5ᵉ onglet Rapprochement) et une clarification obligatoire dans l'UI sur le fait que
`MappingRapprochement.cibleId` référence des entités **scénario-scopées** (`PostePrevision`,
`AlimentPrevision`) alors que le mapping lui-même est **site-scopé** — un risque de perte silencieuse
de rapprochement non couvert par un test existant.

## Vérifications effectuées

### Constat de départ — CONFIRMÉ
- `src/components/previsions/rapprochement-non-rapproche.tsx` (24 lignes) reçoit ses `lignes` en
  props depuis `rapprochement-tab.tsx`, elles-mêmes pré-calculées côté serveur par le moteur
  (`nonRapprocheParMois`) — **aucun appel** à `GET /api/previsions/mapping-rapprochement/non-mappees`
  nulle part dans `src/components/previsions/`. Grep exhaustif : la route `mapping-rapprochement`
  n'est référencée que par ses propres tests (`route.test.ts`) et par
  `previsions-rapprochement-mapping.ts` (queries). Confirmé.

### 1. Inventaire de l'existant

**Routes API `mapping-rapprochement` (toutes existantes, rien à créer côté API) :**

| Route | Méthode | Permission | Fichier |
|---|---|---|---|
| `/api/previsions/mapping-rapprochement` | GET (mapping actif, ou `?version=N`) | `PREVISIONS_VOIR` | `src/app/api/previsions/mapping-rapprochement/route.ts:26-57` |
| `/api/previsions/mapping-rapprochement` | POST (nouvelle version, remplacement en bloc) | `PREVISIONS_PARAMETRER` | même fichier, `:69-86` |
| `/api/previsions/mapping-rapprochement/non-mappees` | GET (catégories réelles non mappées) | `PREVISIONS_VOIR` | `src/app/api/previsions/mapping-rapprochement/non-mappees/route.ts:23-35` |

`GET .../non-mappees` retourne `{ data: CategorieReelleNonMappee[] }` avec
`{ sourceType: SourceRapprochement, sourceCle: string }` (`previsions-rapprochement-mapping.ts:126-129`).
Couvre les 4 sources : `DEPENSE_CATEGORIE`, `PRODUIT_CATEGORIE`, `VENTE` (clé singleton `"VENTE"`),
et `MOUVEMENT_STOCK` (granulométries, comblé depuis la review PR3 Moyenne #2 — commentaire
`previsions-rapprochement-mapping.ts:152-165` cite explicitement ce comblement). Pour
`MOUVEMENT_STOCK`, `sourceCle` est la valeur littérale `TailleGranule` (ex. `"G2"`) ou le littéral
`"INCONNU"` — **pas un libellé lisible**, la traduction en mm doit se faire côté UI (voir référentiel
i18n ci-dessous).

**POST existe déjà — mais c'est un remplacement en bloc, pas un ajout unitaire.**
`creerVersionMappingSchema` (`src/lib/validation/previsions.schema.ts:404-408`) exige
`lignes: LigneMappingRapprochementInput[]` avec **minimum 1 ligne** — il n'existe **aucune** route
d'ajout incrémental d'une seule ligne. Concrètement, « créer un mapping depuis la liste des
non-mappées » signifie côté UI : lire le mapping actif complet (`GET` sans `?version`), y ajouter/
modifier la ou les lignes voulues, et POSTer le tableau complet résultant — jamais un POST à une
seule ligne sur un mapping déjà peuplé (sous peine de désactiver silencieusement toutes les autres
lignes actives, cf. `creerVersionMapping` qui `updateMany({ actif: false })` **toutes** les lignes
actives du site avant de créer la nouvelle version).

**Validation cibleId : gap mineur, non bloquant mais à corriger dans la story API/schema si le temps
le permet.** `ligneMappingRapprochementInputSchema` (`previsions.schema.ts:388-393`) accepte
`cibleId: z.string().nullable().optional()` **sans lier sa présence à `cibleType`** — rien n'empêche
aujourd'hui `cibleType: POSTE_PREVISION` avec `cibleId: null` (silencieusement équivalent à
`NON_RAPPROCHE` côté moteur, `versMappingActif` retournant `cibleCle = null` dans ce cas,
`previsions-rapprochement.ts:105-113`). Recommandé : un `.refine()` refusant `cibleId` absent quand
`cibleType !== NON_RAPPROCHE`, et refusant `cibleId` présent quand `cibleType === NON_RAPPROCHE`.
Non bloquant pour GO (le moteur ne plante pas, il traite juste la ligne comme non rapprochée), mais
la story CRUD UI doit imposer cette contrainte **côté formulaire** au minimum.

**`MappingRapprochement.version` / `ClotureMois.versionMapping` — point critique, vérifié ligne à
ligne :**
- Mois **clôturé** : `previsions-rapprochement.ts` (fonction de résolution ~ligne 130-210) lit
  `ClotureMois.versionMapping` puis appelle `getMappingParVersion(siteId, version)` — **jamais**
  `getMappingActif`. Confirmé par le commentaire explicite `:132-140` et la boucle `:182-208` qui
  résout une version par mois clôturé distinctement, avec cache par version pour éviter le N+1.
- Mois **non clôturé** : lit `getMappingActif` (mapping `actif = true` courant). Confirmé.
- **Nouvelle version créée comment aujourd'hui ?** `creerVersionMapping`
  (`previsions-rapprochement-mapping.ts:85-123`), déjà exposée par `POST
  /api/previsions/mapping-rapprochement`. Transaction (R4) : lit `max(version)` du site
  (`versionActiveCourante`), désactive (`actif=false`) toutes les lignes actives existantes (jamais
  de update de leur contenu), puis `createMany` la nouvelle version `actif=true`. **Jamais un UPDATE
  en place** — conforme à l'ADR §3.9/§15.3.
- **Message que l'UI a le droit de tenir : « modifier le mapping ne réécrit jamais l'historique des
  mois déjà clôturés »** — c'est vrai, prouvé par un test DB-gated cité dans la review PR3 (point 5
  de la checklist, review-sprint-PR3.md). L'UI de PR3-bis peut légitimement afficher ce message sans
  correctif backend préalable.
- Clôture : `cloturerMois` (`src/app/api/previsions/scenarios/[id]/clotures/route.ts:31-63`) fige
  `versionMapping` **dans la même transaction** que la création de `ClotureMois` — conforme R4/§15.3.

**Onglet Rapprochement — 4 vues existantes, mode de navigation :**
`rapprochement-tab.tsx` est déjà le **9ᵉ onglet** de `scenario-detail-client.tsx` (`tableau-de-bord`,
`previsions`, `parametres`, `aliments`, `vagues`, `charges`, `journal`, `apports`, `rapprochement` —
`scenario-detail-client.tsx:159-167`). À l'intérieur de cet onglet, un `<Select>` de mois
(`:74-85`) puis un second niveau de `Tabs` **imbriqué** (`:87-124`) avec 4 `TabsTrigger` :
`mensuelle` (`RapprochementVueMensuelle`), `cumulee` (`RapprochementVueCumulee`), `parVague`
(`RapprochementVueVagues`), `topEcarts` (`RapprochementVueTopEcarts`). Le bac « Non rapproché »
(`RapprochementNonRapproche`) est intégré dans la vue mensuelle, pas un onglet séparé.

**Référentiel de granulométries — emplacement unique, pattern à réutiliser tel quel.**
`src/messages/fr/stock.json:68-78` (et `src/messages/en/stock.json` équivalent) porte les 9 clés
`P0`...`G5` sous `produits.taillesGranule.*`. Consommé ailleurs via
`useTranslations("stock")` puis `tStock(\`produits.taillesGranule.${val}\`)` — exemple exact à copier :
`src/components/previsions/aliment-form-dialog.tsx:70,86-88,202-206`. **Aucun second référentiel à
créer** ; pour le littéral `"INCONNU"` renvoyé par la query non-mappées côté `MOUVEMENT_STOCK`, il
n'existe **pas** de clé i18n dédiée — la story UI doit soit ajouter une clé
`stock.produits.taillesGranule.INCONNU` (cohérent avec le pattern existant), soit gérer ce cas à part
avec un libellé du namespace `previsions` (à trancher par le développeur, non structurant).

**`useDialogCloseGuard` — signature exacte confirmée :**
`src/hooks/use-dialog-close-guard.ts:42` — `useDialogCloseGuard(isDirty: boolean): { onInteractOutside,
onEscapeKeyDown }`, à spreader sur `<DialogContent onInteractOutside={...} onEscapeKeyDown={...}>`.
Exemple d'usage à copier : `aliment-form-dialog.tsx:84` (`useDialogCloseGuard(touched)`).

**`Input` — molette neutralisée, confirmé.** `src/components/ui/input.tsx:63-74` : `onWheel` custom
qui fait perdre le focus (`e.currentTarget.blur()` implicite via le commentaire) pour tout
`type="number"`, en plus de tout `onWheel` fourni en props. `min`/`max` passent tels quels via
`...props` (pas de logique dédiée nécessaire côté story).

**Permissions.** `PREVISIONS_PARAMETRER` est bien la permission qui gouverne
`MappingRapprochement` (ADR §6 : « Administrateur : + PREVISIONS_PARAMETRER (... `MappingRapprochement`) »),
confirmée POST côté API (`route.ts:71`). Côté client, le pattern déjà en place dans 3 onglets
(`aliments-tab.tsx:49`, `charges-tab.tsx:92`, `parametres-tab.tsx:142`) est
`permissions.includes(Permission.PREVISIONS_PARAMETRER)` sur la prop `permissions: Permission[]`
déjà propagée à tous les onglets par `scenario-detail-client.tsx` — **sauf** à `RapprochementTab`
actuellement (`scenario-detail-client.tsx:250-252` ne passe que `rapprochement`, pas `permissions`).
C'est un changement obligatoire de signature à faire dans PR3-bis.

### 2. Décision d'emplacement — TRANCHÉE

**Décision : 5ᵉ sous-onglet dans le `Tabs` imbriqué existant de `rapprochement-tab.tsx`
(`mensuelle` / `cumulee` / `parVague` / `topEcarts` / **`mapping`**), pas un onglet de plus au niveau
`scenario-detail-client.tsx`, pas une route séparée.**

Justification :
- ADR §15.7 acte que le module est organisé en onglets sous `/previsions/scenarios/[id]`, jamais en
  routes séparées — une route `/previsions/mapping` reproduirait exactement le décalage documentaire
  déjà fiché et explicitement non corrigé.
- `scenario-detail-client.tsx` porte déjà **9 onglets** de premier niveau avec défilement horizontal
  forcé sur mobile (`overflow-x-auto` + `scrollIntoView` programmatique, commentaire `:119-137`) — un
  10ᵉ onglet de premier niveau aggraverait un mécanisme déjà tendu (cf. contrainte de plafond de
  navigation évoquée dans la mission). Le sous-niveau de `rapprochement-tab.tsx` n'a que 4 entrées
  aujourd'hui, largement sous tension à 5.
- **Tension identifiée et tranchée malgré tout : le mapping est scopé au `siteId`, pas au
  `scenarioId`** (ADR §3.9, confirmé par le schéma : `MappingRapprochement.siteId`, aucun
  `scenarioId`). Le placer sous un `scenarioId` d'URL est donc une approximation délibérée, pas un
  reflet exact du modèle — mais c'est la même approximation déjà acceptée pour
  `ParametresPrevision`/`PostePrevision` (eux authentiquement scénario-scopés, contrairement au
  mapping) sous la même gate `PREVISIONS_PARAMETRER`. Aucune page de réglages de site pour le module
  Prévisions n'existe (`find src/app -path "*previsions*" -name page.tsx` ne remonte que
  `scenarios/page.tsx` et `scenarios/[id]/page.tsx`) — créer une telle page serait une route
  supplémentaire, contraire à §15.7, pour un seul écran d'administration. **La bande d'information
  du sous-onglet Mapping doit dire explicitement "ce mapping s'applique à tout le site, pas
  seulement à ce scénario"** pour ne pas induire l'utilisateur en erreur sur la portée — c'est un
  prérequis de livraison de la vue, pas un détail cosmétique (même discipline que §15.1 sur la
  fraîcheur).
- Rendu à 375px : le `<Select>` de mois existant + le `TabsList` à 5 entrées doivent rester dans le
  même `overflow-x-auto`/`scrollbar-hide` déjà en place pour le `TabsList` imbriqué — aucun nouveau
  mécanisme de scroll à inventer, réutilisation stricte du pattern `rapprochement-tab.tsx:87-93`. Le
  sous-onglet Mapping ne dépend d'aucun mois sélectionné (contrairement aux 4 autres) — il ne doit
  **pas** lire `moisSelectionne`, c'est une vue autonome au-dessus du sélecteur de mois.

### 3. Plan de stories

| Story | Type | Fichiers | Critères d'acceptation | Dépendances |
|---|---|---|---|---|
| **PR3bis.1** | SCHEMA (mineure, optionnelle) | `src/lib/validation/previsions.schema.ts` (`ligneMappingRapprochementInputSchema`) | `.refine()` : `cibleId` obligatoire (non null) si `cibleType !== NON_RAPPROCHE` ; `cibleId` doit être `null`/absent si `cibleType === NON_RAPPROCHE`. Test unitaire par falsification (cas valide/invalide des deux côtés). | Aucune |
| **PR3bis.2** | UI | `src/components/previsions/rapprochement-tab.tsx` (passer `permissions`), `scenario-detail-client.tsx:250-252` (passer `permissions` à `RapprochementTab`) | `RapprochementTab` reçoit `permissions: Permission[]` en prop, la transmet au nouveau sous-onglet. Build + tests existants de `rapprochement-tab.test.tsx` toujours verts. | Aucune |
| **PR3bis.3** | UI | Nouveau `src/components/previsions/rapprochement-mapping-tab.tsx` — liste des catégories réelles non mappées | Appelle `GET /api/previsions/mapping-rapprochement/non-mappees` côté client (`usePrevisionsApi().get`) ; affiche `sourceType` + `sourceCle` traduit lisiblement (granulométrie en mm via `useTranslations("stock")`/`produits.taillesGranule.*`, catégories dépense/produit via leur i18n existant déjà utilisé ailleurs dans le module) ; état vide explicite (« aucune catégorie non mappée ») distinct d'un état de chargement/erreur ; bandeau de portée site (cf. §2) toujours visible. Mobile-first (cartes empilées, pas de tableau, cf. CLAUDE.md). | PR3bis.2 |
| **PR3bis.4** | UI | Extension de `rapprochement-mapping-tab.tsx` (ou composant dialogue dédié `mapping-form-dialog.tsx`) — création de mapping depuis la liste | Pour une catégorie non mappée sélectionnée : formulaire `cibleType` (`POSTE_PREVISION`/`ALIMENT_PREVISION`/`VENTE_PREVUE`/`NON_RAPPROCHE`), sélection de cible (peuplée depuis `GET /api/previsions/scenarios/[id]/postes` et `GET /api/previsions/scenarios/[id]/aliments` **du scénario actuellement affiché** — voir risque R1 ci-dessous, à documenter explicitement dans le formulaire) ou aucune cible si `NON_RAPPROCHE`. À la soumission : `GET` du mapping actif complet, fusion (ajout de la nouvelle ligne, ou remplacement d'une ligne existante de même `sourceType`+`sourceCle`), `POST /api/previsions/mapping-rapprochement` avec le tableau complet. Utilise `useDialogCloseGuard` (R5, ERR-145/146) si un `Dialog` est choisi. Bloqué (désactivé, pas masqué) si `!permissions.includes(PREVISIONS_PARAMETRER)`. | PR3bis.3, PR3bis.1 (si livrée) |
| **PR3bis.5** | UI | Extension du même composant — consultation + modification des mappings existants avec version | Affiche le mapping actif courant (`GET` sans `?version`) groupé par `sourceType`, avec le numéro de version affiché. Modification = même mécanisme que PR3bis.4 (remplacement en bloc, nouvelle version). Un mapping historique (`?version=N` d'un mois clôturé) n'est PAS éditable depuis cet écran — lecture seule si l'utilisateur consulte une version passée (à clarifier : cet écran ne consulte QUE la version active, pas les versions historiques d'un mois clôturé — cf. risque R2). | PR3bis.3 |
| **PR3bis.6** | TEST | `src/components/previsions/__tests__/rapprochement-mapping-tab.test.tsx` (et dialogue si créé) | Couvre : rendu liste non-mappées, granulométrie traduite en mm (pas le code `G2` brut), état vide, création (POST avec le mapping complet, pas un POST partiel), désactivation des actions si permission absente, test ouvrir→saisir→fermer→rouvrir si un `Dialog` est utilisé (ERR-145/146), test clic extérieur sans saisie (ERR-146). `npx vitest run` + `npm run build` verts. | PR3bis.2 à PR3bis.5 |
| **PR3bis.7** | REVIEW | — | R1-R11, notamment R5 (`DialogTrigger asChild` si dialogue), R6 (variables CSS), mobile 375px réel (pas seulement jsdom, cf. ERR-157 — capture ou vérification en environnement de rendu réel si un mécanisme de mise en page complexe est introduit). | Toutes les précédentes |

### 4. Risques et pièges

**R1 — Risque structurel non testé : `cibleId` d'un mapping site-scopé pointe vers une entité
scénario-scopée.** `MappingRapprochement.cibleId` référence `PostePrevision.id`/`AlimentPrevision.id`
(via `versMappingActif`, `previsions-rapprochement.ts:105-113`) — ces deux modèles sont
**scénario-scopés** (ADR §3.5, §3.8), alors que le mapping lui-même est **site-scopé** et « sert
potentiellement plusieurs scénarios successifs du même site » (ADR §3.9). Preuve tracée dans le
moteur : dans `reconcilierPrevuEtReel` (`src/lib/previsions/rapprochement.ts:310-323,343-344`), une
ligne réelle mappée vers un `cibleCle` qui ne correspond à **aucune** `EntreePrevueRapprochement.cle`
du scénario courant (parce que ce `cibleId` désignait un `PostePrevision` d'un **autre** scénario,
par ex. un scénario archivé remplacé par un nouveau) est accumulée dans `reelParCibleEtMois` mais
**jamais lue** par aucune `prevue` du scénario courant — elle disparaît silencieusement du
rapprochement affiché (ni `RAPPROCHE`, ni `NON_RAPPROCHE`, absente des deux). Aucun test existant
(`rapprochement.test.ts`, `previsions-rapprochement-mapping-integration.test.ts`) ne couvre ce cas
multi-scénario. **Mitigation pour PR3-bis (documentaire, pas un correctif backend)** : le formulaire
de création (PR3bis.4) doit peupler les listes Poste/Aliment **exclusivement depuis le scénario
actuellement affiché** et afficher un avertissement explicite (« ce mapping cible un poste du
scénario [nom] — si ce scénario est archivé, ce mapping cessera de fonctionner correctement pour un
nouveau scénario tant qu'il n'est pas remis à jour »). Un correctif structurel (ex. permettre de
retrouver la cible par nom plutôt que par FK à travers les scénarios) est hors périmètre de ce sprint
et devrait être remonté à `@architect`/knowledge-keeper comme piste d'amendement ADR.

**R2 — Ambiguïté à trancher explicitement avant PR3bis.5 : consultation d'une version historique.**
`GET /api/previsions/mapping-rapprochement?version=N` existe et fonctionne, mais rien dans le plan de
stories du sprint n'exige de l'exposer dans l'écran de consultation — décider dès la story si l'écran
n'affiche QUE la version active (plus simple, cohérent avec « éditer » qui ne peut de toute façon
porter que sur l'actif) ou permet de naviguer l'historique en lecture seule (plus complet, plus de
surface UI). Recommandation : version active seulement pour ce sprint, consultation historique
explicitement reportée (cohérent avec l'esprit de §15.8 de l'ADR, qui reporte plutôt que de bâcler).

**R3 — Zones interdites, à ne jamais toucher.** `src/lib/previsions/` (le moteur pur, recette
protégée) — aucune story de ce sprint n'a de raison d'y toucher, PR3-bis est un sprint UI qui
consomme des routes déjà stables. Si une story UI semble nécessiter un changement dans
`rapprochement.ts`/`route-orchestration.ts`, c'est un signal d'alarme : la pré-analyse doit être
rouverte. Idem pour toute écriture dans `Depense`/`Vente`/`MouvementStock` (ADR §5.1(a)/§15.6 dernier
paragraphe) — le mapping n'écrit que dans `MappingRapprochement`, jamais dans le domaine réel.

**R4 — Piège déjà rencontré, à ne pas reproduire : jsdom ne prouve pas la mise en page (ERR-157).**
Si le sous-onglet Mapping introduit un mécanisme de mise en page non trivial (ex. liste collante,
overflow complexe), une vérification en rendu réel est nécessaire en plus des tests jsdom — pas
attendu a priori pour un simple sous-onglet de plus dans un `Tabs` déjà en place, mais à surveiller
si le formulaire de création devient complexe.

**R5 — Gap de validation `cibleId`/`cibleType` (PR3bis.1) : non bloquant pour GO mais à corriger tôt.**
Voir détail section 1. Sans ce correctif, un bug de formulaire pourrait créer silencieusement une
ligne « fantôme » (cible affichée dans le formulaire mais jamais réellement rattachée côté moteur).

### 5. Vérification de l'état de départ

**Tests :**
```
Test Files  292 passed | 11 skipped (303)
     Tests  9340 passed | 39 skipped | 26 todo (9405)
```
`npx vitest run` — 0 échec.

**Build :** `npm run build` — compilation réussie, aucune erreur (`grep -i error` sur la sortie
complète : aucune occurrence). Toutes les routes buildées incluent bien uniquement
`/previsions/scenarios` et `/previsions/scenarios/[id]` côté pages (confirme §15.7).

**État de la base (lecture seule stricte, EXCEL-V12) :**
- Scénario `EXCEL-V12` existe : `id=cmsdnypml0000n4ekuadykn0f`, `statut=BROUILLON` (pas `ACTIF` —
  donc **aucun `SnapshotBudgetInitial` n'existe pour ce scénario**, cohérent : le snapshot ne se crée
  qu'à l'activation, ADR §15.2).
- Vagues prévues : 19
- Alevins totaux (`effectifAlevinsPrevu`) : 602 500
- Calibres (`AlimentPrevision`) : 3
- Paliers de remise : 4
- Apports capital : 7
- Journal dépenses prévues : 5
- Charges mensuelles (jointure poste) : 84
- `ParametresPrevision` (colonne par colonne) : `effectifAlevinsParVague=10000`,
  `margeSecuriteAlevinsPct=10`, `poidsMoyenInitialG=5`, `poidsObjectifG=400`,
  `prixAlevinUnitaireFCFA=70`, `prixVenteKgFCFA=1900`, `nombreBacsSimultanesCible=4`,
  `frequenceStockageMois=1`, `capaciteTransportAlevinsNb=20000`,
  `capaciteTransportAlimentsSacs=60`, `capaciteTransportPoissonsKg=1500`,
  `coutTransportAlevinsFCFA=30000`, `coutTransportAlimentsFCFA=15000`,
  `coutTransportPoissonsFCFA=25000`, `tauxEpargnePct=30`, `alevinsAchetesParDefaut=false`,
  `tresorerieInitialeFCFA=0`. **Aucun champ `seuilEcartVertPct`/`seuilEcartOrangePct`** n'existe sur
  ce modèle — les seuils de couleur d'écart (ADR §15.5) sont actuellement des constantes codées en
  dur (`SEUILS_ECART_PAR_DEFAUT`, `src/lib/previsions/rapprochement.ts`), pas configurables par site.
  Hors périmètre de PR3-bis (pas mentionné dans la mission), signalé pour information seulement.

**`MappingRapprochement` / `ClotureMois` — comptage par site : ZÉRO ligne dans les deux tables, tous
sites confondus.** Aucun mapping n'existe en base à ce jour, sur aucun site. Ceci confirme
définitivement que l'écran d'administration est un prérequis fonctionnel réel, pas un cas d'école :
sans lui, **aucune** catégorie réelle du produit n'est aujourd'hui rapprochable — tout le réel de
tout site tombe systématiquement dans le bac `NON_RAPPROCHE`.

## Verdict final

**GO AVEC RÉSERVES.**

Conditions :
1. **PR3bis.2 est un prérequis strict** de toutes les stories UI suivantes (propagation de
   `permissions` à `RapprochementTab`, absente aujourd'hui) — à livrer en premier.
2. **Le bandeau de portée « ce mapping s'applique à tout le site »** (§2) et **l'avertissement sur le
   scénario de la cible** (R1) sont des critères d'acceptation obligatoires de PR3bis.3/PR3bis.4, pas
   des détails cosmétiques reportables — cohérent avec la discipline déjà appliquée à la fraîcheur
   (§5.1.b) et à `SANS_SOURCE_REELLE` (§15.1) dans ce module.
3. **PR3bis.1 (validation `cibleId`/`cibleType`) est recommandée mais pas strictement bloquante** —
   peut être faite en parallèle ou juste avant PR3bis.4 sans retarder PR3bis.3.
4. Aucun développement API/queries/schema n'est requis pour les capacités 1 et 3 de la mission (voir,
   consulter) ; la capacité 2 (créer) réutilise le POST existant en mode « remplacement complet du
   tableau », **jamais** un ajout unitaire — ce point doit être explicite dans l'implémentation pour
   éviter de désactiver accidentellement tout le mapping actif du site en croyant n'ajouter qu'une
   ligne.
