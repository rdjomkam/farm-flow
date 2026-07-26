# Review Sprint SU — Rattrapage des suivis non bloquants accumulés

**Reviewer :** @code-reviewer
**Sprint :** SU
**Verdict global : VALIDÉ AVEC RÉSERVES** (aucune réserve bloquante)

**Périmètre revu :** `bon-livraison-flow.tsx`, `vente-detail-client.tsx`, `assignation-invariant.ts`,
`bons-livraison.ts`, `numero-utils.ts`, `bons-livraison-transaction-integration.test.ts`,
`role-form-labels.ts`, migrations de backfill de permissions, `LotAlevins` (unicité `code`),
`pdf-format-utils.ts`, `image-upload-field.tsx`, ainsi que `docs/analysis/pre-analysis-sprint-SU-*.md`
et `docs/TASKS.md`.

**Limitation méthodologique assumée :** le code-reviewer n'a pas d'accès shell dans cet
environnement. Le verdict s'appuie sur (1) le rapport du tester (`docs/tests/rapport-sprint-SU.md` :
222 fichiers de test, **5697 tests passés, 26 todo, 0 échec** ; `npm run build` → exit 0, toutes les
routes générées) et (2) les pré-analyses (`docs/analysis/pre-analysis-sprint-SU-BL.md`,
`pre-analysis-sprint-SU-3.md`, `pre-analysis-sprint-SU-numero.md`, `pre-analysis-sprint-SU-nits.md`),
recoupées avec la lecture directe des fichiers modifiés. Les chiffres retenus comme définitifs sont
ceux produits **en fin de sprint, machine libre de tout agent concurrent** — voir le constat de
process ci-dessous, qui explique pourquoi des chiffres antérieurs (69 échecs à un instant donné) ont
été écartés comme non représentatifs.

---

## Verdict par story

### SU.1 — VALIDÉ
`bon-livraison-flow.tsx:518-520` : `poissonsLivres` est dérivé selon la **même** priorité que le
PDF (`ligneBL?.nombrePoissonsLivres ?? ligne.nombrePoissons - nombreMortsTransport`) — plus de
divergence structurelle entre écran et document signé. Test de non-régression couvrant le cas
90 (commandé) → 87 (livré) présent. i18n FR/EN appariée (aucune chaîne orpheline dans une seule
langue). `vente-detail-client.tsx:729-753` résout le problème en **labellisant** selon `estLivree`
plutôt qu'en changeant la source de la donnée affichée — approche qui préserve l'affichage des BL
déjà signés historiquement (pas de réinterprétation rétroactive d'une donnée figée).

### SU.2 — VALIDÉ
Conforme à [ADR-048](../decisions/ADR-048-persistance-ecarts-conservation.md). `persisterEcartConstate`
est enveloppée d'un try/catch qui n'échoue **jamais** l'appelant (le guard reste non-bloquant, fidèle
à sa nature GT.1/GT.2), le `console.warn` d'origine est conservé **en plus** de la persistance (pas
remplacé, conformément à la décision ADR). Les 9 call sites d'origine sont migrés avec le
`ContexteDetectionEcart` correct (`ARRIVAGE`, `TRANSFERT` ×2, `CALIBRAGE`, `VENTE`, `VENTE_ALEVINS`,
`BON_LIVRAISON`). Les 2 clamps de `bons-livraison.ts` écrivent bien dans `SiteAuditLog`
(`BL_CLAMP_NOMBRE_VENDUS_NEGATIF`), séparément d'`EcartAssignationConstate` — les deux signaux ne
sont pas mélangés, comme tranché en section 2 de l'ADR. `getBacsEnDerive` est une simple query
Prisma (`findMany` + `include`) sans N+1. R7 respectée (`dernierActorId`, `resoluLe` nullable,
justifiés) ; R8 respectée (`siteId` NOT NULL, indexé). Index `[siteId, ecart]` et `[vagueId]`
présents et alignés sur les besoins de requête documentés dans l'ADR.

