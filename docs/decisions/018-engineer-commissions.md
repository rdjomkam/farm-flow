# ADR-018 — Commissions Ingénieurs & Portefeuille

**Date :** 2026-03-20
**Statut :** Acceptée
**Auteur :** @architect
**Sprint :** Sprint 30

---

## Contexte

Les ingénieurs piscicoles supervisent des fermes clientes et doivent recevoir une commission
sur les abonnements des promoteurs qu'ils ont référés ou qu'ils suivent techniquement.

Deux modèles de rémunération coexistent :
1. **Taux par défaut (10%)** — ingénieur ajouté manuellement par un promoteur existant
2. **Taux premium (20%)** — ingénieur a formé le promoteur ou l'a référé à la plateforme

---

## Calcul des commissions

### Déclencheur
Une `CommissionIngenieur` est créée automatiquement lors de chaque confirmation de
`PaiementAbonnement.CONFIRME`, si l'abonnement a un `ingenieurId` renseigné.

```typescript
// Lors de la confirmation d'un paiement
if (abonnement.ingenieurId && paiement.statut === StatutPaiementAbo.CONFIRME) {
  const taux = getTauxCommission(abonnement); // 0.10 ou 0.20
  await createCommission({
    ingenieurId: abonnement.ingenieurId,
    siteClientId: abonnement.siteId,
    abonnementId: abonnement.id,
    paiementAbonnementId: paiement.id,
    montant: paiement.montant * taux,
    taux,
    statut: StatutCommissionIng.EN_ATTENTE,
    periodeDebut: abonnement.dateDebut,
    periodeFin: abonnement.dateFin,
    siteId: SITE_DKFARM_ID,
  });
}
```

### Taux de commission

| Contexte | Taux | Constante |
|----------|------|-----------|
| Ingénieur ajouté par le promoteur | 10% | `COMMISSION_TAUX_DEFAULT` |
| Ingénieur a formé/référé le promoteur | 20% | `COMMISSION_TAUX_PREMIUM` |

La décision sur le taux est prise lors de la liaison ingénieur ↔ abonnement
(champ à définir dans Sprint 34 selon le contexte d'assignation).

---

## Cycle de vie d'une commission

```
EN_ATTENTE (J+0) ──► DISPONIBLE (J+30) ──► DEMANDEE ──► PAYEE
                                               │
                                               └──► ANNULEE (si remboursement abonnement)
```

### Protection contre les remboursements
Une commission passe `DISPONIBLE` après **30 jours** de la date de paiement de l'abonnement.
Ce délai protège contre les remboursements d'abonnements.

```typescript
// CRON job — rendre les commissions disponibles
await prisma.commissionIngenieur.updateMany({
  where: {
    statut: StatutCommissionIng.EN_ATTENTE,
    createdAt: { lt: subDays(maintenant, 30) },
  },
  data: { statut: StatutCommissionIng.DISPONIBLE },
});
```

### Annulation
Si un abonnement est remboursé, toutes ses commissions `EN_ATTENTE` passent `ANNULEE`.
Les commissions déjà `DISPONIBLE` ou `PAYEE` ne sont **pas** annulées automatiquement
(décision admin nécessaire).

---

## Portefeuille ingénieur

`PortefeuilleIngenieur` agrège le solde disponible :

```
solde = SUM(commissions DISPONIBLE)
soldePending = SUM(commissions EN_ATTENTE)
totalGagne = SUM(toutes commissions non ANNULEE)
totalPaye = SUM(commissions PAYEE)
```

Le `solde` est maintenu par les queries de manière atomique (R4) :
à chaque passage EN_ATTENTE → DISPONIBLE, incrémenter `solde` et décrémenter `soldePending`.

---

## Processus de retrait

### Règles
- Montant minimum : **5 000 FCFA** (`RETRAIT_MINIMUM_FCFA`)
- L'ingénieur soumet une `DemandeRetraitDTO`
- Un admin DKFarm valide et déclenche le virement via Mobile Money
- Le virement est enregistré dans `RetraitPortefeuille`

### Workflow

```
Ingénieur → POST /api/portefeuille/retrait (DemandeRetraitDTO)
         → Crée RetraitPortefeuille EN_ATTENTE
         → Décremente solde (atomique R4)

Admin DKFarm → PUT /api/admin/retraits/[id]/traiter
            → Déclenche paiement Mobile Money
            → Met à jour statut → CONFIRME ou ECHEC
            → Si ECHEC : récréditer le solde (transaction atomique)
```

---

## Conséquences

- Sprint 30 : modèles + logique documentée (cette ADR)
- Sprint 34 : implémentation API commissions + portefeuille + retraits
- Sprint 34 : CRON job mensuel pour rendre les commissions disponibles
- Les queries vivront dans `src/lib/queries/commissions.ts` (Sprint 30 Story 30.4)
