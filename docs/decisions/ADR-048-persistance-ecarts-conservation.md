# ADR-048 — Persistance des écarts de conservation tolérés (bacs en dérive)

**Statut :** Acceptée
**Date :** 2026-07-26
**Sprint :** SU (story SU.2)
**Auteur :** @architect
**Réfs :** ADR-043 (Bac/AssignationBac), guard GT.1/GT.2 (`assignation-invariant.ts`),
`docs/analysis/pre-analysis-sprint-SU-BL.md` (section SU.2), Bac 11 / Vague-26-03-Prep (incident prod).

---

## 1. Contexte

Depuis GT.1/GT.2, `verifyAssignationInvariant` (appelée depuis **9 call sites** : arrivages,
transferts ×2, calibrages, ventes, vente-alevins, bons-livraison) tolère un écart de
conservation **préexistant** (mesuré avant l'opération) et ne bloque que si l'opération l'a
**aggravé**. Quand un écart préexistant est toléré, la seule trace produite est un
`console.warn` — donc **éphémère**, invisible dès que le process log tourne (rotation, perte
en cas de conteneur éphémère, aucune requête possible). Un bac qui dérive silencieusement
n'est détectable qu'au moment où une opération finit par le bloquer — c'est exactement le
scénario Bac 11 de Vague-26-03-Prep, qui a coûté une impasse en production : la dérive
existait depuis plusieurs opérations avant de bloquer, sans qu'aucune alerte préalable ne
soit possible.

Objectif : persister ces écarts pour qu'un bac en dérive soit détectable **avant** de
bloquer une opération, via une requête « quels bacs dérivent aujourd'hui et de combien ».

Deux points de log additionnels existent dans `bons-livraison.ts` (clamp `Math.max(0, ...)`
sur `nombreVendus`, lignes ~799-808 et ~927-936, un par mode rectificatif/normal). Leur
sémantique est analysée séparément ci-dessous (section 4) : ce n'est **pas** le même
phénomène que la tolérance du guard.

---

## 2. Deux signaux distincts — ne pas les fusionner

| | Guard `verifyAssignationInvariant` (`e.ecart !== 0`, toléré) | Clamp `bons-livraison.ts` (×2) |
|---|---|---|
| **Nature** | Écart **structurel et persistant** sur un bac : le nombre réel diverge du nombre attendu, et cette divergence **survit** à l'opération (elle ne s'aggrave ni ne se résout forcément). C'est un **état du bac**, qui perdure tant que personne ne fait un COMPTAGE correctif. | Un delta de calcul intermédiaire (`oldVendus + deltaMorts` ou `oldVendus - nombreMortsTransport`) qui devient **négatif** — impossible en théorie (on ne peut pas avoir vendu moins que 0 poisson). C'est le signal qu'**un calcul en amont serait faux** (ex. deux rectificatifs successifs qui se chevauchent, désynchronisation entre `LigneVente` et `Releve` VENTE). |
| **Fréquence attendue** | Rare mais **répétée** tant que le bac reste en dérive (à chaque opération qui le touche). | Quasi nulle en usage normal — ne devrait **jamais** se déclencher ; s'il se déclenche, c'est un signal d'alerte pour un développeur, pas une donnée de suivi métier. |
| **Ce qu'on veut en tirer** | Une vue "état courant" : *quels bacs sont en dérive aujourd'hui, de combien* — pour agir (comptage, correction) avant blocage. | Un historique d'événements diagnostiques rares, à investiguer manuellement (pourquoi un delta est devenu négatif) — pas un tableau de bord de suivi. |
| **Modèle de données adapté** | État par bac, **upserté** (une ligne vivante par bac, mise à jour à chaque nouvelle détection). | Événement, **append-only** (chaque occurrence est un fait daté distinct à examiner, pas un état à faire converger). |

