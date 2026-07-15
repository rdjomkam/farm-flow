---
description: Sprint AV — Gestion des avaries (mortalité transport + perte poids transport, séparées)
---

# Objectif — Sprint AV (Avaries)

Permettre de tracer précisément **deux types distincts d'avaries** à la livraison d'une vente :

1. **Mortalité transport** : X poissons morts entre chargement et livraison → impact sur taux de survie
2. **Perte de poids transport** : Y kg perdus par déshydratation/stress → impact uniquement CA/biomasse

**Principe fondateur** : ne JAMAIS convertir une perte de poids en morts fictifs (biais sur survie). Séparer les 2 dimensions permet des analyses correctes et des actions ciblées (mortalité = problème biologique/logistique, perte poids = optimisation transport).

## Contexte

- Actuellement `CauseMortalite.AVARIE` existe → morts transport partiellement traçables via un relevé MORTALITE manuel
- Le champ `Vente.poidsLivreKg` capte déjà la différence commandé/livré (DV.0)
- Mais aucun mécanisme UI structuré à la livraison, pas de séparation claire, pas de rapport dédié

## Design retenu

**Extension de `LigneVente`** avec 2 champs optionnels :
```prisma
model LigneVente {
  // ... champs existants
  nombreMortsTransport    Int?     @default(0)   // vraies morts
  poidsPerduTransportKg   Float?   @default(0)   // kg de déshydratation
  motifAvarie             String?               // texte libre optionnel
}
```

Choix « par ligne » pour granularité bac-par-bac (une livraison peut avoir des conditions différentes selon la source).

**Flux à la livraison** :
1. UI « Marquer comme livrée » propose un formulaire par ligne :
   - Poids commandé (readonly)
   - **Poids livré (kg)** — pesée réelle à l'arrivée
   - **Nombre de morts transport** (défaut 0)
   - **Motif** (optionnel : chaleur, temps trajet excessif, oxygène, etc.)
2. Backend calcule :
   - `poidsPerduTransportKg = poidsTotalKg (commandé) − poidsLivreKg`
   - Si `nombreMortsTransport > 0` → créer un relevé `MORTALITE cause=AVARIE` sur le bac source
   - Décrémenter `AssignationBac.nombreActuel` supplémentairement de `nombreMortsTransport`
