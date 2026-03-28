# ADR — Interface Ingénieur vs Interface Propriétaire (Éleveur)

**Date :** 2026-03-28
**Statut :** PROPOSÉ
**Auteur :** @architect

---

## Contexte

FarmFlow sert deux audiences distinctes ayant des besoins radicalement différents :

1. **L'ingénieur piscicole** — technicien qui supervise plusieurs fermes pour le compte
   d'éleveurs. Il effectue ou contrôle les opérations quotidiennes : mesures biométriques,
   constats de mortalité, contrôle qualité eau, alimentation, renouvellements. Il travaille
   sur le terrain, principalement sur mobile, souvent avec une connectivité limitée.

2. **Le promoteur (éleveur/propriétaire)** — propriétaire de la ferme qui veut suivre
   la performance globale de son investissement, contrôler les finances, les ventes, et
   prendre des décisions business de haut niveau. Il peut déléguer les opérations
   quotidiennes à un ingénieur.

Le modèle économique (ADR-020) confirme cette dualité : les ingénieurs paient un pack
INGENIEUR, les promoteurs paient un pack ELEVEUR/PROFESSIONNEL/ENTREPRISE. Les ingénieurs
gagnent des commissions sur les abonnements des fermes qu'ils supervisent.

L'application possède actuellement **~35 modules fonctionnels** répartis dans les segments
suivants : élevage opérationnel, stock, finances, ventes, alevins, planning, alertes,
analytics, administration, facturation, abonnements, commissions.

La question posée : comment organiser ces modules entre une interface ingénieur et une
interface propriétaire, sans dupliquer inutilement du code ?

---

## Inventaire complet des modules existants

### Groupe 1 — Élevage opérationnel (coeur métier)

| Module | Route(s) | Permission principale |
|--------|----------|-----------------------|
| Tableau de bord ferme | `/` | DASHBOARD_VOIR |
| Vagues (lots) | `/vagues`, `/vagues/[id]` | VAGUES_VOIR |
| Relevés (biométrie, mortalité, etc.) | `/releves`, `/vagues/[id]/releves` | RELEVES_VOIR |
| Bacs | `/bacs` | BACS_GERER |
| Calibrages | `/vagues/[id]/calibrages` | CALIBRAGES_VOIR |
| Notes / Échanges ingénieur-client | `/notes` | — (SiteModule) |

### Groupe 2 — Stock & Approvisionnement

| Module | Route(s) | Permission principale |
|--------|----------|-----------------------|
| Vue d'ensemble stock | `/stock` | STOCK_VOIR |
| Produits | `/stock/produits`, `/stock/produits/[id]` | STOCK_VOIR |
| Mouvements | `/stock/mouvements` | STOCK_VOIR |
| Fournisseurs | `/stock/fournisseurs` | APPROVISIONNEMENT_VOIR |
| Commandes fournisseurs | `/stock/commandes`, `/stock/commandes/[id]` | APPROVISIONNEMENT_VOIR |
| Listes de besoins | `/besoins`, `/besoins/[id]` | BESOINS_SOUMETTRE |

### Groupe 3 — Finances & Ventes

| Module | Route(s) | Permission principale |
|--------|----------|-----------------------|
| Dashboard finances | `/finances` | FINANCES_VOIR |
| Ventes | `/ventes`, `/ventes/[id]` | VENTES_VOIR |
| Factures | `/factures`, `/factures/[id]` | FACTURES_VOIR |
| Clients acheteurs | `/clients` | CLIENTS_VOIR |
| Dépenses | `/depenses`, `/depenses/[id]` | DEPENSES_VOIR |
| Dépenses récurrentes | `/depenses/recurrentes` | DEPENSES_VOIR |

### Groupe 4 — Production Alevins

| Module | Route(s) | Permission principale |
|--------|----------|-----------------------|
| Vue d'ensemble alevins | `/alevins` | ALEVINS_VOIR |
| Reproducteurs | `/alevins/reproducteurs`, `/alevins/reproducteurs/[id]` | ALEVINS_VOIR |
| Pontes | `/alevins/pontes`, `/alevins/pontes/[id]` | ALEVINS_VOIR |
| Lots d'alevins | `/alevins/lots`, `/alevins/lots/[id]` | ALEVINS_VOIR |

