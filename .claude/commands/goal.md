---
description: Sprint CF — Conservation Followup (clôture des nits + tests E2E + nettoyage post-CG)
---

# Objectif — Sprint CF (Conservation Followup)

Clore les follow-ups identifiés par la review finale du Sprint CG (`docs/reviews/review-sprint-CG.md`).

Objectif global : passer le périmètre Conservation de « APPROVED_WITH_FOLLOWUPS » à « FULLY_GREEN » et éliminer les risques résiduels avant la prochaine grosse opération métier sur Vague-26-03-Prep ou autres vagues à historique complexe.

## Stories

### CF.1 — Audit + correctif edge case CG.1 (`AssignationBac` source fermée)

**Risque** : `createCalibrage` après commit `af91245` throw `ConservationError("Impossible de calculer les vivants pour le bac X")` quand `computeVivantsByBac` ne retourne pas de valeur pour un bac source. Si ce bac a une `AssignationBac.dateFin` antérieure à la date du calibrage (bac libéré puis re-rempli), l'ancien fallback `nombreActuel` masquait le cas. Maintenant ça bloque.

**Mission** :

1. Script SQL d'audit prod : pour chaque vague EN_COURS, lister les bacs sources de calibrages historiques où `AssignationBac.dateFin < calibrage.date`. Si > 0, lister.

2. Auditer également les futurs calibrages : pour chaque vague EN_COURS, vérifier que `computeVivantsByBac` retourne une valeur pour CHAQUE bac actif (sinon le prochain calibrage sera rejeté).

3. Patch `src/lib/queries/calibrages.ts` ligne 170-174 : distinguer 2 cas
   - Bac source SANS AssignationBac active à la date du calibrage → throw `ConservationError` clair (« Le bac X n'est pas affecté à la vague à la date du calibrage »)
   - Bac source AVEC AssignationBac active mais sans relevés → autoriser fallback explicite sur `nombreInitial` de cette assignation (pas `nombreActuel` qui est stale)

4. Test : `src/__tests__/calibrages-edge-cases.test.ts` — cas bac source fermé, cas bac sans relevé mais assignation active.

**Fichiers** : `src/lib/queries/calibrages.ts`, `src/__tests__/calibrages-edge-cases.test.ts`, `prisma/data-fixes/CF1-audit-stale-assignations.sql`.

---

### CF.2 — Vérifier build production

**Contexte** : pendant le Sprint CG, plusieurs dev ont rapporté `npm run build` bloqué en « Collecting build traces » sur `proxy.js.nft.json` (infra). Jamais confirmé OK post-sprint.

**Mission** :

1. Lancer `npm run build` propre (`rm -rf .next && npm run build`).
2. Si succès → rapport OK, fermer la story.
3. Si échec → diagnostiquer (lock file résiduel, conflit ESM/CJS, taille bundle, etc.) et corriger.

**Important** : sans build vert, on ne peut pas pousser de release sur Coolify.

---

### CF.3 — Supprimer `_patchReleve_deprecated`

**Contexte** : la review CG.3 a relevé ~170 lignes de code mort (`_patchReleve_deprecated` dans `src/lib/queries/releves.ts` lignes ~947-1114).

**Mission** :

1. Confirmer que la fonction n'est référencée NULLE PART (`grep -r "_patchReleve_deprecated" src/`).
2. Supprimer le bloc.
3. Vérifier que `npx vitest run` + `npm run build` restent verts.

**Effort minimal** — un dev peut le faire en 15 min.

---

### CF.4 — Tests E2E browser flux complet PG → grossissement

**Mission** : ajouter un test E2E qui couvre le scénario incident prod du 10 juin 2026 :

1. Créer une vague PRE_GROSSISSEMENT vide
2. Ajouter un arrivage de 1000 alevins → 1 bac
3. Ajouter quelques relevés MORTALITE
4. Faire un calibrage 4 catégories (PETIT/MOYEN/GROS/TRES_GROS) → 4 bacs
5. **Tenter** un calibrage incomplet (oublier une catégorie) → vérifier l'erreur 422 affichée
6. **Tenter** une suppression de relevé TRANSFERT → vérifier le bouton est désactivé / affiche le lien parent
7. Créer un transfert vers une vague GROSSISSEMENT (mode B, vague existante) → vérifier que `bacDestId` est requis
8. Vérifier la cohérence finale : sources + transferts + ventes + biomasse actuelle = nombreInitial

**Fichier** : `src/__tests__/e2e/conservation-flow.spec.ts` (Playwright).

---

### CF.5 — Documenter asymétrie CG.3 (protection delete)

**Contexte** : `deleteReleve` utilise 2 mécanismes pour protéger :
- Check `typeReleve in {TRANSFERT, ARRIVAGE, VENTE}` + FK non-null
- Check `calibrageId != null` (sans contrainte sur typeReleve — car relevés auto-créés par calibrage sont MORTALITE/BIOMETRIE)

**Mission** : ajouter un commentaire de 6-10 lignes en tête de `deleteReleve` expliquant cette asymétrie. Aucune logique modifiée.

---

## Hors-scope (à traiter par l'utilisateur ou plus tard)

- **Vente Vague-26-03** (~424 alevins manquants) — saisie métier, pas une story dev.
- **Refactor `computeVivantsByBac`** — déjà robuste, ne pas toucher.
- **Refactor du wizard calibrage** pour endpoint `preview-sources` — gros chantier UX, séparer.

## Dépendances

```
CF.1 ─┐
CF.2 ─┤  (toutes indépendantes — parallélisables)
CF.3 ─┤
CF.4 ─┤
CF.5 ─┘
```

## Processus par story

Chaque story suit `docs/PROCESSES.md` :

1. @pre-analyst — valide terrain (sauf CF.5 trivial)
2. @developer ou @db-specialist — implémente
3. @tester — vérifie
4. @code-reviewer — R1-R9 (sauf CF.5)
5. @status-updater — met à jour `docs/sprints/SPRINT-CF-CONSERVATION-FOLLOWUP.md`

## Définition de fait

- [ ] CF.1 : 0 vague EN_COURS avec calibrage à venir bloqué par edge case
- [ ] CF.2 : `npm run build` vert, hash bundle stable
- [ ] CF.3 : `_patchReleve_deprecated` supprimé, tests + build verts
- [ ] CF.4 : test E2E `conservation-flow.spec.ts` vert
- [ ] CF.5 : commentaire ajouté
- [ ] `npx vitest run` global sans nouvelles régressions
- [ ] Review R1-R9 finale signée (`docs/reviews/review-sprint-CF.md`)
- [ ] Un commit par story + push

## Agents

- **CF.1** : @db-specialist (audit SQL) + @developer (patch query + test)
- **CF.2** : @developer
- **CF.3** : @developer
- **CF.4** : @tester
- **CF.5** : @developer (15 min)
- **Review finale** : @code-reviewer
