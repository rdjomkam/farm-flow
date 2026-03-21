# Pré-analyse Story 36.2 — CRON job : rappels de renouvellement
**Date :** 2026-03-21
**Sprint :** 36
**Dépend de :** Story 36.1 (FAIT)

## Statut : GO AVEC RÉSERVES

## Résumé
Le système de notifications in-app existe et est pleinement opérationnel (modèle `Notification`,
query `getNotifications`, service `creerNotificationSiAbsente` dans `src/lib/alertes.ts`).
La query `getAbonnementsExpirantAvant()` est déjà dans `src/lib/queries/abonnements.ts`.
Trois réserves à traiter avant de commencer : (1) l'enum `TypeAlerte` doit être étendu pour
`ABONNEMENT_RAPPEL_RENOUVELLEMENT`, (2) la story utilise `addDays` (date-fns) mais le projet
n'a pas cette dépendance — utiliser l'API `Date` native comme dans `abonnement-lifecycle.ts`,
(3) la query `getAbonnementsExpirantAvant` retourne les abonnements dont `dateFin < date`,
pas exactement ceux expirant dans X jours — à comprendre pour la logique de J-14/J-7/J-3/J-1.

---

## Vérifications effectuées

### 1. Système de notifications in-app : EXISTE

Le modèle `Notification` est complet dans `prisma/schema.prisma` (lignes 1202-1226) :
- Champs : `id`, `typeAlerte`, `titre`, `message`, `statut`, `lien`, `severite`, `actionPayload`, `userId`, `siteId`, `createdAt`
- `typeAlerte` est de type `TypeAlerte` (enum PostgreSQL)
- `statut` est de type `StatutAlerte` (ACTIVE, LUE, TRAITEE)
- Index : `[userId, siteId, statut]` et `[siteId, severite, statut]`

L'interface TypeScript `Notification` dans `src/types/models.ts` (lignes 1109-1137) est
alignée avec le schéma Prisma.

Le service de création de notification avec déduplication existe dans `src/lib/alertes.ts` :
- `creerNotificationSiAbsente(siteId, userId, typeAlerte, titre, message, lien?)` — vérifie
  l'existence d'une notification ACTIVE du même type pour le jour courant avant de créer
- `notificationActiveExiste(siteId, userId, typeAlerte)` — helper interne de déduplication
  via `createdAt` entre minuit et 23h59 du jour courant

Ces fonctions sont **privées** (non exportées). Le service `rappels-abonnement.ts` devra
soit les dupliquer, soit extraire la logique dans un helper partagé exporté, soit appeler
`prisma.notification.create` directement avec sa propre logique de déduplication.

### 2. Enum TypeAlerte : EXTENSION REQUISE

`TypeAlerte` dans `src/types/models.ts` (lignes 994-1011) contient 11 valeurs, AUCUNE
ne correspond à un rappel d'abonnement :
```
MORTALITE_ELEVEE, QUALITE_EAU, STOCK_BAS, RAPPEL_ALIMENTATION,
RAPPEL_BIOMETRIE, PERSONNALISEE, BESOIN_EN_RETARD, DENSITE_ELEVEE,
RENOUVELLEMENT_EAU_INSUFFISANT, AUCUN_RELEVE_QUALITE_EAU, DENSITE_CRITIQUE_QUALITE_EAU
```

Le même enum dans `prisma/schema.prisma` est identique — 11 valeurs, pas de valeur
abonnement. Une migration Prisma sera **nécessaire** pour ajouter
`ABONNEMENT_RAPPEL_RENOUVELLEMENT` (et synchroniser dans `src/types/models.ts`).

### 3. Modèle Abonnement et champs pertinents : OK

Le modèle `Abonnement` dans `prisma/schema.prisma` (lignes 1982-2011) expose :
- `statut StatutAbonnement` — filtre sur ACTIF requis
- `dateFin DateTime` — date d'expiration à comparer
- `planId String` + relation `plan PlanAbonnement` — pour filtrer DECOUVERTE
- `userId String` + relation `user User` — pour récupérer le destinataire de la notification
- `siteId String` — pour la notification (R8)

