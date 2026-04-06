# Base de Connaissances — Erreurs et Fixes

> **Ce fichier est lu par tous les agents avant de travailler.**
> Il contient les erreurs passées et comment les éviter.
> Maintenu par @knowledge-keeper.

---

## Catégorie : Schema

### ERR-049 — Suppression de valeur d'enum : CAST échoue si des lignes portent encore l'ancienne valeur
**Sprint :** ADR-032 | **Date :** 2026-04-05
**Sévérité :** Critique
**Fichier(s) :** `prisma/migrations/*/migration.sql`, `prisma/schema.prisma`

**Symptôme :**
La migration RECREATE pour supprimer `GOMPERTZ_BAC` de l'enum `StrategieInterpolation` échoue au moment du `ALTER COLUMN ... USING ... ::new_enum_type` avec une erreur PostgreSQL du type `invalid input value for enum` ou `cannot cast type text to enum`. Les lignes `ConfigElevage` qui contiennent encore la valeur `GOMPERTZ_BAC` font échouer le CAST.

**Cause racine :**
L'approche RECREATE (rename old → create new → cast columns → drop old) presuppose que toutes les lignes existantes portent des valeurs présentes dans le nouvel enum. Si une valeur est supprimée sans avoir d'abord migré les lignes qui la portent, le CAST échoue à l'exécution avec des données réelles (la shadow DB est vide, donc le problème ne se manifeste pas lors du `migrate diff`).

**Fix :**
Ajouter un `UPDATE` qui remplace l'ancienne valeur par sa valeur de remplacement AVANT le CAST, dans la même migration :
```sql
-- 1. Renommer l'ancien type
ALTER TYPE "StrategieInterpolation" RENAME TO "StrategieInterpolation_old";

-- 2. Créer le nouveau type sans la valeur supprimée
CREATE TYPE "StrategieInterpolation" AS ENUM ('LINEAIRE', 'GOMPERTZ_VAGUE');

-- 3. Migrer les données AVANT de caster la colonne
UPDATE "ConfigElevage"
SET "interpolationStrategy" = 'GOMPERTZ_VAGUE'
WHERE "interpolationStrategy"::text = 'GOMPERTZ_BAC';

-- 4. Caster la colonne vers le nouveau type
ALTER TABLE "ConfigElevage"
  ALTER COLUMN "interpolationStrategy"
  TYPE "StrategieInterpolation"
  USING "interpolationStrategy"::text::"StrategieInterpolation";

-- 5. Supprimer l'ancien type
DROP TYPE "StrategieInterpolation_old";
```

**Leçon / Règle :**
Quand une valeur d'enum est supprimée, toujours inclure un `UPDATE` de migration des données existantes vers la valeur de remplacement AVANT l'étape CAST de la colonne. La shadow DB étant vide, les tests de migration ne détectent pas ce problème — il faut anticiper les données de production. Voir aussi ERR-001 pour le pattern RECREATE général.

---

### ERR-038 — migrate diff regroupe la dérive de schéma non liée dans la nouvelle migration
**Sprint :** ADR-029 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `prisma/migrations/*/migration.sql`

**Symptôme :**
Un `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` génère un fichier SQL contenant des colonnes ou tables inattendues — des changements qui n'ont rien à voir avec la feature en cours (par exemple, des `ALTER TABLE` sur des modèles existants déjà en production).

**Cause racine :**
`migrate diff` compare l'état réel de la base (ou shadow DB) au schéma Prisma courant. Si des colonnes ont été ajoutées directement en base (hors migrations : hotfix manuel, script de dev, seed), elles constituent une "dérive" (`drift`) que Prisma détecte et inclut dans le diff suivant. La migration générée mélange alors la feature cible et le rattrapage de dérive.

**Fix :**
1. Toujours inspecter le SQL généré avant de le valider :
   ```bash
   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > /tmp/check.sql
   cat /tmp/check.sql
   ```
2. Si des changements non liés à la feature apparaissent, les séparer dans leurs propres fichiers de migration avant de déployer.
3. En cas de dérive avérée, créer d'abord une migration de "rattrapage" (`fix-drift`) séparée avant la migration de feature.

**Leçon / Règle :**
Ne jamais modifier le schéma de base de données directement (hors migrations Prisma) en dev partagé ou en prod. Toute modification de schéma passe par une migration. Avant tout `migrate deploy`, relire le SQL généré ligne par ligne pour détecter les changements parasites.

---

### ERR-001 — Enums PostgreSQL : ADD VALUE + UPDATE dans la même migration
**Sprint :** 1-2 | **Date :** 2026-03-08
**Sévérité :** Critique
**Fichier(s) :** `prisma/migrations/`

**Symptôme :**
Migration échoue sur la shadow database avec `ADD VALUE` + `UPDATE` dans la même transaction.

**Cause racine :**
PostgreSQL ne permet pas d'utiliser une valeur d'enum ajoutée dans la même transaction.

**Fix :**
Utiliser l'approche RECREATE : renommer l'ancien type → créer le nouveau → caster les colonnes → supprimer l'ancien.

**Leçon / Règle :**
JAMAIS `ADD VALUE` + `UPDATE` dans la même migration. Toujours RECREATE.

---

### ERR-002 — Prisma migrate dev échoue en mode non-interactif
**Sprint :** 1 | **Date :** 2026-03-08
**Sévérité :** Haute
**Fichier(s) :** `prisma/schema.prisma`

**Symptôme :**
`npx prisma migrate dev` attend une réponse interactive (y/n) et échoue sous Claude Code.

**Cause racine :**
L'environnement Claude Code ne supporte pas les prompts interactifs.

**Fix :**
Utiliser `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` pour générer le SQL, créer le dossier de migration manuellement, puis `npx prisma migrate deploy`.

**Leçon / Règle :**
Toujours utiliser le workflow non-interactif pour les migrations Prisma.

---

### ERR-003 — Prisma 7 ESM : seed TypeScript impossible
**Sprint :** 1 | **Date :** 2026-03-08
**Sévérité :** Haute
**Fichier(s) :** `prisma/seed.sql`

**Symptôme :**
Le Prisma Client généré utilise `import.meta.url` (ESM-only). tsx, jiti et Node natif échouent à exécuter les seed files TypeScript.

**Cause racine :**
Le générateur `prisma-client` avec output custom produit du code ESM incompatible avec les runners CJS.

**Fix :**
Utiliser du SQL brut via `docker exec -i silures-db psql -U dkfarm -d farm-flow < prisma/seed.sql`. Script npm : `npm run db:seed`.

**Leçon / Règle :**
Le seed est toujours en SQL brut, jamais en TypeScript.

---

## Catégorie : Code

### ERR-063 — Route export PDF utilise `vague.releves` non listée dans le scope ADR : régression silencieuse
**Sprint :** ADR-038 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/export/vague/[id]/route.ts`, `src/lib/queries/vagues.ts`

**Symptôme :**
Après que `getVagueById()` a été modifiée pour ne plus inclure les relevés (split ADR-038 Partie A), la route `GET /api/export/vague/[id]` continuait d'accéder à `vague.releves` — un champ désormais absent du type de retour. TypeScript n'avait pas détecté l'erreur car le type de retour de `getVagueById()` était inféré, non annoté explicitement. L'export PDF vague aurait produit une erreur runtime en production.

**Cause racine :**
L'ADR-038 listait la route export comme "surface exclue de la pagination" (tableau "Surfaces exclues") — donc non modifiée en apparence. Mais la modification de `getVagueById()` (retrait de l'include relevés) impactait implicitement tous les appelants qui accédaient à `vague.releves`. La route export n'était pas dans le tableau "Impact sur les fichiers" de l'ADR, ce qui a conduit à l'omettre. Le type de retour inféré de la fonction (non annoté `Promise<VagueWithBacs | null>`) n'a pas provoqué d'erreur de compilation car TypeScript ne peut pas signaler l'accès à un champ absent sur un type inféré silencieusement changé.

**Fix :**
1. Annoter explicitement le type de retour de `getVagueById()` en `Promise<VagueWithBacs | null>` — cela fait apparaître l'erreur TypeScript dans tous les appelants qui accèdent à `vague.releves`.
2. Migrer `src/app/api/export/vague/[id]/route.ts` pour charger les relevés séparément : `prisma.releve.findMany({ where: { vagueId: id, siteId } })` — en même temps que l'étape 2 de l'ADR (queries), pas après.

**Leçon / Règle :**
Quand une query est modifiée pour supprimer un champ de son include, annoter immédiatement son type de retour explicitement. Tous les appelants qui accédaient au champ supprimé doivent être auditables via `grep -r "fonctionModifiee" src/`. Un tableau "surfaces exclues" dans un ADR ne suffit pas — chaque exclusion doit être vérifiée contre la liste des appelants pour confirmer qu'elle ne dépend pas du champ retiré.

---

### ERR-062 — Wrapper App Router re-export sans props bloquant la transmission de `searchParams`
**Sprint :** ADR-038 | **Date :** 2026-04-06
**Sévérité :** Moyenne
**Fichier(s) :** `src/app/(farm)/vagues/[id]/releves/page.tsx`, `src/components/pages/vague-releves-page.tsx`

**Symptôme :**
La page `/vagues/[id]/releves` était implémentée comme un re-export simple du composant `VagueRelevesPage` (`export { default } from "@/components/pages/vague-releves-page"`). Quand l'ADR-038 a ajouté la pagination URL (lecture de `searchParams.offset`), le composant ne recevait pas `searchParams` — il n'était pas un Page component App Router et le wrapper ne les transmettait pas. La pagination ne fonctionnait pas : l'offset était toujours 0 quel que soit l'URL.

**Cause racine :**
En Next.js App Router, `searchParams` est uniquement disponible dans les composants qui sont des fichiers Page (`app/.../page.tsx`). Un composant importé depuis `components/` n'y a pas accès directement via les props App Router — il doit les recevoir explicitement depuis le wrapper.

**Fix :**
Modifier le wrapper `src/app/(farm)/vagues/[id]/releves/page.tsx` pour accepter `searchParams` en props et les transmettre au composant :
```typescript
// Avant : re-export simple sans props
export { default } from "@/components/pages/vague-releves-page";

// Après : wrapper explicite avec transmission de searchParams
export default async function Page({ searchParams }: { searchParams: Record<string, string | string[]> }) {
  const { default: VagueRelevesPage } = await import("@/components/pages/vague-releves-page");
  return <VagueRelevesPage searchParams={searchParams} />;
}
```

**Leçon / Règle :**
Un re-export simple (`export { default } from "..."`) est uniquement valide pour les wrappers qui n'ont pas besoin de transmettre des props App Router (`params`, `searchParams`). Dès qu'une page doit lire `searchParams` ou `params` depuis l'URL, le wrapper doit être un composant async explicite qui reçoit ces props et les transmet au composant enfant. La pré-analyse doit vérifier si les wrappers existants sont des re-exports simples avant d'ajouter un besoin de `searchParams`.

---

### ERR-058 — Composant extrait non retiré de la source d'origine (copie fantôme)
**Sprint :** ADR-034 | **Date :** 2026-04-06
**Sévérité :** Moyenne
**Fichier(s) :** `src/components/vagues/releves-list.tsx`, `src/components/releves/releve-details.tsx`

**Symptôme :**
Après extraction de `ReleveDetails` vers `src/components/releves/releve-details.tsx` pour le partage entre `releves-list.tsx` et la nouvelle `RelevesGlobalList`, la définition locale du composant restait dans `releves-list.tsx`. Deux définitions identiques coexistaient — l'une partagée, l'autre orpheline. L'import `memo` de React était également importé inutilement dans `releves-list.tsx` alors que le seul usage de `memo` était la définition locale devenue redondante.

**Cause racine :**
L'étape d'extraction d'un composant comprend deux actions : créer le nouveau fichier partagé ET supprimer la définition locale d'origine. La seconde action a été omise — l'implémenteur s'est concentré sur la création du fichier cible sans supprimer la source.

**Fix :**
Remplacer la définition locale de `ReleveDetails` dans `releves-list.tsx` par un import depuis `@/components/releves/releve-details.tsx`. Retirer `memo` des imports React si c'était son seul usage.

**Leçon / Règle :**
Toute extraction de composant est une opération en deux étapes atomiques : (1) créer le fichier partagé, (2) supprimer la définition locale et la remplacer par un import. La review et les tests doivent vérifier l'absence de copie fantôme avec `grep -r "ComponentName" src/` sur le nom du composant extrait. Si le nom apparaît dans plus d'un fichier de définition, l'extraction est incomplète.

---

### ERR-057 — API endpoint manquant un paramètre de filtre requis par une feature en cours
**Sprint :** ADR-034 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/bacs/route.ts`, `src/lib/queries/bacs.ts`

**Symptôme :**
La page `/releves` avec filtrage avancé devait proposer un sélecteur de bac dynamique : quand une vague est sélectionnée dans les filtres, seuls les bacs de cette vague sont listés. Cela nécessite `GET /api/bacs?vagueId=...`. La route existante ignorait ce paramètre — seul `?libre=true` était géré — ce qui rendait le sélecteur non fonctionnel (listait tous les bacs du site au lieu de ceux de la vague choisie).

**Cause racine :**
L'endpoint `/api/bacs` avait été créé pour un besoin différent (libérer un bac ou assigner une vague). Le besoin de filtrer les bacs par vague n'était apparu que plus tard, lors de la conception du filtrage global des relevés. La route n'avait jamais été étendue pour ce cas d'usage.

