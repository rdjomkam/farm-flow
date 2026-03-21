# Plan de Sprints — Internationalisation (i18n)

**Version :** 1.0
**Date :** 2026-03-21
**Auteur :** @project-manager

> Ce plan couvre les Sprints 39 a 42. Il introduit le support bilingue (francais + anglais)
> dans l'ensemble de l'application FarmFlow : infrastructure `next-intl`, extraction des chaines,
> traduction, sélecteur de langue et tests.
> Mettre a jour `docs/TASKS.md` quand chaque sprint commence.

---

## Resume des Sprints

| Sprint | Titre | Stories | Focus | Depend de |
|--------|-------|---------|-------|-----------|
| **Sprint 39** | Fondations i18n (Infrastructure + Config) | 5 | next-intl, middleware, schema, message files | Sprint 38 |
| **Sprint 40** | Extraction des chaines — Couche Core | 5 | Navigation, layout, constantes, permissions, format | Sprint 39 |
| **Sprint 41** | Extraction des chaines — Pages & Composants | 5 | Pages metier, formulaires, API errors, composants UI | Sprint 40 |
| **Sprint 42** | Sélecteur de langue, Polish & Review | 4 | Language switcher, metadata, tests, review R1-R9 | Sprint 41 |
| **Total** | | **19** | | |

---

## Decisions architecturales

### Bibliotheque choisie : `next-intl` v4+

**Pourquoi :**
- Support natif du Next.js App Router (Server + Client Components)
- Hook `useTranslations()` cote client, `getTranslations()` cote serveur
- Type-safe avec generation TS des cles de messages
- Middleware integre pour la detection de locale
- Pas de conflit avec Tailwind/Radix UI

**Approche de routage : sans prefixe de locale dans l'URL**
- L'app garde ses URLs actuelles (`/vagues`, `/stock`, etc.) — pas de `/fr/vagues` ou `/en/vagues`
- La preference de langue est stockee dans la session utilisateur (champ `locale` sur le modele `Session`)
- Pour les visiteurs non connectes : detection via `Accept-Language` header + cookie `NEXT_LOCALE`
- Raison : les URLs restent stables, pas de migration de routes, pas de SEO multilingue necessaire (app privee B2B)

**Structure des fichiers de messages :**
```
messages/
├── fr/
│   ├── common.json        — boutons, actions, etats vides, labels generiques
│   ├── navigation.json    — sidebar, bottom-nav, hamburger, module labels
│   ├── permissions.json   — noms de permissions, roles, groupes
│   ├── vagues.json        — module vagues/waves
│   ├── releves.json       — module releves/reports
│   ├── stock.json         — module intrants/stock
│   ├── ventes.json        — module ventes/sales
│   ├── alevins.json       — module reproduction/fry
│   ├── abonnements.json   — plans, checkout, abonnement
│   ├── commissions.json   — portefeuille, commissions
│   ├── analytics.json     — dashboard, graphiques, benchmarks
│   ├── settings.json      — configuration, alertes, regles
│   ├── users.json         — gestion utilisateurs
│   ├── errors.json        — messages d'erreur API + validation
│   └── format.json        — unites, devises, dates
├── en/
│   └── (meme structure, traduit en anglais)
└── index.ts               — config + types
```

**Scope des chaines :**
- ~550-650 chaines uniques a extraire
- ~280 fichiers concernes (71 pages, 170 composants, 20 libs, 146 API routes)
- Les API routes retournent des cles d'erreur (pas des messages traduits) — la traduction se fait cote client

---

## Sprint 39 — Fondations i18n (Infrastructure + Config)

**Objectif :** Mettre en place toute l'infrastructure i18n sans modifier les composants existants.
A la fin de ce sprint, `next-intl` est installe, configure, et un premier namespace (`common`) est
fonctionnel avec un composant de demonstration.

**Depend de :** Sprint 38 FAIT

---

### Story 39.1 — Schema Prisma : champ locale sur Session
**Assigne a :** @db-specialist
**Priorite :** Critique
**Complexite :** Simple
**Statut :** `FAIT`

**Description :** Ajouter le champ `locale` sur le modele `Session` pour persister la preference
de langue de l'utilisateur connecte. Valeur par defaut : `"fr"`.

**Taches :**
- [ ] `TODO` Ajouter le champ `locale String @default("fr")` sur le modele `Session` dans `prisma/schema.prisma`
- [ ] `TODO` Creer la migration SQL (methode manuelle : `npx prisma migrate diff`, mkdir, `npx prisma migrate deploy`)
- [ ] `TODO` Mettre a jour `prisma/seed.sql` : ajouter `locale = 'fr'` sur les sessions existantes
- [ ] `TODO` Mettre a jour l'interface `Session` dans `src/types/models.ts` : ajouter `locale: string`

**Criteres d'acceptation :**
- Migration appliquee sans erreur
- Sessions existantes ont `locale = 'fr'` par defaut
- R3 : interface TS miroir du modele Prisma

---

### Story 39.2 — Installation et configuration next-intl
**Assigne a :** @architect
**Priorite :** Critique
**Complexite :** Medium
**Depend de :** Story 39.1
**Statut :** `FAIT`

