# Pré-analyse Sprint BD — Rendre visibles les bacs en dérive — 2026-07-27

## Statut : GO CONDITIONNEL

## Résumé
La persistance (ADR-048, SU.2) est livrée conformément à la spécification et couverte par
tests. Le point de risque n°1 (Q1) est confirmé PARTIELLEMENT problématique : `resoluLe` peut
se remplir, mais uniquement via un chemin détourné (un COMPTAGE correctif seul ne suffit
jamais — il faut qu'une opération guardée survienne *ensuite* sur le même bac). Aucun
raccourci UI "faire un comptage" pré-rempli n'existe aujourd'hui (seul `lotAlevinsId` est
supporté en query param sur `/releves/nouveau`). Le reste est GO : query `getBacsEnDerive`
correcte et scoped `siteId`, permission `DASHBOARD_VOIR` réutilisable sans coût, dashboard
site identifié avec pattern de sections `Suspense` réutilisable, build et tests verts.

## Vérifications effectuées

### Schema ↔ Types : OK
- `EcartAssignationConstate` + enum `ContexteDetectionEcart` présents dans
  `prisma/schema.prisma` (L.3703-3745), relations inverses sur `Site`, `Bac`, `Vague`, `User`
  toutes présentes (L.836, 1196, 1274, 1342). `npx prisma validate` → valide.
- Miroir TypeScript présent et conforme (R3) : `src/types/models.ts` L.4037-4103
  (`ContexteDetectionEcart`, `EcartAssignationConstate`, `BacEnDerive`), exportés dans
  `src/types/index.ts` (L.101, 257-258).

### API ↔ Queries : OK
- `src/lib/queries/ecarts-assignation.ts` : `getBacsEnDerive(siteId)` filtre bien
  `where: { siteId, ecart: { not: 0 } }` (R8 respecté), un seul `findMany` avec `include`
  (pas de N+1), aucun SQL brut nécessaire.
- Pas de route API dédiée aujourd'hui (prévu "sprint ultérieur" par l'ADR, section 8.7) —
  pas un manque, juste hors périmètre SU.2.

### Navigation ↔ Permissions : OK (rien à créer)
- Aucune permission dédiée "bacs en dérive" n'existe ni n'est nécessaire :
  `Permission.DASHBOARD_VOIR` est déjà la permission qui gouverne l'accès au dashboard site
  entier (`src/app/(farm)/page.tsx` L.148-152, et ~20 autres usages : `bacs`, `packs`,
  `config-elevage`, `analytics/dashboard`...). Elle est déjà seedée (rôle Administrateur, cf.
  `prisma/seed.sql`) et déjà labellisée dans `src/lib/role-form-labels.ts`.
- Le garde anti-orphelines existe : `src/__tests__/permissions-orphan-guard.test.ts`. Il
  exige que toute valeur de l'enum `Permission` soit (1) portée par le rôle Administrateur
  **seedé** (lu depuis `prisma/seed.sql`, pas depuis `SYSTEM_ROLE_DEFINITIONS` qui serait
  toujours vert par construction) et (2) ait un libellé dans `permissionLabels`
  (`src/lib/role-form-labels.ts`), sauf exclusion documentée (3 permissions plateforme
  réservées + note historique sur `BONS_LIVRAISON_RECTIFIER` désormais couverte).
- **Recommandation** : réutiliser `DASHBOARD_VOIR`, ne rien ajouter à l'enum `Permission`
  pour ce sprint. Créer une nouvelle permission coûterait : migration enum (RECREATE si
  jamais on veut la retirer plus tard, sinon `ADD VALUE` simple ici puisque c'est un ajout
  pur — ERR-083), backfill des `SiteRole` existants (ERR-105), label, entrée seed, et mise à
  jour du test de garde — coût non justifié pour une carte visible par tous ceux qui voient
  déjà le dashboard.

### Build : OK
- `npm run build` → exit code 0, toutes les routes compilées (dont `/releves/nouveau`,
  `/vagues/[id]/*`, `/(farm)` dashboard).

### Tests : 5709/5709 passent (+ 14 skipped, 26 todo)
- `npx vitest run` → 222 fichiers passés, 1 skippé, 0 échec. Conforme à la référence
  documentée (5709 verts). Aucun timeout observé (ERR-107 non applicable ici — run propre).
- Tests dédiés déjà en place et verts : `src/__tests__/ecart-assignation-constate.test.ts`
  (persistance + guard + query layer, 12 tests), `src/__tests__/permissions-orphan-guard.test.ts`.