**Fix :**
Ajouter la lecture du paramètre `vagueId` dans `route.ts` et étendre `getBacs()` dans `queries/bacs.ts` avec un filtre optionnel `vagueId` : `prisma.bac.findMany({ where: { siteId, ...(vagueId ? { vagueId } : {}) } })`.

**Leçon / Règle :**
Lors de la pré-analyse d'une feature qui consomme des données d'endpoints existants, vérifier explicitement que chaque paramètre de filtre nécessaire est exposé dans la route. Ne pas supposer qu'un endpoint couvre tous les cas de filtrage futurs parce qu'il couvre le cas d'usage initial. Documenter dans l'ADR les extensions d'API requises comme des dépendances bloquantes (D-n) à traiter en priorité.

---

### ERR-056 — Composant UI supposé présent mais absent — bloquant détecté en pré-analyse
**Sprint :** ADR-034 | **Date :** 2026-04-06
**Sévérité :** Moyenne
**Fichier(s) :** `src/components/ui/switch.tsx`, `package.json`

**Symptôme :**
Le wireframe de `RelevesFilterSheet` utilisait un Radix Switch pour le toggle "Relevés modifiés seulement". Ni `src/components/ui/switch.tsx` ni le paquet `@radix-ui/react-switch` n'étaient présents dans le projet. L'implémentation aurait échoué à l'import si la pré-analyse n'avait pas détecté l'absence avant le développement.

