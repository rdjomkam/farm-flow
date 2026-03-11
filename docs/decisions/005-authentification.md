# ADR 005 — Authentification et gestion des sessions

**Date :** 2026-03-09
**Statut :** Acceptee
**Auteur :** @architect
**Sprint :** 6

## Contexte

L'application Suivi Silures est utilisee par des pisciculteurs au Cameroun, principalement sur smartphone avec des connexions parfois instables. Les besoins d'authentification sont :

- **Credentials uniquement** : login par email OU telephone + mot de passe (pas de Google, Facebook, etc. — les utilisateurs n'ont pas forcement de comptes OAuth)
- **Telephone camerounais** : format +237 suivi de 9 chiffres (ex: +237 6XX XXX XXX). Au moins un identifiant (email ou phone) est requis par utilisateur
- **Roles** : ADMIN, GERANT, PISCICULTEUR (definis dans l'enum `Role` du schema Prisma, Sprint 7 pour le multi-tenancy)
- **Multi-site** : un utilisateur pourra appartenir a plusieurs sites avec des roles differents (Sprint 7)
- **Mobile first** : ecran de login simple, gros boutons, champs larges
- **Connexions instables** : la session doit etre persistante (pas de re-login frequent)

## Decision

### 1. Librairie : Auth custom avec sessions DB

**Option A — NextAuth.js (rejete)**

| Pour | Contre |
|------|--------|
| Ecosystem riche, adapters Prisma | Surdimensionne pour credentials-only |
| Providers sociaux pre-configures | Pas besoin d'OAuth dans ce contexte |
| Documentation abondante | Complexite de configuration pour un cas simple |
| | Contraintes sur la structure des tables (Account, Session, etc.) |
| | Difficulte a customiser le flow multi-tenancy (Sprint 7) |

**Option B — Auth custom avec sessions DB (retenu)**

| Pour | Contre |
|------|--------|
| Controle total sur le flow | Pas de providers sociaux (non necessaire) |
| Structure DB libre (compatible multi-tenancy Sprint 7) | Securite a implementer soi-meme |
| Simple pour credentials-only | Plus de code a maintenir |
| Facile a tester et debugger | |
| Pas de dependance externe lourde | |

**Justification :** Le contexte (credentials-only, multi-tenancy custom, milieu rural) ne justifie pas la complexite de NextAuth.js. Une implementation custom avec les bonnes pratiques de securite est plus adaptee et plus maintenable.

### 2. Strategie de session : DB sessions (pas JWT)

**JWT (rejete)**

| Pour | Contre |
|------|--------|
| Stateless, pas de requete DB par request | Impossible de revoquer un token sans blacklist |
| Scalable | Taille du cookie augmente avec les claims |
| | Pas de deconnexion instantanee (expire apres le TTL) |
| | Rotation de cle complexe |

**DB sessions (retenu)**

| Pour | Contre |
|------|--------|
| Revocation instantanee (delete en DB) | Requete DB a chaque request authentifiee |
| Deconnexion immediate | Moins scalable (mais non pertinent ici) |
| Facile a lister les sessions actives | |
| Compatible multi-site (session liee a un site actif) | |

**Justification :** Pour une application mono-serveur avec peu d'utilisateurs simultanes, le cout d'une requete DB par request est negligeable. La revocation instantanee et la compatibilite multi-site sont des avantages decisifs.

### 3. Hashing des mots de passe : bcrypt

**bcrypt (retenu)**

| Pour | Contre |
|------|--------|
| Mature, tres bien supporte en Node.js | Limite a 72 octets (suffisant) |
| Librairie `bcryptjs` pure JS (pas de native bindings) | Moins "moderne" que argon2 |
| Facile a deployer (pas de compilation native) | |
| Salt integre, API simple | |
| Bien documente et audite | |

**argon2 (rejete)**

| Pour | Contre |
|------|--------|
| Plus moderne, gagnant du PHC | Necessite des native bindings (compilation) |
| Meilleure resistance au GPU cracking | Deploiement plus complexe |
| | Overkill pour ce contexte |

**Justification :** `bcryptjs` est une implementation pure JavaScript qui fonctionne partout sans compilation native. Pour une application piscicole avec quelques dizaines d'utilisateurs, bcrypt avec un cost factor de 12 est largement suffisant.

### 4. Architecture des routes

#### Routes publiques (pas de session requise)

| Route | Usage |
|-------|-------|
| `/login` | Page de connexion |
| `/register` | Page d'inscription |
| `/api/auth/login` | POST — authentification |
| `/api/auth/register` | POST — creation de compte |
| `/api/auth/logout` | POST — deconnexion |

#### Routes protegees (session requise)

Toutes les autres routes (`/`, `/vagues`, `/bacs`, `/releves`, `/api/*`).

#### Middleware Next.js (cookie-only, pas de DB)

Le middleware (`src/middleware.ts`) est un filtre leger qui verifie uniquement la **presence** du cookie `session_token`. Il ne fait **aucun appel DB** (Edge Runtime, pas d'acces Prisma).

1. Lire le cookie de session (`session_token`)
2. Si present : laisser passer la requete vers le route handler
3. Si absent : rediriger vers `/login` (pages) ou retourner 401 (API)
4. Si present et route publique (`/login`, `/register`) : rediriger vers `/`

La validation complete (session valide en DB, expiration, user actif) est faite par `requireAuth()` dans chaque API route handler (`src/lib/auth/session.ts`).

```
Request → Middleware (cookie present?) → OUI → Route handler → requireAuth() → DB lookup
                                       → NON → /login (redirect) ou 401
```

Ce design en deux couches est voulu :
- **Middleware** : rapide, sans I/O, bloque les requetes sans cookie
- **requireAuth()** : validation DB complete, appelee dans chaque route protegee

### 5. Schema de la session

Le cookie contient uniquement un token opaque (UUID v4). Les donnees de session sont en DB :

```
Cookie: session_token=<uuid-v4>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

- **HttpOnly** : pas d'acces JavaScript (protection XSS)
- **Secure** : HTTPS uniquement (en prod)
- **SameSite=Lax** : protection CSRF basique
- **Max-Age** : 30 jours (connexions instables, eviter les re-logins frequents)
- **Path=/** : valide pour tout le site

### 6. Flow d'authentification

#### Login
```
1. POST /api/auth/login { identifier, password }
2. Detecter si identifier est un email ou un telephone (+237...)
3. Trouver l'utilisateur par email OU phone selon le format
4. Comparer le hash bcrypt
5. Si OK : creer une session en DB, retourner le cookie
6. Si KO : retourner 401 avec message generique
```

Le champ `identifier` accepte indifferemment un email ou un numero de telephone camerounais. La detection est applicative : si la valeur commence par `+` ou contient uniquement des chiffres, c'est un telephone ; sinon, c'est un email.

#### Register
```
1. POST /api/auth/register { name, password, email?, phone? }
2. Verifier qu'au moins email ou phone est fourni
3. Valider le format phone si present (+237 + 9 chiffres)
4. Verifier que l'email/phone n'existe pas deja
5. Hasher le password avec bcrypt (cost 12)
6. Creer l'utilisateur en DB
7. Creer une session automatiquement (login apres inscription)
8. Retourner le cookie
```

#### Logout
```
1. POST /api/auth/logout
2. Supprimer la session en DB
3. Supprimer le cookie
```

#### Verification (deux couches)

**Couche 1 — Middleware (src/middleware.ts) :**
```
1. Lire le cookie session_token
2. Si absent : rediriger vers /login (pages) ou 401 (API)
3. Si present : laisser passer (pas de DB)
```

**Couche 2 — requireAuth() (src/lib/auth/session.ts) :**
```
1. Lire le cookie session_token
2. Chercher en DB : session avec ce token (include user)
3. Verifier expiration (si expiree : supprimer la session, retourner null)
4. Verifier user.isActive
5. Si OK : retourner UserSession (userId, email, phone, name, role)
6. Si KO : throw AuthError (401)
```

### 7. Securite

| Mesure | Implementation |
|--------|---------------|
| Hashing | bcryptjs, cost factor 12 |
| Cookie | HttpOnly, Secure, SameSite=Lax |
| CSRF | SameSite=Lax + verif Origin header sur mutations |
| Brute force | Rate limiting sur /api/auth/login (optionnel Sprint 12) |
| Enumeration | Message d'erreur generique ("Identifiant ou mot de passe incorrect") |
| Session fixation | Nouveau token a chaque login |
| XSS | Pas de donnees sensibles en localStorage/cookie JS |

### 8. Dependances a installer

| Package | Version | Usage |
|---------|---------|-------|
| `bcryptjs` | ^3.0 | Hashing des mots de passe |
| `@types/bcryptjs` | ^2.4 | Types TypeScript |
| `uuid` | ^11.0 | Generation de tokens de session |

Pas de framework auth lourd. Le reste est du code custom dans `src/lib/auth/`.

### 9. Structure des fichiers

```
src/
├── app/
│   ├── login/
│   │   └── page.tsx              # Page de connexion (Server Component + form client)
│   ├── register/
│   │   └── page.tsx              # Page d'inscription
│   └── api/
│       └── auth/
│           ├── login/
│           │   └── route.ts      # POST login
│           ├── register/
│           │   └── route.ts      # POST register
│           ├── logout/
│           │   └── route.ts      # POST logout
│           └── me/
│               └── route.ts      # GET session courante
├── lib/
│   └── auth/
│       ├── password.ts           # hashPassword, verifyPassword (bcrypt)
│       ├── session.ts            # createSession, getSession, deleteSession
│       └── middleware.ts         # Logique de verification (utilisee par src/middleware.ts)
├── middleware.ts                  # Next.js middleware (point d'entree)
└── types/
    └── auth.ts                   # UserSession, LoginDTO, RegisterDTO, AuthResponse
```

## Options considerees

Resumees dans les sections ci-dessus (NextAuth vs custom, JWT vs DB sessions, bcrypt vs argon2).

## Consequences

- **Sprint 6** : implementation de l'auth complete (login, register, logout, middleware, protection des routes)
- **Sprint 7** : le middleware sera etendu pour gerer le `siteId` actif (multi-tenancy) — la session DB facilite cela car on peut stocker `activeSiteId` dans la session
- **Pas de dependance lourde** : seulement `bcryptjs` et `uuid`
- **Toutes les routes existantes** (Phase 1) seront protegees par le middleware
- **Les API routes** devront extraire le `userId` depuis les headers injectes par le middleware
- **L'UI** devra afficher un user menu dans le header (nom + deconnexion)
