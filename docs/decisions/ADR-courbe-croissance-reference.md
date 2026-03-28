# ADR — Courbe de Croissance vs Référentiel Clarias gariepinus (F19)

**Date :** 2026-03-28
**Auteur :** @architect
**Sprint cible :** Sprint FB ou Sprint 12
**Statut :** DESIGN NEEDED

---

## Contexte

Un pisciculteur élevant Clarias gariepinus doit pouvoir répondre à une question simple :
"Est-ce que mes poissons grandissent normalement ?"

Aujourd'hui FarmFlow affiche la courbe de croissance observée (poids moyen vs date) mais
ne fournit aucune référence comparative. Le pisciculteur ne sait pas si un poids moyen de
180 g à J90 est bon, moyen ou insuffisant pour son espèce et ses conditions.

La courbe de croissance vs référentiel répond à ce besoin en superposant :
- La courbe **observée** : points de poids moyen issus des relevés BIOMETRIE de la vague
- La courbe **de référence** : valeurs théoriques pour Clarias gariepinus en conditions
  tropicales optimales (25–30°C, aliment 35–40 % protéines, FCR 1,5)

Cette feature est identifiée comme F19 dans `ADR-feed-analytics-research.md`
(Priorité 4 — NICE-TO-HAVE), reclassée SHOULD pour le sprint FB en raison de sa valeur
pédagogique pour les pisciculteurs débutants.

---

## Options considérées

### Option 1 — Référentiel statique embarqué (constantes dans le code)

**Principe :** Un tableau de valeurs de référence (poids moyen vs âge en jours) est encodé
directement dans le code TypeScript, basé sur les données FAO/CIRAD pour Clarias gariepinus
en conditions tropicales.

**Avantages :**
- Zéro complexité de base de données : aucune migration, aucune table supplémentaire
- Valeurs immédiatement disponibles dès le déploiement
- Données issues de sources scientifiques reconnues (FAO, CIRAD)
- Fonctionnement identique pour tous les sites
- Facile à mettre à jour via un fichier de constantes versionné

**Inconvénients :**
- Non personnalisable par site : un élevage en altitude (T° plus basse) aura un écart
  structurel avec le référentiel standard
- Ne reflète pas les conditions locales spécifiques (température eau, qualité)
- L'éleveur ne peut pas créer son propre référentiel

**Verdict : RETENU pour v1** — simplicité maximale, valeur immédiate.

---

### Option 2 — Référentiel configurable par site (dans ConfigElevage)

**Principe :** Le référentiel est stocké dans le modèle `ConfigElevage` (table Prisma) sous
forme de JSON. L'administrateur du site peut saisir ses propres points de référence ou
choisir parmi des profils prédéfinis (FAO standard, conditions Cameroun, conditions altitude).

**Avantages :**
- Adapté aux conditions locales (zones climatiques différentes au Cameroun)
- L'ingénieur peut personnaliser la référence selon l'expérience terrain
- Possibilité d'intégrer plusieurs profils (aliment artisanal vs aliment industriel)

**Inconvénients :**
- Nécessite une interface de configuration dédiée (formulaire de saisie de points)
- Complexité de migration Prisma (champ JSON ou table dédiée)
- Si non configuré, le système tombe en Option 1 (fallback nécessaire)
- Valeur ajoutée faible en début d'utilisation (sites sans historique)

**Verdict : ENVISAGÉ pour v1.5** — à implémenter après Option 1 si la demande est confirmée.

---

### Option 3 — Référentiel dynamique calculé sur les vagues passées du site

**Principe :** Le référentiel est calculé automatiquement en agrégeant les relevés
BIOMETRIE de toutes les vagues terminées (statut TERMINEE) du site. La médiane des poids
moyens par âge constitue la courbe de référence "site".

**Avantages :**
- Référentiel 100 % adapté aux conditions réelles du site
- S'améliore automatiquement avec chaque nouveau cycle terminé
- Permet de détecter une régression réelle (vague actuelle < médiane historique du site)
- Valeur analytique maximale pour les sites avec plusieurs cycles

**Inconvénients :**
- Requiert un historique minimum (au moins 3–5 vagues terminées) pour être significatif
- Requiert une agrégation de données complexe (normalisation des âges, interpolation)
- Inutilisable pour un nouveau site (0 vague terminée)
- Calcul potentiellement lent sur de nombreuses vagues (à mettre en cache)

**Verdict : RETENU pour v2** — excellent à long terme, impraticable sans historique.

---

## Recommandation

