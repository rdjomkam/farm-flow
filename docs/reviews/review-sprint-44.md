# Review Sprint 44 — Packs liés aux plans + Abonnement automatique

**Date :** 2026-03-21
**Reviewer :** @code-reviewer
**Stories :** 44.1, 44.2, 44.3, 44.4, 44.5, 44.6, 44.7

---

## Verdict : VALIDÉ (après corrections)

Le Sprint 44 est correctement implémenté. La liaison Pack → PlanAbonnement et la création automatique d'Abonnement à l'activation sont fonctionnelles, atomiques et sécurisées.

Correction appliquée :
- P3 : Champ planId remplacé par un Select avec les plans disponibles (packs-list-client.tsx)

---

## Checklist R1-R9

| Règle | Statut | Notes |
|-------|--------|-------|
| R1 — Enums MAJUSCULES | PASS | TypePlan, StatutAbonnement, PeriodeFacturation en UPPERCASE |
| R2 — Import des enums | PASS | Tous les enums importés depuis @/types |
| R3 — Prisma = TypeScript identiques | PASS | Pack.planId aligné Prisma/TS |
| R4 — Opérations atomiques | PASS | Transaction Prisma dans provisioning + createAbonnementFromPack |
| R5 — DialogTrigger asChild | PASS | Conforme dans packs-list-client et pack-detail-client |
| R6 — CSS variables du thème | PASS | Pas de couleurs hardcodées |
| R7 — Nullabilité explicite | PASS | planId NOT NULL, prixMensuel nullable pour DECOUVERTE |
| R8 — siteId PARTOUT | PASS | Pack.siteId, Abonnement.siteId présents |
| R9 — Tests avant review | PASS | Tests Sprint 44 + build OK |

---

## Sécurité

| Point | Statut |
|-------|--------|
| planId validé comme FK existante | OK |
| Pack.enabledModules complètement supprimé | OK |
| Pas de nested transactions (Prisma limitation) | OK |
| createAbonnementFromPack gère renewal/upgrade atomiquement | OK |

---

## Architecture

| Composant | Implementation | Statut |
|-----------|---------------|--------|
| Schema Pack.planId | NOT NULL FK PlanAbonnement, enabledModules supprimé | Correct |
| Migration | ADD nullable → UPDATE mapping → NOT NULL → DROP → FK + index | Correct |
| createAbonnementFromPack | Transaction: cancel old + create new + applyModules | Correct |
| Provisioning integration | Abonnement créé dans la même transaction | Correct |
| UI packs-list | Select plan au lieu de Input texte | Correct |
| UI pack-detail | Affiche plan.nom | Correct |
| UI pack-activer | Affiche plan info | Correct |

---

## Dette technique (non-bloquante)

- Duplication logique entre provisioning.ts et create-from-pack.ts (extraire createAbonnementTx partagé)
- Typage `unknown` dans calculatePrixPaye (utiliser Decimal | null)

---

## Décision finale

**Sprint 44 VALIDÉ. Sprint 45 peut démarrer.**
