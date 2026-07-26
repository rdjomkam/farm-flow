# Pré-analyse Sprint SU — Story SU.3 (generateNextNumero : collision concurrente) — 2026-07-26

## Statut : GO AVEC RÉSERVES

## Résumé
Le pattern de génération de numéro n'est PAS dupliqué quatre fois comme le laissait supposer le finding de review-sprint-BL : il existe un helper factorisé (`src/lib/queries/numero-utils.ts`) déjà réutilisé par Commande/Vente/Facture/BonLivraison/Depense/ListeBesoins-recurrentes. Mais **trois implémentations parallèles et non factorisées** existent en plus, dans le module Reproduction (`geniteurs.ts`, `incubations.ts`, `pontes.ts`), avec une variante strictement pire (check-then-act hors transaction). Le fix doit donc généraliser `numero-utils.ts` pour couvrir aussi les champs `code` du module reproduction, pas seulement ajouter un retry au helper existant.

## Vérifications effectuées

### Build : OK
`npm run build` → compile sans erreur (webpack), toutes les routes listées, migrations à jour ("No pending migrations to apply").

### Schema Prisma : OK
`npx prisma validate` → "The schema at prisma/schema.prisma is valid".

### Tests : 5485/5580 passent (69 échecs, 26 todo) — échecs SANS RAPPORT avec SU.3
`npx vitest run` (durée ~566s). Les 69 échecs observés sont des timeouts (5s/15s) dans :
- `src/components/ventes/__tests__/bon-livraison-flow.test.tsx` (plusieurs cas)
- `src/components/ventes/__tests__/vente-detail-client.test.tsx`
Pattern de timeout de rendu React (composant BL), pas lié à la génération de numéro — aucun test échoué ne touche `numero-utils.ts`, `commandes.ts`, `ventes.ts`, `factures.ts`, `bons-livraison.ts`, `geniteurs.ts`, `incubations.ts`, `pontes.ts`, `besoins.ts`. **Aucun test dédié n'existe pour `generateNextNumero`** (aucun fichier `*numero*` sous `src/__tests__`) : la collision concurrente n'est testée nulle part actuellement.

## Inventaire complet des sites d'appel

### A. Helper factorisé — `src/lib/queries/numero-utils.ts::generateNextNumero(tx, model, prefix, siteId)`
Signature : `(tx: PrismaTransactionClient, model: "depense"|"commande"|"vente"|"facture"|"bonLivraison", prefix, siteId) => Promise<string>`
Format : `{PREFIX}-{YYYY}-{NNN}` (padding 3, compteur **par site ET par année**, requête `findFirst({ where: { siteId, numero: { startsWith } }, orderBy: { numero: "desc" } })`).

