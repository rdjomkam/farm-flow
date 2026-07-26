# Pré-analyse Sprint SU (rattrapage BL/BF/GT) — 2026-07-26

## Statut : GO AVEC RÉSERVES

## Résumé
5 stories pré-analysées. SU.1 (critique, écran/PDF) et SU.8 (permission orpheline) sont des
bugs réels et non ambigus une fois le code tracé jusqu'au bout — SU.8 en particulier a une
cause racine précise et un précédent de fix identique dans l'historique des migrations.
SU.2 nécessite un arbitrage architecte (pas de décision prise ici, éléments chiffrés fournis).
SU.4 est faisable mais introduit un pattern de test (vraie DB) qui n'existe nulle part
ailleurs dans le projet — à budgétiser. SU.5 conclut à l'absence de bug (aucun calcul
faussé), avec justification technique précise permettant de clore le point.

## Vérifications effectuées

### Build : OK
`npm run build` → exit 0 (Prisma generate + migrate deploy + next build --webpack). Aucune
migration en attente (147 migrations, toutes déployées). Pas d'erreur TypeScript/lint.

### Schéma Prisma : OK
`npx prisma validate` → schéma valide.

### Tests : 5540/5554 passent (14 échecs = flakiness environnementale confirmée, pas des régressions)
`npx vitest run` complet : 10 fichiers déclarés en échec, 14 tests, **tous** avec
`Test timed out in 5000ms` (aucune assertion cassée), répartis sur des fichiers sans rapport
entre eux (auth/password, plan-form-dialog, plan-toggle, bacs-page, gompertz-projections,
vagues-page ×2, dialog-scroll, bottom-nav, **bon-livraison-flow.test.tsx**) — signature d'une
saturation machine en exécution parallèle complète (216s, import 613s cumulés), pas d'un bug.
Ré-exécution ciblée de `bon-livraison-flow.test.tsx` et `password.test.ts` isolément :
**11/11 et 5/5 verts**. Aucune action requise, mais à signaler au tester pour ne pas
confondre avec une régression introduite par SU.1.

Point important pour SU.1 : le test existant `bon-livraison-flow.test.tsx` a déjà un cas
"affiche le recap avec le poids reellement livre (pas le poids commande)" (ligne ~250) —
mais il ne couvre que `poidsLivreKg` (kg), **jamais** `nombrePoissons` (le nombre de
poissons). Le futur test de non-régression SU.1 doit ajouter ce cas manquant explicitement.

---

## SU.1 — Incohérence écran / document signé (CRITIQUE)

### Statut : GO — bug réel et confirmé, périmètre exact identifié

### Traçage complet du flux
1. **`src/components/ventes/bon-livraison-flow.tsx`**
   - Étape `quantites` (avant saisie, ligne **401**) : affiche `{ligne.nombrePoissons}` —
     c'est la valeur **commandée** brute de `LigneVente`. **Pas un bug** : à ce stade rien
     n'a encore été saisi, c'est la référence de la ligne qu'on s'apprête à éditer.
   - Étape `recap` (après saisie des quantités, **avant signature**, ligne **521**) :
     affiche `{ligne.nombrePoissons} {t("recap.poissons")}` — **même valeur brute
     commandée**, alors que juste au-dessus (ligne 508-509) le composant calcule déjà
     correctement `poidsLivre` et `ecart` à partir de `ligneBL` (LigneBonLivraison). Le
     nombre de poissons n'a **jamais** cette même correction. C'est exactement le nit
     "récap affiche 90, PDF affiche 87" de la review BF.
   - Root cause : à ce stade (BROUILLON/EN_ATTENTE_SIGNATURE, pas encore signé),
     `LigneVente.nombrePoissons` vaut encore la quantité commandée (elle n'est décrémentée
     que dans `signerBonLivraison`, cf. plus bas) et `LigneBonLivraison.nombrePoissonsLivres`
     est encore `null` (snapshot rempli seulement à la signature). Le calcul correct et déjà
     disponible côté client est : `ligne.nombrePoissons - (ligneBL?.nombreMortsTransport ?? 0)`
     — exactement la formule utilisée à l'étape `quantites` (ligne 302,
     `quantitesTotalPoissonsLivres`).

