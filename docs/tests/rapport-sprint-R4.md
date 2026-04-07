# Rapport de tests — Sprint R4 : Alertes geniteurs + Stats reproduction

**Date :** 2026-04-07
**Auteur :** @tester
**Sprint :** R4
**Statut :** PASSE

---

## Resume

| Fichier de test | Tests | Resultat |
|-----------------|-------|----------|
| `src/__tests__/lib/reproduction-alertes-geniteurs.test.ts` | 26 | PASSE |
| `src/__tests__/lib/reproduction-stats.test.ts` | 17 | PASSE |
| `src/__tests__/api/reproduction-stats.test.ts` | 12 | PASSE |
| **Total sprint R4** | **55** | **PASSE** |
| Suite complete (regression) | 4816 | PASSE |

---

## Fichiers crees

### 1. `src/__tests__/lib/reproduction-alertes-geniteurs.test.ts`

Teste les 3 nouvelles fonctions d'alerte geniteurs ajoutees dans
`src/lib/alertes/reproduction.ts`.

#### `checkMalesStockBasAlerts`
- Cree une notification quand `nombreMalesDisponibles <= seuilAlerteMales`
- Utilise le seuil par defaut de 2 quand `seuilAlerteMales` est null
- Ne cree pas de notification quand `nombreMalesDisponibles > seuil`
- Deduplication : pas de doublon si notification ACTIVE existe deja
- Deduplication selective : seulement les membres sans doublon recoivent une notif
- Notifie tous les membres du site
- Inclut le lien `/reproduction/geniteurs/[id]` dans la notification
- Retourne sans effet si aucun lot geniteur n'est en alerte

#### `checkFemelleSurexploiteeAlerts`
- Cree une notification quand `dernierePonte` remonte a moins de 42 jours
- Ne cree pas de notification quand `dernierePonte >= 42 jours` (filtree par Prisma)
- Ne cree pas d'alerte pour les reproductrices non ACTIF (filtree par Prisma)
- Verifie que le filtre Prisma inclut `sexe = FEMELLE` et `statut = ACTIF`
- Deduplication par femelle par jour
- Inclut le nombre de jours depuis la derniere ponte dans le message
- Gere plusieurs femelles surexploitees en meme temps

#### `checkConsanguiniteRisqueAlerts`
- Cree une notification quand le meme couple (femelleId, maleId) est utilise > 3 fois
- Ne cree pas quand le couple est utilise <= 3 fois (exactement 3 : pas d'alerte)
- Deduplication par cle couple dans le champ `lien`
- Ignore les pontes avec `maleId = null`
- Gere plusieurs couples avec des comptages differents (seulement les risques)
- Inclut le nombre d'utilisations dans le message
- Notifie tous les membres du site

### 2. `src/__tests__/lib/reproduction-stats.test.ts`

Teste `src/lib/queries/reproduction-stats.ts`.

#### `getReproductionStats`
- Retourne tous zeros quand aucune donnee
- `tauxFecondation = pontesReussies / totalPontes * 100`
- `tauxEclosion` calcule depuis les incubations (nombreLarvesViables / nombreOeufsPlaces)
- Repli sur les oeufs des pontes si les incubations n'ont pas `nombreOeufsPlaces`
- `tauxSurvieGlobal = tauxFecondation * tauxEclosion * tauxSurvieLarvaire / 10000`
- Filtre dateDebut/dateFin passe a la requete Prisma via `datePonte`
- Pas de filtre date si aucun parametre
- Tous les taux plafonnent a 100%
- `totalAlevinsActuels` est la somme de tous les lots EN_ELEVAGE + TRANSFERE

#### `getReproductionFunnel`
- Retourne exactement 3 etapes : Oeufs, Larves viables, Alevins actifs
- Premiere etape = 100% toujours
- Chaque etape contient le bon `count`
- Pourcentages calcules par rapport a l'etape precedente
- Retourne 0% pour les etapes sans donnees
- Propage les filtres de date a `getReproductionStats`
- Plafonne les pourcentages a 100%

### 3. `src/__tests__/api/reproduction-stats.test.ts`

Teste `GET /api/reproduction/stats`.

- GET sans parametre retourne `stats`, `funnel`, `periode` (avec dates null)
- Accepte des dates ISO valides et les passe aux fonctions de calcul
- Inclut les dates de periode dans la reponse
- 400 si `dateDebut` est invalide
- 400 si `dateFin` est invalide
- 400 si `dateDebut > dateFin`
- 401 si l'utilisateur n'est pas authentifie (AuthError)
- 403 si permissions insuffisantes (ForbiddenError, permission ALEVINS_VOIR)
- Passe le `siteId` de l'auth context aux fonctions de stats
- 500 en cas d'erreur serveur inattendue
- Verifie que `requirePermission` est appele avec `Permission.ALEVINS_VOIR`
- Les deux fonctions stats et funnel sont appelees

---

## Fichiers sources modifies

### `src/lib/alertes/reproduction.ts`
Ajout de 3 nouvelles fonctions d'alerte et mise a jour de `verifierAlertesReproduction` :

- `checkMalesStockBasAlerts(siteId)` — alerte MALES_STOCK_BAS
- `checkFemelleSurexploiteeAlerts(siteId)` — alerte FEMELLE_SUREXPLOITEE
- `checkConsanguiniteRisqueAlerts(siteId)` — alerte CONSANGUINITE_RISQUE
- `verifierAlertesReproduction` maintenant appelle les 5 fonctions

---

## Verification de non-regression

```
Test Files : 147 passed (147)
Tests      : 4816 passed | 26 todo (4842)
Duration   : 21.48s
```

Aucune regression introduite.

---

## Cas limites valides

| Cas | Couverture |
|-----|------------|
| Division par zero (taux avec 0 pontes) | `getReproductionStats` : retourne 0 |
| maleId null dans ponte (consanguinite) | Ignore sans erreur |
| seuilAlerteMales null | Utilise defaut = 2 |
| Couple utilise exactement 3 fois | Pas d'alerte (seuil strict > 3) |
| Plus de larves que d'oeufs (donnees incorrectes) | Plafonne a 100% |
| Aucune donnee en base | Retourne zeros proprement |
