# Review Sprint GD — Story GD.1 (BUG-049 fix)

**Fichiers reviewés :**
- `src/lib/guards/assignation-invariant.ts`
- `src/__tests__/assignation-invariant-guard.test.ts`

**Verdict : APPROVED_WITH_NITS**

## Correctness

- Discrimination par relevé (lignes 173-181) correcte et identique dans les deux branches de replay (avec/sans COMPTAGE) via `transfertSigne(r)`.
- Fallback `transfertGroupeId=null` → sortant (`-1` par défaut). Comportement historique préservé, testé.
- Cas edge `bacSourceId` null : `null === "xxx"` → `false`, jamais de faux positif. Correct.
- Test régression BUG-049 (bac source de TG-A ET dest de TG-B) reproduit le scénario prod bloquant Vague-26-03-Prep.

## R1-R9

- **R1** : OK, enums MAJUSCULES.
- **R2** : OK dans le guard. **Nit** dans les tests : mocks `typeReleve` en string litérale (`"TRANSFERT"` etc.) au lieu d'importer `TypeReleve`. Pattern préexistant, non introduit par GD.1. Sévérité Basse.
- **R3** : OK — `select` findMany aligné avec les champs consommés.
- **R4** : OK — signature publique inchangée, appelé dans transaction.
- **R7** : OK — nullabilité gérée avec `?? 0`, `?? null`, filters `is string`.
- **R8** : Nit — nouveau `tx.transfertGroupe.findMany` (ligne 129-132) sans filtre `siteId` explicite. Pas un risque réel car IDs proviennent des Releve déjà scopés siteId + vagueId ; TransfertGroupe n'a pas de siteId direct. À documenter. Sévérité Basse.
- **R9** : 16/16 tests verts, build OK, aucune régression.

## Sécurité / Performance

- `findMany` avec `id: { in: Set dédupliqué }` — un aller-retour DB unique, pas de N+1.
- Court-circuit `transfertGroupeIds.length ? ... : []` évite un appel DB inutile (testé).
- Pas de faille d'injection.

## Tests

- 4 nouveaux tests indépendants et déterministes.
- Suppression justifiée des `mockResolvedValueOnce([])` sur les tests sans TRANSFERT (court-circuit).
- **Nit** : commentaire "Cas 10" (ligne 354-356) désynchronisé de la position physique du test suite aux insertions BUG-049. Sévérité Basse.

## Findings

| # | Sévérité | Fichier | Ligne | Description |
|---|----------|---------|-------|-------------|
| 1 | Basse | `assignation-invariant-guard.test.ts` | tout | Mocks `typeReleve` en string litérale (R2 nit, préexistant) |
| 2 | Basse | `assignation-invariant.ts` | 129-132 | `tx.transfertGroupe.findMany` sans filtre `siteId` explicite (à documenter) |
| 3 | Basse | `assignation-invariant-guard.test.ts` | 354-438 | Commentaire "Cas 10" désynchronisé |

Aucun finding Critique ou Haute.

## Recommandation

**APPROVED_WITH_NITS** — mergeable en l'état. Les 3 nits Basses peuvent être polish Sprint 12.
