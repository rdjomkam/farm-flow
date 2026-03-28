# ADR — Navigation Redesign Recommendations (Adversarial Review Response)

**Date :** 2026-03-28
**Statut :** RECOMMANDATIONS — Input pour révision de ADR-navigation-architecture.md
**Auteur :** @architect (senior frontend, mobile-first specialist)
**Source :** Analyse profonde de 13 fichiers de navigation + 90+ routes + review adversariale 24 findings + edge cases

---

## 1. Synthèse des 24 findings à adresser

### Findings adversariaux (A1–A13)

| # | Finding | Criticité | Action recommandée |
|---|---------|-----------|-------------------|
| A1 | Performance/bundle size pour appareils bas de gamme | Haute | Ajouter section dédiée — lazy loading nav, code split |
| A2 | "2 taps max" ambiguë | Moyenne | Renommer : "2 taps pour fonctions PRIMAIRES, navigation contextuelle pour vues détail" |
| A3 | Deadlock planning §2.5 (routes partagées) reporté Sprint 12 | Critique | Résoudre en Phase 1, pas Sprint 12 |
| A4 | Comportement offline absent | Haute | Ajouter section offline explicite |
| A5 | Permissions non cross-référencées avec enum réel | Haute | Cross-référencer avec Permission enum + algorithme de gate |
| A6 | Contraintes ADR référencés non résumées | Basse | Résumer les contraintes inline |
| A7 | /notifications dans groupe Élevage incohérent | Moyenne | Déplacer vers topbar uniquement (cross-cutting) |
| A8 | Bottom nav minimum viable non défini | Haute | Définir : min 3 items (Accueil + Menu toujours présents) |
| A9 | Cleanup legacy non chiffré | Basse | Analyser call sites avant suppression |
| A10 | Wireframes supposés canoniques | Basse | Préciser : illustratifs, spec utilise noms Lucide |
| A11 | /calibrages dead link absent Phase 1 | Haute | Ajouter fix Phase 1 |
| A12 | /analytics/aliments dupliqué Stock + Analytics | Moyenne | Stock group uniquement → remove duplication |
| A13 | Labels nav sans clés i18n | Haute | Tous les labels via src/messages/fr/navigation.json |

### Findings edge cases (E1–E16)

| # | Finding | Criticité | Action recommandée |
|---|---------|-----------|-------------------|
| E1 | Groupes vides (0 items visibles) | Haute | Masquer le groupe entier si 0 items visibles |
| E2 | Utilisateur zéro permissions | Haute | Afficher bottom nav minimaliste (Accueil + Menu) |
| E3 | /mes-taches gate propre | Haute | Gate PLANNING_VOIR séparé du gate groupe |
| E4 | Layout group routing non documenté | Haute | Documenter comportement Next.js App Router |
| E5 | Groupes avec 1 seul item | Basse | Afficher sans header de groupe (collapse) |
| E6 | SiteSelector site unique | Moyenne | Masquer complètement si 1 seul site |
| E7 | FAB et 5e item simultanés | Haute | Si FAB présent : bottom nav 4 items + FAB = 5 slots |
| E8 | Headers de groupes vides | Haute | Masquer si 0 items enfants visibles |
| E9 | /notes gate | Moyenne | ENVOYER_NOTES → lecture seule si absent, caché si pas de notes |
| E10 | /calibrages dead link | Haute | Idem A11 — supprimer ou rediriger vers /vagues |
| E11 | Legacy null-role fallback | Haute | Rediriger vers /login, ne pas afficher nav invalide |
| E12 | Sheet paysage | Basse | Full-height ou side-drawer en landscape |
| E13 | Duplicate nav items | Haute | Idem A12 |
| E14 | Badge notification overflow | Basse | Plafonner à "99+" |
| E15 | Icône cloche conflit | Moyenne | BellRing pour /settings/alertes, Bell pour /notifications |
| E16 | Middleware guard manquant | Haute | Ajouter note middleware pour routes layout-spécifiques |

---

## 2. Redesign complet de la structure de navigation

### 2.1 Principe d'accessibilité révisé (A2)

**Règle corrigée :** "2 taps depuis la bottom nav pour toutes les fonctions PRIMAIRES (quotidiennes). Les vues détail et les formulaires de création sont accessibles en 1 tap supplémentaire depuis la liste correspondante (3 taps au total depuis la bottom nav). Aucune fonction primaire ne doit dépasser 2 taps."

