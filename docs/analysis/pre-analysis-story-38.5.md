# Pre-analyse Story 38.5 — SiteModule : ajout ABONNEMENTS/COMMISSIONS/REMISES + distinction platform/site-level (BUG-022)
**Date :** 2026-03-21
**Sprint :** 38

---

## Statut : GO AVEC RESERVES

---

## Resume

L'enum `SiteModule` (Prisma + TypeScript) ne contient pas les valeurs `ABONNEMENTS`, `COMMISSIONS`, `REMISES` introduites dans les Sprints 33-35. Ces modules sont actuellement gateables uniquement par permission (`PHASE3_MODULE_PERMISSIONS` dans `sidebar.tsx`) mais pas par le systeme de modules de site. La story est implementable sans bloquer le build (qui passe a 100%), mais 18 tests pre-existants echouent — aucun n'est lie au perimetre de cette story. La migration Prisma pour etendre l'enum sera la seule operation risky (pattern RECREATE obligatoire, ERR-001).

---

## Verifications effectuees

### Schema Prisma — SiteModule

Valeurs actuelles dans `prisma/schema.prisma` :
```
REPRODUCTION, GROSSISSEMENT, INTRANTS, VENTES, ANALYSE_PILOTAGE,
PACKS_PROVISIONING, CONFIGURATION, INGENIEUR, NOTES
```

Valeurs manquantes : `ABONNEMENTS`, `COMMISSIONS`, `REMISES`

### Types TypeScript — SiteModule

Valeurs actuelles dans `src/types/models.ts` (enum SiteModule, ligne 242) :
```
REPRODUCTION, GROSSISSEMENT, INTRANTS, VENTES, ANALYSE_PILOTAGE,
PACKS_PROVISIONING, CONFIGURATION, INGENIEUR, NOTES
```

Coherence Prisma <-> TypeScript : OK (identiques, aucun ecart)

Valeurs manquantes : `ABONNEMENTS`, `COMMISSIONS`, `REMISES`

### Sidebar — gating des modules Abonnements/Commissions/Remises

Dans `src/components/layout/sidebar.tsx`, les modules Sprint 33-35 sont declares dans `modulesAdminGerant` avec ces labels :
- "Abonnement" (gate: `Permission.ABONNEMENTS_VOIR` via `PHASE3_MODULE_PERMISSIONS`)
- "Admin Abonnements" (gate: `Permission.ABONNEMENTS_GERER`)
- "Portefeuille" (gate: `Permission.PORTEFEUILLE_VOIR`)
- "Admin Commissions" (gate: `Permission.COMMISSIONS_GERER`)
- "Admin Remises" (gate: `Permission.REMISES_GERER`)

Aucun de ces labels n'est present dans `MODULE_LABEL_TO_SITE_MODULE` (`src/lib/permissions-constants.ts`).
Consequence : `siteModule = MODULE_LABEL_TO_SITE_MODULE[mod.label]` retourne `undefined`, donc la condition `if (siteModule && !siteModules.includes(siteModule))` est sautee — les modules abonnements sont toujours visibles (hors gating site). C'est le comportement attendu POUR L'INSTANT mais pas apres le fix.

### site-detail-client.tsx — MODULE_CONFIG

`MODULE_CONFIG` (ligne 59-69) liste exactement les 9 valeurs actuelles de `SiteModule`, sans distinction platform/site-level. Tous sont affichables comme toggleables par un admin.

Apres le fix, si on ajoute `ABONNEMENTS`, `COMMISSIONS`, `REMISES` a `SiteModule` sans filtrage, un admin pourrait les desactiver — ce que BUG-022 interdit explicitement.

