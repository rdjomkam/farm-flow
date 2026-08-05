# Pré-analyse — Story A.4 « Périmètre de mapping POSTE_PREVISION — correction structurelle »

**Date :** 2026-08-05
**Agent :** @pre-analyst
**Portée :** lecture seule stricte (code + schéma + SELECT en base de dev partagée). Aucune écriture.

## 0. Intégrité EXCEL-V12 — vérifiée avant tout (SELECT uniquement)

Scénario `Plan de reference Excel v12`, id `cmsdnypml0000n4ekuadykn0f`, site `site_01` :

| Attendu | Mesuré | Statut |
|---|---|---|
| 19 `VaguePrevue` | 19 | OK |
| 602 500 alevins (somme `effectifAlevinsPrevu`) | 602 500 | OK |
| 3 `AlimentPrevision` | 3 | OK |
| 4 `PalierRemise` | 4 | OK |
| `ApportCapital` total 30 000 000 | 30 000 000 | OK |
| `JournalDepensePrevue` total 34 400 000 | 34 400 000 | OK |

Intégrité intacte. Aucune écriture effectuée.

Constat additionnel non demandé mais utile : la base de dev ne contient qu'**un seul**
`ScenarioPrevision` (EXCEL-V12 lui-même) et **0 ligne** `MappingRapprochement` au total. Le
comportement décrit ci-dessous est donc entièrement vérifié par lecture de code/schéma — il n'a
jamais été empiriquement déclenché dans cette base (pas de deuxième scénario pour produire un
mapping orphelin réel). Le raisonnement reste valide (contrainte structurelle du schéma, pas un
artefact de données), mais aucune ligne orpheline réelle n'existe aujourd'hui à corriger.

## 1. Vérification des affirmations de l'énoncé

### 1.1 `MappingRapprochement` scopé site, `PostePrevision` scopé scénario — CONFIRMÉ

- `prisma/schema.prisma:4768-4785` (`MappingRapprochement`) : `siteId String`, `cibleId String?`
  littéral, **aucune** FK Prisma vers `PostePrevision`/`AlimentPrevision`. Unicité
  `@@unique([siteId, version, sourceType, sourceCle])` (ligne 4783).
- `prisma/schema.prisma:4684-4709` (`PostePrevision`) : `scenarioId String`, relation
  `onDelete: Cascade` vers `ScenarioPrevision`, `libelle String` (texte libre), unicité
  `@@unique([scenarioId, libelle])` (ligne 4707) — **aucune clé métier stable indépendante du
  scénario**.
- Confirmé en base (introspection `pg_constraint` / `\d`) : `MappingRapprochement` ne porte
  qu'une seule FK réelle, `siteId → Site`. `cibleId` n'a **ni FK, ni index dédié** — seul
  l'index composite `(siteId, actif)` existe.

### 1.2 « Tout nouveau scénario rend orphelins tous les mappings POSTE_PREVISION du site » — CONFIRMÉ (structurellement), non observé empiriquement

`cibleId` pour `POSTE_PREVISION` est l'id littéral d'un `PostePrevision` d'un scénario précis
(`src/lib/queries/previsions-mapping-orphelins.ts:124-129`, commentaire explicite : « correction
structurelle reportee, story A.4 hors perimetre »). Comme `PostePrevision.id` est un `cuid()`
propre à chaque scénario (même `libelle`, id différent d'un scénario à l'autre — pas de clé
partagée), un mapping créé contre le scénario A a un `cibleId` qui n'existe dans **aucun** autre
scénario. `construireClesCiblesValidesDuScenario` (`previsions-mapping-orphelins.ts:105-117`)
confirme : les clés valides sont recalculées à partir des `PostePrevision.id` du scénario
**courant** uniquement.

### 1.3 « La suppression d'un scénario laisse des mappings pointant vers un id mort » — CONFIRMÉ structurellement, actuellement **inatteignable en pratique**

