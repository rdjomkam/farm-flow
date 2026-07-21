# Sprint BL — Bon de livraison signé

**Statut** : ✅ CLÔTURÉ — APPROVED_WITH_NITS (fix R2 appliqué)
**Lancé le** : 2026-07-17
**Clôturé le** : 2026-07-21
**Review** : [review-sprint-BL.md](../reviews/review-sprint-BL.md)

## Objectif

Chaque livraison génère un bon de livraison (BL) signé sur place : le livreur ouvre la vente sur son téléphone, crée le BL, le montre au client, le client **et** le livreur signent sur l'écran, le PDF est généré avec la signature du promoteur + le cachet (uploadés dans les réglages), et peut être partagé par WhatsApp. Le BL signé est **obligatoire** pour passer une vente en LIVREE.

## Décisions validées (utilisateur)

1. **1:1** : un BL par vente (comme Facture).
2. **Signatures** : client + livreur (capturées sur le téléphone) + promoteur (image fixe) + cachet.
3. **Guard** : bloque le passage EN_PREPARATION → LIVREE uniquement. CLOTUREE non concerné (déjà garanti par LIVREE). Rétrocompat : ventes déjà LIVREE sans BL restent valides.
4. **Bloc paiement** sur le BL : Total vente / Payé à ce jour / **Reste à payer** (source : Facture.montantPaye + Paiements si facture liée, sinon total vente, payé=0).

## Flux

```
Vente EN_PREPARATION
 → « Livrer la vente » (dialog AV : poids livrés, morts transport)
 → Écran BL récap (numéro BL-2026-XXX, lignes livrées, montants, reste à payer)
 → Signature CLIENT (canvas tactile, nom signataire)
 → Signature LIVREUR (canvas tactile)
 → Validation → BL SIGNE + vente LIVREE + PDF généré
 → Partage WhatsApp (navigator.share PDF, fallback wa.me + téléchargement)
```

## Modèle de données

**BonLivraison** : id, numero (unique BL-YYYY-NNN), venteId (unique 1:1), statut (`BROUILLON | EN_ATTENTE_SIGNATURE | SIGNE`), signatureClient (base64), signataireClientNom, signatureLivreur (base64), signeLe, userId (livreur), siteId (R8), createdAt/updatedAt.

**Site** : + `signaturePromoteur String?` (base64), + `cachet String?` (base64).

## Stories

| Story | Type | Sujet | Agent |
|-------|------|-------|-------|
| BL.1 | SCHEMA | BonLivraison + enum StatutBonLivraison + champs Site + migration + types TS + DTOs | @db-specialist |
| BL.2 | UI | Réglages site : upload signature promoteur + cachet (préview, remplacement, suppression) | @developer |
| BL.3 | QUERIES+API | createBonLivraison, signerBonLivraison, numérotation, guard livraison ⇒ BL signé (rétrocompat) | @developer |
| BL.4 | UI | Flux mobile : récap BL + composant signature tactile (canvas) + intégration dialog livraison | @developer |
| BL.5 | UI | PDF BL (@react-pdf pattern pdf-facture) : lignes livrées + écarts + bloc paiement + 3 signatures + cachet ; route export authentifiée | @developer |
| BL.6 | UI | Partage : navigator.share(PDF) + fallback wa.me texte + download | @developer |
| BL.7 | TEST+REVIEW | Tests (guard, numérotation, signature, Zod !) + review R1-R9 | @tester + @code-reviewer |

## Rappels critiques

- **R3 étendu (leçon SC2/ERR)** : Prisma = TypeScript = **Zod** — tout nouveau champ doit être ajouté aux schémas de validation runtime, avec tests de parse.
- Mobile-first 360px : la zone de signature doit être large, utilisable au doigt.
- Signatures base64 : limiter la taille (canvas ~600×200, PNG compressé).
- R2, R6, R7 habituels.

## Validation

- [ ] Migration non-breaking appliquée
- [ ] Guard : vente sans BL signé ne peut pas passer LIVREE ; ventes historiques LIVREE intactes
- [ ] Tests Zod + queries + guard verts, build OK
- [ ] Test manuel mobile du flux signature
- [ ] Review R1-R9
