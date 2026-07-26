# Pré-analyse Sprint PX — Robustesse du rendu PDF (BUGFIX, sévérité CRITIQUE)
Date : 2026-07-26

## Statut : GO AVEC RÉSERVES

## Résumé
Le diagnostic du PM est **confirmé et root-causé précisément** : le blocage n'est pas dans notre code applicatif mais dans la librairie vendue `@react-pdf/png-js` (bundlée par `@react-pdf/pdfkit`, dépendance de `@react-pdf/renderer@4.3.2`). La fonction `decodePixels()` utilise `zlib.inflate(buf, (err, data) => { if (err) throw err; ... })` — un callback asynchrone qui **throw** au lieu de rejeter une promesse. Ce chemin n'est emprunté par le moteur de rendu **que pour les PNG avec canal alpha (colorType 6/RGBA), palette indexée avec transparence, ou entrelacés** — exactement le format produit par une signature de pad tactile (fond transparent). Un PNG RGBA corrompu (zlib IDAT invalide) déclenche donc : (1) une promesse `renderToBuffer()` qui ne se règle **jamais**, et (2) une exception non interceptée au niveau process, hors de toute chaîne de promesse. Repro confirmée en environnement isolé (scratchpad, timeout 15s), avec un PNG RGBA de 118 caractères en data URL — taille identique à celle rapportée par le PM.

Aucune donnée corrompue n'est actuellement présente dans la base de dev (le BL-2026-001 problématique a déjà été remplacé). Le risque reste donc **latent** : un nouveau PNG forgé/corrompu posté via une des 2 routes d'écriture identifiées reproduirait l'incident en production.

## Vérifications effectuées

### Diagnostic (reproduction isolée)
Script jetable dans le scratchpad (`repro2.mjs`), PNG RGBA 1×1 avec IDAT corrompu (118 caractères en data URL, identique à l'observation terrain) :
```
Starting renderToBuffer at ...
UNCAUGHT EXCEPTION CAUGHT: incorrect data check Z_DATA_ERROR
settled at time of exception: false
10s elapsed. Promise settled? false
```
Confirme les deux défauts décrits par le PM à l'identique (message d'erreur, code, et blocage indéfini de la promesse).

**Précision non documentée par le PM** : le bug n'est PAS déclenché par n'importe quel PNG corrompu — un PNG grayscale/RGB sans canal alpha corrompu de la même façon **rend avec succès** (le flux `imgData` brut est directement ré-embarqué dans le PDF sans jamais appeler `decodePixels()`/`zlib.inflate`, voir `PNGImage.embed()` dans `node_modules/@react-pdf/pdfkit/lib/pdfkit.js` ligne ~37642). `decodePixels()` n'est appelé que par `splitAlphaChannel()`, `loadIndexedAlphaChannel()`, ou `decodeData()` (image entrelacée). Une signature de pad tactile (canvas HTML avec fond transparent, exportée en `toDataURL("image/png")`) est **quasi systématiquement RGBA** — ce qui explique pourquoi ce bug touche spécifiquement les 3 signatures + le cachet du BL, et pas un logo JPEG ou un PNG opaque.

### Schema ↔ Types : OK
- `BonLivraison.signatureClient`, `signatureLivreur` (String?) — `prisma/schema.prisma` ligne 1841/1846.
- `Site.signaturePromoteur`, `Site.cachet` (String?) — ligne 811/815.
- Pas de champ `logo` sur `Site` (vérifié par lecture du modèle complet).
- `src/types/export.ts` (`CreateBonLivraisonPDFDTO`) reflète ces 4 champs image correctement.

### API ↔ Queries : OK (aucun problème de siteId/permission détecté)
- `GET /api/export/bon-livraison/[id]/route.ts` : `requirePermission(VENTES_VOIR, EXPORT_DONNEES)` correct, `siteId` (`auth.activeSiteId`) transmis à `getBonLivraisonForPDF`.
- Le `try/catch` global de la route **ne protège pas** contre ce bug : le défaut n'est pas une exception synchrone dans la chaîne de promesse de la route, c'est une promesse qui ne se règle jamais + une exception qui s'échappe au niveau `process`, hors de portée de n'importe quel `try/catch` local.