**Décision : deux mécanismes de persistance distincts.**
- Le guard (état persistant) → nouvelle table dédiée, upsert (section 3).
- Les 2 clamps (anomalie de calcul, rarissime) → `SiteAuditLog` existant, une entrée
  `action: "BL_CLAMP_NOMBRE_VENDUS_NEGATIF"` par occurrence, `details` incluant le mode
  (`rectificatif`/`normal`) pour les distinguer sans dupliquer le modèle. Les deux clamps
  produisent la **même action** (ils sont la même anomalie, deux points d'entrée dans le
  code) — un champ `details.mode` suffit à les différencier a posteriori, pas la peine d'une
  action distincte par mode. Ce choix est cohérent avec la nature déjà "audit
  d'événements hétérogènes rares" de `SiteAuditLog` (déjà utilisé pour `BON_LIVRAISON_RECTIFIE`,
  `RELEVE_MORTALITE_SUPPRIME_RECTIFICATIF`), et n'introduit aucun coût : `userId` est déjà
  disponible dans `signerBonLivraison` (paramètre existant de la fonction), donc `actorId`
  NOT NULL n'y pose aucune friction — contrairement au guard (section 5).

---

## 3. Support de persistance du guard : table dédiée vs `SiteAuditLog`

### Critère 1 — Volume d'écriture
Le `console.warn` actuel ne se déclenche que si `e.ecart !== 0` **après tolérance**, donc
uniquement pour des bacs **déjà en dérive** — une situation anormale, rare en usage nominal.
Le volume est **faible et non pic-global** : il dépend de la fréquence des opérations sur les
bacs *déjà* en dérive, pas d'un flux constant. Ce volume est compatible avec les deux options
(un log JSON de plus par occurrence, ou un upsert par bac) — **ce critère ne départage pas**
à lui seul.

Cependant, le mode d'écriture diffère structurellement : `SiteAuditLog` en usage courant est
un flux **append-only** (une ligne par occurrence, jamais mise à jour) — chaque passage du
guard sur un bac en dérive réinsérerait une nouvelle ligne, y compris si l'écart est strictement
identique à la détection précédente (le cas normal : "toléré car identique avant/après"). Sur
un bac qui reste en dérive pendant des semaines avec des opérations quotidiennes, cela
produit N lignes strictement redondantes pour dire la même chose : "toujours en dérive de X".
Une table à upsert n'écrit qu'une seule ligne par bac, mise à jour en place — le volume de
lignes total reste borné par le nombre de bacs, pas par le nombre d'opérations.

**Verdict : léger avantage à la table dédiée** (pas déterminant seul, mais already favorable).

### Critère 2 — Requêtabilité de « quels bacs dérivent aujourd'hui et de combien »
- **Sur `SiteAuditLog`** : la question posée est un état courant ("aujourd'hui"), mais le
  support est un flux d'événements. Il faudrait, pour chaque bac, retrouver la ligne la plus
  récente d'une action dédiée puis vérifier que son `details.ecart` est non nul — ce qui
  impose soit du SQL brut (`DISTINCT ON (details->>'bacId')`, PostgreSQL uniquement, hors
  Prisma Client), soit une agrégation applicative coûteuse (charger tout l'historique de
  l'action pour le site, grouper par bacId en mémoire, garder le max de date). Aucune des deux
  approches ne bénéficie d'un index sur le contenu JSON (`details` n'est pas indexé) : la
  requête dégraderait avec le nombre cumulé d'événements, pas avec le nombre de bacs en
  dérive réels (qui est la vraie grandeur pertinente).
- **Sur une table dédiée à une ligne par bac** : `WHERE siteId = ? AND ecart != 0 ORDER BY
  ABS(ecart) DESC` sur un index `(siteId, ecart)` — requête Prisma standard (`findMany`),
  coût proportionnel au nombre de bacs **réellement en dérive** (par définition petit), pas à
  l'historique.

**Verdict : net avantage à la table dédiée.** C'est le critère décisif — la question posée
("état courant") ne correspond structurellement pas à ce que `SiteAuditLog` est conçu pour
représenter (un historique d'événements).

### Critère 3 — R8 (siteId obligatoire)
Les deux options satisfont R8 nativement : `SiteAuditLog.siteId` existe déjà (NOT NULL,
indexé) ; la nouvelle table aura `siteId` NOT NULL + index dès sa création (section 6). Ce
critère est neutre entre les deux options — mais confirme qu'une table dédiée ne coûte rien
de plus sur ce point précis.

### Décision
**Table dédiée**, nommée `EcartAssignationConstate`. Le modèle correct pour "l'état d'un bac
qui dérive" est un enregistrement **upserté par bac** (dernier écart constaté, première
détection, dernière détection), pas un flux d'événements append-only. `SiteAuditLog` reste
strictement le bon outil pour les 2 clamps (anomalies rares, diagnostiques, événementielles —
section 2), mais serait un mauvais outil pour un état qui doit être interrogé "en direct" et
qui se répare ou s'aggrave dans le temps.

