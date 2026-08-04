# Review — Sprint PR2-ter, Story PR2ter.1 (Reporter une charge sur plusieurs mois)

**Reviewer** : @code-reviewer
**Périmètre revu** : `src/app/api/previsions/postes/[id]/charges/reporter/route.ts` + test, `src/lib/queries/previsions-charges.ts` (`reporterChargeMensuelle`) + test, `src/lib/validation/previsions.schema.ts` (`reporterChargeMensuelleSchema`), `src/components/previsions/reporter-charge-dialog.tsx` + test, `src/components/previsions/charges-tab.tsx`, `src/components/previsions/scenario-detail-client.tsx`, `src/components/previsions/__tests__/{charges-tab,permissions-gating}.test.tsx`, `src/messages/{fr,en}/previsions.json`.
**Méthode** : lecture directe de chaque fichier applicatif et de test — pas une relecture des rapports @pre-analyst/@tester, vérification indépendante des points listés dans la consigne.

## Verdict : **VALIDÉ AVEC RÉSERVES** (aucune réserve bloquante)

## 1. R8 — isolation par site (point le plus critique)

Vérifié route → query, chemin complet :
- La route lit `auth.activeSiteId` (issu de `requirePermission`) et le passe tel quel à `reporterChargeMensuelle` — jamais de `siteId` extrait du payload (`reporterChargeMensuelleSchema` ne contient d'ailleurs pas de champ `siteId` du tout, donc aucune possibilité d'en injecter un côté client).
- `reporterChargeMensuelle` (`src/lib/queries/previsions-charges.ts:202-227`) fait `tx.postePrevision.findFirst({ where: { id: posteId, siteId } })` **à l'intérieur de la transaction**, avant toute écriture. Un poste d'un autre site est donc structurellement inatteignable, y compris avec un `id` deviné : l'erreur levée (`"PostePrevision introuvable"`) est identique qu'il s'agisse d'un poste inexistant ou d'un poste d'un autre site — pas de fuite d'information sur l'existence du poste.
- Confirmé par test réel (`previsions-charges.test.ts:183-192`) : poste d'un autre site → rejet, **zéro** ligne créée.
- Route testée (`route.test.ts:174-187`) : erreur mappée en 404, sans distinction poste-inexistant / poste-autre-site — comportement correct et volontaire.

**Verdict R8 : conforme, sans réserve.**

## 2. R4 — atomicité réelle

`reporterChargeMensuelle` enveloppe `findFirst` **et** la boucle complète d'`upsert` dans une seule `prisma.$transaction(async (tx) => {...})` (lignes 202-227) — aucun check-then-write en dehors de la transaction, aucune boucle de `upsertChargeMensuelle` indépendants côté route (la route appelle une seule fois `reporterChargeMensuelle`).

Le test le plus convaincant (`previsions-charges.test.ts:230-260`) simule une panne réelle **après** que 2 upserts sur 5 aient déjà muté le store, et prouve que les 2 écritures réussies sont annulées (0 ligne restante). C'est la preuve exacte que l'arbitrage « route en lot plutôt que boucle client » de la pré-analyse est honoré : l'atomicité n'est pas simplement une précondition vérifiée avant tout accès DB, elle couvre un vrai rollback mi-parcours.

**Verdict R4 : conforme, la story obtient bien le bénéfice qui justifiait son coût.**

## 3. Aperçu avant écrasement — exigence centrale

Vérifié par lecture directe de `reporter-charge-dialog.tsx` (lignes 124-145) : le calcul de l'aperçu (nombre de mois, mois écrasés avec ancien/nouveau montant, message explicite si 0 écrasement) est purement dérivé de la prop `charges` (déjà chargée en mémoire par `ChargesTab`), sans aucun appel réseau avant confirmation. Le composant filtre strictement par `posteId` (`c.posteId === posteId`), confirmé par un test dédié qui vérifie qu'un autre poste sur le même mois n'apparaît jamais dans l'aperçu.

