# Review — Story PR2q.2 : L'épargne dans le moteur

**Verdict : VALIDÉ.** Aucune réserve Critique ou Haute. Le périmètre strict `tauxEpargnePct` /
`resultatFCFA` / `epargneFCFA` / `calculerEpargne` est conforme sur tous les points, y compris ceux
issus d'ERR-138, ERR-140, ERR-141, ERR-142. Le rapport `@tester` a été vérifié par relecture
indépendante du code, pas pris pour argent comptant.

## Points vérifiés

1. **Pureté et Decimal strict** — `src/lib/previsions/tresorerie.ts:89-91` :
   `Decimal.max(0, resultat).times(tauxEpargnePct).dividedBy(100)`. Aucun `prisma.*`, aucun
   `await`, aucun I/O. `Decimal` de bout en bout, jamais `number`/`Math.max`. La JSDoc précise la
   convention d'échelle et l'obligation d'un site de conversion unique — auto-documentation qui
   prévient la récidive d'ERR-138.

2. **Migration `20260803170000_add_taux_epargne_pct`** —
   `ALTER TABLE "ParametresPrevision" ADD COLUMN "tauxEpargnePct" DECIMAL(65,30) NOT NULL DEFAULT
   30` dans un bloc `DO $$ ... IF NOT EXISTS ... END $$`. R10 : versionnée dans un sous-dossier
   avec `migration.sql`, `ADD COLUMN` pur, aucun `DROP` (ERR-140 ne s'applique pas, c'est une
   colonne neuve). Idempotence prouvée par la garde `information_schema.columns`. R7 : NOT NULL +
   DEFAULT 30 justifié en commentaire (une valeur absente produirait une épargne silencieusement
   nulle sans rejet explicite). Le backfill implicite d'`EXCEL-V12` est légitime et documenté.

3. **Échelle 0..100 vs fraction 0..1 (ERR-138)** — Grep exhaustif refait indépendamment : un seul
   `.dividedBy(100)` (dans `calculerEpargne`) ; `route-orchestration.ts` passe la valeur brute ; le
   loader ne fait qu'un `.toString()` → `new Decimal` sans division ; validation/UI/API en 0..100
   partout ; côté fixtures, un seul `pctFixtureVersMoteur`. Aucune double conversion ni absence de
   conversion.

4. **ERR-141 — consommation de bout en bout** —
   `previsions-scenario-loader-tauxepargne-e2e.test.ts` n'est pas court-circuité : il appelle
   réellement `chargerScenarioPourMoteur` puis `calculerProjectionScenario`, avec deux valeurs
   différentes du taux (10 et 50) transitant par la ligne de mapping du loader — celle-là même que
   `margeSecuriteAlevinsPct` avait laissée inerte tout un sprint sans qu'aucun test échoue.
   Vérifie `resultatFCFA` invariant au taux, le ratio exact `epargne(50)/epargne(10) == 5`, et
   `epargne = 0` sur les mois ≤ 0 et à taux 0. Le mock Prisma exerce le vrai code de mapping :
   suffisant pour la garantie ERR-141, et la distinction avec une intégration DB réelle est
   assumée, pas travestie.

5. **ERR-142 — Section C** — `runSectionC` appelle `calculerProjectionScenario`, la vraie fonction
   publique, et compare mois par mois : `resultatFCFA == revenusFCFA + apportsFCFA - depensesFCFA`
   ; `soldeFCFA[m] - soldeFCFA[m-1] == resultatFCFA[m]` ; `epargneFCFA == calculerEpargne(...)`
   appelée directement, jamais réimplémentée. Le commentaire explique honnêtement pourquoi ce
   grain ne compare pas directement aux fixtures (le builder construit
   `postes: []`/`journal: []`/`apports: []`, structurellement divergent du jeu d'or — une
   comparaison directe produirait un faux écart). Justification honnête, pas un contournement : la
   formule reste prouvée contre le jeu d'or au point 6.

6. **Non-tautologie** — `fixture.resultats.epargne[i]` est lu tel quel depuis le JSON, jamais
   recalculé ; `buildChaineFinanciereCalendrier` appelle réellement `calculerEpargne` importée du
   moteur. Aucune formule dupliquée localement.

7. **Identité `resultatFCFA` = delta de trésorerie** — `revenusFCFA + apportsFCFA - depensesFCFA`
   et `soldePrécédent + revenus - depenses + apports` sont algébriquement identiques, et ce n'est
   pas seulement supposé : prouvé numériquement sur la sortie réelle de `genererSerieTresorerie`,
   tolérance ≤ 1 FCFA.

8. **Deux sérialiseurs synchrones** — `calculer/route.ts` et
   `previsions-scenario-detail-page.tsx` exposent tous deux `n(m.resultatFCFA)` / `n(m.epargneFCFA)`
   de façon identique. Le risque documenté de désynchronisation est neutralisé.

9. **i18n** — clé `tauxEpargnePct` présente en fr et en, accents corrects (« Taux d'épargne (%) »
   / « Savings rate (%) », « déficitaire »), consommée via le mécanisme générique existant, aucune
   chaîne en dur.

10. **R1-R11** — R3 OK (`Decimal @default(30)` ↔ `tauxEpargnePct: number`, non nullable des deux
    côtés). R8 OK (`siteId` threadé dans `updateParametresPrevision`, `chargerScenarioPourMoteur`,
    `auth.activeSiteId` côté route). R9, R10, R11 OK. R1/R5/R6 non applicables.

11. **Fixtures du jeu d'or** — `git diff --stat prisma/fixtures/previsions/` vide, revérifié
    indépendamment.

## Réserve

**Basse, informative, hors périmètre** : `updateParametresPrevision`
(`src/lib/queries/previsions-scenarios.ts`) reste un `findFirst({ siteId })` suivi d'un
`update({ where: { scenarioId } })`, donc pas strictement atomique au sens R4 (une suppression
concurrente entre les deux appels laisserait passer l'update). Pattern **préexistant**, non
introduit par PR2q.2 — signalé pour information, pas comme réserve de cette story.