---

## 4. Analyse des 2 clamps de `bons-livraison.ts` (traitement séparé)

Les deux clamps (~L.799-808 mode rectificatif, ~L.927-936 mode normal) partagent :
- même formule structurelle : `Math.max(0, rawVendus)` où `rawVendus` peut être négatif si un
  delta de morts en transport dépasse la quantité déjà vendue enregistrée sur le relevé VENTE.
- même préfixe de message (`"[signerBonLivraison] clamp nombreVendus ... valeur negative
  absorbee"`).
- **jamais censés se déclencher en usage normal** (contrairement au guard, où l'écart
  préexistant est un cas prévu et documenté — GT.1).

Ils diffèrent seulement par le contexte d'appel (rectificatif re-signe une ligne déjà
signée vs normal signe pour la première fois) — un détail de `mode` à consigner dans
`details`, pas une raison de créer deux actions ou deux tables. **Ils produisent le même
type d'enregistrement** (un événement `SiteAuditLog`), pas deux.

**Décision : les deux clamps écrivent dans `SiteAuditLog`** (déjà disponible dans
`signerBonLivraison`, `userId` déjà en scope — zéro friction `actorId`), action unique
`BL_CLAMP_NOMBRE_VENDUS_NEGATIF`, avec `details: { mode: "rectificatif" | "normal",
ligneVenteId, oldVendus, deltaMorts | nombreMortsTransport, rawVendus, bonLivraisonId }`.
Ce n'est **pas** dans le périmètre d'`EcartAssignationConstate` (qui concerne uniquement le
guard d'invariant bac↔vague) — ne pas les mélanger dans la même table.

---

## 5. Le problème `actorId` / `userId`

`SiteAuditLog.actorId` est NOT NULL. `verifyAssignationInvariant(tx, siteId, vagueId, bacIds,
ecartsRef?)` n'a **pas** de paramètre `userId`. Deux options :

- **(a) Rendre `userId` obligatoire dans la signature** → breaking change sur les 9 call
  sites, à faire dans le même changement.
- **(b) Paramètre optionnel `userId?: string` (+ `contexte?: ContexteDetectionEcart`)** →
  non-breaking, les 9 call sites compilent sans modification immédiate.

**Décision : (b), avec migration recommandée immédiate des 9 call sites dans le même
sprint** (userId est déjà disponible dans le scope de chacun des 9 appelants observés —
`transferts.ts`, `bons-livraison.ts`, `ventes.ts`, `calibrages.ts`, `vagues/[id]/vente-alevins`
sont tous des mutations authentifiées qui reçoivent déjà `userId` en paramètre). Rendre le
paramètre optionnel découple la migration de schéma (db-specialist, bloquante) du threading
des 9 appels (développeur, peut être fait en parallèle ou immédiatement après sans nouvelle
migration) — mais ce découplage ne doit pas devenir un report indéfini : le ticket
d'implémentation doit inclure les 9 mises à jour d'appel, pas seulement le paramètre.

C'est pourquoi `EcartAssignationConstate.dernierActorId` est **nullable** (R7, décidé
maintenant) : la table doit pouvoir accepter une écriture même si un appelant n'a pas
(encore, ou jamais, pour un job système) de `userId` à fournir — contrairement à
`SiteAuditLog.actorId` qui est NOT NULL parce que ses actions sont toutes déclenchées par un
acteur humain identifié. Ici, l'attribution "qui a détecté" est secondaire : la donnée
utile est l'état du bac, pas qui l'a observé.

---

## 6. Conséquences

