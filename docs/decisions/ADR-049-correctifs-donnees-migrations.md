# ADR-049 — Tout correctif de données est une migration Prisma versionnée

**Statut :** Acceptée
**Date :** 2026-07-26
**Sprint :** MG (story MG.1)
**Auteur :** @architect
**Réfs :** commit `c259b48` (4 correctifs orphelins), `scripts/data-fixes/gd3-vague-26-03-prep-transferts.sql` +
`gd3-apply.sh` (Bac 11 / Vague-26-03-Prep, cf. ADR-048), ERR-001, ERR-002, ERR-038, ERR-049
(`docs/knowledge/ERRORS-AND-FIXES.md`), `docs/sprints/SPRINT-MG.md`.

---

## 1. Contexte

Quatre correctifs de données de production ont été commités directement à la **racine** de
`prisma/migrations/` :

- `fix-vague2601-phantom-fish.sql`
- `fix-bes033-cmd015-duplicate.sql`
- `fix-calibrage-may14-missing-biometrie.sql`
- `fix-vte004-missing-vagueid.sql`

(commit `c259b48`).

Prisma ne considère comme migration que les **sous-dossiers** de `prisma/migrations/` contenant
un fichier `migration.sql` — c'est cette structure de dossier, pas l'emplacement racine, que
`migrate deploy` lit et enregistre dans la table `_prisma_migrations`. Les quatre fichiers ci-dessus
sont donc **inertes** : ils n'ont jamais été exécutés par `migrate deploy`, ne sont enregistrés
dans aucun historique de migration, et rien dans le dépôt ne permet d'affirmer si leur contenu a
été appliqué manuellement, sur quelle base, ni à quelle date.

Le même problème existe sous une forme différente pour `scripts/data-fixes/gd3-vague-26-03-prep-transferts.sql`
et son lanceur `gd3-apply.sh` : un script légitimement en dehors de `prisma/migrations/` (il n'a
jamais prétendu être une migration), mais appliqué **manuellement** en production — sans passer
par `migrate deploy`, donc sans garantie de rejouabilité ni de traçabilité de son exécution
(c'est l'incident Bac 11 / Vague-26-03-Prep documenté par ADR-048).

**Conséquence commune aux deux cas :** l'état réel des données de production n'est pas
reproductible depuis le dépôt. Personne ne peut répondre avec certitude à la question « ce
correctif a-t-il déjà tourné sur cette base ? » sans une inspection manuelle des données
elles-mêmes. Un nouvel environnement (dev, staging, nouveau site multi-tenant) ne reçoit jamais
ces correctifs, alors que rien ne signale qu'ils en auraient besoin.

## 2. Options envisagées

### Option A — Statu quo : script SQL/TS ad hoc, exécution manuelle documentée par convention
Le correctif reste un fichier hors du mécanisme de migration ; on se contente d'exiger une
meilleure discipline de documentation (commentaire, entrée dans un changelog manuel) sur qui l'a
exécuté et quand.

**Rejetée.** C'est exactement le statu quo qui a produit le problème : la discipline documentaire
volontaire ne survit pas à la pression d'un correctif urgent en production. Aucune vérification
automatique n'est possible (`migrate status`, CI, garde-fou de test) tant que le correctif ne vit
pas dans le mécanisme de migration lui-même.

### Option B — Tout correctif de données passe par un script dans `scripts/data-fixes/`, exécuté manuellement mais avec une checklist obligatoire (précondition, log, confirmation)
Formaliser `scripts/data-fixes/` comme emplacement canonique, avec un gabarit imposant
idempotence et journalisation, mais toujours hors `prisma/migrations/`.

**Rejetée.** Un script externe au mécanisme de migration reste, par construction, invisible à
`prisma migrate status` : rien ne garantit qu'il a tourné sur telle base avant tel autre correctif
qui en dépendrait, rien ne l'exécute automatiquement dans un pipeline de déploiement standard, et
rien n'empêche un humain de l'oublier. C'est la cause racine exacte de l'incident Bac 11
(`gd3-apply.sh`) : un script qui fonctionne, correctement écrit, mais qui dépend d'un geste humain
supplémentaire non garanti.

