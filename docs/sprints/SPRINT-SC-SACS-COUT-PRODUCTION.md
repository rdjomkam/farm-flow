# Sprint SC — Nombre de sacs dans le coût de production

**Statut** : ✅ CLÔTURÉ — APPROVED_WITH_NITS
**Lancé le** : 2026-07-16
**Clôturé le** : 2026-07-16
**Review** : [review-sprint-SC.md](../reviews/review-sprint-SC.md)

## Objectif

Dans la section « Coût de production » de la page détails d'une vague, afficher le nombre de sacs consommés à côté des kg d'aliment, en utilisant la conversion `Produit.contenance` (kg par sac).

## Données validées en prod

- Tous les produits `categorie=ALIMENT` ont `unite=KG`, `uniteAchat=SACS`, `contenance` renseignée (5 à 25 kg/sac selon l'aliment ; ex. Skretting = 15, DIBAC = 18).
- Formule : `nombreSacs = kgConsommes / contenance` quand `uniteAchat === SACS && contenance > 0`, sinon `null` (fallback : afficher seulement les kg).

## Décisions UX

- Affichage : `{kg} kg (≈ {n} sacs)` avec 1 décimale (ex. `≈ 12.4 sacs`), tooltip ou libellé indiquant la contenance (`sacs de 15 kg`).
- Produit sans contenance → comportement actuel inchangé (kg seuls).
- Répliquer dans le rapport PDF coût de production.

## Stories

| Story | Type | Sujet | Agent |
|-------|------|-------|-------|
| SC.1 | QUERIES | `getCoutProductionVague` : enrichir les lignes aliment avec `contenanceSac` + `nombreSacs` | @developer |
| SC.2 | UI | `cout-production-card.tsx` : afficher `≈ n sacs` à côté des kg | @developer |
| SC.3 | UI PDF | Rapport PDF coût production : même affichage | @developer |
| SC.4 | TEST + REVIEW | Tests unitaires query + review R1-R9 | @tester + @code-reviewer |

## Validation

- [ ] Tests unitaires `getCoutProductionVague` (avec/sans contenance)
- [ ] `npx vitest run` — pas de nouvelle régression
- [ ] `npm run build` OK
- [ ] Review R1-R9
