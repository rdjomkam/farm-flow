# ADR — Besoins Multi-Vague : Répartition des Dépenses Partagées

**Statut :** PROPOSÉ
**Date :** 2026-04-01
**Auteur :** @architect
**Sprint cible :** à déterminer par @project-manager

---

## 1. Contexte et problème

Actuellement, un `ListeBesoins` peut être lié à **au plus une vague** via un champ `vagueId String?` (FK nullable). Ce modèle de relation 1-à-1 optionnelle ne couvre pas le cas d'usage des dépenses partagées.

**Cas d'usage réels identifiés :**
- Facture d'électricité mensuelle bénéficiant à 3 vagues actives simultanément
- Achat de gaz utilisé pour l'ensemble des bassins de la ferme
- Fournitures de laboratoire (tests eau) partagées entre vagues en cours

Dans ces situations, l'opérateur doit pouvoir :
1. Créer une liste de besoins sans vague, avec une ou plusieurs vagues, ou avec toutes les vagues
2. Spécifier un ratio de répartition des coûts par vague (ex. 40 % vague A, 60 % vague B)
3. Obtenir une imputation comptable correcte par vague dans les rapports de rentabilité

---

## 2. Analyse de l'existant

### 2.1 Schéma actuel (prisma/schema.prisma, ligne ~1570)

```
model ListeBesoins {
  vagueId   String?
  vague     Vague?  @relation(fields: [vagueId], references: [id], onDelete: SetNull)
  ...
}
```

### 2.2 Points d'impact identifiés

| Fichier | Nature de l'impact | Gravité |
|---|---|---|
| `prisma/schema.prisma` | Supprimer `vagueId`/`vague` de `ListeBesoins`, ajouter table `ListeBesoinsVague` | Structurel |
| `src/types/models.ts` | Interface `ListeBesoins` : remplacer `vagueId`/`vague` par `vagues: ListeBesoinsVague[]` | Structurel |
| `src/types/api.ts` | `CreateListeBesoinsDTO`, `UpdateListeBesoinsDTO`, `ListeBesoinsFilters` | Interface |
| `src/lib/queries/besoins.ts` | `getListeBesoins` (filtre), `createListeBesoins`, `updateListeBesoins`, `INCLUDE_LISTE_BESOINS` | Logique |
| `src/lib/queries/besoins.ts` (traiter) | Dépense liée à plusieurs vagues via les ratios | Logique métier |
| `src/lib/queries/finances.ts` | `depensesParVague` query (ligne ~315) : doit imputer les besoins au prorata | Financier |
| `src/app/api/besoins/route.ts` | Parsing de `vagueId` en query param | API |
| `src/components/besoins/besoins-form-client.tsx` | Remplacer `<Select>` vague unique par sélecteur multi-vague avec ratios | UI |
| `src/components/besoins/besoins-detail-client.tsx` | Afficher `vague: { id, code }` → liste de vagues avec ratio | UI |
| `src/components/besoins/besoins-list-client.tsx` | Afficher la/les vagues (carte de liste) | UI |
| `src/components/besoins/modifier-besoin-dialog.tsx` | Pas de champ vagueId actuellement, reste inchangé | Aucun |
| `src/__tests__/api/besoins.test.ts` | Mocks et assertions doivent couvrir la table de jonction | Tests |
| `prisma/seed.sql` | Données de seed à migrer vers la table de jonction | Seed |

### 2.3 Impact sur les rapports financiers (finances.ts ligne 314)

La query actuelle filtre directement `depense.vagueId`. Avec le nouveau modèle, les dépenses issues d'un besoin multi-vague n'ont plus de `vagueId` direct sur `Depense`. L'imputation se fera via les ratios stockés dans `ListeBesoinsVague`, appliqués au `montantTotal` de la dépense liée.

---

## 3. Décision

### 3.1 Modèle de données — Table de jonction `ListeBesoinsVague`

Remplacer le champ `vagueId` direct par une table de jonction avec ratio :

```prisma
model ListeBesoinsVague {
  id             String       @id @default(cuid())
  listeBesoinsId String
  listeBesoins   ListeBesoins @relation(fields: [listeBesoinsId], references: [id], onDelete: Cascade)
  vagueId        String
  vague          Vague        @relation(fields: [vagueId], references: [id], onDelete: Cascade)
  /// Fraction du coût imputée à cette vague. Doit être > 0 et <= 1.
  /// La somme des ratio pour un même listeBesoinsId doit être = 1.0
  ratio          Float        @default(1.0)
  siteId         String       /// R8 — toujours présent
  createdAt      DateTime     @default(now())

  @@unique([listeBesoinsId, vagueId])
  @@index([vagueId])
  @@index([siteId])
}
```

