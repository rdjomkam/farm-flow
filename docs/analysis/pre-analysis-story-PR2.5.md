# Pré-analyse Story PR2.5 — Navigation et activation du module — 2026-08-03

## Statut : GO AVEC RÉSERVES

## Résumé

Build et tests sont verts (voir §7) — la mise en garde sur une possible casse de build par le
travail en cours de PR2.3 ne s'est pas matérialisée au moment de cette lecture. **Le point
réellement bloquant n'est pas dans l'API ni l'i18n, il est dans la prémisse même de la story** :
`src/lib/module-nav-items.ts` (le fichier que l'ADR-053 §6 et le sprint désignent explicitement
comme cible d'édition) est du **code mort** — il n'est consommé par aucun composant de navigation
réellement rendu. La navigation réelle vit dans `farm-sidebar.tsx` (`NAV_GROUPS`, hand-roulé) et
`farm-bottom-nav.tsx` (`SHEET_GROUPS`, hand-roulé également), tous deux indépendants de
`MODULE_NAV`. Éditer seulement `module-nav-items.ts` produirait un diff qui compile, ne casse rien,
mais **n'affiche jamais l'entrée Prévisions dans l'application**. Second point structurant :
`SiteModule.PREVISIONS` est absent de `SITE_MODULES_CONFIG`, donc aucun site ne peut aujourd'hui
activer le module via l'UI d'admin — le risque de lien mort en production est donc nul *pour
l'instant*, mais latent. Troisième point : les 5 routes cibles du sprint (Tableau de bord, Plan des
vagues, Prévisions, Dépenses, Paramètres) n'ont **aucune page existante** à ce jour — seules
`/previsions/scenarios` et `/previsions/scenarios/[id]` existent (travail PR2.3 en cours).

## 1. Le mécanisme réel de navigation du dépôt

### 1.1 `src/lib/module-nav-items.ts` — ce qu'il fait, et ce qu'il ne fait plus

Lu intégralement. Structure d'une entrée `MODULE_NAV` :
```typescript
export interface SubNavItem {
  href: string;
  label: string;      // gardé pour compat, pas utilisé pour l'affichage réel
  itemKey: string;     // clé i18n sous navigation.items.*
  icon: React.ComponentType<{ className?: string }>;
}
export interface ModuleNavConfig {
  label: string;              // sert de clé vers MODULE_LABEL_TO_SITE_MODULE (gating module)
  matchPaths: string[];       // préfixes de route qui "appartiennent" au module
  items: SubNavItem[];
}
```
Le gating par `SiteModule` ne se fait **pas** dans ce fichier — il n'y a aucun champ
`siteModule`/`gateModule` sur `ModuleNavConfig`. Le mapping vit ailleurs, dans
`src/lib/permissions-constants.ts` : `MODULE_LABEL_TO_SITE_MODULE: Record<string, SiteModule>`,
indexé par le `label` humain du module (`"Reproduction"`, `"Grossissement"`, etc.). Le gating par
permission n'existe pas non plus dans `module-nav-items.ts` — aucun champ `permission` sur
`SubNavItem`/`ModuleNavConfig`.

**Fait vérifié par `grep` exhaustif** : `MODULE_NAV`/`module-nav-items` n'est importé **nulle part**
dans le dépôt en dehors de lui-même et de `src/__tests__/ui/sprint-nc-nav-cleanup.test.ts`. Le
commentaire du fichier (« Module navigation configurations shared by ModuleSubNav and BottomNav »)
référence un composant `ModuleSubNav` qui **n'existe plus dans le dépôt** (`grep` : zéro occurrence).
Le test `sprint-nc-nav-cleanup.test.ts` documente explicitement, dans son en-tête (`NC.8`), que
`sidebar.tsx`, `bottom-nav.tsx` et `hamburger-menu.tsx` sont des **`DELETED_LEGACY_COMPONENTS`** —
c'est-à-dire que le Sprint NC (nettoyage nav Phase 3) a supprimé les composants qui consommaient
`MODULE_NAV`, sans supprimer ni migrer `module-nav-items.ts` lui-même. **Le fichier ciblé par
l'ADR-053 §6 et par le texte de la story PR2.5 est un vestige d'une architecture de navigation
disparue.**

