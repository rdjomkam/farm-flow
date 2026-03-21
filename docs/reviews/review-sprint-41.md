# Review Sprint 41 — Extraction i18n Pages & Composants

**Date :** 2026-03-21
**Reviewer :** @code-reviewer
**Stories :** 41.1, 41.2, 41.3, 41.4, 41.5

---

## Verdict : VALIDÉ (après corrections)

La première passe identifiait 10 problèmes (3 Haute, 4 Moyenne, 2 Basse). Tous ont été corrigés dans une deuxième passe :
- P1/P2 : bac-comparison-cards et bac-detail-charts migrés vers i18n
- P3 : vague-summary-card converti avec getTranslations
- P4/P5 : chaînes résiduelles dans feed-comparison-cards et vagues-comparison-client
- P6 : uniteLabels externalisé via stock namespace
- P7/P8 : R6 corrigé (text-destructive, accent-* variables)
- P9 : benchmarks survie/densité/mortalité migrés
- P10 : Header vagues page traduit

---

## Checklist R1-R9

| Règle | Statut | Notes |
|-------|--------|-------|
| R1 — Enums MAJUSCULES | PASS | Valeurs d'enum UPPERCASE dans tous les JSON |
| R2 — Import des enums | PASS | Enums importés correctement |
| R3 — Prisma = TypeScript identiques | PASS | Aucune modification de schéma |
| R4 — Opérations atomiques | PASS | Aucune opération DB |
| R5 — DialogTrigger asChild | PASS | Conformes dans les composants modifiés |
| R6 — CSS variables du thème | PASS | api-error-message et user-role-badge corrigés |
| R7 — Nullabilité explicite | PASS | Null guards ajoutés pour les params t() |
| R8 — siteId PARTOUT | PASS | Aucun nouveau modèle |
| R9 — Tests avant review | PASS | Tests Sprint 41, build OK |

---

## Sécurité

| Point | Statut |
|-------|--------|
| Pas de secrets dans les JSON i18n | OK |
| Pas de logique métier dans les labels | OK |
| errorKey n'expose pas de détails internes | OK |
| Backward compatible (message + errorKey) | OK |

---

## Parité fr/en des 8 namespaces

| Namespace | Clés | Parité | Statut |
|-----------|------|--------|--------|
| vagues | ~60 | Complète | PASS |
| releves | ~80 | Complète | PASS |
| stock | ~50 | Complète | PASS |
| ventes | ~45 | Complète | PASS |
| alevins | ~40 | Complète | PASS |
| users | ~35 | Complète | PASS |
| commissions | ~25 | Complète | PASS |
| errors | ~30 | Complète | PASS |

---

## Points positifs

- Couverture i18n quasi-complète sur tous les modules métier
- Mécanique errorKey bien conçue, backward-compatible
- Séparation useTranslations/getTranslations respectée (Client vs Server)
- 11 routes API instrumentées avec errorKey
- Glossaire métier respecté (Vague=Batch, Bac=Tank, Relevé=Record, etc.)

---

## Décision finale

**Sprint 41 VALIDÉ. Sprint 42 peut démarrer.**
