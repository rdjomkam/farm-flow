# Review de sprint — PR2-octies (Alevins achetés ou produits en interne)

## Objet

Le §4.3 des exigences fonctionnelles du module Prévisions pose, sur chaque vague planifiée, un booléen `alevins_achetes` (`false` = production interne → coût nul) et le §5.3 en dérive `cout_alevins(vague) = alevins_achetes ? nb_alevins × prix_alevin × (1 − remise) : 0`. Ce champ n'existait nulle part dans le dépôt avant ce sprint : ni dans `prisma/schema.prisma`, ni dans `src/lib/previsions/types.ts`, ni dans aucun DTO. Le moteur facturait donc systématiquement l'achat des alevins, y compris pour les 19 vagues du jeu d'or, toutes en production interne — écart mesuré d'environ **46 millions FCFA** sur l'ensemble du plan `EXCEL-V12` (dont ~42 175 000 FCFA structurellement invisibles à l'ancienne recette, cf. ERR-170 §14.7). Le sprint corrige ce manque en cinq stories : ADR, schéma, moteur, UI, et la présente review de clôture.

## Périmètre livré

| Story | Contenu | Verdict de story |
|---|---|---|
| PR2oct.1 | Amendement ADR-053 §14 (14.1 à 14.7) | — |
| PR2oct.2 | `VaguePrevue.alevinsAchetes` + `ParametresPrevision.alevinsAchetesParDefaut`, migration `20260805090000_add_vague_prevue_alevins_achetes` | VALIDÉ AVEC RÉSERVES → 2 réserves levées (R3 miroir TS, entrée ERR-170) |
| PR2oct.3 | Gating de `coutAlevinsFCFA` (`route-orchestration.ts`), propagation aux 4 points d'écriture, +80 assertions de recette | VALIDÉ AVEC RÉSERVES → M1 levée (`.omit()` sur le schéma de scission) |
| PR2oct.4 | Checkboxes UI, `prixAlevinUnitaireFCFA` jamais masqué/désactivé, i18n fr/en | VALIDÉ AVEC RÉSERVES → 2 réserves levées (360px réel, `tsc` du harnais) |
| PR2oct.5 | Présente review de sprint | ce document |

## Vérification des trois promesses centrales (relecture directe du code)

### a. Le drapeau existe et le coût suit le §5.3 — CONFIRMÉ

`prisma/schema.prisma` porte `VaguePrevue.alevinsAchetes Boolean @default(false)` et `ParametresPrevision.alevinsAchetesParDefaut Boolean @default(false)`. Le miroir TypeScript est complet : `src/types/models.ts:4277` (`alevinsAchetesParDefaut: boolean`) et `src/types/models.ts:4443` (`alevinsAchetes: boolean`).

Le calcul, `src/lib/previsions/route-orchestration.ts:579-581` :
```ts
const coutAlevinsFCFA = vague.alevinsAchetes
  ? new Decimal(alevinsACommanderNb).times(scenario.parametres.prixAlevinUnitaireFCFA)
  : new Decimal(0);
```
`alevinsACommanderNb` est bien le nombre d'alevins **à commander** (marge de sécurité incluse, `route-orchestration.ts:567-570`), conforme à `nb_alevins` du §5.3. Recalcul indépendant effectué sur le cas synthétique A (`route-orchestration-alevins-achetes.test.ts:112-119`) : `ceil(10 000 × 1,10) = 11 000` alevins × 70 FCFA = **770 000 FCFA** — exact.

Le facteur `(1 − remise)` du §5.3 n'est **pas** appliqué — décision assumée et documentée en commentaire (`route-orchestration.ts:571-578`), renvoyant à ADR-053 §13.3 : le seul mécanisme de remise du modèle (`PalierRemise`) est explicitement scopé au coût aliment (tonnage), et aucune fixture ni cellule du classeur ne porte de remise alevins distincte. Inventer une réutilisation aurait été une décision d'architecture invérifiable par la recette — exactement le piège ERR-160. Ce point est correctement classé comme point ouvert de backlog, pas comme un défaut caché.

