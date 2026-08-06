# Pré-analyse — Sélection de produits à la création d'un scénario Prévisions

## Statut : GO AVEC RÉSERVES

## Résumé
Les deux défauts sont confirmés ligne à ligne. Le point structurant est confirmé : il faut un
NOUVEL endpoint (ou une extension de permission), la route GET /api/produits existante ne peut pas
être réutilisée telle quelle sans changer sa permission ou en ajouter une variante côté Prévisions.
Le test d'intégration DB-gated existant doit rester vert au comportement absent, et servir de modèle
pour les nouveaux tests. Aucun bloqueur technique ; les réserves portent sur des arbitrages à trancher
avant l'implémentation (permission de lecture des produits, forme exacte du filet serveur).

## 1. Vérification des deux défauts

**Confirmé, `src/lib/queries/previsions-scenarios.ts`.**

- Tout-ou-rien (:300-308) : `sansTailleGranule = produits.filter((p) => !p.tailleGranule)` ; si non
  vide, `throw new BusinessRuleError(...422)` DANS `copierAlimentsPrevisionDepuisProduits`, elle-même
  appelée (:237) à l'intérieur de la transaction `createScenario` (le `tx.$transaction` englobant n'est
  pas montré dans l'extrait mais le commentaire de tête et le test d'intégration confirment le rollback
  total). Un produit ALIMENT actif quelconque du site, sans rapport avec le scénario en cours de
  création, bloque la création de TOUT scénario sur le site. `scenario-form-dialog.tsx` ne mentionne à
  aucun endroit produits/aliments — l'utilisateur découvre l'échec sans contexte.
- Zéro silencieux sur `contenance` (:338-339) : `poidsSacKg = new Decimal(produit.contenance ?? 0)`,
  puis `sacsParTonneUnitaire = poidsSacKg.lte(0) ? new Decimal(0) : ...`. Aucun `throw` équivalent à
  celui de `tailleGranule` — `Produit.contenance` est nullable (schema.prisma:1595,
  `contenance Decimal? @db.Decimal(10, 3)`), et rien ne bloque un produit ALIMENT actif sans
  contenance : il produit un article silencieusement à 0 kg/sac, 0 sac/tonne. Le chemin de saisie
  manuelle (`previsions.schema.ts` — en réalité `src/lib/validation/previsions.schema.ts`, voir §2) a
  bien `poidsSacKg: z.number().positive()` sur la création manuelle d'un article — deux disciplines
  opposées sur le même champ logique selon la porte d'entrée. Famille ERR-185/ERR-173 confirmée.

Point supplémentaire vérifié dans le code (non cité dans la commande mais pertinent) : le cas
« aucun produit ALIMENT actif » (:298, `if (produits.length === 0) return;`) est un retour silencieux
identique en nature — le scénario se crée sans aucun calibre, sans qu'aucun message n'informe
l'utilisateur que rien n'a été copié. C'est exactement le cas nommé « c » des arbitrages tranchés
(sélection vide autorisée mais **à rendre visible**).

## 2. Inventaire exhaustif des fichiers impactés