### Groupe 5 — Planning & Activités

| Module | Route(s) | Permission principale |
|--------|----------|-----------------------|
| Planning (calendrier) | `/planning` | PLANNING_VOIR |
| Mes tâches | `/mes-taches`, `/mes-taches/[id]` | DASHBOARD_VOIR |
| Règles d'activités (auto-planification) | `/settings/regles-activites` | REGLES_ACTIVITES_VOIR |

### Groupe 6 — Analytics

| Module | Route(s) | Permission principale |
|--------|----------|-----------------------|
| Dashboard analytics | `/analytics` | DASHBOARD_VOIR |
| Analytics vagues | `/analytics/vagues` | DASHBOARD_VOIR |
| Analytics bacs (densité) | `/analytics/bacs`, `/analytics/bacs/[id]` | DASHBOARD_VOIR |
| Analytics aliments | `/analytics/aliments`, `/analytics/aliments/[id]` | DASHBOARD_VOIR |
| Simulation aliments | `/analytics/aliments/simulation` | DASHBOARD_VOIR |

### Groupe 7 — Alertes & Notifications

| Module | Route(s) | Permission principale |
|--------|----------|-----------------------|
| Notifications | `/notifications` | — |
| Configuration alertes | `/settings/alertes` | ALERTES_CONFIGURER |

### Groupe 8 — Monitoring Ingénieur (multi-fermes)

| Module | Route(s) | Permission principale |
|--------|----------|-----------------------|
| Vue globale clients | `/ingenieur` | MONITORING_CLIENTS |
| Détail client | `/ingenieur/[siteId]` | MONITORING_CLIENTS |
| Vague d'un client | `/ingenieur/[siteId]/vagues/[vagueId]` | MONITORING_CLIENTS |
| Notes vers client | `/ingenieur/[siteId]/notes` | MONITORING_CLIENTS |

### Groupe 9 — Administration Ferme (Settings)

| Module | Route(s) | Permission principale |
|--------|----------|-----------------------|
| Gestion sites | `/settings/sites`, `/settings/sites/[id]` | SITE_GERER |
| Rôles et membres | `/settings/sites/[id]/roles` | MEMBRES_GERER |
| Utilisateurs | `/users`, `/users/[id]` | UTILISATEURS_VOIR |
| Config élevage (profils) | `/settings/config-elevage` | GERER_CONFIG_ELEVAGE |

### Groupe 10 — Packs & Abonnements (interface ingénieur-commercial)

| Module | Route(s) | Permission principale |
|--------|----------|-----------------------|
| Packs disponibles | `/packs` | DASHBOARD_VOIR |
| Détail pack | `/packs/[id]` | — |
| Activer un pack | `/packs/[id]/activer` | ACTIVER_PACKS |
| Historique activations | `/activations` | ACTIVER_PACKS |
| Mon abonnement | `/mon-abonnement` | ABONNEMENTS_VOIR |
| Renouveler abonnement | `/mon-abonnement/renouveler` | ABONNEMENTS_VOIR |
| Mon portefeuille (commissions) | `/mon-portefeuille` | PORTEFEUILLE_VOIR |
| Tarifs (public) | `/tarifs` | — (public) |
| Checkout | `/checkout` | — |

### Groupe 11 — Backoffice Plateforme (DKFarm uniquement)

| Module | Route(s) | Accès |
|--------|----------|-------|
| Dashboard analytics plateforme | `/backoffice/dashboard` | checkBackofficeAccess |
| Sites clients | `/backoffice/sites`, `/backoffice/sites/[id]` | checkBackofficeAccess |
| Abonnements (tous) | `/backoffice/abonnements` | checkBackofficeAccess |
| Plans tarifaires | `/backoffice/plans` | checkBackofficeAccess |
| Commissions | `/backoffice/commissions` | checkBackofficeAccess |
| Remises | `/backoffice/remises` | checkBackofficeAccess |
| Modules sites | `/backoffice/modules` | checkBackofficeAccess |

