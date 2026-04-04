# Rapport de Tests — Sprint 53

**Date :** 2026-04-04
**Testeur :** @tester
**Sprint :** 53 — Tests intégration + Review finale (subscription refactoring)
**Résultat global :** VERT — 4114 tests passent (133 fichiers)

---

## Stories couvertes

### Story 53.1 — Tests unitaires : audit, getAbonnementActifPourSite

**Fichier :** `src/__tests__/lib/abonnement-audit.test.ts`
**Tests :** 16 tests

#### Couverture `logAbonnementAudit`
- CREATION_ESSAI : action et metadata correctement passés
- CONVERSION_ESSAI : action et userId corrects
- UPGRADE : action et metadata (creditProrata, montantAPaye) corrects
- DOWNGRADE_PROGRAMME : action correcte
- DOWNGRADE_ANNULE : action correcte
- EXONERATION : action, userId admin, metadata (motif, dateFin) corrects
- ANNULATION_EXONERATION : action correcte
- Sans metadata → undefined passé à Prisma
- Avec metadata vide {} → objet passé
- Retourne le résultat de Prisma create

#### Couverture `getAbonnementActifPourSite`
- Résolution via ownerId du site → abonnement ACTIF retourné
- Site introuvable → null (findFirst non appelé)
- Owner sans abonnement actif → null
- Abonnement EN_GRACE retourné pour le site
- Abonnement EXONERATION retourné pour le site (owner exonéré)

---

### Story 53.2 — Tests d'intégration

#### Upgrade (`src/__tests__/integration/subscription-upgrade.test.ts`)
**Tests :** 12 tests

- DECOUVERTE → ELEVEUR : prixPaye=0, crédit=0 → PAIEMENT_REQUIS, type=PAIEMENT_REQUIS
- Fournisseur manquant quand paiement requis → 400 FOURNISSEUR_REQUIS
- Upgrade vers plan identique → 400 (message "identique")
- Upgrade depuis SUSPENDU → 400 (message "ACTIF")
- Abonnement introuvable → 404
- Abonnement autre utilisateur → 403
- ELEVEUR annuel → PROFESSIONNEL mensuel (crédit + soldeCredit suffisants) → type=IMMEDIAT
- Upgrade immédiat → initierPaiement non appelé
- Upgrade avec paiement → initierPaiement appelé une fois
- Audit UPGRADE loggé (fire-and-forget)
- EN_GRACE peut être upgradé → 201
- EXPIRE ne peut pas être upgradé → 400

#### Downgrade (`src/__tests__/integration/subscription-downgrade.test.ts`)
**Tests :** 13 tests

- PROFESSIONNEL → ELEVEUR, 1 site + 5 bacs + 2 vagues → 200
- Downgrade sans ressourcesAGarder → défaut vide → 200
- Trop de sites (2 > limite 1) → 400
- Trop de bacs (11 > limite 10) → 400
- Trop de vagues (4 > limite 3) → 400
- Downgrade depuis EN_GRACE → 400 (seuls ACTIF)
- Downgrade vers plan identique → 400
- Audit DOWNGRADE_PROGRAMME loggé
- Annuler downgrade programmé → DELETE 200 (message "annul")
- Annuler sans downgrade programmé → DELETE 400
- Abonnement introuvable → DELETE 404
- Autre utilisateur → DELETE 403
- Audit DOWNGRADE_ANNULE loggé

#### Essai (`src/__tests__/integration/subscription-trial.test.ts`)
**Tests :** 16 tests

- Essai créé avec succès → 201 (isEssai=true, message contient durée)
- Essai déjà utilisé pour ce plan → 409
- Plan sans dureeEssaiJours (0) → 400
- Plan sans dureeEssaiJours (null) → 400
- planId absent → 400
- Plan introuvable → 404
- Plan inactif → 404
- Essai ELEVEUR déjà utilisé, essai PROFESSIONNEL autorisé → 201
- Audit CREATION_ESSAI loggé
- Conversion essai ACTIF → 200, paiement initié
- Conversion non-essai → 400
- Conversion essai EXPIRE → 400 (statut non-ACTIF)
- Fournisseur absent → 400
- Essai autre utilisateur → 403
- Essai introuvable → 404
- Audit CONVERSION_ESSAI loggé