## Incohérences trouvées

Aucune incohérence Schema/Types/Queries. Un point de risque fonctionnel majeur (voir Q1
ci-dessous, section "Risques identifiés").

## Risques identifiés

### 1. (RISQUE N°1, Q1) `resoluLe` ne se remplit QUE par un chemin détourné — jamais par le COMPTAGE seul
**Preuve, avec fichier:ligne :**
- `verifyAssignationInvariant` appelle `persisterEcartConstate(tx, siteId, vagueId, bacId,
  e.ecart, options)` **inconditionnellement**, pour CHAQUE bac de la boucle (
  `src/lib/guards/assignation-invariant.ts` L.456), donc PAS seulement dans la branche
  `if (e.ecart !== 0)` (celle-ci ne contient que le `console.warn`, L.436-450). Le chemin de
  résolution (`ecart === 0` → `persisterEcartConstate` marque `resoluLe: new Date()`,
  `assignation-invariant.ts` L.113-124) n'est donc **pas mort en soi** — contrairement à
  l'hypothèse la plus grave envisagée par l'ADR.
- MAIS : `verifyAssignationInvariant` n'est appelée que par 6 opérations (arrivage, transfert
  ×2, calibrage, vente, vente-alevins — via ventes.ts —, bon-livraison — confirmé par
  `grep -rln "verifyAssignationInvariant(" src` : `arrivages.ts`, `ventes.ts`,
  `bons-livraison.ts`, `calibrages.ts`, `transferts.ts`). **COMPTAGE n'est pas et n'a jamais
  été un call site.**
- `createReleve` (`src/lib/queries/releves.ts` L.156-396, le seul point de création d'un
  relevé COMPTAGE) n'appelle **jamais** `verifyAssignationInvariant` ni
  `persisterEcartConstate`, quel que soit le type de relevé créé (grep confirmé : aucune
  occurrence dans ce fichier). Un COMPTAGE créé isolément ne modifie même pas
  `AssignationBac.nombreActuel` — il ne fait que déplacer la « base de rejeu » (`expected`)
  utilisée par `calculerEcartsParBac` lors du **prochain** appel du guard.
