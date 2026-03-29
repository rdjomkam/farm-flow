# Revue architecturale — Intégration du modèle Gompertz dans FarmFlow

**Date :** 2026-03-29
**Auteur :** @architect
**Document source :** `docs/guides/gompertz-farmflow-guide.docx` (guide technique, format binaire)
**Statut :** LIVREE

---

## Contexte de la revue

Le guide propose d'intégrer un modèle de croissance Gompertz pour prédire la courbe de
poids moyen des Clarias gariepinus :

```
W(t) = W∞ × exp(-exp(-K × (t - tᵢ)))
```

Paramètres :
- `W∞` : poids asymptotique (g) — le poids maximum théorique de l'espèce
- `K`  : taux de croissance intrinsèque (1/jour) — la vitesse à laquelle la croissance ralentit
- `tᵢ` : temps au point d'inflexion (jours) — l'âge de croissance maximale

Calibrage automatique visé : régression non-linéaire par Levenberg-Marquardt sur les
biométries enregistrées. Comparaison des aliments via impact différentiel sur le paramètre K.

---

## A. Validation du guide

### Points forts

1. **Choix du modèle justifié.** Gompertz est le modèle de croissance le plus adapté à
   Clarias gariepinus en élevage intensif. Contrairement à Von Bertalanffy (pêche extensive)
   ou logistique (populations), Gompertz capture correctement la phase d'accélération précoce
   et la décélération progressive caractéristiques de ce silure en bac. Les données terrain
   DK Farm et les références FAO confirment cette forme sigmoïdale asymétrique.

2. **Calibrage automatique pertinent.** L'idée d'extraire les paramètres automatiquement à
   partir des relevés BIOMETRIE existants est architecturalement cohérente : FarmFlow dispose
   déjà de la série temporelle poids/jour pour chaque vague. Pas de saisie manuelle nécessaire.

3. **Application aliments.** Utiliser l'impact sur K comme discriminant d'aliment est
   scientifiquement solide : K capte l'efficacité métabolique nette de l'aliment sur toute la
   durée du cycle, là où le FCR mesure une efficacité ponctuelle et instantanée.

4. **Connexion avec les projections existantes.** Le guide identifie correctement que
   `ProjectionVague` et `CourbeCroissancePoint` dans `src/types/calculs.ts` sont les points
   d'extension naturels.

### Points faibles et lacunes

1. **Absence de traitement du minimum de données.** Le guide ne précise pas combien de points
   biométriques sont nécessaires pour que la calibration LM converge de manière fiable.
   En pratique, 3 paramètres libres (W∞, K, tᵢ) nécessitent au minimum 5 points distincts
   bien répartis sur la courbe sigmoïdale. Avec seulement 2–3 biométries (fréquent en début
   de cycle), l'algorithme LM diverge ou produit des valeurs absurdes (W∞ → ∞ ou K < 0).

