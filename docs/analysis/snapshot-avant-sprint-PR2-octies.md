# Snapshot AVANT — Sprint PR2-octies (2026-08-04)

Scénario cible : `EXCEL-V12` (id `cmsdnypml0000n4ekuadykn0f`), statut `BROUILLON`.
Connexion : PostgreSQL 16 Docker (`silures-db`), lue via `docker exec` — aucune URL/mot de passe reproduit ici (R11).

## VaguePrevue

```
 count |  sum
-------+--------
    19 | 602500
```
Conforme aux attendus (19 lignes, SUM(effectifAlevinsPrevu) = 602 500).

## ApportCapital

```
 count
-------
     3
```
Conforme à l'attendu (3 lignes).

## AlimentPrevision (3 calibres) + articles liés + répartitions

```
            id             | tailleGranule | nb_articles |    articles     | nb_repart
---------------------------+---------------+-------------+-----------------+-----------
 cmsdohxam000an4ek4uvjicxb | G1            |           1 | Marque A — 2 mm |         3
 cmsdombck000fn4ekyzhd68hs | G2            |           1 | Marque A — 3 mm |         3
 cmsdop5q4000kn4eknxds3fwf | G3            |           1 | Marque B — 4 mm |         3
```

## ParametresPrevision — ligne entière (SELECT *)

```
-[ RECORD 1 ]-----------------+-------------------------------------
id                            | cmsdnypmr0001n4ekirvc1r9s
scenarioId                    | cmsdnypml0000n4ekuadykn0f
effectifAlevinsParVague       | 10000
margeSecuriteAlevinsPct       | 10.000000000000000000000000000000
poidsMoyenInitialG            | 5.000000000000000000000000000000
poidsObjectifG                | 400.000000000000000000000000000000
prixAlevinUnitaireFCFA        | 0.000000000000000000000000000000
prixVenteKgFCFA               | 1900.000000000000000000000000000000
nombreBacsSimultanesCible     | 4
frequenceStockageMois         | 1.000000000000000000000000000000
createdAt                     | 2026-08-03 20:10:26.499
updatedAt                     | 2026-08-04 06:03:17.707
capaciteTransportAlevinsNb    | 20000
capaciteTransportAlimentsSacs | 60
capaciteTransportPoissonsKg   | 1500
coutTransportAlevinsFCFA      | 30000.000000000000000000000000000000
coutTransportAlimentsFCFA     | 15000.000000000000000000000000000000
coutTransportPoissonsFCFA     | 25000.000000000000000000000000000000
tauxEpargnePct                | 30.000000000000000000000000000000
```

**⚠️ CONSTAT CRITIQUE** : `prixAlevinUnitaireFCFA` vaut **0** en base, pas 70 comme l'énonce le
briefing de tâche. Le contournement décrit dans le briefing (« mettre le prix à 0 pour ne pas
facturer les alevins ») a **déjà été appliqué en base sur le scénario EXCEL-V12** — l'information
réelle de prix (70 FCFA/alevin, valeur du jeu d'or `Paramètres!B22` d'après `entreesModele` des
fixtures) est **déjà effacée** sur cette ligne au moment de ce snapshot. Ce n'est donc pas une
donnée hypothétique à anticiper : c'est l'état constaté, à corriger par la story SCHEMA (restaurer
70, gouverné par le nouveau drapeau plutôt que par un prix à 0).

## ScenarioPrevision.updatedAt

```
        updatedAt
-------------------------
 2026-08-03 20:10:26.493
```
