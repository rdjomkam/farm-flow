# GD.3 Data-Fix Report — Vague-26-03-Prep transferts traçabilité

**Date d'exécution** : 2026-07-15 10:49:19
**Backup** : `/tmp/backup-avant-GD3-20260715-104919.sql` (1.6 MB)
**Rollback** : `docker exec -i silures-db psql "$DB_URL" < /tmp/backup-avant-GD3-20260715-104919.sql`

## Résultat

✅ **Fix appliqué avec succès** — vérification replay intra-transaction : TOUS LES BACS OK.

## État avant / après

| Bac | init | actuel avant | actuel après | dateFin |
|-----|------|-------------|-------------|---------|
| Bac 08 | 500 | 263 | **0** | 2026-06-15 |
| Bac 11 (init assignation) | 5000 | 5000 | 5000 | 2026-05-28 |
| Bac 11 (assignation active) | 2000 | 936 | **936** (inchangé) | ACTIVE |
| Bac 12 | 449 | 712 | **0** | 2026-07-12 |

## Nouveaux TransfertGroupes

| ID | Source | Dest | Poissons | Poids moyen |
|----|--------|------|----------|-------------|
| `gd3_tg_bac08_bac12` | Bac 08 | Bac 12 | 263 | 42 g |
| `gd3_tg_bac12_bac11` | Bac 12 | Bac 11 | 712 | 20 g |

Nouveaux relevés TRANSFERT :
- `gd3_releve_sortant_bac08` (Bac 08, 263 sortants, TG Bac 08→12)
- `gd3_releve_entrant_bac12` (Bac 12, 263 entrants, TG Bac 08→12)
- `gd3_releve_sortant_bac12` (Bac 12, 712 sortants, TG Bac 12→11)
- `gd3_releve_entrant_bac11` (Bac 11, 712 entrants, TG Bac 12→11)

## Anti-pattern COMPTAGES supprimés

- `cmqf2d6a6005601rr4lop685g` (Bac 08 COMPTAGE=0 « Transfert lors du retrait »)
- `cmqf2d6ah005701rrozze4x36` (Bac 12 COMPTAGE=712 « Transfert depuis Bac 08 »)
- `cmrlr6jgb000301nbu1hizbat` (Bac 11 COMPTAGE=936)

## Vérification replay intra-transaction

Formule utilisée pour chaque bac :
```
expected = nombrePoissonsInitial
         - Σ(MORTALITE.nombreMorts)
         - Σ(VENTE.nombreVendus)
         - Σ(TRANSFERT.nombreTransferes) where TG.bacSourceId = ab.bacId
         + Σ(TRANSFERT.nombreTransferes) where TG.bacDestId = ab.bacId
         + Σ(ARRIVAGE.nombreCompte)
```

Résultat prod :
- Bac 12 (active-filtered) : `actuel=0 expected=0` ✓
- Bac 11 (active) : `actuel=936 expected=936` ✓

Bac 08 non replayé par le check filtré (dateAssignation < 2026-06-01) mais math manuelle : `500 - 37 morts - 200 (10/06) - 263 (15/06) = 0` ✓

## Post-conditions

- Guard `verifyAssignationInvariant` corrigé (GD.1) peut désormais valider correctement toute nouvelle opération sur Vague-26-03-Prep, y compris une vente antidatée sur Bac 11.
- Traçabilité complète : les 2 déplacements Bac 08 → Bac 12 → Bac 11 sont désormais des TransfertGroupes documentés au lieu de comptages opaques.
