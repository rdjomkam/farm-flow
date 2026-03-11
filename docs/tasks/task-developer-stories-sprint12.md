# Tâche @developer — Sprint 12 — Stories 12.2 à 12.7

**Date :** 2026-03-11
**Assigné par :** @project-manager
**Priorité :** Haute — commence après que docs/decisions/006-export-pdf-excel.md existe

## Prérequis

Avant de commencer :
1. Vérifier que docs/decisions/006-export-pdf-excel.md existe (créé par @architect)
2. Vérifier que src/types/export.ts existe
3. Lire ces deux fichiers + CLAUDE.md

## Story 12.2 — Infrastructure PDF

### Installation de la lib PDF

Vérifier d'abord si @react-pdf/renderer est déjà installé :
```bash
cat package.json | grep react-pdf
```

Si non installé :
```bash
npm install @react-pdf/renderer
```

### Créer src/lib/export/pdf-facture.ts

Template facture PDF. Utiliser le DTO `CreateFacturePDFDTO` de src/types/export.ts.

Structure du document React PDF :
```typescript
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { CreateFacturePDFDTO } from '@/types/export';

// Styles
const styles = StyleSheet.create({...});

// Component
export function FacturePDF({ data }: { data: CreateFacturePDFDTO }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* En-tête */}
        {/* Infos client */}
        {/* Tableau lignes */}
        {/* Totaux */}
        {/* Statut paiement */}
      </Page>
    </Document>
  );
}
```

Contenu minimum :
- En-tête : "FACTURE N° {numero}", date émission, date échéance
- Site/Ferme : nom du site
- Client : nom, téléphone/email
- Tableau : Poissons, {quantitePoissons} kg, {prixUnitaireKg} FCFA/kg, {montantTotal} FCFA
- Section paiements : montant payé, solde restant
- Statut : badge textuel (PAYÉE, ENVOYÉE, etc.)

### Créer src/lib/export/pdf-rapport-vague.ts

Template rapport vague. Utiliser `CreateRapportVaguePDFDTO`.

Contenu :
- Titre : "RAPPORT DE VAGUE — {code}"
- Période : {dateDebut} → {dateFin || "En cours"}
- Indicateurs KPI en tableau : Survie, FCR, SGR, Biomasse, Poids Moyen
- Liste des relevés (date, type, données principales)

### Créer src/lib/export/pdf-rapport-financier.ts

Template rapport financier. Utiliser `CreateRapportFinancierPDFDTO`.

Contenu :
- Titre : "RAPPORT FINANCIER — {periode}"
- KPIs : Revenus, Coûts, Marge brute, Taux de marge
- Tableau ventes par vague
- Top clients

---

## Story 12.3 — Infrastructure Excel

### Installation xlsx

```bash
npm install xlsx
```

### Créer src/lib/export/excel-releves.ts

```typescript
import * as XLSX from 'xlsx';
import type { ExportRelevesExcelDTO } from '@/types/export';

export function genererExcelReleves(data: ExportRelevesExcelDTO): Buffer {
  const wb = XLSX.utils.book_new();
  // Headers en français
  const headers = ['Date', 'Type', 'Vague', 'Bac', 'Poids Moyen (g)', ...];
  // Data rows
  const rows = data.releves.map(r => [...]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Relevés');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
```

### Créer src/lib/export/excel-stock.ts

Headers : Date, Produit, Catégorie, Unité, Type Mouvement, Quantité, Prix Total (FCFA), Vague, N° Commande

### Créer src/lib/export/excel-ventes.ts

Headers : N° Vente, Date, Client, Vague, Qté Poissons, Poids Total (kg), Prix/kg (FCFA), Montant Total (FCFA), Statut Facture

---

## Story 12.4 — API routes export

Créer src/app/api/export/ avec les routes suivantes.
Auth obligatoire (requirePermission) + siteId sur toutes les routes.

### GET /api/export/facture/[id]