| Fichier | Ligne | Modèle | Préfixe | Dans un `tx` existant ? |
|---|---|---|---|---|
| `src/lib/queries/commandes.ts` | 188 | commande | CMD | Oui — `prisma.$transaction(async (tx) => ...)` |
| `src/lib/queries/commandes.ts` | 510 | depense | DEP | Oui |
| `src/lib/queries/besoins.ts` | 714, 1065 | depense | DEP | Oui |
| `src/lib/queries/depenses.ts` | 147 | depense | DEP | Oui |
| `src/lib/queries/factures.ts` | 109 | facture | FAC | Oui |
| `src/lib/queries/bons-livraison.ts` | 168, 554 | bonLivraison | BL | Oui |
| `src/lib/queries/ventes.ts` | 420, 559, 797 | vente | VTE | Oui |
| `src/lib/queries/ventes.ts` | 870 | depense | DEP | Oui |
| `src/lib/queries/depenses-recurrentes.ts` | 61-65 (wrapper `generateNumeroDepense`) | depense | DEP | Oui (délègue, tx transmis par l'appelant) |

Tous les appels via ce helper sont **déjà à l'intérieur d'un `prisma.$transaction(async (tx) => ...)`** qui englobe aussi le `create()`. C'est le point clé : un retry sur collision doit rejouer TOUTE la transaction (recalcul du numero + create), pas juste rappeler `generateNextNumero` isolément — la transaction a déjà avorté côté Postgres au moment où le P2002 remonte.

### B. `src/lib/queries/besoins.ts::generateNumeroBesoin(siteId)` (ligne 27) — DUPLIQUÉE, PAS dans un tx
Format : `BES-{YYYY}-{NNN}`. Appelée ligne 340, **avant** `prisma.$transaction(...)` (utilise `prisma` nu, pas `tx`). Le `create` du `ListeBesoins` a lieu ensuite dans la transaction. Fenêtre de collision légèrement plus large que le pattern A (lecture hors tx) mais impact identique : retry = relire le numero + refaire toute la création.

### C. `src/lib/queries/geniteurs.ts::generateLotCode(siteId, sexe)` (ligne 40) — DUPLIQUÉE, **PAS de transaction du tout**
Format : `LG-{F|M}-{NNN}` (**pas d'année** dans le compteur — portée : par site + par sexe, illimitée dans le temps).
Appelée dans `createLotGeniteurs` (ligne 146) : `generateLotCode` (lecture nue) → `prisma.lotGeniteurs.findUnique({ where: { code } })` check explicite (lecture nue) → `throw new Error` si collision → `prisma.lotGeniteurs.create(...)` (écriture nue). **Aucun `$transaction`** : c'est un check-then-act TOCTOU pur, pire que le pattern A/B. Le filet de sécurité reste la contrainte `@unique` sur `create()`.

### D. `src/lib/queries/incubations.ts::generateIncubationCode(siteId)` (ligne 40) et `generateLotAlevinsCode(siteId)` (ligne 65) — DUPLIQUÉES, **PAS de transaction**
- `generateIncubationCode` format `INC-{YYYY}-{NNN}`, utilisé dans `createIncubation` (ligne 179) avec le même check-then-throw hors tx que C.
- `generateLotAlevinsCode` format `LOT-{YYYY}-{NNN}`, utilisé dans `recordEclosion` (ligne 427) — généré **avant** un `prisma.$transaction([...])` de type array (pas interactive), donc pas de retry possible de l'intérieur ; il faudrait retenter l'array transaction entière depuis l'extérieur.

### E. `src/lib/queries/pontes.ts::generatePonteCode(tx, siteId)` (ligne 34) — DUPLIQUÉE mais bien conçue
Format : `PONTE-{YYYY}-{NNN}`. Signature `(tx, siteId)` identique à `generateNextNumero`, appelée ligne 273 **à l'intérieur** d'un `prisma.$transaction(async (tx) => ...)`. Modèle non couvert par le type union `NumeroModel` du helper A (`ponte` absent), d'où la duplication au lieu de la réutilisation.

## Analyse des options de correction

### Contrainte transverse déterminante
Dans **tous** les appelants (A, B, C-partiel, D-partiel, E), le calcul du numero et le `create()` sont couplés dans la même unité logique de travail. Un retry doit donc :
- pour A, B, E : relancer `prisma.$transaction(async (tx) => {...})` en entier (le tx a déjà été rollback par Postgres au P2002 — impossible de continuer dans le même tx).
- pour C, D (createLotGeniteurs / createIncubation) : il n'y a même pas de tx à ce jour ; il faut d'abord introduire un `$transaction` avant de pouvoir appliquer un retry propre (sinon le retry ne fait que déplacer la fenêtre TOCTOU).
- pour `recordEclosion` (D, array-transaction) : nécessite de passer d'un array-transaction à un interactive transaction (`$transaction(async (tx) => ...)`) pour pouvoir générer le code lotAlevins et faire le create au même endroit rejouable.

### Option 1 — Retry applicatif sur P2002 (recommandée)
Wrapper générique `withNumeroRetry(fn: () => Promise<T>, maxAttempts = 3)` qui catch le P2002 spécifiquement sur la contrainte `numero`/`code`, et rejoue **la fonction appelante entière** (englobant tout le `$transaction`), pas seulement `generateNextNumero`.
- Compatible avec la portée par site/année : aucune contrainte de séquence globale à gérer, le retry recalcule naturellement le bon numero pour le bon site/année à chaque tentative.
- Compatible avec les transactions Prisma existantes : oui, à condition de wrapper l'appel au niveau de la fonction exportée (`createCommande`, `createVente`, etc.), pas à l'intérieur du tx.
- Coût migration : nul (pas de changement de schéma).
- Risque : légère latence supplémentaire en cas de collision réelle (rare), mais borné (2-3 tentatives).

### Option 2 — Séquence PostgreSQL dédiée
Rejetée : la portée du compteur est par site ET par année (`{PREFIX}-{YYYY}-{NNN}` remis à 1 chaque année, par site) — une séquence Postgres globale (`CREATE SEQUENCE`) ne peut pas nativement encoder ce reset annuel par site sans une séquence par (site, année, préfixe), ce qui explose en nombre d'objets DB créés dynamiquement (impossible de créer une séquence à la volée par site en toute sécurité depuis Prisma). Écarté.

### Option 3 — Table compteur + `UPDATE ... RETURNING` atomique
Viable et plus robuste à terme (élimine la collision au lieu de la retenter), mais coût de migration réel : nouvelle table `CompteurNumero` (ou colonne compteur sur `Site`), migration de données pour amorcer les compteurs à partir du max existant par site/préfixe/année, et **7 fichiers à modifier** au lieu d'1 seul si on ne factorise pas le point d'écriture. Recommandable en V2 si le volume augmente (mentionné explicitement comme risque à surveiller dans review-sprint-BL), mais overkill pour ce sprint vu qu'aucune collision réelle n'a été rapportée en prod à ce jour.

### Option 4 — Advisory lock Postgres (`pg_advisory_xact_lock(hashtext(siteId||prefix||year))`)
Techniquement solide (élimine la race sans retry), mais nécessite un `$queryRaw` dans **chaque** transaction concernée, couplé à Postgres (perte de portabilité si changement de SGBD un jour), et ne résout pas le problème pour C/D qui n'ont pas de tx du tout (il faudrait d'abord en créer une, ce qui revient au même effort que l'Option 1). Écarté au profit d'Option 1, plus simple et suffisant vu le volume.

## Recommandation d'implémentation — où placer le fix

1. **Un seul point de correction** : étendre `numero-utils.ts` avec une fonction `withNumeroRetry` (ou intégrer le retry directement dans un nouveau helper `createWithNumero(tx-factory, attempt-fn)`), ET élargir l'union `NumeroModel` pour inclure `"ponte" | "lotGeniteurs" | "incubation" | "lotAlevins" | "listeBesoins"` afin que `generateNextNumero` couvre tous les champs `numero`/`code` (renommer en interne le paramètre pour accepter aussi `code` comme nom de colonne, `pontes.ts`/`geniteurs.ts`/`incubations.ts` utilisant `code` et non `numero`).
2. Remplacer les 3 implémentations dupliquées (`generateNumeroBesoin`, `generateLotCode`, `generateIncubationCode`, `generateLotAlevinsCode`, `generatePonteCode`) par des appels au helper commun étendu — SU.3 doit inclure ce nettoyage, sinon la story ne fait que déplacer la duplication au lieu de la résorber (l'énoncé de la story l'exige explicitement : "corriger le pattern UNE FOIS, AU BON ENDROIT").
3. Pour `createLotGeniteurs` et `createIncubation` (pattern C/D) : les envelopper dans un `prisma.$transaction(async (tx) => ...)` — actuellement absent — avant d'y appliquer le retry, sinon le retry ne protège rien (le check `findUnique` + `create` resteront non atomiques entre deux tentatives).
4. Pour `recordEclosion` : migrer l'array-transaction vers une interactive transaction pour permettre au retry de recalculer `lotCode` à l'intérieur du bloc rejoué.
5. Le retry doit catcher spécifiquement P2002 avec `meta.target` contenant le champ numero/code concerné (pas un catch-all), pour ne pas masquer d'autres violations d'unicité involontaires (ex. FK dupliquée par erreur applicative).
6. Conserver la contrainte `@unique` en base sur chaque champ numero/code (déjà présente sur tous les modèles vérifiés : Commande, Vente, Facture, BonLivraison, Depense, ListeBesoins, Ponte, LotAlevins, LotGeniteurs, Incubation) — c'est le filet de sécurité qui rend le retry sûr, à ne jamais retirer.

## Incohérences trouvées

1. **Portée de l'unicité incohérente avec la portée du compteur** — `prisma/schema.prisma` : tous les champs `numero`/`code` de ce pattern sont `@unique` **global** (pas `@@unique([siteId, numero])`), alors que le compteur applicatif est généré **par site** (`where: { siteId, numero: { startsWith } }`). Deux sites différents peuvent donc légitimement générer le même `numero` (ex. `CMD-2026-001` pour le site A et le site B) et l'un des deux créera échouera avec P2002 alors qu'il n'y a aucune vraie collision métier. Ceci est un bug préexistant, distinct de la race condition demandée par SU.3, mais qui **amplifie** sa fréquence en multi-site — à signaler à @knowledge-keeper et à considérer dans le scope réel du fix (la contrainte devrait être `@@unique([siteId, numero])`, ce qui nécessite une migration Prisma). Fichiers : `prisma/schema.prisma` (modèles Commande l.1601, Vente l.1695, Facture l.1779, BonLivraison l.1811, Depense l.2397, ListeBesoins l.2657, Ponte l.1961, LotAlevins l.2015, LotGeniteurs l.2070, Incubation l.2107).
2. Le finding de `review-sprint-BL.md` mentionne "Facture/Commande/Vente/BL" mais omet le module Reproduction (Ponte/LotGeniteurs/Incubation/LotAlevins) et `ListeBesoins`, qui partagent le même pattern et deux d'entre eux (`geniteurs.ts`, `incubations.ts`) sont dans un état **pire** (pas de transaction du tout).

## Risques identifiés

1. **Retry sans wrap de transaction complet** : si l'implémenteur ajoute le retry seulement dans `numero-utils.ts` (retry local de `generateNextNumero`) sans remonter le retry au niveau de la fonction appelante, le fix sera inefficace — le tx aura déjà avorté côté Postgres avant que `generateNextNumero` ne puisse être rappelé. Impact : faux sentiment de correction, bug non résolu. Mitigation : le retry doit englober l'appel complet à `prisma.$transaction(...)`, documenté explicitement dans le code.
2. **Migration de `@unique` vers `@@unique([siteId, numero])`** (si incluse dans le scope) : nécessite un `ALTER TABLE ... DROP CONSTRAINT` puis `ADD CONSTRAINT`, sans risque de perte de données (contrainte plus permissive), mais à vérifier qu'aucune donnée de seed/prod n'a déjà de doublon `numero` cross-site qui bloquerait un futur retrait de l'unique global si jamais on la retire complètement (à ne retirer que si on ajoute le composite, jamais supprimer sans remplacer dans la même migration — cf. ERR-001/ERR-049 sur les migrations destructives).
3. Les tests actuellement en échec (69, timeouts BL) ne bloquent pas SU.3 mais réduisent la marge de sécurité de non-régression sur `bon-livraison-flow.test.tsx` — à surveiller si SU.3 touche indirectement des fichiers partagés (peu probable, mais `bons-livraison.ts` fait partie du pattern A).

## Prérequis manquants

1. Aucun test de non-régression n'existe pour la collision de numero — SU.3 doit en ajouter un (simulation de deux transactions concurrentes ou mock du P2002 + assertion que le retry recalcule un numero différent).
2. Décision à prendre avec @architect/@db-specialist avant implémentation : le scope de SU.3 inclut-il la correction du bug d'unicité globale (point 1 des incohérences) ou seulement le retry sur collision ? Les deux sont liés mais distincts en effort (retry = pas de migration ; unicité composite = migration Prisma).

## Recommandation

GO AVEC RÉSERVES. Le pre-requis technique (build OK, schema valide, 8 modèles à contrainte `@unique` déjà en place comme filet de sécurité) est satisfait. Corriger UNE FOIS dans `numero-utils.ts` en :
1. Élargissant `NumeroModel` pour couvrir `ponte`/`lotGeniteurs`/`incubation`/`lotAlevins`/`listeBesoins`,
2. Ajoutant un wrapper de retry (Option 1) appliqué au niveau de chaque fonction exportée (`createCommande`, `createVente`, `createFacture`, `createBonLivraison`, `createListeBesoins`, `createPonte`, `createLotGeniteurs`, `createIncubation`, `recordEclosion`) englobant tout le `$transaction`,
3. En profitant du sprint pour supprimer les 5 implémentations dupliquées (`generateNumeroBesoin`, `generateLotCode`, `generateIncubationCode`, `generateLotAlevinsCode`, `generatePonteCode`) et pour transactionnaliser `createLotGeniteurs`/`createIncubation` qui n'ont actuellement aucun `$transaction`.

Pas de migration Prisma nécessaire pour le retry lui-même. Une migration serait nécessaire uniquement si le scope est étendu à la correction de la portée d'unicité globale→composite (recommandé mais à valider séparément, potentiellement une story distincte SU.3-bis).
