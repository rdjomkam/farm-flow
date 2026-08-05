# Review Sprint PR3-bis — « L'écran d'administration du mapping »

**Reviewer :** @code-reviewer
**Scribe :** @architect (le @code-reviewer n'a aucun outil d'écriture ; ce rapport consigne
fidèlement ses constats oraux, en deux passes, sans rejugement)
**Sprint :** PR3-bis
**Verdict global (passe 1) : VALIDÉ SOUS RÉSERVE**
**Verdict global (passe 2 / contre-review) : VALIDÉ SOUS RÉSERVE**

Périmètre revu : `src/components/previsions/mapping-form-dialog.tsx`,
`src/components/previsions/rapprochement-mapping-tab.tsx`,
`src/components/previsions/mapping-rapprochement-helpers.ts`,
`src/messages/{fr,en}/previsions.json`, `src/messages/fr/depenses.json`,
`src/messages/fr/stock.json`, et les tests associés livrés par le @developer et le @tester.

---

## Passe 1 — review initiale

### Tableau des constats

| Sévérité | Fichier | Description | Correctif attendu |
|---|---|---|---|
| Moyenne | `src/components/previsions/mapping-form-dialog.tsx` (~l.82, l.236-247) | En édition d'une ligne dont le `cibleId` appartient à un autre scénario, la liste des options ne contient pas cette valeur : Radix `Select` affiche le placeholder alors qu'une valeur réelle est portée par l'état. L'administrateur peut croire qu'aucune cible n'est sélectionnée et écraser silencieusement une cible d'un autre scénario. | Option de repli explicite + alerte distincte du `scenarioWarning` générique |
| Basse | `src/messages/{fr,en}/previsions.json` | Clé `rapprochementTab.mapping.form.fields.cibleId.empty` présente en fr et en, jamais consommée — clé morte | La câbler ou la supprimer des deux langues |
| Basse | `src/components/previsions/__tests__/mapping-form-dialog.test.tsx` | Le chemin « GET du mapping actif échoue au moment du submit » n'est prouvé par aucun test (le code est correct : aucun POST n'est émis) | Ajouter un test `mockPost` non appelé + erreur affichée |

### Points de contrôle vérifiés avec preuve (14/14)

Les 14 points de contrôle de la passe 1 ont tous été vérifiés avec preuve :
- Sens unique ADR §5.1a (aucune écriture sur `Depense`/`Vente`/`MouvementStock`, seul
  `MappingRapprochement` est écrit).
- POST en bloc correct (remplacement complet du tableau, jamais un ajout unitaire).
- Textes de versionnement conformes à ADR §15.3, sans surpromesse.
- Référentiel de granulométrie existant réutilisé (`stock.produits.taillesGranule.*`, clé
  `INCONNU` ajoutée légitimement au bloc existant car issue d'un `COALESCE(..., 'INCONNU')` SQL).
- R5 : `DialogTrigger asChild` respecté.
- R6 : tokens du thème utilisés, aucune couleur en dur.
- `useDialogCloseGuard` non réimplémenté, pattern existant réutilisé tel quel.
- `TabsList` défilable préservé (aucun nouveau mécanisme de scroll inventé).
- Permissions `PREVISIONS_VOIR`/`PREVISIONS_PARAMETRER` gardées côté API et côté UI.
- Aucune 10ᵉ entrée dans `PREVISIONS_STATUS_MAP` (ADR §15.4).
- `src/lib/previsions/` non modifié (zone interdite respectée).
- Tests appelant réellement le code de production (ERR-171 respecté).

### Vérification navigateur réel (Chromium/Playwright, 375 px et 1280 px, ERR-157)

6 points vérifiés, tous OK sauf l'accentuation. Mesures :
- Onglets N1 : `scrollWidth 977 / clientWidth 343` sur **une seule rangée** défilable.
- Sous-onglets : `518 / 343`.
- `documentElement.scrollWidth = 375 = innerWidth` (aucun débordement de page).
- Dialog plein écran `0,0 → 375,812` non rogné, boutons atteignables, fermeture par Échap
  effective.
- Granulométries rendues « G2 — Granulé 3mm », « G3 — Granulé 4mm », « P1 — Poudre 0.5mm ».
- Aucune clé i18n brute à l'écran.

**Défauts remontés :**
1. Libellés de catégories non accentués (« Reparation », « Electricite », « Equipement »,
   « Veterinaire ») — **antérieurs au sprint**, à la source dans `src/messages/fr/depenses.json`
   et `src/messages/fr/stock.json`.
2. Message d'état vide affiché **deux fois** dans la carte « Mapping actif » (sous-titre du
   `CardHeader` + `CardContent`) — c'est l'état par défaut de tous les sites (0 ligne en base).