### Option C — Tout correctif de données est une migration Prisma versionnée (dossier sous `prisma/migrations/`, exécutée par `migrate deploy`), avec des exigences renforcées spécifiques aux correctifs de données (idempotence, no-op silencieux, journalisation)
Le correctif entre dans le même mécanisme, le même historique, la même commande de déploiement
que tout changement de schéma — mais avec des règles supplémentaires propres à sa nature
(modifier des données existantes, pas seulement une structure).

**Retenue.** C'est la seule option qui rend l'application du correctif **vérifiable** (présent
ou non dans `_prisma_migrations`), **reproductible** (même commande `migrate deploy` que tout le
reste), et **automatiquement inclus** dans le pipeline de déploiement standard — sans dépendre
d'un humain qui se souvient de lancer un script à part.

## 3. Décision

**Tout correctif de données doit être déployé comme une migration Prisma versionnée, jamais comme
un script exécuté à la main.**

Cette règle ne s'applique pas uniformément à tout script SQL du dépôt : elle dépend de la nature
de l'opération, formalisée par la taxonomie suivante.

### 3.1 Taxonomie en trois catégories

| Catégorie | Définition | Traitement |
|---|---|---|
| **Correctif de données** | Toute opération qui **modifie des lignes existantes** en base (`UPDATE`, `DELETE`, `INSERT` de rattrapage) pour corriger un état incorrect. | **Obligatoirement** une migration Prisma versionnée (dossier `prisma/migrations/<timestamp>_<nom>/migration.sql`), déployée via `migrate deploy`. |
| **Audit en lecture seule** | Un script dont l'unique effet est un `SELECT` (ou équivalent en lecture pure — `EXPLAIN`, vues non matérialisées). **Critère de qualification : zéro écriture.** | Peut légitimement rester un script (`scripts/data-fixes/` n'est pas le bon dossier pour un audit — voir 3.4 ; un script d'audit vit hors de `prisma/migrations/` et hors de `scripts/data-fixes/`, par exemple `scripts/audits/`). |
| **Garde-fou de migration** | Une vérification de précondition qui doit bloquer une migration si les données ne satisfont pas une contrainte attendue. | Doit vivre **dans la migration elle-même** (même fichier `migration.sql`), jamais dans un script préalable qu'un humain doit penser à lancer avant. |

**Critère de qualification pour "audit en lecture seule" :** zéro écriture, sans exception. Un
script qui contient ne serait-ce qu'un `UPDATE`, un `DELETE`, un `INSERT`, ou un appel de
procédure qui écrit, n'est **pas** un audit — c'est un correctif de données déguisé en audit, et
il doit être traité comme tel (catégorie 1). Un script qui « ne fait qu'un `SELECT` pour vérifier,
puis un `UPDATE` conditionnel juste après » est un correctif de données dans son intégralité, pas
un audit qui aurait accessoirement une petite partie d'écriture.

**Sur le garde-fou de migration :** une migration qui exige qu'un humain lance un script de
vérification *avant* de lancer `migrate deploy` est un **défaut de conception**, pas une
précaution acceptable. Le geste humain intercalé est précisément le point de défaillance qui a
permis aux quatre correctifs orphelins de rester inertes sans que personne ne s'en aperçoive : rien
ne garantit qu'il sera exécuté, ni que son résultat sera lu avant de continuer. La vérification de
précondition doit être un bloc SQL au sein de la migration, qui échoue la migration elle-même si
la précondition n'est pas remplie (section 3.3, point d).

### 3.2 Contrainte technique du projet — création manuelle du dossier de migration

