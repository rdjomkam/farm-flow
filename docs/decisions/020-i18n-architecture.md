# ADR-020 — Architecture i18n (internationalisation)

**Date :** 2026-03-21
**Sprint :** 39
**Statut :** Accepte
**Auteur :** @developer

---

## Contexte

FarmFlow est une application B2B privee utilisee principalement en Afrique francophone (Cameroun).
La demande d'internationalisation vise a supporter le francais (langue principale) et l'anglais
(pour les utilisateurs anglophones de la region). Le produit n'a pas de besoins SEO public.

---

## Decision

### Bibliotheque : next-intl v4

**next-intl** est la bibliotheque de reference pour l'i18n avec Next.js App Router.
Elle supporte nativement les Server Components, les Client Components et l'Edge Runtime.

### Pas de prefixe URL

Les locales NE sont PAS incluses dans les URLs (`/fr/dashboard` est exclu).
**Raison :** Application B2B privee sans besoins SEO. Les URLs propres sont preferees
(`/dashboard` plutot que `/fr/dashboard`). La locale est stockee en session / cookie.

### Detection de la locale

Ordre de priorite :
1. **Cookie `NEXT_LOCALE`** — preference explicite de l'utilisateur ou sync depuis `Session.locale`
2. **Header `Accept-Language`** — preference navigateur (2 premiers caracteres, ex: `fr` depuis `fr-FR`)
3. **Fallback : `fr`** — langue par defaut de l'application

Ce mecanisme est implemente dans `src/i18n/request.ts` via `getRequestConfig` de next-intl.

### Pas de modification du middleware

Le middleware existant (`src/proxy.ts`) gere l'authentification et les abonnements.
next-intl sans prefixe URL n'a pas besoin de son propre middleware de routing.
La detection de locale se fait uniquement au niveau de `getRequestConfig`.

### Structure des messages

```
src/messages/
  fr/
    common.json   — messages communs (navigation, boutons, erreurs generiques)
    format.json   — formats date/nombre specifiques au francais
  en/
    common.json   — common messages in English
    format.json   — date/number formats for English
```

Chaque namespace correspond a un fichier JSON separe.
Les namespaces sont charges dynamiquement dans `loadMessages()` et les fichiers manquants
sont ignores silencieusement (grace a un try/catch) pour faciliter l'ajout progressif.

### Integration dans le layout

`src/app/layout.tsx` utilise `getLocale()` et `getMessages()` de `next-intl/server` pour :
- Definir `<html lang={locale}>` dynamiquement
- Passer la locale et les messages au `NextIntlClientProvider` qui encapsule toute l'application

### Plugin next.config.ts

`createNextIntlPlugin` est utilise dans `next.config.ts` pour :
- Pointer vers `src/i18n/request.ts` comme configuration de requete
- Activer les aliases et optimisations de next-intl au niveau du build

---

## Consequences

### Positives
- Server Components peuvent utiliser `getTranslations()`, `getLocale()`, `getMessages()`
- Client Components peuvent utiliser `useTranslations()`, `useLocale()` via le Provider
- La detection de locale est transparente, sans changement d'URL
- Architecture extensible : ajout d'une nouvelle langue = nouveau dossier `src/messages/{locale}/`
- Les messages par namespace permettent un chargement granulaire (code splitting)

### Contraintes
- La locale ne change pas l'URL — le cache Next.js peut servir la meme page a tous les utilisateurs.
  **Mitigation :** Toutes les routes sont deja dynamiques (`ƒ` dans le build output), pas de SSG.
- Le changement de langue necessite d'ecrire le cookie `NEXT_LOCALE` et de synchroniser
  `Session.locale` en base pour les utilisateurs connectes. Cette logique sera implementee
  dans la story 39.3 (UI changement de langue).

---

## Alternatives ecartees

| Alternative | Raison du rejet |
|-------------|----------------|
| Prefixe URL (`/fr/`, `/en/`) | Casse les URLs existantes, inutile pour une app B2B privee |
| react-i18next | Moins integre avec App Router, pas de support natif RSC |
| Stockage locale uniquement en base | Inaccessible en Edge Runtime (proxy.ts), necessite un fetch supplementaire |

---

## Fichiers crees / modifies

| Fichier | Action |
|---------|--------|
| `src/i18n/config.ts` | Cree — constantes `locales`, `defaultLocale`, type `Locale` |
| `src/i18n/request.ts` | Cree — `getRequestConfig` avec detection cookie/Accept-Language |
| `src/messages/fr/common.json` | Cree — placeholder francais (a completer sprint suivant) |
| `src/messages/fr/format.json` | Cree — placeholder formats FR |
| `src/messages/en/common.json` | Cree — placeholder anglais |
| `src/messages/en/format.json` | Cree — placeholder formats EN |
| `next.config.ts` | Modifie — ajout `createNextIntlPlugin` |
| `src/app/layout.tsx` | Modifie — `html lang` dynamique + `NextIntlClientProvider` |