### Build : non exécuté dans cette pré-analyse (aucune modification de code prévue ; le build sera vérifié par l'agent fixeur après implémentation, cf. R9/PROCESSES.md).

### Tests : dette de test confirmée — angle mort total sur ce chemin de bug
- `src/__tests__/export/pdf-bon-livraison.test.ts` (11 tests documentés, 291 lignes) : mocke intégralement `@react-pdf/renderer`, y compris `Image: () => null`. Aucun de ces tests ne peut détecter ce bug : l'image n'est jamais réellement décodée.
- `src/__tests__/export/pdf-cout-production.test.ts` : même pattern de mock complet — mais ce module n'embarque aucune `<Image>`, donc pas concerné par ce bug spécifique (risque nul ici, mais mock générique à noter).
- `src/app/api/export/bon-livraison/__tests__/route.test.ts` : mocke `renderBonLivraisonPDF` lui-même (`vi.mock("@/lib/export/pdf-bon-livraison")`) — angle mort de bout en bout, de la route jusqu'au moteur PDF.
- Aucun autre fichier de test n'appelle le vrai moteur `@react-pdf/renderer` avec une image réelle.

## Inventaire exhaustif du périmètre

### Modules de rendu PDF (`src/lib/export/`)
| Fichier | Utilise `<Image>` ? | Concerné par ce bug |
|---|---|---|
| `src/lib/export/pdf-bon-livraison.tsx` | OUI — 4 images (signatureClient, signatureLivreur, signaturePromoteur, cachet en overlay) | **OUI — seul module concerné** |
| `src/lib/export/pdf-facture.tsx` | NON | Non |
| `src/lib/export/pdf-rapport-vague.tsx` | NON | Non |
| `src/lib/export/pdf-cout-production.tsx` | NON | Non |
| `src/lib/export/pdf-rapport-financier.tsx` | NON | Non |
| `src/lib/export/excel-*.ts` (3 fichiers) | N/A (Excel, pas PDF) | Non |
| `src/lib/export/pdf-rapport-vague-helpers.ts`, `pdf-rapport-vague-insights.ts`, `pdf-cout-production-insights.ts` | Helpers de calcul, pas de rendu image | Non |

Pas de champ `logo` sur `Site` (seulement `signaturePromoteur` et `cachet`) — donc pas de vecteur logo à couvrir aujourd'hui, mais le futur ajout d'un logo de site devra passer par le même helper durci (cf. arbitrage).

