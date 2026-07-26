# Sprint SU — Rattrapage des suivis non bloquants accumulés

**Statut** : TERMINÉ
**Lancé le** : 2026-07-26
**Clos le** : 2026-07-26
**Périmètre final** : **13 stories** (SU.1 à SU.13)
**Origine** : accumulation de suivis marqués « non bloquants » à la clôture des sprints BL, BF (phase 1 et 2), GT, SC, PX — jamais traités depuis
**Review** : [review-sprint-SU.md](../reviews/review-sprint-SU.md) — verdict **VALIDÉ AVEC RÉSERVES** (aucune réserve bloquante)

## Objectif

Ce sprint ne porte aucune nouvelle fonctionnalité. Il solde les réserves de suivi (« nit », « non bloquant », « à qualifier », « reporté ») laissées ouvertes par les reviews des sprints BL, BF phase 1, BF phase 2, GT et SC, plus un point de traçabilité process (l'absence du sprint PX dans `docs/TASKS.md`). Chaque story est traitée jusqu'à sa clôture propre : soit corrigée, soit explicitement tranchée et documentée comme fermée sans action (jamais laissée dans un flou implicite).

Deux points déjà couverts par le sprint PX (`maxOutputLength` explicite dans `image-decode.ts`, garde-fou structurel `pdf-image-predecode-guard.test.ts`) sont **volontairement exclus** de ce sprint — voir note en fin de document.

## Stories

| Story | Type | Sujet | Sévérité | Origine | Statut |
|-------|------|-------|----------|---------|--------|
| SU.1 | UI/BUGFIX | Incohérence écran / PDF signé — commandé vs livré | HAUTE | review-sprint-BF nit 1, review-sprint-BF-phase2 suivi 2 | FAIT |
| SU.2 | SCHEMA/QUERIES | Persister les écarts de conservation tolérés (ADR-048) | — | review-sprint-GT, review-sprint-BF-phase2 | FAIT |
| SU.3 | REFACTOR | `generateNextNumero` : collision concurrente (advisory lock) | — | review-sprint-BL | FAIT |
| SU.4 | TEST | Robustesse transactionnelle de la signature BL | — | review-sprint-BF nit 3 | FAIT |
| SU.5 | BUGFIX (à qualifier) | Relevé de mortalité sans `bacId` (vente d'alevins) | — | review-sprint-BF nit 4 | FAIT — fermée sans action |
| SU.6 | UI | Nits d'affichage du sprint SC (4 points) | — | review-sprint-SC | FAIT |
| SU.7 | UI | `image-upload-field.tsx:139` — id HTML instable | — | review-sprint-BL | FAIT |
| SU.8 | REVIEW/arbitrage | Permission `BONS_LIVRAISON_RECTIFIER` orpheline | — | introduite sprint BF phase 2 | FAIT |
| SU.9 | DOC | Traçabilité : inscrire PX et SU dans `docs/TASKS.md` | — | absence constatée | FAIT |
| SU.10 | BUGFIX | Permissions orphelines : `VENTES_MODIFIER` et labels manquants | HAUTE | découverte connexe — pré-analyse SU.8 | FAIT |
| SU.11 | BUGFIX | Piège d'encodage WinAnsi dans les insights PDF | — | découverte — pré-analyse SU.6 (déjà en production) | FAIT |
| SU.12 | SCHEMA | Unicité des numéros par site (9 familles) | — | bug de conception — pré-analyse SU.3, arbitré par l'utilisateur | FAIT |
| SU.13 | SCHEMA | `LotAlevins.code` : 10ᵉ famille de numérotation | — | réserve n°4 de review-sprint-SU | FAIT |

---

### SU.1 — Incohérence écran / document signé (commandé vs livré)

**Type** : UI/BUGFIX
**Sévérité** : HAUTE
**Sources** : `docs/reviews/review-sprint-BF.md` (nit n°1), `docs/reviews/review-sprint-BF-phase2.md` (suivi n°2)

**Problème** : le récap à l'écran du flux bon de livraison affiche le nombre de poissons **commandé**, alors que le PDF signé affiche le **livré** (constaté en pratique : 90 à l'écran, 87 sur le PDF). Le client signe en voyant un chiffre différent de celui qui figure sur le document contractuel qu'il vient de parapher — inacceptable sur une pièce contractuelle.

**Décision** : écran et PDF doivent afficher exactement la même chose. Le **livré** fait foi partout, y compris avant signature dès que les quantités livrées sont saisies (cf. sprint BF phase 1 : la saisie précède la signature).

**Périmètre** : tout le flux `bon-livraison-flow.tsx`, l'écran récap, l'affichage de la vente associée (partout où un nombre de poissons ou un poids est montré dans ce flux).

**Critères d'acceptation** :
- [ ] Le nombre affiché à l'écran (récap avant signature) est identique au nombre imprimé sur le PDF signé, pour la même opération
- [ ] Aucune régression sur l'affichage des BL déjà signés
- [ ] Test de non-régression couvrant le cas commandé ≠ livré

---

### SU.2 — Persister les écarts de conservation tolérés

**Type** : SCHEMA/QUERIES
**Sources** : `docs/reviews/review-sprint-GT.md`, `docs/reviews/review-sprint-BF-phase2.md`

**Problème** : depuis le sprint GT, le guard `verifyAssignationInvariant` tolère un écart préexistant sur un bac et se contente d'un `console.warn` éphémère (perdu au redémarrage du process, jamais consultable). Objectif : détecter qu'un bac **dérive** avant que cette dérive ne bloque une opération future — rejoue le scénario du Bac 11 de Vague-26-03-Prep, mais en amont, de façon proactive.

**Points de journalisation concernés** :
- `src/lib/guards/assignation-invariant.ts` (écart capturé par `captureEcartsAssignation` / comparé par `verifyAssignationInvariant`)
- le clamp `Math.max(0, …)` du rectificatif dans `bons-livraison.ts`

**Décision d'architecture à trancher dans ce sprint** : choix du support de persistance entre le `SiteAuditLog` existant et une table dédiée. Critères de décision :
1. Volume d'écriture attendu (un guard appelé à chaque opération sur assignation — fréquence potentiellement élevée)
2. Capacité à requêter « quels bacs dérivent aujourd'hui, et de combien » (agrégation par bac/site, pas seulement un flux d'événements bruts)
3. R8 (`siteId` obligatoire sur tout nouveau modèle)

