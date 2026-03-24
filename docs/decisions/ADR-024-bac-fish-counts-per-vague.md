# ADR-024 — Comptages poissons par bac : champs sur Bac vs table junction VagueBac

**Statut :** Accepté
**Date :** 2026-03-24
**Auteur :** @architect

---

## Contexte

Le modèle `Bac` porte trois champs qui décrivent la population de poissons pour la vague en cours :

```prisma
model Bac {
  nombrePoissons    Int?    // effectif courant (mis à jour en temps réel)
  nombreInitial     Int?    // effectif au moment du stockage dans cette vague
  poidsMoyenInitial Float?  // poids moyen initial au stockage
  vagueId           String? // FK vers la vague courante (null = bac libre)
}
```

Ces champs sont écrits par quatre opérations distinctes :

| Opération | Fichier | Ce qui change |
|-----------|---------|---------------|
| `createVague` | `src/lib/queries/vagues.ts` | `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial` ← données du formulaire |
| `createCalibrage` | `src/lib/queries/calibrages.ts` | `nombrePoissons` → sources à 0, destinations incrémentées |
| `patchCalibrage` | `src/lib/queries/calibrages.ts` | annulation + réapplication du dispatch |
| `createVente` | `src/lib/queries/ventes.ts` | `nombrePoissons` décrémenté proportionnellement |

Et lus par trois contextes distincts :

| Contexte | Fichier | Champs lus |
|----------|---------|------------|
| Calibrage — sélection sources | `src/components/calibrage/step-sources.tsx` | `nombrePoissons` |
| Indicateurs par vague | `src/lib/queries/indicateurs.ts` | `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial` |
| Densité alertes | `src/app/api/bacs/[id]/densite/route.ts` + moteur | `nombrePoissons` |

La clôture d'une vague (`cloturerVague`) libère tous les bacs avec :

```typescript
await tx.bac.updateMany({
  where: { vagueId: id, siteId },
  data: { vagueId: null },   // ← les trois champs de comptage ne sont PAS réinitialisés
});
```

---

## Énoncé du problème

### Problème 1 — Perte d'histoire lors d'une réutilisation de bac

Scénario concret :

1. **Vague A** : Bac-1 stocké avec 500 poissons. `nombreInitial = 500`, `nombrePoissons = 500`.
2. Des calibrages et ventes ont lieu. À la clôture : `nombrePoissons = 320`.
3. `cloturerVague` libère Bac-1 : `vagueId = null`. Les valeurs `nombrePoissons = 320`, `nombreInitial = 500`, `poidsMoyenInitial = X` sont **conservées sur le Bac**.
4. **Vague B** : Bac-1 stocké avec 300 poissons. `createVague` écrase : `nombrePoissons = 300`, `nombreInitial = 300`, `poidsMoyenInitial = Y`.

L'histoire de Vague A sur Bac-1 est effacée. Mais est-ce un problème en pratique ? Les données de Vague A survivent dans :
- Les relevés `COMPTAGE`, `BIOMETRIE`, `MORTALITE` liés à Bac-1 + Vague A (toujours présents)
- Les `CalibrageGroupe` pour chaque redistribution (nombrePoissons par groupe, destinationBacId)
- La vague elle-même (`nombreInitial`, `poidsMoyenInitial` au niveau vague)

**Verdict** : la perte se limite aux champs dénormalisés sur Bac. Les données primaires (relevés, calibrages) survivent.

### Problème 2 — Période entre clôture et réassignation

Entre le moment où `cloturerVague` libère Bac-1 et le moment où `createVague` réassigne Bac-1 à Vague B, le bac affiche `nombrePoissons = 320` (résidu de Vague A) alors que `vagueId = null`.

Ce résidu peut induire en erreur dans deux endroits :

- **`getBacs`** (`src/lib/queries/bacs.ts`) : retourne `nombrePoissons = 320` pour un bac libre
- **`step-sources.tsx`** : classe un bac dans `bacsLegacy` (`vagueId !== null && nombrePoissons === 0`) mais un bac libre avec `nombrePoissons = 320` tomberait dans `bacsAvecPoissons` malgré son statut libre — toutefois ce composant ne reçoit que les bacs de la vague courante (`vagueId === vagueId`), donc ce cas ne se produit pas dans la pratique