`PostePrevision.scenario` a `onDelete: Cascade` (schema.prisma:4687) : supprimer un
`ScenarioPrevision` supprime en cascade ses `PostePrevision`, mais rien ne touche
`MappingRapprochement.cibleId` (pas de FK = pas de `SetNull`/`Cascade`/`Restrict` possible). Le
risque est réel au niveau du schéma. **Mais** : aucune route `DELETE
/api/previsions/scenarios/[id]` n'existe dans le code actuel (`grep` négatif sur
`src/app/api/previsions/scenarios/[id]/route.ts`) — seul un passage à `ARCHIVE` existe
(`statut`, jamais une suppression physique). Le chemin de suppression décrit par l'énoncé n'est
donc, à ce jour, accessible que via un accès direct à la base (migration/db-specialist), pas via
un parcours utilisateur normal.

### 1.4 « ALIMENT_PREVISION s'en sort par clé naturelle » — CONFIRMÉ, et déjà corrigé (story A.3, sprint PR3-ter)

`resoudreCibleCleDuScenarioCourant` (`previsions-mapping-orphelins.ts:138-154`) : pour
`ALIMENT_PREVISION`, `cibleId` est un composite `tailleGranule::id` (`parseCibleAlimentPrevision`),
résolu **dynamiquement** contre l'`AlimentPrevision` du scénario **courant** via la clé métier
stable `tailleGranule` (`@@unique([scenarioId, tailleGranule])` sur `AlimentPrevision`, confirmé
en schéma). C'est exactement le mécanisme qu'A.4 devrait porter à `POSTE_PREVISION` — mais
`PostePrevision` n'a pas d'équivalent de `tailleGranule` (un enum stable) : son unicité est
`(scenarioId, libelle)`, un texte libre, potentiellement rebaptisé d'un scénario à l'autre
(« Transport alevins » vs « Transport des alevins »), ce qui n'a rien d'une clé métier fiable.

## 2. Volumétrie réelle en base

- `MappingRapprochement` total : **0 ligne** (toutes catégories confondues). Aucune ligne
  `POSTE_PREVISION`/`ALIMENT_PREVISION`/etc. n'existe en base de dev à ce jour → **0 ligne
  orpheline** mesurable, par et pour aucun scénario/site.
- `ScenarioPrevision` total : **1** (EXCEL-V12 seul). Le scénario porte 4 `PostePrevision`
  (« Salaires », « Énergie et Carburant », « Produits vétérinaires et intrants », « Loyer et
  redevances »), 0 doublon de libellé, tous accentués correctement (voir §8).

Conséquence méthodologique : la story A.4 ne peut **pas** s'appuyer sur un audit de données
existantes pour dimensionner l'impact (il n'y en a pas) — la seule preuve disponible est
structurelle (schéma + code), pas empirique.

## 3. Comportement UI actuel — le bandeau signale, mais seulement dans un écran spécifique

Chemin tracé : `detecterCiblesOrphelinesDuMappingActif`
(`previsions-mapping-orphelins.ts:187-199`) → route `GET
/api/previsions/mapping-rapprochement?scenarioId=...` (paramètre ajouté story A.2, sprint PR3-ter)
→ `rapprochement-mapping-tab.tsx` (5ᵉ sous-onglet de `rapprochement-tab.tsx`) → rendu ligne par
ligne (`rapprochement-mapping-tab.tsx:359-367`) :

```tsx
{m.cibleOrpheline && (
  <div role="alert" className="... border-danger/40 bg-danger/10 ... text-danger">
    <AlertTriangle .../>
    <span>{t("rapprochementTab.mapping.cibleOrpheline")}</span>
  </div>
)}
```

Ce que l'utilisateur voit **exactement** : un bandeau rouge (`role="alert"`) sous la ligne de
mapping concernée, **uniquement s'il ouvre l'onglet « Rapprochement » → sous-onglet
« Mapping »** de `/previsions/scenarios/[id]`, et uniquement pour les mappings appartenant au
mapping **actif** du site (le filet n'est pas branché sur `?version=N` passée, ni sur les 4 autres
sous-onglets de rapprochement).

