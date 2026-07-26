# Rapport de tests — Sprint PX (Robustesse du rendu PDF)

**Auteur :** @developer (corrections non bloquantes post-review) — complète un rapport partiel déjà déposé par @tester (préservé en Annexe A)
**Date :** 2026-07-26
**Sprint :** PX — Robustesse rendu PDF face aux images corrompues
**Référence :** ADR-047 (`docs/decisions/ADR-047-robustesse-rendu-pdf.md`), review Sprint PX

> **Note de fusion :** un rapport `docs/tests/rapport-sprint-PX.md` avait déjà été déposé en parallèle par @tester, focalisé sur la story de preuve du garde-fou inconditionnel (PX.3-bis). Son contenu est intégralement préservé en **Annexe A** ci-dessous. Ce document ajoute la vue d'ensemble du sprint complet exigée comme livrable de la story PX.4 (périmètre, liste exhaustive des fichiers de test, distinction mocké/réel, dette de test historique, résultats chiffrés finaux après les corrections non bloquantes de la review).

---

## 1. Périmètre testé

Le Sprint PX corrige un bug **critique de disponibilité** : `GET /api/export/bon-livraison/[id]` ne répondait jamais (promesse jamais réglée + `uncaughtException` pouvant tuer le worker Node) quand une des 4 images base64 embarquées dans le document (`signatureClient`, `signatureLivreur`, `signaturePromoteur`, `cachet`) est un PNG RGBA dont le flux IDAT (zlib) est corrompu.

