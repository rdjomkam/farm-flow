# Sprint PR3-bis — L'écran d'administration du mapping

**Statut du sprint : FAIT**

## Contexte

PR3 a livré le rapprochement prévu/réel et le bac « Non rapproché », mais aucun écran ne consomme
`GET /api/previsions/mapping-rapprochement/non-mappees` : l'exploitant voit un montant non
rapproché dans l'onglet Rapprochement sans disposer d'aucun moyen d'agir dessus. À ce jour,
`MappingRapprochement` et `ClotureMois` sont vides sur **tous** les sites — sans cet écran, aucune
catégorie réelle d'aucun site n'est aujourd'hui rapprochable.

Ce sprint livre l'écran d'administration du mapping, en 5ᵉ sous-onglet du `Tabs` imbriqué existant
de `rapprochement-tab.tsx` (`mensuelle` / `cumulee` / `parVague` / `topEcarts` / **`mapping`**) :
- voir les catégories réelles non mappées (4 sources, y compris les granulométries) ;
- créer un mapping à partir d'une catégorie non mappée (remplacement en bloc du tableau actif,
  jamais un ajout unitaire) ;
- consulter et modifier les mappings existants, avec leur numéro de version affiché.

Backend déjà existant et stable pour les 3 capacités (voir/créer/consulter) — ce sprint est un
sprint **UI pur** (+ tests), à l'exception d'une story de validation de schéma mineure et optionnelle.

Référence : `docs/analysis/pre-analysis-sprint-PR3-bis.md` (verdict **GO AVEC RÉSERVES**).

## Stories

| Story | Titre | Type | Agent | Statut | Dépendances |
|---|---|---|---|---|---|
| **PR3bis.1** | Validation `cibleId`/`cibleType` dans `ligneMappingRapprochementInputSchema` (mineure, optionnelle) | SCHEMA | @db-specialist | FAIT | Aucune |
| **PR3bis.2** | Propager `permissions` à `RapprochementTab` (prérequis strict des stories UI suivantes) | UI | @developer | FAIT | Aucune |
| **PR3bis.3** | Sous-onglet Mapping — liste des catégories réelles non mappées | UI | @developer | FAIT | PR3bis.2 |
| **PR3bis.4** | Sous-onglet Mapping — création d'un mapping depuis la liste des non-mappées | UI | @developer | FAIT | PR3bis.3, PR3bis.1 (si livrée) |
| **PR3bis.5** | Sous-onglet Mapping — consultation + modification des mappings existants avec version | UI | @developer | FAIT | PR3bis.3 |
| **PR3bis.6** | Tests du sous-onglet Mapping (rendu, traduction granulométrie, état vide, POST en bloc, permissions, garde de fermeture de dialogue) | TEST | @tester | FAIT | PR3bis.2 à PR3bis.5 |
| **PR3bis.7** | Review de sprint (R1-R11, mobile 375px réel) | REVIEW | @code-reviewer | FAIT | Toutes les précédentes |

Pipeline par story : @pre-analyst → agent assigné → @tester → @code-reviewer → @knowledge-keeper,
sauf PR3bis.6 (@tester seul) et PR3bis.7 (@code-reviewer → @knowledge-keeper), conformément à
`docs/PROCESSES.md`.

## Contraintes du sprint

- **Ne jamais toucher `src/lib/previsions/`** (moteur pur, recette protégée à **≥ 2 709 assertions,
  0 écart**). Ce sprint consomme des routes API déjà stables ; si une story UI semble exiger un
  changement dans `rapprochement.ts`/`route-orchestration.ts`, c'est un signal d'alarme — la
  pré-analyse doit être rouverte, pas contournée.
- **Lecture seule stricte sur le domaine réel** (`Depense`/`Vente`/`MouvementStock`, ADR §5.1(a) et
  §15.6 dernier paragraphe) — le mapping n'écrit que dans `MappingRapprochement`, jamais dans le
  domaine réel.
