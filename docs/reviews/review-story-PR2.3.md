# Review Story PR2.3 — Module Prévisions (Écrans de paramétrage et plan des vagues)

**Reviewer :** @code-reviewer
**Sprint :** PR2
**Story :** PR2.3 — Écrans de paramétrage et plan des vagues
**Verdict global : VALIDÉ AVEC RÉSERVES**

Aucun finding Critique ni Haute. Pipeline `pre-analyst → developer → tester → code-reviewer →
knowledge-keeper`.

Périmètre revu : pages `src/app/(farm)/previsions/scenarios/**`,
`src/components/pages/previsions-scenarios-page.tsx` et
`previsions-scenario-detail-page.tsx`, l'ensemble de `src/components/previsions/` livré par
PR2.3, `src/lib/previsions/format-previsions.ts`, `src/components/ui/popover.tsx`, les tests
livrés, le diff de `src/types/api.ts` / `src/app/api/vagues/route.ts` /
`src/components/pages/vagues-page.tsx`, et l'ajout de `@radix-ui/react-popover`. Les fichiers de
PR2.4 étaient explicitement hors périmètre.

---

## Points conformes vérifiés

- **Distinction saisie / calcul** : `ValeurCalculee` rend un `<span>` neutre (`bg-muted`,
  `text-muted-foreground`), jamais `border-input`, jamais un `<Input readOnly>`. Les 12 sites
  d'appel ont été inspectés.
- **Explicabilité** : les `formule` passées sont réellement en langage courant, pas des formules
  techniques recopiées. Aucun texte passe-partout du type « calculé automatiquement ».
- **Formats §7.4** conformes point par point. `formatXAF` (2 décimales) n'est utilisé nulle part
  dans le module et n'a pas été modifié globalement — le choix d'un fichier dédié plutôt qu'une
  modification en place est le bon arbitrage, il évite une régression silencieuse sur
  ventes/stock/factures.
- **Flux de scission** : interception ciblée sur `data.code === "VAGUE_PREVUE_DEJA_RATTACHEE"`
  uniquement ; un 409 générique, un 403, un 500 ou une panne réseau retombent tous sur l'erreur
  générique — aucun faux positif. Minimum 2 enfants structurellement garanti côté UI comme côté
  API.
- **R5** : `<DialogTrigger asChild>` sur les 8 dialogues. L'exception `scission-dialog.tsx` est
  jugée acceptable : Radix gère le focus trap et les attributs ARIA indépendamment du
  `DialogTrigger`, qui ne participe pas à l'accessibilité du contenu une fois ouvert. Réserve UX
  mineure : à l'ouverture réactive (après un 409), rien ne force le focus sur le premier champ
  modifiable.
- **R6** : aucune couleur en dur dans le périmètre.
- **Frontière Server→Client** : aucun `Decimal` ne la traverse, conversion systématique avant
  construction des DTO.
- **Mobile 360px** : aucune balise `<table>`, choix mois-primaire justifié. Aucune mesure en
  pixels réels n'a été faite — limite d'outillage du dépôt, pas un manquement de la story.
- **Permissions côté client** : patron `permissions.includes(Permission.X)` appliqué
  systématiquement.

---

## Checklist R1-R11

| Règle | Statut | Note |
|-------|--------|------|
| R1 (enums MAJUSCULES) | ✅ | |
| R2 (import enums) | ✅ | |
| R3 (Prisma=TS) | ✅ | |
| R4 (opérations atomiques) | N/A | périmètre UI |
| R5 (DialogTrigger asChild) | ✅ | |
| R6 (CSS variables du thème) | ✅ | |
| R7 (nullabilité) | ✅ | |
| R8 (siteId) | ✅ | |
| R9 (tests avant review) | ⚠️ | voir finding 4 |
| R10 (correctif de données = migration) | N/A | |
| R11 (aucun secret en dur) | ✅ | |

---

## Tableau des findings

