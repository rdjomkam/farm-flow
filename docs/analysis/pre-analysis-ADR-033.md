# Pré-analyse ADR-033 — FCR vague-level calculation — 2026-04-05

## Statut : GO AVEC RÉSERVES

## Résumé

L'implémentation d'ADR-033 porte sur 5 fichiers et supprime 25 divergences documentées entre
l'algorithme FCR vague-level confirmé et le code actuel. Le build passe, les 79 tests existants
passent, mais la totalité de ces tests couvre l'API _per-bac_ qui sera remplacée — ils doivent
être réécrits. Aucune erreur connue de ERRORS-AND-FIXES.md n'est réintroduite par ce travail.

---

## Vérifications effectuées

### Schema ↔ Types : OK
Aucune modification du schéma Prisma requise par ADR-033. Les types impactés sont dans
`src/types/calculs.ts` uniquement (interfaces TypeScript pures, pas de modèles Prisma).

### API ↔ Queries : PROBLÈMES CONFIRMÉS (attendus — à corriger)
Toutes les divergences documentées dans ADR-033-discrepancies.md sont présentes exactement
aux lignes indiquées. Détails ligne par ligne ci-dessous.

### Navigation ↔ Permissions : OK
ADR-033 ne touche pas à la navigation ni aux permissions.

### Build : OK
`npm run build` réussit sans erreur de compilation. Un warning non bloquant :
```
Warning: Next.js inferred your workspace root, but it may not be correct.
```
Ce warning est antérieur à ADR-033 et sans rapport.

### Tests : 79/79 passent — RÉSERVE
`npx vitest run src/__tests__/lib/feed-periods.test.ts` : 79 tests, tous verts.
Ces 79 tests couvrent `interpolerPoidsBac`, `segmenterPeriodesAlimentaires` et
`estimerNombreVivantsADate` — les trois fonctions qui seront _remplacées_ par ADR-033.
Une fois l'implémentation faite, ces tests seront invalides et devront être réécrits pour
couvrir `interpolerPoidsVague`, `segmenterPeriodesAlimentairesVague`, et
`estimerNombreVivantsVague`.

---

## Incohérences trouvées — Vérification des 25 divergences

### `src/lib/feed-periods.ts`

**DISC-01 / DISC-02** (lignes 133–143) — CONFIRMÉ
`interpolerPoidsBac` filtre par `bacId` au lieu d'utiliser la vague entière.
Si `bacBios.length === 0`, retour immédiat `VALEUR_INITIALE` sans évaluer Gompertz.

**DISC-03** (lignes 393–399) — CONFIRMÉ
`segmenterPeriodesAlimentaires` groupe par `bacId` (clé = `r.bacId`).
La structure `for (const [bacId, bacReleves] of bacGroups)` crée des périodes par bac.

**DISC-04** (lignes 407–410, 460–473) — CONFIRMÉ
`bacBios` filtrées per-bac avant d'appeler `interpolerPoidsBac` avec `bacId` filtrant.

**DISC-05** (lignes 281–336) — CONFIRMÉ
`estimerNombreVivantsADate(bacId, ...)` cherche le groupe de calibrage par `destinationBacId === bacId`
et retourne la population du bac, pas la population totale de la vague.

**DISC-06** (lignes 496–501) — CONFIRMÉ
`estimerNombreVivantsADate(bacId, dateDebut, vagueContext, options?.mortalitesParBac)` transmis
dans la construction de la période avec `bacId` — retourne le nombreVivants du bac.

**DISC-07** (lignes 239–250) — CONFIRMÉ
Branche `if (before && !after)` retourne `before.poidsMoyen` (valeur plate) au lieu d'évaluer
Gompertz avant de tomber sur cette valeur. L'ordre des priorités n'est pas respecté.

### `src/lib/queries/analytics.ts`

**DISC-08** (lignes 725–735) — CONFIRMÉ
`computeAlimentMetrics` appelle `segmenterPeriodesAlimentaires` avec `mortalitesParBac`.

**DISC-09** (lignes 702–712) — CONFIRMÉ
Construction de `mortalitesParBac` (Map per-bac) aux lignes 702–712 de `computeAlimentMetrics`.

**DISC-10** (lignes 689–700) — CONFIRMÉ
`gompertzContext` n'est construit que si `interpolStrategy === GOMPERTZ_VAGUE` (ligne 690).
Si le site utilise la stratégie par défaut `LINEAIRE`, Gompertz est `undefined` même si le
modèle est parfaitement calibré.