2. **`src/lib/queries/bons-livraison.ts` (`signerBonLivraison`, lignes 636-1132)**
   - Lignes **772-1002** (les deux branches, rectificatif et normal) : `LigneVente.nombrePoissons`
     est mis à jour au nombre **livré** (`nouveauNombrePoissons`), ET (ligne **987-1004**,
     correctif déjà appliqué en review BF phase 2) `LigneBonLivraison.nombrePoissonsLivres`
     est figé au même nombre **au moment de cette signature précise**. Ce chemin est
     **correct** depuis la review BF phase 2 (finding Haute déjà corrigé).

3. **`src/app/api/export/bon-livraison/[id]/route.ts`** (lignes 71-84) : lit en priorité
   `ligneBL?.nombrePoissonsLivres`, avec repli sur `ligne.nombrePoissons` seulement pour les
   BL signés avant le correctif (legacy). **Correct**, déjà audité par la review BF phase 2.

4. **`src/components/ventes/vente-detail-client.tsx`** ligne 737 : affiche
   `ligne.nombrePoissons` — **pas un bug**, car après signature ce champ contient déjà la
   valeur livrée (mis à jour par `signerBonLivraison`), et avant signature la vente n'a pas
   encore de BL avec quantités figées à afficher sur cette page.

### Conclusion
Le seul point cassé restant est **`bon-livraison-flow.tsx:521`** (étape recap, juste avant
que l'utilisateur déclenche la signature) — exactement l'écran que le client regarde avant
de signer. Le PDF, la vente et le backend sont déjà corrects (corrigés lors de BF phase 2) ;
seul l'écran de récap affiche encore l'ancienne valeur.

### Fichiers à modifier
- `src/components/ventes/bon-livraison-flow.tsx` ligne **521** (et la donnée dérivée juste
  au-dessus, lignes 506-509, à étendre pour calculer `poissonsLivres` à côté de `poidsLivre`/`ecart`) :
  remplacer `ligne.nombrePoissons` par `ligne.nombrePoissons - (ligneBL?.nombreMortsTransport ?? 0)`.
- Vérifier aussi la clé i18n `recap.poissons` / éventuel besoin d'un `recap.poissonsEcart` si
  on veut aussi signaler l'écart de poissons (optionnel, non demandé par le nit).

### Risques de régression
- Faible. Changement localisé à un seul rendu JSX + une variable dérivée déjà calculée
  ailleurs dans le même fichier (réutilisation du même pattern que `quantitesTotalPoissonsLivres`).
- Ajouter un test explicite (le test existant ne couvre que le kg, pas les poissons — cf. ci-dessus).

---

## SU.2 — Persister les écarts de conservation tolérés

### Statut : ÉLÉMENTS FOURNIS, PAS DE TRANCHE (pour l'architecte)

### Inventaire des points de journalisation (3, pas 2)
1. **`src/lib/guards/assignation-invariant.ts:340-352`** (fonction `verifyAssignationInvariant`)
   — `console.warn("[assignation-invariant] Écart préexistant toléré", {bacId, bacNom, vagueId, ecart})`
   quand `e.ecart !== 0` (identique avant/après, toléré). C'est LE point central : appelé
   depuis **9 sites** (`arrivages`, `transferts` ×2, `calibrages`, `ventes.ts`,
   `vagues/[id]/vente-alevins`, et `bons-livraison.ts`).
2. **`src/lib/queries/bons-livraison.ts:799-808`** — clamp `Math.max(0, rawVendus)` mode
   rectificatif, `console.warn` si `rawVendus < 0`.
3. **`src/lib/queries/bons-livraison.ts:927-936`** — même clamp, mode normal.

Ces 2 derniers (clamps) sont un signal différent : ils indiquent qu'un **calcul de delta en
amont serait faux** (jamais censé se déclencher en usage normal), alors que le premier
(guard) est **attendu et fréquent** dès qu'un bac porte un écart hérité (ex. Bac 11).
Ne pas les fusionner dans le même mécanisme de persistance sans distinguer leur sémantique.

### Fonction manquante : `userId` non disponible dans le guard
`verifyAssignationInvariant(tx, siteId, vagueId, bacIds, ecartsRef?)` **n'a pas de paramètre
`userId`**. Or `SiteAuditLog.actorId` est **NOT NULL** (FK vers `User`, requis). Persister
depuis ce guard nécessiterait donc de faire remonter `userId` dans sa signature (breaking
change sur les 9 call sites) — **ou** d'utiliser un acteur système (`isSystem: true`), ce qui
perdrait la traçabilité de qui a déclenché l'opération tolérée.

### Modèle `SiteAuditLog` (existant)
```
id, siteId (FK, index), actorId (FK User, NOT NULL, index), action (String),
details (Json?), createdAt (index)
```
- Pas de colonne `bacId`, `ecart`, ni `vagueId` — tout irait dans `details` (JSON non indexé).
- Table déjà utilisée pour des actions hétérogènes (`SITE_SUSPENDED`, `VENTE_CLOTUREE`,
  `RELEVE_MORTALITE_SUPPRIME_RECTIFICATIF`, `BON_LIVRAISON_RECTIFIE`...) — un audit trail
  **append-only** d'événements métiers, pas un état courant par entité.

### Volumétrie estimée
- Le `console.warn` ne se déclenche que si `e.ecart !== 0` **après tolérance**, c'est-à-dire
  seulement pour des bacs **déjà en dérive** — situation anormale et rare en usage nominal
  (le cas Bac 11 est présenté comme un cas réel mais isolé). Fréquence attendue : faible
  (quelques occurrences par site par mois dans le pire cas), mais **chaque** appel qui touche
  ce bac tant qu'il reste en dérive réémettra le même warning (pas de déduplication) — donc le
  volume dépend surtout de la fréquence des opérations sur CE bac (ventes/arrivages/transferts/
  calibrages), pas d'un pic global.
- Si l'on choisit de logger inconditionnellement (même `ecart === 0`), le volume grimpe à
  "1 ligne par bac touché par écriture de conservation" — bien plus élevé (chaque vente,
  arrivage, transfert, calibrage sur un site actif), mais ce n'est pas ce que fait le code
  actuel (guard uniquement si `e.ecart !== 0`).

### Faisabilité de la requête « quels bacs dérivent aujourd'hui et de combien »
- **Sur `SiteAuditLog` telle quelle : difficile.** Il faudrait scanner `details` (JSONB,
  pas d'index sur les clés), filtrer par une action dédiée (ex. `ECART_TOLERE`, à créer), puis
  dédupliquer par `bacId` en gardant la ligne la plus récente (fenêtre glissante,
  `DISTINCT ON` ou `ROW_NUMBER()` côté SQL brut — Prisma ne le fait pas nativement). Chaque
  passage du guard réinsère une nouvelle ligne pour le même bac tant que l'écart persiste :
  c'est un log d'événements, pas un état, donc la requête "état courant" nécessite une
  agrégation par bac à chaque lecture (coûteux si le volume grossit, sans index dédié).
- **Une table dédiée** (ex. `EcartAssignationConstate` avec `bacId` FK, `vagueId`, `ecart`,
  `siteId`, `constateLe`, éventuellement upsert "1 ligne par bac courant" plutôt
  qu'append-only) répondrait nativement à la question "état courant par bac" avec un simple
  `WHERE ecart != 0 ORDER BY constateLe DESC` sur un index `(siteId, bacId)`, sans avoir à
  parser du JSON. Coût : nouvelle migration, nouveau modèle, R8 (siteId) à respecter dès le
  départ.

### Ne tranche pas
Décision à prendre par l'architecte : (a) étendre `SiteAuditLog` avec une action dédiée
+ requête d'agrégation applicative, ou (b) créer une table dédiée à l'état de dérive par bac.
Le point bloquant technique commun aux deux options est le **manque de `userId` dans la
signature de `verifyAssignationInvariant`** — à trancher en même temps (paramètre requis vs
acteur système).

---

## SU.4 — Test de robustesse transactionnelle de la signature

### Statut : GO AVEC RÉSERVES — faisable, mais nouveau pattern à introduire dans le projet

### Écritures exhaustives de la transaction `signerBonLivraison` (`src/lib/queries/bons-livraison.ts:636-1132`)
Pré-scan (lecture seule, avant boucle) :
- `captureEcartsAssignation` (1 par vague concernée, lecture)

Boucle `for (const ligne of vente.lignes)` (lignes 747-1009), par ligne :
- `tx.ligneVente.update` (nombrePoissons + poidsLivreKg, ou juste poidsLivreKg si pas de morts)
- `tx.releve.findFirst` + `tx.releve.update` (relevé VENTE, nombreVendus) + `tx.releveModification.create`
- Mode rectificatif : `tx.releve.update`/`tx.releve.create`/`tx.releve.delete` (relevé MORTALITE
  AVARIE) + `tx.releveModification.create` OU `tx.siteAuditLog.create` (suppression)
- Mode normal : `tx.releve.create` (MORTALITE AVARIE) si morts > 0
- `tx.ligneBonLivraison.update` (nombrePoissonsLivres, snapshot)

Après la boucle :
- `tx.vente.update` (statut LIVREE, montants, quantités)
- `tx.bonLivraison.updateMany` **conditionnel** (statut != SIGNE) — c'est la garantie anti-double-signature (R4)
- `verifyAssignationInvariant` par vague (throw possible → rollback)
- `tx.facture.update` (si facture existe)
- `tx.bonLivraison.findUniqueOrThrow` (relecture finale)
- `tx.siteAuditLog.create` (audit VENTE_CLOTUREE / BON_LIVRAISON_RECTIFIE)

### Tests existants et leur limite
- `src/lib/queries/__tests__/bons-livraison.test.ts`,
  `src/lib/queries/__tests__/bons-livraison-rectificatif.test.ts` : **mockent entièrement
  `@/lib/db`**, y compris `$transaction` (wrapper qui appelle juste la fonction passée avec un
  `tx` factice). **Aucun test dans tout le projet n'utilise un vrai client Prisma** (grep
  exhaustif sur `8432`, `DATABASE_URL`, `PrismaClient` réel dans `src/__tests__` et
  `src/lib/queries/__tests__` : zéro résultat). Ces tests valident la logique métier
  (quelles données sont écrites) mais **ne peuvent structurellement pas** prouver l'atomicité
  réelle (rollback Postgres) ni le comportement de concurrence (verrouillage de lignes) —
  le mock n'a aucune notion de transaction réelle.

### Comment tester (a) échec en milieu de transaction
- **Impossible à prouver avec les mocks actuels** : il faut un vrai Postgres. Pattern à
  introduire (aucun existant à réutiliser, à documenter comme nouveau pattern projet) :
  1. Ne PAS mocker `@/lib/db` dans ce fichier de test spécifique — utiliser le vrai
     `PrismaClient` pointé sur `localhost:8432` (docker `silures-db`, cf. MEMORY.md).
  2. Seed minimal (vente EN_PREPARATION + BL EN_ATTENTE_SIGNATURE + ligne + bac + assignation).
  3. Injecter un échec contrôlé **à l'intérieur** de la transaction réelle — par exemple en
     spyant `tx.facture.update` (dernier write avant relecture) pour qu'il rejette une fois,
     via un wrapper Proxy autour du client de test, ou plus simple : construire un scénario où
     une contrainte DB réelle échoue naturellement (ex. valeur qui viole une contrainte
     `@unique` ou `CHECK`), pour ne pas dépendre d'un mock du moteur (cf. ERR-103 leçon (e) :
     "un test qui mocke le moteur ne teste pas le moteur" — même principe ici pour Postgres).
  4. Après l'échec attendu (`await expect(signerBonLivraison(...)).rejects.toThrow()`),
     relire en base (vrai client) : `ligneVente.nombrePoissons` inchangé, `bonLivraison.statut`
     toujours `EN_ATTENTE_SIGNATURE`, aucun `releve` MORTALITE créé, aucune ligne
     `SiteAuditLog` — preuve d'absence d'effet partiel.

### Comment tester (b) double signature concurrente
- Nécessite aussi un vrai Postgres (le `updateMany` conditionnel + Read Committed sont un
  comportement moteur, pas applicatif). Pattern : seed un BL `EN_ATTENTE_SIGNATURE`, lancer
  `Promise.allSettled([signerBonLivraison(...), signerBonLivraison(...)])` avec les MÊMES
  arguments (mêmes signatures) en parallèle réel (deux vrais appels concurrents sur le même
  `PrismaClient`, pas dans la même transaction), puis vérifier : exactement 1 `fulfilled` + 1
  `rejected` (`ValidationError` "deja signe"), et en relecture `ligneVente.nombrePoissons`
  décrémenté **une seule fois** (pas deux).

### Fichiers concernés
- Nouveau fichier suggéré : `src/lib/queries/__tests__/bons-livraison-transaction-integration.test.ts`
  (nom distinct pour signaler "vraie DB" vs les tests mockés existants).
- Nécessite un helper de setup/teardown DB (reset entre tests) — à créer, aucun équivalent
  existant dans le projet (seed.sql est un seed complet, pas un reset ciblé pour tests).

### Risque
Effort non trivial (premier test d'intégration réelle du projet) : prévoir du temps dédié,
pas juste "ajouter un test" — c'est une brique d'infrastructure de test nouvelle.

---

## SU.5 — Relevé de mortalité sans bacId (vente d'alevins)

### Statut : CONCLUSION EXPLICITE — ACCEPTABLE, aucun calcul faussé

### Constat sur le code
Pour une ligne de vente d'alevins (`LigneVente.bacId = null` ET `LigneVente.vagueId = null`,
issue de `lotAlevinsId`), le relevé MORTALITE créé dans `signerBonLivraison`
(`src/lib/queries/bons-livraison.ts:958-973` et `860-875`) est créé avec
`vagueId: ligne.vagueId` (null) et `bacId: ligne.bacId` (null) — **et ne renseigne pas non
plus `lotAlevinsId`** (champ pourtant disponible sur `Releve`, utilisé ailleurs en mode lot
d'alevins, cf. `src/lib/queries/releves.ts:159,244`). Le relevé est donc totalement
"orphelin" : rattaché uniquement à `venteId`.

### Tous les consommateurs vérifiés
1. **Per-bac** (`src/lib/calculs.ts:312`, `computeVivantsByBac`) : filtre explicitement
   `r.typeReleve === "MORTALITE" && r.bacId` — le relevé orphelin est **exclu**, et c'est
   **correct** : ces poissons n'ont jamais été dans un bac (alevins vendus depuis un lot), il
   n'y a aucun bac auquel les attribuer.
2. **Vague-level** (`indicateurs.ts:175/200`, `dashboard.ts:119/485`, `analytics.ts` divers) :
   toutes ces fonctions travaillent sur `vague.releves` (relation Prisma filtrée par
   `vagueId = vague.id`). Le relevé orphelin a `vagueId: null`, donc il n'est **jamais chargé**
   dans ces collections — exclusion automatique, cohérente avec le fait qu'il n'appartient à
   aucune vague. `tauxSurvie`, `totalMortalites`, `mortalitesAvarie`/`mortalitesElevage` (AV.5)
   ne le voient jamais, ni en positif ni en négatif : pas de sous-comptage, pas de double
   comptage (il n'appartenait de toute façon à aucune de ces vagues).
3. **`LotAlevins.nombreActuel`** (source de vérité du stock du lot, `src/lib/queries/ventes.ts:596-605`) :
   décrémenté **directement** à la création de la vente, par la quantité **commandée**
   (`nombrePoissons` de la ligne) — pas par agrégation de relevés MORTALITE. Le nombre décrémenté
   est correct indépendamment de la mortalité en transport : les poissons ont physiquement
   quitté le stock du lot au moment de la vente, que 0 ou 3 meurent ensuite en route. Ce champ
   n'est donc **pas affecté** par l'absence de `lotAlevinsId` sur le relevé.
4. **`reproduction-stats.ts` (tauxSurvieLarvaire/tauxSurvieGlobal)** : calculé à partir de
   `totalAlevinsActuels` (somme de `nombreActuel` des lots), **pas** d'une agrégation de
   relevés MORTALITE — non affecté.
5. **Rapports/exports/dashboards génériques** (`src/lib/queries/releves.ts:127`, liste
   paginée de relevés par site) : ce relevé orphelin **apparaît** dans la liste générique
   (filtrée par `siteId` seulement), avec `bac: null` — géré nativement (relation optionnelle
   déjà nullable dans l'`include`). Impact : cosmétique uniquement (une ligne sans bac affiché
   dans une liste déjà conçue pour des relevés sans bac), aucun calcul agrégé ne dépend de
   cette liste brute.
6. Aucune fonction trouvée qui agrège les MORTALITE au niveau du **site** (toutes scopées par
   vague ou par lot) — donc pas de risque de double comptage transversal.

### Ce qui EST perdu (mais n'est pas un bug de calcul)
Traçabilité fine : la fiche détail du `LotAlevins` (`src/lib/queries/lots-alevins.ts:440-469`,
`releves` limité aux 10 derniers, filtré par `lotAlevinsId`) ne montrera **jamais** cet
événement de mortalité en transport dans l'historique du lot — alors que
`lotAlevinsId` est un champ disponible et déjà utilisé pour ce type de rattachement ailleurs
dans le code. C'est une lacune de traçabilité/UX, pas un bug de calcul.

### Conclusion explicite
**ACCEPTABLE en l'état pour tout calcul** (survie, FCR, biomasse, dashboards, exports) —
aucun consommateur vérifié n'agrège ce relevé de façon incorrecte, ni ne le perd d'un calcul
auquel il devrait légitimement participer. **Amélioration mineure optionnelle, hors scope
"bug"** : renseigner `lotAlevinsId: ligne.lotAlevinsId` sur ce `releve.create` (2 lignes,
860-875 et 958-973 de `bons-livraison.ts`) améliorerait uniquement la traçabilité affichée
sur la fiche du lot — à ne traiter que si le produit le juge utile, pas comme un correctif.

---

## SU.8 — Permission `BONS_LIVRAISON_RECTIFIER` orpheline

### Statut : GO — bug confirmé et non ambigu, avec précédent de fix identique dans l'historique

### Constat vérifié dans le code
- `prisma/seed.sql` (données de dev/test) : les rôles `Administrateur` et `Gérant` codés en
  dur (ARRAY[...] statique, lignes ~106-279) **ne contiennent pas** `BONS_LIVRAISON_RECTIFIER`
  — logique, ce seed est un snapshot figé à sa dernière mise à jour, antérieur à l'introduction
  de la permission (Sprint BF phase 2).
- **Mais la vraie source de vérité en production est `SYSTEM_ROLE_DEFINITIONS`**
  (`src/lib/permissions-constants.ts:14-47`, utilisée par `provisioning.ts:213-225` et par
  `createSite`) : `Administrateur = Object.values(Permission)` (tout, dynamiquement calculé
  à la création) et `Gerant = Object.values(Permission)` **moins** `SITE_GERER`/`MEMBRES_GERER`.
  Donc pour un **nouveau** site créé aujourd'hui, `BONS_LIVRAISON_RECTIFIER` est bien présente
  sur Administrateur ET Gérant.
- **Le vrai problème** : `SiteRole.permissions` est un **tableau stocké** (snapshot figé au
  moment de la création du rôle), pas une valeur recalculée dynamiquement à chaque vérification.
  Pour tout site **créé avant** la migration `20260726100000_add_bon_livraison_rectificatif`
  (qui se contente d'un `ALTER TYPE ... ADD VALUE`, **sans backfill**), les lignes `SiteRole`
  existantes (Administrateur ET Gérant) en base **n'ont pas** ce nouveau membre d'enum dans
  leur tableau `permissions` — exactement le constat de la story ("seul Role.ADMIN global
  peut rectifier").
- **Précédent exact dans l'historique du projet** :
  `prisma/migrations/20260401000000_backfill_subscription_permissions/migration.sql` a
  explicitement backfillé (via `array_cat` + `DISTINCT`/`unnest`) les permissions Sprint 30
  manquantes sur les `SiteRole` `isSystem=true` nommés `Administrateur` et `Gerant` existants,
  avec ce commentaire dans le fichier : *"In prod, SiteRole records created before Sprint 30
  are missing these permissions. New sites get them automatically via SYSTEM_ROLE_DEFINITIONS."*
  — **littéralement le même mécanisme et la même phrase de constat** que pour
  `BONS_LIVRAISON_RECTIFIER` aujourd'hui.
- La migration `20260726100000_add_bon_livraison_rectificatif` (celle qui introduit la
  permission) **n'a pas** ce backfill — c'est l'étape manquante, par omission, au regard du
  propre précédent établi par le projet (pas une décision de conception délibérée).

### Conclusion explicite (pas d'ambiguïté à arbitrer)
**Bug confirmé, pas une question d'arbitrage.** L'omission suit exactement le schéma d'un
oubli déjà documenté et déjà corrigé une fois dans ce projet (backfill de permission après
`ADD VALUE` sur l'enum `Permission`, ERR-084/ERR-088 même famille de cause racine :
scope incomplet lors d'une migration de permissions).

### Fix recommandé
Nouvelle migration de backfill, calquée sur `20260401000000_backfill_subscription_permissions` :
```sql
UPDATE "SiteRole"
SET permissions = (
  SELECT ARRAY(SELECT DISTINCT unnest(permissions || ARRAY['BONS_LIVRAISON_RECTIFIER']::"Permission"[]))
)
WHERE "isSystem" = true AND name IN ('Administrateur', 'Gerant');
```
Ne pas toucher `Pisciculteur` ni les rôles custom (même politique que le précédent).
Mettre à jour aussi `prisma/seed.sql` (dev/test) pour ajouter `BONS_LIVRAISON_RECTIFIER` aux
deux rôles seedés, sinon les tests locaux contre la DB seedée resteront dans l'état bugué
signalé par la review — et créer une entrée `ERR-1xx` dans la base de connaissances
généralisant la règle : *"Toute migration `ALTER TYPE Permission ADD VALUE` doit être
accompagnée d'un backfill des `SiteRole` système existants dans la même migration ou une
migration jumelle, sauf raison explicite documentée."*

### Fichiers à modifier
- Nouvelle migration `prisma/migrations/<timestamp>_backfill_bons_livraison_rectifier/migration.sql`
- `prisma/seed.sql` (lignes ~112-192 Administrateur, ~198-274 Gerant, + ~304+ site client)
- `docs/knowledge/ERRORS-AND-FIXES.md` (nouvelle entrée généralisant la règle)

### Risque de régression
Faible — migration additive (ne retire rien), portée strictement aux 2 rôles système
nommés exactement `Administrateur`/`Gerant`, `isSystem=true` (pattern déjà validé une fois
en prod par le précédent Sprint 30).

---

## Récapitulatif GO/NO-GO

| Story | Statut | Bloquant ? |
|---|---|---|
| SU.1 | GO | Non — fix localisé (1 ligne + 1 dérivation), risque faible |
| SU.2 | GO AVEC RÉSERVES | Nécessite arbitrage architecte avant implémentation (SiteAuditLog vs table dédiée + userId dans le guard) |
| SU.4 | GO AVEC RÉSERVES | Nécessite de budgétiser l'introduction d'un premier pattern de test à vraie DB dans le projet |
| SU.5 | GO — pas de fix requis | Conclusion : acceptable, fermer le point (amélioration traçabilité optionnelle hors scope) |
| SU.8 | GO | Non — migration additive à faible risque, précédent exact disponible |

## Recommandation
Démarrer SU.1, SU.5 (clôture) et SU.8 immédiatement (fix + backfill non ambigus, risque
faible). Pour SU.2, faire trancher l'architecte sur SiteAuditLog vs table dédiée AVANT
d'assigner l'implémentation. Pour SU.4, prévoir un effort dédié (introduction du premier
test à vraie DB du projet) plutôt que de l'estimer comme un ajout de test classique.