---

## Classification des modules

### Légende
- **INGENIEUR** — Appartient principalement à l'interface ingénieur
- **OWNER** — Appartient principalement à l'interface propriétaire (éleveur/promoteur)
- **BOTH** — Partagé (même page, même composant, contexte adaptatif ou permissions)
- **PLATFORM** — Réservé au backoffice DKFarm uniquement

---

### Classification détaillée

#### Élevage opérationnel

| Module | Classification | Rationale |
|--------|---------------|-----------|
| Tableau de bord ferme | **BOTH** | L'ingénieur voit les indicateurs zootechniques (survie, FCR, SGR) ; le propriétaire voit les mêmes + l'aperçu financier. La Hero section peut s'adapter selon le rôle. |
| Vagues (liste + création) | **BOTH** | L'ingénieur crée et gère les vagues opérationnellement. Le propriétaire peut consulter le statut et les indicateurs, mais créer une vague devrait rester permis si VAGUES_CREER est accordé. |
| Relevés (saisie) | **INGENIEUR** | La saisie de relevés (biométrie, mortalité, alimentation, qualité eau, comptage) est le geste opérationnel de l'ingénieur. Le propriétaire n'a aucune raison de saisir des relevés quotidiennement. |
| Relevés (lecture) | **BOTH** | Le propriétaire peut consulter l'historique des relevés pour comprendre l'état de sa ferme. La consultation est partagée, la création reste INGENIEUR. |
| Bacs (gestion) | **INGENIEUR** | L'ingénieur configure et assigne les bacs aux vagues. Le propriétaire peut voir leur statut mais rarement les gérer. |
| Calibrages | **INGENIEUR** | Opération technique sur la biométrie d'une vague. Le propriétaire peut consulter les résultats mais ne calibre pas lui-même. |
| Notes / Échanges | **BOTH** | Vue adaptée selon contexte : le propriétaire reçoit les notes de l'ingénieur et peut envoyer des observations ; l'ingénieur envoie des notes et lit les observations. Logique déjà implémentée dans `/notes`. |

#### Stock & Approvisionnement

| Module | Classification | Rationale |
|--------|---------------|-----------|
| Vue d'ensemble stock | **BOTH** | L'ingénieur doit connaître les niveaux de stock pour planifier l'alimentation. Le propriétaire veut voir les alertes et le niveau général. |
| Produits | **INGENIEUR** | Gestion quotidienne des produits (aliments, médicaments). Le propriétaire peut consulter mais rarement modifier. |
| Mouvements de stock | **BOTH** | L'ingénieur enregistre les mouvements. Le propriétaire veut l'historique pour contrôler la consommation. |
| Fournisseurs | **INGENIEUR** | Relation commerciale gérée par l'ingénieur ou le gérant. Le propriétaire peut avoir une vue lecture. |
| Commandes fournisseurs | **BOTH** | L'ingénieur prépare les commandes ; le propriétaire les approuve (rôle BESOINS_APPROUVER). Le workflow d'approbation implique les deux. |
| Listes de besoins | **BOTH** | L'ingénieur soumet (BESOINS_SOUMETTRE) ; le propriétaire approuve (BESOINS_APPROUVER). Module conçu pour ce workflow. |

#### Finances & Ventes

| Module | Classification | Rationale |
|--------|---------------|-----------|
| Dashboard finances | **OWNER** | Données stratégiques : CA, rentabilité par vague, évolution sur 12 mois, top clients. Le propriétaire prend des décisions d'investissement. L'ingénieur n'a pas besoin de ce niveau de visibilité financière pour son travail quotidien. |
| Ventes | **OWNER** | La vente de poissons est une transaction commerciale — décision et exécution du propriétaire ou gérant commercial. L'ingénieur peut préparer les données (poids estimé, biomasse) mais ne conclut pas la vente. |
| Factures | **OWNER** | Outil financier et juridique. Propriétaire / comptable exclusivement. |
| Clients acheteurs | **OWNER** | Base client commerciale. Propriétaire / commercial. |
| Dépenses | **BOTH** | L'ingénieur peut saisir des dépenses opérationnelles (médicaments, frais terrain). Le propriétaire approuve et visualise le total dans le dashboard finances. |
| Dépenses récurrentes | **OWNER** | Configuration des dépenses fixes (loyer, électricité, salaires). Décision de gestion = propriétaire. |