**Description :** Installer `next-intl`, creer la configuration, le middleware de detection de locale
et integrer dans le layout racine.

**Taches :**
- [ ] `TODO` Installer `next-intl` : `npm install next-intl`
- [ ] `TODO` Creer `src/i18n/config.ts` :
  - `export const locales = ["fr", "en"] as const;`
  - `export const defaultLocale = "fr";`
  - `export type Locale = (typeof locales)[number];`
- [ ] `TODO` Creer `src/i18n/request.ts` — configuration `getRequestConfig` de next-intl :
  - Pour les utilisateurs connectes : lire `session.locale` depuis la base
  - Pour les visiteurs : lire le cookie `NEXT_LOCALE`, fallback sur `Accept-Language`, fallback sur `"fr"`
  - Charger les fichiers de messages du namespace demande
- [ ] `TODO` Creer `src/middleware.ts` :
  - Integrer `createMiddleware` de `next-intl/middleware` (mode sans prefixe URL)
  - Gerer la detection de locale via cookie `NEXT_LOCALE`
  - Ne pas impacter les routes `/api/*` et les assets statiques
- [ ] `TODO` Modifier `next.config.ts` : ajouter le plugin `createNextIntlPlugin` si necessaire
- [ ] `TODO` Modifier `src/app/layout.tsx` :
  - Remplacer `<html lang="fr">` par `<html lang={locale}>` dynamique
  - Wrapper avec `NextIntlClientProvider` pour les Client Components
  - Passer les `messages` au provider
- [ ] `TODO` Documenter dans `docs/decisions/020-i18n-architecture.md` : choix de next-intl, approche sans prefixe URL, structure des messages

**Criteres d'acceptation :**
- `next-intl` installe et le build passe (`npm run build`)
- Le layout detecte la locale et la passe au provider
- Le middleware ne casse pas les routes existantes
- ADR documente

---

### Story 39.3 — Fichiers de messages : namespace `common`
**Assigne a :** @developer
**Priorite :** Haute
**Complexite :** Medium
**Depend de :** Story 39.2
**Statut :** `FAIT`

**Description :** Creer les premiers fichiers de messages avec le namespace `common` qui couvre
les chaines transversales (boutons, etats vides, labels generiques, unites).

**Taches :**
- [ ] `TODO` Creer `messages/fr/common.json` avec les chaines suivantes :
  - **Boutons :** "Ajouter", "Modifier", "Supprimer", "Valider", "Annuler", "Retour", "Enregistrer", "Creer", "Confirmer", "Fermer", "Charger plus", "Exporter", "Imprimer", "Rechercher", "Filtrer", "Reinitialiser"
  - **Etats vides :** "Aucun resultat", "Aucun element trouve", "Charger plus"
  - **Statuts generiques :** "Actif", "Inactif", "En cours", "Termine", "Annule"
  - **Labels generiques :** "Date", "Nom", "Code", "Statut", "Actions", "Description", "Total", "Quantite", "Prix", "Montant", "Notes", "Type", "Reference"
  - **Confirmations :** "Etes-vous sur ?", "Cette action est irreversible."
  - **Erreurs generiques :** "Une erreur est survenue", "Champ obligatoire", "Valeur invalide"
- [ ] `TODO` Creer `messages/en/common.json` avec les traductions anglaises correspondantes
- [ ] `TODO` Creer `messages/fr/format.json` :
  - Unites : "g", "kg", "mL", "L", "unite", "sacs", "FCFA"
  - Periodes : "par mois", "par trimestre", "par an"
  - Dates : "aujourd'hui", "hier", "il y a {count} jours"
  - Devise : "Gratuit"
- [ ] `TODO` Creer `messages/en/format.json` avec les traductions anglaises
- [ ] `TODO` Creer le barrel `messages/index.ts` qui exporte la config de chargement des messages

**Criteres d'acceptation :**
- Les fichiers JSON sont valides et parsables
- Les cles sont organisees hierarchiquement (ex: `common.buttons.save`, `common.empty.noResults`)
- Les traductions anglaises sont naturelles (pas du mot-a-mot)

---

### Story 39.4 — Helper hooks et utilitaires i18n
**Assigne a :** @developer
**Priorite :** Haute
**Complexite :** Simple
**Depend de :** Story 39.2
**Statut :** `FAIT`

**Description :** Creer les hooks et utilitaires reutilisables pour acceder aux traductions
dans les Server Components et Client Components.

**Taches :**
- [ ] `TODO` Creer `src/i18n/get-locale.ts` :
  - `getLocale(): Promise<Locale>` — pour Server Components, lit la locale depuis la session ou le cookie
- [ ] `TODO` Creer `src/i18n/use-locale.ts` :
  - Re-export de `useLocale()` de `next-intl` pour les Client Components
- [ ] `TODO` Modifier `src/lib/format.ts` :
  - `formatXAF(montant, locale?)` — accepter un parametre locale optionnel (defaut "fr")
  - `formatDate(date, locale?)` — utiliser `Intl.DateTimeFormat` avec la locale passee
  - `formatXAFOrFree(montant, locale?)` — utiliser `t("format.free")` ou garder la locale