### 1.2 Les composants réellement rendus

- **`src/components/layout/farm-sidebar.tsx`** (desktop, `md:flex`) : tableau `NAV_GROUPS` local
  (interfaces `NavGroup`/`NavItem` **propres au fichier**, homonymes mais distinctes de celles de
  `nav-gating.ts`), avec `permissionRequired?: Permission` et `moduleRequired?: SiteModule` **par
  groupe** (pas par item). Le filtrage des items individuels à l'intérieur d'un groupe visible passe
  par `ITEM_VIEW_PERMISSIONS[item.href]` (`src/lib/permissions-constants.ts`), une table
  `Record<href, Permission>` qui affine/durcit la permission au niveau de l'item (ex.
  `/settings/config-elevage` exige `GERER_CONFIG_ELEVAGE` même si le groupe ne demande que
  `SITE_GERER`).
- **`src/components/layout/farm-bottom-nav.tsx`** (mobile, `md:hidden`) : deux structures distinctes
  co-existent :
  1. **5 slots primaires fixes** (Accueil, Vagues, Finances, Notes, Menu) — codés en dur dans le JSX,
     pas dans un tableau — `Prévisions` n'est **pas** candidat à un slot primaire (les 5 slots sont
     un choix produit déjà arrêté, non renégociable par cette story).
  2. **`SHEET_GROUPS`** (le menu secondaire ouvert par le bouton "Menu") : même patron que
     `NAV_GROUPS` (`gatePermission` par groupe + `permissionRequired`/`moduleRequired` par item),
     mais structure dupliquée indépendamment — pas un import partagé avec `farm-sidebar.tsx`.
- **`src/lib/nav-gating.ts`** : fonctions pures (`isNavItemVisible`, `isGroupVisible`,
  `getVisibleGroups`, `getVisibleBottomNavItems`) qui définissent un modèle `NavItem`/`NavGroup`
  **générique et bien conçu** (permissions ANY/ALL, `requiredModule`, `superAdminOnly`,
  `alwaysVisible`) — mais **aucun des deux composants réels ne l'utilise** ; `farm-sidebar.tsx` et
  `farm-bottom-nav.tsx` réimplémentent leur propre logique de filtrage inline
  (`.filter(isItemVisible)`/`.map(...).filter(Boolean)`). `nav-gating.ts` est probablement lui-même
  un vestige (ou une tentative de centralisation jamais achevée) — non vérifié plus avant, hors
  périmètre strict de cette pré-analyse, mais à signaler au knowledge-keeper.
- **`ingenieur-sidebar.tsx`/`ingenieur-bottom-nav.tsx`** : aucune trace de "previsions" — cohérent,
  Prévisions est un concept d'exploitation (rôle Farm), pas un besoin Ingénieur. Aucune action
  requise sur ces deux fichiers.

### 1.3 Ce qu'il faut ajouter, et où — concrètement

Pour que l'entrée Prévisions soit **réellement visible** dans l'application, PR2.5 doit toucher (au
minimum) :
1. **`src/components/layout/farm-sidebar.tsx`** : un nouveau groupe dans `NAV_GROUPS`, ex.
   `{ labelKey: "modules.previsions", items: [...5 items...], permissionRequired: Permission.PREVISIONS_VOIR, moduleRequired: SiteModule.PREVISIONS }`.
2. **`src/components/layout/farm-bottom-nav.tsx`** : un nouveau groupe symétrique dans `SHEET_GROUPS`
   (`groupKey: "previsions"`, `gatePermission: Permission.PREVISIONS_VOIR`, mêmes items).
3. **`src/lib/permissions-constants.ts`** : une entrée `ITEM_VIEW_PERMISSIONS["/previsions/parametres"] = Permission.PREVISIONS_PARAMETRER`
   (voir §6) pour durcir l'item "Paramètres" au-delà du gate de groupe `PREVISIONS_VOIR`. Envisager
   aussi `MODULE_LABEL_TO_SITE_MODULE["Prévisions"] = SiteModule.PREVISIONS` **si** ce mapping est
   encore utilisé par un composant vivant (à vérifier au moment du dev — utilisé aujourd'hui
   uniquement par `plan-form-dialog.tsx` et par les éditeurs de modules de site, cf. §2).
