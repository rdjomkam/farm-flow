# ADR-050 — Sort des scripts d'audit en lecture seule

**Statut :** Acceptée
**Date :** 2026-07-26
**Sprint :** MG (story MG.5)
**Auteur :** @architect
**Réfs :** ADR-049 (§3.1 taxonomie, §4 conséquences), `docs/analysis/pre-analysis-sprint-MG.md`
(section E), `scripts/data-fixes/su12-audit-doublons-numero.ts`,
`scripts/data-fixes/px-audit-signatures-corrompues.ts`, ERR-038, ERR-106.

---

## 1. Contexte

ADR-049 (§4, dernier point) laisse explicitement en suspens le sort de deux scripts déjà
livrés lors de sprints antérieurs : `scripts/data-fixes/su12-audit-doublons-numero.ts`
(sprint SU) et `scripts/data-fixes/px-audit-signatures-corrompues.ts` (sprint PX). Les
deux vivent dans `scripts/data-fixes/` — le même dossier que, historiquement, des
correctifs de données à écriture (les 4 fichiers `fix-*.sql` orphelins traités par
MG.2/MG.3). La question posée par MG.5 : ces deux scripts portent-ils, malgré leur nom
« audit », une écriture déguisée qui les ferait tomber sous l'obligation de migration
Prisma versionnée d'ADR-049 §3.1 ? Et si non, où doivent-ils vivre, et sont-ils encore
utiles ?

Le dépôt contient aujourd'hui **deux emplacements distincts** pour des scripts d'audit :
`scripts/data-fixes/` (`su12-audit-doublons-numero.ts`, `px-audit-signatures-corrompues.ts`)
et `prisma/data-fixes/` (`CX3-audit-empty-assignations.sql`,
`CF1-audit-stale-assignations.sql`). Une décision d'emplacement canonique est nécessaire
avant que MG.6 puisse écrire un garde-fou de non-régression mécaniquement fiable.

## 2. Qualification — les deux scripts sont-ils strictement en lecture seule ?

**Vérification effectuée par lecture intégrale des deux fichiers (pas un survol) :**

- `su12-audit-doublons-numero.ts` (228 lignes) : la seule opération SQL émise est
  `SELECT "siteId", "<field>" AS valeur, count(*)::int AS count, array_agg(id ORDER BY
  id) AS ids FROM "<table>" GROUP BY "siteId", "<field>" HAVING count(*) > 1` (fonction
  `findDoublons`). Aucun `UPDATE`, `INSERT`, `DELETE` dans le fichier. Aucun appel
  `prisma.*.update|create|delete|upsert` (le fichier n'utilise même pas le client Prisma,
  il passe par `pg.Pool` directement — voir §3.1 de son en-tête pour la justification
  ESM/CJS, ERR-003). La fonction `main()` ne fait qu'agréger et logger les résultats,
  jamais d'écriture.
- `px-audit-signatures-corrompues.ts` (269 lignes) : deux fonctions génératrices
  (`iterateBonLivraisonPages`, `iterateSitePages`) qui ne font que des `SELECT ... LIMIT
  $1 OFFSET $2`, paginées pour éviter de charger toute la table en mémoire. La fonction
  `auditValue()` appelle `decodeImageDataUrl()` (import direct, pas de réimplémentation)
  pour tester la décodabilité — une opération de calcul en mémoire, pas une écriture en
  base. Aucun `UPDATE`/`INSERT`/`DELETE`, aucun appel Prisma d'écriture. Le résultat est
  uniquement loggé.

**Conclusion de qualification :** les deux scripts sont **strictement en lecture seule**,
zéro écriture confirmée par lecture ligne à ligne. Ni l'un ni l'autre ne porte de
correctif déguisé. Au titre de la taxonomie ADR-049 §3.1 (« Audit en lecture seule »,
critère de qualification : zéro écriture, sans exception), **les deux ont le droit de
rester des scripts** — ils ne tombent pas sous l'obligation de migration Prisma
versionnée.

## 3. Options envisagées

### Option A — Supprimer les deux scripts, aucune valeur résiduelle
**Rejetée.** Comme démontré en §4, les deux scripts conservent une utilité diagnostique
réelle (dérive de schéma pour su12 ; quantification pour px), même si aucun n'est un
prérequis bloquant. Les supprimer ferait perdre un outil de diagnostic sans gain
correspondant.

