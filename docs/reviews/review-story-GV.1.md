# Review Story GV.1+GV.2 — computeVivantsByBac discrimination TRANSFERT par relevé

## Verdict initial : **CHANGES_REQUESTED**

## Findings

### 🔴 Majeur — `src/lib/queries/analytics.ts` non migré (4 sites)

Le champ `transfertGroupeId: true` a bien été ajouté aux `select` Prisma (L.563, 1348, 1569, 1574, 1907) mais les 4 appels à `computeNombreVivantsVague` restent sur l'ancienne signature 3-arg (Map jamais construite, fallback = tous les TRANSFERT traités comme sortants) :

- **L.608** dans `computeAlimentMetrics` (utilisée par `getComparaisonAliments` et `getDetailAliment`)
- **L.1405** dans `getComparaisonVagues`
- **L.1588** dans `getAlertesRation`
- **L.1960** dans `getFCRHebdomadaire`

**Impact** : Analytics (comparaison aliments/vagues, alertes ration, FCR hebdomadaire) sous-comptent silencieusement les vivants pour tout bac dest de transfert post-comptage → biomasse, FCR, coûts/kg, ADG/PER, SGR faux.

**Action requise** : ajouter `getTransfertGroupesByVagues` batché (comme dans `dashboard.ts`) et passer `{ transfertGroupesById }` à chaque appel.

### 🟡 Nit — Doc obsolète

`src/lib/queries/transferts.ts:595` — commentaire fait encore référence à `transfertDestBacIds`.

## Points positifs (validés)

- `computeVivantsByBac` : discrimination correcte (entrant/sortant/fallback)
- 3 wrappers OK (`computeNombreVivantsVague`, `calculerDensiteBac`, `calculerDensiteVague`)
- `getTransfertGroupesByVague(s)` retourne un `Map<tgId, {bacSourceId, bacDestId}>` + filtre `siteId`
- 10/11 callers query + toutes les pages/API/activity-engine migrés
- Test régression `GV.3 — discrimination PAR RELEVÉ` présent (`src/__tests__/calculs-transfert-entrant.test.ts:372-434`)
- Aucun résidu de `getTransfertDestBacIds`/`transfertDestBacIds` dans le code source

## R1-R9

- R1 : OK
- R2 : OK (pattern strings dans `calculs.ts` = pré-existant, module DB-agnostic)
- R3 : OK — select alignés
- R4 : OK — `getTransfertGroupesByVague` accepte `tx` optionnel
- R7 : OK — `transfertGroupeId: string | null` obligatoire dans le type
- R8 : OK — filtre `transfert: { siteId }`
- R9 : à confirmer par tester après fix analytics.ts

## Prochaines étapes

1. Migrer les 4 sites de `analytics.ts` (pattern batché de `dashboard.ts`)
2. Nit cosmétique optionnel `transferts.ts:595`
3. Re-run `npx vitest run` + `npm run build` après le fix

## Re-review : TBD après fix analytics.ts
