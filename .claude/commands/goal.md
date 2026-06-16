---
description: Sprint GP — Gompertz Persistence (fire-and-forget fix + NaN guard + data-fix prod)
---

# Objectif — Sprint GP (Gompertz Persistence)

Corriger les 3 défauts détectés sur la persistance `GompertzVague` en prod le 2026-06-16 :

| # | Problème | Constat prod |
|---|----------|--------------|
| **D1** | Upsert `gompertzVague` fire-and-forget dans Server Component | Vague-26-03-Prep MAJ 10 juin alors que biométries plus récentes existent |
| **D2** | NaN persisté en DB | Vague-26-03-Prep : `wInfinity = NaN` |
| **D3** | Seuil 5 biométries trop strict ? | Vague-26-03 (4 biométries) reste sans Gompertz — comportement attendu mais à confirmer |

## Stories

### GP.1 — Await l'upsert GompertzVague (fix fire-and-forget)

**Fichier** : `src/components/pages/vague-detail-page.tsx` lignes 286-318 + `src/app/api/vagues/[id]/gompertz/route.ts` (vérifier idem).

**Bug** : `prisma.gompertzVague.upsert({...})` sans `await`. En prod (Next.js Server Component streaming), la promise est dropable avant d'atteindre la DB.

**Fix recommandé** :
- Option A — **`await` direct** : pénalité légère sur le TTFB, mais garantit la persistance
- Option B — **Server Action** : déplace l'upsert dans une action côté serveur, appelée depuis le client après render
- Option C — **API endpoint** : POST `/api/vagues/[id]/gompertz/persist` avec body { wInfinity, k, ti, ... }, le client le déclenche après mount

→ **Préférer Option A** : la simplicité l'emporte. Pénalité TTFB < 50ms pour un upsert ciblé.

**Tests** : ajouter assertion d'intégration vérifiant que `gompertzVague` existe après chargement de la page (snapshot DB avant/après).

### GP.2 — Validation NaN dans `calibrerGompertz`

**Fichier** : `src/lib/gompertz.ts` — fonction `calibrerGompertz` ou ses appelants.

**Bug** : le solver (probablement Nelder-Mead ou Levenberg-Marquardt) peut diverger et retourner `{wInfinity: NaN, k: NaN, ti: NaN}` sans erreur. Le résultat est persisté tel quel.

**Règle** : avant de retourner `result` depuis `calibrerGompertz`, vérifier :
```ts
if (!Number.isFinite(params.wInfinity) || !Number.isFinite(params.k) || !Number.isFinite(params.ti)) {
  return null;  // Pas de modèle fiable — ne pas persister
}
```

**Tests** : `src/lib/__tests__/gompertz-nan-guard.test.ts` — cas de divergence (input dégénéré) → retour `null`.

### GP.3 — Data-fix prod : supprimer le record NaN de Vague-26-03-Prep

**Action** : `DELETE FROM "GompertzVague" WHERE "vagueId" = 'cmplrrba6000101qwazzjca26'` (Vague-26-03-Prep).

Au prochain chargement de la page, GP.1+GP.2 actifs → upsert relancé avec données valides OU pas de persistance si encore divergent.

**Fichier** : `prisma/data-fixes/GP3-cleanup-nan-gompertz.sql` (audit + DELETE en transaction).

### GP.4 — Test : Vague-26-03 reste sans Gompertz (4 < 5 minPoints)

**Vérification** : confirmer que c'est le comportement attendu. Pas de code à modifier — juste documenter dans le sprint.

Si l'utilisateur veut un Gompertz précoce, baisser `gompertzMinPoints` dans la `ConfigElevage` correspondante (depuis l'UI ou via SQL ciblé).

### GP.5 — Review R1-R9 + e2e

- Review checklist sur GP.1 + GP.2
- E2E optionnel : `gompertz-persistence.spec.ts` — créer vague, ajouter 5 biométries, vérifier qu'un record `GompertzVague` est créé en DB.
- Rapport `docs/reviews/review-sprint-GP.md`.

## Dépendances

```
GP.1 ─┐
GP.2 ─┼─► GP.3 (data-fix) ─► GP.4 (doc) ─► GP.5 (review)
```

GP.1 et GP.2 sont parallélisables.

## Agents

- **GP.1** : @developer
- **GP.2** : @developer (gompertz.ts pur, tests unitaires faciles)
- **GP.3** : @db-specialist (DELETE en transaction)
- **GP.5** : @code-reviewer

## Définition de fait

- [ ] `gompertzVague.upsert` awaité (ou Server Action)
- [ ] `calibrerGompertz` retourne `null` si paramètres non-finite
- [ ] Record NaN supprimé en prod
- [ ] Tests verts (NaN guard + upsert intégration)
- [ ] Review R1-R9 signée
- [ ] Un commit + push par story

## Hors-scope

- Refonte du solver Gompertz (Levenberg-Marquardt, etc.) — chantier séparé
- UI pour ajuster `gompertzMinPoints` — déjà accessible via ConfigElevage