**Risque de divergence identifié, non bloquant** : l'aperçu est calculé sur `charges`, un instantané chargé au montage de la page (via `initialCharges` → état React de `ChargesTab`). Si un autre utilisateur (ou un autre onglet) modifie une charge de la même plage **entre** l'affichage de l'aperçu et la confirmation, le serveur écrasera la valeur réelle courante (pas celle affichée dans l'aperçu) sans le signaler — l'aperçu peut alors annoncer un « ancien montant » périmé. Ce risque est réel mais :
- il est structurellement identique à celui de la route unitaire préexistante (`upsertChargeMensuelle` n'a jamais eu de verrou optimiste non plus) — aucune régression introduite par cette story ;
- le dialogue étant modal, aucune interaction locale ne peut faire diverger `charges` pendant que le dialogue est ouvert dans le même onglet ;
- le cas concret (deux utilisateurs simultanés sur le même poste/plage) est un scénario rare pour ce module mono-utilisateur typique.

Pas de chemin où l'aperçu montrerait un sous-ensemble de la vraie plage envoyée au serveur : `apercu.moisDebutAbsolu`/`moisFinAbsolu` sont exactement ceux envoyés dans `handleConfirmer` (ligne 175-176) — aucun recalcul serveur divergent, la plage n'est jamais recalculée côté serveur.

## 4. Bornes de la plage

- `.refine` Zod (`moisFinAbsolu >= moisDebutAbsolu`) vérifié par test, y compris échec **avant** tout accès DB (`previsions-charges.test.ts:194-202`).
- Cas limite mois=0, plage d'un seul mois, horizon=1 : tous testés (`reporterChargeMensuelle("p1","site-A",500000,3,3)` → 1 ligne ; côté dialogue, horizon=5 avec `moisCourant` variable).
- **Observation non bloquante, pré-existante, hors périmètre de cette story** : le bouton « mois suivant » de `charges-tab.tsx` (ligne 176-183) n'a **aucune borne haute** (`onClick={() => setMoisAbsolu((m) => m + 1)}`, `disabled` seulement sur `moisAbsolu === 0`). Si un utilisateur navigue au-delà de `horizonMois - 1`, l'option « depuis ce mois » du dialogue produit `moisDebutAbsolu > moisFinAbsolu` → `planPourPlage` retourne `null` → message affiché : *« Horizon du plan indisponible pour le moment »* — message trompeur puisque l'horizon **est** disponible, c'est `moisCourant` qui est hors plage. Ce bug de navigation est antérieur à cette story (`charges-tab.tsx` PR2.3) et n'est pas introduit par elle ; seul le message d'erreur du nouveau dialogue expose la conséquence de façon un peu confuse. Sévérité basse, à traiter en polish (pas dans PR2-ter).

## 5. Validation Zod — cohérence avec le schéma unitaire

Vérifié ligne à ligne : `reporterChargeMensuelleSchema.montantFCFA` utilise le **même** helper `nonNegativeNumber` que `upsertChargeMensuelleSchema.montantFCFA` (`previsions.schema.ts:46` et lignes 220-240) — même type, même traitement (pas d'arrondi, `number` brut, converti en `Decimal` par Prisma de la même façon dans les deux routes, aucun `Math.round` ni troncature ajouté dans l'un et pas l'autre). Les bornes (`moisDebutAbsolu`/`moisFinAbsolu`) utilisent `positiveInt`, identique à `upsertChargeMensuelleSchema.moisAbsolu`. Aucune incohérence de comportement entre saisie unitaire et saisie en lot pour un même montant.

## 6. Patron de dialogue PR2ter.2

Confirmé par lecture de `reporter-charge-dialog.tsx` :
- `reset()` appelé sur tout chemin de fermeture (`handleOpenChange(false)`, ligne 119-122).
- Annuler appelle explicitement `handleOpenChange(false)` (ligne 278), pas un `setOpen(false)` direct.
- `useDialogCloseGuard(touched)` câblé sur `onInteractOutside`/`onEscapeKeyDown` du `DialogContent` (lignes 94, 198).
- Tests dédiés (clic extérieur vierge → ferme / touché → ne ferme pas, avec le délai `setTimeout(resolve, 0)` requis par `DismissableLayer`) présents et cohérents avec le patron validé en PR2ter.2.

## 7. Gating de permission

- UI : `ReporterChargeDialog` n'est rendu que si `peutGerer` (`charges-tab.tsx` ligne 235), identique au bouton `Enregistrer` existant.
- Serveur : `requirePermission(request, Permission.PREVISIONS_GERER)` dans la route (ligne 30).
- Les deux couvertes par test : `permissions-gating.test.tsx` (bouton absent avec `PREVISIONS_VOIR` seule, présent avec `PREVISIONS_GERER`) et `route.test.ts` (401/403).

## 8. i18n

Parité stricte vérifiée par lecture directe des deux fichiers : 21 clés feuilles identiques de chaque côté sous `reporterChargeDialog`, structure miroir exacte, accents français corrects (`Aperçu`, `écrasés`, `consécutifs`). Aucune chaîne en dur trouvée dans `reporter-charge-dialog.tsx` (grep confirmé).

## 9. R5/R6/any/mobile-first

- R5 : `<DialogTrigger asChild>` présent (ligne 192). Conforme.
- R6 : aucune couleur hex en dur (grep confirmé 0 résultat) ; classes utilitaires du thème uniquement (`text-danger`, `text-warning`, `text-muted-foreground`).
- Aucun `any` dans les fichiers créés/modifiés (grep confirmé).
- Mobile first 360px : l'aperçu des mois écrasés est une `<ul>` avec `list-disc`, pas un tableau — pas de risque de débordement horizontal à 360px, cohérent avec la règle « pas de tableaux sur mobile ».

## 10. Périmètre

Confirmé par grep : aucun fichier sous `src/lib/previsions/` modifié par cette story ; aucune trace de rapprochement, vue de comparaison, export, ou reprévision dans le code créé/modifié.

---

## Tableau des réserves

| # | Réserve | Sévérité | Bloquante pour clore PR2-ter ? |
|---|---|---|---|
| 1 | Aperçu calculé côté client sur un instantané en mémoire (`charges`) : une modification concurrente entre affichage de l'aperçu et confirmation ne serait pas détectée (pas de verrou optimiste). Risque structurellement identique à la route unitaire préexistante, pas une régression introduite par cette story. | Basse | Non |
| 2 | Le bouton « mois suivant » de `charges-tab.tsx` (pré-existant, hors périmètre de cette story) n'a pas de borne haute sur `horizonMois` ; combiné au nouveau dialogue, un utilisateur qui a navigué au-delà de l'horizon reçoit le message trompeur « Horizon du plan indisponible » alors que le vrai problème est `moisCourant` hors plage. | Basse | Non — bug pré-existant, à traiter en polish (pas dans cette story) |

**Conclusion** : les deux exigences les plus critiques de la consigne (R8 isolation par site jusqu'au bout de la chaîne, R4 atomicité réelle avec preuve de rollback mi-parcours) sont pleinement honorées, avec preuve par test et non par lecture seule des rapports. L'aperçu avant écrasement respecte l'exigence centrale de la story (nombre exact de mois, liste des mois déjà saisis avec ancien→nouveau, message explicite si 0 écrasement), sans chemin de code où un écrasement pourrait survenir sans que l'aperçu l'ait annoncé pour la plage réellement envoyée au serveur. Les deux réserves relevées sont de sévérité basse et non bloquantes pour la clôture du sprint PR2-ter.
