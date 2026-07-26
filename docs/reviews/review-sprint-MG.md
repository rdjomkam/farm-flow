# Review — Sprint MG « Tout correctif de données est une migration »

**Date :** 2026-07-26
**Sprint :** MG
**Reviewer :** @code-reviewer
**Périmètre :** ADR-049, ADR-050, R10, les 6 migrations `202607270900{01..06}`, suppression des fichiers inertes, déplacement vers `scripts/audits/`, `docker-entrypoint.sh`, test de garde MG.6, `docs/analysis/MG2-statut-correctifs-orphelins.md`, `CLAUDE.md`, `docs/knowledge/ERRORS-AND-FIXES.md`.

## Verdict global : VALIDÉ AVEC RÉSERVES

Le sprint tient sa promesse centrale : les 6 migrations sont réellement idempotentes, réellement no-op silencieuses sur une base sans les données de production, et le garde-fou d'unicité (`20260727090006`) est bien construit — précondition qui échoue tôt et nomme les données fautives, tolérance aux tables absentes via `to_regclass`, couverture exacte des 10 familles vérifiée contre `prisma/schema.prisma` et contre les deux migrations existantes (noms d'index vérifiés littéralement). Le test de garde MG.6 est un vrai test de garde (cas fautifs fabriqués en mémoire, échoue si un fichier de dette disparaît sans que l'entrée soit retirée). `docker-entrypoint.sh` propage désormais correctement l'échec de migration.

Rien dans ce lot ne doit bloquer un déploiement en production. Les réserves portent sur des angles morts documentaires et un candidat oublié de la taxonomie ERR-106.

## Constats par sévérité

### Critique / Haute
Aucun.

### Moyenne

**M1 — `Vague.code` et `Reproducteur.code` : même famille de risque qu'ERR-106, jamais tranchée par ce sprint**
`prisma/schema.prisma` L1283 (`Vague.code String @unique`) et L1940 (`Reproducteur.code String @unique`) restent `@unique` global, pas `@@unique([siteId, ...])`, contrairement aux 10 familles converties par SU.12/SU.13 et durcies par ce sprint. Vérifié : ces deux champs sont saisis par l'utilisateur (validation non-vide dans `src/app/api/vagues/route.ts` L175-176 et `src/app/api/reproducteurs/[id]/route.ts` L36-38), pas générés par un compteur scopé site — donc ERR-106 (collision déterministe de compteur) ne s'applique pas littéralement. Mais l'isolation multi-tenant reste imparfaite : deux sites ne peuvent pas utiliser le même code de vague/reproducteur. Ni la migration `20260727090006` ni ADR-050 ne mentionnent ni n'excluent explicitement ces deux champs alors qu'ils suivent un pattern voisin. Pas un défaut du sprint (hors de son périmètre déclaré : les 10 familles héritées d'ERR-106), mais mérite un ticket de suivi (@db-specialist) pour trancher : scoper par site, ou documenter le choix global comme assumé.

**M2 — `docs/sprints/SPRINT-MG.md` et `docs/TASKS.md` non mis à jour**
`SPRINT-MG.md` (L26-36) liste encore MG.2 à MG.6 en TODO alors que tous les livrables existent et sont fonctionnellement complets. La section « Ce que l'utilisateur devra exécuter en production » (L67-85) est explicitement laissée « à compléter ». `docs/TASKS.md` ne contient aucune entrée Sprint MG (alors que SU et PX y figurent). Défaut de clôture de sprint, pas de code — mais expose au même risque de fond que ce sprint corrige : un travail réel dont le statut n'est pas fiable depuis le dépôt seul. Action : @project-manager met à jour les statuts et recopie la liste d'exécution en production (fournie plus bas).

### Basse

**B1 — `20260727090001` : le `RAISE NOTICE` (ligne 79) ne renvoie pas explicitement vers ADR-043** pour expliquer pourquoi le volet `Bac.nombrePoissons` est omis — l'explication complète n'est que dans le commentaire SQL au-dessus, invisible dans les logs `migrate deploy`. Confort d'exploitation, non bloquant.

**B2 — Secret purgé du dépôt actuel mais persistant dans l'historique git.** `scripts/data-fixes/gd3-apply.sh` (supprimé par ce sprint) contenait une URL Postgres de prod avec mot de passe en clair. Vérifié par grep ciblé (`postgres(ql)?://`, `password`, `PGPASSWORD`) sur les fichiers vivants du sprint (6 migrations, ADR-049/050, MG2, `docker-entrypoint.sh`, test de garde, scripts d'audit déplacés) : aucun secret en clair trouvé. Le secret reste néanmoins lisible dans l'historique git. Action opérationnelle recommandée : rotation du mot de passe PostgreSQL de production concerné.

## Points vérifiés en détail

