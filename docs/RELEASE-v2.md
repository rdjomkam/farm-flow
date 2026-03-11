# Release Notes — Farm Flow v2.0

**Date :** 2026-03-11
**Version :** 2.0.0 (Phase 2 complète)
**Sprints :** 6 à 12 (7 sprints, ~50 API routes, ~30 pages UI, 1 000 tests)

---

## Résumé exécutif

Farm Flow v2 transforme l'application de suivi piscicole en une **plateforme de gestion complète** pour l'élevage de silures (*Clarias gariepinus*) au Cameroun. Elle couvre désormais l'ensemble du cycle d'exploitation : authentification multi-rôles, gestion multi-fermes, approvisionnement, ventes/facturation, production d'alevins, alertes, planning, et exports PDF/Excel.

---

## Nouvelles fonctionnalités par sprint

### Sprint 6 — Authentification
- Inscription/connexion avec hachage bcrypt + sessions sécurisées
- 3 rôles : Admin, Gérant, Pisciculteur
- 25 permissions granulaires avec groupes prédéfinis
- Pages `/login` et `/register` mobile-first
- Middleware de protection des routes
- Préfixe téléphonique +237 automatique (Cameroun)

### Sprint 7 — Multi-tenancy
- Modèle `Site` (ferme) : un utilisateur peut gérer plusieurs sites
- Sélecteur de site actif dans la navigation
- Isolation totale des données par `siteId` (R8 respectée sur tous les modèles)
- Gestion des membres par site : ajout/retrait, changement de rôle, permissions individuelles
- Protection anti-escalade de privilèges

### Sprint 8 — Stock & Approvisionnement
- Catalogue produits (Aliment / Intrant / Équipement) avec seuils d'alerte
- Gestion fournisseurs (nom, téléphone, e-mail)
- Commandes avec statuts (BROUILLON → ENVOYEE → RECUE → ANNULEE)
- Mouvements de stock (ENTREE / SORTIE) avec traçabilité vague
- Pages : `/stock`, `/stock/produits`, `/stock/fournisseurs`, `/stock/commandes`, `/stock/mouvements`
- Liaison automatique entre consommation de relevé et mouvement SORTIE

### Sprint 9 — Ventes & Facturation
- Clients avec historique d'achats
- Ventes de poissons liées à une vague (poids, prix au kg, montant)
- Facturation automatique (BROUILLON → ENVOYEE → PAYEE → ANNULEE)
- Suivi des paiements (Espèces / Mobile Money / Virement / Chèque)
- Pages : `/ventes`, `/clients`, `/factures`, `/finances`
- Dashboard financier : KPIs, évolution mensuelle (Recharts), top clients, rentabilité par vague

