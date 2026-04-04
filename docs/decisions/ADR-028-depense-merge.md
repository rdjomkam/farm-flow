# ADR-028 — Fusion de dépenses dupliquées

**Statut :** Accepté
**Date :** 2026-04-04
**Auteur :** @architect

---

## Contexte

Les pisciculteurs créent parfois deux `Depense` qui représentent la même charge
réelle : typiquement deux dépenses générées depuis la même `ListeBesoins` ou la
même `Commande`, ou un doublon de saisie manuelle. Il faut un mécanisme pour
fusionner ces deux dépenses en une seule sans perte d'historique ni incohérence
comptable.

### Contraintes existantes du modèle

- `Depense` possède 4 tables satellites liées par FK + cascade :
  `LigneDepense`, `PaiementDepense` (→ `FraisPaiementDepense`), `AjustementDepense`.
- `montantPaye` et `montantFraisSupp` sont des champs dénormalisés recalculés par
  agrégation à chaque paiement.
- `statut` (`NON_PAYEE` / `PAYEE_PARTIELLEMENT` / `PAYEE`) est dérivé de
  `montantPaye` vs `montantTotal`.
- `numero` est unique par site (format `DEP-YYYY-NNN`).
- `AjustementDepense` est le journal d'audit immuable. On s'appuie dessus pour
  tracer la fusion.

---

## Décision

### 1. Quelle dépense survit ?

La dépense **survivante** est la plus ancienne des deux (champ `date` d'abord,
puis `createdAt` comme tie-breaker). Rationale :

- La date de la dépense représente la date de la charge réelle ; garder la plus
  ancienne préserve la chronologie comptable.
- Prévisible pour l'utilisateur : la dépense "originale" ne disparaît pas.
- Si les deux dates sont identiques, la plus ancienne par `createdAt` survit.

Le choix peut être explicitement surchargé par l'appelant via le champ
`survivantId` du DTO (voir section 5).

### 2. Fusion des LigneDepense

Toutes les `LigneDepense` de la dépense absorbée sont **rattachées** à la
survivante par `UPDATE ligneDepense SET depenseId = survivantId WHERE depenseId = absorbeeId`.

Pas de déduplication automatique des lignes : deux lignes avec la même désignation
restent deux enregistrements distincts (la réalité comptable peut justifier les
deux). L'utilisateur peut ensuite éditer manuellement si besoin.

Après transfert, la `categorieDepense` de la survivante est recalculée via
`computeDominantCategorie` sur l'ensemble des lignes fusionnées.

### 3. Fusion des PaiementDepense (et FraisPaiementDepense)

Tous les `PaiementDepense` de la dépense absorbée sont **rattachés** à la
survivante par `UPDATE paiementDepense SET depenseId = survivantId WHERE depenseId = absorbeeId`.

Les `FraisPaiementDepense` sont liés par `paiementId`, pas par `depenseId` —
ils suivent automatiquement leur paiement, aucune action supplémentaire requise.

Les paiements soft-deletés n'existent pas dans ce modèle (il n'y a pas de
`deletedAt` sur `PaiementDepense`), donc tous les paiements sont transférés.

### 4. Fusion des AjustementDepense

Tous les `AjustementDepense` de la dépense absorbée sont **rattachés** à la
survivante. Cela préserve l'historique complet des deux dépenses dans un seul
fil d'audit.

Un ajustement final de type `MONTANT_TOTAL` est créé automatiquement sur la
survivante pour tracer la décision de fusion (voir section 11).

### 5. Recalcul de montantTotal

Deux stratégies sont possibles :

| Stratégie | Formule | Cas d'usage |
|-----------|---------|-------------|
| **Somme des deux montantTotal** | `montantTotal = A.montantTotal + B.montantTotal` | Les deux dépenses représentaient des charges distinctes qui avaient été créées séparément par erreur |
| **Somme des lignes** | `montantTotal = SUM(lignes.montantTotal)` | Les dépenses avaient des lignes qui se chevauchaient ou étaient partiellement redondantes |

**Décision : somme des deux `montantTotal`** par défaut, avec option d'override via
`montantTotalFinal` dans le DTO.

Rationale : si l'utilisateur sait que les montants étaient dupliqués (ex. même
commande facturée deux fois), il peut passer `montantTotalFinal` explicitement.
Dans le cas où les deux dépenses représentaient des charges réelles distinctes
regroupées a posteriori, la somme est correcte.

