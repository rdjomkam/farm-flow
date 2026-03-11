# ADR 006 — Export PDF et Excel

**Date :** 2026-03-11
**Auteur :** @architect
**Sprint :** 12
**Statut :** ACCEPTÉ

---

## Contexte

L'application Suivi Silures doit permettre aux pisciculteurs d'exporter leurs données
sous des formats exploitables hors ligne :

- **PDF** : documents officiels remis aux clients (factures) ou archivés (rapports de vague,
  rapport financier mensuel). Ces documents doivent être lisibles sur mobile et imprimables.
- **Excel (.xlsx)** : tableaux de bord opérationnels partagés avec des tiers (comptable,
  financeur, encadreur technique) qui travaillent sous Microsoft Excel ou LibreOffice Calc.

Les contraintes du projet sont :
- Stack **Next.js 14 App Router** côté server (Node.js) et React côté client
- **Mobile first** : les boutons d'export doivent être accessibles dès 360 px
- **Sécurité** : chaque export doit être scopé par `siteId` et nécessiter la permission `EXPORT_DONNEES`
- **Pas de service tiers** : génération en-mémoire côté serveur, pas de SaaS externe

---

## Décisions

### PDF : @react-pdf/renderer

**Choix retenu :** `@react-pdf/renderer`

**Pourquoi pas jspdf + jspdf-autotable :**
- API impérative bas niveau (manipulation de coordonnées x/y) inadaptée à React moderne
- Pas de support natif des composants JSX → code difficile à maintenir
- Gestion des styles CSS limitée, pas de flexbox natif

**Avantages de @react-pdf/renderer :**
- Composants JSX déclaratifs (`<Document>`, `<Page>`, `<View>`, `<Text>`, `<Image>`)
- Sous-ensemble CSS supporté : flexbox, padding, margin, fontSize, color, borderRadius
- Génération côté serveur (Node.js) via `renderToBuffer()` → compatible avec les API routes Next.js
- Rendu cohérent entre serveur et aperçu client (React Portal)
- Typage TypeScript natif inclus

**Mode d'utilisation :**
```ts
// Côté serveur dans src/app/api/export/facture/[id]/route.ts
import { renderToBuffer } from "@react-pdf/renderer";
import { FactureTemplate } from "@/lib/export/pdf-facture";

const buffer = await renderToBuffer(<FactureTemplate data={dto} />);
return new Response(buffer, {
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="facture-${numero}.pdf"`,
  },
});
```

---

### Excel : xlsx (SheetJS Community Edition)

**Choix retenu :** `xlsx` (package npm officiel SheetJS CE)

**Pourquoi xlsx :**
- Standard de l'industrie, >40 M téléchargements/semaine
- Zéro dépendance transitive
- Génération `.xlsx` natif (OpenXML) sans Microsoft Office installé
- API simple : `XLSX.utils.aoa_to_sheet()`, `XLSX.utils.book_append_sheet()`, `XLSX.write()`
- Compatible Node.js et navigateur (possible futur export côté client)

**Mode d'utilisation :**
```ts
// Côté serveur dans src/app/api/export/releves/route.ts
import * as XLSX from "xlsx";

const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Relevés");
const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