| # | Sévérité | Fichier | Emplacement | Description |
|---|----------|---------|--------------|--------------|
| 1 | **Moyenne** | `src/components/previsions/charges-tab.tsx` | ~190-194 (`totalMois`) | Le total du mois, somme calculée sur tous les postes, est affiché en texte brut sans `ValeurCalculee`, sans explication ni détail des postes qui le composent. Viole directement l'exigence non négociable §7.4, et sur le chiffre le plus consulté de l'écran. Le rapport de test l'avait manqué : son critère portait sur l'absence d'`<Input readOnly>`, vrai littéralement, mais qui ne détecte pas un total affiché en texte brut. **À corriger avant clôture.** |
| 2 | Basse | `src/components/previsions/aliments-tab.tsx` | ~103-114 (`sommeRepartition`) | Indicateur de répartition calculé affiché hors `ValeurCalculee`. Même famille que le finding 1, risque plus faible car le contexte est immédiatement adjacent. |
| 3 | Basse | `src/components/previsions/valeur-calculee.tsx` | composant entier | Aucune garde contre une `formule` ou une `explication` vide. Confirme le constat du @tester. Aucun site d'appel actuel n'est concerné, risque théorique de régression future. |
| 4 | **Moyenne** | `src/components/previsions/__tests__/permissions-gating.test.tsx` | ~119 | `TypePostePrevision.FIXE` n'existe pas — l'enum ne porte que `LOGISTIQUE` et `CHARGE_EXPLOITATION`. Erreur de type réelle, invisible à l'exécution car `vitest` utilise esbuild sans vérification de type et le composant testé ne lit jamais `poste.type`. **À corriger et revérifier `npm run build`.** |
| 5 | Jugement, à tracer | ensemble du module (PR2.3 + PR2.4) | — | Décision i18n : textes en français en dur, sans `next-intl`. Voir la section dédiée ci-dessous. |
| 6 | Info | `src/components/previsions/aliment-form-dialog.tsx` | ~62 | `sacsParTonneUnitaire` calculé côté client et envoyé tel quel, sans revalidation serveur visible, alors que l'ADR §11.2 le documente comme « pur ratio d'unité, jamais recalculé ». Relève de PR2.2, déjà revue séparément. Signalé pour vigilance. |

Aucun de ces findings n'est de sévérité Critique ou Haute.

---

## Décision i18n — avis argumenté

`useTranslations`/`next-intl` est utilisé systématiquement dans tous les modules métier
comparables du dépôt — `src/components/vagues/` (16 fichiers), `src/components/releves/` (23
fichiers), `src/components/abonnements/` (10+ fichiers). Le module Prévisions (20 fichiers, PR2.3
+ PR2.4) est le **premier module entier du dépôt à ne suivre aucune convention i18n**, alors que
l'application est déjà internationalisée dans la quasi-totalité de ses autres domaines. L'argument
avancé (le test `i18n-completeness.test.ts` fige `namespaces` à `toHaveLength(36)`) est réel mais
ne justifie pas le choix : ajouter un 37e namespace et mettre à jour cette seule assertion est un
changement d'une ligne, strictement plus petit que le coût engagé (20 fichiers, plus de 150
chaînes en dur, et qui grossit à chaque story — PR2.4 a repris le même choix). Ce n'est donc pas
une dette « bien délimitée » : elle grossit sans qu'aucun ticket ne la borne, et le retrofit
exigera de reparcourir tout le module.

**Recommandation** : créer un item de backlog explicite et unique, référencé par PR2.3 et PR2.4,
avec un chiffrage même approximatif, plutôt que deux notes de clôture séparées et sans lien. Non
bloquant pour valider la story — l'application fonctionne et le comportement est correct — mais
c'est une régression de cohérence architecturale décidée unilatéralement par un agent, sans
arbitrage produit préalable.

---

## Verdict

**VALIDÉ AVEC RÉSERVES.** Aucun finding Critique ni Haute. Les findings 1 et 4 (sévérité Moyenne)
doivent être corrigés avant clôture de la story : le total affiché en texte brut dans
`charges-tab.tsx` viole une exigence non négociable du §7.4, et l'enum inexistant dans le test de
gating de permissions est une erreur de type réelle masquée par l'absence de vérification de type
de `vitest`. Les findings 2, 3 et 6 sont non bloquants. Le point 5 (i18n) est un jugement
architectural à tracer en backlog, non bloquant pour ce sprint.

---

## Note d'outillage

Ce rapport a été rédigé par le @code-reviewer, qui ne disposait que des outils Read/Glob/Grep
(aucun outil d'écriture), et persisté dans ce fichier par le @knowledge-keeper.