- **Conclusion nette** : `resoluLe` se remplit **partiellement / de façon détournée**. Un
  COMPTAGE correctif, à lui seul, ne fera JAMAIS passer `resoluLe` de `null` à une date : il
  faut qu'une opération guardée (arrivage/transfert/calibrage/vente/vente-alevins/bon de
  livraison) survienne *ensuite* sur ce même bac pour que le guard soit ré-exécuté, recalcule
  un `ecart === 0` (grâce au COMPTAGE désormais pris en compte comme nouvelle base), et
  appelle `persisterEcartConstate` avec `ecart === 0`. Si un bac corrigé par COMPTAGE ne subit
  plus aucune opération guardée par la suite, la ligne `EcartAssignationConstate` reste
  active indéfiniment (`resoluLe: null`, `ecart` figé à l'ancienne valeur) alors que le bac
  est réellement sain depuis le comptage — **la carte "Bacs en dérive" afficherait alors un
  bac déjà réparé comme toujours en dérive**, ce qui est exactement le risque d'écran
  inutilisable identifié par l'ADR, mais sous une forme plus subtile que "jamais" : c'est
  "jamais sans un déclencheur additionnel qui n'a aucune garantie de survenir à temps".
- **Correctif minimal recommandé (à trancher/arbitrer avant ou pendant ce sprint, pas après) :**
  ajouter un appel (même léger : `captureEcartsAssignation` + `verifyAssignationInvariant`
  sans throw possible car risque nul en écriture seule, ou un simple recalcul +
  `persisterEcartConstate` direct) dans `createReleve` spécifiquement pour
  `TypeReleveEnum.COMPTAGE`, dans le même fichier `src/lib/queries/releves.ts`, à l'endroit
  où le bloc `MORTALITE` met déjà à jour `AssignationBac` (L.341-352) — par symétrie. C'est un
  fix de portée BUGFIX, pas seulement UI, et il conditionne fortement l'utilité de la carte :
  sans lui, la carte affichera un flux qui ne se vide jamais pour les bacs corrigés en dehors
  d'une opération guardée.

### 2. Détection paresseuse confirmée (Q2)
Pas de balayage périodique (cron/job) : recherche de `cron`/`job`/`scheduler` dans `src` ne
retourne qu'un cron sans rapport (`src/app/api/cron/subscription-lifecycle/route.ts`,
lifecycle d'abonnement). La dérive n'est détectée/mise à jour que lorsqu'une des 6 opérations
guardées touche le bac concerné. **"Aucun bac en dérive" ≠ "tout est sain"** : un bac jamais
touché par une de ces 6 opérations depuis sa dernière dérive réelle n'apparaîtra jamais, même
s'il dérive activement. Ne pas présenter la carte comme un état de vérité absolu — un libellé
UI du type "Bacs en dérive détectée" (pas "Bacs sains" en creux) est recommandé pour ne pas
créer une fausse impression de complétude.

### 3. Pas de raccourci "faire un comptage" pré-rempli existant (Q4)
`/(farm)/releves/nouveau/page.tsx` n'accepte que `lotAlevinsId` en `searchParams` — aucun
support pour pré-remplir `vagueId`/`bacId`/`typeReleve=COMPTAGE`. Si ce sprint veut livrer ce
raccourci (recommandé par l'ADR section 9), c'est un ajout de scope (query params
supplémentaires + branchement dans `ReleveFormClient`), pas un lien direct existant.
Alternative à moindre coût : lien vers la fiche bac existante `/bacs/[id]` (page existante,
`Permission.BACS_GERER`), sans pré-remplissage — dégrade l'ergonomie mais ne nécessite aucun
changement du formulaire de relevé.

## Prérequis manquants
1. Décision d'arbitrage sur le point 1 ci-dessus (correctif COMPTAGE→guard) : soit inclus dans
   ce sprint (BUGFIX story avant toute UI), soit accepté comme limitation connue documentée
   dans le libellé de la carte. Ne pas construire l'UI sans avoir tranché ce point — c'est le
   risque n°1 explicitement désigné par la user story.
2. Décision sur le raccourci "faire un comptage" pré-rempli (query params sur
   `/releves/nouveau`) vs lien simple vers `/bacs/[id]` : impacte le découpage UI (une story de
   plus si le pré-remplissage est voulu).

## Découpage en stories proposé

| Story | Type | Fichiers | Dépend de |
|---|---|---|---|
| BD.0 — Fix résolution COMPTAGE→guard (si retenu, cf. prérequis 1) | BUGFIX | `src/lib/queries/releves.ts` (bloc COMPTAGE, par symétrie avec le bloc MORTALITE L.341-352), test de non-régression dans `src/__tests__/ecart-assignation-constate.test.ts` ou nouveau fichier dédié | Aucune |
| BD.1 — Carte "Bacs en dérive" (composant + branchement dashboard) | UI | Nouveau `src/components/dashboard/bacs-en-derive-section.tsx` (pattern `recent-activity-section.tsx`/`indicateurs-section.tsx` + skeleton dans `section-skeletons.tsx`), `src/app/(farm)/page.tsx` (appel `getBacsEnDerive(siteId)` en parallèle des autres `Promise.all`, ajout `<Suspense>`) | BD.0 (pour ne pas afficher un état trompeur), aucune si BD.0 reporté et limitation documentée |
| BD.2 — Lien vers résolution (fiche bac ou raccourci comptage pré-rempli) | UI (+ éventuellement QUERIES si pré-remplissage) | `src/app/(farm)/releves/nouveau/page.tsx` (+ `ReleveFormClient`) si pré-remplissage voulu ; sinon simple `<Link href="/bacs/[id]">` dans BD.1, pas de story séparée | BD.1 |
| BD.3 — Tests UI (rendu carte vide/non-vide, lien, permission) | TEST | `src/__tests__/ui/*` ou colocalisé au composant | BD.1, BD.2 |

Aucune story SCHEMA/API n'est nécessaire : le modèle, la query et les types sont déjà livrés
et testés par SU.2.

## Points nécessitant un arbitrage utilisateur
1. **BD.0 inclus ou reporté ?** Sans lui, la carte peut afficher des bacs déjà réparés par un
   comptage isolé comme "toujours en dérive" indéfiniment. C'est un choix produit/risque, pas
   seulement technique.
2. **Raccourci comptage pré-rempli vs lien simple vers la fiche bac** : arbitrage
   coût (ajout de query params + branchement formulaire) vs ergonomie.

## Résultats tests + build
- `npx vitest run` : 222 fichiers passés, 1 skippé, **5709 tests passés**, 14 skipped, 26 todo,
  0 échec — conforme à la référence documentée.
- `npm run build` : exit code 0, toutes les routes compilent.
- `npx prisma validate` : schéma valide.
