# ADR-049 — AssignationBac comme source unique des comptages par génération

**Date :** 2026-05-16
**Statut :** PROPOSE
**Auteur :** @user + @claude
**Étend / complète :** ADR-043 (modèle associatif Bac↔Vague), ADR-024 (statu quo abandonné)
**Référence bugs :** BUG-045 (compte stale après mortalité), BUG-048 (conservation calibrage incohérente)

---

## Contexte

ADR-043 a introduit la table `AssignationBac` pour matérialiser la relation Bac↔Vague et conserver son historique. Les champs de comptage (`nombrePoissons`, `nombreInitial`, `poidsMoyenInitial`) ont été ajoutés à `AssignationBac` mais **les colonnes équivalentes sur `Bac` ont été conservées** par pragmatisme, avec un pattern *dual-write* destiné à les synchroniser.

L'audit conduit suite au BUG-048 (cf. `docs/bugs/BUG-048.md`) a révélé que le dual-write est **incomplet** :

| Opération | `Bac.nombrePoissons` | `AssignationBac.nombrePoissons` |
|---|---|---|
| Création vague | ✅ | ✅ |
| Calibrage (source) | ✅ → 0 | ✅ → 0 |
| Calibrage (destination) | ✅ | ✅ |
| Vente | ✅ décrément | ✅ décrément |
| **Mortalité (MORTALITE)** | ❌ jamais touché | ❌ jamais touché |
| **Comptage (COMPTAGE)** | ❌ jamais touché | ❌ jamais touché |
| Assignation manuelle | ⚠️ partiel | ✅ |
| Transfert lot alevins | ❌ vagueId only | ✅ |

**Conséquences observées** :
- Les compteurs stockés deviennent stale dès qu'une mortalité ou un comptage est enregistré.
- Les vérifications de conservation (calibrage, vente, dashboard) divergent entre client et serveur.
- `computeVivantsByBac` (calcul à la volée à partir des relevés) est devenu la *seule* source fiable, mais il est utilisé de façon inconsistante (BUG-048).

De plus, la sémantique de `nombreInitial` est ambigüe :
- Sur `Bac`, il représente le compte à la **première** assignation, gravé une fois pour toutes (`calibrages.ts:160-167`).
- Sur `AssignationBac`, il représente le compte à l'entrée du bac dans **cette** assignation (cohérent par génération).

Le pisciculteur, lui, raisonne par **génération** : « ce bac contient 200 poissons depuis le dernier calibrage, il en a perdu 5, il en reste 195 ». La sémantique métier est *par assignation*, pas *par bac*.

---

## Décision

### D1 — `AssignationBac` devient la source unique des comptages

Tous les champs de comptage liés à une **génération de poissons dans un bac** vivent exclusivement sur `AssignationBac` :

| Champ | Sens | Mutable ? |
|---|---|---|
| `AssignationBac.nombreInitial` | Poissons reçus à l'ouverture de cette assignation (création de vague ou dernier calibrage) | **Immuable** après création |
| `AssignationBac.nombreActuel` | Poissons réellement présents maintenant | Décrémenté par mortalité/vente, override par comptage, reset à `nombreInitial` à la création |
| `AssignationBac.poidsMoyenInitial` | Poids moyen à l'ouverture | Immuable |
| `AssignationBac.dateAssignation` | Début de la génération | Immuable |
| `AssignationBac.dateFin` | Fin de la génération (null = active) | Mutable, défini à la clôture/calibrage |

**Bac** ne porte plus aucun champ de comptage. Il ne contient que des métadonnées **physiques** :

