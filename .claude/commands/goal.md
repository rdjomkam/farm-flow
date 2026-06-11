---
description: Sprint CG — Renforcer la conservation des poissons (calibrage, transfert, suppression relevé)
---

# Objectif — Sprint CG (Conservation Garantie)

Empêcher de manière systémique les incohérences détectées sur Vague-26-03-Prep / Vague-26-03 en production le 10 juin 2026 :

- 3524 alevins « perdus » dans un calibrage incomplet (catégorie GROS oubliée)
- 2 TransfertGroupe avec `bacDestId` NULL → 1976 poissons « en l'air » côté vague destination
- 3 relevés TRANSFERT supprimés manuellement → TransfertGroupe orphelins, vivants surestimés côté source
- Bacs « ressuscités » sans AssignationBac active (créées le lendemain seulement)

## Stories

### CG.1 — Garde-fou calibrage : conservation stricte des vivants

**Fichier** : `src/lib/queries/calibrages.ts` (`createCalibrage`, `updateCalibrage`)

**Règle** :
```
sum(groupes.nombrePoissons) + nombreMorts === sum(vivants des sources)
```
écart toléré : ±0.5 % (arrondi entier).

**Comportement** :
- Si écart > tolérance → throw `ConservationError` avec message :
  > « Conservation non respectée. Sources : N poissons vivants. Saisi : M (redistribués) + K (morts). Écart : ±X. Tous les poissons doivent être saisis dans une catégorie. »
- Le front affiche l'erreur et propose les catégories manquantes (PETIT/MOYEN/GROS/TRES_GROS).

**Test** : `src/lib/queries/__tests__/calibrages-conservation.test.ts` — cas 5973 sources, 2449 saisis → refusé.

---

### CG.2 — `bacDestId` obligatoire sur TransfertGroupe

**Fichier** : `src/lib/queries/transferts.ts` (`createTransfert`, `updateTransfert`), `src/app/api/transferts/route.ts`

**Règle** : chaque `TransfertGroupe` DOIT avoir `bacDestId` non-null, SAUF si la vague destination est de type `GROSSISSEMENT` et était vide à la création (mode « En attente de transfert »). Dans ce dernier cas, créer une `AssignationBac` au bac désigné à la dest, jamais NULL.

**UI** ([transfert-multi-source-page.tsx](src/components/pages/transfert-multi-source-page.tsx)) : forcer le sélecteur de bac destination par groupe, désactiver la soumission tant qu'un groupe n'a pas de dest.

**Migration data** : script SQL pour corriger les `TransfertGroupe` historiques avec `bacDestId IS NULL`, en se basant sur la `AssignationBac` créée lors du transfert (chercher par date + vagueDestId).

**Test** : `src/lib/queries/__tests__/transferts-bacdest.test.ts`.

---

### CG.3 — Protection des relevés TRANSFERT contre la suppression

**Fichier** : `src/lib/queries/releves.ts` (`deleteReleve`), `src/app/api/releves/[id]/route.ts`

**Règle** : refuser DELETE sur un `Releve` dont `typeReleve` ∈ `{TRANSFERT, ARRIVAGE, VENTE, CALIBRAGE}` ET qui est lié à un parent (`transfertGroupeId`, `arrivageId`, `venteId`, `calibrageId` non-null).

**Comportement** : retourner 409 Conflict avec message :
> « Ce relevé est lié à un {transfert|arrivage|vente|calibrage}. Supprimez d'abord l'opération parente. »

La suppression du `Transfert` / `Arrivage` / `Vente` / `Calibrage` parent cascade déjà côté Prisma (`onDelete: CASCADE`).

**UI** : masquer le bouton supprimer sur ces relevés dans la liste, montrer un lien « Voir l'opération parente » à la place.

**Test** : `src/lib/queries/__tests__/releves-protected-delete.test.ts`.

---

### CG.4 — AssignationBac créée à la date de l'opération métier

**Fichier** : `src/lib/queries/calibrages.ts`, `src/lib/queries/transferts.ts`, `src/lib/queries/arrivages.ts`

**Règle** : quand un calibrage / transfert / arrivage crée ou réouvre une `AssignationBac`, sa `dateAssignation` DOIT être la date de l'opération, pas `new Date()` ou la date d'enregistrement du relevé.

**Effet attendu** : Bac 11 (cas prod) aurait dû avoir une assignation active dès le 09 juin (date du calibrage), pas le 10 juin. `computeVivantsByBac` redevient cohérent rétroactivement.

**Migration data** : script SQL pour reculer la `dateAssignation` des `AssignationBac` créées dans la semaine suivant un calibrage / transfert / arrivage à la date de l'opération source.

**Test** : `src/lib/queries/__tests__/assignation-date-alignment.test.ts`.

---

### CG.5 — Audit data Vague-26-03-Prep (Bac 11 + Bac 05)

**Diagnostic** :
- Bac 11 1ère assignation (5000 alevins) → fermée 28 mai après calibrage initial qui répartit vers Bac 02 (4500) + Bac 08 (500). État OK.
- Bac 11 2e assignation (224 actuels) → créée 10 juin 10:36 alors que le calibrage du 09 juin redestine 2000 vers ce bac. Décalage 1 jour à corriger via CG.4.
- Bac 05 ARRIVAGE 2000 le 04 juin → calibrage 09 juin redistribue tout. Bac 05 vide → cohérent une fois CG.1 enforced sur les calibrages historiques (déjà OK post-repair manuel via le script `repair_vague_26_03.sql`).

**Action** : exécuter le script de migration CG.4 sur prod, puis vérifier que `computeVivantsByBac(Vague-26-03-Prep)` retourne 936 vivants (= état actuel).

---

### CG.6 — Tests E2E + Review R1-R9

- Test E2E browser : créer vague PRE_GROSSISSEMENT vide → arrivage 1000 → calibrage 4 catégories → transfert sortant → vérifier que la conservation est respectée à chaque étape et qu'aucun bouton dangereux n'est exposé.
- Review checklist R1-R9 sur les nouveaux garde-fous.
- Rapport `docs/reviews/review-sprint-CG.md`.

---

## Dépendances

```
CG.1 ─┐
CG.2 ─┼─► CG.4 (data migration) ─► CG.5 (audit prod) ─► CG.6 (review)
CG.3 ─┘
```

## Agents

- **CG.1, CG.2, CG.3, CG.4** : @db-specialist + @developer (queries + API + UI)
- **CG.5** : @db-specialist (script SQL audit prod)
- **CG.6** : @tester + @code-reviewer

## Définition de fait

- [ ] Tous les garde-fous backend en place + tests unitaires verts
- [ ] UI bloque les saisies incohérentes (calibrage sans conservation, transfert sans bacDest)
- [ ] Boutons supprimer masqués sur relevés liés
- [ ] Migration data appliquée sur prod (CG.4 + audit CG.5)
- [ ] `npm run build` OK
- [ ] `npx vitest run` OK
- [ ] Review R1-R9 signée
- [ ] Commit + push, un commit par story

## Hors-scope (à traiter séparément)

- Vente manquante pour Vague-26-03 (~424 alevins) — saisie utilisateur, pas un fix code.
- Refactor de `computeVivantsByBac` — déjà robuste post-fix `a5671d5` + `5712d88`.
