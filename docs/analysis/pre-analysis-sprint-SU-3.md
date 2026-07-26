# Pré-analyse Sprint SU — Story SU.3 — 2026-07-26

## Statut : GO AVEC RÉSERVES

## Résumé
Le pattern `generateNextNumero` est **déjà factorisé dans un helper unique** (`src/lib/queries/numero-utils.ts`) pour 5 des 9 familles concernées (Facture, Commande, Vente, BonLivraison, Depense). Mais **4 implémentations dupliquées** persistent en dehors du helper (LotGeniteurs, Incubation, Ponte, ListeBesoins) + **une 5e duplication inline** pour Commande dans `besoins.ts` qui contourne le helper existant. Corriger "au bon endroit" implique donc deux actions : (1) le fix anti-collision dans `numero-utils.ts` uniquement, et (2) **faire migrer les 5 implémentations dupliquées vers ce helper** avant/pendant la story pour qu'elles bénéficient du fix (sinon la story ne couvre que la moitié des cas réels). Un problème plus grave et distinct a été détecté : la contrainte `@unique` sur `numero`/`code` est **globale**, pas scopée par site, alors que le calcul de séquence, lui, est scopé par `siteId` — collision garantie (pas seulement probable) entre deux sites différents dès qu'ils génèrent le même numéro la même année.

## Vérifications effectuées

### Schema ↔ Types : OK
`npx prisma validate` → schéma valide. Pas de vérification profonde nécessaire ici (hors scope numero).

### API ↔ Queries : PROBLÈMES (voir Incohérences)
Tous les appelants passent par `handleApiError` (`src/lib/api-utils.ts`), qui traduit déjà P2002 en **409** (pas un 500 opaque comme indiqué dans le review BL — à corriger dans la doc/connaissance, voir plus bas). Le vrai problème n'est donc pas "500 opaque" mais : (a) pas de retry automatique → l'utilisateur reçoit un échec sec sur un événement qui peut être transitoire et bénin ; (b) duplication du pattern hors helper.

### Navigation ↔ Permissions : non applicable à cette story (hors scope).

### Build : OK
`npm run build` (`prisma generate && prisma migrate deploy && next build --webpack`) → exit code 0.

### Tests : 5502/5580 passent (52 échecs, tous des timeouts machine, aucun lié à numero
Exécution complète (268s) : **14 fichiers en échec / 52 tests en échec**, tous de la forme `Test timed out in 5000ms/15000ms`, concentrés sur des tests de composants React (bon-livraison-flow, vente-detail-client, vague-bacs-section, gompertz-feed-comparison, bottom-nav, image-decode). Aucun échec ne mentionne `numero`, `generateNextNumero`, ou une contrainte unique. La machine était très chargée au moment de l'exécution (nombreux processus `vitest`/`next build` concurrents visibles dans `ps aux`, probablement d'autres sessions/agents en parallèle) — ces timeouts sont vraisemblablement de la contention de ressources, pas des régressions. À reconfirmer par @tester sur une machine moins chargée avant de blâmer un vrai bug, mais **aucun test existant ne couvre le scénario de collision de numero** (voir section tests ci-dessous) donc ceci ne change pas le diagnostic SU.3.

## Inventaire complet des sites d'appel (numérotation auto)