**Cause racine :**
L'ADR a été rédigé en supposant la présence d'un composant Switch (présent dans d'autres projets Radix UI standard) sans vérifier son existence réelle dans `src/components/ui/`. La bibliothèque Radix UI est modulaire — chaque composant est une dépendance séparée et doit être installé explicitement.

**Fix :**
La pré-analyse a proposé deux options : installer `@radix-ui/react-switch` ou utiliser une checkbox native (`input type="checkbox"`) stylée Tailwind. La solution retenue a été la checkbox native — pas de nouvelle dépendance, cohérente avec les inputs natifs déjà utilisés pour les dates dans les filtres.

**Leçon / Règle :**
Avant de référencer un composant UI dans un ADR ou une story, vérifier son existence dans `src/components/ui/` ET sa dépendance dans `package.json`. Pour Radix UI en particulier : chaque primitive est un paquet npm distinct (`@radix-ui/react-switch`, `@radix-ui/react-checkbox`, etc.) — la présence d'un composant Radix ne garantit pas la présence d'un autre. La pré-analyse doit lister explicitement les composants requis et leur statut PRESENT/ABSENT.

---

### ERR-055 — Gompertz CLARIAS_DEFAULTS produit des poids absurdes sur vague non calibrée
**Sprint :** ADR-033 fix | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/analytics.ts`, `src/lib/feed-periods.ts`

**Symptôme :**
Sur une vague sans calibrage (`vague.gompertz === null`), le FCR calculé affiche des valeurs aberrantes : des périodes entières ont un gain négatif car le poids estimé au début de la période (43 g) est supérieur au poids estimé en fin de période (pourtant basé sur des biométries réelles de 100 g). Ces périodes à gain négatif sont exclues du calcul FCR, ce qui réduit artificiellement le nombre de périodes exploitables et biaise le résultat.

**Cause racine :**
Lors du passage à "Gompertz systématiquement" (ADR-034 initial), le contexte Gompertz était construit depuis `CLARIAS_DEFAULTS` (`W∞ = 1500 g`, `k = 0.018`, `ti = 95 jours`) quand `vague.gompertz` était absent. Ces paramètres génériques ne correspondent pas à l'élevage réel — ils produisent une courbe qui diverge massivement des mesures terrain (43 g prédit vs 100 g mesuré à J30). Le modèle était donc pire que l'interpolation linéaire pour les vagues non calibrées.

**Fix :**
Ne construire le contexte Gompertz que si un enregistrement calibré existe en base (`vague.gompertz !== null`). Quand `null`, laisser `gompertzCtx = undefined` afin que le système retombe en interpolation linéaire entre les points de biométrie réels :
```typescript
// Avant (incorrect — produit des poids absurdes) :
const gompertzCtx = vague.gompertz
  ? buildGompertzContext(vague.gompertz)
  : buildGompertzContext(CLARIAS_DEFAULTS); // diverge si non calibré

// Après (correct) :
const gompertzCtx = vague.gompertz
  ? buildGompertzContext(vague.gompertz)
  : undefined; // fallback vers interpolation linéaire
```

**Leçon / Règle :**
Les paramètres Gompertz génériques (`CLARIAS_DEFAULTS`) ne peuvent être utilisés comme fallback d'interpolation : ils représentent une population moyenne, pas la vague spécifique en cours d'élevage. Le Gompertz n'est valide que lorsqu'il est ajusté sur les données réelles de la vague (calibrage). Pour toute vague sans calibrage, l'interpolation linéaire entre biométries mesurées est toujours plus précise qu'un modèle générique. Utiliser `CLARIAS_DEFAULTS` dans un calcul de FCR est une source de biais systématique.

---

### ERR-054 — Type `PeriodeAlimentaireVague` créé avec `bacId` malgré la spec ADR
**Sprint :** ADR-033 discrepancies | **Date :** 2026-04-06
**Sévérité :** Moyenne
**Fichier(s) :** `src/types/calculs.ts`

**Symptôme :**
L'interface `PeriodeAlimentaireVague` — censée représenter une période d'alimentation au niveau vague (sans distinction par bac) — contient un champ `bacId: string`. Les fonctions qui consomment ce type peuvent alors filtrer ou grouper par bac, réintroduisant exactement le comportement per-bac que l'ADR cherchait à éliminer. La pré-analyse détecte cette incohérence avant que des bugs ne soient causés en production.

**Cause racine :**
L'interface a été créée lors d'un premier pass d'implémentation ADR-033 en copiant la structure de `PeriodeAlimentaire` (per-bac) sans supprimer le champ `bacId`. La spec ADR-033 §3.1 stipule explicitement que `PeriodeAlimentaireVague` n'a pas de `bacId` — mais le développeur n'a pas relu la spec au moment de créer l'interface. Le champ en trop est passé inaperçu car aucun consommateur immédiat ne testait son absence.

**Fix :**
Supprimer `bacId` de `PeriodeAlimentaireVague` dans `src/types/calculs.ts`. Vérifier à la compilation que les fonctions produisant ce type ne tentent plus de le remplir, et que les consommateurs ne l'utilisent pas.

**Leçon / Règle :**
Quand on crée un nouveau type en "clonant" un type existant, relire la spec ADR pour identifier les champs à ne PAS inclure — pas seulement ceux à ajouter. Appliquer un diff mental systématique : Nouveau type = Ancien type − {champs supprimés par la spec} + {champs ajoutés par la spec}. Un champ hérité par inadvertance dans un type "vague-level" qui ne devrait pas avoir de clé d'entité peut être détecté par la pré-analyse avant tout merge.

---

### ERR-053 — Commentaire ADR "fix appliqué" sur du code per-bac non corrigé
**Sprint :** ADR-033 discrepancies | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/feed-periods.ts`, `src/lib/queries/analytics.ts`

**Symptôme :**
Le commentaire dans `segmenterPeriodesAlimentaires` indique "Weight estimation uses the VAGUE-LEVEL Gompertz curve via `interpolerPoidsVague` (ALL biometries, NOT filtered by bacId)" — ce qui est vrai pour l'estimation du poids, mais la segmentation elle-même reste per-bac (groupement par `bacId` ligne 536). De même, `analytics.ts` porte le commentaire "ADR-033 DISC-09: build `mortalitesParBac` (flat Map)" alors que DISC-09 demandait de passer à un tableau plat `mortalitesTotales`. La pré-analyse détecte des commentaires contradictoires avec le code réel.

**Cause racine :**
L'implémentation a été réalisée en deux passes : une première passe a corrigé l'estimation du poids (interpolation vague-level), puis des commentaires "ADR-033 fixé" ont été ajoutés. Mais la deuxième correction (segmentation vague-level) n'a jamais été effectuée. Les commentaires optimistes ont masqué l'état réel du code lors des reviews suivantes.

**Fix :**
Les discrepancies DISC-03/05/06/08/09/11/12 ont finalement été reclassées "hors-scope" après validation utilisateur : l'algorithme confirmé maintient la segmentation per-bac et le `nombreVivants` per-bac — seule l'estimation du poids passe en vague-level. Les commentaires trompeurs ont été corrigés lors de la review ADR-033 (remarque I5 dans `review-ADR-033.md`).

**Leçon / Règle :**
Ne pas ajouter de commentaire "fix ADR-XXX DISC-YY" avant que la totalité de la correction correspondante soit effectuée. Un commentaire qui décrit un état futur désiré plutôt que l'état réel du code est plus dangereux qu'une absence de commentaire : il induit en erreur les reviewers et bloque la détection du travail restant. Utiliser plutôt un `// TODO(ADR-033 DISC-09): replace mortalitesParBac Map with flat mortalitesTotales array` tant que la correction n'est pas faite.

---

### ERR-052 — FCR : numérateur et dénominateur agrégés sur des périodes différentes
**Sprint :** ADR-033 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/feed-periods.ts`

**Symptôme :**
Le FCR calculé est incohérent : des périodes avec gain négatif (perte de biomasse) sont exclues du dénominateur (gain total) mais leur consommation alimentaire reste incluse dans le numérateur (aliment total). Le ratio aliment/gain est donc artificiellement gonflé.

**Cause racine :**
La logique de filtrage des périodes ne s'appliquait pas symétriquement. Le dénominateur ne sommait que les périodes à gain positif (filtre correct pour éviter un FCR négatif), mais le numérateur sommait toute la consommation sans appliquer le même filtre. Les deux grandeurs n'étaient donc pas calculées sur le même ensemble de périodes.

**Fix :**
Filtrer les deux termes sur le même prédicat (`gain > 0`) avant l'agrégation :
```typescript
const periodesPositives = periodes.filter(p => p.gainBiomasse > 0);
const alimentTotal = periodesPositives.reduce((s, p) => s + p.alimentConsome, 0);
const gainTotal   = periodesPositives.reduce((s, p) => s + p.gainBiomasse,  0);
const fcr = gainTotal > 0 ? alimentTotal / gainTotal : null;
```

**Leçon / Règle :**
Quand un ratio est calculé avec un filtre sur le dénominateur, appliquer le même filtre au numérateur. Ne jamais filtrer un seul terme d'un ratio — cela produit une agrégation incohérente et un résultat trompeur. Vérifier systématiquement que numérateur et dénominateur utilisent exactement le même ensemble de périodes/lignes.

---

### ERR-051 — Contexte Gompertz non construit pour les stratégies LINEAIRE
**Sprint :** ADR-033 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/feed-periods.ts`

**Symptôme :**
Une vague dont la `ConfigElevage.interpolationStrategy` vaut `LINEAIRE` n'utilise jamais le modèle Gompertz même si la vague a été calibrée (champ `vague.gompertz` renseigné avec des paramètres valides). L'interpolation reste linéaire même après calibrage, sous-estimant le poids des poissons dans les bacs créés après le calibrage.

**Cause racine :**
Le contexte Gompertz (`gompertzCtx`) était construit conditionnellement, uniquement quand `interpolStrategy === GOMPERTZ_VAGUE`. Or la stratégie configurée dans `ConfigElevage` contrôle le mode d'interpolation choisi par l'éleveur, mais la disponibilité du modèle Gompertz (existence de `vague.gompertz`) est une propriété indépendante. Conditionner la construction du contexte à la stratégie empêchait toute exploitation de Gompertz hors de ce chemin explicite.

**Fix :**
Séparer la construction du contexte Gompertz de la sélection de stratégie. Construire `gompertzCtx` dès que `vague.gompertz` est présent, indépendamment de `interpolStrategy` :
```typescript
const gompertzCtx = vague.gompertz
  ? buildGompertzContext(vague.gompertz)
  : null;

// Ensuite, utiliser gompertzCtx là où c'est pertinent,
// quelle que soit la valeur de interpolStrategy.
```

**Leçon / Règle :**
Ne pas conditionner la construction d'un contexte de calcul à la stratégie configurée si ce contexte peut être utile indépendamment. La disponibilité d'un modèle (données présentes) et son activation par configuration sont deux choses distinctes. Construire le contexte quand les données existent ; décider de l'utiliser ensuite selon la stratégie.

---

### ERR-050 — `interpolerPoidsBac` filtrait par bacId, rendant les bacs post-calibrage invisibles
**Sprint :** ADR-033 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/feed-periods.ts`

**Symptôme :**
Les bacs créés après un calibrage (redistribution des poissons) reçoivent un poids interpolé de `VALEUR_INITIALE` (50 g) au lieu du poids Gompertz correspondant à leur date de création. Le FCR et la biomasse sont fortement sous-estimés pour ces bacs.

**Cause racine :**
`interpolerPoidsBac` filtrait les biométries par `bacId` (`biometries.filter(b => b.bacId === bacId)`) pour obtenir l'historique du bac. Les bacs créés post-calibrage n'ont aucune biométrie propre dans leur fenêtre d'existence — les biométries appartiennent aux bacs sources. Le filtre retournait un tableau vide, ce qui déclenchait le fallback vers `VALEUR_INITIALE`.

**Fix :**
Créer `interpolerPoidsVague` qui utilise toutes les biométries de la vague sans filtre `bacId`, et qui évalue systématiquement Gompertz quand les paramètres sont disponibles :
```typescript
// Avant (incorrect) :
const biometriesBac = biometries.filter(b => b.bacId === bacId);

// Après (correct) :
// interpolerPoidsVague reçoit toutes les biométries de la vague,
// sans filtre bacId, et évalue Gompertz en priorité si gompertzCtx est non nul.
```

**Leçon / Règle :**
Le poids d'un poisson dans un bac post-calibrage dépend de l'historique de la vague entière, pas de l'historique du bac seul. Ne jamais filtrer les biométries par `bacId` pour alimenter un modèle de croissance (Gompertz ou linéaire) — filtrer par `vagueId` et laisser le modèle interpoler à la date voulue. Réserver le filtre `bacId` uniquement aux affichages de mesures brutes par bac.

---

### ERR-048 — GOMPERTZ_BAC : code mort car le fallback vers GOMPERTZ_VAGUE s'active systématiquement
**Sprint :** ADR-032 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/feed-periods.ts`, `src/lib/queries/analytics.ts`, `src/app/api/vagues/[id]/gompertz/route.ts`, `prisma/schema.prisma`

**Symptôme :**
L'option `GOMPERTZ_BAC` dans `StrategieInterpolation` (introduite par ADR-030) n'est jamais effectivement utilisée. Quand elle est sélectionnée dans `ConfigElevage`, le code de `interpolerPoidsBac` tombe systématiquement dans le fallback `GOMPERTZ_VAGUE`. Le FCR affiché est identique à `GOMPERTZ_VAGUE` quel que soit le choix de l'éleveur.

**Cause racine :**
Les calibrages (redistribution des poissons entre bacs) sont une opération courante dans l'élevage de Clarias gariepinus — toute vague au-delà de J20-J25 en subit au moins un. Les biométries per-bac incluent alors des discontinuités (le poids moyen "recule" après un calibrage) qui ne reflètent pas une vraie perte de poids. Le modèle Gompertz per-bac ne peut pas converger correctement sur ces données (R² faible), ce qui déclenche le fallback vers `GOMPERTZ_VAGUE`. En pratique, `GOMPERTZ_BAC` n'est jamais utilisé sur des données réelles.

**Fix (ADR-032) :**
Suppression complète de `GOMPERTZ_BAC` :
- Enum `StrategieInterpolation` réduit à `LINEAIRE` + `GOMPERTZ_VAGUE` (migration RECREATE)
- Modèle `GompertzBac` supprimé du schéma Prisma
- Branche `GOMPERTZ_BAC` supprimée de `interpolerPoidsBac` dans `feed-periods.ts`
- Chargement `gompertzBacs` supprimé de `analytics.ts`
- Boucle de calibration per-bac supprimée de la route `/api/vagues/[id]/gompertz`
- Option supprimée du formulaire `config-elevage-form-client.tsx` et du dialog `fcr-transparency-dialog.tsx`
- ConfigElevage existants avec `interpolationStrategy = GOMPERTZ_BAC` migrés vers `GOMPERTZ_VAGUE` par la migration SQL

**Leçon / Règle :**
Avant d'implémenter une stratégie d'interpolation per-entité (per-bac, per-lot), vérifier si les données terrain contiennent des discontinuités qui empêcheraient le modèle de converger. Si le fallback vers la stratégie vague/globale s'activera systématiquement, la stratégie per-entité est du code mort. Il vaut mieux une chaîne d'interpolation simple et fiable qu'une chaîne complexe dont les niveaux supérieurs ne sont jamais atteints. Voir ADR-032 qui supersède ADR-030 sur ce point.

---

### ERR-047 — nombreVivants figé au démarrage de la vague : FCR 2.5× trop bas après calibrage
**Sprint :** ADR-032 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/feed-periods.ts` (fonction `estimerNombreVivants`, remplacée par `estimerNombreVivantsADate`)

**Symptôme :**
Le FCR calculé par `computeAlimentMetrics` et `getFCRTrace` est biologiquement implausible (< 0.5) pour les bacs ayant subi un calibrage. Pour Clarias gariepinus, un FCR normal est entre 1.0 et 2.0. Un FCR de 0.4 signifie que les poissons ont pris plus de biomasse que d'aliment consommé — impossible.

**Cause racine :**
La fonction `estimerNombreVivants` dans `src/lib/feed-periods.ts` calculait le nombre de vivants d'un bac une seule fois pour toute sa durée de vie, à partir de `bac.nombreInitial ?? round(vague.nombreInitial / nbBacs)`. Cette valeur ne changeait jamais entre les périodes d'alimentation. Or, après un calibrage, `bac.nombreInitial` est périmé : il reflète la population au moment de la création du bac, pas la population post-calibrage.

Exemple concret (Vague 26-01) : Bac 01 part de 325 poissons, en perd 195 lors d'un calibrage à J25 (redistribués vers Bac 03 et Bac 04). Post-calibrage, Bac 01 ne contient plus que 130 poissons. Mais l'algorithme continuait d'utiliser `nombreVivants = 325`. Le gain de biomasse calculé était donc `poidsMoyenGain × 325` au lieu de `poidsMoyenGain × 130`, soit 2.5× trop élevé. Un gain surestimé → FCR sous-estimé.

**Fix (ADR-032) :**
Remplacement de `estimerNombreVivants` par `estimerNombreVivantsADate(bacId, targetDate, vagueContext, mortalitesParBac)` :
1. Chercher le dernier `CalibrageGroupe` dont `destinationBacId = bacId` et `calibrage.date <= targetDate`
2. Si trouvé, partir de `groupe.nombrePoissons` (source de vérité post-calibrage depuis le modèle `Calibrage` existant depuis Sprint 24)
3. Sinon, partir de `bac.nombreInitial ?? round(vague.nombreInitial / nbBacs)` (comportement précédent)
4. Soustraire les mortalités enregistrées pour ce bac entre la date de base et `targetDate`

Les requêtes Prisma dans `computeAlimentMetrics` et `getFCRTrace` incluent désormais `calibrages { groupes { destinationBacId, nombrePoissons, poidsMoyen } }`. Aucune migration de schéma requise — toutes les données nécessaires existaient déjà dans le modèle `Calibrage`.

**Leçon / Règle :**
Tout calcul de population par bac sur une vague doit être calibrage-aware. La source de vérité pour la population d'un bac après un calibrage est `CalibrageGroupe.nombrePoissons` (dernier calibrage avant la date cible), et non `Bac.nombreInitial` ni `Bac.nombrePoissons` (ce dernier est un champ legacy Phase 1 non fiable). Ne jamais utiliser une population "initiale" figée quand des opérations de redistribution peuvent avoir eu lieu. Voir `VagueContext.calibrages` et l'interface `CalibragePoint` dans `src/lib/feed-periods.ts`.

---

### ERR-046 — Suppression de paiement : le message d'erreur "n'appartient pas" est masqué par "introuvable"
**Sprint :** ADR-032 feature | **Date :** 2026-04-05
**Sévérité :** Basse
**Fichier(s) :** `src/app/api/depenses/[id]/paiements/[paiementId]/route.ts`

**Symptôme :**
La route DELETE `/api/depenses/[id]/paiements/[paiementId]` distingue deux cas d'erreur dans son handler : `message.includes("introuvable")` → 404, et `message.includes("n'appartient pas")` → 422. Mais la query `supprimerPaiementDepense` utilise `paiementDepense.findFirst({ where: { id: paiementId, depenseId } })` : si le paiement existe mais appartient à une autre dépense, `findFirst` retourne `null`, et la query lève "Paiement introuvable ou n'appartient pas a cette depense" — message qui contient "introuvable" en premier, donc l'API retourne toujours 404, jamais 422.

**Cause racine :**
Le contrôle d'ownership (le paiement appartient-il à cette dépense ?) est fusionné dans le même `findFirst` que l'existence du paiement. Il est impossible de distinguer les deux cas sans une deuxième requête.

**Fix appliqué :**
Les tests acceptent ce comportement : le cas "paiement d'une autre dépense" retourne 404 (même message). Ce n'est pas un bug fonctionnel — la sécurité est préservée (l'appelant ne peut pas accéder à des paiements hors-siteId). La distinction 404 vs 422 est cosmétique pour cette ressource.

**Leçon / Règle :**
Quand on rédige les handler HTTP d'erreur, s'assurer que l'ordre des `message.includes()` est cohérent avec les messages que la query peut réellement lever. Si plusieurs cas d'erreur partagent un mot commun (ici "introuvable"), le cas le plus spécifique doit être contrôlé en premier — ou la query doit lever des messages sans ambiguïté (`throw new Error("PAYMENT_NOT_FOUND")` vs `throw new Error("PAYMENT_WRONG_DEPENSE")`).

---

### ERR-045 — Suppression d'un modèle (ADR) sans nettoyer les références dans le code source
**Sprint :** ADR-032 | **Date :** 2026-04-05
**Sévérité :** Critique
**Fichier(s) :** `src/app/api/vagues/[id]/gompertz/route.ts`, `src/components/config-elevage/config-elevage-form-client.tsx`, `src/components/analytics/fcr-transparency-dialog.tsx`

**Symptôme :**
Le build échoue avec trois erreurs TypeScript après qu'une ADR (ADR-032) a supprimé le modèle `GompertzBac` et la valeur d'enum `GOMPERTZ_BAC` de `StrategieInterpolation` :
1. `prisma.gompertzBac` référencé dans la route gompertz → `Property 'gompertzBac' does not exist on type PrismaClient`
2. `StrategieInterpolation.GOMPERTZ_BAC` dans le select de config-elevage → `Property 'GOMPERTZ_BAC' does not exist`
3. Type local `MethodeEstimation` dans fcr-transparency-dialog inclut `"GOMPERTZ_BAC"` → comparaison impossible avec l'union réduite

Ces trois fichiers avaient été mentionnés dans le plan d'implémentation de l'ADR (section 11.B), mais n'avaient pas été mis à jour lors de l'implémentation. Le bug a été découvert par le tester au moment du `npm run build`.

**Cause racine :**
L'implémenteur (Phase A de l'ADR) a nettoyé les fichiers de types et de logique (`src/types/`, `src/lib/feed-periods.ts`, `src/lib/queries/analytics.ts`) mais a omis de nettoyer les trois fichiers de composants/routes listés dans l'ADR. La migration SQL existait déjà dans `prisma/migrations/` mais le code applicatif n'avait pas suivi.

**Fix :**
- `gompertz/route.ts` : supprimer le bloc de calibration par bac (lignes 249-410), retourner `calibrationsBacs: []` pour compatibilité ascendante.
- `config-elevage-form-client.tsx` : supprimer l'option `GOMPERTZ_BAC` du select `interpolationStrategy`.
- `fcr-transparency-dialog.tsx` : supprimer `"GOMPERTZ_BAC"` du type local `MethodeEstimation`, du `config` record, et simplifier les branches conditionnelles.

**Leçon / Règle :**
Quand une ADR supprime un modèle ou une valeur d'enum, tous les fichiers mentionnés dans la section "Impact sur les fichiers" de l'ADR doivent être modifiés dans le même commit/PR. Ne jamais supposer qu'un fichier "UI" n'a pas besoin d'être mis à jour. Avant tout `npm run build`, chercher le symbole supprimé dans tout le projet : `grep -r "GOMPERTZ_BAC" src/`. Un build vert est la condition nécessaire pour clore une ADR.

---

### ERR-044 — Suppression de paiement sans audit trail : perte de traçabilité
**Sprint :** ADR-032 feature | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/depenses.ts` — `supprimerPaiementDepense()`

**Symptôme :**
Pattern initial (avant la feature) : supprimer un `PaiementDepense` directement avec `prisma.paiementDepense.delete()` et recalculer les agrégats. Aucune trace de la suppression n'est conservée ; l'historique financier de la dépense devient incomplet et impossible à auditer.

**Cause racine :**
La suppression d'un paiement est une opération financière irréversible qui modifie le montant payé et le statut de la dépense. Sans audit trail, un bug ou une action malveillante sur cette route ne laisse aucune trace permettant de reconstituer l'état avant suppression.

**Fix :**
Créer un `AjustementDepense` (avec `typeAjustement: MONTANT_TOTAL`, `montantAvant: paiement.montant`, `montantApres: 0`, `paiementId`) **avant** la suppression, dans la même transaction. Si la transaction échoue après la création de l'audit trail mais avant la suppression, la transaction est annulée entièrement — aucun état incohérent.

```typescript
// 1. Create audit trail BEFORE deletion
await tx.ajustementDepense.create({
  data: {
    depenseId,
    montantAvant: paiement.montant,
    montantApres: 0,
    raison: `Suppression du paiement du ${paiement.date.toLocaleDateString("fr-FR")}`,
    userId,
    siteId,
    typeAjustement: TypeAjustementDepense.MONTANT_TOTAL,
    paiementId,
  },
});
// 2. Delete (FraisPaiementDepense cascade automatically)
await tx.paiementDepense.delete({ where: { id: paiementId } });
```

**Leçon / Règle :**
Toute suppression d'un enregistrement financier (paiement, facture, ligne de commande) doit créer un enregistrement d'audit **avant** la suppression, dans la même transaction (R4). L'audit trail doit inclure le `paiementId` de la ligne supprimée pour permettre la reconstitution. Le modèle `AjustementDepense` est le bon outil pour cela dans ce projet.

---

### ERR-043 — Variables mortes issues d'un copy-paste : supprimées avec `void` faute d'être câblées
**Sprint :** ADR-031 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/calculs/fcr-trace.ts`

**Symptôme :**
Une variable `bacBios` est construite par filtrage des biométries sur un bac précis, puis immédiatement supprimée avec `void bacBios` pour éviter un avertissement TypeScript "variable déclarée mais non utilisée". Le résultat de ce filtrage n'alimente aucun calcul.

**Cause racine :**
Code adapté depuis un contexte où `bacBios` était consommé (traitement bac par bac). Dans le nouveau contexte (`getFCRTrace`), la logique avait été réécrite pour opérer sur l'ensemble des biométries ; `bacBios` n'avait donc plus de consommateur. L'auteur a masqué l'avertissement avec `void` au lieu de supprimer la variable.

**Fix :**
Supprimer la déclaration de `bacBios` et l'expression `void bacBios`. Tracer chaque variable jusqu'à son consommateur avant de valider l'adaptation.

**Leçon / Règle :**
Quand on adapte du code d'un contexte à un autre, tracer chaque variable locale jusqu'à son consommateur. Si une variable n'a aucun consommateur dans le nouveau contexte, la supprimer entièrement. Masquer un avertissement avec `void` est un signal d'alarme : soit la variable est nécessaire et doit être câblée, soit elle est morte et doit être retirée.

---

### ERR-042 — Fetch de données déclenché dans le corps de rendu React au lieu d'un `useEffect`
**Sprint :** ADR-031 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/components/releves/fcr-transparency-dialog.tsx`

**Symptôme :**
`loadTrace()` est appelée directement dans le corps du composant avec un garde `if (!loaded && !loading && !error)`. En React Strict Mode (développement), le composant est rendu deux fois, déclenchant deux appels réseau simultanés. En production, le comportement dépend du timing du premier rendu.

**Cause racine :**
Le développeur a tenté d'éviter un `useEffect` vide en plaçant la logique de fetch directement dans le render avec des gardes booléennes. Cette approche est incorrecte : les effets de bord (appels réseau, mutations d'état dérivées) ne doivent jamais être produits dans le corps de rendu.

