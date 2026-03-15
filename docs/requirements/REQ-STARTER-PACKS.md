# REQ — Starter Packs & Automated Guided Farming

**Version:** 1.1
**Date:** 2026-03-15
**Auteur:** @architect + @project-manager
**Statut:** DRAFT

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

---

## 3. Onboarding Automatisé

### 3.1 Flux de provisioning

```
Super Admin crée un Pack (dans FarmFlow)
    → Définit : type de pack, quantité alevins, produits inclus
    → Génère un lien d'activation / code

Client active son pack
    → Crée son compte (ou reçoit des identifiants)
    → Un Site est auto-créé avec :
        - 1 Vague pré-configurée (nombreInitial = nb alevins du pack, poidsMoyenInitial = ~7g)
        - 1 Bac par défaut (volume renseigné par le client)
        - Produits pré-créés dans le stock (aliment + kit santé avec quantités du pack)
        - Activités de la Semaine 1 auto-générées
    → Le client est SiteMember avec rôle PISCICULTEUR
    → DKFarm (super admin) est ajouté comme ADMIN du site pour monitoring
```

### 3.2 Modèle de données — Pack

```
Nouveau modèle : Pack
    id          String    @id @default(cuid())
    code        String    @unique   // "PACK-YYYY-NNN"
    nom         String              // "Pack Starter 300"
    description String?

    nombreAlevins       Int
    poidsMoyenInitial   Float     @default(7.0)   // grammes

    prixTotal           Float
    isActive            Boolean   @default(true)

    createdAt   DateTime  @default(now())
    updatedAt   DateTime  @updatedAt
    siteId      String              // Site DKFarm (vendeur)
    site        Site      @relation(fields: [siteId], references: [id])

Nouveau modèle : PackProduit (contenu du pack)
    id          String    @id @default(cuid())
    packId      String
    pack        Pack      @relation(fields: [packId], references: [id], onDelete: Cascade)
    produitId   String
    produit     Produit   @relation(fields: [produitId], references: [id])
    quantite    Float              // quantité dans le pack

    @@unique([packId, produitId])

Nouveau modèle : PackActivation (vente/livraison d'un pack)
    id              String    @id @default(cuid())
    code            String    @unique   // "ACT-YYYY-NNN"
    packId          String
    pack            Pack      @relation(fields: [packId], references: [id])

    clientUserId    String
    clientUser      User      @relation(fields: [clientUserId], references: [id])
    clientSiteId    String    @unique
    clientSite      Site      @relation(fields: [clientSiteId], references: [id])
    vagueId         String    @unique
    vague           Vague     @relation(fields: [vagueId], references: [id])

    dateActivation  DateTime  @default(now())
    dateExpiration  DateTime?           // fin de l'accès app
    statut          StatutActivation    // ACTIVE, EXPIREE, SUSPENDUE

    notes           String?
    siteId          String              // Site DKFarm (vendeur) — R8

    createdAt       DateTime  @default(now())
    updatedAt       DateTime  @updatedAt

Nouvel enum : StatutActivation
    ACTIVE
    EXPIREE
    SUSPENDUE
```

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
| **RECURRENT** | Intervalle fixe | "Tous les jours : Contrôle mortalité + alimentation" |
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

    typeActivite    TypeActivite        // BIOMETRIE, ALIMENTATION, etc.
    typeDeclencheur TypeDeclencheur     // CALENDRIER, SEUIL_POIDS, etc.

    // Conditions de déclenchement
    jourDepuisDebut     Int?            // pour CALENDRIER
    intervalleJours     Int?            // pour RECURRENT
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
    categorieProduit    CategorieProduit?  // filtre produit à recommander

    priorite            Int     @default(5)   // 1-10, 1 = plus urgent
    isActive            Boolean @default(true)
    ordre               Int     @default(0)   // ordre d'affichage

    // Phase de croissance applicable
    phaseMin            PhaseElevage?    // phase minimum pour appliquer la règle
    phaseMax            PhaseElevage?    // phase maximum

    siteId              String           // R8
    createdAt           DateTime @default(now())
    updatedAt           DateTime @updatedAt

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

### 4.4 Activités générées — Modèle enrichi

Le modèle `Activite` existant sera enrichi :

```
Champs ajoutés à Activite :
    regleId             String?         // FK RegleActivite (si auto-généré)
    regle               RegleActivite?

    instructionsDetaillees  String?     // Markdown — instructions pas à pas
    conseilIA               String?     // Conseil généré par IA

    produitRecommande   String?         // FK Produit (aliment ou intrant recommandé)
    quantiteRecommandee Float?          // quantité suggérée

    priorite            Int?    @default(5)
    isAutoGenerated     Boolean @default(false)

    phaseElevage        PhaseElevage?   // phase au moment de la création
```

### 4.5 Catalogue de règles pré-définies (Seed)

#### 4.5.1 Activités quotidiennes récurrentes

