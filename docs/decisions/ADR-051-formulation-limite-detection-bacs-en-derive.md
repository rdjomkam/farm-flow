# ADR-051 — Formulation honnête de la limite de détection paresseuse (carte "Bacs en dérive")

**Statut :** Acceptée
**Date :** 2026-07-27
**Sprint :** BD (story BD.1)
**Auteur :** @architect
**Réfs :** ADR-048 (persistance des écarts de conservation), `docs/analysis/pre-analysis-sprint-BD.md`
(section "Détection paresseuse confirmée (Q2)"), Bac 11 / Vague-26-03-Prep (incident prod à
l'origine d'ADR-048).

---

## 1. Contexte

ADR-048 (story SU.2) a livré la persistance des écarts de conservation tolérés par
`verifyAssignationInvariant` (`EcartAssignationConstate`) et une query `getBacsEnDerive(siteId)`
exploitable par un écran. Ce sprint (BD) livre l'écran lui-même. Avant d'en écrire le composant
(story BD.2), cette story tranche uniquement la **formulation textuelle** de la carte.

Le problème central, confirmé par la pré-analyse du sprint : la détection est **paresseuse**.
Il n'existe aucun cron ni job de balayage périodique — la recherche de `cron`/`job`/`scheduler`
dans `src` ne retourne qu'un cron sans rapport (lifecycle d'abonnement). Seules **6 opérations
guardées** mettent à jour l'état d'un bac : arrivage, transfert (×2 call sites), calibrage,
vente, vente-alevins, bon de livraison. Un bac qui dérive réellement mais sur lequel plus aucune
de ces opérations n'a lieu **n'apparaîtra jamais** dans `getBacsEnDerive`, même s'il dérive
activement.

Conséquence directe : **« aucun bac en dérive » ne signifie pas « tout est sain »** — cela
signifie seulement « rien n'a été détecté lors des dernières opérations enregistrées ». Si
l'écran laisse croire le contraire, il recrée exactement le problème qu'ADR-048 devait
résoudre (Bac 11 : une dérive invisible jusqu'à ce qu'elle bloque une opération), simplement
déplacé de "aucune trace du tout" à "une fausse trace de sécurité".

## 2. Cadrage déjà acté (rappel, non rediscuté ici)

Décision utilisateur préalable, hors périmètre de cette story : la carte **n'apparaît que**
s'il existe au moins un bac concerné par `getBacsEnDerive(siteId).length > 0`. Pas d'état vide,
pas de bandeau permanent sur un dashboard sain. La nuance sur la limite de détection doit donc
se jouer **dans le texte de la carte elle-même** (elle n'est lue que quand il y a déjà un
problème signalé), pas dans un avertissement affiché en toute circonstance.

## 3. Vocabulaire retenu

Le terme **« écart »** est déjà le vocabulaire métier du projet pour ce phénomène précis —
ADR-048 l'emploie systématiquement (« écart de conservation », « écart constaté », « écart
signé »), et le modèle Prisma s'appelle `EcartAssignationConstate`. On le réutilise tel quel
côté UI plutôt que d'inventer un synonyme. Le terme **« dérive »**, également déjà utilisé côté
métier (titre de la story, ADR-048 section 9), reste employé dans la documentation interne mais
n'apparaît volontairement **pas** dans le titre affiché à l'utilisateur (section 4.2).

## 4. Formulations envisagées et arbitrage

### 4.1 Titre de la carte

