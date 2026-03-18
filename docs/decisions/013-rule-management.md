# ADR-013 — Interface d'administration des regles d'activites

**Date :** 2026-03-18
**Statut :** ACCEPTEE
**Auteurs :** @architect, @project-manager
**Sprint :** 25

---

## Contexte

Le moteur d'activites (`src/lib/activity-engine/`) genere des activites a partir de regles stockees dans la table `RegleActivite`. Ces regles possedent des templates (`titreTemplate`, `descriptionTemplate`, `instructionsTemplate`) contenant des placeholders resolus au moment de la generation (ex : `{quantite_calculee}`, `{bac}`, `{vague}`).

Aujourd'hui, ces regles sont exclusivement gerees via SQL dans `prisma/seed.sql`. Il n'existe aucune UI pour les visualiser, les modifier ou les activer/desactiver. Le super admin DKFarm doit pouvoir piloter ces regles sans passer par un acces direct a la base de donnees.

### 23 regles globales existantes (siteId = NULL)

| Categorie | Regles | typeDeclencheur |
|-----------|--------|-----------------|
| Taches quotidiennes | regle_01 a regle_04 | RECURRENT (intervalleJours = 1) |
| Taches hebdomadaires/bimensuelles | regle_05 a regle_08 | RECURRENT (intervalleJours = 7 ou 14) |
| Seuils de poids (granulometrie) | regle_09 a regle_12 | SEUIL_POIDS |
| Tri | regle_13 | SEUIL_POIDS |
| Alertes seuil | regle_14 a regle_18 | SEUIL_MORTALITE, SEUIL_QUALITE, FCR_ELEVE, STOCK_BAS |
| Jalons de production | regle_19 a regle_23 | JALON |

### Modele RegleActivite (schema.prisma)

| Champ | Type | Role |
|-------|------|------|
| `id` | String (cuid) | Identifiant |
| `nom` | String | Libelle interne |
| `description` | String? | Description metier |
| `typeActivite` | TypeActivite | Type d'activite generee |
| `typeDeclencheur` | TypeDeclencheur | Mode de declenchement |
| `conditionValeur` | Float? | Seuil de declenchement (poids en g, %, FCR...) |
| `conditionValeur2` | Float? | Seuil haut pour SEUIL_QUALITE (ex: pH max) |
| `phaseMin` | PhaseElevage? | Phase minimale d'application |
| `phaseMax` | PhaseElevage? | Phase maximale d'application |
| `intervalleJours` | Int? | Intervalle entre declenchements (RECURRENT) |
| `titreTemplate` | String | Template du titre de l'activite |
| `descriptionTemplate` | String? | Template de la description |
| `instructionsTemplate` | String? | Template des instructions detaillees |
| `priorite` | Int (1-10) | Priorite de l'activite generee |
| `isActive` | Boolean | Regle active ou desactivee |
| `firedOnce` | Boolean | One-shot deja declenche (SEUIL_*) |
| `siteId` | String? | null = regle globale DKFarm, non-null = regle propre au site |
| `userId` | String? | Createur de la regle |

### Placeholders disponibles (template-engine.ts)

Le moteur reconnait 16 placeholders definis dans `TemplatePlaceholders` :

```
{quantite_calculee}      — quantite d'aliment en kg calculee
{taille}                 — taille moyenne des poissons (dernier releve biometrie)
{poids_moyen}            — poids moyen de la vague
{stock}                  — quantite en stock du produit concerne
{taux}                   — taux d'alimentation ou de survie
{valeur}                 — FCR ou SGR selon contexte
{semaine}                — numero de semaine du cycle
{produit}                — nom du produit recommande
{seuil}                  — valeur du seuil ayant declenche la regle
{jours_restants}         — jours restants avant fin de cycle estimee
{quantite_recommandee}   — quantite recommandee definie sur la regle
{bac}                    — nom du bac de la vague
{biomasse}               — biomasse totale en kg
{vague}                  — code de la vague
{jours_ecoules}          — jours ecoules depuis debut de vague
{valeur_marchande}       — valeur marchande estimee en FCFA
```

Tout placeholder non reconnu ou sans valeur est remplace par `[donnee non disponible]`.

### Permission existante