**Verdict** : le résidu est visible sur la page des bacs mais sans conséquence fonctionnelle directe puisqu'un bac libre n'est pas inclus dans les calculs d'indicateurs de vague.

### Problème 3 — Intégrité lors d'un calibrage cross-vague (théorique)

La contrainte actuelle est stricte : un bac doit appartenir à la vague pour être source ou destination d'un calibrage. Un bac libre ne peut donc jamais être impliqué dans un calibrage. Ce problème est théorique et ne peut pas se produire avec le code actuel.

---

## Analyse de l'existant

### Ce que `cloturerVague` fait réellement

```typescript
// src/lib/queries/vagues.ts — cloturerVague()
await tx.bac.updateMany({
  where: { vagueId: id, siteId },
  data: { vagueId: null },  // seul vagueId est mis à null
});
// nombrePoissons, nombreInitial, poidsMoyenInitial sont CONSERVÉS
```

Les trois champs de comptage survivent à la clôture. C'est un "stale data" silencieux.

### Ce que l'indicateur utilise réellement

Dans `src/lib/queries/indicateurs.ts`, `getIndicateursVague` charge les bacs de la vague et lit `nombreInitial` et `poidsMoyenInitial` par bac pour calculer une moyenne pondérée. Ces valeurs sont présentes car elles ont été écrites lors de `createVague`.

Le `nombrePoissons` sur Bac n'est pas utilisé directement dans les calculs d'indicateurs — les vivants sont calculés depuis les relevés `COMPTAGE` et `MORTALITE`. Le `nombrePoissons` sert uniquement au :

1. Calibrage : vérification que le bac source a des poissons (`nombrePoissons > 0`)
2. Calibrage : conservation totale (`sum(bac.nombrePoissons) === sum(groupes) + morts`)
3. Ventes : stock disponible total + déduction proportionnelle
4. UI step-sources : affichage de l'effectif par bac

### Source de vérité pour les vivants

L'effectif courant (`nombrePoissons`) est une **donnée opérationnelle dénormalisée**, mise à jour à chaque opération. Elle est la source de vérité pour les opérations temps-réel (calibrage, ventes). Elle n'est pas recalculée depuis les relevés — c'est un compteur maintenu en cohérence par les transactions.

---

## Options

### Option A — Statu quo + correction du reset à la clôture (recommandé)

Comportement actuel inchangé, sauf qu'on réinitialise les champs à la clôture :

```typescript
// cloturerVague — modification
await tx.bac.updateMany({
  where: { vagueId: id, siteId },
  data: {
    vagueId: null,
    nombrePoissons: null,       // ← ajout
    nombreInitial: null,        // ← ajout
    poidsMoyenInitial: null,    // ← ajout
  },
});
```

**Pros :**
- Migration zéro : pas de nouveau modèle, pas de migration SQL
- Pas de rupture des requêtes existantes (99 fichiers utilisent ces champs)
- La réinitialisation élimine le "stale data" entre deux vagues
- L'histoire par vague est déjà portée par les relevés et les calibrages (données primaires)
- Cohérent avec la sémantique : un bac libre n'a pas de comptage actif

**Cons :**
- Perd l'information "combien de poissons il restait à la clôture" sur le bac lui-même
  — mais cette information existe dans le dernier relevé `COMPTAGE` de la vague

**Impact :** modification d'une seule ligne dans `cloturerVague`. Aucune migration de schéma.

---

### Option B — Table junction `VagueBac`

Créer un modèle junction qui porte les comptages par (vague, bac) :

```prisma
model VagueBac {
  id                String  @id @default(cuid())
  vagueId           String
  vague             Vague   @relation(...)
  bacId             String
  bac               Bac     @relation(...)
  nombrePoissons    Int
  nombreInitial     Int
  poidsMoyenInitial Float
  siteId            String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([vagueId, bacId])
  @@index([vagueId])
  @@index([bacId])
}
```

Les champs `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial` seraient retirés de `Bac`.

