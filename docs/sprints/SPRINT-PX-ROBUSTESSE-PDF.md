# Sprint PX — Robustesse du rendu PDF (bon de livraison)

**Statut** : FAIT
**Origine** : `docs/analysis/pre-analysis-sprint-PX.md`
**Décisions** : [ADR-047-robustesse-rendu-pdf.md](../decisions/ADR-047-robustesse-rendu-pdf.md)
**Sévérité** : CRITIQUE (DoS authentifié, `GET /api/export/bon-livraison/[id]` peut ne jamais répondre et tuer le worker Node)

## Problème

`@react-pdf/png-js` (`decodePixels()`) exécute `zlib.inflate(this.imgData, (err, data) => { if (err) throw err; ... })`. Ce chemin n'est emprunté que pour les PNG RGBA/palette-transparente/entrelacés — exactement le format produit par un pad de signature tactile. Un PNG RGBA à IDAT corrompu provoque : (1) une promesse `renderToBuffer()` qui ne se règle jamais, (2) une exception qui s'échappe au niveau `process` (uncaught exception), hors de portée de tout `try/catch` applicatif. Les 4 champs image (`BonLivraison.signatureClient`, `signatureLivreur`, `Site.signaturePromoteur`, `Site.cachet`) ne sont validés aujourd'hui qu'au préfixe `data:image/` + à la taille (`base64ImageSchema`) — jamais au contenu réel des octets. Vecteur DoS authentifié via 2 routes d'écriture.

## Décisions retenues (voir ADR-047 pour l'argumentaire complet)

- **D1** : décodeur de validation à l'écriture = `zlib.inflateSync` natif Node, zéro nouvelle dépendance. PNG : concaténer TOUS les chunks IDAT avant inflate (piège du faux positif multi-IDAT). JPEG : SOI/EOI seulement. WEBP/GIF/SVG : rejetés (allowlist stricte `image/png` + `image/jpeg`/`jpg`). CRC non vérifié (hors périmètre).
- **D2** : mode dégradé confirmé à la lecture — placeholder texte `"Signature illisible (fichier image corrompu) — à régénérer auprès de l'administrateur du site"`, visuellement distinct du placeholder « Non renseignée », + log `warn` serveur (numéro BL / id site / champ concerné).
- **D3** : protection en deux couches, (a) pré-validation obligatoire avant `renderToBuffer` (rend le blocage structurellement impossible pour le cas connu) — ET (b) wrapper `renderPdfSafely()` **inconditionnel**, appliqué aux 5 routes d'export, avec timeout dur 15s + listener `uncaughtException` scopé (attaché juste avant l'appel, retiré en `finally`, ré-émission si l'exception n'est pas attribuable au rendu en cours).
- **D4** : un seul module par responsabilité — `src/lib/validation/image-decode.ts` et `src/lib/export/render-pdf-safely.ts` — jamais dupliqués route par route.
- **D5** : R3 étendu à Zod — tests de parse obligatoires (acceptation ET rejet), y compris le cas multi-IDAT.

## Stories

| Story | Titre | Type | Agent | Dépend de |
|-------|-------|------|-------|-----------|
| PX.1 | Décodeur défensif d'image + branchement Zod | BUGFIX (fondations) | @developer | aucune |
| PX.2 | Pré-validation des 4 images au rendu + mode dégradé | BUGFIX (rendu) | @developer | PX.1 |
| PX.3 | Wrapper `renderPdfSafely()` inconditionnel sur les 5 routes d'export | BUGFIX (défense en profondeur) | @developer | aucune (parallélisable avec PX.2) |
| PX.4 | Tests non mockés (repro du bug + non-régression) | TEST | @tester | PX.1, PX.2, PX.3 |
| PX.5 | Audit read-only des signatures/cachets en base | SCHEMA/QUERIES (lecture seule) | @db-specialist | aucune (parallélisable avec PX.1) |
| PX.6 | Review sprint (obligatoire, sévérité Critique) | REVIEW | @code-reviewer | PX.1-PX.5 |
| PX.7 | Capitalisation ERR-XXX | Capitalisation | @knowledge-keeper | PX.6 |

---

### PX.1 — Décodeur défensif d'image + branchement Zod

**Type** : BUGFIX (fondations)
**Agent** : @developer
**Dépendances** : aucune

**Description** :
Créer `src/lib/validation/image-decode.ts` exposant `decodeImageDataUrl(dataUrl: string): ImageDecodeResult` et `isDecodableImage(dataUrl: string): boolean` (signatures exactes, voir ADR-047 §D4). PNG : vérifier la signature magique, parser les chunks, **concaténer tous les IDAT avant `zlib.inflateSync`** (ne jamais inflate le premier chunk seul — faux positif documenté). JPEG : vérifier SOI (`FF D8`) + EOI (`FF D9`) uniquement. Tout autre MIME (webp, gif, svg, ...) → rejeté (`format: null`). Restreindre l'allowlist Zod de `base64ImageSchema`/`base64ImageOptionalSchema` aux MIME `image/png`, `image/jpeg`, `image/jpg`, et brancher `.refine(isDecodableImage, "Image illisible ou corrompue.")`.