### b. La logistique alevins n'est PAS gatée — CONFIRMÉ, vérifié à la source

`Grep "alevinsAchetes"` sur `src/lib/previsions/logistique.ts` : **aucune occurrence**. `LogistiqueMensuelleInput`/`LogistiqueMensuelleResult` (`logistique.ts:90-112`) ne portent aucun paramètre de gating ; `calculerLogistiqueMensuelle` (`logistique.ts:133-165`) calcule `voyagesAlevins`/`coutAlevinsFCFA` (transport) inconditionnellement à partir de `input.quantiteAlevinsNb`.

Côté orchestration, `alevinsACommanderNb`/`alevinsNbParMois` (`route-orchestration.ts:583`) sont alimentés **hors** de la branche conditionnelle du coût d'achat, et l'appel à `calculerLogistiqueMensuelle` (lignes ~720-729) ne dépend pas non plus du drapeau. Le cas D du test synthétique (`route-orchestration-alevins-achetes.test.ts:155-171`) le démontre chiffré : `alevinsAchetes = false`, `voyagesAlevins = 1`, `sousTotalFCFA` (logistique) non nul, `coutAlevinsFCFA` (achat) = 0 sur le même mois — exactement la garantie posée par ADR-053 §14.5. Confirmée aussi en base réelle : sur `EXCEL-V12`, `logistique.voyagesAlevins`/`transportAlevins` sont non nuls sur 19 des 21 mois malgré 0 vague achetée.

**Deux notions homonymes `coutAlevinsFCFA` coexistent délibérément** (achat dans `route-orchestration.ts:599`, transport dans `logistique.ts:109`) — piège correctement documenté en commentaire à chacun des deux sites, pas seulement dans l'ADR.

### c. `prixAlevinUnitaireFCFA` conservé, jamais masqué ni forcé à 0 — CONFIRMÉ

Côté moteur : le champ reste lu tel quel dans la formule ci-dessus, quelle que soit la valeur du drapeau — jamais réécrit. Côté UI, `src/components/previsions/parametres-tab.tsx:294-317` : `prixAlevinUnitaireFCFA` reste dans la boucle générique `CHAMPS.map`, avec `disabled={!peutParametrer}` uniquement — aucun `disabled` conditionné par `alevinsAchetesParDefaut`. Test dédié `it.each([true, false])` (`parametres-tab.test.tsx:238-252`) vérifie `not.toBeDisabled()` dans les deux états.

Côté données existantes : la migration restaure `prixAlevinUnitaireFCFA` de `0` à `70` sur `EXCEL-V12` — c'est-à-dire que le sprint corrige aussi une régression **antérieure** où ce même champ avait déjà été mis à zéro par contournement, exactement le comportement que cette promesse interdit désormais.

## Checklist R1-R11 — niveau sprint

