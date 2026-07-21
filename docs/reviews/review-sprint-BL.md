# Review Sprint BL — Bon de livraison signé

**Verdict : APPROVED_WITH_NITS** (fix R2 requis appliqué avant clôture)

## Findings

### Haute (corrigé avant clôture)
- **R2** `src/components/ventes/vente-detail-client.tsx:244` — littéral `"SIGNE"` au lieu de `StatutBonLivraison.SIGNE`. Corrigé : import + comparaison enum, 10/10 tests composants verts.

### Moyenne (non bloquants, hors scope BL)
- `generateNextNumero` (pattern partagé Facture/Commande/Vente/BL) : deux transactions concurrentes pourraient calculer le même numero en Read Committed ; la contrainte `@unique` transforme la collision en erreur 500 plutôt qu'un conflit propre. Pattern préexistant, à surveiller si le volume augmente.
- `image-upload-field.tsx:139` : id HTML dérivé du label traduit (fragile si un `<label htmlFor>` est ajouté un jour).

### Critique / Basse
Aucune.

## R1-R9

| Règle | Statut |
|---|---|
| R1 enums MAJUSCULES | ✓ `StatutBonLivraison` |
| R2 enums importés | ✓ (après fix) |
| R3 Prisma=TS=Zod | ✓ — `base64ImageSchema` 500KB sur les 4 champs image |
| R4 atomicité | ✓ `signerBonLivraison` via `updateMany` conditionnel dans transaction |
| R5 DialogTrigger asChild | ✓ |
| R6 CSS vars | ✓ UI ; hex dans PDF = pattern react-pdf existant (exception justifiée) |
| R7 nullabilité | ✓ |
| R8 siteId partout | ✓ toutes queries/routes |
| R9 tests avant review | ✓ 6 fichiers de tests dédiés |

## Axes sécurité validés

1. **Multi-tenant** : conforme partout (queries, routes, PDF, assets site)
2. **Guard LIVREE incontournable** : `cloturerVente` = unique écrivain de `StatutVente.LIVREE` (grep confirmé), guard dans la transaction, rétrocompat ventes historiques OK
3. **Signature immuable** : re-signature bloquée (`statut: { not: SIGNE }`), aucune route DELETE
4. **Permissions** : VENTES_MODIFIER (créer/signer), VENTES_VOIR (lire), +EXPORT_DONNEES (PDF)
5. **Payloads** : max 500KB Zod sur toutes les entrées base64, testé

## Correctness validée

- Numérotation BL-YYYY-NNN atomique ; bloc paiement `max(0, total - payé)` jamais négatif, avec/sans facture ; createBonLivraison idempotent ; PDF gère tous les null (rétrocompat) ; partage AbortError silencieux + fallback download/wa.me.

## Cohérence inter-stories

- `getBonLivraisonByVente` ↔ `BonLivraisonDetailResponse` harmonisés (écart BL.3 résolu en BL.4)
- Bouton PDF du flow → route export BL.5 ✓