1. **Idempotence des 6 migrations — VALIDÉ.** Lues ligne à ligne :
   - `20260727090001` (vague2601) : `UPDATE ... WHERE ... = <valeur buggée connue>` (ERR-111 respectée), volet `Bac.nombrePoissons` omis à raison (colonne supprimée par `20260521200000_adr043_phase3_remove_bac_production_fields`, vérifié).
   - `20260727090002` (bes033/cmd015) : `UPDATE ... WHERE ... IS NULL AND EXISTS(FK)` + `DELETE ... WHERE id=...` ; cascades `LigneDepense`/`PaiementDepense` confirmées `onDelete: Cascade` dans le schéma.
   - `20260727090003` (calibrage-may14) : `INSERT ... SELECT ... WHERE EXISTS(4 FK) AND NOT EXISTS(cible)` — corrige exactement ERR-110 et le défaut du fichier source (`gen_random_uuid()` sur `INSERT` brut).
   - `20260727090004` (vte004) : `UPDATE ... WHERE id=... AND vagueId='' AND EXISTS(Vague)` — cible la valeur buggée réelle (chaîne vide, pas `NULL`).
   - `20260727090005` (gd3) : chaque `INSERT` réécrit en `SELECT ... WHERE EXISTS(...) AND NOT EXISTS(...)` (corrige le `ON CONFLICT DO NOTHING` du script source, ERR-110) ; garde-fou de conservation post-écriture rendu conditionnel à l'existence de la vague GD3 (`RETURN` sinon) — exactement ce qu'exige ADR-049 §3.3.b.
   - `20260727090006` : garde-fou avant tout DROP/CREATE, DROP/CREATE idempotents (`IF EXISTS`/`IF NOT EXISTS`), tolérants aux tables absentes (`to_regclass`). Noms d'index vérifiés littéralement contre `20260726174843_numero_unique_par_site/migration.sql` et `20260726212515_lotalevins_code_unique_par_site/migration.sql` — correspondance exacte.
   Aucun delta relatif trouvé. Aucun `ON CONFLICT (id) DO NOTHING` protégeant un `INSERT` à FK en dur.

2. **No-op silencieux sur base sans données de prod — VALIDÉ**, y compris le garde-fou de conservation de `20260727090005` (conditionné à l'existence de la vague GD3) et celui de `20260727090006` (`to_regclass`, pas de liste de requêtes en dur).

3. **Garde-fou de `20260727090006` — VALIDÉ.** Nomme table/siteId/valeur/occurrences/5 premiers ids ; 10 familles confirmées par grep direct de `@@unique` dans `schema.prisma` (6 `numero`, 4 `code`) — voir M1 pour deux candidats hors périmètre.

4. **Décision de ne pas éditer les 2 migrations existantes — VALIDÉE sur pièces** (lecture confirmant qu'aucune des deux ne contient d'`UPDATE` de dédoublonnage, seulement `DROP/CREATE INDEX`) ; `20260727090006` est réellement auto-suffisante dans les deux cas de figure (déjà appliquées ou non).

5. **Test de garde MG.6 — VALIDÉ.** Vrais cas négatifs fabriqués en mémoire, liste de dette (9 entrées) chacune datée/justifiée avec test dédié anti-pourrissement (`existsSync`), détection basée sur chemin/nommage (pas une heuristique de contenu comme critère qualifiant).

6. **`docker-entrypoint.sh` — VALIDÉ.** `if ! npx prisma migrate deploy; then ... exit 1; fi` fonctionne correctement sous `set -e` (condition testée dans un `if` n'interrompt pas le script). Message clair, `exec node server.js` inchangé. Changement de comportement à communiquer à l'équipe ops avant déploiement.

7. **Sécurité — voir B2.**

8. **Cohérence documentaire — VALIDÉE avec réserve M2.** ADR-049/ADR-050 cohérents entre eux et avec l'implémentation. R10 dans `CLAUDE.md` exacte et concise. Requêtes de `MG2-statut-correctifs-orphelins.md` vérifiées contre le schéma actuel (aucune ne porte sur `Bac.nombrePoissons`, colonne supprimée — le document corrige explicitement ce piège en note), strictement `SELECT`. Aucune référence morte active vers les anciens chemins (`scripts/data-fixes/gd3-*`, `prisma/data-fixes/CX3-*`/`CF1-*`, scripts hors `scripts/audits/`) — seules des mentions historiques légitimes subsistent dans la documentation.

9. **Esprit du sprint.** Les 9 correctifs orphelins historiques restants sont documentés honnêtement en dette, chacun daté/justifié — défendable pour ce sprint, mais nécessite un futur sprint dédié (diagnostic MG.2-like + conversion) pour être soldé.

10. **R1-R10** : respectées pour ce qui s'applique à ce sprint (R10 est l'objet même du sprint).

## Avant tout déploiement en production
Rien de bloquant.

## Peut attendre (backlog)
1. M1 — trancher `Vague.code`/`Reproducteur.code`.
2. M2 — mettre à jour `SPRINT-MG.md` et `TASKS.md`.
3. B1 — enrichir le `RAISE NOTICE` de `20260727090001`.
4. B2 — rotation du mot de passe Postgres historiquement exposé.
5. Planifier un sprint pour les 9 correctifs orphelins historiques restants.

## Liste ordonnée — ce que l'utilisateur doit exécuter en production
1. Déployer normalement (`npx prisma migrate deploy` / `docker-entrypoint.sh` — informer l'équipe ops que tout échec de migration bloque désormais le démarrage).
2. Les 6 migrations s'appliquent dans l'ordre `20260727090001` → `20260727090006`, sans aucune action manuelle préalable requise.
3. Après déploiement, relire les `RAISE NOTICE` dans les logs pour confirmer combien de lignes chaque correctif a effectivement touchées (0 = déjà appliqué/non concerné ; >0 = corrigé maintenant).
4. Si `20260727090006` lève une exception (doublons détectés) : aucune écriture n'aura eu lieu ; dédupliquer manuellement selon le message (jamais renuméroter automatiquement des identifiants déjà communiqués à des tiers), puis relancer `migrate deploy`.
5. Optionnel : exécuter au préalable les requêtes en lecture seule de `docs/analysis/MG2-statut-correctifs-orphelins.md` pour connaître l'état des 5 correctifs orphelins avant que `migrate deploy` ne les traite.
6. Planifier séparément la rotation du mot de passe PostgreSQL exposé historiquement par `gd3-apply.sh`.