| Règle | Type | Déclencheur | Phase | Instructions |
|-------|------|-------------|-------|--------------|
| Alimentation matin | ALIMENTATION | RECURRENT (1j) | Toutes | "Distribuer {quantité_calculée}g d'aliment {taille}mm. Répartir uniformément. Observer la prise alimentaire pendant 15 minutes. Si les poissons ne finissent pas en 30 min, réduire la dose de 10%." |
| Alimentation soir | ALIMENTATION | RECURRENT (1j) | Toutes | "2ème distribution de {quantité_calculée}g. Si la température est < 26°C, réduire de 20%." |
| Contrôle mortalité | BIOMETRIE | RECURRENT (1j) | Toutes | "Retirer les poissons morts. Compter et noter le nombre. Observer : lésions rouges ? Champignons ? Comportement anormal des vivants ? Si > 3 morts, créer un relevé MORTALITE." |
| Contrôle eau (visuel) | QUALITE_EAU | RECURRENT (1j) | Toutes | "Observer la couleur de l'eau (vert clair = OK, vert foncé/marron = alerte). Vérifier l'odeur. Mesurer la température. Si > 32°C, ombrager le bac." |

#### 4.5.2 Activités hebdomadaires / bi-mensuelles

| Règle | Type | Déclencheur | Phase | Instructions |
|-------|------|-------------|-------|--------------|
| Biométrie | BIOMETRIE | RECURRENT (7j) | ACCLIMATATION → JUVENILE | "Attraper 10 à 20 poissons avec une épuisette. Peser chacun individuellement. Calculer la moyenne. Remettre délicatement dans le bac. ⚠️ Manipuler avec les mains mouillées pour ne pas abîmer le mucus." |
| Biométrie | BIOMETRIE | RECURRENT (14j) | GROSSISSEMENT → PRE_RECOLTE | Idem avec 10 poissons |
| Qualité eau complète | QUALITE_EAU | RECURRENT (7j) | Toutes | "Mesurer pH, température, et si possible ammoniac. pH idéal : 6.5-7.5. Température idéale : 26-32°C. Ammoniac doit être < 0.05 mg/L." |
| Changement eau | NETTOYAGE | RECURRENT (3j) | Toutes | "Renouveler 30-50% de l'eau du bac. Siphonner les déchets au fond. Laisser reposer 30 min avant de nourrir." |

#### 4.5.3 Activités déclenchées par seuil de poids

| Règle | Seuil | Action | Instructions |
|-------|-------|--------|--------------|
| Passage aliment 2mm | poids > 30g | ALIMENTATION | "Les poissons ont atteint {poids_moyen}g. Il est temps de passer à l'aliment 2mm. Stock actuel de 2mm : {stock}. Si insuffisant, commander chez DKFarm. Transition : mélanger 50/50 ancien/nouveau pendant 3 jours." |
| Passage aliment 3mm | poids > 50-80g | ALIMENTATION | "Passer à l'aliment 3mm. Les poissons de {poids_moyen}g ont besoin de granulés plus gros. Taux d'alimentation : 3-5% du poids corporel." |
| Passage aliment 4-6mm | poids > 150g | ALIMENTATION | "Passer à l'aliment 4-6mm (grossissement). Réduire la fréquence à 2x/jour. Taux : 2-3% du poids corporel." |
| Passage aliment 6-9mm | poids > 350g | ALIMENTATION | "Passer à l'aliment finition 6-9mm. Fréquence : 1-2x/jour. Taux : 1.5-2% du poids corporel." |
| Tri obligatoire | poids 15-150g | AUTRE | "Les poissons font en moyenne {poids_moyen}g. Un tri est nécessaire pour réduire le cannibalisme. Séparer les gros (> 120% de la moyenne) des petits (< 80%). Préparer un 2ème bac si disponible." |

#### 4.5.4 Activités déclenchées par anomalies

| Règle | Condition | Action | Instructions |
|-------|-----------|--------|--------------|
| Mortalité élevée | > 1%/jour | TRAITEMENT | "⚠️ Mortalité anormale détectée ({taux}%). Actions immédiates : 1) Vérifier la qualité de l'eau (pH, T°, ammoniac). 2) Observer les poissons : lésions ? comportement ? 3) Si lésions rouges → Traitement Oxytetracycline (voir instructions). 4) Si eau trouble → Changement 50% immédiat. 5) Réduire l'alimentation de 50%." |
| pH hors norme | pH < 6.0 ou > 8.5 | QUALITE_EAU | "⚠️ pH mesuré à {valeur}. Plage idéale : 6.5-7.5. Actions : 1) Changement d'eau 50%. 2) Si pH bas : ajouter du bicarbonate de soude (1g/100L). 3) Si pH haut : réduire l'alimentation, augmenter aération." |
| Température critique | T° < 22 ou > 35 | QUALITE_EAU | "⚠️ Température à {valeur}°C. Idéal : 26-32°C. Si trop chaud : ombrager, aérer. Si trop froid : réduire alimentation de 30%." |
| FCR élevé | FCR > 2.0 | ALIMENTATION | "⚠️ Le FCR est de {valeur} (idéal < 1.5). Cela signifie que les poissons convertissent mal l'aliment. Vérifier : 1) L'aliment n'est-il pas périmé ? 2) La quantité distribuée est-elle correcte ? 3) Y a-t-il des restes après 30 min ? Réduire la dose de 15%." |
| Stock aliment bas | stockActuel < seuilAlerte | AUTRE | "⚠️ Stock de {produit} bas : {stock_actuel} restant (seuil : {seuil}). Au rythme actuel, il vous reste environ {jours_restants} jours. Recommandation : commander {quantite_recommandee} auprès de DKFarm." |