4. **`src/lib/module-nav-items.ts`** : ajouter l'entrée `MODULE_NAV` **quand même**, littéralement
   comme demandé par l'ADR-053 §6 — par cohérence documentaire et parce qu'un futur refactor peut le
   réactiver — mais **ne jamais considérer cet ajout comme suffisant** pour le critère d'acceptation
   « l'entrée est visible dans la navigation ». Le test `sprint-nc-nav-cleanup.test.ts` (NC.5/NC.6)
   vérifie des tableaux **dupliqués à la main dans le test**, recopiés depuis les vrais composants —
   si un futur test de non-régression doit couvrir Prévisions, il devra recopier les nouveaux
   `NAV_GROUPS`/`SHEET_GROUPS`, pas lire `module-nav-items.ts`.

**Recommandation forte à trancher explicitement par @developer, pas à découvrir en test manuel** :
signaler ce constat au @project-manager/@architect — la story telle qu'écrite dans l'ADR-053 §6 et
le sprint (« Entrée `MODULE_NAV` ») décrit une architecture obsolète. Le travail réel est dans
`farm-sidebar.tsx` + `farm-bottom-nav.tsx` + `permissions-constants.ts`.

## 2. `SITE_MODULES_CONFIG` — état actuel et conséquences

`src/lib/site-modules-config.ts` (`SITE_MODULES_CONFIG`, 9 entrées : REPRODUCTION, GROSSISSEMENT,
INTRANTS, VENTES, ANALYSE_PILOTAGE, PACKS_PROVISIONING, CONFIGURATION, INGENIEUR, NOTES) **ne
contient toujours pas `SiteModule.PREVISIONS`**, confirmant explicitement la review PR1
(`docs/reviews/review-sprint-PR1.md:80` : « rendue à l'exécution puisque `PREVISIONS` n'est pas dans
`SITE_MODULES_CONFIG` »). Ce tableau est consommé par **deux** éditeurs UI d'activation de module par
site : `src/components/admin/sites/admin-site-modules-editor.tsx` et
`src/components/backoffice/backoffice-site-modules-editor.tsx`.

**Conséquence directe, à ne pas découvrir en recette** : même après PR2.5, **aucun administrateur ne
pourra activer `SiteModule.PREVISIONS` sur un site via l'UI**, faute d'entrée dans
`SITE_MODULES_CONFIG` — le seul moyen de faire apparaître le module serait une écriture directe en
base (`Site.modules`), hors du parcours produit normal. Vérifié également : aucune migration Prisma
du sprint (`20260803120000/...100/...200`) ne touche `Site.modules` — seules les permissions de
`SiteRole` ont été rétro-remplies, jamais le tableau de modules d'un `Site`.

**Ce que la story dit** (`SPRINT-PR2-PREVISIONS.md` ligne 227) : « Gating par `SiteModule.PREVISIONS`
et par permission » — ne mentionne pas explicitement `SITE_MODULES_CONFIG`. La réserve levée en PR1
("réserve 2 levée") ne portait que sur la clé i18n `modules.previsions`, pas sur
`SITE_MODULES_CONFIG` lui-même.

**Recommandation** : deux options, à trancher explicitement, pas en silence :
1. **Ajouter `PREVISIONS` à `SITE_MODULES_CONFIG` dans cette story** — coût minime (une ligne dans un
   tableau, icône déjà disponible via lucide-react), et c'est la seule façon de rendre le module
   testable de bout en bout par le @tester/le PM sans intervention base de données. C'est cohérent
   avec la review PR1 qui disait « à ajouter en même temps que l'entrée dans `SITE_MODULES_CONFIG` ».
