# ADR — Rapport PDF Consommation Alimentaire (F16)

**Date :** 2026-03-28
**Auteur :** @architect
**Sprint cible :** Sprint 12 (Export PDF/Excel)
**Statut :** DESIGN NEEDED

---

## Contexte

Les pisciculteurs camerounais partagent régulièrement des comptes rendus avec des tiers :
financeurs, encadreurs techniques, groupements coopératifs. Ces interlocuteurs n'ont pas
accès à l'application et opèrent souvent hors ligne (zones à faible connectivité).

Le rapport de consommation alimentaire répond à deux besoins concrets :

1. **Partage offline** : un document imprimable ou envoyé par WhatsApp (PDF) portant le
   résumé de la consommation d'aliment, le FCR et le coût alimentaire d'un cycle.
2. **Impression pour réunions** : les groupements de pisciculteurs organisent des réunions
   mensuelles où chaque membre présente ses résultats. Un PDF structuré facilite cet usage.

Ce rapport est lié à la feature F16 identifiée dans `ADR-feed-analytics-research.md`
(Priorité 3 — COULD-HAVE). La décision architecturale porte sur la librairie à retenir
pour la génération et la structure du document.

---

## Contexte technique

- Stack : Next.js 14 App Router, TypeScript, React Server Components
- Déploiement : Railway / Vercel (pas de serveur dédié avec Chromium)
- Contrainte mobile first : le bouton de génération doit être accessible dès 360 px
- Sécurité : l'export doit être scopé par `siteId` et nécessiter la permission `EXPORT_DONNEES`

---

## Options considérées

### Option 1 — Génération côté client (jsPDF / html2canvas)

**Principe :** La page HTML est capturée en canvas côté navigateur, puis convertie en PDF
par jsPDF.

**Avantages :**
- Aucune dépendance serveur
- Rendu visuel fidèle à l'interface (capture du DOM)

**Inconvénients :**
- Performance dégradée sur appareils bas de gamme (Cameroun) : la génération d'un canvas
  à haute résolution peut bloquer l'UI 2–5 secondes
- html2canvas ne supporte pas tous les styles CSS (flexbox complexe, variables CSS)
- Résolution insuffisante pour l'impression A4 professionnelle
- Sécurité réduite : le contenu est généré côté client, pas scopé par le token serveur
- Taille du PDF non optimisée (image bitmap vs vecteur)

**Verdict : REJETÉ** — trop fragile sur mobile bas de gamme, qualité insuffisante.

---

### Option 2 — Génération côté serveur avec Puppeteer / Playwright

**Principe :** Un serveur Node.js lance un navigateur headless (Chromium), charge la page
HTML et génère le PDF via l'API d'impression du navigateur.

**Avantages :**
- Rendu CSS parfait (Chromium full)
- Support natif des polices, SVG, graphiques Recharts exportés en image

**Inconvénients :**
- Puppeteer embarque Chromium (>100 MB) : incompatible avec les limites de déploiement
  Vercel (50 MB max) et Railway (augmentation significative de l'image Docker)
- Temps de démarrage du navigateur : 2–4 secondes par requête
- Consommation mémoire élevée en production partagée
- Complexité d'intégration avec le App Router Next.js (pas de rendu SSR synchrone d'une
  page entière dans un handler API)

**Verdict : REJETÉ** — trop lourd pour le déploiement ciblé.

---

### Option 3 — Génération côté serveur avec librairie PDF pure (@react-pdf/renderer)

**Principe :** Les composants React décrivent la mise en page du PDF. La librairie les
traduit directement en bytecode PDF (sans navigateur headless) via `renderToBuffer()`.

**Avantages :**
- Aucun navigateur headless requis : génération en Node.js pur
- Composants JSX déclaratifs (`<Document>`, `<Page>`, `<View>`, `<Text>`) cohérents avec
  le reste du code React
- `renderToBuffer()` compatible avec les Route Handlers Next.js App Router
- Typage TypeScript natif inclus
- Taille du bundle serveur raisonnable (<5 MB)
- Déjà retenu dans ADR-006 pour les exports facture et rapport vague

**Inconvénients :**
- Sous-ensemble CSS limité (pas de CSS Grid, position:fixed, etc.)
- Graphiques Recharts non directement exportables : il faut soit les recalculer avec
  `@react-pdf/renderer` SVG primitives, soit les capturer en image PNG côté client et
  passer le data URI au template

**Verdict : RETENU** — cohérence avec ADR-006, stack léger, déployable partout.

---

## Recommandation

**Librairie : `@react-pdf/renderer`**

Cohérente avec ADR-006 (déjà adoptée pour factures et rapport vague). La génération se fait
côté serveur dans un Route Handler Next.js. La limitation sur les graphiques est contournée
par une version simplifiée tabulaire du graphique (voir section Contenu ci-dessous).

---

## Contenu du rapport PDF

### Structure visuelle (A4 portrait)