- [ ] `TODO` Creer `src/app/api/locale/route.ts` :
  - `PUT` — met a jour `session.locale` dans la base + set le cookie `NEXT_LOCALE`
  - Auth requise (utilisateur connecte)
  - Valide que la locale est dans `locales` ("fr" ou "en")

**Criteres d'acceptation :**
- Les helpers fonctionnent dans les Server ET Client Components
- `formatXAF` et `formatDate` acceptent une locale optionnelle
- L'API `/api/locale` persiste la preference de langue

---

### Story 39.5 — Tests + Review Sprint 39
**Assigne a :** @tester + @code-reviewer
**Priorite :** Haute
**Complexite :** Simple
**Depend de :** Stories 39.1 a 39.4
**Statut :** `FAIT`

**Taches @tester :**
- [ ] `TODO` Tester que la migration Prisma s'applique sans erreur
- [ ] `TODO` Tester que `npm run build` passe avec `next-intl` configure
- [ ] `TODO` Tester que les routes existantes ne sont pas cassees par le middleware
- [ ] `TODO` Tester `PUT /api/locale` : changement de locale → cookie + session mis a jour
- [ ] `TODO` Tester le chargement des messages `common.json` en fr et en
- [ ] `TODO` `npx vitest run` + `npm run build` — OK
- [ ] `TODO` Ecrire `docs/tests/rapport-sprint-39.md`

**Taches @code-reviewer :**
- [ ] `TODO` Checklist R1-R9
- [ ] `TODO` Verifier que le middleware ne casse pas les routes API
- [ ] `TODO` Verifier que `NextIntlClientProvider` ne cause pas de probleme d'hydratation
- [ ] `TODO` Ecrire `docs/reviews/review-sprint-39.md`

**Criteres d'acceptation :**
- Build OK, routes intactes, tests passent
- Rapport de review produit

---

## Sprint 40 — Extraction des chaines — Couche Core

**Objectif :** Extraire toutes les chaines hardcodees des fichiers core (navigation, layout,
constantes, permissions, format). Ces fichiers impactent chaque page de l'app.

**Depend de :** Sprint 39 FAIT

---

### Story 40.1 — Namespace `navigation` : sidebar, bottom-nav, hamburger
**Assigne a :** @developer
**Priorite :** Critique
**Complexite :** Medium
**Statut :** `FAIT`

**Description :** Extraire les ~80 chaines de navigation vers le namespace `navigation`.

**Fichiers concernes :**
- `src/components/layout/sidebar.tsx` — module labels, item labels
- `src/components/layout/hamburger-menu.tsx` — module labels, item labels, role labels
- `src/components/layout/bottom-nav.tsx` — item labels
- `src/components/layout/header.tsx` — title (passe en prop, pas a traduire ici)
- `src/lib/module-nav-items.ts` — module labels, item labels

**Taches :**
- [ ] `TODO` Creer `messages/fr/navigation.json` avec toutes les chaines :
  - Modules : "Reproduction", "Grossissement", "Intrants", "Ventes", "Analyse & Pilotage", "Packs & Provisioning", "Ingenieur", "Configuration", "Abonnement", "Admin Abonnements", "Portefeuille", "Admin Commissions", "Admin Remises", "Utilisateurs"
  - Items de chaque module (voir sidebar.tsx pour la liste complete)
  - Roles : "Administrateur", "Gerant", "Pisciculteur", "Ingenieur"
  - Actions : "Se deconnecter", "Plus", "Menu"
- [ ] `TODO` Creer `messages/en/navigation.json` avec les traductions anglaises
- [ ] `TODO` Modifier `sidebar.tsx` : remplacer les labels hardcodes par `useTranslations("navigation")`
- [ ] `TODO` Modifier `hamburger-menu.tsx` : idem
- [ ] `TODO` Modifier `bottom-nav.tsx` : idem
- [ ] `TODO` Modifier `module-nav-items.ts` : exporter des cles de traduction au lieu de chaines brutes, ou accepter un `t()` en parametre

**Criteres d'acceptation :**
- Toute la navigation s'affiche correctement en francais (aucune regression)
- Les labels changent quand on switch la locale en anglais
- R6 : pas de couleurs hardcodees ajoutees

---

### Story 40.2 — Namespace `permissions` : roles, permissions, groupes
**Assigne a :** @developer
**Priorite :** Haute
**Complexite :** Medium
**Statut :** `FAIT`

**Description :** Extraire les ~72 chaines de permissions et roles vers le namespace `permissions`.

**Fichiers concernes :**
- `src/lib/permissions-constants.ts` — MODULE_VIEW_PERMISSIONS labels, SYSTEM_ROLE_DEFINITIONS
- `src/lib/role-form-labels.ts` — PERMISSION_GROUP_LABELS, individual permission labels

