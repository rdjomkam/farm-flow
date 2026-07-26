# ADR-047 — Robustesse du rendu PDF face aux images corrompues (bon de livraison)

**Statut :** ACCEPTÉ
**Date :** 2026-07-26
**Auteur :** @architect
**Sprint :** PX (Robustesse PDF)
**Dépend de :** aucune migration Prisma — durcissement pur couche validation + rendu
**Réserve levée depuis :** `docs/analysis/pre-analysis-sprint-PX.md`

---

## Contexte

`GET /api/export/bon-livraison/[id]` ne répond jamais quand une des 4 images base64 embarquées dans le document (`BonLivraison.signatureClient`, `signatureLivreur`, `Site.signaturePromoteur`, `Site.cachet`) est un PNG RGBA dont l'IDAT (flux compressé zlib) est corrompu.

Root cause confirmée par la pré-analyse : `node_modules/@react-pdf/png-js/lib/png-js.js` ligne 145 :

```js
zlib.inflate(this.imgData, (err, data) => {
  if (err) throw err; // throw dans un callback async Node
  ...
});
```

Un `throw` dans un callback asynchrone Node n'a **aucune chaîne de promesse à rejeter** : la promesse de `renderToBuffer()` ne se règle jamais, ET l'exception s'échappe au niveau `process`, hors de portée de tout `try/catch` applicatif — comportement par défaut de Node : log + `process.exit(1)`. Un worker Node de production peut donc être tué par une simple image malformée soumise par un utilisateur authentifié via les 2 routes d'écriture (`PUT /api/sites/[id]`, `POST /api/bons-livraison/[id]/signer`), dont la validation Zod actuelle (`base64ImageSchema`) ne vérifie que le préfixe `data:image/` et la taille — jamais le contenu réel des octets.

Ce chemin bugué de `@react-pdf/png-js` n'est emprunté que pour les PNG avec canal alpha, palette indexée avec transparence, ou entrelacés — exactement le format produit par un pad de signature tactile (canvas HTML à fond transparent). Un PNG RGB opaque corrompu de la même façon ne déclenche pas le bug (le flux brut est ré-embarqué sans jamais appeler `decodePixels()`).

---

## Décisions

### D1 — Décodeur de validation : zlib natif Node (pas de nouvelle dépendance)

**Décision :** utiliser exclusivement le module `zlib` natif de Node (`zlib.inflateSync`), sans ajouter `pngjs`, `sharp`, ni aucune autre dépendance.

**Justification :**
- Le besoin est de détecter la **décodabilité effective de l'IDAT**, pas d'extraire des pixels, ni de lire des métadonnées avancées (ICC profile, gAMA, etc.). `zlib.inflateSync` couvre exactement ce besoin : si l'inflate échoue, le PNG est structurellement le même objet corrompu que celui qui ferait planter `@react-pdf/png-js` au rendu.
- `sharp` est un binding natif (libvips) compilé par plateforme. L'app est déployée sur Vercel (Next.js serverless) : ajouter `sharp` implique gérer des binaires spécifiques à l'environnement d'exécution (cold start plus lourd, risque de mismatch de plateforme entre build et runtime, taille de bundle). Disproportionné pour un simple contrôle booléen de décodabilité.
- `pngjs` est une dépendance pure-JS plus légère que `sharp`, mais reste une dépendance supplémentaire pour un besoin qu'un module natif Node couvre déjà entièrement. Introduire une dépendance uniquement pour reproduire ce que `zlib.inflateSync` fait nativement n'est pas justifié (principe de moindre dépendance).
- Ne **jamais** réutiliser `@react-pdf/png-js` comme validateur de confiance : c'est la librairie bugguée elle-même.

