---
description: Sprint AV — Gestion des avaries (mortalité transport saisie + suppression conversion kg→morts, avec audit prod)
---

# Objectif — Sprint AV (Avaries)

Corriger un **bug métier critique** : le code actuel convertit toute perte de poids en transport en morts fictifs, ce qui fausse le taux de survie de toutes les vagues qui ont eu des ventes livrées.

## Bug racine identifié

Dans [`livrerVente` — ventes.ts:1330-1391](src/lib/queries/ventes.ts#L1330) :

```ts
const quantiteLivree = Math.round((dto.poidsLivreKg * 1000) / poidsMoyenG);
const nombreMorts = vente.quantitePoissons - quantiteLivree;   // ← MORTS FICTIFS
if (nombreMorts > 0) {
  // Crée un MORTALITE cause=AVARIE avec ces morts inventés
}
```

**Effet** : une vente avec 100 kg commandés livrés en 95 kg (déshydratation, purge, poissons vivants mais plus légers) → le code invente ~10 « morts en transport » → taux de survie baisse artificiellement.

## Principe métier gravé

- **Mortalité transport** (vraies morts) et **perte de poids transport** (déshydratation) sont **2 dimensions distinctes**
- Un mort compte comme mortalité ; une perte de poids ne compte QUE dans la biomasse/CA
- L'utilisateur SAISIT explicitement combien de poissons sont morts en transport (pas de calcul automatique)

## Design retenu — Option E (design élégant, réutilise l'existant)

**Aucun nouveau champ schema.** À la livraison :
1. Utilisateur saisit `poidsLivreKg` (pesée réelle) → réduit CA/biomasse via `Vente.poidsLivreKg` (existant DV.0)
2. Utilisateur saisit `nombreMortsTransport` (compte manuel des poissons morts)
3. Si `nombreMortsTransport > 0` :
   - Créer un relevé `MORTALITE cause=AVARIE, venteId, nombreMorts=nombreMortsTransport`
   - Update le relevé VENTE lié : `nombreVendus - nombreMortsTransport`
   - Update `LigneVente.nombrePoissons` : `- nombreMortsTransport` (audit via `updatedAt` + `ReleveModification`)
4. **Aucune conversion automatique kg → morts**

**Zéro impact** sur `computeVivantsByBac`, `getIndicateursVague`, `calculerTauxSurvie`, `verifyAssignationInvariant` — ces fonctions comptent déjà correctement les MORTALITE (peu importe la cause).

## Stories

### AV.1 — Schema (léger — ou aucun changement)

**Fichier** : `prisma/schema.prisma`

Vérifier si `causeMortalite = AVARIE` existe déjà (probablement oui). Si non, l'ajouter à l'enum `CauseMortalite`.

Sinon, aucun changement de schema — on réutilise entièrement les modèles existants (Vente, LigneVente, Releve, ReleveModification).

Optionnel : ajouter `LigneVente.poidsLivreKg` par ligne (aujourd'hui seulement au niveau Vente) pour granularité — à valider avec la logique DV.0.

### AV.2 — Query : refonte `livrerVente`

**Fichier** : `src/lib/queries/ventes.ts` (lignes 1310-1450 environ)

**Retirer entièrement** la logique auto-calcul (lignes 1328-1391) :
```ts
// À SUPPRIMER
const quantiteLivree = Math.round((dto.poidsLivreKg * 1000) / poidsMoyenG);
const nombreMorts = vente.quantitePoissons - quantiteLivree;
// ... création automatique de MORTALITE AVARIE
```

**Remplacer par** la logique explicite :
```ts
// DTO enrichi :
livrerVente({
  dateLivraison,
  poidsLivreKg,       // pesée réelle (agrégat vente — DV.0)
  lignes: [{
    ligneVenteId,
    poidsLivreKg,             // pesée réelle par ligne (optionnel, défaut = pro rata)
    nombreMortsTransport,     // SAISI, défaut 0
    motifAvarie?,             // texte libre
  }]
})
```

Pour chaque ligne avec `nombreMortsTransport > 0` :
1. Update `LigneVente.nombrePoissons -= nombreMortsTransport`
2. Update relevé VENTE lié `nombreVendus -= nombreMortsTransport` + créer `ReleveModification` (raison="Avarie transport livraison")
3. Créer relevé `MORTALITE cause=AVARIE, bacId=ligne.bacId, vagueId=ligne.vagueId, nombreMorts=nombreMortsTransport, notes=motifAvarie, venteId`

Update `Vente.poidsLivreKg` (agrégat) et `Vente.quantiteLivree` (= somme LigneVente.nombrePoissons post-update). Statut → LIVREE.

Guard `verifyAssignationInvariant` en fin de transaction (déjà en place, compatible car les MORTALITE sont comptées correctement).

### AV.3 — API route

**Fichier** : `src/app/api/ventes/[id]/livraison/route.ts` (ou route existante à étendre)

POST avec le nouveau DTO. Permission `VENTES_LIVRER`.

Retrocompatibilité : si l'ancien DTO (`poidsLivreKg` sans champ `lignes`) est envoyé, accepter et supposer `nombreMortsTransport = 0` pour toutes les lignes. Log un warning « conversion automatique désactivée » pour repérer les intégrations à mettre à jour.

### AV.4 — UI dialog livraison enrichi

**Fichier** : `src/components/ventes/livraison-vente-dialog.tsx` (nouveau ou extension)

Formulaire à la livraison :
- Header : « Marquer VTE-XXXX comme livrée »
- Une carte par ligne de vente :
  - Bac source (readonly) + quantité commandée (readonly)
  - Input **« Poids livré (kg) »** (défaut = poids commandé, pré-rempli)
  - Input **« Poissons morts en transport »** (défaut 0, borne = quantité commandée)
  - Input **« Motif »** (texte libre optionnel, ex. « chaleur excessive »)
- Sous chaque carte : petit label calculé « perte poids ≈ X kg » (info, non éditable)
- Footer : total livré / commandé (kg) + total morts transport agrégé
- Bouton « Confirmer livraison »

Design mobile-first (patterns DV / VA existants).

### AV.5 — Rapports & stats

**Fichiers** : PDF rapport général vague + dashboard finances + coût-production-card

- Séparer visuellement dans le rapport « Mortalités » : élevage vs transport (via `causeMortalite`)
- La ligne « Perte poids transport » = `∑ (LigneVente.poidsTotalKg − LigneVente.poidsLivreKg) WHERE poidsLivreKg IS NOT NULL`
- Ligne « Mortalité transport » = `∑ Releve.nombreMorts WHERE causeMortalite=AVARIE`
- Le taux de survie global reste unique (formule SV inchangée)

### AV.6 — 🔴 CRITIQUE — Migration data prod : purger les MORTALITE fictifs

**Fichier** : `prisma/migrations/{ts}_purge_morts_avarie_auto/migration.sql`

**Contexte** : le code `livrerVente` actuel a créé automatiquement des MORTALITE cause=AVARIE avec `venteId` non-null à chaque livraison où `poidsLivré < poidsCommandé`. Ces morts sont fictifs (calculés depuis une perte de poids) → à supprimer.

**Identification** : `Releve WHERE typeReleve=MORTALITE AND causeMortalite=AVARIE AND venteId IS NOT NULL`. Ce sont très probablement TOUS des faux positifs (jamais saisis manuellement par l'utilisateur — le UI n'exposait pas ce champ).

**Actions dans la migration** :
1. **Audit préalable** (log via `RAISE NOTICE` ou table temporaire) : compte total + par vague
2. **DELETE** ces relevés (préserver les MORTALITE cause=AVARIE SANS venteId, qui pourraient être des saisies manuelles légitimes)
3. **Ne PAS toucher** aux relevés VENTE (leur `nombreVendus` a été update à `quantitéLivrée` — reste correct)

**Note** : la migration est destructive → doit être écrite avec précaution. Documenter précisément ce qui est supprimé dans un commentaire SQL. Idempotent (rejouable sans re-suppression car les relevés seront déjà partis).

**Effet post-migration** :
- Toutes les vagues ayant eu des ventes voient leur `totalMortalites` diminuer
- Le taux de survie remonte automatiquement
- La biomasse actuelle reste inchangée (les morts fictifs ne décrémentaient déjà PAS le bac source dans le code — voir `nombreMorts` avarie sans update `AssignationBac`)

### AV.7 — Tests + Review R1-R9

**Fichier** : `src/__tests__/livraison-avarie.test.ts` (nouveau)

Cas obligatoires :
1. Livraison avec `poidsLivré < poidsCommandé` MAIS `nombreMortsTransport = 0` → **AUCUN MORTALITE créé** (régression du bug)
2. Livraison avec `nombreMortsTransport = 5` → un MORTALITE cause=AVARIE avec `nombreMorts=5` créé + LigneVente.nombrePoissons décrémenté de 5 + relevé VENTE mis à jour
3. Livraison avec les deux (5 morts + 3 kg perdus déshydratation) → 1 MORTALITE(5) + `poidsLivreKg` reflète la perte (aucun mort fictif supplémentaire)
4. `nombreMortsTransport > quantitéCommandée` → ValidationError
5. Guard invariant respecté
6. Audit `ReleveModification` créé pour l'update VENTE

Extension E2E `conservation-flow.spec.ts` optionnelle.

Review R1-R9.

## Dépendances

```
AV.1 (schema léger) ─► AV.2 (query refonte) ─► AV.3 (API) ─► AV.4 (UI)
                                                                │
                                                                ▼
                                                             AV.5 (rapports)
                                                                │
                                                                ▼
                                              AV.6 (migration prod) ─► AV.7 (tests + review)
```

## Agents

- **AV.1** : @db-specialist (schema + migration)
- **AV.2** : @developer (query refonte, retrait auto-calc)
- **AV.3** : @developer (API + rétrocompat)
- **AV.4** : @developer (dialog UI)
- **AV.5** : @developer (rapports)
- **AV.6** : @db-specialist (migration critique + audit prod)
- **AV.7** : @tester + @code-reviewer

## Définition de fait

- [ ] Auto-conversion kg → morts SUPPRIMÉE de `livrerVente`
- [ ] Nouveau flow saisie manuelle `nombreMortsTransport` + `motifAvarie`
- [ ] UI livraison propose 3 champs par ligne
- [ ] Migration prod purge les MORTALITE AVARIE fictifs (`venteId` non-null)
- [ ] Rapports séparent avarie transport / élevage sans doubler la métrique
- [ ] Tests unit 6/6 verts + régression bug conversion
- [ ] `npx tsc --noEmit` clean + `npm run build` OK
- [ ] Review R1-R9 signée
- [ ] Un commit par story + push

## Impact prod attendu (après deploy)

- **Toutes les vagues avec ventes livrées voient leur taux de survie remonter** (les faux morts avarie sont purgés)
- Les rapports PDF de ces vagues reflètent la réalité biologique (pas de mortalité fictive gonflée par la logistique)
- Le CA / la marge nette restent identiques (calculés sur `poidsLivreKg`, DV.0 inchangé)
- L'utilisateur peut désormais saisir explicitement les vraies morts transport quand elles arrivent

## Hors-scope

- Alertes sur perte transport excessive (> 5%) — sprint séparé si besoin
- Multi-transporteur / suivi logistique — chantier séparé
- Backfill « peut-être c'était des vraies morts » — l'utilisateur ré-saisira au cas par cas si nécessaire (la donnée fictive était non-fiable de toute façon)
