# Pré-analyse Sprint 49 — 2026-04-04

## Statut : GO AVEC RÉSERVES

## Résumé
Les prérequis schema et types pour Sprint 49 (essais gratuits) sont tous en place depuis Sprint 45 : `EssaiUtilise`, `isEssai`, `dureeEssaiJours` existent dans le schema Prisma, les types TypeScript, et le client Prisma généré. Les patterns CRON et notification sont matures et réutilisables. Deux réserves bloquantes : (1) `TypeAlerte` ne contient pas de valeur `ABONNEMENT_ESSAI_EXPIRE` pour la notification de fin d'essai (Story 49.3), (2) les stories 49.1–49.3 du backlog officiel (`TASKS.md` / `SPRINTS-SUBSCRIPTIONS-REFACTORING.md`) diffèrent du scope décrit dans la demande utilisateur — la demande mentionne une Story 49.3 "CRON fin d'essai" qui dans le backlog est en réalité incluse dans Story 49.3 "UI essai + CRON".

---

## Vérifications effectuées

### Schema Prisma ↔ Types TypeScript : OK

**`EssaiUtilise` (schema.prisma lignes 3103–3112) :**
- Champs : `id`, `userId`, `typePlan` (TypePlan), `createdAt`
- Contrainte : `@@unique([userId, typePlan])` — garantit un seul essai par plan par utilisateur
- Exception R8 documentée : pas de `siteId` (l'essai est lié à l'utilisateur, pas au site)
- Interface `EssaiUtilise` dans `src/types/models.ts` (lignes 2751–2757) : miroir exact
- Exportée dans `src/types/index.ts` ligne 196 : OK

**`Abonnement.isEssai` (schema.prisma ligne 2577) :**
- `isEssai Boolean @default(false)` : présent
- `dureeEssaiJours Int?` (ligne 2581) : présent
- Interface TypeScript `Abonnement` (models.ts lignes 2730–2733) : miroir exact

**`PlanAbonnement.dureeEssaiJours` (schema.prisma ligne 2530) :**
- `dureeEssaiJours Int?` : présent
- Interface TypeScript `PlanAbonnement` (models.ts ligne 2688) : miroir exact

**Client Prisma généré :**
- `prisma.essaiUtilise` expose bien les opérations CRUD (`src/generated/prisma/models/EssaiUtilise.ts`)
- Accessible via `prisma.essaiUtilise.findFirst`, `.create`, etc.

### API ↔ Queries ↔ Routes : PROBLÈMES

**Routes existantes à modifier / créer :**

1. `POST /api/abonnements` — Story 49.1 : modifier la route existante (`src/app/api/abonnements/route.ts`) pour gérer le path `isEssai: true`. La route existe et est fonctionnelle. Le pattern de la transaction R4 est déjà en place. La modification consistera à brancher une logique conditionnelle dans la route existante.

2. `POST /api/abonnements/[id]/essai-to-paid` — Story 49.2 : **route inexistante**, à créer dans `src/app/api/abonnements/[id]/essai-to-paid/route.ts`. Pattern de référence : `src/app/api/abonnements/[id]/renouveler/route.ts` (même structure : charge abonnement, vérifie statut, crée nouvel abonnement, initie paiement, invalide cache).

3. CRON fin d'essai — Story 49.3 : intégrer dans `src/lib/services/rappels-abonnement.ts` (pattern existant) OU dans `src/lib/services/abonnement-lifecycle.ts` (transition EXPIRE pour les essais). La route CRON existante (`/api/cron/subscription-lifecycle`) appellera le nouveau service.

**Absence de query dédiée pour EssaiUtilise :**
- Aucune fonction dans `src/lib/queries/abonnements.ts` ni ailleurs pour lire/créer un `EssaiUtilise`
- Les développeurs devront implémenter les accès Prisma directement dans la transaction R4 de la route (ou créer des helpers dédiés)
- Pattern recommandé : dans la `$transaction` de création d'essai, faire `tx.essaiUtilise.findUnique({ where: { userId_typePlan: { userId, typePlan } } })` puis `tx.essaiUtilise.create(...)` — atomique par définition

### CRON ↔ Notifications : PROBLÈME BLOQUANT