return new Response(buffer, {
  headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": 'attachment; filename="releves.xlsx"',
  },
});
```

---

## Templates PDF

### Template Facture (`pdf-facture.ts`)

Structure visuelle (mobile A4 portrait) :

```
┌─────────────────────────────────────────────┐
│  [LOGO/NOM FERME]          N° FAC-2026-001  │
│  Adresse du site           Date émission    │
│                            Date échéance    │
├─────────────────────────────────────────────┤
│  FACTURÉ À :                                │
│  Nom client                                 │
│  Téléphone | Email                          │
│  Adresse                                    │
├─────────────────────────────────────────────┤
│  Désignation | Qté | Prix/kg | Total        │
│  Silures (vague VAG-...)  X kg  Y FCFA  Z   │
├─────────────────────────────────────────────┤
│  Sous-total :                     Z FCFA    │
│  Montant payé :                   A FCFA    │
│  Solde restant :                  B FCFA    │
├─────────────────────────────────────────────┤
│  Statut : PAYÉE | EN ATTENTE | PARTIEL      │
│  Mode(s) de paiement : ESPÈCES / MTN Money  │
└─────────────────────────────────────────────┘
```

**Champs requis (→ `CreateFacturePDFDTO`) :**
- En-tête : nom du site, adresse du site, logo optionnel
- Facture : numéro, date émission, date échéance
- Client : nom, email, téléphone, adresse
- Vente : désignation (poissons + code vague), quantité poissons, poids total kg, prix/kg
- Totaux : montant total, montant payé, solde restant
- Statut facture, liste des paiements (mode, référence, date, montant)

---

### Template Rapport Vague (`pdf-rapport-vague.ts`)

Structure visuelle :

```
┌─────────────────────────────────────────────┐
│  RAPPORT DE VAGUE — VAG-2026-001            │
│  Site : Ferme DK Farm                       │
│  Période : 01/01/2026 → 31/03/2026          │
├─────────────────────────────────────────────┤
│  KPIs                                       │
│  Taux survie : 87,5 %                       │
│  FCR : 1,42                                 │
│  SGR : 2,1 %/jour                           │
│  Biomasse totale : 245,6 kg                 │
│  Poids moyen final : 387 g                  │
├─────────────────────────────────────────────┤
│  RELEVÉS (tableau)                          │
│  Date | Type | Bac | Données clés | Notes   │
│  ...                                        │
├─────────────────────────────────────────────┤
│  [Graphique évolution poids — optionnel]    │
└─────────────────────────────────────────────┘
```

**Champs requis (→ `CreateRapportVaguePDFDTO`) :**
- En-tête : code vague, site name, dates début/fin, statut
- KPIs : tauxSurvie, fcr, sgr, biomasseTotale, poidsMoyenFinal, nombreActuel
- Bacs : liste des bacs avec leur volume et nombre de poissons
- Relevés : tableau de tous les relevés avec date, type et champs clés selon le type
- Graphique évolution poids (points date/poids — optionnel Phase 1)

---

### Template Rapport Financier (`pdf-rapport-financier.ts`)

Structure visuelle :

```
┌─────────────────────────────────────────────┐
│  RAPPORT FINANCIER — Janv.-Mars 2026        │
│  Site : Ferme DK Farm                       │
├─────────────────────────────────────────────┤
│  KPIs GLOBAUX                               │
│  Revenus : 1 250 000 FCFA                   │
│  Coûts aliment : 432 000 FCFA               │
│  Marge brute : 818 000 FCFA  (65,4 %)       │
├─────────────────────────────────────────────┤
│  VENTES PAR VAGUE                           │
│  Vague | Qté kg | Montant | Nb ventes       │
│  ...                                        │
├─────────────────────────────────────────────┤
│  TOP CLIENTS                                │
│  Client | Nb achats | Montant total         │
│  ...                                        │
├─────────────────────────────────────────────┤
│  ÉVOLUTION MENSUELLE                        │
│  Mois | Revenus | Coûts | Marge             │
│  ...                                        │
└─────────────────────────────────────────────┘
```

**Champs requis (→ `CreateRapportFinancierPDFDTO`) :**
- En-tête : site name, période (dateDebut, dateFin)
- KPIs globaux : revenus total, coûts total, margeNette, tauxMarge
- Ventes par vague : code vague, quantitéKg, montant, nombre de ventes
- Top clients : nom client, montantTotal, nombreAchats
- Évolution mensuelle : tableau par mois (revenus, coûts, marge)

---

## Templates Excel

### Export Relevés (`excel-releves.ts`)

Feuille : `Relevés`

| Colonne | Type | Description |
|---------|------|-------------|
| Date | Date FR (dd/mm/yyyy) | Date du relevé |
| Type | String | BIOMETRIE, MORTALITE… |
| Vague | String | Code vague |
| Bac | String | Nom du bac |
| Poids Moyen (g) | Number? | Biométrie uniquement |
| Taille Moyenne (cm) | Number? | Biométrie uniquement |
| Nbr Morts | Number? | Mortalité uniquement |
| Cause Mort | String? | Mortalité uniquement |
| Qté Aliment (kg) | Number? | Alimentation uniquement |
| Type Aliment | String? | Alimentation uniquement |
| Température (°C) | Number? | Qualité eau uniquement |
| pH | Number? | Qualité eau uniquement |
| O2 (mg/L) | Number? | Qualité eau uniquement |
| NH3 (mg/L) | Number? | Qualité eau uniquement |
| Nbr Compté | Number? | Comptage uniquement |
| Méthode Comptage | String? | Comptage uniquement |
| Notes | String? | Tous types |

**Champs requis (→ `ExportRelevesExcelDTO`) :**
- Filtres : vagueId optionnel, dateDebut, dateFin, siteId
- Lignes : tableau de `ReleveExcelRow` (tous les champs du modèle Releve + nom du bac + code vague)

---

### Export Stock — Mouvements (`excel-stock.ts`)

Feuille : `Mouvements Stock`

| Colonne | Type | Description |
|---------|------|-------------|
| Date | Date FR | Date du mouvement |
| Produit | String | Nom du produit |
| Catégorie | String | ALIMENT, INTRANT, EQUIPEMENT |
| Type | String | ENTREE / SORTIE |
| Quantité | Number | Quantité mouvementée |
| Unité | String | KG, LITRE, UNITE, SACS |
| Prix Total (FCFA) | Number? | Coût total du mouvement |
| Vague | String? | Code vague si sortie aliment |
| Commande | String? | Numéro commande si entrée livraison |
| Notes | String? | Notes libres |

**Champs requis (→ `ExportStockExcelDTO`) :**
- Filtres : produitId optionnel, type optionnel, dateDebut, dateFin, siteId
- Lignes : tableau de `MouvementExcelRow`

---

### Export Ventes (`excel-ventes.ts`)

Feuille : `Ventes`

| Colonne | Type | Description |
|---------|------|-------------|
| N° Vente | String | Numéro unique (VTE-2026-001) |
| Date | Date FR | Date de la vente |
| Client | String | Nom du client |
| Vague | String | Code vague |
| Qté Poissons | Number | Nombre de poissons vendus |
| Poids Total (kg) | Number | Poids total en kg |
| Prix/kg (FCFA) | Number | Prix unitaire par kg |
| Montant Total (FCFA) | Number | Montant total de la vente |
| Statut Facture | String? | Statut si facture générée |
| Notes | String? | Notes libres |

**Champs requis (→ `ExportVentesExcelDTO`) :**
- Filtres : clientId optionnel, vagueId optionnel, dateDebut, dateFin, siteId
- Lignes : tableau de `VenteExcelRow`

---

## Routes API d'export

| Méthode | Route | Libraire | Permission |
|---------|-------|----------|------------|
| GET | `/api/export/facture/[id]` | @react-pdf/renderer | `FACTURES_VOIR` + `EXPORT_DONNEES` |
| GET | `/api/export/vague/[id]` | @react-pdf/renderer | `VAGUES_VOIR` + `EXPORT_DONNEES` |
| GET | `/api/export/finances` | @react-pdf/renderer | `FINANCES_VOIR` + `EXPORT_DONNEES` |
| GET | `/api/export/releves` | xlsx | `RELEVES_VOIR` + `EXPORT_DONNEES` |
| GET | `/api/export/stock` | xlsx | `STOCK_VOIR` + `EXPORT_DONNEES` |
| GET | `/api/export/ventes` | xlsx | `VENTES_VOIR` + `EXPORT_DONNEES` |

**Headers de réponse communs :**
- PDF : `Content-Type: application/pdf`
- Excel : `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Toujours inclure `Content-Disposition: attachment; filename="..."` pour forcer le téléchargement

