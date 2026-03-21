# Pré-analyse Story 38.1 — Page admin liste des plans
**Date :** 2026-03-21
**Sprint :** 38
**Story :** UI — Page admin liste des plans d'abonnement

## Statut : GO

## Résumé

Toutes les dépendances de la story 38.1 sont satisfaites. Le build est propre, la query `getPlansAbonnements`, la permission `Permission.PLANS_GERER`, et les routes API existent déjà. Le dossier `src/components/abonnements/` est présent. Il n'y a aucun bloquer.

---

## Vérifications effectuées

### Schema Prisma : OK

Le modèle `PlanAbonnement` dans `prisma/schema.prisma` contient les champs attendus :
- `typePlan` (enum `TypePlan`)
- `prixMensuel`, `prixTrimestriel`, `prixAnnuel` (type `Decimal?` — doivent être sérialisés en `Number`)
- `limitesSites`, `limitesBacs`, `limitesVagues`, `limitesIngFermes`
- `isActif`, `isPublic`
- `_count.abonnements` disponible via `include`

### Types TypeScript : OK

- `PlanAbonnement` interface existe dans `src/types/models.ts` (ligne ~2338), avec `prixMensuel: number | null` (déjà sérialisé dans l'interface TypeScript)
- `TypePlan` enum exporté depuis `src/types/index.ts` (Sprint 30)
- `Permission.PLANS_GERER` existe dans l'enum `Permission` (schema.prisma ligne ~196, types/models.ts en miroir)
- `CreatePlanAbonnementDTO` et `UpdatePlanAbonnementDTO` exportés depuis `src/types/index.ts`

### Query `getPlansAbonnements` : OK

Fichier : `src/lib/queries/plans-abonnements.ts`
- `getPlansAbonnements(includeInactif = false)` : signature confirmée
- Avec `includeInactif = true`, retourne TOUS les plans (actifs et inactifs)
- Inclut `_count.abonnements` (filtrés sur `ACTIF` et `EN_GRACE`)
- Fonctions supplémentaires disponibles : `getPlanAbonnementById`, `createPlanAbonnement`, `updatePlanAbonnement`, `togglePlanAbonnement`

### API Routes Plans : OK

Routes existantes et complètes :
- `GET /api/plans` — liste publique ou complète (auth + PLANS_GERER)
- `POST /api/plans` — création (auth + PLANS_GERER)
- `GET /api/plans/[id]` — détail
- `PUT /api/plans/[id]` — modification (auth + PLANS_GERER)
- `DELETE /api/plans/[id]` — désactivation soft-delete (auth + PLANS_GERER)
- `PATCH /api/plans/[id]/toggle` — toggle actif/inactif (présent dans `src/app/api/plans/[id]/toggle/route.ts`)

### Composants existants dans `src/components/abonnements/` : OK

Dossier présent. Composants existants :
- `abonnements-admin-list.tsx` — référence directe pour le pattern à suivre
- `plans-grid.tsx` — liste publique des plans (référence UI existante pour les plans)
- `plan-comparaison-table.tsx`, `abonnement-actuel-card.tsx`, `checkout-form.tsx`, `paiements-history-list.tsx`

Le composant `plans-admin-list.tsx` n'existe pas encore — à créer.

### Page admin `/admin/plans` : OK (à créer)

Le dossier `src/app/admin/plans/` n'existe pas. La page `page.tsx` est à créer.

Référence directe : `src/app/admin/abonnements/page.tsx` — pattern identique :
- `getServerSession()` + `checkPagePermission(session, Permission.PLANS_GERER)`
- Redirect `/login` si pas de session, redirect `/` si pas de permission
- Query Prisma directe ou via `getPlansAbonnements(true)`
- Sérialisation des Decimal : `Number(plan.prixMensuel)` etc.
- Cast des enums Prisma : `p.typePlan as unknown as import("@/types").TypePlan` (ERR-012)

### Navigation Sidebar : ABSENT (non bloquant)

`/admin/plans` n'est pas encore dans la sidebar (`src/components/layout/sidebar.tsx`). La section "Admin Abonnements" existe mais ne contient que le lien vers `/admin/abonnements`. Il faudra ajouter un item "Plans" dans ce groupe lors de l'implémentation ou dans un sprint de navigation.

### Build : OK

`npm run build` passe sans erreur TypeScript ni erreur de compilation. Seul avertissement : workspace root Turbopack (non lié à cette story, pré-existant).

### Tests : Non exécutés

Les tests unitaires n'ont pas été relancés dans cette pré-analyse (pas de nouveau code à valider à ce stade).

---

## Incohérences trouvées

Aucune incohérence bloquante détectée.

**Observation mineure :** la sidebar ne liste pas `/admin/plans`. Ce n'est pas un blocker pour la story 38.1 (la page sera accessible par URL directe), mais la navigation devra être mise à jour. À noter pour l'implémentation.

---

## Risques identifiés

1. **Sérialisation Decimal (ERR-012 / pattern connu)**
   La query `getPlansAbonnements()` retourne des objets Prisma avec des champs `prixMensuel`, `prixTrimestriel`, `prixAnnuel` de type `Prisma.Decimal` (pas `number`). Ces champs doivent être sérialisés avec `Number(...)` avant de passer les données au Client Component, sinon erreur de sérialisation Next.js.
   Mitigation : suivre exactement le pattern de `src/app/admin/abonnements/page.tsx` lignes 92-100.

2. **Cast enum Prisma → @/types (ERR-012)**
   Le champ `typePlan` retourné par Prisma est de type `prisma/enums.TypePlan`, incompatible directement avec `@/types.TypePlan`. Utiliser `p.typePlan as unknown as import("@/types").TypePlan`.
   Mitigation : pattern déjà documenté, déjà appliqué dans la référence.

3. **Aucun lien de navigation existant vers `/admin/plans`**
   La page sera accessible par URL directe mais pas depuis la sidebar. Impact : faible pour la story, mais le développeur doit en être informé pour ajouter le lien sidebar dans cette story ou planifier une story de navigation séparée.

---

## Prérequis manquants

Aucun prérequis manquant. Toutes les dépendances sont présentes.

---

## Fichiers à créer

| Fichier | Type | Notes |
|---------|------|-------|
| `src/app/admin/plans/page.tsx` | Server Component | Suivre `src/app/admin/abonnements/page.tsx` |
| `src/components/abonnements/plans-admin-list.tsx` | Client Component | Suivre `src/components/abonnements/abonnements-admin-list.tsx` |

---

## Fichiers de référence

| Fichier | Usage |
|---------|-------|
| `src/app/admin/abonnements/page.tsx` | Pattern Server Component admin — protection + query + sérialisation |
| `src/components/abonnements/abonnements-admin-list.tsx` | Pattern Client Component liste admin — filtres, cartes mobile, tableau desktop |
| `src/lib/queries/plans-abonnements.ts` | Query `getPlansAbonnements(true)` à utiliser |
| `src/lib/abonnements-constants.ts` | `PLAN_LABELS`, `PLAN_TARIFS`, `PLAN_LIMITES` — pour l'affichage UI |
| `src/types/models.ts` | Interface `PlanAbonnement` |

---

## Recommandation

GO. Aucune correction préalable nécessaire. Le développeur peut commencer immédiatement.

Points d'attention à communiquer au développeur :
1. Sérialiser les 3 champs Decimal (`prixMensuel`, `prixTrimestriel`, `prixAnnuel`) avec `Number(...)` dans la page serveur.
2. Caster `typePlan` avec `as unknown as import("@/types").TypePlan` (ERR-012).
3. Ajouter un item "Plans" dans le groupe "Admin Abonnements" de la sidebar.
