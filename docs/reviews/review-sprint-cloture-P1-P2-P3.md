# Review — Sprint de clôture P1-P2-P3

**Contexte :** sprint de clôture de trois points restés ouverts après le sprint des réserves (commit
`7c39a4a`) :
- **P1** — faux vert des tests DB-gated (ERR-192, non résorbé jusqu'ici).
- **P2** — « absent » vs « désactivé » sur `rapprochement-mapping-tab.tsx` (suite d'ERR-173/ERR-189).
- **P3** — flaky signalé de `mapping-form-dialog.test.tsx`.

**Reviewer :** @code-reviewer
**Date :** 2026-08-05

## Verdict global

**P1 VALIDÉ. P2 VALIDÉ. P3 VALIDÉ (clôture solide). Aucun problème bloquant trouvé.**

---

## P1 — Faux vert des tests DB-gated (ERR-192)

**Points vérifiés :**
- Patron uniforme sur les **15 fichiers** de `src/lib/queries/__tests__/` concernés : disparition du
  `try`/`catch` muet (`dbAvailable = false`) et du repli `if (!dbAvailable || !client) { console.warn(...);
  return; }` dans chaque `it`, remplacé par un `throw new Error(MESSAGE_DB_INJOIGNABLE, { cause:
  erreurConnexion })` dans le `beforeAll`, conforme au patron de référence
  `src/__tests__/api/previsions-poste-referentiel-sql-artefact-historique-integration.test.ts`.
- Les **2 faux positifs préservés** : le fichier déjà conforme avant ce sprint
  (`scripts/data-fixes/__tests__/su12-numero-unique-constraint.test.ts`) et le test légitimement mocké hors
  périmètre DB (celui qui reste vert même base injoignable) n'ont pas été touchés inutilement — le sprint
  s'est concentré exactement sur les 15 fichiers défectueux, pas plus, pas moins.
- La preuve falsifiable rapportée (base injoignable
  `postgresql://invalid:invalid@127.0.0.1:1/nonexistent` → AVANT `15 passed/49 passed`, APRÈS `15 failed/48
  failed | 1 passed`) est cohérente avec le mécanisme attendu : un test DB-gated correctement écrit doit
  échouer bruyamment, jamais verdir, quand la base est injoignable.
- L'allowlist (`src/test/db-gated-allowlist.ts`) et le test méta
  (`src/__tests__/meta/db-gated-tests-registry.test.ts`) restent **intacts** — aucune entrée retirée ni
  ajoutée sans justification, ce qui est cohérent avec le fait que ce fix ne change aucun motif syntaxique
  détecté par le test méta (`runIf`/`skip`), seulement le comportement interne du `beforeAll`/`it`.

**Réserve du reviewer (non bloquante, voir section « Limites » ci-dessous) :** confirmation par exécution
réelle des 15 fichiers contre une base injoignable, et re-exécution complète `npx vitest run` / `tsc` /
`npm run build`, non effectuées par le reviewer lui-même (pas d'accès Bash/DB).

---

## P2 — « Absent » vs « désactivé » sur `rapprochement-mapping-tab.tsx`

**Points vérifiés :**
- Conformité à l'arbitrage tranché par ADR-053 §16.13 (option c + variante par permission) : aucun accès
  élargi, aucune nouvelle permission créée, aucune migration — le rebranchement utilise la route admin déjà
  existante.
- **Anti-403 garanti par construction** : `peutParametrer` est dérivé **synchrониquement** depuis les props
  du composant (pas d'appel réseau pour le déterminer), ce qui exclut structurellement la classe de bug où
  un composant tenterait d'abord la route admin puis se rabattrait dessus après un 403 — la décision de
  route est prise **avant** tout fetch, jamais après un échec.
- `peutParametrer` figure bien dans le tableau de dépendances du `useCallback`/`useEffect` qui déclenche le
  chargement — pas d'état figé si la permission change en cours de vie du composant (changement de site
  actif, par exemple).
- Un test dédié prouve explicitement que la route admin **n'est jamais appelée** pour un profil
  `PREVISIONS_VOIR` seul (assertion sur l'URL réellement invoquée, pas un `includes` permissif — voir la
  mise à jour d'ERR-189 sur ce point précis, ordre des `includes` du mock, motif spécifique testé avant le
  motif générique).
- **Priorité de `ciblesChargees=false` respectée** : le composant ne dégrade pas silencieusement l'ensemble
  des libellés (y compris ceux qui étaient corrects) quand le chargement des cibles échoue ou n'a pas
  encore eu lieu — le drapeau est bien consulté avant d'afficher un jugement définitif « introuvable » vs
  « état indéterminé ».
- **i18n fr/en présentes et correctement accentuées** pour les nouveaux libellés (« État indéterminé
  (introuvable ou désactivée) », etc.) — vérifié par lecture des fichiers de traduction concernés.
- **R2** (imports d'enum, pas de string litéral) : respectée dans le code touché.
- **R5** (`DialogTrigger asChild`) : sans objet direct sur ce composant, mais aucune régression détectée sur
  les triggers existants du dossier `rapprochement-*`.
- **R6** (CSS variables du thème) : les nouveaux états visuels (« état indéterminé ») utilisent les classes
  utilitaires existantes du thème, pas de couleur en dur introduite.
- **R10** : aucun correctif de données impliqué dans ce point — sans objet, respectée par absence de
  violation.
- **R11** : aucun secret, aucune URL de connexion en dur introduite par ce point.

**Réserve du reviewer (non bloquante) :** confirmation par `git diff` réel du périmètre exact touché (le
reviewer n'avait accès qu'à Read/Glob/Grep, pas à Bash), et re-exécution de la suite de tests concernée,
laissées à la vérification parallèle par un autre agent (@tester).

---

## P3 — Flaky de `mapping-form-dialog.test.tsx`

**Points vérifiés :**
- Protocole de vérification large et varié : 90 exécutions, isolé / suite complète / par répertoire,
  parallélisme activé et désactivé, avec et sans `DATABASE_URL` — **0 échec sur 90**.
- Le repère historique cité pour le flaky (`user.type`) a été vérifié comme ne s'appliquant pas : ce motif
  n'apparaît pas dans le fichier actuel.
- Le seul échec rencontré pendant tout le protocole a été correctement identifié comme un artefact de
  mesure (édition concurrente du dépôt par un autre agent pendant l'exécution — « lecture déchirée » entre
  l'assertion figée et le composant recompilé), pas comme une occurrence du flaky lui-même. Cette
  identification est méthodologiquement solide : un flaky réel doit être reproductible dans des conditions
  contrôlées et stables, ce qui n'est pas le cas ici.
- Clôture **sans modification de code** — décision cohérente avec l'absence de reproduction après un
  protocole substantiel.
- Une nouvelle entrée ERR (ERR-194) capitalise la leçon méthodologique — bonne pratique pour éviter que ce
  piège ne reproduise un faux signal dans un futur sprint de vérification de flakiness.

---

## Limites de cette review

Le reviewer n'avait accès ni à l'outil Bash, ni à un accès direct à la base de données pendant cette
review. En conséquence :
- La confirmation par `git diff` réel de l'ensemble du périmètre modifié (au-delà des fichiers cités
  explicitement dans le rapport d'implémentation) n'a pas pu être effectuée directement par le reviewer.
- La ré-exécution de `npx vitest run`, `tsc`, et `npm run build` n'a pas pu être effectuée par le reviewer.

Ces deux vérifications sont traitées en parallèle par un autre agent (@tester / vérification indépendante)
et ne constituent pas un blocage du verdict ci-dessus, qui repose sur la lecture complète du code, des
tests, et des documents de référence (ADR-053 §16.13, ERR-173, ERR-189, ERR-192) disponibles au reviewer.

---

## Conclusion

**P1 VALIDÉ, P2 VALIDÉ, P3 VALIDÉ (clôture solide).** Aucun problème bloquant trouvé. Sprint de clôture
recommandé pour passage en statut FAIT, sous réserve de la confirmation indépendante des tests/build
mentionnée ci-dessus.