**Fichiers concernés** :
- `src/lib/validation/image-decode.ts` (nouveau)
- `src/lib/validation/common.schema.ts` (`base64ImageSchema`, `base64ImageOptionalSchema`)

**Critères d'acceptation** :
- [ ] `decodeImageDataUrl()` accepte un PNG valide mono-IDAT
- [ ] `decodeImageDataUrl()` accepte un PNG valide **multi-IDAT** (non-régression du faux positif)
- [ ] `decodeImageDataUrl()` rejette un PNG à IDAT corrompu, avec `reason` renseignée
- [ ] `decodeImageDataUrl()` rejette un PNG sans chunk IDAT
- [ ] `decodeImageDataUrl()` accepte un JPEG avec SOI+EOI présents, rejette sinon
- [ ] `decodeImageDataUrl()` rejette `data:image/webp`, `data:image/gif`, `data:image/svg+xml` (`format: null`)
- [ ] Une data URL malformée ne fait jamais throw hors du try/catch interne du décodeur
- [ ] `PUT /api/sites/[id]` et `POST /api/bons-livraison/[id]/signer` rejettent en 400 un PNG RGBA à IDAT corrompu, avec message `"Image illisible ou corrompue."`
- [ ] Zéro nouvelle dépendance ajoutée à `package.json`
- [ ] `npx vitest run` et `npm run build` passent

**Statut : FAIT**

---

### PX.2 — Pré-validation des 4 images au rendu + mode dégradé

**Type** : BUGFIX (rendu)
**Agent** : @developer
**Dépendances** : PX.1

**Description** :
Dans `renderBonLivraisonPDF`/`BonLivraisonPDF`, appeler `decodeImageDataUrl()` sur chacune des 4 images (`signatureClient`, `signatureLivreur`, `signaturePromoteur`, `cachet`) **avant** de les injecter dans le composant `<Image>`, et **avant** tout appel à `renderToBuffer`. Toute image non décodable est remplacée par un placeholder texte distinct du placeholder « Non renseignée » : `"Signature illisible (fichier image corrompu) — à régénérer auprès de l'administrateur du site"` (style visuellement distinct, ex. fond ambre/orange). Journaliser (niveau `warn`, avec numéro du BL / id du site / champ concerné) à chaque détection.

**Fichiers concernés** :
- `src/lib/export/pdf-bon-livraison.tsx`

**Critères d'acceptation** :
- [ ] Un BL avec une signature RGBA à IDAT corrompu se rend en PDF sans erreur, avec le placeholder « Signature illisible » à la place de l'image concernée
- [ ] Le placeholder « Signature illisible » est visuellement et textuellement distinct du placeholder « Non renseignée »
- [ ] Un `console.warn`/logger `warn` est émis avec le contexte (numéro BL, champ concerné) à chaque détection
- [ ] Un BL avec les 4 images valides (nominal) se rend sans changement de comportement
- [ ] `npx vitest run` et `npm run build` passent

**Statut : FAIT**

---

### PX.3 — Wrapper `renderPdfSafely()` inconditionnel sur les 5 routes d'export

**Type** : BUGFIX (défense en profondeur), **obligatoire et inconditionnel**
**Agent** : @developer
**Dépendances** : aucune (parallélisable avec PX.2)

**Description** :
Créer `src/lib/export/render-pdf-safely.ts` (signatures exactes ADR-047 §D4 : `PDF_RENDER_TIMEOUT_MS = 15_000`, `PdfRenderErrorCode`, `PdfRenderError`, `RenderPdfSafelyContext`, `RenderPdfSafelyOptions`, `renderPdfSafely()`). Le wrapper attache un listener `process.on('uncaughtException')` **immédiatement avant** l'appel à `renderToBuffer`, le retire dans un `finally` dès que la promesse se règle, applique un timeout dur de 15s, et ré-émet (`process.emit`) toute exception non attribuable au rendu en cours (ne jamais avaler silencieusement). C'est cette protection — inconditionnelle, pas la pré-validation — qui constitue le filet de disponibilité réel. Brancher les **5 routes d'export** (`bon-livraison`, `facture`, `vague`, `vague/[id]/cout-production`, `finances`) sur ce wrapper, même celles qui ne manipulent aucune image (protection homogène contre un futur bug équivalent dans `@react-pdf/renderer`).

