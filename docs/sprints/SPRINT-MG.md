# Sprint MG — Tout correctif de données est une migration

**Statut** : FAIT
**Lancé le** : 2026-07-26
**Review** : VALIDÉ AVEC RÉSERVES ([review-sprint-MG.md](../reviews/review-sprint-MG.md)) — aucun constat
Critique ni Haut, rien de bloquant pour le déploiement.
**Vérification finale (R9)** : `npm run build` vert ; `npx vitest run` → **5703 tests passés sur 5749**
(223 fichiers). Les 6 échecs sont des **timeouts de contention préexistants** au sens ERR-107,
confirmés verts en ré-exécution isolée (**104/104**).
**Origine** : quatre correctifs de données de production commités à la racine de
`prisma/migrations/` (commit `c259b48`), donc jamais lus ni exécutés par `migrate deploy` —
`fix-vague2601-phantom-fish.sql`, `fix-bes033-cmd015-duplicate.sql`,
`fix-calibrage-may14-missing-biometrie.sql`, `fix-vte004-missing-vagueid.sql` — et un correctif
équivalent appliqué **manuellement** en production hors de tout mécanisme de migration
(`scripts/data-fixes/gd3-vague-26-03-prep-transferts.sql` + `gd3-apply.sh`, incident Bac 11 /
Vague-26-03-Prep, cf. ADR-048). Décision de l'utilisateur à formaliser : « Tout correctif de
données doit être déployé comme une migration Prisma versionnée, jamais comme un script exécuté
à la main. »

**ADR** : [ADR-049-correctifs-donnees-migrations.md](../decisions/ADR-049-correctifs-donnees-migrations.md)

## Objectif

Établir et faire appliquer la règle : aucun correctif de données ne doit jamais rester un script
inerte ou un geste manuel non tracé. Ce sprint couvre à la fois la formalisation de la règle
(ADR), le diagnostic exact des correctifs déjà en circulation, leur conversion effective en
migrations idempotentes, la fiabilisation de deux migrations existantes qui dépendent aujourd'hui
d'une résolution manuelle de doublons, le tri des scripts d'audit existants, et un garde-fou
automatisé anti-récidive.

## Stories

| Story | Type | Sujet | Pipeline | Statut |
|-------|------|-------|----------|--------|
| MG.1 | ADR | Établir la règle : tout correctif de données est une migration Prisma versionnée | `@architect (seul)` | **FAIT** |
| MG.2 | ANALYSE | Statut réel des 4 correctifs orphelins (état produit par lecture du SQL, requête de diagnostic par base) | `@pre-analyst → agent assigné → @code-reviewer` (type non formalisé dans PROCESSES.md — pipeline ANALYSE proposé, calqué sur BUGFIX sans étape de fix) | **FAIT** |
| MG.3 | SCHEMA | Convertir les 4 correctifs orphelins + `gd3-*` (Bac 11) en migrations idempotentes ; supprimer les fichiers inertes et le script shell | `@pre-analyst → @db-specialist → @code-reviewer → @knowledge-keeper` | **FAIT** |
| MG.4 | SCHEMA | Rendre auto-suffisantes `20260726174843_numero_unique_par_site` et `20260726212515_lotalevins_code_unique_par_site` (résolution déterministe des doublons ou échec avant modification) | `@pre-analyst → @db-specialist → @code-reviewer → @knowledge-keeper` | **FAIT** |
| MG.5 | ANALYSE/DOC | Sort de `su12-audit-doublons-numero.ts` et `px-audit-signatures-corrompues.ts` (aucun correctif déguisé ? MG.4 rend-il le premier facultatif ? trancher le second) | `@pre-analyst → agent assigné → @code-reviewer` (type non formalisé — pipeline ANALYSE/DOC proposé) | **FAIT** |
| MG.6 | TEST | Garde-fou : `.sql` interdit à la racine de `prisma/migrations/`, correctif sous `scripts/data-fixes/` sans migration correspondante détecté ; règle inscrite dans `CLAUDE.md` et `docs/knowledge/ERRORS-AND-FIXES.md` | `@tester (seul, ou + @developer si fix nécessaire)` | **FAIT** |
| MG.7 | BUGFIX | Un échec de `prisma migrate deploy` doit bloquer le démarrage du conteneur | `@developer` | **FAIT** |

### Livrables par story

