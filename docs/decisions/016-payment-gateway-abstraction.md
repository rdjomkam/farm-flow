# ADR-016 — Abstraction des Passerelles de Paiement

**Date :** 2026-03-20
**Statut :** Acceptée — Implémentation conforme (Sprints 31-36)
**Auteur :** @architect
**Sprint :** Sprint 30

---

## Contexte

FarmFlow permet aux promoteurs de pisciculture de payer leur abonnement en Mobile Money
(MTN MoMo, Orange Money — les deux opérateurs dominants au Cameroun). Deux approches existent :

1. **Intégration directe** : appeler l'API MTN MoMo et l'API Orange Money séparément.
2. **Agrégateur** : passer par Smobilpay/Maviance, un agrégateur camerounais qui unifie MTN + OM
   sous une API unique.

Les paiements Mobile Money sont **asynchrones** (USSD push-based) : on initie la transaction,
le client reçoit une invite USSD sur son téléphone, valide, puis le callback webhook confirme.

---

## Options considérées

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| Intégration directe MTN + OM | Contrôle total, pas d'intermédiaire | 2 APIs différentes, gestion double |
| Smobilpay/Maviance uniquement (Phase 1) | API unifiée, certifié Cameroun, simple | Dépendance à un tiers, frais supplémentaires |
| Abstraction interface + factory | Flexibilité future, isolation des gateways | Plus de code initial |

---

## Décision

**Abstraction via interface + factory pattern.**

Phase 1 : Smobilpay/Maviance uniquement (agrégateur qui couvre MTN + OM).
Phase 2 : Gateways directs MTN MoMo et Orange Money (optionnel selon performance).

### Interface PaymentGateway

```typescript
/** Paramètres pour initier un paiement */
export interface InitiatePaymentParams {
  /** Montant en FCFA */
  amount: number;
  /** Numéro de téléphone Mobile Money du payeur (ex: +237699000000) */
  phone: string;
  /** Référence interne déterministe (ex: SUB-{abonnementId}-{YYYYMM}) */
  reference: string;
  /** Description affichée sur le téléphone du client */
  description: string;
}

/** Réponse d'initiation d'un paiement */
export interface InitiatePaymentResult {
  /** ID de transaction côté gateway */
  transactionId: string;
  /** Statut initial attendu : EN_ATTENTE ou INITIE */
  statut: "EN_ATTENTE" | "INITIE";
  /** Réponse brute de la gateway pour archivage */
  rawResponse: Record<string, unknown>;
}

/** Résultat d'une vérification de statut */
export interface CheckStatusResult {
  statut: "EN_ATTENTE" | "INITIE" | "CONFIRME" | "ECHEC" | "EXPIRE";
  rawResponse: Record<string, unknown>;
}

/** Interface d'abstraction des gateways de paiement */
export interface PaymentGateway {
  /**
   * Initie un paiement USSD push.
   * Le client reçoit une invitation sur son téléphone.
   */
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;

  /**
   * Vérifie le statut d'une transaction existante.
   * Utilisé pour le polling ou après un webhook.
   */
  checkStatus(transactionId: string): Promise<CheckStatusResult>;

  /**
   * Traite un webhook entrant de la gateway.
   * Vérifie la signature et extrait les données.
   */
  processWebhook(
    payload: Record<string, unknown>,
    signature: string
  ): Promise<{
    transactionId: string;
    statut: "CONFIRME" | "ECHEC" | "EXPIRE";
    rawResponse: Record<string, unknown>;
  }>;
}
```

### Factory pattern

```typescript
/**
 * getPaymentGateway — Retourne le gateway selon le fournisseur.
 * Utiliser FournisseurPaiement enum (R2).
 */
export function getPaymentGateway(
  fournisseur: FournisseurPaiement
): PaymentGateway {
  switch (fournisseur) {
    case FournisseurPaiement.SMOBILPAY:
      return new SmobilpayGateway();
    case FournisseurPaiement.MTN_MOMO:
      return new MtnMomoGateway(); // Phase 2
    case FournisseurPaiement.ORANGE_MONEY:
      return new OrangeMoneyGateway(); // Phase 2
    case FournisseurPaiement.MANUEL:
      throw new Error("Paiement MANUEL ne passe pas par une gateway");
  }
}
```

