**GUIDE TECHNIQUE**

Modele de Croissance Gompertz

&

**Optimisation Alimentaire**

Application FarmFlow --- Elevage Clarias gariepinus

Cameroun --- Conditions tropicales

  ---------------------- -------------------------------------------
  **Version :** 1.0      **Date :** 29 mars 2026
  **Auteur :** DK Farm   **Destinataires :** Ingenieurs piscicoles
  ---------------------- -------------------------------------------

Table des matieres

PARTIE I --- Le Modele de Croissance Gompertz

1.1 Pourquoi Gompertz ?

La croissance des poissons ne suit pas une ligne droite. Elle est rapide
au debut, puis ralentit progressivement a mesure que le poisson approche
de sa taille adulte. Cette trajectoire en forme de S (sigmoide) est une
realite biologique universelle.

Parmi les modeles mathematiques disponibles (Von Bertalanffy,
Logistique, Richards), le modele de Gompertz est le plus adapte au
Clarias gariepinus car :

-   Le point d\'inflexion (moment ou la croissance ralentit) arrive tot,
    a environ 30-37% du poids maximum. C\'est exactement le profil du
    Clarias.

-   Il modelise bien la croissance asymetrique : acceleration rapide en
    jeune age, deceleration progressive.

-   Il est valide par la litterature scientifique (FAO, CIRAD, etudes
    Nigeria/Cameroun).

-   Il ne necessite que 3 parametres a calibrer, ce qui le rend pratique
    avec peu de donnees.

1.2 La formule Gompertz --- decortiquee

+----------------------------------------------------------------------+
| **FORMULE GOMPERTZ**                                                 |
|                                                                      |
| W(t) = W∞ × exp( −exp( −K × (t − tᵢ) ) )                             |
|                                                                      |
| Ou :                                                                 |
|                                                                      |
| W(t) = poids moyen predit au jour t (en grammes)                     |
|                                                                      |
| W∞ = poids asymptotique maximal theorique (en grammes)               |
|                                                                      |
| K = taux de croissance intrinseque (par jour)                        |
|                                                                      |
| tᵢ = jour du point d\'inflexion (jour ou la croissance est maximale) |
|                                                                      |
| t = age du poisson en jours depuis la mise en charge                 |
+----------------------------------------------------------------------+

**Decomposition element par element :**

W(t) --- Le poids moyen predit

C\'est le resultat final : le poids moyen en grammes que le modele
predit pour un poisson a l\'age t jours. C\'est la valeur qui sera
tracee sur la courbe previsionnelle dans FarmFlow.

+----------------------------------------------------------------------+
| **Dans FarmFlow**                                                    |
|                                                                      |
| Ce poids est compare au poids moyen observe (releves BIOMETRIE).     |
|                                                                      |
| L\'ecart entre W(t) predit et le poids observe mesure la performance |
| reelle de la vague.                                                  |
+----------------------------------------------------------------------+

W∞ --- Le poids asymptotique maximal

C\'est le poids theorique maximum que le poisson atteindrait s\'il
grandissait indefiniment dans des conditions parfaites. **En pratique,
il n\'est jamais atteint** car on recolte bien avant.

Pour le Clarias gariepinus en conditions tropicales au Cameroun, les
valeurs typiques sont :

  --------------------- ------------------ -----------------------------------------------
  **Systeme**           **W∞ typique**     **Remarque**
  Bac beton intensif    1 000 -- 1 500 g   Recolte a 700--800 g
  Etang semi-intensif   1 500 -- 2 000 g   Croissance plus lente, poids final plus eleve
  RAS intensif          1 200 -- 1 800 g   Conditions controlees
  --------------------- ------------------ -----------------------------------------------

**Valeur par defaut FarmFlow :** 1 200 g *(ajustable dans ConfigElevage
→ champ gompertzWInf)*

K --- Le taux de croissance intrinseque

K determine la **vitesse** a laquelle le poisson approche de W∞. Plus K
est grand, plus la croissance est rapide. C\'est le parametre le plus
sensible aux conditions d\'elevage.

