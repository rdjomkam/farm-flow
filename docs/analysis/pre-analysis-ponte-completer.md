# Pré-analyse — Page "Compléter Ponte" + Garde Incubation

**Date :** 2026-04-08
**Story :** UI — Page compléter ponte + garde incubation
**Analyste :** @pre-analyst

---

## Statut : GO AVEC RÉSERVES

---

## Résumé

La page `/reproduction/pontes/[id]/completer` n'existe pas — les boutons "Compléter" dans `ponte-detail-client.tsx` pointent vers une 404. Les APIs PATCH (stripping, resultat) sont complètes et correctes. `PonteFormClient` n'accepte aucune prop d'initialisation ni de `ponteId` initial, et son étape 4 contient un lien mort `/alevins/pontes/` (route migrée). Deux problèmes additionnels sont identifiés : la permission obsolète `ALEVINS_VOIR` sur la page détail, et l'absence de garde `step2Done` sur le bouton "Lancer l'incubation". Ces points doivent être corrigés dans la même story.

---

## Vérifications effectuées

### 1. ERRORS-AND-FIXES.md

Lu. Erreurs pertinentes pour cette story :
- **ERR-086** : lors d'une migration de routes, grep tous les `href`, `isActive`, `push()`, pas seulement les balises Link. Applicable ici car `ponte-form-client.tsx` contient encore `/alevins/pontes/${ponteId}`.
- **ERR-085** : après migration de permissions, mettre à jour les commentaires JSDoc. Applicable car la page détail utilise encore `ALEVINS_VOIR`.

---

### 2. Analyse de PonteFormClient

**Fichier :** `src/components/reproduction/ponte-form-client.tsx`

#### Structure du stepper

```
Step 1 — Injection  : femelle/mâle, datePonte, hormone, dose, coût, heureInjection, temp
Step 2 — Stripping  : heureStripping, poids oeufs, qualité, méthode mâle, motilité
Step 3 — Résultat   : tauxFecondation, tauxEclosion, larvesViables, coutTotal (ou échec)
Step 4 — Confirmation : récapitulatif + bouton "Voir la ponte"
```

#### Props actuelles (interface `Props`)

```typescript
interface Props {
  lotsFemelles: GenericOption[];
  lotsMales: GenericOption[];
  femelles: GenericOption[];
  males: GenericOption[];
}
```

Le composant n'accepte aucune prop `initialData`, `initialStep`, `mode`, ni `ponteId` existant. Tout est initialisé depuis des constantes `DEFAULT_STEP1/2/3` vides.

#### Gestion du ponteId

- `ponteId` est un `useState<string | null>(null)` initialisé à `null`.
- Il est alimenté exclusivement par la réponse du `POST /api/reproduction/pontes` (step 1).
- Step 2 et 3 font `if (!ponteId) return;` — ils refusent de s'exécuter si `ponteId` est null.

**Conséquence directe :** Pour le mode "compléter step=2", le composant a besoin du `ponteId` dès le départ — sans le POST step 1.

#### Soumission par step

| Step | Appel | Méthode |
|------|-------|---------|
| 1 | `POST /api/reproduction/pontes` | POST — crée une nouvelle ponte |
| 2 | `PATCH /api/reproduction/pontes/[id]/stripping` | PATCH |
| 3 | `PATCH /api/reproduction/pontes/[id]/resultat` | PATCH |
| 3 (échec) | `PATCH /api/reproduction/pontes/[id]/echec` | PATCH |

Pour le mode "compléter step=2", aucun POST ne doit être fait — le composant doit sauter step 1 et utiliser le `ponteId` de la ponte existante.

#### Lien mort en Step 4

`Step4Confirmation` redirige vers `/alevins/pontes/${ponteId}` (ligne 1110). La route correcte est `/reproduction/pontes/${ponteId}` (migration ADR-045). Ce bug ERR-086 doit être corrigé dans la même story.

---

### 3. APIs d'édition

#### `PATCH /api/reproduction/pontes/[id]/stripping`

Champs acceptés :
- `heureStripping` (string ISO, **obligatoire**)
- `poidsOeufsPontesG` (number > 0, optionnel)
- `nombreOeufsEstime` (integer > 0, optionnel)
- `qualiteOeufs` (enum QualiteOeufs, optionnel)
- `methodeMale` (enum MethodeExtractionMale, optionnel)
- `motiliteSperme` (enum MotiliteSperme, optionnel)
- `notes` (string, optionnel)

Permission : `PONTES_GERER`. Compatible avec Step2Data.