**Taches :**
- [ ] `TODO` Creer `messages/fr/permissions.json` :
  - Groupes : "Administration", "Elevage", "Stock & Approvisionnement", "Clients", "Ventes & Facturation", "Production Alevins", "Planning", "Finances", "Alertes", "Depenses & Besoins", "General", "Packs & Provisioning", "Configuration Elevage", "Ingenieur"
  - Permissions individuelles (~55 labels) : "Gerer le site", "Voir les vagues", etc.
  - Roles systeme : descriptions ("Acces complet au site", "Gestion quotidienne sans administration", "Operations de base")
- [ ] `TODO` Creer `messages/en/permissions.json`
- [ ] `TODO` Modifier `src/lib/role-form-labels.ts` : exporter des cles au lieu de chaines
- [ ] `TODO` Modifier les composants qui affichent les permissions pour utiliser `useTranslations("permissions")`

**Criteres d'acceptation :**
- Page /users et formulaire de role affichent les permissions dans la bonne langue
- Aucune regression sur l'attribution de roles

---

### Story 40.3 — Namespace `abonnements` : plans, checkout, statuts
**Assigne a :** @developer
**Priorite :** Haute
**Complexite :** Medium
**Statut :** `FAIT`

**Description :** Extraire les ~25 chaines d'abonnement vers le namespace `abonnements`.

**Fichiers concernes :**
- `src/lib/abonnements-constants.ts` — PLAN_LABELS, PERIODE_LABELS, STATUT_ABONNEMENT_LABELS, FOURNISSEUR_LABELS
- `src/components/abonnements/plans-grid.tsx` — features, CTA labels
- `src/components/abonnements/checkout-form.tsx` — etapes, labels
- `src/components/abonnements/paiements-history-list.tsx` — headers
- `src/app/tarifs/page.tsx`, `src/app/checkout/page.tsx`, `src/app/mon-abonnement/page.tsx`

**Taches :**
- [ ] `TODO` Creer `messages/fr/abonnements.json` :
  - Plans : "Decouverte", "Eleveur", "Professionnel", "Entreprise", "Ingenieur Starter", "Ingenieur Pro", "Ingenieur Expert"
  - Periodes : "Mensuel", "Trimestriel", "Annuel"
  - Statuts : "Actif", "Periode de grace", "Suspendu", "Expire", "Annule", "En attente de paiement"
  - Fournisseurs paiement : "Smobilpay / Maviance", "MTN Mobile Money", "Orange Money", "Paiement manuel"
  - Features par plan (voir plans-grid.tsx PLAN_FEATURES)
  - Checkout : labels des etapes, boutons, messages
- [ ] `TODO` Creer `messages/en/abonnements.json`
- [ ] `TODO` Modifier `src/lib/abonnements-constants.ts` : transformer les label maps en fonctions qui prennent `t()` ou exporter des cles
- [ ] `TODO` Modifier les composants abonnements pour utiliser `useTranslations("abonnements")`

**Criteres d'acceptation :**
- Page /tarifs, /checkout, /mon-abonnement affichent dans la bonne langue
- Les constantes restent utilisables pour la logique metier (pas de regression)

---

### Story 40.4 — Namespaces `settings` et `analytics` : constantes, benchmarks, regles
**Assigne a :** @developer
**Priorite :** Moyenne
**Complexite :** Medium
**Statut :** `FAIT`

**Description :** Extraire les chaines des modules configuration/analytiques.

**Fichiers concernes :**
- `src/lib/regles-activites-constants.ts` — TYPE_DECLENCHEUR_LABELS, TYPE_ACTIVITE_LABELS, PHASE_ELEVAGE_LABELS, placeholders
- `src/lib/benchmarks.ts` — benchmark labels, niveaux
- `src/lib/labels/activite.ts` — activity type labels
- `src/lib/density-thresholds.ts` — threshold labels
- `src/components/dashboard/stats-cards.tsx` — KPI titles
- `src/components/dashboard/indicateurs-panel.tsx` — indicator labels

**Taches :**
- [ ] `TODO` Creer `messages/fr/settings.json` : regles d'activites, declencheurs, phases, conditions, actions
- [ ] `TODO` Creer `messages/en/settings.json`
- [ ] `TODO` Creer `messages/fr/analytics.json` :
  - KPI titles, benchmarks, niveaux, unites
  - **FCR → ICA** : `"analytics.benchmarks.fcr.label": "ICA"`, `"analytics.benchmarks.fcr.full": "ICA (Indice de Conversion Alimentaire)"`
  - **SGR → TCS** : `"analytics.benchmarks.sgr.label": "TCS"`, `"analytics.benchmarks.sgr.full": "TCS (Taux de Croissance Specifique)"`
  - Axes de graphiques : "TCS %/j", "ICA (inv.)" en FR
- [ ] `TODO` Creer `messages/en/analytics.json` :
  - **FCR** : `"analytics.benchmarks.fcr.label": "FCR"`, `"analytics.benchmarks.fcr.full": "FCR (Feed Conversion Ratio)"`
  - **SGR** : `"analytics.benchmarks.sgr.label": "SGR"`, `"analytics.benchmarks.sgr.full": "SGR (Specific Growth Rate)"`
  - Axes de graphiques : "SGR %/d", "FCR (inv.)" en EN