Facteurs qui augmentent K :

-   Temperature de l\'eau optimale (26--30 °C)

-   Aliment de haute qualite (35--45% proteines, FCR \< 1.5)

-   Densite raisonnable (\< 150 kg/m³)

-   Renouvellement d\'eau adequat (\> 25%/jour)

Facteurs qui diminuent K :

-   Sous-alimentation ou aliment de mauvaise qualite

-   Surdensification (\> 200 kg/m³ sans RAS)

-   Temperature hors plage optimale

-   Stress (mauvaise qualite d\'eau, manipulations excessives)

  ---------------------------------------- -------------------- -----------------------
  **Conditions**                           **K (/jour)**        **Contexte**
  Excellentes (RAS, aliment premium)       **0.020 -- 0.025**   Elevage professionnel
  Bonnes (bac beton, aliment commercial)   **0.015 -- 0.020**   Cameroun standard
  Moyennes (etang, aliment artisanal)      0.010 -- 0.015       Campagne rurale
  Mauvaises                                \< 0.010             Probleme a identifier
  ---------------------------------------- -------------------- -----------------------

**Valeur par defaut FarmFlow :** 0.018 /jour *(recalibrable
automatiquement des 3 biometries)*

tᵢ --- Le point d\'inflexion

C\'est le **jour ou la croissance quotidienne est maximale**. Avant tᵢ,
la croissance accelere. Apres tᵢ, elle decelere progressivement.

Au point d\'inflexion, le poids du poisson vaut exactement **W∞ / e ≈
37% de W∞**. Pour un W∞ de 1 200 g, cela donne environ 440 g.

Pour Clarias en bacs au Cameroun, tᵢ se situe generalement entre **85 et
110 jours** apres mise en charge (soit environ 3 mois).

**Valeur par defaut FarmFlow :** 95 jours *(recalibrable
automatiquement)*

+----------------------------------------------------------------------+
| **Importance pratique de tᵢ**                                        |
|                                                                      |
| Le point d\'inflexion est le moment CLE pour l\'eleveur :            |
|                                                                      |
| • AVANT tᵢ : investir au maximum dans l\'alimentation (taux eleves,  |
| qualite premium)                                                     |
|                                                                      |
| • APRES tᵢ : la conversion alimentaire se degrade naturellement →    |
| optimiser les couts                                                  |
|                                                                      |
| • C\'est souvent le moment ideal pour envisager un changement de     |
| taille de granule                                                    |
+----------------------------------------------------------------------+

La double exponentielle --- exp(-exp(\...))

C\'est la signature mathematique du modele Gompertz. La double
exponentielle cree la forme en S asymetrique :

1.  **exp interne** = exp(−K × (t − tᵢ)) : un facteur qui diminue avec
    le temps. Quand t est petit (poisson jeune), ce facteur est grand et
    freine la croissance.

2.  **exp externe** = exp(−\...) : transforme le facteur interne en
    multiplicateur de W∞. Quand le facteur interne est grand, le
    multiplicateur est petit (poids faible). Quand il est petit, le
    multiplicateur tend vers 1 (poids tend vers W∞).

1.3 Exemple chiffre --- Cycle DK Farm

Prenons un cycle typique DK Farm au Cameroun :

-   W∞ = 1 200 g, K = 0.018 /jour, tᵢ = 95 jours