### 4. PlanAbonnement — champ DECOUVERTE : OK

`PlanAbonnement.typePlan` est de type `TypePlan` (enum, `@unique`).
L'enum `TypePlan` dans `prisma/schema.prisma` (lignes 1841-1847) contient :
`DECOUVERTE, ELEVEUR, PROFESSIONNEL, ENTREPRISE, INGENIEUR_STARTER, INGENIEUR_PRO`

Identique dans `src/types/models.ts` (lignes 2260-2274). La condition
`plan.typePlan !== TypePlan.DECOUVERTE` est donc directement utilisable.

### 5. Query getAbonnementsExpirantAvant : PRÉSENTE MAIS LOGIQUE À CLARIFIER

`getAbonnementsExpirantAvant(date: Date)` dans `src/lib/queries/abonnements.ts` (lignes 161-173) :
```typescript
where: { statut: StatutAbonnement.ACTIF, dateFin: { lt: date } }
```

La story cite : `getAbonnementsExpirantAvant(addDays(now(), 14))` pour obtenir les
abonnements expirant dans 14 jours. Or la query retourne les abonnements dont `dateFin < date`,
c'est-à-dire **déjà expirés ou expirant avant J+14**.

Pour les rappels J-14/J-7/J-3/J-1, il faut calculer `daysRemaining = Math.floor((dateFin - now) / 86400000)`
puis filtrer. La query récupérera l'ensemble des abonnements expirant dans les 14 prochains
jours, puis le service calculera `daysRemaining` pour chaque et ne créera une notification
que si `daysRemaining IN [14, 7, 3, 1]`.

### 6. Route CRON existante — intégration : SIMPLE

`src/app/api/cron/subscription-lifecycle/route.ts` (Story 36.1, FAIT) expose un
handler `GET` avec pattern :
1. Vérification `CRON_SECRET`
2. `await transitionnerStatuts()`
3. `await rendreCommissionsDisponiblesCron()`
4. Retour structuré `{ processed: { graces, suspendus, expires, commissionsDisponibles } }`

L'intégration de la Story 36.2 consiste à ajouter :
```typescript
const rappels = await envoyerRappelsRenouvellement();
```
Et inclure `rappelsEnvoyes: rappels.envoyes` dans le retour `processed`.

### 7. Librairie de dates : ABSENTE

La story mentionne `addDays(now(), 14)` (syntaxe date-fns). Le projet **n'a pas** de
librairie de dates externe installée. Tout le code existant utilise l'API `Date` native
(`new Date()`, `setDate(getDate() + N)`). Le service doit utiliser le même pattern natif.

---

## Incohérences trouvées

1. **`TypeAlerte` ne contient pas `ABONNEMENT_RAPPEL_RENOUVELLEMENT`**
   - Fichiers : `prisma/schema.prisma` (enum TypeAlerte), `src/types/models.ts` (enum TypeAlerte)
   - Nécessite une migration Prisma (ajout d'une valeur d'enum) selon ERR-001 : approche RECREATE
   - Impact : bloquant si on veut stocker ce type précis dans le modèle `Notification`

2. **`creerNotificationSiAbsente` non exportée depuis `src/lib/alertes.ts`**
   - La fonction interne de déduplication `creerNotificationSiAbsente` n'est pas exportée
   - Le service `rappels-abonnement.ts` ne peut pas la réutiliser directement
   - Options : exporter la fonction, créer une helper partagé, ou ré-implémenter la déduplication

3. **`addDays` référencé dans la story mais pas disponible dans le projet**
   - La story cite `addDays(now(), 14)` (syntaxe date-fns) — pas de dépendance date-fns
   - Utiliser le pattern natif : `const limite = new Date(); limite.setDate(limite.getDate() + 14)`

