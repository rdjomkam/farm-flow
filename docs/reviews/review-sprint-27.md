# Review Sprint 27 — PWA (Service Worker + Offline)

**Date :** 2026-03-21
**Reviewer :** @code-reviewer
**Sprint :** 27

---

## Perimetre

Sprint 27 ajoute le support PWA : Service Worker, page offline, enregistrement SW, manifest web app.

## Checklist R1-R9

| Regle | Statut | Note |
|-------|--------|------|
| R1 — Enums MAJUSCULES | PASS | Aucun nouvel enum |
| R2 — Import des enums | PASS | Aucun enum utilise |
| R3 — Prisma = TypeScript | PASS | Pas de nouveau modele |
| R4 — Operations atomiques | PASS | Pas de mutation DB |
| R5 — DialogTrigger asChild | PASS | Pas de nouvelle dialog |
| R6 — CSS variables du theme | FAIL | Couleurs hard-coded (voir P1-P5) |
| R7 — Nullabilite explicite | PASS | Pas de nouveau schema |
| R8 — siteId PARTOUT | PASS | Pas de nouveau modele |
| R9 — Tests avant review | PASS | Build verifie |

## Problemes bloqueants (R6)

### P1 — offline/page.tsx : bg-teal-600 au lieu de bg-primary

**Fichier :** `src/app/~offline/page.tsx`
**Severite :** Haute (R6)

La page offline utilise `bg-teal-600` directement en dur au lieu de la variable de theme `bg-primary`.

**Correction requise :**
```tsx
// Avant
<div className="bg-teal-600 ...">

// Apres
<div className="bg-primary ...">
```

### P2 — sw-register.tsx : bg-white au lieu de bg-background

**Fichier :** `src/components/sw-register.tsx`
**Severite :** Haute (R6)

La banniere de mise a jour SW utilise `bg-white` au lieu de `bg-background`.

**Correction requise :**
```tsx
// Avant
<div className="bg-white ...">

// Apres
<div className="bg-background ...">
```

### P3 — sw-register.tsx : text-teal-600 au lieu de text-primary

**Fichier :** `src/components/sw-register.tsx`
**Severite :** Haute (R6)

Texte accentue utilise `text-teal-600` au lieu de `text-primary`.

**Correction requise :**
```tsx
// Avant
<span className="text-teal-600 ...">

// Apres
<span className="text-primary ...">
```

### P4 — sw-register.tsx : bg-teal-600 au lieu de bg-primary

**Fichier :** `src/components/sw-register.tsx`
**Severite :** Haute (R6)

Bouton de mise a jour utilise `bg-teal-600` au lieu de `bg-primary`.

**Correction requise :**
```tsx
// Avant
<button className="bg-teal-600 ...">

// Apres
<button className="bg-primary ...">
```

### P5 — sw-register.tsx : text-gray-400 au lieu de text-muted-foreground

**Fichier :** `src/components/sw-register.tsx`
**Severite :** Moyenne (R6)

Texte secondaire utilise `text-gray-400` au lieu de `text-muted-foreground`.

**Correction requise :**
```tsx
// Avant
<p className="text-gray-400 ...">

// Apres
<p className="text-muted-foreground ...">
```

## Observations non-bloquantes

### O1 — manifest.json : theme_color en dur

**Fichier :** `public/manifest.json`
**Severite :** Basse

Le champ `theme_color` contient une valeur hex en dur (`#0d9488` ou similaire). Bien que les fichiers JSON statiques ne puissent pas utiliser de variables CSS, il faut s'assurer que cette valeur correspond exactement a `--primary` du theme. Documenter cette dependance.

### O2 — manifest.json : champ id manquant

**Fichier :** `public/manifest.json`
**Severite :** Basse

La spec PWA recommande le champ `id` dans le manifest pour identifier l'application de maniere unique et stable. Ajouter `"id": "/"` ou un identifiant stable.

### O3 — sw-register.tsx : nettoyage du listener controllerchange

**Fichier :** `src/components/sw-register.tsx`
**Severite :** Basse

Le listener `controllerchange` sur `navigator.serviceWorker` n'est pas retire lors du cleanup de l'effet React. Ajouter la suppression dans la fonction de cleanup pour eviter les fuites memoire.

**Suggestion :**
```tsx
useEffect(() => {
  const handler = () => { /* ... */ }
  navigator.serviceWorker.addEventListener('controllerchange', handler)
  return () => {
    navigator.serviceWorker.removeEventListener('controllerchange', handler)
  }
}, [])
```

### O4 — Service Worker : limite Background Sync

**Fichier :** `public/sw.js` ou equivalent
**Severite :** Basse

Si Background Sync est implemente, ajouter une limite de tentatives (ex: max 3 retries) pour eviter des boucles infinies en cas d'erreur persistante cote serveur.

### O5 — Service Worker : strategie de cache versionnee

**Severite :** Basse

Verifier que le nom du cache inclut un numero de version (ex: `farm-flow-v1`) pour faciliter la purge lors des mises a jour.

## Corrections requises avant validation

- [ ] P1 : `src/app/~offline/page.tsx` — remplacer `bg-teal-600` par `bg-primary`
- [ ] P2 : `src/components/sw-register.tsx` — remplacer `bg-white` par `bg-background`
- [ ] P3 : `src/components/sw-register.tsx` — remplacer `text-teal-600` par `text-primary`
- [ ] P4 : `src/components/sw-register.tsx` — remplacer `bg-teal-600` par `bg-primary`
- [ ] P5 : `src/components/sw-register.tsx` — remplacer `text-gray-400` par `text-muted-foreground`

## Verdict : VALIDE APRES CORRECTIONS

Les corrections R6 (P1-P5) sont requises avant de marquer le sprint comme termine. Les observations O1-O5 sont non-bloquantes et peuvent etre traitees en Sprint 12 (polish).