#### Production Alevins

| Module | Classification | Rationale |
|--------|---------------|-----------|
| Vue d'ensemble alevins | **BOTH** | KPIs (reproducteurs actifs, pontes en cours, lots) utiles aux deux. |
| Reproducteurs | **INGENIEUR** | Gestion zootechnique des géniteurs : suivi médical, performances de reproduction. Expertise technique de l'ingénieur. |
| Pontes | **INGENIEUR** | Opération de reproduction : stimulation hormonale, collecte des oeufs, incubation. Domaine technique ingénieur. |
| Lots d'alevins | **BOTH** | L'ingénieur suit la croissance des lots ; le propriétaire veut savoir combien d'alevins sont disponibles pour planifier les vagues. La commande de transfert vers vague est opérationnelle (INGENIEUR). |

#### Planning & Activités

| Module | Classification | Rationale |
|--------|---------------|-----------|
| Planning (calendrier) | **BOTH** | L'ingénieur voit ses tâches assignées ; le propriétaire supervise le planning global de la ferme. Vues filtrées selon le rôle. |
| Mes tâches | **INGENIEUR** | Ce module est conçu pour l'exécutant sur le terrain. Le propriétaire n'a pas de tâches opérationnelles quotidiennes. |
| Règles d'activités | **INGENIEUR** | Configuration de l'auto-planification des activités zootechniques. Expertise technique de l'ingénieur ou du gérant technique. |

#### Analytics

| Module | Classification | Rationale |
|--------|---------------|-----------|
| Dashboard analytics | **BOTH** | Mais avec des perspectives différentes. L'ingénieur veut les indicateurs zootechniques (FCR, SGR, densité, alertes). Le propriétaire veut la synthèse performance + contexte financier. |
| Analytics vagues | **BOTH** | Comparaison de performance entre vagues — utile aux deux mais à des fins différentes. |
| Analytics bacs (densité) | **INGENIEUR** | Surveillance de la densité, renouvellements d'eau — expertise et action de l'ingénieur. |
| Analytics aliments | **BOTH** | L'ingénieur optimise la ration ; le propriétaire surveille le coût d'alimentation. |
| Simulation aliments | **INGENIEUR** | Outil de modélisation technique. Domaine de l'ingénieur. |

#### Alertes & Notifications

| Module | Classification | Rationale |
|--------|---------------|-----------|
| Notifications | **BOTH** | Les deux reçoivent des notifications mais de types différents. L'ingénieur : alertes opérationnelles (mortalité, qualité eau, stock bas). Le propriétaire : alertes financières (facture en retard, abonnement expirant). |
| Configuration alertes | **INGENIEUR** | Définir les seuils d'alerte zootechniques est une expertise technique. Le propriétaire peut configurer ses alertes financières/abonnement. |

#### Monitoring multi-fermes (spécifique ingénieur)

| Module | Classification | Rationale |
|--------|---------------|-----------|
| Vue globale clients | **INGENIEUR** | Exclusive à l'ingénieur qui supervise plusieurs fermes. N'existe pas pour un propriétaire mono-site. |
| Détail client (vagues + alertes) | **INGENIEUR** | Lecture transversale de la ferme d'un client. Permission MONITORING_CLIENTS. |
| Vague d'un client (lecture) | **INGENIEUR** | Consultation en lecture seule de la vague d'un client supervisé. |
| Notes vers client | **INGENIEUR** | Envoi de recommandations techniques aux clients. |

#### Administration Ferme

