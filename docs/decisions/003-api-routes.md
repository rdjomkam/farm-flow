# ADR 003 — API Routes et contrats request/response

**Date :** 2026-03-08
**Statut :** Acceptee
**Auteur :** @architect

## Contexte

L'application utilise Next.js App Router. Les API routes servent a :
1. Les mutations (POST, PUT) depuis les formulaires client
2. L'acces aux donnees quand un Server Component ne suffit pas

Les lectures (GET) peuvent aussi etre faites directement via Prisma dans les Server Components, mais les API routes fournissent une interface uniforme et testable.

## Decision

### Routes API

| Methode | Route | Description | Request Body | Response |
|---------|-------|-------------|-------------|----------|
| GET | `/api/bacs` | Lister les bacs | — | `BacListResponse` |
| POST | `/api/bacs` | Creer un bac | `CreateBacDTO` | `BacResponse` (201) |
| GET | `/api/vagues` | Lister les vagues | — | `VagueListResponse` |
| POST | `/api/vagues` | Creer une vague | `CreateVagueDTO` | `VagueSummaryResponse` (201) |
| GET | `/api/vagues/[id]` | Detail d'une vague | — | `VagueDetailResponse` |
| PUT | `/api/vagues/[id]` | Modifier/cloturer | `UpdateVagueDTO` | `VagueSummaryResponse` |
| GET | `/api/releves` | Lister (filtres) | Query params: `ReleveFilters` | `ReleveListResponse` |
| POST | `/api/releves` | Creer un releve | `CreateReleveDTO` | `Releve` (201) |

### Detail des contrats

---

#### `GET /api/bacs`

**Query params :** aucun

**Response 200 :**
```json
{
  "bacs": [
    {
      "id": "clx...",
      "nom": "Bac 1",
      "volume": 1000,
      "vagueId": "clx..." | null,
      "vagueCode": "VAGUE-2024-001" | null,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 4
}
```

---

#### `POST /api/bacs`

**Request body :**
```json
{
  "nom": "Bac 5",
  "volume": 2000
}
```

**Validation :**
- `nom` : obligatoire, string non vide
- `volume` : obligatoire, nombre > 0

**Response 201 :** le bac cree (format `BacResponse`)

**Erreurs :**
- 400 : champs manquants ou invalides

---

#### `GET /api/vagues`

**Query params :**
- `statut` (optionnel) : `EN_COURS` | `TERMINEE` | `ANNULEE`

**Response 200 :**
```json
{
  "vagues": [
    {
      "id": "clx...",
      "code": "VAGUE-2024-001",
      "dateDebut": "2024-01-15T00:00:00Z",
      "dateFin": null,
      "statut": "EN_COURS",
      "nombreInitial": 500,
      "poidsMoyenInitial": 5.0,
      "origineAlevins": "Ecloserie Douala",
      "nombreBacs": 3,
      "joursEcoules": 45,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 2
}
```

---

#### `POST /api/vagues`

**Request body :**
```json
{
  "code": "VAGUE-2024-002",
  "dateDebut": "2024-03-01",
  "nombreInitial": 1000,
  "poidsMoyenInitial": 3.5,
  "origineAlevins": "Production locale",
  "bacIds": ["clx-bac-1", "clx-bac-2"]
}
```

**Validation :**
- `code` : obligatoire, unique
- `dateDebut` : obligatoire, date ISO valide
- `nombreInitial` : obligatoire, entier > 0
- `poidsMoyenInitial` : obligatoire, nombre > 0
- `bacIds` : obligatoire, au moins 1 bac, tous les bacs doivent etre libres (vagueId = null)

**Response 201 :** la vague creee (format `VagueSummaryResponse`)

**Erreurs :**
- 400 : champs manquants ou invalides
- 409 : un ou plusieurs bacs sont deja assignes a une autre vague

---

#### `GET /api/vagues/[id]`

**Response 200 :**
```json
{
  "vague": {
    "id": "clx...",
    "code": "VAGUE-2024-001",
    "dateDebut": "2024-01-15T00:00:00Z",
    "dateFin": null,
    "statut": "EN_COURS",
    "nombreInitial": 500,
    "poidsMoyenInitial": 5.0,
    "origineAlevins": "Ecloserie Douala",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "bacs": [
    { "id": "...", "nom": "Bac 1", "volume": 1000, ... }
  ],
  "releves": [
    { "id": "...", "date": "...", "typeReleve": "BIOMETRIE", ... }
  ],
  "indicateurs": {
    "tauxSurvie": 92.5,
    "fcr": 1.3,
    "sgr": 2.1,
    "biomasse": 45.6,
    "poidsMoyen": 98.5,
    "tailleMoyenne": 22.3,
    "nombreVivants": 463,
    "totalMortalites": 37,
    "totalAliment": 28.5,
    "gainPoids": 93.5,
    "joursEcoules": 45
  }
}
```