Ce que l'utilisateur **ne voit jamais**, ailleurs dans l'application : dans les vues mensuelle,
cumulée, par vague, top écarts et trésorerie (les 4 autres sous-onglets), un montant réel accumulé
sous une clé morte **disparaît silencieusement** — confirmé par ERR-179
(`src/lib/previsions/rapprochement.ts:310-322` accumule sous `cibleId` d'un scénario A ;
`rapprochement.ts:343-344`, `reelParCibleEtMois.get(cle) ?? new Decimal(0)`, retombe sur zéro sans
qu'aucun des 3 états nommés (`RAPPROCHE`/`NON_RAPPROCHE`/`SANS_SOURCE_REELLE`) ne soit produit).
`grep` confirmé : `cibleOrpheline`/`orpheline` n'apparaît dans **aucun** autre composant de
`src/components/previsions/` que `rapprochement-mapping-tab.tsx`,
`mapping-form-dialog.tsx` et `mapping-rapprochement-helpers.ts`.

**Verdict précis sur la question posée : le bandeau signale correctement là où il existe, mais il
ne couvre qu'un cinquième de la surface d'affichage du module rapprochement — le symptôme réel (un
montant qui manque dans les totaux) reste invisible partout ailleurs.** C'est exactement le
diagnostic d'ERR-179/ERR-180, qui documentent ce report comme un risque connu **seulement en
commentaires de code**, jamais répété dans un rapport de clôture (ERR-180 lui-même reproche cette
absence de répétition).

## 4. Impact transverse

- **`SnapshotBudgetInitial`** (`schema.prisma:4826-4853`) : `posteId String?` porte une **vraie**
  FK Prisma vers `PostePrevision` (`onDelete: SetNull`), **pas** un `cibleId` littéral comme
  `MappingRapprochement`. Le `categorie` (libellé) est **copié et figé** au moment du snapshot,
  jamais relu depuis la relation vivante — donc un renommage ultérieur de `PostePrevision.libelle`
  (aujourd'hui impossible, voir §7) ou même sa suppression (`SetNull`) ne corromprait **pas**
  l'historique déjà figé du snapshot. **`SnapshotBudgetInitial` n'est pas exposé au même défaut
  que `MappingRapprochement`** : c'est un contre-exemple utile — le modèle avait déjà anticipé ce
  risque avec une vraie FK + copie figée, contrairement à `MappingRapprochement.cibleId`.
- **`ChargeMensuellePrevue.posteId`** : FK réelle `onDelete: Cascade` vers `PostePrevision` —
  cascade cohérente avec le cycle de vie du scénario, aucun id mort possible ici.
- **`ClotureMois`** : ne référence `PostePrevision` qu'indirectement via `versionMapping`
  (pointeur vers une version de `MappingRapprochement`, pas vers un `PostePrevision.id`) — pas de
  risque direct, mais un mois clôturé qui fige `versionMapping = N` peut figer une version du
  mapping qui contenait déjà, au moment de la clôture, un ou plusieurs `cibleId` orphelins
  (aucune validation bloquante actuelle n'empêche de clôturer un mois avec un mapping orphelin
  actif — non vérifié comme bloquant dans `resoudreVersionMappingPourMois` ni dans la route de
  clôture, à confirmer par l'architecte/développeur si jugé pertinent pour A.4).
- **Autres consommateurs de `PostePrevision.id`** identifiés par grep exhaustif :
  `ChargeMensuellePrevue.posteId`, `SnapshotBudgetInitial.posteId` (FK réelles, saines) et
  `MappingRapprochement.cibleId` (littéral, non sain — le seul cas problématique). Aucun export
  PDF/Excel ni service de reporting n'existe encore pour ce module (non trouvé par grep sur
  `previsions` × `export`/`pdf`/`xlsx`).

## 5. Toutes les valeurs de `CibleRapprochement`/`SourceRapprochement` — résolution actuelle

| `CibleRapprochement` | Résolution actuelle | Souffre du défaut ? |
|---|---|---|
| `POSTE_PREVISION` | `cibleId` littéral, site-scopé, cible scénario-scopée | **Oui** — défaut connu et documenté, story A.4 |
| `ALIMENT_PREVISION` | `cibleId` composite `tailleGranule::id`, résolu dynamiquement contre le scénario courant via `tailleGranule` (clé métier stable, enum) | Non — corrigé (story A.3, sprint PR3-ter) |
| `VENTE_PREVUE` | `cibleCle` = sentinelle fixe `VENTE_PREVUE:MONTANT` / `VENTE_PREVUE:TONNAGE` dérivée de `sourceCle`, jamais un id — structurellement stable, aucune entité référencée | Non — immunisé par construction |
| `NON_RAPPROCHE` | `cibleId = null`, aucune cible à résoudre | Non — sans objet |

`ApportCapital` n'a pas de `CibleRapprochement` propre : il est produit côté « entrées prévues »
avec la sentinelle fixe `CLE_APPORT_CAPITAL` et marqué `sansSourceReelle: true`
(`previsions-rapprochement.ts:799-814`) — jamais une cible de mapping, cohérent avec ADR-053
§15.1 (aucune source réelle structurelle).

`SourceRapprochement` (`DEPENSE_CATEGORIE`, `PRODUIT_CATEGORIE`, `VENTE`, `MOUVEMENT_STOCK`) :
la `sourceCle` référence toujours une valeur d'**enum réel** du domaine (`CategorieDepense`,
`CategorieProduit`), stable et partagée par construction — **aucun** défaut de portée côté source,
le problème est strictement unilatéral (côté `cibleId`).

**Conclusion §5 : `POSTE_PREVISION` est le seul cas affecté, et il est déjà identifié comme tel —
rien de « passé inaperçu » n'a été trouvé au-delà de ce qui est déjà documenté par ERR-179/180.**

## 6. Contraintes d'intégrité

Confirmé par introspection Postgres (`pg_constraint`, `\d "MappingRapprochement"`) : **aucune FK**
sur `cibleId`, **aucun index** dédié à `cibleId` (seul `(siteId, actif)` existe). Rien en base
n'empêche ni ne détecte un id mort — la seule protection est applicative
(`detecterCiblesOrphelines`, lecture seule, appelée à la demande par la route GET de l'écran
d'administration).

## 7. Enjeu de renommage — actuellement sans objet, mais latent

Grep exhaustif de `src/lib/queries/previsions-charges.ts` et de
`src/app/api/previsions/scenarios/[id]/postes/route.ts` (seule route CRUD existante pour
`PostePrevision`) : **seuls `GET` (liste) et `POST` (création) existent.** Aucune fonction
`updatePostePrevision`, aucune route `PUT`/`PATCH`/`DELETE` sur un `PostePrevision` précis.
**Le renommage d'un `PostePrevision.libelle` est aujourd'hui impossible via l'application** — ce
qui réduit l'urgence immédiate du risque de mapping cassé par renommage, mais ne l'élimine pas :
le jour où une story ajoute cette édition (probable, un référentiel « paramétrable » sans édition
possible est incomplet), tout mapping `POSTE_PREVISION` existant continuerait de fonctionner
puisque `cibleId` est un id, pas le libellé — un renommage ne casserait donc **pas** un mapping
existant en soi (l'id ne change pas), mais rendrait plus difficile pour un administrateur de
reconnaître visuellement une cible déjà mappée si le libellé affiché change entre deux visites de
l'écran d'administration (UX, pas intégrité).

## 8. Libellés `PostePrevision` du scénario EXCEL-V12

```
Salaires
Énergie et Carburant
Produits vétérinaires et intrants
Loyer et redevances
```

4 lignes, aucun doublon, casse cohérente (majuscule initiale), accents corrects, pas d'espaces
parasites détectés. Trop peu de lignes et un jeu de données trop propre pour juger de la
« normalisabilité » à grande échelle (le classeur Excel réel a fait évoluer ses lignes de
dépenses, cf. ADR-053 §3.8 — mais ce sprint n'a que 4 postes, pas l'historique de plusieurs
versions de classeur pour observer une dérive de libellé). Un futur `PostePrevision.code`
(slug stable, indépendant de `libelle`) serait normalisable sur ce jeu, mais rien dans les
données actuelles ne prouve ou ne réfute la difficulté à normaliser à l'échelle du classeur
complet.

## 9. Verdict

**GO** pour l'arbitrage architectural (l'architecte peut trancher A.4 dès maintenant) — avec
réserve : **aucune donnée réelle orpheline n'existe en base pour valider empiriquement le fix une
fois écrit**, seule la structure du schéma/code le prouve. Le fix devra être validé par un test
qui construit délibérément deux scénarios avec un mapping croisé (pattern déjà établi pour A.1/A.3,
`src/lib/queries/__tests__/previsions-mapping-orphelins-integration.test.ts`), pas par un audit de
données de dev.

## 10. Questions que l'architecte DOIT trancher

1. **Introduire une clé métier stable pour `PostePrevision`**, analogue à `tailleGranule` pour
   `AlimentPrevision` ? Options : (a) un `code` slugifié généré à la création à partir de
   `libelle`, unique `(scenarioId, code)`, édité indépendamment du libellé affiché ; (b) un enum
   fermé `TypePostePrevisionLibelle` (contredit le choix assumé ADR-053 §3.8 : « le classeur Excel
   a fait évoluer ses lignes de dépenses », justification explicite du texte libre) ; (c) ne rien
   changer au modèle `PostePrevision` et reporter la résolution dynamique côté
   `MappingRapprochement` sur autre chose (voir Q2).
2. **Si le libellé reste la seule clé disponible** : résoudre `POSTE_PREVISION` dynamiquement par
   `libelle` (comme `ALIMENT_PREVISION` par `tailleGranule`) plutôt que par `cibleId` littéral —
   accepte le risque de collision si deux scénarios successifs renomment légèrement un poste
   équivalent (« Transport alevins » → « Transport des alevins »ウ) ; l'admin re-choisirait
   silencieusement la mauvaise cible si les libellés divergent d'un mot.
3. **Faut-il réellement scoper `MappingRapprochement` au site** (design ADR-053 §3.9, justifié par
   « un mapping sert plusieurs scénarios successifs ») **ou le scoper au scénario**, quitte à
   redemander à l'administrateur de reconfigurer le mapping à chaque nouveau scénario ? C'est
   l'arbitrage racine : la story A.4 corrige un symptôme du choix « site-scopé » ; l'architecte
   doit décider si ce choix lui-même reste le bon, maintenant que son coût (défaut structurel pour
   `POSTE_PREVISION`, contourné pour `ALIMENT_PREVISION` par une clé métier qui n'existe pas pour
   les postes) est mesuré.
4. **Faut-il ajouter une FK réelle sur `cibleId`** (au prix de perdre le polymorphisme actuel —
   `cibleId` pointe vers des tables différentes selon `cibleType`) ou rester sur un id/clé littéral
   avec détection applicative (`detecterCiblesOrphelines`, déjà en place) — la FK réelle
   empêcherait structurellement un id mort à l'écriture, la détection applicative le tolère mais le
   signale a posteriori.
5. **La détection `cibleOrpheline` doit-elle être étendue aux 4 autres sous-onglets de
   rapprochement** (mensuelle, cumulée, par vague, top écarts, trésorerie), pas seulement à l'écran
   d'administration du mapping — indépendamment de la correction structurelle elle-même, tant que
   le mécanisme reste un id littéral non garanti par une FK ?
6. **Faut-il bloquer la clôture d'un mois (`ClotureMois`) si le mapping actif du moment contient
   au moins une ligne `POSTE_PREVISION` orpheline** contre le scénario en cours de clôture — pour
   ne jamais figer (`versionMapping`) une version du mapping déjà connue comme cassée ?
7. **Périmètre exact de la story A.4** : corriger uniquement `POSTE_PREVISION` (symétrie avec A.3),
   ou revoir simultanément le design de `MappingRapprochement` dans son ensemble (Q3) — un
   correctif ponctuel de `POSTE_PREVISION` sans revisiter Q3 laisserait la même classe de défaut
   ouverte pour toute future `CibleRapprochement` ajoutée sans clé métier stable.