| Rôle | Fichier |
|---|---|
| Query copie + création | `src/lib/queries/previsions-scenarios.ts` (`copierAlimentsPrevisionDepuisProduits` :288-355, `createScenario` :237, `repartirPourcentagesEgaux` :367-376) |
| Route création scénario | `src/app/api/previsions/scenarios/route.ts` (POST, :64-85) — permission `PREVISIONS_GERER` |
| Schéma zod | `src/lib/validation/previsions.schema.ts` (`createScenarioSchema` :94-101 — chemin réel, PAS `previsions.schema.ts` à la racine comme indiqué dans la consigne ; le fichier de règle de saisie manuelle `poidsSacKg: z.number().positive()` cité (:179 dans la consigne) est probablement dans le même fichier, à vérifier au grep exact `poidsSacKg` avant implémentation) |
| DTO/types front | `src/components/previsions/api-types.ts` (`ScenarioPrevisionSummaryDTO` et tout type d'entrée du POST scénario) |
| UI formulaire | `src/components/previsions/scenario-form-dialog.tsx` (single-step aujourd'hui, aucune section produits/aliments) et son test `src/components/previsions/__tests__/scenario-form-dialog.test.tsx` |
| Appelant(s) de l'UI | à confirmer par grep `<ScenarioFormDialog` (probablement `src/app/previsions/scenarios/*` page liste) |
| i18n fr | `src/messages/fr/previsions.json` (clés sous `scenarioForm.*`, nouvelle section ex. `scenarioForm.produits.*`) |
| i18n en | `src/messages/en/previsions.json` (même structure) |
| Query produits (lecture existante, réutilisable) | `src/lib/queries/produits.ts` (`getProduits`) |
| Route produits (lecture existante) | `src/app/api/produits/route.ts` (GET, permission `STOCK_VOIR`) |
| Fiche produit (lien "corriger") | `src/app/stock/produits/[id]/page.tsx` |
| Test intégration DB-gated à étendre (jamais remplacer) | `src/lib/queries/__tests__/previsions-scenarios-copie-produits-integration.test.ts` |
| Test mocké query | `src/lib/queries/__tests__/previsions-scenarios.test.ts` |
| Tests API mockés impactés | `src/__tests__/api/previsions-auth-permissions.test.ts`, `src/__tests__/api/previsions-validations-http-mapping.test.ts`, `src/__tests__/api/previsions-cross-site-and-serialization.test.ts` |
| Allowlist tests DB-gated | `src/test/db-gated-allowlist.ts` |

## 3. Comment l'UI obtient la liste des produits ALIMENT actifs du site

**Une route existe déjà et suffit fonctionnellement, mais avec un problème de permission (réserve
majeure) :**

`GET /api/produits?categorie=ALIMENT` (`src/app/api/produits/route.ts:15-39`) →
`getProduits(siteId, { categorie: "ALIMENT" }, pagination)` (`src/lib/queries/produits.ts:6-35`).

- Filtre déjà `isActive: true` en dur dans la query (:13), pas seulement optionnel — exactement le
  périmètre voulu (« produits ALIMENT actifs »).
- Trie déjà `orderBy: { nom: "asc" }` (:27) — même ordre que celui utilisé par
  `copierAlimentsPrevisionDepuisProduits` (:295), important pour la cohérence visuelle avec l'ordre de
  regroupement par calibre.
- Réponse : `{ data: Produit[], total, limit, offset }` — `Produit[]` inclut déjà `tailleGranule`,
  `contenance`, `prixUnitaire`, `nom`, `id` (champs du modèle), plus `fournisseur` et `_count`
  (surplus non gênant).
- **Problème** : permission `STOCK_VOIR` (:17), pas `PREVISIONS_*`. `SiteRole.permissions` est un
  tableau libre par site (`prisma/schema.prisma:1148-1162`, pas de rôles fixes) — un utilisateur avec
  `PREVISIONS_GERER` (nécessaire pour `POST /api/previsions/scenarios`) **n'est pas garanti** d'avoir
  aussi `STOCK_VOIR`. Le tableau de rôles par défaut de l'ADR-053 §6 (« Gestionnaire : PREVISIONS_VOIR,
  PREVISIONS_GERER ») ne mentionne aucune permission Stock. Réutiliser tel quel `GET /api/produits`
  provoquerait un 403 pour un Gestionnaire Prévisions sans droits Stock — cassant l'écran de sélection
  pour une partie légitime des utilisateurs cibles.

**Décision à trancher avant l'implémentation (pas tranchée par la consigne) :**
(a) élargir la permission de `GET /api/produits?categorie=ALIMENT` pour accepter `STOCK_VOIR` OU
`PREVISIONS_GERER`/`PREVISIONS_VOIR` (`requirePermission` doit supporter un OR, à vérifier dans
`src/lib/permissions.ts`) ; ou (b) créer un endpoint dédié, ex.
`GET /api/previsions/produits-alimentaires-eligibles` gardé par `PREVISIONS_GERER`, qui appelle en
interne `getProduits` (ou une variante) et ajoute le champ dérivé `eligible: boolean` +
`raisonInvalidite?: string` pour chaque produit (tailleGranule/contenance manquants), évitant à l'UI de
recalculer cette logique côté client. **(b) est recommandé** : la logique d'éligibilité (deux
conditions : tailleGranule non nul, contenance strictement positive) est une règle métier du module
Prévisions, pas du module Stock — la coder côté client dupliquerait une règle serveur déjà appliquée
dans `copierAlimentsPrevisionDepuisProduits`, risque direct de divergence (ERR-185/ERR-173 encore).

