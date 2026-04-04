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

### ERR-018 — String en dur comme clé d'accès à un objet constant indexé par enum (variante R2)
**Sprint :** 37 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/services/abonnements.ts`, divers

**Symptôme :**
Un accès à un objet constant (`PLAN_LIMITES`) utilisait une string littérale comme clé d'index (`PLAN_LIMITES["DECOUVERTE"]`) au lieu de l'enum (`PLAN_LIMITES[TypePlan.DECOUVERTE]`). Pas d'erreur TypeScript immédiate si l'objet est typé `Record<string, ...>`, mais la valeur d'accès est découplée de l'enum : si l'enum change de nom, le compilateur ne détecte pas la régression.

**Cause racine :**
R2 est souvent appliqué aux comparaisons (`statut === "ACTIF"`) et aux paramètres Prisma, mais oublié pour les accès à des objets constants (`MAP[cle]`). L'accès par string en dur ressemble visuellement à un accès valide mais contourne le système de types.

**Fix :**
Utiliser l'enum comme clé d'index dans tous les accès à des objets constants indexés par des valeurs d'enum :

```typescript
// Incorrect (string en dur) :
const limites = PLAN_LIMITES["DECOUVERTE"];

// Correct (enum comme clé) :
import { TypePlan } from "@/types";
const limites = PLAN_LIMITES[TypePlan.DECOUVERTE];
```

**Leçon / Règle :**
R2 ("Toujours importer les enums") s'applique partout où une valeur d'enum est utilisée comme identifiant : comparaisons, paramètres de fonction, clés d'objet/Map, switch-case. Si un objet constant est indexé par des valeurs d'enum, chaque accès à cet objet doit utiliser `Enum.VALEUR` comme clé, jamais `"VALEUR"` en dur.

---

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

### ERR-015 — Double vérification redondante avant une opération déjà conditionnelle
**Sprint :** 36-37 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/services/rappels-abonnement.ts`, divers

**Symptôme :**
Deux formes observées :

1. (Sprint 36) Le service effectuait une requête `COUNT` en base (`rappelExisteAujourdhui`) avant chaque appel à `creerNotificationSiAbsente`, entraînant une double requête DB par rappel traité.

2. (Sprint 37) Un `findFirst` de vérification précédait un `updateMany` qui filtrait déjà par condition. Le `findFirst` était du code mort : si aucun enregistrement ne matchait la condition, le `updateMany` ne faisait rien de toute façon.

**Cause racine :**
Dans le cas 1 : `creerNotificationSiAbsente` inclut déjà une vérification interne d'unicité. La pré-vérification externe dupliquait cette logique.

Dans le cas 2 : un `updateMany` avec clause `where` est par nature conditionnel — il ne met à jour que les lignes qui matchent et ne lève pas d'erreur si aucune ne matche. Un `findFirst` préalable n'ajoute aucune garantie.

**Fix :**
Cas 1 : Supprimer la pré-vérification, déléguer entièrement la logique à la fonction appelée.

Cas 2 : Supprimer le `findFirst`. Laisser le `updateMany` gérer seul la condition :
```typescript
// Inutile (code mort) :
const existing = await prisma.foo.findFirst({ where: { id, siteId, statut: "ACTIF" } });
if (!existing) return; // updateMany ferait de toute façon 0 lignes
await prisma.foo.updateMany({ where: { id, siteId, statut: "ACTIF" }, data: { statut: "INACTIF" } });

// Correct :
await prisma.foo.updateMany({ where: { id, siteId, statut: "ACTIF" }, data: { statut: "INACTIF" } });
```

**Leçon / Règle :**
Avant d'ajouter une vérification en amont d'un appel, se demander : "que se passe-t-il si cette vérification retourne faux/vide ?". Si la réponse est "l'opération suivante ne fait rien de toute façon", la pré-vérification est du code mort. Une double vérification identique double le nombre de requêtes DB sans garantie supplémentaire et donne une fausse impression de sécurité.

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