-   Alevins mis en charge a 0.5 g (J0)

  ---------- ----------------- ------------------- -------------------- ---------------- ----------------------------------
  **Jour**   **W(t) predit**   **Phase**           **Taille granule**   **Taux alim.**   **Observation**
  0          0.5 g             Mise en charge      1.2 mm               9%               Alevins fingerlings
  15         3 g               Acclimatation       1.2 mm               9%               
  30         16 g              Croissance debut    1.5--2 mm            5.5%             1er switch granule
  45         42 g              Croissance debut    2--3 mm              5.5%             
  60         88 g              Juvenile            3--4 mm              4%               2e switch granule
  75         157 g             Grossissement       4--6 mm              2.5%             3e switch granule
  90         249 g             Grossissement       4--6 mm              2.5%             Proche de tᵢ
  **95**     **283 g**         **Grossissement**   **4--6 mm**          **2.5%**         **INFLEXION --- croissance max**
  105        350 g             Grossissement       4--6 mm              2.5%             4e switch granule
  120        450 g             Finition            6--9 mm              1.75%            
  150        644 g             Finition            6--9 mm              1.75%            
  180        800 g             Pre-recolte         6--9 mm              1.25%            Recolte possible
  ---------- ----------------- ------------------- -------------------- ---------------- ----------------------------------

*Note : Les poids predits sont calcules par la formule Gompertz. Les
tailles de granule et taux d\'alimentation correspondent aux seuils par
defaut ConfigElevage de FarmFlow.*

PARTIE II --- Integration avec FarmFlow

2.1 Donnees deja collectees dans FarmFlow

FarmFlow collecte deja toutes les donnees necessaires pour alimenter le
modele Gompertz. Voici la correspondance exacte :

  ------------------------ ------------------------------------------ ----------------------------------- -----------------------
  **Parametre Gompertz**   **Source FarmFlow**                        **Releve / Champ**                  **Frequence ideale**
  W(t) observe             Releve BIOMETRIE                           poidsMoyen (g)                      Toutes les 2 semaines
  t (age en jours)         Vague.dateDebut                            calcule : date releve − dateDebut   Automatique
  W(0) poids initial       Vague.poidsMoyenInitial                    Saisi a la creation                 1 fois
  Temperature eau          Releve QUALITE_EAU                         temperature (°C)                    2×/semaine min.
  Nombre vivants           Releve COMPTAGE / MORTALITE                nombreCompte / nombreMorts          Hebdomadaire
  Aliment distribue        Releve ALIMENTATION / ReleveConsommation   quantite (kg), produitId            Quotidien
  FCR observe              Calcule automatique                        quantiteAliment / gainBiomasse      Automatique
  SGR observe              Calcule automatique                        (ln W2 − ln W1) / Δt × 100          Automatique
  ------------------------ ------------------------------------------ ----------------------------------- -----------------------

2.2 Ou stocker les parametres Gompertz

Les 3 parametres du modele sont stockes dans le modele ConfigElevage
(Prisma) :

  ------------------------ ---------- ------------ -------------------------
  **Champ Prisma**         **Type**   **Defaut**   **Description**
  **gompertzWInf**         Float      1200.0       Poids asymptotique (g)
  **gompertzK**            Float      0.018        Taux croissance (/jour)
  **gompertzTInflexion**   Float      95.0         Jour d\'inflexion
  ------------------------ ---------- ------------ -------------------------

Chaque **site (ferme)** peut avoir ses propres valeurs. Le formulaire
ConfigElevage dans l\'interface ingenieur permettra de les ajuster.

2.3 Calibrage automatique sur les biometries

C\'est la cle pour obtenir une courbe proche de la realite. Des que la
vague a accumule 3 biometries ou plus, FarmFlow recalibre
automatiquement K et tᵢ :

1.  **Collecte des points** --- Chaque releve BIOMETRIE fournit un
    couple (t, W) : l\'age en jours et le poids moyen mesure.

2.  **Regression non-lineaire** --- L\'algorithme de Levenberg-Marquardt
    minimise l\'ecart entre les points observes et la courbe Gompertz en
    ajustant K et tᵢ (W∞ reste fixe ou est contraint).

3.  **Mise a jour** --- A chaque nouvelle biometrie, la courbe est
    recalculee. La precision s\'ameliore avec chaque point.

4.  **Projection** --- La courbe calibree est prolongee jusqu\'a la fin
    du cycle pour predire la trajectoire de poids.