Le fix repose sur deux modules partagés :
- `src/lib/validation/image-decode.ts` — décodeur défensif (pré-validation à l'écriture ET à la lecture), zéro nouvelle dépendance (zlib natif Node).
- `src/lib/export/render-pdf-safely.ts` — wrapper de rendu avec timeout dur (15 s) + capture fail-safe inconditionnelle des exceptions non gérées pendant la fenêtre de rendu en vol (révision PX.3-bis, voir Annexe A).

Le périmètre testé couvre :
1. Le décodeur de validation seul (unitaire, données synthétiques).
2. Le branchement Zod du décodeur dans les schémas de validation d'entrée.
3. Le wrapper de rendu sécurisé seul (unitaire, exceptions simulées).
4. Le rendu PDF réel de bout en bout (`@react-pdf/renderer` NON mocké) pour les 5 templates du projet, avec injection d'images corrompues réelles.
5. La route API complète (`GET /api/export/bon-livraison/[id]`) en pipeline réel non mocké, cas nominal et cas de défaillance.
6. La preuve que le garde-fou aval est **inconditionnel** (pas seulement conditionné à des marqueurs de stack connus) — story dédiée @tester, détail en Annexe A.
7. Un garde-fou structurel empêchant la régression du pattern de pré-validation dans un futur template PDF (correction non bloquante n°2, review Sprint PX).
8. Un durcissement complémentaire de la décompression zlib — borne explicite `maxOutputLength` anti-bombe zlib (correction non bloquante n°1, review Sprint PX).

---

## 2. Fichiers de test du sprint

| Fichier | Ce qu'il couvre |
|---|---|
| `src/lib/validation/__tests__/image-decode.test.ts` | Décodeur `decodeImageDataUrl()` / `isDecodableImage()` en isolation : PNG mono-IDAT et multi-IDAT valides (garde anti-faux-positif ADR-047 D1), PNG à IDAT corrompu, PNG sans chunk IDAT, JPEG valide/invalide (SOI/EOI), formats hors allowlist (webp/gif/svg+xml) rejetés avec `format: null`, data URL malformée / base64 invalide / entrée vide ou non-string ne provoquant jamais de throw. **Complété par la correction non bloquante n°1** : image PNG légitime volumineuse (~300×300 pixels, base64 proche de la limite Zod de 500 000 caractères) acceptée sans faux positif, et bombe zlib (`zlib.deflateSync(Buffer.alloc(50_000_000))`) rejetée proprement grâce à `maxOutputLength`, sans exception non gérée. |
| `src/lib/validation/__tests__/base64-image-schema.test.ts` | Branchement du décodeur dans `base64ImageSchema` / `base64ImageOptionalSchema` (Zod) : allowlist MIME stricte (PNG/JPEG uniquement), rejet via `.refine(isDecodableImage, ...)` d'une image structurellement invalide, acceptation d'une image valide, comportement de la variante optionnelle sur `null`/`undefined`. |
| `src/lib/export/__tests__/render-pdf-safely.test.ts` | Wrapper `renderPdfSafely()` en isolation, avec des fonctions de rendu simulées (pas de vrai `@react-pdf/renderer`) : résolution normale, rejet `TIMEOUT` au-delà de `PDF_RENDER_TIMEOUT_MS`, capture fail-safe d'une `uncaughtException` émise pendant un rendu en vol, refcount partagé entre plusieurs rendus concurrents (listener installé une seule fois, retiré seulement au retour à 0), non-couverture volontaire d'une exception survenant après le dernier rendu réglé. |
| `src/__tests__/export/pdf-render-real.test.ts` | Rendu **réel** (`@react-pdf/renderer` non mocké) des 5 templates PDF du projet (bon de livraison, facture, rapport vague, coût de production, rapport financier) produisant chacun un buffer PDF non vide et valide. Pour le bon de livraison spécifiquement : image RGBA valide → rendu OK avec signature embarquée ; image RGBA à IDAT corrompu (repro exacte du bug de production) → résolution bornée, aucune exception process non gérée, mode dégradé produit ; les 4 images corrompues simultanément → rendu toujours complet et borné. |
| `src/__tests__/export/pdf-render-guard-unconditional.test.ts` | **Story dédiée @tester** — forge une image qui passe la pré-validation amont mais casse `@react-pdf/png-js` (octet de filtre PNG invalide, flux IDAT zlib par ailleurs valide) : preuve que le garde-fou aval `renderPdfSafely()` protège malgré tout, avec le vrai moteur de rendu. A mis en évidence puis validé la correction du défaut fail-open → fail-safe (PX.3-bis). Détail complet en Annexe A. |
| `src/app/api/export/bon-livraison/__tests__/route-real-render.test.ts` | Route `GET /api/export/bon-livraison/[id]` en pipeline **réel** non mocké : signature valide → 200 avec PDF valide (`Content-Type: application/pdf`) ; signature client RGBA à IDAT corrompu (repro exacte du bug de production) → réponse HTTP 200 avec PDF en mode dégradé, jamais de requête suspendue. |
| `src/app/api/export/bon-livraison/__tests__/route-render-guard.test.ts` | Même route, focalisée sur le garde-fou `renderPdfSafely()` en pipeline réel avec la fixture "bypass amont" de la story dédiée : cas nominal (200, buffer PDF réel) et cas de défaillance dans `@react-pdf/png-js` lui-même (`Invalid filter algorithm`) → la route répond en 500 explicite, jamais de requête qui reste en vol indéfiniment. |
| `src/__tests__/export/pdf-image-predecode-guard.test.ts` **(nouveau, correction non bloquante n°2)** | Garde-fou structurel : tout fichier `src/lib/export/*.tsx` qui importe `Image` depuis `@react-pdf/renderer` DOIT aussi importer `decodeImageDataUrl` depuis `@/lib/validation/image-decode` — détection par présence d'imports nommés au niveau module (robuste au reformatage, aux sauts de ligne dans le JSX, aux attributs multi-lignes ; ne dépend jamais de la syntaxe exacte de la balise `<Image>`). Échec avec message pédagogique référençant ADR-047 et le bug d'origine si la convention est violée. Vérifié manuellement en cours de développement : le test échoue correctement (message explicite) quand `Image` est ajouté aux imports d'un template qui n'importe pas le décodeur — modification annulée avant commit final, aucune trace dans le diff livré. |
| `src/__tests__/export/pdf-bon-livraison.test.ts` **(existant, dette historique — voir §4)** | Tests de structure du template (styles, présence de sections, filigrane annulation, etc.) — **entièrement mocké**, ne rend aucun PDF réel. Conservé tel quel : ces tests restent utiles pour la structure statique, mais ne remplacent en rien les tests de rendu réel ajoutés au Sprint PX. |

---

## 3. Distinction explicite : tests mockés vs tests de rendu réel

Deux familles de tests coexistent désormais dans le projet pour les templates PDF, et il est important de ne jamais les confondre :

### Tests mockés (`vi.mock("@react-pdf/renderer", ...)`)
- Vérifient la **structure logique** du composant : quelles sections apparaissent selon les données, quels styles sont appliqués, quelle logique conditionnelle (filigrane, mode dégradé texte) est déclenchée.
- **N'exécutent jamais** le vrai moteur de rendu `@react-pdf/renderer`, ni `@react-pdf/png-js`, ni `zlib.inflate`. Ils ne peuvent donc **jamais** détecter un bug de rendu réel (crash, promesse jamais réglée, image mal décodée).
- Rapides (dizaines de ms), utiles pour la couverture de structure, **insuffisants seuls** pour garantir la disponibilité de la route.

### Tests de rendu réel (`pdf-render-real.test.ts`, `pdf-render-guard-unconditional.test.ts`, `route-real-render.test.ts`, `route-render-guard.test.ts`)
- Appellent le vrai `renderToBuffer()` / la vraie route Next.js, sans mocker `@react-pdf/renderer`.
- Produisent un buffer PDF réel, vérifiable (signature `%PDF`, taille non nulle).
- **Seuls capables de reproduire et de garantir la correction du bug d'origine** : c'est en exécutant réellement `@react-pdf/png-js` sur une image RGBA à IDAT corrompu (ou, pour la story dédiée, une image qui contourne la pré-validation amont, cf. Annexe A) que le comportement de production (promesse jamais réglée / exception non gérée) est reproductible et vérifiable.
- Plus lents (1 à 8 secondes par test selon la taille du document, le nombre d'images, et les scénarios de timeout simulés) — assumé, car c'est le seul niveau de test qui a une valeur de preuve pour ce bug.

---

## 4. Dette de test historique ayant laissé passer le bug

**Fichier concerné :** `src/__tests__/export/pdf-bon-livraison.test.ts` (fichier existant, antérieur au Sprint PX).

Ce fichier mockait **intégralement** `@react-pdf/renderer`, y compris le composant `Image` lui-même :

```ts
vi.mock("@react-pdf/renderer", () => ({
  // ...
  Image: () => null,
  // ...
}));
```

Conséquence : **15 tests** de ce fichier, dont plusieurs intitulés explicitement « rend un PDF sans erreur » (ou équivalent), passaient en **86 ms** au total sans jamais rendre le moindre octet de PDF réel, et sans jamais exécuter `@react-pdf/png-js`. Un composant `Image` remplacé par `() => null` ne peut par construction jamais déclencher le bug qu'il est censé couvrir : le test donnait une fausse confiance de couverture ("un PDF avec signature est testé") alors qu'aucune image n'était réellement traitée par le moteur de rendu.

C'est précisément cette dette de test — un mock total qui masque le comportement du composant le plus à risque du template (`Image`, seul point d'entrée vers `@react-pdf/png-js`) — qui a permis au bug de production de ne jamais être détecté avant son incident réel. La leçon retenue et appliquée dans ce sprint : **tout composant qui délègue à une dépendance tierce connue pour avoir un historique de bugs sur des entrées non fiables (ici, un moteur de décodage d'image) doit être couvert par au moins un test de rendu réel, en plus des tests de structure mockés.** Le fichier `pdf-bon-livraison.test.ts` est conservé tel quel (il reste utile pour la structure statique) mais n'est plus la seule ligne de défense — les tests de rendu réel du Sprint PX (§2) comblent ce trou. Le garde-fou structurel `pdf-image-predecode-guard.test.ts` (correction non bloquante n°2) referme par ailleurs le risque qu'un futur template reproduise ce même pattern de mock total qui masquerait un composant `Image` non pré-validé.

---

## 5. Résultats chiffrés — exécution finale (corrections non bloquantes post-review)

Exécution ciblée des fichiers de test du sprint (y compris les 2 nouveaux cas ajoutés au décodeur et le nouveau test de garde structurel) :

```
source ~/.nvm/nvm.sh && nvm use 22
npx vitest run \
  src/lib/validation/__tests__/image-decode.test.ts \
  src/lib/validation/__tests__/base64-image-schema.test.ts \
  src/lib/export/__tests__/render-pdf-safely.test.ts \
  src/__tests__/export/pdf-render-real.test.ts \
  src/__tests__/export/pdf-render-guard-unconditional.test.ts \
  src/app/api/export/bon-livraison/__tests__/route-real-render.test.ts \
  src/app/api/export/bon-livraison/__tests__/route-render-guard.test.ts \
  src/__tests__/export/pdf-image-predecode-guard.test.ts \
  src/__tests__/export/pdf-bon-livraison.test.ts
```

Résultat :

```
Test Files  9 passed (9)
     Tests  76 passed (76)
  Duration  28.33s
```

Détail par fichier :
- `image-decode.test.ts` : 16 tests (14 initiaux + 2 ajoutés par la correction non bloquante n°1 : image légitime volumineuse acceptée, bombe zlib rejetée).
- `base64-image-schema.test.ts`, `render-pdf-safely.test.ts`, `pdf-render-guard-unconditional.test.ts`, `route-render-guard.test.ts`, `pdf-bon-livraison.test.ts` : inchangés par ces corrections, tous verts.
- `pdf-render-real.test.ts` : 8 tests (5 templates + 3 cas signature RGBA valide/corrompue/multi-corrompue).
- `route-real-render.test.ts` : 2 tests (nominal + corruption).
- `pdf-image-predecode-guard.test.ts` **(nouveau)** : 6 tests (1 garde anti-no-op + 5 templates `.tsx` vérifiés, dont `pdf-bon-livraison.tsx` qui doit — et importe bien — `decodeImageDataUrl`).

Suite complète et `npm run build` exécutés en complément, après application des corrections 1-3 de la delta-review (`MAX_INFLATE_OUTPUT_BYTES` 8→16 Mo, plafonnement `devicePixelRatio` dans `signature-pad.tsx`, nouvelle `reason` distincte pour `ERR_BUFFER_TOO_LARGE`, 2 tests ajoutés au décodeur, note de limite ajoutée au garde structurel) :

```
source ~/.nvm/nvm.sh && nvm use 22
npx vitest run
```

```
Test Files  211 passed (211)
     Tests  5554 passed | 26 todo (5580)
  Duration  59.30s
```

0 échec attribuable au sprint ou aux corrections de la delta-review. Flakys connus sous parallélisme (`password.test.ts`, `plan-form-dialog.test.tsx`, `plan-toggle.test.tsx`, `plans-admin-list.test.tsx`, `vagues-page.test.tsx`, `bacs-page.test.tsx`, `dialog-scroll.test.tsx`, `bon-livraison-flow.test.tsx`, `vente-detail-client`) ré-exécutés isolément avec succès — cohérent avec le résultat déjà consigné en Annexe A.

```
npm run build
```

```
✓ Compiled successfully
```

Build de production OK (Prisma generate + migrate deploy + `next build --webpack`), sans erreur ni warning bloquant.

## Statut : VÉRIFIÉ

---

## Annexe A — Rapport initial @tester : preuve du garde-fou inconditionnel (story PX.3-bis)

> Contenu préservé tel que déposé initialement par @tester, sans modification.

**Auteur :** @tester
**Date :** 2026-07-26
**Réf :** `docs/decisions/ADR-047-robustesse-rendu-pdf.md`, `docs/analysis/pre-analysis-sprint-PX.md`

### Contexte

Le bug d'origine : `GET /api/export/bon-livraison/[id]` pouvait rester suspendu
indéfiniment (et faire planter le worker Node) quand une image base64 embarquée
(signature/cachet) était un PNG RGBA avec un flux IDAT corrompu. Root cause :
`@react-pdf/png-js` fait `zlib.inflate(buf, (err) => { if (err) throw err; })`
— un `throw` dans un callback asynchrone Node, qui (1) ne règle jamais la
promesse `renderToBuffer()`, et (2) s'échappe en exception non interceptée au
niveau process.

Le fix (ADR-047) repose sur deux couches :
- **Amont (D1)** : `isDecodableImage()` / `decodeImageDataUrl()`
  (`src/lib/validation/image-decode.ts`) — décodeur maison à base de
  `zlib.inflateSync`, branché dans le schéma Zod d'écriture et dans le rendu
  (mode dégradé).
- **Aval (D3)** : `renderPdfSafely()` (`src/lib/export/render-pdf-safely.ts`)
  — timeout dur (15 s) + capture d'`uncaughtException`.

### Mission de cette story

Le PM a demandé une preuve explicite, indépendante des tests déjà écrits par
ailleurs, que **le garde-fou aval est inconditionnel** — c'est-à-dire qu'il
protège la requête HTTP **même si** une image franchit la pré-validation
amont. La thèse à vérifier : les deux décodeurs (notre validateur maison et
celui de `@react-pdf/png-js`) ne sont **pas le même code**, donc un écart
entre les deux est possible et doit être couvert par le filet aval, pas
seulement supposé.

### Fichiers de test livrés par cette story

| Fichier | Contenu |
|---|---|
| `src/__tests__/export/pdf-render-guard-unconditional.test.ts` | Forge une image qui **passe** `isDecodableImage()` mais **casse** `@react-pdf/png-js` ; preuve avec le vrai moteur `renderBonLivraisonPDF` + `renderPdfSafely()` ; tests dédiés du filet aval (attributable / non attributable / timeout pur / constante par défaut) |
| `src/app/api/export/bon-livraison/__tests__/route-render-guard.test.ts` | Même fixture, au niveau `GET /api/export/bon-livraison/[id]`, **sans mocker** `renderBonLivraisonPDF` ni `renderPdfSafely` — seuls `requirePermission` et `getBonLivraisonForPDF` sont mockés |

Ces deux fichiers sont **complémentaires**, pas redondants, avec les fichiers
suivants (produits en parallèle par l'agent qui a implémenté PX.3-bis, voir
plus bas) :
- `src/__tests__/export/pdf-render-real.test.ts` — rendu réel des 5 documents PDF, image corrompue "classique" (rejetée par la validation amont, donc jamais transmise au moteur de rendu réel).
- `src/app/api/export/bon-livraison/__tests__/route-real-render.test.ts` — équivalent route, même type d'image.
- `src/lib/export/__tests__/render-pdf-safely.test.ts` — suite unitaire dédiée du wrapper (nominal, timeout, exception attribuable/non attribuable, rendus concurrents, rejets légitimes non masqués).

La différence de fond : les fichiers `*-real.test.ts` / `*-real-render.test.ts`
utilisent une image dont l'IDAT est corrompu **avant même** `zlib.inflateSync`
(rejetée par notre validateur amont — ils exercent donc le mode dégradé D2,
protection primaire). Nos deux fichiers construisent au contraire une image
dont l'IDAT est un flux **zlib parfaitement valide** (donc **acceptée** par
notre validateur amont) mais dont le contenu décompressé fait planter le
décodeur pixel de `@react-pdf/png-js` — ils exercent donc **exclusivement**
le filet aval, sans jamais passer par la protection primaire. C'est
spécifiquement ce que la mission demandait.

### Preuve du garde-fou inconditionnel

#### 1. Fabrication d'une image qui passe l'amont mais casse `@react-pdf/png-js`

**Réussie.** Piste retenue parmi celles suggérées : notre validateur amont
(`decodePng` dans `image-decode.ts`) vérifie uniquement que
`zlib.inflateSync` réussit sur le flux IDAT concaténé — il ne vérifie **ni**
le CRC des chunks, **ni** la cohérence entre les données décompressées et
l'IHDR, **ni** la validité de chaque octet de « filter type » PNG (la norme
n'autorise que 0 à 4 par ligne de balayage, cf. RFC 2083 §6.2).

`@react-pdf/png-js` (`node_modules/@react-pdf/png-js/lib/png-js.js`,
fonction `pass()` dans `decodePixels()`) lit le premier octet de chaque ligne
comme un filter type et fait un `switch` dessus ; le `default` de ce switch
est `throw new Error("Invalid filter algorithm: " + n)`. Ce throw survient
**dans** le callback asynchrone `zlib.inflate(this.imgData, (err, data) => {
...})` — exactement la même famille de bug que celle documentée par l'ADR-047
(callback Node qui throw au lieu de rejeter).

En forgeant un PNG RGBA (`colorType = 6`, condition nécessaire pour que le
moteur PDF appelle `splitAlphaChannel()` → `decodePixels()`) dont chaque ligne
de balayage porte l'octet de filtre invalide `7` (raw), puis compressé avec
`zlib.deflateSync` (donc un flux zlib **valide**), on obtient une image :
- `isDecodableImage(dataUrl) === true` (confirmé par un test dédié, sanity check) ;
- qui fait planter `@react-pdf/png-js` avec `Error: Invalid filter algorithm: 7`,
  reproduisant à l'identique le mode de défaillance historique (promesse
  jamais réglée + exception process-level), confirmé par un test qui invoque
  le VRAI `renderToBuffer()` sans aucun garde-fou.

