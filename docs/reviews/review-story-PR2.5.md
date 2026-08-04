# Review Story PR2.5 — Module Prévisions (Navigation et activation du module)

**Reviewer :** @code-reviewer
**Sprint :** PR2
**Story :** PR2.5 — Navigation et activation du module
**Verdict global : VALIDÉ AVEC RÉSERVES**

Aucun finding Critique, Haute ni Moyenne. Toutes les réserves sont documentaires ou de process,
aucune n'est un bug.

Périmètre revu : `src/components/layout/farm-sidebar.tsx`, `src/components/layout/farm-bottom-nav.tsx`,
`src/lib/site-modules-config.ts`, `src/lib/module-nav-items.ts`,
`src/messages/{fr,en}/navigation.json`, `src/__tests__/lib/site-modules-config.test.ts`,
`src/lib/permissions-constants.ts`, `src/components/abonnements/plan-form-dialog.tsx`.

---

## Points conformes vérifiés

- **Une seule entrée « Prévisions » au lieu des cinq du §7.3** : jugé correct et seul choix
  défendable. Câbler cinq `href` vers des routes inexistantes aurait produit des 404 dès que
  `SITE_MODULES_CONFIG` rend le module activable. L'alternative « onglets adressables par
  paramètre d'URL » aurait été plus fidèle au §7.3 mais aurait débordé du périmètre de PR2.5 en
  touchant `scenario-detail-client.tsx`, explicitement hors périmètre. L'écart est documenté à
  trois endroits (commentaires inline dans les deux fichiers de navigation, notes de clôture du
  sprint, pré-analyse) — il n'a pas été découvert en review. Réserve d'usage réelle : avec une
  seule entrée, l'utilisateur atterrit sur la liste des scénarios et doit découvrir seul les
  onglets internes. Le module reste utilisable, au prix d'une profondeur de clic supplémentaire.
- **`SITE_MODULES_CONFIG` activé** : correct. `labelKey: "Prévisions"` suit exactement le patron
  des 9 entrées existantes. Aucun lien mort : le seul href exposé (`/previsions/scenarios`)
  existe. `getModuleNavKey()` portait déjà `PREVISIONS` par nécessité de typage exhaustif, et la
  clé `modules.previsions` existe en fr et en — pas de régression.
- **i18n** : parité stricte fr/en vérifiée, `items.previsions` = « Prévisions » / « Forecasts ».
  Aucune clé asymétrique.
- **Dette PR1 réserve 5** : `modules.adminCommissions` et `modules.adminRemises` ajoutées en fr et
  en, avec des valeurs strictement identiques à celles de `common.json`. Correction complète et
  cohérente.
- **Gating** : desktop gaté au niveau du **groupe** (`PREVISIONS_VOIR` + `SiteModule.PREVISIONS`),
  mobile gaté au niveau de l'**item**, les deux corrects. Le non-câblage de l'override
  `ITEM_VIEW_PERMISSIONS["/previsions/parametres"]` est jugé **acceptable** : aucune route de ce
  nom n'existe, l'override aurait été cosmétique et trompeur.
- **Placement** : le groupe est inséré entre « Finances » et « Reproduction », symétriquement sur
  desktop et mobile. Défendable, quoique arbitraire.
- **Périmètre** : respecté, aucune référence nouvelle dans `src/components/previsions/`, ni au
  moteur, ni aux queries, ni aux routes API, ni au schéma.

---

## Checklist R1-R11

| Règle | Statut | Note |
|-------|--------|------|
| R1 (enums MAJUSCULES) | N/A | périmètre navigation, pas de nouvel enum |
| R2 (import enums) | ✅ | |
| R3 (Prisma=TS) | N/A | |
| R4 (opérations atomiques) | N/A | |
| R5 (DialogTrigger asChild) | N/A | |
| R6 (CSS variables du thème) | ✅ | |
| R7 (nullabilité) | N/A | |
| R8 (siteId) | N/A | |
| R9 (tests avant review) | ✅ | |
| R10 (correctif de données = migration) | N/A | |
| R11 (aucun secret en dur) | ✅ | |

---

## Tableau des findings

| Sévérité | Problème | Fichier | Action recommandée |
|---|---|---|---|
| Basse | `docs/sprints/SPRINT-PR2-PREVISIONS.md` édité directement par le @developer, alors que `docs/PROCESSES.md` réserve l'écriture de `docs/sprints/*.md` au `@status-updater`. **Ce n'est pas une dérive propre à PR2.5** : le même patron existe déjà pour PR2.1, PR2.2 et PR2.4 — c'est une dette de process transverse au sprint entier. | `docs/sprints/SPRINT-PR2-PREVISIONS.md` | À trancher explicitement avant PR3 : soit acter que le développeur peut écrire ses notes de clôture et amender `PROCESSES.md`, soit faire repasser ces sections par le `@status-updater`. |
| Basse | Entrée ajoutée « par cohérence documentaire » dans `module-nav-items.ts`, fichier déjà mort, avec un commentaire signalant l'absence d'effet. Aucun risque fonctionnel, mais alourdit un fichier mort ; un futur agent qui ne lirait pas le commentaire pourrait le croire vivant. Le commentaire référence en outre `ModuleSubNav`, composant qui n'existe plus. | `src/lib/module-nav-items.ts` | Ne plus enrichir ce fichier à chaque nouveau module ; programmer sa suppression (ou au minimum celle du commentaire obsolète) dans une story de nettoyage dédiée ; faire amender l'ADR-053 §6 par l'@architect pour qu'il cesse de désigner ce fichier comme la cible à éditer — c'est la source de la confusion répétée. |
| Basse | `SheetNavGroup.gatePermission` déclaré sur tous les groupes de `farm-bottom-nav.tsx` mais jamais lu par la logique de visibilité — champ mort global, préexistant, non imputable à cette story. | `src/components/layout/farm-bottom-nav.tsx` | Nettoyage global futur, hors PR2.5. |
| Info | Une seule entrée contre 5 prescrites au §7.3 — écart assumé et documenté, réduit la découvrabilité des onglets internes. | `farm-sidebar.tsx`, `farm-bottom-nav.tsx` | Réévaluer si des routes adressables par URL apparaissent. |

Aucun de ces findings n'est de sévérité Critique, Haute ou Moyenne.

---

## Verdict

**VALIDÉ AVEC RÉSERVES.** Story techniquement propre, décisions bien tracées, aucune régression,
aucun lien mort, gating correct sur les deux surfaces, i18n en parité stricte. Toutes les réserves
sont documentaires ou de process (fichier mort à nettoyer, ADR à amender, écart process transverse
au sprint) — aucune n'est un bug. Aucune réserve ne bloque la progression vers PR2.6.

---

## Note d'outillage

Ce rapport a été rédigé par le @code-reviewer, qui ne disposait que des outils Read/Glob/Grep
(aucun outil d'écriture), et persisté dans ce fichier par le @knowledge-keeper.