**Fichiers concernés** :
- `src/lib/export/render-pdf-safely.ts` (nouveau)
- `src/app/api/export/bon-livraison/[id]/route.ts`
- `src/app/api/export/facture/[id]/route.ts`
- `src/app/api/export/vague/[id]/route.ts`
- `src/app/api/export/vague/[id]/cout-production/route.ts`
- `src/app/api/export/finances/route.ts`

**Critères d'acceptation** :
- [ ] `renderPdfSafely()` retourne `Buffer` en cas de succès nominal, dans les 5 routes
- [ ] Une exception échappée pendant le rendu en cours est transformée en `PdfRenderError({ code: "UNCAUGHT_EXCEPTION" })`, journalisée (niveau `error`, avec contexte), jamais transformée en PDF dégradé silencieux
- [ ] Un dépassement de `PDF_RENDER_TIMEOUT_MS` rejette avec `PdfRenderError({ code: "TIMEOUT" })`
- [ ] Le listener `uncaughtException` est retiré (`removeListener`) dans un `finally`, jamais laissé attaché après résolution/rejet/timeout
- [ ] Une exception non attribuable au rendu protégé (survenant pendant la fenêtre mais ne correspondant à aucune signature connue pdfkit/png-js/@react-pdf) est ré-émise, pas absorbée
- [ ] Aucune route d'export ne contient sa propre logique de timeout/listener dupliquée — une seule implémentation dans `render-pdf-safely.ts`
- [ ] Un DTO invalide (erreur 400/500 normale, non liée au rendu) continue de remonter normalement — le wrapper ne masque pas les erreurs légitimes hors rendu
- [ ] `npx vitest run` et `npm run build` passent

**Statut : FAIT**

---

### PX.4 — Tests non mockés (repro du bug + non-régression)

**Type** : TEST
**Agent** : @tester
**Dépendances** : PX.1, PX.2, PX.3

**Description** :
Créer `src/lib/validation/__tests__/image-decode.test.ts` couvrant au minimum les 8 cas listés en ADR-047 §D5 (PNG mono-IDAT, PNG multi-IDAT valide, PNG IDAT corrompu, PNG sans IDAT, JPEG valide, JPEG invalide, webp/gif/svg rejetés, data URL malformée). Ajouter un test qui appelle le **vrai** `renderBonLivraisonPDF` (sans mocker `@react-pdf/renderer`) avec un PNG RGBA corrompu (fixture reprenant le repro de la pré-analyse) — vérifie résolution bornée dans le temps, absence d'exception échappée, et présence du placeholder « Signature illisible ». Ajouter un test équivalent au niveau route (`route.test.ts`) sans mocker `renderBonLivraisonPDF`. Conserver les tests existants mockés pour les cas nominaux (rapides).

**Fichiers concernés** :
- `src/lib/validation/__tests__/image-decode.test.ts` (nouveau)
- `src/__tests__/export/pdf-bon-livraison.test.ts`
- `src/app/api/export/bon-livraison/__tests__/route.test.ts`

**Critères d'acceptation** :
- [ ] Les 8 cas de `image-decode.test.ts` passent, y compris le cas multi-IDAT (garde contre la réintroduction du faux positif)
- [ ] Le test non mocké de `pdf-bon-livraison.test.ts` avec PNG RGBA corrompu se résout en moins de `PDF_RENDER_TIMEOUT_MS`, sans exception process non gérée, et produit un PDF contenant le placeholder dégradé
- [ ] Le test non mocké au niveau route confirme une réponse HTTP (200 avec PDF dégradé, jamais un hang ni un crash de process de test)
- [ ] Les tests mockés existants (cas nominaux) restent verts
- [ ] `npx vitest run` — suite complète 100% verte
- [ ] `npm run build` — OK

**Statut : FAIT**

---

### PX.5 — Audit read-only des signatures/cachets en base

**Type** : SCHEMA/QUERIES (lecture seule)
**Agent** : @db-specialist
**Dépendances** : aucune (parallélisable avec PX.1)

**Description** :
Écrire un script Node (pas de SQL pur — la décodabilité nécessite `zlib.inflateSync`) `scripts/data-fixes/px-audit-signatures-corrompues.*` qui se connecte via `DATABASE_URL`, sélectionne les 4 colonnes (`BonLivraison.signatureClient`, `signatureLivreur`, `Site.signaturePromoteur`, `cachet`) non nulles, applique `isDecodableImage()` (réutilisé de PX.1, jamais dupliqué) à chacune, et imprime un rapport (`numero/id | champ | décodable OUI/NON | taille`). Strictement read-only : aucune mutation, aucun `UPDATE`.

**Fichiers concernés** :
- `scripts/data-fixes/px-audit-signatures-corrompues.*` (nouveau)

