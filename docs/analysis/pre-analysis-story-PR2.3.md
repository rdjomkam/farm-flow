# Pré-analyse Story PR2.3 — Écrans de paramétrage et plan des vagues — 2026-08-03

## Statut : GO AVEC RÉSERVES

## Résumé
Le terrain applicatif (PR2.1 queries, PR2.2 routes API, 22 routes) est complet pour les usages de
cette story et vert (build OK, 6742 tests passés / 19 skipped / 26 todo / 0 échec, recette moteur
920/920 dont 842 de recette pure). Le patron UI du dépôt (Server Component charge, Client Component
mute via TanStack Query + `useApi`, cartes empilées mobile-first, permission passée en prop) est
stable et directement transposable. **Le point réellement bloquant n'est pas dans l'API, il est dans
l'outillage transverse manquant : aucun composant Tooltip/Popover n'existe dans le dépôt**
(`@radix-ui/react-tooltip`/`@radix-ui/react-popover` absents de `package.json`), alors que l'exigence
§7.4 (« tout chiffre calculé est explicable au clic/survol ») est non négociable et structurante pour
PR2.3 **et** PR2.4. De même, aucun helper de formatage ne respecte encore les règles exactes du §7.4
(0 décimale sur les montants, zéro affiché « – », pourcentage/tonnage à 1 décimale) — `formatXAF`
existant a 2 décimales, en conflit direct avec la règle « aucune décimale sur les montants » à
trancher explicitement, pas en silence. Ce sont des livrables transverses à construire en début de
story, pas des blocages de fond.

## 1. Inventaire des patrons UI réels du dépôt

Lu intégralement : `src/components/vagues/vagues-list-client.tsx`, `src/components/releves/releve-form-client.tsx`
+ `src/hooks/use-releve-form.ts` (indirectement via les props), `src/app/(farm)/vagues/page.tsx` →
`src/components/pages/vagues-page.tsx`, `src/hooks/queries/use-vagues-queries.ts`, `src/hooks/use-api.ts`,
`src/components/calibrage/step-groupes.tsx`, `src/components/abonnements/gerer-ressources-client.tsx`.

- **Frontière Server/Client.** La page (`src/app/(farm)/vagues/page.tsx`, ré-export de
  `src/components/pages/vagues-page.tsx`) est un **Server Component async**, sans `"use client"` :
  elle appelle `getServerSession()`, `checkPagePermission(session, Permission.X)` (redirige/`AccessDenied`
  si absent), puis charge les données **directement via les queries Prisma** (`getVagues`,
  `getBacsLibres`, `prisma.configElevage.findMany(...)`) en `Promise.all` — **jamais un `fetch` vers sa
  propre API** depuis le Server Component. Les permissions résolues et les données initiales sont
  passées en props à un composant `"use client"` (`VaguesListClient`).
- **Chargement des données côté client.** Le composant client réhydrate avec `initialData` via un hook
  TanStack Query dédié (`useVaguesList(undefined, { initialData: initialVagues })`,
  `src/hooks/queries/use-vagues-queries.ts`), qui appelle un **service de domaine**
  (`useVagueService()`) plutôt qu'un `fetch` brut. Toute mutation (`useCreateVague`) suit le même
  principe : `useMutation` + service.