### ERR-019 — R6 : couleurs Tailwind hardcodées dans les composants PWA (pattern systémique)
**Sprint :** 27, 29, 30, 31 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/app/~offline/page.tsx`, `src/components/sw-register.tsx`, `src/components/install-prompt.tsx`, `src/components/sync-status-panel.tsx`, `src/components/offline-indicator.tsx`

**Symptôme :**
Les composants PWA utilisent des classes Tailwind avec des couleurs en dur : `bg-teal-600`, `text-teal-600`, `bg-white`, `text-gray-400`. Le thème dark mode et toute modification de la palette de couleurs ne se propagent pas à ces composants.

**Cause racine :**
Lors de la création de nouveaux composants standalone (page offline, bannière SW, indicateurs sync), les développeurs ont utilisé les couleurs Tailwind directes au lieu des classes de thème. Ce pattern se répète sur tous les sprints PWA (27, 29, 30, 31), indiquant que la règle R6 n'est pas consultée lors de l'écriture des nouveaux composants.

**Fix :**
Remplacer systématiquement les couleurs Tailwind directes par leurs équivalents de thème :
- `bg-teal-600` → `bg-primary`
- `text-teal-600` → `text-primary`
- `bg-white` → `bg-background`
- `text-gray-400` → `text-muted-foreground`
- `text-gray-600` → `text-foreground`
- `border-gray-200` → `border-border`

**Leçon / Règle :**
R6 : Jamais de couleurs Tailwind directes (teal-*, gray-*, white, black) dans les composants. Toujours utiliser les classes de thème (`bg-primary`, `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, etc.). Les composants PWA (offline, SW, install prompt, sync panel) sont des composants UI comme les autres et soumis aux mêmes règles. Pendant la creation d'un nouveau composant, chercher toute occurrence de `-teal-`, `-gray-`, `bg-white`, `text-white` avant de terminer.

---

### ERR-020 — R2 : string literal "MORTALITE" au lieu de TypeReleve.MORTALITE dans un service
**Sprint :** 29 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/lib/services/releve.service.ts` (ligne 57)

**Symptôme :**
Le service utilise la string `"MORTALITE"` en dur pour filtrer les relevés de mortalité. Si la valeur de l'enum TypeReleve change ou est renommée, TypeScript ne détecte pas la régression dans ce fichier.

**Cause racine :**
R2 est souvent respecté dans les routes API et les requêtes Prisma, mais oublié dans les services métier où les comparaisons de type sont moins visibles. Les services reçoivent souvent des données typées depuis Prisma et comparent avec des strings en dur sans importer l'enum.

**Fix :**
```typescript
// Incorrect :
if (releve.typeReleve === "MORTALITE") { ... }

// Correct :
import { TypeReleve } from "@/types";
if (releve.typeReleve === TypeReleve.MORTALITE) { ... }
```

**Leçon / Règle :**
R2 s'applique dans TOUS les fichiers sans exception : routes API, services, queries, hooks, composants. Dans les services métier en particulier, auditer systématiquement les comparaisons `=== "VALEUR"` sur des champs qui correspondent à des enums. Utiliser `TypeReleve.MORTALITE`, jamais `"MORTALITE"`.

---

### ERR-021 — Securite crypto : unwrapDataKey retourne une cle extractable
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Haute (securite)
**Fichier(s) :** `src/lib/offline/crypto.ts`

**Symptôme :**
La fonction `unwrapDataKey` appelle `crypto.subtle.unwrapKey` avec `extractable: true`. Cela signifie que la cle dechiffree peut etre exportee hors du contexte WebCrypto par n'importe quel code JavaScript ayant acces a l'objet `CryptoKey`, y compris du code malveillant injecte (XSS).

**Cause racine :**
La valeur par defaut ou une copie depuis un exemple d'unwrap a conserve `extractable: true`. La difference entre `true` et `false` est subtile visuellement mais critique pour la securite.

**Fix :**
```typescript
// Incorrect (cle exportable hors WebCrypto) :
const dataKey = await crypto.subtle.unwrapKey(
  "raw", wrappedKey, kek,
  { name: "AES-KW" },
  { name: "AES-GCM" },
  true,        // extractable — DANGEREUX
  ["encrypt", "decrypt"]
);

