# Review — Sprint CI (Intégration continue avec base éphémère + hygiène des secrets)

**Reviewer :** @code-reviewer
**Date :** 2026-07-27
**Verdict global : CI.1 à CI.5 VALIDÉ AVEC RÉSERVES**

---

## 1. Périmètre revu

- **CI.1** — Pipeline GitHub Actions avec service Postgres éphémère (`.github/workflows/ci.yml`).
- **CI.2** — Mécanisme structurel rendant impossible l'invisibilité d'un test d'intégration
  DB-gated (garde global, helper `requireDatabaseUrl()`, allowlist + test méta) — voir
  [ADR-052](../decisions/ADR-052-ci-anti-invisibilite-tests-db-gated.md).
- **CI.3** — Scan de secrets (gitleaks) en CI, working tree complet à chaque `push`/`pull_request`.
- **CI.4** — Empêcher la récidive (R11 reformulée dans `CLAUDE.md`).
- **CI.5** — Documentation de la remédiation (`docs/security/REMEDIATION-SECRET-HISTORIQUE.md`).

## 2. Verdict

**CI.1 à CI.5 : VALIDÉ AVEC RÉSERVES.**

Réponse à la question centrale posée par ce sprint — est-il désormais structurellement très
difficile d'ajouter un test d'intégration qui ne tourne jamais ? — **oui**. La défense retenue est
à trois niveaux, chacun couvrant l'angle mort du précédent :

1. Le garde global (`src/test/ci-db-guard.setup.ts`) rend « CI sans base » impossible, quel que
   soit le fichier de test concerné, y compris un fichier qui n'existe pas encore au moment où le
   garde est écrit.
2. Le helper obligatoire (`requireDatabaseUrl()`) centralise le point de décision « ce test
   doit-il tourner ? » — un futur test n'a techniquement aucune raison d'écrire son propre
   `!!process.env.DATABASE_URL`.
3. Le test méta bidirectionnel (`db-gated-tests-registry.test.ts`) empêche qu'un nouveau gate soit
   ajouté sans déclaration justifiée, et empêche l'allowlist de pourrir avec des entrées obsolètes.

Ce dispositif a été éprouvé dans les deux sens par le tester (gate non déclaré → échec confirmé ;
entrée d'allowlist obsolète → échec confirmé), sans trace résiduelle laissée dans le dépôt.

## 3. Défauts relevés

### H1 (Haute) — Absence de test de non-régression du garde lui-même
ADR-052 §5.2 exigeait explicitement un test de non-régression pour `ci-db-guard.setup.ts` et
`require-database-url.ts` — le socle de toute la garantie CI.2. Ce test n'avait jamais été écrit
à la première livraison du sprint.

**Corrigé depuis** : `src/test/__tests__/ci-db-guard.test.ts`, 7 tests, matrice complète des 4
combinaisons `CI` × `DATABASE_URL` (une branche par combinaison), plus 2 tests sur le contenu du
message d'erreur (empêche qu'il soit un jour vidé de sa substance sans faire échouer ce test) et 1
test de non-effet de bord hors des cas ciblés. Vérifié hors de l'allowlist DB-gated à raison (ce
test doit tourner partout, y compris sans base — sinon il deviendrait lui-même un test invisible,
ERR-116/ERR-118).

### M1 (Moyenne) — R11, énumération fermée omettant les fichiers de configuration d'outillage
La première version de R11 énumérait un périmètre fermé (« script, migration, test, doc ») qui
omettait précisément le vecteur réel du secret trouvé pendant ce sprint
(`.claude/settings.local.json`, fichier de configuration d'outillage/agent).

**Corrigé depuis** : R11 reformulée dans `CLAUDE.md` pour couvrir tout fichier tracké par git par
principe, plutôt que par liste fermée de catégories — voir ERR-122
(`docs/knowledge/ERRORS-AND-FIXES.md`).

### M2 (Moyenne) — Commentaire obsolète
Un commentaire faisant référence à un état antérieur du dispositif de gating (avant migration vers
`requireDatabaseUrl()`) subsistait dans un des fichiers de test migrés.

**Corrigé depuis.**

### B1 (Basse) — Risque de fusion de deux entrées d'allowlist
Le format de `db-gated-allowlist.ts` (une entrée par occurrence, pas par fichier) créait un risque
qu'une future modification fusionne par erreur deux entrées distinctes du même fichier
(`su12-numero-unique-constraint.test.ts` en compte deux, une par bloc `describe.runIf`).

**Corrigé depuis.**

## 4. Angle mort déclaré (assumé, pas un défaut)

Le mécanisme protège structurellement :
- la présence de `DATABASE_URL` en CI (garde global) ;
- tout gate détectable syntaxiquement (`describe.runIf`, `it.skip`, `test.skip`,
  `describe.skip`, `skipIf`, `this.skip`) non déclaré dans l'allowlist (test méta).

Il ne protège **pas** un test rendu inopérant par une autre voie, non syntaxique — par exemple une
condition métier interne toujours fausse à l'intérieur du corps du test, ou un `try { ... } catch {
return; }` qui avale une erreur sans jamais passer par un mot-clé surveillé (cas traité
spécifiquement pour le fichier où il a été trouvé — `su12-numero-unique-constraint.test.ts`, voir
ERR-119 — mais un nouveau fichier pourrait réintroduire un pattern équivalent sans se faire
attraper par ce mécanisme). La checklist de @code-reviewer (R1-R11) reste la deuxième ligne de
défense pour ce cas, pas l'outillage automatique seul. Cet angle mort est documenté explicitement
dans ADR-052 §4 et n'est pas considéré comme un défaut de ce sprint — c'est une limite assumée et
connue du mécanisme retenu.

## 5. Constat additionnel hors périmètre du sprint (transmis, pas traité ici)

Le mécanisme gitleaks, en fonctionnant dès sa première exécution, a révélé un secret réel
actuellement tracké dans le dépôt (`.claude/settings.local.json`, depuis le commit initial) — voir
`docs/security/REMEDIATION-SECRET-HISTORIQUE.md` pour la remédiation complète et ERR-122 pour la
leçon associée. Ce n'est pas un défaut de ce sprint : c'est la preuve que le mécanisme construit
par ce sprint fonctionne.

## 6. Références

- [ADR-052](../decisions/ADR-052-ci-anti-invisibilite-tests-db-gated.md)
- [rapport-sprint-CI](../tests/rapport-sprint-CI.md)
- [BUG-CI-migration-order](../bugs/BUG-CI-migration-order.md)
- [REMEDIATION-SECRET-HISTORIQUE](../security/REMEDIATION-SECRET-HISTORIQUE.md)
- `docs/knowledge/ERRORS-AND-FIXES.md` — ERR-107, ERR-116, ERR-118, ERR-119, ERR-120, ERR-121,
  ERR-122, ERR-123
