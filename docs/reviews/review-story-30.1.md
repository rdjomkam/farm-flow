# Review Story 30.1 — Schéma Prisma Abonnements

**Date :** 2026-03-20
**Agent :** @code-reviewer
**Verdict :** APPROUVÉ

---

## Checklist R1-R9

| Règle | Vérification | Statut |
|-------|-------------|--------|
| R1 — Enums MAJUSCULES | TypePlan: DECOUVERTE, ELEVEUR, PROFESSIONNEL, ENTREPRISE, INGENIEUR_STARTER, INGENIEUR_PRO, INGENIEUR_EXPERT — tous en UPPERCASE | PASS |
| R1 — Enums MAJUSCULES | PeriodeFacturation: MENSUEL, TRIMESTRIEL, ANNUEL | PASS |
| R1 — Enums MAJUSCULES | StatutAbonnement: ACTIF, EN_GRACE, SUSPENDU, EXPIRE, ANNULE, EN_ATTENTE_PAIEMENT | PASS |
| R1 — Enums MAJUSCULES | StatutPaiementAbo: EN_ATTENTE, INITIE, CONFIRME, ECHEC, REMBOURSE, EXPIRE | PASS |
| R1 — Enums MAJUSCULES | TypeRemise: EARLY_ADOPTER, SAISONNIERE, PARRAINAGE, COOPERATIVE, VOLUME, MANUELLE | PASS |
| R1 — Enums MAJUSCULES | StatutCommissionIng: EN_ATTENTE, DISPONIBLE, DEMANDEE, PAYEE, ANNULEE | PASS |
| R1 — Enums MAJUSCULES | FournisseurPaiement: SMOBILPAY, MTN_MOMO, ORANGE_MONEY, MANUEL | PASS |
| R3 — Prisma=TS identiques | Story 30.2 non encore faite — vérification différée | DIFF 30.2 |
| R7 — Nullabilité explicite | prixMensuel/Trimestriel/Annuel NULLABLE (DECOUVERTE = 0 prix) | PASS |
| R7 — Nullabilité explicite | dateFinGrace NULLABLE (absent pour plan gratuit) | PASS |
| R7 — Nullabilité explicite | remiseId NULLABLE sur Abonnement (remise optionnelle) | PASS |
| R7 — Nullabilité explicite | referenceExterne NULLABLE sur PaiementAbonnement, RetraitPortefeuille | PASS |
| R7 — Nullabilité explicite | traitePar NULLABLE sur RetraitPortefeuille (non encore traité) | PASS |
| R8 — siteId PARTOUT | PlanAbonnement : pas de siteId — **exception documentée** dans le JSDoc | PASS (exception) |
| R8 — siteId PARTOUT | Remise : siteId NULLABLE (remise globale possible) — documenté dans JSDoc | PASS (exception) |
| R8 — siteId PARTOUT | Abonnement, PaiementAbonnement, CommissionIngenieur, PortefeuilleIngenieur, RetraitPortefeuille : siteId String NOT NULL | PASS |
| R8 — siteId PARTOUT | RemiseApplication : pas de siteId — table de jointure pure, pas de modèle de données propre | NOTE |

---

## Observations

### Points positifs
- Toutes les valeurs d'enum en UPPERCASE (R1)
- Nullabilité correctement définie pour chaque champ (R7)
- Index pertinents sur les champs de filtre et de statut
- Relations inverses correctement nommées sur Site et User
- Commentaires JSDoc documentant les exceptions R8
- Migration propre et appliquée sans erreur
- Seed avec données cohérentes (4 plans, 2 remises, 1 abonnement ACTIF, 1 paiement CONFIRME)

### Note sur RemiseApplication
RemiseApplication n'a pas de siteId. C'est une table de jointure pure (remise × abonnement). L'abonnement référencé a son propre siteId, donc la traçabilité multi-tenant est maintenue via la FK. Acceptable.

### Points à surveiller pour Story 30.2
- R3 : les interfaces TypeScript doivent être des miroirs exacts des modèles Prisma. Vérifier que `Decimal` Prisma correspond à `number | string` ou `Prisma.Decimal` en TypeScript.
- Les permissions ajoutées (ABONNEMENTS_VOIR, etc.) doivent être exportées dans `src/types/models.ts`

---

## Verdict : APPROUVÉ

Story 30.1 peut passer en FAIT. Les Stories 30.2 et 30.3 peuvent démarrer en parallèle.
