# Review Sprint 13 — Liaison Planning ↔ Relevés

**Revieweur :** @code-reviewer
**Date :** 2026-03-11
**Sprint :** 13
**Verdict : ✅ VALIDE** (avec 3 observations mineures non-bloquantes)

---

## Périmètre de la review

Fichiers modifiés / créés dans ce sprint :

| Fichier | Nature |
|---------|--------|
| `prisma/schema.prisma` | Ajout `releveId` FK sur `Activite`, relation inverse sur `Releve` |
| `prisma/migrations/20260311120000_link_activite_releve/migration.sql` | Migration ALTER TABLE + index |
| `src/types/models.ts` | `Activite.releveId`, `ActiviteWithRelations.releve` |
| `src/types/api.ts` | `CreateReleveBase.activiteId`, export `ACTIVITE_RELEVE_TYPE_MAP` |
| `src/types/index.ts` | Barrel export `ACTIVITE_RELEVE_TYPE_MAP` |
| `src/lib/queries/activites.ts` | `findMatchingActivite`, `getActivites` / `getActiviteById` include releve |
| `src/lib/queries/releves.ts` | `createReleve(siteId, userId, data, activiteId?)` — liaison dans transaction |
| `src/app/api/releves/route.ts` | POST — validation `activiteId`, transmission à `createReleve` |
| `src/components/releves/releve-form-client.tsx` | Select activité planifiée + auto-détection |
| `src/components/planning/planning-client.tsx` | Badge "Relevé" + affichage releve lié dans Dialog |
| `src/__tests__/api/activites-releves.test.ts` | 8 suites de test, ~30 cas |

---

## Checklist R1-R9

### R1 — Enums MAJUSCULES ✅
Aucun nouvel enum dans ce sprint. Tous les enums existants (`StatutActivite`, `TypeActivite`, `TypeReleve`, etc.) sont déjà en UPPERCASE.

### R2 — Toujours importer les enums ✅
Vérification exhaustive des imports et usages :

| Fichier | Imports enums | Usage |
|---------|---------------|-------|
| `src/lib/queries/releves.ts` | `StatutActivite, TypeActivite, TypeMouvement, CategorieProduit, StatutVague` depuis `@/types` | `StatutActivite.PLANIFIEE`, `StatutActivite.EN_RETARD`, `StatutActivite.TERMINEE`, `TypeMouvement.SORTIE` ✅ |
| `src/lib/queries/activites.ts` | `StatutActivite, TypeActivite` depuis `@/types` | `StatutActivite.PLANIFIEE`, `StatutActivite.EN_RETARD`, `StatutActivite.TERMINEE` ✅ |
| `src/app/api/releves/route.ts` | `TypeReleve, CauseMortalite, TypeAliment, MethodeComptage, Permission` depuis `@/types` | `TypeReleve.BIOMETRIE`, `TypeReleve.ALIMENTATION`, etc. ✅ |
| `src/app/api/activites/route.ts` | `Permission, StatutActivite, TypeActivite` depuis `@/types` | Dot notation systématique ✅ |
| `src/components/releves/releve-form-client.tsx` | `TypeReleve, TypeActivite, StatutActivite, CategorieProduit, ACTIVITE_RELEVE_TYPE_MAP` depuis `@/types` | ✅ |
| `src/components/planning/planning-client.tsx` | `TypeActivite, StatutActivite, TypeReleve, Permission` depuis `@/types` | ✅ |

Aucune valeur d'enum en string literal brut. **R2 respectée.**

### R3 — Prisma = TypeScript identiques ✅
Alignement complet :

| Champ Prisma | Type Prisma | Interface TypeScript |
|---|---|---|
| `Activite.releveId` | `String? @unique` | `releveId: string \| null` ✅ |
| `Activite.releve` | `Releve?` (relation) | `ActiviteWithRelations.releve?: Releve \| null` ✅ |
| `Releve.activite` | `Activite?` (inverse) | Non exposé dans `Releve` (normal — FK côté Activite) ✅ |

Migration SQL alignée avec le schéma :
```sql
ALTER TABLE "Activite" ADD COLUMN "releveId" TEXT;
CREATE UNIQUE INDEX "Activite_releveId_key" ON "Activite"("releveId");
CREATE INDEX "Activite_releveId_idx" ON "Activite"("releveId");
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_releveId_fkey"
  FOREIGN KEY ("releveId") REFERENCES "Releve"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```
`ON DELETE SET NULL` cohérent avec la nullabilité `String?`. ✅

### R4 — Opérations atomiques ✅
Point critique de ce sprint. Vérification de `createReleve` dans `src/lib/queries/releves.ts` :