- [ ] `TODO` Modifier `src/lib/benchmarks.ts` : remplacer `label: "FCR"` et `label: "SGR"` par des cles i18n
- [ ] `TODO` Modifier `src/components/analytics/vagues-comparison-client.tsx` : labels FCR/SGR → cles i18n (axes radar, labels graphiques)
- [ ] `TODO` Modifier `src/components/dashboard/projections.tsx` : "Croissance (SGR)" → cle i18n, badges SGR → cles i18n
- [ ] `TODO` Modifier `src/components/analytics/feed-simulator.tsx` : affichage FCR → cle i18n
- [ ] `TODO` Modifier les autres constantes et composants concernes

**Criteres d'acceptation :**
- Dashboard, analytiques et configuration affichent dans la bonne langue
- **FCR affiche "ICA" en francais et "FCR" en anglais**
- **SGR affiche "TCS" en francais et "SGR" en anglais**
- Les calculs de benchmarks ne sont pas impactes (logique separee des labels)
- Les noms de variables dans le code restent `fcr`/`sgr` (convention code en anglais)

---

### Story 40.5 — Tests + Review Sprint 40
**Assigne a :** @tester + @code-reviewer
**Priorite :** Haute
**Complexite :** Simple
**Depend de :** Stories 40.1 a 40.4
**Statut :** `FAIT`

**Taches @tester :**
- [ ] `TODO` Tester la navigation en francais — aucune regression
- [ ] `TODO` Tester la navigation en anglais — tous les labels traduits
- [ ] `TODO` Tester les permissions en anglais — labels corrects
- [ ] `TODO` Tester les pages abonnements en anglais
- [ ] `TODO` Verifier qu'aucune chaine francaise brute ne reste dans les fichiers modifies
- [ ] `TODO` `npx vitest run` + `npm run build` — OK
- [ ] `TODO` Ecrire `docs/tests/rapport-sprint-40.md`

**Taches @code-reviewer :**
- [ ] `TODO` Checklist R1-R9
- [ ] `TODO` Verifier la coherence des cles de traduction (pas de cles orphelines)
- [ ] `TODO` Verifier qu'aucune logique metier ne depend des labels traduits
- [ ] `TODO` Ecrire `docs/reviews/review-sprint-40.md`

**Criteres d'acceptation :**
- Build OK, tests passent
- Navigation + permissions + abonnements traduits en anglais
- Rapport de review produit

---

## Sprint 41 — Extraction des chaines — Pages & Composants

**Objectif :** Extraire les chaines des modules metier (vagues, releves, stock, ventes, alevins,
utilisateurs) et les messages d'erreur API. Ceci couvre le gros du volume (~350 chaines).

**Depend de :** Sprint 40 FAIT

---

### Story 41.1 — Namespaces `vagues` et `releves`
**Assigne a :** @developer
**Priorite :** Critique
**Complexite :** Complex
**Statut :** `FAIT`

**Description :** Extraire les ~140 chaines des modules Vagues et Releves — les plus gros modules en volume.

**Fichiers concernes :**
- `src/components/vagues/vagues-list-client.tsx` — filtres, tabs, cartes, etats vides
- `src/components/vagues/vague-form-dialog.tsx` — labels, validation, placeholders
- `src/components/vagues/vague-detail-client.tsx` — headers, stats, sections
- `src/components/releves/releve-form-client.tsx` — etapes, labels par type, validation
- `src/components/releves/form-*.tsx` — labels specifiques par type de releve (biometrie, mortalite, alimentation, qualite_eau, comptage, observation, renouvellement)
- `src/components/releves/releve-detail-client.tsx` — affichage
- `src/app/vagues/*/page.tsx` — metadata, titres
- `src/app/releves/*/page.tsx` — metadata, titres

**Taches :**
- [ ] `TODO` Creer `messages/fr/vagues.json` : labels formulaire, filtres, statuts, validation, etats vides, dialog, stats
- [ ] `TODO` Creer `messages/en/vagues.json`
- [ ] `TODO` Creer `messages/fr/releves.json` : types de releve, labels par type (biometrie, mortalite, alimentation, qualite_eau, comptage, observation, renouvellement), validation, unites
- [ ] `TODO` Creer `messages/en/releves.json`
- [ ] `TODO` Modifier tous les composants vagues pour utiliser `useTranslations("vagues")`
- [ ] `TODO` Modifier tous les composants releves pour utiliser `useTranslations("releves")`

**Criteres d'acceptation :**
- Les formulaires de creation de vague et de releve fonctionnent en francais et en anglais
- Les types de releve s'affichent dans la bonne langue (Biometrie/Biometrics, etc.)
- La validation cote client affiche les erreurs dans la bonne langue

---

### Story 41.2 — Namespaces `stock` et `ventes`
**Assigne a :** @developer
**Priorite :** Haute
**Complexite :** Medium
**Statut :** `FAIT`

**Description :** Extraire les chaines des modules Stock/Intrants et Ventes/Facturation.

**Fichiers concernes :**
- `src/components/stock/` — produits, fournisseurs, commandes, mouvements
- `src/components/ventes/` — clients, ventes, factures
- `src/components/finances/` — dashboard financier
- Pages `src/app/stock/`, `src/app/ventes/`, `src/app/clients/`, `src/app/factures/`

