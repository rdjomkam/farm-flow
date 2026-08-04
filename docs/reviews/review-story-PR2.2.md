# Review Story PR2.2 — Module Prévisions (Routes API)

**Reviewer :** @code-reviewer
**Sprint :** PR2
**Story :** PR2.2 — Routes API
**Verdict global : VALIDÉ**

Aucun finding Critique ni Haute. Pipeline `pre-analyst → developer → tester → code-reviewer →
knowledge-keeper`.

Périmètre revu : les 22 routes de `src/app/api/previsions/**`, `_shared.ts`,
`src/lib/validation/previsions.schema.ts`, `src/lib/previsions/route-orchestration.ts`, la
migration `20260803150000_aliment_prevision_sacs_par_tonne_split`, le diff de
`prisma/schema.prisma`, et les tests associés.

---

## Points conformes vérifiés

- **Auth/permissions/siteId** : les 22 routes appellent `requirePermission()` en première ligne du
  `try` et threadent systématiquement `auth.activeSiteId`, jamais un `siteId` venu du body ou des
  params. Aucun oubli trouvé, sur recherche active. `PREVISIONS_CLOTURER` déclarée mais utilisée
  par aucune route — conforme, la clôture est PR3.
- **Route de calcul en lecture pure** : aucun `create`/`update`/`delete` sur le chemin. Le module
  n'écrit jamais dans une table du domaine réel, à la seule exception de `rattacherVaguePrevue` qui
  écrit `Vague.vaguePrevueId` — exception correctement délimitée, documentée en tête de route, et
  prévue par l'ADR décision 2.
- **Les 3 correctifs Haute vérifiés par relecture directe du code**, indépendamment du rapport de
  test : formule `besoinTotalCycleKg = (tonnageCibleKg / 1000) × sacsParTonneStandard ×
  poidsSacKg`, `sacsParTonneUnitaire` absent de tout calcul de besoin, rejet explicite et bloquant
  sur `sacsParTonneStandard = null` (pas de défaut silencieux), `COALESCE(sacsSaisis,
  sacsCalcules)` appliqué correctement aux deux niveaux de grain (affichage par mois, agrégat de
  cycle qui pilote la remise).
- **Flux de scission** : interception ciblée sur `error.code === "P2002"` ET
  `error.meta?.target` contenant `vaguePrevueId`, renvoyant 409 avec `code:
  "VAGUE_PREVUE_DEJA_RATTACHEE"`. Un P2002 sur un autre champ retombe correctement sur le
  traitement générique — pas de faux positif.
- **Sérialisation** : chaque `Decimal` converti via `.toNumber()` avant `NextResponse.json`, y
  compris les champs imbriqués. Le test dédié vérifie l'absence des motifs internes de
  `decimal.js` dans le JSON brut, pas seulement un typage superficiel. La dette `portefeuille`
  (voir ERR-137) n'est pas reproduite.
- **Migration (R10)** : sous-dossier avec `migration.sql`, rien à la racine, vrai `RENAME COLUMN`
  (pas de `DROP`+`ADD` destructeur), `ADD COLUMN` nullable conforme R7, commentaire de tête
  expliquant le choix.
- **Périmètre** : aucun débordement PR3.

---

## Checklist R1-R11

| Règle | Statut | Note |
|-------|--------|------|
| R1 (enums MAJUSCULES) | ✅ | |
| R2 (import enums) | ✅ | |
| R3 (Prisma=TS) | ✅ | |
| R4 (opérations atomiques) | ✅ | |
| R5 (DialogTrigger asChild) | N/A | pas d'UI dans le périmètre |
| R6 (CSS variables du thème) | N/A | pas d'UI dans le périmètre |
| R7 (nullabilité) | ✅ | |
| R8 (siteId) | ✅ | |
| R9 (tests avant review) | ✅ | |
| R10 (correctif de données = migration) | ✅ | vrai `RENAME COLUMN`, cf. ERR-140 |
| R11 (aucun secret en dur) | ✅ | |

---

## Tableau des findings

| # | Sévérité | Fichier | Description |
|---|----------|---------|--------------|
| 1 | Basse | `src/app/api/previsions/_shared.ts` | Le mapping HTTP repose sur une correspondance par sous-chaîne de message d'erreur. Pour 2 des 4 motifs (« doit valoir 100 », « seuils strictement croissants »), qui viennent du moteur `validation.ts` et n'ont pas de garde zod équivalente en amont, une reformulation future du message ferait silencieusement retomber la validation en 500. Acceptable pour ce sprint (le moteur est déclaré intouchable, et un test de contrôle démontre la dépendance), à durcir si une story future retouche `validation.ts` — l'option plus robuste, écartée sciemment pour ne pas toucher au moteur, serait de typer ces erreurs en `ValidationError`. |
| 2 | Basse | `src/lib/previsions/route-orchestration.ts` | L'exclusion de `logistique.sousTotalFCFA` de la surcharge `sacsSaisis` est fidèle au texte de l'ADR §3.6 (« coût, budget, trésorerie ») **aujourd'hui**, car le câblage actuel exclut le coût logistique de tout agrégat monétaire descendant. À réexaminer le jour où une story câblera `logistique.sousTotalFCFA` dans `depensesFCFA`. Fragilité de conception, pas un bug. |
| 3 | Cosmétique | `src/app/api/previsions/_shared.ts` | L'entrée `assertEntierColonneInt` de `PREVISIONS_STATUS_MAP` est probablement inatteignable via l'API, les champs concernés étant tous couverts en amont par `z.number().int()`. Défense en profondeur cohérente (la garde protège aussi les appels hors API), à noter seulement pour un futur nettoyage. |

Aucun de ces findings n'est bloquant.

---

## Verdict

**VALIDÉ.** Aucun problème de sévérité Haute ou Critique. Les findings #1 à #3 sont non
bloquants et peuvent être traités ultérieurement, au gré des stories qui toucheront à nouveau les
fichiers concernés.
