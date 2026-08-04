# Review — Story PR2q.3 : Compléter la vue Prévisions mensuelle

**Verdict : VALIDÉ AVEC RÉSERVES.** Périmètre revu : uniquement les lignes du classeur et leur
rapprochement au jeu d'or. Les ventilations de PR2q.4, développées en concurrence sur les mêmes
fichiers, sont explicitement **hors périmètre** de cette review.

## Points vérifiés

1. **Aucune branche par nom de ligne (ERR-156)** — `LigneDescriptor` porte
   `accessor`/`totalMode`/`format`/`label`/`formule` ; `calculerTotalLigne()` et `formatLigne()` sont
   des lookups génériques sur ces champs déclaratifs, jamais un `if (l.id === "...")`. Ajouter une
   ligne ne demande aucune retouche du JSX.

2. **`ceil` par granulométrie** — `ceilViaMoteur` est appelé à l'intérieur de la boucle par
   granulométrie, sur le `kgDuMois` d'une seule granulométrie ; les sacs déjà arrondis sont ensuite
   sommés. C'est bien la somme des `ceil`, jamais le `ceil` du total — conforme à la vérification
   n°1 du README du jeu d'or. Cohérent avec la preuve par mutation du @tester (`+1` injecté → 162
   tests en échec, restauration checksum-identique).

3. **Non-tautologie de la Section D** — chaque valeur attendue vient d'un champ de fixture
   (`fixture.entrees.*`, `fixture.besoinsAliments.*`, `fixture.depenses.alevinsCommandes`). Une
   seule exception, assumée et documentée en JSDoc : le test « Total des entrées dégénère à
   `revenusFCFA` » compare une dérivation à elle-même parce que le jeu d'or n'a aucune ligne de
   saisie d'apports (cas ERR-154). Limite honnêtement signalée, pas une tautologie cachée.

4. **Granulométries dynamiques et référentiel unique** — les lignes sont construites depuis l'union
   des clés réellement présentes, aucun 2/3/4 mm codé en dur ; un scénario à un nombre différent de
   calibres reste correct. Les libellés réutilisent `stock.json` (`taillesGranule.G1` = « G1 —
   Granulé 2mm »…). Aucun second référentiel créé — conforme à ADR-053 §12.2.4.

5. **Formats §7.4** — `formatEntierPrevision` pour `alevinsACommanderNb`, `sacsAlimentsTotal`,
   `sacsParGranulometrie.*`, `besoinAlimentsTotalKg` (jamais `formatMontantPrevision`, aucun suffixe
   FCFA) ; `formatMontantPrevision` pour les lignes monétaires ; `formatTonnagePrevision` (1
   décimale) pour `empoissonneKg`/`ventesKg` ; négatifs via `classeMontant()` → `text-danger`
   (variable de thème, R6) ; unité dans le libellé de ligne, non répétée par cellule en desktop.

6. **Explicabilité** — chaque ligne porte son bouton d'explication, desktop et mobile ;
   `<PopoverTrigger asChild>` confirmé (R5). Les textes d'explication décrivent la vraie formule,
   vérifié contre le code.

7. **Deux sérialiseurs** — `calculer/route.ts` et `previsions-scenario-detail-page.tsx` sont
   identiques champ pour champ, y compris les 6 nouveaux champs et l'objet `logistique` imbriqué.

8. **Réserves :**
   - **Basse** — clé i18n morte `previsionsMensuellesTab.sectionToggleAria` (fr + en), jamais
     référencée. Les boutons de bascule ont **déjà** un nom accessible par leur texte visible :
     aucune régression d'accessibilité, la clé est réellement superflue. *(Soldée depuis par le
     @developer de PR2q.4, qui l'a supprimée des deux langues.)*
   - **Documentaire** — la note annonçait « 8 → 30 lignes affichées » ; le compte réel de lignes
     rendues est **19** (4 + 3 + 2 statiques + 3 dynamiques + 7). « 30 » est le total du classeur,
     dont 13 (lignes 11-23) sont hors périmètre assumé. *(Corrigée depuis dans `docs/sprints/` et
     `docs/TASKS.md`.)*

9. **Périmètre** — lignes 11-23 absentes (grep `detailVague|parVague` négatif) ; fixtures,
   `extract-golden.py` et `.xlsx` inchangés ; moteur pur non touché (`route-orchestration.ts` est la
   couche d'orchestration, autorisée). Cas d'école ERR-153 correctement appliqué : des grandeurs
   déjà calculées puis perdues ont été propagées jusqu'au DTO plutôt que recalculées côté composant.

10. **R1-R11** — R2, R5, R6, R9 OK ; R3 OK (`MoisProjectionResult` en Decimal et
    `MoisProjectionDTO` en number alignés champ à champ, conversion explicite) ; R8 non applicable
    (`siteId` déjà appliqué en amont par `chargerScenarioPourMoteur(id, auth.activeSiteId)`) ; aucun
    `any`.

11. **Mobile 375 px** — la carte utilise le **même** tableau `SECTIONS` que le desktop : pas de mur
    de 19 lignes, les 4 sections repliables s'appliquent identiquement. Les 5 tests ajoutés par le
    @tester couvrent l'état initial des sections, l'ouverture de Production et d'Aliments, la
    présence du bouton d'explication et la navigation entre mois.
