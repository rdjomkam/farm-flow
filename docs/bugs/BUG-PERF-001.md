# BUG-PERF-001 — Absence de cache serveur : requêtes Prisma fraîches à chaque page load
**Sévérité :** Haute
**Détecté par :** @architect
**Sprint :** Performance (hors-sprint)
**Fichier(s) :**
- `src/app/(farm)/page.tsx`
- `src/lib/queries/finances.ts`
- `src/lib/api-cache.ts`
- Tous les Server Components sous `src/app/(farm)/`

## Description
Chaque chargement de page déclenche entre 10 et 15 requêtes Prisma fraîches côté serveur. Il n'existe aucun `unstable_cache`, aucun ISR (`revalidate`), et aucune intégration Prisma Accelerate pour les données qui changent rarement (config élevage, résumé financier du mois précédent, vagues terminées).

Le module `src/lib/api-cache.ts` génère des headers `Cache-Control: private, max-age=N` qui protègent uniquement le cache navigateur côté client — ils ne réduisent pas la charge serveur sur la base de données.

La seule donnée mise en cache côté serveur est `check-subscription.ts` (TTL 1h, `unstable_cache`), qui est un bon modèle à étendre.

## Étapes de reproduction
1. Ouvrir `/` (dashboard)
2. Observer les logs Prisma : 10-15 requêtes sont exécutées
3. Recharger la page : exactement les mêmes requêtes sont ré-exécutées
4. Avec 10 utilisateurs simultanés : 100-150 requêtes DB par rafraîchissement

## Cause racine
Absence de stratégie de cache serveur. Le pattern `unstable_cache` + `revalidateTag` est déjà implémenté pour les abonnements mais n'a pas été étendu aux données métier.

## Fix
- [ ] Envelopper les fonctions de queries Prisma fréquentes dans `unstable_cache` avec des TTL adaptés (60s pour le dashboard, 5min pour les vagues terminées, 10min pour la config)
- [ ] Ajouter `export const revalidate = 60` sur les segments de route sans données temps réel
- [ ] Ajouter `revalidateTag` dans les API routes mutation correspondantes
- [ ] Évaluer Prisma Accelerate pour le caching query-level en production
- [ ] Test de non-régression : vérifier que les données se mettent à jour après mutation (revalidation correcte)
- [ ] Tous les tests passent
- [ ] Build OK

## Statut : OUVERT