| Module | Classification | Rationale |
|--------|---------------|-----------|
| Gestion sites | **OWNER** | Créer/modifier un site = décision du propriétaire ou de DKFarm. |
| Rôles et membres | **OWNER** | Gérer qui accède à la ferme = responsabilité du propriétaire. |
| Utilisateurs | **OWNER** | Gestion RH / accès utilisateurs = propriétaire ou admin. |
| Config élevage (profils) | **INGENIEUR** | Les profils de configuration (benchmarks FCR, seuils, rations) relèvent de l'expertise technique de l'ingénieur. |

#### Packs, Abonnements, Commissions

| Module | Classification | Rationale |
|--------|---------------|-----------|
| Packs disponibles | **INGENIEUR** | L'ingénieur vend et active des packs pour ses clients. |
| Activer un pack | **INGENIEUR** | Action commerciale de l'ingénieur vers un client. |
| Historique activations | **INGENIEUR** | Suivi des packs vendus par l'ingénieur. |
| Mon abonnement | **OWNER** | Le propriétaire gère son propre abonnement FarmFlow. |
| Mon portefeuille (commissions) | **INGENIEUR** | Suivi des commissions gagnées par l'ingénieur — fonctionnalité exclusive à son rôle. |
| Tarifs (public) | **BOTH** | Page publique accessible à tous. |

#### Backoffice Plateforme

| Module | Classification | Rationale |
|--------|---------------|-----------|
| Tous les modules `/backoffice/*` | **PLATFORM** | Exclusivement DKFarm. Ni ingénieur ni propriétaire n'y accèdent. |

---

## Synthèse par audience

### Ce que fait un ingénieur au quotidien
L'ingénieur est un **technicien de terrain multi-sites**. Son flux de travail type :
1. Arriver sur la ferme d'un client
2. Consulter les alertes actives (mortalité élevée, qualité eau)
3. Effectuer les relevés du jour (biométrie, mortalité, alimentation)
4. Enregistrer les mouvements de stock (aliment distribué)
5. Marquer ses tâches comme complétées
6. Rédiger une note pour le propriétaire si nécessaire
7. Passer à la ferme suivante

Il a besoin d'une interface **rapide, minimaliste, orientée actions**, optimisée pour mobile
avec de gros boutons et une navigation directe vers l'action.

### Ce que fait un propriétaire au quotidien
Le propriétaire est un **investisseur qui surveille son retour**. Son flux type :
1. Ouvrir le dashboard pour voir l'état général (combien de poissons vivants, taux de survie)
2. Vérifier les alertes reçues de l'ingénieur
3. Lire les dernières notes de son ingénieur
4. Consulter les finances de la semaine (ventes, dépenses)
5. Approuver une commande fournisseur si besoin
6. Vérifier le statut de son abonnement

Il a besoin d'une interface **informative, orientée synthèse**, avec des graphiques et des
indicateurs clés, moins de formulaires de saisie.

---

## Proposition d'architecture des deux interfaces

### Option A — Deux layouts séparés (RECOMMANDÉE)

Créer deux layouts Next.js distincts avec leurs propres navigations :
- `/app/(ingenieur)/layout.tsx` — navigation orientée opérations
- `/app/(owner)/layout.tsx` — navigation orientée performance et finances

Les **pages BOTH** seraient des Server Components réutilisés dans les deux layouts,
avec un prop `perspective: "ingenieur" | "owner"` pour adapter l'affichage si nécessaire.

Les routes actuelles (sans préfixe) restent telles quelles pour la compatibilité ;
les layouts sont distingués via le `activeSite.supervisedBy` (ingénieur) vs le rôle
de l'utilisateur connecté.

**Avantage :** Navigation claire et adaptée à chaque audience. Pas de confusion.
**Inconvénient :** Certaines pages BOTH doivent être disponibles dans les deux layouts
(soit via des liens différents, soit via une redirection).

### Option B — Navigation adaptative sur layout unique (ACTUELLE)

Le layout actuel (bottom-nav mobile + sidebar desktop) adapte ses items selon les
permissions de l'utilisateur. Un ingénieur avec MONITORING_CLIENTS voit "Clients",
un propriétaire avec FINANCES_VOIR voit "Finances".

