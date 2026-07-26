# Review Sprint BF — Phase 1 : fusion quantités livrées ↔ bon de livraison

**Verdict : APPROVED_WITH_NITS** (+ 2 correctifs bloquants trouvés au test E2E, appliqués)

## Points prioritaires vérifiés ligne par ligne

**1. Rien de perdu vs `cloturerVente`** — confirmé étape par étape (`bons-livraison.ts:423-655`) : guards, boucle avaries, décrément `LigneVente.nombrePoissons` uniquement si morts>0, décrément relevé VENTE + `ReleveModification` (raison « Avarie transport livraison »), MORTALITE cause=AVARIE, recalcul `montantTotal` sur le livré, figement `poidsCommandeKg`/`quantiteCommandee`, update facture, `SiteAuditLog` action `VENTE_CLOTUREE`. Zéro conversion kg→morts (garde-fou AV intact).

**2. `verifyAssignationInvariant`** — positionné après les updates de lignes, avant la relecture finale, appelé avec `tx` (rollback garanti), restreint aux bacs de `bacsParVague` (peuplé seulement si morts>0).

**5. `enregistrerQuantitesBonLivraison` n'écrit rien hors du BL** — aucun accès à `tx.ligneVente`/`releve`/`vente`/`facture`. Le brouillon ne pollue pas les agrégations finances qui lisent `LigneVente.poidsLivreKg`.

**9. Récap sur les quantités livrées** — `bon-livraison-flow.tsx:297-308` calcule depuis `bonLivraison.lignes`, jamais `ligne.poidsTotalKg`. Vérifié aussi visuellement en E2E.

## R1-R9

R1 ✓ · R2 ✓ (aucun littéral de statut) · R3 ✓ (Prisma = TS = Zod, tests de parse) · R4 ✓ (transaction unique + `updateMany` conditionnel anti-double-signature) · R5 N/A (dialogs contrôlés) · R6 ✓ · R7 ✓ · R8 ✓ (siteId partout, y compris nouvelle route) · R9 ✓

## Correctifs bloquants trouvés au test E2E navigateur (hors review statique)

1. **`dateLivraison` rejetée** — l'`<input type="date">` envoie `YYYY-MM-DD`, le Zod exigeait un ISO datetime → 400, flux totalement bloqué. Fix : `flexibleDateSchema` (aligné sur le pattern `releveDateSchema` du projet) + tests des deux formats.
2. **Échecs silencieux** — `handleSubmitQuantites` et `handleValidateSignature` faisaient `if (result.ok)` sans branche else : aucun message d'erreur, bouton inopérant sans explication. C'est ce qui a rendu le bug 1 invisible. Fix : toast d'erreur sur les deux chemins.

## Nits (non bloquants)

1. Récap UI : affiche le nombre de poissons **commandé** (90) alors que le PDF affiche le **livré** (87). Incohérence écran/document signé à corriger.
2. `ConservationError` remonte en **500** au lieu d'un 4xx avec message actionnable (voir finding ci-dessous).
3. Aucun test de signature concurrente / échec en milieu de transaction (garantie structurelle présente, non vérifiée par test).
4. Ligne sans `bacId` (vente d'alevins) avec morts>0 → `releve.create` avec `bacId: null` ; pattern hérité de `cloturerVente`, non introduit par BF.

## Finding opérationnel — le guard de conservation peut bloquer une livraison légitime

Découvert en E2E : une livraison avec morts en transport sur un bac dont l'historique porte un écart préexistant est **refusée avec une 500**, alors que l'opération courante est parfaitement légitime.

Le guard vérifie l'invariant en **absolu**, pas en **delta** : il ne distingue pas « cette opération casse la conservation » de « ce bac était déjà décalé avant qu'on y touche ». Dans le cas rencontré, l'écart venait des données de seed (2 poissons), mais le même schéma existe en prod — c'est exactement l'impasse du Bac 11 de Vague-26-03-Prep.

Conséquence terrain : le livreur, devant le client, obtient une erreur serveur incompréhensible et ne peut pas livrer.

**Recommandation** (sprint dédié) : rendre le guard tolérant aux écarts préexistants — mesurer l'écart avant application, et n'échouer que si l'opération l'aggrave. Plus retourner un 4xx avec message actionnable au lieu d'un 500.

## Validation E2E navigateur (preuve visuelle)

Parcours complet rejoué sur VTE-2026-002 avec un écart réel (4,2 kg livrés / 5 commandés, 3 morts, motif) :

| Étape | Résultat |
|---|---|
| Menu vente | « Close delivery » supprimé, seul « Delivery note » subsiste |
| Écran 1 quantités | Arrive en premier, préremplis au commandé, totaux live (perte 0,8 kg, 87 livrés) |
| Récap | **4,2 kg**, écart « Ordered: 5 kg (gap 0.8 kg) », montant **10 500** (au lieu de 12 500) |
| Signatures | Nom client prérempli, client + livreur capturées |
| Transaction | BL SIGNE, vente LIVREE, montant 10 500, 90→87 poissons, MORTALITE AVARIE 3 + motif |
| PDF | « Silure », 87 poissons, 4,2 kg, écart −0,8 kg, « dont 3 morts en transport — Chaleur pendant le trajet », bloc paiement, 3 signatures + cachet |

Le client signe désormais un document qui dit ce qu'il a reçu.