**Fix :**
Déplacer l'appel dans un `useEffect` sans dépendances (ou avec `[open]` si le fetch doit se déclencher à l'ouverture du dialog) :
```tsx
useEffect(() => {
  loadTrace();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Leçon / Règle :**
Ne jamais déclencher de side effects (fetch, setTimeout, mutation d'état externe) dans le corps de rendu d'un composant React, même avec des gardes booléennes. Toujours utiliser `useEffect`. En React Strict Mode, le corps de rendu est exécuté deux fois — toute logique conditionnelle y placée sera invoquée deux fois avant que l'état ne soit mis à jour.

---

### ERR-041 — Arrondi intermédiaire qui se propage dans les calculs suivants (rounding leak)
**Sprint :** ADR-031 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/calculs/fcr-trace.ts`

**Symptôme :**
Le `fcrMoyenFinal` affiché dans le dialog de transparence FCR diffère légèrement du `fcrMoyen` affiché sur la carte de synthèse (ex : `2.34` vs `2.35`). Les deux valeurs sont calculées à partir des mêmes données source mais divergent d'un epsilon visible.

**Cause racine :**
Dans `getFCRTrace`, les valeurs de biomasse intermédiaires (`biomasseCourante`, `biomassePrecedente`) étaient arrondies à 2 décimales pour alimenter les lignes du tableau de détail. Ces valeurs arrondies étaient ensuite réutilisées pour calculer `gainBiomasseKg` et `fcrPeriode`. L'erreur d'arrondi s'accumulait à chaque période et produisait un `fcrMoyenFinal` légèrement différent du FCR calculé depuis les valeurs brutes dans la carte.

**Fix :**
Conserver les valeurs brutes non arrondies dans toutes les variables intermédiaires de calcul. N'appliquer `toFixed()` ou `Math.round()` qu'au moment de construire l'objet destiné à l'affichage, jamais avant.

**Leçon / Règle :**
L'arrondi est une opération d'affichage, pas de calcul. Dans toute chaîne de calcul multi-étapes, les valeurs intermédiaires doivent rester en virgule flottante native. Une valeur arrondie ne doit jamais servir d'entrée à un calcul ultérieur. Appliquer l'arrondi uniquement à la dernière étape, sur la valeur finale destinée à être affichée ou sérialisée.

---

### ERR-037 — TypeScript : Array.includes() rejette une union plus large que le tuple readonly
**Sprint :** ADR-029 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/interpolation/strategy.ts` (et tout fichier utilisant `.includes()` sur un tuple `as const`)

**Symptôme :**
TypeScript émet une erreur de type lors d'un appel `.includes()` sur un tuple `readonly` quand la valeur testée est d'un type union plus large que le type des éléments du tuple :
```
Argument of type '"A" | "B" | "C" | "D"' is not assignable to parameter of type '"A" | "B"'.
```

**Cause racine :**
`Array.prototype.includes(searchElement: T)` exige que `searchElement` soit assignable à `T`. Pour un tuple `readonly ["A", "B"]`, `T` est `"A" | "B"`, ce qui est plus étroit que la valeur de type `"A" | "B" | "C" | "D"` à tester. TypeScript considère l'appel comme type-unsafe car le tuple ne peut logiquement pas contenir `"C"` ou `"D"`.

**Fix :**
Remplacer `.includes()` par des égalités directes :
```typescript
// Incorrect :
const SIMPLE_STRATEGIES = ["LAST_KNOWN", "ZERO"] as const;
if (SIMPLE_STRATEGIES.includes(strategy)) { ... } // erreur TS

// Correct :
if (strategy === "LAST_KNOWN" || strategy === "ZERO") { ... }
```

**Leçon / Règle :**
Ne pas utiliser `.includes()` pour tester l'appartenance d'une valeur à un sous-ensemble de son type union. Utiliser des comparaisons d'égalité directes (`===`) ou un cast explicite `(arr as readonly string[]).includes(val)` si le tuple est large. Les comparaisons directes sont plus lisibles et entièrement type-safe.

---

### ERR-036 — Prisma $Enums vs TypeScript enum : cast obligatoire à la frontière
**Sprint :** ADR-029 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/interpolation/strategy.ts`, tout service lisant un champ Prisma typé `$Enums.XxxEnum`

**Symptôme :**
Une review signale un cast `as SomeEnum` comme "redondant" ou "cosmétique" sur un champ lu depuis Prisma. Supprimer le cast provoque une erreur TypeScript à la compilation :
```
Type '$Enums.InterpolationStrategy' is not assignable to type 'InterpolationStrategy'.
```

**Cause racine :**
Prisma génère ses propres types nominaux dans l'espace `$Enums`. Ces types sont structurellement compatibles avec les enums TypeScript du projet (`src/types/`) mais nominalement distincts. TypeScript enforce la nominalité des enums : même si les valeurs sont identiques, les deux types ne sont pas interchangeables sans cast.

**Fix :**
Conserver le cast `as InterpolationStrategy` (ou l'enum applicatif équivalent) au point de lecture depuis Prisma :
```typescript
// Lecture depuis Prisma :
const strategy = vague.interpolationStrategy as InterpolationStrategy;
// Maintenant strategy est typé comme l'enum applicatif, pas $Enums.InterpolationStrategy
```

**Leçon / Règle :**
Tout champ Prisma dont le type est un enum (`$Enums.X`) doit être casté vers le type enum applicatif (`import { X } from "@/types"`) au point de lecture. Ce cast est **obligatoire**, pas cosmétique. Ne jamais le supprimer lors d'une review sans vérifier que `npm run build` passe toujours. Voir aussi ERR-008 et ERR-012 pour des variantes de ce problème.

---

### ERR-004 — updatedAt affiché au lieu de date de mesure
**Sprint :** 29+ | **Date :** 2026-03-20
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/queries/releves.ts`, `src/components/vagues/releves-list.tsx`

**Symptôme :**
La liste des relevés affichait la date de modification système (`updatedAt`) au lieu de la date de mesure (`date`).

**Cause racine :**
Le `orderBy` et l'affichage utilisaient `updatedAt` par erreur.

**Fix :**
Changer `orderBy: { updatedAt: "desc" }` → `orderBy: { date: "desc" }` et `r.updatedAt` → `r.date` dans l'affichage.

**Leçon / Règle :**
Toujours utiliser le champ métier (`date`) pour le tri et l'affichage, pas les timestamps système (`createdAt`/`updatedAt`).

---

## Catégorie : Build

### ERR-006 — Prisma migrate diff inclut le texte de sortie CLI dans le SQL
**Sprint :** 30 | **Date :** 2026-03-20
**Sévérité :** Moyenne
**Fichier(s) :** `prisma/migrations/*/migration.sql`

**Symptôme :**
La migration échoue avec `ERROR: syntax error at or near "Loaded"` ou un texte de bannière Prisma
au début ou à la fin du fichier SQL généré.

**Cause racine :**
`npx prisma migrate diff --script > file.sql` redirige TOUT le stdout, y compris les messages
de config (`Loaded Prisma config from...`) et les bannières de mise à jour (`Update available...`).

**Fix :**
Après génération, supprimer manuellement les lignes non-SQL au début et à la fin du fichier :
- Supprimer la ligne `Loaded Prisma config from prisma.config.ts.` en tête
- Supprimer le bloc `┌─────...┐` de mise à jour en pied si présent

Puis si la migration a échoué, résoudre avec :
```bash
npx prisma migrate resolve --rolled-back NOM_MIGRATION
npx prisma migrate deploy
```

**Leçon / Règle :**
Toujours vérifier que le fichier migration.sql ne contient que du SQL pur avant de déployer.
Utiliser `head -3 migration.sql` et `tail -5 migration.sql` pour vérifier.

---

## Catégorie : Pattern

### ERR-061 — Constante de liste de paramètres URL hard-codée dans chaque composant : oubli lors d'un ajout
**Sprint :** ADR-038 | **Date :** 2026-04-06
**Sévérité :** Moyenne
**Fichier(s) :** `src/components/releves/releves-filter-bar.tsx`, `src/lib/releve-search-params.ts`

**Symptôme :**
La fonction `updateMultipleParams()` dans `releves-filter-bar.tsx` hard-codait la liste des 6 paramètres URL à effacer lors d'un reset ou d'un changement de type : `["vagueId", "bacId", "typeReleve", "dateFrom", "dateTo", "modifie"]`. Quand l'ADR-038 a ajouté 22 nouveaux paramètres de filtres spécifiques, ils n'étaient pas dans cette liste — un reset partiel laissait donc les filtres BIOMETRIE/MORTALITE/etc. actifs dans l'URL même si le type avait changé. Les filtres croisés produisaient des résultats incorrects (filtre BIOMETRIE actif sur une liste de MORTALITE).

**Cause racine :**
La liste des paramètres était dupliquée à plusieurs endroits (filter-bar, filter-sheet, active-filters) sans source de vérité partagée. Chaque ajout de paramètre nécessitait de mettre à jour N endroits séparément — une mise à jour partielle était difficile à détecter car aucun test ne vérifiait l'exhaustivité de cette liste.

**Fix :**
Créer une constante `ALL_FILTER_PARAMS` dans `src/lib/releve-search-params.ts` contenant l'ensemble de tous les paramètres de filtre, et l'utiliser partout :
```typescript
export const ALL_FILTER_PARAMS = [
  "vagueId", "bacId", "typeReleve", "dateFrom", "dateTo", "modifie",
  "poidsMoyenMin", "poidsMoyenMax", "tailleMoyenneMin", "tailleMoyenneMax",
  "causeMortalite", "nombreMortsMin", "nombreMortsMax",
  // ... 22 params au total
] as const;
```
Remplacer le tableau inline dans `updateMultipleParams()` par `ALL_FILTER_PARAMS`. Écrire un test qui vérifie qu'`ALL_FILTER_PARAMS` contient tous les champs de `ReleveSearchParams` (exhaustivité).

**Leçon / Règle :**
Toute liste de paramètres URL (ou de champs de filtre) partagée entre plusieurs composants doit vivre dans une constante exportée unique, dans le fichier utilitaire dédié (ex: `releve-search-params.ts`). Ne jamais dupliquer un tableau de paramètres URL inline dans les composants. Un test d'exhaustivité (`expect(ALL_FILTER_PARAMS).toContain(key)` pour chaque clé de l'interface) garantit qu'un nouveau paramètre ne sera pas oublié.

---

### ERR-060 — Query lourde chargée pour un sous-ensemble de données : pattern split query
**Sprint :** ADR-038 | **Date :** 2026-04-06
**Sévérité :** Haute (performance)
**Fichier(s) :** `src/lib/queries/vagues.ts`, `src/components/pages/vague-detail-page.tsx`

**Symptôme :**
`getVagueById()` chargeait tous les relevés d'une vague avec leurs relations complètes (bac, consommations, modifications) sans limite. Sur une vague de 6 bacs pendant 6 mois (~2 relevés/jour/bac), cela représente ~2 160 relevés soit ~500 KB de JSON Prisma en mémoire serveur — pour afficher uniquement 2 relevés en preview et quelques biométries sur le graphique. Les pages et le serveur étaient pénalisés sur toute vague mature.

**Cause racine :**
La query initiale avait été conçue quand les données étaient peu volumineuses. L'include `releves` était pratique pour l'accès direct à `vague.releves` dans les composants. Au fur et à mesure que des fonctionnalités dépendant de cette query ont été ajoutées (preview, graphique, page complète, export), le volume réel chargé a crû sans que la query soit adaptée.

**Fix :**
Séparer `getVagueById()` en deux fonctions distinctes avec des contrats explicites :
- `getVagueById(id, siteId)` : retourne `VagueWithBacs | null` — vague + bacs uniquement, sans relevés. Type de retour annoté explicitement pour bloquer tout accès à `.releves`.
- `getVagueByIdWithReleves(id, siteId, pagination?)` : retourne `{ vague, releves, total } | null` — charge relevés paginés en parallèle via `Promise.all`.
Les appelants qui avaient besoin de sous-ensembles de relevés (biométries pour graphique, preview 3 relevés) utilisent maintenant des queries directes ciblées avec `select` restreint.

**Leçon / Règle :**
Une query qui charge un include sans limite (sans `take`) doit être remise en question dès que le volume peut croître. Pour les modèles en relation 1-N potentiellement volumineuse (vague → relevés, commande → lignes), ne jamais inclure l'entité enfant dans la query parent sans `take`. Créer des fonctions de query distinctes selon le besoin : une sans l'enfant (métadonnées) et une avec pagination. Annoter explicitement les types de retour pour que TypeScript détecte les accès aux champs manquants chez les appelants.

---

### ERR-064 — Sheet Radix avec override `!inset-y-0` annule les safe areas iOS/Android
**Sprint :** ADR-038 | **Date :** 2026-04-06
**Sévérité :** Basse (UX mobile)
**Fichier(s) :** `src/components/releves/releves-filter-bar.tsx`, `src/components/releves/releves-filter-sheet.tsx`

**Symptôme :**
Le `SheetContent` du filtre relevés utilisait les classes Tailwind `!inset-y-0 !left-auto !right-0` pour positionner le Sheet en panneau latéral plein écran droit. Ces classes utilisent `!important` qui annule le `pt-[env(safe-area-inset-top)]` défini dans le composant `sheet.tsx` de base. Sur iPhone avec notch ou indicateur home (barre de gestes bas), le contenu du Sheet empiétait sur les zones système réservées : le titre se cachait sous la notch, les boutons d'action se trouvaient derrière la barre home.

**Cause racine :**
L'override `!inset-y-0` est nécessaire pour le positionnement du Sheet mais annule les paddings safe area. Le composant `SheetContent` de base avait prévu les safe areas via `pt-[env(safe-area-inset-top)]` mais le `!important` de l'override positionnement prenait le dessus. Modifier `SheetContent` globalement aurait cassé la sidebar et tous les autres usages partagés.

**Fix :**
Gérer les safe areas directement dans le contenu du Sheet (pas dans `SheetContent`), avec un layout flex-col h-full + header/footer sticky :
```tsx
<div className="flex flex-col h-full">
  {/* Header fixe — safe area top */}
  <div className="shrink-0 px-4 pt-[env(safe-area-inset-top)] pb-3 border-b">
    ...
  </div>
  {/* Corps scrollable */}
  <div className="flex-1 overflow-y-auto px-4 py-4">...</div>
  {/* Footer fixe — safe area bottom + right landscape */}
  <div className="shrink-0 px-4 pt-3
                  pb-[max(0.75rem,env(safe-area-inset-bottom))]
                  pr-[max(1rem,env(safe-area-inset-right))]
                  border-t">
    ...
  </div>