4. **`getAbonnementsExpirantAvant` inclut les abonnements déjà expirés**
   - `dateFin: { lt: date }` retourne aussi les abonnements avec `dateFin < now()`
   - Le service doit ajouter `dateFin: { gte: maintenant }` pour exclure les déjà expirés
   - Alternative : modifier la query ou filtrer côté service (préférer le filtrage Prisma)

---

## Risques identifiés

1. **Migration enum TypeAlerte — approche RECREATE obligatoire**
   - Ajouter `ABONNEMENT_RAPPEL_RENOUVELLEMENT` à l'enum PostgreSQL `TypeAlerte` requiert
     l'approche RECREATE (ERR-001) car `ADD VALUE + UPDATE` dans la même transaction échoue
   - Impact : risque d'erreur de migration si pattern incorrect
   - Mitigation : suivre ERR-001 strictement ; ERR-006 (texte CLI dans SQL généré) aussi applicable

2. **Doublons de notifications inter-jours**
   - La déduplication existante dans `alertes.ts` filtre `createdAt` entre minuit et 23h59
   - Pour les rappels à J-14/J-7/J-3/J-1, si le CRON s'exécute plusieurs fois par jour
     (retry Vercel), la déduplication du jour courant suffit
   - Si le CRON s'exécute à J-14 EXACTEMENT et que `daysRemaining` est calculé en millis,
     l'arrondi peut varier entre J+13.9 et J+14.1 — utiliser `Math.round` ou `Math.floor`
     et documenter le choix

3. **ERR-014 applicable — boucle sans $transaction**
   - Le service créera des notifications dans une boucle `for (const abo of abonnements)`
   - Chaque `prisma.notification.create` est atomique individuellement mais la boucle ne l'est pas
   - Pour les rappels (contrairement aux transitions d'état), un échec partiel est acceptable
     (les notifications manquantes seront retentrées le lendemain)
   - Décision architecturale à documenter : pas de `$transaction` global pour les rappels
     (comportement "best effort" acceptable)

---

## Fichiers à créer / modifier

| Action | Fichier | Raison |
|--------|---------|--------|
| CRÉER | `src/lib/services/rappels-abonnement.ts` | Service principal de la story |
| MODIFIER | `src/app/api/cron/subscription-lifecycle/route.ts` | Ajouter l'appel + retour |
| MODIFIER | `prisma/schema.prisma` | Ajouter `ABONNEMENT_RAPPEL_RENOUVELLEMENT` à `TypeAlerte` |
| MIGRATION | `prisma/migrations/` | Nouvelle migration RECREATE pour l'enum |
| MODIFIER | `src/types/models.ts` | Ajouter la valeur à `TypeAlerte` |
| MODIFIER | `src/types/index.ts` | Vérifier que `TypeAlerte` est bien exporté (déjà le cas) |
| MODIFIER | `src/lib/alertes.ts` OU nouveau helper | Exporter `creerNotificationSiAbsente` |

---

## Recommandation

GO AVEC RÉSERVES. Trois points à traiter en début d'implémentation :

1. Décider si on ajoute `ABONNEMENT_RAPPEL_RENOUVELLEMENT` à `TypeAlerte` (migration
   requise, ERR-001) ou si on réutilise `TypeAlerte.PERSONNALISEE` pour les rappels
   abonnement (sans migration, mais moins lisible). La première option est préférable
   pour la traçabilité.

2. Exporter `creerNotificationSiAbsente` depuis `src/lib/alertes.ts` OU créer un helper
   dédié `creerNotificationAbonnement` dans `src/lib/services/rappels-abonnement.ts`
   qui ré-implémente la déduplication pour ce contexte spécifique.

3. Remplacer `addDays(now(), 14)` par `new Date(now.setDate(now.getDate() + 14))` partout
   dans le service — aucune dépendance à installer.

La query `getAbonnementsExpirantAvant` est prête à l'emploi mais le service doit
s'assurer d'exclure les abonnements dont `dateFin < maintenant` (déjà expirés) du filtre.
