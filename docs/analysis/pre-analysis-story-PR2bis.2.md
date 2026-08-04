# Pré-analyse Story PR2bis.2 — Câbler `genererPlanEmpoissonnement`

## Statut : GO AVEC RÉSERVES

## 1. Signature littérale de `genererPlanEmpoissonnement`

Fichier : `src/lib/previsions/plan.ts:57-85` (export re-exposé par `src/lib/previsions/index.ts:18`).

```ts
export interface ParametresPlanInput {
  dateDebutPlan: Date;
  effectifAlevinsParVague: number;
  poidsMoyenInitialG: Decimal;
}

export interface VaguePrevueGeneree {
  index: number;                 // 1-based, ordre de stockage — PAS un code (le code "V7" est attribué par l'appelant)
  dateStockagePrevue: Date;
  effectifAlevinsPrevu: number;
  poidsMoyenInitialG: Decimal;
  dureeCycleMoisFigee: number;
}

function genererPlanEmpoissonnement(
  parametres: ParametresPlanInput,
  dureeCycleMois: number,
  frequenceStockageMois: Decimal,
  horizonMois: number
): VaguePrevueGeneree[]
```

Fonction pure, sans I/O (conforme ADR §4). Préconditions/comportement :
- retourne `[]` si `frequenceStockageMois.lte(0)` ou `horizonMois < 0` (pas d'exception levée) ;
- `horizonMois = 0` produit **une seule** vague (celle du mois de départ) ;
- boucle `while (offsetMois.lte(horizonMois))`, espacement `+= frequenceStockageMois` (peut être fractionnaire, ex. 0.5 mois) ;
- `addMonthsFractional` avance la partie entière via `setUTCMonth`, la partie fractionnaire en jours calendaires réels du mois cible — comportement documenté comme une interprétation retenue par l'auteur, **pas vérifiée numériquement par la pré-analyse PR1.3** (« GAP DE MODELE », commentaire ligne 39-49 de `plan.ts`) ; le test unitaire (`__tests__/plan.test.ts`) couvre les cas limites logiques (bornes 0, négatif, fractionnaire) mais ne recette pas de dates contre le jeu d'or.
- ne lève **aucune** exception : les seules erreurs possibles viennent de la validation zod en amont (route) ou de la garde `assertEntierColonneInt` côté queries, jamais du moteur lui-même.

## 2. Paramètres à demander vs déjà disponibles

Signature = 4 paramètres. Sources :

| Paramètre moteur | Origine | À ressaisir dans l'UI ? |
|---|---|---|
| `parametres.dateDebutPlan` | `ScenarioPrevision.dateDebutPlan` | NON — déjà en base, pré-rempli, éventuellement éditable comme "date de début du plan de génération" mais la valeur par défaut existe |
| `parametres.effectifAlevinsParVague` | `ParametresPrevision.effectifAlevinsParVague` | NON — déjà en base |
| `parametres.poidsMoyenInitialG` | `ParametresPrevision.poidsMoyenInitialG` | NON — déjà en base |
| `dureeCycleMois` | `ScenarioPrevision.dureeCycleMois` | NON — déjà en base (et c'est la valeur qui doit être figée dans `dureeCycleMoisFigee`, cf. §3) |
| `frequenceStockageMois` | `ParametresPrevision.frequenceStockageMois` | NON — déjà en base |
| `horizonMois` | **N'existe nulle part en base** | **OUI, seul champ réellement à demander** (ex. "sur combien de mois générer le plan ?", 21 dans le cas d'usage ADR §1) |

**Conclusion centrale de la story** : l'UI ne doit demander **qu'un seul champ nouveau, `horizonMois`** (+ éventuellement une confirmation de `dateDebutPlan` si l'utilisateur veut décaler le début de génération par rapport à `scenario.dateDebutPlan`, mais ce n'est pas obligatoire). Tous les autres paramètres viennent charger `ScenarioPrevision` + `ParametresPrevision` déjà persistés — **aucune resaisie**. Un formulaire qui redemande `effectifAlevinsParVague`/`poidsMoyenInitialG`/`frequenceStockageMois`/`dureeCycleMois` serait un doublon de saisie et un risque de divergence avec les Paramètres du scénario (l'onglet `parametres-tab.tsx` existe déjà pour les éditer) — à proscrire.

Attention : `ParametresPrevision` est **nullable-optionnelle en relation** (`scenario.parametres` peut être absente si l'onglet Paramètres n'a jamais été rempli) — le bouton "Générer un plan" doit être désactivé/absent tant que `ParametresPrevision` n'existe pas pour ce scénario (sinon 4 des 5 paramètres manquent silencieusement).

## 3. Écart sortie moteur ↔ modèle Prisma `VaguePrevue`

`VaguePrevueGeneree` (sortie moteur) vs colonnes `VaguePrevue` (`prisma/schema.prisma:4497-4530`) :

| Champ `VaguePrevue` | Fourni par le moteur ? | Comment le combler |
|---|---|---|
| `code` | NON (le commentaire ligne 17 de `plan.ts` le dit explicitement : « le code... est attribué par l'appelant ») | Générer côté appelant, déterministe, ex. `V${offset + index}` où `offset` = nombre de VaguePrevue déjà existantes non ANNULEE (ou total, à trancher §5) — **jamais un défaut arbitraire type "V1" fixe qui collisionnerait avec `@@unique([scenarioId, code])`** |
| `dateStockagePrevue` | OUI | direct |
| `effectifAlevinsPrevu` | OUI (`effectifAlevinsPrevu`) | direct |
| `poidsMoyenInitialG` | OUI | direct |
| `dureeCycleMoisFigee` | OUI | direct |
| `statut` | NON | `StatutVaguePrevue.PLANIFIEE` par défaut — **valeur légitime, pas un défaut silencieux au sens de l'anti-pattern `dashboard.ts:218`** (ce dernier concerne une donnée métier absente masquée par une valeur plausible ; ici c'est l'état initial documenté de toute création, identique à `createVaguePrevue` existant) |
| `vaguePrevueParentId` | NON | `null` (pas issu d'une scission) |
| `scenarioId` / `siteId` | NON (hors moteur, R8) | fournis par la route/query, pas par le moteur |
| `id`, `createdAt`, `updatedAt` | Prisma | auto |

Pas de champ Prisma que le moteur laisserait vide en inventant une valeur non justifiée — l'écart se résume à `code` (attribution déterministe par l'appelant) et aux clés techniques (scénario/site), ce qui est cohérent avec l'ADR (le moteur ne fait pas d'I/O, décision explicite).

## 4. Chemin d'écriture recommandé

**Aucune query de création en masse n'existe aujourd'hui.** `src/lib/queries/previsions-vagues.ts` n'expose que `createVaguePrevue` (une seule ligne, transaction unitaire) — pas de `createManyVaguesPrevues`/`genererPlanVaguesPrevues`. Il faut :

1. **Nouvelle query** dans `previsions-vagues.ts`, ex. `genererPlanVaguesPrevues(scenarioId, siteId, horizonMois)` :
   - charge `scenario` (dureeCycleMois, dateDebutPlan) + `scenario.parametres` en une requête (`tx.scenarioPrevision.findFirst({ include: { parametres: true } })`), 404 si absent, erreur explicite si `parametres` est `null` ;
   - appelle `genererPlanEmpoissonnement(...)` (moteur, pas d'I/O) ;
   - assigne les `code` déterministes (à trancher : suffixe après le dernier code existant, cf. §5) ;
   - `assertEntierColonneInt(effectifAlevinsPrevu, ...)` sur chaque ligne AVANT écriture (pattern déjà utilisé partout dans ce fichier, ERR-135) ;
   - `createMany` dans une **seule transaction** (R4) — pas une boucle de `create()` unitaires (pas de garantie atomique sinon : un plan de 19 vagues à moitié écrit en cas d'erreur au milieu serait un état incohérent silencieux) ;
   - retourne les VaguePrevue créées (`findMany` post-transaction, pas de piège `create+include`, ERR-136, puisque `createMany` ne supporte de toute façon pas `include`).

2. **Nouvelle route API**, recommandée : `POST /api/previsions/scenarios/[id]/vagues/generer` (à côté de `POST /api/previsions/scenarios/[id]/vagues` existant, `src/app/api/previsions/scenarios/[id]/vagues/route.ts`) :
   - `requirePermission(request, Permission.PREVISIONS_GERER)` — même permission que la création unitaire (ADR §6, explicite "vagues prévues") ;
   - `auth.activeSiteId` transmis à la query (R8) ;
   - nouveau schéma zod, ex. `genererPlanVaguesPrevuesSchema = z.object({ horizonMois: nonNegativeInt })` dans `src/lib/validation/previsions.schema.ts` ;
   - `parseBody` + `handleApiError` avec `PREVISIONS_STATUS_MAP` (`src/app/api/previsions/_shared.ts`), pour que `assertEntierColonneInt` retombe en 400 et pas en 500.

Alternative rejetée : réutiliser `POST .../vagues` existant avec un flag `mode: "generer"` — mélangerait deux contrats de payload très différents (un objet vs un `horizonMois`) dans la même route, moins lisible ; une route dédiée est plus conforme au style du dépôt (une route = une action, cf. `/annuler`, `/scinder`, `/rattacher` déjà séparées pour la même ressource).

## 5. Cas « des vagues prévues existent déjà »

Contraintes de base vérifiées dans le code (`previsions-vagues.ts`) :
- **Aucune fonction `deleteVaguePrevue` n'existe** — confirmé, deleteMany/delete absent du fichier. Impossible structurellement de tout effacer puis régénérer via les queries actuelles, et **il ne faut pas en ajouter une pour cette story** (ce serait recréer le trou que PR2.1 a délibérément bouché).
- Une `VaguePrevue` rattachée à une `Vague` réelle (`vague` non nul, relation inverse de `Vague.vaguePrevueId`) ne peut être ni supprimée ni annulée (`annulerVaguePrevue` refuse via `updateMany({ where: { vague: null } })`, count=0 → erreur explicite).
- Statut `ANNULEE` et auto-relation `vaguePrevueParentId` (scission) sont les deux seuls mécanismes de "retrait" d'une VaguePrevue prévus par le schéma.

**Options réellement implémentables pour la régénération :**
- **(a) Ajouter à la suite** — génère uniquement les nouvelles VaguePrevue au-delà de l'horizon déjà couvert (ou après le dernier `code`/dernière date existante), sans toucher aux existantes. Trivialement sûr, ne viole aucune contrainte.
- **(b) "Remplacer" le plan** ne peut PAS être un remplacement physique : il ne peut être implémenté, avec les queries actuelles, que comme **annuler toutes les VaguePrevue non rattachées à une vague réelle et statut ≠ ANNULEE**, puis générer le nouveau plan à côté. Toute VaguePrevue rattachée à du réel (`vague` non nul) est **automatiquement exclue de ce remplacement** — `annulerVaguePrevue` le refuserait de toute façon, donc le remplacement doit filtrer ces lignes en amont plutôt que de laisser échouer un `Promise.all` partiel en transaction. Ce n'est donc pas un vrai "remplacer", plutôt "annuler les prévisions non réalisées, puis régénérer" — l'UI doit le nommer ainsi, pas "remplacer le plan" tout court, pour ne pas laisser croire à une purge totale.
- **(c) Refuser** si des VaguePrevue existent déjà (bloquer, rediriger vers ajout manuel) — le plus simple mais contredit l'esprit "générer un plan complet en une fois", y compris pour re-générer après un changement d'horizon.

**Recommandation** : (a) comme comportement par défaut ("compléter le plan à partir de la dernière vague planifiée"), avec (b) comme option explicite et nommée précisément ("annuler les vagues prévues non réalisées et régénérer"), présentée dans un dialogue de confirmation distinct **avant** toute écriture — jamais un écrasement silencieux (exigence explicite de la story). (c) seul serait insuffisant pour couvrir le cas réel où l'utilisateur veut étendre un horizon de 12 à 21 mois sans dupliquer les 12 premiers.

**Point à trancher par le PM plutôt que par le développeur seul** : le choix par défaut entre (a) et (b), et la définition exacte de "dernière vague planifiée" (par date ou par code) pour (a) — l'ADR ne tranche pas ce point, c'est un choix produit.

## 6. Écran cible : `src/components/previsions/plan-vagues-tab.tsx`

Fichier confirmé (nom exact). Structure actuelle : un seul bouton de mutation visible quand `peutGerer` (`Permission.PREVISIONS_GERER`), ouvrant `VaguePrevueFormDialog` (création unitaire). Greffage recommandé :
- ajouter un second déclencheur à côté (`<DialogTrigger asChild>` — **R5**, comme le reste du dépôt), ex. "Générer un plan", ouvrant un nouveau composant `generer-plan-dialog.tsx` (à créer, suivant le patron de `vague-prevue-form-dialog.tsx`) ;
- ne pas modifier la branche "créer une vague" existante ni son test (`__tests__/permissions-gating.test.tsx` vérifie déjà le bouton "Ajouter" — s'assurer que le nouveau bouton a un nom accessible distinct, ex. "Générer un plan", pour ne pas casser les `getByRole("button", { name: /Ajouter/i })` existants) ;
- callback de retour identique au pattern `onCreated`/`onVaguesPrevuesChange` déjà utilisé (append en bloc plutôt qu'un seul objet) ;
- mobile-first 360px : le formulaire n'a qu'1 champ obligatoire (`horizonMois`) + option (a)/(b) si des VaguePrevue existent déjà — tient largement dans une carte de dialogue mobile sans refonte de layout ;
- **R6** : aucune couleur en dur à introduire, réutiliser les classes/variables existantes du dialogue.

## 7. i18n

**Aucun namespace `previsions` n'existe** dans `src/messages/{fr,en}/` (liste vérifiée : 34 fichiers, aucun `previsions.json`) — confirmé cohérent avec PR2bis.1 ("4 fichiers sur 34 utilisent déjà `next-intl`" dans le module, mais pas via un namespace dédié encore livré ; `plan-vagues-tab.tsx` actuel n'importe PAS `useTranslations` du tout, uniquement du français en dur sans accents : "Planifiee", "Realisee", "Aucune vague planifiee", etc.).

Patron à réutiliser (`src/components/remises/remise-form-dialog.tsx:73`, `src/components/commissions/*`) : `const t = useTranslations("previsions")` puis `t("planVagues.genererPlan.titre")` etc. — clés hiérarchiques par écran/composant, pas un namespace plat.

**Risque de collision concret et sérieux** : PR2bis.1 et PR2bis.2 modifient très probablement **le même fichier** (`plan-vagues-tab.tsx`) et la **même clé racine** (`previsions.json`, encore inexistant) **en parallèle** ("Statut : EN COURS" pour les deux dans `SPRINT-PR2-bis-PREVISIONS.md`). Le texte de la story .2 dit explicitement "textes i18n (fr+en) conformément à PR2bis.1" — cela suppose que PR2bis.1 a déjà posé le patron/namespace `previsions` au moment où .2 écrit son propre texte, ce qui n'est pas garanti par un simple parallélisme documentaire. **Point à faire trancher par le PM** : séquencer réellement .1 avant .2 sur ce fichier précis (ou convenir explicitement de qui crée `previsions.json` en premier et sous quelles clés), sinon conflit de merge quasi certain + risque que .2 réintroduise du français en dur si elle est développée avant que le namespace existe.

Test de complétude fr/en à respecter : `src/__tests__/integration/i18n-completeness.test.ts` — toute nouvelle clé ajoutée par .2 doit exister dans les deux fichiers, accents corrects.

## 8. Tests existants

- `src/lib/previsions/__tests__/plan.test.ts` : couvre `genererPlanEmpoissonnement` isolément (bornes horizon 0/négatif, fréquence ≤0, fractionnaire) — **ne teste pas** l'attribution de code ni l'écriture DB, donc pas de risque direct de casse par cette story, mais ne couvre pas non plus le nouveau code à écrire.
- `src/components/previsions/__tests__/permissions-gating.test.tsx` : vérifie que `PlanVaguesTab` avec seulement `PREVISIONS_VOIR` ne montre AUCUN bouton de mutation (`Ajouter`, `Rattacher`, `Scinder`, `Annuler` — regex `/Ajouter/i`). **Risque de casse direct** : le nouveau bouton "Générer un plan" doit être conditionné par le même `peutGerer` et par conséquent absent dans ce test — sinon la regex `/Ajouter/i` pourrait matcher un texte du nouveau bouton par accident (ex. si le libellé contient "Ajouter"), ou le test devra être étendu pour vérifier explicitement l'absence du nouveau bouton de génération. Ce test mocke déjà `next-intl` (`vi.mock("next-intl", ...)`, ligne 23) — cohérent avec le fait que la conversion i18n est anticipée mais pas encore faite sur ce fichier précis.
- Pas de test dédié `plan-vagues-tab` au-delà de ce fichier de gating.
- Aucun test DB-gated existant pour une éventuelle nouvelle query de génération en masse — à écrire par le développeur (pattern `previsions-int-fractional-integration.test.ts` cité en commentaire de `previsions-vagues.ts` comme précédent contre un vrai Postgres).

## Risques identifiés

1. **Collision PR2bis.1 / PR2bis.2 sur `plan-vagues-tab.tsx` et sur la création du namespace `previsions.json`** — les deux stories sont EN COURS en parallèle sur le même fichier et la même surface i18n. Impact : conflit de merge, ou réintroduction de français en dur si .2 est livrée avant que .1 pose le patron. Mitigation : séquencer réellement, ou le PM tranche qui crée `previsions.json`/le namespace en premier.
2. **`ParametresPrevision` peut être `null`** pour un scénario (relation optionnelle) — le bouton "Générer un plan" doit être gardé par cette précondition, sinon 4 des 5 paramètres du moteur sont absents silencieusement au moment de l'appel.
3. **Attribution du `code`** n'est spécifiée nulle part (ADR ni schéma) — logique déterministe à inventer par le développeur ; doit gérer la collision avec `@@unique([scenarioId, code])` si des VaguePrevue "V7"+ existent déjà avec des codes non strictement séquentiels (ex. après une scission "V7a"/"V7b").
4. **`addMonthsFractional`** (dates de stockage) porte un GAP DE MODELE documenté par l'auteur lui-même comme non recetté contre le jeu d'or — les dates produites par un plan de 19 vagues n'ont pas de garantie numérique au-delà des tests unitaires de bornes.
5. Le test `permissions-gating.test.tsx` doit être étendu (pas seulement vérifié) pour couvrir le nouveau bouton "Générer un plan" sous `PREVISIONS_VOIR` seule.

## Prérequis manquants

- Décision produit PM sur le comportement par défaut face à des VaguePrevue déjà existantes (§5).
- Séquencement explicite entre PR2bis.1 et PR2bis.2 sur `previsions.json`/`plan-vagues-tab.tsx` (§7).
- Convention de nommage du `code` généré, à documenter dans le code (commentaire) une fois tranchée, faute de source ADR.

## Recommandation

GO AVEC RÉSERVES. Le développeur peut commencer la query + la route (§4) et le moteur est déjà stable et testé. Avant d'écrire l'UI, faire trancher par le PM : (1) séquencement i18n avec PR2bis.1 (§7), (2) comportement par défaut "ajouter" vs "remplacer les non réalisées" (§5), (3) règle d'attribution du `code`. Étendre `permissions-gating.test.tsx` en même temps que le nouveau bouton, pas après coup.