`Permission.GERER_REGLES_ACTIVITES` est deja definie dans l'enum et dans le groupe `configElevage` de `permissions-constants.ts`. Elle est incluse dans les permissions du role `Administrateur` mais pas dans `Gerant` ni `Pisciculteur`.

---

## Decisions

### 1. Perimetre v1

**Inclus :**
- API CRUD regles (GET liste, GET detail, POST creation, PUT modification, DELETE)
- API toggle actif/inactif (PATCH)
- API reset firedOnce (POST)
- UI liste regles groupee par typeDeclencheur
- UI detail/edition regle avec apercu templates
- UI creation regle personnalisee (site-specifique)
- Validation templates (placeholders)
- Navigation dans /settings

**Exclu :**
- Suppression de regles globales (siteId = null) — desactivation suffit
- Editeur WYSIWYG/code (CodeMirror/Monaco — trop lourd, mauvais sur mobile)
- Historique des modifications / versioning
- Tags / categories supplementaires (typeActivite + typeDeclencheur suffisent)
- Concept "regle par defaut" reinitialisation (reporte v2)
- Nouveaux TypeDeclencheur/TypeActivite (necessite migration Prisma)

### 2. Routes API

```
GET    /api/regles-activites              → lister les regles accessibles
POST   /api/regles-activites              → creer une nouvelle regle (siteId obligatoire)
GET    /api/regles-activites/[id]         → detail d'une regle
PUT    /api/regles-activites/[id]         → modifier une regle
DELETE /api/regles-activites/[id]         → supprimer (interdit si regle globale ou activites liees)
PATCH  /api/regles-activites/[id]/toggle  → activer/desactiver (isActive)
POST   /api/regles-activites/[id]/reset   → remettre firedOnce a false (SEUIL_* uniquement)
```

#### Controle d'acces

| Operation | Condition |
|-----------|-----------|
| Lire les regles | `Permission.GERER_REGLES_ACTIVITES` |
| Modifier une regle globale | `Permission.GERER_REGLES_ACTIVITES` + session site DKFarm |
| Modifier une regle site | `Permission.GERER_REGLES_ACTIVITES` + meme siteId |
| Creer une regle | `Permission.GERER_REGLES_ACTIVITES` (siteId = session.activeSiteId, jamais null) |
| Supprimer | `Permission.GERER_REGLES_ACTIVITES` + regles site-specifiques uniquement |
| Toggle isActive | Meme regle que modifier |

Les regles globales ne peuvent jamais etre supprimees via l'API. Le toggle PATCH remet `firedOnce = false` lors d'une reactivation de regle SEUIL_*.

#### Contrats de requete/reponse

**GET /api/regles-activites** — query params optionnels :
```typescript
interface ListReglesQuery {
  typeActivite?:    TypeActivite;
  typeDeclencheur?: TypeDeclencheur;
  isActive?:        "true" | "false";
  scope?:           "global" | "site" | "all";  // defaut: "all"
}
```

**POST et PUT** — body :
```typescript
interface UpsertRegleActiviteBody {
  nom:                   string;           // requis, 3-100 chars
  description?:          string;           // max 500 chars
  typeActivite:          TypeActivite;     // requis
  typeDeclencheur:       TypeDeclencheur;  // requis
  conditionValeur?:      number;           // requis si SEUIL_* ou FCR_ELEVE
  conditionValeur2?:     number;           // optionnel, SEUIL_QUALITE uniquement
  phaseMin?:             PhaseElevage;
  phaseMax?:             PhaseElevage;
  intervalleJours?:      number;           // requis si RECURRENT, entier > 0
  titreTemplate:         string;           // requis, 5-200 chars
  descriptionTemplate?:  string;           // max 500 chars
  instructionsTemplate?: string;           // max 5000 chars
  priorite?:             number;           // entier 1-10, defaut 5
  isActive?:             boolean;          // defaut true
}
```

**Validations obligatoires cote API :**
- `conditionValeur` requis si `typeDeclencheur` est `SEUIL_POIDS`, `SEUIL_QUALITE`, `SEUIL_MORTALITE`, ou `FCR_ELEVE`
- `intervalleJours` requis et `> 0` si `typeDeclencheur === RECURRENT`
- `phaseMin` doit preceder `phaseMax` dans l'ordre PhaseElevage si les deux sont renseignes
- `conditionValeur2 > conditionValeur` si les deux sont renseignes (SEUIL_QUALITE : min < max)
- Les placeholders dans les templates ne sont pas rejetes — un placeholder inconnu est accepte mais logue comme avertissement