Les migrations de ce projet sont créées en mode **non-interactif** (ERR-002) : `npx prisma
migrate dev` échoue sous Claude Code, faute de prompts interactifs. Le workflow standard est :

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Ce workflow **dérive le SQL depuis un diff de schéma** — il fonctionne pour toute migration de
structure (nouvelle colonne, nouveau modèle, nouvel enum). **Un correctif de données pur ne
modifie aucune structure** : `schema.prisma` ne change pas, donc `migrate diff` ne produit
**aucun SQL** pour ce correctif (il n'y a pas de diff de schéma à détecter).

**Conséquence obligatoire :** pour un correctif de données pur, le dossier de migration et son
`migration.sql` doivent être créés **à la main** :

```bash
mkdir -p prisma/migrations/<timestamp>_<nom-du-correctif>/
# écrire manuellement le fichier migration.sql (DML de correction, pas DDL de schéma)
npx prisma migrate deploy
```

Le timestamp suit le format Prisma standard (`YYYYMMDDHHMMSS`) et doit être **postérieur** à la
dernière migration existante pour respecter l'ordre d'application. Comme il n'y a pas de diff de
schéma à inspecter (ERR-038 ne s'applique pas au sens propre — il n'y a pas de drift détecté par
`migrate diff` puisque `migrate diff` n'est pas utilisé ici), la relecture manuelle du SQL avant
`migrate deploy` reste néanmoins obligatoire : c'est le seul filet de sécurité, puisqu'aucun outil
Prisma ne génère ni ne valide ce contenu.

### 3.3 Exigences sur toute migration de correctif de données

Une migration de correctif de données a des obligations **supplémentaires** par rapport à une
migration de schéma classique, parce qu'elle s'exécute sur des données réelles hétérogènes selon
l'environnement (prod, staging, dev, nouveau site), alors qu'une migration de schéma s'exécute
d'abord sur une shadow DB vide qui ne révèle jamais ces problèmes (cf. ERR-049 : « la shadow DB
étant vide, les tests de migration ne détectent pas ce problème »).

**a. Idempotence obligatoire.** La migration doit pouvoir être rejouée sur une base déjà corrigée
sans casser ni dupliquer l'effet. Patterns admis :

- `UPDATE ... WHERE <condition « pas encore corrigé »>` — le `WHERE` doit cibler précisément
  l'état incorrect, pas une clé qui matcherait aussi l'état déjà corrigé :
  ```sql
  UPDATE "Bac" SET "nombreActuel" = 348
  WHERE "id" = 'bac_11' AND "nombreActuel" != 348;
  ```
- `INSERT ... ON CONFLICT DO NOTHING` — pour un rattrapage de ligne manquante (ex. un
  `AssignationBac` ou un `Releve` oublié), sur une contrainte unique déjà en place.
- `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM ... WHERE ...)` — pour un rattrapage
  conditionné à l'absence d'une ligne, quand aucune contrainte unique n'existe pour porter un
  `ON CONFLICT`.

**Piège des agrégats dérivés recalculés :** un correctif exprimé comme un **delta relatif** n'est
**jamais** idempotent, même protégé par un `WHERE` :
```sql
-- ANTI-PATTERN — pas idempotent : rejouée une seconde fois, cette ligne soustrait 12 de plus
UPDATE "AssignationBac" SET "nombreActuel" = "nombreActuel" - 12
WHERE "bacId" = 'bac_11';
```
Rejouer cette migration deux fois soustrait 24, pas 12 — le résultat dépend du nombre
d'exécutions, ce qui est la définition même de la non-idempotence. La version idempotente exprime
la **valeur cible absolue**, jamais le delta :
```sql
-- PATTERN CORRECT — idempotent : la valeur finale est la même quel que soit le nombre d'exécutions
UPDATE "AssignationBac" SET "nombreActuel" = 336
WHERE "bacId" = 'bac_11' AND "nombreActuel" != 336;
```
Cette règle généralise à tout champ dérivé recalculé (compteurs, totaux, biomasses) : le correctif
doit toujours écrire la **destination**, jamais une opération relative à l'état courant.

**b. Pas de dépendance à des identifiants qui pourraient ne pas exister sur une autre base.** La
migration doit être un **no-op silencieux** si la ligne visée est absente — un `WHERE` qui ne
matche simplement aucune ligne — jamais une exception qui interromprait `migrate deploy`. Une base
de dev, de test, ou un nouveau site multi-tenant n'a par construction pas les données de
production visées par le correctif (un `id` de vague, de bac, ou de vente spécifique à
l'incident). Ne jamais écrire de correctif qui suppose l'existence d'une ligne précise sans
protéger l'opération par une condition qui échoue proprement en son absence — un simple `UPDATE
... WHERE id = 'x'` qui ne matche rien n'échoue déjà pas en SQL pur (0 ligne affectée n'est pas une
erreur) ; le risque à éviter est plutôt un correctif écrit comme une requête qui **présuppose**
la ligne (par exemple un `SELECT ... INTO STRICT` en PL/pgSQL, qui lève une exception si 0 ou
plusieurs lignes sont retournées) — à réserver strictement au garde-fou de précondition (point d),
jamais au DML du correctif lui-même.

**c. Journalisation de ce qui a été modifié.** La migration doit laisser une trace de son effet
(nombre de lignes touchées, valeurs avant/après). En SQL pur, compatible `migrate deploy`, le
mécanisme concret est un bloc `DO $$ ... RAISE NOTICE ... $$` :
```sql
DO $$
DECLARE
  v_rows_affected INT;
BEGIN
  UPDATE "Bac" SET "nombreActuel" = 348
  WHERE "id" = 'bac_11' AND "nombreActuel" != 348;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RAISE NOTICE '[fix-bac11-phantom-fish] % ligne(s) corrigée(s) sur Bac.nombreActuel (cible: 348)', v_rows_affected;
END $$;
```
**Limite honnête de ce mécanisme :** un `RAISE NOTICE` va dans les **logs** du serveur PostgreSQL
(ou de la sortie de `migrate deploy` selon la configuration du client), **pas dans une table
requêtable**. Il est utile pour une inspection manuelle immédiate après déploiement (confirmer
« 1 ligne corrigée » plutôt que 0 ou 3), mais ne constitue pas un historique durable ni interrogeable
après coup — si les logs tournent ou ne sont pas conservés, la trace disparaît.

**Option pour un historique durable :** une table d'audit dédiée (proche du modèle
`SiteAuditLog` déjà utilisé par le projet — voir ADR-048 section 2 pour son usage comme flux
append-only d'événements rares) dans laquelle la migration insérerait une ligne (`action:
"DATA_FIX_<NOM>"`, `details: { rowsAffected, valeursAvant, valeursApres }`). **Coût de cette
option** : nécessite que `SiteAuditLog.actorId` (NOT NULL) reçoive un acteur — pour une migration
exécutée par le pipeline de déploiement, sans utilisateur humain identifié, il faudrait soit un
utilisateur système dédié (cf. `docs/decisions/010-system-user.md`), soit une exception à la
contrainte NOT NULL pour ce cas précis. Ce coût est jugé disproportionné pour un mécanisme qui
reste, par nature, rare et ponctuel — la recommandation de cet ADR est le bloc `RAISE NOTICE`
comme mécanisme par défaut, avec la table d'audit en option seulement si un correctif futur exige
une preuve d'exécution durable et interrogeable (par exemple à des fins d'audit externe ou de
conformité).

**d. Échec avant modification plutôt qu'au milieu.** Si une précondition n'est pas remplie, la
migration doit échouer **tôt**, avant toute écriture, avec un message qui **nomme les données
fautives** — jamais un échec silencieux ni une erreur de contrainte opaque à mi-parcours :
```sql
DO $$
DECLARE
  v_doublons TEXT;
BEGIN
  SELECT string_agg(numero, ', ') INTO v_doublons
  FROM "Vente"
  GROUP BY "siteId", "numero"
  HAVING COUNT(*) > 1;

  IF v_doublons IS NOT NULL THEN
    RAISE EXCEPTION 'Précondition non satisfaite : numéros de vente en doublon avant migration : %', v_doublons;
  END IF;
END $$;

-- Le DML du correctif ne s'exécute qu'après ce garde-fou, dans la même migration.
```
C'est exactement le rôle du « garde-fou de migration » de la taxonomie (3.1) : il vit dans le
même fichier `migration.sql` que le correctif qu'il protège, jamais dans un script séparé exécuté
en amont par un humain.

## 4. Conséquences

- **Ce qui devient interdit :** créer un fichier `.sql` de correctif de données à la racine de
  `prisma/migrations/` (inerte, jamais lu par Prisma) ; exécuter manuellement un script de
  correctif de données contre une base de production sans passer par `migrate deploy` (cas
  `gd3-apply.sh`) ; écrire un correctif de données non idempotent (delta relatif, `INSERT` sans
  protection de doublon) ; faire dépendre une migration d'une action humaine préalable
  (script de vérification à lancer « avant »).
- **Ce qui change pour l'équipe :** tout correctif de données production suit désormais
  exactement le même chemin de déploiement que tout changement de schéma — création manuelle du
  dossier de migration (section 3.2, car `migrate diff` ne produit rien pour un DML pur),
  relecture du SQL avant `migrate deploy`, exécution via `migrate deploy`. Aucun geste hors de ce
  pipeline n'est plus acceptable pour modifier des données de production.
- **Cas d'un correctif déjà appliqué manuellement à la main :** deux chemins sont possibles pour
  faire concorder l'historique Prisma avec la réalité de la base — `prisma migrate resolve
  --applied <nom>` (marque la migration comme déjà exécutée sans la rejouer) versus écrire quand
  même une migration idempotente qui ne fera rien de plus si elle est rejouée (le `WHERE ...
  != <valeur cible>` ne matchera plus aucune ligne). **Cette décision n'est pas tranchée par le
  présent ADR** — elle appartient à la story MG.3, qui traite spécifiquement le sort des quatre
  correctifs orphelins et du correctif `gd3-*` du Bac 11, et qui dispose du contexte précis
  (état réel de chaque base cible, déterminé par MG.2) pour choisir entre les deux options au cas
  par cas.
- **Garde-fou anti-récidive (story MG.6) :** un test de garde interdira la présence de tout
  fichier `.sql` à la racine de `prisma/migrations/` (en dehors des sous-dossiers de migration
  standard), et vérifiera qu'aucun ajout sous `scripts/data-fixes/` ne constitue un correctif de
  données sans migration correspondante. La règle sera également inscrite dans `CLAUDE.md` et
  `docs/knowledge/ERRORS-AND-FIXES.md` (hors périmètre du présent document — story MG.6).
- **Impact sur les audits en lecture seule existants** (`su12-audit-doublons-numero.ts`,
  `px-audit-signatures-corrompues.ts`) : leur sort n'est pas tranché ici — voir story MG.5, qui
  vérifie spécifiquement qu'aucun des deux ne porte de correctif déguisé (cf. critère de
  qualification 3.1) avant de statuer sur leur maintien.

## 5. Règles opérationnelles (résumé actionnable)

1. Avant d'écrire un script pour corriger des données de production, se poser la question : *ce
   script écrit-il quelque chose ?* Si oui → migration Prisma versionnée, jamais un script
   exécuté à la main. Si non (SELECT pur) → un script d'audit peut rester un script, hors
   `prisma/migrations/`.
2. Toute migration de correctif de données doit être : idempotente (valeur cible absolue, jamais
   un delta relatif), tolérante à l'absence de la ligne visée (no-op silencieux, jamais une
   exception sur son propre DML), journalisée (`RAISE NOTICE` a minima), et protégée par un
   garde-fou de précondition qui échoue **avant** toute écriture s'il détecte un état inattendu,
   en nommant les données fautives.
3. Le garde-fou de précondition vit **dans** le fichier `migration.sql`, jamais dans un script
   séparé qu'un humain devrait lancer avant.
4. Pour un correctif de données pur (sans changement de `schema.prisma`), le dossier de migration
   et son `migration.sql` sont créés **à la main** (`migrate diff` ne produit rien dans ce cas) —
   puis déployés par la commande standard `migrate deploy`.
5. Un correctif déjà appliqué manuellement en production ne dispense pas d'écrire la migration
   correspondante — la réconciliation de l'historique (`migrate resolve --applied` vs migration
   idempotente qui ne fera rien) est un choix au cas par cas, tranché par MG.3 pour les correctifs
   existants, et à trancher au cas par cas pour tout futur correctif découvert après application
   manuelle.