**v1 : Option 1 (référentiel statique FAO/CIRAD)**
Déployable immédiatement, valeur pédagogique immédiate pour tous les sites.

**v1.5 (backlog) : Option 2 (configurable par site)**
Si plusieurs sites demandent un ajustement selon leurs conditions locales.

**v2 (vision long terme) : Option 3 (dynamique sur historique)**
Déclenchée automatiquement dès qu'un site a 3 vagues terminées. L'UI affiche la source
du référentiel utilisé ("Référentiel FAO" vs "Données historiques du site").

---

## Données de référence (v1)

Courbe poids moyen vs âge (en jours depuis mise en charge) pour Clarias gariepinus en
conditions tropicales optimales : eau 25–30°C, aliment 35–40 % protéines, FCR 1,5,
densité initiale 50 poissons/m³.

**Source :** FAO Fisheries Technical Paper No. 408 + CIRAD Afrique subsaharienne + données
terrain DK Farm Cameroun.

| Âge (jours) | Poids moyen de référence (g) | Phase |
|-------------|------------------------------|-------|
| 0 | 0,5 | Mise en charge (alevins fingerling) |
| 10 | 2 | Alevinage |
| 20 | 5 | Alevinage |
| 30 | 15 | Pré-grossissement |
| 45 | 35 | Pré-grossissement |
| 60 | 50 | Grossissement début |
| 75 | 90 | Grossissement |
| 90 | 150 | Grossissement |
| 105 | 210 | Grossissement |
| 120 | 300 | Grossissement avancé |
| 135 | 390 | Grossissement avancé |
| 150 | 500 | Finition |
| 165 | 620 | Finition |
| 180 | 750 | Récolte possible |
| 210 | 950 | Récolte tardive |

**Représentation TypeScript (constante embarquée) :**

```typescript
// src/lib/benchmarks/courbe-croissance-clarias.ts

export interface PointCroissance {
  jour: number;       // âge en jours depuis mise en charge
  poidsMoyenG: number; // poids moyen de référence en grammes
  phase: string;      // libellé de phase (informatif)
}

export const COURBE_REFERENCE_CLARIAS_V1: PointCroissance[] = [
  { jour: 0,   poidsMoyenG: 0.5,  phase: "Mise en charge" },
  { jour: 10,  poidsMoyenG: 2,    phase: "Alevinage" },
  { jour: 20,  poidsMoyenG: 5,    phase: "Alevinage" },
  { jour: 30,  poidsMoyenG: 15,   phase: "Pré-grossissement" },
  { jour: 45,  poidsMoyenG: 35,   phase: "Pré-grossissement" },
  { jour: 60,  poidsMoyenG: 50,   phase: "Grossissement" },
  { jour: 75,  poidsMoyenG: 90,   phase: "Grossissement" },
  { jour: 90,  poidsMoyenG: 150,  phase: "Grossissement" },
  { jour: 105, poidsMoyenG: 210,  phase: "Grossissement" },
  { jour: 120, poidsMoyenG: 300,  phase: "Grossissement avancé" },
  { jour: 135, poidsMoyenG: 390,  phase: "Grossissement avancé" },
  { jour: 150, poidsMoyenG: 500,  phase: "Finition" },
  { jour: 165, poidsMoyenG: 620,  phase: "Finition" },
  { jour: 180, poidsMoyenG: 750,  phase: "Récolte possible" },
  { jour: 210, poidsMoyenG: 950,  phase: "Récolte tardive" },
];

/**
 * Retourne le poids de référence interpolé pour un âge donné.
 * Interpolation linéaire entre les deux points encadrants.
 */
export function getPoidsReference(jourAge: number): number | null {
  if (jourAge < 0) return null;
  const points = COURBE_REFERENCE_CLARIAS_V1;
  if (jourAge >= points[points.length - 1].jour) {
    return points[points.length - 1].poidsMoyenG;
  }
  const idx = points.findIndex((p) => p.jour > jourAge);
  if (idx <= 0) return points[0].poidsMoyenG;
  const p1 = points[idx - 1];
  const p2 = points[idx];
  const ratio = (jourAge - p1.jour) / (p2.jour - p1.jour);
  return p1.poidsMoyenG + ratio * (p2.poidsMoyenG - p1.poidsMoyenG);
}
```

---

## UI — Composant Recharts

### Principe

Le composant `CourbeGrossissement` existant (graphique de croissance par vague) est étendu
avec une deuxième ligne `Line` Recharts représentant le référentiel.

L'utilisateur peut activer/désactiver l'overlay via un toggle (Radix UI `Switch`).