- **Lecture seule stricte sur le scénario `EXCEL-V12`** — aucune story de ce sprint n'a de raison
  d'écrire dans ses données (vagues, alevins, calibres, paliers, apports, journal, charges,
  `ParametresPrevision`).
- **i18n fr + en complète** — aucun libellé en dur, y compris le bandeau de portée site et
  l'avertissement sur le scénario de la cible (voir pré-analyse §2 et R1), tous deux critères
  d'acceptation obligatoires, pas des détails cosmétiques.
- **Mobile first 375px** — cartes empilées, pas de tableau (CLAUDE.md) ; le sous-onglet Mapping
  reste dans le même `overflow-x-auto`/`scrollbar-hide` déjà en place pour le `TabsList` imbriqué
  (`rapprochement-tab.tsx:87-93`), aucun nouveau mécanisme de scroll à inventer. Le sous-onglet ne
  dépend d'aucun mois sélectionné — il ne doit pas lire `moisSelectionne`.
- **R5** — `DialogTrigger asChild` si un `Dialog` est utilisé pour le formulaire de création/
  modification.
- **R6** — variables CSS du thème (`var(--primary)`, etc.), jamais de couleur en dur.
- **Réutiliser `useDialogCloseGuard`** (`src/hooks/use-dialog-close-guard.ts`) si un `Dialog` est
  choisi — signature `useDialogCloseGuard(isDirty: boolean)`, à spreader sur `<DialogContent
  onInteractOutside={...} onEscapeKeyDown={...}>` (exemple : `aliment-form-dialog.tsx:84`).
- **Réutiliser le référentiel i18n existant `stock.produits.taillesGranule.*`**
  (`src/messages/fr/stock.json`, `src/messages/en/stock.json`) pour traduire les granulométries —
  ne jamais créer un second référentiel. Pour le littéral `"INCONNU"` renvoyé par la source
  `MOUVEMENT_STOCK`, ajouter la clé `stock.produits.taillesGranule.INCONNU` (cohérent avec le
  pattern existant) plutôt qu'un référentiel séparé.
- **POST = remplacement en bloc, jamais un ajout unitaire.** `creerVersionMappingSchema` exige un
  tableau complet ; toute création/modification doit d'abord `GET` le mapping actif complet, fusionner
  la ligne voulue, puis `POST` le tableau entier — un POST partiel désactiverait silencieusement
  toutes les autres lignes actives du site.
- **Bandeau de portée obligatoire** : le mapping est site-scopé (`MappingRapprochement.siteId`),
  pas scénario-scopé, alors que l'écran est rendu sous une URL de scénario — la bande d'information
  doit dire explicitement que le mapping s'applique à tout le site, pas seulement au scénario affiché.
- **Avertissement sur la portée de la cible (R1 de la pré-analyse)** : le formulaire de création
  doit peupler les listes Poste/Aliment exclusivement depuis le scénario actuellement affiché et
  avertir explicitement que ce mapping cessera de fonctionner correctement pour un nouveau scénario
  tant qu'il n'est pas remis à jour, si le scénario cible est archivé.
- **Consultation limitée à la version active** pour ce sprint (R2 de la pré-analyse) — pas de
  navigation dans l'historique des versions par mois clôturé, explicitement reporté.
- **Blocage par permission** : toutes les actions d'écriture (création/modification) désactivées
  (pas masquées) si `!permissions.includes(Permission.PREVISIONS_PARAMETRER)`.

## Critères de fin de sprint

- `npx vitest run` — **trois passages consécutifs, 0 échec**.
- Recette **≥ 2 709 assertions, 0 écart**.
- `npm run build`.
- `npx prisma migrate deploy`.
- Rendu vérifié à **375px et 1280px** (pas seulement jsdom — cf. ERR-157, vérification en
  environnement de rendu réel si un mécanisme de mise en page non trivial est introduit).