</div>
```
L'utilisation de `max(0.75rem, env(safe-area-inset-bottom))` garantit un minimum de 12px même sur les appareils sans geste système (où `safe-area-inset-bottom = 0`).

**Leçon / Règle :**
Quand un `SheetContent` ou `DialogContent` utilise des classes de positionnement avec `!important` qui annulent les safe areas, ne pas modifier le composant partagé — gérer les safe areas dans le contenu interne avec `pt-[env(safe-area-inset-top)]` et `pb-[max(0.75rem,env(safe-area-inset-bottom))]`. Cette approche isole le fix à l'usage spécifique sans impacter les autres Sheets/Dialogs. `max()` est le pattern correct pour garantir un minimum de padding sur les appareils sans safe area.

---

### ERR-059 — Route group Next.js : déplacement partiel de dossier casse le loading state des sous-routes
**Sprint :** ADR-034 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/app/releves/`, `src/app/(farm)/releves/`

**Symptôme :**
`src/app/releves/` contenait deux fichiers : `loading.tsx` (pour `/releves`) et `nouveau/page.tsx` (pour `/releves/nouveau`). L'ADR demandait de déplacer uniquement `loading.tsx` vers `src/app/(farm)/releves/`. Ce déplacement partiel aurait cassé le loading state de `/releves/nouveau` : `loading.tsx` dans `(farm)/releves/` ne s'applique plus aux sous-routes restées dans l'ancien dossier `releves/nouveau/`.

**Cause racine :**
En Next.js App Router, un fichier `loading.tsx` couvre les routes du même segment et de ses sous-segments dans le même dossier. Si le dossier parent est divisé entre deux emplacements (`(farm)/releves/` et `releves/`), le `loading.tsx` du nouveau dossier n'a aucun effet sur les fichiers restés dans l'ancien dossier.

**Fix :**
Déplacer l'intégralité du dossier `src/app/releves/` vers `src/app/(farm)/releves/` en une seule opération : `loading.tsx` ET `nouveau/page.tsx` ensemble. Supprimer ensuite le dossier d'origine. Vérifier que les liens FAB (`/releves/nouveau`) fonctionnent toujours après déplacement.

**Leçon / Règle :**
Quand un dossier de route Next.js App Router est déplacé dans un route group (ex: `(farm)/`), déplacer toujours l'intégralité du sous-arbre du dossier en une seule opération. Un déplacement partiel (seulement certains fichiers du dossier) est presque toujours incorrect en App Router car les conventions de fichiers (`loading.tsx`, `error.tsx`, `layout.tsx`) s'appliquent au segment et à tous ses enfants dans le même arbre.

---

### ERR-040 — ADR interne incohérent : hypothèse d'homogénéité contredite par l'ADR précédent
**Sprint :** ADR-030 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `docs/decisions/ADR-029.md`, `docs/decisions/ADR-030.md`

**Symptôme :**
ADR-029 rejette le calibrage Gompertz par bac avec l'argument que "les bacs d'une même vague ont des conditions quasi-identiques". ADR-030 doit annuler ce choix car les bacs ont en réalité des conditions différentes — en particulier des changements d'aliment qui surviennent à des dates distinctes par bac.

**Cause racine :**
ADR-028 avait introduit la segmentation des périodes d'alimentation par bac précisément parce que les bacs ne changent pas d'aliment en même temps. ADR-029, rédigé sans recroiser ADR-028, a posé une hypothèse d'homogénéité que le modèle avait déjà invalidée. Les deux ADR étaient en contradiction directe sur la nature des données.

**Fix :**
ADR-030 a été rédigé pour documenter l'invalidation d'ADR-029 et rétablir le calibrage par bac. Le travail d'implémentation a dû reprendre depuis la décision d'architecture.

**Leçon / Règle :**
Avant de rédiger un ADR qui suppose quelque chose sur la structure ou l'homogénéité des données, relire les ADR précédents pour détecter toute contradiction. En particulier : si un ADR antérieur a introduit une segmentation par entité (par bac, par période, par site), un nouvel ADR ne peut pas supposer que ces entités sont interchangeables. Documenter explicitement dans le nouvel ADR les hypothèses posées et les ADR croisés.

---

### ERR-039 — Pondération multi-entité copy-collée dans un contexte mono-entité devient un no-op
**Sprint :** ADR-030 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/calculs-gompertz.ts` (route de calibrage par bac)

**Symptôme :**
Le calibrage Gompertz par bac produit des résultats identiques qu'avec ou sans pondération. Aucune erreur TypeScript ou runtime, mais la pondération n'a aucun effet.

**Cause racine :**
La route de calibrage par vague pondérait les points biométriques par `vivantsByBac` (nombre de poissons par bac) pour agréger plusieurs bacs à la même date. Quand cette logique a été copy-collée dans la boucle de calibrage par bac, tous les enregistrements avaient le même `bacId`. Le numérateur et le dénominateur de la moyenne pondérée étaient proportionnels à la même constante, ce qui ramène le calcul à une moyenne simple — la pondération ne change rien.

**Fix :**
Dans le contexte mono-entité (boucle par bac), remplacer la moyenne pondérée par une moyenne arithmétique simple. L'abstraction de pondération multi-entité n'est pertinente que lorsque plusieurs entités différentes sont agrégées sur la même dimension temporelle.

**Leçon / Règle :**
Quand on adapte du code d'agrégation multi-entité à un contexte mono-entité, simplifier plutôt que copier. Une moyenne pondérée sur des enregistrements qui partagent tous le même identifiant d'entité est algébriquement équivalente à une moyenne simple — conserver la pondération est trompeur car elle suggère une variance entre entités qui n'existe pas. Se poser la question : "quelle diversité ce code est-il censé compenser ?" Si la diversité n'est pas présente dans le jeu de données courant, l'abstraction ne doit pas être transférée.

---

### ERR-018 — String en dur comme clé d'accès à un objet constant indexé par enum (variante R2)
**Sprint :** 37 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/services/abonnements.ts`, divers

**Symptôme :**
Un accès à un objet constant (`PLAN_LIMITES`) utilisait une string littérale comme clé d'index (`PLAN_LIMITES["DECOUVERTE"]`) au lieu de l'enum (`PLAN_LIMITES[TypePlan.DECOUVERTE]`). Pas d'erreur TypeScript immédiate si l'objet est typé `Record<string, ...>`, mais la valeur d'accès est découplée de l'enum : si l'enum change de nom, le compilateur ne détecte pas la régression.

**Cause racine :**
R2 est souvent appliqué aux comparaisons (`statut === "ACTIF"`) et aux paramètres Prisma, mais oublié pour les accès à des objets constants (`MAP[cle]`). L'accès par string en dur ressemble visuellement à un accès valide mais contourne le système de types.

**Fix :**
Utiliser l'enum comme clé d'index dans tous les accès à des objets constants indexés par des valeurs d'enum :

```typescript
// Incorrect (string en dur) :
const limites = PLAN_LIMITES["DECOUVERTE"];

// Correct (enum comme clé) :
import { TypePlan } from "@/types";
const limites = PLAN_LIMITES[TypePlan.DECOUVERTE];
```

**Leçon / Règle :**
R2 ("Toujours importer les enums") s'applique partout où une valeur d'enum est utilisée comme identifiant : comparaisons, paramètres de fonction, clés d'objet/Map, switch-case. Si un objet constant est indexé par des valeurs d'enum, chaque accès à cet objet doit utiliser `Enum.VALEUR` comme clé, jamais `"VALEUR"` en dur.

---

### ERR-017 — Tests existants cassés après refactoring de route API (régression silencieuse)
**Sprint :** 36 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/__tests__/api/vagues.test.ts`, `src/app/api/vagues/route.ts`

**Symptôme :**
4 tests de la suite `vagues.test.ts` passent en régression après le refactoring R4 de la route `POST /api/vagues`. Le build CI détecte des échecs que le développeur n'a pas vus car il n'a relancé que les nouveaux tests.

**Cause racine :**
Le refactoring R4 a déplacé le check quota et la création dans une `$transaction()`, changeant le flow interne de la route (plus d'appel direct à `getQuotasUsage()`, erreur levée différemment via `throw` dans la transaction). Les mocks dans les tests existants ciblaient l'ancien flow et n'ont pas été mis à jour en même temps que le code.

**Fix :**
Après le refactoring, mettre à jour les mocks de la suite de tests correspondante pour refléter le nouveau flow : retirer le mock de `getQuotasUsage`, adapter les stubs de `prisma.$transaction` pour simuler le reject ou resolve selon les cas.

**Leçon / Règle :**
Après tout refactoring de route API qui change le flow interne (ordre des appels, encapsulation dans une transaction, remplacement d'une fonction par une autre), toujours relancer `npx vitest run` sur la suite de tests de cette route spécifiquement avant de déclarer le refactoring terminé. Si des mocks ne correspondent plus au nouveau flow, les mettre à jour dans le même commit que le refactoring.

---

### ERR-016 — Race condition check-then-create sur les quotas de plan (R4)
**Sprint :** 36 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/bacs/route.ts`, `src/app/api/vagues/route.ts`

**Symptôme :**
Deux requêtes POST concurrentes passent simultanément le check de quota (`getQuotasUsage()`) et créent toutes les deux leur ressource, dépassant la limite du plan. Aucune erreur n'est levée, le dépassement est silencieux.

**Cause racine :**
Le pattern `getQuotasUsage() → if quota atteint → create` n'est pas atomique. Entre le moment du count et celui de la création, une autre requête concurrente peut effectuer le même count (qui retourne la même valeur) et procéder à sa propre création.

**Fix :**
Encapsuler le count et la création dans `prisma.$transaction()` pour que le check et la création soient atomiques :

```typescript
// Avant (non-atomique, vulnérable aux race conditions) :
const usage = await getQuotasUsage(siteId);
if (usage.bacs >= plan.limiteBacs) {
  return NextResponse.json({ error: "Quota atteint" }, { status: 403 });
}
const bac = await prisma.bac.create({ data });

// Après (atomique) :
const bac = await prisma.$transaction(async (tx) => {
  const count = await tx.bac.count({ where: { siteId } });
  if (count >= plan.limiteBacs) {
    throw new Error("QUOTA_ATTEINT");
  }
  return tx.bac.create({ data });
});
```