Ce test constitue la preuve empirique que **la pré-validation amont ne peut
jamais être la barrière ultime** : les deux décodeurs divergent réellement,
pas seulement en théorie.

#### 2. Preuve que `renderPdfSafely()` protège malgré tout

Avec cette même image injectée dans `renderBonLivraisonPDF` (pipeline réel,
`@react-pdf/renderer` non mocké), enveloppé par `renderPdfSafely()` :
- Le rendu se **règle toujours dans un délai borné** (jamais de promesse
  pendante) — observé en quelques centaines de millisecondes en pratique,
  très en-dessous du timeout dur de test (8 s) et du `PDF_RENDER_TIMEOUT_MS`
  de production (15 s).
- Le rejet produit est un `PdfRenderError({ code: "UNCAUGHT_EXCEPTION" })`.
- **Aucune exception ne s'échappe au-delà du wrapper** : le listener de test
  englobant (jouant le rôle du "reste du process") ne voit l'exception
  qu'une seule fois — la dispatch initiale inévitable de Node (tous les
  listeners `uncaughtException` attachés à l'instant du throw sont invoqués),
  jamais une seconde fois. Une seconde invocation aurait signalé une
  ré-émission (`process.emit`) — c'est-à-dire une fuite au-delà du wrapper.
- Le même test est répété au niveau `GET /api/export/bon-livraison/[id]`
  (sans mocker `renderBonLivraisonPDF` ni `renderPdfSafely`) : la route
  répond **500** dans un délai borné (< 9 s en pratique), jamais de requête
  suspendue. Un test compagnon (image saine) confirme le cas nominal : 200,
  vrai buffer `%PDF-...`.