- **`EXCEL-V12` inchangé**, vérifié par comptage SQL avant/après : 19 vagues / 602 500 alevins, 3
  calibres, 4 paliers, apports = 30 000 000, journal = 34 400 000, 4 postes × 21 mois = 20 580 000,
  `ParametresPrevision` inchangée colonne par colonne.

## Clôture du sprint — mesures réelles

Toutes les stories sont `FAIT`. Sprint livré et validé.

- **Tests** : 3 passages consécutifs de `npx vitest run` **strictement identiques** — **306 fichiers /
  9 413 tests, 26 todo, 0 skip, 0 échec, aucune flakiness**. Mesures obtenues avec `DATABASE_URL`
  exportée ; sans elle, les tests DB-gated sont **silencieusement skippés** (cf. **ERR-116**).
- **Recette du moteur** : `src/lib/previsions/` → **2 709 / 2 709, 0 écart**. **Aucun fichier du
  moteur modifié** (contrainte du sprint respectée).
- **Build** : `npm run build` → **EXIT=0**.
- **Migrations** : `npx prisma migrate deploy` → **aucune migration en attente** (170 migrations).
- **Falsification** : **11 règles falsifiées et chiffrées, (a) → (k)**. Un seul trou détecté et
  comblé (**correctif C5**, dont la falsification **(i)** tombait à 0 test). La falsification **(j)**
  (**correctif D1**) tombe à **0 test** — **trou de couverture assumé et documenté, non masqué** : le
  défaut protégé est une fenêtre de rendu d'une frame, non observable par la suite RTL.
- **Vérification en navigateur réel** (Chromium/Playwright, **ERR-157**) : **deux passes, à 375 px et
  1280 px**. Tous les correctifs tiennent. Onglets N1 `scrollWidth 977 / clientWidth 343` sur une
  seule rangée défilable, sous-onglets `518 / 343`, **aucun débordement horizontal de page**
  (`documentElement.scrollWidth === innerWidth`), dialog **non rogné** à 375 px. Garde de fermeture
  `useDialogCloseGuard` **prouvée avec une valeur réellement modifiée** (Échap et clic extérieur
  bloquent, « Annuler » reste l'issue).
- **`EXCEL-V12` : strictement inchangé**, vérifié par SQL avant/après — 19 vagues prévues, 602 500
  alevins, 3 `AlimentPrevision`, 4 `PalierRemise`, apports 30 000 000, journal 34 400 000, charges
  20 580 000, `ParametresPrevision` **colonne par colonne y compris `updatedAt`**. Sites jetables
  `vpr3b_site` et `vpr3c_site` créés puis supprimés, **0 résidu sur 13 tables**.
- **Review** : `docs/reviews/review-sprint-PR3-bis.md` — verdict **VALIDÉ SOUS RÉSERVE** sur les deux
  passes, **toutes les réserves corrigées ensuite** (C1 → C6, puis D1/D2).
- **Capitalisation** : **ERR-174 à ERR-178** créées ; **ERR-116** et **ERR-168** enrichies.

## Points ouverts — NON traités, à porter en backlog (pas des stories de ce sprint)

| Nature | Point |
|---|---|
| Risque structurel non corrigé, **hors périmètre** | `MappingRapprochement.cibleId` est **site-scopé** alors que `PostePrevision`/`AlimentPrevision` sont **scénario-scopés** (ADR-053 §3.9). **Mitigation UI en place** (cibles peuplées depuis le scénario affiché, alerte explicite en édition) ; le **correctif structurel reste à concevoir dans une story dédiée**. |
| Dette signalée, **hors périmètre** | `src/components/ventes/vente-detail-client.tsx` et `src/components/ventes/depense-vente-dialog.tsx` portent des tables `CATEGORIE_LABELS` **codées en dur, non accentuées, indépendantes du référentiel i18n** (cf. **ERR-176**). |
| Dette signalée, **hors périmètre** | Libellés d'interface **non accentués** sur `/depenses` (titre « Depenses », « payee », « recurrentes configurees ») — hors du périmètre du correctif C4, qui ne visait que `categories.*`. |
