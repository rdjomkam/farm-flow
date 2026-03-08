# Review Sprint 4 — Pages métier (Vagues, Relevés, Bacs)

**Date :** 2026-03-08
**Reviewer :** @code-reviewer
**Fichiers analysés :** 18 composants/pages + 4 fichiers de tests (48 tests)

---

## Checklist

| Critère | Résultat |
|---------|----------|
| TypeScript strict (pas de `any`) | OK |
| Mobile first (360px → sm → md → lg) | OK |
| Radix UI pour composants interactifs | OK (Dialog, Select, Tabs, Toast) |
| Taille tactile 44px minimum | OK |
| Server Components par défaut | OK |
| "use client" justifié | OK (7 composants clients, tous justifiés) |
| Validation côté client | OK |
| Gestion d'erreurs (try/catch, toast) | OK |
| Pas de secrets en dur | OK |
| Noms en anglais, UI en français | OK |
| Enums utilisés (pas de string literals) | PARTIEL (voir I1) |
| Recharts responsive | OK |
| Switch dynamique par type de relevé | OK |
| Tests UI | OK (48/48 passent) |

---

## Fichiers analysés

### Pages (Server Components)
- `src/app/vagues/page.tsx` — Promise.all pour chargement parallèle
- `src/app/vagues/[id]/page.tsx` — Promise.all, notFound(), indicateurs
- `src/app/releves/nouveau/page.tsx` — Filtre vagues EN_COURS via enum
- `src/app/bacs/page.tsx` — Fetch simple getBacs()

### Composants clients ("use client" justifié)
- `src/components/vagues/vagues-list-client.tsx` — useState, Tabs, Dialog, fetch
- `src/components/vagues/poids-chart.tsx` — Recharts (client-only)
- `src/components/vagues/releves-list.tsx` — useState pour onglet filtrage
- `src/components/vagues/cloturer-dialog.tsx` — useState, Dialog, fetch PUT
- `src/components/releves/releve-form-client.tsx` — useState, useEffect, fetch
- `src/components/bacs/bacs-list-client.tsx` — useState, Dialog, fetch

### Composants serveur (pas de "use client")
- `src/components/vagues/vague-card.tsx` — Card + Link, enums
- `src/components/vagues/indicateurs-cards.tsx` — 5 KPIs en grille
- `src/components/releves/form-biometrie.tsx` — 3 Inputs
- `src/components/releves/form-mortalite.tsx` — Input + Select
- `src/components/releves/form-alimentation.tsx` — Input + Select + Input
- `src/components/releves/form-qualite-eau.tsx` — 4 Inputs (optionnels)
- `src/components/releves/form-comptage.tsx` — Input + Select
- `src/components/releves/form-observation.tsx` — Textarea

### Tests UI (4 fichiers, 48 tests)
- `src/__tests__/ui/bacs-page.test.tsx` — 10 tests (affichage + formulaire)
- `src/__tests__/ui/vagues-page.test.tsx` — 18 tests (liste, filtres, carte, indicateurs)
- `src/__tests__/ui/releves-form.test.tsx` — 6 tests (affichage + validation)
- `src/__tests__/ui/responsive.test.tsx` — 14 tests (responsive, tactile, badges, grilles)

---

## Problèmes identifiés

### I1 — Important : String literal au lieu de l'enum StatutVague

**Fichier :** `src/components/vagues/cloturer-dialog.tsx:38`
**Problème :** Le body du PUT utilise `statut: "TERMINEE"` en string literal.
```ts
body: JSON.stringify({ statut: "TERMINEE", dateFin }),
```
**Pourquoi c'est important :** Ce pattern a été corrigé dans le Sprint 2 (correction I1) pour toutes les API routes. L'import de `StatutVague` et l'utilisation de `StatutVague.TERMINEE` garantissent la cohérence et la sécurité de type. Si l'enum change, ce string ne suivra pas.
**Suggestion :**
```ts
import { StatutVague } from "@/types";
// ...
body: JSON.stringify({ statut: StatutVague.TERMINEE, dateFin }),
```

### I2 — Important : Dialog sans DialogTrigger (accessibilité)

**Fichiers :**
- `src/components/vagues/vagues-list-client.tsx:136-137`
- `src/components/bacs/bacs-list-client.tsx:84-85`

**Problème :** Le bouton d'ouverture du Dialog est un simple `<Button onClick>` à l'intérieur de `<Dialog>`, sans être wrappé par `<DialogTrigger asChild>`. Radix Dialog ne peut pas ajouter les attributs ARIA (`aria-haspopup="dialog"`, `aria-expanded`) ni gérer correctement le retour du focus à la fermeture.
**Comparaison :** `cloturer-dialog.tsx` utilise correctement `<DialogTrigger asChild>`.
**Suggestion :**
```tsx
<Dialog open={dialogOpen} onOpenChange={...}>
  <DialogTrigger asChild>
    <Button size="sm">
      <Plus className="h-4 w-4" />
      Nouveau bac
    </Button>
  </DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>
```