**Avantage :** Pas de refonte architecturale, évolution incrémentale.
**Inconvénient :** La navigation devient surchargée ; les deux profils voient un
sous-ensemble arbitraire d'une même nav, ce qui nuit à la cohérence de l'expérience.

### Option C — Mode switcher (intermédiaire)

Un seul layout avec un sélecteur de "vue" (Vue Ingénieur / Vue Propriétaire) qui
réorganise la navigation et met en avant les modules pertinents.

**Avantage :** Simplicité de déploiement, partage de code maximal.
**Inconvénient :** Moins professionnel ; un utilisateur ne devrait pas avoir à choisir
son "mode" manuellement.

---

## Dashboard Ingénieur — Proposition de wireframe

```
┌──────────────────────────────────────────┐
│  Bonjour [Nom]             [Notif] [Profil] │
│  [Site actif: DKFarm]                      │
├──────────────────────────────────────────┤
│                                            │
│  ALERTES ACTIVES (toutes fermes)           │
│  ┌──────────────────────┐                  │
│  │ ⚠ Mortalité élevée   │ Ferme Kamdem     │
│  │ ⚠ Qualité eau        │ Ferme Ateba      │
│  └──────────────────────┘                  │
│                                            │
│  MES TÂCHES DU JOUR                        │
│  ┌─────────────────────────────┐           │
│  │ ▶ Biométrie — Vague V-003   │ 09:00     │
│  │ ▶ Alimentation — Vague V-004│ 14:00     │
│  └─────────────────────────────┘           │
│                                            │
│  FERMES SUPERVISÉES (3)                    │
│  ┌────────────────────────────────────┐    │
│  │ Ferme Kamdem    2 vagues • 3 alertes│   │
│  │ Ferme Ateba     1 vague  • 0 alertes│   │
│  │ Ferme Nlend     2 vagues • 0 alertes│   │
│  └────────────────────────────────────┘    │
│                                            │
│  MON PORTEFEUILLE                          │
│  Solde: 45 000 XAF  |  Pending: 12 000 XAF │
│                                            │
├──────────────────────────────────────────┤
│  [Tâches]  [Clients]  [+Relevé]  [Stock]  │
└──────────────────────────────────────────┘
```

**Items navigation bottom-nav ingénieur (5 items) :**
1. Accueil (dashboard multi-fermes)
2. Mes tâches
3. + Nouveau relevé (action rapide)
4. Mes clients (monitoring)
5. Menu (notes, portefeuille, packs, profil)

---

## Dashboard Propriétaire — Proposition de wireframe

```
┌──────────────────────────────────────────┐
│  [Logo Ferme]    Ma ferme      [Notif]   │
├──────────────────────────────────────────┤
│                                            │
│  STATUT FERME                             │
│  ┌────────┬────────┬────────┬────────┐   │
│  │ 2 400  │  96.2% │ 450 kg │ 3      │   │
│  │Vivants │Survie  │Biomasse│Vagues  │   │
│  └────────┴────────┴────────┴────────┘   │
│                                            │
│  ALERTES INGÉNIEUR                        │
│  ┌───────────────────────────────────┐    │
│  │ 📋 Rapport biométrie disponible   │    │
│  │ ✉ Nouvelle note de votre ingénieur│    │
│  └───────────────────────────────────┘    │
│                                            │
│  FINANCES (30 derniers jours)             │
│  ┌────────┬────────┬────────┐             │
│  │ 320 000│ 85 000 │ 235 000│             │
│  │ Ventes │Dépenses│ Solde  │             │
│  └────────┴────────┴────────┘             │
│                                            │
│  PROCHAINES ÉCHÉANCES                     │
│  Facture #F-012 — due dans 3 jours        │
│  Commande #C-008 — livraison demain        │
│                                            │
├──────────────────────────────────────────┤
│  [Accueil] [Ferme] [Finances] [Messages] [+]│
└──────────────────────────────────────────┘
```