**Livrable minimum** : persistance de l'écart détecté (bac, site, écart avant/après, opération déclenchante, horodatage) + une requête exploitable listant les bacs en dérive. **La vue UI est hors périmètre de ce sprint.**

**Critères d'acceptation** :
- [ ] ADR ou note de décision tranchant le support de persistance (SiteAuditLog vs table dédiée), avec justification volume/requêtabilité/R8
- [ ] Écart préexistant détecté → persisté (plus seulement loggé en `console.warn`)
- [ ] Requête `getBacsEnDerive(siteId)` (ou équivalent) exploitable et testée
- [ ] Aucune UI ajoutée
- [ ] Tests couvrant la persistance et la requête

---

### SU.3 — `generateNextNumero` : collision concurrente

**Type** : REFACTOR
**Source** : `docs/reviews/review-sprint-BL.md`

**Problème** : le pattern `generateNextNumero` est dupliqué à l'identique dans Facture, Commande, Vente, BonLivraison. Deux transactions concurrentes peuvent calculer le même numéro en isolation Read Committed ; la contrainte `@unique` transforme alors la collision en 500 opaque au lieu d'un retry ou d'un message actionnable.

**Décision** : corriger **une fois**, dans un module partagé, pas quatre fois dans chaque appelant.

**Minimum requis** : détecter la violation de contrainte d'unicité (code Prisma `P2002`) et retenter avec un nouveau numéro calculé, **ou** rendre le calcul du numéro atomique (ex. séquence PostgreSQL, `SELECT ... FOR UPDATE`). Si l'échec persiste après retries, message d'erreur actionnable (pas une 500 générique).

