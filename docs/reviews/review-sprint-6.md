# Review Sprint 6 — Authentification

**Date :** 2026-03-09
**Reviewer :** @code-reviewer
**Sprint :** 6
**Verdict : VALIDE**

---

## Resume

Le Sprint 6 implemente un systeme d'authentification custom avec sessions DB, bcrypt, et middleware Next.js. L'implementation inclut le login par email **et par telephone** (BUG-001 corrige en cours de sprint). La securite est solide (bcrypt cost 12, cookies HttpOnly/Secure/SameSite, anti-enumeration, tokens opaques). 205 tests passent avec 0 regression. Build OK.

---

## Historique de la review

| Etape | Date | Verdict | Detail |
|-------|------|---------|--------|
| Review initiale | 2026-03-09 | CONDITIONNEL | 2 items Important (I1: ADR mismatch, I2: roleLabels typing) |
| BUG-001 | 2026-03-09 | — | Login par telephone ajoute (email nullable, phone, identifier) |
| Re-review | 2026-03-09 | **VALIDE** | I1 et I2 corriges, BUG-001 bien implemente |

---

## Fichiers revus (26 fichiers)

### Nouveaux fichiers Sprint 6
| Fichier | Story |
|---------|-------|
| `prisma/schema.prisma` (modif) | 6.2 + BUG-001 — User (email?, phone?), Session, enums Role/Permission |
| `prisma/migrations/20260309065155_add_auth/migration.sql` | 6.2 — Migration initiale auth |
| `prisma/migrations/20260309080000_user_phone_email_nullable/migration.sql` | BUG-001 — email nullable + phone |
| `prisma/seed.sql` (modif) | 6.9 + BUG-001 — Admin user avec email + phone |
| `src/types/models.ts` (modif) | 6.3 + BUG-001 — User.email nullable, User.phone nullable |
| `src/types/auth.ts` | 6.3 + BUG-001 — LoginDTO.identifier, RegisterDTO.email?/phone?, UserSession.phone |
| `src/types/index.ts` (modif) | 6.3 — Barrel exports |
| `src/lib/auth/password.ts` | 6.4 — hashPassword, verifyPassword (bcrypt) |
| `src/lib/auth/session.ts` | 6.4 + BUG-001 — getSession retourne phone |
| `src/lib/auth/index.ts` | 6.4 — Barrel export |
| `src/lib/queries/users.ts` | 6.6 + BUG-001 — getUserByIdentifier, getUserByPhone, createUser(email?/phone?) |
| `src/app/api/auth/login/route.ts` | 6.6 + BUG-001 — identifier (email ou phone) |
| `src/app/api/auth/register/route.ts` | 6.6 + BUG-001 — email et/ou phone, PHONE_REGEX |
| `src/app/api/auth/logout/route.ts` | 6.6 — POST /api/auth/logout |
| `src/app/api/auth/me/route.ts` | 6.6 — GET /api/auth/me |
| `src/middleware.ts` | 6.5 — Middleware Next.js (cookie-only) |
| `src/app/login/page.tsx` | 6.7 + BUG-001 — Champ identifier (email ou telephone) |
| `src/app/register/page.tsx` | 6.7 + BUG-001 — Champs email + phone (au moins un requis) |
| `src/components/layout/user-menu.tsx` | 6.7 + I2 fix — Record<Role, string>, affiche email ou phone |
| `src/components/layout/header.tsx` (modif) | 6.7 — Integration user-menu |
| `docs/decisions/005-authentification.md` | 6.1 + I1 fix + BUG-001 — ADR mis a jour |

### Routes existantes protegees (Story 6.8)
| Fichier | Modification |
|---------|-------------|
| `src/app/api/bacs/route.ts` | +`requireAuth(request)` dans GET et POST |
| `src/app/api/vagues/route.ts` | +`requireAuth(request)` dans GET et POST |
| `src/app/api/vagues/[id]/route.ts` | +`requireAuth(request)` dans GET et PUT |
| `src/app/api/releves/route.ts` | +`requireAuth(request)` dans GET et POST |

