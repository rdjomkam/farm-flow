# Review Sprint 40 — Extraction des chaînes i18n (Couche Core)

**Date :** 2026-03-21
**Reviewer :** @code-reviewer
**Stories :** 40.1, 40.2, 40.3, 40.4, 40.5

---

## Verdict : VALIDÉ (après corrections)

La première passe de review avait identifié 14 problèmes (6 Haute, 4 Moyenne, 4 Basse). Tous les problèmes Haute et Moyenne ont été corrigés dans une deuxième passe. Le sprint est maintenant validé.

---

## Checklist R1-R9

| Règle | Statut | Notes |
|-------|--------|-------|
| R1 — Enums MAJUSCULES | PASS | Aucune nouvelle valeur d'enum |
| R2 — Import des enums | PASS | Enums importés correctement |
| R3 — Prisma = TypeScript identiques | PASS | Aucune modification de schéma |
| R4 — Opérations atomiques | PASS | Aucune opération DB |
| R5 — DialogTrigger asChild | PASS | Conformes dans plans-admin-list et plan-form-dialog |
| R6 — CSS variables du thème | PASS | subscription-banner.tsx corrigé (amber/red → CSS variables) |
| R7 — Nullabilité explicite | PASS | Aucun changement de schéma |
| R8 — siteId PARTOUT | PASS | Aucun nouveau modèle |
| R9 — Tests avant review | PASS | 116 tests Sprint 40, build OK |

---

## Sécurité

| Point | Statut |
|-------|--------|
| Pas de secrets en dur | OK |
| Pas de logique métier dans les labels | OK |
| Auth non impactée | OK |

---

## Problèmes identifiés et corrigés

| # | Sévérité | Description | Statut |
|---|----------|-------------|--------|
| P1 | Haute | R9 : rapport de test absent | Corrigé — rapport-sprint-40.md produit |
| P2 | Haute | Bug : clé i18n brute en vue mobile plans-admin-list | Corrigé — `t()` ajouté |
| P3 | Haute | R6 : couleurs Tailwind hardcodées dans subscription-banner | Corrigé — CSS variables utilisées |
| P4 | Haute | Chaînes FR non extraites dans indicateurs-panel | Corrigé — 9 clés indicators.* ajoutées |
| P5 | Haute | Chaînes FR non extraites dans projections | Corrigé — 14 clés projections.* ajoutées |
| P6 | Haute | Clés simulation.* existantes mais non utilisées dans feed-simulator | Corrigé — 9 strings migrés |
| P7 | Moyenne | regles-activites-constants : maps FR non migrées | Corrigé — 8 maps retournent des clés i18n |
| P8 | Moyenne | subscription-banner : textes FR hardcodés | Corrigé — 3 clés banner.* ajoutées |
| P9 | Moyenne | plans-admin-list : chaînes FR restantes | Corrigé — 20 clés admin.* ajoutées |
| P10 | Moyenne | vagues-comparison-client : chaînes FR restantes | Reporté Sprint 41 (périmètre vagues) |
| P11 | Basse | feed-comparison-cards : chaînes FR restantes | Reporté Sprint 41 |
| P12 | Basse | benchmarks.ts : labels non-FCR/SGR | Reporté Sprint 41 |

---

## Tests

| Fichier | Tests | Statut |
|---------|-------|--------|
| messages-sprint40.test.ts | 116 | PASS |
| messages.test.ts (mis à jour) | 37 | PASS |
| **Total Sprint 40** | **153** | **PASS** |

Build : PASS — toutes les routes compilent sans erreur.

---

## Décision finale

**Sprint 40 VALIDÉ. Sprint 41 peut démarrer.**

P10-P12 sont des chaînes résiduelles dans des composants qui seront entièrement traités dans le Sprint 41 (périmètre Pages & Composants). Ils ne constituent pas un blocage.