#### 4.5.5 Jalons de production

| Règle | Jour | Action | Instructions |
|-------|------|--------|--------------|
| Bilan semaine 2 | J14 | BIOMETRIE | "Première évaluation majeure. Faire un comptage précis des survivants + biométrie. Le taux de survie à J14 doit être > 90%. Si < 80%, contacter un technicien DKFarm." |
| Premier tri | J21-28 | AUTRE | "Premier tri critique. Le cannibalisme est la 1ère cause de mortalité chez Clarias. Trier les poissons en 2-3 catégories de taille. Les plus gros et les plus petits doivent être séparés." |
| Évaluation FCR | J70 | BIOMETRIE | "Évaluation à mi-parcours. Biométrie complète + calcul FCR. FCR idéal à ce stade : < 1.5. Comparer les performances avec les références FarmFlow." |
| Évaluation récolte partielle | J112 | COMPTAGE | "Certains poissons peuvent avoir atteint 400-500g. Évaluer si une récolte partielle est possible pour les plus gros spécimens. Cela réduit la densité et favorise la croissance des restants." |
| Pré-récolte | J140-168 | RECOLTE | "Les poissons devraient être entre 700g-1kg. Préparer la récolte : 1) Identifier les acheteurs. 2) Arrêter l'alimentation 48h avant. 3) Créer une vente dans FarmFlow." |

---

## 5. Calcul Automatique des Quantités d'Aliment

### 5.1 Formule

```
Quantité quotidienne (g) = Nombre de vivants × Poids moyen (g) × Taux d'alimentation (%)
```

### 5.2 Table de taux d'alimentation

| Phase | Poids moyen | Taux (% poids corporel/jour) | Fréquence |
|-------|-------------|------------------------------|-----------|
| ACCLIMATATION | 5-15g | 8-10% | 3-4x/jour |
| CROISSANCE_DEBUT | 15-50g | 5-6% | 3x/jour |
| JUVENILE | 50-150g | 3-5% | 2-3x/jour |
| GROSSISSEMENT | 150-350g | 2-3% | 2x/jour |
| FINITION | 350-700g | 1.5-2% | 1-2x/jour |
| PRE_RECOLTE | 700g+ | 1-1.5% | 1x/jour |

### 5.3 Taille d'aliment recommandée

| Poids moyen | Taille granulé | Catégorie stock |
|-------------|----------------|-----------------|
| 5-15g | 1.2mm | Aliment démarrage |
| 15-30g | 1.5-2mm | Aliment croissance |
| 30-80g | 2-3mm | Aliment croissance |
| 80-150g | 3-4mm | Aliment grossissement |
| 150-350g | 4-6mm | Aliment grossissement |
| 350g+ | 6-9mm | Aliment finition |

### 5.4 Exemple concret (Pack Starter 300 alevins)

```
Jour 1 :  300 poissons × 7g × 8% = 168g/jour (en 3 distributions de 56g)
Jour 14 : 285 poissons × 12g × 8% = 273g/jour
Jour 30 : 275 poissons × 25g × 6% = 412g/jour → Passage à 2mm
Jour 45 : 270 poissons × 40g × 5% = 540g/jour
Jour 60 : 265 poissons × 65g × 4% = 689g/jour → Passage à 3mm
Jour 90 : 260 poissons × 120g × 3% = 936g/jour → Passage à 4mm
Jour 120: 255 poissons × 250g × 2.5% = 1,594g/jour
Jour 150: 250 poissons × 450g × 2% = 2,250g/jour → Passage à 6mm
Jour 180: 245 poissons × 700g × 1.5% = 2,572g/jour
Jour 210: 240 poissons × 1,000g × 1.2% = 2,880g/jour → RÉCOLTE
```

---

## 6. Paramètres Configurables (ConfigElevage)

### 6.1 Principe

Toutes les valeurs qui pilotent le moteur d'activités, les calculs d'alimentation, les benchmarks et les alertes doivent être **configurables par site**. Un super admin DKFarm définit un **profil de configuration par défaut** (basé sur les références FAO pour Clarias gariepinus). Chaque site peut ensuite personnaliser ses paramètres.

Ceci permet :
- D'adapter les seuils à l'espèce élevée (Clarias vs Tilapia vs autre)
- De varier l'objectif de production (400g, 500g, 800g, 1kg selon le marché)
- D'ajuster les recommandations au contexte local (climat, aliments disponibles)
- De détecter les anomalies **au plus tôt** avec des benchmarks adaptés

