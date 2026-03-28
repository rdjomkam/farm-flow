# ADR — Architecture de Navigation (Farm, Ingénieur, Backoffice)

**Date :** 2026-03-28
**Statut :** PROPOSÉ
**Auteur :** @architect
**Référence :** ADR-ingenieur-interface.md, ADR-022-backoffice-separation.md, PLAN-feed-analytics-v2.md

---

## 1. Contexte et motivation

FarmFlow dessert trois audiences avec des besoins radicalement différents :

1. **Farm layout** (ADMIN, GERANT, PISCICULTEUR) — propriétaires et personnel de ferme. Utilisateurs quotidiens. Littératie tech variable, mobile-first strict.
2. **Ingénieur layout** (INGENIEUR) — techniciens terrain supervisant plusieurs fermes. Terrain, mobile, offline potentiel, actions rapides prioritaires.
3. **Backoffice layout** (isSuperAdmin) — équipe DKFarm uniquement. Pas de contrainte mobile critique.

L'ADR-ingenieur-interface.md a posé les principes architecturaux. Ce document en constitue l'opérationnalisation : cartographie complète de toutes les routes, identification exhaustive des lacunes d'accessibilité mobile, et spécification précise de la navigation à implémenter pour chaque layout.

---

## 2. Cartographie complète des routes existantes

### 2.1 Routes hors layout (publiques / système)

| Route | Accessible depuis nav ? | Notes |
|-------|------------------------|-------|
| `/login` | N/A — page auth | Pas de nav |
| `/register` | N/A — page auth | Pas de nav |
| `/select-site` | N/A — flux session | Pas de nav |
| `/tarifs` | Non (lien dans sheet "Abonnement") | Page publique |
| `/checkout` | Non (flux depuis /tarifs) | Flux transactionnel |
| `/abonnement-expire` | Non (redirect automatique) | Page d'erreur |
| `/~offline` | N/A — PWA offline fallback | Pas de nav |

### 2.2-bis Note architecturale — Routes partagées hors layout groups

Un sous-ensemble important de routes existe **à la racine de `src/app/`** (hors des groupes `(farm)/` et `(ingenieur)/`). Ces routes sont accessibles dans les deux layouts car le `AppShell` injecte la navigation selon le rôle, sans que la route elle-même ne soit contrainte à un layout group spécifique.

Routes confirmées hors layout group :

| Route | Fichier | Contexte d'usage |
|-------|---------|-----------------|
| `/observations` | `src/app/observations/page.tsx` | Farm — accessible depuis vagues/bacs |
| `/stock/fournisseurs` | `src/app/stock/fournisseurs/page.tsx` | Farm + Ingénieur |
| `/stock/produits` | `src/app/stock/produits/page.tsx` | Farm + Ingénieur |
| `/stock/produits/[id]` | `src/app/stock/produits/[id]/page.tsx` | Farm + Ingénieur |
| `/alevins/lots/[id]` | `src/app/alevins/lots/[id]/page.tsx` | Farm |
| `/alevins/pontes` | `src/app/alevins/pontes/page.tsx` | Farm |
| `/alevins/pontes/[id]` | `src/app/alevins/pontes/[id]/page.tsx` | Farm |
| `/alevins/reproducteurs` | `src/app/alevins/reproducteurs/page.tsx` | Farm |
| `/alevins/reproducteurs/[id]` | `src/app/alevins/reproducteurs/[id]/page.tsx` | Farm |
| `/analytics/bacs` | `src/app/analytics/bacs/page.tsx` | Farm + Ingénieur |
| `/analytics/bacs/[bacId]` | `src/app/analytics/bacs/[bacId]/page.tsx` | Farm + Ingénieur |
| `/analytics/aliments/[produitId]` | `src/app/analytics/aliments/[produitId]/page.tsx` | Farm + Ingénieur |
| `/analytics/aliments/simulation` | `src/app/analytics/aliments/simulation/page.tsx` | Farm + Ingénieur |
| `/besoins/[id]` | `src/app/besoins/[id]/page.tsx` | Farm |
| `/besoins/nouveau` | `src/app/besoins/nouveau/page.tsx` | Farm |
| `/depenses/[id]` | `src/app/depenses/[id]/page.tsx` | Farm |
| `/depenses/nouvelle` | `src/app/depenses/nouvelle/page.tsx` | Farm |
| `/planning/nouvelle` | `src/app/planning/nouvelle/page.tsx` | Farm + Ingénieur |
| `/releves/nouveau` | `src/app/releves/nouveau/page.tsx` | Farm + Ingénieur (via FAB) |
| `/vagues/[id]/calibrages` | `src/app/vagues/[id]/calibrages/page.tsx` | Farm |
| `/vagues/[id]/calibrage/[calibrageId]` | `src/app/vagues/[id]/calibrage/[calibrageId]/page.tsx` | Farm |
| `/vagues/[id]/calibrage/nouveau` | `src/app/vagues/[id]/calibrage/nouveau/page.tsx` | Farm |

**Règle :** Ces routes partagées héritent du layout (farm ou ingénieur) par la session active et le `AppShell`. Elles ne nécessitent pas de duplication dans des layout groups distincts. Pour toute nouvelle route de ce type, placer le fichier à la racine de `src/app/` est acceptable si la route est commune aux deux audiences.

### 2.2 Routes Farm layout — `(farm)/*`

#### Groupe Élevage opérationnel

| Route | Farm sidebar | Farm bottom nav | Accessible mobile ? | Notes |
|-------|-------------|-----------------|---------------------|-------|
| `/` (dashboard) | Oui — "Dashboard" | Oui — item "Accueil" | Oui | — |
| `/vagues` | Oui — "Vagues" | Oui — item "Ma ferme" | Oui | isActive couvre /bacs et /releves aussi |
| `/vagues/[id]` | Non (deep link) | Via /vagues | Oui — 1 tap depuis liste | — |
| `/vagues/[id]/releves` | Non (deep link) | Via /vagues/[id] | Oui — 2 taps | — |
| `/vagues/[id]/calibrages` | Non (deep link) | Via /vagues/[id] | Oui — 2 taps | — |
| `/vagues/[id]/calibrage/[calibrageId]` | Non | Via liste calibrages | Oui — 3 taps | — |
| `/vagues/[id]/calibrage/nouveau` | Non | Via /vagues/[id] | Oui | — |
| `/bacs` | Oui — "Bacs" | **ABSENT** | **LACUNE** | Pas dans bottom nav, ni dans sheet |
| `/releves` | Oui — "Relevés" | **ABSENT** | **LACUNE** | Pas dans bottom nav, ni dans sheet |
| `/calibrages` | Oui — "Calibrages" (`FarmSidebar`) | **ABSENT** | **LIEN MORT** | `src/app/calibrages/page.tsx` n'existe pas. Les calibrages vivent sous `/vagues/[id]/calibrages`. Lien sidebar à corriger ou page racine à créer. |
| `/observations` | **ABSENT** | **ABSENT** | **LACUNE** | Page `src/app/observations/page.tsx` — aucun chemin nav. Accessible depuis contexte vague/bac uniquement |
| `/notes` | Non (dans sidebar "Ingenieur" group) | Oui — item "Messages" | Oui | Via sheet si permissions |
| `/notifications` | Non (absent sidebar farm) | **ABSENT** | **LACUNE** | Zéro chemin mobile |
| `/releves/nouveau` | Non (via FAB ou bouton) | Via FAB / bouton contextuel | Oui | Route création partagée |