#### 3. Défaut découvert en cours de mission, puis corrigé (PX.3-bis)

En construisant le test complémentaire demandé explicitement par le PM (une
`renderFn` qui ne se règle jamais et lève une exception asynchrone hors
chaîne de promesse, avec un message générique `"incorrect data check"` — sans
aucun marqueur reconnu par l'implémentation d'alors), j'ai mis en évidence
que l'implémentation **initiale** de `renderPdfSafely()` n'était **pas**
inconditionnelle au sens strict :

- L'heuristique d'attribution de l'époque (`KNOWN_PDF_STACK_MARKERS =
  ["png-js", "pdfkit", "@react-pdf", "zlib"]`, recherche dans
  `message`/`stack`) ne capturait que les exceptions dont la forme
  correspondait à un marqueur connu. Une exception **non attribuable**
  (message/stack générique, sans marqueur) était **ré-émise**
  (`process.emit('uncaughtException', err)`) plutôt qu'absorbée.
- Empiriquement : cette ré-émission, observée avec un listener de test
  englobant, se produisait **avant** que le timeout séparé n'ait la moindre
  chance de se déclencher. En production, sans aucun autre listener global
  installé (c'est le cas de ce projet), une telle ré-émission avec zéro
  listener restant aurait déclenché le comportement fatal **par défaut** de
  Node (crash du worker) — soit **exactement** le bug d'origine, pour toute
  défaillance future dont l'erreur ne porte pas l'un des 4 marqueurs connus.
- Ce défaut a été corrigé (révision **PX.3-bis**, cf. commentaire d'en-tête
  de `render-pdf-safely.ts` et ADR-047 §D3 mis à jour) pendant l'exécution de
  cette même story, par l'agent qui a implémenté PX.3-bis : passage d'une
  politique **FAIL-OPEN** (capture conditionnelle à un marqueur connu) à une
  politique **FAIL-SAFE** (capture inconditionnelle de toute exception tant
  qu'au moins un rendu est en vol, via un registre partagé
  `inFlightRenders` + un listener unique partagé). Les marqueurs de stack
  servent désormais uniquement à qualifier le niveau de confiance dans le
  log diagnostique, plus jamais à conditionner la capture.
- Mes fichiers de test ont été mis à jour (par l'agent qui a implémenté le
  fix) pour refléter ce nouveau comportement : le test reproduisant
  exactement le pattern demandé par le PM (`setTimeout` qui throw un message
  générique) démontre désormais que l'exception **n'échappe plus** — elle
  est capturée par défaut et convertie en `PdfRenderError`, **avant** que le
  timeout n'ait la moindre chance de se déclencher.

**Conclusion sur ce point** : la mission a rempli son objectif de preuve —
elle a d'abord démontré un **écart réel** entre la théorie ("le filet aval
est inconditionnel") et l'implémentation d'alors (fail-open, conditionnel à
une liste de marqueurs), puis confirmé que la correction (fail-safe)
referme cet écart. Le test qui reproduit littéralement le scénario demandé
par le PM est maintenant **vert** avec la garantie renforcée.

### Réponse à la question du PM

> Le garde-fou aval est-il inconditionnel, prouvé comment ?

**Oui, depuis la révision PX.3-bis — et non, dans l'implémentation initiale
de cette même story (défaut découvert puis corrigé).**

Preuve en trois temps :
1. **La pré-validation amont n'est pas une barrière fiable en toutes
   circonstances** : une image RGBA construite avec un octet de « filter
   type » invalide (7, hors norme PNG) est jugée décodable par
   `isDecodableImage()` (zlib inflate réussit) mais fait planter
   `@react-pdf/png-js` au rendu réel (`Invalid filter algorithm: 7`),
   reproduisant le bug historique (promesse jamais réglée + exception
   process-level) — confirmé avec le vrai moteur `@react-pdf/renderer`, sans
   aucun garde-fou.
2. **Le garde-fou aval protège malgré tout, avec cette même image, au niveau
   composant (`renderBonLivraisonPDF` + `renderPdfSafely`) ET au niveau route
   HTTP (`GET /api/export/bon-livraison/[id]`, non mocké)** : règlement
   borné, `PdfRenderError` propre, réponse HTTP 500 explicite, aucune fuite
   d'exception au-delà du wrapper.
3. **Le garde-fou reste borné et sûr même face à une défaillance qui ne
   ressemble à aucun cas connu** (message générique, aucun marqueur
   `png-js`/`pdfkit`/`@react-pdf`/`zlib`) — depuis la révision fail-safe
   PX.3-bis. Avant cette révision, ce cas précis constituait un angle mort
   documenté (fail-open) : c'est la preuve la plus directe que "inconditionnel"
   n'est pas un adjectif à prendre pour acquis sans un test qui l'exerce
   explicitement, marqueurs de stack exclus.

### Image bypass forgée avec succès

**Oui.** Un PNG RGBA dont chaque ligne de balayage porte un octet de filtre
invalide (7), avec un flux IDAT zlib par ailleurs valide, franchit
`isDecodableImage()` (`ok: true`) tout en faisant planter
`@react-pdf/png-js` (`decodePixels()` → `pass()` → `throw new Error("Invalid
filter algorithm: 7")`, dans le callback asynchrone `zlib.inflate`). Piste
utilisée : absence de vérification de la validité des octets de filtre PNG
dans notre validateur maison (celui-ci ne vérifie que la décompressibilité
zlib du flux IDAT concaténé, pas la validité sémantique du contenu
décompressé). Le code de construction de cette fixture est dans
`src/__tests__/export/pdf-render-guard-unconditional.test.ts` et dupliqué
(même logique) dans `src/app/api/export/bon-livraison/__tests__/route-render-guard.test.ts`.

### Précision méthodologique sur les tests `uncaughtException`

Node invoque **tous** les listeners `uncaughtException` actuellement
enregistrés lors d'une émission, pas seulement le premier. Un listener de
test attaché avant l'appel à `renderPdfSafely()` voit donc **toujours**
l'émission initiale d'une exception, que le wrapper l'attribue ou non — ce
n'est pas un signe de fuite. Le signal réellement significatif est le
**nombre d'invocations** : une seule (dispatch initial inévitable, absorbé en
interne sans ré-émission) versus deux ou plus (preuve d'une ré-émission,
donc d'une fuite au-delà du wrapper). Ce protocole de mesure est documenté
en détail dans les commentaires de `pdf-render-guard-unconditional.test.ts`
et a été la clé pour distinguer correctement le comportement fail-open de
l'ancien code du comportement fail-safe du code corrigé.

Un autre piège méthodologique rencontré et corrigé en cours de route : un
appel direct et non enveloppé à `renderToBuffer()` (utilisé pour prouver que
le bug brut existe, sans garde-fou) laisse une promesse **qui ne se règle
jamais** — le callback `zlib.inflate` orphelin peut throw à un instant
arbitraire, potentiellement **après** la fin du test qui l'a déclenché, ce
qui contaminerait le test suivant (listener de test attaché par erreur au
moment où l'exception tardive survient). Le test concerné attend
explicitement (polling borné) que l'exception soit observée avant de se
terminer, pour ne jamais laisser un callback en vol au-delà de son propre
scope.

### Résultats R9

- `npx vitest run` : **210 fichiers de test / 5545 tests passés**, 0 échec, 26 `todo` (préexistants, hors périmètre). Les échecs observés lors d'exécutions antérieures sous très forte contention (suite complète lancée en parallèle d'un `next build` concurrent) concernaient exclusivement des fichiers déjà connus comme sensibles au parallélisme (`password.test.ts`, `plan-form-dialog.test.tsx`, `plan-toggle.test.tsx`, `vagues-page.test.tsx`, `bon-livraison-flow.test.tsx`) — ré-exécutés isolément, ils passent tous. Aucun des fichiers de cette story n'a jamais échoué en isolation.
- `npm run build` : **OK**, build de production complet sans erreur (Prisma generate + migrate deploy + `next build --webpack`).

### Fichiers livrés / modifiés par cette story

- `src/__tests__/export/pdf-render-guard-unconditional.test.ts` (créé)
- `src/app/api/export/bon-livraison/__tests__/route-render-guard.test.ts` (créé)
- `src/app/api/export/bon-livraison/__tests__/route-real-render.test.ts` (fix mineur : mock `@/lib/permissions` incomplet — `ForbiddenError` manquant, corrigé avec `importOriginal`, même défaut que celui trouvé et corrigé dans `route-render-guard.test.ts`)

Aucune modification de `src/lib/` ou `src/app/` (hors le test ci-dessus) —
conformément à la contrainte de la mission. Le fix fail-open → fail-safe de
`src/lib/export/render-pdf-safely.ts` (PX.3-bis) a été réalisé par un autre
agent en parallèle de cette story, en réaction au défaut mis en évidence par
mes tests.
