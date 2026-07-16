# Sprint SC2 — Poids du sac configurable dans le profil de production

**Statut** : ✅ CLÔTURÉ — APPROVED (après fix C1 Zod)
**Lancé le** : 2026-07-16
**Clôturé le** : 2026-07-17
**Review** : [review-sprint-SC2.md](../reviews/review-sprint-SC2.md)
**Follow-up de** : Sprint SC (sacs dans coût de production)

## Objectif

Permettre de configurer le nombre de kg par sac dans un profil de production (`ConfigElevage`). Ce paramètre est utilisé **prioritairement** pour le calcul du nombre de sacs dans le coût de production d'une vague ; si absent (null), fallback sur `Produit.contenance` (comportement actuel du Sprint SC).

## Règle de priorité

```
poidsSac = vague.configElevage?.poidsSacKg  // priorité 1 (profil)
        ?? produit.contenance               // priorité 2 (produit, si uniteAchat=SACS)
        ?? null                             // pas de calcul de sacs
```

Note : quand le poids vient du profil, il s'applique à TOUS les aliments de la vague (pas de condition `uniteAchat === SACS` — le profil est une décision explicite de l'éleveur).

## Stories

| Story | Type | Sujet | Agent |
|-------|------|-------|-------|
| SC2.1 | SCHEMA | `ConfigElevage.poidsSacKg Float?` + migration + types TS miroirs | @db-specialist |
| SC2.2 | QUERIES | `getCoutProductionVague` : charger configElevage.poidsSacKg de la vague, appliquer la priorité | @developer |
| SC2.3 | UI | Formulaire profil d'élevage : champ « Poids d'un sac (kg) » optionnel | @developer |
| SC2.4 | TEST + REVIEW | Tests priorité profil > produit + review | @tester + @code-reviewer |

## Validation

- [ ] Migration sans erreur (dev + prod-ready)
- [ ] Tests : profil renseigné → priorité profil ; profil null → fallback produit ; les deux null → pas de sacs
- [ ] `npx vitest run` sans nouvelle régression
- [ ] `npm run build` OK
- [ ] R1-R9