### Structure du composant

```
CourbeGrossissement (Server Component shell)
  └── CourbeGrossissementClient (Client Component — "use client")
        ├── Switch "Afficher référentiel" (Radix UI)
        ├── ResponsiveContainer (Recharts)
        │     └── LineChart
        │           ├── Line "Observé" (couleur primaire, points réels)
        │           ├── Line "Référentiel FAO" (couleur neutre, tirets, conditionnelle)
        │           ├── ReferenceLine (zone verte = ±15 % du référentiel)
        │           ├── Tooltip (affiche les deux valeurs + écart %)
        │           └── Legend
        └── Badge source du référentiel
              ex. "Référentiel FAO/CIRAD — conditions tropicales optimales"
```

### Données passées au composant

```typescript
interface CourbeGrossissementData {
  // Points observés (depuis relevés BIOMETRIE)
  observes: {
    date: string;           // ISO date du relevé
    jourAge: number;        // âge de la vague à ce relevé
    poidsMoyenG: number;    // poids moyen mesuré
  }[];

  // Points de référence interpolés (calculés côté serveur)
  // Couvre la même plage d'âges que les points observés + projection jusqu'à J210
  references: {
    jourAge: number;
    poidsMoyenG: number;
    phase: string;
  }[];

  // Méta
  sourceReference: "FAO_CIRAD_V1" | "SITE_HISTORIQUE" | "CONFIGELEVAGE";
  dateDebutVague: string;
}
```

### Indicateur d'écart

Sous le graphique, afficher un résumé textuel :

```
Au jour 90 : poids observé 135 g — référentiel 150 g — écart : -10 %
  → Dans la normale (écart < 15 %)
```

Seuils d'alerte :
- Écart < -15 % : alerte orange (retard de croissance)
- Écart < -30 % : alerte rouge (retard critique)
- Écart > +20 % : indication verte (croissance supérieure au référentiel)

---

## Emplacement des fichiers

```
src/
  lib/
    benchmarks/
      courbe-croissance-clarias.ts    ← Constante + fonction getPoidsReference()
  components/
    vagues/
      courbe-grossissement.tsx        ← Shell Server Component (existant — à étendre)
      courbe-grossissement-client.tsx ← Client Component avec Recharts + Switch overlay
  app/
    (farm)/
      vagues/
        [id]/
          page.tsx                    ← Passer les données de référence pré-calculées
```

---

## Contrat de données (API / Server Component)

Le calcul du référentiel se fait côté serveur (Server Component ou Route Handler) :

```typescript
// Dans la page vague/[id]/page.tsx (Server Component)
import { getPoidsReference, COURBE_REFERENCE_CLARIAS_V1 } from "@/lib/benchmarks/courbe-croissance-clarias";

// 1. Récupérer les relevés BIOMETRIE de la vague
const releves = await getReleves({ vagueId, type: TypeReleve.BIOMETRIE });

// 2. Calculer l'âge pour chaque relevé
const observes = releves.map((r) => ({
  date: r.date.toISOString(),
  jourAge: differenceInDays(r.date, vague.dateDebut),
  poidsMoyenG: r.poidsMoyen,
}));

// 3. Calculer les points de référence pour la même plage
const maxJour = Math.max(...observes.map((o) => o.jourAge), 180);
const references = COURBE_REFERENCE_CLARIAS_V1
  .filter((p) => p.jour <= maxJour + 30)
  .map((p) => ({ ...p }));

// 4. Passer au composant client
```

---

## Décisions liées

- ADR-feed-analytics-research.md — F19 : courbe croissance vs référentiel
- ADR 006 : Export PDF/Excel — ce graphique pourra être inclus dans le rapport PDF vague
  (comme image PNG via `@react-pdf/renderer` `<Image>` ou tableau simplifié)
- ADR 004 : Multi-tenancy — les données observées sont filtrées par `siteId`

---

## Sprint cible et ordre d'implémentation

**Sprint FB (Feed Analytics) ou Sprint 12**

1. Ce document (ADR) — @architect
2. Fichier `src/lib/benchmarks/courbe-croissance-clarias.ts` — @architect ou @developer
3. Extension du composant `courbe-grossissement-client.tsx` (overlay + toggle) — @developer
4. Calcul côté serveur dans `vagues/[id]/page.tsx` — @developer
5. Tests du composant + de la fonction `getPoidsReference` — @tester

**Dépendances :**
- Aucune migration Prisma requise pour v1 (données statiques)
- Dépend du composant `CourbeGrossissement` existant (à identifier dans la codebase)