| Formulation envisagée | Verdict | Raison |
|---|---|---|
| **« Tous les bacs sont sains »** (absence de carte = ce message implicite) | Rejetée | Faux : l'absence de carte ne veut dire que "rien détecté", pas "sain". Ce message, explicite ou implicite, transformerait un silence de détection en garantie qu'aucune donnée ne permet d'établir. |
| **« Aucune dérive »** | Rejetée | Même défaut que ci-dessus, formulé comme titre de la carte elle-même (hypothèse d'un état vide visible) — un titre qui affirme une négation absolue ("aucune") alors que le système n'a qu'une couverture partielle et paresseuse. Rejetée même si le cadrage acté élimine l'état vide, car elle resterait un piège si un jour l'état vide était réintroduit. |
| **« Bacs en dérive »** (reprise telle quelle du nom de la story / de la section 9 d'ADR-048) | Rejetée | Un titre nu, sans nuance et sans marque de détection, se lit comme une liste exhaustive et affirmée ("voici LES bacs en dérive"), alors que c'est une liste de ce qui a été *observé*. Trop proche de l'écueil que ce sprint doit justement éviter. |
| **« Bacs à vérifier »** | Rejetée | Trop vague : ne dit pas pourquoi, perd le lien avec le vocabulaire "écart" déjà établi, et sonne comme une tâche à cocher plutôt qu'un signal de données. |
| **« Écarts détectés sur des bacs »** (retenue) | **Retenue** | Le verbe "détectés" place explicitement l'affirmation du côté de l'observation, pas de l'état absolu — cohérent avec ce que le système peut réellement garantir. Court, sans jargon interne, réutilise le vocabulaire métier déjà en place ("écart"). |

### 4.2 Phrase de nuance (sous le titre)

| Formulation envisagée | Verdict | Raison |
|---|---|---|
| Aucune phrase de nuance (le titre suffirait) | Rejetée | Un gérant lisant "Écarts détectés" sur une carte qui n'apparaît que dans ce cas précis peut raisonnablement l'interpréter comme une liste complète des problèmes existants s'il n'y a aucune indication contraire. Le titre seul, même honnête dans sa formulation, ne suffit pas à couper cette inférence naturelle. |
| « Cette liste peut être incomplète » | Rejetée | Vrai mais vide de sens actionnable : ne dit pas *pourquoi* ni *dans quel cas* un bac pourrait manquer, donc rassure faussement ("c'est juste une formule de prudence générique") plutôt que d'informer. |
| « Détection automatique — un balayage complet n'est pas encore disponible » | Rejetée | Jargon interne ("balayage", "détection automatique" en creux) tourné vers l'implémentation plutôt que vers ce que l'utilisateur doit en faire ; sonne comme une excuse technique plutôt qu'une information opérationnelle. |
| **« Constaté lors des dernières opérations enregistrées — un bac sans opération récente peut dériver sans apparaître ici. »** (retenue) | **Retenue** | Dit précisément (a) sur quelle base la liste est construite ("dernières opérations enregistrées" — compréhensible sans connaître les 6 call sites), et (b) le cas concret où elle serait manquante ("un bac sans opération récente"), sans jamais promettre une exhaustivité que le système n'offre pas. Reste courte (une phrase, ~150 caractères) pour un écran 360px. |

### 4.3 Écart signé

| Formulation envisagée | Verdict | Raison |
|---|---|---|
| Afficher le nombre brut signé (`+3`, `-3`) | Rejetée | Le signe encode une distinction métier réelle (surplus constaté vs manque constaté) qui n'est pas évidente pour tout le monde à la lecture d'un simple signe mathématique sur un écran de 360px, en particulier sans légende visible à proximité immédiate de chaque ligne. |
| **Phrase qualitative : « N poisson(s) en trop » / « N poisson(s) manquant(s) »** (retenue) | **Retenue** | Explicite directement le sens métier du signe sans nécessiter de légende séparée ; `ecart > 0` → surplus constaté ("en trop"), `ecart < 0` → déficit constaté ("manquant"). Accord singulier/pluriel géré (`formatEcartSigne`, `src/lib/bacs-en-derive-constants.ts`). |

### 4.4 Date de première détection

| Formulation envisagée | Verdict | Raison |
|---|---|---|
| Durée relative (« depuis 3 jours ») | Rejetée | Se périme au moment du rendu suivant (un Server Component rendu une fois, consulté plus tard sur un écran resté ouvert ou remis en cache, afficherait une durée fausse) — introduirait une deuxième forme d'inexactitude non maîtrisée, alors que l'objectif de ce sprint est justement de ne jamais afficher plus de certitude que ce que la donnée garantit. |
| **Date absolue (« Détecté le 12/07/2026 »)** (retenue) | **Retenue** | Exacte et vérifiable indépendamment du moment de lecture, cohérente avec `formatDate` déjà utilisé ailleurs dans le projet (`src/lib/format.ts`). |

## 5. Décision

- **Titre de la carte** : « Écarts détectés sur des bacs »
- **Phrase de nuance** : « Constaté lors des dernières opérations enregistrées — un bac sans
  opération récente peut dériver sans apparaître ici. »
- **Colonnes** : Bac / Vague / Écart / Détecté depuis
- **Lien** : « Voir la fiche du bac »
- **Écart signé** : phrase qualitative (« N poisson(s) en trop » / « N poisson(s) manquant(s) »),
  jamais le nombre brut signé seul.
- **Première détection** : date absolue (« Détecté le JJ/MM/AAAA »), jamais une durée relative.

Ces libellés et fonctions de formatage sont livrés dans
`src/lib/bacs-en-derive-constants.ts` (`BACS_EN_DERIVE_LABELS`, `CONTEXTE_DETECTION_LABELS`,
`formatEcartSigne`, `formatPremiereDetection`, `formatDernierContexte`), directement
consommables par le composant de la story BD.2 sans logique de formatage supplémentaire à y
écrire.

## 6. Recommandation hors périmètre — balayage périodique

Un balayage périodique (cron/job qui ré-exécute `verifyAssignationInvariant`/
`persisterEcartConstate` sur tous les bacs, pas seulement ceux touchés par une opération) serait
le **seul** moyen de transformer « rien détecté aux dernières opérations » en une vraie garantie
« aucun bac ne dérive actuellement ». C'est explicitement hors périmètre de ce sprint (arbitrage
utilisateur) : cette ADR ne le conçoit pas en détail (pas de fréquence, pas de coût
d'exécution, pas de schéma de job proposés ici) — seule sa nécessité future est actée, dans la
continuité de la recommandation déjà faite par ADR-048 section 9.

## 7. Conséquences

- Aucun changement de schéma, de query ni de composant dans cette story — seuls l'ADR et le
  fichier de constantes sont livrés.
- La story BD.2 consomme `src/lib/bacs-en-derive-constants.ts` tel quel pour le rendu de la
  carte ; elle ne doit pas réintroduire de formulation plus forte que celle actée ici (par
  exemple un état vide affirmant « Tous les bacs sont sains », cf. section 4.1 — le cadrage
  acté l'exclut déjà, mais toute évolution future de ce cadrage doit revenir à cette ADR avant
  de changer le message).
- Si BD.0 (fix résolution COMPTAGE→guard, cf. pré-analyse) n'est pas traité dans ce sprint, la
  nuance retenue ici reste valable et couvre implicitement aussi ce cas : un bac réparé "à la
  main" par un comptage isolé, sans opération guardée ultérieure, resterait affiché comme en
  dérive — ce que la phrase de nuance n'exclut pas explicitement (elle parle d'un bac
  *manquant*, pas d'un bac *affiché à tort*), donc un risque résiduel distinct existe encore et
  reste documenté dans la pré-analyse, pas dans cette ADR.