## 4. Lien vers la fiche produit

`src/app/stock/produits/[id]/page.tsx` → URL `/stock/produits/{id}`. Confirmé existant par présence du
fichier de page. Le lien "corriger" dans la liste de sélection doit pointer vers cette URL (nouvel
onglet recommandé pour ne pas perdre la saisie en cours du formulaire de scénario, cf. `touched` state
dans `scenario-form-dialog.tsx:105-106` déjà pensé pour la fermeture accidentelle).

## 5. Inventaire des tests existants impactés

Fichiers qui appellent `createScenario` ou `POST /api/previsions/scenarios` :

- `src/lib/queries/__tests__/previsions-scenarios.test.ts` — tests mockés de `createScenario`
  (transaction, copie, isolation site). **Risque : faible si `produitIds` reste optionnel** — ces tests
  n'envoient jamais ce champ, donc le chemin `undefined` (comportement actuel préservé par arbitrage b)
  doit rester identique. À VÉRIFIER une fois le code écrit : que le branchement `produitIds === undefined`
  emprunte exactement l'ancien code, pas une réécriture qui changerait un comportement de bord (ordre,
  regroupement).
- `src/lib/queries/__tests__/previsions-scenarios-copie-produits-integration.test.ts` — **le plus
  sensible.** Les deux tests (`nominal` et `rollback`) appellent `createScenario` SANS `produitIds`
  → doivent rester verts sans modification si l'arbitrage (b) est respecté à la lettre. Le test
  `rollback` attend `.rejects.toThrow(/tailleGranule/)` avec zéro ligne survivante — ce comportement doit
  être PRÉSERVÉ quand `produitIds` est absent (comportement actuel, garde 422 inchangé) et doit être
  ÉTENDU (nouveaux tests, pas remplacement) pour le cas `produitIds` fourni avec un id invalide (produit
  sans tailleGranule/contenance choisi explicitement → 422 nommant CE produit).
- `src/__tests__/api/previsions-auth-permissions.test.ts` — teste la permission `PREVISIONS_GERER` sur
  `POST /api/previsions/scenarios` avec un payload minimal mocké (`createScenario` entièrement mocké,
  :66). Risque faible : n'exerce pas `copierAlimentsPrevisionDepuisProduits` réellement.
- `src/__tests__/api/previsions-validations-http-mapping.test.ts` et
  `src/__tests__/api/previsions-cross-site-and-serialization.test.ts` — à confirmer par grep du corps
  exact du payload POST envoyé (non lu en détail ici) ; probablement des mocks de `createScenario` donc
  peu de risque, mais si l'un de ces fichiers valide le schéma zod `createScenarioSchema` avec un objet
  strict (`.strict()` ou vérification exhaustive des clés), l'ajout du champ optionnel `produitIds`
  DOIT être vérifié pour ne pas casser une assertion de forme exacte de payload.
- `src/lib/queries/__tests__/previsions-snapshot-budget-integration.test.ts`,
  `previsions-cloture-integration.test.ts`, `previsions-rapprochement-integration.test.ts`,
  `previsions-postes-referentiel-admin-integration.test.ts`,
  `previsions-tresorerie-trois-series-integration.test.ts`,
  `previsions-mapping-orphelins-integration.test.ts`,
  `previsions-rapprochement-aliment-scope-integration.test.ts` — appellent `createScenario`
  probablement comme fixture de mise en place (setup), pas comme sujet du test. Risque faible SI le
  comportement par défaut (`produitIds` absent) reste bit-à-bit identique. À vérifier un par un
  (non fait ici par économie de temps — @tester doit les exécuter tous après implémentation, pas
  seulement les nommés dans la consigne).

## 6. Contrat ADR-052 §6 pour les nouveaux tests DB-gated