- **Formulaires.** Pas de librairie de formulaire (pas de react-hook-form/formik) : état local
  (`useState` par champ ou objet), validation manuelle synchrone au `handleSubmit`
  (`Record<string, string>` d'erreurs affichées inline sous chaque champ), pas de schéma zod côté
  client (zod n'existe que côté serveur, `src/lib/validation/*.schema.ts`). `releve-form-client.tsx`
  délègue tout l'état à un hook dédié (`useReleveForm`) plutôt que de le porter localement — un
  patron à retenir si les écrans PR2.3 ont un état complexe (ex. le formulaire scénario + paramètres).
- **Remontée des erreurs API à l'utilisateur.** Deux mécanismes coexistent :
  1. **Toast automatique** via `useApi`/services (`src/hooks/use-api.ts`) : tout appel via un service
     de domaine affiche un toast d'erreur automatiquement (sauf `silentError`), sans code spécifique
     géré — c'est le chemin par défaut pour les erreurs génériques.
  2. **Interception manuelle d'un code d'erreur métier**, précédent direct et transposable :
     `src/components/abonnements/gerer-ressources-client.tsx` fait un `fetch` brut (pas via
     `useApi`/service), parse `data.code` (`"QUOTA_DEPASSE"`) **avant** de retomber sur un message
     générique. **C'est exactement le patron à répliquer pour intercepter
     `code: "VAGUE_PREVUE_DEJA_RATTACHEE"`** (409) et déclencher le flux de scission plutôt qu'un
     simple toast d'échec (voir section 4).
- **Composants `src/components/ui/` réutilisables pour PR2.3** : `Dialog`/`DialogTrigger`/`DialogContent`/
  `DialogFooter` (R5 : `asChild` déjà pratiqué partout), `Tabs`, `Select`, `Input` (label + erreur
  intégrés), `FormSection`, `EmptyState`, `Badge`, `KpiCard` (bandeau d'indicateurs — plutôt PR2.4),
  `MultiSelect`, `ExportButton`, `BlockedResourceOverlay`. **Absents et à créer** : `Tooltip`,
  `Popover` (aucune des deux dépendances Radix correspondantes n'est déclarée dans `package.json` —
  seuls `dialog`, `dropdown-menu`, `select`, `tabs`, `collapsible`, `label`, `slot`, `toast` sont
  présents).
- **Pattern de saisie répétée en cartes empilées (calibrage)** : `src/components/calibrage/step-groupes.tsx`
  gère une liste dynamique de groupes (ajout/suppression, `Select` + `Input` par carte), avec un
  **indicateur de répartition en direct** (barre de progression + total réparti / total source,
  couleur success/warning/danger selon l'équilibre). C'est le patron directement transposable pour
  la répartition d'une granulométrie sur les mois du cycle (`RepartitionMoisAliment`, somme = 100 %)
  et pour la liste de charges/postes.

## 2. Le point le plus important — §7.4, saisie vs calcul, explicabilité

**Rien n'existe aujourd'hui dans le dépôt pour ce besoin, ni composant, ni convention.**
Vérifications faites :
- `grep "radix-ui" package.json` : ni `@radix-ui/react-tooltip` ni `@radix-ui/react-popover` ne sont
  déclarés (seulement `dialog`, `dropdown-menu`, `select`, `tabs`, `collapsible`, `label`, `slot`, `toast`).
- `src/components/ui/chart-tooltip.tsx` existe mais c'est un **tooltip Recharts** (rendu conditionné
  par la prop `active` du graphique, pas un composant générique hover/clic réutilisable hors contexte
  de graphique) — ne convient pas tel quel à un survol de cellule de formulaire ou de tableau.
- Aucun composant `ValeurCalculee`/`CalculatedValue`, aucun helper `expliquer(...)` ne préexiste.

**Il faut donc construire ce livrable transverse dès PR2.3**, il resservira intégralement en PR2.4 :
1. **Ajouter la dépendance manquante** : `@radix-ui/react-popover` (recommandé plutôt que
   `react-tooltip` seul, car l'exigence dit « clic **ou** survol » — un Popover Radix gère nativement
   les deux, un Tooltip Radix ne gère que le survol/focus et pas le clic-pour-rester-ouvert sur
   mobile où il n'y a pas de hover). Suivre le précédent `decimal.js` de PR1/ADR-053 §7 : dépendance
   déclarée explicitement dans `package.json`, jamais laissée transitive.
2. **Composant `ValeurCalculee`** (nom proposé, `src/components/previsions/valeur-calculee.tsx`),
   props suggérées : `{ value: React.ReactNode; explication: { label: string; valeur: string }[];
   formule?: string }`. Rendu : la valeur affichée avec un style visuellement neutre (texte
   `text-muted-foreground` ou fond `bg-muted`, jamais la bordure `border-input` d'un champ
   saisissable), un petit indicateur cliquable (icône `Info`/`Calculator` de `lucide-react`, déjà une
   dépendance du projet), qui ouvre un `Popover` listant en langage courant les valeurs sources (ex.
   « Coût aliment (285 sacs × 3 kg × 1 250 FCFA/kg, remise palier 2 appliquée) »). Focus/clic
   accessibles au clavier (Radix Popover gère ça nativement).
3. **Convention de style pour le champ saisissable**, symétrique : bordure `border-input` +
   fond `bg-background` standard (déjà la norme des `Input`/`Select` existants) — la distinction
   visuelle vient donc surtout du fait que les champs calculés **n'utilisent jamais** `Input`/`Select`
   mais un conteneur neutre dédié (`ValeurCalculee`), pas d'une variante CSS d'`Input` à inventer.
4. Ce composant est le candidat naturel à écrire **en premier**, avant les écrans eux-mêmes, car les
   écrans de granulométrie (sacs calculés par mois), de vagues prévues (coût, revenu prévu) et de
   charges en dépendent tous.

## 3. Formats d'affichage du §7.4

Lu `src/lib/format.ts` en entier, et les trois occurrences de `formatPct` dupliquées dans
`src/lib/export/pdf-cout-production.tsx`, `pdf-rapport-vague.tsx`, `pdf-rapport-financier.tsx`.

| Règle §7.4 | Utilitaire existant | Verdict |
|---|---|---|
| Séparateur de milliers systématique | `formatNumber(n, locale)` — `Intl.NumberFormat` 0 décimale | **Réutilisable tel quel** pour les entiers (sacs, alevins, poissons) |
| Aucune décimale sur les montants | `formatXAF`/`formatCFA` | **Conflit direct** : `formatXAF` a **2 décimales fixes** (`minimumFractionDigits: 2`), `formatCFA` a bien 0 décimale mais suffixe `"CFA"` pas `"FCFA"`. Aucun des deux ne correspond exactement à la règle prévisions (0 décimale + suffixe FCFA). **Écart de convention avec le reste de l'app à signaler, pas à trancher en silence** : le domaine opérationnel (ventes, dépenses) affiche aujourd'hui des montants à 2 décimales via `formatXAF` — le module Prévisions introduirait une **nouvelle convention d'affichage** (0 décimale) cohérente avec Excel/le classeur de référence mais divergente du reste de l'app. Décision à documenter explicitement par @developer (nouvel utilitaire `formatMontantPrevision` dédié au module, distinct de `formatXAF`, plutôt que modifier `formatXAF` globalement et risquer une régression visuelle sur tout le reste de l'app) |
| Zéro affiché « – » | Aucun — `formatNumber(0)` retourne `"0"`, pas `"–"` (seul `null`/`undefined` retourne `"–"` aujourd'hui) | **À créer** : variante `afficherZeroCommeTiret` ou option `{ zeroAsDash: true }` sur les nouveaux formatteurs du module |
| Négatifs en rouge | Aucun helper — c'est une question de `className` (`text-danger` déjà utilisé ad hoc ailleurs, ex. `step-groupes.tsx`), pas de formatage de chaîne | À traiter au niveau composant (`className={value < 0 ? "text-danger" : undefined}`), pas dans la fonction de formatage — cohérent avec le seul précédent trouvé (`text-danger`/`text-success`/`text-warning` déjà la convention R6 du dépôt) |
| Pourcentage à 1 décimale | `formatPct` existe **3 fois**, dupliqué indépendamment dans 3 fichiers d'export PDF, **aucun dans `src/lib/format.ts`** — à vérifier au cas par cas si chacune arrondit à 1 décimale (non vérifié en détail, mais la duplication en 3 endroits est déjà un signal : aucune source unique) | **À créer/consolider** : `formatPourcentage(n, decimals=1)` dans `src/lib/format.ts`, réutilisable par PR2.3/PR2.4 et par les 3 exports PDF existants (nettoyage possible mais hors périmètre strict de cette story — à signaler comme dette) |
| Tonnage à 1 décimale | Aucun (`formatWeight` existe pour grammes/kg, pas pour tonnes, et arrondit à 2 décimales en kg) | **À créer** : `formatTonnage(kg, decimals=1)` |

**Recommandation** : créer un fichier dédié `src/lib/previsions/format-previsions.ts` (ou étendre
`src/lib/format.ts` avec des fonctions spécifiques nommées explicitement, ex. `formatMontantPrevision`,
`formatPourcentagePrevision`, `formatTonnagePrevision`) plutôt que de modifier `formatXAF`/`formatNumber`
en place — un changement de leur signature/comportement impacterait silencieusement tout le reste de
l'app (ventes, stock, factures) qui affiche déjà des montants à 2 décimales.

## 4. Le flux de scission (ADR décision 2) — vérifié dans le code

**Route de rattachement** (`src/app/api/previsions/vagues-prevues/[id]/rattacher/route.ts`, lue
intégralement) : `POST` avec `{ vagueId }`, permission `PREVISIONS_GERER` seule. Intercepte
spécifiquement le P2002 sur `vaguePrevueId` **avant** `handleApiError` générique et renvoie :
```json
{ "status": 409, "message": "...", "code": "VAGUE_PREVUE_DEJA_RATTACHEE", "vaguePrevueId": "..." }
```
avec statut HTTP 409 réel. Confirmé conforme à l'énoncé de la mission.

**Route et query de scission** (`.../scinder/route.ts` + `scinderVaguePrevue` dans
`src/lib/queries/previsions-vagues.ts`) :
- Payload : `{ scissions: CreateVaguePrevueInput[] }`, validé par `scinderVaguePrevueSchema`
  (`z.array(createVaguePrevueSchema).min(2, ...)`) — **minimum 2 enfants obligatoires**, pas de
  maximum.
- Chaque scission attend exactement les champs de `createVaguePrevueSchema` : `code` (string, unique
  au sein du scénario — `V7a`, `V7b`...), `dateStockagePrevue` (date ISO), `effectifAlevinsPrevu`
  (entier strictement positif), `poidsMoyenInitialG` (nombre non négatif). **`dureeCycleMoisFigee` est
  copié automatiquement du parent** par la query (pas un champ à saisir par l'utilisateur).
- Effet côté parent : `scinderVaguePrevue` — dans une transaction — crée les enfants avec
  `vaguePrevueParentId = parent.id` puis fait passer le parent à `StatutVaguePrevue.ANNULEE` (jamais
  de suppression physique, conforme ADR décision 2).
- Réponse : `201` avec `{ data: enfants }` (liste des `VaguePrevue` créées, avec
  `INCLUDE_VAGUE_PREVUE_DETAIL`).

**Où le rattachement/la scission doivent vivre dans l'UI** :
- Le rattachement est une action ponctuelle sur une `VaguePrevue` donnée (fiche/détail dans l'écran
  Plan des vagues, ou action de ligne dans la carte de la `VaguePrevue` PLANIFIEE/EN_COURS) — un
  dialogue `Dialog` avec un `Select` de vagues réelles candidates + bouton "Rattacher".
- La scission se déclenche à deux occasions distinctes, l'ADR ne les distingue pas hiérarchiquement :
  (a) **réactivement**, quand la tentative de rattachement échoue en 409 — l'UI doit intercepter
  `code === "VAGUE_PREVUE_DEJA_RATTACHEE"` (patron `gerer-ressources-client.tsx`, fetch brut + lecture
  de `data.code`) et proposer immédiatement, dans le même flux, un dialogue de scission pré-rempli
  avec 2 lignes filles par défaut (code suggéré `${parent.code}a`/`${parent.code}b`, effectif suggéré
  réparti moitié-moitié — pattern "distributeEvenly" déjà vu dans `vagues-list-client.tsx`) ; (b)
  **préventivement**, un bouton "Scinder" indépendant sur toute `VaguePrevue` non encore rattachée,
  sans dépendre d'un rejet préalable — confirmé possible et voulu par la note de clôture PR2.2
  ("aucune dépendance forcée entre les deux routes").
- **Rien ne manque côté API pour ce flux** — il est entièrement réalisable avec les deux routes
  existantes. Le seul travail restant est UI : formulaire de scission à N lignes (minimum 2, patron
  `step-groupes.tsx` : ajout/suppression de cartes, total réparti vs effectif du parent affiché en
  direct, bien que l'API n'impose *pas* que la somme des effectifs des enfants égale l'effectif du
  parent — à vérifier/décider si l'UI veut imposer cette cohérence en plus, ou la laisser à la
  discrétion de l'utilisateur puisque l'API ne l'exige pas).

**Gap mineur signalé, pas bloquant** : le sélecteur de "vague réelle candidate" au rattachement n'a
aucune donnée disponible pour filtrer les vagues déjà rattachées à une autre `VaguePrevue`.
`VagueSummaryResponse` (`src/types/api.ts:295`) n'expose pas `vaguePrevueId`, et `getVagues`
(`src/lib/queries/vagues.ts`) ne le sélectionne ni ne le filtre — vérifié par grep, aucune occurrence.
L'API `rattacherVaguePrevue` rejette bien une vague déjà liée (contrainte unique via P2002, mais sur
`vaguePrevueId`, donc en pratique le rejet porterait sur la tentative de lier une **deuxième**
`VaguePrevue` à une vague déjà rattachée — cas symétrique, pas explicitement documenté ni testé dans
PR2.2 à ma lecture). Sans ce champ, l'UI ne peut proposer qu'une liste brute de toutes les vagues du
site dans le `Select` de rattachement, sans pouvoir grisér/exclure celles déjà utilisées — l'erreur
ne serait détectée qu'à la soumission (409 générique cette fois, pas `VAGUE_PREVUE_DEJA_RATTACHEE`,
puisque la contrainte violée serait sur `Vague.vaguePrevueId` déjà non-null côté vague, pas côté
VaguePrevue). **Décision à prendre par @developer** : soit étendre `VagueSummaryResponse`/`getVagues`
avec `vaguePrevueId` (changement mineur, hors périmètre strict de PR2.2 mais nécessaire pour une bonne
UX), soit accepter un filtrage uniquement côté serveur au clic (moins bon, mais fonctionnellement
correct grâce à la contrainte d'unicité).

## 5. Mobile first — 360px

Règle du projet confirmée : pas de tableau brut sur mobile, cartes empilées (aucune occurrence
`overflow-x-auto`/`<table>` trouvée dans les listes métier `vagues`/`releves`/`alevins`/`reproduction`
— seule `plan-comparaison-table.tsx` (abonnements, contexte différent, comparatif de plans) utilise un
`<table>` avec `overflow-x-auto`, sans variante carte explicite trouvée à côté).

- **Le dépôt résout déjà ce problème pour de la saisie répétée à somme contrainte** :
  `src/components/calibrage/step-groupes.tsx` (répartition d'un effectif source en N groupes, somme
  contrainte, ajout/suppression de cartes, indicateur de progression coloré) est un patron **presque
  identique** à « répartition d'une granulométrie sur les mois du cycle » (`RepartitionMoisAliment`,
  somme = 100 %) — **directement réutilisable** avec `moisCycle` fixe (1..`dureeCycleMois`, pas
  ajout/suppression libre puisque le nombre de mois est fixé par le cycle) plutôt que des groupes
  ajoutables librement.
- **Écran où la contrainte sera réellement difficile : charges mensuelles (poste × mois)**. C'est une
  matrice 2D authentique (N postes × M mois du plan), pas une simple liste à somme contrainte comme
  la répartition aliment. Aucun précédent dans le dépôt ne résout une saisie de matrice 2D en
  cartes empilées à 360px. Deux options possibles, à trancher explicitement par @developer, pas à
  découvrir en cours de développement :
  1. **Poste-primaire** : une carte par poste, dépliable (ou lien vers un sous-écran) listant ses
     mois en cartes empilées verticales — cohérent avec `PostePrevision` comme entité de premier
     niveau, mais rend la vue "tous les postes d'un mois donné" indirecte.
  2. **Mois-primaire** : navigation mois par mois (un sélecteur de mois, puis tous les postes de ce
     mois en cartes) — cohérent avec la logique de trésorerie mensuelle et avec le futur PR2.4 (vue
     mensuelle), mais rend la saisie initiale "remplir toute l'année pour un poste" plus fastidieuse
     (changer de mois à chaque poste).
  Recommandation : mois-primaire, par cohérence avec PR2.4 (déjà prévue "vue mensuelle") et parce que
  la saisie initiale peut se faire au clavier physique (desktop) où la contrainte 360px ne s'applique
  pas — le mobile sert surtout à la consultation/ajustement ponctuel, pas à la saisie initiale
  complète d'un plan de charges sur 21 mois.
- Le journal de dépenses (liste simple, pas de matrice) et les apports en capital (liste simple) ne
  posent pas de difficulté particulière — patron de liste standard (`vagues-list-client.tsx` filtré/
  onglets) suffit.

## 6. Contrôle d'accès côté UI

**Aucun hook ni composant de garde dédié n'existe** (`grep "usePermission\|hasPermission"` : aucune
occurrence dans `src/hooks`). Le patron réel, confirmé par lecture de `vagues-page.tsx` +
`vagues-list-client.tsx`, est en deux temps :
1. **Server Component** : `checkPagePermission(session, Permission.X)` — bloque l'accès à la page
   entière (retourne `<AccessDenied />`) si la permission de lecture minimale manque. Résultat
   (`Permission[]` complet de l'utilisateur) passé en prop au client component.
2. **Client Component** : conditionnels inline sur le tableau de permissions reçu en prop, ex.
   `{permissions.includes(Permission.VAGUES_CREER) && <Dialog>...</Dialog>}` — pas de hook, pas de
   composant `<Can permission="...">`, juste un test de tableau à chaque bouton/action sensible.

**Pour PR2.3** : reprendre ce patron à l'identique — `checkPagePermission(session, Permission.PREVISIONS_VOIR)`
en tête de chaque page, `permissions.includes(Permission.PREVISIONS_GERER)` pour les boutons de
mutation (créer vague prévue, rattacher, scinder), `permissions.includes(Permission.PREVISIONS_PARAMETRER)`
pour les écrans de paramètres/référentiel aliments/postes. Aucun nouveau mécanisme à inventer.

## 7. Vérifications exécutables

- `npm run build` : **OK**, compilation réussie sans erreur.
- `npx vitest run` : **6742 tests passés / 19 skipped / 26 todo / 0 échec** (242 fichiers passés, 4
  skipped sur 246) — identique à la ligne de base attendue.
- Recette moteur (`src/lib/previsions/__tests__/recette/*.recette.test.ts`) : **920 tests passés** sur
  le dossier `src/lib/previsions/__tests__` en isolation, dont **421 + 421 = 842** dans les deux
  fichiers de recette (`annexe-b-corrigee.recette.test.ts`, `plan-v12-corrige.recette.test.ts`) — la
  ligne de base **842/842** est confirmée intacte, aucune régression du moteur.

## 8. Verdict — GO AVEC RÉSERVES

**GO pour démarrer PR2.3.** Aucune route API manquante ne bloque un écran prévu par le périmètre de
la story — les gaps trouvés sont mineurs et contournables (voir ci-dessous), pas structurels.

**Points que le @developer devra trancher explicitement, pas découvrir en cours de route :**
1. Ajouter `@radix-ui/react-popover` (recommandé) ou `@radix-ui/react-tooltip` à `package.json` avant
   d'écrire le composant `ValeurCalculee`/explicabilité §7.4 — livrable transverse à construire en
   premier, réutilisé par PR2.3 et PR2.4.
2. Convention de formatage des montants prévisionnels (0 décimale) **distincte** de `formatXAF`
   existant (2 décimales) — créer des fonctions dédiées au module (`formatMontantPrevision`, etc.)
   plutôt que modifier `formatXAF` en place et risquer une régression visuelle sur le reste de l'app.
   Consolider si possible les 3 `formatPct` dupliqués dans les exports PDF (dette signalée, pas
   bloquante pour cette story).
3. Choix mois-primaire vs poste-primaire pour l'écran de charges mensuelles à 360px (aucun précédent
   direct dans le dépôt pour une matrice 2D en cartes empilées) — recommandation mois-primaire.
4. Cohérence somme des effectifs enfants = effectif du parent lors d'une scission : l'API ne
   l'impose pas — décider si l'UI l'impose quand même (validation front) ou laisse la liberté totale.
5. Gap mineur : `VagueSummaryResponse`/`getVagues` n'exposent pas `vaguePrevueId` — sans cette
   extension (hors périmètre strict de PR2.2, mais nécessaire pour une bonne UX), le sélecteur de
   rattachement ne peut pas pré-filtrer les vagues déjà liées ; l'API reste correcte (elle rejette
   quand même via contrainte unique), seule l'ergonomie est dégradée. Décision : étendre le DTO
   maintenant (petit changement de query) ou accepter le rejet tardif comme suffisant pour le MVP.

**Aucun manque des routes API de PR2.2 ne bloque un écran de PR2.3** : le détail d'une `VaguePrevue`
(`GET .../vagues-prevues/[id]`) inclut déjà aliments par mois, journal affecté, vague liée et enfants
de scission ; la liste de plan (`GET .../scenarios/[id]/vagues?withAliments=true`) est prévue pour
l'écran plan des vagues ; le calcul (`GET .../scenarios/[id]/calculer`) est pur-lecture et séparé de
la persistance (`PUT .../vagues-prevues/[id]/aliments`), ce qui correspond exactement au flux attendu
« calculer puis, sur choix explicite de l'utilisateur, enregistrer/ajuster ».
