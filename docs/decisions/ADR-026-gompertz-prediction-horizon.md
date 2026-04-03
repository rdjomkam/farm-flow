# ADR-026 — Extension de la courbe Gompertz jusqu'à 120 jours

**Statut :** Accepté
**Date :** 2026-04-03
**Auteur :** @architect

## Contexte

La courbe Gompertz dans le graphique d'évolution du poids (`PoidsChart`) s'arrête
actuellement à la date de la dernière biométrie observée. Pourtant, le modèle
mathématique est déjà capable de projeter bien au-delà — `genererCourbeGompertz`
accepte un `joursMax` arbitraire. Le problème vient de la construction des données
dans le Server Component : `poidsData` est construit en itérant uniquement sur
`groupedByDate` (les dates d'observations réelles), et `poidsGompertz` est ensuite
résolu via un Map indexé sur ces mêmes jours. Les points de prédiction futurs ne
sont jamais injectés dans le tableau.

L'utilisateur veut voir la prédiction Gompertz jusqu'à J120 (ou la date de récolte
projetée), avec des points tous les 7 jours, représentés en pointillé.

## Décision

### Principe : séparation des séries de données

Le graphique Recharts doit recevoir **deux séries distinctes** dans le même tableau
de données :

1. `poidsMoyen` — données observées (biométrie réelle), présentes uniquement sur
   les points d'observation (null ailleurs).
2. `poidsGompertz` — courbe de prédiction Gompertz, présente sur tous les points
   de la fenêtre temporelle étendue.

Recharts gère nativement les valeurs null dans une série : avec `connectNulls={false}`
sur la ligne observée, les segments entre biométries sont tracés normalement ; avec
`connectNulls={true}` sur la ligne Gompertz, la courbe est continue. Ce comportement
est déjà partiellement exploité dans le code actuel (`connectNulls={true}` sur la
ligne Gompertz).

### Architecture de la solution

#### 1. Séparation des types de points dans `EvolutionPoidsPoint`

L'interface actuelle `EvolutionPoidsPoint` est suffisante. Il suffit d'utiliser
`poidsMoyen: number | null` au lieu de `number` pour distinguer les points futurs
(pas d'observation) des points passés. Modifier le type dans `src/types/calculs.ts` :

```typescript
export interface EvolutionPoidsPoint {
  date: string;           // ISO string
  poidsMoyen: number | null;  // null pour les points de prédiction pure
  jour: number;
  poidsGompertz?: number | null;
  isPrediction?: boolean; // true pour les points au-delà de la dernière biométrie
}
```

Le champ `isPrediction` est optionnel et sert uniquement à du styling différencié
côté chart si nécessaire (tooltip, label).

#### 2. Construction des données dans `vague-detail-page.tsx`

**Remplacement de la logique de construction de `poidsData`** (lignes 195-215) :

L'approche en deux passes :

**Passe 1** — Points d'observation (inchangés, comportement actuel).
Pour chaque date de biométrie dans `groupedByDate`, construire le point avec
`poidsMoyen` réel et `poidsGompertz` depuis `gompertzByJour`.

**Passe 2** — Points de prédiction future.
Si Gompertz est disponible, générer des points tous les 7 jours depuis
`(dernierJourObserve + 7)` jusqu'à `min(120, joursHorizon)`, en ajoutant
uniquement `poidsGompertz` (avec `poidsMoyen: null` et `isPrediction: true`).

La constante `HORIZON_JOURS = 120` et le pas `PAS_PREDICTION_JOURS = 7` doivent
être définis comme constantes nommées dans le Server Component.

La valeur de `joursHorizon` est calculée ainsi :
```
joursHorizon = max(120, dernierJourObserve + 30)
```
Ce qui garantit qu'une vague en phase avancée (J100+) voit quand même la
prédiction se prolonger au moins 30 jours.

**Important :** Les points de prédiction ne doivent être ajoutés que si Gompertz
est disponible (`hasGompertz === true`). Sans modèle calibré, le graphique reste
identique à aujourd'hui.

#### 3. Modification de `PoidsChart` (composant client)

Seuls deux ajustements sont nécessaires :

**a) `connectNulls` sur la ligne observée** : mettre `connectNulls={false}` (déjà
le comportement par défaut dans Recharts) pour que les gaps entre biométries
lointaines ne soient pas reliés artificiellement.

**b) Tooltip conditionnel** : dans le `ChartTooltip`, afficher "Prédiction
Gompertz" quand `poidsMoyen` est null (point futur). Cela peut être géré dans le
`labelFormatter` existant si le payload expose `isPrediction`.