```typescript
// src/app/api/export/facture/[id]/route.ts
import { getFactureById } from '@/lib/queries/factures';
import { FacturePDF } from '@/lib/export/pdf-facture';
import { renderToBuffer } from '@react-pdf/renderer';

export async function GET(request, { params }) {
  const auth = await requirePermission(request, Permission.FINANCES_VOIR);
  const { id } = await params;
  const facture = await getFactureById(auth.activeSiteId, id);
  if (!facture) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

  // Construire le DTO
  const dto: CreateFacturePDFDTO = { ... };

  const buffer = await renderToBuffer(<FacturePDF data={dto} />);
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="facture-${facture.numero}.pdf"`
    }
  });
}
```

### GET /api/export/vague/[id]

Même pattern, génère pdf-rapport-vague avec getVagueById + getIndicateursVague.
Permission : Permission.VAGUES_VOIR

### GET /api/export/finances

Génère pdf-rapport-financier avec getResumeFinancier(siteId, filters).
Query params : dateFrom, dateTo
Permission : Permission.FINANCES_VOIR

### GET /api/export/releves

Génère Excel relevés. Query params : vagueId?, dateFrom?, dateTo?, typeReleve?
Permission : Permission.RELEVES_VOIR
Retourne : `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
Content-Disposition : `attachment; filename="releves-${new Date().toISOString().slice(0,10)}.xlsx"`

### GET /api/export/stock

Génère Excel mouvements stock. Query params : dateFrom?, dateTo?
Permission : Permission.STOCK_VOIR (ou STOCK_GERER)

### GET /api/export/ventes

Génère Excel ventes. Query params : dateFrom?, dateTo?
Permission : Permission.VENTES_VOIR

---

## Story 12.5 — UI export (boutons sur les pages concernées)

### Page /factures/[id]

Ajouter un bouton "Télécharger PDF" qui appelle GET /api/export/facture/[id].

```tsx
async function handleExportPDF() {
  const res = await fetch(`/api/export/facture/${factureId}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `facture-${numero}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Page /vagues/[id]

Ajouter bouton "Exporter PDF" pour le rapport de vague.

### Page /finances

Ajouter bouton "Rapport PDF" (finances) + bouton "Export Excel ventes".

### Page /releves (ou filtre sur /vagues/[id])

Ajouter bouton "Export Excel" pour les relevés de la vague courante.

### Page /stock/mouvements

Ajouter bouton "Export Excel" pour les mouvements.

**Note mobile-first :** Les boutons export sont des boutons secondaires (variant="outline"), taille min 44px, placés en haut de page à côté du titre ou dans un menu d'actions.

---

## Story 12.6 — Vérification navigation

Vérifier que tous les modules sont accessibles depuis hamburger + sidebar.
Lire src/components/layout/hamburger-menu.tsx, sidebar.tsx, bottom-nav.tsx.

Modules à vérifier : Alertes, Planning, Finances, Analytiques, Export (si bouton nav pertinent).

Corriger toute entrée manquante ou mal libellée.
Desktop sidebar : groupes cohérents.

---

## Story 12.7 — Polish

1. Corriger M4 dans member-actions-dialog.tsx (si pas déjà fait dans bug fixes)
2. Corriger M5 dans releves/route.ts (si pas déjà fait)
3. Corriger S3 dans member-actions-dialog.tsx (si pas déjà fait)
4. Audit accessibilité pages Sprint 11-12 : aria-labels sur icônes sans texte, focus visible
5. Lazy loading Recharts : s'assurer que tous les graphiques utilisent dynamic import avec `ssr: false`

---

## Vérification finale

```bash
npx vitest run 2>&1 | tail -5
npm run build 2>&1 | tail -10
```

Base attendue : 905+ tests passent, build OK.

## Mise à jour TASKS.md

Pour chaque story terminée (12.2 à 12.7) :
- Cocher toutes les tâches [x] FAIT
- Changer le statut → FAIT
- Ajouter commentaire `<!-- Story 12.X FAIT le 2026-03-11. @developer. -->`