**DISC-11** (lignes 2629–2637) — CONFIRMÉ
Identique à DISC-09 dans `getFCRTrace` : construction de `mortalitesParBac` Map per-bac.

**DISC-12** (lignes 2668–2673) — CONFIRMÉ
`getFCRTrace` appelle `segmenterPeriodesAlimentaires` (per-bac) avec `interpolOptions` contenant
`mortalitesParBac`.

**DISC-13** (lignes 2687–2699) — CONFIRMÉ
`getFCRTrace` appelle `interpolerPoidsBac(periode.dateDebut, resolvedBacId, biometriePoints, ...)`.
`biometriePoints` contient toutes les biométries mais elles seront filtrées en interne par `bacId`.

**DISC-14** (lignes 2752–2754) — CONFIRMÉ
`FCRTracePeriode` construit avec `bacId: periode.bacId` et
`bacNom: bacNomMap.get(periode.bacId) ?? ...`.

**DISC-15** (lignes 2616–2627) — CONFIRMÉ
Identique à DISC-10 dans `getFCRTrace` : `gompertzContext` conditionnel à `interpolStrategy === GOMPERTZ_VAGUE`.

**DISC-16** (lignes 830–832) — CONFIRMÉ
`fcrMoyen = calculerFCRParAliment(vagueMetrics.map((v) => ({ quantite: v.quantite, gainBiomasse: v.gainBiomasse })))`.
`v.quantite` est la consommation totale vague, `v.gainBiomasse` est la somme des gains positifs
des périodes — combinaison incohérente (numérateur inclut aliment de périodes à gain négatif).

### `src/types/calculs.ts`

**DISC-17** (ligne 645) — CONFIRMÉ
`PeriodeAlimentaire.bacId: string` présent.

**DISC-18** (lignes 842–845) — CONFIRMÉ
`FCRTracePeriode.bacId: string` (ligne 843) et `FCRTracePeriode.bacNom: string` (ligne 845) présents.

**DISC-19** (ligne 941) — CONFIRMÉ
`FCRTraceVague.modeLegacy: boolean` présent.

**DISC-20** — CONFIRMÉ
`PeriodeAlimentaireVague` absente de `src/types/calculs.ts`. Seule `PeriodeAlimentaire` (per-bac)
est définie.

### `src/components/analytics/fcr-transparency-dialog.tsx`

**DISC-21** (ligne 159) — CONFIRMÉ
```
const title = `${t("bac")} ${periode.bacNom}  ${formatDate(periode.dateDebut)} → ...`;
```

**DISC-22** (ligne 280) — CONFIRMÉ
```
{vague.periodes.length} {t("periodesDuBac")}
```

**DISC-23** (lignes 308–310) — CONFIRMÉ
```
{vague.modeLegacy && (
  <p className="text-[10px] text-amber-600 font-medium mb-2">{t("modeLegacy")}</p>
)}
```

**DISC-24** — CONFIRMÉ
Aucun composant `GompertzParamsBlock` dans le dialog. Le champ `gompertzVague` de `FCRTraceVague`
est présent dans le type mais jamais rendu dans l'interface.

**DISC-25** (ligne 319) — CONFIRMÉ
```
key={`${periode.bacId}-${periode.dateDebut}-${idx}`}
```

### Observation additionnelle — Fichiers de messages i18n

Les clés de traduction `modeLegacy` et `periodesDuBac` sont présentes dans
`src/messages/fr/analytics.json` et `src/messages/en/analytics.json`. Elles devront être
mises à jour ou supprimées par ADR-033 :
- `periodesDuBac` : la clé existe déjà avec valeur "periods" / "périodes" — elle peut rester
  si la clé est renommée en `periodes` dans le composant.
- `modeLegacy` : à supprimer des fichiers JSON après suppression du bloc dans le composant.
- Nouvelle clé à ajouter : `periodeN` ou équivalent pour le titre numéroté des périodes.

### Observation additionnelle — `src/types/index.ts`

`PeriodeAlimentaire` est re-exportée depuis `src/types/index.ts`. La nouvelle
`PeriodeAlimentaireVague` devra également y être exportée. Vérifier que l'ancienne
`PeriodeAlimentaire` est retirée des exports si elle est supprimée.

---

## Risques identifiés