Fonctions primaires définies : Accueil, Vagues, Finances, Messages/Notes, et toute destination dans le sheet "Menu" (accessible en 1 tap sur l'item "Menu").

### 2.2 Algorithm de permission gating (A5)

```typescript
/**
 * Algorithme de gate de navigation — à implémenter dans chaque composant nav.
 * Source de vérité : Permission enum dans src/types/models.ts
 */
function isNavItemVisible(
  item: NavItem,
  userPermissions: Permission[],
  userModules: SiteModule[],
  isSuperAdmin: boolean
): boolean {
  // 1. SuperAdmin bypass — voir tout
  if (isSuperAdmin && item.superAdminOnly) return true;

  // 2. SuperAdmin exclusif — masquer pour non-superAdmin
  if (item.superAdminOnly && !isSuperAdmin) return false;

  // 3. Gate module SiteModule
  if (item.requiredModule && !userModules.includes(item.requiredModule)) {
    return false;
  }

  // 4. Gate permission — ANY (OR logic par défaut)
  if (item.requiredPermissions && item.requiredPermissions.length > 0) {
    const hasAny = item.requiredPermissions.some(p =>
      userPermissions.includes(p)
    );
    if (!hasAny) return false;
  }

  // 5. Gate permission ALL (AND logic si requiredPermissionsAll)
  if (item.requiredPermissionsAll && item.requiredPermissionsAll.length > 0) {
    const hasAll = item.requiredPermissionsAll.every(p =>
      userPermissions.includes(p)
    );
    if (!hasAll) return false;
  }

  return true;
}

/**
 * Gate de groupe — masquer si 0 items visibles (E1, E8)
 */
function isGroupVisible(
  group: NavGroup,
  userPermissions: Permission[],
  userModules: SiteModule[],
  isSuperAdmin: boolean
): boolean {
  return group.items.some(item =>
    isNavItemVisible(item, userPermissions, userModules, isSuperAdmin)
  );
}

/**
 * Bottom nav minimum viable (A8, E2)
 * Toujours au moins : [Accueil, Menu]
 * Accueil visible même sans DASHBOARD_VOIR (redirect vers contenu disponible)
 */
function getVisibleBottomNavItems(
  items: BottomNavItem[],
  ...args: Parameters<typeof isNavItemVisible>[1]
): BottomNavItem[] {
  const visible = items.filter(item =>
    item.alwaysVisible || isNavItemVisible(item, ...args)
  );
  // Minimum viable : Accueil + Menu
  const hasAccueil = visible.some(i => i.id === 'accueil');
  const hasMenu = visible.some(i => i.id === 'menu');
  if (!hasAccueil) visible.unshift(ACCUEIL_ITEM);
  if (!hasMenu) visible.push(MENU_ITEM);
  return visible;
}
```

**Mapping permissions réelles (cross-référence Permission enum) :**

| Route | Permission(s) requise(s) | Module(s) | Logique |
|-------|------------------------|-----------|---------|
| `/` | DASHBOARD_VOIR | — | — |
| `/vagues` | VAGUES_VOIR | — | — |
| `/bacs` | BACS_GERER ou BACS_MODIFIER | — | ANY |
| `/releves` | RELEVES_VOIR | — | — |
| `/releves/nouveau` | RELEVES_CREER | — | — |
| `/calibrages` → redirect `/vagues` | CALIBRAGES_VOIR | — | dead link corrigé |
| `/observations` | RELEVES_VOIR | — | inclus dans relevés |
| `/notifications` | — | — | toujours visible |
| `/stock` | STOCK_VOIR | — | — |
| `/stock/produits` | STOCK_VOIR | — | — |
| `/stock/mouvements` | STOCK_GERER | — | — |
| `/stock/fournisseurs` | APPROVISIONNEMENT_VOIR | — | — |
| `/stock/commandes` | APPROVISIONNEMENT_GERER | — | — |
| `/besoins` | BESOINS_SOUMETTRE ou BESOINS_APPROUVER | — | ANY |
| `/finances` | FINANCES_VOIR | — | — |
| `/ventes` | VENTES_VOIR | — | — |
| `/factures` | FACTURES_VOIR | — | — |
| `/clients` | CLIENTS_VOIR | — | — |
| `/depenses` | DEPENSES_VOIR | — | — |
| `/analytics` | DASHBOARD_VOIR | — | — |
| `/analytics/aliments` | DASHBOARD_VOIR | — | — |
| `/planning` | PLANNING_VOIR | — | — |
| `/mes-taches` | PLANNING_VOIR | — | gate propre (E3) |
| `/alevins` | ALEVINS_VOIR | REPRODUCTION | AND |
| `/settings/sites` | SITE_GERER | — | — |
| `/settings/alertes` | ALERTES_CONFIGURER | — | — |
| `/settings/config-elevage` | GERER_CONFIG_ELEVAGE | — | — |
| `/settings/regles-activites` | REGLES_ACTIVITES_VOIR ou GERER_REGLES_ACTIVITES | — | ANY |
| `/users` | UTILISATEURS_VOIR | — | — |
| `/mon-abonnement` | ABONNEMENTS_VOIR | — | — |
| `/packs` | ACTIVER_PACKS | — | — |
| `/activations` | ACTIVER_PACKS | — | — |
| `/notes` | ENVOYER_NOTES | — | E9: read-only si absent |
| `/monitoring` | MONITORING_CLIENTS | — | — |
| `/mon-portefeuille` | PORTEFEUILLE_VOIR | — | — |
| `/backoffice` | — | — | isSuperAdmin uniquement |

### 2.3 Structure Farm Bottom Nav révisée (A7, A8, E7)

**Règle :** La bottom nav farm a toujours 5 slots visuels. Le 5e slot est toujours "Menu". La cloche notification quitte la bottom nav et va dans la topbar mobile (A7 — cross-cutting).

```
Position fixe :
[1: Accueil] [2: Ma ferme] [3: Finances] [4: Messages] [5: Menu]
              ↓ si VAGUES_VOIR absent    ↓ si FINANCES_VOIR absent
              Slot masqué, nav compressée (min 3 items : Accueil + 1 + Menu)
```

| Position | Id | Label (i18n key) | Icon Lucide | Route | Permissions |
|----------|----|-----------------|-------------|-------|-------------|
| 1 | accueil | navigation:items.accueil | Home | `/` | alwaysVisible |
| 2 | maFerme | navigation:items.vagues | Layers | `/vagues` | VAGUES_VOIR |
| 3 | finances | navigation:items.finances | Wallet | `/finances` | FINANCES_VOIR |
| 4 | messages | navigation:items.notes | MessageSquare | `/notes` | ENVOYER_NOTES |
| 5 | menu | navigation:actions.menu | Menu | sheet | alwaysVisible |

**Comportement minimum viable (A8, E2) :**
- 0 permissions : [Accueil] [Menu] — 2 items
- VAGUES_VOIR seulement : [Accueil] [Ma ferme] [Menu] — 3 items
- Toutes permissions : 5 items

**Note :** Les items masqués ne laissent pas de slot vide. La bottom nav se recompresse automatiquement.

### 2.4 Farm Sheet "Menu" révisé (A7, A12, E1, E8)

**Changements vs version initiale :**
- `/notifications` retiré du groupe Élevage → topbar uniquement (A7)
- `/analytics/aliments` retiré du groupe Stock (A12, E13) — accessible via /analytics
- Groupes vides masqués automatiquement (E1, E8)

**Structure complète avec clés i18n :**

```
GROUPE: navigation:modules.grossissement (gate: VAGUES_VOIR)
  - /vagues          navigation:items.vagues           Waves
  - /bacs            navigation:items.bacs             Container    [BACS_GERER ou BACS_MODIFIER]
  - /releves         navigation:items.releve           NotebookPen  [RELEVES_VOIR]
  - /observations    navigation:items.observations*    Eye          [RELEVES_VOIR]

GROUPE: navigation:modules.intrants (gate: STOCK_VOIR)
  - /stock           navigation:items.stock            Package      [STOCK_VOIR]
  - /stock/fournisseurs navigation:items.fournisseurs  Truck        [APPROVISIONNEMENT_VOIR]
  - /stock/commandes navigation:items.commandes        ShoppingCart [APPROVISIONNEMENT_GERER]
  - /besoins         navigation:items.besoins          ClipboardList [BESOINS_SOUMETTRE ou BESOINS_APPROUVER]

GROUPE: navigation:modules.ventes (gate: FINANCES_VOIR)
  - /finances        navigation:items.analytiquesFinances Wallet    [FINANCES_VOIR]
  - /ventes          navigation:items.ventesItem        Banknote    [VENTES_VOIR]
  - /factures        navigation:items.factures          FileText    [FACTURES_VOIR]
  - /clients         navigation:items.clients*          Users        [CLIENTS_VOIR]
  - /depenses        navigation:items.depenses          Receipt      [DEPENSES_VOIR]

GROUPE: navigation:modules.analysePilotage (gate: DASHBOARD_VOIR)
  - /analytics       navigation:items.analytiquesVagues BarChart3   [DASHBOARD_VOIR]
  - /planning        navigation:items.calendrier        Calendar     [PLANNING_VOIR]
  - /mes-taches      navigation:items.mesTaches         ClipboardCheck [PLANNING_VOIR] (E3: gate propre)

GROUPE: navigation:modules.reproduction (gate: ALEVINS_VOIR + module REPRODUCTION)
  - /alevins         navigation:items.lotsAlevins       Egg

GROUPE: navigation:modules.configuration (gate: SITE_GERER ou UTILISATEURS_VOIR ou ABONNEMENTS_VOIR)
  - /settings/sites  navigation:items.sites             Settings     [SITE_GERER]
  - /settings/alertes navigation:items.alertes          BellRing     [ALERTES_CONFIGURER]  (E15)
  - /users           navigation:items.liste             Users        [UTILISATEURS_VOIR]
  - /mon-abonnement  navigation:items.monAbonnement     CreditCard   [ABONNEMENTS_VOIR]
  - /packs           navigation:items.packs             Boxes        [ACTIVER_PACKS]
  - /activations     navigation:items.activations*      ClipboardCheck [ACTIVER_PACKS]
  - /backoffice      navigation:items.adminSites        Shield       [isSuperAdmin]
```

*Clé i18n manquante — à ajouter dans navigation.json (A13) : observations, clients, activations

### 2.5 Ingénieur Bottom Nav révisé

```
[1: Accueil] [2: Tâches] [FAB +] [4: Clients] [5: Menu]
```

| Position | Id | Label (i18n key) | Icon Lucide | Route | Permissions |
|----------|----|-----------------|-------------|-------|-------------|
| 1 | accueil | navigation:items.accueil | Home | `/` | DASHBOARD_VOIR |
| 2 | taches | navigation:items.taches | CheckSquare | `/mes-taches` | PLANNING_VOIR (E3) |
| FAB | fab | — | Plus | `/releves/nouveau` | RELEVES_CREER |
| 4 | clients | navigation:items.dashboardClients | Users | `/monitoring` | MONITORING_CLIENTS |
| 5 | menu | navigation:actions.menu | Menu | sheet | alwaysVisible |

**Spécification FAB (E7) :**
- Taille : 56×56px (touch target confortable)
- Élévation : `-translate-y-3` (sail au-dessus de la bottom nav)
- Couleur : var(--primary)
- `aria-label` : "Nouveau relevé" (hardcodé pour accessibilité immédiate)
- Le FAB occupe visuellement le slot 3 — la bottom nav a donc 4 items réels + FAB
- Si RELEVES_CREER absent : FAB masqué, bottom nav repasse à 4 items normaux

### 2.6 Ingénieur Sheet "Menu" révisé

```
GROUPE: navigation:modules.ingenieur (gate: MONITORING_CLIENTS)
  - /monitoring      navigation:items.dashboardClients  Users       [MONITORING_CLIENTS]
  - /notes           navigation:items.notes             NotebookPen  [ENVOYER_NOTES] (E9: show read-only si absent mais notes reçues)
  - /settings/alertes navigation:items.alertes          BellRing    [ALERTES_CONFIGURER] (E15, I1)

GROUPE: navigation:modules.grossissement (sans gate — toujours INGENIEUR)
  - /stock           navigation:items.stock             Package     [STOCK_VOIR]
  - /stock/fournisseurs navigation:items.fournisseurs   Truck       [APPROVISIONNEMENT_VOIR]
  - /stock/commandes navigation:items.commandes         ShoppingCart [APPROVISIONNEMENT_GERER]
  - /planning        navigation:items.calendrier        Calendar    [PLANNING_VOIR]
  - /analytics       navigation:items.analytiquesVagues BarChart3   [DASHBOARD_VOIR]

GROUPE: navigation:modules.packsProvisioning (gate: ACTIVER_PACKS)
  - /packs           navigation:items.packs             Boxes       [ACTIVER_PACKS]
  - /activations     navigation:items.activations*      ClipboardCheck [ACTIVER_PACKS]
  - /mon-portefeuille navigation:items.monPortefeuille  Wallet      [PORTEFEUILLE_VOIR]

GROUPE: navigation:modules.configuration (gate: GERER_CONFIG_ELEVAGE ou REGLES_ACTIVITES_VOIR)
  - /settings/config-elevage navigation:items.profilsElevage Settings [GERER_CONFIG_ELEVAGE]
  - /settings/regles-activites navigation:items.reglesActivites Zap [REGLES_ACTIVITES_VOIR]
```

---

## 3. Spécifications mobiles détaillées

### 3.1 Dimensions (mobile first 360px)

| Élément | Hauteur | Largeur | Notes |
|---------|---------|---------|-------|
| Bottom nav | 56px min, 64px confort | 100vw | position: fixed, bottom: 0 |
| Bottom nav items | 44px touch target | flex-1 | text-xs label, icon 20px |
| FAB | 56×56px | — | position absolue, -translate-y-3 |
| Topbar mobile | 48px | 100vw | position: sticky, top: 0 |
| Sheet menu | 85vh max | 100vw | bottom sheet, scroll interne |
| Sheet header | 56px | — | padding-x 16px |
| Items sheet (grille) | 72px | flex | grid-cols-3, gap-2, p-3 |
| Touch targets | 44×44px min | — | WCAG 2.5.5 |
| Icônes nav | 20px | 20px | Lucide, stroke-width 1.5 |
| Icônes sheet | 24px | 24px | Lucide, stroke-width 1.5 |
| Badge notification | 16px | min 16px | top-1 right-1, bg-destructive |
| Safe area | padding-bottom env(safe-area-inset-bottom) | — | iOS notch |

### 3.2 Comportement paysage (E12)

Sur viewport `orientation: landscape` et `height < 500px` :
- Bottom nav : hauteur réduite à 44px
- Sheet menu : passe en side-drawer (slide depuis la droite, width 320px max)
- Topbar : reste sticky mais peut se masquer au scroll (auto-hide)

### 3.3 Badge notification (E14)

```typescript
function formatBadgeCount(count: number): string {
  if (count <= 0) return '';
  if (count > 99) return '99+';
  return String(count);
}
```

Rendu : badge rouge `bg-destructive text-destructive-foreground`, `text-[10px]`, `min-w-[16px] h-4`, position `absolute -top-1 -right-1`.

### 3.4 Topbar mobile — FarmHeader et IngenieurHeader

```
FarmHeader (md:hidden, sticky top-0, z-50, h-12):
  LEFT:  Logo "FarmFlow" (text-sm font-semibold) ou icône Waves (20px)
  RIGHT: [NotificationBell avec badge] [SiteSelector dropdown — caché si 1 seul site (E6)]

IngenieurHeader (md:hidden, sticky top-0, z-50, h-12):
  LEFT:  Logo "FarmFlow"
  RIGHT: [NotificationBell avec badge]
```

**SiteSelector (E6) :** composant `<SiteSelector>` rendu uniquement si `userSites.length > 1`. Si site unique, afficher le nom du site comme texte statique (ou masquer).

---

## 4. Icônes Lucide — Assignations canoniques (A10)

Les wireframes ASCII sont ILLUSTRATIFS. La spécification canonique des icônes utilise les noms de composants Lucide React.

| Route / Concept | Icône Lucide | Justification |
|----------------|--------------|---------------|
| Accueil / Dashboard | `Home` | Standard universel |
| Vagues | `Waves` | Métaphore eau/lot |
| Bacs | `Container` | Contenant physique |
| Relevés | `NotebookPen` | Prise de notes |
| Observations | `Eye` | Observation visuelle |
| Notifications | `Bell` | Standard notifications |
| Config alertes (/settings/alertes) | `BellRing` | Alerte active (E15) |
| Stock / Produits | `Package` | Produit emballé |
| Fournisseurs | `Truck` | Livraison |
| Commandes | `ShoppingCart` | Commande d'achat |
| Besoins | `ClipboardList` | Liste de besoins |
| Finances | `Wallet` | Portefeuille |
| Ventes | `Banknote` | Transaction financière |
| Factures | `FileText` | Document |
| Clients | `Users` | Groupe d'utilisateurs |
| Dépenses | `Receipt` | Reçu |
| Analytics | `BarChart3` | Graphique barres |
| Planning | `Calendar` | Calendrier |
| Mes tâches | `ClipboardCheck` | Tâche cochée |
| Activations | `ClipboardCheck` | Idem tâches |
| Alevins | `Egg` | Reproduction |
| Paramètres sites | `Settings` | Configuration |
| Utilisateurs | `Users` | Idem clients — contexte différent |
| Abonnement | `CreditCard` | Paiement |
| Packs | `Boxes` | Ensemble de produits |
| Backoffice / Admin | `Shield` | Sécurité/Admin |
| Notes ingénieur | `NotebookPen` | Écriture de notes |
| Monitoring clients | `Users` | Clients supervisés |
| Portefeuille ingénieur | `Wallet` | Revenus |
| Config élevage | `Settings` | Configuration |
| Règles activités | `Zap` | Automatisation |
| Menu (sheet trigger) | `Menu` | Hamburger standard |
| FAB nouveau relevé | `Plus` | Action création |

---

## 5. Comportement offline (A4)

### 5.1 Stratégie de navigation en mode offline

L'application est une PWA avec Service Worker. La navigation en mode offline suit ces règles :

**Bottom nav — comportement offline :**
- Tous les items restent visibles (la nav elle-même est mise en cache)
- Items pointant vers des routes non-cachées : `opacity-50`, cursor-not-allowed sur tap, Toast "Hors ligne — données non disponibles"
- Items qui fonctionnent offline (cache-first) : `/` (dashboard cached), `/mes-taches` (si cached), `/releves/nouveau` (FAB — formulaire fonctionne, sync différé)

**Routes prioritaires pour le cache SW :**
- Shell statique : layout + bottom nav + sheet menu → `cache-first`
- Dashboard `/` → `stale-while-revalidate`, TTL 5min
- `/mes-taches` → `stale-while-revalidate`, TTL 1h
- `/releves/nouveau` → `network-first` avec fallback queue de synchro

**Page offline `/~offline` :**
- Rendu si navigation vers route non-cachée en mode offline
- Affiche le bottom nav avec items actifs (routes en cache)
- Message "Vous êtes hors connexion. Les données affichées peuvent ne pas être à jour."

### 5.2 Indicateur d'état réseau

Dans la topbar mobile, un indicateur subtil (dot rouge/vert `8×8px`) ou bannière `bg-destructive` si offline.

---

## 6. Performance et bundle size (A1)

### 6.1 Stratégie de code splitting pour la navigation

La navigation est chargée dans le bundle principal mais optimisée :

```typescript
// Lazy loading des sheets menu — ne charger que si ouvert
const FarmMenuSheet = lazy(() => import('./farm-menu-sheet'));
const IngenieurMenuSheet = lazy(() => import('./ingenieur-menu-sheet'));

// Icônes Lucide — importer uniquement les icônes utilisées (tree-shaking)
import { Home, Waves, Wallet, MessageSquare, Menu } from 'lucide-react';
// NE PAS FAIRE : import * as Icons from 'lucide-react'
```

### 6.2 Cibles de performance

| Métrique | Cible | Contexte |
|----------|-------|---------|
| FCP (First Contentful Paint) | < 2s | 3G lent (1.5 Mbps) |
| TTI (Time to Interactive) | < 4s | 3G lent |
| Bottom nav LCP | < 100ms | Render immédiat |
| Sheet open animation | 200ms | `ease-out` cubic-bezier |
| Bundle nav (gzipped) | < 15KB | Icônes + composants nav |

### 6.3 Optimisations spécifiques appareils bas de gamme

- Désactiver les animations si `prefers-reduced-motion: reduce`
- Réduire les box-shadows sur la bottom nav (performance GPU)
- `will-change: transform` uniquement pendant l'animation du sheet, pas en continu
- Éviter les `backdrop-filter: blur()` sur les sheets (coûteux sur mid-range Android)

---

## 7. Stratégie i18n — Navigation (A13)

### 7.1 Règle obligatoire

Tous les labels de navigation **doivent** utiliser des clés de traduction depuis `src/messages/fr/navigation.json`. Aucun texte de navigation hardcodé.

### 7.2 Clés existantes dans navigation.json

```json
navigation:modules.{reproduction,grossissement,intrants,ventes,analysePilotage,
                    packsProvisioning,ingenieur,configuration,abonnement,
                    adminPlateforme,portefeuille,utilisateurs,notes}
navigation:items.{dashboard,reproducteurs,pontes,lotsAlevins,lots,vagues,bacs,
                  nouveauReleve,releve,analytiquesBacs,analytiquesVagues,
                  anBacs,anVagues,produits,fournisseurs,commandes,mouvements,
                  analytiquesAliments,clients,ventesItem,factures,finances,
                  depenses,besoins,vueGlobale,calendrier,nouvelleActivite,
                  mesTaches,taches,analytiquesFinances,tendances,packs,
                  activations,dashboardClients,notes,sites,profilsElevage,
                  profils,configAlertes,alertes,reglesActivites,monAbonnement,
                  plansTarifs,tousAbonnements,abonnementsItem,gestionPlans,
                  monPortefeuille,toutesCommissions,commissions,remisesPromos,
                  adminSites,adminAnalytics,adminModules,liste,nouveau,accueil,
                  analyse,stock,echanges,ingenieur}
navigation:roles.{admin,gerant,pisciculteur,ingenieur}
navigation:actions.{logout,more,menu,language}
```

### 7.3 Clés manquantes à ajouter (A13)

Les items suivants sont référencés dans la spec mais n'ont pas de clé dans navigation.json :

```json
// À ajouter dans src/messages/fr/navigation.json — section items
{
  "observations": "Observations",
  "clientsItem": "Clients",
  "activationsItem": "Activations",
  "notificationsItem": "Notifications",
  "portefeuilleItem": "Portefeuille"
}
```

Et dans `src/messages/en/navigation.json` :
```json
{
  "observations": "Observations",
  "clientsItem": "Clients",
  "activationsItem": "Activations",
  "notificationsItem": "Notifications",
  "portefeuilleItem": "Portfolio"
}
```

### 7.4 Pattern d'usage dans les composants

```typescript
// Correct
import { useTranslations } from 'next-intl';
const t = useTranslations('navigation');
<span>{t('items.vagues')}</span>
<span>{t('modules.grossissement')}</span>

// Incorrect — NE PAS FAIRE
<span>Vagues</span>
<span>Grossissement</span>
```

---

## 8. Résolution routes partagées §2.5 — Phase 1 (A3, E4)

### 8.1 Problème

Trois routes sont définies dans `(ingenieur)/` mais référencées depuis `FarmSidebar` :
- `/packs` → `src/app/(ingenieur)/packs/page.tsx`
- `/activations` → `src/app/(ingenieur)/activations/page.tsx`
- `/mes-taches` → `src/app/(ingenieur)/mes-taches/page.tsx`

### 8.2 Comportement Next.js App Router (E4)

En Next.js 14+ App Router, les route groups `(farm)` et `(ingenieur)` affectent uniquement les layouts, pas les URLs. La route `/packs` est servie par le premier `page.tsx` trouvé dans l'arborescence. S'il existe `(ingenieur)/packs/page.tsx` mais pas `(farm)/packs/page.tsx`, la route `/packs` est accessible depuis les deux layouts — le layout injecté dépend du `layout.tsx` parent dans la hiérarchie.

**Conséquence :** Si `src/app/(ingenieur)/layout.tsx` est le layout parent de `packs/page.tsx`, alors accéder à `/packs` depuis le farm layout injectera le layout ingénieur — comportement incorrect.

### 8.3 Solution recommandée — Phase 1 (A3)

Déplacer les trois pages à la racine `src/app/` (pattern §2.2-bis) :

```
src/app/packs/page.tsx      (déplacé depuis (ingenieur)/packs/)
src/app/activations/page.tsx (déplacé depuis (ingenieur)/activations/)
src/app/mes-taches/page.tsx  (déplacé depuis (ingenieur)/mes-taches/)
```

Ces pages utilisent des données communes (API `/api/packs`, etc.) et leur contenu est identique ou quasi-identique pour farm et ingénieur. Le composant de page peut adapter son rendu selon le rôle via `session.role`.

**Action Phase 1 :** Créer les fichiers racine et supprimer les fichiers `(ingenieur)/`. Tests de non-régression requis.

### 8.4 Fix /calibrages dead link — Phase 1 (A11, E10)

`src/app/calibrages/page.tsx` n'existe pas. La `FarmSidebar` a un lien "Calibrages" qui pointe vers `/calibrages`.

**Solution Phase 1 :** Dans `FarmSidebar`, remplacer le lien `/calibrages` par la suppression pure de cet item (les calibrages sont accessibles via `/vagues/[id]/calibrages`). Pas de page racine `/calibrages` à créer — trop complexe sans contexte de vague.

```typescript
// Dans FarmSidebar NAV_GROUPS — groupe Élevage
// AVANT :
{ label: t('items.calibrages'), href: '/calibrages', icon: Scale }
// APRÈS : item supprimé
// Les calibrages restent accessibles via /vagues/[id] → onglet Calibrages
```

---

## 9. Comportement edge cases spécifiés

### E5 — Groupes avec 1 seul item visible

Si un groupe n'a qu'un seul item visible après gate : masquer le header du groupe, afficher l'item directement sans section. Évite les sections orphelines.

```typescript
const visibleItems = group.items.filter(isVisible);
if (visibleItems.length === 0) return null; // E8
if (visibleItems.length === 1) {
  return <NavItemFlat item={visibleItems[0]} />; // E5 — sans header
}
return <NavGroup header={group.label} items={visibleItems} />;
```

### E9 — /notes et permissions

```typescript
// Si ENVOYER_NOTES absent mais l'utilisateur a des notes reçues → afficher /notes en lecture seule
// Si ENVOYER_NOTES présent → afficher /notes avec actions d'envoi
// Si 0 notes ET 0 permission ENVOYER_NOTES → masquer l'item /notes du sheet
const showNotes = hasPermission(Permission.ENVOYER_NOTES) || hasUnreadNotes;
```

### E11 — Legacy null-role

Si `session.role === null` (legacy ou erreur) : ne pas afficher `sidebar.tsx` avec liens cassés. Rediriger vers `/login` via middleware.

```typescript
// src/middleware.ts
if (session && !session.role && !session.isSuperAdmin) {
  return NextResponse.redirect('/login');
}
```

### E16 — Middleware guard

Les routes spécifiques à un layout doivent être protégées en middleware :

```typescript
// Routes ingénieur-only
const INGENIEUR_ROUTES = ['/monitoring', '/mon-portefeuille'];
if (INGENIEUR_ROUTES.some(r => pathname.startsWith(r))) {
  if (session.role !== Role.INGENIEUR) {
    return NextResponse.redirect('/');
  }
}
```

---

## 10. Plan de migration révisé (intégrant A3)

### Phase 1 — Corrections bloquantes (sprint courant, priorité absolue)

**Durée estimée : 2-3 jours développeur**

1. **Fix dead link /calibrages** — Supprimer item de FarmSidebar (30min)
2. **Fix routes partagées §8.3** — Déplacer 3 fichiers à la racine (2h + tests)
3. **FarmBottomNav sheet** — Ajouter 10 items manquants avec clés i18n (3h)
4. **IngenieurBottomNav sheet** — Ajouter 5 items manquants (1h)
5. **IngenieurSidebar** — Ajouter fournisseurs, commandes, groupe Configuration (1h)
6. **navigation.json** — Ajouter 5 clés manquantes (30min)
7. **Legacy null-role redirect** — Middleware guard (1h)

### Phase 2 — Restructuration (Sprint 12, première quinzaine)

**Durée estimée : 3-4 jours développeur**

1. **FarmHeader** + **IngenieurHeader** mobiles (topbar avec NotificationBell)
2. **AppShell** — Injecter les headers mobiles
3. Réorganiser groupes FarmSidebar (spec §2.4)
4. Réorganiser groupes IngenieurSidebar (spec §2.6)
5. SiteSelector — masquer si site unique (E6)
6. Badge notification — plafonner 99+ (E14)
7. BellRing vs Bell distinction (E15)
8. FAB comportement offline (§5.1)

### Phase 3 — Nettoyage legacy (Sprint 12, deuxième quinzaine)

**Durée estimée : 1-2 jours développeur**

Avant suppression — analyser les call sites (A9) :

```bash
# Vérifier l'utilisation de sidebar.tsx (legacy)
grep -r "from.*layout/sidebar" src/
grep -r "from.*layout/bottom-nav" src/
grep -r "from.*layout/hamburger-menu" src/
```

Si aucun import actif → supprimer. Si imports trouvés → migrer vers farm-sidebar/farm-bottom-nav.

Nettoyage :
1. `sidebar.tsx` — Supprimer entrées `/admin/*` inexistantes (ou supprimer le fichier)
2. `bottom-nav.tsx` — Nettoyer ou supprimer
3. `hamburger-menu.tsx` — Nettoyer ou supprimer
4. `module-nav-items.ts` — Supprimer entrées `Admin Abonnements`, `Admin Commissions`, `Admin Remises`

---

## 11. Résumé des contraintes ADR référencées (A6)

| ADR référencé | Contrainte pertinente |
|--------------|----------------------|
| ADR-ingenieur-interface.md | INGENIEUR = audience séparée. Config élevage + règles activités = modules INGENIEUR exclusivement. Monitoring clients = INGENIEUR. |
| ADR-022-backoffice-separation.md | Backoffice = `/backoffice/*` uniquement pour isSuperAdmin. Pas de navigation croisée. |
| PLAN-feed-analytics-v2.md | /analytics/aliments accessible via /analytics. Pas d'item top-level dédié. /analytics/aliments/simulation = outil avancé via bouton contextuel. |
| CLAUDE.md | Mobile first 360px. Radix UI pour composants interactifs (Sheet, Dialog, etc.). Server Components par défaut. |