#### Groupe Stock & Approvisionnement

| Route | Farm sidebar | Farm bottom nav | Accessible mobile ? | Notes |
|-------|-------------|-----------------|---------------------|-------|
| `/stock` | Oui — "Vue stock" | Oui — dans sheet menu | Oui — 2 taps | — |
| `/stock/produits` | Oui | **ABSENT bottom nav direct** | Via /stock puis tabs | 3 taps |
| `/stock/produits/[id]` | Non | Via liste produits | Oui — 4 taps | — |
| `/stock/mouvements` | Oui | **ABSENT bottom nav direct** | Via /stock | 3 taps |
| `/stock/fournisseurs` | Oui — groupe Stock (`FarmSidebar`) | **ABSENT bottom nav direct** | Via /stock sheet item | 3 taps via sheet. Route partagée hors layout group |
| `/stock/commandes` | Oui | **ABSENT bottom nav direct** | Via /stock | 3 taps |
| `/stock/commandes/[id]` | Non | Via liste commandes | Oui — 4 taps | — |
| `/besoins` | Oui — groupe Stock (`FarmSidebar`) | **ABSENT** | **LACUNE** | Sheet farm n'a pas /besoins actuellement |
| `/besoins/[id]` | Non | Via /besoins | Oui | Route partagée hors layout group |
| `/besoins/nouveau` | Non | Via /besoins | Oui | Route partagée hors layout group |

#### Groupe Finances & Ventes

| Route | Farm sidebar | Farm bottom nav | Accessible mobile ? | Notes |
|-------|-------------|-----------------|---------------------|-------|
| `/finances` | Oui | Oui — item "Finances" | Oui | isActive couvre /ventes et /factures |
| `/ventes` | Oui | Via /finances | Oui — mais indirect | |
| `/ventes/[id]` | Non | Via /ventes | Oui — 3 taps | — |
| `/ventes/nouvelle` | Non | Via /ventes | Oui | — |
| `/factures` | Oui | Via /finances | Oui — indirect | |
| `/factures/[id]` | Non | Via /factures | Oui — 3 taps | — |
| `/clients` | Oui | **ABSENT** | **LACUNE** | Pas dans sheet ni bottom nav farm |
| `/depenses` | Oui — groupe Finances (`FarmSidebar`) | **ABSENT** | **LACUNE** | Pas dans sheet farm |
| `/depenses/[id]` | Non | Via /depenses | **LACUNE** — dépend de /depenses | Route partagée hors layout group |
| `/depenses/nouvelle` | Non | Via /depenses | **LACUNE** — dépend de /depenses | Route partagée hors layout group |
| `/depenses/recurrentes` | Non | **ABSENT** | **LACUNE** | Aucun chemin mobile |

#### Groupe Alevins

| Route | Farm sidebar | Farm bottom nav | Accessible mobile ? | Notes |
|-------|-------------|-----------------|---------------------|-------|
| `/alevins` | Oui | Oui — dans sheet menu | Oui — 2 taps | Module REPRODUCTION requis |
| `/alevins/lots` | Oui | Via /alevins | Oui — 3 taps | — |
| `/alevins/lots/[id]` | Non | Via /alevins/lots | Oui — 4 taps | — |
| `/alevins/pontes` | Oui | Via /alevins | Oui — 3 taps | — |
| `/alevins/pontes/[id]` | Non | Via liste | Oui | — |
| `/alevins/reproducteurs` | Oui | Via /alevins | Oui — 3 taps | — |
| `/alevins/reproducteurs/[id]` | Non | Via liste | Oui | — |

#### Groupe Planning & Activités

| Route | Farm sidebar | Farm bottom nav | Accessible mobile ? | Notes |
|-------|-------------|-----------------|---------------------|-------|
| `/planning` | Oui | Oui — dans sheet menu | Oui — 2 taps | — |
| `/planning/nouvelle` | Non | Via /planning | Oui — 2 taps | Route partagée hors layout group |
| `/mes-taches` | Oui (sous "Planning & Activités") | **ABSENT** | **LACUNE CRITIQUE** | Absent du sheet farm. Route définie sous `(ingenieur)/mes-taches/` — voir §2.5 |

#### Groupe Analytics

| Route | Farm sidebar | Farm bottom nav | Accessible mobile ? | Notes |
|-------|-------------|-----------------|---------------------|-------|
| `/analytics` | Oui | Oui — dans sheet menu | Oui — 2 taps | — |
| `/analytics/vagues` | Oui | Via /analytics | Oui — module nav | — |
| `/analytics/bacs` | Oui | Via /analytics | Oui — module nav | — |
| `/analytics/bacs/[bacId]` | Non | Via liste | Oui | Route partagée hors layout group |
| `/analytics/aliments` | Oui | Via /analytics | Oui — module nav | — |
| `/analytics/aliments/[produitId]` | Non | Via liste | Oui | Route partagée hors layout group |
| `/analytics/aliments/simulation` | Non | **ABSENT** | **LACUNE** | Route partagée hors layout group — accès via bouton sur [produitId] |

#### Groupe Administration

| Route | Farm sidebar | Farm bottom nav | Accessible mobile ? | Notes |
|-------|-------------|-----------------|---------------------|-------|
| `/settings/sites` | Oui | Oui — dans sheet ("Paramètres") | Oui — 2 taps | Permission SITE_GERER |
| `/settings/sites/[id]` | Non | Via liste | Oui | — |
| `/settings/sites/[id]/roles` | Non | Via /settings/sites/[id] | Oui — 3 taps | — |
| `/settings/sites/[id]/roles/[roleId]` | Non | Via liste | Oui | — |
| `/settings/sites/[id]/roles/nouveau` | Non | Via liste | Oui | — |
| `/settings/alertes` | Oui | **ABSENT farm sheet** | **LACUNE** | Présent dans IngenieurBottomNav sheet seulement |
| `/settings/config-elevage` | Oui (sous "Administration") | **ABSENT** | **LACUNE** | Zéro chemin mobile farm |
| `/settings/regles-activites` | Oui | **ABSENT** | **LACUNE** | Zéro chemin mobile farm |
| `/settings/regles-activites/[id]` | Non | — | **LACUNE** | — |
| `/settings/regles-activites/nouvelle` | Non | — | **LACUNE** | — |
| `/settings/regles-activites/placeholders` | Non | — | **LACUNE** | — |
| `/users` | Oui | Oui — dans sheet ("Utilisateurs") | Oui — 2 taps | Permission UTILISATEURS_VOIR |
| `/users/[id]` | Non | Via liste | Oui | — |
| `/users/nouveau` | Oui (sidebar) | **ABSENT sheet** | Indirectement via /users | — |
| `/mon-abonnement` | Oui | Oui — dans sheet | Oui — 2 taps | — |
| `/mon-abonnement/renouveler` | Non | Via /mon-abonnement | Oui | — |