**Cas limite :** si les lignes existent sur les deux dépenses et que leur somme
diffère de `A.montantTotal + B.montantTotal`, la valeur `montantTotalFinal`
fournie par l'appelant prend la priorité. L'absence de `montantTotalFinal` dans
le DTO signifie qu'on utilise la somme des deux `montantTotal`.

### 6. Recalcul de montantPaye

Recalculé par agrégation réelle après transfert des paiements :

```
montantPaye = SUM(paiement.montant WHERE depenseId = survivantId)
```

Cette agrégation est déjà implémentée dans `ajouterPaiementDepense`. On réutilise
le même pattern dans la transaction de fusion.

### 7. Recalcul de statut

Algorithme identique aux autres mutations :

```
if montantPaye >= montantTotal → PAYEE
else if montantPaye > 0        → PAYEE_PARTIELLEMENT
else                           → NON_PAYEE
```

### 8. Champs textuels en conflit (factureUrl, notes, description)

| Champ | Règle |
|-------|-------|
| `description` | Garde celle de la survivante ; si l'appelant fournit `description` dans le DTO, elle remplace |
| `notes` | Concatène les deux, séparées par `\n---\n`, en déduisant les doublons exacts |
| `factureUrl` | Garde celle de la survivante ; si null sur la survivante mais non-null sur l'absorbée, utilise celle de l'absorbée |
| `dateEcheance` | Garde la plus tardive des deux (la plus conservative) |
| `vagueId` | Doit être identique sur les deux dépenses **ou** null sur l'une d'elles. Si les deux ont des `vagueId` différents et non-null, c'est une erreur de validation bloquante |
| `commandeId` | Doit être identique ou null sur l'une des deux — même règle que `vagueId` |
| `listeBesoinsId` | Même règle |
| `categorieDepense` | Recalculée depuis les lignes après fusion (voir section 2) ; si aucune ligne n'existe, garde celle de la survivante |

### 9. Règles de validation (pré-condition)

Ces vérifications doivent toutes passer avant d'ouvrir la transaction :

| Règle | Message d'erreur |
|-------|-----------------|
| Les deux dépenses appartiennent au même `siteId` | "Les deux dépenses doivent appartenir au même site" |
| Les deux IDs sont différents | "Impossible de fusionner une dépense avec elle-même" |
| Ni l'une ni l'autre n'est déjà `PAYEE` (optionnel, configurable) | "Impossible de fusionner une dépense entièrement payée" |
| `commandeId` compatible (identiques ou au moins un null) | "Conflit de commande entre les deux dépenses" |
| `listeBesoinsId` compatible (identiques ou au moins un null) | "Conflit de liste de besoins entre les deux dépenses" |
| `vagueId` compatible (identiques ou au moins un null) | "Conflit de vague entre les deux dépenses" |
| Si `montantTotalFinal` fourni : doit être >= montantPaye total des deux dépenses | "Le montant final ne peut pas être inférieur au total déjà payé" |

Note : fusionner deux dépenses `PAYEE` est **autorisé** par défaut si
`allowMergePayees: true` est passé dans le DTO. Cela couvre le cas où un utilisateur
veut regrouper deux charges déjà réglées dans un seul enregistrement historique.
La règle de blocage s'applique uniquement si l'une est `PAYEE` et que les montants
payés combinés dépasseraient le `montantTotalFinal`.

### 10. Permission

Réutilise `DEPENSES_MODIFIER`. Aucune nouvelle permission n'est créée.

Rationale : la fusion est une opération de correction de données, pas une
opération financière autonome. Elle est de même nature qu'un ajustement de
montant. Les rôles qui peuvent modifier une dépense (ADMIN, GERANT) sont
naturellement ceux qui doivent pouvoir corriger des doublons.

### 11. Audit trail

La fusion est tracée via **deux** `AjustementDepense` de type `MONTANT_TOTAL` :

1. Sur la **survivante** :
   - `montantAvant` = montantTotal d'origine de la survivante
   - `montantApres` = montantTotal final après fusion
   - `raison` = `"Fusion avec dépense {absorbee.numero} — {raison fournie par l'utilisateur}"`