```prisma
model Bac {
  id          String   @id
  nom         String
  volume      Float?
  typeSysteme TypeSystemeBac?
  isBlocked   Boolean  @default(false)
  siteId      String
  site        Site     @relation(fields: [siteId], references: [id])
  // Pas de vagueId, pas de nombrePoissons, pas de nombreInitial, pas de poidsMoyenInitial
  assignations AssignationBac[]
  releves      Releve[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### D2 — Règles de mise à jour de `nombreActuel`

L'invariant `nombreActuel` est maintenu par les opérations suivantes, **chacune dans une transaction Prisma**. La cohérence est garantie par dual-write (toujours) et par des contraintes d'idempotence sur les relevés.

| Évènement | Effet sur `AssignationBac.nombreActuel` |
|---|---|
| **Création vague** | Insert d'une nouvelle `AssignationBac` avec `nombreInitial = N`, `nombreActuel = N` |
| **Mortalité (`POST /api/releves` type MORTALITE)** | `UPDATE … SET nombreActuel = nombreActuel - nombreMorts WHERE bacId = X AND dateFin IS NULL` |
| **Édition d'une mortalité** | Diff appliqué : `nombreActuel += ancienNombreMorts - nouveauNombreMorts` |
| **Suppression d'une mortalité** | `nombreActuel += nombreMorts` (re-incrément) |
| **Vente (`POST /api/ventes`)** | Décrément proportionnel sur chaque bac source (logique existante préservée) |
| **Calibrage (`POST /api/calibrages`)** | <ul><li>Sources : `dateFin = NOW`, l'assignation est archivée (nombreActuel reste figé)</li><li>Destinations : nouvelles AssignationBac créées avec `nombreInitial = nombreActuel = N_attribué`</li></ul> |
| **Comptage (`POST /api/releves` type COMPTAGE)** | Option B retenue ci-dessous |

### D3 — Sémantique du COMPTAGE (Option B)

Un relevé de comptage est un **ajustement manuel autoritaire**. Quand un pisciculteur compte 195 poissons alors que le théorique est de 200 :

1. `AssignationBac.nombreActuel` est **forcé à 195** (override).
2. La différence (`200 - 195 = 5`) est tracée comme **mortalité non observée** dans une métadonnée du relevé COMPTAGE (`ecartConstate: 5`), sans créer de relevé MORTALITE séparé.
3. Le taux de survie tient compte de l'écart sans double-comptage.

Avantages :
- Le compteur reste cohérent même quand le terrain révèle des écarts.
- L'écart est tracé proprement (audit + analytics ultérieurs).
- Pas de double-comptage avec les MORTALITE explicites.

Option A (audit sans impact) et Option C (reset complet de `nombreInitial`) sont rejetées :
- A perd la précision (la valeur compteur reste fausse).
- C casse la sémantique de génération (nombreInitial doit refléter l'entrée dans le bac, pas un re-baselining arbitraire).

### D4 — `computeVivantsByBac` devient outil de migration/audit uniquement

La fonction reste dans la codebase pour :
- **Migration initiale** : recalculer `AssignationBac.nombreActuel` à partir de l'historique des relevés.
- **Audit / health-check** : un cron de vérification compare la valeur stockée avec le re-calcul, alerte sur les écarts.

Elle n'est plus appelée par les requêtes de lecture. Toute logique métier (conservation calibrage, sélection bacs source, dashboard, indicateurs) lit `AssignationBac.nombreActuel` directement.

### D5 — Suppression progressive de `Bac.vagueId` et compteurs

| Étape | Schéma | Code |
|---|---|---|
| Phase 1 | Champs Bac.* conservés, marqués `@deprecated` dans la doc | Triple-write + lectures depuis AssignationBac |
| Phase 2 | Migration des données : `UPDATE AssignationBac SET nombreActuel = computeVivantsByBac()` pour tous les bacs actifs | Tests E2E |
| Phase 3 | Drop des colonnes `Bac.nombrePoissons`, `Bac.nombreInitial`, `Bac.poidsMoyenInitial`, `Bac.vagueId` | Adapter requêtes restantes |
| Phase 4 | Suppression de `computeVivantsByBac` du runtime (gardé en util de migration/audit) | Cleanup |

---

## Conséquences

### Positives

- ✅ **Source unique de vérité** — élimine structurellement BUG-045 et BUG-048.
- ✅ **Historique préservé** — chaque génération (assignation) garde son nombreInitial/nombreActuel finaux.
- ✅ **Sémantique métier alignée** — taux de survie d'un calibrage à l'autre = `nombreActuel / nombreInitial` de l'assignation courante.
- ✅ **Performance** — plus d'agrégation à la lecture, lecture indexée directe.
- ✅ **Réutilisation de bac claire** — bac libéré puis réassigné = 2 lignes AssignationBac distinctes, pas d'écrasement.
- ✅ **Cohérence garantie par transactions** — toutes les mutations dans des transactions Prisma atomiques.

### Négatives / coûts

- ⚠️ **Refactor de ~30 fichiers** — toutes les queries qui lisent `bac.nombrePoissons`, `bac.nombreInitial`, `bac.vagueId` doivent passer par l'assignation active.
- ⚠️ **Migration de données** — recalcul des `nombreActuel` à partir des relevés historiques (nécessite backup + rollback plan).
- ⚠️ **Mortalité = écriture lourde** — `createReleve` (MORTALITE) doit maintenant ouvrir une transaction et décrémenter. Latence légèrement supérieure (estimé +20ms).
- ⚠️ **Édition de mortalité non-triviale** — gestion d'idempotence requise : snapshot de la valeur appliquée sur le relevé pour pouvoir l'inverser en cas d'édition/suppression.
- ⚠️ **Cas bac libre** — `getActiveAssignation(bacId)` retourne `null` → l'UI doit gérer gracieusement (la plupart des affichages le font déjà).

### Risques mitigés

- **Drift initial post-migration** : un job de vérification compare stocké vs recalculé, alerte si écart > 0.
- **Rollback** : les colonnes `Bac.*` restent en phase 1-2, permettant de revenir en arrière sans perte.
- **Performance** : tous les accès passent par l'index `@@index([bacId, dateFin])` déjà défini sur AssignationBac.

---

## Contrat d'API (résumé)

### Helpers à créer

```ts
// src/lib/queries/assignation-bac.ts (nouveau)

