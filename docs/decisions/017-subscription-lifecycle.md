# ADR-017 — Cycle de Vie des Abonnements

**Date :** 2026-03-20
**Statut :** Acceptée
**Auteur :** @architect
**Sprint :** Sprint 30

---

## Contexte

Les abonnements FarmFlow ont un cycle de vie qui doit gérer les impayés de manière
progressive, sans couper brutalement l'accès aux données des éleveurs. Le marché
camerounais présente des contraintes spécifiques :

- Instabilité des revenus des promoteurs (dépend des cycles de production)
- Paiements mobiles USSD parfois échoués (réseau, solde insuffisant)
- Risque de perte de données si suspension trop rapide

---

## Cycle de vie

```
                        Paiement OK
                      ┌─────────────────────────────┐
                      │                             │
                      ▼                             │
EN_ATTENTE_PAIEMENT ──► ACTIF ──► (J+0 expiry) ──► EN_GRACE ──► SUSPENDU ──► EXPIRE
                         ▲          Rappels J-14,          │J+7      │J+30      │J+90
                         │          J-7, J-3, J-1          │         │          │
                         │                                  │         │          ▼
                         └──── Paiement OK ─────────────────┘─────────┘      archivage
                                depuis EN_GRACE,
                                SUSPENDU (si < 90j)
```

### Détail des états

| État | Description | Accès aux données | Durée |
|------|-------------|-------------------|-------|
| `EN_ATTENTE_PAIEMENT` | Abonnement créé, paiement non encore confirmé | Aucun accès | Indéfini |
| `ACTIF` | Abonnement valide et payé | Accès complet | Selon période |
| `EN_GRACE` | Période de grâce post-expiration | Accès complet | 7 jours |
| `SUSPENDU` | Grâce expirée, en attente de paiement | Lecture seule | 30 jours |
| `EXPIRE` | Long impayé, données menacées | Aucun accès | 90 jours |
| `ANNULE` | Annulation volontaire avant expiry | Accès jusqu'à dateFin | - |

---

## Transitions automatiques (CRON job quotidien)

```
Chaque jour à 00:00 UTC :

1. ACTIF → EN_GRACE si dateFin < maintenant
2. EN_GRACE → SUSPENDU si dateFin + 7j < maintenant
3. SUSPENDU → EXPIRE si dateFin + 37j < maintenant
4. Envoi rappels : abonnements ACTIF avec dateFin dans J-14, J-7, J-3, J-1
```

Toutes ces transitions utilisent `updateMany` avec condition (R4 — atomique) :

```typescript
// Exemple : passer ACTIF → EN_GRACE
await prisma.abonnement.updateMany({
  where: {
    statut: StatutAbonnement.ACTIF,
    dateFin: { lt: maintenant },
  },
  data: {
    statut: StatutAbonnement.EN_GRACE,
    dateFinGrace: addDays(maintenant, GRACE_PERIOD_JOURS),
  },
});
```

---

## Réactivation depuis un état dégradé

| État actuel | Réactivation possible ? | Condition |
|-------------|------------------------|-----------|
| `EN_GRACE` | Oui | Paiement confirmé |
| `SUSPENDU` | Oui | Paiement confirmé |
| `EXPIRE` | Oui (sous conditions) | Paiement confirmé + validation admin |

---

## Impact sur les permissions (middleware)

Middleware `checkSubscriptionStatus` à appeler dans les Server Components critiques :

```typescript
// Comportement selon statut
switch (abonnement.statut) {
  case StatutAbonnement.ACTIF:
  case StatutAbonnement.EN_GRACE:
    // Accès complet — continuer normalement
    break;
  case StatutAbonnement.SUSPENDU:
    // Accès lecture seule — redirect vers page "Abonnement suspendu"
    redirect("/abonnement/suspendu");
  case StatutAbonnement.EXPIRE:
  case StatutAbonnement.ANNULE:
    // Aucun accès — redirect vers page renouvellement
    redirect("/abonnement/expire");
}
```

---

## Rappels et notifications

| Délai | Type | Canal |
|-------|------|-------|
| J-14 | Rappel doux | Notification in-app |
| J-7 | Rappel modéré | Notification in-app + SMS |
| J-3 | Rappel urgent | Notification in-app + SMS |
| J-1 | Rappel critique | Notification in-app + SMS |
| J+0 (EN_GRACE) | Alerte grâce | Notification in-app + SMS |
| J+7 (SUSPENDU) | Alerte suspension | SMS |

---

## Conséquences

- Sprint 30 : modèles + cycle de vie documenté (cette ADR)
- Sprint 36 : implémentation CRON job + rappels
- Sprint 36 : middleware `checkSubscriptionStatus`
- Les jobs CRON vivront dans `src/lib/cron/subscription-lifecycle.ts`
