# Sprint AV — Avaries (mortalité + perte poids transport séparées)

**Statut** : ✅ SIGNÉ — APPROVED_WITH_FOLLOWUPS
**Lancé le** : 2026-07-15
**Clôturé le** : 2026-07-15

## Objectif

Corriger le bug racine dans `cloturerVente` qui convertissait automatiquement toute perte de poids en transport en morts fictifs, faussant le taux de survie. Séparer proprement les 2 dimensions (mortalité vs perte poids), avec saisie explicite par l'utilisateur.

## Stories

| Story | Sujet | Commit | Verdict |
|-------|-------|--------|---------|
| AV.6 | Migration prod : purge 17 MORTALITE fictifs (Vagues 26-01/02/Dibac) | `51fef8e` | ✅ Appliquée |
| AV.1+2+3 | Refonte `cloturerVente` — DTO enrichi, auto-conversion SUPPRIMÉE | `a3d3934` | APPROVED |
| AV.4 | Dialog livraison enrichi par ligne | `f147df8` | APPROVED |
| AV.5 | Rapports + indicateurs séparent avarie/élevage | `9f454b2` | APPROVED |
| AV.7 | Tests + fix R2/R6 + sprint close | (ce commit) | APPROVED_WITH_FOLLOWUPS |

## Validation prod (déjà appliquée via AV.6)

| Vague | Survie avant | Survie après | Gain |
|-------|-------------|--------------|------|
| Vague 26-01 | 85.42% | **90.33%** | +4.91 pts |
| Vague 26-02 | 80.49% | **81.44%** | +0.95 pt |
| Vague 26-02-Dibac | 71.64% | **74.00%** | +2.36 pts |

## Tests

- **6/6 verts** — `src/lib/queries/__tests__/cloture-vente-avarie.test.ts`
  1. Régression bug : perte poids sans morts → **AUCUN MORTALITE créé** ✓
  2. `nombreMortsTransport=5` → MORTALITE(5) + LigneVente/VENTE décrémentés + ReleveModification
  3. Cas mixte : morts + perte poids → 1 seul MORTALITE, pas de fictif
  4. Dépassement → ValidationError, aucune écriture
  5. Stock bac inchangé (AssignationBac non retouché à la clôture)
  6. Rétrocompat DTO legacy → 0 morts, aucun MORTALITE créé

## Fix nits appliqués (AV.7)

- **R2** : `src/lib/queries/ventes.ts:1191` — `"VENTE"` → `TypeReleve.VENTE`
- **R6** : `src/components/ventes/vente-detail-client.tsx` — `text-orange-600` → `text-warning` (variable CSS thème)

## Checklist R1-R9

| Règle | Statut |
|-------|--------|
| R1 enums MAJUSCULES | ✓ (`CauseMortalite.AVARIE`, `StatutVente.LIVREE`) |
| R2 imports enums | ✓ (fix appliqué AV.7) |
| R3 Prisma == TS | ✓ (`LigneVente.poidsLivreKg`, `IndicateursVague.mortalites*`) |
| R4 atomicité | ✓ (transaction unique + guard fin) |
| R5 DialogTrigger asChild | ✓ (dialog contrôlé) |
| R6 CSS vars du thème | ✓ (fix `text-warning` appliqué AV.7) |
| R7 nullabilité explicite | ✓ (`poidsLivreKg?`, `nombreMortsTransport?`, `motifAvarie?`) |
| R8 `siteId` partout | ✓ |
| R9 tests + build verts | ✓ 6/6 dédiés + build OK |

## Followups (non-bloquants)

| Priorité | Action |
|----------|--------|
| 🟡 Basse | `VENTE_LIST_INCLUDE` / `VENTE_DETAIL_INCLUDE` ne sélectionnent pas `LigneVente.poidsLivreKg` (agrégat seul exposé) — à ajouter si besoin d'afficher le détail par ligne |
| 🟡 Basse | Alerte perte transport > 5% (AV.6 hors scope initial) |
| 🟡 Basse | Multi-transporteur / suivi logistique — chantier séparé |

## Garde-fous Avarie actifs en prod

1. 🛡 **Zéro conversion kg → morts** — `cloturerVente` accepte uniquement des morts saisis explicitement
2. 🛡 Guard CS.3 compatible (stock bac inchangé à la clôture)
3. 🛡 Rapports séparent avarie transport / élevage sans doubler la métrique survie
4. 🛡 Audit `ReleveModification` sur chaque update VENTE (raison="Avarie transport livraison")
5. 🛡 Migration idempotente en place (relance sans risque)

## Fonctionnalité disponible en prod (après deploy Coolify)

Sur une vente `EN_PREPARATION`, action « Livrer la vente » ouvre un dialog par ligne avec :
- Poids livré (kg) — pré-rempli avec poids commandé
- Poissons morts en transport — saisi explicitement (défaut 0)
- Motif avarie — texte libre optionnel
- Total livré / morts affichés en temps réel

**Aucun mort fictif n'est plus créé** par le backend, quel que soit l'écart poids commandé / livré.
