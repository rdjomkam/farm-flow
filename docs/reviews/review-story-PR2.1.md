# Review Story PR2.1 — Module Prévisions (queries Prisma)

**Reviewer :** @code-reviewer
**Sprint :** PR2
**Story :** PR2.1 — Queries Prisma
**Verdict global : VALIDÉ AVEC RÉSERVES**

Aucun finding Critique. Pipeline `pre-analyst → db-specialist → tester → code-reviewer →
knowledge-keeper`.

---

## Points conformes vérifiés

- **R8 exhaustif** : chaque lecture et écriture filtre `siteId`, y compris sur les enfants dans
  `chargerScenarioPourMoteur`.
- **R4 respecté** sur tous les remplacements en bloc (`replacePaliersRemise`,
  `replaceRepartitionsMoisAliment`, `createAlimentPrevision`, `scinderVaguePrevue`,
  `replaceAlimentsParVaguePrevue`), avec la validation **avant** le `deleteMany`, dans la même
  transaction.
- **Conversion Decimal** centralisée et correcte dans `decimal-io.ts` (`.toString()`, jamais de
  `.toNumber()` intermédiaire).
- **Pas de N+1** : 7 requêtes constantes, mesurées.
- **Règles métier ADR respectées** : aucune fonction `deleteVaguePrevue`, scission avec
  `dureeCycleMoisFigee` copiée depuis le parent et non depuis le scénario courant.
- **Qualité des tests bonne** : le faux Prisma `previsions-fake-db.ts` est honnête sur ses
  limites et simule un rollback réel sur violation d'unicité.
- **Recette moteur intacte** à 842/842.
- **Diff de `src/lib/previsions/aliments.ts`** confirmé JSDoc-only.
- **Aucun débordement de périmètre PR3.**

---

## Checklist R1-R11

| Règle | Statut | Note |
|-------|--------|------|
| R1 (enums MAJUSCULES) | ✅ | |
| R2 (import enums) | ✅ | |
| R3 (Prisma=TS) | ✅ | |
| R4 (opérations atomiques) | ✅ avec réserves | voir findings 2 et 3 |
| R5 (DialogTrigger asChild) | N/A | pas d'UI dans le périmètre |
| R6 (CSS variables du thème) | N/A | pas d'UI dans le périmètre |
| R7 (nullabilité) | ✅ | |
| R8 (siteId) | ✅ | |
| R9 (tests avant review) | ✅ | |
| R10 (correctif de données = migration) | N/A | |
| R11 (aucun secret en dur) | ✅ | |

---

## Tableau des findings

| # | Sévérité | Fichier | Emplacement | Description |
|---|----------|---------|--------------|--------------|
| 1 | **Haute** | `src/lib/queries/previsions-charges.ts` | `createPostePrevision`, `upsertChargeMensuelle` | Aucune garde `assertEntierColonneInt` sur `PostePrevision.ordre` et `ChargeMensuellePrevue.moisAbsolu`, deux colonnes `Int` alimentées par un DTO externe. Même classe de bug (troncature silencieuse par Prisma) déjà prouvée empiriquement et corrigée ailleurs dans cette story, non répliquée ici. Risque : un `moisAbsolu` fractionnaire tronqué peut silencieusement écraser ou fusionner le mauvais mois via `@@unique([posteId, moisAbsolu])` — corruption de données financières sans aucun signal. |
| 2 | Moyenne | `src/lib/queries/previsions-vagues.ts` | `annulerVaguePrevue` | Check-then-update : lecture de `vagueReelleLiee` puis `update({ where: { id } })` sans reconditionner l'écriture — fenêtre de course théorique entre le check métier et l'écriture. |
| 3 | Basse | `src/lib/queries/previsions-charges.ts` | `deleteJournalDepensePrevue` | Check-then-delete (`findFirst` avec `siteId` puis `delete({ where: { id } })` sans `siteId`). Risque théorique. |
| 4 | Basse | `src/lib/queries/previsions-scenario-loader.ts` | JSDoc d'en-tête | « 6 requêtes » annoncé, 7 énumérées juste en dessous et 7 mesurées. Incohérence cosmétique de documentation. |

Le finding #1 est en cours de correction par le @db-specialist en parallèle de l'écriture de ce
rapport. Les findings #2 à #4 sont non bloquants.

---

## Verdict

**VALIDÉ AVEC RÉSERVES.** Aucun finding Critique. Le finding #1 (Haute) doit être corrigé avant
la clôture de la story (correction en cours en parallèle). Les findings #2 à #4 sont non
bloquants et peuvent être traités ultérieurement.