**Périmètre exact de la validation PNG :**
1. Vérifier la signature magique PNG (8 octets : `89 50 4E 47 0D 0A 1A 0A`). Si absente → rejet immédiat, format non PNG.
2. Parser les chunks séquentiellement (`length: u32 BE` + `type: 4 ASCII` + `data: length octets` + `crc: u32 BE`), en avançant chunk par chunk jusqu'à `IEND` ou fin de buffer.
3. Localiser le chunk `IHDR` (doit être le premier après la signature). Extraire `width`, `height`, `colorType` — utile pour une éventuelle validation future, mais **non bloquant** dans le périmètre de cette ADR (une image 1×1 est un PNG valide).
4. **Concaténer TOUS les chunks `IDAT`** rencontrés, dans l'ordre d'apparition, **avant** d'appeler `zlib.inflateSync`. C'est un piège documenté explicitement : **un PNG réel a très souvent plusieurs chunks IDAT** (le format PNG découpe volontairement les gros flux compressés en plusieurs chunks de taille bornée). Faire l'inflate sur le premier chunk IDAT seul produirait un **faux positif de rejet** — l'inflate échouerait sur un flux zlib tronqué qui n'est en réalité pas corrompu, juste incomplet parce qu'on ignore les IDAT suivants. Ce point doit être testé explicitement (cf. R3 étendu ci-dessous, cas de test "PNG valide multi-IDAT accepté").
5. Appeler `zlib.inflateSync(concatenatedIdat)` dans un bloc `try/catch`. Si ça throw → image jugée non décodable, `reason` renseignée avec le message d'erreur zlib (ex. `Z_DATA_ERROR`).
6. **CRC des chunks : volontairement NON vérifié.** Le CRC détecte la corruption de la trame binaire du chunk (bit-flip accidentel en transit) ; le bug de production est une corruption du contenu de l'IDAT — c'est justement ce que `zlib.inflateSync` détecte déjà, de façon plus fiable et sans coût de complexité additionnel. Vérifier le CRC en plus n'apporterait rien pour ce cas et ajouterait une deuxième source de rejet à maintenir. Documenté explicitement pour qu'un futur agent ne l'ajoute pas par réflexe de "complétude".

**Traitement JPEG :** validation structurelle uniquement — vérifier le marqueur SOI (`FF D8`) en tête et le marqueur EOI (`FF D9`) en queue du buffer binaire décodé. **Pas de décodage entropique (Huffman/DCT)** : le format JPEG n'utilise pas zlib, et surtout — confirmé par la pré-analyse — le chemin de rendu de `@react-pdf/pdfkit` pour JPEG n'appelle jamais `zlib.inflate`/`png-js`. Le contrôle JPEG est donc une mesure de cohérence/symétrie du schéma (défense en profondeur), pas un correctif du bug ciblé. Limite assumée et documentée dans le code : un JPEG tronqué au milieu du flux DCT (SOI et EOI présents mais payload corrompu) ne sera pas détecté par ce contrôle — hors périmètre, car ce n'est pas le vecteur du bug actuel.

**Formats non-PNG/non-JPEG (WEBP, GIF, SVG, autres) : REJETÉS explicitement, allowlist stricte.**
Le schéma Zod actuel accepte tout préfixe `data:image/*`. Décision : restreindre l'allowlist du schéma aux deux seuls MIME `image/png` et `image/jpeg` (+ `image/jpg` en alias toléré). Tout autre type MIME est rejeté au niveau Zod avec le message `"Format d'image non supporté (PNG ou JPEG uniquement)."`
- **Cas SVG tranché explicitement :** rejet total, y compris si un futur usage voulait l'accepter. Un SVG est un document XML pouvant embarquer du script (`<script>`), des références externes (XXE via `<!ENTITY>` ou `xlink:href` vers une ressource distante), ou des `foreignObject`. Bien que `@react-pdf/renderer` ne l'exécute pas aujourd'hui, un payload SVG stocké en base est un risque latent dès qu'un futur consommateur (aperçu HTML, export web, `<img src>` direct) le rendrait différemment. Pas de valeur métier identifiée (aucune signature de pad ni cachet scanné n'est un SVG) → rejet, pas de décodeur à écrire.
- WEBP/GIF : aucun cas d'usage métier identifié aujourd'hui (signatures et cachets sont des PNG/JPEG). Rejet pour garder le périmètre de validation fermé et auditable. À rouvrir via une ADR dédiée si un besoin réel apparaît (ex. upload de logo au format WEBP), avec son propre décodeur validé.

---

### D2 — Mode dégradé à la lecture (confirmé, avec amendements sur la clarté du message)

**Décision confirmée :** en cas d'image non décodable détectée au moment du rendu (données legacy antérieures au durcissement à l'écriture, ou tout autre cas résiduel), **ne pas faire échouer tout le document**. Remplacer l'image concernée par un placeholder, **sans bloquer la génération du reste du bon de livraison**.