### 3. Structure des pages UI

#### Emplacement navigation

Groupe **Configuration** (`/settings`), aux cotes de `/settings/config-elevage` et `/settings/alertes`. Permission `GERER_REGLES_ACTIVITES`.

#### Pages

```
/settings/regles-activites              → page liste (Server Component)
/settings/regles-activites/nouvelle     → page creation (Server Component + Client Form)
/settings/regles-activites/[id]         → page detail + edition (Server Component + Client Form)
```

#### Arbre des composants

```
src/
├── app/settings/regles-activites/
│   ├── page.tsx                                    → Server Component (liste)
│   ├── nouvelle/
│   │   └── page.tsx                                → Server Component (shell)
│   └── [id]/
│       └── page.tsx                                → Server Component (shell + data fetch)
│
├── components/regles-activites/
│   ├── regles-list-client.tsx                      → "use client" — liste filtree
│   ├── regle-card.tsx                              → carte resume
│   ├── regle-form-client.tsx                       → "use client" — formulaire creation/edition
│   ├── regle-detail-client.tsx                     → "use client" — vue detail avec actions
│   ├── template-editor.tsx                         → "use client" — editeur avec chips
│   ├── template-preview.tsx                        → "use client" — apercu resolu
│   └── placeholder-reference.tsx                   → tableau de reference
│
└── lib/queries/
    └── regles-activites.ts                         → queries Prisma
```

### 4. Page liste

**Pattern :** identique a `/settings/config-elevage`.

```
Header "Regles d'activites"  [+ Nouvelle regle]
Tabs: [Toutes] [Actives] [Inactives]
Groupement par TypeDeclencheur (sections)
  → RegleCard par regle
    - Nom (gras), TypeActivite badge, TypeDeclencheur badge
    - Badge "Globale DKFarm" ou "Ce site"
    - Toggle Switch isActive (PATCH immediat, optimistic update)
    - Badge firedOnce si pertinent
    - Nombre d'activites generees
    - Lien vers detail
```

Mobile-first : cartes empilees, toggle 44px, pas de tableau.

### 5. Editeur de templates (TemplateEditor)

**Solution : Textarea augmentee + chips de placeholders**

```
Label "Titre de l'activite"
┌─────────────────────────────────────────────────────────┐
│ Distribuer {quantite_calculee}kg de granule {taille}    │
└─────────────────────────────────────────────────────────┘
Chips cliquables (inserent {placeholder} a la position du curseur) :
  [quantite_calculee] [taille] [poids_moyen] [bac] [vague] [semaine]
  [Voir tous ↓]  — Radix Collapsible pour les 10 suivants
```

Les 6 premiers placeholders les plus utilises sont visibles par defaut. Un Radix `Collapsible` revele les suivants. Chaque chip est un `<button type="button">` qui insere a `selectionStart` dans le textarea associe.

### 6. Apercu des templates (TemplatePreview)

Resolution client-side avec valeurs d'exemple fixes (pas d'appel API). Le composant utilise une copie locale du regex `resolveTemplate`. Les placeholders inconnus affichent `[donnee non disponible]` — feedback suffisant pour l'admin.

```
Section "Apercu (donnees exemple)"
  ┌──────────────────────────────────┐
  │ Titre : Distribuer 1,25kg de...  │
  │ Description : Poids moyen...     │
  │ Instructions : [step cards]      │
  └──────────────────────────────────┘
```

Mise a jour temps reel (`useEffect` sur les valeurs des templates).

### 7. Page detail/edition

Layout deux colonnes desktop, une colonne mobile :
- Section Identite (nom, description, typeActivite, badge scope)
- Section Declencheur (typeDeclencheur, champs conditionnels, phaseMin/Max, priorite)
- Section Templates (TemplateEditor × 3)
- Section Apercu (TemplatePreview)
- Actions : Enregistrer, Reinitialiser, Supprimer (si site-specifique sans activites)
- Reset firedOnce (bouton si firedOnce=true, avec dialog de confirmation)

Instructions textarea ouvre en fullscreen Dialog sur mobile.

### 8. Schema — aucun changement en v1

