# Rapport de Tests — Sprint NA (Navigation Phase 1 : Corrections urgentes)

**Date :** 2026-03-29
**Testeur :** @tester
**Sprint :** NA (Navigation fixes — post ADR-ingenieur-interface)

---

## Résumé exécutif

| Indicateur | Résultat |
|-----------|---------|
| Tests unitaires | 3559 passes / 26 todo / 0 echec |
| Fichiers de test | 115 passes |
| Build production | OK |
| Erreurs TypeScript | 0 |

---

## Résultats des tests

### Etat initial (avant corrections)

Au lancement, 9 fichiers de test échouaient avec 31 tests en echec :

| Fichier | Tests en echec | Cause |
|--------|--------------|-------|
| `route-boundaries.test.ts` | 3 | Routes mes-taches/packs/activations attendues dans (ingenieur)/ — déplacées par NA.4 |
| `middleware/proxy-redirect.test.ts` | 2 | no-role redirigé vers /login par Guard E11 (NA.6), pas vers / |
| `api/auth.test.ts` | 2 | `clearIsSuperAdminCookie` non mockée (NA.6 ajout) |
| `api/depenses-recurrentes.test.ts` | 1 | Date rollover : `new Date().setMonth(month-1)` sur jour 29 en mois court |
| `api/vagues.test.ts` | 1 | Test utilisait `addBacIds` (ancien API) au lieu de `addBacs` (API actuelle) |
| `integration/i18n-completeness.test.ts` | 6 | Clés manquantes dans en/analytics.json et en/releves.json |
| `i18n/messages-sprint40.test.ts` | 2 | Clés aliments manquantes dans en/analytics.json |
| `i18n/messages-sprint41.test.ts` | 2 | Clés alimentation manquantes dans en/releves.json |
| `ui/analytics-aliments.test.tsx` | 10 | `scoreQualite` absent des données de test (TypeError: undefined.toFixed) |

### Corrections appliquées

#### 1. route-boundaries.test.ts — Routes NA.4 déplacées vers app root

Sprint NA.4 a déplacé `/packs`, `/activations` et `/mes-taches` de `(ingenieur)/` vers la racine de l'app pour permettre l'accès multi-rôle. Le test a été mis à jour pour :
- Retirer `mes-taches` de `INGENIEUR_EXCLUSIVE_ROUTES`
- Remplacer le bloc "packs et activations dans (ingenieur)/" par un nouveau bloc vérifiant leur présence à la racine et leur ABSENCE dans (ingenieur)/

#### 2. middleware/proxy-redirect.test.ts — Guard E11 (NA.6)

NA.6 a ajouté un Guard E11 : session valide mais rôle absent → redirect `/login` (cookie corrompu). Le test attendait `/` mais le middleware envoie maintenant vers `/login` pour les rôles vides. Correction : séparation des cas `farmRoles` (ADMIN/GERANT/PISCICULTEUR → `/`) et `no-role` (→ `/login`).

#### 3. api/auth.test.ts — clearIsSuperAdminCookie non mockée

NA.6 a ajouté `clearIsSuperAdminCookie` dans le logout route. Le mock `@/lib/auth` ne l'incluait pas, causant une erreur 500. Ajout de `clearIsSuperAdminCookie: vi.fn()` et `setIsSuperAdminCookie: vi.fn()` dans le mock.

#### 4. api/depenses-recurrentes.test.ts — Date rollover fin de mois

Bug de date : `new Date()` le 29 mars + `setMonth(1)` → JavaScript fixe au 1 mars (fév 2026 n'a pas de jour 29). Résultat : `derniereGeneration === debutMois` → `estDue` retourne `false`. Correction : `setDate(15)` avant `setMonth()` pour eviter les rollovers de fin de mois.

#### 5. api/vagues.test.ts — Ancien contrat API addBacIds vs addBacs

Le test utilisait `addBacIds: ["bac-3"]` (ancienne API) alors que l'implementation actuelle attend `addBacs: [{ bacId, nombrePoissons }]`. Correction du corps de la requête et de l'assertion `toHaveBeenCalledWith`.

#### 6. en/analytics.json — 5 clés manquantes

Clés présentes en `fr` mais absentes en `en` (ajoutées par Sprint FD) :
- `aliments.aucuneDonneeMortalite`
- `aliments.changementGranule`
- `aliments.correlationMortalite`
- `aliments.fcrHebdoTitle`
- `aliments.mortaliteElevee`

Traductions anglaises ajoutées dans `src/messages/en/analytics.json`.

#### 7. en/releves.json — 10 clés manquantes

Clés `form.alimentation.comportementAlim.*` et `form.alimentation.tauxRefus.*` présentes en `fr` mais absentes en `en`. Traductions anglaises ajoutées dans `src/messages/en/releves.json`.

#### 8. ui/analytics-aliments.test.tsx — scoreQualite absent des fixtures

Le champ `scoreQualite: number | null` est obligatoire dans `AnalytiqueAliment` (ajouté par Sprint FD). Les fixtures de test ne l'incluaient pas, causant `undefined.toFixed(1)` dans `ScoreBadge`. Ajout de `scoreQualite: 7.5 / 5.2 / null` aux trois fixtures.

---

## Couverture Sprint NA

| Story | Changement | Couverture test |
|-------|-----------|----------------|
| NA.1 | FarmBottomNav — 5 groupes, 11 items | Tests ingenieur-nav.test.ts existants passent |
| NA.2 | IngenieurBottomNav — 4 groupes, 7 items | Tests ingenieur-nav.test.ts existants passent |
| NA.3 | IngenieurSidebar — Stock sub-items + Configuration | Tests route-boundaries passent |
| NA.4 | Déplacement /packs, /activations, /mes-taches → app root | route-boundaries.test.ts MIS A JOUR |
| NA.5 | FarmSidebar — suppression liens morts | Tests route-boundaries passent |
| NA.6 | Middleware — Guard E11 + SuperAdmin bypass + FARM_ONLY | proxy-redirect.test.ts MIS A JOUR |
| NA.7 | i18n — notificationsItem, portefeuilleItem, groups | i18n tests passent |
| NA.8 | Fix icônes — UserRound, Eye, PackageCheck | Build OK, pas de conflit |

---

## Build production

```
Compiled successfully in 15.4s
Generating static pages (138/138) — OK
```

Aucune erreur TypeScript. Aucun avertissement critique.

---

## Fichiers modifiés

### Tests
- `src/__tests__/route-boundaries.test.ts` — Mis à jour pour NA.4 (routes app-root)
- `src/__tests__/middleware/proxy-redirect.test.ts` — Mis à jour pour Guard E11 (NA.6)
- `src/__tests__/api/auth.test.ts` — Mock clearIsSuperAdminCookie ajouté
- `src/__tests__/api/depenses-recurrentes.test.ts` — Fix date rollover fin de mois
- `src/__tests__/api/vagues.test.ts` — Mise à jour addBacs API
- `src/__tests__/ui/analytics-aliments.test.tsx` — scoreQualite ajouté aux fixtures

### Messages i18n
- `src/messages/en/analytics.json` — 5 clés aliments ajoutées
- `src/messages/en/releves.json` — 10 clés form.alimentation ajoutées

---

## Conclusion

Sprint NA est validé. Tous les tests passent (3559/3559). Le build est propre. Les corrections effectuées alignent les tests sur les changements réels du sprint (routes déplacées, Guard E11, nouvelles i18n keys, nouveau champ scoreQualite).
