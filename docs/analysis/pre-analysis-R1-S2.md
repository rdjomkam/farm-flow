# Pré-analyse R1-S2 — Modification d'enums existants (StatutReproducteur +2, TypeReleve +TRI, TypeAlerte +5)
**Date :** 2026-04-07
**Story :** R1-S2 — Modifier enums existants
**Auteur :** @pre-analyst

---

## Statut : GO AVEC RÉSERVES

---

## Résumé

Les 3 enums à modifier existent dans `prisma/schema.prisma` et `src/types/models.ts`. Aucune des valeurs à ajouter n'existe déjà. La stratégie de migration RECREATE est obligatoire pour les 3 enums (ERR-001). L'impact le plus large concerne `TypeReleve` : 12+ fichiers source utilisent des `Record<TypeReleve, ...>` exhaustifs qui nécessiteront une mise à jour TypeScript synchronisée. `TypeAlerte` est similaire avec 3 mappings exhaustifs dans les composants d'alertes. `StatutReproducteur` a le périmètre d'impact le plus restreint mais les composants UI utilisent un `Record<StatutReproducteur, string>` strict qui cassera à la compilation.

---

## Vérifications effectuées

### Schema — État actuel des 3 enums : CONFORME

**`StatutReproducteur`** (prisma/schema.prisma lignes 441-445, models.ts lignes 1009-1013)
- Valeurs actuelles : `ACTIF`, `REFORME`, `MORT`
- Valeurs à ajouter : `EN_REPOS`, `SACRIFIE`
- Aucune de ces valeurs n'existe dans le schéma actuel.

**`TypeReleve`** (prisma/schema.prisma lignes 20-28, models.ts lignes 152-161)
- Valeurs actuelles : `BIOMETRIE`, `MORTALITE`, `ALIMENTATION`, `QUALITE_EAU`, `COMPTAGE`, `OBSERVATION`, `RENOUVELLEMENT`
- Valeur à ajouter : `TRI`
- `TRI` existe dans `TypeActivite` (lignes 255-267 du schéma) mais PAS dans `TypeReleve` — ce sont deux enums distincts, aucun conflit.

**`TypeAlerte`** (prisma/schema.prisma lignes 232-247, models.ts lignes 1153-1174)
- Valeurs actuelles : 13 valeurs (MORTALITE_ELEVEE, QUALITE_EAU, STOCK_BAS, RAPPEL_ALIMENTATION, RAPPEL_BIOMETRIE, PERSONNALISEE, BESOIN_EN_RETARD, DENSITE_ELEVEE, RENOUVELLEMENT_EAU_INSUFFISANT, AUCUN_RELEVE_QUALITE_EAU, DENSITE_CRITIQUE_QUALITE_EAU, ABONNEMENT_RAPPEL_RENOUVELLEMENT, ABONNEMENT_ESSAI_EXPIRE)
- Valeurs à ajouter : `MALES_STOCK_BAS`, `FEMELLE_SUREXPLOITEE`, `CONSANGUINITE_RISQUE`, `INCUBATION_ECLOSION`, `TAUX_SURVIE_CRITIQUE_LOT`
- Aucune de ces 5 valeurs n'existe dans le schéma actuel.

### Schema — Stratégie de migration (ERR-001) : RECREATE OBLIGATOIRE

ERR-001 interdit `ALTER TYPE ... ADD VALUE` suivi d'un `UPDATE` dans la même transaction. La règle du projet (ERRORS-AND-FIXES.md) impose systématiquement l'approche RECREATE pour les modifications d'enums existants.

Cependant, pour R1-S2 spécifiquement, aucune valeur n'est SUPPRIMÉE — uniquement des AJOUTS. ERR-001 concerne l'impossibilité d'utiliser une valeur nouvellement ajoutée dans la même transaction. ERR-049 concerne les suppressions avec données existantes.