#### Groupe Packs

| Route | Farm sidebar | Farm bottom nav | Accessible mobile ? | Notes |
|-------|-------------|-----------------|---------------------|-------|
| `/packs` | Oui | Oui — dans sheet | Oui — 2 taps | Permission ACTIVER_PACKS. Route sous `(ingenieur)/packs/` uniquement — voir §2.5 |
| `/packs/[id]` | Non | Via liste | Oui | — |
| `/packs/[id]/activer` | Non | Via /packs/[id] | Oui | — |
| `/activations` | Oui (sidebar) | **ABSENT sheet farm** | **LACUNE** | Sidebar farm a l'item mais pas le sheet. Route sous `(ingenieur)/activations/` — voir §2.5 |

### 2.3 Routes Ingénieur layout — `(ingenieur)/*`

| Route | Ingénieur sidebar | Ingénieur bottom nav | Accessible mobile ? | Notes |
|-------|------------------|---------------------|---------------------|-------|
| `/` (dashboard) | Oui — "Dashboard" | Oui — "Accueil" | Oui | — |
| `/mes-taches` | Oui — "Tâches" | Oui — "Tâches" | Oui | — |
| `/mes-taches/[id]` | Non | Via /mes-taches | Oui | — |
| `/monitoring` | Oui — "Clients supervisés" | Oui — "Clients" | Oui | — |
| `/monitoring/[siteId]` | Non | Via /monitoring | Oui — 2 taps | — |
| `/monitoring/[siteId]/notes` | Non | Via /monitoring/[siteId] | Oui — 3 taps | — |
| `/monitoring/[siteId]/vagues/[vagueId]` | Non | Via /monitoring/[siteId] | Oui — 3 taps | — |
| `/notes` | Oui | Oui — dans sheet | Oui — 2 taps | — |
| `/mon-portefeuille` | Oui — "Portefeuille" | Oui — dans sheet | Oui — 2 taps | — |
| `/packs` | Oui — "Packs" | Oui — dans sheet | Oui — 2 taps | — |
| `/packs/[id]` | Non | Via liste | Oui | — |
| `/packs/[id]/activer` | Non | Via /packs/[id] | Oui | — |
| `/activations` | Oui | **ABSENT sheet ingénieur** | **LACUNE** | Dans sidebar mais pas dans le sheet mobile |
| `/stock` | Oui — groupe Stock | Oui — dans sheet | Oui — 2 taps | — |
| `/stock/produits` | Oui — groupe Stock | Via /stock tabs | Oui — 3 taps | Route partagée hors layout group |
| `/stock/produits/[id]` | Non | Via liste | Oui — 4 taps | Route partagée hors layout group |
| `/stock/mouvements` | Oui — groupe Stock | Via /stock tabs | Oui — 3 taps | — |
| `/stock/fournisseurs` | **ABSENT sidebar ingénieur** | **ABSENT sheet** | **LACUNE** | Absent de `IngenieurSidebar` NAV_GROUPS. Route partagée hors layout group. Présent dans FarmSidebar. |
| `/stock/commandes` | **ABSENT sidebar ingénieur** | **ABSENT sheet** | **LACUNE** | Absent de `IngenieurSidebar` NAV_GROUPS. |
| `/stock/commandes/[id]` | Non | Via liste | **LACUNE** — dépend de /stock/commandes | — |
| `/settings/alertes` | **ABSENT sidebar ingénieur** | Oui — dans sheet | Oui — 2 taps | Incohérence sidebar/sheet |
| `/settings/regles-activites` | **ABSENT sidebar ingénieur** | **ABSENT** | **LACUNE** | ADR-ingenieur dit c'est INGENIEUR mais absent |
| `/settings/regles-activites/[id]` | Non | — | **LACUNE** | — |
| `/settings/regles-activites/nouvelle` | Non | — | **LACUNE** | — |
| `/settings/regles-activites/placeholders` | Non | — | **LACUNE** | — |
| `/settings/config-elevage` | **ABSENT sidebar ingénieur** | **ABSENT** | **LACUNE** | ADR-ingenieur dit c'est INGENIEUR mais absent |
| `/settings/config-elevage/[id]` | Non | — | **LACUNE** | — |
| `/settings/config-elevage/nouveau` | Non | — | **LACUNE** | — |
| `/planning` | Oui (sous "Planning & Analytics") | **ABSENT** | **LACUNE** | Dans sidebar mais absent du sheet/bottom nav |
| `/analytics` | Oui (sous "Planning & Analytics") | **ABSENT** | **LACUNE** | Dans sidebar mais absent du sheet/bottom nav |
| `/releves/nouveau` | Non (via FAB) | Via FAB | Oui — 1 tap | FAB fonctionne bien |

### 2.4 Routes Backoffice layout — `/backoffice/*`

| Route | Backoffice sidebar | Backoffice mobile (sheet header) | Accessible mobile ? |
|-------|-------------------|----------------------------------|---------------------|
| `/backoffice` | — (redirect vers /backoffice/dashboard) | — | Oui (redirect) |
| `/backoffice/dashboard` | Oui | Oui (sheet via hamburger) | Oui |
| `/backoffice/sites` | Oui | Oui | Oui |
| `/backoffice/sites/[id]` | Non | Via liste | Oui |
| `/backoffice/abonnements` | Oui | Oui | Oui |
| `/backoffice/plans` | Oui | Oui | Oui |
| `/backoffice/commissions` | Oui | Oui | Oui |
| `/backoffice/remises` | Oui | Oui | Oui |
| `/backoffice/modules` | Oui | Oui | Oui |

Le backoffice est le seul layout avec une navigation mobile cohérente et complète (via hamburger + sheet dans le header). Pas de lacunes d'accessibilité identifiées.

### 2.5 Discordance routes layout — `(ingenieur)/` vs usage farm

Trois routes sont définies physiquement dans le layout group `(ingenieur)/` mais sont référencées dans la `FarmSidebar` comme si elles existaient dans `(farm)/` :

| Route | Fichier physique | Référencée dans | Problème |
|-------|-----------------|-----------------|---------|
| `/packs` | `src/app/(ingenieur)/packs/page.tsx` | `FarmSidebar` + `FarmBottomNav` sheet | Si `(farm)/packs/page.tsx` n'existe pas, la route `/packs` depuis le farm layout est servie par le fichier ingénieur — comportement implicite acceptable seulement si le `AppShell` route correctement |
| `/activations` | `src/app/(ingenieur)/activations/page.tsx` | `FarmSidebar` | Idem |
| `/mes-taches` | `src/app/(ingenieur)/mes-taches/page.tsx` | `FarmSidebar` groupe "Planning & Activités" | Idem |

