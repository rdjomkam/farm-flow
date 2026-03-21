# Base de Connaissances — Erreurs et Fixes

> **Ce fichier est lu par tous les agents avant de travailler.**
> Il contient les erreurs passées et comment les éviter.
> Maintenu par @knowledge-keeper.

---

## Catégorie : Schema

### ERR-001 — Enums PostgreSQL : ADD VALUE + UPDATE dans la même migration
**Sprint :** 1-2 | **Date :** 2026-03-08
**Sévérité :** Critique
**Fichier(s) :** `prisma/migrations/`

**Symptôme :**
Migration échoue sur la shadow database avec `ADD VALUE` + `UPDATE` dans la même transaction.

**Cause racine :**
PostgreSQL ne permet pas d'utiliser une valeur d'enum ajoutée dans la même transaction.

**Fix :**
Utiliser l'approche RECREATE : renommer l'ancien type → créer le nouveau → caster les colonnes → supprimer l'ancien.

**Leçon / Règle :**
JAMAIS `ADD VALUE` + `UPDATE` dans la même migration. Toujours RECREATE.

---

### ERR-002 — Prisma migrate dev échoue en mode non-interactif
**Sprint :** 1 | **Date :** 2026-03-08
**Sévérité :** Haute
**Fichier(s) :** `prisma/schema.prisma`

**Symptôme :**
`npx prisma migrate dev` attend une réponse interactive (y/n) et échoue sous Claude Code.

**Cause racine :**
L'environnement Claude Code ne supporte pas les prompts interactifs.

**Fix :**
Utiliser `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` pour générer le SQL, créer le dossier de migration manuellement, puis `npx prisma migrate deploy`.

**Leçon / Règle :**
Toujours utiliser le workflow non-interactif pour les migrations Prisma.

---

### ERR-003 — Prisma 7 ESM : seed TypeScript impossible
**Sprint :** 1 | **Date :** 2026-03-08
**Sévérité :** Haute
**Fichier(s) :** `prisma/seed.sql`

**Symptôme :**
Le Prisma Client généré utilise `import.meta.url` (ESM-only). tsx, jiti et Node natif échouent à exécuter les seed files TypeScript.

**Cause racine :**
Le générateur `prisma-client` avec output custom produit du code ESM incompatible avec les runners CJS.

**Fix :**
Utiliser du SQL brut via `docker exec -i silures-db psql -U dkfarm -d farm-flow < prisma/seed.sql`. Script npm : `npm run db:seed`.

**Leçon / Règle :**
Le seed est toujours en SQL brut, jamais en TypeScript.

---

## Catégorie : Code