**`TypeAlerte` ne contient pas de valeur pour "essai expiré" :**
- Valeurs actuelles dans `prisma/schema.prisma` (ligne 231–244) et dans `src/types/models.ts` (lignes 1092–1110) : `ABONNEMENT_RAPPEL_RENOUVELLEMENT` est présent, mais aucune valeur `ABONNEMENT_ESSAI_EXPIRE` ou équivalent n'existe
- Story 49.3 (CRON fin d'essai) doit envoyer la notification "Votre essai est terminé, souscrivez pour continuer"
- La fonction `creerNotificationSiAbsente` prend un `TypeAlerte` typé — on ne peut pas passer une string arbitraire
- **Action requise avant de coder Story 49.3** : ajouter `ABONNEMENT_ESSAI_EXPIRE` dans l'enum `TypeAlerte` du schema Prisma ET dans `src/types/models.ts` (migration non nécessaire car les enums PostgreSQL utilisent l'approche RECREATE documentée en ERR-001)

**Pattern CRON à suivre :**
- Service de rappel : `src/lib/services/rappels-abonnement.ts` (utilise `creerNotificationSiAbsente` + `TypeAlerte` depuis `@/generated/prisma/enums`)
- Transition de statut : `src/lib/services/abonnement-lifecycle.ts` (utilise `StatutAbonnement` depuis `@/types`, `updateMany` atomique)
- La logique "essai expiré → EXPIRE" peut s'ajouter dans `transitionnerStatuts()` (fichier `abonnement-lifecycle.ts`) comme 4e transition
- La notification peut s'ajouter dans `envoyerRappelsRenouvellement()` ou dans un nouveau service dédié appelé depuis le CRON route

### Navigation ↔ Permissions : OK (non impacté)
Sprint 49 ne crée aucune page UI ni item de navigation (Stories 49.1 et 49.2 sont de type API, Story 49.3 inclut de l'UI mais selon le backlog officiel, non selon la demande utilisateur).

### Build & Tests : NON EXÉCUTÉS (analyse statique uniquement)
- Pas de changement de code dans ce sprint encore — le build actuel (Sprint 47 FAIT) est supposé propre
- Les tests devront être ajoutés en Story 49.4

---

## Incohérences trouvées

### INC-1 : Scope Stories 49.1–49.3 diverge entre la demande et le backlog officiel

**Fichiers concernés :**
- `docs/sprints/SPRINTS-SUBSCRIPTIONS-REFACTORING.md` (source de vérité)
- Demande utilisateur (description Sprint 49)

**Détail :**
- Le backlog officiel définit Story 49.3 comme "UI essai : bouton checkout + affichage tarifs + carte abonnement + CRON" (UI + CRON combinés)
- La demande utilisateur définit Story 49.3 comme "CRON fin d'essai uniquement" (API type)
- Story 49.2 dans le backlog est "API conversion essai → payant (essai-to-paid)" — cohérent avec la demande
- Story 49.1 dans le backlog est "API création essai + vérification EssaiUtilise" — cohérent avec la demande

**Suggestion :** Aligner le scope avec le `@project-manager` avant de commencer. Si la demande porte sur 49.1 (API), 49.2 (API), et la partie CRON de 49.3, c'est réalisable. La partie UI de 49.3 sera séparée.

### INC-2 : `TypeAlerte` manque `ABONNEMENT_ESSAI_EXPIRE`

**Fichiers concernés :**
- `prisma/schema.prisma` (enum `TypeAlerte`, ligne 231)
- `src/types/models.ts` (enum `TypeAlerte`, ligne 1092)

**Détail :** La notification "essai terminé" requiert une valeur d'enum dédiée. Sans elle, `creerNotificationSiAbsente` ne peut pas être appelée avec le bon `TypeAlerte`.

**Fix :**
1. Ajouter `ABONNEMENT_ESSAI_EXPIRE` dans l'enum `TypeAlerte` du schema Prisma (approche RECREATE, voir ERR-001)
2. Ajouter `ABONNEMENT_ESSAI_EXPIRE = "ABONNEMENT_ESSAI_EXPIRE"` dans `src/types/models.ts`
3. Générer une migration (workflow non-interactif ERR-002)

### INC-3 : Aucune query helper pour `EssaiUtilise`

**Fichiers concernés :**
- `src/lib/queries/abonnements.ts` (absent)

**Détail :** Le modèle `EssaiUtilise` est présent en schema et en types mais aucune fonction de query n'existe. Les Stories 49.1 et 49.3 ont besoin de lire/créer des `EssaiUtilise`. Ce n'est pas bloquant si les accès sont faits directement via `prisma.essaiUtilise` dans les transactions R4 — mais des helpers (`getEssaiUtilise`, `marquerEssaiUtilise`) amélioreraient la lisibilité et la testabilité.

---

## Risques identifiés

### RISQUE-1 : R4 sur la vérification EssaiUtilise + création Abonnement (Story 49.1)
**Impact :** Critique — race condition possible
**Détail :** Si le check `essaiUtilise.findFirst` et la création de l'abonnement (+ la création de l'`EssaiUtilise`) ne sont pas dans la même `$transaction`, deux requêtes concurrentes peuvent créer deux essais pour le même plan/user. Le `@@unique([userId, typePlan])` en base empêchera la deuxième `essaiUtilise.create` avec une erreur Prisma P2002, mais l'abonnement aura déjà été créé. Il faut que le tout soit dans une seule transaction.
**Mitigation :** Encapsuler dans `prisma.$transaction` : `essaiUtilise.findUnique` → si existe throw → `abonnement.create` → `essaiUtilise.create`. ERR-016 s'applique ici.