- Nouveau modèle Prisma `EcartAssignationConstate` (spécification exacte en section 7, pour
  @db-specialist) — migration additive, aucune donnée existante à backfiller (le guard ne
  persistait rien avant ce sprint).
- `verifyAssignationInvariant` gagne un paramètre optionnel (non-breaking) et appelle la
  nouvelle fonction de persistance `persisterEcartConstate` à l'intérieur de la même
  transaction (`tx`), pour la même raison R4 que le guard lui-même : si l'opération est
  rollback, l'écart constaté ne doit pas être persisté non plus (il ne s'est jamais
  matérialisé).
- Une requête `getBacsEnDerive(siteId)` devient disponible pour un futur écran ou une
  alerte proactive (non requis ce sprint, cf. section 8).
- `bons-livraison.ts` gagne 2 `tx.siteAuditLog.create()` supplémentaires aux points de clamp
  existants (aucun changement de modèle, aucune migration nécessaire pour cette partie).
- Le `console.warn` du guard est **conservé en plus de** la persistance (utile pour
  l'observabilité immédiate en dev/staging), pas remplacé.

### Alternative rejetée
Étendre `SiteAuditLog` avec des colonnes dédiées (`bacId`, `ecart`) en plus de `details` JSON,
pour bénéficier d'un index sans créer de nouvelle table. Rejetée : `SiteAuditLog` resterait
un flux append-only, donc le problème de doublons/agrégation "état courant" (critère 2)
subsiste identique — ajouter des colonnes ne change pas la nature append-only du modèle. Le
coût d'une table dédiée est comparable (une migration dans les deux cas) pour un bénéfice
structurel supérieur.

---

## 7. Plan de migration (non-interactif, obligatoire — ERR-002)

1. `@db-specialist` ajoute `model EcartAssignationConstate` + enum `ContexteDetectionEcart`
   dans `prisma/schema.prisma` (spécification exacte section 8 de ce document).
2. Générer le diff : `npx prisma migrate diff --from-config-datasource --to-schema
   prisma/schema.prisma --script > migration.sql` (ERR-002).
3. Inspecter le SQL généré avant de créer le dossier de migration (ERR-038 : vérifier
   qu'aucune dérive non liée à ce changement n'est incluse).
4. Créer manuellement le dossier `prisma/migrations/<timestamp>_add_ecart_assignation_constate/`
   avec ce SQL.
5. `npx prisma migrate deploy`.
6. Migration additive pure (nouveau modèle, nouvel enum) — aucun `ADD VALUE` sur un enum
   existant, aucun risque ERR-001/ERR-049 (pas de valeur retirée, pas de colonne castée sur
   données existantes).
7. Mettre à jour `prisma/seed.sql` : aucune ligne de seed nécessaire pour `EcartAssignationConstate`
   (table vide au démarrage — elle ne se peuple qu'à la détection d'un vrai écart). Optionnel :
   ajouter un cas de test manuel (1 bac en dérive volontaire) si le tester le juge utile pour
   valider `getBacsEnDerive` en local.
8. Mettre à jour `src/types/models.ts` (fait dans ce sprint, cf. section 8 — R3, ERR-087 :
   pas d'auto-synchronisation, à maintenir manuellement).

---

## 8. Spécification pour @db-specialist

### 8.1 Nouveau modèle Prisma

```prisma
enum ContexteDetectionEcart {
  ARRIVAGE
  TRANSFERT
  CALIBRAGE
  VENTE
  VENTE_ALEVINS
  BON_LIVRAISON
  INDETERMINE
}

/// EcartAssignationConstate — État courant (upserté) de l'écart de conservation
/// toléré sur un bac. Une ligne par bac en dérive (ou ayant déjà dérivé et
/// depuis résolu — conservée pour historique, cf. resoluLe).
/// R8 : siteId obligatoire.
model EcartAssignationConstate {
  id                    String                  @id @default(cuid())
  siteId                String
  site                  Site                    @relation(fields: [siteId], references: [id])
  bacId                 String                  @unique
  bac                   Bac                     @relation(fields: [bacId], references: [id])
  vagueId               String
  vague                 Vague                   @relation(fields: [vagueId], references: [id])
  /// Écart signé constaté (actual - expected), identique à EcartBac.ecart du guard.
  ecart                 Int
  /// Date de la toute première détection de cette dérive (jamais réécrite après création).
  premiereDetectionLe   DateTime                @default(now())
  /// Date de la détection la plus récente (mise à jour à chaque upsert).
  derniereDetectionLe   DateTime                @default(now()) @updatedAt
  /// Contexte (quelle opération métier était en cours) lors de la dernière détection.
  dernierContexte       ContexteDetectionEcart  @default(INDETERMINE)
  /// Utilisateur ayant déclenché l'opération lors de la dernière détection.
  /// Nullable (R7) : verifyAssignationInvariant n'a pas toujours userId disponible
  /// (paramètre optionnel, cf. ADR-048 section 5) tant que les 9 call sites ne
  /// sont pas tous migrés.
  dernierActorId        String?
  dernierActor          User?                   @relation("EcartAssignationActor", fields: [dernierActorId], references: [id])
  /// Date à laquelle l'écart est repassé à 0 (comptage correctif). Null tant que
  /// non résolu. La ligne n'est PAS supprimée à la résolution (historique conservé).
  resoluLe              DateTime?
  createdAt             DateTime                @default(now())
  updatedAt             DateTime                @updatedAt

  @@index([siteId, ecart])
  @@index([vagueId])
}
```

Ajouter la relation inverse `ecartsAssignation EcartAssignationConstate[]` sur `Site`, `Bac`,
`Vague`, et `ecartsAssignationActes EcartAssignationConstate[] @relation("EcartAssignationActor")`
sur `User` (pattern identique à `SiteAuditLog.auditLogsActed`).

### 8.2 Nullabilité (R7 — décidée ici, pas après)
| Champ | Nullable | Raison |
|---|---|---|
| `bacId`, `vagueId`, `siteId`, `ecart` | NON | Toujours connus au moment de la détection (le guard a déjà chargé l'assignation active). |
| `dernierActorId` | **OUI** | Le guard n'a pas toujours `userId` disponible tant que les 9 call sites ne sont pas migrés (section 5) ; job système futur possible. |
| `resoluLe` | **OUI** | Null = toujours en dérive ; non-null = résolu à cette date. |
| `dernierContexte` | NON, avec défaut `INDETERMINE` | Toujours renseignable par l'appelant (chaque call site sait quelle opération il exécute) ; défaut pour ne pas bloquer un appel qui omettrait le paramètre. |

### 8.3 Index
- `@@index([siteId, ecart])` — sert directement la requête « bacs en dérive aujourd'hui »
  filtrée par site avec `ecart != 0`.
- `@@index([vagueId])` — pour une vue "dérives de cette vague" (probable évolution UI, cf.
  section 9).
- `@@unique` implicite sur `bacId` (colonne `@unique`) — clé d'upsert, garantit une seule
  ligne vivante par bac.

### 8.4 Signature de la fonction de persistance (à ajouter dans `assignation-invariant.ts`)

```typescript
export interface PersisterEcartOptions {
  userId?: string;
  contexte?: ContexteDetectionEcart; // défaut INDETERMINE si absent
}

export async function persisterEcartConstate(
  tx: PrismaTransactionClient,
  siteId: string,
  vagueId: string,
  bacId: string,
  ecart: number,
  options?: PersisterEcartOptions,
): Promise<void>
```

Comportement :
- Si `ecart !== 0` : upsert par `bacId` — `create` renseigne `premiereDetectionLe: now()`,
  `update` NE touche PAS `premiereDetectionLe` (préserver la date de première détection),
  mais met à jour `ecart`, `derniereDetectionLe`, `dernierContexte`, `dernierActorId`, et
  remet `resoluLe: null` si la ligne existait déjà avec un `resoluLe` non-null (une dérive
  précédemment résolue qui réapparaît redevient active).
- Si `ecart === 0` : si une ligne existe pour ce `bacId` avec `resoluLe: null`, la mettre à
  jour (`ecart: 0`, `resoluLe: now()`) — marque la résolution sans supprimer la ligne
  (historique). Si aucune ligne n'existe, ne rien faire (pas de bruit pour un bac qui n'a
  jamais dérivé).

### 8.5 Signature de la query « bacs en dérive »

```typescript
export interface BacEnDerive {
  bacId: string;
  bacNom: string;
  vagueId: string;
  vagueCode: string;
  ecart: number;
  premiereDetectionLe: Date;
  derniereDetectionLe: Date;
  dernierContexte: ContexteDetectionEcart;
}

export async function getBacsEnDerive(siteId: string): Promise<BacEnDerive[]>
```

Implémentation attendue (query layer, `src/lib/queries/ecarts-assignation.ts`, pattern
`vagues.ts`) :
```typescript
prisma.ecartAssignationConstate.findMany({
  where: { siteId, ecart: { not: 0 } },
  include: { bac: { select: { nom: true } }, vague: { select: { code: true } } },
  orderBy: { derniereDetectionLe: "desc" },
})
```
Aucun SQL brut nécessaire (contrairement à l'option `SiteAuditLog` écartée) — c'est
précisément le bénéfice recherché au critère 2.

### 8.6 Traitement des 9 call sites sans les casser
1. `verifyAssignationInvariant` reçoit un **6e paramètre optionnel**
   `options?: { userId?: string; contexte?: ContexteDetectionEcart }` — signature rétro-compatible,
   les 9 appels existants continuent de compiler sans modification.
2. À l'intérieur de la fonction, au point actuel du `console.warn` (ligne ~340-352), ajouter
   l'appel à `persisterEcartConstate(tx, siteId, bacId, vagueId, e.ecart, options)` **en plus**
   du `console.warn` existant (ne pas le retirer).
3. Migration recommandée des 9 call sites (même sprint, cf. section 5) — chacun passe déjà
   `userId` en paramètre de sa propre fonction englobante :
   - `arrivages.ts` → `contexte: ContexteDetectionEcart.ARRIVAGE`
   - `transferts.ts` (×2 sites : source et destination) → `ContexteDetectionEcart.TRANSFERT`
   - `calibrages.ts` → `ContexteDetectionEcart.CALIBRAGE`
   - `ventes.ts` → `ContexteDetectionEcart.VENTE`
   - `vagues/[id]/vente-alevins` (route) → `ContexteDetectionEcart.VENTE_ALEVINS`
   - `bons-livraison.ts` → `ContexteDetectionEcart.BON_LIVRAISON`
4. Si un call site n'est pas migré dans ce sprint (report), `options` reste `undefined` :
   la persistance se fait quand même avec `dernierActorId: null` et
   `dernierContexte: INDETERMINE` — dégradé mais non bloquant, jamais un throw.

### 8.7 Types TypeScript (R3 / R2) — livrés dans ce sprint par @architect
Voir `src/types/models.ts` (interface `EcartAssignationConstate` + enum
`ContexteDetectionEcart`), `src/types/index.ts` (export), et
`src/lib/validation/ecart-assignation.schema.ts` (Zod, si une route API expose la query —
prévu pour un sprint ultérieur, schéma fourni par anticipation).

---

## 9. Recommandation — vue UI (hors périmètre de ce sprint)

**Oui, une vue UI doit suivre dans un sprint ultérieur.** La donnée n'a de valeur
opérationnelle que si un gérant/ingénieur peut la consulter sans lire les logs serveur —
c'est exactement le problème que ce sprint corrige côté données (le Bac 11 a coûté une
impasse parce que personne ne pouvait voir la dérive avant le blocage). Recommandation
concrète pour ce futur sprint :
- Une carte "Bacs en dérive" sur le dashboard site (visible seulement si
  `getBacsEnDerive(siteId)` retourne au moins 1 résultat — pas de bruit sinon), listant bac,
  vague, écart signé, depuis quand (`premiereDetectionLe`).
- Un lien direct vers la fiche du bac ou un raccourci "faire un comptage" (le seul geste qui
  résout réellement la dérive : `resoluLe` ne se met à jour qu'après qu'un relevé COMPTAGE
  ait ramené `expected` = `actual`).
- Pas de UI dans ce sprint (SU.2) : le minimum livrable ici est la persistance + la query
  exploitable, conformément au périmètre demandé.