| # | Règle | Verdict | Justification |
|---|---|---|---|
| R1 | Enums MAJUSCULES | N/A | Aucun nouvel enum introduit — deux `Boolean`, cohérent avec un besoin binaire (§4.3). |
| R2 | Import des enums | Conforme | Aucune chaîne d'enum en dur détectée dans le périmètre du sprint. |
| R3 | Prisma = TypeScript identiques | **Conforme (après correction)** | Violé initialement en PR2oct.2 (`src/types/models.ts` incomplet), corrigé et vérifié : `models.ts:4277` et `models.ts:4443` portent les deux champs, alignés avec `schema.prisma`. |
| R4 | Opérations atomiques | Conforme | La migration porte un `UPDATE` ciblé sur clause `WHERE` (pas de check-then-update applicatif) ; `updateVaguePrevue` reste un `updateMany({ where: { id, siteId } })` (`previsions-vagues.ts:221-234`) ; `scinderVaguePrevue`/`genererPlanVaguesPrevues` restent en `$transaction` unique avec `createMany`. |
| R5 | DialogTrigger asChild | Conforme | Seul trigger du périmètre (`vague-prevue-form-dialog.tsx:171`) porte déjà `asChild`, non régressé. |
| R6 | CSS variables du thème | Conforme | Checkbox en `border-input`, hint en `text-muted-foreground`, badge en `variant="default"` — aucune couleur en dur relevée. |
| R7 | Nullabilité explicite | Conforme | `Boolean NOT NULL DEFAULT false` sur les deux colonnes, jamais `Boolean?` — décision justifiée explicitement en §14.2 de l'ADR (pas de troisième état « on ne sait pas »). |
| R8 | siteId partout | Conforme, avec nuance préexistante non aggravée | `VaguePrevue` porte `siteId` ; `ParametresPrevision` n'en porte pas en propre (1-1 avec `ScenarioPrevision` qui le porte) — état antérieur au sprint. Toutes les requêtes touchées (`createVaguePrevue`, `updateVaguePrevue`, `scinderVaguePrevue`, `genererPlanVaguesPrevues`, `createScenario`, `updateParametresPrevision`) filtrent bien `siteId`. |
| R9 | Tests avant review | Conforme | `npx vitest run` ×3 passages identiques, `npm run build`, `npx prisma migrate deploy` exécutés et rapportés avant clôture (`rapport-sprint-PR2-octies.md`). |
| R10 | Correctif de données = migration versionnée | Conforme | `prisma/migrations/20260805090000_add_vague_prevue_alevins_achetes/migration.sql` — sous-dossier correct, `DO $$ IF NOT EXISTS` idempotent pour les colonnes, `UPDATE` ciblé sur une **valeur** (`= 70`), jamais un delta, no-op silencieux si `EXCEL-V12` absent ou si la valeur courante diffère de 0. |
| R11 | Aucun secret en dur | Conforme | Aucune URL, mot de passe ou token dans `migration.sql`, `schema.prisma`, ni les fichiers applicatifs du sprint. Connexion du @tester via `docker exec` sans reproduction d'identifiant. |

**Verdict global R1-R11 : conforme sur toute la ligne**, y compris le point initialement violé (R3), effectivement corrigé et re-vérifié par lecture directe.

## Qualité du filet de test — jugement exigeant

La progression 2 378 → 2 458 assertions (+80) est **réellement significative**, pas un gonflement cosmétique, pour trois raisons vérifiées indépendamment :

1. **Les assertions comparent une valeur recalculée à une valeur de fixture indépendante**, pas une réimplémentation du moteur : `route-orchestration.recette.test.ts:147` compare `projection.coutAlevinsFCFA` à `vague.coutAlevinsFCFA` (fixture JSON), et `:325-331` compare `moisCourant.coutAlevinsFCFA` à `fixture.depenses.alevins[m]`.
2. **Preuve de discrimination par régression contrôlée** : restauration temporaire de l'ancienne formule non gatée → **76 des 80 nouvelles assertions échouent**, écarts jusqu'à 2 887 500 FCFA sur une seule vague, puis `git diff --stat` vide confirmé après restauration. C'est la bonne pratique attendue après ERR-160/ERR-127 : une assertion qui existe et passe ne prouve rien tant qu'on n'a pas montré qu'elle casse sur le bug qu'elle prétend attraper.
3. **Le cas `alevinsAchetes = true` est réellement couvert, pas effleuré.** Le jeu d'or ne l'exerce jamais (19/19 à `false`) — la couverture est entièrement synthétique et délibérée : `route-orchestration-alevins-achetes.test.ts`, 4 cas (A : 770 000 FCFA recalculé à la main et confirmé indépendamment ; B : non-régression `false`→0 ; C : deux vagues du même mois, l'une `true` l'autre `false` ; D : `false` avec transport non nul, la garantie §14.5 chiffrée). C'est exactement ce qu'exige ADR-053 §14.6 : une couverture construite, pas héritée.