**Analyse du risque réel :**
- `StatutReproducteur` : table `Reproducteur` existe avec données seed. Les valeurs actuelles (`ACTIF`, `REFORME`, `MORT`) sont conservées. Aucun CAST vers une valeur supprimée. ADD VALUE serait techniquement safe ici — mais le projet impose RECREATE par règle générale.
- `TypeReleve` : table `Releve` existe avec données seed. Aucune ligne n'utilise `TRI` (valeur inexistante aujourd'hui). CAST safe.
- `TypeAlerte` : table `Notification` et `ConfigAlerte` existent avec données seed. Aucune ligne n'utilise les 5 nouvelles valeurs. CAST safe.

**Décision : utiliser RECREATE pour les 3 enums** conformément à la politique du projet. Créer 3 migrations distinctes ou une migration avec 3 blocs RECREATE clairement séparés.

### Données seed — Impact sur le CAST : OK (SAFE)

Fichier `prisma/seed.sql` analysé :
- `StatutReproducteur` : 3 reproducteurs avec `'ACTIF'`, 1 avec `'REFORME'`. Aucun `EN_REPOS` ni `SACRIFIE`. CAST safe.
- `TypeReleve` : relevés avec `'MORTALITE'`, `'ALIMENTATION'`, `'BIOMETRIE'`, etc. Aucun `TRI`. CAST safe.
- `TypeAlerte` : `ConfigAlerte` et `Notification` avec `'MORTALITE_ELEVEE'` uniquement. Aucune des 5 nouvelles valeurs. CAST safe.

### TypeScript — Impact sur Record<TypeReleve, ...> : PROBLÈMES À ANTICIPER

L'ajout de `TRI` à `TypeReleve` rendra exhaustifs ces 12 mappings TypeScript incomplets à la compilation :

| Fichier | Ligne | Type de mapping |
|---------|-------|-----------------|
| `src/lib/export/pdf-rapport-vague.tsx` | 39 | `Record<TypeReleve, string>` |
| `src/lib/export/excel-releves.ts` | 26 | `Record<TypeReleve, string>` |
| `src/components/vagues/releves-list.tsx` | 32 | `Record<TypeReleve, "info" | "warning" | "default">` |
| `src/components/releves/releves-global-list.tsx` | 16 | `Record<TypeReleve, "info" | "warning" | "default">` |
| `src/components/planning/planning-client.tsx` | 50 | `Record<TypeReleve, string>` |
| `src/app/api/releves/route.ts` | ~234 | `switch(typeReleve)` sans cas `TRI` |
| `src/hooks/use-releve-form.ts` | ~105 | `switch(typeReleve)` sans cas `TRI` |
| `src/components/releves/modifier-releve-dialog.tsx` | ~138 | `switch(typeReleve)` sans cas `TRI` |
| `src/components/releves/releve-details.tsx` | ~17 | `switch(typeReleve)` sans cas `TRI` |
| `src/services/releve.service.ts` | ~58 | accès conditionnel sur `typeReleve` |
| `src/lib/releve-search-params.ts` | ~165 | accès conditionnel sur `typeReleve` |

