# Review Sprint BF phase 2 — Bon de livraison rectificatif

**Verdict : APPROVED_WITH_NITS → APPROVED après correctifs**

Un BL signé est immuable. La correction d'une erreur découverte après signature passe par un **rectificatif** : un second BL qui annule et remplace le précédent, avec nouvelle signature. L'original reste SIGNE (fait historique) ; « annulé » se déduit de la présence de `rectifiePar`, sans statut supplémentaire.

## Axes critiques — réponses explicites

**1. Calcul des deltas — CONFORME.**
`bons-livraison.ts:699-701` lit `bonLivraison.rectifie.lignes`, soit le BL **immédiatement** rectifié — jamais la tête de chaîne. Test dédié (`bons-livraison-rectificatif.test.ts:451-475`) : sur A ← B ← C, le delta de C se calcule vs B. C'est la protection contre le double comptage.
Signes vérifiés dans les deux sens : `deltaMorts = anciensMorts − nouveauxMorts`, appliqué identiquement à `LigneVente.nombrePoissons` et au relevé VENTE `nombreVendus`, dans la même transaction. L'invariant `vendus + morts = réservé initial` tient quel que soit le sens. Les 4 cas limites sont testés (origine sans mortalité → ajout, mortalité → suppression, poids seul, sens inverse).

**2. Suppression du relevé de mortalité — CONFORME.**
La protection utilisateur (`releves.ts:695-716`) est intacte et testée dans les deux sens (refuse une avarie liée à une vente, autorise une mortalité d'autre cause). Le rectificatif contourne volontairement via `tx.releve.delete` — chemin sanctionné contre chemin utilisateur — avec trace `SiteAuditLog` (`RELEVE_MORTALITE_SUPPRIME_RECTIFICATIF`, ancien nombre, BL, vente, bac). Aucun autre chemin non protégé.

**3. Guard de conservation — CONFORME.**
Capture en première opération de la transaction, avec `tx`, sur la **superset** des bacs touchés par l'origine **ou** le rectificatif (`nombreMortsTransportPreScan > 0 || anciensMortsPreScan > 0`) — un bac dont les morts retombent à 0 reste dans le périmètre, testé explicitement. Delta algébriquement neutre, cohérent avec le guard différentiel du sprint GT.

**4. Intégrité de la chaîne — CONFORME.**
Rectifier un BL déjà rectifié → refusé. Signer un BL déjà rectifié → refusé. `getBonLivraisonActif` filtre `rectifiePar: { is: null }` + `siteId`. Aucun résidu de `.bonLivraison` singulier : `getVenteById` réduit explicitement le tableau en `bonLivraisonActif`. `getBonLivraisonForPDF` reste keyée par `id` (non restreinte à l'actif) — volontaire, pour régénérer le PDF d'un bon annulé.

## Finding Haute (corrigé)

**Le PDF d'un bon annulé affichait le nombre de poissons courant, pas celui de sa propre signature.**
La route lisait `LigneVente.nombrePoissons`, champ d'état réécrit à chaque rectification, alors que le poids livré et les morts venaient de `LigneBonLivraison` (snapshot correct). Le même document mélangeait donc deux époques — précisément le défaut que la phase 1 visait à éliminer, sur une pièce à valeur contractuelle.

**Correctif** : `LigneBonLivraison.nombrePoissonsLivres` figé à la signature (dans les deux modes), lu en priorité par le PDF avec repli commenté pour les bons antérieurs. Test : après rectification, le PDF de l'origine affiche toujours **ses** chiffres.

## Durcissements appliqués

| Sujet | Décision |
|---|---|
| Permission de signature | Signer un **rectificatif** exige aussi `BONS_LIVRAISON_RECTIFIER` — c'est la signature qui engage la correction de stock et de montants. La saisie du brouillon reste sous `VENTES_MODIFIER` : tant que ce n'est pas signé, rien n'est appliqué. |
| Clamp `Math.max(0, …)` | Conservé (ne pas transformer un cas limite bénin en panne), mais désormais **observable** via `console.warn` structuré quand il s'active — une régression future du delta devient visible au lieu d'être absorbée. |
| Historique | Déplacé de la page serveur vers la couche `queries` (`getHistoriqueBonsLivraison`, filtré `siteId`), et enrichi : « Remplacé par BL-XXX » + motif, au lieu d'un badge muet. |
| Test instable | 3 tests à ~4 s pour une limite de 5 s. Cause réelle diagnostiquée (simulation pointeur + montage Radix, non la frappe), remplacée par `fireEvent` → temps du fichier divisé par trois, plus timeout explicite sur les tests ouvrant le menu. |

## R1-R9

R1 ✓ · R2 ✓ · R3 ✓ (Prisma = TS = Zod, `motifRectification` borné 5-500 et testé au parse) · R4 ✓ · R5 N/A · R6 N/A (PDF react-pdf) · R7 ✓ · R8 ✓ · R9 ✓ — **5487 tests verts, 0 échec**, build OK

## Décisions de conception retenues

- Mortalité : mise à jour si le nouveau nombre > 0, **supprimée** s'il tombe à 0 (partout ailleurs dans le code, un relevé de mortalité n'existe que s'il y a des morts).
- Facture : solde créditeur toléré, **jamais** de blocage — réutilise la logique de `regenererFacture` (PAYEE si `montantPaye >= nouveauMontant`). Le projet ne modélise pas de montant négatif.
- Rectification **interdite sur vente CLOTUREE** : le code affirme déjà deux fois que cet état est terminal.
- Pas de statut `ANNULE_ET_REMPLACE` : la back-relation suffit et reste plus lisible (`WHERE rectifiePar IS NULL` donne l'actif).

## Suivis non bloquants

- Persister les écarts de conservation tolérés (aujourd'hui `console.warn`) pour un tableau de bord des bacs qui dérivent.
- Le récap à l'écran du flux BL affiche le nombre de poissons **commandé** alors que le PDF affiche le **livré**.