**Un point reste net et correctement consigné, pas balayé** : ADR-053 §14.7 et ERR-170 documentent que la recette **avant** ce sprint était structurellement aveugle à ce terme — le helper `orchestration.ts` lit `coutAlevinsFCFA` depuis la fixture plutôt que de le recalculer. Ce défaut de conception n'est **pas** corrigé par contournement (le helper lit toujours la fixture) : seules les nouvelles assertions dédiées comblent la lacune, en parallèle du helper. Suffisant au regard d'ERR-160 pour la branche en question, mais cela laisse ouverte une question générale : d'autres termes du helper pourraient porter le même défaut sans qu'on l'ait vérifié.

**Conclusion : filet suffisant et rigoureux pour ce sprint.** La discipline de preuve (régression contrôlée, recalcul indépendant du reviewer, cas synthétiques ciblés) est un net progrès méthodologique par rapport aux sprints qui ont produit ERR-127/ERR-148/ERR-155/ERR-160.

## Protection des données de l'utilisateur

La restauration `prixAlevinUnitaireFCFA` 0 → 70 était **légitime et correctement bornée** :

- **Motif documenté et vérifié** : la valeur `0` en base sur `EXCEL-V12` était elle-même un contournement antérieur — ADR-053 §14.4 et ERR-170 l'établissent comme un fait vérifié (`entreesModele.parametresScenario.prixAlevinUnitaireFCFA = 70` dans le classeur de référence).
- **Bornage correct** : `UPDATE ... WHERE sp.code = 'EXCEL-V12' AND pp."prixAlevinUnitaireFCFA" = 0` — cible une valeur, pas un delta ; ne touche que le scénario nommé ; n'écrase jamais une valeur différente de 0 saisie légitimement ailleurs ; no-op silencieux si le scénario est absent (dev d'un autre agent, CI, prod).
- **Neutralité fonctionnelle démontrée, pas seulement affirmée** : `alevinsAchetes = false` sur les 19 vagues → coût toujours 0, que le prix vaille 0 ou 70. La restauration corrige uniquement une valeur saisie mensongère.

**Le protocole AVANT/APRÈS a été réellement appliqué**, pas seulement annoncé : snapshot par table (`VaguePrevue` 19/602500/0, `ApportCapital` 3, `AlimentPrevision` 3 calibres avec mêmes id/articles/répartitions, `ScenarioPrevision.updatedAt` inchangé à la milliseconde près) et comparaison colonne par colonne de `ParametresPrevision`, avec les deux seules différences explicitement autorisées. C'est le niveau de granularité attendu.

## Constats par sévérité

### Critique
Aucun.

### Haute
Aucun. Le point structurellement le plus dangereux (contamination possible de la logistique par le drapeau) a été traité de façon exemplaire et vérifié à trois niveaux indépendants (grep du code source, test synthétique dédié, données réelles `EXCEL-V12`).

### Moyenne
1. **La remise alevins du §5.3 n'est pas modélisée** (`route-orchestration.ts:571-578`) — décision assumée, bien commentée, correcte compte tenu de l'absence de donnée de recette capable de la discriminer. À porter en backlog : si un futur besoin l'exige, il faudra **d'abord** une donnée de recette qui l'exerce, faute de quoi on reproduirait ERR-160.
2. **1 423 erreurs `tsc --noEmit` préexistantes** subsistent (contre 1 427 avant ce sprint — 4 corrigées, ciblées et vérifiées sans effet de bord). Massivement hors module Prévisions, elles ne bloquent ni `vitest run` ni `npm run build`. 4 erreurs résiduelles à lien indirect avec Prévisions (`RequestInit` Next vs DOM, `Decimal` vs `number` sur `previsions-charges.test.ts:161`) — signalées pour triage séparé.