```typescript
return prisma.$transaction(async (tx) => {
  // 1. Vérification bac + vague (tx)
  // 2. tx.releve.create(...)
  // 3. Traitement consommations (tx)
  // 4. Liaison activité (auto-match ou explicite) (tx)
  //    → tx.activite.findFirst(...) + tx.activite.update(...)
  return releve;
});
```

**La totalité de la logique métier (création relevé + mise à jour activité) est dans un seul `prisma.$transaction()`.**
Si l'update de l'activité échoue, la création du relevé est rollback. ✅

> **Observation OBS-1 (non-bloquant) :** La liaison explicite utilise un pattern `findFirst + update` à l'intérieur de la transaction. R4 recommande `updateMany` avec conditions pour être plus idiomatique. Puisque tout est dans `$transaction`, le risque de race condition est nul — mais `updateMany` serait plus propre :
> ```typescript
> // Actuel (findFirst + update dans $transaction) — fonctionnel
> // Recommandé (updateMany atomique)
> await tx.activite.updateMany({
>   where: { id: activiteId, siteId, statut: { in: [...] }, releveId: null },
>   data: { statut: StatutActivite.TERMINEE, releveId: releve.id },
> });
> ```
> À adresser dans le prochain sprint ou en bugfix basse priorité.

### R5 — DialogTrigger asChild ✅
Dans `planning-client.tsx`, le Dialog est contrôlé par état (`open={!!selectedActivite}` + `onOpenChange`), sans `<DialogTrigger>`. Ce pattern programmatique est légitime et ne nécessite pas `asChild`. R5 ne s'applique pas ici. ✅

### R6 — CSS variables du thème ✅
`planning-client.tsx` utilise des classes Tailwind thématisées (`bg-accent-green`, `bg-accent-blue`, `bg-primary`, `bg-muted-foreground`, etc.) — aucune couleur hexadécimale codée en dur. ✅

### R7 — Nullabilité explicite ✅
- `releveId String? @unique` — nullable explicite dès le schéma ✅
- `releve Releve?` — nullable explicite ✅
- TypeScript : `releveId: string | null` ✅
- Barrel export : `ACTIVITE_RELEVE_TYPE_MAP` en `Partial<Record<TypeActivite, TypeReleve>>` — partial explicite pour les types sans mapping ✅

### R8 — siteId PARTOUT ✅
Vérification des nouvelles fonctions :

**`findMatchingActivite`** (`src/lib/queries/activites.ts`) :
```typescript
return tx.activite.findFirst({
  where: {
    siteId,          // ← R8 ✅
    typeActivite: typeReleve,
    statut: { in: [StatutActivite.PLANIFIEE, StatutActivite.EN_RETARD] },
    ...(vagueId && { vagueId }),
    dateDebut: { gte: dateMin, lte: dateMax },
    releveId: null,
  },
  orderBy: { dateDebut: "asc" },
});
```

**Liaison explicite** dans `createReleve` :
```typescript
const activite = await tx.activite.findFirst({
  where: {
    id: activiteId,
    siteId,  // ← R8 ✅
    statut: { in: [StatutActivite.PLANIFIEE, StatutActivite.EN_RETARD] },
    releveId: null,
  },
});
```

> **Observation OBS-2 (non-bloquant) :** Le `tx.activite.update` qui suit le `findFirst` dans la liaison explicite utilise `where: { id: activiteId }` sans `siteId`. Techniquement sûr (le `findFirst` précédent a déjà validé siteId dans la même transaction), mais ajouter `siteId` au `update` serait plus cohérent avec l'esprit de R8.

### R9 — Tests avant review ✅
Le fichier `src/__tests__/api/activites-releves.test.ts` couvre les 8 cas requis :

| Test | Description | Couverture |
|---|---|---|
| 1 | `activiteId` explicite → transmis comme 4e argument à `createReleve` | POST + validation trim ✅ |
| 2 | Sans `activiteId` → auto-match (undefined) | POST sans activiteId ✅ |
| 3 | Sans match possible → relevé créé normalement | Robustesse absence d'activité ✅ |
| 4 | OBSERVATION → absent de `ACTIVITE_RELEVE_TYPE_MAP` | Pas de liaison pour types non mappés ✅ |
| 5 | MORTALITE → absent du map | Idem ✅ |
| 6 | GET /api/activites → inclut `releve {id, typeReleve, date}` | Relation retournée correctement ✅ |
| 7 | Activité TERMINEE avec releveId → pas re-matchée | Protection doublon ✅ |
| 8 | `activiteId` invalide (vide/nombre/objet) → 400 | Validation robuste ✅ |

Tests bien structurés avec mocks, `beforeEach` `clearAllMocks()`, helpers réutilisables. ✅

---

## Analyse fonctionnelle

### Architecture de la liaison Planning ↔ Relevés

Le workflow implémenté est correct :

