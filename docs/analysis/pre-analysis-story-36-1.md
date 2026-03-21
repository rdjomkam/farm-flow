# Pré-analyse Story 36.1 — CRON job : transitions de statut quotidiennes
**Date :** 2026-03-21
**Sprint :** 36

## Statut : GO

## Résumé
Toutes les dépendances sont satisfaites. Les services `abonnementLifecycleService.transitionnerStatuts()` et `commissionsService.rendreCommissionsDisponiblesCron()` existent et sont prêts à l'emploi. Un pattern de route CRON identique existe dans `/api/activites/generer/route.ts`. `vercel.json` et `.env.example` sont présents et doivent être complétés.

---

## Vérifications effectuées

### Schema ↔ Types : OK
- `StatutAbonnement` : 6 valeurs UPPERCASE (ACTIF, EN_GRACE, SUSPENDU, EXPIRE, ANNULE, EN_ATTENTE_PAIEMENT) — identiques dans `prisma/schema.prisma` et `src/types/models.ts`
- `StatutCommissionIng` : 5 valeurs UPPERCASE (EN_ATTENTE, DISPONIBLE, DEMANDEE, PAYEE, ANNULEE) — identiques dans schéma et types
- Les deux enums sont exportés dans `src/types/index.ts` (lignes 66 et 69)
- Les modèles `Abonnement` et `CommissionIngenieur` existent dans le schéma avec les bons champs (`statut`, `dateFin`, `dateFinGrace`)

### Services existants : OK
Les deux fonctions attendues par la story existent :

- `src/lib/services/abonnement-lifecycle.ts` — `transitionnerStatuts()` : gère les 3 transitions ACTIF→EN_GRACE, EN_GRACE→SUSPENDU, SUSPENDU→EXPIRE (R4 : updateMany atomique)
- `src/lib/services/commissions.ts` — `rendreCommissionsDisponiblesCron()` : rend disponibles les commissions EN_ATTENTE créées il y a plus de 30 jours

Note importante : la story spécifie d'appeler `commissionsService.rendreCommissionsDisponibles()` mais le nom réel de la fonction exportée est `rendreCommissionsDisponiblesCron()` (avec suffixe `Cron`). Le développeur doit utiliser ce nom exact.

### API — Pattern CRON existant : OK
`src/app/api/activites/generer/route.ts` est un modèle direct à réutiliser :
- Méthode POST avec vérification `Authorization: Bearer {CRON_SECRET}` via `crypto.timingSafeEqual` (timing-safe)
- Variable `process.env.CRON_SECRET` déjà utilisée
- Retour structuré `{ stats: { ... } }`

La story demande un handler `GET` (au lieu de `POST` pour `/api/activites/generer`). C'est cohérent avec Vercel Cron qui appelle les routes en GET.

### Infrastructure : OK AVEC NOTE
- `vercel.json` : EXISTE déjà à la racine — contient déjà un cron job (`/api/activites/generer` à `0 5 * * *`). Il faut ajouter une entrée, pas créer le fichier.
- `.env.example` : EXISTE mais ne contient PAS de `CRON_SECRET`. Il faut l'ajouter.
- `.env` local : ne contient pas non plus `CRON_SECRET`. À noter pour le développeur.

### Idempotence : OK par conception
`transitionnerStatuts()` utilise `updateMany` avec conditions sur les statuts — si les transitions ont déjà eu lieu, `count = 0`. Idem pour `rendreCommissionsDisponiblesCron()` qui filtre par `createdAt < dateAvant`.

### ADR-019 : ABSENT — À CRÉER
`docs/decisions/` ne contient pas de fichier `019-cron-jobs.md`. C'est une livrable de la story.

---

## Incohérences trouvées

1. **Nom de fonction commission** — La story cite `commissionsService.rendreCommissionsDisponibles()` mais la fonction exportée dans `src/lib/services/commissions.ts` s'appelle `rendreCommissionsDisponiblesCron()`. Le développeur doit utiliser le nom exact : `rendreCommissionsDisponiblesCron`.
   - Fichier concerné : `src/lib/services/commissions.ts` ligne 169
   - Suggestion : importer `{ rendreCommissionsDisponiblesCron }` depuis ce fichier

2. **CRON_SECRET absent des env files** — Ni `.env.example` ni `.env` local ne définissent `CRON_SECRET`, alors que `/api/activites/generer` l'utilise déjà en production. Le job existant est donc déjà dépendant de cette variable.
   - Fichiers concernés : `.env.example`, `.env`
   - Suggestion : ajouter `CRON_SECRET=` dans les deux fichiers dans la même livraison

---

## Risques identifiés

1. **Conflit de schedule Vercel Cron** — `vercel.json` a déjà `0 5 * * *` pour `/api/activites/generer`. Si on ajoute `/api/cron/subscription-lifecycle` avec un horaire différent (ex: `0 0 * * *` pour minuit UTC selon ADR-017), il n'y a pas de conflit. Si on utilise le même horaire, le plan Vercel gratuit limite le nombre de crons.
   - Impact : Moyen — vérifier les limites du plan Vercel avant de choisir l'horaire
   - Mitigation : utiliser `0 0 * * *` (minuit UTC, conforme ADR-017) et documenter le choix dans ADR-019

2. **ERR-013 résilience** — La note de connaissance ERR-013 signale que le rate limiting in-memory n'est pas partagé entre instances serverless. Ce n'est pas directement applicable au CRON (il est appelé une fois/jour), mais le même principe s'applique à l'idempotence si Vercel retry une invocation échouée. Les `updateMany` conditionnels de `transitionnerStatuts()` gèrent ce cas correctement.

---

## Prérequis manquants

Aucun prérequis bloquant. Les fichiers suivants seront créés/modifiés par la story :
1. CRÉER `src/app/api/cron/subscription-lifecycle/route.ts` — route principale
2. MODIFIER `vercel.json` — ajouter l'entrée cron (ne pas écraser l'existante)
3. MODIFIER `.env.example` — ajouter `CRON_SECRET=your-secret-here`
4. CRÉER `docs/decisions/019-cron-jobs.md` — ADR documentation

---

## Recommandation

GO. Développer en utilisant `/api/activites/generer/route.ts` comme patron exact (timing-safe token, try/catch global, retour structuré). Attention aux deux points : nom de fonction `rendreCommissionsDisponiblesCron` et ajout dans `vercel.json` sans écraser l'entrée existante.
