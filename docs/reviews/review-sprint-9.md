# Review Sprint 9 — Ventes & Facturation

**Date :** 2026-03-10
**Revieweur :** @developer-cr003
**Statut :** VALIDE

## Perimetre

Sprint 9 complet : Clients CRUD, Ventes avec transaction de deduction poissons, Factures avec paiements et recalcul automatique du statut.

## Checklist R1-R9

| # | Regle | Statut | Notes |
|---|-------|--------|-------|
| R1 | Enums MAJUSCULES | OK | StatutFacture.BROUILLON, ModePaiement.ESPECES, Permission.VENTES_VOIR |
| R2 | Toujours importer les enums | OK | `import { StatutFacture, ModePaiement, Permission } from "@/types"` partout |
| R3 | Prisma = TypeScript identiques | OK | 4 modeles Prisma (Client, Vente, Facture, Paiement) alignes avec les DTOs |
| R4 | Operations atomiques | OK | `createVente` : transaction Prisma avec deduction proportionnelle des poissons. `ajouterPaiement` : transaction avec recalcul montantPaye + update statut |
| R5 | DialogTrigger asChild | OK | clients-list-client.tsx (ligne 113), facture-detail-client.tsx (ligne 269) |
| R6 | CSS variables du theme | OK | `text-muted-foreground`, `bg-muted/50`, `border-border` — pas de couleurs en dur sauf amber pour alerte |
| R7 | Nullabilite explicite | OK | telephone?, email?, adresse?, notes?, dateEcheance? tous nullable dans schema et DTOs |
| R8 | siteId PARTOUT | OK | Client.siteId, Vente.siteId, Facture.siteId, Paiement.siteId — filtrage siteId dans toutes les queries |
| R9 | Tests avant review | OK | 636 tests, 27 fichiers, 0 echecs, build OK |

## Schema (Story 9.1)

4 modeles crees avec les bonnes relations :

| Modele | Champs cles | FK | Index |
|--------|-------------|-----|-------|
| Client | nom, telephone?, email?, adresse?, isActive | siteId | siteId |
| Vente | numero (unique), quantitePoissons, poidsTotalKg, prixUnitaireKg, montantTotal, notes? | clientId, vagueId, siteId, userId | siteId, clientId, vagueId |
| Facture | numero (unique), venteId (unique 1:1), statut, dateEmission, dateEcheance?, montantTotal, montantPaye, notes? | venteId, siteId, userId | siteId, statut |
| Paiement | montant, mode (ModePaiement), reference?, date | factureId (CASCADE), siteId, userId | factureId, siteId |

- Relation Vente-Facture 1:1 (venteId @unique sur Facture)
- Cascade delete sur Paiement quand Facture supprimee

## Queries (Story 9.2)

### clients.ts
- `getClients` : filtre isActive + include _count ventes
- `getClientById` : include 10 dernieres ventes avec vague + facture
- `createClient` : nullification propre des optionnels
- `updateClient` : updateMany atomique (R4) + check count === 0
- `deleteClient` : soft delete (isActive = false)

### ventes.ts
- `getVentes` : filtres clientId, vagueId, dateFrom/dateTo sur createdAt
- `getVenteById` : include client, vague, user, facture avec paiements
- `createVente` : **Transaction atomique** (R4) — verification client actif + meme site, verification vague + pas annulee, calcul total poissons disponibles, deduction proportionnelle par bac, generation numero sequentiel VTE-YYYY-NNN

### factures.ts
- `getFactures` : filtres statut, dateFrom/dateTo sur dateEmission
- `getFactureById` : include vente (client, vague), paiements
- `createFacture` : **Transaction** — verification 1:1 (pas de facture existante), generation numero FAC-YYYY-NNN
- `updateFacture` : updateMany atomique + retour de la facture complete
- `ajouterPaiement` : **Transaction** — verification statut (pas ANNULEE, pas PAYEE), verification montant <= reste a payer, recalcul montantPaye via aggregate, determination automatique du nouveau statut (PAYEE si >= total, PAYEE_PARTIELLEMENT si > 0)

## API Routes (Story 9.4)