3. Guard CS.3 valide (mortalités avarie s'ajoutent aux morts déjà comptés)

## Stories

### AV.1 — Schema

**Fichier** : `prisma/schema.prisma`

Ajouter les 3 champs sur `LigneVente` :
```prisma
nombreMortsTransport   Int?    @default(0)
poidsPerduTransportKg  Float?  @default(0)
motifAvarie            String?
```

Migration Prisma générée + committée. Idempotente pour Coolify.

### AV.2 — Query : logique de livraison enrichie

**Fichier** : `src/lib/queries/ventes.ts`

Modifier `livrerVente` (ou équivalent qui passe le statut à LIVREE) pour accepter par ligne :
```ts
lignes: Array<{
  ligneVenteId: string;
  poidsLivreKg: number;
  nombreMortsTransport?: number;
  motifAvarie?: string;
}>
```

Logique dans la transaction :
1. Pour chaque ligne : update `LigneVente` avec `poidsLivreKg` + `poidsPerduTransportKg` calculé (commandé − livré) + `nombreMortsTransport` + `motifAvarie`
2. Si `nombreMortsTransport > 0` : créer un relevé `MORTALITE` avec `causeMortalite = AVARIE`, `bacId = ligne.bacId`, `vagueId = ligne.vagueId`, `nombreMorts = nombreMortsTransport`, `notes` incluant le motif
3. Décrémenter `AssignationBac.nombreActuel` de `nombreMortsTransport` supplémentaires
4. Update `Vente.poidsLivreKg` (agrégat) + statut LIVREE
5. Guard `verifyAssignationInvariant`

**Note** : les relevés MORTALITE créés impactent naturellement le taux de survie via la formule `(nombreInitial − totalMortalites) / nombreInitial` (Sprint SV).

### AV.3 — API route

**Fichier** : `src/app/api/ventes/[id]/livraison/route.ts` (nouveau ou étendre existant)

POST avec body typé. Permission `VENTES_LIVRER`.

### AV.4 — UI dialog livraison avec avaries

**Fichier** : `src/components/ventes/livraison-vente-dialog.tsx` (nouveau ou étendre existant)

Formulaire :
- Table par ligne de vente :
  - Bac (readonly)
  - Poids commandé (readonly)
  - Input « Poids livré (kg) » (pré-rempli avec poids commandé)
  - Input « Morts transport » (défaut 0, borne = quantité commandée)
  - Input « Motif » (libre, optionnel)
- Total livré / commandé affiché en bas
- Total morts transport agrégé
- Case « Publier immédiatement (statut LIVREE) »

Design mobile-first, réutilise le pattern DV et VA existants.

### AV.5 — Rapports & stats

**Fichiers** : PDF rapport général vague + dashboard finances

Sur les rapports Vague et les cartes du dashboard :
- Ligne « Mortalité transport » distincte de « Mortalité élevage »
- Ligne « Perte poids transport (kg) »
- Impact biomasse : `biomasse produite = biomasse vive + biomasse vendue livrée + biomasse transférée` (le CA suit `poidsLivreKg`, la perte est déjà déduite)

Le taux de survie **inclut automatiquement les morts avarie** grâce à la formule SV (∑ mortalités toutes causes / initial).

### AV.6 — Alerte perte transport excessive (optionnel — reportable)

Si `poidsPerduTransportKg / poidsTotalKg > 5%` sur une livraison → alerte visible dans l'historique vente ou dashboard. Investigation logistique déclenchée.

Peut être reporté à un sprint AV.2 ultérieur si trop de charge.

### AV.7 — Tests + review R1-R9

- `src/__tests__/livraison-avarie.test.ts` — 5 cas :
  1. Livraison sans avarie → pas de MORTALITE créée
  2. Livraison avec 5 morts transport → MORTALITE cause=AVARIE + AssignationBac décrémenté
  3. Livraison poids livré < commandé → `poidsPerduTransportKg` calculé, pas de MORTALITE
  4. Morts transport > quantité commandée → ValidationError
  5. Guard invariant respecté

- Extension E2E `conservation-flow.spec.ts` ou nouveau spec.

- Review R1-R9.

## Dépendances

```
AV.1 (schema) ─► AV.2 (query) ─► AV.3 (API) ─► AV.4 (UI)
                                     │             │
                                     ▼             ▼
                                   AV.5 (rapports/stats)
                                     │
                                     ▼
                                   AV.7 (tests + review)
```

AV.6 (alerte) est optionnel, peut sortir du scope initial.

## Agents

- **AV.1** : @db-specialist (schema + migration Prisma)
- **AV.2 + AV.3** : @developer (query + API)
- **AV.4** : @developer (dialog UI)
- **AV.5** : @developer (rapports + dashboard)
- **AV.7** : @tester + @code-reviewer

## Définition de fait

- [ ] Migration Prisma `LigneVente.nombreMortsTransport + poidsPerduTransportKg + motifAvarie` appliquée
- [ ] `livrerVente` accepte les avaries par ligne
- [ ] Relevé MORTALITE créé si `nombreMortsTransport > 0` (cause=AVARIE)
- [ ] Guard CS.3 valide correctement
- [ ] Dialog livraison propose 3 champs par ligne
- [ ] Rapports PDF + dashboard distinguent avarie transport / élevage
- [ ] Tests unit 5/5 verts
- [ ] `npx tsc --noEmit` clean + `npm run build` OK
- [ ] Review R1-R9 signée
- [ ] Un commit par story + push

## Principes métier (à graver)

- **Perte poids ≠ morts** : NE JAMAIS convertir kg en poissons fictifs
- **Deux dimensions séparées** : survie (nombre) vs biomasse (kg)
- **CA = poids livré** (DV.0 déjà en place)
- **Traçabilité** : le motif libre permet de corréler avec transporteur/conditions

## Hors-scope

- Refonte du modèle Vente (déjà robuste post-DV/EX)
- Application prod « corriger les livraisons passées » — les livraisons existantes gardent leur `poidsLivreKg` actuel, `nombreMortsTransport` reste à 0 par défaut (backfill nul)
- Multi-transporteur / suivi logistique complet — chantier séparé
