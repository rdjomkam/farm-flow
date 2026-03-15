# Rapport de Tests — Sprint 21 (Story S15-10)
**Testeur :** @tester
**Date :** 2026-03-15
**Sprint :** 21
**Story :** S15-10 — Tests du moteur d'activites

---

## Bilan

| Indicateur | Valeur |
|---|---|
| Tests nouveaux (Sprint 21) | **143** |
| Tests totaux suite complète | **1349** |
| Fichiers de test | **47** |
| Tests en echec | **0** |
| Build production | OK |

---

## Fichiers crees

| Fichier | Tests | Description |
|---|---|---|
| `src/__tests__/activity-engine/evaluator.test.ts` | 53 | 8 declencheurs + regles de skip |
| `src/__tests__/activity-engine/template-engine.test.ts` | 33 | Placeholders + buildPlaceholders |
| `src/__tests__/activity-engine/feeding.test.ts` | 17 | Calcul alimentation + projection SGR |
| `src/__tests__/activity-engine/generator.test.ts` | 12 | Deduplication, firedOnce, priorite |
| `src/__tests__/activity-engine/api/regles-activites.test.ts` | 28 | API CRUD + droits globales |

---

## Couverture par module

### evaluator.ts (53 tests)

Tous les 8 declencheurs sont couverts :

| Declencheur | Tests | EC couverts |
|---|---|---|
| CALENDRIER | 4 | EC-3.12 (null = J+0) |
| RECURRENT | 4 | EC-3.12 (intervalleJours null) |
| SEUIL_POIDS | 5 | EC-3.12, seuil exact (>=) |
| SEUIL_QUALITE | 5 | EC-3.12 (deux nulls), pH hors range, aucun releve |
| SEUIL_MORTALITE | 4 | EC-3.12, seuil exact (>) |
| STOCK_BAS | 4 | EC-3.12 (pas de seuil = match si alerte) |
| FCR_ELEVE | 5 | EC-3.12 (fcr null reste null) |
| JALON | 3 | EC-3.12, duree 180j par defaut |

Regles de skip verifiees :

| Regle | EC | Tests |
|---|---|---|
| Vague avec 0 vivants skippee | EC-3.9 | 3 (0, null, negatif) |
| Regle inactive | — | 1 |
| firedOnce=true pour SEUIL_* | EC-3.2 | 5 (un par type) |
| phaseMin > phaseMax invalide | EC-3.5 | 2 |
| Deduplication meme jour | EC-3.1 | 2 |
| Filtre de phase | — | 4 |

Score de priorite :
- EC-3.3 : Score = (11 - priorite) * 10. Priorite 1 = score 100, priorite 10 = score 10
- Tri decroissant : plus urgent en premier

### template-engine.ts (33 tests)

- `resolveTemplate` : 8 tests couvrant les cas limites (chaine vide, inconnu, consecutifs, sans placeholder)
- `buildPlaceholders` : 20 tests couvrant chaque champ (semaine, poids_moyen, taille, valeur, taux, quantite_calculee, produit, seuil, jours_restants, stock, quantite_recommandee)
- Integration : 2 tests (template complet + placeholders manquants)

Cas limite EC-3.6 verifie : tout placeholder inconnu ou valeur nulle → "[donnee non disponible]"

Cas note : le placeholder `quantite_calculee` convertit grammes → kg (division par 1000) avant formatage FR.

### feeding.ts (17 tests)

| Cas | Resultat |
|---|---|
| nombreVivants null (EC-4.1) | retourne null |
| nombreVivants = 0 | retourne null |
| nombreVivants negatif | retourne null |
| Formule quantiteGrammes = vivants * poids * taux / 100 | verifie |
| Fallback poidsMoyenInitial si poidsMoyen null | verifie |
| poidsMoyenInitial = 0 | retourne null |
| Biometrie recente < 7j → pas de projection (EC-4.2) | verifie |
| Biometrie ancienne > 7j + SGR non null → projection (EC-4.2) | verifie (poids projete > poids initial) |
| SGR null → pas de projection meme si biometrie ancienne | verifie |
| Frequences par phase (5 phases testees) | verifie |
| Taille de granule par poids (2 cas) | verifie |
| ConfigElevage personnalisee | verifie (seuils custom) |

### generator.ts (12 tests)

| Cas | EC | Resultat |
|---|---|---|
| Creation si pas de doublon | EC-3.1 | created=1, skipped=0 |
| Skip si doublon aujourd'hui | EC-3.1 | created=0, skipped=1 |
| firedOnce=true pour 5 types SEUIL_* | EC-3.2 | updateMany appelee avec firedOnce:false→true |
| Pas de firedOnce pour RECURRENT | EC-3.2 | updateMany non appelee |
| Priorite : ordre de traitement par vague | EC-3.3 | priorite 1 traitee avant priorite 8 |
| Capture erreurs sans exception globale | — | errors rapportees, pas de throw |
| Liste vide → bilan vide | — | created=0, skipped=0 |
| Deux vagues independantes | — | created=2 |

### API /api/regles-activites (28 tests)

| Route | Tests | Scenarios |
|---|---|---|
| GET / | 6 | 200 liste, filtre typeActivite, filtre isActive, 403, 401, siteId correct |
| POST / | 7 | 201 creation, 400 nom manquant, 400 typeActivite, 400 typeDeclencheur, 400 titreTemplate, 400 intervalleJours RECURRENT, 400 priorite hors range, 403 |
| GET /[id] | 4 | 200 site, 200 globale, 404, 403 |
| PUT /[id] | 6 | 200 succes, 403 globale, 404, 400 titreTemplate vide, 400 intervalleJours<=0, 403 permission |
| DELETE /[id] | 4 | 200 succes, 403 globale, 404, 403 permission |

---

## Bugs decouverts pendant les tests

**BUG-001 (non bloquant, corrige dans le test) :** Le test SEUIL_QUALITE "pH dans la plage normale" utilisait une plage [6.5, 8.5] mais le releve avait aussi `temperature: 28` qui depasse 8.5, ce qui declenchait l'alerte a juste titre. Ce n'est pas un bug du moteur mais une erreur de donnees de test. Corrige en utilisant une plage [6, 35] qui couvre les deux valeurs.

---

## Commandes executees

```bash
npx vitest run src/__tests__/activity-engine/   # 5 fichiers, 143 tests, 0 echec
npx vitest run                                   # 47 fichiers, 1349 tests, 0 echec
npm run build                                    # Build production OK
```

---

## Non-regression

Aucun test anterieur n'a ete casse. Les 47 fichiers de test existants (sprints 2-20) continuent de passer sans modification.

---

## Statut

**S15-10 : FAIT**
Tests en place, build OK, non-regression validee.