**Taches :**
- [ ] `TODO` Creer `messages/fr/stock.json` : produits, fournisseurs, commandes, mouvements, categories, unites stock, statuts commande
- [ ] `TODO` Creer `messages/en/stock.json`
- [ ] `TODO` Creer `messages/fr/ventes.json` : clients, ventes, factures, paiements, statuts facture, modes paiement
- [ ] `TODO` Creer `messages/en/ventes.json`
- [ ] `TODO` Modifier les composants stock et ventes

**Criteres d'acceptation :**
- Modules stock et ventes fonctionnels en anglais et en francais
- Les statuts de commande/facture s'affichent dans la bonne langue

---

### Story 41.3 — Namespaces `alevins`, `users`, `commissions`
**Assigne a :** @developer
**Priorite :** Haute
**Complexite :** Medium
**Statut :** `FAIT`

**Description :** Extraire les chaines des modules restants.

**Fichiers concernes :**
- `src/components/alevins/` — reproducteurs, pontes, lots
- `src/components/users/` — liste, formulaire, impersonation
- `src/components/commissions/` — portefeuille, retraits
- Pages correspondantes dans `src/app/`

**Taches :**
- [ ] `TODO` Creer `messages/fr/alevins.json` : reproducteurs, pontes, lots, labels
- [ ] `TODO` Creer `messages/en/alevins.json`
- [ ] `TODO` Creer `messages/fr/users.json` : liste, formulaire, roles, impersonation
- [ ] `TODO` Creer `messages/en/users.json`
- [ ] `TODO` Creer `messages/fr/commissions.json` : portefeuille, commissions, retraits
- [ ] `TODO` Creer `messages/en/commissions.json`
- [ ] `TODO` Modifier les composants concernes

**Criteres d'acceptation :**
- Modules alevins, utilisateurs et commissions fonctionnels en anglais et en francais

---

### Story 41.4 — Namespace `errors` : messages d'erreur API
**Assigne a :** @developer
**Priorite :** Haute
**Complexite :** Medium
**Statut :** `FAIT`

**Description :** Remplacer les messages d'erreur hardcodes dans les ~146 routes API par des cles
d'erreur standardisees. La traduction des erreurs se fait cote client.

**Approche :**
- Les API routes retournent un `errorKey` au lieu d'un message francais
  - Ex: `{ status: 400, errorKey: "errors.validation.required", field: "nom" }`
  - Ex: `{ status: 404, errorKey: "errors.notFound.plan" }`
- Les composants client traduisent le `errorKey` via `useTranslations("errors")`
- **Migration progressive :** garder le champ `message` en parallele pendant la transition, le supprimer dans un sprint futur

**Taches :**
- [ ] `TODO` Creer `messages/fr/errors.json` :
  - Validation : "Champ obligatoire", "Valeur invalide", "Le {field} est obligatoire", etc.
  - Not found : "Plan introuvable", "Vague introuvable", "Membre introuvable", etc.
  - Conflict : "Un plan avec ce type existe deja", "Impossible de desactiver un plan avec des abonnes actifs"
  - Permissions : "Permission insuffisante", "Vous n'etes pas membre de ce site"
  - Serveur : "Erreur serveur", "Erreur lors de..."
- [ ] `TODO` Creer `messages/en/errors.json`
- [ ] `TODO` Creer `src/lib/api-error-keys.ts` : constantes pour les cles d'erreur les plus courantes
- [ ] `TODO` Modifier les routes API les plus utilisees pour retourner `errorKey` + `message` (migration progressive)
- [ ] `TODO` Creer `src/components/ui/api-error-message.tsx` : composant qui affiche un `errorKey` traduit avec fallback sur `message`

**Criteres d'acceptation :**
- Les routes API retournent `errorKey` en plus de `message` (retro-compatible)
- Le composant `ApiErrorMessage` traduit correctement les erreurs
- Aucune regression sur les messages d'erreur existants (fallback sur `message`)

---

### Story 41.5 — Tests + Review Sprint 41
**Assigne a :** @tester + @code-reviewer
**Priorite :** Haute
**Complexite :** Medium
**Depend de :** Stories 41.1 a 41.4
**Statut :** `FAIT`

**Taches @tester :**
- [ ] `TODO` Tester chaque module en anglais : vagues, releves, stock, ventes, alevins, users, commissions
- [ ] `TODO` Tester les formulaires : validation en anglais, labels corrects
- [ ] `TODO` Tester les erreurs API : `errorKey` retourne, traduction cote client
- [ ] `TODO` Grep exhaustif pour les chaines francaises residuelles dans les composants modifies
- [ ] `TODO` `npx vitest run` + `npm run build` — OK
- [ ] `TODO` Ecrire `docs/tests/rapport-sprint-41.md`

**Taches @code-reviewer :**
- [ ] `TODO` Checklist R1-R9
- [ ] `TODO` Verifier la coherence des namespaces (pas de cle en double entre fichiers)
- [ ] `TODO` Verifier que les API routes retournent `errorKey` + `message` (retro-compatible)
- [ ] `TODO` Verifier qu'aucune logique metier n'a ete cassee par l'extraction
- [ ] `TODO` Ecrire `docs/reviews/review-sprint-41.md`

