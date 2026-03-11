# Rapport de tests — Sprint 6 (Authentification)

**Date :** 2026-03-09
**Testeur :** @tester
**Vitest :** v4.0.18
**Resultat global :** 205 tests PASSES / 0 echec

---

## Synthese

| Categorie | Fichier | Tests | Statut |
|-----------|---------|-------|--------|
| Unit — Password | `auth/password.test.ts` | 5 | PASS |
| Unit — Session | `auth/session.test.ts` | 12 | PASS |
| API — Auth routes | `api/auth.test.ts` | 26 | PASS |
| API — Protection | `api/auth-protection.test.ts` | 6 | PASS |
| Non-regression — Calculs | `calculs.test.ts` | 42 | PASS |
| Non-regression — Bacs | `api/bacs.test.ts` | 12 | PASS |
| Non-regression — Vagues | `api/vagues.test.ts` | 23 | PASS |
| Non-regression — Releves | `api/releves.test.ts` | 31 | PASS |
| Non-regression — UI Responsive | `ui/responsive.test.tsx` | 14 | PASS |
| Non-regression — UI Releves Form | `ui/releves-form.test.tsx` | 6 | PASS |
| Non-regression — UI Bacs Page | `ui/bacs-page.test.tsx` | 10 | PASS |
| Non-regression — UI Vagues Page | `ui/vagues-page.test.tsx` | 18 | PASS |
| **TOTAL** | **12 fichiers** | **205** | **PASS** |

---

## Nouveaux tests Sprint 6 (49 tests)

### 1. Tests unitaires — hashPassword / verifyPassword (5 tests)
- `hashPassword` cree un hash bcrypt valide (prefixe $2)
- `hashPassword` produit des hashes differents a chaque appel (salt unique)
- `verifyPassword` retourne true pour un mot de passe correct
- `verifyPassword` retourne false pour un mot de passe incorrect
- `verifyPassword` retourne false pour un hash invalide

### 2. Tests unitaires — Session (12 tests)
- `createSession` cree un token UUID et une expiration a 30 jours
- `createSession` appelle prisma.session.create avec les bonnes donnees
- `getSession` retourne null si pas de cookie session
- `getSession` retourne null si session non trouvee en DB
- `getSession` retourne null et supprime la session si expiree
- `getSession` retourne null si l'utilisateur est inactif
- `getSession` retourne les donnees UserSession (avec phone) pour une session valide
- `requireAuth` retourne UserSession pour une session valide
- `requireAuth` lance AuthError si pas de session
- `deleteSession` supprime la session via prisma.session.deleteMany
- `setSessionCookie` definit le cookie session_token sur la reponse
- `clearSessionCookie` efface le cookie session_token

### 3. Tests API — Auth routes (26 tests)

**POST /api/auth/register (13 tests) :**
- Cree un utilisateur avec email et retourne 201 avec auto-login
- Cree un utilisateur avec telephone uniquement et retourne 201 (BUG-001)
- Cree un utilisateur avec email + telephone et retourne 201 (BUG-001)
- Accepte un telephone fixe camerounais (+237 2XX) (BUG-001)
- Retourne 409 si email deja utilise
- Retourne 409 si telephone deja utilise (BUG-001)
- Retourne 400 si ni email ni telephone fourni (BUG-001)
- Retourne 400 si email invalide
- Retourne 400 si format telephone invalide — pas camerounais (BUG-001)
- Retourne 400 si telephone sans prefixe +237 (BUG-001)
- Retourne 400 si nom manquant
- Retourne 400 si mot de passe trop court (< 6 caracteres)
- Retourne 400 avec erreurs multiples si tous les champs manquent

**POST /api/auth/login (7 tests) :**
- Connecte par email (identifier) et retourne 200 avec session
- Connecte par telephone (identifier) et retourne 200 avec session (BUG-001)
- Retourne 401 si identifiant inconnu (message generique anti-enumeration)
- Retourne 401 si mot de passe incorrect (message generique)
- Retourne 403 si compte desactive
- Retourne 400 si identifiant manquant
- Retourne 400 si tous les champs manquent