### Routes API appelant un `renderXxxPDF` (exhaustif)
- `src/app/api/export/bon-livraison/[id]/route.ts` → `renderBonLivraisonPDF` (**seule route à risque de blocage**)
- `src/app/api/export/facture/[id]/route.ts` → `renderFacturePDF` (pas d'image, hors risque)
- `src/app/api/export/vague/[id]/route.ts` → rapport de vague (pas d'image, hors risque)
- `src/app/api/export/vague/[id]/cout-production/route.ts` → coût de production (pas d'image, hors risque)
- `src/app/api/export/finances/route.ts` → rapport financier (pas d'image, hors risque)

### Points d'écriture des images concernées
1. **`PUT /api/sites/[id]/route.ts`** — écrit `signaturePromoteur` et `cachet` (+ `nomPromoteur`).
   Validation actuelle : `updateSiteImagesSchema` (Zod) → `base64ImageOptionalSchema` = `z.string().startsWith("data:image/").max(500_000).optional().nullable()`. **Ne valide QUE le préfixe et la taille — aucun décodage réel, aucune vérification que les octets base64 forment un PNG/JPEG valide.**
2. **`POST /api/bons-livraison/[id]/signer/route.ts`** — écrit `signatureClient` et `signatureLivreur` via `signerBonLivraisonSchema` (`src/lib/validation/bon-livraison.ts`, à confirmer qu'il réutilise bien `base64ImageSchema` — mêmes limites : préfixe + taille seulement).

Le schéma `base64ImageSchema` / `base64ImageOptionalSchema` (`src/lib/validation/common.schema.ts` lignes 122-137) est **le point central unique** où les 4 champs image sont validés à l'écriture. C'est le levier de durcissement le plus efficace en amont.

### Helper partagé existant / lib de validation d'image
- Aucun décodeur d'image (PNG/JPEG) n'existe dans le projet. `package.json` ne contient ni `sharp`, ni `pngjs`, ni `jimp`, ni `image-size`, ni `file-type`. Seule dépendance disponible : **`zlib` (module Node natif)** et la lib vendue `@react-pdf/png-js` (transitivement, via `@react-pdf/pdfkit`) — celle-là même qui est bugguée, donc à ne PAS réutiliser comme validateur de confiance.
- `src/lib/validation/common.schema.ts` est le seul module de validation d'image existant (préfixe + taille).
- **Aucune dépendance n'est à inventer sans le dire** : toute validation "vraie" (décodage effectif du flux zlib de l'IDAT) devra être écrite à la main avec `zlib.inflateSync` en mode try/catch (Node natif, zéro nouvelle dépendance), OU une dépendance légère (`pngjs` ou `sharp`) devra être ajoutée explicitement — à trancher en story ADR/architecture, pas décidé silencieusement par l'agent fixeur.

## Incohérences trouvées
1. **`base64ImageSchema` ne valide pas le contenu réel de l'image**, seulement le préfixe `data:image/` et la taille en caractères. Fichier : `src/lib/validation/common.schema.ts`. C'est la porte d'entrée du vecteur DoS : n'importe quel utilisateur avec permission `VENTES_MODIFIER` (signature BL) ou `SITE_GERER` (signature promoteur/cachet) peut poster un PNG RGBA à IDAT corrompu et provoquer le blocage à la prochaine tentative d'export.
2. **Aucun test n'exécute le vrai moteur `@react-pdf/renderer`** sur le chemin bon-livraison, à aucun niveau (unité PDF, route API). Les 3 fichiers de test existants mockent totalement soit le renderer, soit la fonction de rendu elle-même. Le bug aurait pu être détecté bien plus tôt avec un seul test d'intégration non mocké.
3. Le `try/catch` de la route `GET /api/export/bon-livraison/[id]/route.ts` donne une **fausse impression de sécurité** : il ne protège en rien contre ce type précis de défaillance (promesse jamais réglée + exception hors chaîne).

## Risques identifiés
1. **Déni de service confirmé** : toute tentative de régénérer le PDF d'un BL (ou futur document) portant une image RGBA corrompue bloque indéfiniment la requête HTTP et — en l'absence de tout `process.on('uncaughtException')` global dans l'app — peut faire planter le worker Node en production (comportement par défaut de Node : log + `process.exit(1)` sur exception non interceptée). Impact : toutes les requêtes en vol sur ce worker sont perdues, pas seulement celle qui a déclenché le bug.
2. **Vecteur d'attaque actif** : les schémas Zod actuels acceptent n'importe quel octet suivant le préfixe `data:image/png;base64,`. Un attaquant authentifié avec la permission de signer un BL (rôle assez répandu : livreur/gérant) peut forger un PNG RGBA corrompu et le soumettre, provoquant un DoS reproductible à volonté sur `/api/export/bon-livraison/[id]`.
3. **Un simple `Promise.race` avec timeout NE RÉSOUT PAS le problème racine** : même si la route "timeout" et répond, la promesse originale de `renderToBuffer` reste non réglée en arrière-plan et le `throw err` du callback `zlib.inflate` se déclenchera quand même, de façon asynchrone et détachée de la requête HTTP déjà "terminée" côté client — l'exception non interceptée au niveau process survient malgré tout, avec le risque de crash de worker inchangé. Un timeout seul est un cache-misère, pas un correctif.
4. **Angle mort de non-régression** : tant que les 3 fichiers de test PDF continuent de mocker le renderer/l'image, ce bug (ou un bug voisin dans une future version de `@react-pdf/renderer`) peut être réintroduit silencieusement sans qu'aucun test ne le détecte.
5. **Legacy data** : bien qu'aucune donnée corrompue ne subsiste en dev, rien ne garantit l'absence de telles données en prod (le BL-2026-001 de dev en portait une avant remplacement manuel) — un audit lecture seule est nécessaire avant de considérer le risque clos.

## Prérequis manquants
- Aucune dépendance bloquante de schéma/types/queries : le fix est intégralement contenu dans la couche validation (Zod) + la couche de rendu (`pdf-bon-livraison.tsx`) + éventuellement un wrapper de rendu partagé. Aucune migration Prisma nécessaire.
- Décision à trancher AVANT implémentation : zlib natif (zéro dépendance) vs librairie dédiée (`pngjs`/`sharp`) pour la validation d'écriture — voir arbitrage ci-dessous. Recommandation : commencer avec zlib natif (suffisant pour détecter un flux IDAT invalide), documenter en ADR courte si une lib plus riche s'avère nécessaire plus tard (validation de dimensions exactes, formats étendus).

## Arbitrages recommandés (à valider par @architect avant implémentation)

### 1. Où placer le durcissement partagé
Créer **un seul module** `src/lib/validation/image-decode.ts` (nouveau), exposant :
- `isDecodableImage(dataUrl: string): boolean` — décodage synchrone défensif (parse l'en-tête PNG/JPEG + `zlib.inflateSync` sur l'IDAT pour un PNG, wrap try/catch ; validation de structure JPEG basique pour les JPEG) utilisé à l'écriture (Zod `.refine()`).
- Réutilisé par `base64ImageSchema` (`src/lib/validation/common.schema.ts`) — un seul point de vérité pour les 4 champs image actuels ET tout futur champ image (logo, etc.).
Ne PAS dupliquer la logique de décodage dans chaque route — c'est exactement le pattern que ERR-088/ERR-084 (grep exhaustif avant scope) recommandent d'éviter : centraliser dans un module unique référencé partout.

### 2. Validation à l'écriture
- Utiliser **zlib natif** (déjà dans Node, zéro nouvelle dépendance) : décoder l'en-tête PNG (signature magique + IHDR), puis tenter `zlib.inflateSync(idatBuffer)` dans un try/catch. Si ça throw → rejeter côté Zod avec message clair ("Image illisible ou corrompue.").
- Ne PAS se contenter d'un contrôle de dimensions minimales (une signature 1×1 est un PNG syntaxiquement valide et un décodage zlib réussi — le vrai problème est un IDAT corrompu, pas une image trop petite). Le contrôle doit porter sur la **décodabilité effective**, pas sur des heuristiques de taille.
- Ajouter ce contrôle dans `base64ImageSchema`/`base64ImageOptionalSchema`, ce qui protège automatiquement les 2 routes d'écriture identifiées (`PUT /api/sites/[id]`, `POST /api/bons-livraison/[id]/signer`) sans les toucher individuellement.

### 3. Validation à la lecture (rendu PDF) — recommandation : mode dégradé, PAS échec franc
Pour les données déjà en base (avant durcissement à l'écriture, ou toute donnée legacy) : **pré-valider chaque image AVANT de la passer à `<Image>`**, dans `renderBonLivraisonPDF` / `BonLivraisonPDF` lui-même. Si une image échoue le même contrôle `isDecodableImage()` :
- **Remplacer l'image par le placeholder existant** (`signaturePlaceholder`, déjà présent dans le composant pour le cas `image === null`), avec un texte explicite type "Signature illisible — à régénérer" plutôt que "Non renseignée".
- **Ne PAS faire échouer tout le document.** Argumentation : un bon de livraison déjà SIGNÉ est une pièce contractuelle existante — refuser de produire le PDF prive l'utilisateur de tout document, alors que produire un PDF avec une mention explicite "signature illisible" reste honnête, actionnable (contacter l'administrateur, re-signer si possible) et n'aggrave pas le service. C'est cohérent avec le traitement déjà présent pour une signature absente.
- Ce pré-check DOIT s'exécuter avant tout appel à `renderToBuffer`, de façon synchrone dans notre propre code — c'est la seule manière de rendre le blocage **structurellement impossible**, indépendamment du comportement interne (buggé) de `@react-pdf/png-js`.

### 4. Empêcher qu'une exception de rendu PDF ne devienne une uncaught exception process-level
**Un `Promise.race` avec timeout seul est INSUFFISANT** (voir Risque #3) : il ne libère pas le rendu bloqué et n'empêche pas le `throw` différé du callback `zlib.inflate` de s'échapper en exception non interceptée après coup.
Stratégie recommandée, dans cet ordre de priorité :
1. **Pré-validation systématique de chaque image AVANT `renderToBuffer`** (section 3) — rend le scénario de blocage impossible dès le départ, plutôt que de compter sur un filet de sécurité après coup. C'est la protection primaire.
2. **En défense en profondeur uniquement** (pour couvrir tout futur bug similaire dans `@react-pdf/renderer`, pas seulement celui-ci) : envelopper l'appel à `renderToBuffer` dans un wrapper partagé (`renderPdfSafely()`, réutilisable par les 5 routes d'export) qui : (a) pose un `Promise.race` avec un timeout dur (ex. 15s) pour que la requête HTTP ne reste jamais bloquée indéfiniment, ET (b) installe un listener `process.on('uncaughtException', handler)` **scopé à la durée du rendu** (ajouté juste avant l'appel, retiré juste après résolution/rejet/timeout) qui transforme toute exception échappée en rejet de promesse capturé, au lieu de laisser Node terminer le process. Documenter explicitement dans le code que ce filet ne corrige pas la fuite de ressource sous-jacente (le callback zlib orphelin reste en mémoire jusqu'à GC) — c'est un filet de disponibilité, pas un fix de fond.
3. Ne jamais compter sur le timeout seul sans la pré-validation : documenter cette dépendance dans le commentaire du wrapper pour éviter qu'un futur agent ne supprime la pré-validation en pensant que le timeout suffit.

## Audit des données existantes
Colonnes concernées : `BonLivraison.signatureClient`, `BonLivraison.signatureLivreur`, `Site.signaturePromoteur`, `Site.cachet`.

Constat en base de DEV (lecture seule, effectué dans cette pré-analyse) : **aucune donnée suspecte actuellement** — les 2 BL signés (`BL-2026-001`, `BL-2026-002`) portent des signatures de ~27-28 Ko (taille cohérente avec un vrai tracé de pad), et le site `Ferme Douala` porte une signature promoteur de 16 Ko et un cachet de 19 Ko. Le cas problématique (118 caractères) qui a servi à la reproduction du PM a déjà été corrigé manuellement en base de dev.

**Script de constat à écrire pour la prod** (`scripts/data-fixes/px-audit-signatures-corrompues.*`), suivant le pattern de `scripts/data-fixes/gd3-apply.sh` (bash + SQL séparés, mode lecture seule ici donc pas de backup nécessaire) :
- Un script Node (pas un simple `.sql`, car la validation "décodable ou non" nécessite `zlib.inflateSync`, pas exprimable en SQL pur) qui : (1) se connecte à la DB via `DATABASE_URL`, (2) sélectionne les 4 colonnes ci-dessus sur toutes les lignes non nulles, (3) applique `isDecodableImage()` (le même helper que PX.1, réutilisé — pas dupliqué) à chacune, (4) imprime un rapport `numero/id | champ | décodable OUI/NON | taille` sans aucune écriture.
- Read-only strict : aucune mutation, aucun `UPDATE`. Si des lignes corrompues sont trouvées, elles seront traitées dans une story de remédiation séparée (décision manuelle : re-demander la signature au client/livreur, ou nettoyer le champ à `NULL` avec passage en mode dégradé).

## Dette de test à combler (résumé)
- `src/__tests__/export/pdf-bon-livraison.test.ts` : mock complet du renderer + `Image: () => null` — angle mort total sur le décodage d'image.
- `src/app/api/export/bon-livraison/__tests__/route.test.ts` : mock complet de `renderBonLivraisonPDF` — angle mort de bout en bout.
- `src/__tests__/export/pdf-cout-production.test.ts` : même pattern de mock, mais module non concerné (pas d'`<Image>`) — pas d'action requise pour CE bug, à noter pour information.

## Plan d'implémentation proposé (découpage en stories)

| Story | Type | Agent | Contenu |
|---|---|---|---|
| **PX.1** | BUGFIX (fondations) | `@developer` | Créer `src/lib/validation/image-decode.ts` (`isDecodableImage()`, zlib natif, zéro nouvelle dépendance). Brancher dans `base64ImageSchema`/`base64ImageOptionalSchema` (`src/lib/validation/common.schema.ts`) via `.refine()`. Protège d'un coup `PUT /api/sites/[id]` et `POST /api/bons-livraison/[id]/signer`. |
| **PX.2** | BUGFIX (rendu) | `@developer` | Pré-valider chaque image (`signatureClient`, `signatureLivreur`, `signaturePromoteur`, `cachet`) dans `renderBonLivraisonPDF`/`BonLivraisonPDF` avant `renderToBuffer` ; mode dégradé (placeholder "Signature illisible") pour toute image non décodable, réutilisant `isDecodableImage()` de PX.1. |
| **PX.3** | BUGFIX (défense en profondeur) | `@developer` | Wrapper partagé `renderPdfSafely()` (`src/lib/export/render-pdf-safely.ts` ou équivalent) : timeout dur + `process.on('uncaughtException')` scopé autour de l'appel `renderToBuffer`. Appliqué aux 5 routes d'export (protection homogène, même si seule bon-livraison utilise des images aujourd'hui). |
| **PX.4** | TEST | `@tester` | Dé-mocker partiellement : ajouter un test qui appelle le VRAI `renderBonLivraisonPDF` (sans mock de `@react-pdf/renderer`) avec un PNG RGBA corrompu (fixture reprenant le repro de cette pré-analyse) — vérifie résolution bornée + pas d'exception échappée + mode dégradé. Ajouter un test équivalent au niveau route (`route.test.ts`) sans mocker `renderBonLivraisonPDF`. Garder les tests existants mockés pour les cas nominaux (rapides). |
| **PX.5** | SCHEMA/QUERIES (lecture seule) | `@db-specialist` | Script `scripts/data-fixes/px-audit-signatures-corrompues.*` (Node + zlib, réutilise `isDecodableImage()`) : constat read-only en base de prod sur les 4 colonnes concernées. Aucune mutation. Rapport à `docs/bugs/` ou `docs/analysis/`. |
| **PX.6** | REVIEW (obligatoire, sévérité Critique) | `@code-reviewer` | Vérifie R1-R9, en particulier : aucun `console.log` de debug (ERR-082), pas de nouvelle dépendance non justifiée, le mode dégradé ne casse pas le rendu nominal, le wrapper `renderPdfSafely` ne masque pas d'autres erreurs légitimes (ex. DTO invalide doit toujours remonter en 400/500 normal). |
| **PX.7** | Capitalisation | `@knowledge-keeper` | Nouvelle entrée `ERR-XXX` dans `docs/knowledge/ERRORS-AND-FIXES.md` : callback Node async qui `throw` au lieu de rejeter une promesse = uncaught exception + promesse jamais réglée ; toute librairie tierce embarquant ce pattern sur des entrées utilisateur doit être pré-validée en amont, jamais fiée en confiance. |

Note process : la story ADR n'est pas jugée strictement nécessaire (décision suffisamment cadrée par cette pré-analyse), mais le @project-manager peut demander une courte ADR pour PX.3 (stratégie process-level uncaughtException) si l'équipe souhaite formaliser ce choix pour les futurs modules PDF.

## Recommandation
**GO** pour démarrer l'implémentation selon le plan PX.1 → PX.7 ci-dessus, dans cet ordre (PX.1 et PX.5 peuvent être parallélisés — aucune dépendance entre eux ; PX.2 dépend de PX.1 ; PX.3 est indépendant et peut être fait en parallèle de PX.2 ; PX.4 dépend de PX.1+PX.2+PX.3 ; PX.6 après tout le reste ; PX.7 en dernier).

Réserve unique : trancher explicitement (avant PX.1) le choix "zlib natif" vs "librairie dédiée" pour le décodage — cette pré-analyse recommande zlib natif (suffisant, zéro dépendance nouvelle) mais la décision finale revient à `@architect`/`@project-manager`.