Ces fichiers ne cassent pas forcément à la compilation (switch sans default ne force pas l'exhaustivité), mais les `Record<TypeReleve, ...>` avec type exact casseront si TypeScript strict est activé. Un build check est nécessaire après mise à jour de l'enum.

### TypeScript — Impact sur Record<TypeAlerte, ...> : PROBLÈMES À ANTICIPER

L'ajout des 5 valeurs à `TypeAlerte` rendra incomplets ces mappings exhaustifs :

| Fichier | Mappings exhaustifs à mettre à jour |
|---------|-------------------------------------|
| `src/components/alertes/notifications-list-client.tsx` | `typeAlerteTranslationKeys`, `typeAlerteIcons`, `typeAlerteColors` (3 Records complets) |
| `src/components/alertes/alertes-config-client.tsx` | mapping de configuration par type d'alerte |
| `src/lib/ingenieur/alerte-helpers.ts` | 2 mappings (labels et "critique"/"attention"/"info") |
| `src/lib/alertes.ts` | switch/case par type d'alerte |
| `src/lib/activity-engine/generator.ts` | switch/case de génération |

### TypeScript — Impact sur StatutReproducteur : PROBLÈMES À ANTICIPER

Deux composants UI utilisent `Record<StatutReproducteur, string>` qui cassera à la compilation TypeScript :

| Fichier | Ligne | Impact |
|---------|-------|--------|
| `src/components/alevins/reproducteurs-list-client.tsx` | 85 | `Record<StatutReproducteur, string>` avec 3 clés — cassera avec 5 clés |
| `src/components/alevins/reproducteur-detail-client.tsx` | 91 | `Record<StatutReproducteur, string>` avec 3 clés — cassera avec 5 clés |

Les switch/case dans ces fichiers (lignes 38-40) devront aussi être étendus.

### Migrations existantes — Conflit de nommage : OK

Les migrations récentes (jusqu'à `20260421010000_add_reproduction_enums`) n'ajoutent pas ces valeurs. La migration R1-S1 crée bien 12 nouveaux enums (CREATE TYPE) et ne modifie pas les 3 enums concernés par R1-S2. Pas de duplication.

### ERR-038 (dérive de schéma) : À VÉRIFIER

Avant de générer le SQL, exécuter :
```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > /tmp/check-drift.sql
```
Inspecter le fichier pour détecter toute dérive non liée à la story.

---

## Incohérences trouvées

1. **`src/types/models.ts` désynchronisé après R1-S2** — Les 3 enums TypeScript ne contiendront pas les nouvelles valeurs tant que models.ts n'est pas mis à jour manuellement. Les fichiers build en dépendant (Record<TypeReleve,...>, etc.) produiront des erreurs TypeScript. La mise à jour de models.ts DOIT accompagner la migration SQL dans le même commit.
   - Fichiers concernés : `/Users/ronald/project/dkfarm/farm-flow/src/types/models.ts`, `/Users/ronald/project/dkfarm/farm-flow/src/types/index.ts`

2. **`src/types/api.ts` ligne 1261 — `ACTIVITE_RELEVE_TYPE_MAP`** — Ce mapping est `Partial<Record<TypeActivite, TypeReleve>>` donc non-exhaustif : il n'est pas obligatoire d'ajouter `TypeActivite.TRI -> TypeReleve.TRI` immédiatement. Cependant, ADR-044 implique que les activités de tri seront associées à des relevés TRI. La mise à jour de ce mapping devrait être planifiée dans la story UI correspondante.
   - Fichier : `/Users/ronald/project/dkfarm/farm-flow/src/types/api.ts` ligne 1261

3. **`src/components/alertes/notifications-list-client.tsx` — 3 Records exhaustifs** — Les 3 Records `typeAlerteTranslationKeys`, `typeAlerteIcons`, `typeAlerteColors` sont `Record<TypeAlerte, ...>` complets. L'ajout de 5 valeurs cassera la compilation TypeScript si strict est activé. Ces entrées doivent être ajoutées AVANT le prochain build.
   - Fichier : `/Users/ronald/project/dkfarm/farm-flow/src/components/alertes/notifications-list-client.tsx` lignes 30-84

---

## Risques identifiés

1. **Erreurs de compilation TypeScript en cascade** — L'ajout de `TRI` à `TypeReleve` et de 5 valeurs à `TypeAlerte` impacte des Records exhaustifs dans des composants existants. Si models.ts est mis à jour sans que ces composants soient simultanément mis à jour, le build échouera. Ce risque doit être géré en un seul commit cohérent.
   - Impact : build cassé entre la mise à jour de models.ts et la mise à jour des composants.
   - Mitigation : mettre à jour models.ts ET tous les Records affectés dans le même commit.

2. **RECREATE sur `TypeReleve` — table `Releve` très active** — La table `Releve` est la plus utilisée du projet (119 fichiers). Un CAST sur cette table est plus risqué qu'un CAST sur `Reproducteur` (18 fichiers). En production, une migration RECREATE sur `TypeReleve` est une opération longue si la table contient beaucoup de lignes. En dev/test, aucun risque.
   - Impact : migration lente en prod avec beaucoup de données.
   - Mitigation : tester la migration sur la base de dev avant déploiement prod.

3. **`StatutReproducteur.EN_REPOS` vs `StatutReproducteur.REFORME`** — La sémantique des deux statuts est proche. Les composants `reproducteurs-list-client.tsx` et `reproducteur-detail-client.tsx` gèrent déjà la logique de tabs (ACTIF / REFORME) basée sur des conditions `statut === StatutReproducteur.ACTIF`. Après l'ajout de `EN_REPOS` et `SACRIFIE`, la logique d'affichage dans les tabs pourrait devenir ambiguë si non traitée.
   - Impact : UX dégradée si `EN_REPOS` n'est pas inclus dans le bon tab.
   - Mitigation : ce risque appartient aux stories UI — la story R1-S2 n'a pas à corriger cela, mais le @developer doit en être informé.

---

## Prérequis manquants

1. **R1-S1 doit être DONE** — La migration `20260421010000_add_reproduction_enums` doit être appliquée en base avant de créer la migration R1-S2. Statut actuel selon TASKS.md : R1-S1 est marquée DONE selon la présence du fichier de migration. A vérifier que la migration est effectivement déployée sur la base de dev Docker.

2. **Inspection du drift préalable** — Exécuter `npx prisma migrate diff` pour détecter toute dérive avant de créer les nouvelles migrations.

---

## Stratégie de migration recommandée

### Option A — 3 migrations séparées (recommandée)

Créer 3 fichiers de migration distincts pour isoler les risques :

```
20260421020000_add_statut_reproducteur_en_repos_sacrifie/migration.sql
20260421030000_add_type_releve_tri/migration.sql
20260421040000_add_type_alerte_reproduction/migration.sql
```

Chaque migration applique le pattern RECREATE :
```sql
-- Exemple pour StatutReproducteur
ALTER TYPE "StatutReproducteur" RENAME TO "StatutReproducteur_old";
CREATE TYPE "StatutReproducteur" AS ENUM ('ACTIF', 'REFORME', 'MORT', 'EN_REPOS', 'SACRIFIE');
ALTER TABLE "Reproducteur"
  ALTER COLUMN "statut" TYPE "StatutReproducteur"
  USING "statut"::text::"StatutReproducteur";
DROP TYPE "StatutReproducteur_old";
```

**Avantages :** isolation des problèmes, rollback granulaire possible, lisibilité.

### Option B — 1 migration avec 3 blocs RECREATE

Un seul fichier de migration avec des commentaires clairs séparant les 3 blocs RECREATE. Acceptable si le @db-specialist préfère minimiser le nombre de migrations.

**Inconvénient :** une erreur dans le 3ème RECREATE rollback toute la migration.

### Option C — ADD VALUE direct (NON recommandée)

`ALTER TYPE ... ADD VALUE 'EN_REPOS'` sans UPDATE ni RECREATE. Techniquement valide pour un ADD seul dans une transaction dédiée, MAIS la politique du projet interdit cette approche (ERR-001). Ne pas utiliser.

---

## Recommandation

**GO** — Les 3 enums sont bien identifiés, les nouvelles valeurs ne conflictent pas avec l'existant, les données seed ne contiennent aucune valeur qui casserait le CAST.

Conditions de démarrage :
1. Confirmer que R1-S1 est déployé en base Docker (`docker exec silures-db psql -U dkfarm -d farm-flow -c "\dT+ \"ModeGestionGeniteur\""`)
2. Exécuter le check de drift avant de générer les migrations
3. Utiliser 3 migrations RECREATE séparées (Option A)
4. Mettre à jour `src/types/models.ts` en synchrone avec les migrations SQL
5. Mettre à jour TOUS les `Record<TypeReleve, ...>`, `Record<TypeAlerte, ...>`, `Record<StatutReproducteur, ...>` dans les composants et lib affectés
6. Vérifier `npm run build` après mise à jour de models.ts pour détecter les Records exhaustifs incomplets