La distinction devra etre implementee avec une config TypeScript pure (pas dans l'enum Prisma), par exemple un `Set<SiteModule>` ou un objet constant `PLATFORM_MODULES` dans `permissions-constants.ts`, filtre a l'affichage dans `MODULE_CONFIG`.

### permissions-server.ts — getServerSiteModules()

```typescript
if (site.enabledModules.length === 0) return Object.values(SiteModule);
```

Ce retour fallback `Object.values(SiteModule)` inclura automatiquement les nouvelles valeurs une fois l'enum etendu — comportement correct (backward compat pour les sites sans supervision).

### API route PUT /api/sites/[id]

```typescript
const VALID_MODULES = Object.values(SiteModule);
```

Meme pattern : la validation `VALID_MODULES.includes(m as SiteModule)` acceptera automatiquement les nouvelles valeurs une fois l'enum etendu. Aucune modification de cette route necessaire pour la validation de base.

Cependant, la route ne filtre pas les modules platform — un client pourrait envoyer `enabledModules: ["ABONNEMENTS"]` et le desactiver. Un garde suppletaire devra etre ajoute dans la route PUT pour rejeter toute tentative de toggle sur un module platform.

### Build

Statut : OK — `Compiled successfully in 26.9s`, 127/127 pages generees, aucune erreur TypeScript.

### Tests

Statut : 18 echecs sur 2423 tests (5 fichiers).

Les echecs sont **tous pre-existants** et **hors perimetre** de cette story :

| Fichier | Echecs | Cause |
|---------|--------|-------|
| `benchmarks.test.ts` | 3 | Logique densite (Sprint 27) — pre-existant |
| `sprint22.test.ts` | 1 | RELEVE_COMPATIBLE_TYPES contient 4 types attendus (Sprint 22) — pre-existant |
| `remises-verifier.test.ts` | 6 | Route remises verifier (Sprint 35) — pre-existant |
| `sites.test.ts` | 4 | POST/PUT/DELETE roles (500 au lieu de 201/200/204) — pre-existant |
| `vagues.test.ts` | 4 | POST vagues (conflit mock $transaction R4 Sprint 36) — pre-existant, reference ERR-017 |

Aucun de ces echecs ne concerne `SiteModule` ou les modules abonnements.

---

## Incoherences trouvees

### 1. SiteModule enum incomplet — Prisma + TypeScript
**Fichiers :** `prisma/schema.prisma` (ligne 107-117), `src/types/models.ts` (ligne 242-252)
**Probleme :** Valeurs `ABONNEMENTS`, `COMMISSIONS`, `REMISES` absentes.
**Fix :** Ajouter les 3 valeurs dans les deux fichiers. Migration Prisma avec pattern RECREATE (ERR-001).

### 2. MODULE_LABEL_TO_SITE_MODULE incomplet
**Fichier :** `src/lib/permissions-constants.ts` (ligne 217-230)
**Probleme :** Aucun mapping pour "Abonnement", "Admin Abonnements", "Admin Commissions", "Admin Remises", "Portefeuille".
**Attention :** Le BUG-022 precise que les modules platform ne doivent PAS etre gates par SiteModule dans la sidebar. Donc ces labels ne doivent pas etre ajoutes a `MODULE_LABEL_TO_SITE_MODULE` — leur absence est volontaire apres le fix.

### 3. Absence de distinction platform/site-level
**Fichiers :** `src/lib/permissions-constants.ts`, `src/components/sites/site-detail-client.tsx`
**Probleme :** Pas de metadata pour distinguer les modules always-on (ABONNEMENTS, COMMISSIONS, REMISES) des modules toggleables (REPRODUCTION, VENTES, etc.).
**Fix propose :** Creer un `PLATFORM_MODULES: Set<SiteModule>` ou `Set<string>` dans `permissions-constants.ts`, puis filtrer `MODULE_CONFIG` dans `site-detail-client.tsx` pour exclure les modules platform de l'interface de toggle.

### 4. Route PUT /api/sites/[id] sans garde anti-toggle platform
**Fichier :** `src/app/api/sites/[id]/route.ts` (ligne 89-104)
**Probleme :** La validation `VALID_MODULES.includes(m)` accepte tous les `SiteModule` valides. Apres ajout de ABONNEMENTS/COMMISSIONS/REMISES a l'enum, la route acceptera de les desactiver.
**Fix :** Ajouter une validation : si `enabledModules` contient un module platform, retourner 400.

---

## Risques identifies

### Risque 1 — Migration RECREATE obligatoire (ERR-001)
**Impact :** Moyen — La migration pour etendre `SiteModule` en PostgreSQL ne peut pas utiliser `ADD VALUE` + `UPDATE` dans la meme transaction.
**Mitigation :** Appliquer strictement le pattern RECREATE (ERR-001) : renommer l'ancien type, creer le nouveau, caster les colonnes, supprimer l'ancien. Verifier le fichier SQL genere pour absence de texte non-SQL (ERR-006).

### Risque 2 — getServerSiteModules() retourne ABONNEMENTS en fallback
**Impact :** Faible — Le fallback `Object.values(SiteModule)` inclura les nouvelles valeurs. Cela signifie que les sites sans supervision auront ABONNEMENTS/COMMISSIONS/REMISES dans leur liste de modules actifs, ce qui est le comportement souhaite (toujours disponible). Pas de regression.

### Risque 3 — Tests pre-existants en echec
**Impact :** Faible pour cette story — Les 18 echecs sont pre-existants et hors perimetre. Cependant, tout test de non-regression ajoute pour cette story doit etre execute en isolation pour eviter un faux positif global.

---

## Prerequis manquants

Aucun prerequis bloquant. La story peut demarrer immediatement.

---

## Fichiers a modifier

| Fichier | Modification |
|---------|-------------|
| `prisma/schema.prisma` | Ajouter `ABONNEMENTS`, `COMMISSIONS`, `REMISES` a l'enum `SiteModule` |
| `src/types/models.ts` | Ajouter les 3 valeurs a l'enum `SiteModule` TypeScript |
| `src/lib/permissions-constants.ts` | Ajouter `PLATFORM_MODULES` constant (Set ou objet) — NE PAS ajouter les nouveaux modules a `MODULE_LABEL_TO_SITE_MODULE` |
| `src/components/sites/site-detail-client.tsx` | Filtrer `MODULE_CONFIG` pour exclure les modules platform (lire `PLATFORM_MODULES`) |
| `src/app/api/sites/[id]/route.ts` | Ajouter validation : rejeter les modules platform dans `enabledModules` PUT |
| `prisma/migrations/[timestamp]_extend_sitemodule/migration.sql` | Migration RECREATE pour PostgreSQL |

Fichier de test a creer :
| `src/__tests__/lib/site-modules.test.ts` | Tests : PLATFORM_MODULES ne contient que les modules platform, MODULE_CONFIG filtre correctement, route PUT rejette les modules platform |

---

## Recommandation

GO — Demarrer la story. Build propre, aucun prerequis manquant, incoherences clairement identifiees et bornees. Appliquer le pattern RECREATE pour la migration (ERR-001). Ne pas ajouter les modules platform a `MODULE_LABEL_TO_SITE_MODULE`. Ajouter le garde anti-toggle dans la route PUT.