### Tests Sprint 6
| Fichier | Tests |
|---------|-------|
| `src/__tests__/auth/password.test.ts` | 5 tests unitaires |
| `src/__tests__/auth/session.test.ts` | 12 tests unitaires (phone inclus) |
| `src/__tests__/api/auth.test.ts` | 26 tests API (register email/phone/both, login email/phone, logout, me) |
| `src/__tests__/api/auth-protection.test.ts` | 6 tests protection routes |

---

## Verification des corrections (re-review)

### I1 — ADR 005 mis a jour : CORRIGE
**Fichier :** `docs/decisions/005-authentification.md`
- Section 4 renommee "Middleware Next.js (cookie-only, pas de DB)" avec description claire du design deux couches
- Section 6 "Verification (deux couches)" distingue Couche 1 (Middleware) et Couche 2 (requireAuth)
- Diagramme de flux mis a jour
- Login flow mis a jour pour `identifier` (email ou phone)
- Register flow mis a jour pour email?/phone? optionnels

### I2 — roleLabels type avec enum Role : CORRIGE
**Fichier :** `src/components/layout/user-menu.tsx:7,10`
- `import { Role } from "@/types"` ajoute
- `Record<Role, string>` au lieu de `Record<string, string>`
- TypeScript avertira si un nouveau role est ajoute sans label

### BUG-001 — Login par telephone : BIEN IMPLEMENTE

**Schema :**
- `email String? @unique` — maintenant nullable
- `phone String? @unique` — nouveau champ
- Migration propre (`ALTER TABLE ... DROP NOT NULL`, `ADD COLUMN`)
- Regle "au moins un identifiant" appliquee cote application (acceptable, pas de CHECK constraint DB possible via Prisma)

**Types :**
- `User.email: string | null`, `User.phone: string | null` — aligne avec schema (R3)
- `UserSession.email: string | null`, `UserSession.phone: string | null`
- `LoginDTO.identifier: string` — champ unique pour email ou phone
- `RegisterDTO.email?: string, phone?: string` — les deux optionnels

**Queries :**
- `getUserByIdentifier()` — detection intelligente : commence par `+` ou digits-only → phone, sinon email
- `getUserByPhone()` — recherche par phone exact
- `getUserByEmail()` — normalise en lowercase (inchange)
- `createUser()` — accepte email et/ou phone optionnels

**Login API :**
- Champ `identifier` au lieu de `email`
- Message generique "Identifiant ou mot de passe incorrect" (anti-enumeration preservee)
- Reponse inclut `email` et `phone`

**Register API :**
- Validation "au moins email ou phone requis"
- `PHONE_REGEX = /^\+237[62]\d{8}$/` — format camerounais (mobile 6XX + fixe 2XX)
- Verification unicite email ET phone separement
- Reponse inclut les deux champs

**UI Login :**
- Champ "Email ou telephone" avec placeholder adapte
- `autoComplete="username"` (correct pour champ combiné)

**UI Register :**
- Champs email et phone separes, labels "(optionnel)"
- Helper text explicite "Au moins un des deux (email ou telephone) est requis"
- `PHONE_REGEX` coherente client/serveur
- `autoComplete="tel"` pour le telephone

**User Menu :**
- Affiche `user.email ?? user.phone` sous le role

**Seed :**
- Admin avec email + phone

**Tests :**
- 26 tests API auth (vs 17 avant BUG-001) couvrant tous les cas :
  - Register email seul, phone seul, email+phone, 409 email/phone, formats invalides, +237 fixe
  - Login par email, par phone, identifiant inconnu, mot de passe incorrect, compte desactive
  - /me avec email, /me avec phone seul
- Session tests mis a jour avec `phone: null` dans validUser