| Story | Livrable(s) |
|-------|-------------|
| MG.1 | [ADR-049-correctifs-donnees-migrations.md](../decisions/ADR-049-correctifs-donnees-migrations.md) |
| MG.2 | [MG2-statut-correctifs-orphelins.md](../analysis/MG2-statut-correctifs-orphelins.md) |
| MG.3 | 5 migrations : `20260727090001_data_fix_vague2601_phantom_fish`, `20260727090002_data_fix_bes033_cmd015_duplicate`, `20260727090003_data_fix_calibrage_may14_missing_biometrie`, `20260727090004_data_fix_vte004_missing_vagueid`, `20260727090005_data_fix_gd3_vague2603_prep_transferts` ; fichiers inertes et `gd3-apply.sh` supprimés |
| MG.4 | `20260727090006_unicite_numero_par_site_autosuffisante` (nouvelle migration de durcissement). Les deux migrations existantes n'ont **volontairement PAS** été éditées, pour ne pas casser leur checksum Prisma alors que leur statut en production est inconnu. |
| MG.5 | [ADR-050-sort-des-scripts-audit.md](../decisions/ADR-050-sort-des-scripts-audit.md) — les deux scripts d'audit sont confirmés **strictement en lecture seule** et déplacés vers `scripts/audits/` |
| MG.6 | `src/__tests__/mg6-correctif-donnees-guard.test.ts` (18 tests), règle **R10** dans `CLAUDE.md`, **ERR-109 à ERR-112** dans `docs/knowledge/ERRORS-AND-FIXES.md` |
| MG.7 | `docker-entrypoint.sh` |

## Dépendances entre stories