2. **Ne pas y toucher**, en documentant explicitement dans les notes de clôture que le module reste
   inactivable via l'UI d'admin tant qu'une story ultérieure n'aura pas traité ce point — au risque
   que PR2.6 (review de sprint) ne puisse pas vérifier visuellement la navigation en conditions
   réelles sans un contournement base de données.

Recommandation de cette pré-analyse : **option 1**, parce que le risque de régression est nul (un
site de plus dans un tableau de configuration togglable, pas un changement de comportement pour les
sites existants) et parce que laisser le point ouvert bloquerait toute vérification manuelle
end-to-end de cette story même.

## 3. i18n — clés à créer, test de complétude identifié

**Test de complétude identifié** : `src/__tests__/integration/i18n-completeness.test.ts`, describe
`"i18n — parite des cles fr/en (tous namespaces)"`, itère sur une liste de namespaces incluant
`"navigation"` et fait `expect(enKeys).toEqual(frKeys)` (égalité stricte, triée) — **échoue
immédiatement si une clé est ajoutée dans un seul des deux fichiers**. Second test dans le même
fichier (describe « couverture globale ») vérifie aussi qu'aucune valeur n'est vide et qu'il y a
`>= 2500` clés fr au total (pas un risque, juste un plancher qu'on ne fait qu'agrandir).

**Autres tests de complétude i18n existants sur `navigation.json`** :
- `src/__tests__/i18n/messages-sprint40.test.ts` (describe `"navigation.json — parité de clés
  fr/en (Sprint 40.1)"`, `"navigation.json — chargement"`) — parité clé par clé, sections de premier
  niveau identiques (`modules`, `items`, `roles`, `actions`, `groups`), valeurs non vides. **Aucun
  compte figé de clés** (pas de `toHaveLength(N)` sur les clés de `items`) — ajouter des clés ne
  casse pas ces tests tant que fr/en restent symétriques.
- `src/__tests__/i18n/messages.test.ts` (ligne 677 : « navigation.json fr et en ont le même nombre de
  clés ») — même exigence de parité de comptage, symétrique, pas un seuil figé.

**Clé `modules.previsions`** : confirmée déjà présente dans `src/messages/fr/navigation.json` et
`src/messages/en/navigation.json` (`"previsions": "Prévisions"` côté fr) — PR1 réserve 2 bien levée,
rien à faire ici.

**Clés `navigation.items.*` à créer** pour les 5 entrées (fr **et** en, noms proposés, à choisir
distincts des clés génériques déjà réutilisées ailleurs comme `items.dashboard`="Dashboard" ou
`items.depenses`="Dépenses", par cohérence avec le patron déjà en place pour les autres modules qui
ont chacun leurs propres clés dédiées — ex. `dashboardReproduction` distinct de `dashboard`) :

| Sous-entrée (§7.3) | Clé `itemKey` proposée | Valeur fr proposée |
|---|---|---|
| Tableau de bord | `items.previsionsDashboard` | "Tableau de bord" |
| Plan des vagues | `items.previsionsPlanVagues` | "Plan des vagues" |
| Prévisions | `items.previsionsVue` | "Prévisions" |
| Dépenses | `items.previsionsDepenses` | "Dépenses" |
| Paramètres | `items.previsionsParametres` | "Paramètres" |

Ces noms sont une **proposition**, pas une prescription figée — @developer peut réutiliser des clés
génériques existantes (`items.dashboard`, `items.depenses`) si le patron du dépôt le permet ailleurs,
mais attention : `items.dashboard` a une valeur volontairement identique fr/en (`"Dashboard"`, testé
explicitement ligne 689 de `i18n-completeness.test.ts` comme « terme technique universel ») — la
réutiliser pour "Tableau de bord" (qui doit être traduit, pas un terme universel) serait incohérent.
Préférer des clés dédiées, comme le fait déjà chaque autre module (`dashboardReproduction`,
`dashboardFinances`, `dashboardClients`, etc. — patron répété 3 fois dans le fichier actuel).

## 4. Réserve 5 de PR1 — `getModuleNavKey()` — diagnostic confirmé, coût et recommandation