**POST /api/auth/logout (2 tests) :**
- Deconnecte et retourne 200 (supprime session + efface cookie)
- Retourne 200 meme sans cookie de session

**GET /api/auth/me (4 tests) :**
- Retourne les donnees utilisateur (avec email) pour une session valide
- Retourne les donnees avec telephone pour un user sans email (BUG-001)
- Retourne 401 si pas de session valide
- Retourne 500 en cas d'erreur serveur inattendue

### 4. Tests protection routes API (6 tests)
- GET /api/bacs retourne 401 sans session
- POST /api/bacs retourne 401 sans session
- GET /api/vagues retourne 401 sans session
- POST /api/vagues retourne 401 sans session
- GET /api/releves retourne 401 sans session
- POST /api/releves retourne 401 sans session

---

## BUG-001 — Login par telephone (tests de non-regression)

### Contexte
Les pisciculteurs camerounais n'ont pas tous une adresse email. Le login
et le register ont ete mis a jour pour supporter le telephone comme identifiant
alternatif (format camerounais : +237 6XX/2XX XXX XXX).

### Tests specifiques BUG-001 (9 tests)
| # | Test | Statut |
|---|------|--------|
| 1 | Register avec telephone uniquement → 201 | PASS |
| 2 | Register avec email + telephone → 201 | PASS |
| 3 | Register telephone fixe +237 2XX → 201 | PASS |
| 4 | Register 409 telephone deja utilise | PASS |
| 5 | Register 400 ni email ni telephone | PASS |
| 6 | Register 400 format telephone invalide | PASS |
| 7 | Register 400 telephone sans prefixe +237 | PASS |
| 8 | Login par telephone → 200 | PASS |
| 9 | GET /me retourne phone pour user sans email | PASS |

### Verification format telephone
- `+237691234567` (mobile 6XX) → VALIDE
- `+237222123456` (fixe 2XX) → VALIDE
- `+33612345678` (pas camerounais) → REJETE
- `691234567` (sans prefixe) → REJETE
- Regex utilisee : `/^\+237[62]\d{8}$/`

---

## Non-regression

### Correctifs appliques aux tests Phase 1
Les routes API existantes ayant ete mises a jour avec `requireAuth()` (Story 6.8),
les tests Phase 1 ont necessite des ajustements :

1. **bacs.test.ts** : ajout mock `@/lib/auth` + passage de `NextRequest` aux appels GET
2. **vagues.test.ts** : ajout mock `@/lib/auth`
3. **releves.test.ts** : ajout mock `@/lib/auth`
4. **Tous les mocks auth** : ajout `phone: null` dans UserSession (BUG-001)

### Resultat non-regression
- **156 tests Phase 1** : TOUS PASSES (0 regression)
- **49 tests Sprint 6 + BUG-001** : TOUS PASSES
- **Build production** : OK (TypeScript compile sans erreur)

---

## Build

```
npm run build → OK
- TypeScript : 0 erreur
- 16 pages generees (dont /login, /register, auth API)
- Middleware proxy fonctionnel
```

---

## Couverture des regles R1-R9

| Regle | Verifiee | Detail |
|-------|----------|--------|
| R1 — Enums MAJUSCULES | Oui | Role.ADMIN, Role.GERANT, Role.PISCICULTEUR |
| R2 — Import enums | Oui | `import { Role } from "@/types"` dans les routes |
| R3 — Prisma = TS | Oui | User.email nullable, User.phone nullable — aligne |
| R5 — DialogTrigger | N/A | Pas de Dialog dans Sprint 6 auth |
| R9 — Tests avant review | Oui | 205 tests OK + build OK |

---

## Conclusion

Le Sprint 6 (Authentification) + BUG-001 (login telephone) sont entierement testes :
- Fonctions utilitaires d'auth (password + session) testees unitairement
- 4 endpoints API auth testes (register, login, logout, me)
- Login par email ET par telephone verifie
- Register avec email, telephone, ou les deux
- Validation format camerounais (+237 6XX/2XX)
- Protection des 6 routes existantes verifiee (401 sans session)
- Non-regression complete : aucun test Phase 1 casse
- Build production OK