### 6.2 Modèle de données

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
    seuilAcclimatation      Float   @default(15)    // 0 → 15g
    seuilCroissanceDebut    Float   @default(50)    // 15 → 50g
    seuilJuvenile           Float   @default(150)   // 50 → 150g
    seuilGrossissement      Float   @default(350)   // 150 → 350g
    seuilFinition           Float   @default(700)   // 350 → 700g
    // Au-delà de seuilFinition → PRE_RECOLTE

    // ── Alimentation : taille de granulé par poids ──
    // Format JSON: [{poidsMin, poidsMax, tailleGranule, description}]
    alimentTailleConfig     Json        // voir §6.3

    // ── Alimentation : taux par phase (%BW/jour) ────
    // Format JSON: [{phase, tauxMin, tauxMax, frequence}]
    alimentTauxConfig       Json        // voir §6.4

    // ── Benchmarks : seuils de performance ──────────
    // FCR
    fcrExcellentMax         Float   @default(1.5)
    fcrBonMax               Float   @default(1.8)
    fcrAcceptableMax        Float   @default(2.2)
    // Au-delà → MAUVAIS

    // SGR (%/jour)
    sgrExcellentMin         Float   @default(2.0)
    sgrBonMin               Float   @default(1.5)
    sgrAcceptableMin        Float   @default(1.0)
    // En-dessous → MAUVAIS

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

    createdAt           DateTime @default(now())
    updatedAt           DateTime @updatedAt
```

### 6.3 Configuration taille d'aliment (`alimentTailleConfig`)

Format JSON stocké dans le champ :

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

**Pourquoi configurable** : Les aliments disponibles au Cameroun diffèrent de ceux au Nigeria ou en RDC. Le taux de protéines et la taille des granulés varient selon le fournisseur. Un éleveur utilisant un aliment artisanal pourra ajuster ces seuils.

### 6.4 Configuration taux d'alimentation (`alimentTauxConfig`)

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

### 6.5 Impact sur le code existant — Refactoring benchmarks.ts

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

### 6.6 Impact sur alertes.ts — Seuils configurables

Seuils actuellement hardcodés dans `src/lib/alertes.ts` :

| Seuil actuel (hardcodé) | Champ ConfigElevage | Valeur actuelle |
|--------------------------|---------------------|-----------------|
| pH range `[6.5, 8.5]` | `phMin` / `phMax` | 6.5 / 8.5 |
| Température range `[25, 32]` | `temperatureOptimalMin` / `temperatureOptimalMax` | 25* / 32 |
| Mortalité seuil par défaut = 5 | `mortaliteQuotidienneAlerte` | 1% (plus sensible) |
| Biométrie rappel = 7 jours | `biometrieIntervalleDebut` | 7 |

*Note : la valeur 25°C actuelle dans alertes.ts est en dessous de l'optimal (26°C). ConfigElevage distingue `temperatureMin` (létal à 22°C) de `temperatureOptimalMin` (stress à 26°C) pour des alertes graduées.

### 6.7 Impact sur calculs.ts — Quantités d'aliment dynamiques

La formule de calcul d'aliment utilise actuellement des tables fixes. Avec ConfigElevage :

```typescript
// AVANT (hardcodé)
function getTauxAlimentation(poidsMoyen: number): number {
  if (poidsMoyen < 15) return 0.08; // 8%
  if (poidsMoyen < 50) return 0.05; // 5%
  // ...
}

