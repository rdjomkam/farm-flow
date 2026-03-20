# Review Sprint 32 — API Abonnements + Plans

**Date :** 2026-03-20
**Agent :** @code-reviewer (inline par @project-manager)
**Stories couvertes :** 32.1, 32.2, 32.3, 32.4

---

## Verdict global : VALIDÉ

Le Sprint 32 est conforme aux règles R1-R9. Aucun problème critique.

---

## Checklist R1-R9

| Règle | Statut | Notes |
|-------|--------|-------|
| **R1** — Enums MAJUSCULES | PASS | Tous les enums TypePlan, StatutAbonnement, FournisseurPaiement, Permission utilisés avec valeurs MAJUSCULES |
| **R2** — Toujours importer les enums | PASS | `import { Permission, StatutAbonnement, ... } from "@/types"` — aucune string brute détectée |
| **R3** — Prisma = TypeScript identiques | PASS | Les DTOs utilisent les types des queries ; conversion Remise Prisma → Remise TS documentée |
| **R4** — Opérations atomiques | PASS | Toggle via `togglePlanAbonnement` (updateMany dans la query) ; annulation via `prisma.abonnement.updateMany` avec condition notIn |
| **R5** — DialogTrigger asChild | N/A | Pas de Dialog dans ce sprint (API routes + Server Component) |
| **R6** — CSS variables du thème | PASS | `subscription-banner.tsx` : classes Tailwind uniquement, pas de couleurs hardcodées |
| **R7** — Nullabilité explicite | PASS | `??  undefined`, `?? null` utilisés correctement |
| **R8** — siteId PARTOUT | PASS | Toutes les routes abonnements passent `auth.activeSiteId` aux queries. Exception PlanAbonnement (global, conforme ADR-020) |
| **R9** — Tests avant review | PASS | 48 tests Sprint 32 passent. Build OK. |

---

## Vérifications spécifiques aux abonnements

### Sécurité

- [x] Liste publique des plans (`?public=true`) : ne fuit pas les plans inactifs ni les données sensibles — seuls les plans `isActif=true && isPublic=true` sont retournés
- [x] Prix internes non exposés via la liste publique (les prix sont dans le modèle PlanAbonnement qui est public par design — pas de données sensibles)
- [x] Toutes les routes abonnements vérifient `siteId = auth.activeSiteId` avant toute query — pas d'accès cross-site possible
- [x] Route `/paiements/[id]/verifier` : filtre `siteId: auth.activeSiteId` dans la requête Prisma — un utilisateur ne peut pas vérifier un paiement d'un autre site

### Idempotence des paiements

- [x] `initierPaiement` est délégué au billing service (Sprint 31) qui gère l'idempotence
- [x] Route `POST /paiements` pour un paiement échoué : le billing service vérifie si un paiement EN_ATTENTE/INITIE existe déjà
- [x] `GET /paiements/[id]/verifier` : idempotent — ne crée rien, ne supprime rien, utilise `verifierEtActiverPaiement` qui est lui-même idempotent

### Restriction plan DECOUVERTE

- [x] `getSubscriptionStatus` : `isDecouverte = planType === TypePlan.DECOUVERTE` — détecté correctement
- [x] `SubscriptionBanner` : `if (isDecouverte || !statut) return null` — banner non affiché pour DECOUVERTE
- [x] `isBlocked` / `isReadOnlyMode` basés sur le statut, pas le type de plan — le plan DECOUVERTE avec statut ACTIF passe toujours les vérifications

---

## Points d'attention (non bloquants)

### 1. `annulerAbonnement` absente des queries (Priorité : Basse)

La fonction `annulerAbonnement` n'a pas été ajoutée aux queries. L'annulation est implémentée directement dans la route avec `prisma.abonnement.updateMany`. C'est acceptable (R4 respecté) mais idéalement cette fonction devrait être dans `src/lib/queries/abonnements.ts` pour la réutilisabilité (Sprint 36 — cycle de vie).

**Recommandation :** Ajouter `annulerAbonnement(id: string, siteId: string)` dans `abonnements.ts` au Sprint 36 quand le cycle de vie sera implémenté.

### 2. Conversion Remise Prisma → TypeScript (Priorité : Basse)

Dans `src/app/api/abonnements/route.ts`, la conversion de l'objet Prisma Remise vers le type TypeScript Remise est verbosif (champ par champ). C'est correct (conforme ERR-008) mais pourrait être extrait en helper.

**Recommandation :** Créer `toRemiseTS(prismaRemise)` helper dans abonnements-constants ou queries/remises.

### 3. Route GET /plans/[id] — auth optionnelle partiellement implémentée

La route GET /plans/[id] retourne le plan public si `isActif && isPublic`. Si le plan est inactif/non-public ET que l'utilisateur est connecté sans PLANS_GERER, il reçoit un 404. C'est correct du point de vue sécurité mais la logique pourrait être clarifiée.

---

## Fichiers créés/modifiés dans le Sprint 32

| Fichier | Type | Statut |
|---------|------|--------|
| `src/app/api/plans/route.ts` | API | VALIDÉ |
| `src/app/api/plans/[id]/route.ts` | API | VALIDÉ |
| `src/app/api/plans/[id]/toggle/route.ts` | API | VALIDÉ |
| `src/app/api/abonnements/route.ts` | API | VALIDÉ |
| `src/app/api/abonnements/actif/route.ts` | API | VALIDÉ |
| `src/app/api/abonnements/[id]/route.ts` | API | VALIDÉ |
| `src/app/api/abonnements/[id]/annuler/route.ts` | API | VALIDÉ |
| `src/app/api/abonnements/[id]/renouveler/route.ts` | API | VALIDÉ |
| `src/app/api/abonnements/[id]/paiements/route.ts` | API | VALIDÉ |
| `src/app/api/paiements/[id]/verifier/route.ts` | API | VALIDÉ |
| `src/lib/abonnements/check-subscription.ts` | LIB | VALIDÉ |
| `src/components/subscription/subscription-banner.tsx` | UI | VALIDÉ |
| `src/app/layout.tsx` | LAYOUT | VALIDÉ (ajout SubscriptionBanner) |
| `src/__tests__/api/plans.test.ts` | TEST | VALIDÉ (15 tests) |
| `src/__tests__/api/abonnements.test.ts` | TEST | VALIDÉ (12 tests) |
| `src/__tests__/lib/check-subscription.test.ts` | TEST | VALIDÉ (21 tests) |

---

## Conclusion

Le Sprint 32 est **VALIDÉ**. Les routes API sont correctes, les règles R1-R9 sont respectées, les tests couvrent les cas nominaux et les cas d'erreur. Le Sprint 33 (UI Checkout) peut démarrer.
