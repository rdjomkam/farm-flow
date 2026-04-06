# Base de Connaissances — ADR-036 FCR par aliment

> Entrées extraites de la review de l'ADR-036 et de la pré-analyse associée.
> Référence : `docs/decisions/ADR-036-fcr-by-feed-algorithm.md`
> Ces entrées sont également à ajouter dans `ERRORS-AND-FIXES.md` (catégories Code et Pattern).

---

## Catégorie : Code

### ERR-065 — R2 : string literals TypeReleve dans les queries Prisma au lieu de l'enum
**Sprint :** ADR-036 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/fcr-by-feed.ts`

**Symptôme :**
Les filtres Prisma utilisent des strings en dur : `typeReleve: "BIOMETRIE"`, `typeReleve: "COMPTAGE"`, `typeReleve: "MORTALITE"`. Aucune erreur TypeScript à la compilation car Prisma accepte les strings compatibles avec l'enum, mais la règle R2 est violée.

**Cause racine :**
Le développeur a écrit les filtres de query directement avec les valeurs string au lieu d'importer l'enum `TypeReleve` depuis `@/types`. Ce pattern est fréquent dans les nouvelles queries car les strings "semblent" fonctionner.

**Fix :**
```typescript
// Avant (violation R2) :
where: { typeReleve: "BIOMETRIE", siteId }

// Après (R2 respectée) :
import { TypeReleve } from "@/types";
where: { typeReleve: TypeReleve.BIOMETRIE, siteId }
```

**Leçon / Règle :**
Toujours importer et utiliser les enums TypeScript (`TypeReleve`, `StatutVague`, `TypeMouvement`, etc.) dans les filtres Prisma. Ne jamais passer une string en dur — même si TypeScript ne proteste pas, cela viole R2 et rend les refactorings d'enum silencieusement cassants. Voir aussi ERR-020 (pattern identique sur `TypeReleve.MORTALITE`).

---

### ERR-066 — `as any` pour adapter un type intermédiaire au lieu de créer le bon type
**Sprint :** ADR-036 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/fcr-by-feed.ts`

**Symptôme :**
`as any[]` est utilisé pour passer un tableau de `CalibrageWithSource` à la fonction `estimerPopulationBac`. Double `as any` détecté dans la même fonction. TypeScript ne signale aucune erreur mais la sécurité de type est perdue — une incohérence de structure sera silencieuse au runtime.

**Cause racine :**
La query Prisma retourne un type inféré (ex. `CalibrageWithSource & { sourceBacIds: string[] }`) qui ne correspond pas exactement à `CalibragePoint` attendu par `estimerPopulationBac`. Plutôt que de créer un type intermédiaire précis et d'effectuer la transformation correctement, l'implémenteur a utilisé `as any` pour court-circuiter TypeScript.

**Fix :**
Définir un type intermédiaire explicite et mapper les données de la query vers ce type avant d'appeler la fonction :
```typescript
// Avant (dangereux) :
estimerPopulationBac(..., calibrages as any[], ...);

// Après (sûr) :
interface CalibrageForEstimation {
  date: Date;
  bacSourceId: string;
  bacDestId: string;
  nombreTransfere: number;
}
const calibragesFormatted: CalibrageForEstimation[] = rawCalibrages.map(c => ({
  date: c.date,
  bacSourceId: c.sourceBacIds[0],  // voir aussi ERR-067
  bacDestId: c.bacDestId,
  nombreTransfere: c.nombreTransfere,
}));
estimerPopulationBac(..., calibragesFormatted, ...);
```

**Leçon / Règle :**
Un `as any` ou `as any[]` dans une query Prisma est toujours le symptôme d'un type intermédiaire manquant. La solution correcte est : (1) définir le type de destination, (2) mapper explicitement. Ne jamais caster pour "faire taire" TypeScript — chaque `as any` est une bombe à retardement dans les refactorings futurs. La review doit refuser tout `as any` dans les fichiers de query.

---

### ERR-067 — Tableau `sourceBacIds` : seul l'index 0 traité — les bacs 2, 3... invisibles
**Sprint :** ADR-036 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/fcr-by-feed.ts`

**Symptôme :**
`sourceBacIds` est un champ de type `string[]` (tableau). Dans la logique de détection des "bacs vidés" lors d'un calibrage, seul `sourceBacIds[0]` est lu. Si un calibrage implique 2 ou 3 bacs sources, seul le premier bac est détecté comme "vidé" — les autres restent avec une population incorrecte, faussant le calcul FCR de leurs périodes post-calibrage.

**Cause racine :**
L'implémenteur a supposé qu'un calibrage n'implique qu'un seul bac source et a accédé à l'index 0 directement. La structure de données (`sourceBacIds: string[]`) indique explicitement qu'un calibrage peut avoir plusieurs sources.

**Fix :**
Itérer sur tous les éléments du tableau :
```typescript
// Avant (incomplet) :
const isVideSource = calibrage.sourceBacIds[0] === bacId;