### ERR-004 — updatedAt affiché au lieu de date de mesure
**Sprint :** 29+ | **Date :** 2026-03-20
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/queries/releves.ts`, `src/components/vagues/releves-list.tsx`

**Symptôme :**
La liste des relevés affichait la date de modification système (`updatedAt`) au lieu de la date de mesure (`date`).

**Cause racine :**
Le `orderBy` et l'affichage utilisaient `updatedAt` par erreur.

**Fix :**
Changer `orderBy: { updatedAt: "desc" }` → `orderBy: { date: "desc" }` et `r.updatedAt` → `r.date` dans l'affichage.

**Leçon / Règle :**
Toujours utiliser le champ métier (`date`) pour le tri et l'affichage, pas les timestamps système (`createdAt`/`updatedAt`).

---

## Catégorie : Build

### ERR-006 — Prisma migrate diff inclut le texte de sortie CLI dans le SQL
**Sprint :** 30 | **Date :** 2026-03-20
**Sévérité :** Moyenne
**Fichier(s) :** `prisma/migrations/*/migration.sql`

**Symptôme :**
La migration échoue avec `ERROR: syntax error at or near "Loaded"` ou un texte de bannière Prisma
au début ou à la fin du fichier SQL généré.

**Cause racine :**
`npx prisma migrate diff --script > file.sql` redirige TOUT le stdout, y compris les messages
de config (`Loaded Prisma config from...`) et les bannières de mise à jour (`Update available...`).

**Fix :**
Après génération, supprimer manuellement les lignes non-SQL au début et à la fin du fichier :
- Supprimer la ligne `Loaded Prisma config from prisma.config.ts.` en tête
- Supprimer le bloc `┌─────...┐` de mise à jour en pied si présent

Puis si la migration a échoué, résoudre avec :
```bash
npx prisma migrate resolve --rolled-back NOM_MIGRATION
npx prisma migrate deploy
```

**Leçon / Règle :**
Toujours vérifier que le fichier migration.sql ne contient que du SQL pur avant de déployer.
Utiliser `head -3 migration.sql` et `tail -5 migration.sql` pour vérifier.

---

## Catégorie : Pattern

### ERR-017 — Tests existants cassés après refactoring de route API (régression silencieuse)
**Sprint :** 36 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/__tests__/api/vagues.test.ts`, `src/app/api/vagues/route.ts`

**Symptôme :**
4 tests de la suite `vagues.test.ts` passent en régression après le refactoring R4 de la route `POST /api/vagues`. Le build CI détecte des échecs que le développeur n'a pas vus car il n'a relancé que les nouveaux tests.

**Cause racine :**
Le refactoring R4 a déplacé le check quota et la création dans une `$transaction()`, changeant le flow interne de la route (plus d'appel direct à `getQuotasUsage()`, erreur levée différemment via `throw` dans la transaction). Les mocks dans les tests existants ciblaient l'ancien flow et n'ont pas été mis à jour en même temps que le code.

**Fix :**
Après le refactoring, mettre à jour les mocks de la suite de tests correspondante pour refléter le nouveau flow : retirer le mock de `getQuotasUsage`, adapter les stubs de `prisma.$transaction` pour simuler le reject ou resolve selon les cas.

**Leçon / Règle :**
Après tout refactoring de route API qui change le flow interne (ordre des appels, encapsulation dans une transaction, remplacement d'une fonction par une autre), toujours relancer `npx vitest run` sur la suite de tests de cette route spécifiquement avant de déclarer le refactoring terminé. Si des mocks ne correspondent plus au nouveau flow, les mettre à jour dans le même commit que le refactoring.

---

### ERR-016 — Race condition check-then-create sur les quotas de plan (R4)
**Sprint :** 36 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/bacs/route.ts`, `src/app/api/vagues/route.ts`

**Symptôme :**
Deux requêtes POST concurrentes passent simultanément le check de quota (`getQuotasUsage()`) et créent toutes les deux leur ressource, dépassant la limite du plan. Aucune erreur n'est levée, le dépassement est silencieux.

**Cause racine :**
Le pattern `getQuotasUsage() → if quota atteint → create` n'est pas atomique. Entre le moment du count et celui de la création, une autre requête concurrente peut effectuer le même count (qui retourne la même valeur) et procéder à sa propre création.

**Fix :**
Encapsuler le count et la création dans `prisma.$transaction()` pour que le check et la création soient atomiques :

```typescript
// Avant (non-atomique, vulnérable aux race conditions) :
const usage = await getQuotasUsage(siteId);
if (usage.bacs >= plan.limiteBacs) {
  return NextResponse.json({ error: "Quota atteint" }, { status: 403 });
}
const bac = await prisma.bac.create({ data });

// Après (atomique) :
const bac = await prisma.$transaction(async (tx) => {
  const count = await tx.bac.count({ where: { siteId } });
  if (count >= plan.limiteBacs) {
    throw new Error("QUOTA_ATTEINT");
  }
  return tx.bac.create({ data });
});
```

**Leçon / Règle :**
R4 s'applique aussi aux créations conditionnelles : quand une création dépend d'un comptage de limite (quotas, stock, places disponibles, etc.), toujours mettre le count + create dans la même transaction. Le pattern check-then-create hors transaction est toujours vulnérable aux race conditions sous charge.

**Complément Sprint 36 :** Quand on refactorise une route pour appliquer R4, identifier toutes les routes similaires dans le même fichier ou dans des fichiers parallèles (ex : `/api/bacs` ET `/api/vagues` traitent toutes les deux des quotas de plan). Corriger le pattern sur TOUTES ces routes en même temps. Un fix partiel laisse une surface d'attaque résiduelle.

---

### ERR-005 — Check-then-update au lieu d'opérations atomiques (R4)
**Sprint :** 2 | **Date :** 2026-03-08
**Sévérité :** Haute
**Fichier(s) :** divers

**Symptôme :**
Race conditions possibles quand on fait `findFirst` puis `update` sans transaction.

**Cause racine :**
Pattern "vérifier puis modifier" non atomique.

**Fix :**
Utiliser `$transaction()` avec `updateMany` conditionnel ou `findFirst` + `update` dans la même transaction.

**Leçon / Règle :**
R4 : Toujours utiliser des opérations atomiques. `$transaction()` pour les opérations multi-étapes.

---

### ERR-008 — Conflit enum Prisma généré vs TypeScript dans les routes/services
**Sprint :** 31 | **Date :** 2026-03-20
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/webhooks/`, `src/lib/services/billing.ts`

**Symptôme :**
Erreur TypeScript `Type 'import(".../prisma/enums").StatutPaiementAbo' is not assignable to
type 'import(".../types/models").StatutPaiementAbo'` lors de l'utilisation des résultats
de queries Prisma dans les routes ou services.

**Cause racine :**
Prisma génère ses propres enums dans `src/generated/prisma/enums`. Ces enums sont
distincts des enums TypeScript dans `src/types/models.ts`, même si les valeurs sont identiques.
Quand une query retourne un objet Prisma (ex: `paiementAbonnement.statut`), son type est
`prisma/enums.StatutPaiementAbo`, pas `types/models.StatutPaiementAbo`.

**Fix :**
Option 1 (comparaison) : Caster en string pour comparer :
```typescript
if ((paiement.statut as string) === StatutPaiementAbo.CONFIRME) { ... }
```

Option 2 (passage à Prisma) : Caster le type pour les fonctions Prisma directes :
```typescript
const gateway = getPaymentGateway(paiement.fournisseur as FournisseurPaiement);
```

Option 3 (recommandée) : Utiliser les fonctions de query Sprint 30/31 qui gèrent les
enums en interne plutôt que d'appeler Prisma directement dans les routes :
```typescript
// Au lieu de : tx.abonnement.updateMany({ data: { statut: "ACTIF" as never } })
// Utiliser : activerAbonnement(abonnementId) — qui fait le updateMany en interne
await confirmerPaiement(referenceExterne);
await activerAbonnement(abonnementId);
```

**Leçon / Règle :**
Dans les routes API et services, TOUJOURS utiliser les fonctions de query plutôt que d'appeler
Prisma directement avec des statuts d'enum. Les fonctions de query gèrent le conflit d'enum
correctement. Si la comparaison directe est nécessaire, utiliser `(val as string) === Enum.VALUE`.

---

### ERR-007 — Prisma Json field : type InputJsonValue requis pour update
**Sprint :** 30 | **Date :** 2026-03-20
**Sévérité :** Basse
**Fichier(s) :** `src/lib/queries/*.ts`

**Symptôme :**
Erreur TypeScript `Type 'Record<string, unknown> | undefined' is not assignable to type 'NullableJsonNullValueInput | InputJsonValue | undefined'`
lors de la mise à jour d'un champ `Json?` Prisma.

**Cause racine :**
Prisma génère des types spécifiques pour les champs Json. `Record<string, unknown>` est compatible
mais TypeScript ne peut pas l'inférer directement sans cast.

**Fix :**
Utiliser un cast vers `Prisma.InputJsonValue` :
```typescript
import type { Prisma } from "@/generated/prisma/client";

// Dans l'update :
...(metadata !== undefined && {
  metadata: metadata as Prisma.InputJsonValue
})
```

**Leçon / Règle :**
Pour les champs `Json?` Prisma en update, toujours caster avec `as Prisma.InputJsonValue`.

---

### ERR-012 — Cast enums Prisma généré vs @/types dans les Server Components
**Sprint :** 33 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/app/*/page.tsx`, `src/generated/prisma/enums.ts`

**Symptôme :**
```
Type '"DECOUVERTE"' is not assignable to type 'TypePlan'
```
Les enums Prisma générés dans `src/generated/prisma/enums.ts` ne sont pas compatibles avec les enums de `src/types/models.ts` même si les valeurs string sont identiques (R1 garantit l'identité).

**Cause racine :**
Prisma génère ses propres enums dans un namespace isolé. TypeScript refuse l'assignation directe même si les valeurs sont les mêmes.

**Fix :**
Utiliser le cast `as unknown as import("@/types").TypePlan` pour convertir les retours Prisma avant de les passer à des composants typés `@/types`.

```typescript
// Dans la Server Component page.tsx :
statut: prismaResult.statut as unknown as import("@/types").StatutAbonnement,
typePlan: prismaResult.plan.typePlan as unknown as import("@/types").TypePlan,
```

**Leçon / Règle :**
Quand une Server Component lit depuis Prisma et passe les données à un composant avec des types `@/types`, toujours caster les enums Prisma via `as unknown as TypeCible`. Ce cast est sûr car R1 garantit que toutes les valeurs d'enum sont UPPERCASE et identiques entre Prisma et `@/types`.

---

### ERR-015 — Double vérification redondante de déduplication avant une fonction qui déduplique déjà
**Sprint :** 36 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/services/rappels-abonnement.ts`

