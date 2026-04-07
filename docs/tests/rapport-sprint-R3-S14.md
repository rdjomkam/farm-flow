# Rapport de tests — Sprint R3-S14 : Incubation, Calculs Reproduction, Eclosion

**Date :** 2026-04-07
**Agent :** @tester
**Sprint :** R3-S14
**Statut :** PASSE (73/73)

---

## Fichiers de test crees

| Fichier | Tests | Statut |
|---------|-------|--------|
| `src/__tests__/lib/reproduction-calculs.test.ts` | 47 | PASSE |
| `src/__tests__/lib/reproduction-alertes.test.ts` | 26 | PASSE |

---

## reproduction-calculs.test.ts — 47 tests

Fichier source : `src/lib/reproduction/calculs.ts`

### getLatenceTheoriqueH (19 tests)

Table de reference : 20°C→24h, 22°C→20h, 25°C→14h, 27°C→12h, 30°C→10h

| Cas | Temperature | Resultat attendu | Resultat obtenu |
|-----|-------------|------------------|-----------------|
| Point exact table | 20°C | 24h | 24h |
| Point exact table | 22°C | 20h | 20h |
| Point exact table | 25°C | 14h | 14h |
| Point exact table | 27°C | 12h | 12h |
| Point exact table | 30°C | 10h | 10h |
| Clamp minimum | 15°C | 24h | 24h |
| Clamp minimum | 0°C | 24h | 24h |
| Clamp minimum | 19.9°C | 24h | 24h |
| Clamp maximum | 35°C | 10h | 10h |
| Clamp maximum | 40°C | 10h | 10h |
| Clamp maximum | 30.1°C | 10h | 10h |
| Interpolation 20-22 | 21°C | 22h | 22h |
| Interpolation 22-25 | 23°C | 18h | 18h |
| Interpolation 22-25 | 24°C | 16h | 16h |
| Interpolation 25-27 | 26°C | 13h | 13h |
| Interpolation 27-30 | 28°C | 11h | 11h |
| Interpolation 27-30 | 29°C | 11h | 11h |
| Retour entier | toutes valeurs | integer | integer |

### estimerNombreOeufs (9 tests)

Facteur : 750 oeufs/gramme

| Cas | Entree | Attendu | Obtenu |
|-----|--------|---------|--------|
| Normal | 100g | 75 000 | 75 000 |
| Normal | 50g | 37 500 | 37 500 |
| Normal | 200g | 150 000 | 150 000 |
| Normal | 10g | 7 500 | 7 500 |
| Cas limite | 0g | 0 | 0 |
| Decimal | 1.5g | 1 125 | 1 125 |
| Decimal | 0.5g | 375 | 375 |
| Decimal | 1.3g | 975 | 975 |
| Arrondi | 1.001g | 751 | 751 |
| Grand | 500g | 375 000 | 375 000 |

### getDureeIncubationH (19 tests)

Table de reference : 20°C→40h, 22°C→36h, 25°C→30h, 27°C→25h, 30°C→22h

Memes categories de tests que getLatenceTheoriqueH (points exacts, clamping, interpolation, integrite du type).

Test supplementaire de coherence biologique : duree d'incubation > latence theorique pour chaque temperature de reference (verifie que les deux tables sont coherentes entre elles).

---

## reproduction-alertes.test.ts — 26 tests

Fichier source : `src/lib/alertes/reproduction.ts`
Strategie : mock integral de Prisma via `vi.mock("@/lib/db")`

### checkIncubationEclosionAlerts (11 tests)

| Cas teste |
|-----------|
| Cree une notification par membre quand eclosion dans < 2h |
| typeAlerte = INCUBATION_ECLOSION, statut = ACTIVE |
| Code de l'incubation present dans le titre |
| Code de la ponte present dans le message (quand presente) |
| Lien correct vers /reproduction/incubations/[id] |
| Pas de notification quand aucune incubation proche |
| Deduplication : pas de doublon si notification existe deja aujourd'hui |
| Deduplication selective : seuls les membres sans doublon recoivent la notification |
| Plusieurs incubations simultanees : une notification par incubation par membre |
| Temps en heures quand >= 1h restante (format "dans Xh") |
| Temps en minutes quand < 30 min restantes (format "dans X min") |

Note sur le format temps : la logique source utilise `Math.round(ms / 3 600 000)` pour les heures. A exactement 30 min, `Math.round(0.5) = 1`, donc le seuil "minutes" n'est atteint qu'en dessous de ~30 min. Le test utilise 20 min pour garantir `heuresRestantes = 0`.

### checkLotSurvieAlerts (15 tests)

| Cas teste |
|-----------|
| Notification quand taux < seuil configure (seuilPourcentage) |
| typeAlerte = TAUX_SURVIE_CRITIQUE_LOT, statut = ACTIVE, userId = celui de la config |
| Code du lot present dans le titre |
| Taux de survie formate a 1 decimale (ex: "60.0%") |
| Detail nombreActuel/nombreInitial present dans le message (ex: "1200/2000") |
| Lien correct vers /reproduction/lots/[id] |
| Pas de notification si taux >= seuil |
| Pas de notification si taux exactement au seuil (condition stricte <) |
| Utilise seuilValeur quand seuilPourcentage est null |
| Deduplication : pas de doublon si notification existe deja aujourd'hui |
| Seuil par defaut 70% quand aucune config n'existe |
| Notifie tous les membres du site quand aucune config |
| Pas de notification sans config si taux >= 70% |
| Pas de notification si aucun lot en elevage |
| Plusieurs lots : seulement ceux sous le seuil declenchent une notification |

---

## Commande d'execution

```bash
npx vitest run src/__tests__/lib/reproduction-calculs.test.ts src/__tests__/lib/reproduction-alertes.test.ts
```

Resultat :
```
Test Files  2 passed (2)
      Tests  73 passed (73)
   Duration  440ms
```

---

## Observations

1. **Interpolation lineaire verifiee** : les formules de getLatenceTheoriqueH et getDureeIncubationH produisent des resultats correctement arrondis a l'entier le plus proche.

2. **Coherence biologique** : un test transversal verifie que la duree d'incubation est toujours superieure a la latence theorique pour les 5 temperatures de la table, confirmant la coherence entre les deux fonctions.

3. **Clamping robuste** : les valeurs extremes (0°C, 50°C) sont correctement bloquees aux bornes de la table.

4. **Deduplication Prisma** : les deux fonctions d'alerte respectent la deduplication par (siteId, userId, typeAlerte, lien) dans la fenetre journaliere.

5. **Comportement du seuil** : la condition de declenchement est strictement inferieure (`<`), ce qui signifie qu'un lot a exactement 70% de survie ne declenche pas d'alerte.
