# Pré-analyse Sprint PR2-ter, Story PR2ter.1 — Reporter une charge sur plusieurs mois

**Date :** 2026-08-03
**Auteur :** @pre-analyst
**Périmètre déclaré :** UI (`charges-tab.tsx` + dialogue de report), avec extension probable à une route API en lot. Hors périmètre absolu : `src/lib/previsions/` (moteur), rapprochement, comparaison prévu/réel, exports, reprévision.

## Statut : GO AVEC RÉSERVES

## Résumé

L'intention (saisir un montant une fois, l'appliquer à une plage de mois pour un poste de charge) est réalisable sans toucher au moteur ni au schéma Prisma. Le composant `charges-tab.tsx` charge déjà **toutes** les `ChargeMensuellePrevue` du scénario en mémoire (pas seulement le mois affiché), ce qui rend l'aperçu « quels mois seront écrasés » calculable côté client sans lecture réseau supplémentaire — c'est le point le plus favorable de cette pré-analyse. En revanche, l'exigence d'atomicité (des charges annoncées comme « rigoureusement constantes » ne doivent jamais finir dans un état partiellement appliqué) fait pencher la balance vers une **nouvelle route API en lot, transactionnelle**, plutôt qu'une boucle client sur la route unitaire existante — ce qui transforme la story en UI+API, comme anticipé par la consigne.

---

## 1. Lecture exhaustive effectuée