### Option B — Conserver tel quel, sans reclassification ni déplacement
**Rejetée.** L'en-tête actuel de `su12-audit-doublons-numero.ts` présente l'audit comme
un **prérequis obligatoire** avant la migration de contrainte composite (« Si des
doublons existent, la migration ne doit PAS être appliquée telle quelle »). C'est
factuellement erroné — voir §4.1. Laisser ce texte en l'état continuerait de propager une
fausse prémisse à quiconque relit ce script plus tard. De plus, ne rien décider sur
l'emplacement canonique laisserait `scripts/data-fixes/` et `prisma/data-fixes/`
coexister indéfiniment, rendant impossible un garde-fou mécanique fiable pour MG.6.

### Option C — Reclassifier explicitement les deux scripts comme outils de diagnostic
optionnels (avec correction documentée, non appliquée ici, de l'en-tête su12), et statuer
sur un emplacement canonique unique pour tout futur script d'audit
**Retenue.** Elle corrige la fausse prémisse sans supprimer l'outil, formalise
l'emplacement canonique nécessaire à MG.6, et documente honnêtement le cas structurel
particulier de px (voir §5).

## 4. Décision — cas par script

### 4.1 `su12-audit-doublons-numero.ts`

**Le garde-fou de MG.4 (les migrations `20260726174843_numero_unique_par_site` et
`20260726212515_lotalevins_code_unique_par_site`) rend-il cet audit facultatif ?**

**Oui — et la raison est contre-intuitive, à expliciter clairement.**

Les deux migrations remplacent un `@unique` **global** sur `numero`/`code` par un
composite `@@unique([siteId, numero])` / `@@unique([siteId, code])`. Un composite
scopé par `siteId` est **strictement plus permissif** qu'un unique global : il autorise
tout ce que l'unique global autorisait, plus des combinaisons supplémentaires (même
`numero` sur deux sites différents). L'implication logique est directe :

> Si l'ancienne contrainte (`@unique` global sur `numero` seul) interdisait déjà
> l'existence de deux lignes portant le même `numero`, tous sites confondus, alors il ne
> peut *a fortiori* pas exister deux lignes portant le même `(siteId, numero)` — un
> sous-ensemble de conditions plus restrictif que « même `numero` » ne peut jamais être
> violé si la condition plus large ne l'était déjà pas.

**Conséquence directe :** ces deux migrations, prises isolément, **ne peuvent pas
échouer** sur un `CREATE UNIQUE INDEX ... (siteId, numero)` à cause de doublons de
données — il ne peut structurellement pas y avoir de doublon `(siteId, numero)` sur une
base qui vient de sortir d'une contrainte `@unique` globale sur `numero`. La prémisse de
l'en-tête actuel du script (« il faut auditer avant de déployer, sinon la migration
casse ») est **erronée** pour ces deux migrations précises.

**L'audit n'est donc pas un prérequis bloquant.** Son utilité résiduelle, réelle mais non
bloquante, est double :
1. **Détecter une dérive de schéma non documentée (ERR-038)** — le seul scénario qui
   ferait échouer `CREATE UNIQUE INDEX` serait que l'unique global sur `numero` ait déjà
   été retiré ou contourné hors migration Prisma (hotfix manuel, script de dev). Rien
   dans le dépôt n'indique un tel cas, mais l'absence ne peut pas être prouvée par simple
   lecture du dépôt — l'audit reste le seul moyen de le vérifier empiriquement contre une
   base réelle.
2. **Servir de contrôle avant l'introduction de futures familles de numérotation scopées
   par site** — toute nouvelle famille `numero`/`code` à `@unique` global qui migrerait
   un jour vers un composite bénéficierait du même raisonnement logique, mais l'audit
   reste un filet de sécurité peu coûteux à relancer avant chaque nouvelle migration de
   ce type, en particulier si le contexte diffère (par ex. une contrainte partant déjà
   d'un état composite plus étroit, où le raisonnement de §4.1 ne s'appliquerait plus).

**Recommandation :** conserver le script, le requalifier explicitement d'**outil de
diagnostic optionnel** (pas de prérequis bloquant), et corriger son en-tête. Ligne
concrète à corriger dans `scripts/data-fixes/su12-audit-doublons-numero.ts` (à faire par
un agent disposant du droit d'écrire ce fichier — **hors du périmètre d'écriture du
présent ADR**) :