---

## Alternatives considérées et rejetées

| Option | Raison du rejet |
|--------|-----------------|
| jspdf | API bas niveau, pas de composants JSX, styles limités |
| Puppeteer / html-to-pdf | Requiert Chromium embarqué (>100 MB), trop lourd pour le déploiement Vercel/Railway |
| pdfmake | Moins adapté à React, pas de JSX |
| exceljs | Plus lourd que xlsx pour notre usage (coloration avancée non requise) |
| Génération côté client | Risque d'erreurs sur appareils mobiles bas de gamme (Cameroun), sécurité insuffisante |

---

## Décisions liées

- ADR 001 : Structure projet (src/lib/export/ pour les helpers)
- ADR 003 : API Routes (schéma des routes export)
- ADR 004 : Multi-tenancy (siteId obligatoire sur tous les exports)
- ADR 005 : Authentification (permission `EXPORT_DONNEES` requise)

---

## Implémentation — Ordre recommandé

1. **Story 12.1** (ce doc) — ADR + types `src/types/export.ts` ← @architect ✅
2. **Story 12.2** — Templates PDF (`src/lib/export/pdf-*.ts`) ← @developer
3. **Story 12.3** — Templates Excel (`src/lib/export/excel-*.ts`) ← @developer
4. **Story 12.4** — API routes (`/api/export/...`) ← @developer
5. **Story 12.5** — UI : boutons + dialogs export ← @developer
6. **Story 12.8** — Tests complets ← @tester