+----------------------------------------------------------------------+
| **Precision attendue**                                               |
|                                                                      |
| Avec 3 biometries (J15, J30, J45) : ecart moyen ±15--20%             |
|                                                                      |
| Avec 5 biometries (J15--J75) : ecart moyen ±8--12%                   |
|                                                                      |
| Avec 7+ biometries (J15--J105+) : ecart moyen ±3--5%                 |
|                                                                      |
| La precision depend aussi de la regularite des biometries et de la   |
| taille de l\'echantillon pese.                                       |
+----------------------------------------------------------------------+

2.4 Guide pas-a-pas : comment utiliser les donnees

Etape 1 --- Configurer le profil d\'elevage

Dans FarmFlow, aller dans Parametres \> Config Elevage \> Nouveau
profil. Renseigner :

1.  **Poids objectif :** 800 g (ou selon votre marche)

2.  **Duree cycle :** 180 jours (6 mois standard Cameroun)

3.  **W∞ :** 1 200 g (laisser la valeur par defaut pour commencer)

4.  **K :** 0.018 (sera recalibre automatiquement)

5.  **tᵢ :** 95 jours (sera recalibre automatiquement)

Etape 2 --- Faire des biometries regulieres

La qualite de la prediction depend directement de la frequence des
biometries :

  --------------------------- ---------------- ------------------ -------------------- --------------
  **Phase**                   **Intervalle**   **Echantillon**    **Methode**          **Priorite**
  Acclimatation (0--15g)      7 jours          30 poissons min.   Pesee par lot        **CRITIQUE**
  Croissance (15--150g)       10--14 jours     20 poissons        Pesee individuelle   **HAUTE**
  Grossissement (150--350g)   14 jours         15 poissons        Pesee individuelle   **HAUTE**
  Finition (350g+)            14--21 jours     10 poissons        Pesee individuelle   **MOYENNE**
  --------------------------- ---------------- ------------------ -------------------- --------------

Etape 3 --- Interpreter la courbe previsionnelle

Une fois 3+ biometries enregistrees, la courbe Gompertz calibree
apparait dans le dashboard de la vague. Voici comment l\'interpreter :

  ----------------------------- ----------------- ----------------------------------------------------------------------------------------------------
  **Situation**                 **Ecart**         **Action recommandee**
  **Poids observe \> predit**   **\> +10%**       Excellent ! Conditions superieures aux previsions. Verifier si la densite reste acceptable.
  Poids observe ≈ predit        ±10%              Dans la norme. Le modele est bien calibre. Continuer le protocole.
  **Poids observe \< predit**   **−10% a −25%**   Retard de croissance. Verifier : temperature, qualite aliment, densite, qualite eau.
  **Retard critique**           **\< −25%**       Probleme serieux. Investigation immediate : maladie, sous-alimentation, surdensite, pollution eau.
  ----------------------------- ----------------- ----------------------------------------------------------------------------------------------------

Etape 4 --- Ajuster le modele au fil des cycles

Apres chaque cycle termine, comparer le poids final reel au poids predit
par Gompertz. Si l\'ecart est constant (toujours +15% ou toujours −10%),
ajuster W∞ dans ConfigElevage pour les prochains cycles. Le K et tᵢ
seront recalibres automatiquement a chaque nouvelle vague.

PARTIE III --- Comparaison et Optimisation des Aliments

3.1 Pourquoi comparer les aliments ?

L\'alimentation represente 60 a 70% du cout total de production du
Clarias. Le choix de l\'aliment a un impact direct sur :

-   **La vitesse de croissance** --- un aliment de meilleure qualite
    augmente K dans le modele Gompertz

-   **Le FCR (Feed Conversion Ratio)** --- kg d\'aliment / kg de poisson
    produit. Plus bas = meilleur

-   **Le cout par kg de poisson produit** --- l\'indicateur final de
    rentabilite

Un aliment cher avec un bon FCR peut etre **plus rentable** qu\'un
aliment bon marche avec un mauvais FCR. C\'est pourquoi FarmFlow calcule
le **cout par kg de gain** et pas seulement le prix au kilo de
l\'aliment.

