# Pré-analyse R1-S1 — Nouveaux enums Prisma (Reproduction Module)
**Date :** 2026-04-07
**Story :** R1-S1 — Ajout de 12 nouveaux enums au schéma Prisma pour le module Reproduction
**Auteur :** @pre-analyst

---

## Statut : GO AVEC RÉSERVES

---

## Résumé

Les 12 nouveaux noms d'enum sont tous disponibles (aucun conflit avec l'existant). Cependant, ADR-044 implique également deux modifications d'enums existants (`StatutReproducteur` et `TypeReleve`) qui nécessitent chacune une migration RECREATE séparée. Ces deux opérations constituent un risque opérationnel non négligeable qui doit être planifié explicitement avant le début du travail.

---

## Vérifications effectuées

### Schema — Conflits de noms d'enum : OK

Aucun des 12 noms proposés n'existe dans `prisma/schema.prisma` :

| Enum proposé | Présent dans le schéma |
|---|---|
| `ModeGestionGeniteur` | Non |
| `GenerationGeniteur` | Non |
| `SourcingGeniteur` | Non |
| `TypeHormone` | Non |
| `QualiteOeufs` | Non |
| `MethodeExtractionMale` | Non |
| `MotiliteSperme` | Non |
| `CauseEchecPonte` | Non |
| `SubstratIncubation` | Non |
| `StatutIncubation` | Non |
| `PhaseLot` | Non |
| `DestinationLot` | Non |

Aucun des 12 noms ne figure non plus dans `src/types/models.ts`, `src/types/index.ts`, `src/types/api.ts`, ni dans aucun fichier TypeScript du projet.

### Schema — Valeurs d'enum : PROBLÈMES (réserves)

ADR-044 exige, en plus des 12 nouveaux enums, **deux modifications d'enums existants** qui sortent du périmètre déclaré de la story mais sont des prérequis logiques pour les stories suivantes :

