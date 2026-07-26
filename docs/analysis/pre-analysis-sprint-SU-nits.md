# Pré-analyse Sprint SU — Nits SC/BL (SU.6, SU.7) — 2026-07-26

## Statut : GO

## Résumé
Les 5 points (SU.6 a/b/c/d + SU.7) sont des corrections locales, non structurantes, à faible risque. Le scope de chaque fix est confirmé par grep exhaustif. Baseline build OK, tests OK (les 56 échecs observés lors du premier run complet sont des timeouts de contention CPU dus à des process `next build`/`vitest` résiduels d'une session précédente — confirmés faux positifs par rerun isolé, voir section Tests).

## Vérifications effectuées

### Base de connaissances (ERRORS-AND-FIXES.md)
Lu intégralement (page 1, 2787 lignes au total — section pertinente couverte : ERR-096/097/098/099/100 sur R2/R3, pattern Map/enum, labels PDF). Aucune des 5 corrections ne réintroduit une erreur connue ; au contraire, (a) est exactement le pattern ERR-096/097 (typer une Map avec l'enum plutôt que `string`).

### review-sprint-SC.md (source des points a-d)
Confirme le scope exact :
- Fichiers revus : `src/lib/queries/finances.ts` (L.779-786, 1358-1404), `src/components/vagues/cout-production-card.tsx` (L.240-249), `src/lib/export/pdf-cout-production.tsx` (L.621-624), `src/messages/{fr,en}/vagues.json` (clé `sections.detailAlimentationSacs`).
- Verdict original : APPROVED_WITH_NITS, 4 nits listés = exactement a/b/c/d de cette pré-analyse.

### review-sprint-BL.md
Consulté (non cité en détail ici car SU.7 provient d'une lecture directe du fichier, pas d'un nit du rapport BL — voir section SU.7).

## Détail par point

### SU.6(a) — `alimentsMap.uniteAchat: string | null` au lieu de `UniteStock | null`

**GO.**

Déclaration exacte : `src/lib/queries/finances.ts:1362-1371`
```ts
const alimentsMap = new Map<
  string,
  {
    quantite: number;
    prixUnitaire: number;
    total: number;
    uniteAchat: string | null;      // ligne 1368 — à corriger en UniteStock | null
    contenance: number | null;
  }
>();
```
`UniteStock` est **déjà importé** dans ce fichier (`finances.ts:2`) et utilisé juste après à la ligne 1407 (`data.uniteAchat === UniteStock.SACS`) — donc le fix est un simple changement de type, zéro nouvel import.

Consommateurs directs de `alimentsMap` : uniquement interne à `getCoutProductionVague` (lignes 1379-1420), le champ `uniteAchat` de la map n'est **pas propagé** dans `CoutProductionDetailAliment` (interface de retour, `finances.ts:779-786`) qui n'expose que `contenanceSac` et `nombreSacs`. Donc le fix est strictement local à ces ~10 lignes, sans effet de bord sur l'UI/PDF/tests.

**Pas de schéma Zod à aligner** : la validation de `uniteAchat` en API (`src/app/api/produits/route.ts`, `src/app/api/produits/[id]/route.ts`) est faite manuellement via `VALID_UNITES.includes(...)` (`Object.values(UniteStock)`), pas via Zod — il n'existe aucun schéma Zod pour `Produit`/`uniteAchat` dans ce projet à ce jour (`grep -rn "zod"` sur `src/app/api/produits/` : aucun résultat).

**Risque annexe (hors scope mais à signaler à @knowledge-keeper)** : le même pattern `uniteAchat: string | null` en violation R3 existe dans une dizaine d'autres fichiers non couverts par la review SC (composants de listing stock, `lib/calculs.ts`, `lib/bac-performance.ts`, `services/depense.service.ts`, `lib/queries/analytics.ts:456`). Ne pas les toucher dans SU.6 (hors scope de la review citée), mais à tracer comme dette technique séparée.

### SU.6(b) — Pluriel « 1.0 sacs »

**GO avec réserve sur la convention à choisir.**

Rendu UI : `src/components/vagues/cout-production-card.tsx:242-249`, clé i18n `sections.detailAlimentationSacs` :
- FR (`src/messages/fr/vagues.json:406`) : `"≈ {sacs} sacs ({contenance} kg/sac)"`
- EN (`src/messages/en/vagues.json:406`) : `"≈ {sacs} bags ({contenance} kg/bag)"`

Ces chaînes sont statiques (pas de logique singulier/pluriel), donc « sacs » s'affiche toujours, y compris pour 1.0.

**Aucun helper de pluralisation générique** n'existe dans `src/lib/`. Le pattern déjà utilisé partout ailleurs dans le projet (≈20 occurrences grepées : `vagues-list-client.tsx`, `pontes-list-client.tsx`, `lots-list-client.tsx`, `fcr-transparency-dialog.tsx`, `pdf-cout-production.tsx:607`, etc.) est un test **binaire sur le compte entier** : `count > 1 ? t("xPlural") : t("x")` avec deux clés i18n séparées (singulier/pluriel), jamais un helper partagé.

**Piège signalé explicitement** : ce pattern existant compare `count > 1` (ou `!== 1`), qui est correct pour un compteur entier, mais **incompatible avec la règle typographique française stricte pour les valeurs décimales** (singulier pour `|n| < 2`, donc 1.0 **et** 1.5 → « sac » singulier). Une implémentation qui copie le pattern usuel (`nombreSacs > 1`) donnera "1.5 sac" (faux, devrait être pluriel en fait sous la règle stricte… attention : la règle typographique française dit que le singulier s'utilise pour toute valeur dont la partie entière est 0 ou 1, ex: "1,5 kilomètre" est débattu — en pratique Bescherelle/Larousse recommandent le singulier uniquement pour des valeurs strictement inférieures à 2, ce qui inclut 1.5). Aucun autre endroit du projet n'affiche de valeur décimale pluralisée (`nombreSacs.toFixed(1)` est un cas nouveau) — il n'y a donc **pas de précédent direct** à reproduire pour le seuil décimal, seulement le pattern binaire entier. Recommandation : traiter ce point comme une décision produit explicite à trancher par l'implémenteur/reviewer (probablement `Math.abs(nombreSacs - 1) < 0.05 ? singulier : pluriel`, ou plus simplement le seuil `< 1.5` avec arrondi cohérent avec `.toFixed(1)` affiché), et ajouter un test couvrant explicitement 1.0.

### SU.6(c) — PDF sans la contenance vs UI avec contenance

**GO.**

- UI (`cout-production-card.tsx:244-247`) via la clé `detailAlimentationSacs` : `"≈ {sacs} sacs ({contenance} kg/sac)"` — formulation exacte à répliquer.
- PDF (`src/lib/export/pdf-cout-production.tsx:623`) :
```tsx
{a.quantite} kg{a.nombreSacs !== null ? ` (≈ ${a.nombreSacs.toFixed(1)} sacs)` : ""}
```
Le PDF a bien accès à `a.contenanceSac` (même objet `CoutProductionDetailAliment`, champ `contenanceSac: number | null` déjà dans le DTO, `finances.ts:784`) — donc pas besoin d'étendre le DTO, seulement compléter le template PDF avec `a.contenanceSac` pour matcher `(≈ X.X sacs (Y kg/sac))`.

### SU.6(d) — Quantité PDF sans séparateur de milliers

**GO, avec piège majeur identifié et confirmé empiriquement.**

Ligne exacte : `pdf-cout-production.tsx:623` — `{a.quantite} kg...` est un rendu brut, sans passer par un formateur.

Un formateur **existe déjà dans ce même fichier** : `formatNumPDF` (`pdf-cout-production.tsx:35-39`) :
```ts
function formatNumPDF(n: number): string {
  const abs = Math.abs(Math.round(n));
  const formatted = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return n < 0 ? "-" + formatted : formatted;
}
```
Le même pattern (regex sur `.toString()`, espace ASCII `" "` en dur) est dupliqué à l'identique dans `pdf-facture.tsx`, `pdf-bon-livraison.tsx`, `pdf-rapport-financier.tsx`, `pdf-rapport-vague.tsx` (fonctions `fmtNum`/`formatMontant`). C'est le pattern **délibérément réutilisé partout dans les PDF** du projet, par opposition à `formatNumber` (`src/lib/format.ts`, utilisé côté UI) qui repose sur `Intl.NumberFormat("fr-FR")`.

**Piège confirmé empiriquement (vérification Node) : `Intl.NumberFormat("fr-FR")` / `toLocaleString("fr-FR")` utilise `U+202F` (NARROW NO-BREAK SPACE) comme séparateur de milliers, pas un espace ASCII ni même `U+00A0` (NBSP).** `U+202F` n'existe pas dans l'encodage WinAnsi/CP1252 utilisé par les polices standards des moteurs PDF (Helvetica dans `@react-pdf/renderer` ici) → risque de caractère manquant/glyphe de substitution si `formatNumber`/`toLocaleString("fr-FR")` est utilisé directement dans un contexte PDF. C'est très probablement **la raison pour laquelle tous les templates PDF du projet réimplémentent leur propre formateur regex-based en ASCII plutôt que de réutiliser `formatNumber` de `src/lib/format.ts`.**
→ **Conclusion : ne PAS réutiliser `formatNumber` (lib/format.ts) tel quel dans le PDF. Réutiliser `formatNumPDF` déjà présent dans `pdf-cout-production.tsx`.**

**Piège secondaire (à traiter dans le fix, sinon régression silencieuse)** : `formatNumPDF` fait `Math.round(n)` — il **tronque tout à l'entier**. Or `a.quantite` (kg d'aliment) est une valeur décimale (agrégat de plusieurs relevés), actuellement affichée brute sans arrondi (`{a.quantite} kg`). Appliquer `formatNumPDF(a.quantite)` tel quel ferait perdre les décimales silencieusement (ex. "1234.7 kg" → "1235 kg"), ce qui est un changement de comportement (perte de précision), pas juste un ajout de séparateur. Un `console.log` local (`Math.round(1234.6)` → `1235`) confirme ce comportement. Il faut soit accepter cette perte de précision (à valider explicitement avec le reviewer/PM, car ce n'est pas neutre), soit écrire une variante décimale du formateur (séparer partie entière avec la regex, concaténer la partie décimale déjà présente via `.toFixed(1)` par exemple) avant de l'appliquer à `a.quantite`.

## Risques identifiés
1. **(b)** Le choix du seuil de pluralisation décimale (`< 1.5` vs `!== 1` vs `Math.round(nombreSacs) <= 1`) n'a aucun précédent dans le code — décision à documenter explicitement dans le PR/commit, sinon divergence future entre bacs de données similaires.
2. **(d)** Risque de régression silencieuse de précision si `formatNumPDF` (arrondi entier) est appliqué sans adaptation à une valeur décimale (`a.quantite`).
3. **(a)** Dette technique plus large hors scope (même violation R3 dans ~10 autres fichiers) — à ne pas corriger dans SU.6 mais à signaler pour un futur sprint de polissage.

## Prérequis manquants
Aucun. Toutes les dépendances (imports, DTO, tests existants) sont déjà en place.

---

## SU.7 — `image-upload-field.tsx:139` — id dérivé du label traduit

**Fichier** : `src/components/sites/image-upload-field.tsx`

**Code actuel (ligne 139)** :
```tsx
<input
  ref={inputRef}
  type="file"
  accept="image/png,image/jpeg"
  className="hidden"
  id={`upload-${label}`}
  onChange={handleFileSelect}
  disabled={loading}
/>
```
Aucun `htmlFor` associé dans ce fichier (grep `htmlFor` : 0 résultat) — le `id` est donc actuellement **mort** (ne sert à rien fonctionnellement aujourd'hui), mais fragile dès qu'un `<label htmlFor="upload-...">` serait ajouté pour améliorer l'accessibilité (le composant a d'ailleurs un `<span>{label}</span>` juste au-dessus, ligne 116, qui devrait probablement être un vrai `<label>` — c'est un défaut d'accessibilité latent, apparenté à ce nit).

**Usages du composant** (grep `ImageUploadField` dans `src/**/*.tsx`) : **un seul usage actif**, `src/components/sites/site-detail-client.tsx:289-297`, pour le champ « cachet » (`label={t("detail.cachet")}`). Donc aucune collision d'id en pratique aujourd'hui (pas de deux instances sur la même page avec le même label traduit) — mais le risque est réel dès qu'une deuxième instance serait ajoutée (ex. un futur champ image supplémentaire), ou si `t("detail.cachet")` change de valeur entre re-renders (peu probable mais fragile), ou si deux locales génèrent le même id malgré des libellés différents entre montages (id non stable entre les rendus si le libellé est recalculé).

**`useId()` déjà utilisé dans le projet** : oui, pattern établi dans `src/components/ui/input.tsx:3,15-16` :
```ts
import { forwardRef, useId } from "react";
...
const generatedId = useId();
const id = idProp ?? generatedId;
```
Également dans `src/components/ui/select.tsx` (`labelId`, `triggerId`), `textarea.tsx`, `markdown-editor.tsx`. C'est la convention du projet pour ce problème exact.

**Fix recommandé** : reproduire le pattern `Input`/`Select` — ajouter `useId()` dans `ImageUploadField`, générer `const id = useId()`, remplacer `id={\`upload-${label}\`}` par `id={id}`. Optionnellement exposer une prop `id?: string` (comme `InputProps`) pour permettre un id explicite si un consommateur en a besoin (tests, deep-linking). Pas de changement de comportement pour le seul usage actuel.

**Tests ciblant cet id** : aucun. `grep -rn "upload-" src/__tests__` → 0 résultat. Aucun test ne cible `getByLabelText` ni un sélecteur `#upload-...` sur ce composant — le fix est donc sans risque de casser un test existant, mais un test de non-régression (id stable, pas de dépendance au label) serait une bonne pratique à ajouter.

## Recommandation finale
**GO** pour l'ensemble (SU.6 a/b/c/d + SU.7). Tous les points sont des corrections localisées et bien isolées. Points d'attention à transmettre à l'implémenteur :
- (b) trancher explicitement le seuil de pluralisation décimale avant d'écrire le code (pas de précédent à copier).
- (d) ne pas réutiliser `Intl`/`formatNumber` (lib/format.ts) dans le PDF — utiliser `formatNumPDF` local, et gérer la décimale de `a.quantite` sans arrondi silencieux à l'entier.
- SU.7 : suivre le pattern `useId()` déjà en place dans `src/components/ui/input.tsx`.

## Build & Tests (baseline)
- `npx prisma validate` : implicite via `npm run build` (prisma generate + migrate deploy sans erreur, 147 migrations, aucune migration en attente).
- `npm run build` : **OK**, aucune erreur, toutes les routes générées (dernier run propre après nettoyage des process résiduels d'une session précédente qui bloquaient `.next/lock`).
- `npx vitest run` : premier run complet = 56 tests / 16 fichiers en échec, **tous par timeout** (`Test timed out in 5000ms/15000ms`), dus à une contention CPU par des process `next build`/`vitest` orphelins d'exécutions précédentes tournant en parallèle (confirmé via `ps aux`). Après `pkill` de ces process et un rerun isolé des fichiers en échec (`bon-livraison-flow.test.tsx`, `bottom-nav.test.tsx`), **tous passent** (17/17, 11/11). Baseline considérée saine (5498 passed dans le run initial, échecs = faux positifs de charge machine, pas de régression réelle). Recommandation : le @tester devra relancer `npx vitest run` complet dans un environnement propre avant la review finale du sprint.
