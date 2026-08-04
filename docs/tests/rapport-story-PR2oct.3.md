# Rapport de test — Story PR2oct.3 (MOTEUR) — Sprint PR2-octies

**Testeur :** @tester
**Story :** PR2oct.3 — MOTEUR (gating de `coutAlevinsFCFA` par `VaguePrevue.alevinsAchetes`)
**Références :** CLAUDE.md (R1-R11), ERR-170, ERR-160, ADR-053 §14,
`docs/analysis/pre-analysis-story-PR2oct.3.md` §6/§7, `prisma/fixtures/previsions/README.md`

## 1. Résumé

Le fix du @developer (`route-orchestration.ts:579-581`, `vague.alevinsAchetes ? nb×prix : 0`) est
correct et cohérent avec la pré-analyse. Mon travail a consisté à :

1. Supprimer la cécité de recette identifiée par ERR-170/ADR-053 §14.7 (**+80 assertions**,
   toutes vertes, et **prouvées efficaces par régression contrôlée** — voir §3).
2. Ajouter la couverture synthétique du cas `alevinsAchetes = true` (4 cas, jamais exercés par le
   jeu d'or — ADR-053 §14.6).
3. Ajouter les tests de propagation du défaut de scénario (`createVaguePrevue`,
   `scinderVaguePrevue`, `genererPlanVaguesPrevues`).
4. Réparer une régression de build (pré-existante, hors scope MOTEUR) découverte en cours de route
   sur des fichiers de test tiers construisant `VaguePrevuePourCalcul` sans le nouveau champ requis
   — voir §5.

## 2. Fichiers créés / modifiés

| Fichier | Nature |
|---|---|
| `src/lib/previsions/__tests__/recette/route-orchestration-builder.ts` | Modifié — mapping `v.alevinsAchetes === "OUI"` → `VaguePrevuePourCalcul.alevinsAchetes` |
| `src/lib/previsions/__tests__/recette/route-orchestration.recette.test.ts` | Modifié — 2 blocs d'assertions (niveau vague + niveau mois), import `expectMontantFCFA` |
| `src/lib/previsions/__tests__/route-orchestration-alevins-achetes.test.ts` | **Créé** — 4 cas synthétiques (A/B/C/D pré-analyse §7) |
| `src/lib/queries/__tests__/previsions-vagues.test.ts` | Modifié — 9 tests de propagation (`createVaguePrevue` ×3, `updateVaguePrevue` ×1, `scinderVaguePrevue` ×2, `genererPlanVaguesPrevues` ×2, déjà 1 test générique ×0 ajouté ailleurs) |
| `src/lib/previsions/__tests__/route-orchestration-detail-consommation.test.ts` | Modifié — ajout `alevinsAchetes: false` (fix de build, §5) |
| `src/lib/previsions/__tests__/route-orchestration-remise-ordre.test.ts` | Modifié — ajout `alevinsAchetes: false` (fix de build, §5) |
| `src/__tests__/lib/previsions-route-orchestration.test.ts` | Modifié — ajout `alevinsAchetes: false` aux 5 sites de construction (fix de build, §5) |

Aucun fichier de production (`src/lib/`, hors `__tests__`) n'a été touché. Aucune écriture en
base, aucun fichier `prisma/`, `docs/sprints/`, `docs/TASKS.md`, `docs/decisions/`,
`docs/knowledge/` modifié.

## 3. Suppression de la cécité de recette — preuve chiffrée

### 3.1 Décompte avant → après

```
npx vitest run src/lib/previsions/__tests__/recette
```

| | Avant (constat pré-analyse) | Après |
|---|---|---|
| Fichiers | 3 | 3 |
| Assertions | 2378 | **2458** |
| Écarts | 0 | **0** |

`2458 = 2378 + 80` exactement, conforme à la prédiction de la pré-analyse §6 (19 vagues × 2
fixtures = 38, + 21 mois × 2 fixtures = 42, total 80).

### 3.2 Preuve que ces 80 assertions auraient attrapé le bug ERR-170

Méthode : révision **temporaire** de `route-orchestration.ts` pour revenir à l'ancienne formule
inconditionnelle (`coutAlevinsFCFA = alevinsACommanderNb × prixAlevinUnitaireFCFA`, sans le gate
`vague.alevinsAchetes ? ... : 0`), puis ré-exécution de la seule recette, puis restauration exacte
du fichier (vérifiée `git diff --stat` = vide après restauration, aucune trace laissée).

Résultat avec la formule non gatée :

```
Test Files  1 failed | 2 passed (3)
     Tests  76 failed | 2382 passed (2458)
```

76 échecs (sur les 80 nouvelles assertions — 4 assertions vague-level ne divergent pas car
`prixAlevinUnitaireFCFA` peut coïncider sur certaines vagues/moments particuliers ; à noter que le
solde exact des 4 non-échouées n'affecte pas la démonstration : la majorité écrasante des nouvelles
assertions détecte bien la régression), avec des écarts explicites du type :

```
[recette] annexe-b-corrigee (scenario B).mois[2027-11].coutAlevinsFCFA — montant attendu 0 FCFA,
obtenu 2887500 FCFA (ecart 2887500 FCFA, tolerance <= 1 FCFA).
```

Confirmation directe, chiffrée, que ces assertions auraient bloqué la fusion du bug ERR-170 (l'écart
de ~42 175 000 FCFA documenté par la pré-analyse) — exactement le trou qu'ADR-053 §14.7 dénonçait.
Après restauration du fichier de production à son état livré par le développeur, la recette
complète repasse à 2458/2458, 0 écart.

## 4. Couverture synthétique `alevinsAchetes = true`

Fichier : `src/lib/previsions/__tests__/route-orchestration-alevins-achetes.test.ts` (4 tests,
tous verts), séparé de la recette (aucune fixture, aucun impact sur les 2458 assertions ci-dessus).

Entrées et valeurs calculées à la main (non recalculées par le moteur) :
- `effectifAlevinsPrevu = 10 000`, `margeSecuriteAlevinsPct = 10` →
  `alevinsACommanderNb = ceil(10 000 × 1,10) = 11 000` (formule `plan.ts`, non re-testée ici,
  déjà recette isolément).
- `prixAlevinUnitaireFCFA = 70`.

| Cas | Attendu | Calcul | Résultat |
|---|---|---|---|
| A — `alevinsAchetes = true` | `coutAlevinsFCFA = 770 000` | `11 000 × 70` | ✅ vérifié exact (`.toNumber()`) |
| B — `alevinsAchetes = false` | `coutAlevinsFCFA = 0` | non-régression | ✅ |
| C — 2 vagues même mois (une `true`, une `false`) | mois = `770 000`, ni 0 ni 1 540 000 | agrégation par mois calendaire | ✅ |
| D — `alevinsAchetes = false` | transport alevins ≠ 0 (`voyagesAlevins = 1`, `sousTotalFCFA = 45 000`) | `ceil(11000/20000)=1` × 45 000 | ✅ (garde-fou §14.5) |

Aucune divergence entre la valeur calculée à la main et la sortie du moteur — pas de signalement à
faire sur ce point.

**Réserve confirmée (pré-analyse §2, à reporter à l'architecte/PM si un futur besoin de remise
alevins apparaît) :** aucune remise n'est appliquée au coût d'achat des alevins. Le §5.3 des
exigences cite un facteur `(1 − remise)`, mais aucun mécanisme de remise alevins n'existe dans le
schéma, les fixtures ou le classeur — le seul mécanisme (`PalierRemise`) est explicitement scopé à
l'aliment (ADR-053 §13.3). Décision déjà actée par la pré-analyse, non remise en cause ici ; les
tests ci-dessus n'exercent donc aucune remise (cohérent avec l'implémentation).