> Ligne 30 : `*     empêcheraient l'application de la contrainte composite (le`
> Ligne 31 : `*     \`CREATE UNIQUE INDEX\` échouerait sinon). Si des doublons existent, la`
> Ligne 32 : `*     migration ne doit PAS être appliquée telle quelle — il faut d'abord`
> Ligne 33 : `*     dédupliquer les données (remédiation manuelle, hors scope de ce script).`

À remplacer par une formulation du type : « détecte les doublons `(siteId, numero/code)`
à titre de diagnostic — ces migrations ne peuvent structurellement pas échouer sur des
doublons de données puisque l'ancien `@unique` global les interdisait déjà (voir
ADR-050 §4.1) ; cet audit sert uniquement à détecter une dérive de schéma non documentée
(ERR-038) ou à valider une future famille de numérotation avant sa propre migration ».
Le code de sortie (0/1/2) et la logique de détection restent inchangés — seule la
documentation en tête de fichier doit refléter la nature réelle (diagnostic, pas
prérequis).

### 4.2 `px-audit-signatures-corrompues.ts`

**Que détecte-t-il exactement ?** Pour chaque signature/cachet stocké (`BonLivraison.
signatureClient`, `signatureLivreur`, `Site.signaturePromoteur`, `Site.cachet`), le
script teste si le PNG est décodable — décodage de structure PNG + `zlib.inflateSync` du
flux IDAT concaténé (réutilise `decodeImageDataUrl()` de PX.1, sans vérification CRC, cf.
limitation documentée du décodeur lui-même). Il rapporte, par ligne, décodable
(oui/non), format détecté, taille en octets, et raison de l'échec le cas échéant.

**Point technique établi — exception réelle à ADR-049, à nommer explicitement.** La
décodabilité d'un PNG (inflate zlib du flux IDAT) **n'est pas vérifiable en SQL pur** —
PostgreSQL n'a pas de fonction d'inflate zlib générique en core (pas d'équivalent de
`zlib.inflateSync` accessible depuis un `SELECT`). Ce n'est pas une limitation de
convention ou de style d'écriture : c'est une limitation **structurelle** du moteur SQL
lui-même. Conséquence directe et importante : **si un correctif de données s'avérait un
jour nécessaire sur des signatures corrompues** (par exemple mettre `NULL` sur les
colonnes non décodables, ou toute autre remédiation), **ce correctif ne pourrait pas être
une migration SQL pure** — contrairement à tous les correctifs traités par MG.2/MG.3, qui
ne font que comparer/écraser des valeurs stockées (jamais décoder un contenu binaire).

C'est une exception réelle au principe général d'ADR-049 (« tout correctif de données est
une migration Prisma versionnée ») : cette règle présuppose que le correctif peut être
exprimé en SQL, ce qui n'est pas toujours vrai dès que la logique de correction dépend
d'un décodage applicatif (zlib, parsing binaire, tout traitement que PostgreSQL ne sait
pas faire nativement). Il faut nommer et cadrer cette exception plutôt que de prétendre
qu'elle n'existe pas.

**Comment traiter cette exception le jour où le besoin se présentera.** Deux approches
sont possibles :

1. **Le correctif reste un script applicatif Node**, mais alors il doit satisfaire aux
   mêmes exigences de rigueur qu'une migration de correctif de données (ADR-049 §3.3),
   adaptées au contexte applicatif : idempotent (relire l'état avant d'écrire, ne
   ré-écrire que si nécessaire), journalisé (log structuré des lignes modifiées, avant/
   après), et sa trace d'exécution consignée quelque part de durable (pas seulement la
   sortie console — un fichier de log commité, ou une entrée dans
   `docs/analysis/`/`docs/bugs/` documentant quand et par qui il a été exécuté).
2. **Diviser en deux étapes** : l'identification reste un script applicatif (Node,
   décodage zlib réel) qui produit une **liste d'ids** des lignes corrompues ; la
   remédiation elle-même (par exemple `UPDATE ... SET "signatureClient" = NULL WHERE id
   IN (<liste>)`) devient alors une migration SQL classique, **prenant en entrée** la
   liste d'ids déjà identifiée — cette seconde étape ne nécessite plus de décodage, donc
   redevient exprimable en SQL pur et peut suivre le pipeline `migrate deploy` standard.