### Basse
1. **`alevinsAchetesParDefaut` absent du dialogue de création d'un scénario** — un nouveau scénario ne peut fixer ce défaut qu'après coup, via l'onglet Paramètres. Cohérent avec le périmètre défini par la pré-analyse PR2oct.4 (non exigé), mais friction UX réelle à envisager en polissage.
2. **Dépassement de périmètre assumé sur le badge `plan-vagues-tab.tsx`** — la pré-analyse tranchait de ne pas l'exiger ; livré quand même. Exécution propre (3 tests dédiés, i18n complète, vérifié en navigateur réel), donc accepté, mais à signaler comme précédent : dépasser un périmètre explicitement refusé mérite une confirmation avant implémentation.

## Points ouverts pour le backlog

| Point | Sévérité | Porteur suggéré |
|---|---|---|
| Remise alevins du §5.3 non modélisée — exige une donnée de recette avant toute implémentation | Moyenne | @architect / @db-specialist selon future demande |
| 1 423 erreurs `tsc --noEmit` préexistantes, dette massive hors module Prévisions | Moyenne | @project-manager (triage séparé) |
| 4 erreurs `tsc` résiduelles à lien indirect Prévisions (`RequestInit`, `Decimal`) | Basse-Moyenne | porteur de la prochaine story touchant ces fichiers |
| `alevinsAchetesParDefaut` absent du dialogue de création de scénario | Basse | polissage UI, prochain sprint Prévisions |
| Précédent de dépassement de périmètre (badge) — discipline de confirmation avant implémentation | Basse | rappel processus, @project-manager |
| Vérifier si d'autres termes du helper `orchestration.ts` souffrent du même défaut que `coutAlevinsFCFA` (lecture de fixture au lieu de recalcul) | Moyenne | audit ponctuel, hors ce sprint |

## Ce qui reste insuffisamment prouvé — lecture exigeante

Rien dans ce sprint n'a été trouvé insuffisamment prouvé au sens où une affirmation clé reposerait sur une déclaration non vérifiée : chaque promesse centrale (a, b, c) a été recontrôlée par lecture directe du code de production, et les chiffres cités (770 000 FCFA, 76/80 assertions en échec, 168 migrations, 2 458/2 458, 8 977 passed ×3) sont cohérents entre le rapport de test, les reviews de story et l'inspection directe. Le seul point de vigilance non clos est le n°6 du backlog ci-dessus : le fait qu'`orchestration.ts` lise certaines valeurs depuis la fixture plutôt que de les recalculer est établi pour `coutAlevinsFCFA` — rien ne garantit que ce patron n'existe pas ailleurs dans le même helper. Ce n'est pas un défaut de ce sprint, mais un doute méthodique qu'il révèle et qu'aucune story n'avait mandat de trancher.

## Verdict de sprint

**VALIDÉ.**

Les trois promesses centrales sont tenues et vérifiées par lecture directe du code, pas seulement par confiance dans les rapports amont : le drapeau existe et suit fidèlement le §5.3 (hors remise, décision assumée et documentée) ; la logistique alevins n'est jamais gatée, garantie chiffrée par un test dédié et confirmée en données réelles ; `prixAlevinUnitaireFCFA` n'est jamais masqué ni forcé à zéro, et l'ancien contournement qui l'avait fait a été réparé par une migration idempotente et correctement bornée. Les violations relevées en cours de sprint ont été effectivement corrigées et revérifiées. Le filet de test constitue le meilleur exemple à ce jour, dans ce module, de preuve de discrimination méthodique plutôt qu'une simple accumulation d'assertions vertes. Le protocole de protection des données a été appliqué avec la granularité attendue. Aucun constat Critique ou Haute. Les points Moyenne et Basse sont des décisions assumées et documentées, correctement transmises au backlog plutôt que résolues dans la précipitation.
