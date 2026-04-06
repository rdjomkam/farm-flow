# Review ADR-033 — FCR Vague-Level Calculation

**Date :** 2026-04-05
**Reviewer :** @code-reviewer
**Statut :** APPROUVÉ (après corrections)

## Synthèse

L'implémentation d'ADR-033 corrige le calcul FCR pour utiliser Gompertz VAGUE systématiquement pour l'estimation des poids, tout en conservant la segmentation per-tank et le nombreVivants per-tank — conformément à l'algorithme validé manuellement sur les données réelles.

**Algorithme confirmé :**
1. Segmentation des périodes d'alimentation per-tank (correct — chaque bac reçoit de l'aliment indépendamment)
2. Estimation du poids via Gompertz VAGUE (corrigé — plus jamais filtré par bacId)
3. nombreVivants per-tank via calibrage (correct — chaque bac a un nombre différent après calibrage)
4. Gain par période = (poidsFin − poidsDebut) × nombreVivants / 1000
5. FCR = Σ feed / Σ gain (corrigé — exclut l'aliment des périodes à gain négatif)

## Checklist R1-R9

| Règle | Statut |
|-------|--------|
| R1 — Enums MAJUSCULES | PASS |
| R2 — Import des enums | PASS |
| R3 — Prisma = TypeScript | PASS |
| R4 — Opérations atomiques | PASS |
| R5 — DialogTrigger asChild | PASS |
| R6 — CSS variables | PASS |
| R7 — Nullabilité explicite | PASS |
| R8 — siteId PARTOUT | N/A |
| R9 — Tests avant review | PASS (96/96, build OK) |

## Discrepancies corrigées (11/14 pertinentes)

| DISC | Statut | Description |
|------|--------|-------------|
| DISC-01/02 | CORRIGÉ | `interpolerPoidsVague` n'utilise pas bacId, évalue Gompertz même avec 0 biométries |
| DISC-07 | CORRIGÉ | Extrapolation utilise Gompertz au lieu de valeur plate |
| DISC-10/15 | CORRIGÉ | Gompertz construit inconditionnellement |
| DISC-13 | CORRIGÉ | `getFCRTrace` utilise `interpolerPoidsVague` |
| DISC-16 | CORRIGÉ | Aliment exclu quand gain négatif |
| DISC-19 | CORRIGÉ | `modeLegacy` supprimé |
| DISC-21-25 | CORRIGÉ | Dialog restructuré avec GompertzParamsBlock |

## Discrepancies non-applicables (DISC-03/05/06/08/09/11/12)

Ces items prescrivaient une segmentation vague-level et un nombreVivants vague-level. L'algorithme confirmé par l'utilisateur maintient la segmentation per-tank et le nombreVivants per-tank — seule l'estimation des poids passe en vague-level. Ces DISC sont donc hors-scope.

## Remarques corrigées

- I4: Paramètre `strategie` inutilisé supprimé de `interpolerPoidsVague`
- I5: JSDoc de `segmenterPeriodesAlimentaires` mis à jour
- R2: Commentaire obsolète sur `bacBios.length === 0` supprimé
- R3: Clé orpheline `"bac"` supprimée des fichiers i18n
- R4: `.toFixed(2)` appliqué à `fcrPeriode` dans le dialog

## Verdict

**APPROUVÉ.** L'implémentation est conforme à l'algorithme validé. Les corrections de la review initiale ont été appliquées.
