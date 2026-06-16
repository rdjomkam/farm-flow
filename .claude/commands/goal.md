---
description: Sprint SV — SurVie (formule taux de survie correcte : non-morts / initial)
---

# Objectif — Sprint SV (SurVie)

Corriger la formule du **taux de survie** dans tout le projet. La formule actuelle est biaisée : elle assimile transferts sortants et calibrages à des morts, alors que ces poissons sont vivants (juste plus dans la vague).

## Diagnostic

**Formule actuelle** ([calculs.ts:34](src/lib/calculs.ts#L34)) :
```
tauxSurvie = (nombreVivants / nombreInitial) * 100
```

**Bug** : `nombreVivants` est l'état actuel **dans la vague** (déduit des morts, ventes, transferts sortants, calibrages sortants). Pour une vague PG qui a transféré 5500 → vague GR, le taux de survie tombe à ~13 % alors que les poissons sont bien vivants en aval.

**Formule correcte** (définition métier) :
```
tauxSurvie = ((nombreInitial - totalMortalites) / nombreInitial) * 100
```

Tout ce qui n'est pas mort est survivant. Vendus / transférés / calibrés sortants comptent comme vivants par définition.

## Cas réels observés

| Vague | nombreInitial | Morts | Formule actuelle | Formule correcte |
|-------|--------------|-------|------------------|------------------|
| Vague-26-03-Prep | 7000 | ~565 | 13 % ❌ | **92 %** ✓ |
| Vague-26-03 | 5500 | ~35 | 99 % | **99 %** (idem) ✓ |
| Vague 26-02 | ~ | ~ | sous-estimé | corrigé |

## Stories

### SV.1 — Changer signature de `calculerTauxSurvie`

**Fichier** : `src/lib/calculs.ts` lignes 27-35.

**Avant** :
```ts
export function calculerTauxSurvie(
  nombreVivants: number | null,
  nombreInitial: number | null
): number | null
```

**Après** :
```ts
export function calculerTauxSurvie(
  nombreInitial: number | null,
  totalMortalites: number | null
): number | null {
  if (nombreInitial == null || nombreInitial <= 0 || totalMortalites == null) {
    return null;
  }
  const nonMorts = Math.max(0, nombreInitial - totalMortalites);
  return (nonMorts / nombreInitial) * 100;
}
```

Mettre à jour le commentaire jsdoc.

### SV.2 — Mettre à jour tous les appelants

`grep -rn "calculerTauxSurvie" src/` puis MAJ chaque caller :

- `src/lib/queries/indicateurs.ts:199` — utiliser `totalMortalites` au lieu de `nombreVivantsForSurvie`. Supprimer le code mort qui calcule `nombreVivantsForSurvie` avec `excludeVentes: true`.
- `src/lib/queries/analytics.ts` — idem
- `src/lib/bac-performance.ts:269` — formule inline `vivants / nombreInitial * 100` à remplacer par `(initial - morts) / initial * 100`
- `src/lib/alertes/reproduction.ts:205` — formule inline `lot.nombreActuel / lot.nombreInitial`. Pour les lots de reproduction, comportement à valider : si un lot peut avoir des sorties (transferts vers grossissement), même bug ; si lot fermé, la formule actuelle marche. **Recommandation** : aligner pour cohérence.
- `src/components/...` — chercher si une UI calcule directement le taux.

### SV.3 — Tests

**Fichier** : `src/lib/__tests__/taux-survie.test.ts` (créer si absent, étendre sinon).

Cas obligatoires :
1. 1000 initiaux − 50 morts → 95 %
2. 1000 initiaux − 0 mort − 500 transferts sortants → **100 %** (régression du bug)
3. 1000 initiaux − 200 morts − 300 ventes → 80 % (régression)
4. nombreInitial = 0 → null
5. nombreInitial = null → null
6. totalMortalites > nombreInitial (cas pathologique) → 0 % (pas négatif)
7. Régression Vague-26-03-Prep : 7000 init − 565 morts = 91.93 %

Étendre les tests existants `bac-performance.test.ts` et `analytics.test.ts` pour la régression sur le bug.

### SV.4 — Audit prod : vérifier que les valeurs affichées sont cohérentes

Pas de data-fix nécessaire (calcul à la volée, pas de persistance). Juste valider après deploy que :
- Vague-26-03-Prep affiche ~92 % de survie
- Vague-26-03 affiche ~99 %
- Autres vagues : taux raisonnables

### SV.5 — Review R1-R9 + sprint close

- Review des fichiers modifiés
- Rapport `docs/reviews/review-sprint-SV.md`
- Sprint close

## Dépendances

```
SV.1 ─► SV.2 (callers) ─► SV.3 (tests) ─► SV.4 (audit) ─► SV.5 (review)
```

Linéaire — chaque story dépend de la précédente.

## Agents

- **SV.1 + SV.2** : @developer (refactor signature + callers)
- **SV.3** : @tester
- **SV.4** : (visualisation après deploy, pas de dev)
- **SV.5** : @code-reviewer

## Définition de fait

- [ ] `calculerTauxSurvie` utilise `(nombreInitial, totalMortalites)`
- [ ] Tous les callers mis à jour
- [ ] Tests verts (nouveaux + régression)
- [ ] `npx tsc --noEmit` clean
- [ ] Review R1-R9 signée
- [ ] Un commit + push par story (1 ou 2 commits suffisent — sprint focalisé)

## Hors-scope

- Refonte UI carte « Taux de survie » — déjà OK
- Distinction « survie nette » vs « survie élevage » (concept avancé pisciculture) — séparé
- Tracking par cohorte temporelle — chantier séparé
