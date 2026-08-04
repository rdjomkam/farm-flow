# Review — Story PR2q.4 : Ventilations

**Verdict : VALIDÉ AVEC RÉSERVES.** Une seule réserve substantielle (Moyenne), déjà identifiée,
testée et documentée par l'équipe — maintenue **ouverte** plutôt que close.

## Points vérifiés

1. **Garantie centrale « total ventilé = ligne agrégée »** — le test du cas **non dégénéré**
   (`ventilations.test.ts:145-202`, « piège 2 ») construit un journal `OPERATIONNEL` à
   `vaguePrevueId` non nul (500 000) au milieu d'un poste inclus (200 000) et d'un journal général
   (80 000), appelle **réellement** `calculerBaseRepartition` (import de `../charges`, aucune
   réimplémentation), et attend 280 000. La preuve par mutation du @tester (retrait de
   `j.vaguePrevueId !== null` → 780 000 au lieu de 280 000, seul ce test rouge sur 6) est cohérente
   avec le code lu. **Le critère d'acceptation est prouvé, pas seulement affirmé.**

2. **Duplication du filtre de `calculerBaseRepartition` — le point d'architecture.** `charges.ts:
   105-118` filtre en deux `.filter()` inline non extraits ; `ventilations.ts:152/168` reproduit ces
   conditions caractère pour caractère. C'est **un ERR-138 en puissance** : deux expressions
   indépendantes de la même règle métier, que rien dans le typage ne lie. Une extraction était
   possible sans changer le comportement du moteur — deux prédicats purs
   (`estInclusDansBaseRepartition`, `estJournalGeneral`) exportés depuis `charges.ts` et réutilisés
   des deux côtés ; ce n'est pas une réécriture, c'est un renommage de deux expressions existantes,
   prouvable par la recette existante inchangée. Le scope de la story explique le choix mais ne
   l'empêchait pas techniquement. Le test comparatif est **un filet réel mais partiel** : il détecte
   une divergence pour le jeu de données qu'il contient, pas l'ajout d'un 3e état de
   `vaguePrevueId`, d'une nouvelle valeur de `CategorieJournalPrevu`, ou un changement de sémantique
   de `inclusBaseRepartition` — sauf si un humain pense à l'enrichir en même temps que `charges.ts`.
   Sa valeur dépend entièrement de la discipline de maintenance future, ce qui est précisément le
   point faible qu'ERR-138 documente. **Sévérité Moyenne** (la duplication est documentée et non
   silencieuse, un test comparatif contre le moteur réel existe, le scope excluait `charges.ts`),
   maintenue **ouverte** : tant que l'extraction n'est pas faite, toute story future touchant
   `calculerBaseRepartition` doit vérifier `ventilations.ts` en conséquence.

3. **Pureté** — aucun `prisma.*`, aucun I/O ; entrées/sorties en mémoire. Seule dépendance :
   `moisAbsoluDepuis` (réutilisée) et les types `@/types`.

4. **`TypePostePrevision` jamais clé de regroupement** — ses seules occurrences dans
   `ventilations.ts` sont en JSDoc, expliquant pourquoi il n'est pas utilisé (2 valeurs, trop
   grossier). Le regroupement réel est par `posteId` → `libelle`.

5. **R2** — `import { CategorieJournalPrevu, type TypeApportCapital } from "@/types"` ; grep
   `"CAPITAL"`/`"CREDIT"` en dur → 0 occurrence.

6. **Section repliée par défaut** — `ventilations: false` à l'initialisation, test dédié vérifiant
   `aria-expanded="false"` et l'absence du texte avant ouverture. Sur un scénario à beaucoup de
   postes : une ligne par poste, non borné — tenable car la section reste repliée (aucun coût au
   premier écran) et suit le patron déjà accepté des granulométries dynamiques, mais à 20-30 postes
   le parcours mobile deviendrait long. **Sévérité Basse**, vigilance, pas de correctif requis.

7. **Formats et explicabilité** — `formatLigne` existant réutilisé, aucune logique de formatage
   nouvelle donc aucun risque de divergence ; chaque libellé i18n porte `(FCFA)` ; `<PopoverTrigger
   asChild>` (R5) ; test dédié sur la ligne « Dépenses — Loyer ».

8. **Libellé utilisateur injecté** — `p.libelle` passe en paramètre d'interpolation `next-intl` puis
   est rendu comme enfant React, jamais via `dangerouslySetInnerHTML` ni concaténation HTML :
   **aucune injection possible**. Un libellé vide dégrade gracieusement (espace vide), sans crash.

9. **Limites du jeu d'or documentées dans le code du test** — le JSDoc d'en-tête de
   `ventilations.test.ts` écrit explicitement que le classeur n'a qu'une ligne d'apports agrégée et
   que la répartition CAPITAL/CREDIT testée est « forcément inventée pour le test » (renvoi
   ERR-147). C'est le bon endroit : lisible par qui relit le test dans six mois, sans consulter un
   rapport externe.

10. **Périmètre — attribution vérifiée par deuxième méthode indépendante** — `git status` ne liste
    ni `tresorerie.ts` ni `aliments.ts` parmi les fichiers modifiés ; grep du vocabulaire de la
    story dans les deux fichiers : aucune occurrence pertinente (une seule occurrence de « ventiler »
    au sens générique dans une JSDoc sans rapport). `charges.ts` et le `types.ts` du moteur : aucun
    diff.

11. **i18n** — clés alignées fr/en, accents corrects, `sectionToggleAria` à 0 occurrence dans les
    deux fichiers, aucune chaîne en dur.

12. **R1-R11** — conformes ; aucun `any`. Remarque mineure **Basse** : les noms de ce module sont en
    français (`ventilerApportsParType`…) alors que CLAUDE.md prescrit l'anglais pour le code —
    cohérent avec le reste du module `previsions/` déjà en français (`calculerBaseRepartition`,
    `calculerTresorerieMensuelle`), donc pas une dérive nouvelle ; à ne pas corriger isolément, cela
    romprait la cohérence locale.

13. **Instabilité *flaky*** — bruit d'environnement à surveiller, pas une dette à ouvrir maintenant.
    Le @tester a rejoué 3 fois (8323/8323 à chaque run) sans reproduire, et refuse à juste titre de
    conclure « non reproductible = résolu ». L'absence de reproduction locale ne dit rien du
    comportement en CI (workers, ordonnancement différents). Si l'instabilité réapparaît en CI,
    ouvrir un `BUG-XXX.md` avec les logs CI exacts.

## Tableau des réserves

| # | Sévérité | Réserve |
|---|---|---|
| 1 | Moyenne | Duplication du filtre de `calculerBaseRepartition` entre `charges.ts` et `ventilations.ts` — non bloquante pour la story, recommandation d'extraction de prédicats pour un sprint futur |
| 2 | Basse | Cardinalité non bornée de la section Ventilations — vigilance |
| 3 | Info | Instabilité *flaky* — à rouvrir en bug si la CI la reproduit |