### RISQUE-2 : Essai expiré vs logique ACTIF → EN_GRACE → SUSPENDU → EXPIRE (Story 49.3)
**Impact :** Haute — comportement incohérent possible
**Détail :** Le CRON actuel fait passer ACTIF → EN_GRACE les abonnements dont `dateFin < maintenant`. Les essais (`isEssai: true`) vont donc passer par la même période de grâce que les abonnements payants. Si l'intention métier est d'expirer les essais directement (sans grâce), il faut filtrer `isEssai: true` dans la transition ACTIF → EN_GRACE et les faire passer directement à EXPIRE, OU ajouter une transition dédiée.
**Mitigation :** Clarifier avec le PM si les essais ont une période de grâce. Si non, ajouter une transition `ACTIF(isEssai) → EXPIRE` avant la transition générale dans `transitionnerStatuts()`.

### RISQUE-3 : Story 49.2 — ne pas annuler l'essai avant confirmation paiement
**Impact :** Haute — perte de continuité de service
**Détail :** Le backlog spécifie explicitement "L'essai ne doit PAS être annulé tant que le paiement n'est pas confirmé". La route `essai-to-paid` crée un nouvel abonnement EN_ATTENTE_PAIEMENT sans toucher l'essai. La transition essai → EXPIRE doit se faire dans le webhook de confirmation (comme `confirmerPaiement`). Nécessite de savoir comment le webhook identifie l'abonnement précédent (essai) à expirer.
**Mitigation :** Le nouvel abonnement créé par `essai-to-paid` doit stocker une référence à l'essai parent (via `metadata` dans l'audit ou un champ dédié). Vérifier si le modèle `Abonnement` a un champ pour cela — actuellement non (pas de `essaiParentId`). Probablement à gérer via `logAbonnementAudit` avec la référence dans les métadonnées, et un lookup au moment de la confirmation.

---

## Prérequis manquants

1. **Migration schema pour `TypeAlerte.ABONNEMENT_ESSAI_EXPIRE`** — blocant pour Story 49.3. Créer avant de coder le CRON. Utiliser l'approche RECREATE (ERR-001) + workflow non-interactif (ERR-002).

2. **Décision métier : les essais ont-ils une période de grâce ?** — à clarifier avec le PM avant Story 49.3. Impact sur la logique de transition dans `abonnement-lifecycle.ts`.

3. **Décision : comment `essai-to-paid` track l'essai parent ?** — à clarifier avant Story 49.2. Si on veut expirer l'essai à la confirmation de paiement, il faut un moyen de le retrouver. Options : champ `essaiParentId` sur `Abonnement` (schema change) ou metadata dans l'audit trail.

4. **Sprint 48 pas encore FAIT** — le backlog marque Sprint 48 `TODO`. Sprint 49 "dépend de Sprint 47" (FAIT) selon le backlog, et est "parallélisable avec Sprint 48" — donc pas de blocage strict sur 48.

---

## Recommandation

GO sur Stories 49.1 et 49.2 (parties API) avec les réserves suivantes :

- Story 49.1 : implémenter dans la route existante `src/app/api/abonnements/route.ts`, branche conditionnelle `isEssai: true`. Tout dans une `$transaction` (ERR-016 / RISQUE-1). Utiliser `prisma.essaiUtilise` directement dans la transaction.
- Story 49.2 : créer `src/app/api/abonnements/[id]/essai-to-paid/route.ts` sur le modèle de `renouveler/route.ts`. Clarifier avant le codage comment l'essai parent est tracké pour l'expiration post-paiement (RISQUE-3).
- Story 49.3 (CRON) : NO-GO tant que `TypeAlerte.ABONNEMENT_ESSAI_EXPIRE` n'est pas ajouté au schema et aux types (INC-2). Clarifier aussi si les essais ont une période de grâce (RISQUE-2).

**Action immédiate recommandée :** Ouvrir un ticket de schema pour ajouter `ABONNEMENT_ESSAI_EXPIRE` dans l'enum `TypeAlerte` (migration RECREATE). Cette migration peut se faire en parallèle du codage de 49.1 et 49.2.
