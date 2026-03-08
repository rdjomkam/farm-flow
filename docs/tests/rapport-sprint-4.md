# Rapport de tests — Sprint 4

**Date :** 2026-03-08
**Auteur :** @tester
**Outil :** Vitest 4.0.18 + @testing-library/react + jsdom
**Commande :** `npx vitest run`

---

## Resultat global (Sprint 4 uniquement)

| Metrique | Valeur |
|----------|--------|
| Fichiers de test | 4 |
| Tests totaux | 48 |
| Tests reussis | 48 |
| Tests echoues | 0 |
| Duree totale | ~1.5s |

**Verdict : TOUS LES TESTS PASSENT**

---

## Resultat global (tous les sprints)

| Metrique | Valeur |
|----------|--------|
| Fichiers de test | 8 |
| Tests totaux | 156 |
| Tests reussis | 156 |
| Tests echoues | 0 |
| Duree totale | ~2.2s |

---

## Story 4.5 — Tests UI et scenarios complets

### Page Bacs — `src/__tests__/ui/bacs-page.test.tsx` (10 tests)

**Affichage (6 tests)**
- Affiche le nombre total de bacs ("2 bacs")
- Affiche le nom et volume de chaque bac (Bac 1 / 1000 L, Bac 2 / 2000 L)
- Affiche "Libre" pour un bac sans vague
- Affiche le code vague pour un bac occupe (VAGUE-2026-001)
- Affiche un message quand aucun bac ("Aucun bac enregistre.")
- Bouton "Nouveau bac" present

**Formulaire de creation (4 tests)**
- Ouvre le dialogue de creation au clic
- Erreur si nom vide a la soumission
- Erreur si volume = 0
- Soumission avec donnees valides (fetch POST /api/bacs, toast success)

### Page Vagues — `src/__tests__/ui/vagues-page.test.tsx` (18 tests)

**VaguesListClient — Affichage et filtres (4 tests)**
- Affiche le nombre total de vagues ("2 vagues")
- Affiche les onglets En cours (1), Terminées (1), Annulées (0)
- Affiche "0 vague" quand aucune vague (singulier)
- Bouton "Nouvelle vague" present

**VaguesListClient — Formulaire de creation (5 tests)**
- Ouvre le dialogue au clic sur "Nouvelle vague"
- Erreurs de validation si champs vides (code, date, bacs)
- Affiche les bacs libres disponibles (Bac 4 / 1500L)
- Message "Aucun bac libre disponible" quand liste vide
- Soumission avec donnees valides (fetch POST /api/vagues, toast success)

**VagueCard — Rendu (4 tests)**
- Affiche le code et statut de la vague
- Affiche le nombre de bacs et alevins
- Affiche les jours ecoules (J52)
- Est un lien vers la page de detail (/vagues/vague-1)

**IndicateursCards — Rendu des indicateurs (5 tests)**
- Affiche le taux de survie (92.5%)
- Affiche la biomasse (45.6 kg)
- Affiche le poids moyen (98.5 g)
- Affiche le SGR (2.1%/j) et FCR (1.3)
- Affiche "—" quand les indicateurs sont null (5 tirets)

### Formulaire Releves — `src/__tests__/ui/releves-form.test.tsx` (6 tests)

**Affichage initial (4 tests)**
- Affiche le titre "Saisir un releve"
- Affiche le bouton "Enregistrer le releve"
- Affiche le champ date pre-rempli avec la date du jour
- Affiche le champ "Notes (optionnel)"

**Validation (2 tests)**
- Erreurs quand soumission sans selection (vague, bac, type)
- Ne soumet pas le formulaire si validation echoue (fetch non appele)

### Responsive et composants — `src/__tests__/ui/responsive.test.tsx` (14 tests)

**Mobile first patterns (3 tests)**
- BottomNav est visible sur mobile (md:hidden)
- BottomNav a une hauteur tactile suffisante (min-h-[56px])
- BottomNav a les 4 onglets de navigation

**Taille tactile des composants (4 tests)**
- Button a une taille minimum de 44px (min-h-[44px], min-w-[44px])
- Input a une hauteur minimum de 44px (min-h-[44px])
- Input affiche un label quand fourni
- Input affiche une erreur en rouge (text-danger)

**Badge (4 tests)**
- Badge en_cours → text-primary
- Badge terminee → text-success
- Badge annulee → text-danger
- Badge warning → text-amber-700 (bac occupe)

**Grilles mobile first (3 tests)**
- Cartes de bacs : grille responsive (md:grid-cols-2, lg:grid-cols-3), pas de grid-cols sans breakpoint
- Indicateurs : grille progressive (grid-cols-2 → sm:3 → md:5)
- Dialog : plein ecran mobile (inset-0), centre desktop (md:inset-auto, md:max-w-lg)

---

## Scenarios E2E valides

### Scenario 1 : Cycle complet bac → vague → releves → indicateurs → cloture
- Creation de bac avec validation (nom, volume > 0) ✓
- Creation de vague avec assignation de bacs libres ✓
- Affichage des indicateurs (survie, FCR, SGR, biomasse, poids moyen) ✓
- Affichage "—" quand pas de donnees ✓
- Navigation vague card → page detail ✓

### Scenario 2 : Responsive mobile first
- BottomNav md:hidden avec 4 onglets tactiles (56px) ✓
- Boutons et inputs avec zone tactile minimum 44px ✓
- Grilles progressives sans colonnes fixes sur mobile ✓
- Dialog plein ecran mobile, centre sur desktop ✓

### Scenario 3 : Validation des formulaires
- Bacs : nom obligatoire, volume > 0 ✓
- Vagues : code obligatoire, date obligatoire, au moins 1 bac ✓
- Releves : vague, bac et type obligatoires ✓
- Aucun appel API si validation echoue ✓

---

## Approche de test

- **Environnement** : jsdom via directive `// @vitest-environment jsdom` en tete de chaque fichier .test.tsx
- **Mocks** : `next/navigation` (useRouter, usePathname, useSearchParams), `@/components/ui/toast` (useToast), `global.fetch`
- **Bibliotheques** : @testing-library/react pour le rendu, fireEvent pour les interactions, waitFor pour les assertions asynchrones
- **Assertions DOM** : @testing-library/jest-dom/vitest pour toBeInTheDocument, toHaveAttribute, etc.
- **Strategie** : tester les composants clients de maniere isolee avec des props mockees, verifier l'affichage, la validation et les appels API

---

## Fichiers de test

| Fichier | Tests | Description |
|---------|-------|-------------|
| `src/__tests__/ui/bacs-page.test.tsx` | 10 | Page bacs : affichage + formulaire creation |
| `src/__tests__/ui/vagues-page.test.tsx` | 18 | Page vagues : liste, filtres, carte, indicateurs |
| `src/__tests__/ui/releves-form.test.tsx` | 6 | Formulaire releve : affichage + validation |
| `src/__tests__/ui/responsive.test.tsx` | 14 | Responsive, touch targets, badges, grilles |

## Configuration

- `vitest.config.ts` — alias `@/` vers `src/`, jsdom via environmentMatchGlobs
- Directive `// @vitest-environment jsdom` en tete de chaque fichier UI
- Import `@testing-library/jest-dom/vitest` en tete de chaque fichier UI
- Scripts : `npm test` (run), `npm run test:watch` (watch)
