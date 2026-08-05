# Rapport de falsification — Sprint PR3 (Rapprochement prévu/réel)

**Sprint :** PR3 | **Date :** 2026-08-05 | **Auteur :** consolidation par @knowledge-keeper (scribe),
d'après l'exécution réelle menée story par story pendant le sprint.

## Pourquoi ce document existe

Ce sprint n'a **aucun jeu d'or.** Le classeur Excel de référence (`Previsions_Elevage_Silure_v12.xlsx`)
ne contient aucune donnée réelle (`Depense`/`Vente`/`MouvementStock` sont des tables opérationnelles
farm-flow, jamais modélisées dans le classeur) — le rapprochement prévu/réel n'est donc vérifiable
**contre rien d'externe**. Deux précédents directs dans ce module rendent ce risque concret, pas
théorique :

- **ERR-160** a montré qu'un jeu d'or peut rester structurellement incapable de discriminer deux
  formules candidates — vert sur une formule fausse, faute d'un cas de divergence dans les données de
  référence elles-mêmes.
- **ERR-171** (récidive directe d'ERR-142) a montré qu'une recette peut ne jamais appeler le code de
  production — 2 458 assertions vertes qui ne testaient qu'une réimplémentation locale de la formule
  dans le test lui-même, pendant deux sprints.

Dans ces conditions, la **falsification** — muter délibérément le code de production et vérifier que
des tests tombent — est la **seule** preuve disponible que la suite de tests teste réellement quelque
chose. Une mutation qui ne fait tomber aucun test est un test sans valeur, quel que soit son nombre de
lignes ou son vert apparent.

## Méthode

Pour chaque règle du §6 de l'ADR-053, la story responsable a :
1. appliqué la mutation décrite au code de **production** (jamais à un test ni à une fixture) ;
2. relancé `npx vitest run` ;
3. relevé le nombre exact de tests tombés ;
4. restauré le code (diff nul confirmé, SHA vérifié) avant de considérer la story terminée.

## Résultats consolidés

| Story | Mutation appliquée au code de production | Tests tombés |
|---|---|---|
| PR3.1a — trésorerie initiale | Remettre `new Decimal(0)` en dur au lieu de lire `parametres.tresorerieInitialeFCFA` (`route-orchestration.ts:800`) | 2 sur 3 (le 3e est le cas solde=0, non-régression, vert à juste titre) |
| PR3.1b — ERR-162 couverture des mois | Neutraliser `validerCouvertureMoisRepartition` (no-op) | 8 |
| PR3.2 — ERR-165 erreurs typées | Commenter l'interception `if (error instanceof BusinessRuleError)` dans `api-utils.ts` | 23 (sur 6 fichiers) |
| PR3.3 — mapping versionné | Réutiliser la version précédente au lieu d'incrémenter (écriture en place) | 1 sur 2 (contrainte d'unicité DB interceptée avant la 1re assertion) |
| PR3.3 — snapshot budget initial | Désactiver la garde anti-double-activation + écraser le snapshot | 1 sur 2 |
| PR3.4 — moteur (i) | Inverser le signe : `prevu − reel` au lieu de `reel − prevu` | 11 |
| PR3.4 — moteur (ii) | `ecartPct = 0` au lieu de `null` quand `prevu = 0` | 2 |
| PR3.4 — moteur (iii) | Ignorer les catégories non mappées au lieu de les ranger dans `NON_RAPPROCHE` | 4 |
| PR3.4 — moteur (iv) | Inverser FAVORABLE/DÉFAVORABLE pour les dépenses | 9 |
| PR3.5 — queries (i) | Lire le mapping ACTIF même pour un mois clôturé (casse l'immuabilité) | 1 |
| PR3.5 — queries (ii) | Filtrer silencieusement les catégories non mappées avant le moteur | 1 |
| PR3.5 — queries (iii) | Retirer le filtre `siteId` d'une agrégation | 2 (dont une fuite inter-sites observée) |
| PR3.6 — API (i) | UPDATE en place au lieu d'une nouvelle version de mapping | 2 |
| PR3.6 — API (ii) | Ne pas figer `versionMapping` à la clôture | 1 |
| PR3.6 — API (iii) | Retirer `requirePermission` sur POST /clotures | 3 |
| PR3.7 — UI (i) | Inverser vert↔rouge dans `classeTexteCouleur` | 1 |
| PR3.7 — UI (ii) | Masquer le bac « Non rapproché » | 2 |
| PR3.7 — UI (iii) | Rendre `SANS_SOURCE_REELLE` comme `reel ?? 0` | 1 |
| PR3.7 — moteur par vague | Inverser la nature de grandeur | 2 |
| PR3.7 — moteur par vague | Masquer les vagues non réalisées | 1 |
| PR3.7 — moteur par vague | Supprimer le garde de division par zéro | 2 (`Infinity` littéral observé) |

## Conclusion

**Aucune mutation n'est passée inaperçue** : chaque règle du §6 de l'ADR-053 est protégée par au moins
un test qui tombe quand on la casse. C'est la garantie que ce document apporte, à défaut de tout jeu
d'or externe.

## Réserve honnête

- Les compteurs « 1 sur 2 » ou « 2 sur 3 » s'expliquent par l'arrêt de Vitest à la **première
  assertion en échec** d'un test donné — un test avec plusieurs `expect` séquentiels s'arrête au
  premier échec et ne rapporte jamais les suivants. Cela **sous-estime mécaniquement** le nombre
  d'assertions réellement protégées par chaque mutation ; le chiffre rapporté est un plancher, pas un
  compte exhaustif.
- Un compteur faible (1, voire 1 sur 2) **n'est pas en soi rassurant** — ce n'est pas le nombre qui
  importe ici, c'est le fait qu'il soit **non nul**. Une mutation qui ferait tomber zéro test
  identifierait une règle non protégée, à corriger avant de considérer la story terminée. Aucune ligne
  de ce tableau n'est à zéro.

## Portée

Ce rapport couvre le périmètre backend du sprint PR3 (moteur `rapprochement.ts`, queries, API,
clôture/mapping) ainsi que les mutations UI listées pour PR3.7 exécutées dans le même esprit. Il ne
remplace pas une exécution `npx vitest run` complète de non-régression (hors périmètre de ce document,
voir `docs/reviews/review-sprint-PR3.md` — angles morts déclarés).

**Références :** ERR-160, ERR-168 (pratique de falsification), ERR-171 (récidive d'ERR-142), ADR-053
§15.6 point 3, `docs/analysis/pre-analysis-sprint-PR3.md` section C.