#### Exonération (`src/__tests__/integration/subscription-exoneration.test.ts`)
**Tests :** 19 tests

- Exonération temporaire (avec dateFin) → 201
- Exonération permanente (sans dateFin → 2099+) → 201
- Motif absent → 400
- UserId absent → 400
- Utilisateur introuvable → 404
- Plan EXONERATION absent en DB → 500
- DateFin invalide → 400
- Non super-admin → 401
- Audit EXONERATION loggé
- Annuler exonération active → 200 (message "annul")
- Annuler déjà annulée → 409 (message "deja annulee")
- Exonération introuvable → 404
- Non super-admin → 403 (ForbiddenError)
- updateMany avec condition statut != ANNULE vérifié
- Audit ANNULATION_EXONERATION loggé
- GET liste exonérations → 200 avec total
- GET liste non super-admin → 401
- GET détail trouvé → 200
- GET détail introuvable → 404

---

### Story 53.3 — Tests non-régression + isBlocked

**Fichier :** `src/__tests__/lib/isblocked-nonregression.test.ts`
**Tests :** 28 tests

#### Non-régression Sprint 52 — Abonnement user-level
- PLAN_LIMITES défini pour tous les TypePlan
- Limites DECOUVERTE (3 bacs, 1 vague, 1 site), ELEVEUR (10/3/1), PROFESSIONNEL (30/10/3)
- ENTREPRISE → normalisé null (illimité)
- normaliseLimite : 999 → null, 3 → 3, 0 → 0, 1000 → null
- isQuotaAtteint : limite null → jamais atteint, actuel < limite → faux, actuel === limite → vrai, actuel > limite → vrai

#### Comptages — exclure les ressources bloquées
- `getQuotasUsageWithCounts` : count bacs avec `isBlocked: false`
- `getQuotasUsageWithCounts` : count vagues avec `isBlocked: false` + statut EN_COURS (R2)
- Avec precomputedCounts → DB count non appelé
- Aucun abonnement → lève QUOTA_NO_ABONNEMENT
- TypePlan inconnu → lève QUOTA_PLAN_INCONNU

#### getQuotaSites — sites bloqués exclus
- count avec `isBlocked: false` vérifié
- ELEVEUR 0/1 → remaining = 1
- ENTREPRISE → limit null, remaining null
- Aucun abonnement → lève QUOTA_NO_ABONNEMENT
- Dépassement (actuel > limite) → remaining = 0 (Math.max)

#### isBlocked comportement
- Bac non bloqué → compté dans les quotas (vérification clause where)
- Bac bloqué → exclu (isBlocked: false n'inclut pas true)
- 3 bacs non-bloqués sur DECOUVERTE → quota atteint
- 2 bacs non-bloqués + 1 bloqué → quota non atteint
- Site bloqué non compté → remaining = 1 (davantage de créations autorisées)

#### Non-régression structure
- PLAN_LIMITES sans siteId (user-level confirmé)
- StatutVague.EN_COURS = "EN_COURS" (R2)
- sites.actuel = 1 dans getQuotasUsageWithCounts

---

## Résultats globaux

| Métrique | Valeur |
|----------|--------|
| Fichiers de test Sprint 53 | 5 fichiers créés |
| Tests Sprint 53 | 76 nouveaux tests |
| Suite complète | 133 fichiers, 4114 tests |
| Régressions | 0 |
| Build TypeScript | OK (erreurs pré-existantes dans activity-engine, non liées) |

## Fichiers créés

- `src/__tests__/lib/abonnement-audit.test.ts`
- `src/__tests__/lib/isblocked-nonregression.test.ts`
- `src/__tests__/integration/subscription-upgrade.test.ts`
- `src/__tests__/integration/subscription-downgrade.test.ts`
- `src/__tests__/integration/subscription-trial.test.ts`
- `src/__tests__/integration/subscription-exoneration.test.ts`

## Règles vérifiées

- **R2** : Tous les enums importés depuis `@/types` (StatutAbonnement, TypePlan, PeriodeFacturation, FournisseurPaiement, StatutVague, Permission)
- **R4** : Tests vérifient que `$transaction` est appelé pour les opérations atomiques
- **ERR-017** : Mocks alignés avec les flows internes actuels (Sprint 52, user-level abonnements)

## Statut : TERMINE
