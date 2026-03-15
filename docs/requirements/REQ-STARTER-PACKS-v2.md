# REQ — Starter Packs & Automated Guided Farming

**Version:** 2.1
**Date:** 2026-03-15
**Auteur:** @architect + @project-manager
**Statut:** REFINED
**Basé sur:** v2.0 + retrait IA (reportée Phase 4) + communication bidirectionnelle client-ingénieur

---

## 1. Vision & Objectif Business

### 1.1 Contexte

DKFarm produit des alevins (fingerlings) de Clarias gariepinus et souhaite développer un nouveau canal de vente : les **Packs Démarrage**. Ces packs permettent à des débutants de se lancer dans la pisciculture avec un accompagnement complet via l'application FarmFlow.

### 1.2 Proposition de valeur

> « Achetez un pack, suivez les instructions de l'app, élevez vos poissons vous-même. »

- **Pour le client** : Un kit complet (alevins + aliment + antibiotiques) + une app qui guide pas à pas toute la production
- **Pour DKFarm** : Revenus récurrents (vente d'aliments, intrants) + fidélisation via l'app + collecte de données agronomiques
- **Pour l'ingénieur** : Monitoring à distance des fermes clientes pour conseil et intervention ciblée

### 1.3 Modèle économique

```
Pack vendu → Client utilise FarmFlow → App crée activités automatiques
    → Client consomme stock fourni → Stock épuisé
    → App recommande réapprovisionnement → Client rachète chez DKFarm
    → Cycle récurrent sur 6-8 mois de production
```

---

## 2. Définition des Packs

### 2.1 Structure d'un Pack

| Composant | Description | Objectif |
|-----------|-------------|----------|
| **Alevins** | Fingerlings Clarias gariepinus (5-10g) | Base de l'élevage |
| **Aliment démarrage** | 1.2-2mm, quantité pour 4-6 premières semaines | Démarrer sans attendre |
| **Kit santé** | Oxytetracycline + Vitamine C + Sel | Prévention/traitement basique |
| **Accès FarmFlow** | Compte utilisateur + Site pré-configuré | Suivi et guidage automatique |

### 2.2 Offres de Packs

| Pack | Alevins | Aliment démarrage | Kit santé | Prix indicatif |
|------|---------|-------------------|-----------|----------------|
| **Pack Découverte** | 100 | 2kg (1.2mm) + 5kg (2mm) | Mini kit | — |
| **Pack Starter** | 300 | 5kg (1.2mm) + 15kg (2mm) | Kit standard | — |
| **Pack Pro** | 500 | 8kg (1.2mm) + 25kg (2mm) | Kit complet | — |
| **Pack Business** | 1 000 | 15kg (1.2mm) + 45kg (2mm) | Kit complet + probiotiques | — |
| **Pack Custom** | Sur mesure | Calculé selon quantité | Choix | — |

### 2.3 Contenu détaillé du Kit Santé

| Élément | Mini | Standard | Complet |
|---------|------|----------|---------|
| Oxytetracycline (g) | 50 | 100 | 200 |
| Vitamine C (g) | 50 | 100 | 200 |
| Sel (kg) | 1 | 2 | 5 |
| Probiotiques | — | — | 100g |

### 2.4 Contraintes de validation (EC-1.1, EC-1.2, EC-1.3, EC-1.7)

| Champ | Contrainte | Raison |
|-------|-----------|--------|
| `Pack.nombreAlevins` | `>= 10` | Éviter division par zéro dans calculs survie/FCR/SGR |
| `Pack.prixTotal` | `> 0` | Pas de pack gratuit ni négatif ; devise = FCFA |
| `PackProduit.quantite` | `> 0` | Zéro/négatif n'a pas de sens pour un contenu de pack |
| Pack Custom | `nombreAlevins` dans `[10, 10000]` | Bornes raisonnables |

### 2.5 Cycle de vie des Packs (EC-1.5, EC-1.6)

- Un Pack avec `isActive = false` ne peut plus être utilisé pour de nouvelles activations.
- Les activations existantes continuent à fonctionner (pas de cascade).
- Un `Produit` référencé par `PackProduit` ne peut pas être supprimé → `onDelete: Restrict` sur la relation.
- Un Pack avec 0 `PackProduit` est autorisé mais génère un avertissement à l'UI.

---

## 3. Onboarding Automatisé

### 3.1 Flux de provisioning

```
Super Admin crée un Pack (dans FarmFlow)
    → Définit : type de pack, quantité alevins, produits inclus
    → Sélectionne un profil ConfigElevage

Client active son pack (ou l'admin active pour le client)
    → Crée son compte (ou reçoit des identifiants)
    → Un Site est auto-créé avec (dans une TRANSACTION Prisma $transaction) :
        1. Site créé
        2. SiteMember (client = PISCICULTEUR, DKFarm admin = INGENIEUR)
        3. ConfigElevage COPIÉE depuis le Pack (snapshot indépendant)
        4. Vague pré-configurée (nombreInitial = nb alevins, poidsMoyenInitial = ~7g, configElevageId = copie)
        5. Bac par défaut (volume = null, à renseigner par le client avant premier nourrissage)
        6. Produits COPIÉS dans le stock client (avec quantités du pack, fournisseurId = null)
        7. Activités de la Semaine 1 auto-générées (userId = SYSTEM_USER_ID)
        8. PackActivation créée avec statut ACTIVE
    → Le client reçoit ses identifiants
```

### 3.2 Provisioning transactionnel (F-01, F-03, EC-2.3)

**OBLIGATOIRE** : L'ensemble du provisioning (les 8 étapes ci-dessus) DOIT être exécuté dans un `prisma.$transaction()` atomique. En cas d'échec partiel, tout est annulé.

### 3.3 Concept de System User (F-01, F-03)

Les activités auto-générées nécessitent un `userId`. Solution retenue :

```
Constante : SYSTEM_USER_ID = "system"

Utilisateur spécial en base :
    id = "system"
    name = "FarmFlow System"
    email = null
    phone = null
    role = ADMIN
    isActive = true
    passwordHash = "" (non connectable)
```

- Cet utilisateur est créé par le seed et ne peut PAS se connecter (pas de mot de passe valide).
- Il est utilisé comme `userId` pour toutes les activités auto-générées par le moteur de règles.
- Il est utilisé comme `userId` pour les MouvementStock créés automatiquement lors du provisioning.
- L'UI filtre cet utilisateur des listes de membres.

### 3.4 Copie des Produits vers le site client (F-14)

Lors de l'activation, pour chaque `PackProduit` :
1. Créer un nouveau `Produit` sur le site client avec les mêmes attributs (nom, categorie, unite, prixUnitaire) mais `fournisseurId = null` et `siteId = clientSiteId`.
2. Créer un `MouvementStock` de type `ENTREE` pour la quantité du pack.
3. Le `stockActuel` du Produit client est initialisé à la quantité du pack.
4. Le `seuilAlerte` est calculé : `quantiteQuotidienneEstimee * config.stockJoursAlerte`.

### 3.5 Volume du Bac (EC-2.4)

Le `Bac.volume` est **nullable** (`Float?`) lors de l'activation. Le client doit renseigner le volume avant la première activité d'alimentation. Le moteur d'activités génère une activité bloquante "Renseigner le volume de votre bac" de priorité 1 si `volume IS NULL`.

Les calculs de densité sont ignorés tant que le volume n'est pas renseigné.

### 3.6 Modèle de données — Pack

```
Nouveau modèle : Pack
    id          String    @id @default(cuid())
    code        String    @unique   // "PACK-YYYY-NNN"
    nom         String              // "Pack Starter 300"
    description String?

    nombreAlevins       Int         // >= 10
    poidsMoyenInitial   Float     @default(7.0)   // grammes

    prixTotal           Float       // > 0, en FCFA
    isActive            Boolean   @default(true)

    configElevageId     String
    configElevage       ConfigElevage @relation(fields: [configElevageId], references: [id])

    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt
    siteId      String              // Site DKFarm (vendeur)
    site        Site      @relation("PacksSite", fields: [siteId], references: [id])

    produits    PackProduit[]
    activations PackActivation[]

Nouveau modèle : PackProduit (contenu du pack)
    id          String    @id @default(cuid())
    packId      String
    pack        Pack      @relation(fields: [packId], references: [id], onDelete: Cascade)
    produitId   String
    produit     Produit   @relation(fields: [produitId], references: [id], onDelete: Restrict)
    quantite    Float              // > 0, quantité dans le pack

    @@unique([packId, produitId])

Nouveau modèle : PackActivation (vente/livraison d'un pack)
    id              String    @id @default(cuid())
    code            String    @unique   // "ACT-YYYYMMDD-XXXX" (suffixe 4 chars aléatoires)
    packId          String
    pack            Pack      @relation(fields: [packId], references: [id])

    clientUserId    String
    clientUser      User      @relation(fields: [clientUserId], references: [id])
    clientSiteId    String              // PAS @unique — un site peut avoir plusieurs activations
    clientSite      Site      @relation("ActivationsClientSite", fields: [clientSiteId], references: [id])
    vagueId         String              // PAS @unique — permet remplacement de vague
    vague           Vague     @relation(fields: [vagueId], references: [id])

    dateActivation  DateTime  @default(now())
    dateExpiration  DateTime?           // fin de l'accès app (null = illimité)
    statut          StatutActivation    // ACTIVE, EXPIREE, SUSPENDUE, TERMINEE

    notes           String?
    siteId          String              // Site DKFarm (vendeur) — R8

    createdAt       DateTime  @default(now())
    updatedAt       DateTime  @updatedAt

    @@index([clientSiteId])
    @@index([clientUserId])
    @@index([statut])

Nouvel enum : StatutActivation
    ACTIVE
    EXPIREE
    SUSPENDUE
    TERMINEE
```

### 3.7 Visibilité des Packs pour les clients (F-04)

Le `Pack.siteId` pointe vers le site DKFarm (vendeur). Un client n'interroge PAS directement la table `Pack`.

L'accès client aux informations du pack se fait via `PackActivation` :
- Le client voit son `PackActivation` via `clientSiteId = monSiteId`.
- L'API `/api/mon-pack` retourne les informations du pack via la jointure `PackActivation → Pack`.
- Les endpoints `GET /api/packs` et `POST /api/packs` sont réservés au rôle ADMIN/INGENIEUR.

### 3.8 Activations multiples (F-05, F-06, EC-2.1, EC-2.7, EC-2.8)

- **`clientSiteId` n'est PAS `@unique`** : un site peut avoir plusieurs activations (achats successifs).
- **`vagueId` n'est PAS `@unique`** : permet le remplacement d'une vague échouée.
- **Contrôle doublon** : une même combinaison `(packId, clientUserId)` avec statut `ACTIVE` est interdite (check applicatif).
- **Statut `TERMINEE`** : ajouté pour marquer les activations dont la vague est TERMINEE ou ANNULEE.

### 3.9 Code d'activation (EC-2.5)

Format : `ACT-YYYYMMDD-XXXX` où XXXX est un suffixe aléatoire alphanumérique (4 caractères). Cela élimine la limite de 999/an tout en gardant la lisibilité.

### 3.10 Expiration et suspension (EC-2.9, EC-2.10)

- **EXPIREE** : le CRON quotidien vérifie `dateExpiration < now()` et met à jour le statut. L'accès de l'ingénieur au site reste actif. L'accès du client passe en lecture seule.
- **SUSPENDUE** : déclenché manuellement par un ADMIN/INGENIEUR. Raisons : non-paiement, inactivité prolongée (> 30 jours sans relevé). Accès client en lecture seule. Le moteur d'activités est mis en pause.

---

## 4. Moteur d'Activités Automatiques (Activity Engine)

### 4.1 Concept

Le cœur de la fonctionnalité : un **moteur de règles** qui crée automatiquement des activités (tâches) en fonction de :

1. **Le temps écoulé** depuis le début de la vague (calendrier prédéfini)
2. **Les données des relevés** (poids moyen, mortalité, qualité eau)
3. **L'état du stock** (niveaux, seuils)
4. **Les jalons de croissance** (changement de taille d'aliment, tri, récolte)

### 4.2 Types de déclencheurs (Triggers)

| Type | Déclencheur | Exemple |
|------|-------------|---------|
| **CALENDRIER** | Nombre de jours depuis début vague | "Jour 7 : Première biométrie" |
| **RECURRENT** | Intervalle fixe depuis début vague | "Tous les jours : Contrôle mortalité + alimentation" |
| **SEUIL_POIDS** | Poids moyen atteint un seuil | "Poids > 30g → Passer à l'aliment 2mm" |
| **SEUIL_QUALITE** | Paramètre eau hors norme | "pH < 6.5 → Changer l'eau" |
| **SEUIL_MORTALITE** | Taux de mortalité élevé | ">1% mortalité/jour → Investigation" |
| **STOCK_BAS** | Stock sous le seuil d'alerte | "Aliment 2mm < 2kg → Commander" |
| **FCR_ELEVE** | FCR au-dessus du seuil | "FCR > 2.0 → Ajuster alimentation" |
| **JALON** | Étape de production atteinte | "Semaine 16 → Évaluation récolte partielle" |

### 4.3 Modèle de données — Règles d'activités

```
Nouveau modèle : RegleActivite (template de règle)
    id              String    @id @default(cuid())
    nom             String              // "Biométrie hebdomadaire S1-S6"
    description     String?

    typeActivite    TypeActivite        // BIOMETRIE, ALIMENTATION, TRI, etc.
    typeDeclencheur TypeDeclencheur     // CALENDRIER, SEUIL_POIDS, etc.

    // Conditions de déclenchement
    jourDepuisDebut     Int?            // pour CALENDRIER
    intervalleJours     Int?            // pour RECURRENT (point de départ = dateDebut vague)
    seuilPoidsMin       Float?          // pour SEUIL_POIDS (g)
    seuilPoidsMax       Float?          // pour SEUIL_POIDS (g)
    seuilValeur         Float?          // pour SEUIL_QUALITE, SEUIL_MORTALITE, FCR
    parametreQualite    String?         // "ph", "temperature", "oxygene", "ammoniac"
    comparateur         String?         // "GT", "LT", "GTE", "LTE"

    // Contenu de l'activité générée
    titreTemplate       String          // "Biométrie semaine {semaine}"
    descriptionTemplate String          // Instructions détaillées avec placeholders
    instructionsDetaillees String?      // Markdown — guide pas à pas

    // Relation produit (pour recommandations stock)
    categorieProduit    CategorieProduit?  // filtre catégorie de produit à recommander
    produitRecommandeId String?         // FK Produit spécifique (optionnel)
    produitRecommande   Produit?        @relation("RegleProduitRecommande", fields: [produitRecommandeId], references: [id], onDelete: SetNull)

    priorite            Int     @default(5)   // 1-10, 1 = plus urgent
    isActive            Boolean @default(true)
    ordre               Int     @default(0)   // ordre d'affichage

    // Comportement de déclenchement (EC-3.2)
    onceOnly            Boolean @default(false) // true = ne se déclenche qu'une seule fois par vague

    // Phase de croissance applicable
    phaseMin            PhaseElevage?    // phase minimum pour appliquer la règle
    phaseMax            PhaseElevage?    // phase maximum

    // Conditions nullables (EC-3.12) : si aucune condition n'est définie, la règle match TOUJOURS
    // (pour le type de déclencheur donné). Validation : phaseMin <= phaseMax (EC-3.5).

    siteId              String           // R8
    site                Site     @relation(fields: [siteId], references: [id])
    createdAt           DateTime @default(now())
    updatedAt           DateTime @updatedAt

    // Relations inverses
    activites           Activite[]

    @@index([siteId])
    @@index([typeActivite])
    @@index([typeDeclencheur])

Nouvel enum : TypeDeclencheur
    CALENDRIER
    RECURRENT
    SEUIL_POIDS
    SEUIL_QUALITE
    SEUIL_MORTALITE
    STOCK_BAS
    FCR_ELEVE
    JALON

Nouvel enum : PhaseElevage
    ACCLIMATATION     // 5-15g, Semaines 1-2
    CROISSANCE_DEBUT  // 15-50g, Semaines 3-6
    JUVENILE          // 50-150g, Semaines 7-10
    GROSSISSEMENT     // 150-350g, Semaines 11-14
    FINITION          // 350-700g, Semaines 15-20
    PRE_RECOLTE       // 700g+, Semaines 21-28
```

### 4.4 Nouveaux TypeActivite (F-02, EC-3.10)

Valeurs à ajouter à l'enum `TypeActivite` existant :

```
enum TypeActivite {
    ALIMENTATION
    BIOMETRIE
    QUALITE_EAU
    COMPTAGE
    NETTOYAGE
    TRAITEMENT
    RECOLTE
    AUTRE
    // Phase 3 — nouvelles valeurs
    TRI                     // Tri/grading des poissons par taille
    RECOMMANDATION_STOCK    // Alerte stock bas + recommandation de réapprovisionnement
    MEDICATION              // Traitement médical spécifique (distinct de TRAITEMENT général)
}
```

### 4.5 Activités générées — Modèle enrichi

Le modèle `Activite` existant sera enrichi avec les champs suivants :

```
Champs ajoutés à Activite :
    regleId                 String?         // FK RegleActivite (si auto-généré)
    regle                   RegleActivite?  @relation(fields: [regleId], references: [id], onDelete: SetNull)

    instructionsDetaillees  String?         // Markdown — instructions pas à pas

    produitRecommandeId     String?         // FK Produit (aliment ou intrant recommandé)
    produitRecommande       Produit?        @relation("ActiviteProduitRecommande", fields: [produitRecommandeId], references: [id], onDelete: SetNull)
    quantiteRecommandee     Float?          // quantité suggérée (en grammes)

    priorite                Int?    @default(5)
    isAutoGenerated         Boolean @default(false)

    phaseElevage            PhaseElevage?   // phase au moment de la création
```

**Réconciliation recurrence vs intervalleJours (F-01)** :
- Le champ existant `Activite.recurrence` (enum `Recurrence`) est conservé pour les activités créées MANUELLEMENT par l'utilisateur.
- Les activités AUTO-GÉNÉRÉES par le moteur (`isAutoGenerated = true`) n'utilisent PAS `recurrence`. Le moteur utilise `RegleActivite.intervalleJours` pour calculer la prochaine date et crée une NOUVELLE activité à chaque occurrence.
- Il n'y a donc pas de conflit : `recurrence` = activités manuelles, `intervalleJours` = moteur automatique.

### 4.6 Déduplication et idempotence (EC-3.1, EC-3.2, EC-3.11)

**Problème** : Le CRON peut s'exécuter deux fois, ou des relevés concurrents peuvent déclencher la même règle.

**Solution** : Table de suivi `RegleExecution` :

```
Nouveau modèle : RegleExecution
    id              String    @id @default(cuid())
    regleId         String
    regle           RegleActivite @relation(fields: [regleId], references: [id], onDelete: Cascade)
    vagueId         String
    vague           Vague     @relation(fields: [vagueId], references: [id], onDelete: Cascade)

    lastTriggeredDate   DateTime      // date du dernier déclenchement
    triggerCount        Int     @default(1)  // nombre de fois déclenchée

    createdAt       DateTime  @default(now())
    updatedAt       DateTime  @updatedAt

    @@unique([regleId, vagueId])     // une entrée par couple règle+vague
    @@index([vagueId])
```

**Logique** :
- Pour `RECURRENT` : vérifier que `lastTriggeredDate + intervalleJours <= now()` avant de générer.
- Pour `SEUIL_POIDS` avec `onceOnly = true` : vérifier que `triggerCount = 0` avant de générer.
- Pour `CALENDRIER` : vérifier que `lastTriggeredDate` ne correspond pas déjà au jour cible.
- Utiliser `prisma.regleExecution.upsert()` dans une transaction pour éviter les doublons concurrents.

### 4.7 Guard : vague sans poissons vivants (EC-3.9)

Le moteur NE GÉNÈRE PAS d'activités pour une vague dont `nombreVivants = 0` (calculé à partir du dernier relevé de comptage ou `nombreInitial - somme(mortalités) - somme(ventes)`). Exception : l'activité de type `RECOLTE` peut être générée même si `nombreVivants = 0` (pour finaliser la vague).

### 4.8 Résolution de priorité (EC-3.3)

Quand plusieurs règles matchent simultanément pour la même vague :
1. Les activités sont toutes générées (pas de suppression).
2. Elles sont triées par `priorite` (1 = plus urgent) pour l'affichage.
3. Les activités de type TRAITEMENT/MEDICATION ont toujours priorité sur ALIMENTATION.

### 4.9 Référence temporelle pour RECURRENT (EC-3.7)

Le point de départ de l'intervalle `RECURRENT` est **la date de début de la vague** (`Vague.dateDebut`). Le moteur calcule : `jours_ecoules = (now - dateDebut).days`. Si `jours_ecoules % intervalleJours == 0`, la règle est éligible.

### 4.10 Catalogue de règles pré-définies (Seed)

#### 4.10.1 Activités quotidiennes récurrentes

| Règle | Type | Déclencheur | Phase | Instructions |
|-------|------|-------------|-------|--------------|
| Alimentation matin | ALIMENTATION | RECURRENT (1j) | Toutes | "Distribuer {quantité_calculée}g d'aliment {taille}mm. Répartir uniformément. Observer la prise alimentaire pendant 15 minutes. Si les poissons ne finissent pas en 30 min, réduire la dose de 10%." |
| Alimentation soir | ALIMENTATION | RECURRENT (1j) | Toutes | "2ème distribution de {quantité_calculée}g. Si la température est < 26°C, réduire de 20%." |
| Contrôle mortalité | BIOMETRIE | RECURRENT (1j) | Toutes | "Retirer les poissons morts. Compter et noter le nombre. Observer : lésions rouges ? Champignons ? Comportement anormal des vivants ? Si > 3 morts, créer un relevé MORTALITE." |
| Contrôle eau (visuel) | QUALITE_EAU | RECURRENT (1j) | Toutes | "Observer la couleur de l'eau (vert clair = OK, vert foncé/marron = alerte). Vérifier l'odeur. Mesurer la température. Si > 32°C, ombrager le bac." |

#### 4.10.2 Activités hebdomadaires / bi-mensuelles

| Règle | Type | Déclencheur | Phase | Instructions |
|-------|------|-------------|-------|--------------|
| Biométrie | BIOMETRIE | RECURRENT (7j) | ACCLIMATATION → JUVENILE | "Attraper 10 à 20 poissons avec une épuisette. Peser chacun individuellement. Calculer la moyenne. Remettre délicatement dans le bac. Manipuler avec les mains mouillées pour ne pas abîmer le mucus." |
| Biométrie | BIOMETRIE | RECURRENT (14j) | GROSSISSEMENT → PRE_RECOLTE | Idem avec 10 poissons |
| Qualité eau complète | QUALITE_EAU | RECURRENT (7j) | Toutes | "Mesurer pH, température, et si possible ammoniac. pH idéal : 6.5-7.5. Température idéale : 26-32°C. Ammoniac doit être < 0.05 mg/L." |
| Changement eau | NETTOYAGE | RECURRENT (3j) | Toutes | "Renouveler 30-50% de l'eau du bac. Siphonner les déchets au fond. Laisser reposer 30 min avant de nourrir." |

#### 4.10.3 Activités déclenchées par seuil de poids

| Règle | Seuil | Type | onceOnly | Instructions |
|-------|-------|------|----------|--------------|
| Passage aliment 2mm | poids > 30g | ALIMENTATION | true | "Les poissons ont atteint {poids_moyen}g. Il est temps de passer à l'aliment 2mm. Stock actuel de 2mm : {stock}. Si insuffisant, commander chez DKFarm. Transition : mélanger 50/50 ancien/nouveau pendant 3 jours." |
| Passage aliment 3mm | poids > 50-80g | ALIMENTATION | true | "Passer à l'aliment 3mm. Les poissons de {poids_moyen}g ont besoin de granulés plus gros. Taux d'alimentation : 3-5% du poids corporel." |
| Passage aliment 4-6mm | poids > 150g | ALIMENTATION | true | "Passer à l'aliment 4-6mm (grossissement). Réduire la fréquence à 2x/jour. Taux : 2-3% du poids corporel." |
| Passage aliment 6-9mm | poids > 350g | ALIMENTATION | true | "Passer à l'aliment finition 6-9mm. Fréquence : 1-2x/jour. Taux : 1.5-2% du poids corporel." |
| Tri obligatoire | poids 15-150g | TRI | false | "Les poissons font en moyenne {poids_moyen}g. Un tri est nécessaire pour réduire le cannibalisme. Séparer les gros (> 120% de la moyenne) des petits (< 80%). Préparer un 2ème bac si disponible." |

**Note** : Les règles de passage d'aliment ont `onceOnly = true` (EC-3.2) car elles ne doivent se déclencher qu'une fois par vague. Le tri a `onceOnly = false` car il peut être répété.

#### 4.10.4 Activités déclenchées par anomalies

| Règle | Condition | Type | Instructions |
|-------|-----------|------|--------------|
| Mortalité élevée | > 1%/jour | TRAITEMENT | "Mortalité anormale détectée ({taux}%). Actions immédiates : 1) Vérifier la qualité de l'eau (pH, T°, ammoniac). 2) Observer les poissons : lésions ? comportement ? 3) Si lésions rouges → Traitement Oxytetracycline (voir instructions). 4) Si eau trouble → Changement 50% immédiat. 5) Réduire l'alimentation de 50%." |
| pH hors norme | pH < 6.0 ou > 8.5 | QUALITE_EAU | "pH mesuré à {valeur}. Plage idéale : 6.5-7.5. Actions : 1) Changement d'eau 50%. 2) Si pH bas : ajouter du bicarbonate de soude (1g/100L). 3) Si pH haut : réduire l'alimentation, augmenter aération." |
| Température critique | T° < 22 ou > 35 | QUALITE_EAU | "Température à {valeur}°C. Idéal : 26-32°C. Si trop chaud : ombrager, aérer. Si trop froid : réduire alimentation de 30%." |
| FCR élevé | FCR > 2.0 | ALIMENTATION | "Le FCR est de {valeur} (idéal < 1.5). Cela signifie que les poissons convertissent mal l'aliment. Vérifier : 1) L'aliment n'est-il pas périmé ? 2) La quantité distribuée est-elle correcte ? 3) Y a-t-il des restes après 30 min ? Réduire la dose de 15%." |
| Stock aliment bas | stockActuel < seuilAlerte | RECOMMANDATION_STOCK | "Stock de {produit} bas : {stock_actuel} restant (seuil : {seuil}). Au rythme actuel, il vous reste environ {jours_restants} jours. Recommandation : commander {quantite_recommandee} auprès de DKFarm." |

**Taux de mortalité** (EC-3.4) : le pourcentage est calculé sur le nombre de vivants actuel (pas le nombre initial). Formule : `nombreMorts_dernier_jour / nombreVivants_actuel * 100`.

#### 4.10.5 Jalons de production

| Règle | Jour | Type | onceOnly | Instructions |
|-------|------|------|----------|--------------|
| Bilan semaine 2 | J14 | BIOMETRIE | true | "Première évaluation majeure. Faire un comptage précis des survivants + biométrie. Le taux de survie à J14 doit être > 90%. Si < 80%, contacter un technicien DKFarm." |
| Premier tri | J21-28 | TRI | true | "Premier tri critique. Le cannibalisme est la 1ère cause de mortalité chez Clarias. Trier les poissons en 2-3 catégories de taille. Les plus gros et les plus petits doivent être séparés." |
| Évaluation FCR | J70 | BIOMETRIE | true | "Évaluation à mi-parcours. Biométrie complète + calcul FCR. FCR idéal à ce stade : < 1.5. Comparer les performances avec les références FarmFlow." |
| Évaluation récolte partielle | J112 | COMPTAGE | true | "Certains poissons peuvent avoir atteint 400-500g. Évaluer si une récolte partielle est possible pour les plus gros spécimens. Cela réduit la densité et favorise la croissance des restants." |
| Pré-récolte | J140-168 | RECOLTE | true | "Les poissons devraient être entre 700g-1kg. Préparer la récolte : 1) Identifier les acheteurs. 2) Arrêter l'alimentation 48h avant. 3) Créer une vente dans FarmFlow." |

### 4.11 Placeholders de templates (F-19)

Liste des placeholders disponibles dans `titreTemplate` et `descriptionTemplate` :

| Placeholder | Source | Exemple |
|-------------|--------|---------|
| `{semaine}` | `floor(joursEcoules / 7) + 1` | 6 |
| `{jour}` | `joursEcoules` | 42 |
| `{poids_moyen}` | Dernier relevé BIOMETRIE | 45.2 |
| `{quantité_calculée}` | Formule alimentation (§5) | 540 |
| `{taille}` | Table taille aliment (§5.3) | 2mm |
| `{stock}` | `Produit.stockActuel` filtré par categorie | 8500 |
| `{produit}` | `Produit.nom` | Granulé 2mm |
| `{stock_actuel}` | `Produit.stockActuel` | 1200 |
| `{seuil}` | `Produit.seuilAlerte` | 2000 |
| `{jours_restants}` | `stockActuel / consommationQuotidienne` | 3 |
| `{quantite_recommandee}` | `consommationQuotidienne * 30` | 16200 |
| `{taux}` | Taux mortalité quotidien (%) | 2.1 |
| `{valeur}` | Valeur du paramètre déclencheur | 5.8 |
| `{nombre_vivants}` | Nombre vivants actuel | 275 |

**Fallback** : Si un placeholder ne peut pas être résolu (ex: pas de relevé biométrie), il est remplacé par `"[non disponible]"` et une note est ajoutée à l'activité.

---

## 5. Calcul Automatique des Quantités d'Aliment

### 5.1 Formule

```
Quantité quotidienne (g) = Nombre de vivants × Poids moyen (g) × Taux d'alimentation (%)
```

**Nombre de vivants** (EC-4.1) : calculé comme `nombreInitial - somme(mortalités) - somme(ventes)`. Le dernier relevé COMPTAGE fait foi si disponible. Si aucune donnée récente (> 14 jours), utiliser la dernière valeur connue avec un avertissement.

### 5.2 Table de taux d'alimentation

| Phase | Poids moyen | Taux (% poids corporel/jour) | Fréquence |
|-------|-------------|------------------------------|-----------|
| ACCLIMATATION | 5-15g | 8-10% | 3-4x/jour |
| CROISSANCE_DEBUT | 15-50g | 5-6% | 3x/jour |
| JUVENILE | 50-150g | 3-5% | 2-3x/jour |
| GROSSISSEMENT | 150-350g | 2-3% | 2x/jour |
| FINITION | 350-700g | 1.5-2% | 1-2x/jour |
| PRE_RECOLTE | 700g+ | 1-1.5% | 1x/jour |

**Sélection du taux** (EC-4.3) : le moteur utilise la **moyenne** de la plage (ex: 8-10% → 9%). L'utilisateur peut ajuster via ConfigElevage.

### 5.3 Taille d'aliment recommandée

| Poids moyen | Taille granulé | Catégorie stock |
|-------------|----------------|-----------------|
| 5-15g | 1.2mm | Aliment démarrage |
| 15-30g | 1.5-2mm | Aliment croissance |
| 30-80g | 2-3mm | Aliment croissance |
| 80-150g | 3-4mm | Aliment grossissement |
| 150-350g | 4-6mm | Aliment grossissement |
| 350g+ | 6-9mm | Aliment finition |

**Frontières de phase** (EC-4.4) : la borne supérieure est exclusive. Un poisson de exactement 15g est en phase CROISSANCE_DEBUT (pas ACCLIMATATION). Formule : `poids > seuilAcclimatation` → CROISSANCE_DEBUT.

### 5.4 Alimentation par bac après tri (EC-4.5)

Après un tri qui sépare les poissons en plusieurs bacs, le calcul d'alimentation est fait **par bac** en utilisant le dernier relevé BIOMETRIE de chaque bac. Si un bac n'a pas encore de biométrie post-tri, le poids moyen de la vague est utilisé comme fallback.

### 5.5 Conversion d'unités stock (EC-14.4)

Les quantités d'aliment sont calculées en **grammes**. Les produits en stock peuvent être en KG ou SACS. Conversion :
- KG → grammes : `stockActuel * 1000`
- SACS → grammes : `stockActuel * Produit.contenance * 1000` (contenance en kg par sac, champ existant)

### 5.6 Exemple concret (Pack Starter 300 alevins)

```
Jour 1 :  300 poissons × 7g × 8% = 168g/jour (en 3 distributions de 56g)
Jour 14 : 285 poissons × 12g × 8% = 273g/jour
Jour 30 : 275 poissons × 25g × 6% = 412g/jour → Passage à 2mm
Jour 45 : 270 poissons × 40g × 5% = 540g/jour
Jour 60 : 265 poissons × 65g × 4% = 689g/jour → Passage à 3mm
Jour 90 : 260 poissons × 120g × 3% = 936g/jour → Passage à 4mm
Jour 120: 255 poissons × 250g × 2.5% = 1594g/jour
Jour 150: 250 poissons × 450g × 2% = 2250g/jour → Passage à 6mm
Jour 180: 245 poissons × 700g × 1.5% = 2572g/jour
Jour 210: 240 poissons × 1000g × 1.2% = 2880g/jour → RÉCOLTE
```

---

## 6. Paramètres Configurables (ConfigElevage)

### 6.1 Principe

Toutes les valeurs qui pilotent le moteur d'activités, les calculs d'alimentation, les benchmarks et les alertes doivent être **configurables par vague**. Un super admin DKFarm définit un **profil de configuration par défaut** (basé sur les références FAO pour Clarias gariepinus). Chaque Pack référence un profil, et lors de l'activation le profil est **copié** vers le site du client.

Ceci permet :
- D'adapter les seuils à l'espèce élevée (Clarias vs Tilapia vs autre)
- De varier l'objectif de production (400g, 500g, 800g, 1kg selon le marché)
- D'ajuster les recommandations au contexte local (climat, aliments disponibles)
- De détecter les anomalies **au plus tôt** avec des benchmarks adaptés

### 6.2 Ownership : ConfigElevage par Vague (F-07)

La ConfigElevage est rattachée à la **Vague** via `Vague.configElevageId`. Cela permet :
- Plusieurs vagues sur un même site avec des configs différentes.
- Immutabilité : la config est copiée (snapshot) à l'activation, pas liée. Modifier la config d'un Pack n'affecte pas les vagues existantes.

```
Champ ajouté à Vague :
    configElevageId     String?
    configElevage       ConfigElevage? @relation(fields: [configElevageId], references: [id])
```

### 6.3 Copie vs Lien (EC-5.8)

**Décision : COPIE (snapshot).**

Lors de l'activation d'un pack :
1. La ConfigElevage du Pack est dupliquée (nouvel enregistrement avec un nouvel id).
2. La copie est rattachée au `siteId` du client et à la `Vague` via `configElevageId`.
3. Toute modification ultérieure de la config du Pack (par le super admin) n'affecte PAS les vagues en cours.
4. Le client (PISCICULTEUR) ne peut PAS modifier la ConfigElevage (EC-12.2). Seuls ADMIN et INGENIEUR peuvent.

### 6.4 Fallback en absence de ConfigElevage (EC-5.1)

Si une vague n'a pas de `configElevageId` (cas des vagues créées avant la Phase 3) :
1. Chercher une ConfigElevage avec `isDefault = true` sur le site.
2. Si aucune config par défaut sur le site, utiliser les **constantes hardcodées** existantes dans `benchmarks.ts`, `alertes.ts`, `calculs.ts` comme fallback.
3. Les constantes hardcodées ne sont JAMAIS supprimées — elles servent toujours de dernier recours.

### 6.5 Modèle de données

```
Nouveau modèle : ConfigElevage
    id              String    @id @default(cuid())
    nom             String              // "Clarias Standard Cameroun"
    description     String?

    // ── Objectif de production ──────────────────────
    poidsObjectif           Float       // Poids cible par poisson à la récolte (g) — ex: 800
    dureeEstimeeCycle       Int         // Durée estimée du cycle en jours — ex: 180
    tauxSurvieObjectif      Float       // Taux de survie cible en % — ex: 85

    // ── Phases de croissance (seuils de poids en g) ─
    // INVARIANT : seuilAcclimatation < seuilCroissanceDebut < seuilJuvenile < seuilGrossissement < seuilFinition (EC-5.7)
    seuilAcclimatation      Float   @default(15)    // 0 → 15g
    seuilCroissanceDebut    Float   @default(50)    // 15 → 50g
    seuilJuvenile           Float   @default(150)   // 50 → 150g
    seuilGrossissement      Float   @default(350)   // 150 → 350g
    seuilFinition           Float   @default(700)   // 350 → 700g
    // Au-delà de seuilFinition → PRE_RECOLTE

    // ── Alimentation : taille de granulé par poids ──
    // Format JSON validé (voir §6.6)
    alimentTailleConfig     Json        // [{poidsMin, poidsMax, tailleGranule, description, proteines}]

    // ── Alimentation : taux par phase (%BW/jour) ────
    // Format JSON validé (voir §6.7)
    alimentTauxConfig       Json        // [{phase, tauxMin, tauxMax, frequence, notes}]

    // ── Benchmarks : seuils de performance ──────────
    // FCR — INVARIANT : fcrExcellentMax < fcrBonMax < fcrAcceptableMax (EC-5.6)
    fcrExcellentMax         Float   @default(1.5)
    fcrBonMax               Float   @default(1.8)
    fcrAcceptableMax        Float   @default(2.2)

    // SGR (%/jour) — INVARIANT : sgrExcellentMin > sgrBonMin > sgrAcceptableMin
    sgrExcellentMin         Float   @default(2.0)
    sgrBonMin               Float   @default(1.5)
    sgrAcceptableMin        Float   @default(1.0)

    // Taux de survie (%)
    survieExcellentMin      Float   @default(90)
    survieBonMin            Float   @default(85)
    survieAcceptableMin     Float   @default(80)

    // Densité (kg/m³)
    densiteExcellentMax     Float   @default(7)
    densiteBonMax           Float   @default(10)
    densiteAcceptableMax    Float   @default(15)

    // Mortalité cumulative (%)
    mortaliteExcellentMax   Float   @default(3)
    mortaliteBonMax         Float   @default(5)
    mortaliteAcceptableMax  Float   @default(10)

    // ── Qualité eau : seuils d'alerte ───────────────
    phMin                   Float   @default(6.5)
    phMax                   Float   @default(8.5)
    phOptimalMin            Float   @default(6.5)
    phOptimalMax            Float   @default(7.5)

    temperatureMin          Float   @default(22)    // létal
    temperatureMax          Float   @default(36)    // létal
    temperatureOptimalMin   Float   @default(26)
    temperatureOptimalMax   Float   @default(32)

    oxygeneMin              Float   @default(1.5)   // létal
    oxygeneAlerte           Float   @default(4.0)   // stress
    oxygeneOptimal          Float   @default(5.0)

    ammoniacMax             Float   @default(0.5)   // létal
    ammoniacAlerte          Float   @default(0.05)  // stress
    ammoniacOptimal         Float   @default(0.02)

    nitriteMax              Float   @default(1.0)   // létal
    nitriteAlerte           Float   @default(0.5)

    // ── Mortalité : seuils d'alerte quotidiens ──────
    mortaliteQuotidienneAlerte  Float   @default(1.0)   // % → investigation
    mortaliteQuotidienneCritique Float  @default(3.0)   // % → urgence

    // ── Alimentation : seuils d'alerte ──────────────
    fcrAlerteMax            Float   @default(2.0)   // FCR au-delà → réduire dose
    stockJoursAlerte        Int     @default(5)     // Jours restants de stock → alerte

    // ── Tri / Grading ───────────────────────────────
    triPoidsMin             Float   @default(5)     // trier à partir de ce poids (g)
    triPoidsMax             Float   @default(150)   // arrêter de trier au-delà (g)
    triIntervalleJours      Int     @default(14)    // fréquence du tri

    // ── Biométrie ───────────────────────────────────
    biometrieIntervalleDebut    Int @default(7)     // jours entre biométries (phases début)
    biometrieIntervalleFin      Int @default(14)    // jours entre biométries (phases fin)
    biometrieEchantillonPct     Float @default(10)  // % de la population à échantillonner

    // ── Changement d'eau ────────────────────────────
    eauChangementPct            Float @default(30)  // % du volume à renouveler
    eauChangementIntervalleJours Int  @default(3)   // fréquence

    // ── Densité d'élevage ───────────────────────────
    densiteMaxPoissonsM3        Float @default(100) // poissons/m³ max
    densiteOptimalePoissonsM3   Float @default(50)  // poissons/m³ recommandé

    // ── Récolte ─────────────────────────────────────
    recoltePartiellePoidsSeuil  Float @default(400) // poids min pour récolte partielle (g)
    recolteJeuneAvantJours      Int   @default(2)   // arrêter alimentation N jours avant

    // ── Métadonnées ─────────────────────────────────
    isDefault           Boolean @default(false)     // profil par défaut du système
    isActive            Boolean @default(true)

    siteId              String          // R8
    site                Site    @relation(fields: [siteId], references: [id])

    // Relations inverses
    vagues              Vague[]
    packs               Pack[]

    createdAt           DateTime @default(now())
    updatedAt           DateTime @updatedAt

    @@unique([siteId, isDefault], where: { isDefault: true })  // EC-5.2 : un seul défaut par site
    @@index([siteId])
```

**Note sur `@@unique` conditionnel** : Prisma ne supporte pas les unique partiels natifs. L'unicité `isDefault = true` par site sera assurée par un check applicatif dans l'API (avant de sauvegarder, vérifier qu'aucune autre config du site n'est déjà `isDefault`).

### 6.6 Validation JSON — alimentTailleConfig (F-08, EC-5.3)

Le champ `alimentTailleConfig` DOIT respecter ce schéma :

```typescript
interface AlimentTailleEntry {
  poidsMin: number;    // >= 0
  poidsMax: number;    // > poidsMin
  tailleGranule: string; // non vide
  description: string;   // non vide
  proteines: number;     // 0-100 (%)
}
```

**Validation applicative (API)** :
1. Le tableau ne doit pas être vide.
2. Les plages `[poidsMin, poidsMax)` doivent être contiguës et sans chevauchement.
3. Le premier `poidsMin` doit être `0`.
4. Le dernier `poidsMax` doit être suffisamment grand (>= `poidsObjectif`).
5. Validation via Zod schema dans la route API.

### 6.7 Validation JSON — alimentTauxConfig (F-08)

```typescript
interface AlimentTauxEntry {
  phase: PhaseElevage;   // valeur valide de l'enum
  tauxMin: number;       // > 0, < tauxMax
  tauxMax: number;       // > tauxMin, <= 20
  frequence: number;     // 1-6 (distributions/jour)
  notes: string;         // optionnel
}
```

**Validation applicative** :
1. Le tableau doit contenir exactement 6 entrées (une par PhaseElevage).
2. Chaque phase doit être représentée une et une seule fois.

### 6.8 Modification pendant vague active (EC-5.4)

- La ConfigElevage copiée lors de l'activation est immutable par défaut.
- Un ADMIN/INGENIEUR peut modifier la config d'une vague en cours avec un **avertissement explicite** : "Modifier la configuration pendant une vague active peut causer des changements de phase inattendus."
- L'historique des modifications est tracé via `updatedAt`.

### 6.9 Configuration taille d'aliment (`alimentTailleConfig`) — Valeurs par défaut

```json
[
  { "poidsMin": 0,   "poidsMax": 15,  "tailleGranule": "1.2mm", "description": "Aliment démarrage", "proteines": 42 },
  { "poidsMin": 15,  "poidsMax": 30,  "tailleGranule": "1.5-2mm", "description": "Aliment croissance petit", "proteines": 38 },
  { "poidsMin": 30,  "poidsMax": 80,  "tailleGranule": "2-3mm", "description": "Aliment croissance", "proteines": 35 },
  { "poidsMin": 80,  "poidsMax": 150, "tailleGranule": "3-4mm", "description": "Aliment grossissement petit", "proteines": 32 },
  { "poidsMin": 150, "poidsMax": 350, "tailleGranule": "4-6mm", "description": "Aliment grossissement", "proteines": 28 },
  { "poidsMin": 350, "poidsMax": 99999, "tailleGranule": "6-9mm", "description": "Aliment finition", "proteines": 25 }
]
```

### 6.10 Configuration taux d'alimentation (`alimentTauxConfig`) — Valeurs par défaut

```json
[
  { "phase": "ACCLIMATATION",    "tauxMin": 8,   "tauxMax": 10,  "frequence": 4, "notes": "3-4 distributions/jour" },
  { "phase": "CROISSANCE_DEBUT", "tauxMin": 5,   "tauxMax": 6,   "frequence": 3, "notes": "3 distributions/jour" },
  { "phase": "JUVENILE",         "tauxMin": 3,   "tauxMax": 5,   "frequence": 3, "notes": "2-3 distributions/jour" },
  { "phase": "GROSSISSEMENT",    "tauxMin": 2,   "tauxMax": 3,   "frequence": 2, "notes": "2 distributions/jour" },
  { "phase": "FINITION",         "tauxMin": 1.5, "tauxMax": 2,   "frequence": 2, "notes": "1-2 distributions/jour" },
  { "phase": "PRE_RECOLTE",      "tauxMin": 1,   "tauxMax": 1.5, "frequence": 1, "notes": "1 distribution/jour" }
]
```

### 6.11 Impact sur le code existant — Refactoring benchmarks.ts

Les benchmarks actuellement hardcodés dans `src/lib/benchmarks.ts` devront lire depuis `ConfigElevage` :

| Paramètre actuel (hardcodé) | Champ ConfigElevage | Valeur actuelle |
|------------------------------|---------------------|-----------------|
| `BENCHMARK_SURVIE.excellent.min` = 90 | `survieExcellentMin` | 90 |
| `BENCHMARK_SURVIE.bon.min` = 85 | `survieBonMin` | 85 |
| `BENCHMARK_SURVIE.acceptable.min` = 80 | `survieAcceptableMin` | 80 |
| `BENCHMARK_FCR.excellent.max` = 1.5 | `fcrExcellentMax` | 1.5 |
| `BENCHMARK_FCR.bon.max` = 1.8 | `fcrBonMax` | 1.8 |
| `BENCHMARK_FCR.acceptable.max` = 2.2 | `fcrAcceptableMax` | 2.2 |
| `BENCHMARK_SGR.excellent.min` = 2 | `sgrExcellentMin` | 2.0 |
| `BENCHMARK_SGR.bon.min` = 1.5 | `sgrBonMin` | 1.5 |
| `BENCHMARK_SGR.acceptable.min` = 1 | `sgrAcceptableMin` | 1.0 |
| `BENCHMARK_DENSITE.excellent.max` = 7 | `densiteExcellentMax` | 7 |
| `BENCHMARK_DENSITE.bon.max` = 10 | `densiteBonMax` | 10 |
| `BENCHMARK_DENSITE.acceptable.max` = 15 | `densiteAcceptableMax` | 15 |
| `BENCHMARK_MORTALITE.excellent.max` = 3 | `mortaliteExcellentMax` | 3 |
| `BENCHMARK_MORTALITE.bon.max` = 5 | `mortaliteBonMax` | 5 |
| `BENCHMARK_MORTALITE.acceptable.max` = 10 | `mortaliteAcceptableMax` | 10 |

**Les constantes hardcodées sont conservées comme fallback** (EC-5.1).

### 6.12 Impact sur alertes.ts — Seuils configurables

| Seuil actuel (hardcodé) | Champ ConfigElevage | Valeur actuelle |
|--------------------------|---------------------|-----------------|
| pH range `[6.5, 8.5]` | `phMin` / `phMax` | 6.5 / 8.5 |
| Température range `[25, 32]` | `temperatureOptimalMin` / `temperatureOptimalMax` | 25* / 32 |
| Mortalité seuil par défaut = 5 | `mortaliteQuotidienneAlerte` | 1% (plus sensible) |
| Biométrie rappel = 7 jours | `biometrieIntervalleDebut` | 7 |

*Note : la valeur 25°C actuelle dans alertes.ts est en dessous de l'optimal (26°C). ConfigElevage distingue `temperatureMin` (létal à 22°C) de `temperatureOptimalMin` (stress à 26°C) pour des alertes graduées.

### 6.13 Impact sur calculs.ts — Quantités d'aliment dynamiques

```typescript
// AVANT (hardcodé)
function getTauxAlimentation(poidsMoyen: number): number {
  if (poidsMoyen < 15) return 0.08; // 8%
  if (poidsMoyen < 50) return 0.05; // 5%
  // ...
}

// APRÈS (configurable, avec fallback)
function getTauxAlimentation(poidsMoyen: number, config?: ConfigElevage): number {
  if (!config) return getTauxAlimentationHardcode(poidsMoyen); // fallback EC-5.1
  const phase = detecterPhase(poidsMoyen, config);
  const tauxConfig = config.alimentTauxConfig.find(t => t.phase === phase);
  if (!tauxConfig) return getTauxAlimentationHardcode(poidsMoyen); // fallback
  return (tauxConfig.tauxMin + tauxConfig.tauxMax) / 2 / 100; // moyenne
}

function detecterPhase(poidsMoyen: number, config: ConfigElevage): PhaseElevage {
  if (poidsMoyen <= config.seuilAcclimatation) return "ACCLIMATATION";
  if (poidsMoyen <= config.seuilCroissanceDebut) return "CROISSANCE_DEBUT";
  if (poidsMoyen <= config.seuilJuvenile) return "JUVENILE";
  if (poidsMoyen <= config.seuilGrossissement) return "GROSSISSEMENT";
  if (poidsMoyen <= config.seuilFinition) return "FINITION";
  return "PRE_RECOLTE";
}
```

### 6.14 Benchmarks configurables — Alertes graduées

| Niveau | Couleur | Action automatique |
|--------|---------|-------------------|
| **EXCELLENT** | Vert | Aucune — tout va bien |
| **BON** | Bleu/Vert | Aucune — performance normale |
| **ACCEPTABLE** | Orange | Notification d'information |
| **MAUVAIS** | Rouge | Activité corrective auto-générée + notification urgente + alerte ingénieur |

### 6.15 Projections et prévisions basées sur config

Avec `poidsObjectif` et `dureeEstimeeCycle`, l'app peut :
- Calculer le **SGR requis** : `SGR_requis = (ln(poidsObjectif) - ln(poidsMoyenActuel)) / joursRestants * 100`
- Comparer le SGR actuel au SGR requis → alerte si en retard
- Estimer la **date de récolte** : projeter la courbe de croissance
- Calculer l'**aliment total restant** nécessaire pour finir le cycle
- Estimer le **revenu attendu** : `nombreVivants * poidsObjectif * prixVenteKg`

### 6.16 Profils pré-définis (Seed)

| Profil | Objectif | Durée | Contexte |
|--------|----------|-------|----------|
| **Clarias Standard Cameroun** | 800g | 180 jours | Pack DKFarm, aliments commerciaux |
| **Clarias Express** | 500g | 120 jours | Cycle court, densité réduite |
| **Clarias Premium** | 1200g | 240 jours | Gros spécimens, marché premium |
| **Tilapia Standard** | 400g | 180 jours | Espèce alternative (si expansion) |

### 6.17 UI — Page de configuration

```
/settings/config-elevage          → Liste des profils du site
/settings/config-elevage/[id]     → Édition d'un profil
/settings/config-elevage/nouveau  → Création (depuis template ou custom)
```

La page d'édition est organisée en sections repliables :
1. **Objectif de production** — poids cible, durée, survie cible
2. **Phases de croissance** — seuils de poids pour chaque phase (avec validation monotonique)
3. **Alimentation** — tailles de granulé, taux par phase
4. **Benchmarks** — FCR, SGR, survie, densité, mortalité (avec prévisualisation couleur)
5. **Qualité de l'eau** — seuils optimal/alerte/létal pour chaque paramètre
6. **Tri et biométrie** — intervalles, poids min/max pour tri
7. **Densité et gestion** — densité max, changement d'eau
8. **Récolte** — poids min récolte partielle, jeûne pré-récolte

**Accès** : ADMIN et INGENIEUR uniquement. PISCICULTEUR voit en lecture seule (EC-12.2).

### 6.18 API Routes ConfigElevage

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/config-elevage` | GET, POST | Lister/créer des profils de config |
| `/api/config-elevage/[id]` | GET, PUT, DELETE | CRUD individuel |
| `/api/config-elevage/defaut` | GET | Obtenir la config par défaut du site |
| `/api/config-elevage/[id]/dupliquer` | POST | Dupliquer un profil existant |

### 6.19 Relation ConfigElevage avec les composants

```
ConfigElevage ──→ Moteur d'activités (§4)
    │               ├── Calcul quantité aliment (alimentTauxConfig)
    │               ├── Détection changement de phase (seuilXxx)
    │               ├── Déclenchement seuils (fcrAlerteMax, etc.)
    │               └── Fréquences récurrentes (biometrieIntervalle, etc.)
    │
    ├──────────→ Benchmarks (§6.11)
    │               ├── evaluerBenchmark() lit depuis config (fallback hardcodé)
    │               └── Coloration des indicateurs dans le dashboard
    │
    ├──────────→ Alertes (§6.12)
    │               ├── Seuils qualité eau configurables
    │               └── Seuils mortalité configurables
    │
    ├──────────→ Projections (§6.15)
    │               ├── SGR requis vs actuel
    │               ├── Date de récolte estimée
    │               └── Budget aliment restant
    │
    └──────────→ Phase 4 — IA (§7)
                    └── ConfigElevage sera incluse dans le contexte prompt (différé)
```

---

## 7. Intelligence Artificielle — Conseiller Virtuel

> **Reporté en Phase 4.** Le moteur de règles (§4) et les instructions détaillées couvrent 90%+ des besoins de guidage.
> L'IA (Claude API) sera ajoutée comme couche d'enrichissement en Phase 4.
> Voir **Annexe B** pour le périmètre différé et les raisons.

---

## 8. Monitoring Ingénieur (Remote Support)

### 8.1 Concept

Un ingénieur/technicien DKFarm peut :
1. Accéder au site du client (en tant qu'INGENIEUR via le multi-tenancy existant)
2. Voir un **tableau de bord ingénieur** avec les métriques clés de tous les clients
3. Identifier les fermes en difficulté (alertes, mortalité élevée, FCR mauvais)
4. Laisser des notes/conseils directement dans l'app

### 8.2 Dashboard Ingénieur

```
┌────────────────────────────────────────────────┐
│  Dashboard Ingénieur — Mes clients              │
├────────────────────────────────────────────────┤
│                                                  │
│  Alertes actives : 3 fermes                     │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ Client: Jean D. (Pack Starter 300)      │    │
│  │ Jour 45 | Survie: 72% | FCR: 2.3       │    │
│  │ Dernière activité: il y a 3 jours       │    │
│  │ [Voir détails] [Envoyer conseil]        │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ Client: Marie K. (Pack Pro 500)         │    │
│  │ Jour 90 | Survie: 89% | FCR: 1.6       │    │
│  │ Dernière activité: aujourd'hui          │    │
│  │ [Voir détails]                          │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  Stats globales:                                 │
│  - 12 packs actifs                               │
│  - Survie moyenne: 84%                           │
│  - 3 fermes nécessitant attention                │
│  - 2 clients proches de la récolte               │
│  [Page suivante >]                               │
└────────────────────────────────────────────────┘
```

**Pagination** (EC-7.5) : le dashboard ingénieur pagine les clients (20 par page), triés par sévérité d'alerte décroissante.

### 8.3 Modèle de données — Support Ingénieur

```
Nouveau modèle : NoteIngenieur
    id          String    @id @default(cuid())

    ingenieurId String
    ingenieur   User      @relation("NotesEnvoyees", fields: [ingenieurId], references: [id])

    clientSiteId String
    clientSite   Site     @relation("NotesClientSite", fields: [clientSiteId], references: [id])
    vagueId      String?
    vague        Vague?   @relation(fields: [vagueId], references: [id])

    titre        String
    contenu      String            // Markdown
    isUrgent     Boolean  @default(false)
    isRead       Boolean  @default(false)
    isPublic     Boolean  @default(true)  // EC-7.4 : visible par le client (true) ou interne (false)

    // Communication bidirectionnelle (v2.1)
    isFromClient    Boolean  @default(false)  // true = observation envoyée par le client
    observationTexte String?                  // texte libre de l'observation client

    createdAt    DateTime @default(now())
    siteId       String             // R8 — site DKFarm (de l'ingénieur)
    site         Site     @relation("NotesSiteDKFarm", fields: [siteId], references: [id])

    @@index([clientSiteId])
    @@index([ingenieurId])
    @@index([siteId])
```

### 8.4 Endpoint client pour lire les notes (F-09)

Le client accède aux notes de l'ingénieur via :
- `GET /api/mes-notes` : retourne les `NoteIngenieur` où `clientSiteId = activeSiteId` ET `isPublic = true`.
- Les notes non publiques (`isPublic = false`) ne sont visibles que par les INGENIEUR/ADMIN.
- Les notes urgentes (`isUrgent = true`) déclenchent une notification au client.

### 8.5 Accès ingénieur (EC-7.3)

L'ingénieur est ajouté comme `SiteMember` sur le site client avec le rôle `INGENIEUR` (nouveau rôle, voir §12.1). Les permissions du rôle INGENIEUR sur un site client sont **lecture seule** pour les données d'élevage (relevés, activités, stock) + **écriture** pour les notes.

### 8.6 Alertes vers l'ingénieur

Le système envoie automatiquement des notifications à l'ingénieur DKFarm quand :
- Taux de survie d'un client < seuil `survieAcceptableMin` de la config (par défaut 80%)
- FCR > seuil `fcrAcceptableMax` de la config (par défaut 2.2)
- Aucun relevé enregistré depuis > 3 jours (client inactif) — **note** : cette alerte s'applique tous les jours, y compris weekends (EC-7.4). L'ingénieur peut la désactiver par client.
- Client n'a pas complété ses activités depuis > 2 jours
- Stock d'aliment estimé < `stockJoursAlerte` jours (par défaut 5)

---

## 9. Parcours Utilisateur (User Flows)

### 9.1 Super Admin — Création d'un pack

```
1. Menu → Packs → Nouveau Pack
2. Définir : nom, nombre d'alevins (min 10), prix (> 0 FCFA)
3. Sélectionner un profil ConfigElevage
4. Ajouter produits : sélectionner parmi le stock DKFarm + quantité (> 0)
5. Sauvegarder le pack (template réutilisable)
```

### 9.2 Super Admin — Activer un pack pour un client

```
1. Menu → Packs → [Pack] → Nouvelle activation
2. Créer ou sélectionner un utilisateur client (email OU téléphone requis — EC-2.6)
3. Le système crée automatiquement (dans une $transaction) :
   a. Site pour le client
   b. SiteMember (client = PISCICULTEUR, DKFarm = INGENIEUR)
   c. ConfigElevage copiée du Pack vers le site client
   d. Vague avec les paramètres du pack (configElevageId = copie)
   e. Bac par défaut (volume = null, à renseigner)
   f. Produits copiés dans le stock avec quantités du pack
   g. Activités de la semaine 1 (userId = SYSTEM_USER_ID)
   h. PackActivation avec statut ACTIVE
4. Envoyer les identifiants au client (SMS/WhatsApp — hors scope technique Phase 3)
```

### 9.3 Client — Utilisation quotidienne

```
1. Se connecter → Dashboard personnel
2. Voir "Mes tâches du jour" (activités auto-générées, triées par priorité)
   - Alimentation matin : distribuer 168g d'aliment 1.2mm
   - Contrôle mortalité : retirer et compter les morts
   - Alimentation soir : distribuer 168g
3. Cliquer sur une tâche → Voir instructions détaillées (Markdown)
4. Marquer comme terminé (avec relevé si nécessaire)
5. Voir les notifications et notes de l'ingénieur
6. En cas de problème → Décrire l'observation → Envoyer à l'ingénieur DKFarm → Recevoir une note de réponse
```

### 9.4 Ingénieur — Monitoring

```
1. Se connecter (rôle INGENIEUR)
2. Dashboard ingénieur → Vue paginée de tous les clients
3. Identifier les alertes (rouge = critique, orange = attention)
4. Cliquer sur un client → Voir ses stats détaillées
5. Analyser les graphiques (croissance, mortalité, FCR)
6. Envoyer une note/conseil au client (publique ou interne)
7. Consulter les observations envoyées par les clients et y répondre via une note
```

---

## 10. Intégration avec l'existant

### 10.1 Modèles existants impactés

| Modèle | Modification |
|--------|-------------|
| **Activite** | + regleId, instructionsDetaillees, produitRecommandeId (FK avec @relation), quantiteRecommandee, priorite, isAutoGenerated, phaseElevage |
| **Vague** | + configElevageId? (FK ConfigElevage), relations PackActivation, NoteIngenieur, RegleExecution |
| **Bac** | volume change de `Float` (required) à `Float?` (nullable) |
| **Site** | + relations Pack, PackActivation (x2: seller + client), ConfigElevage, NoteIngenieur (x2), RegleActivite |
| **User** | + relations PackActivation, NoteIngenieur |
| **Produit** | + relations PackProduit, RegleActivite (produitRecommande), Activite (produitRecommande) |
| **benchmarks.ts** | Refactored : accepte ConfigElevage optionnel, fallback hardcodé |
| **alertes.ts** | Refactored : seuils lus depuis ConfigElevage, fallback hardcodé |
| **calculs.ts** | Enrichi : fonctions acceptent ConfigElevage optionnel, fallback hardcodé |

### 10.2 API Routes nouvelles

| Route | Méthode | Rôle requis | Description |
|-------|---------|-------------|-------------|
| `/api/config-elevage` | GET, POST | ADMIN, INGENIEUR | Lister/créer des profils de configuration |
| `/api/config-elevage/[id]` | GET, PUT, DELETE | ADMIN, INGENIEUR | CRUD profil individuel |
| `/api/config-elevage/defaut` | GET | Tous | Obtenir la config par défaut du site |
| `/api/config-elevage/[id]/dupliquer` | POST | ADMIN, INGENIEUR | Dupliquer un profil existant |
| `/api/packs` | GET, POST | ADMIN, INGENIEUR | Lister/créer des packs |
| `/api/packs/[id]` | GET, PUT, DELETE | ADMIN, INGENIEUR | CRUD pack individuel |
| `/api/packs/[id]/produits` | GET, POST, DELETE | ADMIN, INGENIEUR | Gérer les produits du pack |
| `/api/packs/[id]/activer` | POST | ADMIN | Activer un pack pour un client |
| `/api/pack-activations` | GET | ADMIN, INGENIEUR | Lister les activations (avec filtres) |
| `/api/pack-activations/[id]` | GET, PUT | ADMIN, INGENIEUR | Détail/modifier une activation |
| `/api/mon-pack` | GET | PISCICULTEUR | Voir mon pack actif (via PackActivation) |
| `/api/mes-notes` | GET | PISCICULTEUR | Notes de l'ingénieur (isPublic=true) |
| `/api/regles-activites` | GET, POST | ADMIN, INGENIEUR | Gérer les règles d'activités |
| `/api/regles-activites/[id]` | GET, PUT, DELETE | ADMIN, INGENIEUR | CRUD règle |
| `/api/activites/generer` | POST | ADMIN, INGENIEUR | Déclencher le moteur d'activités manuellement |
| `/api/activites/[id]/instructions` | GET | Tous | Instructions détaillées d'une activité |
| `/api/mes-observations` | POST | PISCICULTEUR | Client envoie une observation/question à l'ingénieur |
| `/api/mes-observations` | GET | PISCICULTEUR | Client voit ses observations et réponses |
| `/api/ingenieur/dashboard` | GET | INGENIEUR, ADMIN | Dashboard monitoring toutes les fermes |
| `/api/ingenieur/clients` | GET | INGENIEUR, ADMIN | Liste des clients avec métriques (paginée) |
| `/api/ingenieur/notes` | GET, POST | INGENIEUR, ADMIN | Notes ingénieur |
| `/api/ingenieur/notes/[id]` | GET, PUT | INGENIEUR, ADMIN | Détail note |

### 10.3 Pages UI nouvelles

| Page | Description | Rôle |
|------|-------------|------|
| `/settings/config-elevage` | Liste des profils de configuration élevage | ADMIN, INGENIEUR |
| `/settings/config-elevage/[id]` | Édition d'un profil (sections repliables) | ADMIN, INGENIEUR |
| `/settings/config-elevage/nouveau` | Création depuis template ou custom | ADMIN, INGENIEUR |
| `/packs` | Liste des packs (admin DKFarm) | ADMIN, INGENIEUR |
| `/packs/[id]` | Détail/édition d'un pack | ADMIN, INGENIEUR |
| `/packs/nouveau` | Création d'un pack | ADMIN |
| `/packs/[id]/activer` | Formulaire d'activation pour un client | ADMIN |
| `/activations` | Liste des activations (admin) | ADMIN, INGENIEUR |
| `/activations/[id]` | Détail d'une activation | ADMIN, INGENIEUR |
| `/mes-taches` (enrichi) | Tâches avec instructions détaillées | Tous |
| `/mes-notes` | Notes de l'ingénieur (côté client) | PISCICULTEUR |
| `/mes-observations` | Observations/questions du client vers l'ingénieur | PISCICULTEUR |
| `/ingenieur` | Dashboard ingénieur | INGENIEUR, ADMIN |
| `/ingenieur/[siteId]` | Vue détaillée d'un client | INGENIEUR, ADMIN |

---

## 11. Phases d'implémentation suggérées

### Phase A — ConfigElevage & Refactoring Benchmarks (Sprint 13)

1. Modèle ConfigElevage + migration Prisma
2. Validation Zod pour JSON fields (alimentTailleConfig, alimentTauxConfig)
3. API CRUD config-elevage + endpoint /defaut + /dupliquer
4. Unicité applicative de `isDefault` par site
5. Seed des profils pré-définis (Clarias Standard, Express, Premium)
6. Refactoring `benchmarks.ts` : lire depuis ConfigElevage avec fallback hardcodé
7. Refactoring `alertes.ts` : seuils qualité eau et mortalité depuis ConfigElevage avec fallback
8. Refactoring `calculs.ts` : fonctions acceptent config optionnel avec fallback
9. UI settings : page config-elevage (liste, édition en sections repliables)
10. Tests unitaires : validation JSON, fallback, calculs avec config

### Phase B — Packs & Provisioning (Sprint 14)

1. Créer le System User en seed
2. Modèles : Pack, PackProduit, PackActivation, StatutActivation
3. Relation Pack → ConfigElevage
4. Rendre `Bac.volume` nullable
5. API CRUD packs + activation avec $transaction atomique
6. Logique de copie : ConfigElevage, Produits vers site client
7. UI admin : gestion des packs
8. UI admin : activation d'un pack
9. Tests : provisioning atomique, rollback, validation contraintes

### Phase C — Moteur d'Activités Automatiques (Sprint 15)

1. Nouveaux TypeActivite : TRI, RECOMMANDATION_STOCK, MEDICATION
2. Modèles : RegleActivite, TypeDeclencheur, PhaseElevage, RegleExecution
3. Enrichissement Activite (instructions, priorité, auto-generated, produitRecommandeId avec @relation)
4. Moteur de règles : évaluation des conditions basée sur ConfigElevage
5. Déduplication via RegleExecution (lastTriggeredDate, onceOnly)
6. Guard : skip si nombreVivants = 0
7. Seed des règles pré-définies (catalogue complet)
8. CRON : Vercel Cron Jobs (voir §13.1) + idempotence
9. Event-driven : évaluation post-relevé pour SEUIL_*
10. Calcul automatique des quantités d'aliment (via alimentTauxConfig)

### Phase D — Instructions détaillées & UX guidée (Sprint 16)

1. Page "Mes tâches" enrichie avec instructions Markdown
2. Lien activité → relevé (complétion via relevé)
3. Recommandations produit (avec lien stock + détection taille aliment)
4. Projections : SGR requis, date de récolte estimée, budget aliment restant
5. Alertes graduées par benchmark (EXCELLENT → MAUVAIS)
6. Page `/mes-notes` pour les clients
7. Page `/mon-pack` pour les clients

### Phase E — Monitoring Ingénieur & Polish (Sprint 17)

1. Nouveau rôle INGENIEUR + permissions Phase 3
2. Dashboard ingénieur multi-sites paginé (avec seuils depuis ConfigElevage client)
3. Alertes automatiques vers ingénieur (seuils configurables)
4. Notes ingénieur (isPublic, isUrgent) + communication bidirectionnelle (isFromClient, observationTexte)
5. Endpoint client `/api/mes-notes` + `/api/mes-observations`
6. Vue consolidée des performances clients
7. Historique des interventions
8. Polish UI, tests de non-régression, vérification mobile-first

> **Note :** La Phase 3 comprend désormais **5 sprints** (13-17).

### Phase 4 — Intelligence Artificielle (Sprint 18+)

> Différée. Voir **Annexe B** pour le détail du périmètre IA reporté.

---

## 12. Rôles, Permissions et Sécurité

### 12.1 Nouveau rôle : INGENIEUR (F-10, EC-12.1)

Valeur à ajouter à l'enum `Role` existant :

```
enum Role {
    ADMIN
    GERANT
    PISCICULTEUR
    INGENIEUR           // Phase 3 — Technicien DKFarm
}
```

### 12.2 Nouvelles permissions Phase 3 (F-10, EC-12.1)

Valeurs à ajouter à l'enum `Permission` existant :

```
// Packs (4)
PACKS_VOIR
PACKS_GERER
PACKS_ACTIVER
ACTIVATIONS_VOIR

// ConfigElevage (3)
CONFIG_ELEVAGE_VOIR
CONFIG_ELEVAGE_GERER
CONFIG_ELEVAGE_DEFAUT

// Règles d'activités (2)
REGLES_VOIR
REGLES_GERER

// Observations client (1)
OBSERVATIONS_GERER

// Notes ingénieur (2)
NOTES_VOIR
NOTES_GERER

// Dashboard ingénieur (1)
INGENIEUR_DASHBOARD
```

### 12.3 Matrice rôle → permissions Phase 3

| Permission | ADMIN | INGENIEUR | GERANT | PISCICULTEUR |
|------------|-------|-----------|--------|--------------|
| PACKS_VOIR | X | X | | |
| PACKS_GERER | X | | | |
| PACKS_ACTIVER | X | | | |
| ACTIVATIONS_VOIR | X | X | | |
| CONFIG_ELEVAGE_VOIR | X | X | X | lecture seule |
| CONFIG_ELEVAGE_GERER | X | X | | |
| REGLES_VOIR | X | X | | |
| REGLES_GERER | X | X | | |
| OBSERVATIONS_GERER | X | X | | X |
| NOTES_VOIR (publiques) | X | X | X | X |
| NOTES_GERER | X | X | | |
| INGENIEUR_DASHBOARD | X | X | | |

### 12.4 Sécurité multi-tenancy

- Un client (PISCICULTEUR) ne voit QUE son site (`WHERE siteId = activeSiteId`).
- L'ingénieur DKFarm a accès en **lecture** aux sites clients via SiteMember.
- L'ingénieur ne peut PAS modifier les relevés, activités ou stock du client.
- Le System User (`id = "system"`) ne peut pas se connecter.

---

## 13. Considérations techniques

### 13.1 Exécution du moteur d'activités (F-11)

**Mécanisme CRON : Vercel Cron Jobs** (recommandé pour le déploiement Next.js)

```
// vercel.json
{
  "crons": [{
    "path": "/api/cron/activites",
    "schedule": "0 5 * * *"   // 05:00 UTC = 06:00 WAT chaque jour
  }]
}
```

**Route API CRON** : `GET /api/cron/activites`
- Protégée par un header `Authorization: Bearer CRON_SECRET` (variable d'environnement).
- Pour chaque vague EN_COURS avec `nombreVivants > 0` :
  1. Évaluer les règles RECURRENT + CALENDRIER.
  2. Vérifier la déduplication via `RegleExecution`.
  3. Générer les activités dans une transaction.
- **Idempotence** : même si le CRON s'exécute deux fois, `RegleExecution.lastTriggeredDate` empêche les doublons.

**Event-driven (complément)** :
- Après chaque création de relevé → évaluer les règles SEUIL_* dans un `afterCreate` hook ou middleware API.
- Utiliser la même logique de déduplication via `RegleExecution`.

**Alternative locale (dev)** : `pg_cron` pour PostgreSQL Docker, ou un simple `setInterval` dans un script Node.

### 13.2 Timezone (EC-11.1, EC-11.2, F-16)

- **Référence** : Cameroun WAT = UTC+1.
- Toutes les dates sont stockées en UTC dans PostgreSQL.
- Le calcul de "jour" utilise le fuseau WAT : `jourDepuisDebut = floor((now_wat - dateDebut_wat).totalDays)`.
- Le CRON s'exécute à 05:00 UTC (= 06:00 WAT) pour que les activités du jour soient prêtes au matin.

### 13.3 Performance

- Les règles sont évaluées par vague, pas globalement.
- Cache des indicateurs de vague (recalcul seulement après nouveau relevé).
- Le dashboard ingénieur est paginé (20 clients/page).

### 13.4 Concurrence (EC-9.1 à EC-9.4)

- **Activation simultanée** : la $transaction avec un lock optimiste sur le Pack empêche les doublons.
- **CRON et event-driven** : `RegleExecution.upsert()` avec `@@unique([regleId, vagueId])` gère la concurrence.
- **Stock** : les décrements de stock utilisent `prisma.produit.update({ where: { id, stockActuel: { gte: quantite } }, data: { stockActuel: { decrement: quantite } } })` (opération atomique).
- **ConfigElevage pendant évaluation** : la config est lue une fois en début d'évaluation et utilisée pour toutes les règles de la vague.

### 13.5 Cycle de vie des données (EC-10.1 à EC-10.4)

- **Archivage** : les activités TERMINEE de plus de 90 jours peuvent être archivées (marquées, pas supprimées). Hors scope Phase 3, à planifier Phase 4.
- **RegleActivite supprimée** : `onDelete: SetNull` sur `Activite.regleId` — les activités existantes conservent leurs données mais perdent le lien vers la règle.
- **Vague TERMINEE/ANNULEE** (EC-14.5) : met à jour `PackActivation.statut = TERMINEE`. Le moteur arrête de générer des activités.

### 13.6 Sécurité

- Un client ne voit QUE son site (multi-tenancy existant)
- L'ingénieur DKFarm a accès en lecture aux sites clients

### 13.7 Mobile-first

- Les instructions détaillées doivent être lisibles sur 360px
- Les activités quotidiennes sont la première chose visible au login
- Notifications push (PWA) pour les tâches critiques — architecture détaillée en Phase 4
- Mode hors-ligne : cache les activités du jour — architecture détaillée en Phase 4

### 13.8 Nombre format (EC-11.3)

Les nombres sont affichés avec le format français (locale `fr-FR`) : séparateur décimal = virgule, séparateur de milliers = espace. Exemple : `1 594,0g`, pas `1,594.0g`.

---

## 14. Références agronomiques

### Clarias gariepinus — Paramètres de référence

| Paramètre | Valeur optimale | Source |
|-----------|----------------|--------|
| Température eau | 26-32°C | FAO |
| pH | 6.5-7.5 | FAO |
| Oxygène dissous | > 4 mg/L | FAO |
| Ammoniac (NH3) | < 0.05 mg/L | TheFishSite |
| Densité d'élevage | 50-100 poissons/m³ (max 200 intensif) | WorldFish |
| FCR cible | 1.0-1.5 | Alltech Coppens |
| SGR cible | > 2%/jour | FAO |
| Taux de survie cible | > 85% | WorldFish |
| Durée cycle (5g → 1kg) | 6-8 mois | Production camerounaise |
| Protéines aliment fingerling | 38-45% | FAO |
| Protéines aliment finition | 24-28% | FAO |

### Sources principales

- FAO — On-farm feed management for North African catfish
- WorldFish — Production of African catfish in Cameroon
- Alltech Coppens — African Catfish Species Tool
- TheFishSite — Water Quality Monitoring for Catfish Ponds
- Famerlio — Catfish Feeding Chart & Starter Pack references

---

## 15. Changelog

### Changes in v2.1 (from v2.0)

| Change | Description |
|--------|-------------|
| Section 7 (IA) | Reporté intégralement en Phase 4. Le moteur de règles couvre 90%+ des besoins. |
| Section 4.5 | Retrait du champ `conseilIA` de l'enrichissement Activite |
| Section 8.3 | Ajout de `isFromClient` et `observationTexte` sur NoteIngenieur pour communication bidirectionnelle |
| Section 9.3 | Flux client : remplacement des conseils IA par communication avec l'ingénieur |
| Section 9.4 | Flux ingénieur : remplacement du déclenchement IA par consultation des observations client |
| Section 10.1 | Retrait de conseilIA et ConseilIA des modèles impactés |
| Section 10.2 | Remplacement des routes `/api/conseil-ia` par `/api/mes-observations` |
| Section 10.3 | Remplacement de la page `/conseil` par `/mes-observations` |
| Section 11 | Phase E (IA Sprint 17) supprimée ; Phase F renommée Phase E (Sprint 17) ; Phase 3 = 5 sprints (13-17) |
| Section 12.2 | Permissions CONSEIL_IA_* remplacées par OBSERVATIONS_GERER |
| Annexe B | Ajout du périmètre IA différé en Phase 4 |

### Changes from v1.1 to v2.0

### BLOCKER fixes

| ID | Finding | Fix applied |
|----|---------|-------------|
| F-01 | `Activite.recurrence` conflits avec `RegleActivite.intervalleJours` | Clarified: `recurrence` = manual activities, `intervalleJours` = auto engine. No conflict (§4.5) |
| F-01 | `Activite.userId` NOT NULL pour activités auto-générées | Introduced System User concept (`id = "system"`) (§3.3) |
| F-01 | `produitRecommande` String sans @relation | Changed to `produitRecommandeId` with proper `@relation` and `onDelete: SetNull` (§4.5, §4.3) |
| F-03 | userId for auto-generated activities on client site | System User is used as userId for all auto-generated activities (§3.3) |

### HIGH fixes

| ID | Finding | Fix applied |
|----|---------|-------------|
| F-02 | No TypeActivite for TRI, stock recommendations | Added `TRI`, `RECOMMANDATION_STOCK`, `MEDICATION` to TypeActivite enum (§4.4) |
| F-04 | Pack.siteId creates visibility issue for clients | Added `/api/mon-pack` endpoint + PackActivation as join table for client access (§3.7) |
| F-05 | `clientSiteId @unique` prevents multiple activations | Removed @unique, added @@index instead (§3.6, §3.8) |
| F-06 | `vagueId @unique` prevents vague replacement | Removed @unique (§3.6, §3.8) |
| F-07 | ConfigElevage ownership unclear | ConfigElevage linked via `Vague.configElevageId` (§6.2). COPY on activation (§6.3) |
| F-08 | ConfigElevage JSON blobs unvalidated | Added Zod validation schemas for both JSON fields (§6.6, §6.7) |

### MEDIUM-HIGH fixes

| ID | Finding | Fix applied |
|----|---------|-------------|
| F-09 | No client endpoint for engineer notes | Added `GET /api/mes-notes` (§8.4) |
| F-10 | No permissions for Phase 3 features | Added INGENIEUR role + 14 new Permission values (§12.1, §12.2) |
| F-11 | Activity engine execution hand-waved | Specified Vercel Cron Jobs + idempotency via RegleExecution model (§4.6, §13.1) |

### MEDIUM fixes

| ID | Finding | Fix applied |
|----|---------|-------------|
| F-12 | AI rate limiting — no tier field | Deferred to Phase 4 (Annexe B) |
| F-13 | ConseilIA missing @relation | Deferred to Phase 4 (Annexe B) |
| F-14 | Produit records must be COPIED to client site | Specified copy logic with fournisseurId = null (§3.4) |
| F-15 | RegleActivite.siteId — global vs per-site | Rules are per-site. Seed copies rules to DKFarm site. On activation, rules are NOT copied — the engine reads rules from the DKFarm site for all client vagues |
| F-22 | isDefault no uniqueness constraint | Applicative check before save (§6.5 note) |

### Edge case fixes

| ID | Edge case | Fix applied |
|----|-----------|-------------|
| EC-1.1 | nombreAlevins = 0 | Minimum 10 alevins (§2.4) |
| EC-1.3 | PackProduit quantite <= 0 | Validation quantite > 0 (§2.4) |
| EC-1.6 | Deleting Produit referenced by PackProduit | onDelete: Restrict (§2.5) |
| EC-2.3 | Partial failure during provisioning | Prisma $transaction required (§3.2) |
| EC-2.4 | Bac volume unknown at activation | Volume nullable, blocking activity if null (§3.5) |
| EC-2.5 | Code caps at 999/year | Changed format to ACT-YYYYMMDD-XXXX (§3.9) |
| EC-3.1 | CRON double-run duplicates | RegleExecution deduplication model (§4.6) |
| EC-3.2 | SEUIL_POIDS fires repeatedly | onceOnly flag on RegleActivite (§4.6) |
| EC-3.3 | Multiple conflicting rules | All generated, sorted by priority (§4.8) |
| EC-3.4 | Mortality rate base | Percentage on current living count (§4.10.4) |
| EC-3.5 | phaseMin > phaseMax | Validation rule in API (§4.3 note) |
| EC-3.7 | RECURRENT interval start | Anchored to Vague.dateDebut (§4.9) |
| EC-3.9 | Activities for 0-fish vague | Skip generation when nombreVivants = 0 (§4.7) |
| EC-3.12 | Rules with null conditions | Null conditions = always match for the trigger type (§4.3 note) |
| EC-4.1 | nombreVivants not tracked | Derived from initial - deaths - sales (§5.1) |
| EC-4.3 | Feeding rate is range | Use average of range (§5.2) |
| EC-4.4 | Phase boundary at exact weight | Upper bound exclusive (§5.3) |
| EC-4.5 | Per-bac feeding after tri | Feeding calculated per-bac (§5.4) |
| EC-5.1 | No ConfigElevage fallback | Hardcoded constants as last resort (§6.4) |
| EC-5.2 | Multiple isDefault per site | Applicative uniqueness check (§6.5) |
| EC-5.3 | JSON validation | Zod schemas specified (§6.6, §6.7) |
| EC-5.4 | Config modified during active vague | Warning + immutable by default (§6.8) |
| EC-5.6 | Benchmark inversions | Documented invariants (§6.5) |
| EC-5.7 | Phase seuils not monotonic | Documented invariant + validation (§6.5) |
| EC-5.8 | Copy vs link ambiguity | Explicit COPY decision (§6.3) |
| EC-6.1 | Claude API unavailable | Deferred to Phase 4 (Annexe B) |
| EC-6.2 | Rate limit reset timing | Deferred to Phase 4 (Annexe B) |
| EC-6.3 | AI harmful advice | Deferred to Phase 4 (Annexe B) |
| EC-6.4 | ConseilIA missing @relation | Deferred to Phase 4 (Annexe B) |
| EC-6.6 | Large context payloads | Deferred to Phase 4 (Annexe B) |
| EC-7.1 | NoteIngenieur visibility | isPublic flag added (§8.3) |
| EC-7.3 | Engineer write access | INGENIEUR role = read-only + notes write (§8.5) |
| EC-7.5 | Dashboard no pagination | Pagination 20/page (§8.2) |
| EC-7.6 | Engineer AI exhausts client quota | Deferred to Phase 4 (Annexe B) |
| EC-9.1-9.4 | Concurrency issues | Atomic operations, upsert, optimistic locking (§13.4) |
| EC-11.1-11.2 | Timezone ambiguity | WAT (UTC+1) specified everywhere (§13.2) |
| EC-11.3 | Number formatting | French locale specified (§13.8) |
| EC-12.1 | No Phase 3 permissions | 14 new permissions defined (§12.2) |
| EC-12.2 | Client can modify config | PISCICULTEUR = read-only on ConfigElevage (§6.17, §12.3) |
| EC-12.3 | AI anonymization | Only vague codes sent, no PII (§7.5) |
| EC-14.4 | Unit conversion | Conversion spec for KG/SACS to grams (§5.5) |
| EC-14.5 | Vague TERMINEE impact | PackActivation.statut = TERMINEE (§13.5) |

### Items explicitly deferred to Phase 4

| ID | Item | Reason |
|----|------|--------|
| F-17 | SMS/WhatsApp push notifications | Multi-week integration, needs separate architecture |
| F-18 | Pack Custom dynamic calculation | UI/UX design needed |
| F-20 | Metrics tracking implementation | Feedback system needed |
| F-21 | Benchmarks par phase | Extension v2 of ConfigElevage |
| F-23 | Sprint time estimates | Project planning, not requirements |
| EC-14.1 | Offline/PWA spec | Separate architecture document |
| EC-14.2 | SMS/WhatsApp integration | Same as F-17 |
| EC-14.3 | Backup/restore for client sites | Infrastructure concern |
| EC-10.1-10.2 | Data archiving | Performance optimization, plan in Phase 4 |
| **IA** | Intelligence Artificielle complète (ConseilIA, Claude API, rate limiting, rapport hebdo) | Le moteur de règles couvre 90%+ des besoins. IA = enrichissement Phase 4 (Annexe B) |

---

## Annexe B — Phase 4 : Intelligence Artificielle (differee)

### Pourquoi le report ?

Le moteur de regles (section 4) combine aux instructions detaillees en Markdown et a la communication bidirectionnelle client-ingenieur couvre **plus de 90%** des besoins de guidage des pisciculteurs debutants. L'IA (Claude API) est un **enrichissement**, pas une dependance. Reporter l'IA en Phase 4 permet de :

1. **Livrer la Phase 3 plus rapidement** (5 sprints au lieu de 6)
2. **Valider le moteur de regles** avec de vrais utilisateurs avant d'ajouter une couche IA
3. **Collecter des donnees reelles** qui serviront a affiner les prompts IA
4. **Reduire les couts** (pas d'appels API Claude pendant la phase de lancement)

### Perimetre differe

| Composant | Description |
|-----------|-------------|
| **Modele ConseilIA** | Stockage des conseils generes (vagueId, typeConseil, contexte JSON, reponse Markdown) |
| **Integration Claude API** | Appels Anthropic avec contexte enrichi (releves, indicateurs, ConfigElevage, anonymise) |
| **Rate limiting** | 10 appels/jour/site, reset a 00:00 WAT |
| **Diagnostic mortalite** | Analyse automatique des causes de mortalite a partir des releves |
| **Optimisation alimentation** | Recommandations basees sur l'historique FCR/SGR |
| **Prevision de recolte** | Projection de la courbe de croissance et date estimee |
| **Conseil sur anomalie** | Reponse IA a une observation texte libre du client |
| **Rapport hebdomadaire** | Synthese automatique des performances de la semaine |
| **Interface chat-like** | Page `/conseil` pour questions libres |
| **Champ conseilIA sur Activite** | Conseil IA attache a une activite specifique |
| **Permissions CONSEIL_IA_VOIR / CONSEIL_IA_DEMANDER** | Controle d'acces aux fonctions IA |

### Prerequis Phase 4

- Phase 3 deployee et validee avec des utilisateurs reels
- Donnees d'elevage collectees (minimum 3 mois sur 10+ sites)
- Cle API Anthropic configuree en production
- Budget API valide (estimation : ~0.5 FCFA/appel avec Claude Haiku)