Confirmé par lecture de `src/components/abonnements/plan-form-dialog.tsx` (lignes 167-183, 554-556) :
`getModuleNavKey()` mappe `SiteModule.COMMISSIONS → "modules.adminCommissions"` et
`SiteModule.REMISES → "modules.adminRemises"`, puis `tNav(navKey)` (`useTranslations("navigation")`)
est appelé pour **chaque module de `SITE_TOGGLEABLE_MODULES`** (= `SITE_MODULES_CONFIG`, ré-exporté
tel quel, `site-modules-config.ts` ligne 34).

**Le bug est confirmé mais structurellement inatteignable** : `SITE_MODULES_CONFIG` ne contient **ni
`SiteModule.COMMISSIONS` ni `SiteModule.REMISES`** (seulement les 9 modules "site" listés en §2) — la
boucle `SITE_TOGGLEABLE_MODULES.map(...)` (ligne 554) n'itère donc **jamais** sur ces deux valeurs, et
`getModuleNavKey(SiteModule.COMMISSIONS)` n'est jamais appelé à l'exécution. Les clés
`modules.adminCommissions`/`modules.adminRemises` **existent bel et bien**, mais dans
`src/messages/{fr,en}/common.json` (section `seo`/plate-forme, ex. `"adminCommissions": "Gestion des
commissions"`), **pas** dans `navigation.json` sous `modules.*` — donc si un jour ce code devenait
atteignable (ex. `COMMISSIONS`/`REMISES` ajoutés à `SITE_MODULES_CONFIG`), l'appel `tNav("modules.adminCommissions")`
échouerait bel et bien (clé absente du namespace `navigation`).

**Coût réel de la correction** : trivial en soi (ajouter 2 clés dans `navigation.json` fr+en, ou
rediriger `getModuleNavKey` vers le namespace `common`/`seo` où les clés existent déjà) — mais le
correctif **le plus sûr** (rediriger vers le bon namespace) demande de vérifier comment `tNav` est
invoqué (`useTranslations("navigation")` uniquement, pas un accès cross-namespace direct dans ce
fichier) : un simple ajout de clés dans `navigation.json` est donc le chemin de moindre effort,
compatible avec le patron actuel du fichier.

**Verdict francs** : **best-effort recommandé, faisable dans cette story sans déborder** — il s'agit
d'ajouter 2 clés à `navigation.json` (fr+en), un travail strictement inférieur en volume à l'ajout
des 5 clés `items.*` déjà requis par le périmètre principal, et dans le **même fichier**, avec le
**même risque** (test de parité déjà couvert par §3). Aucune dépendance croisée avec le reste de la
story. Si le développeur choisit néanmoins de reporter, la story doit le documenter explicitement
comme dette assumée (le sprint l'autorise explicitement : « best-effort... sinon reporter »).

## 5. Routes de pages réellement existantes

Inventaire exhaustif de `src/app/(farm)/previsions/` :
```
src/app/(farm)/previsions/scenarios/page.tsx
src/app/(farm)/previsions/scenarios/[id]/page.tsx
```
**C'est tout.** Aucune des 5 routes cibles du §7.3 (`Tableau de bord`, `Plan des vagues`,
`Prévisions`, `Dépenses`, `Paramètres`) ne correspond à une page existante aujourd'hui — ni même à
`/previsions/scenarios` (qui n'apparaît dans aucune des deux listes à 5 ou 7 entrées). PR2.3 est en
cours d'écriture (seul le CRUD scénarios existe pour l'instant, le plan des vagues/aliments/charges
visés par PR2.3 ne sont pas encore sur disque) ; PR2.4 (tableau de bord, vue mensuelle) n'a pas
commencé.

**Conséquence directe pour PR2.5, à trancher explicitement, pas à découvrir en recette** :
- Si PR2.5 est développée maintenant avec les 5 `href` du §7.3 tels quels
  (`/previsions`, `/previsions/plan`, `/previsions/depenses`... — noms exacts non fixés par le sprint,
  seuls les libellés le sont), **chacun de ces liens est mort** au sens strict (page inexistante,
  404) au moment du merge de cette story.