1. **`StatutReproducteur`** — ajout de `EN_REPOS` et `SACRIFIE`
   - Enum actuel : `ACTIF`, `REFORME`, `MORT`
   - Enums à ajouter : `EN_REPOS`, `SACRIFIE`
   - Approche requise : **RECREATE** (ERR-001 / ERR-049 — interdiction d'ADD VALUE + UPDATE dans la même transaction)
   - Risque : les données existantes (`ACTIF` en seed) survivent car `ACTIF` est conservé. Migration safe.

2. **`TypeReleve`** — ajout de `TRI`
   - Enum actuel : `BIOMETRIE`, `MORTALITE`, `ALIMENTATION`, `QUALITE_EAU`, `COMPTAGE`, `OBSERVATION`, `RENOUVELLEMENT`
   - `TRI` n'existe **pas** dans `TypeReleve` (il existe dans `TypeActivite` à la ligne 263 du schéma — ce sont deux enums distincts, pas de collision)
   - Approche requise : **RECREATE**
   - Risque : aucune ligne `Releve` en seed n'utilise `TRI`, le CAST est safe.

**Question de périmètre :** La story R1-S1 porte sur les "12 nouveaux enums". Le @db-specialist doit confirmer si les modifications de `StatutReproducteur` et `TypeReleve` sont incluses dans R1-S1 ou planifiées dans une story distincte. Recommandation : les inclure dans R1-S1 car elles sont des dépendances bloquantes des stories R1-S2+ (models).

### Schema — Convention de nommage (R1) : OK

Tous les 12 nouveaux enums respectent la règle R1 (valeurs en UPPERCASE). Le schéma existant utilise uniformément des valeurs UPPERCASE. Pas de dérogation constatée.

### Schema — Mots réservés Prisma/PostgreSQL : OK

Aucun des 12 noms d'enum ni aucune de leurs valeurs ne correspond à un mot réservé PostgreSQL ou Prisma connu (`TABLE`, `INDEX`, `TYPE`, `CREATE`, `DROP`, `ALTER`, `SELECT`, etc.). La valeur `OK` et `KO` dans `MotiliteSperme` sont des identifiants courts sans ambiguïté dans un contexte d'enum PostgreSQL.

### Schema — Chevauchement de valeurs entre enums distincts : OK (non-bloquant)

Les valeurs `G1`, `G2`, `G3_PLUS` dans le futur enum `GenerationGeniteur` ont une apparence similaire à `G1`–`G5` dans `TailleGranule`. En PostgreSQL et Prisma, les valeurs d'enum sont scoped à leur type respectif. Il n'y a aucun conflit technique. Le `G3_PLUS` de `GenerationGeniteur` est distinct de `G3` de `TailleGranule`.

### TypeScript — Cohérence attendue post-R1-S1 : ATTENTION

Après ajout des 12 enums dans `prisma/schema.prisma`, le @db-specialist devra s'assurer que `src/types/models.ts` et `src/types/index.ts` sont mis à jour en synchrone (R2, R3). Ces fichiers ne sont pas auto-générés — ils sont maintenus manuellement. Ce point est un risque d'oubli fréquent.

### ERR-049 (enum RECREATE avec données existantes) : APPLICABLE

La règle ERR-049 s'applique aux modifications de `StatutReproducteur` et `TypeReleve`. Dans les deux cas, les valeurs supprimées (aucune) ou ajoutées ne cassent pas les données existantes en seed — les INSERT seed utilisent uniquement `ACTIF`, `FEMELLE`, `MALE` pour les Reproducteurs, et les types standard pour les Relevés. Le CAST ne rencontrera pas de valeur inconnue.

### ERR-002 (migrate dev non-interactif) : APPLICABLE

Le workflow de migration doit suivre le pattern non-interactif documenté : `migrate diff --script` + création manuelle du dossier + `migrate deploy`. Ne pas utiliser `migrate dev`.

### ERR-038 (dérive de schéma) : À VÉRIFIER

Avant de générer le SQL de migration, le @db-specialist doit inspecter le diff complet pour s'assurer qu'aucune dérive de schéma préexistante n'est mélangée à la migration des nouveaux enums.

---

## Incohérences trouvées

1. **Périmètre incomplet dans l'intitulé de la story** — R1-S1 parle de "12 nouveaux enums" mais ADR-044 §2.1 et §3.1 exige aussi la modification de deux enums existants (`StatutReproducteur` +2 valeurs, `TypeReleve` +1 valeur). Ces modifications sont des prérequis pour les stories de models (R1-S2+). Si elles ne sont pas faites dans R1-S1, les stories suivantes seront bloquées.
   - Fichiers concernés : `prisma/schema.prisma` lignes 441-445 (StatutReproducteur), lignes 20-28 (TypeReleve)
   - Suggestion : inclure explicitement ces deux modifications dans R1-S1, ou créer une story R1-S1b dédiée.

2. **`src/types/models.ts` non auto-synchronisé** — Ce fichier liste manuellement tous les enums (en-tête commentaire ligne 9-11). Après R1-S1, il faudra ajouter les 12+2 nouveaux enums ET mettre à jour le commentaire d'en-tête. Risque de désynchronisation si oublié.
   - Fichier concerné : `/Users/ronald/project/dkfarm/farm-flow/src/types/models.ts`

---

## Risques identifiés

1. **RECREATE de `StatutReproducteur` et `TypeReleve` dans la même migration** — Si le @db-specialist choisit de regrouper les 3 opérations (12 créations + 2 RECREATE) dans une seule migration SQL, la lisibilité et le débogage deviennent complexes. Recommandation : scinder en 2 fichiers de migration — un pour les 12 CREATE ENUM purs, un pour les 2 RECREATE qui touchent des enums existants.
   - Impact : si groupés, une erreur dans le RECREATE bloque toute la migration.
   - Mitigation : migrations séparées ou au minimum des transactions explicites par bloc.

2. **`G0_SAUVAGE` comme valeur d'enum PostgreSQL** — PostgreSQL accepte les underscores et chiffres dans les valeurs d'enum. `G0_SAUVAGE` et `G3_PLUS` sont valides. Pas de risque technique.

3. **`TRI` dans `TypeActivite` vs `TypeReleve`** — Un développeur peut confondre ces deux enums lors de l'utilisation. La valeur `TRI` existera dans deux enums distincts après la migration. Ce n'est pas un problème technique, mais un risque de mauvaise utilisation dans le code applicatif (stories UI/API ultérieures).

---

## Prérequis manquants

1. Clarification du périmètre de R1-S1 : inclure ou non les modifications de `StatutReproducteur` (+`EN_REPOS`, `SACRIFIE`) et `TypeReleve` (+`TRI`). Si non inclus dans R1-S1, créer une story dédiée avant de commencer R1-S2.

---

## Recommandation

**GO** — les 12 nouveaux noms d'enum sont disponibles, conformes à R1 (UPPERCASE), sans conflit avec l'existant, et sans risque de données lors des migrations.

Réserve principale : le @db-specialist doit inclure dans R1-S1 (ou dans une story adjacente bloquante) les 2 modifications d'enums existants requises par ADR-044 (`StatutReproducteur` et `TypeReleve`). Ces modifications doivent utiliser le pattern RECREATE (ERR-001/ERR-049) et le workflow non-interactif (ERR-002).

Ordre recommandé dans le fichier de migration :
1. Créer les 12 nouveaux enums avec `CREATE TYPE ... AS ENUM` (opérations pures, sans toucher l'existant)
2. Migrer `StatutReproducteur` par RECREATE (ajouter EN_REPOS, SACRIFIE)
3. Migrer `TypeReleve` par RECREATE (ajouter TRI)
4. Inspecter le SQL généré avant deploy (ERR-038)