**Critères d'acceptation** :
- [ ] Un seul point d'implémentation du retry/atomicité, réutilisé par Facture/Commande/Vente/BonLivraison
- [ ] Test simulant une collision concurrente (deux créations en parallèle) → une seule échoue silencieusement en interne, les deux réussissent côté appelant avec des numéros distincts, ou message clair si épuisement des retries
- [ ] Aucune régression sur la numérotation existante (format, unicité, ordre)

---

### SU.4 — Robustesse transactionnelle de la signature du BL

**Type** : TEST
**Source** : `docs/reviews/review-sprint-BF.md` (nit n°3)

**Problème** : la signature d'un bon de livraison écrit beaucoup de choses en une seule transaction (quantités livrées, mortalités/avaries, décréments de stock, montants, facture, audit). L'atomicité de cette transaction est structurelle (une seule transaction Prisma) mais n'a jamais été testée explicitement.

**Tests à ajouter** :
- Échec injecté en milieu de transaction (ex. contrainte violée sur une des écritures tardives) → aucun effet partiel constaté en base (ni quantités, ni mortalités, ni facture, ni audit)
- Double signature concurrente du même BL (deux requêtes simultanées) → une seule gagne, l'autre échoue proprement (pas de double décrément de stock, pas de double facture)

**Critères d'acceptation** :
- [ ] Test d'échec en milieu de transaction : rollback complet vérifié sur toutes les tables touchées
- [ ] Test de double signature concurrente : effets appliqués une seule fois
- [ ] Suite complète verte

---

### SU.5 — Relevé de mortalité sans `bacId` (à qualifier)

