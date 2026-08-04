# Review — Story PR2oct.2 (SCHEMA)

## Périmètre reviewé
- `prisma/schema.prisma` — `VaguePrevue.alevinsAchetes Boolean @default(false)` (lignes 4590-4602) et `ParametresPrevision.alevinsAchetesParDefaut Boolean @default(false)` (lignes 4442-4451).
- `prisma/migrations/20260805090000_add_vague_prevue_alevins_achetes/migration.sql`.
- Vérification annexe : `src/types/models.ts`, `docs/knowledge/ERRORS-AND-FIXES.md`, `src/lib/previsions/**`, `src/lib/queries/previsions-scenario-loader.ts`, `src/components/previsions/**`, `src/messages/**`.

## Checklist R1-R11

| Règle | Verdict | Justification |
|---|---|---|
| R1 (enums MAJUSCULES) | N/A | Aucun nouvel enum — deux `Boolean`, cohérent avec la nature binaire du besoin (§4.3). |
| R2 (import des enums) | N/A | Pas d'enum en jeu. |
| R3 (Prisma = TypeScript identiques) | **VIOLÉ** | `prisma/schema.prisma:4451` et `prisma/schema.prisma:4602` existent côté Prisma, mais sont **absents** de `src/types/models.ts` — `interface ParametresPrevision` (`src/types/models.ts:4232-4273`) et `interface VaguePrevue` (`src/types/models.ts:4419-4444`) ne portent aucun des deux champs. |
| R4 (opérations atomiques) | Conforme | L'`UPDATE` de `prixAlevinUnitaireFCFA` (migration.sql:51-56) est une opération ensembliste unique conditionnée dans son `WHERE`, pas un check-then-update applicatif. |
| R5 (DialogTrigger asChild) | N/A | Aucun composant UI dans le périmètre. |
| R6 (CSS variables du thème) | N/A | Aucun style dans le périmètre. |
| R7 (nullabilité explicite) | Conforme | Les deux champs sont `Boolean NOT NULL DEFAULT false`, jamais `Boolean?`. Le défaut `false` est justifié par le jeu d'or (19/19 vagues `alevinsAchetes: "NON"`) et la non-régression (~46 M FCFA, ADR-053 §14.3). |
| R8 (siteId partout) | Conforme, avec nuance préexistante | `VaguePrevue` porte déjà `siteId` (`prisma/schema.prisma:4610-4611`). `ParametresPrevision` n'a pas de `siteId` propre (relation 1-1 stricte avec `ScenarioPrevision`, qui le porte) — état préexistant, ni introduit ni aggravé par cette story. |
| R9 (tests avant review) | **Non vérifiable par le reviewer** | Aucun rapport de test dédié à cette story dans le périmètre transmis ; le reviewer n'a pas d'outil d'exécution. À confirmer par @tester avant clôture. |
| R10 (correctif de données = migration versionnée) | Conforme | Migration dans un sous-dossier `prisma/migrations/20260805090000_add_vague_prevue_alevins_achetes/migration.sql` (pas de `.sql` à la racine). Le `DO $$ ... IF NOT EXISTS ... ADD COLUMN` est correct et idempotent. L'`UPDATE` (migration.sql:51-56) pose une **valeur cible** (`= 70`, jamais un delta), est **no-op silencieux** si `EXCEL-V12` est absent (jointure vide), et sa clause `AND pp."prixAlevinUnitaireFCFA" = 0` est un choix sain et documenté : elle cible précisément l'état constaté au snapshot, sans écraser une valeur différente saisie légitimement ailleurs. |
| R11 (aucun secret en dur) | Conforme | Aucune URL de connexion ni identifiant dans `migration.sql` ni `schema.prisma`. Le snapshot rappelle explicitement l'absence de reproduction d'URL/mot de passe. |

## Constats