**Pros :**
- Modèle normalisé : l'histoire complète par (vague, bac) est conservée
- Permet de retrouver l'effectif de Bac-1 pour Vague A après réassignation à Vague B

**Cons :**
- **Impact massif** : 99 fichiers référencent `bac.nombrePoissons` / `bac.nombreInitial` / `bac.poidsMoyenInitial`
- Toutes les requêtes calibrage, ventes, indicateurs, dashboard, moteur d'activités doivent être réécrites pour joindre `VagueBac`
- Migration SQL non triviale : créer la table, migrer les données existantes (les bacs actuellement assignés ont des valeurs valides, les libres ont des stale values)
- Les transactions de calibrage deviennent plus complexes (`updateMany` sur Bac devient `upsert` sur VagueBac)
- Le moteur de densité (`src/lib/activity-engine/`) lit `bac.nombrePoissons` directement
- La "source de vérité opérationnelle" pour calibrage/ventes serait sur VagueBac, mais les relevés COMPTAGE sont toujours sur Releve — deux sources potentiellement divergentes

**Verdict :** coût de migration élevé pour un gain limité. L'histoire per-vague existe déjà dans les relevés et calibrages.

---

### Option C — Garder les champs sur Bac + table d'historique en lecture seule

À la clôture, créer un snapshot `BacSnapshot` (lecture seule) avec les valeurs finales, puis réinitialiser Bac.

**Pros :**
- Préserve l'histoire par vague pour audit/rapports
- Pas de rupture sur les lectures courantes (Bac reste la source opérationnelle)

**Cons :**
- Un modèle supplémentaire qui ne sert qu'à l'audit rarement consulté
- Les données existent déjà via les relevés — duplication
- Migration SQL + nouveau endpoint pour exposer ces snapshots

**Verdict :** surcoût pour un cas d'usage marginal.

---

## Décision

**Option A — Statu quo + reset des champs à la clôture.**

### Justification

1. **Les données primaires survivent.** L'effectif par bac par vague est reconstituable depuis les relevés COMPTAGE et les CalibrageGroupe. Retirer les champs dénormalisés du Bac à la clôture n'efface pas l'histoire — elle est dans les tables primaires.

2. **Le coût de l'Option B est disproportionné.** 99 fichiers seraient impactés pour corriger un problème qui n'a pas encore causé de bug en production. La règle de pragmatisme s'impose.

3. **Le seul vrai problème est le stale data silencieux.** Un bac libre affichant `nombrePoissons = 320` est trompeur. La correction est une ligne de code dans `cloturerVague`.

4. **La sémantique est correcte après le fix.** Un bac libre n'a pas de comptage en cours. `nombrePoissons = null` sur un bac libre est sémantiquement juste.

---

## Migration

### Stratégie

Aucune migration de schéma. Seule modification : `src/lib/queries/vagues.ts`.

```typescript
// cloturerVague — AVANT
await tx.bac.updateMany({
  where: { vagueId: id, siteId },
  data: { vagueId: null },
});

// cloturerVague — APRÈS
await tx.bac.updateMany({
  where: { vagueId: id, siteId },
  data: {
    vagueId: null,
    nombrePoissons: null,
    nombreInitial: null,
    poidsMoyenInitial: null,
  },
});
```

### Données existantes

Les bacs actuellement libres (`vagueId = null`) peuvent avoir des stale values. Un script de nettoyage peut les remettre à null en une seule requête SQL :

```sql
UPDATE "Bac"
SET "nombrePoissons" = NULL,
    "nombreInitial"  = NULL,
    "poidsMoyenInitial" = NULL
WHERE "vagueId" IS NULL;
```

Ce script est optionnel (cosmétique) et sans risque de régression puisque les bacs libres ne sont pas inclus dans les calculs d'indicateurs.

---

## Impact sur les fonctionnalités existantes

### Calibrage (`src/lib/queries/calibrages.ts`)

Aucun impact. Le calibrage ne s'applique qu'à des bacs avec `vagueId === data.vagueId`. Les bacs libres sont exclus par la vérification.

Seule observation : le step 5 de `createCalibrage` fait un snapshot de `nombreInitial` si null :