**Criteres d'acceptation :**
- Tous les modules fonctionnent en anglais
- Aucune chaine francaise brute restante dans les fichiers modifies
- Build OK, tests passent
- Rapport de review produit

---

## Sprint 42 — Selecteur de langue, Polish & Review

**Objectif :** Ajouter le selecteur de langue dans l'UI, traduire les metadata des pages,
valider l'ensemble avec des tests complets et faire la review finale.

**Depend de :** Sprint 41 FAIT

---

### Story 42.1 — Composant Language Switcher
**Assigne a :** @developer
**Priorite :** Critique
**Complexite :** Medium
**Statut :** `FAIT`

**Description :** Creer le selecteur de langue et l'integrer dans le layout.

**Taches :**
- [ ] `TODO` Creer `src/components/layout/language-switcher.tsx` (Client Component) :
  - Dropdown (Radix `DropdownMenu`) avec les langues disponibles
  - Affiche le drapeau + code de la langue active (FR / EN)
  - Au clic : appelle `PUT /api/locale` pour persister + set cookie `NEXT_LOCALE` + `router.refresh()`
  - Pour les visiteurs non connectes : set uniquement le cookie + refresh
  - R5 : DropdownMenuTrigger correctement configure
  - Taille mobile-first : bouton min-h-[44px]
- [ ] `TODO` Integrer dans `sidebar.tsx` : en bas de la sidebar, avant le footer
- [ ] `TODO` Integrer dans `hamburger-menu.tsx` : dans le footer, avant "Se deconnecter"
- [ ] `TODO` Integrer dans les pages publiques non-connectees (`/login`, `/tarifs`, `/inscription`) : dans le header

**Criteres d'acceptation :**
- Le switcher est visible sur toutes les pages (desktop sidebar + mobile hamburger)
- Changer la langue rafraichit la page avec les nouvelles traductions
- La preference est persistee (cookie pour les visiteurs, session pour les connectes)
- L'app fonctionne correctement apres un switch de langue (pas de crash d'hydratation)

---

### Story 42.2 — Metadata des pages et textes publics
**Assigne a :** @developer
**Priorite :** Moyenne
**Complexite :** Simple
**Statut :** `FAIT`

**Description :** Traduire les metadata (title, description) des pages et les textes
des pages publiques (login, tarifs, inscription, abonnement-expire).

**Taches :**
- [ ] `TODO` Modifier `src/app/layout.tsx` : metadata dynamique avec `generateMetadata()` selon la locale
- [ ] `TODO` Modifier les pages avec metadata custom : utiliser `generateMetadata()` par page
- [ ] `TODO` Traduire les textes des pages publiques :
  - `/login` — labels du formulaire, messages d'erreur
  - `/tarifs` — titres, descriptions
  - `/abonnement-expire` — messages de blocage
