# Pré-analyse Bugfix — ICA Vague-level (analytics.ts) — 2026-04-06

## Statut : GO AVEC RÉSERVES

## Résumé
Trois bugs ont été diagnostiqués et confirmés dans `src/lib/queries/analytics.ts`.
BUG 1 et BUG 2 font partie du même pattern : `quantiteAliment` est null pour les relevés
alimentés via le module stock (dual-write désactivé ou explicitement null), et aucun fallback
vers `ReleveConsommation` n'est appliqué dans ces fonctions. BUG 3 est un bug de logique : le
gain de biomasse mensuel est calculé comme le gain total de vie de la vague, non le gain
intra-mois. Le build est OK. Il existe 81 tests en échec dans la baseline actuelle, sans rapport
avec ces bugs.

---

## Vérifications effectuées

### Schema ↔ Types : OK
- `ReleveConsommation.quantite` : Float, non null, confirmé dans le schéma.
- `Releve.quantiteAliment` : Float?, nullable, confirmé — dual-write possible mais pas obligatoire.
- La relation `Releve.consommations` (ReleveConsommation[]) est bien présente.

### API ↔ Queries : OK pour le périmètre audité
- `createReleve` dans `src/lib/queries/releves.ts` (lignes 219-221) : `quantiteAliment` est
  persisté si présent dans le DTO. Les `consommations` sont créées séparément via
  `ReleveConsommation`. Il n'y a PAS de dual-write forcé : un relevé stock-linked peut avoir
  `quantiteAliment = null` et uniquement des `ReleveConsommation`.

### Build : OK
- `npm run build` : aucune erreur de compilation TypeScript ni de Next.js.
- Warning workspace root inoffensif (configuration Next.js).

### Tests : 4296/4377 passent — 81 ÉCHECS (baseline pre-bugfix)
- Les 81 échecs sont dans des fichiers non liés à ces bugs :
  - `permissions.test.ts` (count de permissions Sprint 30)
  - `abonnements-statut-middleware.test.ts` (logique isBlocked null)
  - `bacs.test.ts` (quotas abonnement)
  - `vagues-distribution.test.ts` (bacDistribution BUG-033)
  - `plan-form-dialog.test.tsx` (composant UI)
- Ces échecs PRÉEXISTENT au bugfix ciblé. Ils ne bloquent pas le développement.

---

## Incohérences confirmées

### BUG 1 — `getComparaisonVagues` : FCR zootechnique ignore ReleveConsommation
**Fichier :** `src/lib/queries/analytics.ts`, ligne 1332
**Code :**
```typescript
const totalAliment = alimentations.reduce((s, r) => s + (r.quantiteAliment ?? 0), 0);
```
**Cause racine :** Pour les relevés liés au stock, `quantiteAliment` est null. La quantité
réelle est dans `r.consommations[*].quantite`. La query (lignes 1282-1287) sélectionne bien
`consommations` avec `quantite` et `produit.prixUnitaire` — mais uniquement pour le calcul
financier (lignes 1350-1354). Le calcul FCR à la ligne 1341 utilise `totalAliment = 0`.
**Impact :** `fcrGlobal = null` pour toute vague utilisant le module stock. Comparaison vagues
tronquée.
**Fix suggéré :** Remplacer la ligne 1332 par un calcul hybride qui additionne
`r.quantiteAliment ?? SUM(r.consommations[*].quantite)`. La somme des consommations est déjà
calculée pour le coût financier — réutiliser cette logique ou extraire une fonction utilitaire
`computeTotalAlimentReleve(r)`.

### BUG 2 — `getAnalyticsDashboard` `tendanceFCR` : même pattern quantiteAliment
**Fichier :** `src/lib/queries/analytics.ts`, ligne 1190
**Code :**
```typescript
const totalAliment = alimentations.reduce((s, r) => s + (r.quantiteAliment ?? 0), 0);
```
**Cause racine identique à BUG 1**, mais la query (lignes 1155-1173) ne sélectionne PAS
`consommations` — champ absent du `select`. Le fallback est donc impossible sans modifier la
query.
**Impact :** FCR mensuel = null pour tous les mois où les relevés sont stock-linked.
**Fix suggéré :** Ajouter `consommations: { select: { quantite: true } }` dans le `select` de
`relevesRecents` (ligne 1162), puis appliquer le calcul hybride à la ligne 1190.

### BUG 3 — `tendanceFCR` : gain biomasse = gain vie totale, non gain mensuel
**Fichier :** `src/lib/queries/analytics.ts`, lignes 1203-1208
**Code :**
```typescript
const biomasseFin = calculerBiomasse(poidsMoyenFin, vagueRef.nombreInitial);
const biomasseDebut = calculerBiomasse(vagueRef.poidsMoyenInitial, vagueRef.nombreInitial);
```
**Cause racine :** `vagueRef.poidsMoyenInitial` est le poids au démarrage de la vague
(poids J0), pas le poids au début du mois courant. `vagueRef.nombreInitial` est le nombre
initial de la vague, pas le nombre de vivants du mois. Résultat : `gainBiomasse` est le gain
cumulé depuis le démarrage, donc le même pour chaque mois — le FCR mensuel devient
totalAlimentMois / gainVieTotal, sans signification métier.
**Impact :** FCR mensuel affiché faussé. Si plusieurs mois existent, les valeurs ne sont pas
comparables entre elles.
**Fix suggéré (recommandation architecte) :** Ne produire un point FCR mensuel que si le mois
contient au moins 2 biométries. Utiliser la première et la dernière biométrie du mois pour
calculer le gain intra-mois :
```
biomasseFin = calculerBiomasse(dernierebioDuMois.poidsMoyen, nombreVivantsEstime)
biomasseDebut = calculerBiomasse(premiereBioDuMois.poidsMoyen, nombreVivantsEstime)
```
Où `nombreVivantsEstime` est calculé via `computeNombreVivantsVague` pour les relevés du mois.
Si le mois n'a qu'une biométrie (ou zéro), ne pas émettre de point FCR pour ce mois.