---

### M1 — Mineur : Couleurs hardcodées dans le graphique

**Fichier :** `src/components/vagues/poids-chart.tsx:44,62`
**Problème :** Les couleurs `stroke="#0d9488"` (primary) et `stroke="#e2e8f0"` (grid) sont en dur au lieu d'utiliser les CSS variables du système de design tokens (`--primary`, `--border`).
**Impact :** Si le thème change, ces couleurs ne suivront pas.

### M2 — Mineur : Badge "en_cours" pour statut "Libre"

**Fichier :** `src/components/bacs/bacs-list-client.tsx:147`
**Problème :** `<Badge variant="en_cours">Libre</Badge>` — la variante "en_cours" signifie "en cours" dans le contexte des vagues, pas "disponible/libre". Un badge "default" ou "info" serait plus sémantique.
**Note :** Déjà signalé en Sprint 3 (M3), toujours présent.

### M3 — Mineur : Textarea brut sans composant UI

**Fichier :** `src/components/releves/form-observation.tsx:15-28`
**Problème :** Utilise un `<textarea>` HTML natif avec des classes Tailwind manuelles, tandis que tous les autres champs de formulaire utilisent les composants `<Input>` ou `<Select>` du dossier `ui/`. Un composant `<Textarea>` devrait être créé dans `src/components/ui/` pour la cohérence.

---

### S1 — Suggestion : Typage loose des champs de relevé

**Fichier :** `src/components/releves/releve-form-client.tsx:54`
**Problème :** L'état `fields` est typé `Record<string, string>`, ce qui ne garantit pas que les noms de champs correspondent aux types de relevé attendus. Un typage par type de relevé (discriminated union ou Record spécifique) détecterait les fautes de frappe à la compilation.

### S2 — Suggestion : Tests responsive sur strings hardcodés

**Fichier :** `src/__tests__/ui/responsive.test.tsx:98-124`
**Problème :** Les 3 tests "Grilles mobile first" vérifient des constantes string, pas des classes réellement rendues par les composants. Ces tests passent toujours, même si les composants changent leurs classes de grille. Recommandation : tester sur des composants rendus comme les autres tests du fichier.

---

## Points positifs

1. **Server Components par défaut** — Les 4 pages et 7 sous-composants sont des Server Components. Seuls les composants avec state/interactivité sont "use client". Excellent.
2. **Mobile first cohérent** — Grilles sans colonnes fixes sur mobile (`grid gap-3 md:grid-cols-2 lg:grid-cols-3`), Dialog plein écran mobile / centré desktop, zones tactiles 44px+.
3. **Radix UI bien intégré** — Dialog, Select, Tabs, Toast utilisés partout pour les composants interactifs. `cloturer-dialog.tsx` est un modèle d'utilisation correcte avec `DialogTrigger asChild`.
4. **Enums correctement utilisés** — `StatutVague`, `TypeReleve`, `CauseMortalite`, `TypeAliment`, `MethodeComptage` importés et utilisés dans les Records typés. Exception : I1.
5. **Validation exhaustive** — Le formulaire de relevé valide chaque type (biométrie, mortalité, alimentation, comptage, observation) avec des règles spécifiques. Formulaires bacs et vagues également validés.
6. **Gestion d'erreurs systématique** — Tous les fetch dans try/catch, toast success/error, gestion du réseau.
7. **Switch dynamique** — `ReleveDetails` dans releves-list.tsx et les 6 sous-formulaires dans releve-form-client.tsx implémentent correctement le switch par type de relevé.
8. **Recharts responsive** — `ResponsiveContainer` avec `width="100%"` et `height="100%"`, empty state géré.
9. **Tests solides** — 48 tests couvrant affichage, validation, soumission, responsive. Mocks propres pour next/navigation, toast, fetch.

---

## Verdict : VALIDE

Le Sprint 4 est **validé**. Le code est de bonne qualité, mobile first, bien typé et bien testé.

**2 corrections importantes recommandées (I1, I2)** à corriger en priorité dans le Sprint 5 :
- I1 : Remplacer le string literal `"TERMINEE"` par `StatutVague.TERMINEE` dans cloturer-dialog.tsx
- I2 : Wrapper les boutons de création dans `<DialogTrigger asChild>` pour l'accessibilité (vagues-list-client.tsx, bacs-list-client.tsx)

**3 mineurs (M1-M3) et 2 suggestions (S1-S2)** reportés au Sprint 5.