// APRÈS (configurable)
function getTauxAlimentation(poidsMoyen: number, config: ConfigElevage): number {
  const phase = detecterPhase(poidsMoyen, config);
  const tauxConfig = config.alimentTauxConfig.find(t => t.phase === phase);
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

function getTailleAliment(poidsMoyen: number, config: ConfigElevage): string {
  const match = config.alimentTailleConfig.find(
    a => poidsMoyen >= a.poidsMin && poidsMoyen < a.poidsMax
  );
  return match?.tailleGranule ?? "6-9mm";
}
```

### 6.8 Benchmarks configurables — Détection précoce

Les benchmarks configurables permettent une **détection précoce des problèmes** :

#### 6.8.1 Alertes graduées par benchmark

| Niveau | Couleur | Action automatique |
|--------|---------|-------------------|
| **EXCELLENT** | Vert | Aucune — tout va bien |
| **BON** | Bleu/Vert | Aucune — performance normale |
| **ACCEPTABLE** | Orange | Notification d'information — "Attention, votre FCR est de 1.9" |
| **MAUVAIS** | Rouge | Activité corrective auto-générée + notification urgente + alerte ingénieur |

#### 6.8.2 Benchmarks par phase de croissance

Les seuils de benchmark devraient idéalement varier par phase. Le FCR attendu n'est pas le même à 20g (faible) qu'à 500g (élevé naturellement). Extension future possible :

```json
// benchmarksParPhase dans ConfigElevage (extension v2)
{
  "ACCLIMATATION": { "fcrMax": 1.2, "sgrMin": 3.0, "mortaliteMax": 5 },
  "CROISSANCE_DEBUT": { "fcrMax": 1.4, "sgrMin": 2.5, "mortaliteMax": 3 },
  "JUVENILE": { "fcrMax": 1.6, "sgrMin": 2.0, "mortaliteMax": 2 },
  "GROSSISSEMENT": { "fcrMax": 1.8, "sgrMin": 1.5, "mortaliteMax": 1 },
  "FINITION": { "fcrMax": 2.0, "sgrMin": 1.0, "mortaliteMax": 1 },
  "PRE_RECOLTE": { "fcrMax": 2.2, "sgrMin": 0.8, "mortaliteMax": 0.5 }
}
```

#### 6.8.3 Projections et prévisions basées sur config

Avec `poidsObjectif` et `dureeEstimeeCycle`, l'app peut :
- Calculer le **SGR requis** pour atteindre l'objectif : `SGR_requis = (ln(poidsObjectif) - ln(poidsMoyenActuel)) / joursRestants × 100`
- Comparer le SGR actuel au SGR requis → alerte si en retard
- Estimer la **date de récolte** : projeter la courbe de croissance
- Calculer l'**aliment total restant** nécessaire pour finir le cycle
- Estimer le **revenu attendu** : `nombreVivants × poidsObjectif × prixVenteKg`

### 6.9 Profils pré-définis (Seed)

| Profil | Objectif | Durée | Contexte |
|--------|----------|-------|----------|
| **Clarias Standard Cameroun** | 800g | 180 jours | Pack DKFarm, aliments commerciaux |
| **Clarias Express** | 500g | 120 jours | Cycle court, densité réduite |
| **Clarias Premium** | 1200g | 240 jours | Gros spécimens, marché premium |
| **Tilapia Standard** | 400g | 180 jours | Espèce alternative (si expansion) |

### 6.10 UI — Page de configuration

```
/settings/config-elevage          → Liste des profils du site
/settings/config-elevage/[id]     → Édition d'un profil
/settings/config-elevage/nouveau  → Création (depuis template ou custom)
```

La page d'édition est organisée en sections repliables :
1. **Objectif de production** — poids cible, durée, survie cible
2. **Phases de croissance** — seuils de poids pour chaque phase
3. **Alimentation** — tailles de granulé, taux par phase
4. **Benchmarks** — FCR, SGR, survie, densité, mortalité (avec prévisualisation couleur)
5. **Qualité de l'eau** — seuils optimal/alerte/létal pour chaque paramètre
6. **Tri et biométrie** — intervalles, poids min/max pour tri
7. **Densité et gestion** — densité max, changement d'eau
8. **Récolte** — poids min récolte partielle, jeûne pré-récolte

### 6.11 Relation avec les autres composants

```
ConfigElevage ──→ Moteur d'activités (§4)
    │               ├── Calcul quantité aliment (alimentTauxConfig)
    │               ├── Détection changement de phase (seuilXxx)
    │               ├── Déclenchement seuils (fcrAlerteMax, etc.)
    │               └── Fréquences récurrentes (biometrieIntervalle, etc.)
    │
    ├──────────→ Benchmarks (§6.5)
    │               ├── evaluerBenchmark() lit depuis config au lieu de constantes
    │               └── Coloration des indicateurs dans le dashboard
    │
    ├──────────→ Alertes (§6.6)
    │               ├── Seuils qualité eau configurables
    │               └── Seuils mortalité configurables
    │
    ├──────────→ Projections (§6.8.3)
    │               ├── SGR requis vs actuel
    │               ├── Date de récolte estimée
    │               └── Budget aliment restant
    │
    └──────────→ Conseil IA (§7)
                    └── ConfigElevage incluse dans le contexte prompt
```

### 6.12 API Routes

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/config-elevage` | GET, POST | Lister/créer des profils de config |
| `/api/config-elevage/[id]` | GET, PUT, DELETE | CRUD individuel |
| `/api/config-elevage/defaut` | GET | Obtenir la config par défaut du site |
| `/api/config-elevage/[id]/dupliquer` | POST | Dupliquer un profil existant |

### 6.13 Relation Pack ↔ ConfigElevage

Chaque Pack référence un profil ConfigElevage :

```
Champ ajouté à Pack :
    configElevageId     String
    configElevage       ConfigElevage @relation(fields: [configElevageId], references: [id])
```

Lors de l'activation d'un pack, la ConfigElevage est copiée (ou liée) au site du client. Cela garantit que le moteur d'activités utilise les bons paramètres pour ce client.

---

## 7. Intelligence Artificielle — Conseiller Virtuel

### 7.1 Objectif

Intégrer un modèle d'IA (Claude API) pour fournir des **conseils personnalisés** basés sur les données de la ferme.

### 7.2 Cas d'usage de l'IA

| Cas | Entrée | Sortie |
|-----|--------|--------|
| **Diagnostic mortalité** | Relevés récents (mortalité, qualité eau, alimentation) | "La mortalité semble liée à un pic d'ammoniac (0.3mg/L mesuré hier). Recommandation : changement d'eau 50% immédiat + réduire alimentation." |
| **Optimisation alimentation** | Historique biométrie + alimentation + FCR | "Votre FCR est de 1.8 avec l'aliment X. Un passage à l'aliment Y (32% protéines) pourrait améliorer le FCR de 15% d'après les données similaires." |
| **Prévision de récolte** | Courbe de croissance + nombre vivants | "À ce rythme de croissance (SGR 1.8%), vos poissons atteindront 800g vers le jour 175 (environ le 15 août). Biomasse estimée : 196kg." |
| **Conseil sur anomalie** | Observation utilisateur (texte libre) | L'utilisateur décrit un symptôme, l'IA identifie la cause probable et recommande une action. |
| **Rapport hebdomadaire** | Tous les relevés de la semaine | Synthèse automatique : performances, alertes, recommandations pour la semaine suivante. |

### 7.3 Architecture technique

```
┌─────────────────────────────────────────────────┐
│                  FarmFlow App                     │
│                                                   │
│  ┌──────────┐    ┌──────────────┐                │
│  │ Activité │───→│ Moteur de    │                │
│  │ Engine   │    │ Règles       │                │
│  └──────────┘    └──────┬───────┘                │
│                         │                         │
│  ┌──────────┐    ┌──────▼───────┐    ┌─────────┐│
│  │ Relevés  │───→│ Analyseur    │───→│ Conseil  ││
│  │ (données)│    │ de contexte  │    │ IA       ││
│  └──────────┘    └──────────────┘    └────┬────┘│
│                                           │      │
│                                    ┌──────▼────┐ │
│                                    │ Claude API │ │
│                                    │ (Anthropic)│ │
│                                    └───────────┘ │
└─────────────────────────────────────────────────┘
```

### 7.4 Modèle de données — Conseils IA

```
Nouveau modèle : ConseilIA
    id              String    @id @default(cuid())
    vagueId         String
    vague           Vague     @relation(fields: [vagueId], references: [id])

    typeConseil     TypeConseil
    contexte        Json              // données envoyées au modèle
    conseil         String            // réponse du modèle (Markdown)

    isRead          Boolean   @default(false)
    isApplied       Boolean   @default(false)

    activiteId      String?           // activité générée suite au conseil

    userId          String
    siteId          String            // R8
    createdAt       DateTime  @default(now())

Nouvel enum : TypeConseil
    DIAGNOSTIC
    OPTIMISATION
    PREVISION
    ANOMALIE
    RAPPORT_HEBDO
```

### 7.5 Prompt Engineering — Contexte fourni au modèle

Pour chaque appel IA, fournir :

```json
{
  "vague": {
    "code": "V-2026-001",
    "joursEcoules": 45,
    "nombreInitial": 300,
    "nombreVivants": 275,
    "poidsMoyenActuel": 42,
    "phaseElevage": "CROISSANCE_DEBUT"
  },
  "derniers_releves": [
    // 7 derniers jours de relevés (biométrie, mortalité, eau, alimentation)
  ],
  "indicateurs": {
    "tauxSurvie": 91.6,
    "fcr": 1.4,
    "sgr": 2.1,
    "biomasse": 11.55,
    "densite": 5.7
  },
  "stock": {
    "aliment_actuel": { "nom": "Granulé 2mm", "quantite": 8500, "unite": "g" },
    "consommation_quotidienne_estimee": 540
  },
  "historique_alertes": [
    // alertes récentes
  ],
  "question_utilisateur": "..." // si applicable
}
```

### 7.6 Limites et garde-fous

- **Pas de prescription médicale** : l'IA recommande de consulter un vétérinaire/technicien pour les cas graves
- **Rate limiting** : max 10 appels IA/jour par site (pack standard)
- **Validation humaine** : les conseils sont des suggestions, pas des actions automatiques
- **Fallback** : si l'API IA est indisponible, les règles statiques du moteur d'activités prennent le relais

---

## 8. Monitoring Ingénieur (Remote Support)

### 8.1 Concept

Un ingénieur/technicien DKFarm peut :
1. Accéder au site du client (en tant qu'ADMIN via le multi-tenancy existant)
2. Voir un **tableau de bord ingénieur** avec les métriques clés de tous les clients
3. Identifier les fermes en difficulté (alertes, mortalité élevée, FCR mauvais)
4. Laisser des notes/conseils directement dans l'app

### 8.2 Dashboard Ingénieur

```
┌────────────────────────────────────────────────┐
│  Dashboard Ingénieur — Mes clients              │
├────────────────────────────────────────────────┤
│                                                  │
│  🔴 Alertes actives : 3 fermes                  │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ Client: Jean Dupont (Pack Starter 300)  │    │
│  │ Jour 45 | Survie: 72% ⚠️ | FCR: 2.3 ⚠️│    │
│  │ Dernière activité: il y a 3 jours       │    │
│  │ [Voir détails] [Envoyer conseil]        │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ Client: Marie Kamga (Pack Pro 500)      │    │
│  │ Jour 90 | Survie: 89% ✅ | FCR: 1.6 ✅ │    │
│  │ Dernière activité: aujourd'hui          │    │
│  │ [Voir détails]                          │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  Stats globales:                                 │
│  - 12 packs actifs                               │
│  - Survie moyenne: 84%                           │
│  - 3 fermes nécessitant attention                │
│  - 2 clients proches de la récolte               │
└────────────────────────────────────────────────┘
```

### 8.3 Modèle de données — Support Ingénieur

```
Nouveau modèle : NoteIngenieur
    id          String    @id @default(cuid())

    ingenieurId String
    ingenieur   User      @relation("NotesEnvoyees", fields: [ingenieurId], references: [id])

    clientSiteId String
    clientSite   Site     @relation(fields: [clientSiteId], references: [id])
    vagueId      String?

    titre        String
    contenu      String            // Markdown
    isUrgent     Boolean  @default(false)
    isRead       Boolean  @default(false)

    createdAt    DateTime @default(now())
    siteId       String             // R8 — site DKFarm
```

### 8.4 Alertes vers l'ingénieur

Le système envoie automatiquement des notifications à l'ingénieur DKFarm quand :
- Taux de survie d'un client < 80%
- FCR > 2.2
- Aucun relevé enregistré depuis > 3 jours (client inactif)
- Client n'a pas complété ses activités depuis > 2 jours
- Stock d'aliment estimé < 5 jours

---

## 9. Parcours Utilisateur (User Flows)

### 9.1 Super Admin — Création d'un pack

```
1. Menu → Packs → Nouveau Pack
2. Définir : nom, nombre d'alevins, prix
3. Ajouter produits : sélectionner parmi le stock DKFarm + quantité
4. Sauvegarder le pack (template réutilisable)
```

### 9.2 Super Admin — Activer un pack pour un client

```
1. Menu → Packs → [Pack] → Nouvelle activation
2. Créer ou sélectionner un utilisateur client
3. Le système crée automatiquement :
   a. Site pour le client
   b. SiteMember (client = PISCICULTEUR, DKFarm = ADMIN)
   c. Vague avec les paramètres du pack
   d. Bac par défaut (volume à renseigner)
   e. Produits dans le stock avec quantités du pack
   f. Activités de la semaine 1
4. Envoyer les identifiants au client (SMS/WhatsApp)
```

### 9.3 Client — Utilisation quotidienne

```
1. Se connecter → Dashboard personnel
2. Voir "Mes tâches du jour" (activités auto-générées)
   - ✅ Alimentation matin : distribuer 168g d'aliment 1.2mm
   - ⬜ Contrôle mortalité : retirer et compter les morts
   - ⬜ Alimentation soir : distribuer 168g
3. Cliquer sur une tâche → Voir instructions détaillées
4. Marquer comme terminé (avec relevé si nécessaire)
5. Voir les notifications et conseils IA
6. En cas de problème → Décrire l'observation → Recevoir un conseil IA
```

### 9.4 Ingénieur — Monitoring

```
1. Se connecter (rôle ADMIN global)
2. Dashboard ingénieur → Vue tous les clients
3. Identifier les alertes (rouge = critique, orange = attention)
4. Cliquer sur un client → Voir ses stats détaillées
5. Analyser les graphiques (croissance, mortalité, FCR)
6. Envoyer une note/conseil au client
7. Optionnel : déclencher un conseil IA pour le client
```

---

## 10. Intégration avec l'existant

### 10.1 Modèles existants impactés

| Modèle | Modification |
|--------|-------------|
| **Activite** | + regleId, instructionsDetaillees, conseilIA, produitRecommande, quantiteRecommandee, priorite, isAutoGenerated, phaseElevage |
| **Vague** | + packActivationId? (lien vers PackActivation), phaseElevage (calculé ou stocké), configElevageId? |
| **Site** | + relation PackActivation, ConfigElevage |
| **User** | + relation PackActivation |
| **Produit** | + relation PackProduit |
| **benchmarks.ts** | Refactored : `evaluerBenchmark()` accepte ConfigElevage au lieu de constantes hardcodées |
| **alertes.ts** | Refactored : seuils pH, température, mortalité lus depuis ConfigElevage |
| **calculs.ts** | Enrichi : `getTauxAlimentation()`, `getTailleAliment()`, `detecterPhase()` acceptent ConfigElevage |

### 10.2 API Routes nouvelles

| Route | Méthode | Description |
|-------|---------|-------------|
| `/api/config-elevage` | GET, POST | Lister/créer des profils de configuration |
| `/api/config-elevage/[id]` | GET, PUT, DELETE | CRUD profil individuel |
| `/api/config-elevage/defaut` | GET | Obtenir la config par défaut du site |
| `/api/config-elevage/[id]/dupliquer` | POST | Dupliquer un profil existant |
| `/api/packs` | GET, POST | Lister/créer des packs |
| `/api/packs/[id]` | GET, PUT, DELETE | CRUD pack individuel |
| `/api/packs/[id]/produits` | GET, POST, DELETE | Gérer les produits du pack |
| `/api/packs/[id]/activer` | POST | Activer un pack pour un client |
| `/api/pack-activations` | GET | Lister les activations (avec filtres) |
| `/api/pack-activations/[id]` | GET, PUT | Détail/modifier une activation |
| `/api/regles-activites` | GET, POST | Gérer les règles d'activités |
| `/api/regles-activites/[id]` | GET, PUT, DELETE | CRUD règle |
| `/api/activites/generer` | POST | Déclencher le moteur d'activités manuellement |
| `/api/activites/[id]/instructions` | GET | Instructions détaillées d'une activité |
| `/api/conseil-ia` | POST | Demander un conseil IA |
| `/api/conseil-ia/[vagueId]` | GET | Historique des conseils IA pour une vague |
| `/api/ingenieur/dashboard` | GET | Dashboard monitoring toutes les fermes |
| `/api/ingenieur/clients` | GET | Liste des clients avec métriques |
| `/api/ingenieur/notes` | GET, POST | Notes ingénieur |
| `/api/ingenieur/notes/[id]` | GET, PUT | Détail note |

### 10.3 Pages UI nouvelles

| Page | Description |
|------|-------------|
| `/settings/config-elevage` | Liste des profils de configuration élevage |
| `/settings/config-elevage/[id]` | Édition d'un profil (sections repliables) |
| `/settings/config-elevage/nouveau` | Création depuis template ou custom |
| `/packs` | Liste des packs (admin DKFarm) |
| `/packs/[id]` | Détail/édition d'un pack |
| `/packs/nouveau` | Création d'un pack |
| `/packs/[id]/activer` | Formulaire d'activation pour un client |
| `/activations` | Liste des activations (admin) |
| `/activations/[id]` | Détail d'une activation |
| `/mes-taches` (enrichi) | Tâches avec instructions détaillées + conseils IA |
| `/conseil` | Interface de conseil IA (chat-like) |
| `/ingenieur` | Dashboard ingénieur |
| `/ingenieur/[siteId]` | Vue détaillée d'un client |

---

## 11. Phases d'implémentation suggérées

### Phase A — ConfigElevage & Refactoring Benchmarks (Sprint 13)

1. Modèle ConfigElevage + migration Prisma
2. API CRUD config-elevage + endpoint /defaut + /dupliquer
3. Seed des profils pré-définis (Clarias Standard, Express, Premium)
4. Refactoring `benchmarks.ts` : lire depuis ConfigElevage au lieu de constantes
5. Refactoring `alertes.ts` : seuils qualité eau et mortalité depuis ConfigElevage
6. Refactoring `calculs.ts` : fonctions acceptent config en paramètre
7. UI settings : page config-elevage (liste, édition en sections repliables)
8. Tests unitaires : vérifier que les calculs utilisent les configs correctement

### Phase B — Packs & Provisioning (Sprint 14)

1. Modèles : Pack, PackProduit, PackActivation, StatutActivation
2. Relation Pack → ConfigElevage
3. API CRUD packs + activation
4. Logique de provisioning automatique (site + vague + stock + bac + copie config)
5. UI admin : gestion des packs
6. UI admin : activation d'un pack

### Phase C — Moteur d'Activités Automatiques (Sprint 15)

1. Modèles : RegleActivite, TypeDeclencheur, PhaseElevage
2. Enrichissement Activite (instructions, priorité, auto-generated, etc.)
3. Moteur de règles : évaluation des conditions basée sur ConfigElevage
4. Seed des règles pré-définies (catalogue complet)
5. CRON ou trigger post-relevé pour générer les activités
6. Calcul automatique des quantités d'aliment (via alimentTauxConfig)
7. Détection de phase automatique (via seuilXxx de ConfigElevage)

### Phase D — Instructions détaillées & UX guidée (Sprint 16)

1. Page "Mes tâches" enrichie avec instructions Markdown
2. Lien activité → relevé (complétion via relevé)
3. Recommandations produit (avec lien stock + détection taille aliment)
4. Projections : SGR requis, date de récolte estimée, budget aliment restant
5. Notifications push pour les tâches du jour
6. Alertes graduées par benchmark (EXCELLENT → MAUVAIS)

### Phase E — Intelligence Artificielle (Sprint 17)

1. Intégration Claude API (Anthropic)
2. Modèle ConseilIA
3. Endpoint conseil IA avec contexte enrichi (inclut ConfigElevage)
4. Génération de conseils post-relevé (si anomalie détectée)
5. Rapport hebdomadaire automatique
6. Interface chat-like pour questions libres

### Phase F — Monitoring Ingénieur (Sprint 18)

1. Dashboard ingénieur multi-sites (avec seuils depuis ConfigElevage client)
2. Alertes automatiques vers ingénieur (seuils configurables)
3. Notes ingénieur
4. Vue consolidée des performances clients
5. Historique des interventions

---

## 12. Métriques de succès

| Métrique | Cible | Mesure |
|----------|-------|--------|
| Taux de survie clients guidés | > 85% | Moyenne tauxSurvie des vagues liées à des packs |
| Taux de complétion des activités | > 70% | Activités TERMINEE / total générées |
| Taux de réachat aliment | > 80% | Clients ayant commandé après épuisement stock initial |
| FCR moyen clients | < 1.8 | Moyenne FCR des vagues packs |
| Temps moyen de réponse ingénieur | < 24h | Temps entre alerte et note ingénieur |
| Satisfaction utilisateur | > 4/5 | Feedback in-app (à implémenter) |

---

## 13. Considérations techniques

### 13.1 Exécution du moteur d'activités

**Option A — Event-driven (recommandé)**
- Après chaque création de relevé → évaluer les règles SEUIL_*
- Après chaque biométrie → recalculer la phase + générer activités liées au poids
- CRON quotidien (ou API schedulée) → générer activités RECURRENT + CALENDRIER

**Option B — CRON seul**
- Job quotidien qui évalue toutes les règles pour toutes les vagues actives
- Plus simple mais moins réactif

### 13.2 Performance

- Les règles sont évaluées par vague, pas globalement
- Cache des indicateurs de vague (recalcul seulement après nouveau relevé)
- L'IA est appelée de manière asynchrone, le résultat est stocké

### 13.3 Sécurité

- Un client ne voit QUE son site (multi-tenancy existant)
- L'ingénieur DKFarm a accès en lecture aux sites clients
- Les appels IA sont rate-limited et loggés
- Les données envoyées à l'IA sont anonymisées (pas de noms/emails)

### 13.4 Mobile-first

- Les instructions détaillées doivent être lisibles sur 360px
- Les activités quotidiennes sont la première chose visible au login
- Notifications push (PWA ou SMS) pour les tâches critiques
- Mode hors-ligne : cache les activités du jour (future amélioration)

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