---

## Autres occurrences du pattern quantiteAliment (périmètre élargi)

Les fonctions suivantes utilisent le même pattern `reduce(quantiteAliment ?? 0)` et sont
potentiellement affectées par le même problème pour les relevés stock-linked, mais avec des
contextes différents :

| Fichier | Ligne | Fonction | Contexte | Sévérité |
|---------|-------|----------|----------|----------|
| `src/lib/queries/analytics.ts` | 88 | `computeIndicateursBac` | FCR par bac | Haute |
| `src/lib/queries/indicateurs.ts` | 54 | `getIndicateursVague` | Page vague (FCR global) | Haute |
| `src/lib/queries/dashboard.ts` | 179 | `getDashboardProjections` | Projection aliment restant | Moyenne |
| `src/lib/queries/dashboard.ts` | 409 | `getDashboardIndicateurs` | Benchmark FCR dashboard | Haute |
| `src/lib/activity-engine/engineer-alerts.ts` | 227 | `detectFCRAlerte` | Alerte FCR élevé | Moyenne |

Note importante : pour le périmètre de CE bugfix (bugs 1, 2, 3), seules les lignes 1190 et
1332 d'`analytics.ts` sont dans le scope. Les autres occurrences constituent des bugs
satellites qui devront être couverts dans un sprint dédié ou des BUG reports séparés.

---

## Risques de régression

1. **Modification query tendanceFCR (BUG 2)** : ajouter `consommations` dans le select d'une
   query qui charge potentiellement des centaines de relevés sur 3 mois peut impacter les
   performances. Risque faible si les ReleveConsommation sont peu nombreuses par relevé.
   Mitigation : la query est déjà filtrée par `siteId` et `date >= troisMoisAvant`.

2. **Logique hybride quantiteAliment vs consommations (BUG 1+2)** : si un relevé a BOTH
   `quantiteAliment != null` ET des `consommations` (double-saisie), le nouveau calcul ne doit
   pas les additionner. Il faut une règle de priorité claire.
   Recommandation : utiliser `quantiteAliment` en priorité si non null, sinon `SUM(consommations)`.
   Vérifier avec `createReleve` : les deux peuvent coexister dans le dual-write pattern.

3. **Fix BUG 3 — guard biométrie** : si la condition "2 biométries dans le mois" est trop
   stricte, tous les mois de démarrage de vague (souvent une seule biométrie initiale)
   n'auront pas de point FCR. C'est le comportement correct selon l'architecte, mais cela
   peut produire un graphe vide pour les nouvelles vagues. Mitigation : documenter dans l'UI.

4. **Tests en échec préexistants** : 81 tests échouent avant le bugfix. Le développeur devra
   vérifier que le nombre de tests en échec n'augmente pas après ses modifications. Les 81
   échecs actuels ne concernent pas analytics.ts.

---

## Prérequis manquants

Aucun prérequis bloquant. Les fonctions utilitaires nécessaires existent :
- `calculerBiomasse`, `calculerFCR`, `computeNombreVivantsVague` sont dans `src/lib/calculs.ts`
- `getPrixParUniteBase` est déjà importée dans `analytics.ts` (utilisée ligne 1352)
- La relation `consommations` est déjà sélectionnée dans `getComparaisonVagues` (ligne 1282)

---

## Fichiers impactés par ce bugfix

- `src/lib/queries/analytics.ts` : modifications aux lignes ~1162-1174 (ajout consommations
  dans select), ~1190 (calcul hybride), ~1196-1214 (guard biométrie + gain intra-mois),
  et ~1332 (calcul hybride)

---

## Recommandation

GO — les trois bugs sont clairement localisés dans `src/lib/queries/analytics.ts`. Le build
est OK. Les 81 tests en échec sont préexistants et sans rapport.

Le développeur doit :
1. Extraire une fonction utilitaire `sumAlimentReleve(r)` qui retourne
   `r.quantiteAliment ?? r.consommations.reduce((s,c) => s + c.quantite, 0)` pour éviter la
   duplication entre BUG 1 et BUG 2.
2. Ajouter `consommations: { select: { quantite: true } }` dans la query `tendanceFCR`
   avant de pouvoir utiliser le fallback (BUG 2).
3. Pour BUG 3 : implementer le guard "au moins 2 biométries dans le mois" et calculer le
   gain avec les poids de la première et dernière biométrie du mois, pas depuis J0.
4. Ne PAS modifier les autres occurrences hors scope (indicateurs.ts, dashboard.ts,
   engineer-alerts.ts) — créer des BUG reports séparés.
5. Vérifier que le nombre de tests en échec n'augmente pas (baseline : 81 échecs).