**c) Label de la légende** : mettre à jour le texte de la note en bas du graphique
pour préciser "étendue à 120 jours" ou "jusqu'à J120".

Aucune nouvelle prop n'est nécessaire sur `PoidsChart` — les données arrivent déjà
via `data: EvolutionPoidsPoint[]`.

### Ce qu'il ne faut PAS faire

- Ne pas passer les paramètres Gompertz au composant client pour y re-générer
  la courbe — les calculs restent dans le Server Component (Server Components =
  calcul lourd côté serveur).
- Ne pas créer un deuxième tableau séparé pour les points de prédiction — Recharts
  fonctionne sur un tableau unique, et deux `<Line>` sur deux tableaux différents
  ne peuvent pas partager le même axe X sans configuration complexe.
- Ne pas générer les 120 points jour par jour (pas de 1) — seuls 7 points de
  prédiction sont nécessaires (7, 14, 21, ... 120 jours au-delà de la dernière
  biométrie), ce qui limite la taille du payload serialisé.

## Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/types/calculs.ts` | `poidsMoyen: number | null` + champ `isPrediction?: boolean` |
| `src/components/pages/vague-detail-page.tsx` | Logique de construction de `poidsData` (2 passes) |
| `src/components/vagues/poids-chart.tsx` | Légende + tooltip conditionnel |

## Précautions UX et performance

### Mobile first (360px)

Le graphique est actuellement fixé à `h-[220px]`. Avec une fenêtre à 120 jours,
l'axe X devient plus chargé. Recommandations :

- Limiter les ticks de l'axe X à 6 maximum via `tickCount={6}` sur le `<XAxis>`.
- Le formatter existant `J${v}` est bon, mais vérifier qu'il ne chevauche pas sur
  petits écrans (le margin `right: 12` actuel est suffisant).

### Lisibilité

La distinction visuelle entre courbe observée (trait plein) et courbe de prédiction
(pointillé) existe déjà via `strokeDasharray="4 3"` sur la ligne Gompertz. C'est
suffisant. Il n'est pas nécessaire d'ajouter une zone de fond différenciée
(ReferenceLine, ReferenceArea) pour marquer la frontière observation/prédiction —
cela alourdirait l'interface sur mobile.

### Performance

La passe 2 génère au maximum `ceil(120/7) = 18` points supplémentaires. Impact
négligeable. Le payload serialisé de la page augmente d'environ 500 octets. Aucune
optimisation supplémentaire n'est nécessaire.

### Vagues terminées

Pour une vague terminée (`statut === TERMINEE`), la prédiction au-delà de la
dernière biométrie a moins d'utilité. La logique reste la même (le modèle est
calibré, les points sont générés). Un futur ADR pourrait décider de supprimer les
points de prédiction pour les vagues terminées si les utilisateurs trouvent cela
confus.

## Alternatives rejetées

### Alternative A — Passer `gompertzParams` au composant client pour générer la courbe côté browser

Rejeté. Cela déplace le calcul vers le client, cassant le principe Server
Components. De plus, `gompertzParams` est déjà passé au composant pour le
`GompertzInfoPanel`, mais il ne devrait pas être utilisé pour générer des courbes —
c'est le rôle du Server Component.

### Alternative B — Créer une API route `/api/vagues/[id]/gompertz/prediction`

Rejeté. Overhead injustifié pour un calcul pur qui peut être fait server-side lors
du rendu de la page. Cela ajouterait une requête client et un état de chargement
inutiles.

### Alternative C — Afficher un graphique séparé pour la prédiction

Rejeté. L'utilisateur veut une continuité visuelle entre observations et prédictions
dans le même graphique.

## Résumé

La modification est **mineure et localisée** : deux passes dans le Server Component
pour construire `poidsData`, un ajustement de type, et des retouches cosmétiques
dans le composant chart. La logique de calcul existante (`genererCourbeGompertz`,
`gompertzByJour`) est déjà correcte et n'a pas besoin d'être modifiée.
