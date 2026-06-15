---
description: Sprint CX — Conservation Extended (calibrage init + guard date filter + audit Bac 07/08)
---

# Objectif — Sprint CX (Conservation Extended)

Corriger les deux failles découvertes en prod le 2026-06-15 lorsqu'un calibrage sur Vague-26-02 a été rejeté à tort par le guard CS.3 :

> `Invariant cassé sur le bac cmmtgcza8000604lf3ft910rv (Bac 08) : AssignationBac.nombreActuel=1215 mais le calcul des opérations donne 0 (écart +1215).`

## Diagnostic

1. **Bac 08 a une `AssignationBac` créée manuellement à 10:28** avec `nombreInitial=0` et `nombrePoissons=0`
2. **Calibrage à 11:28** :
   - Pass 2 incrémente `nombrePoissons` 0 → 1215 mais ne touche **PAS** `nombreInitial`
   - COMPTAGE créé à `calibrageDate`
3. **Guard CS.3** filtre les relevés par `releveDate > dateAssignation` (strict)
4. **Deux failles combinées** :
   - **F1** : Pass 2 du calibrage n'a pas reçu le fix CS.1 (`nombreInitial` reste à 0 quand le bac dest existait déjà vide)
   - **F2** : Si `data.date` envoyée par l'UI ne contient pas l'heure (date seule), `calibrageDate = 00:00:00 UTC`. Or `dateAssignation = 10:28:16`. Le COMPTAGE est filtré → guard voit `expected = 0` → rejet faux-positif

## Stories

### CX.1 — Étendre CS.1 à `calibrages.ts`

**Fichier** : `src/lib/queries/calibrages.ts` — `createCalibrage` Pass 2 (lignes 296-340) + `patchCalibrage` (équivalent).

**Règle** : quand Pass 2 incrémente une `AssignationBac` destination dont `nombreInitial = 0` (bac vide rattaché manuellement), MAJ aussi `nombreInitial = ancien + total` ET `poidsMoyenInitial = moyenne_pondérée` (issue des groupes calibrage destinés à ce bac).

**Cas existant déjà OK** : si Pass 2 crée une nouvelle AssignationBac via le `else` (ligne 326-337), le post-CG.4 fix met `dateAssignation = calibrageDate`. Mais `nombreInitial` est lu depuis l'historique → 0 si neuf. À aligner avec CS.1.

**Tests** : `src/__tests__/calibrages-init-fields.test.ts` (nouveau)
- Pass 2 sur AssignationBac existante avec init=0 → init mis à `total`
- Pass 2 sur AssignationBac existante avec init>0 → init **inchangé** (l'historique reste valide)
- Pass 2 crée une nouvelle AssignationBac → init=total

### CX.2 — Filtre date du guard plus tolérant

**Fichier** : `src/lib/guards/assignation-invariant.ts` lignes 136-141.

**Bug** : `releveDate > assignationDate` (strict). Quand `dateAssignation` et le relevé sont créés au même instant dans une même transaction (ex. calibrage qui crée AssignationBac + COMPTAGE), le relevé est exclu et le guard calcule un `expected` faux.

**Fix recommandé** : `releveDate >= assignationDate`. Logique : un relevé daté **exactement** au moment de l'assignation représente l'état initial du bac à cet instant — il doit être pris en compte dans le replay.

**Alternative** : supprimer entièrement le filtre date côté guard (depuis l'assignation, tout relevé sur ce bac/vague est pertinent). Plus simple, moins de logique défensive.

**Tests** : étendre `assignation-invariant-guard.test.ts` avec un cas où `releveDate === assignationDate` → le relevé est compté.

### CX.3 — Audit + data-fix prod Bac 07 / Bac 08 / autres

**Diagnostic prod** :
- Bac 07 (Vague-26-02) : `dateAssignation=2026-06-15 10:28:07`, `init=0`, `actuel=0` — rattachement manuel
- Bac 08 (Vague-26-02) : `dateAssignation=2026-06-15 10:28:16`, `init=0`, `actuel=0` — rattachement manuel

Ces deux bacs ont été ajoutés manuellement à Vague-26-02 sans contenu. Une fois CX.1 + CX.2 mergés, le calibrage rejeté pourra être ré-tenté et passera.

**Script SQL d'audit** : `prisma/data-fixes/CX3-audit-empty-assignations.sql` — SELECT toutes les `AssignationBac` actives avec `init=0 AND actuel=0` (bacs vides rattachés, sans incohérence mais à signaler).

**Pas de UPDATE** sur ces lignes — elles ne sont pas corrompues, juste vides. Le retry du calibrage les remplira correctement après CX.1.

### CX.4 — Retry du calibrage Vague-26-02

Après merge de CX.1 + CX.2, **l'utilisateur** (ou nous) refait le calibrage Vague-26-02 via l'UI. Le guard doit passer.

Pas une story dev — juste une validation manuelle.

### CX.5 — Tests E2E + review finale

- Étendre `conservation-flow.spec.ts` avec scenario : créer bac vide, rattacher à vague, calibrer dessus → vérifier que le calibrage est accepté (régression CX.1 + CX.2).
- Review R1-R9.

## Dépendances

```
CX.1 ─┐
CX.2 ─┼─► CX.3 (audit) ─► CX.4 (retry user) ─► CX.5 (review)
```

CX.1 et CX.2 sont parallélisables. Recommandé de les merger en même temps.

## Agents

- **CX.1** : @developer (Pass 2 + tests calibrages)
- **CX.2** : @developer (filtre guard + tests)
- **CX.3** : @db-specialist (SQL audit)
- **CX.5** : @tester + @code-reviewer

## Définition de fait

- [ ] Pass 2 calibrage populer `nombreInitial` sur destination existante vide
- [ ] Guard CS.3 utilise `>=` ou supprime le filtre date
- [ ] Audit prod : liste des bacs vides rattachés sans incohérence
- [ ] Tests E2E nouveau scénario vert
- [ ] Review finale signée
- [ ] Un commit + push par story

## Hors-scope

- Refactor du guard (déjà robuste après CX.2)
- Refonte UI calibrage (data.date doit-elle inclure l'heure ? — séparé)