**Critères d'acceptation** :
- [x] Le script ne réalise aucune écriture en base (vérifié par lecture du code : aucun `UPDATE`/`INSERT`/`DELETE`)
- [x] Le script produit un rapport listant chaque ligne concernée avec son statut décodable OUI/NON et sa taille
- [x] Le script réutilise `isDecodableImage()` de PX.1 (import direct, pas de réimplémentation)
- [x] Rapport exécuté sur l'environnement de dev et archivé dans `docs/bugs/` ou `docs/analysis/`
- [x] Si des lignes corrompues sont détectées, elles sont listées mais aucune action corrective automatique n'est prise (remédiation = story séparée, décision manuelle)

**Statut : FAIT**

---

### PX.6 — Review sprint (obligatoire, sévérité Critique)

**Type** : REVIEW
**Agent** : @code-reviewer
**Dépendances** : PX.1, PX.2, PX.3, PX.4, PX.5

**Description** :
Review complète selon la checklist R1-R9, avec attention particulière à : aucun `console.log` de debug résiduel (cf. ERR-082), aucune nouvelle dépendance non justifiée dans `package.json`, le mode dégradé ne casse pas le rendu nominal (cas 4 images valides), le wrapper `renderPdfSafely` ne masque pas d'autres erreurs légitimes (un DTO invalide doit toujours remonter en 400/500 normal, pas en `PdfRenderError`), les 5 routes d'export utilisent bien le wrapper de façon homogène, et le listener `uncaughtException` est bien scopé (retiré en `finally`, jamais laissé attaché).

**Fichiers concernés** :
- Tous les fichiers listés en PX.1-PX.5
- `docs/reviews/review-sprint-PX.md` (livrable)

**Critères d'acceptation** :
- [ ] Checklist R1-R9 validée
- [ ] Aucun `console.log` de debug non conditionné
- [ ] `package.json` inchangé (zéro nouvelle dépendance)
- [ ] `npx vitest run` + `npm run build` exécutés et verts avant validation (R9)
- [ ] `docs/reviews/review-sprint-PX.md` produit avec verdict APPROVED ou liste de correctifs

**Statut : FAIT**

---

### PX.7 — Capitalisation ERR-XXX

**Type** : Capitalisation
**Agent** : @knowledge-keeper
**Dépendances** : PX.6 (review approuvée)

**Description** :
Ajouter une entrée `ERR-XXX` dans `docs/knowledge/ERRORS-AND-FIXES.md` : un callback Node asynchrone qui `throw` au lieu de rejeter une promesse (`zlib.inflate(buf, (err, data) => { if (err) throw err; ... })`) provoque à la fois une promesse jamais réglée ET une uncaught exception process-level. Toute librairie tierce embarquant ce pattern sur des entrées utilisateur (images, fichiers, tout binaire externe) doit être pré-validée en amont — jamais utilisée elle-même comme validateur de confiance.

**Fichiers concernés** :
- `docs/knowledge/ERRORS-AND-FIXES.md`

**Critères d'acceptation** :
- [ ] Entrée `ERR-XXX` créée, suivant le gabarit existant (Symptôme / Cause racine / Fix / Leçon-Règle)
- [ ] Référence croisée vers ADR-047 et `docs/bugs/` si un fichier bug dédié existe
- [ ] Le sprint PX est marqué clôturé dans `docs/TASKS.md` par @project-manager après cette étape

**Statut : FAIT**

## Ordre d'exécution recommandé

PX.1 et PX.5 sont parallélisables (aucune dépendance mutuelle). PX.2 dépend de PX.1. PX.3 est indépendant, parallélisable avec PX.2. PX.4 dépend de PX.1+PX.2+PX.3. PX.6 après tout le reste. PX.7 en dernier, après review approuvée.

## Livrables et clôture

| Livrable | Référence |
|----------|-----------|
| Review | [`docs/reviews/review-sprint-PX.md`](../reviews/review-sprint-PX.md) — verdict **VALIDÉ** (+ section delta-review) |
| Rapport de test | [`docs/tests/rapport-sprint-PX.md`](../tests/rapport-sprint-PX.md) |
| ADR | [`docs/decisions/ADR-047-robustesse-rendu-pdf.md`](../decisions/ADR-047-robustesse-rendu-pdf.md) — §D3 révisée en PX.3-bis : fail-open → fail-safe |
| Capitalisation | **ERR-103** dans [`docs/knowledge/ERRORS-AND-FIXES.md`](../knowledge/ERRORS-AND-FIXES.md) |
| Audit données dev | 6 images inspectées, **0 corrompue** |

**Vérification finale** : `npx vitest run` → 211 fichiers, 5554 tests passés, 26 todo, 0 échec ; `npm run build` → OK.

## Reliquats / suites

- **Audit PROD à exécuter par l'utilisateur** (non exécuté dans ce sprint) :
  `DATABASE_URL="<url-prod>" npx tsx scripts/data-fixes/px-audit-signatures-corrompues.ts`
