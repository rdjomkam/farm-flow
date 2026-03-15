# ADR-010 — System User pour les entités auto-générées (Phase 3)

**Date :** 2026-03-20
**Statut :** Accepté
**Sprint :** 20 (Packs & Provisioning)
**Source :** Review adversariale F-03

## Contexte

Lors du provisioning d'un pack (création transactionnelle d'un site client), plusieurs entités sont créées automatiquement par le système :
- Vague initiale
- Mouvements stock ENTREE (produits du pack)
- Activités (si moteur d'activités actif — Sprint 21+)

Ces entités nécessitent un `userId` non-null (contrainte FK sur plusieurs modèles). Mais elles ne sont pas créées par un utilisateur humain.

## Problème

Le finding F-03 de la review adversariale identifie l'absence d'un userId valide pour les entités auto-générées lors du provisioning comme un problème bloquant.

Options considérées :
1. **Rendre userId nullable** — risque de régression, contraire aux règles R7 (nullabilité explicite)
2. **Utiliser l'userId de l'ingénieur activant** — incohérent (l'ingénieur n'a pas créé ces données)
3. **Créer un System User par site** — propre, traçable, facile à filtrer dans les UIs

## Décision

Ajouter un champ `isSystem Boolean @default(false)` sur le modèle `User`.

Lors de l'initialisation d'un site (seed ou provisioning), créer un User système :
- `name` : "FarmFlow System"
- `isSystem` : true
- `passwordHash` : valeur impossible à utiliser pour se connecter (ex: bcrypt d'un UUID aléatoire)
- `email` : null
- `phone` : null
- `role` : PISCICULTEUR (le moins de permissions, ce user ne se connecte jamais)

Toutes les entités auto-générées (provisioning, moteur d'activités) utilisent l'ID de ce system user comme `userId`.

## Conséquences

### Positives
- Les UIs peuvent filtrer `WHERE isSystem = false` pour masquer les entités auto-générées
- La traçabilité reste intacte (on sait que c'est le système)
- Pas de changement de nullabilité (R7 respectée)

### Négatives
- Il faut s'assurer qu'un system user existe avant tout provisioning
- Le seed doit inclure le system user pour le site DKFarm

## Implémentation

```prisma
model User {
  // ...
  isSystem Boolean @default(false)
  // ...
}
```

Dans seed.sql :
```sql
INSERT INTO "User" (id, name, "passwordHash", role, "isSystem")
VALUES ('system_dkfarm', 'FarmFlow System', '$IMPOSSIBLE_HASH', 'PISCICULTEUR', true);
```

Dans le provisioning :
```typescript
const systemUser = await prisma.user.findFirst({
  where: { siteId: vendeurSiteId, isSystem: true }
});
// ou créer si absent
```