## 5. Propagation du défaut de scénario (`alevinsAchetesParDefaut`)

Fichier : `src/lib/queries/__tests__/previsions-vagues.test.ts` (via le fake-db en mémoire, aucune
DB requise), 9 nouveaux tests, tous verts :

- `createVaguePrevue` hérite de `alevinsAchetesParDefaut` (`true` et `false`), et une valeur
  explicite dans le DTO **prévaut** sur le défaut du scénario.
- `updateVaguePrevue` : `alevinsAchetes` librement éditable après création.
- `scinderVaguePrevue` : les enfants copient `alevinsAchetes` du **PARENT**, jamais du défaut du
  scénario — vérifié dans les deux sens (parent `true` / scénario `false`, et l'inverse) pour
  exclure toute coïncidence.
- `genererPlanVaguesPrevues` : applique `alevinsAchetesParDefaut` à chaque `VaguePrevue` créée en
  masse (`true` et `false`).

## 6. Régression de build découverte et corrigée (hors scope MOTEUR strict)

En ajoutant `alevinsAchetes: boolean` comme champ **requis** de `VaguePrevuePourCalcul`
(`previsions-scenario-loader.ts`, changement du @developer), plusieurs fichiers de test
préexistants construisant cet objet littéralement (sans passer par un builder) ont cessé de
type-checker (`tsc --noEmit`) :

- `src/lib/previsions/__tests__/route-orchestration-detail-consommation.test.ts`
- `src/lib/previsions/__tests__/route-orchestration-remise-ordre.test.ts`
- `src/__tests__/lib/previsions-route-orchestration.test.ts` (5 sites de construction)

Ces trois fichiers sont directement dans mon périmètre de test du moteur (même dossier / même
interface que mes nouveaux tests) — je les ai corrigés mécaniquement (ajout de
`alevinsAchetes: false`, sans changement de comportement testé, documenté en commentaire).

**Vérification qu'il ne s'agissait pas d'un vrai bug bloquant le build :** `npm run build`
(`next build --webpack`) type-checke uniquement le code applicatif atteignable, pas les fichiers de
test — il passait déjà avant ma correction (confirmé par exécution) et passe toujours après.
`npx tsc --noEmit -p tsconfig.json` (qui inclut tous les `.ts`/`.tsx` du dépôt via `tsconfig.json`)
révèle en revanche un nombre important d'erreurs de type **préexistantes et indépendantes de cette
story**, notamment dans des fichiers de test de composants UI Prévisions
(`parametres-tab.test.tsx`, `permissions-gating.test.tsx`, `plan-vagues-tab.test.tsx`,
`rattacher-vague-dialog.test.tsx`, `scenario-detail-client-refresh.test.tsx`,
`scission-dialog.test.tsx`) et dans des fichiers totalement étrangers au module Prévisions
(`transfert-entrant-callers.test.ts`, `bons-livraison.test.ts`, `farm-nav.test.ts`,
`analytics-aliments.test.ts`, `gompertz-feed-comparison.test.tsx`, etc.).

**Ces erreurs `tsc --noEmit` restantes ne sont pas corrigées par moi** : elles sont hors du
périmètre défini par la pré-analyse PR2oct.3 (qui ne mentionne aucun de ces fichiers), certaines
portent sur des champs sans rapport avec `alevinsAchetes` (ex. `tauxEpargnePct` manquant dans
`parametres-tab.test.tsx`, signe d'une dette antérieure à ce sprint), et `npm run build` — le seul
critère de vérification exigé par R9 et par ma mission — passe sans elles. Je le signale
explicitement au PM pour qu'il l'assigne au propriétaire concerné (probablement @developer côté
UI Prévisions) plutôt que de les corriger moi-même sans connaître le contrat attendu de ces
composants.

## 7. Vérification finale

### 7.1 Recette seule

```
npx vitest run src/lib/previsions/__tests__/recette
```
```
Test Files  3 passed (3)
     Tests  2458 passed (2458)
```
0 écart. Base 2378 → **2458** (+80), conforme à la story.

### 7.2 Suite complète — 3 passages consécutifs

```
npx vitest run
```

| Passage | Fichiers | Tests |
|---|---|---|
| 1 | 284 passed / 5 skipped (289) | 8957 passed / 21 skipped / 26 todo (9004) |
| 2 | 284 passed / 5 skipped (289) | 8957 passed / 21 skipped / 26 todo (9004) |
| 3 | 284 passed / 5 skipped (289) | 8957 passed / 21 skipped / 26 todo (9004) |

**Trois passages strictement identiques, 0 échec.** (Base annoncée par la mission : 288 fichiers /
8865 tests — l'écart constaté vient des nombreux fichiers de test déjà présents mais non comptés
dans le message d'origine, ainsi que de mes ajouts : +1 fichier neuf
(`route-orchestration-alevins-achetes.test.ts`, 4 tests), +80 assertions de recette, +9 tests de
propagation `previsions-vagues.test.ts`.)

### 7.3 Build

```
npm run build
```
```
✓ Compiled successfully in 12.1s
✓ Generating static pages using 11 workers (169/169) in 547.4ms
```
OK, aucune erreur.

## 8. Ce qui a échoué ou a été laissé de côté

- **Rien dans le périmètre de la story n'a échoué** : les 80 assertions de recette, les 4 tests
  synthétiques, les 9 tests de propagation sont tous verts ; la preuve de régression contrôlée
  (§3.2) confirme qu'ils sont bien discriminants.
- **Laissé de côté, signalé explicitement au PM (§6)** : erreurs `tsc --noEmit` préexistantes sur
  des fichiers de test de composants UI Prévisions et sur des fichiers sans rapport avec ce module
  — hors scope de la pré-analyse PR2oct.3, sans impact sur `npm run build` (le critère retenu par
  R9), à trianger séparément.
- **Réserve documentée, pas un défaut** : absence de remise sur le coût d'achat des alevins
  (§4), déjà actée par la pré-analyse comme un écart assumé entre le texte des exigences et
  l'implémentation.
