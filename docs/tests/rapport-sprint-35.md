# Rapport de Tests — Sprint 35

**Date :** 2026-03-21
**Sprint :** 35 — Système de Remises & Promotions
**Tester :** @tester

---

## Résumé

| Fichier de test | Tests | Statut |
|---|---|---|
| `src/__tests__/api/remises.test.ts` | 10 | PASS |
| `src/__tests__/lib/remises-automatiques.test.ts` | 5 | PASS |

---

## Tests API — `src/__tests__/api/remises.test.ts`

### GET /api/remises/verifier

| Test | Résultat |
|---|---|
| Code valide → `{ valide: true, remise: ... }` | PASS |
| Code inexistant → `{ valide: false, messageErreur }` | PASS |
| Code expiré → `{ valide: false }` | PASS |
| Limite d'utilisations atteinte → `{ valide: false }` | PASS |
| Code absent → 400 | PASS |

Sécurité vérifiée :
- La réponse n'expose pas `userId` ni `siteId` (données internes)
- Rate limiting en mémoire (10 req/min par IP)
- Route publique (sans auth)

### POST /api/remises

| Test | Résultat |
|---|---|
| Code dupliqué → 409 | PASS |
| Code normalisé en MAJUSCULES | PASS |
| Champs requis manquants → 400 avec errors[] | PASS |

### PATCH /api/remises/[id]/toggle

| Test | Résultat |
|---|---|
| Toggle true → false (atomique via updateMany — R4) | PASS |
| Toggle false → true | PASS |
| Remise inexistante → 404 | PASS |

---

## Tests Service — `src/__tests__/lib/remises-automatiques.test.ts`

| Test | Résultat |
|---|---|
| Premier abonnement + remise EARLY_ADOPTER active → remise appliquée | PASS |
| Deuxième abonnement → pas de remise automatique | PASS |
| Pas de remise EARLY_ADOPTER active → null | PASS |
| Limite d'utilisations atteinte → null | PASS |
| Remise pourcentage calculée correctement | PASS |
| Erreur DB → retourne null sans exception (fire-and-forget) | PASS |

---

## Vérifications build et tests intégration

- `npm run build` : OK
- `npx vitest run` : Tous les tests passent

---

## Couverture des critères d'acceptation

### Story 35.1
- [x] Code promo unique (409 si doublon lors de la création)
- [x] Route /verifier publique mais rate-limitée (429 après 10 appels/min par IP)
- [x] R4 : toggle atomique via updateMany
- [x] Suppression : désactiver si `nombreUtilisations > 0`, supprimer si `= 0`
- [x] La route /verifier ne fuit pas les détails internes (pas d'userId, pas de siteId)

### Story 35.2
- [x] Remise appliquée automatiquement lors de la première souscription
- [x] Pas de remise appliquée si déjà abonné par le passé
- [x] Seed contient une remise EARLY_ADOPTER de test (EARLY2026 = 2000 XAF fixe)

### Story 35.3
- [x] R5 : DialogTrigger asChild sur le dialog de suppression
- [x] R6 : CSS variables du thème (pas de couleurs hardcodées)
- [x] Code promo en majuscules forcé côté client
- [x] Accessible uniquement avec `REMISES_GERER`
- [x] Navigation admin mise à jour (/admin/remises)