- **Le risque réel est actuellement nul** : comme documenté en §2, `SiteModule.PREVISIONS` n'est
  activable sur aucun site (absent de `SITE_MODULES_CONFIG`), donc aucun utilisateur réel ne peut
  aujourd'hui atteindre ces liens en conditions de production — mais ce filet de sécurité disparaît
  dès que §2-option-1 est traité (ou dès qu'un site reçoit `PREVISIONS` en base par un autre moyen).
- **Recommandation** : @developer choisit et documente explicitement l'une de ces deux postures (ne
  pas la découvrir a posteriori) :
  1. **Câbler les 5 items dès maintenant**, en acceptant que certains hrefs pointent vers des pages
     qui n'existent pas encore (le filet de sécurité `SITE_MODULES_CONFIG` couvre le risque tant que
     PR2.3/PR2.4 ne sont pas finies) — cohérent avec le fait que la story ne dépend pas formellement
     de PR2.3/PR2.4 dans le tableau des stories du sprint.
  2. **Séquencer PR2.5 après PR2.3 et PR2.4**, de sorte que chaque href pointe vers une page réelle
     dès l'activation du groupe de navigation — plus prudent, mais retarde la story sans nécessité
     stricte si l'option 1 du §2 (`SITE_MODULES_CONFIG`) n'est pas traitée en parallèle.
  Recommandation de cette pré-analyse : **posture 1 acceptable seulement si §2-option-2 est retenue**
  (ne pas activer `SITE_MODULES_CONFIG` dans cette story) — combiner "câbler les 5 liens" **et**
  "rendre le module activable en prod" dans la même story créerait des 404 accessibles en prod avant
  que PR2.3/PR2.4 ne soient terminées. **Ne jamais faire les deux choses à la fois sans que les pages
  existent.**

## 6. Gating par permission — quelle permission par entrée

Le patron déjà en place dans le dépôt pour ce cas exact (item plus restrictif que le gate de groupe)
est `ITEM_VIEW_PERMISSIONS: Record<href, Permission>` (`src/lib/permissions-constants.ts`), déjà
utilisé pour durcir des items individuels sous un groupe dont le gate est plus large — précédents
directs : `"/settings/config-elevage": Permission.GERER_CONFIG_ELEVAGE` sous le groupe
"Configuration" (gate `SITE_GERER`), `"/reproduction/geniteurs": Permission.GENITEURS_VOIR` sous le
groupe "Alevins" (gate `ALEVINS_VOIR`).