// Correct (cle confinee dans WebCrypto) :
const dataKey = await crypto.subtle.unwrapKey(
  "raw", wrappedKey, kek,
  { name: "AES-KW" },
  { name: "AES-GCM" },
  false,       // extractable: false — cle non exportable
  ["encrypt", "decrypt"]
);
```

**Leçon / Règle :**
Dans toute utilisation de `crypto.subtle.importKey`, `crypto.subtle.unwrapKey` ou `crypto.subtle.generateKey`, poser `extractable: false` sauf si l'export explicite de la cle est necessaire (ex: sauvegarde). Les cles de chiffrement de donnees utilisateur ne doivent jamais etre exportables. Auditer tous les appels WebCrypto lors de chaque code review de la couche crypto.

---

### ERR-022 — Securite : delai exponentiel absent apres echecs de PIN (tentatives 3 a 5)
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Haute (securite)
**Fichier(s) :** `src/lib/offline/auth-cache.ts`

**Symptôme :**
La validation du PIN offline n'applique pas de delai exponentiel entre les tentatives 3 et 5. Un attaquant peut bruteforcer un PIN a 4 chiffres (10 000 combinaisons) sans contrainte de temps apres 2 echecs.

**Cause racine :**
L'ADR definissait ce comportement (blocage progressif des tentatives 3-5) mais l'implementation dans `auth-cache.ts` ne l'a pas inclus. Le compteur d'echecs est maintenu mais le delai correspondant n'est pas applique.

**Fix :**
Apres verification du nombre d'echecs, appliquer un delai avant de retourner la reponse :
```typescript
const DELAYS_MS = [0, 0, 0, 2_000, 5_000, 10_000]; // index = nb echecs

async function verifyPin(pin: string): Promise<boolean> {
  const meta = await getAuthMeta();
  const failCount = meta.failedAttempts ?? 0;
  const delay = DELAYS_MS[Math.min(failCount, DELAYS_MS.length - 1)];
  if (delay > 0) await new Promise(r => setTimeout(r, delay));
  // ... verification PBKDF2 ...
}
```

**Leçon / Règle :**
Toute interface de validation de secret (PIN, code, mot de passe) doit implementer un delai exponentiel cote serveur/service — pas uniquement cote UI. Si l'ADR specifie un comportement de securite, l'implementation doit l'inclure explicitement. Lors de la review d'une couche d'authentification, verifier que chaque spec de securite de l'ADR a un test de non-regression correspondant.

---

### ERR-023 — R8 : RefRecord sans siteId dans la couche de cache offline (fuite multi-tenant)
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Haute (multi-tenancy)
**Fichier(s) :** `src/lib/offline/ref-cache.ts`, `src/lib/offline/db.ts`

**Symptôme :**
Le modele `RefRecord` (donnees de reference mises en cache dans IndexedDB) ne possede pas de champ `siteId`. Un utilisateur membre de plusieurs sites peut lire les donnees de reference d'un site dans le contexte d'un autre site. La fonction `clearSiteRefData` efface tous les sites faute de filtre.

**Cause racine :**
R8 ("siteId PARTOUT") est bien applique aux modeles Prisma mais pas aux interfaces TypeScript des structures IndexedDB offline. Les structures de cache cote client sont des "modeles" au sens large et doivent aussi isoler les donnees par site.

**Fix :**
Ajouter `siteId: string` au type `RefRecord` et a tous les stores IndexedDB contenant des donnees multi-tenant. Toutes les fonctions de lecture/ecriture doivent filtrer par `siteId`. La fonction `clearSiteRefData` doit accepter un `siteId` en parametre et ne supprimer que les entrees correspondantes :
```typescript
interface RefRecord {
  id: string;
  siteId: string;   // OBLIGATOIRE — R8
  type: string;
  data: unknown;
  cachedAt: number;
}

async function clearSiteRefData(siteId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("refData", "readwrite");
  const index = tx.store.index("by-site");
  const keys = await index.getAllKeys(siteId);
  await Promise.all(keys.map(k => tx.store.delete(k)));
}
```

**Leçon / Règle :**
R8 s'applique a TOUTES les structures de donnees qui stockent des informations metier : modeles Prisma, interfaces TypeScript, stores IndexedDB, caches locaux, fichiers JSON. Toute structure contenant des donnees qui appartiennent a un site doit avoir `siteId`. Le mode offline ne fait pas exception : les donnees isolees en base doivent l'etre aussi en cache local.

---

### ERR-024 — R4 : count + put non atomique dans la queue offline (race condition)
**Sprint :** 28 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/offline/queue.ts`