Sur `ListeBesoins`, supprimer `vagueId String?` et `vague Vague?`, ajouter la relation inverse :

```prisma
model ListeBesoins {
  // Supprimer : vagueId String? + vague Vague?
  vagues  ListeBesoinsVague[]   // Nouveau
  ...
}
```

Sur `Vague`, ajouter la relation inverse :

```prisma
model Vague {
  // Ajouter :
  listesBesoinVagues  ListeBesoinsVague[]
}
```

### 3.2 Règles métier

| Règle | Détail |
|---|---|
| **R-MV-01** | Un `ListeBesoins` peut avoir 0, 1 ou N vagues associées |
| **R-MV-02** | Si N >= 1 vagues, la somme des `ratio` doit être égale à `1.0` (± 0.001 de tolérance flottante) |
| **R-MV-03** | Si 0 vague : la liste est une dépense de site (ex. frais généraux), non imputée à une vague |
| **R-MV-04** | Chaque `ratio` doit être strictement > 0 et <= 1 |
| **R-MV-05** | Un `ListeBesoins` ne peut pas avoir deux fois la même vague (unicité `[listeBesoinsId, vagueId]`) |
| **R-MV-06** | Lors du traitement (APPROUVEE → TRAITEE), les dépenses générées héritent de la liste de besoins mais **pas** du vagueId. L'imputation se lit depuis `ListeBesoinsVague`. |
| **R-MV-07** | La modification des vagues liées est autorisée uniquement si statut `SOUMISE` |
| **R-MV-08** | Si une seule vague avec ratio = 1.0 : l'auto-balance s'applique (comportement identique à l'existant) |

### 3.3 Stratégie de migration des données existantes

La migration SQL doit :

1. Créer la table `ListeBesoinsVague`
2. Pour chaque `ListeBesoins` avec `vagueId IS NOT NULL` : insérer une ligne dans `ListeBesoinsVague` avec `ratio = 1.0`
3. Conserver le champ `vagueId` sur `ListeBesoins` avec `@deprecated` pendant une période transitoire, puis le supprimer dans une migration ultérieure (migration en deux temps pour sécurité des données)

**Attention :** La migration doit s'exécuter **avant** tout déploiement du nouveau code qui supprime le champ `vagueId` de `ListeBesoins`. Séquence stricte :

```
1. Migration A : CREATE TABLE ListeBesoinsVague + INSERT from vagueId existants
2. Migration B : ALTER TABLE ListeBesoins DROP COLUMN vagueId
```

Ne pas fusionner A et B dans une seule migration (risque shadow DB Prisma).

### 3.4 Interfaces TypeScript (src/types/models.ts)

**Nouveau modèle `ListeBesoinsVague` :**

```typescript
export interface ListeBesoinsVague {
  id: string;
  listeBesoinsId: string;
  vagueId: string;
  /** Fraction du coût imputée à cette vague (0 < ratio <= 1, sum = 1.0 si vagues.length > 0) */
  ratio: number;
  siteId: string;
  createdAt: Date;
}

export interface ListeBesoinsVagueWithRelations extends ListeBesoinsVague {
  vague?: { id: string; code: string };
}
```

**Interface `ListeBesoins` modifiée :**

```typescript
export interface ListeBesoins {
  id: string;
  numero: string;
  titre: string;
  demandeurId: string;
  valideurId: string | null;
  // SUPPRIMÉ : vagueId string | null
  // SUPPRIMÉ : vague Vague | null
  statut: StatutBesoins;
  montantEstime: number;
  montantReel: number | null;
  notes: string | null;
  motifRejet: string | null;
  dateLimite: Date | null;
  siteId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListeBesoinsWithRelations extends ListeBesoins {
  demandeur?: User;
  valideur?: User | null;
  vagues?: ListeBesoinsVagueWithRelations[];   // Remplace vague?: Vague | null
  lignes?: LigneBesoin[];
  depenses?: Depense[];
  _count?: { lignes: number };
}
```

### 3.5 DTOs API (src/types/api.ts)

```typescript
/** Entrée d'association vague-ratio dans un DTO Besoins */
export interface VagueRatioDTO {
  vagueId: string;
  /** Valeur entre 0 (exclus) et 1 (inclus). La somme de tous les ratios doit valoir 1.0 */
  ratio: number;
}

/** DTO pour créer une liste de besoins */
export interface CreateListeBesoinsDTO {
  titre: string;
  /**
   * Vagues associées avec leurs ratios (optionnel).
   * - Absent ou [] : liste sans vague (frais généraux)
   * - Présent : la somme des ratios doit être égale à 1.0
   */
  vagues?: VagueRatioDTO[];
  lignes: CreateLigneBesoinDTO[];
  notes?: string;
  dateLimite?: string;
}

/** DTO pour modifier une liste de besoins (seulement si SOUMISE) */
export interface UpdateListeBesoinsDTO {
  titre?: string;
  /**
   * Remplacement complet des associations vague.
   * - null : supprimer toutes les associations
   * - [] : idem
   * - [...] : remplacer par les nouvelles associations (ratios doivent sommer à 1.0)
   */
  vagues?: VagueRatioDTO[] | null;
  notes?: string | null;
  lignes?: CreateLigneBesoinDTO[];
  dateLimite?: string | null;
}

/** Filtres pour lister les listes de besoins */
export interface ListeBesoinsFilters {
  statut?: StatutBesoins;
  demandeurId?: string;
  /**
   * Filtrer par vague : retourne les listes ayant au moins une association avec cette vague.
   * Implémentation : EXISTS sur ListeBesoinsVague.vagueId
   */
  vagueId?: string;
  dateFrom?: string;
  dateTo?: string;
  enRetard?: boolean;
}
```

### 3.6 Modifications de `src/lib/queries/besoins.ts`

**`INCLUDE_LISTE_BESOINS`** — remplacer `vague` par `vagues` :

```typescript
const INCLUDE_LISTE_BESOINS = {
  demandeur: { select: { id: true, name: true } },
  valideur: { select: { id: true, name: true } },
  // Remplace : vague: { select: { id: true, code: true } }
  vagues: {
    select: {
      id: true,
      vagueId: true,
      ratio: true,
      vague: { select: { id: true, code: true } },
    },
  },
  lignes: { ... },
  depenses: { ... },
  _count: { select: { lignes: true } },
};
```

**`getListeBesoins` — filtre `vagueId`** — remplacer le filtre direct :

```typescript
// Avant :
...(filters?.vagueId && { vagueId: filters.vagueId }),

// Après :
...(filters?.vagueId && {
  vagues: { some: { vagueId: filters.vagueId } },
}),
```

**`createListeBesoins`** — créer les lignes de jonction dans la transaction :

```typescript
// Après création de `liste`, si data.vagues?.length > 0 :
await tx.listeBesoinsVague.createMany({
  data: (data.vagues ?? []).map((v) => ({
    listeBesoinsId: liste.id,
    vagueId: v.vagueId,
    ratio: v.ratio,
    siteId,
  })),
});
```

**`updateListeBesoins`** — remplacement atomique des vagues :

```typescript
if (data.vagues !== undefined) {
  // Supprimer toutes les associations existantes
  await tx.listeBesoinsVague.deleteMany({ where: { listeBesoinsId: id } });
  // Recréer si non null/vide
  if (data.vagues && data.vagues.length > 0) {
    await tx.listeBesoinsVague.createMany({
      data: data.vagues.map((v) => ({
        listeBesoinsId: id,
        vagueId: v.vagueId,
        ratio: v.ratio,
        siteId: liste.siteId,
      })),
    });
  }
}
```

**Validation de la somme des ratios** — helper à ajouter :

```typescript
function validerRatios(vagues: VagueRatioDTO[]): void {
  if (vagues.length === 0) return;
  const somme = vagues.reduce((acc, v) => acc + v.ratio, 0);
  if (Math.abs(somme - 1.0) > 0.001) {
    throw new Error(
      `La somme des ratios doit être égale à 1.0 (somme actuelle : ${somme.toFixed(3)})`
    );
  }
  for (const v of vagues) {
    if (v.ratio <= 0 || v.ratio > 1) {
      throw new Error(`Ratio invalide ${v.ratio} pour la vague ${v.vagueId}`);
    }
  }
}
```

### 3.7 Impact sur `src/lib/queries/finances.ts` (rentabilité par vague)

La query actuelle (ligne ~314) charge les dépenses via `depense.vagueId`. Avec le nouveau modèle, les dépenses issues d'une liste de besoins multi-vague n'ont pas de `vagueId` direct.

**Nouvelle stratégie d'imputation :**

Pour le calcul des coûts par vague dans `getRentabiliteParVague`, ajouter une requête supplémentaire :

```typescript
// Charger les dépenses issues de listes de besoins avec associations vague
const depensesBesoinsMultiVague = await prisma.depense.findMany({
  where: {
    siteId,
    listeBesoinsId: { not: null },
    vagueId: null,  // Pas imputée directement à une vague
    commandeId: null,
  },
  select: {
    montantTotal: true,
    listeBesoins: {
      select: {
        vagues: {
          select: { vagueId: true, ratio: true },
          where: { vagueId: { in: vagueIds } },
        },
      },
    },
  },
});

// Distribuer au prorata
for (const dep of depensesBesoinsMultiVague) {
  for (const lbv of dep.listeBesoins?.vagues ?? []) {
    const montantImpute = dep.montantTotal * lbv.ratio;
    coutsByVague.set(
      lbv.vagueId,
      (coutsByVague.get(lbv.vagueId) ?? 0) + montantImpute
    );
  }
}
```

**Cas des dépenses directement imputées à une vague (`vagueId` non null sur `Depense`)** : comportement inchangé — ces dépenses ne passent pas par un besoin multi-vague.

---

## 4. UX Mobile-First — Formulaire de création

### 4.1 Principe général

Remplacer le `<Select>` mono-vague par un **composant de liste dynamique** où l'utilisateur peut ajouter autant de paires (vague, pourcentage) qu'il veut. Le formulaire auto-balance les pourcentages.

### 4.2 Composant `VagueRatioEditor` (nouveau composant réutilisable)

Localisation : `src/components/besoins/vague-ratio-editor.tsx`

**Props :**

```typescript
interface VagueRatioEditorProps {
  /** Vagues disponibles sur le site */
  vagues: { id: string; code: string }[];
  /** Valeur courante */
  value: { vagueId: string; ratio: number }[];
  /** Callback de mise à jour */
  onChange: (value: { vagueId: string; ratio: number }[]) => void;
}
```

**Comportement :**

- Si aucune vague sélectionnée : message "Dépense générale (non imputée à une vague)"
- Bouton "Associer une vague" → ajoute une ligne (vague sélectionnable + % saisie)
- Chaque ligne : `<Select>` pour la vague + `<Input type="number">` pour le %
- Indicateur visuel du total des % (barre de progression ou compteur `Total: 85 % / 100 %`)
- Bouton d'auto-équilibrage : redistribue équitablement entre les vagues sélectionnées (100% / N, arrondi au dixième, ajustement sur la dernière)
- Bouton de suppression par ligne (icône corbeille)
- Validation en temps réel : rouge si total != 100 %, vert si = 100 %

**Rendu mobile (360px) :**

```
┌─────────────────────────────────────────┐
│ Vagues associées            [+ Ajouter] │
│─────────────────────────────────────────│
│ [VAG-2026-001 ▾]              [40] %  ✕ │
│ [VAG-2026-002 ▾]              [60] %  ✕ │
│─────────────────────────────────────────│
│ Total : 100 %  ✓        [Équilibrer]   │
└─────────────────────────────────────────┘
```

### 4.3 Intégration dans `BesoinsFormClient`

Remplacer le bloc `<Select>` vague unique (lignes 209–227) par `<VagueRatioEditor>`. La valeur est stockée dans `useState<{ vagueId: string; ratio: number }[]>([])`.

### 4.4 Intégration dans `ModifierBesoinDialog`

Ajouter `<VagueRatioEditor>` au dialog de modification (actuellement absent du dialog). Les vagues sont pré-chargées depuis l'API lors de l'ouverture du dialog.

### 4.5 Affichage dans `BesoinsDetailClient`

Remplacer le bloc d'affichage de `liste.vague` (ligne ~291) par :

```
Vagues associées
  VAG-2026-001  40 %
  VAG-2026-002  60 %
```

Si aucune vague : afficher "Dépense générale".

### 4.6 Affichage dans `BesoinsListClient` (cartes)

Remplacer `{lb.vague && <span>{lb.vague.code}</span>}` par :
- Aucune vague : rien (ou icône "site")
- 1 vague : afficher son code comme avant
- N vagues : afficher le code de la première + `+N-1` (ex. `VAG-001 +2`)

---

## 5. Alternatives considérées

### Alternative A : Ratio sur `LigneBesoin` plutôt que sur `ListeBesoins`

Permettre d'associer une vague différente par ligne de besoin (granularité maximale).

**Rejeté** : trop complexe pour l'UX mobile. La dépense partagée s'applique à l'ensemble de la liste, pas ligne par ligne. Le cas d'usage (électricité, gaz) est bien un coût global à répartir, pas une ligne spécifique.

### Alternative B : Conserver `vagueId` + ajouter un champ `vaguesJson` (JSONB)

Utiliser un champ JSON pour stocker les vagues supplémentaires.

**Rejeté** : anti-pattern pour les requêtes (impossibilité d'utiliser un filtre Prisma natif sur `vagueId`, pas de FK avec intégrité référentielle).

### Alternative C : Ne modifier que la `Depense` (vagueId multi via table de jonction)

Ajouter la multi-vague directement sur le modèle `Depense` plutôt que sur `ListeBesoins`.

**Rejeté** : le point d'entrée utilisateur est la liste de besoins. La dépense est générée automatiquement à partir de la liste. Il est plus cohérent d'exprimer l'intention de répartition au niveau du besoin, à la création.

### Alternative D : Ratio en pourcentage entier (Int) plutôt que Float

Stocker `ratio` comme un entier de 0 à 100.

**Rejeté** : les arrondis sur des distributions 3-vagues (33/33/34) sont plus propres en Float. La contrainte `SUM = 1.0` est plus naturelle en décimal. Le fait d'exposer des % à l'UI (côté form) ne requiert pas que la DB stocke des entiers.

---

## 6. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Migration de données silencieuse (besoins existants perdent leur vague) | Moyenne | Haut | Migration A séparée avec `INSERT INTO ListeBesoinsVague SELECT ... FROM ListeBesoins WHERE vagueId IS NOT NULL` avant tout `DROP COLUMN` |
| Régression du filtre `vagueId` sur l'API | Faible | Moyen | Test de non-régression dans `besoins.test.ts` (filtre `vagues: { some: ... }`) |
| Performance de la query financière (N+1 sur besoins) | Faible | Moyen | La query `depensesBesoinsMultiVague` est unique avec `include` Prisma, pas N+1 |
| Régression affichage cartes liste (vague afficée) | Faible | Bas | Test visuel mobile après déploiement |
| Somme des ratios != 1 côté client (arrondis JS) | Possible | Moyen | Tolérance ±0.001 côté serveur, auto-ajustement sur la dernière vague côté client |

---

## 7. Ordre d'implémentation suggéré

1. **@db-specialist** : Schéma Prisma + Migration A (CREATE TABLE) + Migration B (DROP COLUMN) + seed
2. **@architect** : Interfaces TypeScript (`src/types/models.ts`, `src/types/api.ts`)
3. **@developer** : `src/lib/queries/besoins.ts` (INCLUDE, getListeBesoins, create, update)
4. **@developer** : `src/lib/queries/finances.ts` (imputation prorata)
5. **@developer** : Composant `VagueRatioEditor` (mobile-first)
6. **@developer** : Intégration dans `BesoinsFormClient`, `ModifierBesoinDialog`, `BesoinsDetailClient`, `BesoinsListClient`
7. **@developer** : Route API `besoins/route.ts` (parsing `vagues[]` body)
8. **@tester** : Tests unitaires `besoins.test.ts` + test finances

---

## 8. Fichiers à créer ou modifier

| Fichier | Action |
|---|---|
| `prisma/schema.prisma` | Ajouter `ListeBesoinsVague`, modifier `ListeBesoins` et `Vague` |
| `prisma/migrations/YYYYMMDD_add_liste_besoins_vague/migration.sql` | Migration A |
| `prisma/migrations/YYYYMMDD_drop_liste_besoins_vague_id/migration.sql` | Migration B |
| `prisma/seed.sql` | Données de jonction pour les besoins existants |
| `src/types/models.ts` | Ajouter `ListeBesoinsVague`, modifier `ListeBesoins` et `ListeBesoinsWithRelations` |
| `src/types/api.ts` | Ajouter `VagueRatioDTO`, modifier `CreateListeBesoinsDTO`, `UpdateListeBesoinsDTO`, `ListeBesoinsFilters` |
| `src/lib/queries/besoins.ts` | Modifier `INCLUDE`, `getListeBesoins`, `createListeBesoins`, `updateListeBesoins` |
| `src/lib/queries/finances.ts` | Ajouter imputation prorata dans `getRentabiliteParVague` |
| `src/app/api/besoins/route.ts` | Remplacer parsing `vagueId` par parsing `vagues[]` |
| `src/components/besoins/vague-ratio-editor.tsx` | Nouveau composant |
| `src/components/besoins/besoins-form-client.tsx` | Intégrer `VagueRatioEditor` |
| `src/components/besoins/besoins-detail-client.tsx` | Afficher `vagues` au lieu de `vague` |
| `src/components/besoins/besoins-list-client.tsx` | Adapter affichage carte |
| `src/components/besoins/modifier-besoin-dialog.tsx` | Ajouter `VagueRatioEditor` |
| `src/__tests__/api/besoins.test.ts` | Tests multi-vague + filtre + finances |