**Argument pesé et tranché malgré la réserve juridique soulevée :**
- L'argument contre (produire un document contractuel sans la signature qu'il est censé porter peut être trompeur) est réel, mais il présuppose que le mode dégradé serait un état **permanent et silencieux**. Ce n'est pas la décision retenue ici :
  1. **D1 (validation à l'écriture) ferme la porte en amont** : après cette ADR, aucune nouvelle image corrompue ne peut plus être enregistrée en base — le mode dégradé au rendu ne couvre donc que les données legacy et les cas résiduels non prévus, pas un flux normal.
  2. **Le mode dégradé doit être explicite et non ambigu** : il ne doit jamais se confondre visuellement ou textuellement avec le placeholder « signature absente » existant.
  3. **L'événement doit être journalisé**, pas seulement affiché — pour qu'un administrateur puisse être alerté et agir (re-signature, contact client) plutôt que découvrir le problème seulement en ouvrant le PDF.
- Un échec franc (refuser tout le document) transformerait un incident de qualité de donnée en interruption de service : le bon de livraison, document déjà signé et juridiquement existant, deviendrait totalement inaccessible tant que personne n'a corrigé la donnée en base — pire du point de vue métier qu'un document affichant une mention explicite de corruption.

**Texte exact affiché (distinct du placeholder « signature absente ») :**
- Cas signature absente (déjà existant, inchangé) : texte neutre indiquant l'absence (ex. « Non renseignée »), style neutre/gris.
- **Nouveau cas — image présente mais non décodable :**
  `"Signature illisible (fichier image corrompu) — à régénérer auprès de l'administrateur du site"`
  Style visuellement distinct du placeholder « absente » (ex. fond ambre/orange dans le PDF, pas gris neutre), pour qu'un lecteur du document comprenne sans ambiguïté qu'une signature existait mais n'a pas pu être restituée — différent d'une signature jamais recueillie.
- Le champ concerné (`signatureClient`, `signatureLivreur`, `signaturePromoteur`, `cachet`) et l'identifiant du document sont **journalisés côté serveur** (log niveau `warn`) à chaque détection, avec le numéro du bon de livraison / l'id du site — pour permettre un audit et un contact proactif, pas seulement une découverte passive par l'utilisateur qui ouvre le PDF.

---

### D3 — Stratégie anti-uncaught-exception : ordre de priorité et garde-fous du filet de sécurité

**Décision : les deux niveaux de protection de la pré-analyse sont retenus, dans cet ordre strict de priorité.**

**(a) Protection primaire — pré-validation systématique, obligatoire, avant tout `renderToBuffer` :**
Chacune des 4 images est passée à `decodeImageDataUrl()` (D1) **avant** d'être injectée dans le composant `<Image>` de `BonLivraisonPDF`. Toute image non décodable est remplacée par le placeholder (D2) **avant** l'appel à `renderToBuffer`. Cette protection rend le scénario de blocage **structurellement impossible** pour le cas connu : à aucun moment `@react-pdf/png-js` ne reçoit une image dont l'IDAT est invalide, puisqu'elle a déjà été écartée en amont, dans notre propre code synchrone.

**(b) Défense en profondeur — wrapper partagé `renderPdfSafely()` :**
La pré-analyse recommande ce filet pour couvrir un futur bug similaire dans `@react-pdf/renderer` (pas seulement celui-ci). Retenu, avec les garde-fous ci-dessous.

> **RÉVISION PX.3-bis (2026-07-26) — passage FAIL-OPEN → FAIL-SAFE.**
> La version initiale de cette section (Sprint PX, stories PX.3/PX.4, ci-dessous conservée en note historique) retenait un point 3 **fail-open** : une exception dont le message/stack ne portait aucun des 4 marqueurs connus (`png-js`, `pdfkit`, `@react-pdf`, `zlib`) était jugée "non attribuable" et **ré-émise** (`process.emit`), laissant le comportement fatal par défaut de Node s'appliquer — c'est-à-dire tuer le worker. Le PM a identifié ce comportement comme un **défaut de conception**, documenté et même entériné par un test qui assertait explicitement l'échappement de l'exception (`src/__tests__/export/pdf-render-guard-unconditional.test.ts`) : une liste de marqueurs de stack est par construction incomplète (futures versions de la lib, `throw` sans stack utile depuis un worker/stream, stack tronquée) — et puisque D1 (validateur amont) et le décodeur réel de `@react-pdf/png-js` ne sont PAS le même code, la pré-validation ne peut jamais servir de garantie que ce filet aval ne sera jamais sollicité par une forme d'exception imprévue.
>
> **Nouvelle décision (remplace le point 3 ci-dessous) : la capture est désormais INCONDITIONNELLE (fail-safe) tant qu'au moins un rendu PDF est en vol.** Les marqueurs de stack ne sont plus une condition de capture — ils ne servent plus qu'à qualifier, dans le log diagnostique, le niveau de confiance de l'attribution (« certaine » si un marqueur connu est présent, « par défaut » sinon). Voir le mécanisme détaillé ci-dessous (points 1-5 révisés) et le commentaire d'en-tête de `src/lib/export/render-pdf-safely.ts` pour l'implémentation complète.

1. **Portée temporelle minimale, via un refcount partagé.** Un seul listener `process.on('uncaughtException', handler)` est partagé par TOUS les rendus PDF en vol sur le worker (jamais un listener par rendu — Next.js sert des requêtes concurrentes par worker, et empiler des listeners déclencherait le `MaxListenersExceededWarning` de Node au-delà de 10). Un registre des rendus en vol (`inFlightRenders`) fait office de refcount : le listener partagé est installé quand ce compteur passe de 0 à 1, et retiré (`process.removeListener`) uniquement quand il retombe à 0 — jamais par un rendu individuel qui se termine tant que d'autres rendus restent en vol. Fenêtre d'exposition globale = union des fenêtres de tous les rendus en vol, jamais la durée de vie de la requête HTTP entière ni du process.
2. **Ne jamais avaler silencieusement.** Si le listener partagé se déclenche, l'exception est journalisée systématiquement (niveau `error`, avec le contexte complet : route, type de document, id, message, stack, ET la liste de tous les rendus en vol affectés) puis chaque rendu en vol concerné est transformé en rejet contrôlé d'un type dédié `PdfRenderError` (code `"UNCAUGHT_EXCEPTION"`). Le caller (route API) transforme ce rejet en réponse 500 avec message générique — **jamais** en un PDF dégradé silencieux à cet endroit (la dégradation "image illisible" appartient exclusivement à (a)/D2 ; (b) ne doit produire aucun document dans ce cas, seulement une erreur explicite).
3. **Attribution par défaut (fail-safe), politique explicite pour les rendus concurrents.** La librairie ne permet pas d'attribuer une exception uncaught à un rendu précis parmi N rendus concurrents en vol au même instant. Décision explicite : une exception non attribuable individuellement **fait échouer TOUS les rendus actuellement en vol** — mieux vaut N réponses HTTP 500 explicites et journalisées qu'un worker mort qui interromprait indistinctement toutes les requêtes du worker (y compris celles sans rapport avec le rendu PDF). Ce choix est signalé explicitement dans le log (nombre de rendus affectés, contexte de chacun) et dans le message d'erreur retourné à l'appelant. *(Ce point remplace l'ancien comportement de ré-émission fail-open décrit dans la note historique ci-dessus.)*
4. **Timeout dur : 15 secondes**, valeur reprise du test de reproduction de la pré-analyse (le blocage observé est indéfini — 15s est largement supérieur au temps de rendu nominal d'un bon de livraison, y compris avec 4 images). Constante nommée unique, définie une seule fois dans le module wrapper, référencée par les tests (pas de valeur dupliquée en dur ailleurs).
5. Le timeout **ne remplace jamais** (a) : le commentaire du wrapper documente explicitement que le timeout seul ne libère pas le callback `zlib.inflate` orphelin (qui reste en mémoire jusqu'au GC) et que la capture fail-safe reste nécessaire tant qu'au moins un rendu est en vol (refcount > 0). Frontière assumée : une exception survenant APRÈS que le DERNIER rendu en vol se soit réglé (refcount à 0, listener déjà retiré) n'est plus couverte — le comportement Node par défaut s'applique alors, ce qui est voulu : ce module ne doit jamais devenir un handler `uncaughtException` global et permanent pour toute l'application.

**Où vit le timeout :** constante exportée dans `src/lib/export/render-pdf-safely.ts` (pas de duplication de la valeur numérique dans les 5 routes consommatrices).

**Garanties reformulées (PX.3-bis) :**
- **G1 — la requête HTTP répond toujours** : garanti inconditionnellement par le timeout dur, indépendamment de tout le reste.
- **G2 — un rendu PDF ne tue jamais le worker** : garanti par la capture fail-safe pendant la fenêtre où au moins un rendu est en vol.
- Limites honnêtes qui subsistent : le timeout ne libère pas le rendu bloqué (fuite mémoire jusqu'au GC) ; une exception arrivant après le retour du dernier rendu en vol n'est plus couverte ; la pré-validation amont (a)/D1 ne doit jamais être supprimée sous prétexte que ce filet aval existe.

---

### D4 — Portée du durcissement : deux modules partagés, signatures exactes

Un seul point de vérité pour chaque responsabilité, réutilisé partout (jamais dupliqué route par route — cf. ERR-088/ERR-084 sur le grep exhaustif et la centralisation).

#### `src/lib/validation/image-decode.ts`

```typescript
export type ImageDecodeFormat = "png" | "jpeg";

export interface ImageDecodeResult {
  /** true si l'image est structurellement valide et décodable */
  ok: boolean;
  /** format détecté, null si la signature/l'en-tête ne correspond à rien de reconnu */
  format: ImageDecodeFormat | null;
  /** raison lisible (FR) du rejet, présente uniquement si ok === false */
  reason?: string;
}

/**
 * Décode défensivement une image en data URL (data:image/png;base64,... ou
 * data:image/jpeg;base64,...). PNG : concatène tous les chunks IDAT puis
 * zlib.inflateSync. JPEG : vérifie SOI/EOI uniquement (pas de décodage entropique).
 * Tout autre MIME (webp, gif, svg, ...) => ok: false, format: null.
 */
export function decodeImageDataUrl(dataUrl: string): ImageDecodeResult;

/**
 * Wrapper booléen pour usage dans un .refine() Zod.
 */
export function isDecodableImage(dataUrl: string): boolean;
```

Consommateurs imposés :
- `src/lib/validation/common.schema.ts` (`base64ImageSchema`, `base64ImageOptionalSchema`) via `.refine(isDecodableImage, "Image illisible ou corrompue.")`, en plus de la restriction d'allowlist MIME (`data:image/png` / `data:image/jpeg` / `data:image/jpg` uniquement — cf. D1).
- `src/lib/export/pdf-bon-livraison.tsx` (`BonLivraisonPDF` / `renderBonLivraisonPDF`) via `decodeImageDataUrl()` pour obtenir `reason` (utilisée dans le log serveur, cf. D2) avant tout rendu `<Image>`.
- `scripts/data-fixes/px-audit-signatures-corrompues.*` (PX.5, lecture seule) — même fonction, aucune duplication de logique de décodage.

#### `src/lib/export/render-pdf-safely.ts`

```typescript
export const PDF_RENDER_TIMEOUT_MS = 15_000;

export type PdfRenderErrorCode = "TIMEOUT" | "UNCAUGHT_EXCEPTION";

export class PdfRenderError extends Error {
  readonly code: PdfRenderErrorCode;
  constructor(message: string, code: PdfRenderErrorCode, options?: { cause?: unknown });
}

export interface RenderPdfSafelyContext {
  route: string;
  documentType: string;
  documentId?: string;
}

export interface RenderPdfSafelyOptions {
  timeoutMs?: number; // défaut : PDF_RENDER_TIMEOUT_MS
  context: RenderPdfSafelyContext;
}

/**
 * Enveloppe un appel renderToBuffer (ou équivalent) avec :
 * (1) un timeout dur (PDF_RENDER_TIMEOUT_MS par défaut),
 * (2) un listener process.on('uncaughtException') scopé à la durée de l'appel,
 *     retiré dans un finally, qui transforme toute exception échappée
 *     attribuable au rendu en cours en PdfRenderError({code: "UNCAUGHT_EXCEPTION"}),
 *     et ré-émet (process.emit) toute exception non attribuable.
 * Rejette avec PdfRenderError({code: "TIMEOUT"}) si le délai est dépassé.
 */
export function renderPdfSafely(
  renderFn: () => Promise<Buffer>,
  options: RenderPdfSafelyOptions
): Promise<Buffer>;
```

Consommateurs imposés : les 5 routes d'export PDF (`bon-livraison`, `facture`, `vague`, `vague/[id]/cout-production`, `finances`) — protection homogène, même si seule `bon-livraison` manipule des images aujourd'hui (cohérence de posture contre tout futur bug équivalent dans `@react-pdf/renderer`).

---

### D5 — R3 étendu : Prisma = TypeScript = Zod, tests de parse exigés

R3 (« Prisma = TypeScript identiques ») est étendu à la couche Zod : tout schéma de validation qui encode une règle métier non triviale (ici : décodabilité d'image) doit être accompagné d'un fichier de test dédié qui exerce les deux branches (acceptation ET rejet), pas seulement vérifié manuellement.

**Fichier de test exigé :** `src/lib/validation/__tests__/image-decode.test.ts`, avec au minimum :
- PNG valide **mono-IDAT** → accepté.
- PNG valide **multi-IDAT** (plusieurs chunks `IDAT` consécutifs formant un flux zlib valide une fois concaténés) → accepté. **Ce cas est le test qui garantit qu'on n'a pas réintroduit le piège du faux positif** décrit en D1 (inflate sur le premier chunk seul rejetterait à tort ce cas).
- PNG avec IDAT corrompu (reprendre le fixture de repro de la pré-analyse, PNG RGBA ~118 caractères en data URL) → rejeté, `reason` renseignée.
- PNG sans chunk `IDAT` du tout → rejeté.
- JPEG valide (SOI+EOI présents) → accepté.
- JPEG sans marqueur SOI ou EOI → rejeté.
- `data:image/webp;...`, `data:image/gif;...`, `data:image/svg+xml;...` → rejetés (`format: null`).
- Data URL malformée (pas de préfixe `data:image/`, base64 invalide) → rejetée sans exception non gérée (le décodeur lui-même ne doit jamais throw hors try/catch interne).

---

## Conséquences

- Zéro nouvelle dépendance ajoutée à `package.json`.
- Toute image déjà en base (avant ce durcissement) reste lisible : le mode dégradé ne casse aucun document existant, il les rend seulement honnêtes sur les cas déjà corrompus.
- Le vecteur DoS actuel (POST d'un PNG RGBA à IDAT corrompu) est fermé à l'écriture (D1) ; le rendu reste protégé même pour les données historiques (D2 + D3-a) ; un filet de sécurité générique protège contre un futur bug équivalent (D3-b), avec un risque de sur-capture explicitement mitigé.
- Aucune migration Prisma requise.

## Références
- `docs/analysis/pre-analysis-sprint-PX.md`
- `docs/sprints/SPRINT-PX-ROBUSTESSE-PDF.md`
- ERR-088, ERR-084 (`docs/knowledge/ERRORS-AND-FIXES.md`) — centralisation obligatoire, grep exhaustif avant scope