### Haute
1. **R3 non respecté — miroir TypeScript incomplet.** `src/types/models.ts:4232-4273` (`ParametresPrevision`) et `src/types/models.ts:4419-4444` (`VaguePrevue`) ne déclarent ni `alevinsAchetesParDefaut` ni `alevinsAchetes`, alors que la pré-analyse (§8) le demandait explicitement. Conséquence : TypeScript étant structurel, une interface incomplète ne bloque pas l'assignation d'un objet qui a *plus* de champs — aucune erreur de compilation, donc terrain de régression silencieuse pour la story MOTEUR, dans l'esprit d'ADR-053 §14.7.

### Moyenne
2. **Entrée `ERRORS-AND-FIXES.md` manquante.** La pré-analyse (§8) demandait une entrée signalant le constat §7/§14.7 (recette structurellement aveugle au coût d'achat des alevins). `grep "alevinsAchetes" docs/knowledge/ERRORS-AND-FIXES.md` ne retourne aucune occurrence — seul l'ADR-053 §14.7 porte ce constat. L'ADR documente la décision de conception mais ne remplace pas le catalogue numéroté ERR-XXX.
3. **R9 non vérifiable en l'état.** Aucun rapport de test propre à PR2oct.2 transmis ; à faire lever par @tester avant clôture du sprint.

### Basse
4. **Commentaires Prisma de qualité** (remarque positive, aucune action) : `schema.prisma:4591-4601` et `4442-4450` documentent la provenance de la valeur (patron `effectifAlevinsPrevu`), la règle de copie en cas de scission, et le chiffre de non-régression (~46 M FCFA), alignant le code sur ADR-053 §14.2-14.3.

## Portée (débordement de périmètre)
`Grep` sur `alevinsAchetes` : aucune occurrence dans `src/lib/previsions/route-orchestration.ts`, `src/lib/queries/previsions-scenario-loader.ts`, `src/components/previsions/**`, ni `src/messages/**`. Les occurrences hors `prisma/` sont préexistantes et sans lien avec le champ Prisma : `src/lib/previsions/__tests__/recette/helpers.ts:62` et `orchestration.ts:523` référencent le champ `"OUI" | "NON"` de la **fixture JSON** du jeu d'or. Les occurrences dans `src/generated/prisma/**` sont la régénération attendue du client. **Aucun débordement vers le moteur, l'UI ou l'i18n.**

## Risque d'omission silencieuse
Les créations de `VaguePrevue`/`ParametresPrevision` (`prisma.vaguePrevue.create`, `createVaguePrevue` dans `src/lib/queries/previsions-vagues.ts:165`) n'échoueront **pas** à la compilation : les deux champs portent un `@default()`, donc ils sont optionnels dans les types d'input Prisma générés. Le risque réel est l'**omission silencieuse** : tant que `createVaguePrevue`/`scinderVaguePrevue`/`genererPlanVaguesPrevues` ne copient pas explicitement `alevinsAchetesParDefaut` → `alevinsAchetes`, toute nouvelle vague héritera du `DEFAULT false` de colonne sans jamais lire le paramètre de scénario — correct pour EXCEL-V12 aujourd'hui (les deux valent `false`), mais bug silencieux le jour où un scénario mettra `alevinsAchetesParDefaut = true`. Point hors périmètre SCHEMA, transmis à la story MOTEUR.

## Cohérence avec ADR-053 §14
Le schéma et la migration livrés correspondent exactement à ce qui est acté en §14.2 (couple de champs, nommage, non-nullabilité), §14.3 (défaut `false` justifié) et §14.4 (restauration ciblée et idempotente de `prixAlevinUnitaireFCFA = 70` sur `EXCEL-V12` uniquement). Aucun écart.

## Verdict

**VALIDÉ AVEC RÉSERVES**

Le schéma et la migration sont corrects, conformes à R7/R8/R10/R11 et fidèles à ADR-053 §14. Deux réserves :
1. **R3** : compléter `src/types/models.ts` avec `VaguePrevue.alevinsAchetes: boolean` et `ParametresPrevision.alevinsAchetesParDefaut: boolean`.
2. Ajouter l'entrée `ERRORS-AND-FIXES.md` demandée par la pré-analyse.

R9 (tests) reste à confirmer par @tester avant clôture finale du sprint.