Le modele `RegleActivite` actuel est suffisant. Champs reportes v2 :
- `isSeeded` (Boolean) — pour concept "reset to default"
- Table `RegleActiviteHistory` — versioning des modifications

### 9. Protection des regles globales

```
Regle globale (siteId = null)  → DELETE interdit (409)
Regle site (siteId non-null)   → DELETE autorise si activites.length = 0
                                → 409 si activites liees
```

Les regles globales sont modifiables uniquement par les admin du site DKFarm. Un banner "Regle globale DKFarm" est affiche dans l'UI.

### 10. Mobile-first

| Probleme mobile | Solution |
|-----------------|----------|
| Textarea instructions longue | Dialog fullscreen sur mobile |
| Chips placeholders debordement | `flex flex-wrap gap-1.5` + Collapsible |
| Page detail deux colonnes | Une colonne mobile, reference en bas |
| Formulaire long (15+ champs) | Sections accordeon (Collapsible) sur mobile |
| Bouton Enregistrer | `sticky bottom-0` sur mobile |

---

## Fichiers a creer

| Fichier | Type | Responsable |
|---------|------|-------------|
| `src/lib/queries/regles-activites.ts` | Query functions | @db-specialist |
| `src/lib/regles-activites-constants.ts` | Constants + validation | @architect |
| `src/app/api/regles-activites/route.ts` | API Route | @developer |
| `src/app/api/regles-activites/[id]/route.ts` | API Route | @developer |
| `src/app/api/regles-activites/[id]/toggle/route.ts` | API Route | @developer |
| `src/app/api/regles-activites/[id]/reset/route.ts` | API Route | @developer |
| `src/app/settings/regles-activites/page.tsx` | Server Component | @developer |
| `src/app/settings/regles-activites/nouvelle/page.tsx` | Server Component | @developer |
| `src/app/settings/regles-activites/[id]/page.tsx` | Server Component | @developer |
| `src/components/regles-activites/regles-list-client.tsx` | Client Component | @developer |
| `src/components/regles-activites/regle-card.tsx` | Component | @developer |
| `src/components/regles-activites/regle-form-client.tsx` | Client Component | @developer |
| `src/components/regles-activites/regle-detail-client.tsx` | Client Component | @developer |
| `src/components/regles-activites/template-editor.tsx` | Client Component | @developer |
| `src/components/regles-activites/template-preview.tsx` | Client Component | @developer |
| `src/components/regles-activites/placeholder-reference.tsx` | Component | @developer |

**Fichiers a modifier :**

| Fichier | Modification |
|---------|-------------|
| `src/lib/permissions-constants.ts` | Ajouter `/settings/regles-activites` dans `ITEM_VIEW_PERMISSIONS` |
| `src/lib/module-nav-items.ts` | Ajouter item "Regles d'activites" dans Configuration |
| `src/types/api.ts` | Ajouter DTOs |
| `src/types/models.ts` | Ajouter `RegleActiviteWithCount` |
| `src/types/index.ts` | Barrel export |

---

## Alternatives considerees

### A — Dialog d'edition inline (pas de page detail)
Rejetee. Le formulaire a 15+ champs, 3 templates, et un apercu temps reel — trop complexe pour un Dialog, surtout sur mobile.

### B — Editeur Markdown riche (CodeMirror/Monaco)
Rejetee. ~500KB de dependance, mauvaise experience mobile. Le Markdown utilise est simple (listes numerotees, gras). Textarea + chips suffit.

### C — Validation placeholders en temps reel (surlignage rouge)
Partiellement retenu via l'apercu : les placeholders inconnus affichent `[donnee non disponible]` dans le preview. Pas de surlignage dans le textarea en v1.

### D — Editeur JSON brut
Rejetee. Trop technique, risque d'erreurs.

---

## Consequences

### Positives
- Le super admin DKFarm peut gerer les 23 regles seeded sans acces SQL
- Les admins de sites peuvent creer des regles propres a leur contexte
- L'apercu temps reel reduit les erreurs de template silencieuses
- La permission `GERER_REGLES_ACTIVITES` est deja en place — pas de migration

### Negatives
- Les regles globales ne peuvent pas etre supprimees (communication necessaire)
- L'apercu utilise des donnees fictives (l'admin doit le comprendre)
- `firedOnce` peut etre confus — tooltip explicative necessaire