Modèle exact : `src/lib/queries/__tests__/previsions-scenarios-copie-produits-integration.test.ts`
(et `previsions-poste-referentiel-sql-artefact-historique-integration.test.ts` cité en consigne, motif
identique). Éléments obligatoires pour tout nouveau test DB-gated ajouté par cette story (ex. test du
garde serveur avec `produitIds` fourni contenant un id invalide, exercé contre une vraie transaction
Postgres pour prouver le rollback réel) :

1. `import { requireDatabaseUrl } from "@/test/require-database-url";` puis
   `describe.runIf(requireDatabaseUrl())(...)` — jamais un `!!process.env.DATABASE_URL` réécrit à la
   main (interdit explicitement par ADR-052 §6).
2. `beforeAll` qui tente la connexion (`pool.connect()` + `SELECT 1`), catch qui met `dbAvailable =
   false` **et conserve l'erreur** (`erreurConnexion`) — jamais un `catch { return; }` muet (c'est
   exactement le motif ERR-192 interdit).
3. Dans CHAQUE test (jamais dans `beforeAll`) : `if (!dbAvailable || !client) { throw new Error(
   MESSAGE_DB_INJOIGNABLE, { cause: erreurConnexion }); }` — le test échoue bruyamment, jamais un
   `console.warn` + `return` déguisé en skip.
4. Nettoyage explicite en `finally` (`cleanup`) supprimant dans l'ordre inverse des FK — pas de
   dépendance sur une transaction englobante qui rollback automatiquement (ces tests insèrent via `pg`
   brut, pas via Prisma test transaction).
5. Entrée dans `src/test/db-gated-allowlist.ts` : une entrée par occurrence de
   `describe.runIf(...)`, avec `justification` substantielle nommant la ressource externe réelle
   prouvée (ici : la contrainte transactionnelle réelle de Postgres — le rollback total de
   `$transaction` sur un `throw` en cours de boucle `createMany`/`create`, non simulable par un mock JS
   qui n'applique aucune atomicité réelle), et `adr: "ADR-052"`. Le test méta
   (`src/__tests__/meta/db-gated-tests-registry.test.ts`) vérifie la présence et la longueur minimale de
   cette justification — l'omettre fait échouer ce test méta, pas seulement une convention documentaire.

## 7. Risques et pièges

1. **`repartirPourcentagesEgaux` sur sous-ensemble** — vérifié : la fonction ne connaît que `n` (le
   nombre d'articles du groupe APRÈS filtrage par sélection), donc cocher un seul produit d'un calibre à
   deux produits donne bien `[100]` (cas `n<=1` :368). Correct par construction, aucun changement requis
   dans cette fonction — seul l'appelant doit lui passer `groupe.length` du sous-ensemble sélectionné,
   pas du total.
2. **Ordre déterministe** — `orderBy: { nom: "asc" }` (:295) est la source d'ordre pour `ordreCalibre`
   ET pour l'ordre des articles au sein d'un groupe (`indexArticle` dans `.map`, :337). Filtrer par
   `produitIds` doit se faire APRÈS ce tri (filtrer un tableau déjà trié préserve l'ordre relatif en
   JS `Array.filter`), jamais reconstruire l'ordre depuis `produitIds` (qui n'a aucune garantie d'ordre
   côté client).
3. **Cast `produit.tailleGranule as TailleGranule` (:312)** — sûr uniquement parce que le garde
   (:300-308) a déjà exclu tout produit sans `tailleGranule` AVANT ce point. Si l'implémentation future
   remplace le garde tout-ou-rien par un filtre sur liste sélectionnée, ce cast reste sûr TANT QUE le
   filtre de validation (nouveau, sur `produitIds`) s'exécute strictement avant la boucle de
   regroupement — sinon un produit sélectionné-mais-invalide franchirait le cast sans être rejeté. Un
   vrai type guard (`function estGranuleValide(p): p is Produit & { tailleGranule: TailleGranule }`)
   est plus sûr qu'un cast si la logique de validation se complexifie (ajout de la contrainte
   `contenance` en plus de `tailleGranule`).