```
┌──────────────────────────────────────────────────────────┐
│  RAPPORT CONSOMMATION ALIMENTAIRE                        │
│  Vague : VAG-2026-001 — Clarias gariepinus               │
│  Site : Ferme DK Farm                                    │
│  Période : 01/01/2026 → 31/03/2026 (90 jours)            │
├──────────────────────────────────────────────────────────┤
│  INDICATEURS GLOBAUX                                     │
│  FCR : 1,42          ✓ Bon (benchmark < 1,5)             │
│  Consommation totale : 245 kg                            │
│  Coût alimentaire total : 122 500 FCFA                   │
│  Coût par kg de poisson produit : 890 FCFA               │
│  Biomasse initiale : 24 kg — Biomasse finale : 172 kg    │
│  Gain total : +148 kg                                    │
├──────────────────────────────────────────────────────────┤
│  CONSOMMATION PAR ALIMENT                                │
│  Aliment          | Qtité (kg) | % Total | Coût (FCFA)  │
│  Skretting G2 3mm |   80 kg   |  33 %   |  40 000      │
│  Skretting G3 4mm |  120 kg   |  49 %   |  60 000      │
│  PRODAC G4 6mm    |   45 kg   |  18 %   |  22 500      │
├──────────────────────────────────────────────────────────┤
│  ÉVOLUTION HEBDOMADAIRE (tableau simplifié)              │
│  Semaine | Aliment utilisé | Qté (kg) | FCR sem.        │
│  Sem 1   | Skretting G2   |   18 kg  |  1,20           │
│  Sem 2   | Skretting G2   |   20 kg  |  1,35           │
│  ...                                                     │
├──────────────────────────────────────────────────────────┤
│  NOTES ET OBSERVATIONS                                   │
│  [Texte libre — notes issues des relevés de la période]  │
├──────────────────────────────────────────────────────────┤
│  Généré le 28/03/2026 — FarmFlow v2                      │
└──────────────────────────────────────────────────────────┘
```

### Champs requis (DTO `RapportConsommationPDFDTO`)

```typescript
interface RapportConsommationPDFDTO {
  // En-tête
  siteNom: string;
  siteAdresse: string | null;
  vagueCode: string;          // ex. VAG-2026-001
  espece: string;             // ex. Clarias gariepinus
  dateDebut: Date;
  dateFin: Date;
  dureeJours: number;

  // KPIs globaux
  fcr: number | null;
  consommationTotaleKg: number;
  coutAlimentaireTotalFCFA: number;
  coutParKgGainFCFA: number | null;
  biomasseInitialeKg: number | null;
  biomasseFinalKg: number | null;
  gainBiomassKg: number | null;

  // Détail par aliment
  parAliment: {
    nomProduit: string;
    tailleGranule: string | null;   // ex. G2 / 3mm
    quantiteKg: number;
    pourcentageTotal: number;
    coutFCFA: number | null;
    prixUnitaire: number | null;
  }[];

  // Évolution hebdomadaire
  parSemaine: {
    semaine: number;              // numéro de semaine du cycle
    dateDebut: Date;
    aliment: string;              // nom du produit principal
    quantiteKg: number;
    fcrHebdo: number | null;
  }[];

  // Notes
  notes: string | null;
  dateGeneration: Date;
}
```

---

## Contrat API

### Route

```
GET /api/analytics/rapport-consommation
```

### Paramètres de requête

| Paramètre | Type | Obligatoire | Description |
|-----------|------|-------------|-------------|
| `vagueId` | string | Oui | ID de la vague |
| `dateFrom` | string (ISO) | Non | Date de début (défaut : dateDebut de la vague) |
| `dateTo` | string (ISO) | Non | Date de fin (défaut : aujourd'hui) |
| `format` | `pdf` \| `json` | Non | Défaut : `pdf` |

### Réponse (format `pdf`)

```
HTTP 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="rapport-consommation-VAG-2026-001.pdf"

[binary PDF blob]
```

### Réponse (format `json`)

```
HTTP 200 OK
Content-Type: application/json

{ ...RapportConsommationPDFDTO }
```

Le format `json` permet au frontend d'afficher un aperçu avant téléchargement.

### Erreurs

| Code | Cause |
|------|-------|
| 401 | Non authentifié |
| 403 | Permission `EXPORT_DONNEES` manquante ou `siteId` non correspondant |
| 404 | Vague introuvable |
| 422 | `dateFrom` > `dateTo` ou paramètres malformés |

---

## Permissions requises

- `RELEVES_VOIR` (pour accéder aux relevés d'alimentation)
- `EXPORT_DONNEES` (pour la génération du fichier)

Les deux permissions doivent être vérifiées avant la génération.

---

## Emplacement des fichiers

```
src/
  app/
    api/
      analytics/
        rapport-consommation/
          route.ts              ← Route Handler Next.js
  lib/
    export/
      pdf-rapport-consommation.tsx  ← Template @react-pdf/renderer
    queries/
      analytics-consommation.ts     ← Query Prisma pour les données
  types/
    export.ts                   ← Ajouter RapportConsommationPDFDTO
```

---

## Décisions liées

- ADR 006 : Export PDF/Excel — librairie `@react-pdf/renderer` déjà adoptée
- ADR 005 : Authentification — permission `EXPORT_DONNEES`
- ADR 004 : Multi-tenancy — filtre `siteId` obligatoire
- ADR-feed-analytics-research.md — F16 définit ce besoin (Priorité 3)

---

## Sprint cible et ordre d'implémentation

**Sprint 12 — Export PDF/Excel**

1. Ce document (ADR) — @architect
2. DTO `RapportConsommationPDFDTO` dans `src/types/export.ts` — @architect
3. Query `analytics-consommation.ts` — @db-specialist
4. Template PDF `pdf-rapport-consommation.tsx` — @developer
5. Route Handler `/api/analytics/rapport-consommation/route.ts` — @developer
6. Bouton "Exporter PDF" sur la page `/analytics/aliments` — @developer
7. Tests — @tester