/** Retourne l'assignation active d'un bac (ou null si libre) */
export function getActiveAssignation(bacId: string, siteId: string): Promise<AssignationBac | null>

/** Retourne le nombreActuel d'un bac (lecture directe, pas de calcul) */
export function getNombreActuelBac(bacId: string, siteId: string): Promise<number | null>

/** Retourne le nombreActuel total d'une vague (somme des assignations actives) */
export function getNombreActuelVague(vagueId: string, siteId: string): Promise<number>

/** Décrémente atomiquement nombreActuel d'un bac (utilisé par createReleve MORTALITE) */
export function decrementerAssignationActive(
  tx: PrismaTx, bacId: string, vagueId: string, delta: number, releveId: string
): Promise<void>

/** Force nombreActuel à une valeur (utilisé par COMPTAGE — Option B) */
export function setNombreActuelAssignation(
  tx: PrismaTx, bacId: string, vagueId: string, nouvelleValeur: number, releveId: string
): Promise<{ ecart: number }>

/** Audit : compare la valeur stockée au recalcul via computeVivantsByBac */
export function auditAssignationCounts(vagueId: string, siteId: string): Promise<AuditReport>
```

### Modifications de queries existantes

- `createReleve` (MORTALITE) → décrémente `nombreActuel` (transactionnel).
- `createReleve` (COMPTAGE) → force `nombreActuel` (Option B) + trace `ecartConstate`.
- `updateReleve` / `deleteReleve` (MORTALITE/COMPTAGE) → revert + apply.
- `createCalibrage` → archive assignations sources (`dateFin = NOW`), crée nouvelles assignations destinations.
- `createVente` → décrément déjà existant, mais sur `AssignationBac.nombreActuel` directement.
- `getVagueById` → lit `nombreActuel` depuis l'assignation active.
- `getBacs` / `getBacById` → lit depuis l'assignation active (déjà partiellement le cas).

---

## Plan d'implémentation

### Sprint A (1-2 j) — Préparation
- [ ] Ajouter `nombreActuel` sur AssignationBac (rename de `nombrePoissons` actuel pour clarifier la sémantique)
- [ ] Ajouter `ecartConstate Int? @default(0)` sur Releve (Option B des comptages)
- [ ] Ajouter `appliedDelta Int? @default(0)` sur Releve (snapshot pour idempotence édition/suppression)
- [ ] Migration Prisma (additive, non-destructive)
- [ ] Helpers `getActiveAssignation`, `getNombreActuelBac`, `decrementerAssignationActive`, `setNombreActuelAssignation`

### Sprint B (2-3 j) — Refactor des writes
- [ ] `createReleve` MORTALITE → décrément `nombreActuel` + écrit `appliedDelta`
- [ ] `createReleve` COMPTAGE → force `nombreActuel` + écrit `ecartConstate`
- [ ] `updateReleve` MORTALITE/COMPTAGE → revert via `appliedDelta` + apply nouveau
- [ ] `deleteReleve` MORTALITE/COMPTAGE → revert via `appliedDelta`
- [ ] `createCalibrage` → archive sources, crée nouvelles destinations
- [ ] `createVente` → écrit directement sur AssignationBac (Bac.nombrePoissons devient legacy)
- [ ] Tests unitaires + intégration

### Sprint C (1-2 j) — Refactor des reads
- [ ] `getVagueById` lit AssignationBac.nombreActuel
- [ ] Pages calibrage, ventes, dashboard, indicateurs → lecture depuis AssignationBac
- [ ] Retirer `computeVivantsByBac` des chemins de lecture (gardé pour migration/audit)
- [ ] Tests E2E

### Sprint D (1 j) — Migration de données
- [ ] Script de migration : pour chaque AssignationBac active, recalculer `nombreActuel = computeVivantsByBac()`
- [ ] Job de vérification : compare stocké vs recalculé, log les écarts
- [ ] Backup avant migration

### Sprint E (0.5 j) — Cleanup
- [ ] Marquer `Bac.nombrePoissons`, `nombreInitial`, `poidsMoyenInitial`, `vagueId` comme `@deprecated` dans le schéma (commentaires)
- [ ] Garder 1 sprint pour valider la stabilité
- [ ] Drop des colonnes (migration séparée, après confirmation prod)

**Effort total estimé** : 5-8 jours-développeur.

---

## Questions ouvertes

1. **Édition d'une mortalité passée** : si une mortalité enregistrée le 2026-04-01 est éditée le 2026-05-16, faut-il appliquer le diff sur le `nombreActuel` actuel, ou recalculer toute la chaîne d'évènements depuis le 2026-04-01 ? → **Réponse provisoire** : appliquer le diff sur le `nombreActuel` actuel (idempotence par `appliedDelta`), c'est suffisant pour le métier et évite la complexité d'un re-calcul global.

2. **Vague clôturée avec assignations** : à la clôture d'une vague, faut-il forcer `dateFin = clôtureDate` sur toutes les AssignationBac actives ? → **Oui**, pour préserver l'invariant "active = dateFin null".

3. **Bacs sans nombreInitial historique** : pour les anciennes données pré-ADR-043 où certaines AssignationBac n'ont pas de `nombreInitial`, faut-il les considérer ? → Lors de la migration, on calcule rétroactivement depuis `Bac.nombreInitial` ou la valeur initiale de la vague (`vague.nombreInitial / nb_bacs`).

---

## Statut : **PROPOSE — en attente de validation par l'utilisateur avant Sprint A**

Une fois validé, créer les tickets dans `docs/TASKS.md` :
- `[ADR-049-A] AssignationBac.nombreActuel + helpers + migration additive`
- `[ADR-049-B] Refactor writes (mortalité, vente, calibrage, comptage)`
- `[ADR-049-C] Refactor reads + suppression de computeVivantsByBac du runtime`
- `[ADR-049-D] Migration données + job audit`
- `[ADR-049-E] Cleanup colonnes Bac (drop)`