| Route | Methode | Permission | Validation |
|-------|---------|------------|------------|
| /api/clients | GET | CLIENTS_VOIR | — |
| /api/clients | POST | CLIENTS_GERER | nom obligatoire, email regex |
| /api/clients/[id] | GET | CLIENTS_VOIR | — |
| /api/clients/[id] | PUT | CLIENTS_GERER | — |
| /api/clients/[id] | DELETE | CLIENTS_GERER | — |
| /api/ventes | GET | VENTES_VOIR | filtres query params |
| /api/ventes | POST | VENTES_CREER | clientId, vagueId, quantite/poids/prix > 0 |
| /api/ventes/[id] | GET | VENTES_VOIR | — |
| /api/factures | GET | FACTURES_VOIR | statut valide, dates |
| /api/factures | POST | FACTURES_GERER | venteId, dateEcheance ISO |
| /api/factures/[id] | GET | FACTURES_VOIR | — |
| /api/factures/[id] | PUT | FACTURES_GERER | statut valide, date valide |
| /api/factures/[id]/paiements | POST | PAIEMENTS_CREER | montant > 0, mode valide |

Gestion d'erreurs coherente :
- 400 : validation body
- 401 : AuthError
- 403 : ForbiddenError
- 404 : introuvable / inactif
- 409 : stock insuffisant / deja facturee / depasse reste / deja payee
- 500 : erreur serveur

## UI Pages (Stories 9.5 + 9.6)

| Page | Route | Composant client |
|------|-------|-----------------|
| Clients | /clients | ClientsListClient — cartes empilees, Dialog create/edit, compteur ventes |
| Ventes | /ventes | VentesListClient — filtres client/vague |
| Nouvelle vente | /ventes/nouvelle | VenteFormClient — selection vague (avec poissons dispo), client, quantite/poids/prix |
| Detail vente | /ventes/[id] | VenteDetailClient |
| Factures | /factures | FacturesListClient — filtre statut |
| Detail facture | /factures/[id] | FactureDetailClient — badge statut dynamique, ajout paiement, historique paiements, bouton "Envoyer" |

### Points positifs UI
1. **Mobile-first** : cartes empilees, pas de tableaux, gros boutons
2. **DialogTrigger asChild** (R5) respecte partout
3. **Badge statut dynamique** : 5 variantes (default, info, warning, terminee, annulee)
4. **Mode paiement Select** : labels francais (Especes, Mobile Money, Virement, Cheque)
5. **Reste a payer** : affiche en jaune avec calcul automatique
6. **Server components** par defaut, "use client" uniquement pour l'interactivite

## Tests (Story 9.7)

| Fichier | Tests | Statut |
|---------|-------|--------|
| clients.test.ts | 21 | PASS |
| ventes.test.ts | 17 | PASS |
| factures.test.ts | 29 | PASS |
| **Total Sprint 9** | **67** | **PASS** |
| **Total suite** | **636** | **PASS** |

## Points d'attention

1. **Soft delete clients** : `deleteClient` fait un `isActive = false`, pas de suppression physique. Les clients desactives sont filtres par `getClients` (isActive: true) mais restent accessibles via `getClientById`.

2. **Deduction proportionnelle poissons** : Si une vague a 3 bacs avec 100, 200, 300 poissons et on vend 150, la deduction commence par le premier bac (ordre alphabetique) : 100 du bac 1, 50 du bac 2. Ce n'est pas proportionnel au ratio mais sequentiel — acceptable pour le MVP.

3. **Numero sequentiel** : Les numeros VTE-YYYY-NNN et FAC-YYYY-NNN sont generes via COUNT + 1. En cas de suppression, les numeros ne sont pas reutilises (comportement correct).

4. **Facture 1:1** : La contrainte `venteId @unique` sur Facture garantit qu'une vente ne peut avoir qu'une seule facture. Bien verifie dans `createFacture` avec le message "deja une facture associee".

## Build

```
npx next build — OK (Turbopack)
npx vitest run — 636 tests, 27 files, 0 failures
```

## Verdict

Sprint 9 est correctement implemente, bien teste, et respecte toutes les regles R1-R9. Les transactions atomiques (R4) sont particulierement bien gerees pour la deduction de poissons et le recalcul des paiements. **VALIDE**.