3.2 Indicateurs de comparaison dans FarmFlow

FarmFlow calcule automatiquement ces indicateurs pour chaque aliment
utilise :

  ------------------------- -------------------------------------------------------------------------------------- ----------------
  **Indicateur**            **Formule**                                                                            **Objectif**
  **FCR pondere**           Somme quantite aliment (kg) / Somme gain biomasse (kg) --- pondere par vague           **\< 1.5**
  **Cout par kg de gain**   (quantite aliment × prix unitaire) / gain biomasse                                     Le plus bas
  **SGR moyen**             (ln W2 − ln W1) / nombre jours × 100 --- pendant utilisation de l\'aliment             **\> 2.5 %/j**
  **Score qualite**         Score composite ponderant FCR (40%), cout/kg gain (30%), SGR (20%), regularite (10%)   \> 70/100
  ------------------------- -------------------------------------------------------------------------------------- ----------------

3.3 Protocole de test comparatif d\'aliments

**Objectif :** determiner quel aliment offre le meilleur rapport
qualite/prix pour VOTRE ferme, dans VOS conditions.

Methode 1 --- Comparaison entre vagues

La methode la plus simple : utiliser un aliment different pour chaque
vague et comparer les resultats.

1.  **Creer 2--3 vagues simultanees** avec le meme nombre d\'alevins, la
    meme provenance, et les memes bacs.

2.  **Assigner un aliment different** a chaque vague. Enregistrer chaque
    distribution dans FarmFlow (releve ALIMENTATION avec le produitId).

3.  **Biometries simultanees** : peser les poissons des vagues de test
    le meme jour pour eliminer le biais saisonnier.

4.  **A mi-parcours (J90)**, analyser dans FarmFlow \> Analytiques \>
    Aliments : comparer les courbes Gompertz, les FCR et les couts/kg.

5.  **A la recolte**, le rapport de fin de vague resume toutes les
    metriques. La fonction genererRecommandation() de FarmFlow produit
    automatiquement une recommandation textuelle.

Methode 2 --- Comparaison par phase au sein d\'une vague

Plus avancee : changer d\'aliment a une phase precise et mesurer
l\'impact sur le K de Gompertz.

  ------------ ----------------------- ----------------------- -----------------------------
  **Phase**    **Aliment A**           **Aliment B**           **Ce qu\'on mesure**
  J0--J60      Skretting Starter 45%   Skretting Starter 45%   Meme aliment = baseline
  J60--J120    Skretting Grower 38%    Aller Aqua Grower 40%   **Impact sur K, FCR, cout**
  J120--J180   Meme pour les deux      Meme pour les deux      Effet residuel
  ------------ ----------------------- ----------------------- -----------------------------

*L\'historique nutritionnel de FarmFlow (table HistoriqueNutritionnel)
enregistre automatiquement chaque changement d\'aliment avec la date et
le poids moyen au moment du switch.*

3.4 Donnees a collecter pour optimiser

Pour une comparaison fiable, chaque distribution d\'aliment doit etre
enregistree dans FarmFlow :

  --------------------- ------------------------------- ---------------- ---------------------------------
  **Donnee**            **Champ FarmFlow**              **Importance**   **Pourquoi**
  Quantite distribuee   ReleveConsommation.quantite     **CRITIQUE**     Calcul FCR et cout
  Produit (aliment)     ReleveConsommation.produitId    **CRITIQUE**     Identifier quel aliment
  Date distribution     Releve.date                     **CRITIQUE**     Lier a la phase de croissance
  Prix unitaire         Produit.prixUnitaire            HAUTE            Calcul cout/kg de gain
  \% Proteines          Produit.proteines (a ajouter)   MOYENNE          Correlation qualite/performance
  Taille granule        Produit.taille                  MOYENNE          Adapter au poids moyen
  Fournisseur           Produit.fournisseurId           HAUTE            Comparer les fournisseurs
  Lot / Batch           ReleveConsommation.notes        BASSE            Tracabilite qualite
  --------------------- ------------------------------- ---------------- ---------------------------------

