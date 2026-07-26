# Review Sprint PX — Robustesse du rendu PDF (bugfix, sévérité Critique)

**Reviewer :** @code-reviewer
**Sévérité du bug :** CRITIQUE
**Verdict : VALIDÉ**

**Périmètre revu :** `src/lib/validation/image-decode.ts`, `src/lib/validation/common.schema.ts`, `src/lib/export/render-pdf-safely.ts`, `src/lib/export/pdf-bon-livraison.tsx`, les 5 routes d'export, `scripts/data-fixes/px-audit-signatures-corrompues.ts`, et l'ensemble des tests du sprint.

## Point d'attention n°1 (a) — Exhaustivité de la pré-validation

Grep exhaustif de `<Image` dans `src/lib/export/` : seul `pdf-bon-livraison.tsx` embarque des images (4 : signatureClient, signatureLivreur, signaturePromoteur, cachet, via `SignatureBlock`). Les 4 autres templates n'embarquent aucune image. `Site` n'a pas de champ `logo`. Les 4 images passent bien par `safeSignatureImage()` → `decodeImageDataUrl()` avant injection dans `<Image>`, avant l'unique `renderToBuffer()` (l. 756).

Contournement : partiellement possible — rien n'empêche mécaniquement un futur développeur d'ajouter un `<Image src={...}>` non pré-validé dans un nouveau template (pas de lint rule ni de test structurel). Repose sur la discipline documentée, pas sur un garde-fou structurel. Recommandation mineure non bloquante : test de garde ou règle ESLint. Compensé par (b), indépendant du template consommateur.

## Point d'attention n°1 (b) — Le garde-fou au rendu est-il INCONDITIONNEL ? OUI

C'est la conclusion centrale.