- MG.1 (ce document + l'ADR) ne dépend de rien — type ADR, peut être parallélisé avec tout le
  reste (règle explicite de `docs/PROCESSES.md` : « Type `ADR` peut être parallélisé avec
  n'importe quoi »).
- MG.2 ne dépend pas de MG.1 pour être *exécutée* (c'est une lecture factuelle du SQL existant),
  mais ses conclusions doivent être interprétées à la lumière de la taxonomie de l'ADR (correctif
  de données vs audit vs garde-fou) — à mener après lecture de l'ADR.
- MG.3 dépend de MG.2 (il faut connaître l'état réel de chaque correctif avant de choisir entre
  `migrate resolve --applied` et migration idempotente qui ne fera rien, cf. ADR-049 section 4).
- MG.4 est indépendante de MG.2/MG.3 (concerne deux migrations différentes, déjà sous
  `prisma/migrations/`, pas les 4 correctifs orphelins) — peut être menée en parallèle.
- MG.5 dépend de MG.4 (la question « MG.4 rend-il `su12-audit-doublons-numero.ts` facultatif ? »
  ne peut être tranchée qu'une fois MG.4 close) et bénéficie de la taxonomie de l'ADR (MG.1) pour
  qualifier si l'un des deux scripts porte un correctif déguisé.
- MG.6 dépend de MG.3 (les fichiers inertes doivent être supprimés avant qu'un test de garde
  puisse vérifier qu'il n'y en a plus) et de la règle formalisée par MG.1 pour rédiger la
  documentation (`CLAUDE.md`, `ERRORS-AND-FIXES.md`).

## Notes de méthode

- Les types `ANALYSE` et `ANALYSE/DOC` ne sont pas des types formalisés dans
  `docs/PROCESSES.md` (qui liste SCHEMA, TYPES, ADR, QUERIES, API, UI, INTEGRATION, BUGFIX,
  REFACTOR, TEST, REVIEW). Le pipeline proposé ci-dessus pour MG.2 et MG.5 est calqué sur le
  pipeline `BUGFIX` en retirant l'étape de correction (ces stories ne modifient aucun code, elles
  produisent un diagnostic et une recommandation) — à confirmer ou ajuster par @project-manager
  avant le lancement de ces stories.
- Aucune modification de code, de migration, de test ni de base de données n'a été effectuée par
  MG.1 : cette story est strictement documentaire (ADR + présent fichier de suivi).

## Ce que l'utilisateur devra exécuter en production

1. Déployer normalement (`npx prisma migrate deploy`, ou le redémarrage du conteneur qui l'exécute
   via `docker-entrypoint.sh`). Prévenir l'équipe d'exploitation qu'un échec de migration bloque
   désormais le démarrage du conteneur — c'est volontaire.
2. Les 6 migrations s'appliquent dans l'ordre `20260727090001` → `20260727090006`. **Aucune action
   manuelle préalable n'est requise** : c'est l'objet du sprint.
3. Après déploiement, relire les `RAISE NOTICE` dans les logs pour savoir combien de lignes chaque
   correctif a réellement touchées (0 = déjà appliqué ou non concerné ; >0 = corrigé à ce
   déploiement).
4. Si `20260727090006` lève une exception (doublons `(siteId, numero|code)` détectés) : aucune
   écriture n'a eu lieu, la transaction a été annulée. Dédupliquer manuellement selon le message,
   qui nomme les lignes fautives — ne jamais renuméroter automatiquement un identifiant déjà
   communiqué à un tiers — puis relancer `migrate deploy`.
5. Optionnel, avant déploiement : exécuter les requêtes en lecture seule de
   [MG2-statut-correctifs-orphelins.md](../analysis/MG2-statut-correctifs-orphelins.md) pour
   connaître l'état des 5 correctifs orphelins en production.
6. Hors périmètre technique mais recommandé : faire tourner le mot de passe PostgreSQL de
   production, exposé en clair dans `scripts/data-fixes/gd3-apply.sh` et donc toujours présent dans
   l'historique git même après suppression du fichier.

## Dette laissée ouverte

- **9 correctifs de données orphelins historiques non convertis**, tolérés par une liste
  d'exclusion datée et justifiée dans le test de garde : `prisma/fix-vague-26-01.sql`,
  `scripts/fix-missing-mouvements.sql`, `scripts/fix-depense-mouvement-link.sql`,
  `scripts/repair-bug041.sql`, et sous `prisma/data-fixes/` : `CG2-bacdest-null.sql`,
  `CG4-assignation-dates.sql`, `CS1-init-fields-prod.sql`, `CS2-mirror-transfert-releves.sql`,
  `GP3-cleanup-nan-gompertz.sql`. Leur état d'application en production est **inconnu**, ils n'ont
  donc pas été convertis à l'aveugle. À solder par un sprint dédié.
- `Vague.code` et `Reproducteur.code` restent en `@unique` **global** au lieu de
  `@@unique([siteId, code])` : à trancher (scoper par site, ou assumer et documenter). Constat
  **M1** de la review.
- Enrichir le `RAISE NOTICE` de `20260727090001` d'un renvoi à **ADR-043** (constat **B1**,
  cosmétique).

## Story MG.1 — Détail

**Type** : ADR
**Agent** : @architect
**Statut** : FAIT

Livrable : [ADR-049-correctifs-donnees-migrations.md](../decisions/ADR-049-correctifs-donnees-migrations.md).

Contenu :
- Taxonomie en trois catégories (correctif de données / audit en lecture seule / garde-fou de
  migration), avec critère de qualification strict pour l'audit (zéro écriture).
- Exigences obligatoires sur toute migration de correctif de données : idempotence (valeur cible
  absolue, jamais un delta relatif), tolérance à l'absence de la ligne visée (no-op silencieux,
  jamais une exception), journalisation (`RAISE NOTICE`, avec option table d'audit et son coût
  explicité), échec avant modification en cas de précondition non remplie (message nommant les
  données fautives).
- Contrainte technique du projet documentée : `migrate diff` ne produit rien pour un DML pur
  (aucun changement de `schema.prisma`) — le dossier de migration et son `migration.sql` doivent
  être créés à la main pour un correctif de données (cf. ERR-002).
- Conséquences : interdictions actées, non-tranchage volontaire du cas des correctifs déjà
  appliqués manuellement (renvoyé à MG.3 : `migrate resolve --applied` vs migration idempotente
  qui ne fera rien), annonce du garde-fou anti-récidive (MG.6).

## Story MG.7 — Détail

**Type** : BUGFIX
**Agent** : @developer
**Statut** : FAIT

Sujet : « Un échec de `prisma migrate deploy` doit bloquer le démarrage du conteneur ».

Livrable : `docker-entrypoint.sh`.

Motif : le script **avalait** l'échec de migration (`|| echo WARNING ... continuing`), ce qui rendait
inopérant tout garde-fou de migration — le conteneur démarrait sur un schéma non migré,
silencieusement. Documenté en **ERR-112**.