**Symptôme :**
Le service effectuait une requête `COUNT` en base (`rappelExisteAujourdhui`) avant chaque appel à `creerNotificationSiAbsente`, entraînant une double requête DB par rappel traité.

**Cause racine :**
`creerNotificationSiAbsente` inclut déjà une vérification interne d'unicité avant d'insérer. La pré-vérification externe dupliquait exactement cette logique sans apporter de valeur supplémentaire.

**Fix :**
Supprimer la pré-vérification `rappelExisteAujourdhui`. Déléguer entièrement la déduplication à `creerNotificationSiAbsente` qui est conçue pour ça.

**Leçon / Règle :**
Avant d'ajouter une vérification en amont d'un appel de fonction, lire ce que fait cette fonction. Si elle intègre déjà une déduplication ou un guard, ne pas en ajouter une couche supplémentaire à l'extérieur. Une double vérification identique double le nombre de requêtes DB sans garantie supplémentaire.

---

### ERR-014 — Boucle de updateMany séquentiels sans $transaction (R4)
**Sprint :** 36 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/lib/services/abonnement-lifecycle.ts`

**Symptôme :**
Un CRON job exécutait une boucle `for` de plusieurs `updateMany` séquentiels sans transaction globale. Un crash ou une erreur en milieu de boucle laissait la base dans un état partiellement mis à jour (certains abonnements transitionnnés, d'autres non).

**Cause racine :**
Chaque `updateMany` est atomique individuellement, mais une séquence de `updateMany` dans une boucle sans `$transaction` n'est pas atomique globalement. Une interruption entre deux itérations produit une exécution partielle.

**Fix :**
Collecter toutes les opérations dans un tableau, puis les envelopper dans `prisma.$transaction([...])` (forme batch) :

```typescript
// Avant (non-atomique) :
for (const operation of operations) {
  await prisma.abonnement.updateMany({ where: operation.where, data: operation.data });
}