**Leçon / Règle :**
R4 s'applique aussi aux créations conditionnelles : quand une création dépend d'un comptage de limite (quotas, stock, places disponibles, etc.), toujours mettre le count + create dans la même transaction. Le pattern check-then-create hors transaction est toujours vulnérable aux race conditions sous charge.

**Complément Sprint 36 :** Quand on refactorise une route pour appliquer R4, identifier toutes les routes similaires dans le même fichier ou dans des fichiers parallèles (ex : `/api/bacs` ET `/api/vagues` traitent toutes les deux des quotas de plan). Corriger le pattern sur TOUTES ces routes en même temps. Un fix partiel laisse une surface d'attaque résiduelle.

---

### ERR-005 — Check-then-update au lieu d'opérations atomiques (R4)
**Sprint :** 2 | **Date :** 2026-03-08
**Sévérité :** Haute
**Fichier(s) :** divers

**Symptôme :**
Race conditions possibles quand on fait `findFirst` puis `update` sans transaction.

**Cause racine :**
Pattern "vérifier puis modifier" non atomique.

**Fix :**
Utiliser `$transaction()` avec `updateMany` conditionnel ou `findFirst` + `update` dans la même transaction.

**Leçon / Règle :**
R4 : Toujours utiliser des opérations atomiques. `$transaction()` pour les opérations multi-étapes.

---

### ERR-008 — Conflit enum Prisma généré vs TypeScript dans les routes/services
**Sprint :** 31 | **Date :** 2026-03-20
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/webhooks/`, `src/lib/services/billing.ts`

**Symptôme :**
Erreur TypeScript `Type 'import(".../prisma/enums").StatutPaiementAbo' is not assignable to
type 'import(".../types/models").StatutPaiementAbo'` lors de l'utilisation des résultats
de queries Prisma dans les routes ou services.

**Cause racine :**
Prisma génère ses propres enums dans `src/generated/prisma/enums`. Ces enums sont
distincts des enums TypeScript dans `src/types/models.ts`, même si les valeurs sont identiques.
Quand une query retourne un objet Prisma (ex: `paiementAbonnement.statut`), son type est
`prisma/enums.StatutPaiementAbo`, pas `types/models.StatutPaiementAbo`.

**Fix :**
Option 1 (comparaison) : Caster en string pour comparer :
```typescript
if ((paiement.statut as string) === StatutPaiementAbo.CONFIRME) { ... }
```

Option 2 (passage à Prisma) : Caster le type pour les fonctions Prisma directes :
```typescript
const gateway = getPaymentGateway(paiement.fournisseur as FournisseurPaiement);
```

Option 3 (recommandée) : Utiliser les fonctions de query Sprint 30/31 qui gèrent les
enums en interne plutôt que d'appeler Prisma directement dans les routes :
```typescript
// Au lieu de : tx.abonnement.updateMany({ data: { statut: "ACTIF" as never } })
// Utiliser : activerAbonnement(abonnementId) — qui fait le updateMany en interne
await confirmerPaiement(referenceExterne);
await activerAbonnement(abonnementId);
```

**Leçon / Règle :**
Dans les routes API et services, TOUJOURS utiliser les fonctions de query plutôt que d'appeler
Prisma directement avec des statuts d'enum. Les fonctions de query gèrent le conflit d'enum
correctement. Si la comparaison directe est nécessaire, utiliser `(val as string) === Enum.VALUE`.

---

### ERR-007 — Prisma Json field : type InputJsonValue requis pour update
**Sprint :** 30 | **Date :** 2026-03-20
**Sévérité :** Basse
**Fichier(s) :** `src/lib/queries/*.ts`

**Symptôme :**
Erreur TypeScript `Type 'Record<string, unknown> | undefined' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'`
lors de la mise à jour d'un champ `Json?` Prisma.

**Cause racine :**
Prisma génère des types spécifiques pour les champs Json. `Record<string, unknown>` est compatible
mais TypeScript ne peut pas l'inférer directement sans cast.

**Fix :**
Utiliser un cast vers `Prisma.InputJsonValue` :
```typescript
import type { Prisma } from "@/generated/prisma/client";

// Dans l'update :
...(metadata !== undefined && {
  metadata: metadata as Prisma.InputJsonValue
})
```

**Leçon / Règle :**
Pour les champs `Json?` Prisma en update, toujours caster avec `as Prisma.InputJsonValue`.

---

### ERR-012 — Cast enums Prisma généré vs @/types dans les Server Components
**Sprint :** 33 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/app/*/page.tsx`, `src/generated/prisma/enums.ts`

**Symptôme :**
```
Type '"DECOUVERTE"' is not assignable to type 'TypePlan'
```
Les enums Prisma générés dans `src/generated/prisma/enums.ts` ne sont pas compatibles avec les enums de `src/types/models.ts` même si les valeurs string sont identiques (R1 garantit l'identité).

**Cause racine :**
Prisma génère ses propres enums dans un namespace isolé. TypeScript refuse l'assignation directe même si les valeurs sont les mêmes.

**Fix :**
Utiliser le cast `as unknown as import("@/types").TypePlan` pour convertir les retours Prisma avant de les passer à des composants typés `@/types`.

```typescript
// Dans la Server Component page.tsx :
statut: prismaResult.statut as unknown as import("@/types").StatutAbonnement,
typePlan: prismaResult.plan.typePlan as unknown as import("@/types").TypePlan,
```

**Leçon / Règle :**
Quand une Server Component lit depuis Prisma et passe les données à un composant avec des types `@/types`, toujours caster les enums Prisma via `as unknown as TypeCible`. Ce cast est sûr car R1 garantit que toutes les valeurs d'enum sont UPPERCASE et identiques entre Prisma et `@/types`.

---

### ERR-015 — Double vérification redondante avant une opération déjà conditionnelle
**Sprint :** 36-37 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/services/rappels-abonnement.ts`, divers

**Symptôme :**
Deux formes observées :

1. (Sprint 36) Le service effectuait une requête `COUNT` en base (`rappelExisteAujourdhui`) avant chaque appel à `creerNotificationSiAbsente`, entraînant une double requête DB par rappel traité.

2. (Sprint 37) Un `findFirst` de vérification précédait un `updateMany` qui filtrait déjà par condition. Le `findFirst` était du code mort : si aucun enregistrement ne matchait la condition, le `updateMany` ne faisait rien de toute façon.

**Cause racine :**
Dans le cas 1 : `creerNotificationSiAbsente` inclut déjà une vérification interne d'unicité. La pré-vérification externe dupliquait cette logique.

Dans le cas 2 : un `updateMany` avec clause `where` est par nature conditionnel — il ne met à jour que les lignes qui matchent et ne lève pas d'erreur si aucune ne matche. Un `findFirst` préalable n'ajoute aucune garantie.

**Fix :**
Cas 1 : Supprimer la pré-vérification, déléguer entièrement la logique à la fonction appelée.

Cas 2 : Supprimer le `findFirst`. Laisser le `updateMany` gérer seul la condition :
```typescript
// Inutile (code mort) :
const existing = await prisma.foo.findFirst({ where: { id, siteId, statut: "ACTIF" } });
if (!existing) return; // updateMany ferait de toute façon 0 lignes
await prisma.foo.updateMany({ where: { id, siteId, statut: "ACTIF" }, data: { statut: "INACTIF" } });

// Correct :
await prisma.foo.updateMany({ where: { id, siteId, statut: "ACTIF" }, data: { statut: "INACTIF" } });
```

**Leçon / Règle :**
Avant d'ajouter une vérification en amont d'un appel, se demander : "que se passe-t-il si cette vérification retourne faux/vide ?". Si la réponse est "l'opération suivante ne fait rien de toute façon", la pré-vérification est du code mort. Une double vérification identique double le nombre de requêtes DB sans garantie supplémentaire et donne une fausse impression de sécurité.

---

### ERR-014 — Boucle de updateMany séquentiels sans $transaction (R4)
**Sprint :** 36 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/lib/services/abonnement-lifecycle.ts`

**Symptôme :**
Un CRON job exécutait une boucle `for` de plusieurs `updateMany` séquentiels sans transaction globale. Un crash ou une erreur en milieu de boucle laissait la base dans un état partiellement mis à jour (certains abonnements transitionnnés, d'autres non).

**Cause racine :**
Chaque `updateMany` est atomique individuellement, mais une séquence de `updateMany` dans une boucle sans `$transaction` n'est pas atomique globalement. Une interruption entre deux itérations produit une exécution partielle.

**Fix :**
Collecter toutes les opérations dans un tableau, puis les envelopper dans `prisma.$transaction([...])` (forme batch) :

```typescript
// Avant (non-atomique) :
for (const operation of operations) {
  await prisma.abonnement.updateMany({ where: operation.where, data: operation.data });
}

// Après (atomique) :
const updates = operations.map((operation) =>
  prisma.abonnement.updateMany({ where: operation.where, data: operation.data })
);
await prisma.$transaction(updates);
```

**Leçon / Règle :**
R4 s'applique aussi aux boucles : quand plusieurs `updateMany` (ou autres opérations Prisma) doivent s'exécuter ensemble, toujours les regrouper dans `prisma.$transaction([...])`. L'atomicité individuelle de chaque opération ne suffit pas — c'est l'ensemble de la séquence qui doit être atomique.

---

### ERR-013 — Rate limiting en mémoire non partagé entre instances serverless
**Sprint :** 35 | **Date :** 2026-03-21
**Sévérité :** Basse (dev/staging), Moyenne (production)
**Fichier(s) :** `src/app/api/remises/verifier/route.ts`

**Symptôme :**
En production avec plusieurs instances serverless (Vercel), le rate limiting via `Map` en mémoire n'est pas partagé entre les instances. Un même utilisateur peut dépasser la limite en envoyant des requêtes sur des instances différentes.

**Cause racine :**
Chaque instance serverless a sa propre mémoire. La `Map` est locale à l'instance.

**Fix pour production :**
Utiliser un store partagé comme Redis (Upstash) ou le middleware Vercel pour le rate limiting.

```typescript
// Alternative avec Upstash Redis :
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
});
```

**Leçon / Règle :**
Le rate limiting in-memory est acceptable en Phase 2 (dev/staging). Pour la production, migrer vers un store partagé avant le déploiement final.

---

### ERR-019 — R6 : couleurs Tailwind hardcodées dans les composants PWA (pattern systémique)
**Sprint :** 27, 29, 30, 31 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/app/~offline/page.tsx`, `src/components/sw-register.tsx`, `src/components/install-prompt.tsx`, `src/components/sync-status-panel.tsx`, `src/components/offline-indicator.tsx`

**Symptôme :**
Les composants PWA utilisent des classes Tailwind avec des couleurs en dur : `bg-teal-600`, `text-teal-600`, `bg-white`, `text-gray-400`. Le thème dark mode et toute modification de la palette de couleurs ne se propagent pas à ces composants.

**Cause racine :**
Lors de la création de nouveaux composants standalone (page offline, bannière SW, indicateurs sync), les développeurs ont utilisé les couleurs Tailwind directes au lieu des classes de thème. Ce pattern se répète sur tous les sprints PWA (27, 29, 30, 31), indiquant que la règle R6 n'est pas consultée lors de l'écriture des nouveaux composants.

**Fix :**
Remplacer systématiquement les couleurs Tailwind directes par leurs équivalents de thème :
- `bg-teal-600` → `bg-primary`
- `text-teal-600` → `text-primary`
- `bg-white` → `bg-background`
- `text-gray-400` → `text-muted-foreground`
- `text-gray-600` → `text-foreground`
- `border-gray-200` → `border-border`

**Leçon / Règle :**
R6 : Jamais de couleurs Tailwind directes (teal-*, gray-*, white, black) dans les composants. Toujours utiliser les classes de thème (`bg-primary`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.). Les composants PWA (offline, SW, install prompt, sync panel) sont des composants UI comme les autres et soumis aux mêmes règles. Pendant la creation d'un nouveau composant, chercher toute occurrence de `-teal-`, `-gray-`, `bg-white`, `text-white` avant de terminer.

---

### ERR-020 — R2 : string literal "MORTALITE" au lieu de TypeReleve.MORTALITE dans un service
**Sprint :** 29 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/lib/services/releve.service.ts` (ligne 57)

**Symptôme :**
Le service utilise la string `"MORTALITE"` en dur pour filtrer les relevés de mortalité. Si la valeur de l'enum TypeReleve change ou est renommée, TypeScript ne détecte pas la régression dans ce fichier.

**Cause racine :**
R2 est souvent respecté dans les routes API et les requêtes Prisma, mais oublié dans les services métier où les comparaisons de type sont moins visibles. Les services reçoivent souvent des données typées depuis Prisma et comparent avec des strings en dur sans importer l'enum.

**Fix :**
```typescript
// Incorrect :
if (releve.typeReleve === "MORTALITE") { ... }

// Correct :
import { TypeReleve } from "@/types";
if (releve.typeReleve === TypeReleve.MORTALITE) { ... }
```

**Leçon / Règle :**
R2 s'applique dans TOUS les fichiers sans exception : routes API, services, queries, hooks, composants. Dans les services métier en particulier, auditer systématiquement les comparaisons `=== "VALEUR"` sur des champs qui correspondent à des enums. Utiliser `TypeReleve.MORTALITE`, jamais `"MORTALITE"`.

---

### ERR-021 — Securite crypto : unwrapDataKey retourne une cle extractable
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Haute (securite)
**Fichier(s) :** `src/lib/offline/crypto.ts`

**Symptôme :**
La fonction `unwrapDataKey` appelle `crypto.subtle.unwrapKey` avec `extractable: true`. Cela signifie que la cle dechiffree peut etre exportee hors du contexte WebCrypto par n'importe quel code JavaScript ayant acces a l'objet `CryptoKey`, y compris du code malveillant injecte (XSS).

**Cause racine :**
La valeur par defaut ou une copie depuis un exemple d'unwrap a conserve `extractable: true`. La difference entre `true` et `false` est subtile visuellement mais critique pour la securite.

**Fix :**
```typescript
// Incorrect (cle exportable hors WebCrypto) :
const dataKey = await crypto.subtle.unwrapKey(
  "raw", wrappedKey, kek,
  { name: "AES-KW" },
  { name: "AES-GCM" },
  true,        // extractable — DANGEREUX
  ["encrypt", "decrypt"]
);