**Items navigation bottom-nav propriétaire (5 items) :**
1. Accueil (dashboard ferme)
2. Ma ferme (vagues, bacs, relevés en lecture)
3. Finances (ventes, factures, dépenses)
4. Messages (notes ingénieur, échanges)
5. Menu (stock, alevins, planning, paramètres, abonnement)

---

## Recommandations

### 1. Implémenter l'Option A (deux layouts) dès Sprint 12+

Créer des route groups Next.js :
- `src/app/(farm)/layout.tsx` — layout ferme actuel (propriétaire + membres)
- `src/app/(ingenieur-hub)/layout.tsx` — layout hub multi-fermes (ingénieur)

La redirection après login utilise `session.role` et `activeSite.isPlatform` pour
router vers le bon layout.

### 2. Ne pas recréer de pages BOTH — utiliser les permissions

Les pages classées BOTH restent à leurs routes actuelles. La navigation adaptative
(items différents dans la bottom-nav selon le rôle) guide l'utilisateur vers les
bonnes pages. Ne pas dupliquer les pages `/vagues`, `/releves`, `/analytics` etc.

### 3. Affiner le dashboard selon le rôle

Le composant `DashboardHeroSection` existant peut accepter un prop `role` pour
afficher soit :
- **INGENIEUR** : nombre de fermes supervisées, alertes globales, tâches du jour
- **OWNER/GERANT** : état de la ferme, indicateurs zootechniques, résumé financier

### 4. Réviser la bottom-nav pour 5 items maximum

Navigation ingénieur-hub : Accueil | Tâches | + (action rapide) | Clients | Menu
Navigation ferme-owner : Accueil | Ma ferme | Finances | Messages | Menu

### 5. Le module "Mes tâches" est l'entrée principale de l'ingénieur sur site

Quand un ingénieur switch vers le site d'un client (via `activeSiteId`), le flow
devient identique à celui d'un gérant sur ce site. La distinction ingénieur/owner
ne s'applique que dans le hub multi-fermes (`/ingenieur/*`) et sur le site DKFarm.

### 6. Action rapide "+ Nouveau relevé" en bas de nav ingénieur

Le relevé est le geste quotidien le plus fréquent pour l'ingénieur. Un bouton FAB
(Floating Action Button) centré dans la bottom-nav doit ouvrir directement le
formulaire de saisie de relevé pour la vague en cours sélectionnée.

---

## Modules PLATFORM — ne pas exposer aux autres

Les routes `/backoffice/*` sont protégées par `checkBackofficeAccess()` qui vérifie
`isPlatform === true` sur le site actif. Cette logique est correcte et suffisante.

Aucun module backoffice ne doit apparaître dans la navigation d'un ingénieur ou d'un
propriétaire, même avec les permissions ABONNEMENTS_GERER ou COMMISSIONS_GERER actives
sur un site non-platform.

---

## Tableau récapitulatif final

| Module | INGENIEUR | OWNER | PLATFORM |
|--------|:---------:|:-----:|:--------:|
| Dashboard ferme | BOTH | BOTH | — |
| Vagues (CRUD) | oui | lecture | — |
| Relevés (saisie) | oui | non | — |
| Relevés (lecture) | oui | oui | — |
| Bacs | oui | lecture | — |
| Calibrages | oui | lecture | — |
| Notes / Échanges | oui | oui | — |
| Stock (vue) | oui | oui | — |
| Produits stock | oui | lecture | — |
| Mouvements stock | oui | lecture | — |
| Fournisseurs | oui | lecture | — |
| Commandes fournis. | oui | approbation | — |
| Listes de besoins | oui | approbation | — |
| Finances dashboard | non | oui | — |
| Ventes | non | oui | — |
| Factures | non | oui | — |
| Clients acheteurs | non | oui | — |
| Dépenses | oui | oui | — |
| Dépenses récurrentes | non | oui | — |
| Alevins (vue) | oui | oui | — |
| Reproducteurs | oui | non | — |
| Pontes | oui | non | — |
| Lots alevins | oui | lecture | — |
| Planning | oui | oui | — |
| Mes tâches | oui | non | — |
| Règles activités | oui | non | — |
| Analytics dashboard | oui | oui | — |
| Analytics bacs densité | oui | non | — |
| Simulation aliments | oui | non | — |
| Alertes config | oui | partiel | — |
| Notifications | oui | oui | — |
| Monitoring clients | oui | non | — |
| Config élevage | oui | non | — |
| Gestion site/membres | non | oui | — |
| Utilisateurs | non | oui | — |
| Packs (activer) | oui | non | — |
| Mon abonnement | non | oui | — |
| Mon portefeuille | oui | non | — |
| Tarifs | public | public | — |
| Backoffice dashboard | — | — | oui |
| Backoffice abonnements | — | — | oui |
| Backoffice plans | — | — | oui |
| Backoffice commissions | — | — | oui |
| Backoffice remises | — | — | oui |
| Backoffice modules | — | — | oui |

