# Sprint BF — Fusion quantités livrées ↔ bon de livraison + BL rectificatif

**Statut** : ✅ CLÔTURÉ — phase 1 et phase 2 livrées (APPROVED)
**Lancé le** : 2026-07-21
**Phase 1 clôturée le** : 2026-07-26
**Review phase 1** : [review-sprint-BF.md](../reviews/review-sprint-BF.md)
**Review phase 2** : [review-sprint-BF-phase2.md](../reviews/review-sprint-BF-phase2.md)
**Phase 2 clôturée le** : 2026-07-26
**Origine** : anomalie de conception détectée par l'utilisateur après le sprint BL

## Problème

`LigneVente.poidsLivreKg` n'est écrit que par `cloturerVente`, qui tourne **après** la signature du BL. Au moment où le client signe, la colonne « poids livré » et l'écart du PDF sont vides : **le client atteste une commande, pas une livraison**.

Aggravant : la signature est immuable (par design sécurité, review BL.7). Si un écart apparaît à la remise (poids réel, morts en transport, caisse refusée), le document signé est figé avec les quantités commandées et **aucun chemin d'amendement n'existe**.

Constat prod au lancement du sprint : `BL-2026-001` sur `VTE-2026-015`, BROUILLON, 3 lignes (245,25 + 349 + 232 = 826,25 kg commandés), `poidsLivreKg` vide → le prochain BL signé aurait le défaut.

## Décisions validées (utilisateur)

1. **Fusion** : les quantités livrées sont saisies **dans le flux BL, avant signature**. La signature devient ce qui passe la vente en LIVREE. Le dialog séparé « Confirmer la livraison » disparaît (son contenu devient l'écran 1 du BL).
2. **Après signature** : option 2 — **BL rectificatif**. Un second BL lié au premier, qui annule et remplace, avec nouvelle signature (pratique comptable de l'avoir sur facture). L'original reste SIGNE (fait historique, immuabilité préservée) et porte un lien vers son rectificatif.

## Flux cible (phase 1)

```
BL BROUILLON
 → Écran 1  Quantités livrées par ligne (poids livré prérempli = commandé,
            morts transport, motif) → persistées sur le BL, modifiables
            tant que non signé → statut EN_ATTENTE_SIGNATURE
 → Écran 2  Récap : VRAIES quantités + écarts + montant recalculé sur le
            livré + Total/Payé/Reste réels  ← ce qu'on montre au client
 → Écran 3  Signature client (nom prérempli)
 → Écran 4  Signature livreur
 → Validation : UNE transaction — applique les quantités (MORTALITE avaries,
   décréments LigneVente + relevé VENTE, montantTotal, facture, audit),
   BL → SIGNE, vente → LIVREE
 → PDF avec quantités réelles + écarts
```

## Choix d'architecture

**Stockage des quantités avant signature : nouveau modèle `LigneBonLivraison`** (et non écriture directe dans `LigneVente.poidsLivreKg`).

Raisons :
- `LigneVente.poidsLivreKg` est lu par les helpers « montant livré » (sprint DV.0) et les agrégations finances/dashboard — l'écrire avant livraison effective ferait compter une vente non livrée.
- Le BL porte ses propres données → snapshot naturel, indispensable au rectificatif (chaque BL garde ses quantités).
- La transaction de signature reste le **seul** point d'écriture de `LigneVente.poidsLivreKg` → aucune régression DV.0.

## Stories

### Phase 1 — Fusion (débloque le risque prod)

| Story | Type | Sujet | Agent |
|-------|------|-------|-------|
| BF.1 | SCHEMA | Modèle `LigneBonLivraison` (blId, ligneVenteId, poidsLivreKg, nombreMortsTransport, motifAvarie) + types + Zod | @db-specialist |
| BF.2 | QUERIES | `enregistrerQuantitesBonLivraison` (BROUILLON→EN_ATTENTE_SIGNATURE, ré-éditable) ; `signerBonLivraison` absorbe la logique de clôture (transaction unique → BL SIGNE + vente LIVREE) | @developer |
| BF.3 | UI | Flux BL : nouvel écran 1 quantités, récap sur les vraies valeurs, suppression du dialog « Confirmer la livraison » | @developer |
| BF.4 | UI PDF | PDF lit `LigneBonLivraison` (quantités du BL) au lieu de `LigneVente` | @developer |
| BF.5 | TEST+REVIEW | Tests (fusion, avaries préservées sprint AV, guard, Zod) + review R1-R9 | @tester + @code-reviewer |

### Phase 2 — BL rectificatif

| Story | Type | Sujet | Agent |
|-------|------|-------|-------|
| BF.6 | SCHEMA | `BonLivraison.rectifieId` (self-relation unique), `venteId` passe de unique à index (plusieurs BL par vente, un seul actif) | @db-specialist |
| BF.7 | QUERIES+UI | `creerBonLivraisonRectificatif` : applique les **deltas** vs l'original (poids, montant, facture, MORTALITE) ; UI depuis une vente LIVREE ; PDF avec mention « annule et remplace BL-X » et watermark sur l'original | @developer |
| BF.8 | TEST+REVIEW | Tests deltas + review | @tester + @code-reviewer |

## Rappels critiques

- **R3 étendu (leçon ERR SC2)** : Prisma = TypeScript = **Zod**, avec tests de parse.
- La logique métier avaries du sprint AV (MORTALITE cause=AVARIE saisie explicitement, zéro conversion kg→morts) est **conservée telle quelle** — les 6 tests AV doivent rester verts.
- Guard « BL signé avant LIVREE » conservé, mais devient tautologique (la signature livre).
- Immuabilité de la signature préservée : un BL SIGNE reste intouchable, la correction passe par un rectificatif.
- Mobile-first 360px.

## Validation

- [ ] Migration non-breaking (prod : 1 BL BROUILLON → repasse par le nouveau flux sans souci)
- [ ] Un BL signé porte les quantités réellement livrées, visibles sur le PDF signé
- [ ] Impossible de livrer sans BL signé ; impossible de signer sans quantités saisies
- [ ] Tests AV verts + nouveaux tests fusion, suite complète sans régression
- [ ] Test E2E navigateur du flux complet
- [ ] Review R1-R9