3. Cible précise non affichée dans la liste « Mapping actif » : seul le type de cible apparaissait,
   deux mappings vers deux postes différents étaient indiscernables.

**Contrôle :** `EXCEL-V12` strictement inchangé (19 vagues, 602 500 alevins, apports 30 000 000,
journal 34 400 000, charges 20 580 000, `ParametresPrevision` colonne par colonne y compris
`updatedAt`) ; site jetable `vpr3b_site` créé puis supprimé, 0 résidu sur 8 tables.

### Correctifs appliqués (C1→C6)

- **C1** : alerte explicite + option de repli pour la cible hors scénario.
- **C2** : clé `empty` câblée.
- **C3** : test GET-échoue-au-submit ajouté.
- **C4** : accents corrigés à la source dans `depenses.json`/`stock.json` fr (valeurs seulement,
  aucune clé renommée) + assertions de test mises à jour.
- **C5** : message d'état vide dédoublonné.
- **C6** : libellé de la cible affiché en liste via `libelleCible(...)`, jamais l'id brut.

---

## Passe 2 — contre-review

**Verdict : VALIDÉ SOUS RÉSERVE.**

C1→C6 tous jugés **CORRIGÉS**.

### Constats restants (sévérité Basse)

| Sévérité | Fichier | Description |
|---|---|---|
| Basse | `mapping-form-dialog.tsx:97` | `chargementCibles` initialisé à `false` : fenêtre de rendu d'une frame où l'alerte « cible hors scénario » pourrait s'afficher à tort |
| Basse | `rapprochement-mapping-tab.tsx:75-90` | Échec isolé de `postes`/`aliments` non testé, et le libellé « Cible introuvable dans ce scénario » est trompeur quand la cause réelle est un échec réseau |

### Constat Info, hors périmètre

`src/components/ventes/vente-detail-client.tsx` et
`src/components/ventes/depense-vente-dialog.tsx` portent des tables `CATEGORIE_LABELS` codées en
dur, non accentuées, indépendantes du référentiel i18n — dette préexistante à traiter séparément.

### Correctifs D1/D2 (post-contre-review)

- **D1** : `chargementCibles` devient un état **dérivé**
  (`open && cibleDataScenarioId !== scenarioId`), sans fenêtre de rendu.
- **D2** : nouveau libellé `cibleNonChargee` (« Cible non chargée » / « Target not loaded »)
  distinct de `cibleIntrouvable`, + test discriminant (1 test tombe si on revient à l'ancien
  appel).

---

## Risque connu, non corrigé, hors périmètre

`MappingRapprochement.cibleId` est **site-scopé** alors que `PostePrevision`/`AlimentPrevision`
sont **scénario-scopés** (ADR-053 §3.9). Un mapping créé contre un scénario A puis lu depuis un
scénario B ne matche aucune cible et le montant réel disparaît silencieusement (ni `RAPPROCHE` ni
`NON_RAPPROCHE`). Mitigation retenue pour ce sprint : peuplement des cibles depuis le scénario
affiché, avertissement explicite, alerte dédiée en édition. **Le correctif structurel reste à
concevoir dans une story dédiée.**

---

## Ce que la review n'a pas pu vérifier

Le `@code-reviewer` n'a pas d'outil shell : `npx vitest run`, `npm run build` et `git diff` n'ont
pas été rejoués par lui, il s'est appuyé sur le rapport du @tester. Le rendu navigateur des ajouts
C1/C6 et D1/D2 n'a pas été re-capturé après correctifs par la review elle-même.

---

## Note d'outillage

Ce rapport a été rédigé oralement par le @code-reviewer, qui ne dispose que des outils
Read/Glob/Grep (aucun outil d'écriture), en deux passes, et persisté dans ce fichier par
l'@architect agissant comme scribe à la demande du @project-manager.