**Pour Prévisions** : le gate de groupe est `Permission.PREVISIONS_VOIR` (ADR-053 §6 : rôle Lecteur
n'a que celle-ci). Les 4 items « Tableau de bord », « Plan des vagues », « Prévisions », « Dépenses »
n'ont pas besoin d'un override — `PREVISIONS_VOIR` suffit à les voir. **L'item « Paramètres » doit
recevoir un override** vers `Permission.PREVISIONS_PARAMETRER` (rôle Administrateur uniquement, per
ADR-053 §6) — sinon un utilisateur avec seulement `PREVISIONS_VOIR`/`PREVISIONS_GERER` verrait un
lien "Paramètres" menant à une page qui le rejetterait ensuite (double-gating incohérent, pattern à
éviter, cf. leçon `ERR-` sur le double-gating dans l'historique du dépôt — cohérent avec la
philosophie R-mobile "ne jamais montrer un lien qu'on va ensuite refuser").

À ajouter dans `ITEM_VIEW_PERMISSIONS` :
```typescript
"/previsions/parametres": Permission.PREVISIONS_PARAMETRER,
```
(le href exact dépend du nommage retenu par @developer — à faire correspondre avec la page réelle
créée par PR2.3, si elle existe déjà au moment du dev, sinon documenter le href prévu).

## 7. Vérifications exécutables

- **`npm run build`** : **OK, exit 0**, aucune erreur, toutes les routes existantes compilent (y
  compris `/previsions/scenarios` et `/previsions/scenarios/[id]`). **La mise en garde de la mission
  sur un possible échec dû au travail en cours de PR2.3 ne s'est pas matérialisée** — le build est
  propre au moment de cette lecture.
- **`npx vitest run`** : **247 fichiers passés (+4 skipped sur 251) / 6872 tests passés / 19 skipped /
  26 todo / 0 échec** — **identique à la ligne de base attendue** (6872/19/26/0).
- **Recette moteur** : `annexe-b-corrigee.recette.test.ts` (421 tests) +
  `plan-v12-corrige.recette.test.ts` (421 tests) = **842/842**, confirmée intacte.

## 8. Verdict — GO AVEC RÉSERVES

**GO pour démarrer PR2.5**, à condition que le @developer tranche explicitement, avant de coder, les
points suivants (documentés dans les notes de clôture, pas découverts en cours de route) :

1. **Le fichier `module-nav-items.ts` désigné par l'ADR-053 §6 est du code mort** vis-à-vis du rendu
   réel — l'ajout indispensable, pour que l'entrée soit visible, se fait dans
   `src/components/layout/farm-sidebar.tsx` (`NAV_GROUPS`) **et**
   `src/components/layout/farm-bottom-nav.tsx` (`SHEET_GROUPS`). Ajouter aussi l'entrée dans
   `module-nav-items.ts` par cohérence documentaire ne suffit pas et ne doit pas être confondu avec
   le critère d'acceptation réel.
2. **`SITE_MODULES_CONFIG` n'a pas `PREVISIONS`** — décider si cette story l'ajoute (recommandé, coût
   minime, débloque la recette end-to-end) ou la reporte explicitement (auquel cas documenter que le
   module reste inactivable via l'UI d'admin, uniquement par écriture base directe).
3. **Aucune des 5 pages cibles n'existe encore** (seules `/previsions/scenarios` et son détail
   existent) — décider si les hrefs sont câblés dès maintenant vers des pages pas-encore-écrites
   (acceptable seulement si le point 2 est *reporté*, pour garder le risque de lien mort en
   production à zéro) ou si la story attend PR2.3/PR2.4.
4. **Mapping ADR-053 §6 (7 entrées) → sprint §7.3 (5 entrées)**, à documenter explicitement dans les
   notes de clôture (proposition de cette pré-analyse, non prescriptive) :

   | ADR-053 §6 (7 entrées) | Sprint §7.3 (5 entrées) | Sort |
   |---|---|---|
   | Dashboard (`/previsions`) | Tableau de bord | Renommé, conservé |
   | Plan empoissonnement (`/previsions/plan`) | Plan des vagues | Renommé, conservé |
   | Aliments (`/previsions/aliments`) | *(fusionné dans "Prévisions" ou "Paramètres" — ambigu, à trancher par @developer)* | Conservé sous une autre entrée |
   | Trésorerie (`/previsions/tresorerie`) | Prévisions | Renommé/fusionné (vue mensuelle PR2.4), conservé |
   | Scénarios (`/previsions/scenarios`) | *(probablement fusionné dans "Paramètres")* | Conservé sous une autre entrée |
   | Charges (`/previsions/charges`) | Dépenses | Renommé, conservé |
   | Rapprochement (`/previsions/rapprochement`) | — | **Supprimé de ce sprint (PR3)** |

   Les lignes marquées "ambigu" ne sont **pas résolues par cette pré-analyse** — le sprint ne précise
   pas la correspondance exacte au-delà des libellés ; le @developer doit choisir une correspondance
   href et la documenter, pas la découvrir implicitement dans son propre diff.
5. **Réserve 5 de PR1 (`getModuleNavKey`)** : correction recommandée dans cette story (coût marginal,
   même fichier, même filet de test que le point i18n principal) — cf. §4.
6. **Gating de « Paramètres »** : ajouter l'override `ITEM_VIEW_PERMISSIONS[href] = Permission.PREVISIONS_PARAMETRER`
   (cf. §6), sinon incohérence lien-visible/action-refusée.

Aucun de ces points n'est bloquant en soi (aucun ne casse le build ni les tests existants), mais tous
doivent être **des décisions explicites de @developer**, actées dans les notes de clôture de la
story — c'est le sens du "GO AVEC RÉSERVES" plutôt qu'un GO simple.
