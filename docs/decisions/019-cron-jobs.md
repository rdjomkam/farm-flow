# ADR-019 — CRON Jobs : Architecture et Sécurisation

**Date :** 2026-03-21
**Statut :** Accepté
**Sprint :** 36
**Auteur :** @developer

---

## Contexte

Le projet nécessite des traitements automatiques quotidiens :
1. Transitions de statut des abonnements (lifecycle : ACTIF → EN_GRACE → SUSPENDU → EXPIRE)
2. Disponibilité des commissions ingénieur (EN_ATTENTE → DISPONIBLE après J+30)
3. Génération des activités planifiées (Sprint 35)

Ces traitements doivent s'exécuter sans intervention humaine, de façon fiable et sécurisée.

---

## Décision : Vercel Cron Jobs

### Choix : Vercel Cron (vercel.json)

Vercel Cron est la solution native pour les projets Next.js déployés sur Vercel. Il appelle des endpoints HTTP selon une planification cron standard.

**Avantages :**
- Intégration native avec Next.js App Router
- Aucune infrastructure supplémentaire (pas de Redis, pas de worker séparé)
- Configuration centralisée dans `vercel.json`
- Logs disponibles dans le dashboard Vercel
- Retry automatique en cas d'échec

**Inconvénients acceptés :**
- Fonctionne uniquement sur Vercel (pas en dev local sans tunnel)
- Granularité minimale : 1 minute (suffisant pour nos besoins quotidiens)
- Timeout par défaut : 10s sur Hobby, 60s sur Pro — nos traitements sont rapides

### Alternatives rejetées

| Option | Raison du rejet |
|--------|----------------|
| GitHub Actions scheduled | Couplage au CI/CD, pas idéal pour les tâches opérationnelles |
| Trigger.dev / Inngest | Dépendance externe supplémentaire non justifiée à ce stade |
| Cron Linux sur VPS | Infrastructure séparée non cohérente avec le déploiement Vercel |

---

## Sécurisation par CRON_SECRET

### Problème

Les endpoints CRON sont des routes HTTP publiques. Sans protection, n'importe qui pourrait les appeler.

### Solution : Authorization Bearer + crypto.timingSafeEqual

Chaque endpoint CRON vérifie le header `Authorization: Bearer {CRON_SECRET}` en utilisant `crypto.timingSafeEqual` pour éviter les timing attacks.

```typescript
function timingSafeTokenEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return crypto.timingSafeEqual(bufA, bufB);
}
```

**Vercel Cron** envoie automatiquement le header `Authorization: Bearer {CRON_SECRET}` si `CRON_SECRET` est défini dans les variables d'environnement du projet Vercel.

### Configuration requise

1. Générer un secret fort : `openssl rand -hex 32`
2. Ajouter `CRON_SECRET=<valeur>` dans les variables d'environnement Vercel
3. La valeur est également dans `.env.example` comme documentation

---

## Idempotence

Tous les endpoints CRON sont **idempotents** : les appeler plusieurs fois le même jour ne produit pas d'effets cumulatifs.

### Garanties d'idempotence

**`/api/cron/subscription-lifecycle`** :
- Transitions via `updateMany` avec condition `where: { statut: X }` (R4)
- Si l'abonnement est déjà dans le bon statut, `updateMany` ne modifie rien
- `rendreCommissionsDisponiblesCron` : `updateMany` avec condition `createdAt < J-30`

**`/api/activites/generer`** :
- `runEngineForSite` compte les doublons et saute les activités déjà créées
- `runLifecycle` utilise des conditions temporelles

---

## Planning des CRON Jobs

| Endpoint | Schedule | Heure | Rôle |
|----------|----------|-------|------|
| `/api/activites/generer` | `0 5 * * *` | 05:00 UTC (06:00 WAT) | Génération activités + alertes + lifecycle PackActivation |
| `/api/cron/subscription-lifecycle` | `0 8 * * *` | 08:00 UTC (09:00 WAT) | Transitions abonnements + commissions disponibles |

Les deux jobs sont décalés de 3h pour éviter la contention sur la base de données.

---

## Implémentation

### Fichiers créés/modifiés

| Fichier | Action |
|---------|--------|
| `src/app/api/cron/subscription-lifecycle/route.ts` | Créé — endpoint CRON lifecycle abonnements |
| `vercel.json` | Modifié — ajout entrée subscription-lifecycle |
| `.env.example` | Modifié — ajout variable CRON_SECRET documentée |

### Pattern de référence

Le pattern est établi dans `src/app/api/activites/generer/route.ts` :
- Vérification `Authorization: Bearer` via `timingSafeTokenEqual`
- Try/catch global avec message d'erreur structuré
- Retour JSON avec compteurs détaillés

---

## Conséquences

- Tout nouvel endpoint CRON DOIT utiliser le même pattern de vérification (timingSafeEqual)
- `CRON_SECRET` DOIT être configuré dans les variables d'environnement Vercel avant déploiement
- En développement local, les endpoints CRON peuvent être testés avec `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/subscription-lifecycle`