---

## Règles de sécurité

### Idempotence
Avant de confirmer un paiement, TOUJOURS vérifier que `referenceExterne` n'est pas déjà
`CONFIRME` dans `PaiementAbonnement`. Pattern :

```typescript
// Vérifier l'idempotence avant d'appliquer
const existing = await getPaiementByReference(transactionId);
if (existing?.statut === StatutPaiementAbo.CONFIRME) {
  return; // Déjà traité — ignorer silencieusement
}
```

### Vérification webhook
Chaque gateway a une clé secrète dans `.env` :
- `SMOBILPAY_WEBHOOK_SECRET`
- `MTN_MOMO_WEBHOOK_SECRET` (Phase 2)
- `ORANGE_MONEY_WEBHOOK_SECRET` (Phase 2)

La signature doit être vérifiée **avant** toute action sur la base de données.

### Stockage des réponses brutes
Le champ `metadata Json?` sur `PaiementAbonnement` stocke la réponse brute complète
de la gateway. Cela permet l'audit et le debugging sans mapping partiel.

---

## Variables d'environnement requises

```env
# Sprint 31 — Payment Gateways
SMOBILPAY_API_KEY=...
SMOBILPAY_API_SECRET=...
SMOBILPAY_BASE_URL=https://api.smobilpay.com/v1
SMOBILPAY_WEBHOOK_SECRET=...
```

---

## Conséquences

- Sprint 30 : interface TypeScript définie (cette ADR), pas d'implémentation
- Sprint 31 : implémentation SmobilpayGateway + routes webhook
- Sprint 31+ : Tests unitaires avec gateways mockés (pas d'appels réels)
- Phase 2 : MtnMomoGateway et OrangeMoneyGateway si nécessaire

Les gateways vivront dans `src/lib/payment-gateways/`.

---

## Note d'implémentation — Sprints 31-36

**Confirmé — implémentation conforme à l'ADR**, avec les précisions suivantes :

### Écart de chemin
- ADR prévu : `src/lib/payment-gateways/`
- Chemin réel : `src/lib/payment/`
- Raison : organisation plus standard avec `index.ts` + `factory.ts` + `types.ts` séparés.

### Fichiers créés
| Fichier | Rôle |
|---------|------|
| `src/lib/payment/types.ts` | Interface `PaymentGateway`, `InitiatePaymentParams`, `InitiatePaymentResult`, `CheckStatusResult` |
| `src/lib/payment/factory.ts` | `getPaymentGateway(fournisseur)` — factory pattern ADR-016 |
| `src/lib/payment/smobilpay-gateway.ts` | Implémentation Smobilpay (Phase 1) |
| `src/lib/payment/manual-gateway.ts` | Implémentation MANUEL (paiements offline) |
| `src/lib/payment/__mocks__/smobilpay-gateway.ts` | Mock pour tests unitaires |
| `src/lib/payment/index.ts` | Barrel export |
| `src/app/api/webhooks/smobilpay/route.ts` | Endpoint webhook Smobilpay avec vérification signature |
| `src/app/api/webhooks/manuel/route.ts` | Endpoint confirmation manuelle |

### Sécurité : conforme
- Vérification `timingSafeEqual` sur le secret webhook (voir ADR-019)
- Idempotence garantie via `referenceExterne` unique sur `PaiementAbonnement`
- Réponses brutes stockées dans le champ `metadata Json?`

### Phase 2 : toujours en attente
`MtnMomoGateway` et `OrangeMoneyGateway` non implémentées — Smobilpay couvre MTN + OM via agrégation.