// Après (atomique) :
const updates = operations.map((operation) =>
  prisma.abonnement.updateMany({ where: operation.where, data: operation.data })
);
await prisma.$transaction(updates);
```

**Leçon / Règle :**
R4 s'applique aussi aux boucles : quand plusieurs `updateMany` (ou autres opérations Prisma) doivent s'exécuter ensemble, toujours les regrouper dans `prisma.$transaction([...])`. L'atomicité individuelle de chaque opération ne suffit pas — c'est l'ensemble de la séquence qui doit être atomique.

---

### ERR-013 — Rate limiting en mémoire non partagé entre instances serverless
**Sprint :** 35 | **Date :** 2026-03-21
**Sévérité :** Basse (dev/staging), Moyenne (production)
**Fichier(s) :** `src/app/api/remises/verifier/route.ts`

**Symptôme :**
En production avec plusieurs instances serverless (Vercel), le rate limiting via `Map` en mémoire n'est pas partagé entre les instances. Un même utilisateur peut dépasser la limite en envoyant des requêtes sur des instances différentes.

**Cause racine :**
Chaque instance serverless a sa propre mémoire. La `Map` est locale à l'instance.

**Fix pour production :**
Utiliser un store partagé comme Redis (Upstash) ou le middleware Vercel pour le rate limiting.

```typescript
// Alternative avec Upstash Redis :
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
});
```

**Leçon / Règle :**
Le rate limiting in-memory est acceptable en Phase 2 (dev/staging). Pour la production, migrer vers un store partagé avant le déploiement final.

---