**Erreurs :**
- 404 : vague non trouvee

---

#### `PUT /api/vagues/[id]`

**Request body (cloture) :**
```json
{
  "statut": "TERMINEE",
  "dateFin": "2024-04-15"
}
```

**Request body (ajout de bacs) :**
```json
{
  "addBacIds": ["clx-bac-4"]
}
```

**Validation :**
- Si `statut` = `TERMINEE`, `dateFin` est obligatoire
- Si `addBacIds`, les bacs doivent etre libres
- Si `removeBacIds`, les bacs doivent appartenir a la vague

**Comportement lors de la cloture :**
1. Mettre le statut a `TERMINEE`
2. Renseigner `dateFin`
3. Liberer tous les bacs (mettre `vagueId = null`) dans une transaction

**Response 200 :** la vague mise a jour (format `VagueSummaryResponse`)

**Erreurs :**
- 400 : validation echouee
- 404 : vague non trouvee
- 409 : bacs deja assignes

---

#### `GET /api/releves`

**Query params :**
- `vagueId` (optionnel) : filtrer par vague
- `bacId` (optionnel) : filtrer par bac
- `typeReleve` (optionnel) : `BIOMETRIE` | `MORTALITE` | `ALIMENTATION` | `QUALITE_EAU` | `COMPTAGE` | `OBSERVATION`
- `dateFrom` (optionnel) : date ISO, releves apres cette date
- `dateTo` (optionnel) : date ISO, releves avant cette date

**Response 200 :**
```json
{
  "releves": [
    {
      "id": "...",
      "date": "2024-02-10T08:00:00Z",
      "typeReleve": "BIOMETRIE",
      "vagueId": "...",
      "bacId": "...",
      "notes": null,
      "poidsMoyen": 45.2,
      "tailleMoyenne": 15.3,
      "echantillonCount": 20,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "total": 15
}
```

---

#### `POST /api/releves`

**Request body (exemple biometrie) :**
```json
{
  "date": "2024-02-15T09:00:00Z",
  "typeReleve": "BIOMETRIE",
  "vagueId": "clx...",
  "bacId": "clx...",
  "notes": "Echantillonnage matin",
  "poidsMoyen": 52.3,
  "tailleMoyenne": 16.1,
  "echantillonCount": 25
}
```

**Validation :**
- `date` : obligatoire
- `typeReleve` : obligatoire, enum valide
- `vagueId` : obligatoire, vague existante et EN_COURS
- `bacId` : obligatoire, bac existant et appartenant a la vague
- Champs specifiques au type : valides selon le typeReleve (cf. DTOs discrimines dans `src/types/api.ts`)

**Response 201 :** le releve cree (format `Releve`)

**Erreurs :**
- 400 : validation echouee (champs manquants, type invalide)
- 404 : vague ou bac non trouve
- 409 : le bac n'appartient pas a la vague

---

### Codes HTTP utilises

| Code | Signification | Usage |
|------|--------------|-------|
| 200 | OK | GET reussi, PUT reussi |
| 201 | Created | POST reussi |
| 400 | Bad Request | Validation echouee |
| 404 | Not Found | Ressource inexistante |
| 409 | Conflict | Bac deja assigne, code duplique |
| 500 | Internal Server Error | Erreur serveur inattendue |

### Format des erreurs

Toutes les erreurs suivent le meme format :

```json
{
  "status": 400,
  "message": "Le champ 'nom' est obligatoire.",
  "field": "nom"
}
```

Pour les erreurs de validation multiples :

```json
{
  "status": 400,
  "message": "Erreurs de validation",
  "errors": [
    { "field": "nom", "message": "Le champ 'nom' est obligatoire." },
    { "field": "volume", "message": "Le volume doit etre superieur a 0." }
  ]
}
```

## Options considerees

### Option A — Server Actions uniquement
**Rejete** : moins testable, plus difficile a debugger, pas de contrat explicite.

### Option B — API Routes uniquement (retenu pour les mutations)
**Retenu** : contrats explicites, testable avec des outils HTTP, coherent avec les types DTOs.

### Option C — Hybride Server Components + API Routes
**Retenu** : les Server Components lisent directement via Prisma (queries), les mutations passent par les API routes. Meilleur des deux mondes.

## Consequences

- Les Server Components appellent `src/lib/queries/` directement pour les lectures
- Les Client Components appellent `fetch("/api/...")` pour les mutations
- Les contrats sont documentes ici et types dans `src/types/api.ts`
- Les messages d'erreur sont en francais pour l'utilisateur final
