Verdict final : **VALIDÉ** (après correction ; verdict initial : **VALIDÉ SOUS RÉSERVE**). Réf : ADR-053 §16.6, §16.8, §16.9, §16.10, §16.11, §16.12 ; `docs/analysis/pre-analysis-story-A5-poste-referentiel-admin.md` ; `docs/tests/rapport-story-A5-poste-referentiel-admin.md`. Date 2026-08-05.

## Statut R1-R11

Toutes OK.
- R1/R2/R3/R7/R8 : conformes, aucun écart de schéma constaté (`PosteReferentiel.actif`, `PostePrevision.posteReferentielId` NOT NULL déjà en base depuis `20260805120000_add_poste_referentiel`).
- R4 : opérations atomiques inchangées depuis A.4 (get-or-create transactionnel avec retry P2002).
- R5 : `DialogTrigger asChild` vérifié dans `poste-form-dialog.tsx` et `postes-referentiel-admin-client.tsx` (un seul `<button>` par action, testé explicitement dans `postes-referentiel-admin-client.test.tsx`).
- R6 : variables de thème CSS, aucune couleur en dur constatée dans les nouveaux composants.
- R9 : suite complète exécutée avant review — 341 fichiers / 9712 tests / 0 échec.
- R10 : **aucune migration nécessaire, confirmé.** Le champ `actif` et la FK `posteReferentielId` existent déjà ; renommage et désactivation touchent des colonnes existantes, aucun DDL requis pour cette story.
- R11 : aucun secret en dur constaté dans les fichiers modifiés ou créés.

## Écart Moyenne #1 (corrigé) — `POSTE_REFERENTIEL_CHAMP_REQUIS` inatteignable par la route HTTP réelle

Le `.refine()` de `createPostePrevisionSchema` (validation Zod, couche `src/lib/validation/previsions.schema.ts` — en amont de la query) court-circuitait la requête HTTP **avant** que `createPostePrevision` ne soit jamais appelée : `parseBody` répondait 400 sur l'échec du `.refine()`, mais sans jamais poser de `code` exploitable (`POSTE_REFERENTIEL_CHAMP_REQUIS` restait un identifiant défini côté query, jamais transmis au JSON de réponse). Conséquence :
- La branche serveur qui pose ce `code` dans `createPostePrevision` était du **code mort** — inatteignable depuis la route réelle, uniquement exercée par les tests qui appellent la fonction directement en contournant Zod.
- Le mapping client `posteForm.errors.champRequis` (qui dépend de `code === "POSTE_REFERENTIEL_CHAMP_REQUIS"` dans la réponse HTTP) était donc lui aussi mort en pratique : un utilisateur qui soumettait le formulaire sans aucun champ recevait un 400 Zod générique, jamais le message localisé attendu.

**Correction appliquée** : `params: { code: "POSTE_REFERENTIEL_CHAMP_REQUIS" }` ajouté sur le `.refine()` Zod concerné, relayé par `parseBody` (`src/app/api/previsions/_shared.ts`) jusqu'au JSON de réponse — le contrat documenté par l'ADR et testé au niveau fonction est désormais également celui réellement servi par la route HTTP.

**Vérification croisée effectuée** : `POSTE_REFERENTIEL_CHAMPS_EXCLUSIFS` (l'autre `.refine()` du même schéma) a été audité et **n'était pas mort** — la condition de garde est un OU (`champA fourni OU champB fourni`), pas un XOR strict au niveau Zod ; le cas « les deux champs fournis » traverse donc bien la validation Zod sans être rejeté à cette couche, et atteint effectivement `createPostePrevision`, où le `code` correspondant est réellement posé et propagé. Aucune correction nécessaire sur cette branche.

## Écart Basse #1 (corrigé) — double affichage du message d'erreur

`poste-form-dialog.tsx` affichait le message d'erreur du cas `POSTE_REFERENTIEL_INACTIF` deux fois : une fois via la prop `error` de l'`Input`, une fois via un bloc `{error && !collision}` séparé rendu juste en dessous. Corrigé — un seul affichage désormais.

## Nouveau point Basse — non bloquant, à mettre au backlog

`src/components/previsions/poste-form-dialog.tsx` : rien ne désactive les `Tabs` (Rechercher/Créer) pendant `submitting`. Un utilisateur qui change d'onglet pendant une requête en vol peut faire passer `etape2Visible` à `false` avant la résolution de la promesse ; l'`Input` porteur du `role="alert"` est alors démonté et **l'erreur devient silencieuse** (la réponse d'erreur arrive mais ne s'affiche plus nulle part, l'onglet affiché ne portant plus l'élément prévu pour la recevoir). Fenêtre de course étroite, **préexistante** — pas une régression introduite par A.5, non corrigée dans cette story, à planifier séparément.

## Points laissés ouverts par l'ADR (non bloquants pour A.5)

- Conflation « introuvable » / « désactivé » dans `cibleReferentielIntrouvableWarning` de `mapping-form-dialog.tsx` — les deux états produisent le même message d'avertissement côté utilisateur.
- Absence d'avertissement « blast radius » à la désactivation d'une entrée référentiel (combien de `PostePrevision`/scénarios seraient affectés avant confirmation).
- Pas de test end-to-end navigateur réel (Chromium) pour l'écran d'admin — uniquement jsdom (cf. ERR-157 : jsdom ne prouve pas le rendu visuel réel).

## Dette projet non imputable à A.5

`npx tsc --noEmit` sur `tsconfig.json` complet : ~1449 erreurs préexistantes, déjà tracées dans `docs/reviews/review-sprint-PR2-octies.md` (porteur @project-manager, hors périmètre de cette story). **A.5 a réduit ce compteur d'environ 19** (corrections de fixtures de test enrichies avec les nouveaux champs non optionnels `posteReferentielId`/`posteReferentiel` du DTO).

## Chiffres de clôture

341 fichiers / 9712 tests / 0 échec / 26 todo pré-existants (module densité, hors périmètre) ; recette moteur pur 2709/2709, inchangée ; `npm run build` exit 0 (vérifié trois fois pendant la falsification) ; intégrité EXCEL-V12 vérifiée identique avant/après par SQL direct (`VaguePrevue` 19, Σ `effectifAlevinsPrevu` 602 500, `AlimentPrevision` 3, `PalierRemise` 4, Σ `ApportCapital.montantFCFA` 30 000 000, Σ `JournalDepensePrevue.montantFCFA` 34 400 000, `PosteReferentiel` 4, `PostePrevision` 4, `MappingRapprochement` 0).

Falsification : 9 règles falsifiées au total sur les deux passages de test, toutes couvertes (aucune tombée à 0 test résiduel après complément — cf. §8.4 du rapport de test pour le trou détecté puis comblé en cours de falsification, sous-cas « entrée inactive + libellé coïncident » sur les 3 vues de rapprochement).