| Modèle | Champ | Format | Portée compteur (query) | Portée @unique DB | Implémentation | Dans une transaction ? |
|---|---|---|---|---|---|---|
| Facture | numero | `FAC-YYYY-NNN` | siteId + année | **globale** (`@unique` seul) | `generateNextNumero` (helper) | Oui — `prisma.$transaction(async (tx)=>...)` dans `createFacture` (factures.ts:92), appel ligne 109 |
| Depense | numero | `DEP-YYYY-NNN` | siteId + année | **globale** | `generateNextNumero` (helper) | Oui — 6 sites d'appel, tous dans un `$transaction` propre à leur fonction : `depenses.ts:147` (dans tx de `createDepense`, l.123), `depenses-recurrentes.ts:65` (wrapper `generateNumeroDepense` → délègue au helper, appelé depuis tx de `genererDepensesRecurrentes`, l.221), `ventes.ts:870` (tx de `createVenteAlevinsDepuisVague`, l.787), `commandes.ts:510` (tx de `recevoirCommande`, l.318), `besoins.ts:714` (tx de `traiterBesoins`, l.565), `besoins.ts:1065` (tx de `creerCommandeDepuisBesoin`, l.880), `app/api/ventes/[id]/depenses/route.ts:126` (tx local à la route) |
| Commande | numero | `CMD-YYYY-NNN` | siteId + année | **globale** | `generateNextNumero` (helper) **dans commandes.ts** — **MAIS dupliqué inline (sans le helper) dans besoins.ts** | Oui — `commandes.ts:188` dans tx de `createCommande` (l.148) ; **`besoins.ts:644` et `besoins.ts:967`** : code dupliqué (findFirst+orderBy+split manuel), dans tx de `creerCommandeDepuisBesoin` (l.880) et une 2e branche de la même fonction |
| Vente | numero | `VTE-YYYY-NNN` | siteId + année | **globale** | `generateNextNumero` (helper) | Oui — 3 sites : `ventes.ts:420` (tx `createVente`, l.365), `:559` (tx `createVenteAlevins`, l.496), `:797` (tx `createVenteAlevinsDepuisVague`, l.787) |
| BonLivraison | numero | `BL-YYYY-NNN` | siteId + année | **globale** (mais `venteId` n'est plus unique — plusieurs BL/vente autorisés, cf rectificatifs) | `generateNextNumero` (helper) | Oui — `bons-livraison.ts:168` (tx `createBonLivraison`, l.141), `:554` (tx `creerBonLivraisonRectificatif`, l.520) |
| ListeBesoins | numero | `BES-YYYY-NNN` | siteId + année | **globale** | **Dupliqué** — `generateNumeroBesoin()` propre (besoins.ts:27), **appelée HORS transaction** (`prisma` direct, pas `tx`) | **Non !** `createListeBesoins` (besoins.ts:329) appelle `generateNumeroBesoin(siteId)` en dehors de tout `$transaction` (l.340), puis lance `prisma.$transaction` séparément (l.343) pour la création. Fenêtre de course plus large que les autres modèles (deux requêtes DB séparées, pas la même transaction). |
| Ponte | code | `PONTE-YYYY-NNN` | siteId + année | **globale** | **Dupliqué** — `generatePonteCode(tx, siteId)` (pontes.ts:34), prend `tx` en paramètre | Oui — appelée avec `tx` (à vérifier ligne d'appel exacte dans le call-site de création, transaction commence l.214) |
| Incubation | code | `INC-YYYY-NNN` | siteId + année | **globale** | **Dupliqué** — `generateIncubationCode(siteId)` (incubations.ts:40), **utilise `prisma` direct, pas `tx`** | À vérifier au call-site — si le create est dans un `$transaction`, cette fonction ne réutilise pas `tx` → lit hors transaction, incohérence possible en isolation Read Committed |
| LotGeniteurs | code | `LG-{F\|M}-NNN` (**pas d'année**, compteur global par sexe) | siteId + sexe | **globale** | **Dupliqué** — `generateLotCode(siteId, sexe)` (geniteurs.ts:40), **utilise `prisma` direct, pas `tx`** | À vérifier au call-site |

**Bilan factorisation : 5/9 familles utilisent le helper commun (`numero-utils.ts`), 4/9 sont dupliquées (Ponte, Incubation, LotGeniteurs, ListeBesoins), et 1 cas supplémentaire (Commande dans `besoins.ts`) duplique inline le pattern alors même que le helper est importé et utilisé ailleurs dans le même fichier pour Depense — incohérence interne au fichier.**

## Options évaluées

### Option A — Retry sur P2002 avec bornes, au niveau de la transaction entière
- **Mécanisme** : retenter tout le `prisma.$transaction(async (tx) => {...})` (pas juste l'appel à `generateNextNumero`) en cas de P2002 sur la contrainte `numero`/`code`, avec un nombre de tentatives borné (ex. 3-5) et un léger backoff.
- **Compatibilité transactions existantes** : c'est **la seule option qui respecte la contrainte du point 4** (voir plus bas) — Prisma n'autorise pas de retry partiel à l'intérieur d'une transaction déjà avortée par une violation de contrainte ; il faut relancer `$transaction` en entier depuis le call-site.
- **Coût migration** : aucun changement de schéma. Changement de code : wrapper à ajouter autour de chaque `prisma.$transaction(...)` qui peut produire un numero (9 fonctions publiques + variantes), OU — mieux — un seul point d'interception dans le **Proxy déjà existant** `src/lib/db.ts` (qui retry déjà les erreurs de connexion sur `prisma.$transaction`). C'est l'endroit le plus naturel : le Proxy intercepte déjà `$transaction`, il suffit d'ajouter une branche "P2002 sur un champ `numero`/`code` → retry avec un nouveau callback" à côté de la branche `isConnectionError`.
- **Risque** : si la transaction contient des effets de bord non idempotents en dehors de Prisma (envoi d'email, appel HTTP externe) avant la génération du numero, un retry complet les rejouerait. Vérification faite : les fonctions concernées (create*) ne font que des opérations Prisma dans leur tx — pas d'effet de bord externe observé dans les 9 fonctions listées. À confirmer néanmoins avant implémentation (grep `fetch(`, `sendEmail`, `smobilpay` dans les fonctions concernées).

### Option B — Séquence PostgreSQL
- **Incompatible avec la portée du compteur.** Une séquence Postgres (`CREATE SEQUENCE`) est un compteur *global* atomique — elle ne peut pas nativement produire un compteur **par site ET par année** (ni par sexe pour LotGeniteurs) sans une séquence par (site, année) créée dynamiquement, ce qui est impraticable en SQL standard (impossible de créer une séquence "à la volée" par valeur de clé étrangère sans DDL dynamique). Écartée.

### Option C — Table compteur avec `UPDATE ... RETURNING` atomique
- **Mécanisme** : table `CompteurNumero(siteId, prefix, annee, dernierSeq)` avec `UPDATE ... SET dernierSeq = dernierSeq + 1 WHERE siteId=... AND prefix=... AND annee=... RETURNING dernierSeq` (ou `INSERT ... ON CONFLICT DO UPDATE RETURNING`). Cette opération est atomique même en Read Committed (l'`UPDATE` verrouille la ligne).
- **Compatibilité portée** : compatible avec toutes les portées (site+année, site+sexe) — il suffit d'adapter la clé composite de la table compteur.
- **Compatibilité transactions existantes** : compatible, s'exécute avec `tx` comme n'importe quelle requête Prisma dans la transaction existante — **aucun changement de structure de transaction nécessaire**, contrairement à l'Option A qui exige un retry de toute la transaction.
- **Coût migration** : **nécessite une migration Prisma** (nouveau modèle `CompteurNumero` + une ligne de seed/backfill pour ne pas réinitialiser les séquences existantes à 0 — il faut initialiser `dernierSeq` à la valeur max actuelle par (site, prefix, année) pour chaque modèle concerné, sous peine de re-générer des numéros déjà utilisés).
- C'est l'option la plus robuste sur le fond (élimine la race condition à la source, pas seulement en aval), mais coûte une migration + un script de backfill non trivial (8 familles × N sites × N années).

### Option D — Advisory lock PostgreSQL (`pg_advisory_xact_lock`)
- **Mécanisme** : verrou consultatif tenu pour la durée de la transaction, clé dérivée de `hashtext(siteId || prefix || annee)`, posé juste avant le `findFirst` dans `generateNextNumero`.
- **Compatibilité transactions existantes** : compatible — s'exécute via `tx.$queryRaw` dans la transaction déjà ouverte, aucun retry de transaction nécessaire, **changement localisé à `numero-utils.ts` uniquement** (et aux 4 helpers dupliqués si on les factorise en même temps).
- **Compatibilité portée** : compatible avec toute portée, la clé de hash peut inclure autant de composantes que nécessaire (site, prefix, année, sexe).
- **Coût migration** : **aucune migration Prisma nécessaire** — `pg_advisory_xact_lock` est une fonction Postgres native, appelée via `tx.$executeRaw` ou `tx.$queryRaw`.
- Contrainte : les verrous advisory sont globaux au niveau de la connexion/session Postgres, donc sans risque de collision de clé avec d'autres usages de `pg_advisory_lock` dans le projet — à vérifier qu'aucun autre usage n'existe déjà (grep effectué : aucun usage actuel de `pg_advisory` dans le repo).

## Point déterminant — retry et transactions existantes (point 4)

**Confirmé pour les 9 sites d'appel du helper/pattern dupliqué : TOUS sont invoqués depuis l'intérieur d'un `prisma.$transaction(async (tx) => {...})` ouvert dans la même fonction publique**, sauf **`ListeBesoins` où `generateNumeroBesoin(siteId)` est appelée HORS de toute transaction** (avant l'ouverture du `$transaction` de création, besoins.ts:340 vs :343).

Conséquence directe pour l'Option A (retry sur P2002) : **on ne peut pas retenter uniquement `generateNextNumero`** à l'intérieur d'une transaction Prisma déjà avortée par une violation de contrainte unique — une fois qu'une requête échoue dans un `$transaction` interactif, la transaction Postgres sous-jacente est dans un état `aborted` et toute requête suivante sur la même transaction échoue aussi (`current transaction is aborted, commands ignored until end of transaction block`). **La boucle de retry doit donc englober l'appel entier à `prisma.$transaction(...)`**, pas seulement l'appel à `generateNextNumero`.

Placement exact recommandé par famille (si Option A retenue) :
- **Facture** : autour de `prisma.$transaction(...)` dans `createFacture` (factures.ts:92)
- **Depense** : 6 call-sites différents, chacun avec son propre `$transaction` — soit dupliquer le wrapper de retry 6 fois, soit (préférable) centraliser dans le Proxy `db.ts`
- **Commande** : `commandes.ts:148` (`createCommande`) + corriger `besoins.ts` pour utiliser le helper au lieu du code dupliqué avant d'y ajouter le retry
- **Vente** : 3 call-sites (`ventes.ts:365`, `:496`, `:787`)
- **BonLivraison** : `bons-livraison.ts:141` (`createBonLivraison`) + `:520` (`creerBonLivraisonRectificatif`)
- **ListeBesoins** : nécessite d'abord de **déplacer `generateNumeroBesoin` à l'intérieur de la transaction de création** (besoins.ts:343) avant de pouvoir appliquer un retry cohérent — actuellement le calcul et l'écriture sont dans deux requêtes DB séparées, ce qui est un bug de robustesse plus large que la story SU.3 (fenêtre de course même sans collision d'unicité : un autre besoin peut être créé entre le calcul du numero et la création réelle).
- **Ponte / Incubation / LotGeniteurs** : à corriger pour utiliser le helper commun d'abord (voir Incohérences), puis même traitement.

**C'est pourquoi l'Option la plus économe en points de modification est soit D (advisory lock, localisé à `numero-utils.ts` + génériser aux 4 helpers dupliqués), soit A implémentée UNE SEULE FOIS dans le Proxy `src/lib/db.ts`** (qui intercepte déjà tous les appels `$transaction` — il suffit d'y ajouter une branche P2002-sur-numero à côté de la branche `isConnectionError` existante), plutôt que de dupliquer un retry dans chaque fonction `create*`.

## Recommandation d'option

**Option D (advisory lock) au niveau du helper `numero-utils.ts`, complétée par la factorisation des 4 implémentations dupliquées vers ce même helper.**

Justification :
1. Zéro migration Prisma — contrainte de coût la plus faible.
2. Un seul point de modification (`numero-utils.ts`) au lieu de modifier 9+ fonctions appelantes ou le Proxy global (qui mélangerait une préoccupation "connexion" avec une préoccupation "unicité applicative" — séparation des responsabilités).
3. Compatible tel quel avec la portée par site/année/sexe (clé de hash composite).
4. Élimine la race condition à la source (pas de retry perceptible côté utilisateur, pas de risque de rejouer un side-effect).
5. Ne résout PAS le bug distinct de la contrainte `@unique` globale (voir Risques) — un fix séparé (migration `@@unique([siteId, numero])` ou équivalent) reste nécessaire, mais n'est pas bloquant pour SU.3 si le volume actuel est mono-site ou faible-multi-site (à confirmer avec le PM/l'historique de prod).

Si une migration est de toute façon nécessaire pour corriger le bug d'unicité globale (voir ci-dessous), alors l'Option C (table compteur) devient plus attractive car elle peut être introduite dans la même migration que le passage à `@@unique([siteId, numero])`, et règle les deux problèmes (race condition + portée) d'un seul geste. **Décision à trancher par @architect/@db-specialist selon si le bug d'unicité globale est traité dans la même story ou reporté.**

## Incohérences trouvées

1. **4 implémentations dupliquées du pattern hors du helper commun** : `pontes.ts:generatePonteCode`, `incubations.ts:generateIncubationCode`, `geniteurs.ts:generateLotCode`, `besoins.ts:generateNumeroBesoin`. Chacune répète le même `findFirst + orderBy desc + split + parseInt + padStart`. Suggestion : étendre le type `NumeroModel` dans `numero-utils.ts` pour couvrir `ponte`, `incubation`, `lotGeniteurs`, `listeBesoins`, et généraliser `generateNextNumero` pour accepter soit le champ `numero` soit `code` (paramètre `field: "numero" | "code"`), soit un séparateur différent pour `LG-{F|M}-NNN` (pas d'année, format à 2 segments au lieu de 3 — le helper actuel suppose `parts[2]`, ce qui casserait sur `LG-F-001` où le seq est `parts[2]` par coïncidence mais le préfixe n'a pas d'année — à vérifier soigneusement lors de la généralisation).
2. **Duplication inline supplémentaire dans `besoins.ts`** pour le numero de Commande (lignes 644 et 967, dupliquée deux fois dans le même fichier) alors que `commandes.ts` utilise déjà `generateNextNumero(tx, "commande", "CMD", siteId)` et que `besoins.ts` importe et utilise ce même helper pour Depense un peu plus loin dans le fichier. C'est la preuve la plus nette qu'un fix appliqué uniquement dans `numero-utils.ts` **laissera 3 bugs de collision non corrigés** (2x Commande dans besoins.ts + ListeBesoins).
3. **`ListeBesoins` : génération du numero hors transaction** (besoins.ts:340 vs `$transaction` ouvert en 343) — fenêtre de course plus large que les autres modèles, à corriger indépendamment du choix d'option retenu.
4. **Contrainte `@unique` globale au lieu de composite par site** sur `numero`/`code` pour tous les modèles concernés (Facture, Depense, Commande, Vente, BonLivraison, Ponte, Incubation, LotGeniteurs, ListeBesoins) — vérifié dans `prisma/schema.prisma`. Le calcul de séquence est scopé par `siteId` (`where: { siteId, numero: { startsWith } }`), mais l'unicité en base ne l'est pas. **Deux sites distincts généreront systématiquement le même `FAC-2026-001`** dès que chacun crée sa première facture de l'année — ce n'est pas une simple race condition concurrente, c'est une collision déterministe multi-tenant. Risque distinct de SU.3 (qui porte sur la concurrence intra-site) mais à signaler au PM/architecte : la vraie correction long terme est `@@unique([siteId, numero])` (nécessite une migration), combinée à l'un des mécanismes anti-race ci-dessus.
5. **Le rapport de review-sprint-BL affirme "500 opaque"** alors que `handleApiError` (déjà en place) convertit P2002 en 409 propre pour toutes les routes concernées (vérifié : tous les fichiers appelant `createFacture/createDepense/createCommande/createVente/createBonLivraison/createListeBesoins/...` passent par `handleApiError`). À signaler à @knowledge-keeper pour corriger la description du problème (le problème réel est "pas de retry automatique", pas "500 opaque").

## Risques identifiés

1. **Fix appliqué uniquement dans `numero-utils.ts`** : ne couvrirait que 5 des 9 familles concernées → faux sentiment de "corrigé une fois pour toutes" alors que Ponte/Incubation/LotGeniteurs/ListeBesoins/Commande(besoins.ts) resteraient vulnérables. Impact : Haute si non traité dans le scope de SU.3.
2. **Contrainte `@unique` globale vs scope par site** : collision garantie en multi-site actif simultanément sur la même année. Impact : Critique si plusieurs sites de production sont actifs ; à vérifier avec le PM le nombre de sites actuellement en production. Mitigation : traiter séparément ou dans la même migration si Option C est retenue.
3. **Retry de transaction entière (Option A)** : risque de rejouer un effet de bord si une des fonctions concernées venait à en acquérir un plus tard (email, webhook). Mitigation : documenter la contrainte "pas d'I/O externe dans une transaction avec numero auto-généré" dans ERRORS-AND-FIXES.md pour éviter une régression future.
4. **Généralisation du helper à `code` (Ponte/Incubation/LotGeniteurs)** : le format `LG-{F|M}-NNN` n'a pas de segment année — généraliser sans casser le parsing `parts[2]` demande une attention particulière (offset différent selon le nombre de segments du préfixe).

## Prérequis manquants

1. Décision PM/architecte sur le périmètre exact de SU.3 : le fix couvre-t-il uniquement les 5 familles déjà dans le helper, ou les 9 familles (y compris la factorisation des 4 dupliquées) ? Le titre de la story ("UNE FOIS, AU BON ENDROIT") suggère fortement la 2e option.
2. Décision sur le traitement du bug distinct de `@unique` global (item 4 des incohérences) : dans SU.3, story séparée, ou accepté comme risque connu documenté.
3. Confirmation qu'aucune des fonctions `create*` concernées n'exécute d'I/O externe non idempotent dans sa transaction (grep rapide fait, rien trouvé, mais à reconfirmer par l'implémenteur avant de choisir l'Option A).

## Recommandation

**GO** pour démarrer SU.3, à condition que le scope couvre explicitement :
1. Le fix anti-collision dans `numero-utils.ts` (Option D recommandée : advisory lock).
2. La migration des 4 implémentations dupliquées (Ponte, Incubation, LotGeniteurs, ListeBesoins) vers ce helper commun, généralisé pour accepter `code` en plus de `numero` et un format sans année.
3. La suppression du code dupliqué inline dans `besoins.ts` (2 occurrences CMD) au profit de l'appel existant à `generateNextNumero`.
4. Le déplacement de `generateNumeroBesoin` à l'intérieur de la transaction de création dans `createListeBesoins`.

Le bug distinct de contrainte `@unique` globale (item 4) est un **NO-GO conditionnel** : à faire trancher explicitement par le PM avant de clore la story — soit inclus dans SU.3 (migration `@@unique([siteId, numero])`), soit reporté à une story dédiée avec un bug ouvert documenté.

Build : OK. Tests : 5502/5580 passent, 52 échecs tous par timeout (contention machine, sans rapport avec numero) — à revalider par @tester sur une machine moins chargée, mais ne bloque pas le démarrage de SU.3.