// Après (correct) :
const isVideSource = calibrage.sourceBacIds.includes(bacId);
```
Et lors du mapping vers un type intermédiaire, produire une entrée par bac source :
```typescript
const calibragesExpanded = rawCalibrages.flatMap(c =>
  c.sourceBacIds.map(sourceId => ({ ...c, bacSourceId: sourceId }))
);
```

**Leçon / Règle :**
Quand un champ est un tableau (`string[]`, `number[]`, etc.), toujours traiter TOUS ses éléments. Accéder à l'index 0 d'un tableau est un anti-pattern sauf si le tableau est garanti de longueur 1 par le schéma. Lors de la review, tout accès `array[0]` sur un champ dont le type est `T[]` doit être justifié ou remplacé par une itération. La pré-analyse doit signaler les champs tableaux dans les structures de données impliquées.

---

## Catégorie : Pattern

### ERR-068 — Découverte des bacs depuis `Bac.vagueId` au lieu de `ReleveConsommation` : bacs désassignés invisibles
**Sprint :** ADR-036 | **Date :** 2026-04-06
**Sévérité :** Critique
**Fichier(s) :** `src/lib/queries/analytics.ts` (ancien `computeAlimentMetrics`), `src/lib/queries/fcr-by-feed.ts`

**Symptôme :**
L'ancienne fonction `computeAlimentMetrics` découvrait les bacs d'une vague via `prisma.bac.findMany({ where: { vagueId } })`. Après un calibrage (transfert de poissons d'un bac source vers un bac destination), le bac source est désassigné (`vagueId = null`). Sa consommation de nourriture AVANT le calibrage était alors ignorée du calcul FCR, produisant un FCR sous-estimé (moins d'aliment au numérateur, même gain au dénominateur).

**Cause racine :**
`Bac.vagueId` reflète l'état ACTUEL de l'assignation du bac. Après un calibrage, un bac peut être libéré (`vagueId = null`) alors que ses relevés de consommation historiques contiennent toujours des données valides appartenant à la vague. La query sur `Bac.vagueId` ne remonte jamais dans le passé.

**Fix (Step 5 de l'ADR-036) :**
Découvrir les bacs depuis les enregistrements `ReleveConsommation` au lieu de `Bac.vagueId` :
```typescript
// Avant (incorrect — manque les bacs désassignés) :
const bacs = await prisma.bac.findMany({ where: { vagueId, siteId } });

// Après (correct — inclut tous les bacs ayant réellement consommé) :
const consommations = await prisma.releveConsommation.findMany({
  where: { releve: { vagueId, siteId }, produitId },
  include: { releve: { include: { bac: true } } }
});
const bacsActifs = [...new Map(
  consommations.map(c => [c.releve.bacId, c.releve.bac])
).values()];
```

**Leçon / Règle :**
Pour calculer des métriques basées sur la consommation historique d'une vague, toujours partir des enregistrements de consommation (`ReleveConsommation`) pour découvrir les bacs impliqués — jamais de `Bac.vagueId`. `Bac.vagueId` est l'état courant, pas l'historique. Ce pattern s'applique à tout calcul rétrospectif : FCR, SGR, bilan alimentaire. L'ADR-036 mandate cette approche pour `computeAlimentMetrics` et tout nouvel algorithme similaire.

---

### ERR-069 — Invariant de conservation non testé : sum(qtyPériodes) doit égaler total consommation bac
**Sprint :** ADR-036 | **Date :** 2026-04-06
**Sévérité :** Haute
**Fichier(s) :** `src/lib/queries/fcr-by-feed.ts`, `src/__tests__/lib/fcr-by-feed.test.ts`

**Symptôme :**
La fonction `segmenterPeriodesParBac` divise les jours de consommation d'un bac en périodes (exclusives, mixtes, ruptures). Si cet invariant n'est pas testé, une logique incorrecte de rattachement des jours mixtes ou de gestion des gaps peut silencieusement "perdre" de la quantité d'aliment — du tonnage qui existait dans `ReleveConsommation` n'apparaît dans aucune période, faussant le FCR.

**Cause racine :**
L'invariant de conservation est une propriété globale difficile à vérifier visuellement dans le code. Sans test unitaire dédié, une régression dans la segmentation peut passer inaperçue tant que les valeurs calculées "semblent raisonnables".

**Fix :**
Ajouter un test d'invariant explicite dans la suite de tests :
```typescript
describe("segmenterPeriodesParBac", () => {
  it("conservation : sum(qtyTargetKg) over toutes les périodes == total consommation bac", () => {
    const consoByDay = new Map([
      ["2026-01-01", { qtyTargetKg: 2.5, autresProduits: [] }],
      ["2026-01-02", { qtyTargetKg: 3.0, autresProduits: [{ produitId: "other", quantiteKg: 1.0 }] }],
      ["2026-01-05", { qtyTargetKg: 1.8, autresProduits: [] }], // gap de 2 jours
    ]);
    const totalConso = [...consoByDay.values()].reduce((s, d) => s + d.qtyTargetKg, 0);
    const periodes = segmenterPeriodesParBac(consoByDay, "bac1", "Bac 1");
    const totalPeriodes = periodes.reduce((s, p) => s + p.qtyTargetKg, 0);
    expect(totalPeriodes).toBeCloseTo(totalConso, 6);
  });
});
```

**Leçon / Règle :**
Toute fonction qui partitionne un ensemble de données en sous-ensembles (segmentation, groupement, splitting) DOIT avoir un test d'invariant de conservation : la somme des parties doit égaler le tout. Cet invariant doit être le premier test écrit, avant les cas nominaux. Pour l'algorithme FCR-by-feed, l'invariant est : `Σ qtyTargetKg sur toutes les périodes d'un bac == Σ quantite de ReleveConsommation pour ce bac et cet aliment`. Tout écart indique une perte ou un double-comptage silencieux dans le calcul FCR.

---

## Références

- ADR-036 : `docs/decisions/ADR-036-fcr-by-feed-algorithm.md`
- Pré-analyse : `docs/reviews/pre-analysis-ADR-036.md`
- Review : `docs/reviews/review-ADR-036-fcr-by-feed.md`
- Erreurs connexes : ERR-020 (R2 string literal), ERR-050 (bacs désassignés invisibles), ERR-052 (agrégation FCR incorrecte)