---

## Décision — VALIDÉE (2026-03-28)

**Statut : ACCEPTÉ** après brainstorming session avec adversarial review, edge case analysis, et role playing sur 5 personas réels.

Voir le rapport complet : `_bmad-output/brainstorming/brainstorming-session-2026-03-28.md`

### Principes fondamentaux

1. **Le layout est un skin de navigation, pas un contrôle d'accès.** Le layout ne bloque jamais — il organise.
2. **Les permissions SiteMember contrôlent la visibilité des modules.** Le propriétaire est souverain sur les grants.
3. **`User.role === INGENIEUR` → ingénieur layout. Tous les autres → farm layout.** Pas de `isIngenieur`, pas de nouveau champ.
4. **`User.isSuperAdmin` → backoffice.** Seul critère pour le backoffice.

### Architecture retenue : Y1 — Deux route groups + stub re-exports

```
src/components/pages/vagues-page.tsx        → logique réelle
src/app/(farm)/vagues/page.tsx              → export { default } from "@/components/pages/vagues-page"
src/app/(ingenieur)/vagues/page.tsx         → export { default } from "@/components/pages/vagues-page"
```

- Pages partagées : stubs 1 ligne dans chaque route group, composant réel dans `src/components/pages/`
- Pages exclusives farm : `/finances`, `/ventes`, `/factures`, `/clients`, `/mon-abonnement`, `/settings/sites`, `/users`
- Pages exclusives ingénieur : `/monitoring`, `/portefeuille`, `/packs`, `/activations`

### Middleware redirect

```
if (user.isSuperAdmin) → /(backoffice)/
else if (user.role === INGENIEUR) → /(ingenieur)/
else → /(farm)/
```

Middleware enforce aussi les frontières : un INGENIEUR sur `/(farm)/*` est redirigé vers `/(ingenieur)/*`.

### Navigation bottom-nav

**Farm (5 items) :** Accueil | Ma ferme | Finances | Messages | Menu
**Ingénieur (5 items) :** Accueil | Tâches | +Relevé (FAB) | Clients | Menu

### Rôles et layouts

| Rôle | Layout | Raison |
|------|--------|--------|
| INGENIEUR | ingénieur | Toujours, même scopé sur une ferme client |
| PISCICULTEUR | farm | Propriétaire ou solo farmer |
| GERANT | farm | Staff de la ferme, permissions du propriétaire |
| ADMIN | farm | Sauf isSuperAdmin → backoffice |

### Impact schema

**ZERO migrations. ZERO nouveaux champs.** Tout est frontend : routing + navigation + middleware.

### Décisions clés du brainstorming

1. Pas de `isIngenieur` — `User.role` existant suffit
2. L'ingénieur **reste toujours** dans son layout, même scopé sur une ferme client
3. Le GERANT n'est **pas** une 3e audience — c'est un profil de permissions dans le farm layout
4. Le solo PISCICULTEUR accède à tout via permissions (Ma ferme > Vague > +Relevé)
5. Le propriétaire est **souverain** — il décide qui voit quoi sur sa ferme
6. Le FAB (+Relevé) est une optimisation de fréquence pour l'ingénieur, pas un blocage pour les autres
7. Un ingénieur qui possède sa propre ferme la voit comme un client avec toutes les permissions