**Action requise Sprint 12 :** Vérifier le comportement de routing Next.js pour ces routes depuis le farm layout. Deux options :
1. Créer des pages miroir dans `(farm)/packs/`, `(farm)/activations/`, `(farm)/mes-taches/` — solution propre mais duplication.
2. Déplacer ces pages hors des layout groups (racine `src/app/`) comme le pattern §2.2-bis — solution recommandée si le contenu est identique pour les deux audiences.

Jusqu'à résolution, ces routes sont marquées **"routes à créer dans (farm)/ ou à déplacer à la racine"** dans les sections de navigation farm.

---

## 3. Inventaire complet des lacunes

### 3.1 Lacunes critiques (fonctionnalité inaccessible sur mobile sans URL directe)

| # | Route | Layout | Gravité | Impact |
|---|-------|--------|---------|--------|
| L1 | `/bacs` | Farm | Haute | Les bacs sont une ressource centrale. Pas dans le sheet ni le bottom nav farm |
| L2 | `/releves` (historique) | Farm | Haute | L'historique des relevés est inaccessible sans URL sur mobile farm |
| L3 | `/notifications` | Farm | Haute | Aucun chemin mobile. La cloche notification n'est que dans la sidebar desktop |
| L4 | `/mes-taches` | Farm | Haute | Absent du sheet farm. Le PISCICULTEUR a des tâches mais ne peut y accéder sur mobile |
| L5 | `/settings/alertes` | Farm | Moyenne | Absent du sheet farm. Présent uniquement dans ingénieur sheet |
| L6 | `/settings/config-elevage` | Farm + Ingénieur | Moyenne | Absent des deux nav mobiles alors que ADR-ingenieur dit INGENIEUR |
| L7 | `/settings/regles-activites` | Farm + Ingénieur | Moyenne | Idem — expertise ingénieur mais aucun chemin mobile |
| L8 | `/depenses` | Farm | Haute | Absent du sheet farm. Accessible seulement via /finances + navigation interne |
| L9 | `/clients` | Farm | Haute | Absent du sheet farm. Accessible via /finances + navigation interne |
| L10 | `/depenses/recurrentes` | Farm | Moyenne | Aucun chemin mobile (ni sidebar, ni sheet) |
| L11 | `/activations` | Farm + Ingénieur | Basse | Présent sidebar desktop mais absent des deux sheets mobiles |
| L12 | `/analytics/aliments/simulation` | Farm + Ingénieur | Basse | Aucun chemin direct. Accessible via /analytics/aliments mais pas évident |
| L13 | `/planning` | Ingénieur | Haute | Présent dans `IngenieurSidebar` ("Planning & Analytics") mais absent du sheet/bottom nav mobile |
| L14 | `/analytics` | Ingénieur | Haute | Idem — présent sidebar ingénieur mais absent sheet/bottom nav |
| L15 | `/stock/fournisseurs` | Ingénieur | Moyenne | Absent de `IngenieurSidebar` NAV_GROUPS (groupe Stock n'a que produits + mouvements) |
| L16 | `/stock/commandes` | Ingénieur | Moyenne | Idem — absent de `IngenieurSidebar` NAV_GROUPS |
| L17 | `/observations` | Farm | Moyenne | Page `src/app/observations/page.tsx` existe mais absente de toute nav (sidebar, sheet, bottom nav) |
| L18 | `/besoins` | Farm | Moyenne | Présent dans `FarmSidebar` groupe Stock mais absent du sheet `FarmBottomNav` |

### 3.2 Incohérences entre mobile et desktop

| # | Route | Problème |
|---|-------|---------|
| I1 | `/settings/alertes` | Présent dans sheet ingénieur mobile mais ABSENT de la sidebar ingénieur desktop |
| I2 | `/releves` | Sidebar farm a "Relevés" + "Calibrages" mais bottom nav farm n'a ni l'un ni l'autre |
| I3 | `/bacs` | Sidebar farm a "Bacs" mais bottom nav farm ne l'a pas |
| I4 | `/mes-taches` | Présent dans sidebar farm ("Planning & Activités") et sidebar ingénieur mais absent bottom nav farm |
| I5 | Sidebar legacy `sidebar.tsx` | Référence des routes `/admin/*` inexistantes (Admin Abonnements, Admin Commissions) — ces routes n'existent plus |
| I6 | `bottom-nav.tsx` (legacy) | Encore utilisé dans le fallback AppShell pour rôle null. Référence `getModuleNavForPath` qui inclut modules `Admin Abonnements`/`Admin Commissions` inexistants |
| I7 | `/activations` | Présent sidebar farm ET sidebar ingénieur mais absent des deux sheets mobiles correspondants |
| I8 | `FarmSidebar` | Groupe "Administration" inclut `/settings/config-elevage` et `/settings/regles-activites` mais ce sont des modules INGENIEUR selon ADR-ingenieur |
| I9 | `IngenieurBottomNav` sheet | A `/settings/alertes` mais `IngenieurSidebar` ne l'a pas — incohérence desktop/mobile ingénieur |
| I10 | `FarmSidebar` groupe Stock | A `/stock/fournisseurs` et `/besoins` mais `FarmBottomNav` sheet n'a ni l'un ni l'autre |
| I11 | `/observations` | Page existante non référencée dans aucun composant de navigation |
| I12 | `/calibrages` | Item dans `FarmSidebar` groupe Élevage mais page `src/app/calibrages/page.tsx` inexistante — lien mort |

### 3.3 Routes présentes dans une nav mais appartenant au mauvais layout

| # | Route | Nav actuelle | Layout correct (ADR-ingenieur) |
|---|-------|-------------|-------------------------------|
| M1 | `/settings/config-elevage` | Farm sidebar, groupe "Administration" | INGENIEUR |
| M2 | `/settings/regles-activites` | Farm sidebar, groupe "Administration" | INGENIEUR |
| M3 | `/mes-taches` | Farm sidebar + ingénieur sidebar | INGENIEUR principalement |
| M4 | `/monitoring` | Farm sidebar (groupe "Ingenieur") | INGENIEUR exclusivement |

### 3.4 Composants de navigation legacy non utilisés activement

| Fichier | Statut | Note |
|---------|--------|------|
| `src/components/layout/sidebar.tsx` | Legacy — fallback pour rôle null | Contient références à routes inexistantes (/admin/\*) |
| `src/components/layout/bottom-nav.tsx` | Legacy — fallback pour rôle null | Contextual nav complexe, risqué |
| `src/components/layout/hamburger-menu.tsx` | Legacy — fallback pour rôle null | Duplique la logique de `sidebar.tsx` pour mobile |
| `src/components/layout/header.tsx` | Fichier présent mais non utilisé dans les layouts actifs | À vérifier |

---

## 4. Solution proposée

### 4.1 Principes directeurs

1. **Tout accessible en maximum 2 taps sur mobile** — pour les fonctionnalités quotidiennes.
2. **Bottom nav = 5 items fixes** — les 4–5 destinations les plus fréquentes + "Menu" en dernier.
3. **Le sheet "Menu" = panneau secondaire complet** — toutes les destinations qui ne tiennent pas dans les 5 items.
4. **Cohérence mobile/desktop** — tout ce qui est dans la sidebar desktop est dans le sheet mobile, et vice-versa.
5. **Séparation claire farm/ingénieur** — pas d'items qui appartiennent à l'autre audience.
6. **Notifications accessibles partout** — la cloche notification doit être dans la topbar mobile, pas seulement en desktop.

### 4.2 Architecture Farm Layout — Spécification complète

#### Farm Bottom Nav Mobile (5 items)

```
┌──────────────────────────────────────────────────┐
│  [Accueil]  [Ma ferme]  [Finances]  [Messages]  [Menu] │
└──────────────────────────────────────────────────┘
```

| Position | Label | Icon | Route | Permission | Module |
|----------|-------|------|-------|-----------|--------|
| 1 | Accueil | Home | `/` | DASHBOARD_VOIR | — |
| 2 | Ma ferme | Layers | `/vagues` | VAGUES_VOIR | GROSSISSEMENT |
| 3 | Finances | Wallet | `/finances` | FINANCES_VOIR | VENTES |
| 4 | Messages | MessageSquare | `/notes` | — | — |
| 5 | Menu | Menu | sheet open | — | — |

Règle d'activation : `isActive` pour "Ma ferme" couvre `/vagues`, `/bacs`, `/releves`, `/analytics/bacs`, `/analytics/vagues`. Pour "Finances" : `/finances`, `/ventes`, `/factures`, `/clients`, `/depenses`.

Si FINANCES_VOIR absent → item 3 "Finances" masqué. Si VAGUES_VOIR absent → item 2 masqué. La bottom nav se compresse (3 ou 4 items). Ne jamais laisser un slot vide.

#### Farm Sheet "Menu" — Organisation par groupes

Le sheet s'ouvre du bas, hauteur max 85vh, scroll vertical.

```
┌────────────────────────────────────────────────┐
│  FarmFlow                                [×]   │
├────────────────────────────────────────────────┤
│  ÉLEVAGE                                       │
│  [Vagues]  [Bacs]  [Relevés]  [Observations]  │
│  [Notifs]                                      │
├────────────────────────────────────────────────┤
│  STOCK                                         │
│  [Stock]  [Fournisseurs]  [Commandes]          │
│  [Besoins]                                     │
├────────────────────────────────────────────────┤
│  FINANCES                                      │
│  [Finances]  [Ventes]  [Factures]              │
│  [Clients]  [Dépenses]                         │
├────────────────────────────────────────────────┤
│  ANALYSE & PLANNING                            │
│  [Analytics]  [Planning]  [Mes tâches]         │
├────────────────────────────────────────────────┤
│  ALEVINS (si module REPRODUCTION actif)        │
│  [Alevins]                                     │
├────────────────────────────────────────────────┤
│  ADMINISTRATION                                │
│  [Paramètres]  [Utilisateurs]  [Abonnement]   │
│  [Packs]  (Backoffice si superAdmin)           │
├────────────────────────────────────────────────┤
│  [Avatar] Jean Kamdem — Administrateur  [Lang] │
│  [Déconnexion]                                 │
└────────────────────────────────────────────────┘
```

Détail des items par groupe dans le sheet (avec conditions d'affichage) :

**Groupe Élevage** (gate : VAGUES_VOIR + module GROSSISSEMENT)
- `/vagues` — Vagues — Waves
- `/bacs` — Bacs — Container *(corrige L1)*
- `/releves` — Relevés — NotebookPen *(corrige L2)*
- `/observations` — Observations — Eye *(corrige L17 — route partagée hors layout group)*
- `/notifications` — Notifications — Bell *(corrige L3)*

**Groupe Stock** (gate : STOCK_VOIR + module INTRANTS)
- `/stock` — Stock — Package
- `/stock/fournisseurs` — Fournisseurs — Truck *(corrige L18 partiel, L15)*
- `/stock/commandes` — Commandes — ShoppingCart
- `/besoins` — Besoins — ClipboardList (gate BESOINS_SOUMETTRE) *(corrige L18)*

**Groupe Finances** (gate : FINANCES_VOIR + module VENTES)
- `/finances` — Finances — Wallet
- `/ventes` — Ventes — Banknote
- `/factures` — Factures — FileText
- `/clients` — Clients — Users *(corrige L9)*
- `/depenses` — Dépenses — Receipt *(corrige L8)*

**Groupe Analyse & Planning** (gate : DASHBOARD_VOIR)
- `/analytics` — Analytics — BarChart3
- `/planning` — Planning — Calendar (gate PLANNING_VOIR)
- `/mes-taches` — Mes tâches — ClipboardCheck *(corrige L4)*

**Groupe Alevins** (gate : ALEVINS_VOIR + module REPRODUCTION)
- `/alevins` — Alevins — Egg

**Groupe Administration** (gate : SITE_GERER ou UTILISATEURS_VOIR ou ABONNEMENTS_VOIR)
- `/settings/sites` — Paramètres — Settings (gate SITE_GERER)
- `/settings/alertes` — Alertes — Bell (gate ALERTES_CONFIGURER) *(corrige L5)*
- `/users` — Utilisateurs — Users (gate UTILISATEURS_VOIR)
- `/mon-abonnement` — Abonnement — CreditCard (gate ABONNEMENTS_VOIR)
- `/packs` — Packs — Boxes (gate ACTIVER_PACKS)
- `/activations` — Activations — ClipboardCheck (gate ACTIVER_PACKS) *(corrige L11)*
- `/backoffice` — Backoffice — Shield (gate isSuperAdmin)

#### Farm Sidebar Desktop — Groupes réorganisés

Groupes dans l'ordre :
1. **Élevage** — Dashboard `/`, Vagues `/vagues`, Bacs `/bacs`, Relevés `/releves`, Observations `/observations`
2. **Stock** (gate STOCK_VOIR + INTRANTS) — Vue stock `/stock`, Produits, Mouvements, Fournisseurs, Commandes, Besoins
3. **Finances** (gate FINANCES_VOIR + VENTES) — Dashboard finances `/finances`, Ventes, Factures, Clients, Dépenses
4. **Alevins** (gate ALEVINS_VOIR + REPRODUCTION) — Vue `/alevins`, Reproducteurs, Pontes, Lots
5. **Planning & Tâches** (gate PLANNING_VOIR) — Planning `/planning`, Mes tâches `/mes-taches`
6. **Analytics** (gate DASHBOARD_VOIR) — Vue globale `/analytics`, Vagues, Bacs, Aliments
7. **Administration** (gate SITE_GERER) — Paramètres sites, Alertes, Règles activités, Config élevage, Utilisateurs
8. **Abonnement** (gate ABONNEMENTS_VOIR) — Mon abonnement, Packs (gate ACTIVER_PACKS), Activations
9. **Super Admin** (gate isSuperAdmin) — Backoffice

Changements vs état actuel :
- `/bacs` et `/releves` ajoutés au groupe Élevage (retirés de nulle part)
- `/clients` et `/depenses` déplacés dans groupe dédié Finances (pas dans Ventes)
- `/settings/config-elevage` et `/settings/regles-activites` retirés du groupe "Administration" car ce sont des fonctions INGENIEUR (correction M1, M2)
- `/mes-taches` ajouté explicitement dans "Planning & Tâches"
- `/mon-abonnement/renouveler` accessible via `/mon-abonnement` (pas besoin de nav directe)

#### Farm — Topbar mobile (nouvelle)

Une topbar `FarmHeader` fixée en haut sur mobile uniquement (`md:hidden`), contenant :
- Logo FarmFlow (gauche)
- `NotificationBell` (droite) *(corrige L3 — la cloche n'est visible que desktop actuellement)*
- `SiteSelector` si plusieurs sites

```
┌─────────────────────────────────────────┐
│  FarmFlow              [🔔] [Site ▼]    │
└─────────────────────────────────────────┘
```

### 4.3 Architecture Ingénieur Layout — Spécification complète

#### Ingénieur Bottom Nav Mobile (5 items avec FAB central)

```
┌──────────────────────────────────────────────────────┐
│  [Accueil]  [Tâches]  [  +  ]  [Clients]  [Menu]    │
│                       (FAB)                          │
└──────────────────────────────────────────────────────┘
```

| Position | Label | Icon | Route | Permission |
|----------|-------|------|-------|-----------|
| 1 | Accueil | Home | `/` | DASHBOARD_VOIR |
| 2 | Tâches | CheckSquare | `/mes-taches` | DASHBOARD_VOIR |
| 3 | + (FAB) | Plus | relevé rapide | RELEVES_CREER |
| 4 | Clients | Users | `/monitoring` | MONITORING_CLIENTS |
| 5 | Menu | Menu | sheet open | — |

Le FAB est élevé `-translate-y-3` et visuellement distinct (couleur primary, taille 56px). Comportement via `FabReleve` existant.

#### Ingénieur Sheet "Menu" — Organisation

```
┌──────────────────────────────────────────┐
│  FarmFlow                           [×]  │
├──────────────────────────────────────────┤
│  MONITORING                              │
│  [Clients]  [Notes]  [Alertes]           │
├──────────────────────────────────────────┤
│  OPÉRATIONS                              │
│  [Stock]  [Fournisseurs]  [Commandes]    │
│  [Planning]  [Analytics]                 │
├──────────────────────────────────────────┤
│  COMMERCIAL                              │
│  [Packs]  [Activations]  [Portefeuille]  │
├──────────────────────────────────────────┤
│  CONFIGURATION                           │
│  [Config élevage]  [Règles activités]    │
├──────────────────────────────────────────┤
│  [Avatar] Nom — Ingénieur       [Lang]   │
│  [Déconnexion]                           │
└──────────────────────────────────────────┘
```

Détail des items (avec corrections) :

**Groupe Monitoring** (gate : MONITORING_CLIENTS)
- `/monitoring` — Clients supervisés — Users
- `/notes` — Notes — NotebookPen (gate ENVOYER_NOTES)
- `/settings/alertes` — Alertes — Bell (gate ALERTES_CONFIGURER) *(corrige I1 — cohérence sidebar/sheet)*

**Groupe Opérations** (sans gate spécifique — toujours visible si rôle INGENIEUR)
- `/stock` — Stock — Package (gate STOCK_VOIR + module INTRANTS)
- `/stock/fournisseurs` — Fournisseurs — Truck (gate STOCK_VOIR) *(corrige L15 — absent de IngenieurSidebar)*
- `/stock/commandes` — Commandes — ShoppingCart (gate STOCK_VOIR) *(corrige L16 — absent de IngenieurSidebar)*
- `/planning` — Planning — Calendar (gate PLANNING_VOIR) *(corrige L13)*
- `/analytics` — Analytics — BarChart3 (gate DASHBOARD_VOIR) *(corrige L14)*

Note : `/stock/produits` et `/stock/mouvements` sont accessibles via les onglets internes de `/stock`. Ils ne nécessitent pas d'items dédiés dans le sheet mais sont présents dans la `IngenieurSidebar` groupe Stock.

**Groupe Commercial** (gate : ACTIVER_PACKS)
- `/packs` — Packs — Boxes
- `/activations` — Activations — ClipboardCheck *(corrige L11 ingénieur)*
- `/mon-portefeuille` — Portefeuille — Wallet (gate PORTEFEUILLE_VOIR)

**Groupe Configuration** (gate : GERER_CONFIG_ELEVAGE ou REGLES_ACTIVITES_VOIR)
- `/settings/config-elevage` — Config élevage — Settings *(corrige L6)*
- `/settings/regles-activites` — Règles activités — Zap *(corrige L7)*

#### Ingénieur Sidebar Desktop — Groupes réorganisés

1. **Opérations** (gate DASHBOARD_VOIR) — Dashboard `/`, Tâches `/mes-taches`, Vagues `/vagues`, Bacs `/bacs`, Relevés `/releves`
2. **Monitoring** (gate MONITORING_CLIENTS) — Clients supervisés `/monitoring`, Notes `/notes`
3. **Stock** (gate STOCK_VOIR + INTRANTS) — Vue stock `/stock`, Produits `/stock/produits`, Mouvements `/stock/mouvements`, Fournisseurs `/stock/fournisseurs` *(corrige L15)*, Commandes `/stock/commandes` *(corrige L16)*
4. **Analyse & Planning** (gate PLANNING_VOIR) — Planning `/planning`, Analytics `/analytics`
5. **Commercial** (gate ACTIVER_PACKS) — Packs `/packs`, Activations `/activations`, Portefeuille `/mon-portefeuille`
6. **Configuration** — Alertes `/settings/alertes` *(corrige I1)*, Config élevage `/settings/config-elevage`, Règles activités `/settings/regles-activites`

### 4.4 Architecture Backoffice — État actuel satisfaisant

Le backoffice dispose d'une navigation cohérente mobile et desktop via :
- Sidebar desktop (hidden sur mobile) — 7 items + "Retour à l'application"
- Hamburger bouton dans BackofficeHeader → Sheet identical aux items sidebar

Aucune lacune identifiée. Aucun changement requis sur le backoffice.

### 4.5 Notifications — Accessibilité mobile

Actuellement `NotificationBell` est dans `FarmSidebar` (desktop only) et `IngenieurSidebar` (desktop only). Il n'existe pas de chemin mobile vers les notifications.

**Solution :** Créer un composant `FarmHeader` et `IngenieurHeader` pour mobile uniquement :
- Visible uniquement sur mobile (`md:hidden`)
- Contient la `NotificationBell` (icône cloche avec badge count)
- Contient `SiteSelector` si l'utilisateur a plusieurs sites
- Sticky en haut du viewport

Le composant `AppShell` doit injecter ce header en haut du `<main>` pour les layouts farm et ingénieur.

Alternatif : ajouter la cloche dans la bottom nav (item 4 ou via le sheet header) — moins optimal car la cloche est une action persistente, pas une destination.

---

## 5. Feed Analytics (Sprint FA-FD) — Intégration navigation

Les pages feed analytics concernées :

| Route | Layout | Intégration |
|-------|--------|-------------|
| `/analytics/aliments` | Farm + Ingénieur | Déjà accessible via `/analytics` (module nav) |
| `/analytics/aliments/[produitId]` | Farm + Ingénieur | Via liste `/analytics/aliments` |
| `/analytics/aliments/simulation` | Farm + Ingénieur | Via `/analytics/aliments/[produitId]` — bouton "Simuler" |

Aucun item de navigation top-level n'est requis pour les feed analytics. Ces pages s'intègrent dans la navigation contextuelle du module "Analytics" et "Intrants".

La page de simulation (`/analytics/aliments/simulation`) doit être accessible via un bouton CTA depuis la page détail produit (`/analytics/aliments/[produitId]`). Pas de lien direct dans la navigation — la simulation est un outil avancé accessible après consultation du détail.

Pour le module "Intrants" / "Stock", le lien `/analytics/aliments` doit être ajouté au sheet "Menu" sous le groupe Stock (accès rapide depuis la gestion stock) :
- `/analytics/aliments` — Analytiques aliments — BarChart3 (gate DASHBOARD_VOIR + module INTRANTS)

---

## 6. Plan de migration

### Phase 1 — Corrections urgentes (Sprint courant)

Ces corrections sont des ajouts purs dans les fichiers de navigation existants, sans refonte.

**FarmBottomNav (sheet items) :**
- Ajouter `/bacs` — "Bacs" dans le groupe Élevage du sheet
- Ajouter `/releves` — "Relevés" dans le groupe Élevage
- Ajouter `/observations` — "Observations" dans le groupe Élevage *(corrige L17)*
- Ajouter `/mes-taches` — "Mes tâches" dans le groupe Analyse (préalable : §2.5 résolu)
- Ajouter `/clients` — "Clients" dans le groupe Finances
- Ajouter `/depenses` — "Dépenses" dans le groupe Finances
- Ajouter `/settings/alertes` — "Alertes" dans le groupe Administration
- Ajouter `/activations` — "Activations" dans le groupe Packs (préalable : §2.5 résolu)
- Ajouter `/notifications` — "Notifications" (new item)
- Ajouter `/stock/fournisseurs` — "Fournisseurs" dans le groupe Stock *(corrige I10)*
- Ajouter `/besoins` — "Besoins" dans le groupe Stock *(corrige L18)*

**IngenieurBottomNav (sheet items) :**
- Ajouter `/planning` — "Planning" dans le sheet
- Ajouter `/analytics` — "Analytics" dans le sheet
- Ajouter `/activations` — "Activations" dans le sheet
- Ajouter `/settings/config-elevage` — "Config élevage" dans le sheet
- Ajouter `/settings/regles-activites` — "Règles activités" dans le sheet

**IngenieurSidebar :**
- Ajouter `/stock/fournisseurs` et `/stock/commandes` dans le groupe Stock *(corrige L15, L16)*
- Ajouter `/settings/alertes` dans un groupe Configuration *(corrige I1, I9)*
- Ajouter `/settings/config-elevage` et `/settings/regles-activites` dans Configuration *(corrige L6, L7)*

### Phase 2 — Restructuration des groupes (Sprint 12)

- Réorganiser les groupes de la `FarmSidebar` selon la spécification §4.2
- Réorganiser les groupes de l'`IngenieurSidebar` selon la spécification §4.3
- Créer `FarmHeader` et `IngenieurHeader` (topbar mobile avec NotificationBell)
- Intégrer le header mobile dans `AppShell`

### Phase 3 — Nettoyage legacy (Sprint 12)

- Audit et nettoyage de `sidebar.tsx` (supprimer références `/admin/*` inexistantes)
- Audit et nettoyage de `bottom-nav.tsx` et `hamburger-menu.tsx`
- Vérifier et nettoyer `module-nav-items.ts` (entrées `Admin Abonnements`, `Admin Commissions`, `Admin Remises` qui pointent vers `/admin/*` inexistant)
- Déplacer `/settings/config-elevage` et `/settings/regles-activites` hors du groupe "Administration" de la FarmSidebar (ces pages appartiennent à l'INGENIEUR)

---

## 7. Spécification des wireframes ASCII

### 7.1 Farm mobile — Navigation complète

```
ÉTAT PAR DÉFAUT (dashboard)
┌─────────────────────────────────────────────┐  ← 360px
│  FarmFlow                         [🔔] [▼]  │  ← topbar mobile (NEW)
├─────────────────────────────────────────────┤
│                                             │
│  [contenu dashboard]                        │
│                                             │
│                                             │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│  [🏠]    [⟰]    [💰]    [💬]    [☰]       │  ← bottom nav 56px min
│ Accueil  Ferme  Finances  Msg   Menu        │
└─────────────────────────────────────────────┘

ÉTAT SHEET MENU OUVERT (slide-up)
┌─────────────────────────────────────────────┐
│  [contenu partiel visible]                  │
├─────────────────────────────────────────────┤
│  FarmFlow                              [×]  │  ← sheet header
│ ─────────────────────────────────────────── │
│  ÉLEVAGE                                    │
│  [🌊 Vagues] [📦 Bacs] [📋 Relevés]        │  ← grid 3 colonnes
│  [👁 Obs.]  [🔔 Notifs]                     │
│ ─────────────────────────────────────────── │
│  STOCK                                      │
│  [📦 Stock] [🚛 Fournisseurs] [🛒 Cmdes]   │
│  [📝 Besoins]                               │
│ ─────────────────────────────────────────── │
│  FINANCES                                   │
│  [💰 Finances] [💵 Ventes] [📄 Factures]   │
│  [👥 Clients] [🧾 Dépenses]                │
│ ─────────────────────────────────────────── │
│  ANALYSE & PLANNING                         │
│  [📊 Analytics] [📅 Planning] [✅ Tâches]  │
│ ─────────────────────────────────────────── │
│  ADMINISTRATION                             │
│  [⚙ Paramètres] [👥 Utilisateurs]          │
│  [💳 Abonnement] [📦 Packs]                │
│ ─────────────────────────────────────────── │
│  [Avatar] Jean K. — Admin         [FR/EN]  │
│  [→ Déconnexion]                            │
└─────────────────────────────────────────────┘
```

### 7.2 Ingénieur mobile — Navigation complète

```
ÉTAT PAR DÉFAUT
┌─────────────────────────────────────────────┐
│  FarmFlow (Ingénieur)             [🔔]      │  ← topbar mobile
├─────────────────────────────────────────────┤
│                                             │
│  [contenu dashboard ingénieur]              │
│                                             │
├─────────────────────────────────────────────┤
│  [🏠]   [✅]   [    ➕    ]  [👥]   [☰]   │
│ Accueil Tâches  (FAB élevé)  Clients Menu  │
└─────────────────────────────────────────────┘

ÉTAT SHEET MENU OUVERT
┌─────────────────────────────────────────────┐
│  FarmFlow                              [×]  │
│ ─────────────────────────────────────────── │
│  MONITORING                                 │
│  [👥 Clients] [📝 Notes] [🔔 Alertes]      │
│ ─────────────────────────────────────────── │
│  OPÉRATIONS                                 │
│  [📦 Stock] [🚛 Fournis.] [🛒 Cmdes]       │
│  [📅 Planning] [📊 Analytics]               │
│ ─────────────────────────────────────────── │
│  COMMERCIAL                                 │
│  [📦 Packs] [✅ Activations] [💰 Portef.]  │
│ ─────────────────────────────────────────── │
│  CONFIGURATION                              │
│  [⚙ Config élevage] [⚡ Règles activités]  │
│ ─────────────────────────────────────────── │
│  [Avatar] Paul N. — Ingénieur     [FR/EN]  │
│  [→ Déconnexion]                            │
└─────────────────────────────────────────────┘
```

### 7.3 Desktop sidebar — Farm (structure groupes)

```
┌──────────────────────────────────────┐  ← w-60
│  🐟 FarmFlow                    [🔔] │  ← header (h-14)
├──────────────────────────────────────┤
│  ÉLEVAGE                             │
│  ● Dashboard                         │
│  ● Vagues                            │
│  ● Bacs               ← (NEW ici)   │
│  ● Relevés            ← (NEW ici)   │
│  ● Observations       ← (NEW ici)   │
├──────────────────────────────────────┤
│  STOCK              (si INTRANTS)    │
│  ● Vue stock                         │
│  ● Produits                          │
│  ● Mouvements                        │
│  ● Fournisseurs                      │
│  ● Commandes                         │
│  ● Besoins                           │
├──────────────────────────────────────┤
│  FINANCES           (si VENTES)      │
│  ● Dashboard finances                │
│  ● Ventes                            │
│  ● Factures                          │
│  ● Clients                           │
│  ● Dépenses                          │
├──────────────────────────────────────┤
│  ALEVINS          (si REPRODUCTION)  │
│  ● Vue alevins                       │
│  ● Reproducteurs                     │
│  ● Pontes                            │
│  ● Lots                              │
├──────────────────────────────────────┤
│  PLANNING & TÂCHES                   │
│  ● Planning                          │
│  ● Mes tâches        ← (AJOUTÉ)     │
├──────────────────────────────────────┤
│  ANALYTICS                           │
│  ● Vue globale                       │
│  ● Vagues                            │
│  ● Bacs                              │
│  ● Aliments                          │
├──────────────────────────────────────┤
│  ADMINISTRATION     (si SITE_GERER)  │
│  ● Paramètres sites                  │
│  ● Alertes                           │
│  ● Utilisateurs                      │
├──────────────────────────────────────┤
│  ABONNEMENT   (si ABONNEMENTS_VOIR)  │
│  ● Mon abonnement                    │
│  ● Packs             (si ACTIVER_P) │
│  ● Activations                       │
├──────────────────────────────────────┤
│  SUPER ADMIN    (si isSuperAdmin)    │
│  ● Backoffice                        │
└──────────────────────────────────────┘
```

---

## 8. Composants à créer ou modifier

### 8.1 Nouveaux composants

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `FarmHeader` | `src/components/layout/farm-header.tsx` | Topbar mobile farm — logo + NotificationBell + SiteSelector. `md:hidden`. |
| `IngenieurHeader` | `src/components/layout/ingenieur-header.tsx` | Topbar mobile ingénieur — logo + NotificationBell. `md:hidden`. |

### 8.2 Composants à modifier

| Composant | Fichier | Modifications |
|-----------|---------|--------------|
| `FarmBottomNav` | `src/components/layout/farm-bottom-nav.tsx` | Ajouter dans SHEET_ITEMS : `/bacs`, `/releves`, `/observations`, `/clients`, `/depenses`, `/stock/fournisseurs`, `/besoins`, `/settings/alertes`, `/activations`, `/notifications`. Organiser par groupes avec séparateurs. |
| `FarmSidebar` | `src/components/layout/farm-sidebar.tsx` | Réorganiser groupes selon spec §4.2, retirer config-elevage et regles-activites |
| `IngenieurBottomNav` | `src/components/layout/ingenieur-bottom-nav.tsx` | Ajouter dans SHEET_ITEMS : `/planning`, `/analytics`, `/activations`, `/stock/fournisseurs`, `/stock/commandes`, `/settings/config-elevage`, `/settings/regles-activites` |
| `IngenieurSidebar` | `src/components/layout/ingenieur-sidebar.tsx` | Ajouter `/stock/fournisseurs` et `/stock/commandes` dans groupe Stock. Créer groupe "Configuration" avec `/settings/alertes`, `/settings/config-elevage`, `/settings/regles-activites`. |
| `AppShell` | `src/components/layout/app-shell.tsx` | Injecter FarmHeader / IngenieurHeader au-dessus du `<main>` |
| `module-nav-items.ts` | `src/lib/module-nav-items.ts` | Supprimer entrées `/admin/*` inexistantes, ajouter `/analytics/aliments` dans Intrants |

### 8.3 Composants legacy à nettoyer (Phase 3)

| Composant | Action |
|-----------|--------|
| `sidebar.tsx` | Supprimer entrées Admin Abonnements / Admin Commissions / Admin Remises (`/admin/*` inexistants) |
| `bottom-nav.tsx` | Audit — utilisé uniquement dans le fallback AppShell (rôle null). Simplifier ou supprimer si le fallback n'est plus nécessaire |
| `hamburger-menu.tsx` | Idem — cleanup des entrées `/admin/*` |

---

## 9. Règles d'accessibilité ARIA

Pour tous les boutons de navigation mobile :
- Attribut `aria-label` obligatoire sur les boutons sans texte visible
- `aria-current="page"` sur l'item actif de la bottom nav
- Le FAB ingénieur doit avoir `aria-label="Nouveau relevé"`
- Les sheets (Radix UI `SheetContent`) doivent avoir `aria-label` ou `aria-labelledby` pointant vers le titre du sheet
- Focus trap dans le sheet (déjà géré par Radix UI)
- Touch targets minimum 44×44px (objectif 56px de hauteur sur bottom nav)

---

## 10. Décision

Ce document est soumis pour validation. Une fois validé, les corrections Phase 1 (§6 Phase 1) peuvent être implémentées immédiatement dans les fichiers existants sans refonte architecturale.

Les Phases 2 et 3 font l'objet de stories Sprint 12 dédiées.

**Statut : PROPOSÉ — en attente de validation @project-manager**