---

## Points positifs

1. **Architecture propre** — Separation claire en modules (`auth/password.ts`, `auth/session.ts`, `queries/users.ts`). Barrel exports simplifient les imports.

2. **Securite du hashing** — bcrypt avec cost factor 12, salt auto-genere, bcryptjs pure JS.

3. **Sessions DB bien implementees** — Token opaque via `crypto.randomUUID()` (Web Crypto, plus secure que le package `uuid`). Cookie HttpOnly + Secure (prod) + SameSite=Lax. 30 jours. Revocation instantanee.

4. **Anti-enumeration** — "Identifiant ou mot de passe incorrect" pour tout echec login. Bonne pratique.

5. **Protection complete** — Toutes les routes API existantes protegees par `requireAuth()` + gestion AuthError.

6. **Types bien separes** — `UserSession` ne contient jamais `passwordHash`. Separation propre types internes/exposes.

7. **Validation robuste** — Email regex + phone regex (format camerounais), longueur mot de passe, unicite separee email/phone.

8. **Tests complets** — 49 nouveaux tests (Sprint 6 + BUG-001) + 156 non-regression = 205 total.

9. **Operations atomiques** — `deleteSession` via `deleteMany` (R4).

10. **Normalisation coherente** — Email lowercase dans getUserByEmail et createUser. Phone stocke tel quel (format international).

11. **BUG-001 reactif et propre** — Le fix est bien integre dans l'architecture existante sans hack. Migration additive (non destructive).

12. **ADR de qualite** — Le design deux couches (middleware cookie-only + requireAuth DB) est bien documente et justifie.

---

## Checklist R1-R9

| Regle | Statut | Detail |
|-------|--------|--------|
| R1 — Enums MAJUSCULES | OK | Role: ADMIN, GERANT, PISCICULTEUR. Permission: 25 valeurs UPPERCASE. |
| R2 — Import enums | OK | `import { Role } from "@/types"` dans routes, user-menu. `Record<Role, string>` pour roleLabels. |
| R3 — Prisma = TS | OK | User/Session alignes 1:1 (email?, phone?, passwordHash, isActive, etc.). |
| R4 — Operations atomiques | OK | `deleteSession` via `deleteMany`. `createUser` atomique. |
| R5 — DialogTrigger asChild | N/A | Pas de Dialog dans Sprint 6. |
| R6 — CSS variables | OK* | `bg-primary/10`, `text-primary`, `bg-muted/30` partout. *themeColor en dur dans viewport (obligatoire Next.js). |
| R7 — Nullabilite explicite | OK | email `String?`, phone `String?`, passwordHash `String` (required). TS: `string | null` pour email/phone. |
| R8 — siteId PARTOUT | N/A | Sprint 7+. |
| R9 — Tests avant review | OK | 205 tests passes, 0 echec. Build OK. |

---

## Problemes restants

### Mineur

#### M1 — Cast `as Role` dans les routes login et register
**Fichier :** `src/app/api/auth/login/route.ts:63`, `src/app/api/auth/register/route.ts:99`
**Probleme :** `user.role as Role` est utilise pour construire la reponse. Si le client Prisma genere correctement le type `Role`, le cast est inutile et masque un eventuel desalignement.
**Suggestion :** Verifier le type retourne par Prisma et supprimer le cast si possible. Reportable.

---

#### M2 — Pas de nettoyage automatique des sessions expirees
**Fichier :** `src/lib/auth/session.ts`
**Probleme :** Seule la session courante est nettoyee dans `getSession()`. Pas de purge globale.
**Suggestion :** Ajouter un cron ou un endpoint admin de nettoyage. Reportable a Sprint 11 ou 12.

---

