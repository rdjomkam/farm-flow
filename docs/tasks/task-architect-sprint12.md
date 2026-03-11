# Tâche @architect — Sprint 12 — Story 12.1

**Date :** 2026-03-11
**Assigné par :** @project-manager
**Priorité :** Haute — BLOQUE les stories 12.2 et 12.3

## Contexte

Tu es l'ARCHITECTE du projet Suivi Silures. Sprint 12 = Export PDF/Excel + Polish + Navigation.

Avant de commencer, lis impérativement :
- CLAUDE.md (règles R1-R9, conventions)
- prisma/schema.prisma (modèles existants : Vague, Releve, Facture, Vente, MouvementStock...)
- src/types/models.ts (interfaces TypeScript existantes)
- src/types/api.ts (DTOs existants)
- docs/TASKS.md (Story 12.1)

## Travail à réaliser

### 1. Créer docs/decisions/006-export-pdf-excel.md

Structure obligatoire :
```
# ADR 006 — Export PDF et Excel

## Contexte
[Pourquoi on a besoin d'export]

## Décisions

### PDF : @react-pdf/renderer
Choix : @react-pdf/renderer (recommandé pour Next.js/React — composants JSX)
Pourquoi pas jspdf : API bas niveau, moins adapté au style React moderne

### Excel : xlsx (SheetJS)
Choix : xlsx — standard industrie, zero dépendance, supporte .xlsx natif

## Templates PDF

### Template Facture
- En-tête : logo/nom ferme, N° facture, date émission/échéance
- Client : nom, email, téléphone, adresse
- Tableau : produit (poissons), quantité, prix unitaire, total
- Totaux : sous-total, montant payé, solde restant
- Statut facture, mode de paiement

### Template Rapport Vague
- En-tête : code vague, dates début/fin, site
- KPIs : survie (%), FCR, SGR, biomasse totale, poids moyen
- Tableau : liste des relevés (date, type, données clés)
- Graphique : évolution poids moyen (optionnel en Phase 1)

### Template Rapport Financier
- Période couverte, site
- KPIs : revenus, coûts, marge, taux de marge
- Tableau ventes par vague
- Top clients
- Évolution revenus/coûts par mois

## Templates Excel

### Export Relevés
Colonnes : Date, Type, Vague, Bac, Poids Moyen, Taille Moyenne, Nbr Morts,
           Cause Mort, Qté Aliment, Type Aliment, Temp, pH, O2, NH3, Nbr Compté, Méthode, Notes

### Export Stock (Mouvements)
Colonnes : Date, Produit, Catégorie, Type (ENTREE/SORTIE), Quantité, Prix Total, Vague, Commande

### Export Ventes
Colonnes : N° Vente, Date, Client, Vague, Qté Poissons, Poids Total (kg), Prix/kg, Montant Total
```

### 2. Créer src/types/export.ts

Fichier TypeScript avec les DTOs export. Utilise les imports depuis @/types pour les enums.

```typescript
import type { StatutFacture, ModePaiement } from "@/types";
// ... autres imports nécessaires

/** DTO pour générer une facture en PDF */
export interface CreateFacturePDFDTO { /* ... champs de la facture */ }

/** DTO pour générer un rapport de vague en PDF */
export interface CreateRapportVaguePDFDTO { /* ... */ }

/** DTO pour générer le rapport financier en PDF */
export interface CreateRapportFinancierPDFDTO { /* ... */ }

/** DTO pour exporter les relevés en Excel */
export interface ExportRelevesExcelDTO { /* ... */ }

/** DTO pour exporter les ventes en Excel */
export interface ExportVentesExcelDTO { /* ... */ }

/** DTO pour exporter les mouvements de stock en Excel */
export interface ExportStockExcelDTO { /* ... */ }
```

Chaque DTO doit avoir les champs nécessaires pour le template correspondant.
Utiliser les types des modèles existants (Facture, Vente, Releve, etc.).
Pas d'`any`. Commentaires JSDoc obligatoires.

### 3. Mettre à jour src/types/index.ts

Ajouter le barrel export depuis export.ts.

## Mise à jour TASKS.md

Quand tu as terminé, mets à jour docs/TASKS.md :
- Story 12.1 : remplacer `[ ] \`EN COURS\`` par `[x] \`FAIT\`` pour chaque tâche
- Changer `**Statut :** EN COURS` en `**Statut :** FAIT`
- Ajouter un commentaire `<!-- Story 12.1 FAIT le 2026-03-11. @architect. -->`

## Règles obligatoires

- R1 : Enums MAJUSCULES
- R2 : Importer les enums depuis @/types
- R3 : Types TS alignés avec Prisma
- Commentaires JSDoc sur tous les DTOs
- Aucun `any`