**Symptôme :**
La fonction `enqueue` effectue un `count` des items en attente puis un `put` pour ajouter le nouvel item en deux operations IndexedDB separees. Sous acces concurrent (deux onglets, deux requetes simultanees), deux `count` peuvent retourner la meme valeur avant que l'un des `put` ne soit execute, permettant de depasser la limite de la queue.

**Cause racine :**
R4 ("operations atomiques") est applique aux mutations Prisma mais oublié pour les operations IndexedDB. La transaction IndexedDB existe pour exactement ce cas : grouper count + put dans une seule transaction garantit l'atomicite.

**Fix :**
Encapsuler `count` et `put` dans la meme transaction IndexedDB :
```typescript
async function enqueue(item: QueueItem): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("queue", "readwrite");
  const count = await tx.store.count();
  if (count >= MAX_QUEUE_SIZE) {
    tx.abort();
    throw new Error("QUEUE_FULL");
  }
  await tx.store.put(item);
  await tx.done;
}
```

**Leçon / Règle :**
R4 s'applique aussi aux operations IndexedDB : count + put, get + put, et tout pattern check-then-write doit s'executer dans la meme transaction IndexedDB. IndexedDB dispose de transactions pour cette raison. Ne pas confondre "base de donnees locale" avec "pas besoin d'atomicite".

---

### ERR-025 — Sync : delai de retry calcule depuis createdAt au lieu de lastAttemptAt
**Sprint :** 29-30 | **Date :** 2026-03-21
**Sévérité :** Haute
**Fichier(s) :** `src/lib/offline/sync.ts` (ligne 106), `src/lib/offline/db.ts`, `src/lib/offline/queue.ts`