#### `PATCH /api/reproduction/pontes/[id]/resultat`

Champs acceptés :
- `tauxFecondation` (number 0-100, optionnel)
- `tauxEclosion` (number 0-100, optionnel)
- `nombreLarvesViables` (integer > 0, optionnel)
- `coutTotal` (number >= 0, optionnel)
- `notes` (string, optionnel)

Permission : `PONTES_GERER`. Compatible avec Step3Data.

#### Pas de `PATCH /api/reproduction/pontes/[id]` (step 1)

Le fichier `src/app/api/reproduction/pontes/[id]/route.ts` n'expose que `GET` et `DELETE` — pas de `PATCH` pour modifier les champs injection. **Conséquence :** le mode "compléter step=1" ne peut pas faire de PATCH pour l'injection via une API dédiée. Deux options :
- A. Créer un `PATCH /api/reproduction/pontes/[id]` pour les champs step 1.
- B. Pour step=1 non complété, la nouvelle page peut réutiliser directement le formulaire existant en mode création (le POST crée bien une ponte avec les données d'injection).

L'option B est acceptable car `isStep1Complete` est faux uniquement si aucun champ injection n'a été renseigné lors de la création — ce cas est rare. L'option A est plus propre mais hors scope minimal.

---

### 4. Page serveur détail `src/app/reproduction/pontes/[id]/page.tsx`

La page :
- Charge la ponte via `getPonteById(id, session.activeSiteId)`
- Passe le résultat sérialisé à `ReproductionPonteDetailClient`
- Utilise `Permission.ALEVINS_VOIR` au lieu de `Permission.PONTES_VOIR` — **permission obsolète** (ERR-085 pattern)

La ponte chargée contient tous les champs nécessaires pour pré-remplir les steps : `heureStripping`, `heureInjection`, `typeHormone`, etc. (confirmé via `PonteDetailData` dans `ponte-detail-client.tsx`).

---

### 5. Garde "Lancer l'incubation"

Dans `ponte-detail-client.tsx` ligne 642, la condition pour afficher le bouton "Lancer l'incubation" est :

```typescript
{canModify && !isEchouee && (
  <Dialog ...>
    <DialogTrigger asChild>
      <Button>Lancer l'incubation</Button>
    </DialogTrigger>
```

La variable `step2Done` est calculée (ligne 315) mais **n'est pas utilisée comme garde**. Le bouton est accessible dès que `canModify && !isEchouee`, même si le stripping n'a pas été complété. La condition doit devenir :

```typescript
{canModify && !isEchouee && step2Done && (
```

---

## Incohérences trouvées

### INC-1 — Page `/reproduction/pontes/[id]/completer` inexistante (bloquant)

Les boutons "Compléter" dans `ponte-detail-client.tsx` (lignes 485, 560, 607) pointent vers cette route qui n'existe pas. Résultat : 404 garanti.

Fichiers concernés :
- `src/app/reproduction/pontes/[id]/completer/page.tsx` — à créer
- `src/components/reproduction/ponte-completer-client.tsx` — à créer

### INC-2 — Lien mort `/alevins/pontes/` dans Step4Confirmation (ERR-086)

`src/components/reproduction/ponte-form-client.tsx` ligne 1110 : `router.push(\`/alevins/pontes/${ponteId}\`)`. La route correcte est `/reproduction/pontes/${ponteId}`.

### INC-3 — Permission obsolète sur la page détail

`src/app/reproduction/pontes/[id]/page.tsx` ligne 18 : `Permission.ALEVINS_VOIR` au lieu de `Permission.PONTES_VOIR`.

### INC-4 — Absence de garde step2Done sur "Lancer l'incubation"

`src/components/reproduction/ponte-detail-client.tsx` ligne 642 : le bouton s'affiche sans vérification que le stripping est complété.

### INC-5 — PonteFormClient sans props d'initialisation

Le composant ne supporte pas de mode "édition". Il faudra soit créer un nouveau composant `PonteCompleterClient`, soit étendre `PonteFormClient` avec des props optionnelles.

---

## Évaluation de la faisabilité — Réutilisation vs nouveau composant

### Option A — Étendre PonteFormClient (complexité haute)

Ajouter `initialData`, `initialStep`, `initialPonteId`, `mode` à `PonteFormClient`. Le composant est déjà de 1450 lignes. Risque de régression sur le mode création.

**Non recommandé.**

### Option B — Nouveau composant PonteCompleterClient (recommandé)

Créer `src/components/reproduction/ponte-completer-client.tsx` :
- Accepte `ponte: PonteDetailData` (ou un sous-ensemble) et `step: 1 | 2 | 3` en props
- Initialise l'état depuis les données de la ponte existante
- `ponteId` est passé en prop (pas de POST step 1)
- Pour step=2 : montre uniquement Step2Stripping + submit PATCH stripping
- Pour step=3 : montre uniquement Step3Resultat + submit PATCH resultat
- Pour step=1 : montre Step1Injection + submit PATCH (nécessite création de l'endpoint, ou rediriger vers `/reproduction/pontes/nouvelle` si la ponte n'a pas de données injection du tout)
- Redirect vers `/reproduction/pontes/${ponteId}` après succès

### Page serveur `/reproduction/pontes/[id]/completer/page.tsx`

```typescript
// Paramètres attendus : params.id + searchParams.step
// Charge la ponte via getPonteById
// Vérifie que la ponte est EN_COURS
// Rend PonteCompleterClient avec ponte + step
```

---

## Prérequis manquants

1. **Endpoint `PATCH /api/reproduction/pontes/[id]`** pour le cas step=1 (optionnel si le cas est rare). Sans cet endpoint, la completion du step 1 n'est pas possible via PATCH — il faudrait soit créer cet endpoint, soit masquer le bouton "Compléter" du step 1 dans `ponte-detail-client.tsx` si la ponte a déjà été créée via le formulaire complet (cas normal).

2. **Vérifier la compatibilité des types** : `PonteDetailData` (dans `ponte-detail-client.tsx`) a les champs number pour les valeurs numériques, alors que `Step2Data` et `Step3Data` travaillent avec des strings (inputs HTML). Le composant `PonteCompleterClient` devra convertir `ponte.heureStripping` (ISO string) en format `datetime-local` string pour l'input.

---

## Recommandation

**GO** — Développement faisable sans modification des APIs existantes (sauf si step=1 est requis).

### Travail à faire par le @developer

1. **Corriger INC-2** : ligne 1110 de `ponte-form-client.tsx`, remplacer `/alevins/pontes/` par `/reproduction/pontes/`.

2. **Corriger INC-3** : ligne 18 de `src/app/reproduction/pontes/[id]/page.tsx`, remplacer `Permission.ALEVINS_VOIR` par `Permission.PONTES_VOIR`.

3. **Corriger INC-4** : ligne 642 de `ponte-detail-client.tsx`, ajouter `step2Done &&` à la condition du bouton "Lancer l'incubation".

4. **Créer `src/app/reproduction/pontes/[id]/completer/page.tsx`** :
   - Charge la ponte via `getPonteById`
   - Lit `searchParams.step` (1, 2 ou 3)
   - Vérifie que la ponte est `EN_COURS` (sinon redirect vers détail)
   - Permission : `PONTES_GERER`
   - Rend `PonteCompleterClient`

5. **Créer `src/components/reproduction/ponte-completer-client.tsx`** :
   - Props : `ponte: PonteDetailData`, `step: 1 | 2 | 3`
   - Pour step=2 : utiliser directement le sous-composant `Step2Stripping` (à extraire ou dupliquer) avec pré-remplissage depuis `ponte.heureStripping`, etc.
   - Pour step=3 : idem avec `Step3Resultat`
   - Conversions type : `ponte.heureStripping` (ISO string) → format `datetime-local` (`string.slice(0, 16)`)
   - Submit : PATCH vers les endpoints existants
   - Redirect : `/reproduction/pontes/${ponte.id}` après succès

6. **Décision step=1** : Si le cas "ponte créée sans données injection" est possible, créer `PATCH /api/reproduction/pontes/[id]` acceptant les champs step 1. Sinon, masquer le bouton "Compléter" du step 1 si `isStep1Complete` est toujours vrai après création via le formulaire normal (auquel cas le bouton n'apparaît jamais en pratique).

### Points de vigilance

- Le composant `Step2Stripping` et `Step3Resultat` sont des fonctions internes non exportées de `ponte-form-client.tsx`. Le developer devra soit les extraire dans un fichier partagé, soit les redupliquer dans `ponte-completer-client.tsx`. La duplication est acceptable si les sous-composants restent stables.
- La conversion des valeurs initiales `number | null` → `string` pour les inputs doit être explicite : `ponte.poidsOeufsPontesG?.toString() ?? ""`.
- L'`heureStripping` en base est un ISO datetime ; l'input `datetime-local` attend le format `YYYY-MM-DDTHH:MM`. Utiliser `new Date(ponte.heureStripping).toISOString().slice(0, 16)`.