### SU.3 — VALIDÉ
`pg_advisory_xact_lock` posé sur `tx` (jamais sur le client Prisma global — condition nécessaire
pour que le verrou protège effectivement quelque chose), avec une clé scopée modèle + pattern +
site (pas de sur-blocage de portées disjointes). Les 4 helpers dupliqués (Facture, Commande, Vente,
BonLivraison) sont migrés vers `numero-utils.ts`. La duplication inline de génération CMD dans
`besoins.ts` a été supprimée à cette occasion ; `generateNumeroBesoin` a été déplacé **dans** la
transaction (il n'a de sens qu'à l'intérieur de la fenêtre verrouillée). Aucune transaction
imbriquée détectée. Nit accepté : `tx[model] as any` — usage isolé, commenté, nécessaire pour
généraliser le helper sur plusieurs modèles Prisma sans dupliquer la fonction par modèle.

### SU.4 — VALIDÉ
Vrai test d'intégration Postgres (pas de mock du moteur de transaction, cf. leçon ERR-103(e)).
Rollback réel vérifié sur 7 tables touchées par `signerBonLivraison`. Nettoyage `finally` confirmé
(suppressions scopées par préfixe `siteId`, aucune pollution résiduelle en cas d'échec du test
lui-même). Limitation honnêtement documentée dans le rapport de test : le pool de connexion
`max: 1` sérialise les accès, donc le test ne peut pas prouver une vraie course **inter-connexions**
concurrentes — seulement l'atomicité du rollback. Acceptable : le scénario principal à risque
(atomicité) est couvert ; la vraie concurrence multi-connexion resterait à couvrir dans un sprint
dédié si jugée prioritaire.

### SU.5 — VALIDÉ (fermée sans action)
Tous les consommateurs de relevés `MORTALITE` ont été vérifiés (calculs per-bac, agrégats vague,
stock de lot, statistiques de reproduction, listes génériques) : chacun exclut nativement le relevé
orphelin (`bacId: null` **et** `vagueId: null`), soit par filtre explicite, soit parce que la
relation Prisma le charge déjà sous condition. Aucune faille trouvée, aucun calcul faussé. Seule
limite relevée (traçabilité, pas exactitude) : `lotAlevinsId` non renseigné sur ce relevé — jugée
hors périmètre d'un correctif de bug, à raison.

### SU.6 — VALIDÉ
(a) `uniteAchat` retypé `UniteStock | null` (R3 respectée). (b) Le seuil `> 1` retenu pour le
pluriel est cohérent entre UI et PDF, et évite le piège classique
`Intl.PluralRules("fr").select(1.5) === "one"` (l'API `Intl.PluralRules` en français traite 1.5
comme singulier grammatical selon la CLDR, ce qui aurait produit "1.5 sac" — un seuil numérique
simple `> 1` sur la valeur déjà arrondie est le choix correct ici, pas une API d'internationalisation
générique mal appliquée à un cas déjà résolu par arrondi). (c) La contenance du sac est désormais
affichée au PDF, à parité avec l'UI. (d) `formatNumPDF` appliqué pour le séparateur de milliers.
Aucune divergence UI/PDF résiduelle : l'UI arrondissait déjà à l'entier
(`maximumFractionDigits: 0`), donc le fix PDF les aligne sans introduire de nouvel écart.

### SU.7 — VALIDÉ
`useId()` interne + prop `id?` optionnelle exposée au consommateur — pattern strictement identique
à celui déjà en place sur `Input`/`Select`. L'id n'est plus dérivé du texte de label traduit ;
`<label htmlFor>` reste correctement associé.

### SU.8 — VALIDÉ
Arbitrage respecté à la lettre : permission par possession (aucun garde codé en dur par rôle) —
`signer/route.ts` teste `auth.permissions.includes(...)`, jamais un `if (role === "GERANT")`
explicite. L'exclusion actuelle du Gérant de `BONS_LIVRAISON_RECTIFIER` reste un défaut de seed
modifiable a posteriori par un admin de site (SiteRole éditable), pas une restriction figée dans le
code. Le backfill (story connexe SU.10) est scopé strictement à `Administrateur`, sans toucher à
`BONS_LIVRAISON_RECTIFIER` tant que l'utilisateur n'a pas tranché — conforme à la consigne "ne pas
trancher seul si ambigu".

### SU.9 — VALIDÉ AVEC RÉSERVE
Le Sprint PX est bien inscrit et clos dans `docs/TASKS.md`. Réserve : le tableau Sprint SU de
`docs/TASKS.md` était incomplet au moment de cette review (SU.10, SU.11, SU.12 absentes du tableau,
statuts de certaines stories obsolètes/périmés par rapport à l'avancement réel). Voir tableau des
réserves ci-dessous (réserve n°1).

### SU.10 — VALIDÉ
Backfill idempotent (`DISTINCT` + `unnest` sur les tableaux de permissions existants — pas de
doublon si rejoué). Labels ajoutés dans `role-form-labels.ts` (cf. ERR-088). Test de garde de bonne
qualité : la liste d'exclusion est réduite à 3 permissions strictement plateforme, chacune justifiée
par ADR-021, pas une liste d'exclusion fourre-tout qui viderait le garde de son sens.

### SU.11 — VALIDÉ
`formatNumPDF`/`formatDecimalPDF` factorisés dans `src/lib/export/pdf-format-utils.ts` et réutilisés
par `pdf-cout-production-insights.ts` (`formatK`, `formatKg`). La garde ajoutée est à deux volets
(structurel : grep de `.toLocaleString(` dans `src/lib/export/*` ; runtime : caractère hors table
WinAnsi détecté dans un texte destiné au PDF) — non décorative, les deux volets échouent
effectivement sur une régression réintroduite.

### SU.12 — VALIDÉ AVEC RÉSERVE
9 familles de modèles corrigées (`@@unique([siteId, numero|code])` en remplacement de la contrainte
`@unique` globale). Aucun `@unique` global résiduel détecté sur les champs concernés. Migration
propre (additive du point de vue structurel, cohérente avec ERR-038/ERR-049). Script d'audit
strictement read-only. Réserve : `LotAlevins.code` constitue une **10ᵉ famille** avec le même
problème structurel (compteur scopé par site, contrainte globale), non couverte par le scope
initial de SU.12 — a donné lieu à l'ouverture de la story **SU.13**. Voir réserve n°4.

### SU.13 — statut à confirmer
Ouverte pour lever la réserve `LotAlevins.code` laissée par SU.12. Au moment de la rédaction de
cette review, son traitement était en cours — se référer à `docs/TASKS.md` pour le statut final.

---

## Tableau des réserves

| # | Réserve | Sévérité | Traitement |
|---|---------|----------|------------|
| 1 | `docs/TASKS.md` — tableau Sprint SU incomplet (SU.10-12 absentes, statuts stales) | Moyenne | En cours de correction (@status-updater) |
| 2 | `docs/sprints/SPRINT-SU.md` — stale, SU.8 encore marqué BLOQUÉ dans le tableau récapitulatif alors que la partie non ambiguë a été extraite en SU.10 | Moyenne | En cours |
| 3 | ERR-104 référencé dans le code et les tests (`pdf-format-utils.ts`, `pdf-winansi-format-guard.test.ts`) mais absent de `docs/knowledge/ERRORS-AND-FIXES.md` | Basse | Corrigé par cette capitalisation (voir ci-dessous) |
| 4 | `LotAlevins.code` — 10ᵉ famille d'unicité globale oubliée par SU.12 | Moyenne | Story **SU.13** |
| 5 | `tx[model] as any` dans `numero-utils.ts` | Nit | Accepté (isolé, commenté) |

---

## Constat de process — parallélisation sur un working tree partagé

Plusieurs agents ont travaillé **en parallèle sur le même working tree** pendant ce sprint, ce qui
a provoqué des courses d'édition observées sur au moins trois fichiers : `prisma/seed.sql`,
`pdf-cout-production.tsx`, `permissions-orphan-guard.test.ts`. Un `git stash` accidentel sans
pathspec a également eu lieu en cours de sprint. Un audit d'intégrité a été mené et a conclu
qu'**aucun travail n'a été perdu** : le working tree final constituait un surensemble strict du
contenu stashé.

**Recommandation forte : isoler les agents dans des git worktrees séparés lors des prochains
sprints fortement parallélisés**, pour éliminer structurellement ce risque de collision
d'édition plutôt que de compter sur un audit a posteriori.

---

## Conformité R1-R9

- **R1/R2** OK sur l'ensemble des stories touchant des enums (`ContexteDetectionEcart`,
  `UniteStock`) — valeurs importées, aucune chaîne en dur.
- **R3** OK, y compris l'étendue Prisma=TS=Zod pour `EcartAssignationConstate` (SU.2).
- **R4** OK — `persisterEcartConstate` appelée à l'intérieur de la même transaction que le guard
  (rollback cohérent) ; `pg_advisory_xact_lock` posé sur `tx` (SU.3).
- **R6** non concerné par ce sprint (aucune nouvelle couleur en dur introduite).
- **R7** OK — nullabilité de `EcartAssignationConstate` décidée et justifiée dans l'ADR-048 avant
  implémentation.
- **R8** OK — `EcartAssignationConstate.siteId` NOT NULL, indexé.
- **R9** OK — `npx vitest run` (5697 passés / 26 todo / 0 échec, 222 fichiers) et `npm run build`
  (exit 0) exécutés en fin de sprint, machine libre.

## Verdict

**VALIDÉ AVEC RÉSERVES.** Aucune réserve n'est bloquante : les 5 points du tableau ci-dessus sont
soit déjà en cours de correction dans ce même cycle (réserves 1, 2), soit corrigés par le présent
travail de capitalisation (réserve 3), soit déjà pris en charge par une story de suivi ouverte
(réserve 4), soit un nit accepté (réserve 5). Le sprint peut être clos dès que les réserves 1 et 2
sont effectivement appliquées à `docs/TASKS.md` et `docs/sprints/SPRINT-SU.md`.