**Symptôme :**
Le calcul du delai de backoff exponentiel entre les tentatives de synchronisation utilise `createdAt` (date de creation de l'item dans la queue) au lieu de `lastAttemptAt` (date de la derniere tentative). Un item cree il y a plusieurs heures mais avec une seule tentative recente peut se voir attribuer un delai incorrect, causant soit des retries trop frequents soit des retries indefiniment bloques.

**Cause racine :**
Le champ `lastAttemptAt` n'existe pas dans le schema `QueueItem` dans `db.ts`. La logique de retry dans `sync.ts` utilise le seul timestamp disponible (`createdAt`) faute d'alternative. C'est a la fois un bug de schema et un bug de logique.

**Fix :**
1. Ajouter `lastAttemptAt: number | null` au type `QueueItem` dans `db.ts`.
2. Mettre a jour `lastAttemptAt` a chaque tentative dans `sync.ts` (via un `put` avant de tenter la requete).
3. Calculer le delai de retry depuis `lastAttemptAt` (ou `createdAt` si `lastAttemptAt` est null pour la premiere tentative) :
```typescript
const baseTime = item.lastAttemptAt ?? item.createdAt;
const delay = Math.min(BASE_DELAY_MS * 2 ** item.retryCount, MAX_DELAY_MS);
if (Date.now() - baseTime < delay) continue; // pas encore le moment
```

**Leçon / Règle :**
Dans tout systeme de retry avec backoff, le delai doit etre calcule depuis le dernier echec (`lastAttemptAt`), pas depuis la creation (`createdAt`). Ces deux timestamps ont des semantiques differentes. Lors de la conception d'un schema de queue, toujours inclure `lastAttemptAt`, `retryCount` et `status` comme champs obligatoires.

---

### ERR-026 — TypeScript : IdempotencyResult non discrimine — statusCode potentiellement undefined
**Sprint :** 29-30 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/offline/idempotency.ts`

**Symptôme :**
Le type `IdempotencyResult` n'est pas une union discriminante. Le champ `statusCode` peut etre `undefined` meme dans les branches ou il est attendu. TypeScript ne peut pas affiner le type dans les switch/if, forcant des assertions non nulles (`!`) ou des verifications redondantes.

**Cause racine :**
Le type a ete defini comme une interface plate avec des champs optionnels au lieu d'une union discriminante avec un champ litterale commun (`kind` ou `type`).

**Fix :**
Refactoriser en union discriminante :
```typescript
// Incorrect (interface plate) :
interface IdempotencyResult {
  found: boolean;
  statusCode?: number;
  body?: unknown;
}

// Correct (union discriminante) :
type IdempotencyResult =
  | { kind: "HIT"; statusCode: number; body: unknown }
  | { kind: "MISS" };

// Usage :
if (result.kind === "HIT") {
  return new Response(JSON.stringify(result.body), { status: result.statusCode });
  // TypeScript sait que statusCode est number ici
}
```

**Leçon / Règle :**
Toute interface representant un resultat a plusieurs etats mutuellement exclusifs (trouve/non trouve, succes/echec, ok/erreur) doit etre une union discriminante TypeScript avec un champ litterale (`kind`, `type`, `status`). Les interfaces plates avec champs optionnels forcent des verifications defensives a chaque usage et masquent les etats invalides. Lors de la creation d'un type de resultat, se demander : "tous les champs ont-ils du sens dans tous les etats ?" Si non, utiliser une union discriminante.

---

### ERR-027 — API deprecie : navigator.platform au lieu de navigator.userAgentData
**Sprint :** 29-31 | **Date :** 2026-03-21
**Sévérité :** Moyenne
**Fichier(s) :** `src/hooks/use-install-prompt.ts` (ligne 48)

**Symptôme :**
Le hook utilise `navigator.platform` pour detecter iOS et ainsi conditionner l'affichage du prompt d'installation PWA. `navigator.platform` est marque comme deprecie dans les specs et peut retourner des valeurs incorrectes ou vides sur les navigateurs recents.

**Cause racine :**
`navigator.platform` etait la solution standard pour la detection de plateforme avant l'introduction de `navigator.userAgentData`. Son utilisation persiste par habitude ou copie d'exemples anciens.

**Fix :**
Utiliser `navigator.userAgentData` avec fallback sur `navigator.platform` pour la compatibilite :
```typescript
function isIOS(): boolean {
  // Priorite a l'API moderne (Chrome 90+, Edge 90+)
  if ("userAgentData" in navigator) {
    return (navigator as Navigator & { userAgentData: { platform: string } })
      .userAgentData.platform === "iOS";
  }
  // Fallback legacy
  return /iPhone|iPad|iPod/.test(navigator.platform);
}
```

**Leçon / Règle :**
Ne pas utiliser `navigator.platform` dans le nouveau code. Utiliser `navigator.userAgentData.platform` (avec fallback) pour la detection de plateforme. Plus generalement, avant d'utiliser une API navigateur, verifier son statut de depreciation sur MDN. Les APIs deprecated peuvent disparaitre silencieusement dans les mises a jour navigateur.

---

### ERR-032 — Next.js 16+ : `revalidateTag` requiert 2 arguments (faux positif de review)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Basse (faux positif)
**Fichier(s) :** `src/app/api/*/route.ts`, tout fichier appelant `revalidateTag`

**Symptôme :**
Un reviewer signale `revalidateTag(tag, {})` comme un bug ("le deuxième argument n'existe pas"). Mais le build passe sans erreur et l'invalidation fonctionne correctement.

**Cause racine :**
L'API `revalidateTag` a changé entre les versions Next.js. En Next.js 14, la signature est `revalidateTag(tag: string)` (1 argument). En Next.js 16.1.6+, la signature est `revalidateTag(tag: string, profile: string | CacheLifeConfig)` (2 arguments requis). Passer `{}` comme deuxième argument est valide pour le profil par défaut.

**Fix :**
Aucun fix nécessaire si le projet utilise Next.js 16.1.6+. Vérifier la version dans `package.json` avant de signaler ce pattern comme bug.

**Leçon / Règle :**
Avant de signaler l'usage d'un argument "non existant" sur une API Next.js, vérifier la version du package dans `package.json`. Les signatures des APIs Next.js évoluent entre versions majeures. Un appel à `revalidateTag(tag, {})` est correct en Next.js 16+ et incorrect en Next.js 14. Ne pas supposer la version à partir de la documentation en ligne — lire `package.json` en priorité.

---

### ERR-031 — R2 : `as keyof typeof` pour accéder à un objet constant indexé par enum (Story 46.1)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Moyenne
**Fichier(s) :** `src/lib/abonnements/check-subscription.ts`

**Symptôme :**
Accès à `PLAN_LIMITES` via `PLAN_LIMITES[plan.typePlan as keyof typeof PLAN_LIMITES]`. Pas d'erreur TypeScript immédiate mais le cast `as keyof typeof` contourne le système de types : si la valeur de l'enum ou le type de l'objet constant divergent, le compilateur ne détecte pas la régression.

Variante additionnelle (Stories 46.2-46.3) : `PLAN_LIMITES[plan.typePlan as string]`. Le cast `as string` est encore plus permissif que `as keyof typeof` — TypeScript n'émet aucune erreur mais l'accès est complètement découplé du système de types. Les deux casts (`as string` et `as keyof typeof`) sont des violations R2 équivalentes.

**Cause racine :**
Variante de la violation R2 déjà documentée en ERR-018 : au lieu d'une string littérale en dur, on utilise ici un cast de type pour accéder à l'objet constant. Le résultat est identique — la valeur d'enum n'est pas utilisée via l'enum importé, ce qui découple l'accès du système de types.

**Fix :**
```typescript
// Incorrect — cast as keyof typeof :
const limites = PLAN_LIMITES[plan.typePlan as keyof typeof PLAN_LIMITES];

// Incorrect — cast as string (tout aussi problématique) :
const limites = PLAN_LIMITES[plan.typePlan as string];

// Correct (enum comme clé, avec import explicite) :
import { TypePlan } from "@/types";
const limites = PLAN_LIMITES[plan.typePlan as TypePlan];
// ou, si la valeur est une constante connue :
const limites = PLAN_LIMITES[TypePlan.DECOUVERTE];
```

**Leçon / Règle :**
Voir ERR-018 pour la règle générale. Cette entrée couvre deux variantes du même anti-pattern : `as keyof typeof OBJ` et `as string`. Les deux sont des violations R2. Toujours utiliser `as TypeEnum` (le type de l'enum importé) si un cast est nécessaire. Si l'objet constant est `Record<TypePlan, ...>`, TypeScript accepte directement `PLAN_LIMITES[valeurTypee]` sans cast dès que la variable est typée `TypePlan`.

**Voir aussi :** ERR-018 (même pattern avec string littérale en dur), Sprint 37.

---

### ERR-030 — R4 : quota check + création de ressource dans des transactions séparées (Story 46.1)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Haute
**Fichier(s) :** `src/app/api/vagues/route.ts`

**Symptôme :**
La route `POST /api/vagues` effectuait le check de quota dans une fonction externe (`checkSubscription`) puis créait la vague dans un appel Prisma séparé. Deux requêtes concurrentes peuvent passer le check simultanément et créer toutes les deux une vague, dépassant silencieusement la limite du plan.

**Cause racine :**
Nouveau pattern de violation R4 : la séparation n'est pas un `findFirst` + `update` classique (ERR-005) mais un appel de service externe + create. La logique de quota est encapsulée dans `checkSubscription`, ce qui masque le fait que check et création ne sont pas dans la même transaction.

**Fix :**
Inliner la création de la vague à l'intérieur de la même `$transaction` que le check de quota, sur le modèle de la route `/api/bacs` :

```typescript
// Avant (non-atomique) :
const quotaCheck = await checkSubscription(siteId, "VAGUE");
if (!quotaCheck.allowed) return NextResponse.json(..., { status: 403 });
const vague = await prisma.vague.create({ data });

// Après (atomique) :
const vague = await prisma.$transaction(async (tx) => {
  const count = await tx.vague.count({ where: { siteId } });
  if (count >= plan.limiteVagues) throw new Error("QUOTA_ATTEINT");
  return tx.vague.create({ data });
});
```

**Leçon / Règle :**
R4 s'applique dès que la décision de créer/modifier dépend d'un état lu en base, même si le check est encapsulé dans une fonction de service externe. L'encapsulation ne confère pas l'atomicité. Avant d'appeler un service de check suivi d'une mutation, se demander : "ces deux opérations sont-elles dans la même transaction ?". Si non, et si la cohérence est requise, les réunir dans `prisma.$transaction`.

**Voir aussi :** ERR-016 (même pattern sur `/api/bacs`, fix de référence), ERR-005 (R4 générale).

---

### ERR-029 — Double `unstable_cache` imbriqué sur le même tag (anti-pattern cache)
**Sprint :** 46 | **Date :** 2026-04-04
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/abonnements.ts`, `src/lib/abonnements/check-subscription.ts`

**Symptôme :**
Deux fonctions wrappent leur résultat avec `unstable_cache` en utilisant le même tag (ex: `["abonnement", siteId]`). La fonction de plus haut niveau (`checkSubscription`) encapsule une fonction déjà cachée (`getAbonnementActif`). Les deux caches peuvent diverger : une invalidation via `revalidateTag` purge le cache interne mais pas nécessairement le cache externe, ou vice versa, selon l'ordre d'appel et la durée de vie respective.

**Cause racine :**
Le wrapping `unstable_cache` a été appliqué mécaniquement à plusieurs niveaux d'abstraction sans vérifier si les niveaux inférieurs étaient déjà cachés. Le cache Next.js `unstable_cache` est composable mais pas transparent : deux caches imbriqués avec le même tag ne se comportent pas comme un seul cache — ils créent deux entrées distinctes dans le cache Next.js.

**Fix :**
Cacher uniquement au niveau le plus bas (la requête Prisma), pas au niveau du wrapper de service :

```typescript
// src/lib/queries/abonnements.ts — cache ici (niveau bas) :
export const getAbonnementActif = unstable_cache(
  async (siteId: string) => prisma.abonnement.findFirst({ where: { siteId, statut: "ACTIF" } }),
  ["abonnement-actif"],
  { tags: ["abonnement"] }
);

// src/lib/abonnements/check-subscription.ts — PAS de cache ici (niveau haut) :
export async function checkSubscription(siteId: string, ressource: string) {
  const abonnement = await getAbonnementActif(siteId); // déjà caché
  // ... logique de check ...
}
```

**Leçon / Règle :**
`unstable_cache` se place au niveau de la requête de données (queries), pas au niveau des fonctions de service ou des wrappers de logique métier. Si une fonction de service appelle une query déjà cachée, ne pas ajouter un deuxième `unstable_cache` sur le service. Un seul niveau de cache par chemin de données. Les tags d'invalidation (`revalidateTag`) ne traversent pas les caches imbriqués de façon fiable.

---

### ERR-028 — SW : listener controllerchange non retire au cleanup du composant React
**Sprint :** 27 | **Date :** 2026-03-21
**Sévérité :** Basse (fuite memoire)
**Fichier(s) :** `src/components/sw-register.tsx`

**Symptôme :**
Le `useEffect` qui enregistre le Service Worker ajoute un listener `controllerchange` sur `navigator.serviceWorker` mais ne le retire pas dans la fonction de cleanup. En mode strict React (double montage/demontage en dev) ou lors de la navigation, le listener s'accumule et peut declencher des rappels multiples lors d'un changement de controleur.

**Cause racine :**
Le pattern `addEventListener` sans `removeEventListener` correspondant dans le return du `useEffect` est une fuite memoire classique. Particulierement impactant ici car `navigator.serviceWorker` est un objet global — le listener persiste apres le demontage du composant.

**Fix :**
```typescript
useEffect(() => {
  if (!("serviceWorker" in navigator)) return;

  const handleControllerChange = () => {
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

  // Cleanup obligatoire — evite les fuites et les doubles declenchements
  return () => {
    navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
  };
}, []);
```

**Leçon / Règle :**
Tout `addEventListener` dans un `useEffect` React doit avoir son `removeEventListener` correspondant dans le return du cleanup. Cette regle s'applique a tous les objets globaux (window, document, navigator.serviceWorker, etc.). Les objets globaux ne sont pas garbage collectes avec le composant — leurs listeners survivent au demontage. Verifier systematiquement chaque `useEffect` contenant un `addEventListener` lors de la review de composants PWA/SW.
