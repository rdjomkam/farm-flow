# Pré-analyse — Story 30.1 : Schéma Prisma Abonnements

**Date :** 2026-03-20
**Agent :** @pre-analyst
**Statut global :** GO — aucun bloquant détecté

---

## 1. État actuel du schéma

### Enums existants (39 enums)
StatutVague, TypeReleve, TypeAliment, CauseMortalite, MethodeComptage, Role, CategorieProduit,
UniteStock, TypeMouvement, StatutCommande, StatutFacture, ModePaiement, ActionRegle, SiteModule,
Permission, TypeAlerte, StatutAlerte, TypeActivite, StatutActivite, Recurrence, CategorieDepense,
StatutDepense, FrequenceRecurrence, StatutBesoins, StatutActivation, VisibiliteNote,
CategorieCalibrage, TypeSystemeBac, SeveriteAlerte, OperateurCondition, LogiqueCondition,
TypeDeclencheur, PhaseElevage, SexeReproducteur, StatutReproducteur, StatutPonte, StatutLotAlevins,
PlaceholderMode, PlaceholderFormat

### Modèles existants (42 modèles)
Site, ConfigElevage, SiteRole, SiteMember, User, Session, Bac, Vague, Releve, Fournisseur, Produit,
MouvementStock, Commande, LigneCommande, ReleveConsommation, Client, Vente, Facture, Paiement,
Reproducteur, Ponte, LotAlevins, ConfigAlerte, Notification, Activite, RegleActivite,
ConditionRegle, Depense, PaiementDepense, DepenseRecurrente, ListeBesoins, LigneBesoin, Pack,
PackProduit, PackBac, PackActivation, NoteIngenieur, Calibrage, CalibrageGroupe,
ReleveModification, CalibrageModification, CustomPlaceholder

---

## 2. Vérifications de prérequis

| Vérification | Statut | Détail |
|---|---|---|
| User.id existe | GO | `String @id @default(cuid())` |
| Site.id existe | GO | `String @id @default(cuid())` |
| Aucun conflit de noms d'enum | GO | 7 nouveaux enums tous disponibles |
| Aucun conflit de noms de modèle | GO | 8 nouveaux modèles tous disponibles |

---

## 3. Conflits détectés

Aucun conflit. Tous les noms d'enums et de modèles sont disponibles.

---

## 4. Dernières migrations appliquées

```
20260326140000_add_condition_regle
20260326150000_add_notification_severity_index
20260326160000_add_quality_declencheur_types
20260326170000_add_action_regle
```

La prochaine migration doit avoir un timestamp postérieur à `20260326170000`.
Suggestion : `20260327000000_add_subscriptions`

---

## 5. Notes pour @db-specialist

### Workflow migration (ERR-002 obligatoire)
NE PAS utiliser `npx prisma migrate dev` — mode non-interactif requis.

```bash
# 1. Modifier prisma/schema.prisma
# 2. Générer le diff SQL
npx prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --script > /tmp/migration.sql

# 3. Créer le répertoire de migration manuellement
mkdir -p prisma/migrations/20260327000000_add_subscriptions

# 4. Copier le SQL
cp /tmp/migration.sql prisma/migrations/20260327000000_add_subscriptions/migration.sql

# 5. Appliquer
npx prisma migrate deploy
```

### ERR-001 : Enums PostgreSQL
- Utiliser la stratégie RECREATE uniquement (jamais ADD VALUE + UPDATE dans la même transaction)
- Pour les nouveaux enums Sprint 30, ce n'est pas un souci (création pure)

### ERR-003 : Seed en SQL brut
- Le seed est toujours via `prisma/seed.sql` + `npm run db:seed` (docker exec psql)
- Jamais de fichier TypeScript pour le seed

### Règles critiques
- R1 : Valeurs d'enum MAJUSCULES sans exception
- R7 : prixMensuel, prixTrimestriel, prixAnnuel NULLABLE sur PlanAbonnement (DECOUVERTE est gratuit)
- R8 : siteId obligatoire sur tous les modèles sauf PlanAbonnement (global) et PortefeuilleIngenieur (ingenieurId @unique)
- Note : PortefeuilleIngenieur DOIT quand même avoir siteId (R8) même s'il a un ingenieurId @unique

### ADR de référence
Voir `docs/decisions/ADR-020-subscriptions-memberships.md` — source de vérité pour le design des modèles.