3.5 Lien entre aliment et modele Gompertz

La qualite de l\'aliment impacte directement le parametre K du modele
Gompertz. Voici comment :

+----------------------------------------------------------------------+
| **Boucle d\'optimisation**                                           |
|                                                                      |
| 1\. OBSERVER : FarmFlow enregistre les distributions d\'aliment et   |
| les biometries                                                       |
|                                                                      |
| 2\. CALIBRER : Le modele Gompertz se recalibre avec les nouvelles    |
| biometries → K evolue                                                |
|                                                                      |
| 3\. COMPARER : Si K augmente apres un changement d\'aliment → le     |
| nouvel aliment est meilleur                                          |
|                                                                      |
| 4\. DECIDER : Choisir l\'aliment avec le meilleur K ajuste pour le   |
| cout le plus bas                                                     |
|                                                                      |
| 5\. RECOMMENCER : A chaque cycle, affiner les choix avec les donnees |
| accumulees                                                           |
+----------------------------------------------------------------------+

En pratique, si vous changez d\'aliment a J60 et que K passe de 0.016 a
0.019 lors du recalibrage suivant (J75), c\'est un signal fort que le
nouvel aliment est **significativement meilleur** pour vos conditions.

PARTIE IV --- Synthese et Plan d\'Action

4.1 Resume des donnees essentielles

  ---------------------------- ------------------------------------------------ ------------------------
  **Objectif**                 **Donnees requises**                             **Frequence**
  **Courbe Gompertz fiable**   Biometries (poids moyen)                         Toutes les 2 semaines
  **Prediction temperature**   Releves qualite eau (T°C)                        2x / semaine minimum
  **Comparaison aliments**     Distributions alimentaires (produit, quantite)   A chaque nourrissage
  **Calcul FCR / Cout**        Prix aliment + gain biomasse                     Automatique (FarmFlow)
  **Survie / mortalite**       Comptages + releves mortalite                    Hebdomadaire
  ---------------------------- ------------------------------------------------ ------------------------

4.2 Checklist de demarrage

1.  **Configurer ConfigElevage** avec les parametres Gompertz par defaut
    (W∞=1200, K=0.018, tᵢ=95)

2.  **Enregistrer tous les produits alimentaires** dans le stock avec
    prix, fournisseur, et taille granule

3.  **A chaque nourrissage**, enregistrer la quantite et le produit
    utilise (releve ALIMENTATION)

4.  **Toutes les 2 semaines**, faire une biometrie sur 10--30 poissons
    (selon la phase)

5.  **2x par semaine**, mesurer la temperature de l\'eau (releve
    QUALITE_EAU)

6.  **Apres 3 biometries (\~J45)**, consulter la courbe Gompertz
    calibree dans le dashboard

7.  **Pour tester un aliment**, lancer 2 vagues paralleles avec des
    aliments differents et comparer les resultats dans Analytiques \>
    Aliments

8.  **A chaque fin de cycle**, exporter le rapport PDF de la vague et
    archiver les resultats pour referentiel futur

+----------------------------------------------------------------------+
| **OBJECTIF FINAL**                                                   |
|                                                                      |
| En suivant ce protocole et en utilisant le modele Gompertz integre a |
| FarmFlow,                                                            |
|                                                                      |
| vous obtiendrez en quelques cycles :                                 |
|                                                                      |
| • Une courbe de croissance previsionnelle fiable a ±5% pres          |
|                                                                      |
| • Un classement objectif des aliments par rentabilite reelle         |
|                                                                      |
| • La capacite de projeter votre date de recolte et vos besoins en    |
| aliment                                                              |
|                                                                      |
| • Un referentiel propre a votre ferme, ajuste a vos conditions       |
| locales                                                              |
+----------------------------------------------------------------------+

*Document genere le 29 mars 2026 --- FarmFlow v2.0 --- DK Farm,
Cameroun*
