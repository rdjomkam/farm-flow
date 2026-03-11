# Tâche @developer — Sprint 12 — Bug Fixes

**Date :** 2026-03-11
**Assigné par :** @project-manager
**Priorité :** IMMÉDIATE — peut commencer sans attendre l'ADR architect

## Contexte

Tu es le DÉVELOPPEUR du projet Suivi Silures. Corrige les bugs du Sprint 12.

Avant de commencer, lis :
- CLAUDE.md (règles R1-R9)
- docs/TASKS.md (section "Bug fixes Sprint 12")

## AUDIT PRÉLIMINAIRE (déjà fait par PM)

Ces bugs sont **déjà corrigés** dans le code — NE PAS RETRAVAILLER :
- ✅ BUG-003 : suppressHydrationWarning déjà sur le body (src/app/layout.tsx ligne 50)
- ✅ I1-bugfix : PUT /api/releves/[id] retourne déjà 409 (lignes 175-177)
- ✅ I2-bugfix : GET /api/releves a déjà console.error (ligne 41)

## Bugs à corriger

### BUG-002 — Préfixe +237 automatique

**Fichiers à modifier :**
- src/app/login/page.tsx
- src/app/register/page.tsx

**Comportement actuel :** L'utilisateur doit taper "6XX XX XX XX" dans un champ libre.
**Comportement attendu :** Afficher "+237" comme préfixe fixe, l'utilisateur saisit les 9 chiffres restants.

**Implémentation suggérée (login/page.tsx) :**
```tsx
// Remplacer le champ identifier simple par un champ avec gestion du mode téléphone
// Détecter si l'utilisateur saisit un numéro (commence par 6/7) → mode téléphone
// Sinon → mode email

// Option simple : champ avec indicatif affiché côté gauche
// Afficher "+237 |" comme préfixe visuel quand l'input ressemble à un numéro

// Logique de normalisation AVANT envoi API :
// Si le champ contient uniquement des chiffres (9 chiffres) → préfixer "+237"
// Si commence par "6" ou "7" et longueur 9 → "+" + "237" + valeur
```

**Logique de validation côté UI :**
```typescript
// Avant fetch vers /api/auth/login
let normalizedIdentifier = identifier.trim();
// Si c'est un numéro de téléphone local (9 chiffres, commence par 6 ou 7)
if (/^[67]\d{8}$/.test(normalizedIdentifier)) {
  normalizedIdentifier = `+237${normalizedIdentifier}`;
}
// Si c'est 9 chiffres commençant par 237... -> +237...
```

**Pour register/page.tsx :**
Même logique pour le champ téléphone. Si l'utilisateur entre "699000000" → normaliser en "+237699000000" avant envoi API.

---

### BUG-005 — Overflow horizontal sur /vagues/[id] (mobile 360px)

**Fichiers à vérifier et modifier :**
- src/app/vagues/[id]/page.tsx
- src/components/vagues/indicateurs-cards.tsx
- src/components/vagues/poids-chart.tsx
- src/components/vagues/releves-list.tsx

**Diagnostic :**
L'app-shell.tsx a déjà `overflow-x-hidden` sur le `<main>`. Si l'overflow persiste c'est qu'un composant enfant force une largeur supérieure à 100vw.

**Action :**
1. Lire src/app/vagues/[id]/page.tsx - vérifier les classes CSS
2. Chercher des `min-w-*` ou `w-[xxx]` fixes trop larges
3. S'assurer que les grilles utilisent `grid-cols-2` mobile + `md:grid-cols-X` desktop
4. Les cartes KPI : `grid grid-cols-2 gap-2` ou `gap-3` max
5. Le graphique Recharts : s'assurer que le container a `max-w-full overflow-hidden`

**Fix attendu :**
Vérifier que toutes les grilles de cards sont `grid-cols-2` mobile (pas grid-cols-3 sans breakpoint).
Si des tableaux existent sur mobile, les remplacer par des cartes.

---

### M4-bugfix — Bouton trigger dialog 32px → 44px

**Fichier :** src/components/sites/member-actions-dialog.tsx

**Code actuel (ligne ~135) :**
```tsx
<Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
  <Settings className="h-3.5 w-3.5" />
</Button>
```

**Fix :**
```tsx
<Button variant="ghost" size="sm" className="h-11 w-11 p-0 shrink-0">
  <Settings className="h-4 w-4" />
</Button>
```
(ou min-h-[44px] min-w-[44px])

---

### M5-bugfix — Switch POST /api/releves sans clause default

**Fichier :** src/app/api/releves/route.ts

**Code actuel (ligne ~305, après le case OBSERVATION) :**
```typescript
      case TypeReleve.OBSERVATION:
        dto = { ... };
        break;
    }  // ← ici, pas de default
```

**Fix — ajouter avant la fermeture du switch :**
```typescript
      default:
        return NextResponse.json(
          { status: 400, message: `Type de relevé non supporté: ${body.typeReleve}` },
          { status: 400 }
        );
    }
```

Note : après ce fix, TypeScript peut se plaindre que `dto` est potentiellement non assigné. Ajouter une assertion ou initialiser `dto` avec une valeur par défaut avant le switch : `let dto!: CreateReleveDTO;`

---

### S3-bugfix — Messages toast sans accents (member-actions-dialog.tsx)

**Fichier :** src/components/sites/member-actions-dialog.tsx

**Code actuel (recherche "toast({") :**
- `"Role modifie"` → doit devenir `"Rôle modifié"`
- `"Membre retire"` → doit devenir `"Membre retiré"`
- `"Erreur reseau"` → doit devenir `"Erreur réseau"`

---

## Vérification

Après chaque fix :
```bash
npx vitest run --reporter=verbose 2>&1 | tail -20
npm run build 2>&1 | tail -20
```

Les tests doivent passer (baseline: 905 tests).
Le build doit compiler sans erreur TypeScript.

## Mise à jour TASKS.md

Quand tous les bugs sont corrigés, mets à jour docs/TASKS.md :
- Section "Bug fixes Sprint 12" : mettre **FAIT** sur chaque bug corrigé
- BUG-003, I1-bugfix, I2-bugfix : déjà corrigés → marquer FAIT aussi
- Ajouter un commentaire `<!-- Bug fixes Sprint 12 corrigés le 2026-03-11 par @developer -->`