```typescript
// Snapshot bacs sources if nombreInitial is null
for (const bac of sourceBacs) {
  if (bac.nombreInitial === null) {
    await tx.bac.update({
      where: { id: bac.id },
      data: { nombreInitial: bac.nombrePoissons, poidsMoyenInitial: bac.poidsMoyenInitial ?? null },
    });
  }
}
```

Après le fix, `nombreInitial` sera toujours `null` sur un bac fraîchement réassigné (car clôture le remet à null), donc ce snapshot sera toujours déclenché pour les bacs qui n'avaient pas encore été calibrés. C'est le comportement correct.

### Ventes (`src/lib/queries/ventes.ts`)

Aucun impact. Les ventes ne portent que sur des bacs avec `vagueId === data.vagueId`.

### Indicateurs (`src/lib/queries/indicateurs.ts`)

Aucun impact sur les vagues EN_COURS (bacs toujours assignés). Pour les vagues TERMINEE, les bacs sont libres (`vagueId = null`) mais la query charge les bacs via `vague.bacs` qui utilise la relation Prisma — cette relation ne retournera plus les anciens bacs après la clôture. C'est déjà le comportement actuel.

**Note importante :** `getIndicateursVague` charge les bacs avec :

```typescript
bacs: { select: { id: true, nombrePoissons: true, nombreInitial: true, poidsMoyenInitial: true } }
```

Pour une vague TERMINEE, ces bacs auraient `vagueId = null` après clôture, et les champs seraient null après le fix. Mais la relation `vague.bacs` dans Prisma est définie par `vagueId` sur Bac — donc une vague terminée n'aura plus de bacs inclus dans cette include. Ce qui signifie que le calcul per-bac tombera dans le fallback global. C'est acceptable car les vagues terminées n'ont plus de bacs actifs à analyser.

**Recommandation connexe :** pour les vagues terminées, les indicateurs devraient idéalement être calculés depuis les relevés uniquement (sans dépendance aux bacs), ce qui est déjà le cas dans le chemin fallback de `getIndicateursVague`. Ce comportement reste correct.

### Dashboard (`src/lib/queries/dashboard.ts`)

Aucun impact. Le dashboard ne lit pas `bac.nombrePoissons` directement — il calcule les vivants depuis les relevés.

### Moteur d'alertes et densité

Le moteur d'alertes lit `bac.nombrePoissons` pour calculer la densité. Après le fix, les bacs libres auront `nombrePoissons = null`, ce qui est correct : un bac libre ne doit pas déclencher d'alerte de densité.

### `step-sources.tsx` (calibrage UI)

Lit `bac.nombrePoissons` pour afficher l'effectif et sélectionner les bacs sources. Après le fix, un bac fraîchement assigné aura `nombrePoissons` mis par `createVague` (non null, valeur correcte). Pas d'impact.

---

## Résumé des fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/lib/queries/vagues.ts` | `cloturerVague` : ajouter reset des 3 champs dans `updateMany` |
| `prisma/seed.sql` | Optionnel : ajouter nettoyage des bacs libres avec stale values |

**Aucune migration Prisma requise.** Aucune interface TypeScript à modifier.

---

## Alternatives non retenues et pourquoi

| Alternative | Rejet |
|-------------|-------|
| Option B — VagueBac | Impact 99 fichiers, coût >> bénéfice |
| Option C — BacSnapshot | Duplication des données déjà dans les relevés |
| Ne rien faire | Le stale data entre vagues est un bug latent qui induira en erreur les opérateurs |

---

## Critères de succès

- [ ] `cloturerVague` remet `nombrePoissons`, `nombreInitial`, `poidsMoyenInitial` à null
- [ ] Un bac libéré affiche `nombrePoissons = null` sur la page des bacs
- [ ] La réassignation d'un bac à une nouvelle vague écrit les nouvelles valeurs correctement
- [ ] Les tests existants (`src/__tests__/api/vagues.test.ts`, `vagues-distribution.test.ts`) passent toujours
- [ ] Le moteur de densité ne déclenche pas d'alerte sur les bacs libres