- [ ] `TODO` Modifier `manifest.json` : garder "FarmFlow" (nom de l'app, pas traduit)

**Criteres d'acceptation :**
- Le titre de l'onglet du navigateur change selon la langue
- Les pages publiques sont bilingues

---

### Story 42.3 — Tests d'integration i18n complets
**Assigne a :** @tester
**Priorite :** Critique
**Complexite :** Complex
**Statut :** `FAIT`

**Description :** Tests d'integration couvrant le parcours i18n complet.

**Taches :**
- [ ] `TODO` Creer `src/__tests__/integration/i18n-switch.test.ts` :
  - Parcours : utilisateur connecte → switch FR → EN → verification que les labels changent
  - Parcours : utilisateur connecte → switch EN → deconnexion → reconnexion → locale persistee (EN)
  - Parcours : visiteur non connecte → switch EN → cookie set → pages publiques en anglais
- [ ] `TODO` Creer `src/__tests__/integration/i18n-completeness.test.ts` :
  - Pour chaque namespace : verifier que toutes les cles de `fr/*.json` existent dans `en/*.json` (et inversement)
  - Verifier qu'aucune cle n'est vide dans les fichiers de messages
- [ ] `TODO` Creer `src/__tests__/integration/i18n-components.test.ts` :
  - Rendre les composants principaux avec locale "en" → verifier que les chaines sont en anglais
  - Composants a tester : Sidebar, PlansGrid, VaguesListClient, ReleveForm, StatsCards
- [ ] `TODO` Grep exhaustif final : rechercher les chaines francaises hardcodees restantes dans `src/components/**/*.tsx` et `src/app/**/page.tsx`
- [ ] `TODO` `npx vitest run` + `npm run build` — OK
- [ ] `TODO` Test manuel : parcourir toutes les pages en anglais, verifier la coherence
- [ ] `TODO` Ecrire `docs/tests/rapport-sprint-42.md` avec synthese complete

**Criteres d'acceptation :**
- 100% des cles FR ont un equivalent EN (et inversement)
- Aucune chaine francaise residuelle dans les composants
- Build OK, tests passent
- Rapport de test complet

---

### Story 42.4 — Review finale i18n (Sprints 39-42)
**Assigne a :** @code-reviewer
**Priorite :** Critique
**Complexite :** Complex
**Depend de :** Stories 42.1 a 42.3
**Statut :** `FAIT`

**Description :** Review complete du systeme i18n.

**Taches :**
- [ ] `TODO` Audit R1-R9 sur tous les fichiers modifies
- [ ] `TODO` Verifier la qualite des traductions anglaises (pas de mot-a-mot, termes metier corrects)
- [ ] `TODO` Verifier la coherence terminologique :
  - "Vague" traduit uniformement ("Wave" ou "Batch" — choisir un seul terme)
  - "Releve" traduit uniformement ("Report" ou "Record")
  - "Bac" traduit uniformement ("Tank" ou "Basin")
  - Termes metier piscicoles corrects en anglais
- [ ] `TODO` Verifier qu'aucune logique metier ne depend de la langue (calculs, permissions, etc.)
- [ ] `TODO` Verifier l'accessibilite : `lang` sur `<html>` change, `aria-label` traduits
- [ ] `TODO` Verifier le mobile-first : language switcher utilisable a 360px
- [ ] `TODO` Verifier la performance : pas de bundle bloat (messages lazy-loaded)
- [ ] `TODO` Ecrire `docs/reviews/review-sprints-39-42.md`

**Criteres d'acceptation :**
- R1-R9 respectees sur tous les fichiers modifies
- Traductions anglaises de qualite professionnelle
- Terminologie coherente dans toute l'app
- Performance non degradee
- Rapport de review finale produit

---

## Glossaire metier FR → EN (reference pour les traducteurs)

| Francais | Anglais (recommande) | Notes |
|----------|---------------------|-------|
| Vague | Batch | Lot de poissons a suivre |
| Bac | Tank | Bassin d'elevage |
| Releve | Record | Mesure/observation effectuee |
| Biometrie | Biometrics | Releve de poids/taille |
| Mortalite | Mortality | Releve de morts |
| Alimentation | Feeding | Releve de nourriture |
| Qualite de l'eau | Water quality | Releve pH, O2, etc. |
| Comptage | Counting | Releve de denombrement |
| Grossissement | Grow-out | Phase d'elevage principale |
| Alevin | Fry / Fingerling | Jeune poisson |
| Ponte | Spawning | Reproduction |
| Reproducteur | Broodstock | Poisson reproducteur |
| Intrants | Inputs / Supplies | Stock de produits |
| Fournisseur | Supplier | |
| Mouvement de stock | Stock movement | Entree/sortie |
| Silure | Catfish | Clarias gariepinus |
| Pisciculteur | Fish farmer | |
| Ingenieur | Engineer | Superviseur technique |
| Gerant | Manager | |
| Taux de survie | Survival rate | |
| FCR | FCR | EN: Feed Conversion Ratio — **voir note ICA/TCS ci-dessous** |
| SGR | SGR | EN: Specific Growth Rate — **voir note ICA/TCS ci-dessous** |
| FCFA / XAF | XAF | Franc CFA |

### Note importante : FCR/SGR vs ICA/TCS

Les acronymes **FCR** (Feed Conversion Ratio) et **SGR** (Specific Growth Rate) sont des termes
anglais utilises tels quels dans la version actuelle de l'app. En francais, les acronymes corrects sont :

| Anglais | Francais | Signification |
|---------|----------|---------------|
| **FCR** (Feed Conversion Ratio) | **ICA** (Indice de Conversion Alimentaire) | Ratio aliment consomme / gain de poids |
| **SGR** (Specific Growth Rate) | **TCS** (Taux de Croissance Specifique) | Taux de croissance en %/jour |

**Regle pour l'i18n :**
- En **francais** : afficher **ICA** et **TCS** avec le libelle complet au survol ou en premiere occurrence ("ICA (Indice de Conversion Alimentaire)")
- En **anglais** : afficher **FCR** et **SGR** avec le libelle complet au survol ou en premiere occurrence ("FCR (Feed Conversion Ratio)")
- Les noms de variables dans le code restent `fcr` et `sgr` (convention de code en anglais — pas de renommage)
- Les enums Prisma restent `FCR_ELEVE` (pas de changement en base)

**Fichiers impactes (~15 occurrences UI) :**
- `src/lib/benchmarks.ts` — `label: "FCR"`, `label: "SGR"` → cles i18n
- `src/components/analytics/vagues-comparison-client.tsx` — labels FCR/SGR dans les graphiques et axes radar
- `src/components/dashboard/projections.tsx` — "Croissance (SGR)", "SGR actuel", badges SGR
- `src/components/analytics/feed-simulator.tsx` — affichage FCR dans les resultats
- `src/components/analytics/feed-detail-charts.tsx` — labels de graphiques
- `src/components/dashboard/indicateurs-panel.tsx` — benchmarks FCR/SGR
- `src/types/calculs.ts` — commentaires (pas de traduction necessaire, code en anglais)

Ces remplacements doivent etre faits dans le **Sprint 40 (Story 40.4)** lors de l'extraction du namespace `analytics`.
