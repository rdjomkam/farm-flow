# Review Sprint SC — Nombre de sacs dans le coût de production

**Verdict : APPROVED_WITH_NITS**

## Fichiers revus

- `src/lib/queries/finances.ts` (L.779-786, 1358-1404)
- `src/components/vagues/cout-production-card.tsx` (L.240-249)
- `src/lib/export/pdf-cout-production.tsx` (L.621-624)
- `src/messages/fr/vagues.json` / `en/vagues.json` (clé `sections.detailAlimentationSacs`)
- Tests : `finances-cout-production.test.ts`, `cout-production-card.test.tsx`, `pdf-cout-production.test.ts`

## Correctness — OK

- Formule `nombreSacs = quantite / contenanceSac`, arrondi 1 décimale.
- Division par zéro impossible (garde `contenanceSac && contenanceSac > 0`).
- Fallback `null` géré UI + PDF.
- Comparaison `data.uniteAchat === UniteStock.SACS` sûre (valeurs enum DB UPPERCASE).
- Contenance prise sur première occurrence — comportement identique au pré-existant pour `prixUnitaire`, pas une régression.

## R1-R9

- R2 : `UniteStock.SACS` importé, pas de littéral ✓
- R3 : `CreateCoutProductionPDFDTO` référence `CoutProductionVague` → propagation automatique des champs ✓
- R6 : classes Tailwind thème, pas de couleur en dur ✓
- R7 : nullabilité explicite `number | null` ✓
- R9 : 75/75 tests verts, build OK ✓

## Nits (non bloquants — polissage optionnel)

1. `alimentsMap` type `uniteAchat: string | null` au lieu de `UniteStock | null` (fonctionnellement sûr)
2. Pluriel : "1.0 sacs" pour un sac unique
3. PDF affiche `(≈ X.X sacs)` sans la contenance, UI l'affiche
4. Quantité PDF sans séparateur de milliers (pré-existant)

## i18n / Mobile-first

- Clés FR + EN présentes, interpolation cohérente ✓
- Span dans le flex-wrap existant, pas de casse 360px ✓

Aucun finding Critique ou Haute sévérité.
