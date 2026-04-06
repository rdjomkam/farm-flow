# Review — ADR-036 FCR par aliment (FCR-by-feed)

**Date :** 2026-04-06
**Reviewer :** @code-reviewer
**Verdict :** APPROUVE AVEC RESERVES

## Bugs identifiés

### BUG-R2 — Violation R2 : strings en dur (Haute)
**Fichier :** `src/lib/queries/fcr-by-feed.ts`
`typeReleve: "BIOMETRIE"`, `"COMPTAGE"`, `"MORTALITE"` doivent utiliser `TypeReleve.BIOMETRIE` etc.

### BUG-CAST — `as any[]` pour calibrages (Haute)
Cast `as any[]` pour adapter la structure CalibrageWithSource. Double `as any` dans `estimerPopulationBac`.

### BUG-MULTI-SOURCE — Seul `sourceBacIds[0]` pris en compte (Haute)
`sourceBacIds` est un tableau. Seul le premier élément est utilisé. Si un calibrage implique plusieurs bacs sources, les bacs 2,3... ne seront pas détectés comme "bac vidé".

### BUG-GLOBAL-FCR — flagLowConfidence exclut du FCR global mais compté dans nombreVaguesIncluses (Moyenne)
Clarifier le compteur.

### BUG-DEAD-CODE — `exclusiveRuns[]` construit mais jamais utilisé (Basse)
~60 lignes de code mort dans `segmenterPeriodesParBac`.

## Fonctions pures (Steps 4-8) : APPROUVÉES