- `src/components/previsions/charges-tab.tsx` (215 lignes) — navigateur mois-primaire, un poste = une carte, un `Input` + un bouton `Enregistrer` par carte, état `charges` = **tableau complet non filtré** des `ChargeMensuellePrevue` du scénario (`initialCharges`), filtré localement par `moisAbsolu` via `useMemo` (`chargesDuMois`). `handleSave` appelle `PUT /api/previsions/postes/{posteId}/charges` avec `{ moisAbsolu, montantFCFA }` puis fusionne la ligne renvoyée dans l'état local (pas de refetch complet).
- `src/app/api/previsions/postes/[id]/charges/route.ts` — `PUT` unique, `requirePermission(PREVISIONS_GERER)`, délègue à `upsertChargeMensuelle(id, auth.activeSiteId, moisAbsolu, montantFCFA)`.
- `src/lib/queries/previsions-charges.ts` — `upsertChargeMensuelle` : upsert natif sur `@@unique([posteId, moisAbsolu])`, garde `assertEntierColonneInt` sur `moisAbsolu` (piège Prisma 7 documenté : troncature silencieuse d'un `Int` non entier). `getChargesMensuellesParScenario` accepte déjà un filtre optionnel `moisAbsolu`.
- `src/lib/validation/previsions.schema.ts` — `upsertChargeMensuelleSchema = { moisAbsolu: positiveInt, montantFCFA: nonNegativeNumber }`.
- `src/components/previsions/api-types.ts` — `PostePrevisionDTO`, `ChargeMensuellePrevueDTO { id, scenarioId, posteId, moisAbsolu, montantFCFA: Dec, siteId }`.
- `src/components/previsions/scenario-detail-client.tsx` — shell des onglets. **`ChargesTab` ne reçoit actuellement pas l'horizon du plan** (`projection.horizonMois` existe déjà dans les props du shell — donné à `PrevisionsMensuellesTab` mais pas à `ChargesTab`).
- `src/components/previsions/projection-types.ts` — `ProjectionScenarioDTO.horizonMois: number` — la longueur réelle de l'horizon calculé, déjà disponible côté Server Component, déjà converti en `number`.
- Précédent architectural directement réutilisable : `src/app/api/previsions/scenarios/[id]/vagues/generer/route.ts` (`GET` = aperçu dry-run, `POST` = écriture en masse dans **une seule** `prisma.$transaction`) et son composant `src/components/previsions/generer-plan-dialog.tsx` (dialogue 2 étapes : saisie → aperçu chiffré → confirmation, jamais d'écriture silencieuse). C'est exactement le patron à reproduire ici.
- `src/messages/fr/previsions.json` / `en/previsions.json` — bloc `chargesTab` (11 clés), parité stricte 299/299 confirmée par la review PR2-bis.
- `src/__tests__/integration/i18n-completeness.test.ts` — test de parité **générique** (comparaison d'ensembles de clés `fr`/`en`, pas de nombre magique « 299 » codé en dur dans ce test ; le chiffre 299 n'apparaît que dans `docs/tests/rapport-story-PR2bis.1.md`, un rapport, pas un test). Le namespace `"previsions"` est déjà dans les listes `describe`-loop de ce fichier (lignes ~206, ~282, ~324) : **aucune modification de ce test n'est requise pour ajouter des clés sous `previsions.json`**, seulement pour ajouter un namespace entier (non applicable ici). Réserve mineure de la review PR2-bis, sans rapport avec cette liste : les blocs `describe` de complétude par-clé itèrent une liste de clés recopiée à la main ailleurs dans le fichier — à vérifier si la story ajoute des clés à une liste de ce type (voir section 6).
- `docs/decisions/ADR-053-module-previsions.md` §3, §4, §6, §8 — confirme R8/R4/Decimal, et confirme que rien dans le module Prévisions ne doit écrire dans le domaine réel (sans rapport direct avec cette story, mais contextualise le périmètre).
- `docs/reviews/review-sprint-PR2-bis.md` — aucune réserve ne concerne `charges-tab.tsx` ni la route `postes/[id]/charges`. R1-R11 tous OK sur le sprint précédent ; le seul point d'architecture ouvert (`PalierRemise.seuilSacs`) est sans rapport avec les charges mensuelles.

---

## 2. Forme exacte de l'UI proposée

**Un bouton « Reporter sur plusieurs mois » par carte de poste**, à côté du bouton `Enregistrer` existant (visible uniquement si `peutGerer`, comme le bouton `Enregistrer`). Justification :

- La granularité de la base (`@@unique([posteId, moisAbsolu])`) et de la route existante (`PUT .../postes/{posteId}/charges`) est **par poste**. Un report a donc naturellement pour périmètre un seul poste à la fois — cohérent avec le modèle de données, pas une nouveauté.
- `charges-tab.tsx` est déjà mois-primaire (navigation précédent/suivant) avec un poste = une carte. Ajouter le bouton de report **dans** la carte du poste (pas un dialogue global au-dessus de la liste qui mélangerait les 4 postes) préserve cette structure et évite une matrice poste × mois qui a déjà été écartée comme trop complexe en 360px (commentaire d'en-tête du fichier, décision PR2.3 déjà actée).
- Le dialogue est scopé à **un seul poste**, avec son libellé affiché en titre (« Reporter — Électricité »), un champ montant, et un choix de plage (radio à 2 options, cf. point 3). Toujours `<DialogTrigger asChild>` (R5).
- Mobile first 360px : dialogue en pleine largeur, champs empilés verticalement (`DialogBody` existant gère déjà cet empilement dans `generer-plan-dialog.tsx` — même composant réutilisé).

Alternative écartée : un unique dialogue « Reporter toutes les charges » au niveau de la page, avec un montant par poste dans le même formulaire. Écartée parce qu'elle réintroduirait la matrice poste × mois que la décision de conception du fichier a explicitement évitée, et parce qu'elle complique l'aperçu (quel poste écrase quel mois) sans bénéfice proportionné pour 4 postes qui se reportent индépendamment les uns des autres dans le cas d'usage décrit.

---

## 3. Arbitrage — route en lot vs boucle client

**Volume réel : 21 mois maximum** (horizon du plan de référence), un seul poste par appel.

### Boucle client sur la route unitaire existante

- 21 appels HTTP séquentiels (ou parallélisés) vers `PUT /api/previsions/postes/{id}/charges`.
- Latence : en séquentiel, de l'ordre de 21 × (latence d'un upsert simple, quelques dizaines à ~150 ms en environnement de prod géré) ≈ 1 à 4 secondes. Acceptable en soi pour une saisie ponctuelle.
- **Risque d'écriture partielle réel et significatif** : si l'appel n°12 sur 21 échoue (coupure réseau, session expirée en cours de route, permission révoquée entre-temps), le client a déjà committé 11 mois au nouveau montant et les 10 restants gardent l'ancien — un état **silencieusement incohérent** avec l'intention métier explicite de l'utilisateur (« ces charges sont rigoureusement constantes »). Pire : `charges-tab.tsx` n'affiche qu'un seul mois à la fois — rien dans l'UI actuelle ne signale visuellement qu'un report a été interrompu à mi-chemin ; l'utilisateur devrait naviguer manuellement sur les 21 mois pour s'en apercevoir.
- Une boucle client ne peut pas être rendue atomique sans un mécanisme de compensation (rollback manuel des appels déjà réussis), ce qui est plus complexe à écrire correctement qu'une transaction serveur.

### Route en lot (recommandée)

- Un seul appel HTTP, une seule `prisma.$transaction` côté serveur qui exécute les upserts pour toute la plage — tout ou rien (R4), exactement le patron déjà en place pour `genererPlanVaguesPrevues` (qui gère un volume comparable ou supérieur — jusqu'à 19 vagues × plusieurs lignes dérivées — dans une transaction unique).
- Latence dominée par une seule aller-retour réseau + N upserts dans la même transaction Postgres (N ≤ 21) — plus rapide que 21 requêtes séparées, pas seulement plus sûr.
- Aucun risque d'état partiel visible côté client : soit la réponse 200 arrive et les 21 (ou moins) mois sont à jour, soit une erreur est renvoyée et **rien** n'a été écrit.

**Conclusion : route en lot.** Le volume (21) ne justifierait pas à lui seul une nouvelle route si la latence était le seul critère — mais l'exigence d'atomicité sur une donnée que l'utilisateur déclare explicitement constante est le critère décisif, pas une préférence de principe pour les endpoints en masse. **Ceci transforme la story en UI+API** : le @developer devra écrire la route + son schéma Zod + des tests d'intégration (transaction, rollback, garde `assertEntierColonneInt`), en plus du composant UI.

### Signature proposée

```
POST /api/previsions/postes/[id]/charges/reporter
```

Body :
```ts
{
  montantFCFA: number;       // >= 0
  moisDebutAbsolu: number;   // entier >= 0, mois de départ inclus
  moisFinAbsolu: number;     // entier >= moisDebutAbsolu, mois de fin inclus
}
```

Schéma Zod (`src/lib/validation/previsions.schema.ts`) :
```ts
export const reporterChargeMensuelleSchema = z.object({
  montantFCFA: nonNegativeNumber,
  moisDebutAbsolu: positiveInt,
  moisFinAbsolu: positiveInt,
}).refine((d) => d.moisFinAbsolu >= d.moisDebutAbsolu, {
  message: "moisFinAbsolu doit etre superieur ou egal a moisDebutAbsolu.",
  path: ["moisFinAbsolu"],
});
export type ReporterChargeMensuelleInput = z.infer<typeof reporterChargeMensuelleSchema>;
```

Query (`src/lib/queries/previsions-charges.ts`), signature calquée sur `upsertChargeMensuelle` :
```ts
export async function reporterChargeMensuelle(
  posteId: string,
  siteId: string,
  montantFCFA: number,
  moisDebutAbsolu: number,
  moisFinAbsolu: number
): Promise<ChargeMensuellePrevue[]>
```
— vérifie `assertEntierColonneInt` sur les deux bornes (même piège Prisma 7 que l'existant), résout le `poste` une fois (`findFirst` par `id` + `siteId`, comme `upsertChargeMensuelle`), puis exécute dans **une seule** `prisma.$transaction` une boucle d'`upsert` sur chaque `moisAbsolu` de la plage (un `upsert` par mois reste nécessaire — la contrainte `@@unique` empêche un `createMany` brut de gérer le cas déjà-existant — mais l'atomicité vient de l'enveloppe `$transaction`, pas d'un `createMany` seul). Retourne le tableau des lignes créées/mises à jour, pour que le client remplace directement son état local sans refetch complet (cohérent avec le patron `handleSave` actuel).

Permission : `PREVISIONS_GERER` (identique à la route unitaire — c'est un acte de gestion/saisie, pas de paramétrage).

Nommage : `POST` plutôt que `PUT` car ce n'est pas idempotent au sens strict d'un upsert unique par ressource adressée par URL — c'est une opération de commande (« reporter »), cohérent avec le `POST .../vagues/generer` déjà en place pour une opération en lot comparable.

---

## 4. Aperçu avant validation (point le plus important)

**Les données mensuelles sont déjà chargées côté client** : `ChargesTab` reçoit `initialCharges` (toutes les `ChargeMensuellePrevue` du scénario, tous postes et tous mois confondus) et les garde dans l'état `charges` — jamais filtrées à la source, seulement dérivées localement (`chargesDuMois` via `useMemo`) pour l'affichage du mois courant. **Aucune lecture réseau supplémentaire n'est nécessaire pour construire l'aperçu.**

Calcul de l'aperçu, entièrement côté client, avant tout appel réseau :
```ts
const moisConcernes = Array.from(
  { length: moisFinAbsolu - moisDebutAbsolu + 1 },
  (_, i) => moisDebutAbsolu + i
);
const moisDejaSaisis = moisConcernes
  .map((m) => ({ moisAbsolu: m, charge: charges.find((c) => c.posteId === posteId && c.moisAbsolu === m) }))
  .filter((x) => x.charge !== undefined);
```
L'aperçu affiche, avant tout bouton de confirmation :
- Le nombre total de mois concernés et leurs bornes calendaires (réutiliser `libelleMois(dateDebutPlan, moisAbsolu)`, déjà défini dans le fichier).
- Le nombre de mois qui **seront écrasés** (`moisDejaSaisis.length`) avec, pour chacun, l'ancien montant et le libellé du mois — jamais un total agrégé qui masquerait lesquels.
- Si `moisDejaSaisis.length === 0` : message explicite « aucun mois existant ne sera écrasé », pas une absence de message (un silence pourrait être lu comme une absence d'information plutôt qu'une confirmation positive).

Ceci reproduit exactement le patron déjà validé par la review PR2-bis pour `generer-plan-dialog.tsx` (aperçu chiffré affiché avant toute confirmation, jamais un écrasement silencieux) — sauf qu'ici l'aperçu ne nécessite même pas d'appel réseau (`GET` dry-run), contrairement au plan d'empoissonnement qui doit interroger le moteur : un avantage net pour cette story.

**Prérequis pour la plage « jusqu'à la fin de l'horizon »** : `ChargesTab` doit recevoir `horizonMois` (disponible dans `projection.horizonMois` au niveau du Server Component / `scenario-detail-client.tsx`, mais **pas encore threadé jusqu'à `ChargesTab`** — modification nécessaire, cf. section 7). Cas limite à traiter explicitement : si `erreurProjection !== null` (la projection a levé une exception, ADR-053/PR2.4), `horizonMois` peut être absent ou non fiable — l'option « jusqu'à la fin de l'horizon » doit alors être désactivée avec un message, jamais silencieusement bornée à une valeur par défaut arbitraire.

---

## 5. Réversibilité

**Recommandation : confirmation explicite avec récapitulatif, pas d'undo.**

Un undo à coût raisonnable supposerait de mémoriser les anciennes valeurs (déjà disponibles via `moisDejaSaisis` ci-dessus) et de proposer un bouton « Annuler » dans un toast après l'application. Mais ce n'est **pas** à coût raisonnable ici pour une raison précise : parmi les mois de la plage, certains n'ont **aucune** ligne `ChargeMensuellePrevue` existante avant le report (`moisDejaSaisis` exclut ces mois). Un « annuler » correct devrait, pour ces mois-là, **supprimer** la ligne nouvellement créée (retour à « pas de valeur saisie »), pas la remettre à `0` (`0` est une valeur saisie valide, différente de « rien »). Or ni la route unitaire ni la route en lot proposée ne portent de capacité de suppression de `ChargeMensuellePrevue` — en ajouter une uniquement pour servir un undo serait une extension de périmètre non demandée par la story, et un undo partiellement correct (qui remet les mois pré-existants à leur ancienne valeur mais laisse les mois nouvellement créés à `montantFCFA` au lieu de les effacer) serait pire qu'aucun undo : il donnerait l'illusion d'une annulation complète alors qu'elle ne l'est pas.

L'aperçu déjà décrit en section 4 rend une confirmation explicite suffisante : l'utilisateur voit, avant de cliquer sur « Appliquer », exactement combien de mois seront touchés et lesquels seront écrasés — le risque d'erreur qu'un undo viserait à corriger est déjà largement réduit en amont par cet aperçu.

---

## 6. Clés i18n à ajouter (fr + en)

Nouveau bloc `reporterChargeDialog` dans `src/messages/{fr,en}/previsions.json`, à ajouter au même niveau que `chargesTab`/`posteForm` (parité stricte à maintenir : chaque clé ci-dessous doit exister dans les deux fichiers, aucune valeur vide).

Français :
```json
"reporterChargeDialog": {
  "triggerButton": "Reporter sur plusieurs mois",
  "dialogTitle": "Reporter la charge — {libelle}",
  "description": "Applique un même montant à plusieurs mois consécutifs pour ce poste.",
  "fields": {
    "montant": {
      "label": "Montant (FCFA)",
      "placeholder": "0"
    },
    "plage": {
      "label": "Plage de mois"
    }
  },
  "plage": {
    "depuisMoisCourant": "Depuis ce mois jusqu'à la fin du plan",
    "tousLesMois": "Tous les mois du plan"
  },
  "errors": {
    "montantInvalide": "Le montant doit être un nombre positif ou nul.",
    "horizonIndisponible": "Horizon du plan indisponible pour le moment.",
    "generic": "Une erreur est survenue."
  },
  "apercu": {
    "title": "Aperçu du report",
    "moisConcernes": "{count} mois concernés ({debut} → {fin})",
    "moisEcrases": "{count} mois seront écrasés (valeur actuelle remplacée)",
    "aucunEcrasement": "Aucun mois existant ne sera écrasé.",
    "detailEcraseligne": "{mois} : {ancien} → {nouveau}"
  },
  "previewButton": "Voir l'aperçu",
  "previewing": "...",
  "backButton": "Retour",
  "confirmButton": "Appliquer",
  "confirming": "Application en cours..."
}
```

Anglais (miroir strict, mêmes clés) :
```json
"reporterChargeDialog": {
  "triggerButton": "Roll over to several months",
  "dialogTitle": "Roll over charge — {libelle}",
  "description": "Applies the same amount to several consecutive months for this item.",
  "fields": {
    "montant": {
      "label": "Amount (FCFA)",
      "placeholder": "0"
    },
    "plage": {
      "label": "Month range"
    }
  },
  "plage": {
    "depuisMoisCourant": "From this month to the end of the plan",
    "tousLesMois": "All months of the plan"
  },
  "errors": {
    "montantInvalide": "The amount must be a positive number or zero.",
    "horizonIndisponible": "Plan horizon currently unavailable.",
    "generic": "An error occurred."
  },
  "apercu": {
    "title": "Rollover preview",
    "moisConcernes": "{count} months affected ({debut} → {fin})",
    "moisEcrases": "{count} months will be overwritten (current value replaced)",
    "aucunEcrasement": "No existing month will be overwritten.",
    "detailEcraseligne": "{mois}: {ancien} → {nouveau}"
  },
  "previewButton": "Preview",
  "previewing": "...",
  "backButton": "Back",
  "confirmButton": "Apply",
  "confirming": "Applying..."
}
```

18 clés feuilles ajoutées de chaque côté (`fr`/`en`), parité stricte à vérifier par `npx vitest run src/__tests__/integration/i18n-completeness.test.ts`. Le namespace `previsions` est déjà dans toutes les listes `describe`-loop de ce fichier — **aucune modification de ce test n'est nécessaire**, contrairement à ce qu'une lecture rapide de la consigne pourrait laisser craindre. À vérifier néanmoins par le @developer en fin de story (ne pas supposer, exécuter le test).

---

## 7. Fichiers à créer / modifier

**Créer :**
- `src/app/api/previsions/postes/[id]/charges/reporter/route.ts` — `POST`, `requirePermission(PREVISIONS_GERER)`, validation Zod, appel à `reporterChargeMensuelle`.
- `src/components/previsions/reporter-charge-dialog.tsx` — dialogue 2 étapes (saisie → aperçu → confirmation), `<DialogTrigger asChild>` (R5), variables CSS du thème uniquement (R6).
- `src/app/api/previsions/postes/[id]/charges/reporter/__tests__/route.test.ts` — tests d'intégration (transaction atomique, rollback sur erreur au milieu de la plage, garde `assertEntierColonneInt`, permission).
- Test(s) composant pour `reporter-charge-dialog.tsx` (aperçu calculé correctement, aucun appel réseau avant confirmation, mobile 360px).

**Modifier :**
- `src/lib/validation/previsions.schema.ts` — ajouter `reporterChargeMensuelleSchema`.
- `src/lib/queries/previsions-charges.ts` — ajouter `reporterChargeMensuelle` (transaction).
- `src/components/previsions/charges-tab.tsx` — ajouter le bouton/dialogue par carte de poste ; étendre `setCharges` pour fusionner un tableau de lignes (pas seulement une ligne) après un report réussi ; recevoir et transmettre `horizonMois`.
- `src/components/previsions/scenario-detail-client.tsx` — thread `projection.horizonMois` (et `erreurProjection` si l'option « fin de l'horizon » doit être désactivée en cas d'erreur) jusqu'à `ChargesTab`.
- `src/components/previsions/api-types.ts` — ajouter le type de payload/réponse si un DTO dédié est jugé utile (sinon réutiliser `ChargeMensuellePrevueDTO[]`).
- `src/messages/fr/previsions.json` et `src/messages/en/previsions.json` — bloc `reporterChargeDialog` (section 6).

**Ne pas toucher (hors périmètre absolu, rappel) :** tout fichier sous `src/lib/previsions/` (moteur), tout ce qui touche rapprochement/reprévision/exports/comparaison prévu-réel.

---

## 8. Contraintes rappelées au @developer

- **R5** : `<DialogTrigger asChild>` obligatoire pour le nouveau bouton de report.
- **R6** : aucune couleur hexadécimale en dur — réutiliser les classes/variables déjà en place dans `charges-tab.tsx`/`generer-plan-dialog.tsx` (`text-danger`, `text-muted-foreground`, etc.).
- **R4** : la route en lot doit être une seule `prisma.$transaction`, jamais une boucle de `upsertChargeMensuelle` appelés indépendamment depuis la route (ce qui recréerait le risque d'écriture partielle que cette story cherche justement à éviter).
- **R8** : `siteId` filtré à chaque lecture/écriture, comme l'existant (`auth.activeSiteId`, jamais un `siteId` du payload).
- Aucune chaîne en dur dans le composant — toutes les clés listées en section 6 doivent être utilisées via `useTranslations("previsions")`.
- Aucun `any` — les types `ChargeMensuellePrevueDTO[]`/`ReporterChargeMensuelleInput` doivent être explicites de bout en bout.
- Mobile first 360px — dialogue testé visuellement/par test à cette largeur, cohérent avec `generer-plan-dialog.tsx`.

---

## Risques identifiés

1. **`horizonMois` non threadé aujourd'hui jusqu'à `ChargesTab`** — modification obligatoire de `scenario-detail-client.tsx`, sans quoi l'option « jusqu'à la fin de l'horizon » ne peut pas être implémentée correctement. Impact : Moyen. Mitigation : décrite en section 7.
2. **Cas `erreurProjection !== null`** — si la projection a échoué, `horizonMois` peut ne pas être fiable ; l'option correspondante doit être désactivée explicitement, pas silencieusement bornée. Impact : Moyen si non traité (résultat : un report « jusqu'à la fin » sur un horizon erroné). Mitigation : décrite en section 4.
3. **Extension de la story en UI+API** — le @developer devra aussi écrire la route, son schéma Zod et ses tests d'intégration, pas seulement le composant. Impact : planifier le temps en conséquence, signalé explicitement dans la consigne du sprint.
4. **Undo non implémenté** — un utilisateur qui se trompe de montant doit repasser par le dialogue de report ou corriger mois par mois via la saisie unitaire existante ; ce n'est pas une régression (la route unitaire reste disponible), mais à documenter dans le message de confirmation si jugé utile.
5. **Cohérence de l'état local après un report réussi** — `setCharges` dans `charges-tab.tsx` ne gère aujourd'hui qu'une seule ligne remplacée à la fois (`handleSave`) ; le @developer doit étendre cette logique pour fusionner un tableau de lignes sans dupliquer ni perdre de lignes existantes pour d'autres postes/mois.

## Prérequis manquants

- Aucun bloquant en base ou en migration : `ChargeMensuellePrevue` et sa contrainte `@@unique([posteId, moisAbsolu])` existent déjà, aucune modification de schéma n'est nécessaire pour cette story.
- Le seul prérequis de code est le threading de `horizonMois` (section 7, point 1) — à faire dans la même story, pas une dépendance externe bloquante.

## Recommandation

**GO.** La story est réalisable sans toucher au moteur ni au schéma. Elle s'étend légitimement en UI+API du fait de l'exigence d'atomicité — à budgétiser explicitement. Points à corriger/prévoir avant de considérer la story terminée : threading de `horizonMois` jusqu'à `ChargesTab`, gestion explicite du cas `erreurProjection`, et respect strict du patron transactionnel déjà validé par la review PR2-bis (`genererPlanVaguesPrevues`) pour la nouvelle route.

---

## Ligne de base factuelle (exécutée)

```
npm run build   → succès, aucune erreur.
npx vitest run  → 267 fichiers de test (263 passés, 4 skippés) ; 7487 tests passés, 19 skippés, 26 todo, 0 échec.
```

Conforme à la ligne de base attendue (267 fichiers, 7487 tests, 0 échec).