// Correct (cle confinee dans WebCrypto) :
const dataKey = await crypto.subtle.unwrapKey(
  "raw", wrappedKey, kek,
  { name: "AES-KW" },
  { name: "AES-GCM" },
  false,       // extractable: false — cle non exportable
  ["encrypt", "decrypt"]
);
```

**Leçon / Règle :**
Dans toute utilisation de `crypto.subtle.importKey`, `crypto.subtle.unwrapKey` ou `crypto.subtle.generateKey`, poser `extractable: false` sauf si l'export explicite de la cle est necessaire (ex: sauvegarde). Les cles de chiffrement de donnees utilisateur ne doivent jamais etre exportables. Auditer tous les appels WebCrypto lors de chaque code review de la couche crypto.

---

### ERR-022 — Securite : delai exponentiel absent apres echecs de PIN (tentatives 3 a 5)
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Haute (securite)
**Fichier(s) :** `src/lib/offline/auth-cache.ts`

**Symptôme :**
La validation du PIN offline n'applique pas de delai exponentiel entre les tentatives 3 et 5. Un attaquant peut bruteforcer un PIN a 4 chiffres (10 000 combinaisons) sans contrainte de temps apres 2 echecs.

**Cause racine :**
L'ADR definissait ce comportement (blocage progressif des tentatives 3-5) mais l'implementation dans `auth-cache.ts` ne l'a pas inclus. Le compteur d'echecs est maintenu mais le delai correspondant n'est pas applique.

**Fix :**
Apres verification du nombre d'echecs, appliquer un delai avant de retourner la reponse :
```typescript
const DELAYS_MS = [0, 0, 0, 2_000, 5_000, 10_000]; // index = nb echecs

async function verifyPin(pin: string): Promise<boolean> {
  const meta = await getAuthMeta();
  const failCount = meta.failedAttempts ?? 0;
  const delay = DELAYS_MS[Math.min(failCount, DELAYS_MS.length - 1)];
  if (delay > 0) await new Promise(r => setTimeout(r, delay));
  // ... verification PBKDF2 ...
}
```

**Leçon / Règle :**
Toute interface de validation de secret (PIN, code, mot de passe) doit implementer un delai exponentiel cote serveur/service — pas uniquement cote UI. Si l'ADR specifie un comportement de securite, l'implementation doit l'inclure explicitement. Lors de la review d'une couche d'authentification, verifier que chaque spec de securite de l'ADR a un test de non-regression correspondant.

---

### ERR-023 — R8 : RefRecord sans siteId dans la couche de cache offline (fuite multi-tenant)
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Haute (multi-tenancy)
**Fichier(s) :** `src/lib/offline/ref-cache.ts`, `src/lib/offline/db.ts`

**Symptôme :**
Le modele `RefRecord` (donnees de reference mises en cache dans IndexedDB) ne possede pas de champ `siteId`. Un utilisateur membre de plusieurs sites peut lire les donnees de reference d'un site dans le contexte d'un autre site. La fonction `clearSiteRefData` efface tous les sites faute de filtre.

**Cause racine :**
R8 ("siteId PARTOUT") est bien applique aux modeles Prisma mais pas aux interfaces TypeScript des structures IndexedDB offline. Les structures de cache cote client sont des "modeles" au sens large et doivent aussi isoler les donnees par site.

**Fix :**
Ajouter `siteId: string` au type `RefRecord` et a tous les stores IndexedDB contenant des donnees multi-tenant. Toutes les fonctions de lecture/ecriture doivent filtrer par `siteId`. La fonction `clearSiteRefData` doit accepter un `siteId` en parametre et ne supprimer que les entrees correspondantes :
```typescript
interface RefRecord {
  id: string;
  siteId: string;   // OBLIGATOIRE — R8
  type: string;
  data: unknown;
  cachedAt: number;
}

async function clearSiteRefData(siteId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("refData", "readwrite");
  const index = tx.store.index("by-site");
  const keys = await index.getAllKeys(siteId);
  await Promise.all(keys.map(k => tx.store.delete(k)));
}
```

**Leçon / Règle :**
R8 s'applique a TOUTES les structures de donnees qui stockent des informations metier : modeles Prisma, interfaces TypeScript, stores IndexedDB, caches locaux, fichiers JSON. Toute structure contenant des donnees qui appartiennent a un site doit avoir `siteId`. Le mode offline ne fait pas exception : les donnees isolees en base doivent l'etre aussi en cache local.

---

### ERR-024 — R4 : count + put non atomique dans la queue offline (race condition)
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/offline/queue.ts`

**Symptôme :**
La fonction `enqueue` effectue un `count` des items en attente puis un `put` pour ajouter le nouvel item en deux operations IndexedDB separees. Sous acces concurrent (deux onglets, deux requetes simultanees), deux `count` peuvent retourner la meme valeur avant que l'un des `put` ne soit execute, permettant de depasser la limite de la queue.

**Cause racine :**
R4 ("operations atomiques") est applique aux mutations Prisma mais oublié pour les operations IndexedDB. La transaction IndexedDB existe pour exactement ce cas : grouper count + put dans une seule transaction garantit l'atomicite.

**Fix :**
Encapsuler `count` et `put` dans la meme transaction IndexedDB :
```typescript
async function enqueue(item: QueueItem): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("queue", "readwrite");
  const count = await tx.store.count();
  if (count >= MAX_QUEUE_SIZE) {
    tx.abort();
    throw new Error("QUEUE_FULL");
  }
  await tx.store.put(item);
  await tx.done;
}
```

**Leçon / Règle :**
R4 s'applique aussi aux operations IndexedDB : count + put, get + put, et tout pattern check-then-write doit s'executer dans la meme transaction IndexedDB. IndexedDB dispose de transactions pour cette raison. Ne pas confondre "base de donnees locale" avec "pas besoin d'atomicite".

---

### ERR-025 — Sync : delai de retry calcule depuis createdAt au lieu de lastAttemptAt
**Sprint :** 29-30 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/lib/offline/sync.ts` (ligne 106), `src/lib/offline/db.ts`, `src/lib/offline/queue.ts`

**Symptôme :**
Le calcul du delai de backoff exponentiel entre les tentatives de synchronisation utilise `createdAt` (date de creation de l'item dans la queue) au lieu de `lastAttemptAt` (date de la derniere tentative). Un item cree il y a plusieurs heures mais avec une seule tentative recente peut se voir attribuer un delai incorrect, causant soit des retries trop frequents soit des retries indefiniment bloques.

**Cause racine :**
Le champ `lastAttemptAt` n'existe pas dans le schema `QueueItem` dans `db.ts`. La logique de retry dans `sync.ts` utilise le seul timestamp disponible (`createdAt`) faute d'alternative. C'est a la fois un bug de schema et un bug de logique.

**Fix :**
1. Ajouter `lastAttemptAt: number | null` au type `QueueItem` dans `db.ts`.
2. Mettre a jour `lastAttemptAt` a chaque tentative dans `sync.ts` (via un `put` avant de tenter la requete).
3. Calculer le delai de retry depuis `lastAttemptAt` (ou `createdAt` si `lastAttemptAt` est null pour la premiere tentative) :
```typescript
const baseTime = item.lastAttemptAt ?? item.createdAt;
const delay = Math.min(BASE_DELAY_MS * 2 ** item.retryCount, MAX_DELAY_MS);
if (Date.now() - baseTime < delay) continue; // pas encore le moment
```

**Leçon / Règle :**
Dans tout systeme de retry avec backoff, le delai doit etre calcule depuis le dernier echec (`lastAttemptAt`), pas depuis la creation (`createdAt`). Ces deux timestamps ont des semantiques differentes. Lors de la conception d'un schema de queue, toujours inclure `lastAttemptAt`, `retryCount` et `status` comme champs obligatoires.

---

### ERR-026 — TypeScript : IdempotencyResult non discrimine — statusCode potentiellement undefined
**Sprint :** 29-30 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/offline/idempotency.ts`

**Symptôme :**
Le type `IdempotencyResult` n'est pas une union discriminante. Le champ `statusCode` peut etre `undefined` meme dans les branches ou il est attendu. TypeScript ne peut pas affiner le type dans les switch/if, forcant des assertions non nulles (`!`) ou des verifications redondantes.

**Cause racine :**
Le type a ete defini comme une interface plate avec des champs optionnels au lieu d'une union discriminante avec un champ litterale commun (`kind` ou `type`).

**Fix :**
Refactoriser en union discriminante :
```typescript
// Incorrect (interface plate) :
interface IdempotencyResult {
  found: boolean;
  statusCode?: number;
  body?: unknown;
}

// Correct (union discriminante) :
type IdempotencyResult =
  | { kind: "HIT"; statusCode: number; body: unknown }
  | { kind: "MISS" };

// Usage :
if (result.kind === "HIT") {
  return new Response(JSON.stringify(result.body), { status: result.statusCode });
  // TypeScript sait que statusCode est number ici
}
```

**Leçon / Règle :**
Toute interface representant un resultat a plusieurs etats mutuellement exclusifs (trouve/non trouve, succes/echec, ok/erreur) doit etre une union discriminante TypeScript avec un champ litterale (`kind`, `type`, `status`). Les interfaces plates avec champs optionnels forcent des verifications defensives a chaque usage et masquent les etats invalides. Lors de la creation d'un type de resultat, se demander : "tous les champs ont-ils du sens dans tous les etats ?" Si non, utiliser une union discriminante.

---