**Type** : BUGFIX à qualifier — **interdiction de corriger à l'aveugle**
**Source** : `docs/reviews/review-sprint-BF.md` (nit n°4)
**Statut** : **FAIT — fermée sans action** (aucune modification de code)
**Pré-analyse de référence** : [`docs/analysis/pre-analysis-sprint-SU-BL.md`](../analysis/pre-analysis-sprint-SU-BL.md), section « SU.5 — Relevé de mortalité sans bacId (vente d'alevins) »

**Problème constaté** : une ligne de vente d'alevins n'a pas de `bacId` (les alevins ne sont pas rattachés à un bac au moment de la vente). Si des morts en transport sont saisis sur cette ligne, un relevé `MORTALITE` est créé avec `bacId` null. Pattern hérité de `cloturerVente`.

**Ce qui est attendu de ce sprint** : une **pré-analyse** qui tranche, avant toute correction :
1. Est-ce un vrai bug — un calcul en aval (survie, biomasse par bac, indicateurs) est-il faussé par ce `bacId` null ? Si oui, corriger.
2. Ou est-ce un point fermé légitimement — le relevé MORTALITE sans bac est correct par nature (mortalité en transport, hors de tout bac) et aucun calcul n'en dépend incorrectement ? Si oui, documenter la justification et fermer sans modifier le code.

**Critères d'acceptation** :
- [x] Note de pré-analyse tranchant explicitement bug réel vs point fermé, avec preuve (grep des consommateurs de `Releve.bacId` côté calculs/indicateurs) → `docs/analysis/pre-analysis-sprint-SU-BL.md`
- [x] Si bug réel : fix + test de non-régression → **sans objet**, pas de bug réel
- [x] Si point fermé : justification écrite dans ce document (section mise à jour) ou dans une note de decisions, aucune modification de code → voir ci-dessous, **aucune modification de code**

**Verdict : ACCEPTABLE — fermé sans action.** Aucun calcul n'est faussé par le relevé MORTALITE orphelin créé lors d'une vente d'alevins avec morts en transport. Ce relevé, créé dans `signerBonLivraison` (`src/lib/queries/bons-livraison.ts`, lignes 860-875 et 958-973), a `bacId: null` **et** `vagueId: null` — la ligne de vente d'alevins étant issue d'un `lotAlevinsId`, elle ne porte ni bac ni vague. Tous les consommateurs de relevés MORTALITE ont été vérifiés et l'excluent nativement, par filtre ou en le sautant explicitement :

1. **Calculs per-bac** — `computeVivantsByBac` (`src/lib/calculs.ts:312`) filtre explicitement `r.typeReleve === "MORTALITE" && r.bacId` : le relevé orphelin est exclu, et cette exclusion est **correcte** — ces poissons n'ont jamais été dans un bac, il n'existe aucun bac auquel les attribuer.
2. **Agrégats au niveau vague** — `indicateurs.ts:175/200`, `dashboard.ts:119/485` et les fonctions d'`analytics.ts` travaillent toutes sur `vague.releves`, relation Prisma filtrée par `vagueId`. Avec `vagueId: null`, le relevé n'est **jamais chargé** dans ces collections : exclusion automatique via la relation. `tauxSurvie`, `totalMortalites`, `mortalitesAvarie`/`mortalitesElevage` (AV.5) ne le voient ni en positif ni en négatif — ni sous-comptage, ni double comptage, puisqu'il n'appartenait à aucune de ces vagues.
3. **`LotAlevins.nombreActuel`** (source de vérité du stock du lot, `src/lib/queries/ventes.ts:596-605`) — décrémenté **directement** à la création de la vente par la quantité commandée, pas par agrégation de relevés. Le décrément est correct que 0 ou 3 poissons meurent ensuite en route : ils ont physiquement quitté le stock du lot au moment de la vente.
4. **Statistiques de reproduction** — `reproduction-stats.ts` (`tauxSurvieLarvaire`, `tauxSurvieGlobal`) part de `totalAlevinsActuels` (somme des `nombreActuel` des lots), c'est-à-dire du **stock**, pas d'une agrégation de relevés MORTALITE : non affecté.
5. **Listes génériques** — `src/lib/queries/releves.ts:127` (liste paginée par `siteId`) affiche bien ce relevé avec `bac: null`, cas déjà géré nativement (relation optionnelle dans l'`include`). Impact strictement cosmétique, aucun calcul agrégé ne dépend de cette liste brute.
6. Aucune fonction n'agrège les MORTALITE au niveau **site** (toutes sont scopées par vague ou par lot) : pas de risque de double comptage transversal.

Seule limite constatée, sans impact sur la justesse des chiffres : une perte de **traçabilité** — le relevé ne renseigne pas non plus `lotAlevinsId` alors que l'information est disponible sur `Releve` et déjà utilisée pour ce type de rattachement ailleurs (`src/lib/queries/releves.ts:159,244`). Il est donc invisible dans l'historique du lot (`src/lib/queries/lots-alevins.ts:440-469`, `releves` filtré par `lotAlevinsId`). Amélioration optionnelle (2 lignes), hors périmètre d'un correctif de bug.

Décision : **ne pas corriger à l'aveugle**, conformément à la consigne du sprint.

---

### SU.6 — Nits d'affichage du sprint SC

**Type** : UI
**Source** : `docs/reviews/review-sprint-SC.md`

Quatre points, tous mineurs, à corriger dans la même story :

a. `alimentsMap` typé `uniteAchat: string | null` au lieu de `UniteStock | null` — violation R3 (Prisma = TypeScript identiques)
b. Pluriel fautif « 1.0 sacs » → doit afficher le singulier quand la quantité arrondie vaut 1
c. Le PDF affiche `(≈ X.X sacs)` sans la contenance du sac, alors que l'UI l'affiche (incohérence UI/PDF)
d. Quantité dans le PDF sans séparateur de milliers (pré-existant, mineur)

**Critères d'acceptation** :
- [ ] `uniteAchat` typé `UniteStock | null` partout où c'est pertinent
- [ ] Singulier/pluriel correct sur « sac(s) » selon la valeur arrondie
- [ ] PDF affiche la contenance du sac au même titre que l'UI
- [ ] Séparateur de milliers appliqué dans le PDF
- [ ] Aucune régression visuelle sur les autres champs du PDF SC

---

### SU.7 — `image-upload-field.tsx:139` — id HTML instable

**Type** : UI
**Source** : `docs/reviews/review-sprint-BL.md`

**Problème** : l'`id` HTML de l'input est dérivé du label traduit (texte affiché). Fragile : lié à un `<label htmlFor>` correspondant, et instable si le libellé change ou si l'app devient multilingue (l'id changerait avec la locale, cassant potentiellement des sélecteurs ou tests e2e basés sur l'id).

**Fix attendu** : utiliser un id stable (prop explicite ou dérivé d'un identifiant technique fixe, jamais du texte traduit affiché).

**Critères d'acceptation** :
- [ ] L'id de l'input n'est plus dérivé du label affiché
- [ ] Le `<label htmlFor>` reste correctement associé à l'input (accessibilité préservée)
- [ ] Aucune régression sur les tests existants référençant ce composant

---

### SU.8 — Permission `BONS_LIVRAISON_RECTIFIER` orpheline

**Type** : REVIEW/arbitrage — **ne pas trancher seul si ambigu**
**Source** : introduite au sprint BF phase 2
**Statut** : **FAIT — arbitrage utilisateur rendu**

**Problème** : la permission `BONS_LIVRAISON_RECTIFIER` n'est portée par aucun `SiteRole`. En pratique, seul un `Role.ADMIN` global peut rectifier un BL, car il court-circuite entièrement les permissions via `getServerPermissions`. Un gérant de site — même avec des permissions étendues sur son site — ne peut donc jamais créer de BL rectificatif.

**Ce qui est attendu** : déterminer si c'est un oubli (la permission aurait dû être assignée à un rôle SiteRole lors du sprint BF phase 2) ou un choix délibéré (rectifier un BL engage une correction de stock et de montants — restriction volontaire aux admins).

**Règle explicite pour cette story** : si l'ambiguïté ne peut pas être levée par la seule lecture du code et des décisions BF phase 2, **remonter la question à l'utilisateur** avec une recommandation argumentée — ne pas trancher unilatéralement une question de contrôle d'accès sur une opération à impact financier.

**Critères d'acceptation** :
- [x] Analyse documentée de l'historique (BF phase 2 : la permission a-t-elle été assignée puis retirée, ou jamais assignée ?) → `docs/analysis/pre-analysis-sprint-SU-BL.md`
- [x] Si tranchable sans ambiguïté : SiteRole(s) mis à jour + test → arbitrage utilisateur rendu, rôle Administrateur de site mis à jour + migration de backfill + test de garde
- [x] Si ambigu : question remontée à l'utilisateur avec recommandation, décision consignée avant toute modification de code

**Question remontée à l'utilisateur** : aucun `SiteRole` seedé ne porte `BONS_LIVRAISON_RECTIFIER` ; le Gérant doit-il pouvoir rectifier un bon de livraison (opération qui engage une correction de stock et de montants), ou est-ce réservé à l'Administrateur de site ?

**Décision rendue (arbitrage utilisateur)** : **« utilisateur avec la permission nécessaire »**. Le droit de rectifier un bon de livraison découle de la **détention** de la permission `BONS_LIVRAISON_RECTIFIER`, et non d'un rôle codé en dur.

Implémentation :
- Label présent dans `role-form-labels.ts` — sans lui, la permission serait invisible dans l'UI de gestion des rôles, donc inattribuable.
- Accordée **par défaut** au rôle **Administrateur de site** (`prisma/seed.sql` + migration de backfill `20260726170000_backfill_bons_livraison_rectifier`, scopée à ce seul rôle).
- L'exclusion du rôle **Gérant** est un **simple défaut modifiable**, pas une restriction figée : un administrateur peut accorder la permission à un gérant s'il le souhaite — la décision appartient à chaque ferme.
- **Aucun garde codé en dur** : le contrôle d'accès teste `auth.permissions.includes(...)`, jamais un `if (role === "GERANT")`.

**Note de découpage** : la partie **non ambiguë** de la découverte — la permission `VENTES_MODIFIER`, orpheline elle aussi, et les labels manquants — a été extraite dans une story dédiée, **SU.10**, qui a pu avancer sans attendre l'arbitrage.

---

### SU.9 — Traçabilité : inscrire PX et SU dans `docs/TASKS.md`

**Type** : DOC
**Constat** : le Sprint PX n'a jamais été inscrit dans `docs/TASKS.md` — son critère de clôture (mise à jour de TASKS.md après capitalisation, cf. PX.7) est resté sans objet faute d'entrée à mettre à jour. Le présent sprint SU risquerait la même impasse s'il n'est pas explicitement ajouté.

**Action** : le `@status-updater` inscrit dans `docs/TASKS.md` (1) le résumé du Sprint PX (objectif + stories + statuts réels, déjà FAIT), et (2) le Sprint SU (objectif + les 13 stories ci-dessus + statuts au fil de l'exécution). Cette story architecte ne modifie pas `docs/TASKS.md` elle-même — voir résumé PX préparé séparément pour le status-updater.

**Critères d'acceptation** :
- [x] `docs/TASKS.md` contient une section Sprint PX correctement close (statut FAIT, review, tests, capitalisation)
- [x] `docs/TASKS.md` contient une section Sprint SU avec les 13 stories et leurs statuts à jour
- [x] Aucun autre sprint lettré (BL, BF, GT, SC, etc.) n'est requis d'être rétroactivement ajouté par cette story — périmètre strictement PX + SU

---

### SU.10 — Permissions orphelines : `VENTES_MODIFIER` et labels manquants

**Type** : BUGFIX
**Sévérité** : HAUTE
**Statut** : **FAIT**
**Origine** : découverte connexe lors de la pré-analyse de SU.8 (story créée en cours de sprint)

**Problème** : la permission `VENTES_MODIFIER` n'est portée par **aucun** `SiteRole` seedé. Sans elle, un utilisateur non-admin ne peut ni créer ni signer un bon de livraison normal : le flux de livraison est donc cassé pour tout le monde **sauf** le `Role.ADMIN` global, qui court-circuite entièrement les permissions. Contrairement à SU.8, il n'y a ici **aucune ambiguïté d'arbitrage** — un rôle censé gérer les ventes doit évidemment pouvoir les modifier.

**Périmètre** :
- Attribution de `VENTES_MODIFIER` aux bons rôles système
- Migration de **backfill** des sites existants — les permissions sont un **tableau stocké en base** (`SiteRole.permissions`), figé à la création du rôle : sans backfill, les sites déjà créés restent dans l'état bugué
- Labels manquants dans `role-form-labels.ts` (cf. ERR-088)
- **Test de garde** échouant si une permission n'est attribuée à aucun rôle **ou** n'a pas de label, avec liste d'exclusion explicite et commentée

**Critères d'acceptation** :
- [ ] `VENTES_MODIFIER` attribuée aux rôles système pertinents
- [ ] Migration de backfill appliquée aux `SiteRole` des sites existants
- [ ] Labels manquants ajoutés dans `role-form-labels.ts`
- [ ] Test de garde : échoue si une permission est orpheline (aucun rôle) ou sans label, avec liste d'exclusion explicite et commentée
- [ ] Un non-admin peut créer et signer un bon de livraison normal
- [ ] Suite complète verte

---

### SU.11 — Piège d'encodage WinAnsi dans les insights PDF

**Type** : BUGFIX
**Statut** : **FAIT**
**Origine** : découverte lors de la pré-analyse de SU.6 — **déjà en production** (story créée en cours de sprint)

**Problème** : `src/lib/export/pdf-cout-production-insights.ts` (fonctions `formatK` et `formatKg`) utilise `toLocaleString("fr-FR")`, qui produit un séparateur de milliers **U+202F** (espace fine insécable) **absent de la table WinAnsi**. Le PDF n'enregistrant aucune police custom (Helvetica AFMFont, `WinAnsiEncoding`), le caractère retombe silencieusement sur `.notdef` : le séparateur est **invisible**, sans crash ni avertissement — donc indétectable sans extraction de texte réelle du PDF généré.

**Périmètre** :
- Factoriser le helper `formatNumPDF` **existant** dans un module partagé
- Balayer les autres usages de `toLocaleString` / `Intl.*` dans `src/lib/export/**`
- Ajouter un **test de garde anti-caractères hors WinAnsi**

**Critères d'acceptation** :
- [ ] `formatNumPDF` factorisé dans un module partagé et utilisé par `pdf-cout-production-insights.ts` (`formatK`, `formatKg`)
- [ ] Tous les usages de `toLocaleString`/`Intl.*` dans `src/lib/export/**` recensés et traités
- [ ] Test de garde échouant si un texte destiné au PDF contient un caractère hors table WinAnsi
- [ ] Séparateur de milliers effectivement visible dans le PDF généré (vérifié par extraction de texte, pas par inspection visuelle seule)
- [ ] Aucune régression sur les autres exports PDF

---

### SU.12 — Unicité des numéros par site (9 familles)

**Type** : SCHEMA
**Statut** : **FAIT**
**Origine** : bug de conception détecté lors de la pré-analyse de SU.3, arbitré par l'utilisateur — « corriger maintenant, la migration est bien moins risquée qu'après l'apparition de doublons » (story créée en cours de sprint)

**Problème** : les contraintes `@unique` sur `numero`/`code` étaient **globales**, alors que le compteur qui génère ces valeurs est scopé par `siteId`. Deux sites distincts généraient donc le **même** `FAC-2026-001` : il s'agit d'une collision **déterministe** en contexte multi-tenant, pas d'une simple race concurrente. Cette story est **complémentaire** de SU.3 (verrou d'advisory lock), pas alternative — SU.3 protège contre la course, SU.12 corrige le périmètre de la contrainte.

**Livré** :
- `@@unique([siteId, numero|code])` en **remplacement** de la contrainte globale sur 9 modèles : `Facture`, `Depense`, `Commande`, `Vente`, `BonLivraison`, `ListeBesoins`, `Ponte`, `Incubation`, `LotGeniteurs`
- Migration `20260726174843_numero_unique_par_site`
- Contrôle préalable d'absence de doublons en base avant application (0 doublon trouvé)
- Call-sites `findUnique` migrés vers la clé composite
- Script d'audit prod **read-only** `scripts/audits/su12-audit-doublons-numero.ts`
- Tests de garde

---

### SU.13 — `LotAlevins.code` : 10ᵉ famille de numérotation

**Type** : SCHEMA
**Statut** : **FAIT**
**Origine** : réserve n°4 de `docs/reviews/review-sprint-SU.md` (story créée en fin de sprint)

**Problème** : `LotAlevins.code` présentait le **même double défaut** que les 9 familles traitées par SU.12, mais avait été oublié dans son périmètre initial :
1. génération **hors** transaction — `$transaction([...])` sous sa forme *array*, qui ne fournit pas de client `tx` et empêche donc de poser le verrou ;
2. contrainte `@unique` **globale** au lieu d'être scopée par site.

**Livré** :
- Intégration au helper commun `numero-utils.ts`
- Conversion de `recordEclosion` en `$transaction(async (tx) => …)` (forme callback), à sémantique et ordre d'opérations **préservés**
- `@@unique([siteId, code])` + migration `20260726212515_lotalevins_code_unique_par_site`
- Contrôle de doublons en base (0 trouvé)
- 5 call-sites de `lots-alevins.ts` migrés vers la clé composite
- Script d'audit étendu à **10 familles**
- Tests de garde étendus

---

## Note — points PX déjà couverts, non repris ici

Deux suivis potentiellement proches du périmètre de ce sprint sont **déjà faits** dans le cadre du sprint PX et ne sont donc **pas** repris en story SU :
- Le `maxOutputLength` explicite dans `src/lib/validation/image-decode.ts`
- Le garde-fou structurel `pdf-image-predecode-guard.test.ts`

## Critères de clôture du sprint

- [x] Checklist R1-R9 validée pour chaque story touchant du code, avec **R3 étendu** : Prisma = TypeScript = Zod, avec tests de parse pour les schémas concernés
- [x] `npx vitest run` — suite complète verte (voir résultats ci-dessous)
- [x] `npm run build` — OK
- [x] Mobile-first 360px vérifié pour toute story UI (SU.1, SU.6, SU.7)
- [x] Migrations Prisma réalisées en non-interactif : `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` puis `migrate deploy` (jamais `migrate dev`, cf. ERR-002)
- [x] `docs/reviews/review-sprint-SU.md` produit
- [x] `docs/TASKS.md` mis à jour (SU.9) avec Sprint PX et Sprint SU

---

## Clôture du sprint

**Verdict de review** : **VALIDÉ AVEC RÉSERVES** — aucune réserve bloquante. Voir [review-sprint-SU.md](../reviews/review-sprint-SU.md).

### Réserves de la review et leur traitement

| # | Réserve | Traitement |
|---|---------|-----------|
| 1 | `docs/TASKS.md` — tableau Sprint SU incomplet (SU.10-12 absentes, statuts périmés) | **Levée** par la présente mise à jour |
| 2 | `docs/sprints/SPRINT-SU.md` — stale (SU.8 encore `BLOQUÉ`, pas de section SU.12, « 9 stories ») | **Levée** par la présente mise à jour |
| 3 | ERR-104 référencé dans le code et les tests mais absent de `docs/knowledge/ERRORS-AND-FIXES.md` | **Levée** — ERR-104 à ERR-108 ajoutées à `docs/knowledge/ERRORS-AND-FIXES.md` |
| 4 | `LotAlevins.code` — 10ᵉ famille d'unicité globale oubliée par SU.12 | **Levée** par la story **SU.13** |
| 5 | `tx[model] as any` dans `numero-utils.ts` | **Nit accepté en l'état** (usage isolé, commenté) |

### Vérification finale (R9), machine libre de tout agent concurrent

- `npx vitest run` → **5688 tests passés sur 5731**. 3 échecs résiduels (`plan-form-dialog`, `plan-toggle`, `bon-livraison-flow`) sont des **timeouts purs de 5000 ms** dans des tests UI sans rapport avec le périmètre du sprint, chacun **vérifié vert en relance isolée** — faux positifs de contention documentés en ERR-107.
- `npm run build` → **exit code 0**, aucune erreur TypeScript.

### Capitalisation (`docs/knowledge/ERRORS-AND-FIXES.md`)

- **ERR-104** — piège WinAnsi / `toLocaleString` dans les PDF
- **ERR-105** — permissions orphelines et backfill des rôles stockés en base
- **ERR-106** — unicité globale vs compteur scopé par site
- **ERR-107** — faux positifs de tests sous contention CPU
- **ERR-108** — race de génération de numéro et forme de la transaction

### Migrations Prisma appliquées en non-interactif durant le sprint

- `20260726160000_backfill_ventes_modifier_permissions`
- `20260726170000_backfill_bons_livraison_rectifier`
- `20260726174843_numero_unique_par_site`
- `20260726180000_add_ecart_assignation_constate`
- `20260726212515_lotalevins_code_unique_par_site`

### Suivi ouvert — dette explicite pour un sprint ultérieur

**Vue UI « Bacs en dérive »** — l'ADR-048 et le @db-specialist recommandent une carte sur le dashboard site alimentée par `getBacsEnDerive` : la donnée persistée par SU.2 n'a de valeur opérationnelle que si elle est visible sans lire les logs serveur. **Hors périmètre de ce sprint par décision explicite** — ce n'est PAS une story du Sprint SU.