4. **La sélection doit précéder la transaction, pas la déclencher** — le POST reçoit `produitIds`
   (déjà choisis côté client), donc la validation serveur (site, catégorie, actif, tailleGranule ET
   contenance exploitables) doit se faire soit avant `tx.$transaction`, soit en tout début de la
   transaction, mais dans TOUS les cas AVANT toute écriture (`ScenarioPrevision`,
   `ParametresPrevision`) — sinon un produit invalide provoque encore un rollback tardif après écriture
   partielle, ce qui reste correct fonctionnellement (transaction unique = rollback total) mais gaspille
   un aller-retour DB inutile. Non bloquant, mais à optimiser : valider `produitIds` par une requête
   `findMany` AVANT `tx.$transaction` (lecture seule, hors transaction) permet de renvoyer le 422 sans
   même ouvrir de transaction d'écriture — cohérent avec "sélection avant l'écriture" de la consigne.
5. **`AlimentArticlePrevision.produitId`** — confirmé JAMAIS lu pour la résolution de rapprochement :
   `src/lib/queries/previsions-rapprochement.ts` résout exclusivement par
   `MouvementStock.produitId -> Produit.tailleGranule` (chemin réel) ou
   `LigneDepense.produitId -> Produit.tailleGranule` (chemin nullable), jamais par
   `AlimentArticlePrevision.produitId`. Confirme que restreindre la copie à un sous-ensemble de
   `produitId` n'a aucun impact sur le moteur de rapprochement — risque nul de ce côté.
6. **Permission de lecture des produits côté UI (voir §3)** — risque le plus concret de blocage
   fonctionnel si non tranché : sans décision explicite, l'écran de sélection sera invisible ou en
   erreur pour tout Gestionnaire Prévisions sans droits Stock.
7. **`createScenarioSchema` — chemin réel du fichier.** La consigne cite `previsions.schema.ts:179`
   pour la règle `poidsSacKg: z.number().positive()` ; le fichier réel confirmé dans ce dépôt est
   `src/lib/validation/previsions.schema.ts` (avec un "validation" singulier, pas "validations" comme
   indiqué dans le rôle générique de @pre-analyst). À utiliser tel quel pour toute implémentation.
8. **Réponse vide explicite (arbitrage c)** — actuellement `:298 if (produits.length === 0) return;`
   est un retour totalement silencieux. La story doit couvrir aussi le cas `produitIds` fourni comme
   tableau vide (`[]`, distinct de `undefined`) : la consigne l'autorise explicitement, mais l'API DTO
   de retour du scénario créé doit porter un signal exploitable par l'UI pour afficher le message
   "scénario créé sans calibre" (ex. `calibresCrees: 0` dans la réponse, ou l'UI déduit ce cas de
   l'absence de calibres après création — à trancher, la consigne ne le précise pas).

## 8. Verdict GO / NO-GO

**GO AVEC RÉSERVES.** Aucun bloqueur structurel. Deux points doivent être tranchés avant que
@developer commence, faute de quoi l'implémentation buttera dessus en cours de route :

1. **Permission de lecture des produits pour l'écran de sélection** (§3, §7.6) — élargir
   `GET /api/produits` ou créer un endpoint dédié Prévisions. Recommandation : endpoint dédié
   `GET /api/previsions/produits-alimentaires-eligibles` (ou nom équivalent), gardé par
   `PREVISIONS_GERER`, qui expose directement `eligible`/`raisonInvalidite` calculés côté serveur — évite
   toute duplication de règle métier côté client.
2. **Forme du signal "scénario créé sans calibre"** (§7.8) — à ajouter au DTO de retour ou déduit côté
   UI, mais doit être explicitement affiché (pas un silence, cf. ERR-173/ERR-185).

Aucune migration de schéma n'est nécessaire (aucun nouveau modèle, aucun nouveau champ Prisma identifié
— `produitIds` est un paramètre de requête, pas une colonne). Le test d'intégration DB-gated existant
(`previsions-scenarios-copie-produits-integration.test.ts`) sert de modèle direct et doit rester vert
sans modification pour le chemin `produitIds` absent — condition de non-régression vérifiable
immédiatement après implémentation en le relançant tel quel.
