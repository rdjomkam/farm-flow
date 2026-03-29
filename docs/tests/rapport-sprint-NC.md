# Rapport de test — Sprint NC (Nettoyage legacy Navigation Phase 3)

**Sprint :** NC
**Date :** 2026-03-29
**Testeur :** @tester
**Stories couvertes :** NC.5, NC.6, NC.7, NC.8

---

## Résumé exécutif

| Critère | Résultat |
|---------|----------|
| `npx vitest run` | 117 fichiers, 3676 tests — TOUS PASSENT |
| `npm run build` | BUILD OK — 0 erreur TypeScript |
| Stale imports (composants supprimés) | Aucun détecté |
| Routes /admin/* dans les navs | Aucune |
| Routes inexistantes dans les navs | Aucune |
| ARIA audit | Conforme |

---

## 1. Vérification des tests (NC.5 / NC.8)

### Avant sprint NC
- 116 fichiers de test, 3609 tests passants

### Après sprint NC
- 117 fichiers de test, 3676 tests passants (+1 fichier, +67 tests)
- Nouveau fichier : `src/__tests__/ui/sprint-nc-nav-cleanup.test.ts`

---

## 2. Vérification du build (NC.8)

```
npm run build
```

Résultat :
- Prisma generate : OK (Client 7.4.2)
- Prisma migrate deploy : 63 migrations, aucune en attente
- TypeScript compilation : OK
- Next.js build : 138 pages statiques générées
- Aucune erreur TypeScript ou de module manquant

---

## 3. Imports stale — composants supprimés (NC.1 / NC.2 / NC.3)

Fichiers supprimés lors du cleanup NC.1-NC.3 :
- `sidebar.tsx` (legacy)
- `bottom-nav.tsx` (legacy)
- `hamburger-menu.tsx` (legacy)

Vérification des imports dans tout `src/` :
- Aucun fichier source n'importe ces composants supprimés
- `app-shell.tsx` : utilise correctement `FarmSidebar`, `FarmBottomNav`, `IngenieurSidebar`, `IngenieurBottomNav`
- `responsive.test.tsx` : contient un commentaire de migration documentant la suppression (pas d'import cassé)
- `hamburger-menu.test.ts` : test de non-régression BUG-021 reimplementant les données statiques sans importer le composant supprimé

---

## 4. Couverture des routes Farm (NC.5)

### FarmBottomNav — 5 slots primaires
| Slot | Route | Condition |
|------|-------|-----------|
| 1. Accueil | `/` | Toujours visible |
| 2. Vagues | `/vagues` | VAGUES_VOIR |
| 3. Finances | `/finances` | FINANCES_VOIR + module VENTES |
| 4. Notes | `/notes` | ENVOYER_NOTES |
| 5. Menu | — | Toujours visible (ouvre Sheet) |

### FarmBottomNav — Sheet (6 groupes)
| Groupe | Routes principales |
|--------|-------------------|
| grossissement | /vagues, /bacs, /releves, /observations |
| intrants | /stock, /stock/fournisseurs, /stock/commandes, /besoins |
| ventes | /finances, /ventes, /factures, /clients, /depenses |
| analysePilotage | /analytics, /planning, /mes-taches |
| reproduction | /alevins (gate REPRODUCTION) |
| configuration | /settings/sites, /settings/alertes, /users, /mon-abonnement, /packs, /activations, /backoffice (superAdmin) |

### FarmSidebar — 8 groupes (ADR §4.4)
| Groupe | Permission | Module |
|--------|-----------|--------|
| Élevage | VAGUES_VOIR | GROSSISSEMENT |
| Stock | STOCK_VOIR | INTRANTS |
| Finances | FINANCES_VOIR | VENTES |
| Alevins | ALEVINS_VOIR | REPRODUCTION |
| Planning & Tâches | PLANNING_VOIR | — |
| Analytics | DASHBOARD_VOIR | — |
| Administration | SITE_GERER | — |
| Abonnement | ABONNEMENTS_VOIR | — |

Routes sidebar notable : `/analytics/aliments` placé dans le groupe Analytics (correction NC.4).

---

## 5. Couverture des routes Ingénieur (NC.6)

### IngenieurBottomNav — 5 slots primaires (ADR §5.3)
| Slot | Route | Condition |
|------|-------|-----------|
| 1. Accueil | `/` | Toujours visible |
| 2. Tâches | `/mes-taches` | DASHBOARD_VOIR |
| 3. FAB +Relevé | — (FAB) | RELEVES_CREER |
| 4. Clients | `/monitoring` | MONITORING_CLIENTS |
| 5. Menu | — | Toujours visible (ouvre Sheet) |

### IngenieurBottomNav — Sheet (4 groupes)
| Groupe | Routes |
|--------|--------|
| monitoring | /monitoring, /notes |
| operationsIngenieur | /stock, /stock/fournisseurs, /stock/commandes, /planning, /analytics |
| commercial | /packs, /activations, /mon-portefeuille |
| configuration | /settings/alertes, /settings/config-elevage, /settings/regles-activites |

Items statiques supplémentaires : `/profil`, `/backoffice` (superAdmin)

### IngenieurSidebar — 4 groupes (ADR §5.4)
| Groupe | Permission |
|--------|-----------|
| Monitoring | MONITORING_CLIENTS |
| Opérations | Toujours visible (filtrage individuel par ITEM_VIEW_PERMISSIONS) |
| Commercial | ACTIVER_PACKS ou PORTEFEUILLE_VOIR |
| Configuration | Toujours visible (filtrage individuel) |

---

## 6. Vérification absence de routes /admin/* (NC.4 / NC.8)

Routes supprimées lors de NC.4 du fichier `module-nav-items.ts` :
- `/admin/abonnements`
- `/admin/commissions`
- `/admin/remises`

Vérification :
- `farm-bottom-nav.tsx` : aucune route `/admin/*`
- `farm-sidebar.tsx` : aucune route `/admin/*`
- `ingenieur-bottom-nav.tsx` : aucune route `/admin/*`
- `ingenieur-sidebar.tsx` : aucune route `/admin/*`
- `module-nav-items.ts` : aucune route `/admin/*`

---

## 7. ARIA Audit (NC.7)

### NotificationBell (`notification-bell.tsx`)
- `aria-label` dynamique : `"Notifications"` (0 non lues) ou `"N notification(s) non lue(s)"` (N > 0)
- Touch target : `min-h-[44px] min-w-[44px]` — WCAG 2.5.5 conforme

### Bottom nav items
- Touch target : `min-h-[56px]` sur tous les items de navigation primaire (Farm et Ingénieur)
- **56px >= 44px requis par WCAG 2.5.5** — conforme

### Sheet items
- Touch target : `min-h-[72px]` sur tous les items de sheet/drawer
- **72px >= 44px requis par WCAG 2.5.5** — conforme

### OfflineNavLink (`offline-nav-item.tsx`)
- Items désactivés offline : `<span aria-disabled="true" role="link" className="opacity-50 pointer-events-none">`
- Routes cachées offline (toujours actives) : `/` et `/mes-taches`
- Routes non cachées désactivées offline : `/vagues`, `/stock`, etc.

### Points d'attention restants (non bloquants)
- Le bouton Menu (ouverture sheet) n'a pas d'`aria-label` explicite — il contient un label textuel ("Menu") donc accessible, mais un `aria-label="Ouvrir le menu de navigation"` serait préférable pour les lecteurs d'écran
- Le FAB +Relevé dans `IngenieurBottomNav` n'a pas d'`aria-label` sur l'élément div wrapper — le composant `FabReleve` interne devrait avoir son propre `aria-label`

---

## 8. Fichier de tests créé

**`src/__tests__/ui/sprint-nc-nav-cleanup.test.ts`** — 67 tests répartis en 8 suites :

| Suite | Tests | Résultat |
|-------|-------|----------|
| NC.5 — FarmBottomNav — Couverture routes Farm | 12 | PASS |
| NC.5 — FarmSidebar — Groupes (ADR §4.4) | 12 | PASS |
| NC.6 — IngenieurBottomNav — Couverture routes Ingénieur | 12 | PASS |
| NC.6 — IngenieurSidebar — Groupes (ADR §5.4) | 9 | PASS |
| NC.7 — ARIA Audit | 8 | PASS |
| NC.8 — Absence routes /admin/* | 5 | PASS |
| NC.8 — AppShell — Logique routing | 5 | PASS |
| NC.7 — Tailles tactiles (inline) | 4 | PASS |

---

## 9. Résultats finaux

```
Test Files   117 passed (117)
     Tests  3676 passed | 26 todo (3702)

Build        OK — 0 erreurs TypeScript — 138 pages générées
```

---

## 10. Conclusion

Le sprint NC (Nettoyage legacy Navigation Phase 3) est **validé** :

- Tous les composants legacy (`sidebar.tsx`, `bottom-nav.tsx`, `hamburger-menu.tsx`) ont été supprimés sans laisser d'imports cassés
- La navigation Farm (FarmBottomNav + FarmSidebar) et Ingénieur (IngenieurBottomNav + IngenieurSidebar) couvrent toutes les routes attendues par l'ADR
- Aucune route `/admin/*` ne subsiste dans les composants de navigation
- `/analytics/aliments` est correctement placé dans le groupe Analyse & Pilotage (NC.4)
- L'ARIA est conforme : `aria-label` sur NotificationBell, `aria-disabled` sur OfflineNavLink, touch targets >= 44px partout
- Le build de production est clean