#### M3 — ADR 005 sections 8-9 legerement desalignees
**Fichier :** `docs/decisions/005-authentification.md`
**Probleme :** Section 8 mentionne le package `uuid` comme dependance, mais l'implementation utilise `crypto.randomUUID()` (natif). Section 9 mentionne `src/lib/auth/middleware.ts` qui n'existe pas (la logique est dans `src/middleware.ts` directement).
**Suggestion :** Corriger ces deux sections mineures. Reportable.

---

### Suggestions

#### S1 — Extraire PHONE_REGEX en constante partagee
**Fichiers :** `src/app/api/auth/register/route.ts:8`, `src/app/register/page.tsx:13`
**Detail :** La regex telephone est dupliquee cote serveur et client. Extraire dans `src/lib/constants.ts` ou `src/lib/validation.ts` pour garantir la coherence.

---

#### S2 — Rate limiting sur les endpoints auth
**Fichiers :** `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts`
**Detail :** Pas de rate limiting. ADR mentionne "optionnel Sprint 12". Recommande avant mise en production.

---

#### S3 — Loading skeleton pour UserMenu
**Fichier :** `src/components/layout/user-menu.tsx`
**Detail :** Retourne `null` pendant le fetch `/api/auth/me`. Un placeholder eviterait le layout shift.

---

## Securite — Checklist

| Critere | Statut | Detail |
|---------|--------|--------|
| Hashing correct | OK | bcrypt, cost 12, bcryptjs pure JS |
| Sessions securisees | OK | HttpOnly, Secure (prod), SameSite=Lax, 30j expiration |
| Pas de fuite passwordHash | OK | UserSession n'expose jamais passwordHash. Reponses: userId/email/phone/name/role |
| Protection CSRF | OK | SameSite=Lax. Acceptable pour l'usage |
| Validation des entrees | OK | Email regex, phone regex camerounais, password min 6, name required |
| Anti-enumeration login | OK | Message generique "Identifiant ou mot de passe incorrect" |
| Token generation | OK | crypto.randomUUID() (Web Crypto API) |
| Session revocation | OK | Suppression immediate en DB |
| Compte desactive | OK | Verifie dans getSession() + login (403) |
| Phone format | OK | `^\+237[62]\d{8}$` — mobile (6XX) + fixe (2XX), 9 chiffres apres +237 |

---

## Mobile-first

| Page | Statut | Detail |
|------|--------|--------|
| `/login` | OK | `max-w-sm`, `px-4`, `min-h-dvh`. Champ identifier large (`w-full`). Gros bouton. |
| `/register` | OK | 5 champs (nom, email, phone, password, confirm) bien espaces (`gap-4`). Helper text pour email/phone. |
| User menu | OK | Avatar seul sur mobile (`sm:hidden`), nom+role+email/phone sur desktop. Bouton 44x44px min. |
| Header | OK | `sticky top-0`, `truncate`, `shrink-0`. |

---

## Accessibilite

| Critere | Statut | Detail |
|---------|--------|--------|
| Labels sur les inputs | OK | Prop `label` sur tous les champs (login: 2, register: 5) |
| autoComplete | OK | `username`, `current-password`, `new-password`, `name`, `email`, `tel` |
| Focus auto | OK | `autoFocus` sur premier champ |
| Bouton logout | OK | `aria-label` + `title` |
| Erreurs lisibles | OK | Messages francais sous chaque champ. Helper text pour email/phone |
| Navigation clavier | OK | Formulaires `<form>` + `<button type="submit">` |

---

## Verdict : VALIDE

Le Sprint 6 (Authentification) est **valide**. Tous les items bloquants de la premiere review sont corriges :
- **I1** : ADR 005 mis a jour (middleware cookie-only documente)
- **I2** : roleLabels type `Record<Role, string>` avec import enum
- **BUG-001** : Login par telephone bien implemente et teste

Les items Mineur (M1-M3) et Suggestions (S1-S3) sont reportables aux sprints suivants sans impact sur la validation.

**Chiffres finaux :** 205 tests, 0 echec, build OK, 26 fichiers revus.
