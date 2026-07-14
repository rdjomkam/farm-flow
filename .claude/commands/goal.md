---
description: Sprint VA — Vente d'Alevins depuis une vague PRE_GROSSISSEMENT (clôture + monétisation restants)
---

# Objectif — Sprint VA (Vente d'Alevins)

Permettre à un utilisateur de **vendre les poissons restants** d'une vague `PRE_GROSSISSEMENT` (fingerlings/alevins) directement comme alevins — sans devoir les transférer d'abord vers une autre vague. Débloque le cas prod où une vague PG a un reliquat après transferts et le pisciculteur veut le liquider comme alevins.

## Contexte

- La vague PG en fin de vie a des poissons trop petits pour aller en grossissement mais assez grands pour être vendus comme alevins (nurserie)
- Actuellement, `createVenteAlevins` ([ventes.ts:444](src/lib/queries/ventes.ts#L444)) n'accepte que des sources d'unités de reproduction
- La `Vente` standard supporte déjà `LigneVente.vagueId` et `bacId`, mais l'UI ne propose pas de flow « vente d'alevins » clair depuis une vague PG

## Design retenu

Extension de `createVenteAlevins` OU nouveau flow `createVenteAlevinsDepuisVague`. Le second est plus clair sémantiquement.

**Réutilisation maximale** : `Vente` + `LigneVente` + relevés VENTE. Guard CS.3 déjà compatible. Rapport PDF et dashboard suivent automatiquement.

## Stories

### VA.1 — Marqueur `Vente.origineType`

**Fichier** : `prisma/schema.prisma`

Ajouter enum + colonne :
```prisma
enum OrigineVente {
  GROSSISSEMENT         // Vente normale depuis vague GR
  ALEVINS_REPRODUCTION  // Depuis unité de reproduction (existant)
  ALEVINS_PG            // NOUVEAU : depuis vague PG (reliquat)
}

model Vente {
  origineType OrigineVente @default(GROSSISSEMENT)
  // ...
}
```

Migration Prisma générée + committée.

### VA.2 — Query `createVenteAlevinsDepuisVague`

**Fichier** : `src/lib/queries/ventes.ts` (nouvelle fonction, ~80 lignes)

```ts
export async function createVenteAlevinsDepuisVague(
  siteId: string,
  userId: string,
  data: {
    vagueId: string,           // vague PG source
    clientId: string,          // peut être "Nurserie interne" (système)
    dateCommande: Date,
    lignes: Array<{
      bacId: string,
      nombrePoissons: number,
      poidsMoyenG: number,
      prixUnitaireKg: number,
    }>,
    depenses?: DepenseVenteInput[],  // optionnel
    autoCloture?: boolean,           // si true et tous bacs vidés → cloturerVague
    notes?: string,
  }
): Promise<VenteWithGroupes>
```

Logique :
1. Valider que la vague est `PRE_GROSSISSEMENT` et `EN_COURS`
2. Valider que chaque bacId ∈ AssignationBac.dateFin=null pour cette vague
3. Valider que `nombrePoissons ≤ vivantsByBac.get(bacId)` (via `computeVivantsByBac` + `transfertDestBacIds`)
4. Appeler la logique existante de création Vente + LigneVente (extraire un helper depuis `createVente` si utile)
5. `origineType = ALEVINS_PG`
6. Guard CS.3 (`verifyAssignationInvariant`) déjà en place
7. Si `autoCloture` et sum(vivants après vente) === 0 → appeler `cloturerVague`

### VA.3 — API route

**Fichier** : `src/app/api/vagues/[id]/vente-alevins/route.ts` (nouveau)

POST endpoint qui appelle `createVenteAlevinsDepuisVague`. Permission requise : `VENTES_CREER` + `VAGUES_MODIFIER` (pour l'auto-clôture).

### VA.4 — UI : bouton + dialog

**Fichier** : `src/components/vagues/vente-alevins-dialog.tsx` (nouveau)

Dans `VagueActionMenu` (déjà existant), ajouter un item « **Vendre restants comme alevins** » visible uniquement si :
- Vague statut = EN_COURS
- Vague type = PRE_GROSSISSEMENT
- Utilisateur a permission VENTES_CREER

Dialog contenu :
- Sélecteur client (+ option « + Créer client Nurserie interne » si absent)
- Date commande
- Table bacs avec vivants pré-remplis, quantité éditable ≤ vivants, poids moyen (fallback = dernière biométrie du bac)
- Prix unitaire /kg (peut être 0 pour vente interne)
- Case « Clôturer la vague après validation »
- Champ dépenses (optionnel — DV pattern)
- Bouton Confirmer

### VA.5 — Client système « Nurserie interne » (optionnel)

**Fichier** : `prisma/seed.sql` + `src/lib/queries/clients.ts`

Seed un client par site avec `nom = "Nurserie interne"` et flag `isSysteme = true` (nouveau champ). Non supprimable. Sert de destinataire par défaut pour les ventes de reliquats.

Si le pisciculteur préfère ne pas passer par ce client (vente directe au vrai client), il choisit un autre client normalement.

### VA.6 — Tests + Review R1-R9

- `src/lib/queries/__tests__/vente-alevins-vague.test.ts` — 5 cas (vente valide, quantité > vivants → rejet, auto-clôture, guard invariant, permission VENTES_CREER manquante)
- E2E : étendre `conservation-flow.spec.ts` avec un scénario « vente alevins depuis PG + clôture »
- Review R1-R9

## Dépendances

```
VA.1 (schema) ─► VA.2 (query) ─► VA.3 (API) ─► VA.4 (UI)
                                                    │
                                     VA.5 (seed) ───┤
                                                    ▼
                                                  VA.6 (tests)
```

VA.5 peut être livré en parallèle de VA.4 mais avant VA.6.

## Agents

- **VA.1** : @db-specialist (migration Prisma)
- **VA.2** : @developer (query + extraction helper commun avec createVente)
- **VA.3** : @developer (route API)
- **VA.4** : @developer (dialog + intégration VagueActionMenu)
- **VA.5** : @db-specialist (seed + query clients système)
- **VA.6** : @tester + @code-reviewer

## Définition de fait

- [ ] Migration Prisma `origineType` appliquée
- [ ] `createVenteAlevinsDepuisVague` implémentée + testée
- [ ] Route API `/api/vagues/[id]/vente-alevins` fonctionnelle
- [ ] Dialog UI accessible depuis le menu vague PG
- [ ] Client « Nurserie interne » seedé (si retenu)
- [ ] Tests unitaires 5/5 verts + E2E vert
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` OK
- [ ] Review R1-R9 signée
- [ ] Un commit par story

## Hors-scope

- Refonte du modèle `LotAlevins` — indépendant, resterait pour les ventes depuis reproduction
- Rapport PDF spécifique « vente d'alevins » — Vente est déjà dans les PDF via VENTE_LIST_INCLUDE
- Notification / alerte sur clôture — séparé
- Gestion multi-client par bac dans une même vente (multi-lignes déjà supporté par LigneVente)