### Sprint 10 — Production Alevins
- Suivi des reproducteurs (mâle/femelle, poids, statut)
- Enregistrement des pontes (date, nombre d'œufs, taux de fécondation)
- Lots d'alevins : suivi des pertes, transfert en vague de grossissement
- Pages : `/alevins`, `/alevins/reproducteurs`, `/alevins/pontes`, `/alevins/lots`
- Analytiques dédiés (graphiques évolution des alevins)

### Sprint 11 — Alertes + Planning + Dashboard Financier
- Système d'alertes : stock bas, mortalité élevée, FCR dégradé, délai de relevé
- Configuration des seuils d'alerte par site
- Cloche de notifications avec badge compteur en temps réel
- Module Planning : planification des activités (alimentation, biométrie, traitement)
- Pages : `/notifications`, `/settings/alertes`, `/planning`

### Sprint 12 — Export PDF/Excel + Polish + Navigation
- Export PDF : facture (A4, tableaux, paiements), rapport vague (KPIs, relevés), rapport financier (KPIs, ventes/vague, top clients, évolution)
- Export Excel : relevés (20 colonnes), ventes, mouvements de stock
- Boutons d'export intégrés sur les pages /factures/[id], /vagues/[id], /finances, /stock/mouvements
- Réorganisation navigation : bottom-nav contextuelle (5 groupes × 5 items), sidebar repliable, hamburger avec groupes
- Polish accessibilité : aria-labels, focus management, DialogTrigger asChild (R5)
- Lazy loading des graphiques Recharts (dynamic import ssr:false)
- Fix bloquant review (I-1) : `nombreVentes` réel par vague dans le rapport financier PDF

---

## Schéma de données — Phase 2

| Modèle | Sprint | Description |
|--------|--------|-------------|
| `User` | 6 | Utilisateur avec rôle + passwordHash |
| `Session` | 6 | Session authentifiée avec activeSiteId |
| `Site` | 7 | Ferme piscicole |
| `SiteMember` | 7 | Appartenance user ↔ site avec permissions[] |
| `Fournisseur` | 8 | Fournisseur d'intrants |
| `Produit` | 8 | Produit stock (aliment / intrant / équipement) |
| `MouvementStock` | 8 | Entrée / Sortie de stock |
| `Commande` | 8 | Commande fournisseur + lignes |
| `LigneCommande` | 8 | Ligne de commande |
| `ReleveConsommation` | 8 | Consommation liée à un relevé |
| `Client` | 9 | Client acheteur |
| `Vente` | 9 | Vente de poissons |
| `Facture` | 9 | Facture liée à une vente |
| `Paiement` | 9 | Paiement d'une facture |
| `Reproducteur` | 10 | Poisson reproducteur |
| `Ponte` | 10 | Opération de ponte |
| `LotAlevins` | 10 | Lot d'alevins issu d'une ponte |
| `Activite` | 11 | Activité planifiée |
| `AlerteConfig` | 11 | Configuration d'alerte par site |

**Total Phase 2 :** 19 nouveaux modèles · 16 enums · 9 migrations

---

## Statistiques techniques

| Indicateur | Valeur |
|-----------|--------|
| API routes | ~50 endpoints |
| Pages UI | ~30 pages |
| Tests | **1 000** (0 échec) |
| Fichiers de test | 36 |
| Pages build | 73 |
| Erreurs TypeScript | 0 |
| Migrations Prisma | 9 (Phase 2) |
| Sprints Phase 2 | 7 |
| Bugs résolus | 16 (BUG-001 à BUG-019) |

---

## Règles Phase 2 respectées (R1-R9)

| # | Règle | Statut |
|---|-------|--------|
| R1 | Enums MAJUSCULES | ✅ 16 enums, 0 valeur lowercase |
| R2 | Importer les enums | ✅ Jamais de string littérale |
| R3 | Prisma = TypeScript | ✅ Interfaces miroirs dans models.ts |
| R4 | Opérations atomiques | ✅ updateMany avec conditions |
| R5 | DialogTrigger asChild | ✅ Tous les dialogs auditées |
| R6 | CSS variables du thème | ✅ (exception documentée : @react-pdf/renderer Node.js) |
| R7 | Nullabilité explicite | ✅ Zéro champ ambigu |
| R8 | siteId PARTOUT | ✅ 19 modèles + toutes les queries + toutes les routes |
| R9 | Tests avant review | ✅ 1 000/1 000 à chaque sprint |

---

## Corrections appliquées avant release

| Ref | Sévérité | Description | Fichier |
|-----|----------|-------------|---------|
| I-1 | **Bloquante** | `nombreVentes: 0` hardcodé → comptage réel depuis `ventesByVague` | `src/lib/queries/finances.ts` + `src/app/api/export/finances/route.ts` |
| M-2 | Basse | Bouton hamburger 36 px → 44 px (touch target mobile) | `src/components/layout/hamburger-menu.tsx` |
| M-3 | Basse | "Releve" → "Relevé" (accent manquant) | `src/components/layout/bottom-nav.tsx` |

---

## Migrations exécutées (Phase 2)

| Migration | Description |
|-----------|-------------|
| `20260309065155_add_auth` | User + Session + Role/Permission enums |
| `20260309080000_user_phone_email_nullable` | email nullable + phone |
| `20260309092300_add_multi_tenancy` | Site + SiteMember + siteId sur Bac/Vague/Releve |
| `20260309120000_add_stock` | Fournisseur + Produit + MouvementStock + Commande + LigneCommande |
| `20260309150000_add_releve_consommation` | ReleveConsommation + releveId sur MouvementStock |
| `20260309200000_add_bacs_releves_modifier_permissions` | 3 nouvelles Permission values |
| `20260310120000_add_dynamic_roles` | AlerteConfig + rôles dynamiques |
| `20260310150000_add_ventes` | Client + Vente + Facture + Paiement |
| `20260310200000_add_alevins` | Reproducteur + Ponte + LotAlevins |
| `20260311100000_add_alertes_planning` | Activite + modèles planification |
| `20260311120000_link_activite_releve` | Liaison Activite ↔ Releve |

---

## Stack technique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Framework | Next.js (App Router) | 14+ |
| ORM | Prisma | 7 |
| Base de données | PostgreSQL | 16 |
| Styles | Tailwind CSS | 3 |
| Composants | Radix UI | latest |
| Graphiques | Recharts | latest |
| Export PDF | @react-pdf/renderer | 4.3.2 |
| Export Excel | xlsx | 0.18.5 |
| Tests | Vitest | latest |
| Auth | bcrypt + sessions custom | — |

---

## Environnements

| Environnement | Base de données | URL |
|---------------|----------------|-----|
| Développement | PostgreSQL 16 Docker (port 8432) | `postgresql://dkfarm:...@localhost:8432/farm-flow` |
| Production | Prisma Postgres (prisma.io) | Via `DATABASE_URL` + Prisma Accelerate optionnel |

---

## Comment démarrer

```bash
# 1. Démarrer la base de données
docker compose up -d

# 2. Appliquer les migrations
npx prisma migrate deploy

# 3. Charger les données de seed
npm run db:seed

# 4. Démarrer l'application
npm run dev

# 5. Accéder à l'application
# http://localhost:3000
# Admin : admin@farmflow.cm / admin123
```

---

## Prochaines étapes (Phase 3 — non planifiée)

- PWA / mode hors-ligne (Service Worker)
- Notifications push (mobile)
- Tableau de bord multi-sites (consolidé)
- Intégration carte des bassins (plan interactif)
- API publique pour intégrations tierces

---

*Release validée par @code-reviewer le 2026-03-11.*
*Coordonnée par @project-manager — Sprint 12.10.*