### ERR-027 — API deprecie : navigator.platform au lieu de navigator.userAgentData
**Sprint :** 29-31 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/hooks/use-install-prompt.ts` (ligne 48)

**Symptôme :**
Le hook utilise `navigator.platform` pour detecter iOS et ainsi conditionner l'affichage du prompt d'installation PWA. `navigator.platform` est marque comme deprecie dans les specs et peut retourner des valeurs incorrectes ou vides sur les navigateurs recents.

**Cause racine :**
`navigator.platform` etait la solution standard pour la detection de plateforme avant l'introduction de `navigator.userAgentData`. Son utilisation persiste par habitude ou copie d'exemples anciens.

**Fix :**
Utiliser `navigator.userAgentData` avec fallback sur `navigator.platform` pour la compatibilite :
```typescript
function isIOS(): boolean {
  // Priorite a l'API moderne (Chrome 90+, Edge 90+)
  if ("userAgentData" in navigator) {
    return (navigator as Navigator & { userAgentData: { platform: string } })
      .userAgentData.platform === "iOS";
  }
  // Fallback legacy
  return /iPhone|iPad|iPod/.test(navigator.platform);
}
```

**Leçon / Règle :**
Ne pas utiliser `navigator.platform` dans le nouveau code. Utiliser `navigator.userAgentData.platform` (avec fallback) pour la detection de plateforme. Plus generalement, avant d'utiliser une API navigateur, verifier son statut de depreciation sur MDN. Les APIs deprecated peuvent disparaitre silencieusement dans les mises a jour navigateur.

---

### ERR-032 — Next.js 16+ : `revalidateTag` requiert 2 arguments (faux positif de review)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Basse (faux positif)
**Fichier(s) :** `src/app/api/*/route.ts`, tout fichier appelant `revalidateTag`

**Symptôme :**
Un reviewer signale `revalidateTag(tag, {})` comme un bug ("le deuxième argument n'existe pas"). Mais le build passe sans erreur et l'invalidation fonctionne correctement.

**Cause racine :**
L'API `revalidateTag` a changé entre les versions Next.js. En Next.js 14, la signature est `revalidateTag(tag: string)` (1 argument). En Next.js 16.1.6+, la signature est `revalidateTag(tag: string, profile: string | CacheLifeConfig)` (2 arguments requis). Passer `{}` comme deuxième argument est valide pour le profil par défaut.

**Fix :**
Aucun fix nécessaire si le projet utilise Next.js 16.1.6+. Vérifier la version dans `package.json` avant de signaler ce pattern comme bug.

**Leçon / Règle :**
Avant de signaler l'usage d'un argument "non existant" sur une API Next.js, vérifier la version du package dans `package.json`. Les signatures des APIs Next.js évoluent entre versions majeures. Un appel à `revalidateTag(tag, {})` est correct en Next.js 16+ et incorrect en Next.js 14. Ne pas supposer la version à partir de la documentation en ligne — lire `package.json` en priorité.

---

### ERR-031 — R2 : `as keyof typeof` pour accéder à un objet constant indexé par enum (Story 46.1)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/abonnements/check-subscription.ts`

**Symptôme :**
Accès à `PLAN_LIMITES` via `PLAN_LIMITES[plan.typePlan as keyof typeof PLAN_LIMITES]`. Pas d'erreur TypeScript immédiate mais le cast `as keyof typeof` contourne le système de types : si la valeur de l'enum ou le type de l'objet constant divergent, le compilateur ne détecte pas la régression.

Variante additionnelle (Stories 46.2-46.3) : `PLAN_LIMITES[plan.typePlan as string]`. Le cast `as string` est encore plus permissif que `as keyof typeof` — TypeScript n'émet aucune erreur mais l'accès est complètement découplé du système de types. Les deux casts (`as string` et `as keyof typeof`) sont des violations R2 équivalentes.

**Cause racine :**
Variante de la violation R2 déjà documentée en ERR-018 : au lieu d'une string littérale en dur, on utilise ici un cast de type pour accéder à l'objet constant. Le résultat est identique — la valeur d'enum n'est pas utilisée via l'enum importé, ce qui découple l'accès du système de types.

**Fix :**
```typescript
// Incorrect — cast as keyof typeof :
const limites = PLAN_LIMITES[plan.typePlan as keyof typeof PLAN_LIMITES];

// Incorrect — cast as string (tout aussi problématique) :
const limites = PLAN_LIMITES[plan.typePlan as string];

// Correct (enum comme clé, avec import explicite) :
import { TypePlan } from "@/types";
const limites = PLAN_LIMITES[plan.typePlan as TypePlan];
// ou, si la valeur est une constante connue :
const limites = PLAN_LIMITES[TypePlan.DECOUVERTE];
```

**Leçon / Règle :**
Voir ERR-018 pour la règle générale. Cette entrée couvre deux variantes du même anti-pattern : `as keyof typeof OBJ` et `as string`. Les deux sont des violations R2. Toujours utiliser `as TypeEnum` (le type de l'enum importé) si un cast est nécessaire. Si l'objet constant est `Record<TypePlan, ...>`, TypeScript accepte directement `PLAN_LIMITES[valeurTypee]` sans cast dès que la variable est typée `TypePlan`.

**Voir aussi :** ERR-018 (même pattern avec string littérale en dur), Sprint 37.

---

### ERR-030 — R4 : quota check + création de ressource dans des transactions séparées (Story 46.1)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/vagues/route.ts`

**Symptôme :**
La route `POST /api/vagues` effectuait le check de quota dans une fonction externe (`checkSubscription`) puis créait la vague dans un appel Prisma séparé. Deux requêtes concurrentes peuvent passer le check simultanément et créer toutes les deux une vague, dépassant silencieusement la limite du plan.

**Cause racine :**
Nouveau pattern de violation R4 : la séparation n'est pas un `findFirst` + `update` classique (ERR-005) mais un appel de service externe + create. La logique de quota est encapsulée dans `checkSubscription`, ce qui masque le fait que check et création ne sont pas dans la même transaction.

**Fix :**
Inliner la création de la vague à l'intérieur de la même `$transaction` que le check de quota, sur le modèle de la route `/api/bacs` :

```typescript
// Avant (non-atomique) :
const quotaCheck = await checkSubscription(siteId, "VAGUE");
if (!quotaCheck.allowed) return NextResponse.json(..., { status: 403 });
const vague = await prisma.vague.create({ data });

// Après (atomique) :
const vague = await prisma.$transaction(async (tx) => {
  const count = await tx.vague.count({ where: { siteId } });
  if (count >= plan.limiteVagues) throw new Error("QUOTA_ATTEINT");
  return tx.vague.create({ data });
});
```

**Leçon / Règle :**
R4 s'applique dès que la décision de créer/modifier dépend d'un état lu en base, même si le check est encapsulé dans une fonction de service externe. L'encapsulation ne confère pas l'atomicité. Avant d'appeler un service de check suivi d'une mutation, se demander : "ces deux opérations sont-elles dans la même transaction ?". Si non, et si la cohérence est requise, les réunir dans `prisma.$transaction`.

**Voir aussi :** ERR-016 (même pattern sur `/api/bacs`, fix de référence), ERR-005 (R4 générale).

---

### ERR-029 — Double `unstable_cache` imbriqué sur le même tag (anti-pattern cache)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/abonnements.ts`, `src/lib/abonnements/check-subscription.ts`

**Symptôme :**
Deux fonctions wrappent leur résultat avec `unstable_cache` en utilisant le même tag (ex: `["abonnement", siteId]`). La fonction de plus haut niveau (`checkSubscription`) encapsule une fonction déjà cachée (`getAbonnementActif`). Les deux caches peuvent diverger : une invalidation via `revalidateTag` purge le cache interne mais pas nécessairement le cache externe, ou vice versa, selon l'ordre d'appel et la durée de vie respective.

**Cause racine :**
Le wrapping `unstable_cache` a été appliqué mécaniquement à plusieurs niveaux d'abstraction sans vérifier si les niveaux inférieurs étaient déjà cachés. Le cache Next.js `unstable_cache` est composable mais pas transparent : deux caches imbriqués avec le même tag ne se comportent pas comme un seul cache — ils créent deux entrées distinctes dans le cache Next.js.

**Fix :**
Cacher uniquement au niveau le plus bas (la requête Prisma), pas au niveau du wrapper de service :

```typescript
// src/lib/queries/abonnements.ts — cache ici (niveau bas) :
export const getAbonnementActif = unstable_cache(
  async (siteId: string) => prisma.abonnement.findFirst({ where: { siteId, statut: "ACTIF" } }),
  ["abonnement-actif"],
  { tags: ["abonnement"] }
);

// src/lib/abonnements/check-subscription.ts — PAS de cache ici (niveau haut) :
export async function checkSubscription(siteId: string, ressource: string) {
  const abonnement = await getAbonnementActif(siteId); // déjà caché
  // ... logique de check ...
}
```

**Leçon / Règle :**
`unstable_cache` se place au niveau de la requête de données (queries), pas au niveau des fonctions de service ou des wrappers de logique métier. Si une fonction de service appelle une query déjà cachée, ne pas ajouter un deuxième `unstable_cache` sur le service. Un seul niveau de cache par chemin de données. Les tags d'invalidation (`revalidateTag`) ne traversent pas les caches imbriqués de façon fiable.

---

### ERR-035 — Filter-before-map : filtrer les nullables avant le mapping, pas après (FCR refactor)
**Sprint :** ADR-028 | **Date :** 2026-04-05
**Sévérité :** Basse
**Fichier(s) :** `src/lib/calculs/fcr.ts` (ou équivalent calculs aliment)

**Symptôme :**
`biometriePoints` était construit avec `.map(b => b.poids ?? 0).filter(p => p > 0)`. Si le `.filter` est un jour retiré par erreur (refactoring, simplification), des valeurs `0` silencieuses entrent dans les calculs de biomasse ou d'interpolation, produisant des résultats faux sans erreur TypeScript ni runtime.

**Cause racine :**
Le mapping transforme `null` en `0` avant le filtre, créant un état intermédiaire sémantiquement incorrect (`0` n'est pas la même chose que "donnée absente"). La correction de l'absence est portée par le `.filter` qui suit, mais ce couplage est fragile : retirer le filtre ne produit aucun avertissement.

**Fix :**
Filtrer les nulls avant le mapping :
```typescript
// Incorrect (filter après map — fragile) :
const biometriePoints = biometries
  .map(b => b.poids ?? 0)
  .filter(p => p > 0);

// Correct (filter avant map — robuste) :
const biometriePoints = biometries
  .filter((b): b is typeof b & { poids: number } => b.poids !== null && b.poids > 0)
  .map(b => b.poids);
```

**Leçon / Règle :**
Ne jamais transformer une valeur nulle en valeur sentinelle (0, "", -1) pour la filtrer ensuite. Filtrer les nulls en premier avec un type guard, puis mapper uniquement des valeurs valides. Le pattern `map(null → 0).filter(> 0)` est sémantiquement incorrect et fragile : un refactoring anodin qui retire le filtre introduit silencieusement des données invalides dans les calculs.

---

### ERR-034 — Agrégation de qualité/confiance : utiliser le pire cas, pas le meilleur (FCR refactor)
**Sprint :** ADR-028 | **Date :** 2026-04-05
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/calculs/fcr.ts` (ou équivalent calculs aliment)

**Symptôme :**
La `methodeEstimation` d'une période était dérivée en prenant le `max` du rang de précision des méthodes utilisées aux deux bornes de la période (biométrie exacte > interpolation > extrapolation). Utiliser le max revient à annoncer la méthode la plus précise, ce qui surestime la confiance réelle de l'estimation.

**Cause racine :**
L'intuition "prendre le max pour avoir la meilleure représentation" est incorrecte pour une métrique de qualité/confiance où la qualité de l'ensemble est limitée par le maillon le plus faible. Si une borne de la période est extrapolée, toute la période est de qualité "extrapolation", peu importe la précision de l'autre borne.

**Fix :**
Utiliser `min` (pire cas) pour l'agrégation de méthodes d'estimation :
```typescript
// Incorrect (max = surclasse la confiance réelle) :
const methodeEstimation = [methodeDebut, methodeFin]
  .map(m => PRECISION_RANK[m])
  .reduce((a, b) => Math.max(a, b));

// Correct (min = conservateur, borne inférieure de qualité) :
const methodeEstimation = [methodeDebut, methodeFin]
  .map(m => PRECISION_RANK[m])
  .reduce((a, b) => Math.min(a, b));
```

**Leçon / Règle :**
Quand on agrège des indicateurs de qualité, précision ou confiance provenant de plusieurs sources, toujours utiliser le **pire cas** (min, worst-case) comme valeur consolidée. La qualité globale est limitée par l'estimation la moins précise, pas par la plus précise. Ce principe s'applique à toute fonction d'estimation, interpolation, ou calcul basé sur plusieurs points de mesure de qualités hétérogènes.

---

### ERR-033 — Interpolation : extrapolation étiquetée "BIOMETRIE_EXACTE" (FCR refactor)
**Sprint :** ADR-028 | **Date :** 2026-04-05
**Sévérité :** Haute
**Fichier(s) :** `src/lib/calculs/fcr.ts` (ou équivalent calculs aliment)

**Symptôme :**
La fonction `interpolerPoidsBac` retournait `methode: "BIOMETRIE_EXACTE"` lorsque la date cible était postérieure à toutes les biométries disponibles (cas d'extrapolation). L'appelant recevait une estimation extrapolée avec une étiquette de confiance maximale, ce qui pouvait conduire à des décisions basées sur des données présentées comme plus fiables qu'elles ne l'étaient.

**Cause racine :**
La branche de code gérant le cas "date cible après la dernière biométrie" copiait le retour de la branche "date cible exactement sur un point de mesure" (match exact = `BIOMETRIE_EXACTE`) sans adapter la valeur de `methode`. L'extrapolation et la lecture exacte étaient traitées de façon identique dans le label retourné.

**Fix :**
Retourner `"INTERPOLATION_LINEAIRE"` (ou un label dédié `"EXTRAPOLATION"`) pour les cas hors des bornes connues :
```typescript
// Incorrect (extrapolation labellisée comme lecture exacte) :
if (dateTarget > dernierPoint.date) {
  return { poids: dernierPoint.poids, methode: "BIOMETRIE_EXACTE" }; // FAUX
}

// Correct (label reflète la nature de l'estimation) :
if (dateTarget > dernierPoint.date) {
  return { poids: dernierPoint.poids, methode: "INTERPOLATION_LINEAIRE" };
  // ou : methode: "EXTRAPOLATION" si le type le supporte
}
```

**Leçon / Règle :**
Dans toute fonction d'interpolation/extrapolation, chaque branche de retour doit porter un label `methode` qui correspond à ce que la branche fait réellement :
- Date exacte sur un point mesuré → `"BIOMETRIE_EXACTE"`
- Date entre deux points → `"INTERPOLATION_LINEAIRE"`
- Date avant ou après toutes les mesures → `"INTERPOLATION_LINEAIRE"` ou `"EXTRAPOLATION"` (jamais `"BIOMETRIE_EXACTE"`)

L'exactitude du label de méthode est aussi importante que l'exactitude de la valeur calculée : les appelants utilisent ce label pour communiquer la confiance aux utilisateurs finaux.

---

### ERR-028 — SW : listener controllerchange non retire au cleanup du composant React
**Sprint :** 27 | **Date :** 2026-03-21
**Sévérité :** Basse (fuite memoire)
**Fichier(s) :** `src/components/sw-register.tsx`

**Symptôme :**
Le `useEffect` qui enregistre le Service Worker ajoute un listener `controllerchange` sur `navigator.serviceWorker` mais ne le retire pas dans la fonction de cleanup. En mode strict React (double montage/demontage en dev) ou lors de la navigation, le listener s'accumule et peut declencher des rappels multiples lors d'un changement de controleur.

**Cause racine :**
Le pattern `addEventListener` sans `removeEventListener` correspondant dans le return du `useEffect` est une fuite memoire classique. Particulierement impactant ici car `navigator.serviceWorker` est un objet global — le listener persiste apres le demontage du composant.

**Fix :**
```typescript
useEffect(() => {
  if (!("serviceWorker" in navigator)) return;

  const handleControllerChange = () => {
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

  // Cleanup obligatoire — evite les fuites et les doubles declenchements
  return () => {
    navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
  };
}, []);
```

**Leçon / Règle :**
Tout `addEventListener` dans un `useEffect` React doit avoir son `removeEventListener` correspondant dans le return du cleanup. Cette regle s'applique a tous les objets globaux (window, document, navigator.serviceWorker, etc.). Les objets globaux ne sont pas garbage collectes avec le composant — leurs listeners survivent au demontage. Verifier systematiquement chaque `useEffect` contenant un `addEventListener` lors de la review de composants PWA/SW.