1. **Suppression de `PeriodeAlimentaire.bacId` casse le contrat de l'API** — L'interface
   `PeriodeAlimentaire` est exportée depuis `src/types/index.ts` et utilisée dans les tests
   existants. Sa modification (ou son remplacement par `PeriodeAlimentaireVague`) provoquera
   des erreurs TypeScript dans les 79 tests actuels. Ces erreurs sont attendues et les tests
   devront être réécrits.

2. **`calculerFCRParAliment` dans `src/lib/calculs.ts` reste inchangée** — ADR-033 corrige
   l'agrégation au niveau de l'appelant (`computeAlimentMetrics`) mais ne modifie pas
   `calculerFCRParAliment`. Si d'autres appelants utilisent cette fonction, ils héritent du
   problème DISC-16. A vérifier que la correction de DISC-16 est bien faite directement dans
   `computeAlimentMetrics` et que `calculerFCRParAliment` n'est plus appelée dans ce contexte.

3. **`getFCRTrace` recalcule les estimations de poids à partir de `biometriePoints` non filtrés**
   (DISC-13) mais `segmenterPeriodesAlimentaires` les a déjà calculées en interne. La trace
   recalcule deux fois les mêmes valeurs, ce qui crée une duplication. Après ADR-033, vérifier
   que `getFCRTrace` ne recalcule pas les estimations indépendamment si `segmenterPeriodesAlimentairesVague`
   les retourne déjà avec les détails nécessaires.

4. **Compatibilité ascendante des données legacy** — Les relevés sans `bacId` (legacy)
   étaient regroupés sous `bacId = null` → `"unknown"` dans l'ancien code. Dans la nouvelle
   implémentation vague-level, le `bacId` n'existe plus sur `PeriodeAlimentaireVague`. Les
   données legacy sont gérées naturellement par l'algorithme vague-level (tous relevés
   confondus). La logique `modeLegacy` disparaît — s'assurer qu'aucun consommateur externe
   ne dépend de `FCRTraceVague.modeLegacy`.

---

## Prérequis manquants

Aucun prérequis technique bloquant. ADR-033 est un refactor interne sans nouveau modèle
Prisma, sans migration, sans nouvelle API route.

---

## Ordre d'implémentation recommandé (confirmé)

L'ordre de l'ADR-033-discrepancies.md §6 est correct et doit être respecté :

1. `src/types/calculs.ts` — Ajouter `PeriodeAlimentaireVague`, modifier `FCRTracePeriode`
   (retirer `bacId`, `bacNom`), modifier `FCRTraceVague` (retirer `modeLegacy`) [DISC-17–20]
2. `src/types/index.ts` — Exporter `PeriodeAlimentaireVague`
3. `src/lib/feed-periods.ts` — Ajouter `interpolerPoidsVague`, `estimerNombreVivantsVague`,
   `segmenterPeriodesAlimentairesVague` [DISC-01–07]
4. `src/lib/queries/analytics.ts` — Mettre à jour `computeAlimentMetrics` et `getFCRTrace`
   [DISC-08–16]
5. `src/components/analytics/fcr-transparency-dialog.tsx` — Restructurer [DISC-21–25]
6. `src/messages/fr/analytics.json` + `src/messages/en/analytics.json` — Supprimer
   `modeLegacy`, vérifier `periodesDuBac`
7. `src/__tests__/lib/feed-periods.test.ts` — Réécrire les tests per-bac en vague-level

---

## Vérification ERRORS-AND-FIXES.md

- **ERR-049** (suppression valeur d'enum avec CAST) : non concerné — ADR-033 ne touche pas les enums Prisma.
- **ERR-038** (drift de schéma dans migrate diff) : non concerné — aucune migration requise.
- **ERR-001** (ADD VALUE + UPDATE dans même migration) : non concerné.
- Aucune erreur connue n'est réintroduite.

---

## Recommandation

GO — L'implémentation peut démarrer immédiatement. Les 25 divergences sont toutes confirmées
aux lignes exactes documentées dans ADR-033-discrepancies.md. Le build est vert, les fichiers
cibles sont identifiés. Respecter l'ordre d'implémentation ci-dessus pour éviter les erreurs
TypeScript en cascade.

Réserve unique : les 79 tests existants dans `feed-periods.test.ts` couvrent uniquement l'API
per-bac et seront invalides après l'implémentation. Le @tester doit les réécrire pour couvrir
les nouvelles fonctions vague-level avant de déclarer la story terminée (R9).