2. Sur l'**absorbée** (créé AVANT sa suppression, dans la même transaction) :
   - `montantAvant` = montantTotal de l'absorbée
   - `montantApres` = 0
   - `raison` = `"Absorbée par dépense {survivante.numero} — {raison}"`

La dépense absorbée est ensuite **supprimée** (hard delete, après transfert de
toutes ses FK et création de son ajustement d'audit). Ses `AjustementDepense`
ont déjà été transférés à la survivante à l'étape 4.

Pas de nouveau modèle Prisma requis. L'audit trail existant est suffisant.

### 12. Design de l'API

```
POST /api/depenses/merge
```

Corps de la requête : `MergeDepensesDTO`
Réponse : `MergeDepensesResponse` (la dépense survivante avec ses relations complètes)

**Pourquoi POST et non PATCH ?**
- L'opération n'est pas idempotente (une deuxième exécution échouerait car
  l'absorbée n'existe plus).
- Elle crée de nouveaux enregistrements (ajustements d'audit).
- La sémantique "fusionner deux ressources" n'a pas d'analogue REST naturel
  en PATCH sur une ressource unique.
- Un endpoint dédié est plus facile à auditer et à tester.

### 13. UI — Déclenchement

**Point d'entrée : liste des dépenses (mobile + desktop)**

Flux en 3 étapes dans un Dialog Radix :

1. **Sélection** : l'utilisateur coche une première dépense dans la liste, puis
   clique sur "Fusionner avec...". Un second sélecteur (combobox filtré sur même
   `commandeId` ou `listeBesoinsId`) s'ouvre pour choisir la dépense à absorber.

2. **Prévisualisation** : le Dialog affiche un tableau de comparaison :
   - Survivante (la plus ancienne ou celle choisie)
   - Absorbée
   - Résultat prévu (montantTotal fusionné, lignes combinées, statut calculé)
   - Champ texte obligatoire pour la `raison`

3. **Confirmation** : bouton "Confirmer la fusion" déclenche `POST /api/depenses/merge`.
   Toast de succès ou d'erreur. Redirection vers le détail de la survivante.

**Alternative depuis le détail d'une dépense :** bouton "Fusionner" dans le menu
actions (kebab menu), pré-remplit la survivante avec la dépense courante.

**Mobile first :** Dialog plein écran sur 360px, étapes en BottomSheet si Dialog
prend trop de hauteur.

---

## Interfaces TypeScript

Voir `src/types/api.ts` — section "ADR-028 — Fusion de dépenses".

---

## Algorithme de fusion — pseudo-code

```
function mergeDepenses(survivantId, absorbeeId, dto, tx):

  # 1. Charger les deux dépenses (avec paiements + lignes)
  survivante = tx.depense.findFirst({ where: { id: survivantId, siteId } })
  absorbee   = tx.depense.findFirst({ where: { id: absorbeeId, siteId } })

  # 2. Validation
  assertSameSite(survivante, absorbee)
  assertCompatibleFKs(survivante, absorbee)   # commandeId, vagueId, listeBesoinsId
  assertNotSameId(survivantId, absorbeeId)

  # 3. Déterminer montantTotalFinal
  montantTotalFinal = dto.montantTotalFinal ?? (survivante.montantTotal + absorbee.montantTotal)

  # 4. Créer ajustement audit sur l'absorbée (avant transfert)
  tx.ajustementDepense.create({
    depenseId: absorbeeId,
    montantAvant: absorbee.montantTotal,
    montantApres: 0,
    raison: "Absorbée par " + survivante.numero + " — " + dto.raison,
    ...
  })

  # 5. Transférer LigneDepense
  tx.ligneDepense.updateMany({ where: { depenseId: absorbeeId }, data: { depenseId: survivantId } })

  # 6. Transférer PaiementDepense (FraisPaiementDepense suivent automatiquement)
  tx.paiementDepense.updateMany({ where: { depenseId: absorbeeId }, data: { depenseId: survivantId } })

  # 7. Transférer AjustementDepense
  tx.ajustementDepense.updateMany({ where: { depenseId: absorbeeId }, data: { depenseId: survivantId } })

  # 8. Résoudre les champs textuels
  description  = dto.description ?? survivante.description
  notes        = mergeNotes(survivante.notes, absorbee.notes)
  factureUrl   = survivante.factureUrl ?? absorbee.factureUrl
  dateEcheance = max(survivante.dateEcheance, absorbee.dateEcheance)
  commandeId   = survivante.commandeId ?? absorbee.commandeId
  listeId      = survivante.listeBesoinsId ?? absorbee.listeBesoinsId
  vagueId      = survivante.vagueId ?? absorbee.vagueId

  # 9. Recalculer montantPaye par agrégation réelle
  agg = tx.paiementDepense.aggregate({ where: { depenseId: survivantId }, _sum: { montant } })
  montantPaye = agg._sum.montant ?? 0

  fraisAgg = tx.fraisPaiementDepense.aggregate({
    where: { paiement: { depenseId: survivantId }, deletedAt: null }, _sum: { montant }
  })
  montantFraisSupp = fraisAgg._sum.montant ?? 0

  # 10. Recalculer categorieDepense depuis les lignes
  lignes = tx.ligneDepense.findMany({ where: { depenseId: survivantId } })
  categorieDepense = lignes.length > 0
    ? computeDominantCategorie(lignes)
    : (dto.categorieDepense ?? survivante.categorieDepense)

  # 11. Recalculer statut
  statut = computeStatut(montantPaye, montantTotalFinal)

  # 12. Créer ajustement audit sur la survivante
  tx.ajustementDepense.create({
    depenseId: survivantId,
    montantAvant: survivante.montantTotal,
    montantApres: montantTotalFinal,
    raison: "Fusion avec " + absorbee.numero + " — " + dto.raison,
    ...
  })

  # 13. Mettre à jour la survivante
  tx.depense.update({ where: { id: survivantId }, data: {
    montantTotal: montantTotalFinal,
    montantPaye,
    montantFraisSupp,
    statut,
    description,
    notes,
    factureUrl,
    dateEcheance,
    commandeId,
    listeBesoinsId: listeId,
    vagueId,
    categorieDepense,
  }})

  # 14. Supprimer l'absorbée (hard delete — ses FK sont déjà toutes transférées)
  tx.depense.delete({ where: { id: absorbeeId } })

  return tx.depense.findFirst({ where: { id: survivantId }, include: { ... } })
```

---

## Cas limites documentés

| Cas | Comportement |
|-----|-------------|
| L'absorbée a `montantPaye > 0` | Les paiements sont transférés, recalcul couvre les deux |
| Les deux ont `factureUrl` non-null | Celle de la survivante est conservée, celle de l'absorbée est perdue — documenté dans la prévisualisation UI |
| `notes` identiques sur les deux | Dédupliquées (pas de concaténation redondante) |
| `montantTotalFinal` < montantPaye cumulé | Erreur 400, fusion refusée |
| La survivante est `PAYEE` | Autorisé si `allowMergePayees: true`, sinon erreur 409 |
| Aucune ligne sur aucune des deux | `categorieDepense` = celle de la survivante |
| Les deux ont le même `commandeId` non-null | Compatible, la FK est conservée telle quelle |
| Une a `commandeId = X`, l'autre `commandeId = Y` (Y ≠ X, les deux non-null) | Erreur 422 — conflit de FK non résolvable automatiquement |

---

## Conséquences

- **Positif :** nettoyage propre des doublons sans perte de données ni d'historique
- **Positif :** aucun nouveau modèle Prisma requis
- **Positif :** réutilise les patterns existants (ajustement d'audit, agrégation)
- **Négatif :** la dépense absorbée est définitivement supprimée (hard delete) —
  atténué par l'audit trail créé avant la suppression
- **Neutre :** le numéro de la dépense absorbée est perdu mais tracé dans les `raison`
  des ajustements d'audit

---

## Fichiers à créer ou modifier

| Fichier | Action |
|---------|--------|
| `src/types/api.ts` | Ajouter `MergeDepensesDTO`, `MergeDepensesResponse` |
| `src/types/index.ts` | Exporter les nouveaux types |
| `src/lib/queries/depenses.ts` | Ajouter `mergeDepenses()` |
| `src/app/api/depenses/merge/route.ts` | Nouveau endpoint POST |
| `src/components/depenses/merge-depenses-dialog.tsx` | Nouveau composant Dialog |
| `docs/decisions/ADR-028-depense-merge.md` | Ce fichier |