```
Activité PLANIFIEE/EN_RETARD
         │
         ▼ Pisciculteur crée un Relevé
POST /api/releves (activiteId explicite ou absent)
         │
         ▼ createReleve() dans $transaction
         ├── Si activiteId fourni → liaison directe (findFirst + update dans tx)
         └── Si absent → auto-match par type/vague/fenêtre ±1 jour (findMatchingActivite)
                         │
                         ▼ Si match trouvé
                         Activite.statut = TERMINEE + releveId = releve.id
```

**Points forts :**
- Mapping `ACTIVITE_RELEVE_TYPE_MAP` centralisé et exporté depuis le barrel → cohérence front/back
- Fenêtre d'auto-match de ±1 jour raisonnable métier (évite les faux positifs)
- `releveId: null` comme filtre dans `findMatchingActivite` → une activité déjà liée n'est plus matchable
- `statut IN [PLANIFIEE, EN_RETARD]` → une activité TERMINEE ou ANNULEE n'est pas re-matchée
- UI : select activité optionnel avec label "Auto-détection" clair pour l'UX

**`ACTIVITE_RELEVE_TYPE_MAP` correctement borné :**
```typescript
// ALIMENTATION, BIOMETRIE, QUALITE_EAU, COMPTAGE → liaison possible
// NETTOYAGE, TRAITEMENT, RECOLTE, AUTRE → pas de TypeReleve associé → jamais liés
```

### `ACTIVITE_RELEVE_TYPE_MAP` dans le composant UI

Le composant `releve-form-client.tsx` construit l'inverse du map à la volée :
```typescript
const RELEVE_ACTIVITE_TYPE_MAP: Partial<Record<string, TypeActivite>> = {};
for (const [typeActivite, typeReleve] of Object.entries(ACTIVITE_RELEVE_TYPE_MAP)) {
  if (typeReleve) RELEVE_ACTIVITE_TYPE_MAP[typeReleve] = typeActivite as TypeActivite;
}
```
Correct et robuste. Le select n'est affiché que pour les types avec un mapping, ce qui est cohérent. ✅

---

## Observations mineures (non-bloquantes)

| # | Fichier | Observation | Priorité |
|---|---------|-------------|----------|
| OBS-1 | `src/lib/queries/releves.ts` L193-196 | Pattern `findFirst + update` dans liaison explicite → préférer `updateMany` (R4 style) | Basse |
| OBS-2 | `src/lib/queries/releves.ts` L193 | `tx.activite.update({ where: { id } })` sans `siteId` dans le where | Basse |
| OBS-3 | `src/lib/queries/activites.ts` L89 | Paramètre `typeReleve: TypeActivite` — nom trompeur, devrait s'appeler `typeActivite` | Cosmétique |

Aucun de ces points n'est bloquant. L'architecture est correcte, la sécurité multi-tenant est respectée, la transaction est propre.

---

## Conformité checklist finale

| Règle | Statut | Commentaire |
|-------|--------|-------------|
| R1 — Enums MAJUSCULES | ✅ PASS | Pas de nouveaux enums |
| R2 — Import enums | ✅ PASS | Tous les enums importés et utilisés via dot notation |
| R3 — Prisma = TypeScript | ✅ PASS | `releveId` aligné schema ↔ models.ts ↔ migration |
| R4 — Opérations atomiques | ✅ PASS | Liaison dans `$transaction` — OBS-1 pour amélioration future |
| R5 — DialogTrigger asChild | ✅ N/A | Dialog programmatique (state), pas de trigger bouton |
| R6 — CSS variables thème | ✅ PASS | Classes Tailwind thématisées, pas de hex hardcodé |
| R7 — Nullabilité explicite | ✅ PASS | `String?`, `Releve?`, `string \| null` cohérents |
| R8 — siteId partout | ✅ PASS | `findMatchingActivite` + liaison explicite filtrent par siteId |
| R9 — Tests + build | ✅ PASS | 8 suites de test, ~30 cas couvrant tous les scénarios |

---

## Verdict

### ✅ VALIDE

Le Sprint 13 est validé. La liaison Planning ↔ Relevés est correctement implémentée :
- Architecture transactionnelle solide (R4 ✅)
- Multi-tenancy respecté (`siteId` partout, R8 ✅)
- Imports d'enums systématiques (R2 ✅)
- Mapping centralisé et cohérent front/back
- Tests complets couvrant les cas nominaux et les cas limites

Les 3 observations mineures (OBS-1 à OBS-3) peuvent être adressées lors d'un prochain sprint de polissage ou en bugfix basse priorité. Elles ne bloquent pas le passage au sprint suivant.

**Prochaines étapes suggérées :**
- Corriger OBS-1 (`updateMany` dans liaison explicite) en bugfix
- Renommer `typeReleve → typeActivite` dans `findMatchingActivite` (OBS-3) lors d'un refactoring