**Voie recommandée : l'option 2 (script d'identification + migration de remédiation).**
Justification : elle maximise la portion du correctif qui bénéficie de la traçabilité et
de la rejouabilité de `migrate deploy` (ADR-049) — seule l'étape d'identification, qui ne
peut structurellement pas être du SQL, reste hors du mécanisme de migration. La migration
de remédiation, elle, reste vérifiable via `_prisma_migrations`, reproductible, et
n'introduit aucun geste humain supplémentaire non garanti au moment de l'écriture
effective des données (le risque que corrigeait justement ADR-049). L'option 1
(correctif entièrement en script Node) resterait acceptable en dernier recours si la
remédiation elle-même nécessitait un traitement binaire (par exemple régénérer une
signature, pas seulement l'annuler) — mais ce n'est pas le cas prévisible ici (mettre à
`NULL` ou demander une nouvelle signature ne nécessite aucun décodage).

**Un correctif est-il nécessaire aujourd'hui ?** **Non.** Vérifié par lecture de code,
pas par supposition :
- `src/lib/export/render-pdf-safely.ts` : implémente un timeout dur
  (`PDF_RENDER_TIMEOUT_MS`) et une capture fail-safe des `uncaughtException` par refcount
  partagé (`inFlightRenders`), documentés comme garantissant qu'aucun rendu ne peut
  suspendre ni tuer le process, quelle que soit la cause (message, timeout, ou capture
  d'une `uncaughtException`) — indépendamment de toute pré-validation amont.
- `src/lib/export/pdf-bon-livraison.tsx` : importe et utilise `decodeImageDataUrl()` de
  `src/lib/validation/image-decode.ts` en pré-validation, mais ce n'est qu'une des deux
  barrières (défense en profondeur, pas la barrière ultime).
- `src/__tests__/export/pdf-render-guard-unconditional.test.ts` : appelle le **vrai**
  moteur `@react-pdf/renderer` (pas mocké) avec un PNG **forgé pour passer la
  pré-validation amont tout en cassant le décodeur réel de `@react-pdf/png-js`** — et
  prouve que `renderPdfSafely()` protège la requête HTTP même dans ce scénario exact
  (celui qui causait historiquement le blocage documenté par ERR-103/ADR-047).

Le rendu dégrade donc déjà proprement au lieu de planter, **indépendamment** de l'état
des données déjà en base. **Conclusion explicite : l'audit `px-audit-signatures-
corrompues.ts` est purement informatif aujourd'hui — aucun correctif de données n'est
requis pour lever un risque de disponibilité, celui-ci étant déjà couvert côté
application (sprint PX, ADR-047).** Son utilité reste réelle mais non urgente :
quantifier combien de signatures legacy (antérieures au durcissement PX.1/PX.2) sont
réellement corrompues, pour une décision de remédiation manuelle éventuelle (redemander
la signature, nettoyer à `NULL`) — une décision de produit, pas une urgence technique.

## 5. Décision opérationnelle — emplacement canonique des scripts d'audit

**Constat :** le dépôt a aujourd'hui deux emplacements pour des scripts d'audit :
`scripts/data-fixes/` (`su12-audit-doublons-numero.ts`, `px-audit-signatures-
corrompues.ts`) et `prisma/data-fixes/` (`CX3-audit-empty-assignations.sql`,
`CF1-audit-stale-assignations.sql`).

**Décision : `scripts/data-fixes/` n'est PAS l'emplacement canonique pour un audit** —
son nom porte sémantiquement le mot « fixes » (correctifs), ce qui entre en tension
directe avec la nature en lecture seule d'un audit et rend impossible une distinction
mécanique fiable entre les deux catégories dans un même dossier sans dépendre d'une
heuristique de contenu (fragile, cf. ADR-049 §4 qui rejette explicitement ce type
d'heuristique pour le garde-fou MG.6).

**Emplacement canonique retenu : `scripts/audits/`.**

Justification :
- Sépare physiquement, au niveau du système de fichiers, les scripts d'audit (lecture
  seule, hors du mécanisme de migration par nature — ADR-049 §3.1) des scripts de
  correctif de données à écriture (qui, eux, ne doivent jamais rester des scripts,
  ADR-049 §3, et n'ont donc pas vocation à survivre comme fichiers durables dans
  `scripts/data-fixes/` une fois convertis en migrations par MG.3).
- Rend le garde-fou de MG.6 vérifiable par une propriété structurelle du système de
  fichiers (« tout script sous `scripts/audits/` », pas une regex de contenu ou de nom)
  — cohérent avec la préférence déjà exprimée en pré-analyse (section F) pour des tests
  de garde basés sur des propriétés de chemin/dossier plutôt que sur une heuristique de
  contenu.
- `prisma/data-fixes/` (contenant aujourd'hui `CX3-audit-empty-assignations.sql` et
  `CF1-audit-stale-assignations.sql`) est également à considérer comme non canonique : sa
  localisation sous `prisma/` suggère à tort une proximité avec le mécanisme de migration
  Prisma, alors que ces fichiers sont, comme les deux scripts `.ts` traités ici, de purs
  audits en lecture seule sans lien avec `migrate deploy`.

**Convention de nommage : tout fichier sous `scripts/audits/` doit contenir la chaîne
`-audit-` dans son nom de fichier** (ex. `su12-audit-doublons-numero.ts`, `px-audit-
signatures-corrompues.ts`, `cx3-audit-empty-assignations.sql`, `cf1-audit-stale-
assignations.sql` — renommage mineur de casse pour les deux derniers, `CX3`/`CF1` →
`cx3`/`cf1`, à uniformiser avec la casse des deux scripts `.ts` existants). Cette
convention permet à un test de garde de vérifier mécaniquement deux propriétés
indépendantes et complémentaires :
1. **Tout fichier sous `scripts/audits/` respecte la convention `*-audit-*`** — sinon le
   test échoue (empêche qu'un correctif à écriture se glisse dans ce dossier sous couvert
   du nom du répertoire).
2. **Aucun fichier `.sql`/`.ts` de correctif à écriture ne doit se trouver ailleurs que
   dans un dossier de migration Prisma standard** (`prisma/migrations/<timestamp>_*/`) —
   propriété déjà couverte par le garde-fou général d'ADR-049 §4 (aucun fichier `.sql` à
   la racine de `prisma/migrations/`).

**Ce que le présent ADR ne fait pas :** aucun fichier n'est déplacé ici. Le déplacement
physique de `su12-audit-doublons-numero.ts`, `px-audit-signatures-corrompues.ts`,
`CX3-audit-empty-assignations.sql` et `CF1-audit-stale-assignations.sql` vers
`scripts/audits/` (avec renommage de casse pour les deux derniers), ainsi que la
suppression de `scripts/data-fixes/` et `prisma/data-fixes/` une fois vides, sont laissés
à la story **MG.6**, qui dispose du périmètre d'écriture nécessaire.

## 6. Conséquences

- **Ce qui devient interdit :** créer un nouveau script d'audit ailleurs que sous
  `scripts/audits/`, ou sans le composant `-audit-` dans son nom de fichier ; présenter
  un audit read-only comme un prérequis bloquant à une migration alors qu'aucune analyse
  ne le démontre (cf. correction requise sur l'en-tête de `su12-audit-doublons-numero.ts`,
  §4.1).
- **Ce qui change pour l'équipe :** tout futur script de diagnostic en lecture seule doit
  être créé sous `scripts/audits/` avec la convention `*-audit-*` dès sa création — pas
  seulement à l'occasion d'une réorganisation ultérieure.
- **Exception structurelle documentée :** un correctif de données portant sur un contenu
  nécessitant un décodage binaire (zlib, parsing d'image, etc. — cas des signatures PNG)
  ne peut pas être exprimé comme une migration SQL pure au sens strict d'ADR-049. La voie
  recommandée (§4.2) est la division identification (script Node) / remédiation
  (migration SQL prenant en entrée la liste d'ids identifiés) — à appliquer si et quand un
  correctif de signatures devient nécessaire, ce qui n'est pas le cas aujourd'hui.
- **Impact MG.6 :** le test de garde anti-récidive peut désormais s'appuyer sur une
  propriété de chemin (`scripts/audits/*-audit-*`) plutôt que sur une heuristique de
  contenu — cohérent avec la recommandation de la pré-analyse (section F).