- Le timeout dur (`PDF_RENDER_TIMEOUT_MS = 15000`) est posé indépendamment de tout autre mécanisme (`setTimeout` dans la promesse englobante) : **G1 (la requête répond toujours)** est garanti quel que soit le comportement de `renderFn()`.
- Le refcount (`inFlightRenders: Set<InFlightEntry>`) installe le listener partagé au passage 0→1 et le retire au passage →0 (`cleanup()` dans `settleOnce`). Aucun rendu ne retire le listener d'un autre : la décision de retrait dépend uniquement de `inFlightRenders.size === 0`, pas de l'identité du rendu (vérifié l. 259-266, 275-281).
- Les marqueurs `KNOWN_PDF_STACK_MARKERS` ne conditionnent **plus** la capture (révision PX.3-bis) : ils ne qualifient que le log (`hasKnownPdfSignature`, l. 191). La capture est inconditionnelle tant que `inFlightRenders.size > 0` ; `sharedUncaughtExceptionHandler` fait échouer TOUS les rendus en vol, sans branche de ré-émission. **G2 (un rendu PDF ne tue jamais le worker)** est garanti.
- Aucune exception avalée silencieusement : `console.error` avec contexte complet avant transformation en `PdfRenderError`.
- Les erreurs légitimes remontent inchangées via `.catch((error) => settleOnce(() => reject(error)))` — testé positivement (`render-pdf-safely.test.ts` l. 267-292 : `rejects.toBe(legitimateError)`, même référence d'objet, preuve forte qu'aucune erreur légitime n'est masquée).
- Limite (refcount à 0 au moment de l'exception) honnêtement documentée en en-tête (§ « FRONTIÈRE ASSUMÉE », l. 72-77), choix volontaire de ne pas devenir un handler global permanent.

## Preuve exigée — TROUVÉE et jugée SUFFISANTE

`src/__tests__/export/pdf-render-guard-unconditional.test.ts` construit via `buildPngThatPassesUpstreamButBreaksReactPdf` (l. 60-99) un PNG dont l'IDAT est un flux zlib **parfaitement valide** (donc `isDecodableImage() === true`, sanity-check dédié l. 177-180) mais dont le contenu décompressé porte un octet de « filter type » invalide (7, hors spec PNG 0-4), qui fait réellement planter `@react-pdf/png-js`. C'est exactement le scénario redouté : une image qui **passe la validation amont et casse le décodeur de la lib**, isolant la divergence entre les deux décodeurs plutôt que de la simuler par un mock.

Les l. 182-225 prouvent d'abord, **sans le wrapper**, que le bug historique est bien reproduit sur cette fixture (promesse jamais réglée + exception échappée au process). Les l. 227-288 réutilisent la même fixture enveloppée par `renderPdfSafely(() => renderBonLivraisonPDF(dto), ...)` et vérifient :
1. résolution bornée (`elapsedMs < 8000`, bien avant les 15 s de prod) ;
2. résultat = soit `PdfRenderError({code:"UNCAUGHT_EXCEPTION"})`, soit buffer PDF valide en mode dégradé ;
3. le point le plus fort : le listener de test externe ne voit l'exception qu'**une seule fois** (dispatch initial inévitable de Node, documenté l. 141-161), jamais deux — preuve que `renderPdfSafely` l'a absorbée sans la ré-émettre ;
4. `process.listenerCount("uncaughtException")` revient à sa valeur initiale (pas de fuite).

`route-render-guard.test.ts` (l. 166-191) refait la preuve bout en bout sans mocker ni `pdf-bon-livraison` ni `render-pdf-safely` (seuls `requirePermission`/`getBonLivraisonForPDF` mockés) et vérifie que la requête répond **500** en délai borné (`elapsedMs < 9000`) au lieu de rester suspendue.

Ce n'est pas un test qui « passe parce que rien ne se résout » : il asserte une résolution positive avec contenu précis, et le compteur d'invocations du listener est la preuve la plus rigoureuse possible (1 = absorbé, 2+ = régression fail-open).

## Constats

**Bloquant :** aucun.
**Majeur :** aucun.

**Mineurs :**
1. Aucun garde-fou structurel (lint/test) contre un futur `<Image>` non pré-validé dans un nouveau template PDF — repose sur la discipline. Non bloquant, (b) protège en défense en profondeur (au prix d'un 500 au lieu d'un mode dégradé).
2. `docs/tests/rapport-sprint-PX.md` absent alors que PX.4 en fait un livrable — dette de traçabilité à combler avant clôture.
3. Textes FR relus (`SIGNATURE_ILLISIBLE_TEXT`, `"Image illisible ou corrompue."`, `"Format d'image non supporté (PNG ou JPEG uniquement)."`, sortie du script d'audit) : **corrects**, aucune faute résiduelle, la correction « à régénérer » est bien appliquée.

## Conformité R1-R9

- **R1/R2** OK (`StatutBonLivraison` importé, aucune chaîne de statut en dur).
- **R3 étendu** (Prisma=TS=Zod) OK : `ImageDecodeResult`/`ImageDecodeFormat` cohérents, le cas **multi-IDAT** est testé dans deux fichiers (`image-decode.test.ts` et `base64-image-schema.test.ts`) — aucun risque de faux positif.
- **R4** non concerné.
- **R6** : `pdf-bon-livraison.tsx` utilise des constantes hexadécimales locales — pattern préexistant du fichier (react-pdf ne supporte pas les CSS custom properties), pas une régression du sprint.
- **R7** OK (`SafeImage { image: string | null; corrupted: boolean }`, nullabilité explicite).
- **R8** non applicable (aucun nouveau modèle).
- **R9** OK (`npx vitest run` : 209 fichiers / 5539 tests / 0 échec ; `npm run build` exit 0).

Aucune nouvelle dépendance (`pg` préexistant). Aucun `console.log` de debug (les `console.log` du script CLI d'audit sont la sortie voulue ; `console.warn`/`console.error` sont des logs diagnostiques volontaires D2/D3).

## Sécurité

`decodeImageDataUrl` enveloppé d'un try/catch englobant (jamais de throw non capturé, testé sur entrée `null`/malformée). `zlib.inflateSync` **sans `maxOutputLength` explicite** — l'entrée est bornée à ~375 Ko par la limite Zod amont (500 000 caractères base64), donc l'amplification zlib réaliste plafonne à quelques centaines de Mo dans le pire cas, pas des gigaoctets : risque résiduel faible mais non nul, `maxOutputLength` explicite recommandé en défense en profondeur (non bloquant).

Parsing des chunks PNG borné par `while (offset + 8 <= buffer.length)` avec vérification `dataEnd + 4 > buffer.length` : pas de boucle infinie possible. Pas de fuite de stack trace HTTP : `PdfRenderError` tombe dans la branche générique de `handleApiError` → 500 avec `fallbackMsg`, jamais `error.message`/stack.

Mode dégradé : ne casse pas le rendu nominal (test « 4 images valides » dans `pdf-render-real.test.ts`), texte « Signature illisible » bien distinct de « Non renseignée » (texte + style ambre vs gris), conforme à D2.

## Verdict

**VALIDÉ.** Corrections recommandées non bloquantes :
1. Créer `docs/tests/rapport-sprint-PX.md`.
2. Garde structurel contre un futur `<Image>` non pré-validé.
3. Fixer `maxOutputLength` explicitement.

## Delta-review post-review (2026-07-26)

Trois corrections non bloquantes issues de la review principale (VALIDÉ) ont été apportées après coup et sont revues ici spécifiquement.

### Delta 1 — `maxOutputLength` sur `zlib.inflateSync` (image-decode.ts)

**Verdict : à corriger (mineur, non bloquant).**

- La borne de 8 Mo protège correctement contre une bombe zlib et le dépassement est bien capturé (jamais d'exception non gérée, résultat `{ ok: false }` propre).
- **Cependant** le raisonnement du commentaire ("366 Ko compressés ⇒ sortie bornée") est imprécis : la taille compressée ne borne pas la taille décompressée pour un PNG à fond uni/transparent (ratio de compression très élevé possible). La vraie garantie vient de deux contraintes non citées dans le commentaire :
  - `src/components/sites/image-upload-field.tsx` (`MAX_WIDTH = 600`) — largeur plafonnée à 600 px pour les cachets/signatures uploadés en fichier ;
  - `src/components/ui/signature-pad.tsx` — canvas de signature dont la largeur physique = `container.clientWidth × devicePixelRatio`.
- **Cas limite concret identifié** : sur un poste desktop large (conteneur ≈ 1200 px) avec `devicePixelRatio = 3` (écrans haute densité courants), le canvas de signature atteint ~3600×600 px physiques, soit `600 × (1 + 3600×4)` ≈ **8,24 Mo** décompressés — au-dessus du seuil actuel. Risque de **faux positif** (rejet d'une signature légitime comme "corrompue").
- Le message `"Flux IDAT illisible (...)"` est trompeur en cas de dépassement de `maxOutputLength` : il implique une corruption, alors que l'image est parfaitement valide, simplement plus volumineuse que la borne de sécurité.

**Corrections précises demandées :**
1. Remonter `MAX_INFLATE_OUTPUT_BYTES` à ~16 Mo (marge de sécurité par rapport au cas desktop haute-densité identifié ci-dessus), et/ou plafonner la largeur physique du canvas dans `signature-pad.tsx`.
2. Réécrire le commentaire de justification pour citer les contraintes réelles (`image-upload-field.tsx` MAX_WIDTH, dimensions du canvas de `signature-pad.tsx`) au lieu d'un scénario hypothétique non vérifié.
3. Distinguer la `reason` en cas de dépassement de `maxOutputLength` (`err.code === "ERR_BUFFER_TOO_LARGE"`) d'un vrai échec zlib, avec un message honnête distinct (ex. "Image trop volumineuse une fois décompressée — réduisez la résolution avant l'envoi.").

### Delta 2 — Test de garde structurel (pdf-image-predecode-guard.test.ts)

**Verdict : OK**, avec une note mineure.

- Assertion réelle et calculée dynamiquement (`expect(importsDecoder).toBe(true)`), pas de no-op ; garde anti-glob-vide présente.
- Robuste au reformatage (imports multi-lignes, alias, ordre des noms).
- Message d'échec pédagogique, référence ADR-047 explicite.
- Limite acceptée (vérifie la co-présence d'imports, pas l'usage réel dans le JSX) et justifiée dans les commentaires du fichier, mais gagnerait à énoncer **explicitement** cette limite en une phrase dédiée (un import inutilisé suffirait techniquement à satisfaire le garde).

### Delta 3 — `docs/tests/rapport-sprint-PX.md` (fusion)

**Verdict : OK.**

Le document fusionné est cohérent, sans contradiction entre le corps principal et l'Annexe A (rapport @tester préservé). La dette de test historique (`pdf-bon-livraison.test.ts`, `Image: () => null`, 15 tests "verts" sans jamais exécuter le vrai moteur de rendu) est documentée avec précision, de même que la distinction tests mockés / tests de rendu réel. Note mineure : le chiffre final global (`npx vitest run`) est référencé par renvoi à un message de clôture externe plutôt que reproduit intégralement dans le document — à inclure directement pour un rapport pleinement autoporteur.

### Fail-safe de `render-pdf-safely.ts` — confirmé

Relecture complète : la révision PX.3-bis est bien en place. Capture **inconditionnelle** de toute exception tant qu'un rendu est en vol (`inFlightRenders.size > 0`), aucune ré-émission conditionnelle vers `process.emit("uncaughtException", ...)`. `KNOWN_PDF_STACK_MARKERS` ne sert plus qu'à qualifier la confiance du log, jamais à conditionner la capture. Conforme à ADR-047 §D3 (révision PX.3-bis).

### Verdict global final du sprint : VALIDÉ

Les 3 deltas répondent aux recommandations mineures de la review principale. Un point (Delta 1) mérite un correctif avant mise en production impliquant le canvas de signature desktop haute-densité — non bloquant, la défense en profondeur (`renderPdfSafely()` fail-safe) reste opérationnelle même dans le pire cas. Les autres points sont des améliorations de documentation/robustesse à faible priorité, reportables au polissage.

### Suite donnée (@developer, 2026-07-26)

Les 3 deltas ont été corrigés :

- **Delta 1** : `MAX_INFLATE_OUTPUT_BYTES` remonté de 8 Mo à **16 Mo** (`src/lib/validation/image-decode.ts`). Commentaire de justification réécrit pour citer les contraintes réelles (`MAX_WIDTH = 600` de `image-upload-field.tsx`, dimensions du canvas de `signature-pad.tsx`, formule `height × (1 + width × 4)`) et le cas limite chiffré (~8,24 Mo). En défense en profondeur complémentaire, `devicePixelRatio` est désormais plafonné à 2 dans `src/components/ui/signature-pad.tsx` (fonction partagée `getCappedDevicePixelRatio()`, utilisée à la fois pour le dimensionnement du canvas et pour `handleClear()`) — jugé sans impact perceptible sur la netteté du tracé (trait de 2.5 px de large, pas de texte fin) même sur mobile haute densité. La `reason` retournée en cas de dépassement de `maxOutputLength` (`err.code === "ERR_BUFFER_TOO_LARGE"`) est désormais distincte et honnête : *"Image trop volumineuse une fois décompressée (limite de sécurité dépassée) — réduisez la résolution avant l'envoi."*, au lieu du message trompeur "Flux IDAT illisible". Deux tests ajoutés à `src/lib/validation/__tests__/image-decode.test.ts` : (1) acceptation d'un PNG RGBA ~3600×600 (cas limite desktop haute-densité, non-régression du faux positif) ; (2) rejet d'une bombe zlib avec la nouvelle `reason` distincte, sans exception non capturée.
- **Delta 2** : phrase de limite explicite ajoutée au commentaire d'en-tête de `src/__tests__/export/pdf-image-predecode-guard.test.ts` (le garde vérifie la co-présence des imports, pas l'usage réel dans le JSX).
- **Delta 3** : `docs/tests/rapport-sprint-PX.md` §5 rendu autoporteur — chiffres finaux (`npx vitest run` : 211 fichiers, 5554 tests passés, 26 todo, 0 échec ; `npm run build` OK) inclus directement dans le document, plus la mention des flakys connus.

Vérification finale (R9) : `npx vitest run` → 211 fichiers de test, 5554 tests passés, 26 todo, 0 échec (flakys connus non déclenchés dans cette exécution). `npm run build` → OK, build de production complet sans erreur.