2. **Initialisation des paramètres LM non traitée.** L'algorithme Levenberg-Marquardt est
   sensible aux valeurs initiales. Le guide ne propose pas de stratégie d'initialisation.
   Sans valeurs initiales raisonnables, LM converge vers un minimum local non physique.
   Les valeurs initiales recommandées pour Clarias en élevage camerounais :
   - W∞₀ = max(biometries) × 1.5 ou 1200 g si pas de données
   - K₀ = 0.03 (d'après paramètres FAO moyens pour Clarias gariepinus)
   - tᵢ₀ = 45 jours (point d'inflexion moyen observé en élevage intensif)

3. **Contraintes physiques manquantes.** LM sans bornes peut produire K < 0 ou W∞ < poids
   actuel. Les bornes doivent être imposées :
   - W∞ ∈ [max(biometries), 3000 g] — le plafond biologique plausible
   - K ∈ [0.005, 0.2] — plage réaliste pour Clarias
   - tᵢ ∈ [0, 120] — l'inflexion ne peut pas dépasser la moitié du cycle

4. **Aucune bibliothèque JavaScript de régression non-linéaire n'est identifiée.** C'est
   un choix crucial. Le guide laisse cette question ouverte. Voir section D ci-dessous.

5. **Lien avec le SGR et les projections linéaires existantes non clarifié.** FarmFlow
   utilise actuellement une projection basée sur le SGR (`feeding.ts` ligne 135 :
   `W(t) = W0 × exp(SGR/100 × t)`). Cette formule est une croissance exponentielle simple,
   incompatible avec la décélération Gompertz en fin de cycle. Le guide doit préciser la
   coexistence : Gompertz pour la courbe de croissance complète, SGR pour la projection
   immédiate à court terme (7 jours), ou Gompertz pour les deux.

6. **Problème de dégénérescence pour les vagues de finition.** Quand une vague est en
   phase PRE_RECOLTE (poids > 700 g), la courbe Gompertz est déjà dans la zone asymptotique
   plate. La projection de date de récolte via Gompertz devient très imprécise car
   W(t) ≈ W∞ pour tout t. Le guide ne mentionne pas ce cas limite.

7. **Absence de traitement des vagues multi-bacs.** FarmFlow supporte les vagues avec
   plusieurs bacs ayant des poids moyens différents (`BacAlimentationContext`). Le guide
   traite la vague comme un seul lot homogène. Un bac de poids moyen 80 g et un autre de
   200 g dans la même vague produisent des paramètres Gompertz radicalement différents.

### Corrections factuelles

- Le point d'inflexion `tᵢ` est l'âge en jours à la croissance ABSOLUE maximale (dW/dt
  maximum), non l'âge à la moitié du poids asymptotique. Cette nuance est importante pour
  l'interprétation : chez Clarias en élevage intensif camerounais, tᵢ se situe typiquement
  entre 30 et 60 jours selon la température de l'eau et la densité.

- W∞ n'est pas le "poids à la récolte" mais le poids théorique si la vague durait
  indéfiniment. Pour un cycle de 180 jours, W(180) ≈ 0.85 × W∞ typiquement. Cette
  distinction doit apparaître dans l'UI pour éviter la confusion.

---

## B. Plan d'implémentation concret

### B.1 Nouveau fichier : `src/lib/gompertz.ts`

Fonctions pures, zéro dépendance DB, testables unitairement.

```typescript
// Interfaces

export interface GompertzParams {
  wInfinity: number;   // poids asymptotique en grammes
  k: number;           // taux de croissance intrinsèque (1/jour)
  ti: number;          // point d'inflexion en jours
}

export interface GompertzCalibrationInput {
  // Série chronologique des biométries triées par date
  points: Array<{
    jourAge: number;      // âge de la vague en jours depuis mise en charge
    poidsMoyenG: number;  // poids moyen mesuré en grammes
  }>;
  // Contraintes physiques optionnelles (override des defaults)
  bornes?: {
    wInfMin?: number;
    wInfMax?: number;
    kMin?: number;
    kMax?: number;
    tiMin?: number;
    tiMax?: number;
  };
}

export interface GompertzCalibrationResult {
  params: GompertzParams;
  // Qualité de l'ajustement
  r2: number;                    // coefficient de détermination [0,1]
  rmse: number;                  // erreur quadratique moyenne (g)
  pointsUtilises: number;        // nombre de points biométriques utilisés
  // Fiabilité
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";
  // Message d'avertissement si convergence partielle
  warning: string | null;
}

// Fonctions à implémenter

export function gompertzWeight(t: number, params: GompertzParams): number
export function calibrerGompertz(input: GompertzCalibrationInput): GompertzCalibrationResult | null
export function projeterDateRecolte(params: GompertzParams, poidsObjectif: number, joursActuels: number): number | null
export function genererCourbeGompertz(params: GompertzParams, joursMax: number, pas?: number): Array<{jour: number; poids: number}>
export function gompertzVelocity(t: number, params: GompertzParams): number  // dW/dt — taux de croissance instantané
```

### B.2 Modifications de `src/lib/calculs.ts`

Ajouter une fonction de projection Gompertz compatible avec le contexte existant :

```typescript
export function projeterPoidsGompertz(
  joursDepuisDebut: number,
  params: GompertzParams
): number | null

// Remplaçant amélioré de la projection SGR linéaire dans feeding.ts
// Pour joursRestants <= 14 : continuer avec SGR (précision à court terme)
// Pour joursRestants > 14 : utiliser Gompertz si paramètres calibrés disponibles
```

### B.3 Nouveau fichier : `src/lib/gompertz-cache.ts`

Cache serveur des paramètres calibrés par vague pour éviter de recalculer à chaque rendu.

```typescript
export interface GompertzCacheEntry {
  vagueId: string;
  params: GompertzParams;
  calibrationResult: GompertzCalibrationResult;
  calculatedAt: Date;           // Date du dernier calibrage
  biometrieCount: number;       // Nombre de biométries au moment du calibrage
  lastBiometrieDate: Date;      // Date de la dernière biométrie utilisée
}

// Map en mémoire (Next.js module-level cache, invalidé par restart)
// Pour la production : Redis via Upstash ou table Prisma GompertzVague
```

### B.4 Nouveaux types dans `src/types/calculs.ts`

```typescript
export interface GompertzProjectionPoint extends CourbeCroissancePoint {
  poidsGompertz: number | null;   // troisième série : courbe Gompertz calibrée
}

export interface ProjectionVagueV2 extends ProjectionVague {
  // Extension non breaking de l'interface existante
  gompertzParams: GompertzParams | null;
  gompertzR2: number | null;
  gompertzConfidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA" | null;
  dateRecolteGompertz: Date | null;    // date estimée par Gompertz vs SGR
}
```

### B.5 Nouveau fichier : `src/app/api/vagues/[id]/gompertz/route.ts`

```typescript
// GET /api/vagues/[id]/gompertz
// Retourne les paramètres Gompertz calibrés pour la vague
// Déclenche le calibrage si non encore calculé ou si nouvelles biométries depuis

// Response type
interface GompertzRouteResponse {
  vagueId: string;
  calibration: GompertzCalibrationResult | null;
  courbe: Array<{ jour: number; poids: number }>;
  dateRecolteEstimee: string | null;
}
```

### B.6 Extension de `src/components/dashboard/projections.tsx`

Le composant `CourbeProjectionChart` reçoit actuellement `courbeProjection: CourbeCroissancePoint[]`.
Étendre pour afficher une troisième ligne Gompertz via `dataKey="poidsGompertz"` sans casser
l'interface existante (champ optionnel).

---

## C. Modifications du schéma Prisma

### Option recommandée : table dédiée `GompertzVague`

Ne pas polluer `ConfigElevage` avec des paramètres qui appartiennent à une vague spécifique
(résultat d'un calibrage sur données réelles, pas une configuration).

```prisma
// À ajouter dans prisma/schema.prisma

model GompertzVague {
  id        String   @id @default(cuid())

  // Relation vague (1:1, un seul jeu de paramètres par vague)
  vagueId   String   @unique
  vague     Vague    @relation(fields: [vagueId], references: [id], onDelete: Cascade)

  // Paramètres calibrés
  wInfinity Float    // poids asymptotique (g)
  k         Float    // taux de croissance (1/jour)
  ti        Float    // point d'inflexion (jours)

  // Qualité du calibrage
  r2        Float    // coefficient de détermination
  rmse      Float    // erreur quadratique moyenne (g)
  biometrieCount Int // nombre de points utilisés
  confidenceLevel String // "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA"

  // Métadonnées
  siteId    String
  site      Site     @relation(fields: [siteId], references: [id])
  calculatedAt DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([siteId])
  @@index([vagueId])
}
```

Ajouter sur le modèle `Vague` :
```prisma
gompertz GompertzVague?
```

### Migration SQL (à créer manuellement — workaround non-interactif)

```sql
-- Migration: add_gompertz_vague
CREATE TABLE "GompertzVague" (
  "id"              TEXT NOT NULL,
  "vagueId"         TEXT NOT NULL,
  "wInfinity"       DOUBLE PRECISION NOT NULL,
  "k"               DOUBLE PRECISION NOT NULL,
  "ti"              DOUBLE PRECISION NOT NULL,
  "r2"              DOUBLE PRECISION NOT NULL,
  "rmse"            DOUBLE PRECISION NOT NULL,
  "biometrieCount"  INTEGER NOT NULL,
  "confidenceLevel" TEXT NOT NULL,
  "siteId"          TEXT NOT NULL,
  "calculatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GompertzVague_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GompertzVague_vagueId_key" UNIQUE ("vagueId"),
  CONSTRAINT "GompertzVague_vagueId_fkey"
    FOREIGN KEY ("vagueId") REFERENCES "Vague"("id") ON DELETE CASCADE,
  CONSTRAINT "GompertzVague_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "Site"("id")
);

CREATE INDEX "GompertzVague_siteId_idx" ON "GompertzVague"("siteId");
CREATE INDEX "GompertzVague_vagueId_idx" ON "GompertzVague"("vagueId");
```

### Pourquoi pas dans ConfigElevage

`ConfigElevage` porte des paramètres de configuration applicables à tout un profil d'élevage
(seuils, benchmarks, intervalles). Les paramètres Gompertz sont des résultats de calibrage
spécifiques à une vague précise. Les mettre dans `ConfigElevage` contaminerait la sémantique
du modèle et rendrait impossible la comparaison inter-vagues (chaque vague doit avoir ses
propres paramètres, pas hérités du profil).

---

## D. Architecture du calibrage automatique

### Où placer l'algorithme Levenberg-Marquardt

**Decision : côté SERVEUR uniquement (Server Action ou API Route).**

Justification :
- LM est itératif (50–200 itérations typiquement). Sur mobile 360px avec CPU limité,
  cela peut bloquer le thread JavaScript pendant 200–800 ms.
- L'algorithme doit accéder aux relevés BIOMETRIE depuis la DB — c'est déjà côté serveur.
- Les résultats mis en cache (table `GompertzVague`) évitent de recalculer à chaque page.
- La lib recommandée pour Next.js server-side : `ml-levenberg-marquardt` (npm, 12 kB,
  TypeScript natif, zéro dépendance native). Alternative : `levenberg-marquardt` de
  scijs/levenberg-marquardt.

Ne pas utiliser côté client : aucune lib LM mature disponible côté browser sans WebWorker,
et le calcul n'apporte aucune interactivité qui justifie l'exécution client.

### Stratégie d'initialisation des paramètres LM

```typescript
function initialiserParams(
  points: Array<{jourAge: number; poidsMoyenG: number}>
): GompertzParams {
  const poidsMax = Math.max(...points.map(p => p.poidsMoyenG));
  const jourMax  = Math.max(...points.map(p => p.jourAge));
  return {
    wInfinity: poidsMax * 1.5,                    // 50% au-dessus du max observé
    k: 0.03,                                       // valeur FAO moyenne Clarias
    ti: Math.min(45, jourMax * 0.4),               // 40% de la plage observée
  };
}
```

### Quand déclencher le recalibrage

Le recalibrage doit être déclenché de manière paresseuse (lazy), pas proactive :

1. **Lors de la lecture de la page vague/[id]** : si `GompertzVague.calculatedAt` est
   absent ou si un nouveau relevé BIOMETRIE existe depuis `GompertzVague.updatedAt`,
   déclencher le recalibrage en arrière-plan (Server Action asynchrone ou background job).

2. **Après l'enregistrement d'un relevé BIOMETRIE** : dans l'API route
   `POST /api/releves`, invalider le cache `GompertzVague` de la vague concernée via
   `prisma.gompertzVague.deleteMany({ where: { vagueId } })`. Le prochain chargement
   recalibrera.

3. **Ne pas recalibrer si biometrieCount < 5** : retourner `null` avec
   `confidenceLevel: "INSUFFICIENT_DATA"` et afficher un message UX (voir section F).

### Comment stocker les paramètres calibrés

**Par vague** (table `GompertzVague` recommandée ci-dessus), pas par site ni dans
`ConfigElevage`. Raison : les paramètres sont une propriété intrinsèque du lot de poissons
de cette vague (génétique, aliment, conditions locales), pas une configuration réutilisable.

La comparaison aliment se fait en LISANT les paramètres K de plusieurs vagues distinctes
et en les aggrégeant par `produitId` d'aliment — pas en stockant des "paramètres aliment".

---

## E. Impact sur les composants existants

### E.1 `src/components/dashboard/projections.tsx`

Modification minimale, non-breaking. `ProjectionCard` et `CourbeProjectionChart` reçoivent
`projection: ProjectionVague`. Deux changements requis :

1. Étendre `CourbeCroissancePoint` avec un champ optionnel `poidsGompertz: number | null`
   dans `src/types/calculs.ts`. Les composants existants ignorent les champs inconnus.

2. Dans `CourbeProjectionChart`, ajouter une troisième `<Line>` conditionnelle :
   ```tsx
   {hasGompertzData && (
     <Line
       type="monotone"
       dataKey="poidsGompertz"
       name="poidsGompertz"
       stroke="var(--accent-amber)"
       strokeWidth={1.5}
       strokeDasharray="2 2"
       dot={false}
     />
   )}
   ```

3. Étendre le badge d'information sous le graphique pour afficher :
   `Modèle Gompertz — W∞ = {wInf}g — K = {k} — R² = {r2}`
   Conditionnel à `gompertzConfidence !== "INSUFFICIENT_DATA"`.

### E.2 `src/lib/calculs.ts`

La projection SGR existante dans `feeding.ts` (ligne 135) reste inchangée pour le calcul
de ration quotidienne : l'horizon est de 7 jours maximum, et la croissance exponentielle
simple est suffisante et plus stable à court terme.

Nouvelle fonction à ajouter dans `calculs.ts` :

```typescript
/**
 * Projette le poids via le modèle Gompertz.
 * Retourne null si les paramètres sont absents ou si le modèle produit une valeur négative.
 * À utiliser pour les projections > 14 jours.
 */
export function projeterPoidsGompertz(
  joursDepuisDebut: number,
  params: GompertzParams
): number | null
```

La coexistence SGR/Gompertz dans `ProjectionVague` doit être explicite :
- `dateRecolteEstimee` : calculée par SGR (compatibilité existante)
- `dateRecolteGompertz` : calculée par Gompertz si disponible (nouveau champ)
- L'UI affiche les deux avec un badge "Modèle" pour chacune

### E.3 `src/lib/activity-engine/feeding.ts`

Aucune modification requise dans un premier temps. Le calcul de ration journalière repose
sur le poids moyen actuel et le SGR à court terme — Gompertz n'améliore pas ce calcul.

À terme (v2), Gompertz peut améliorer la projection de masse d'aliment restante pour toute
la durée du cycle (champ `alimentRestantEstime` dans `ProjectionVague`). Actuellement ce
champ est calculé via SGR linéaire, qui surestime la ration en fin de cycle (là où Gompertz
prédit un ralentissement). Cet affinement est une amélioration non-prioritaire.

### E.4 `src/lib/benchmarks.ts`

Pas de modification directe. En revanche, ajouter dans `src/lib/benchmarks.ts` des
constantes de référence pour les paramètres Gompertz afin de qualifier les paramètres
calibrés :

```typescript
// Plages de référence FAO/CIRAD pour Clarias gariepinus en élevage intensif
export const GOMPERTZ_REF_CLARIAS = {
  wInfinity: { min: 600, optimal: 1000, max: 2000 },  // grammes
  k:         { min: 0.01, optimal: 0.03, max: 0.08 }, // 1/jour
  ti:        { min: 20,   optimal: 45,   max: 90 },   // jours
} as const;

export type GompertzKLevel = "EXCELLENT" | "BON" | "FAIBLE";

export function evaluerKGompertz(k: number): GompertzKLevel
```

---

## F. Risques et recommandations

### F.1 Performance — calcul LM côté client

**Risque : BLOQUANT si mal géré.**

L'algorithme LM est O(n × p²) par itération (n = points, p = 3 paramètres). Pour 20
biométries et 100 itérations, le calcul est rapide même sur Node.js (~5 ms). Le risque
n'est pas la performance brute mais la fréquence de recalibrage : si déclenché à chaque
rendu de page sans cache, le surcoût cumulé devient notable. La table `GompertzVague`
comme cache persistant résout ce problème.

**Recommandation :** Toujours lire depuis `GompertzVague` en premier, ne recalibrer que si
`biometrieCount` a changé depuis le dernier calibrage.

### F.2 Précision avec peu de données

**Risque : HAUTE, fréquent en début de cycle.**

En phase ACCLIMATATION ou CROISSANCE_DEBUT (jours 0–45), une vague peut n'avoir que 2–4
biométries. Avec moins de 5 points, LM ne peut pas distinguer les trois paramètres de
manière stable.

**Recommandation graduée :**

| Nombre de biométries | Comportement | Affichage UI |
|---------------------|--------------|-------------|
| 0–2 | Ne pas calibrer | "Pas assez de relevés (min. 5)" |
| 3–4 | Calibrer avec K et tᵢ fixés (W∞ seul libre) | Badge "Estimation préliminaire" |
| 5–9 | Calibrer les 3 paramètres, afficher R² | Badge "Modèle en construction" |
| 10+ | Calibrage complet, confiance haute si R² > 0.95 | Badge "Modèle fiable" |

Le guide devrait documenter cette graduation. Ignorer ce problème produit des paramètres
absurdes visibles par l'utilisateur (W∞ = 50000 g, K négatif).

### F.3 UX pour l'utilisateur non-technique

**Risque : MOYEN — risque d'incompréhension et perte de confiance.**

W∞, K et tᵢ sont des paramètres mathématiques sans signification intuitive pour un
pisciculteur camerounais. Exposer ces valeurs brutes dans l'UI est une erreur.

**Recommandation :** Traduire les paramètres en indicateurs métier :

| Paramètre technique | Affichage utilisateur |
|--------------------|----------------------|
| W∞ | "Poids plafond estimé : {W∞} g" |
| K  | "Vitesse de croissance : Rapide / Normale / Lente" (selon GOMPERTZ_REF_CLARIAS.k) |
| tᵢ | "Pic de croissance : vers le jour {tᵢ}" |
| R² | "Fiabilité du modèle : {R2*100}%" — visible uniquement si ingénieur ou admin |

N'afficher les valeurs numériques brutes de W∞, K, tᵢ que dans une section
"Détails techniques" collapsible, accessible aux rôles INGENIEUR et ADMIN.

### F.4 Divergence du modèle en fin de cycle

**Risque : MOYEN — projection dégradée.**

Pour une vague en PRE_RECOLTE, W(t) approche W∞ de façon asymptotique. La dérivée
dW/dt → 0. Dans ce contexte, Gompertz projette "jamais" comme date de récolte si W∞ est
légèrement inférieur au poids objectif.

**Recommandation :** Si `gompertzWeight(poidsObjectif) > 0.99 × W∞`, basculer sur la
projection SGR linéaire et afficher un avertissement. La robustesse de l'expérience
utilisateur prime sur la précision du modèle.

### F.5 Vagues multi-bacs

**Risque : MOYEN — cas courant dans l'application.**

FarmFlow supporte les vagues avec plusieurs bacs. Les biométries sont saisies au niveau
vague (poids moyen global) ou au niveau bac individuel.

**Recommandation v1 :** Calibrer Gompertz sur le poids moyen au niveau vague uniquement,
en ignorant la décomposition par bac. Documenter cette limitation.

**Recommandation v2 :** Si les biométries portent un `bacId`, calculer des paramètres
Gompertz distincts par bac dans `GompertzVague`. Stocker sous forme JSON dans un champ
`parBac Json?`. À planifier dans un sprint ultérieur.

### F.6 Bibliothèque LM recommandée

Après analyse des options disponibles dans l'écosystème npm/TypeScript :

**Recommandée : `ml-levenberg-marquardt` (package npm `levenberg-marquardt` de mljs)**
- TypeScript natif
- Supporte les bornes (contraintes box)
- Zéro dépendance native (pur JavaScript, fonctionne sur Node.js et browser)
- Maintenu activement (dernière version 2024)
- API simple : `LM(data, paramFunc, options)`

Alternative si non satisfaisante : implémenter LM from scratch (~80 lignes) en suivant
l'algorithme standard de Moré (1978), dont la convergence est documentée pour 3 paramètres.
Le code est court et totalement testable unitairement.

---

## G. Ordre d'implémentation — découpage en stories

### Prérequis non fonctionnel (avant tout)

Valider que `ml-levenberg-marquardt` ou l'implémentation maison converge correctement sur
les données biométriques DK Farm avant de commencer le développement UI.
**Effort estimé : 0.5 jour — @architect ou @developer (notebook de test).**

---

### Sprint G1 — Fondations Gompertz (prerequis : données biométriques suffisantes)

| ID | Story | Assigné | Effort | Dépendances |
|----|-------|---------|--------|-------------|
| G1-1 | Implémenter `src/lib/gompertz.ts` — fonctions pures (`gompertzWeight`, `calibrerGompertz`, `projeterDateRecolte`, `genererCourbeGompertz`) | @developer | 1 j | Aucune |
| G1-2 | Tests unitaires `gompertz.ts` : convergence sur jeux de données synthétiques, bornes, cas dégénérés | @tester | 0.5 j | G1-1 |
| G1-3 | Migration Prisma : table `GompertzVague` + relation sur `Vague` | @db-specialist | 0.5 j | Aucune |
| G1-4 | API route `GET /api/vagues/[id]/gompertz` (calibrage lazy + mise en cache DB) | @developer | 1 j | G1-1, G1-3 |
| G1-5 | Ajouter constantes de référence Gompertz dans `src/lib/benchmarks.ts` + `evaluerKGompertz` | @developer | 0.25 j | G1-1 |

**Total Sprint G1 : ~3.25 jours**

---

### Sprint G2 — Intégration UI et projections

| ID | Story | Assigné | Effort | Dépendances |
|----|-------|---------|--------|-------------|
| G2-1 | Étendre `CourbeCroissancePoint` et `ProjectionVague` avec champs Gompertz optionnels dans `src/types/calculs.ts` | @architect | 0.25 j | G1-1 |
| G2-2 | Étendre `CourbeProjectionChart` : troisième Line Gompertz conditionnelle + légende | @developer | 0.5 j | G2-1 |
| G2-3 | Étendre `ProjectionCard` : badge fiabilité + date récolte Gompertz vs SGR | @developer | 0.5 j | G2-1 |
| G2-4 | Connecter `projections.tsx` à la nouvelle API Gompertz (fetch côté serveur dans le Server Component parent) | @developer | 0.5 j | G1-4, G2-2 |
| G2-5 | Tests UI projections avec données Gompertz + cas "données insuffisantes" | @tester | 0.5 j | G2-4 |

**Total Sprint G2 : ~2.25 jours**

---

### Sprint G3 — Comparaison aliments via paramètre K (NICE-TO-HAVE)

| ID | Story | Assigné | Effort | Dépendances |
|----|-------|---------|--------|-------------|
| G3-1 | Agrégation du paramètre K par `produitId` : requête Prisma joignant `GompertzVague`, `Vague`, `ReleveConsommation`, `Produit` | @db-specialist | 1 j | G1-3 |
| G3-2 | Étendre `AnalytiqueAliment` avec `kMoyenGompertz: number | null` et `kNiveauGompertz: GompertzKLevel | null` | @architect | 0.25 j | G1-5 |
| G3-3 | Affichage dans la page analytics aliments : colonne "Vitesse de croissance Gompertz" + graphique K par aliment | @developer | 1 j | G3-1, G3-2 |
| G3-4 | Tests agrégation K + validation sur données seed DK Farm | @tester | 0.5 j | G3-1 |

**Total Sprint G3 : ~2.75 jours**

---

### Résumé des efforts

| Sprint | Description | Effort total |
|--------|-------------|-------------|
| Pré-requis | Validation LM sur données réelles | 0.5 j |
| G1 | Fondations (lib + DB + API) | 3.25 j |
| G2 | Intégration UI | 2.25 j |
| G3 | Comparaison aliments via K | 2.75 j |
| **Total** | | **~8.75 jours** |

Sprint G3 est conditionnel : ne démarrer que si les sites ont assez de vagues terminées
pour que la comparaison K par aliment soit statistiquement significative (minimum 3 vagues
complètes avec le même aliment sur un site).

---

## Synthèse des décisions architecturales

| Décision | Choix | Raison |
|----------|-------|--------|
| Placement du calibrage LM | Serveur uniquement | Performance mobile, accès DB |
| Stockage des paramètres | Table `GompertzVague` (1:1 avec Vague) | Séparation sémantique, comparaison inter-vagues |
| Coexistence SGR / Gompertz | SGR pour horizon < 14 j, Gompertz pour courbe complète | Complémentarité, non-remplacement |
| Affichage paramètres bruts | Réservé aux rôles INGENIEUR et ADMIN | UX non-technique |
| Minimum biométries | 5 points pour calibrage complet | Convergence LM stable |
| Bibliothèque LM | `ml-levenberg-marquardt` (mljs/levenberg-marquardt npm) | TypeScript, bornes, zéro dépendance native |
| Comparaison aliments | Agrégation K par produitId depuis GompertzVague | Lien indirect via vagues |

---

*Fichier produit par @architect le 2026-03-29. Aucune implémentation de code fonctionnel.*
*Les interfaces et fonctions décrites sont des contrats à implémenter par @developer et @db-specialist.*
