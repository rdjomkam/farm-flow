---
description: Sprint CS — Conservation Stricte (init AssignationBac + TRANSFERT entrant + post-write guard)
---

# Objectif — Sprint CS (Conservation Stricte)

Empêcher de manière systémique l'incohérence détectée sur Vague-26-03 : les `AssignationBac` destinations d'un transfert avaient `nombrePoissonsInitial = 0` et `poidsMoyenInitial = 0` alors que `nombrePoissons` était correctement incrémenté. Conséquence : `computeVivantsByBac` retournait 0 pour Bac 01 et Bac 04 dans l'UI alors qu'ils contenaient 1744 et 1780 poissons.

## Contexte (incident détecté 2026-06-11)

- Vague-26-03 affichait **1976 vivants** dans le header au lieu de **5500**
- Bac 01 (1744 reçus) et Bac 04 (1780 reçus) affichaient 0 vivants
- Cause : `createTransfert` étape 9 incrémente `nombrePoissons` mais ne populait pas `nombrePoissonsInitial`/`poidsMoyenInitial` au moment de l'assignation destination
- `computeVivantsByBac` utilise `nombrePoissonsInitial` comme base de calcul → vivants = 0

Le data-fix manuel a été appliqué (`bacId=cmmnd2oab000104jse23g509w` et `cmmtgbf4x000204lfb3tsnrrd`) ; il faut maintenant le fix code et un garde-fou.

## Stories

### CS.1 — Populer `nombreInitial` + `poidsMoyenInitial` à la création d'AssignationBac destination

**Fichiers** : `src/lib/queries/transferts.ts` (étapes 6 et 9 de `createTransfert`, étape 6 de `updateTransfertGroupe`), `src/lib/queries/arrivages.ts` (par symétrie — `createArrivage`).

**Règle** :
- À la **création** d'une nouvelle `AssignationBac` destination via transfert/arrivage → set `nombrePoissonsInitial = nombrePoissons` ET `poidsMoyenInitial = poidsMoyenG`
- À l'**incrément** d'une AssignationBac existante → **ne pas** toucher à `nombrePoissonsInitial` (l'historique reste intact) mais documenter la décision en commentaire de code

**Migration data** : script SQL pour réparer les destinations historiques (init=0 mais nombrePoissons>0).

**Tests** : `src/__tests__/transferts-init-fields.test.ts` — créer transfert vers bac neuf → vérifier init=nombrePoissons.

---

### CS.2 — `computeVivantsByBac` compte les TRANSFERT entrants

**Fichier** : `src/lib/calculs.ts` — fonction `computeVivantsByBac`.

**Règle** : symétrique aux TRANSFERT sortants côté source, ajouter le traitement des TRANSFERT entrants côté destination. La détection passe par les `TransfertGroupe.bacDestId` ou (préférable) par un relevé TRANSFERT incoming sur le bac dest.

**Discussion architecture** :
- Option A — créer un relevé TRANSFERT **entrant** symétrique au sortant (avec `bacId = bacDestId`, `nombreTransferes` positif)
- Option B — joindre `TransfertGroupe` directement dans le calcul (sans relevé miroir)

→ **Préférer Option A** pour cohérence (toutes les variations de stock passent par un relevé). Implique de modifier `createTransfert` pour créer 2 relevés par groupe (source + dest).

**Tests** : `src/__tests__/calculs-transfert-entrant.test.ts` — bac dest vide + transfert 100 entrant → vivants = 100.

---

### CS.3 — Post-write guard sur AssignationBac

**Fichiers** : `src/lib/queries/transferts.ts`, `src/lib/queries/arrivages.ts`, `src/lib/queries/ventes.ts`, `src/lib/queries/calibrages.ts`.

**Règle** : à la fin de chaque transaction qui modifie une `AssignationBac`, vérifier l'invariant :
```
AssignationBac.nombrePoissons === nombrePoissonsInitial
  + sum(transferts entrants .nombrePoissons)
  + sum(arrivages entrants .nombrePoissons)
  - sum(transferts sortants .nombreTransferes)
  - sum(ventes .nombreVendus)
  - sum(mortalites .nombreMorts)
  + ajustements COMPTAGE (override)
```

Si écart > tolérance (0 strict, on n'arrondit pas les têtes de poisson) → throw `ConservationError` + rollback automatique de la transaction.

**Fichier nouveau** : `src/lib/guards/assignation-invariant.ts` — utilitaire réutilisé par les 4 queries.

**Tests** : `src/__tests__/assignation-invariant-guard.test.ts` — simuler un transfert qui casse l'invariant → throw + rollback DB confirmé.

---

### CS.4 — Audit prod : autres AssignationBac avec init incohérent

**Fichier** : `prisma/data-fixes/CS4-audit-stale-init.sql`.

**Mission** : SELECT toutes les `AssignationBac` dateFin IS NULL avec `nombrePoissonsInitial = 0` ET `nombrePoissons > 0`. Lister + proposer UPDATE manuels (un par cas, pas de batch automatique car les valeurs poidsMoyenInitial doivent venir des `TransfertGroupe`/`ArrivageGroupe` sources).

**Décision** : appliquer les UPDATE en transaction visible après revue.

---

### CS.5 — Tests E2E + Review R1-R9

- Étendre `src/__tests__/e2e/conservation-flow.spec.ts` (commit `61b7d91`) avec step supplémentaire : après le transfert, vérifier `AssignationBac.nombrePoissonsInitial` du bac destination est non-null.
- Review checklist R1-R9 sur les nouveaux fichiers.
- Rapport `docs/reviews/review-sprint-CS.md`.

---

## Dépendances

```
CS.1 ─┐
CS.2 ─┼─► CS.3 (utilise les conditions CS.1+CS.2) ─► CS.4 (audit) ─► CS.5 (review)
```

CS.1 et CS.2 sont parallélisables. CS.3 doit attendre les deux pour valider l'invariant sur des données justes.

## Agents

- **CS.1** : @developer (query + tests)
- **CS.2** : @developer (calculs.ts pur + relevé miroir + tests)
- **CS.3** : @developer + @db-specialist (invariant + rollback)
- **CS.4** : @db-specialist (audit SQL prod + UPDATE)
- **CS.5** : @tester + @code-reviewer

## Définition de fait

- [ ] Tous les `AssignationBac` créés par transfert/arrivage ont `nombrePoissonsInitial` + `poidsMoyenInitial` non-nulls
- [ ] `computeVivantsByBac` compte les TRANSFERT entrants (Option A : relevé miroir)
- [ ] Post-write guard actif sur 4 queries (transfert, arrivage, vente, calibrage)
- [ ] Audit prod : 0 AssignationBac avec init incohérent restant
- [ ] `npx vitest run` + `npm run build` OK
- [ ] E2E `conservation-flow.spec.ts` étendu et vert
- [ ] Review R1-R9 signée
- [ ] Un commit + push par story

## Hors-scope

- Refactor de `computeVivantsByBac` (l'optimiser : déjà robuste après CS.2)
- Refonte UI de la carte « Vivants » (déjà OK depuis UX.2)
- Migration `nombrePoissonsInitial NOT NULL` — à différer après CS.4 confirme 0 ligne pathologique
