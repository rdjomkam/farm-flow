# CX3 — Audit AssignationBac vides (prod)

**Date :** 2026-06-15
**Base :** prod Prisma Postgres (72.61.187.32:5432)
**Nature :** lecture seule — aucun UPDATE/DELETE exécuté

---

## Nombre de cas

**2 AssignationBac actives (dateFin IS NULL) avec nombrePoissonsInitial = 0 et nombrePoissons = 0.**

Les deux appartiennent à la vague **Vague 26-02**.

---

## Liste détaillée par vague

### Vague 26-02 (statut : EN_COURS)

| Bac | dateAssignation | nombrePoissonsInitial | nombrePoissons | poidsMoyenInitial | Cas |
|-----|----------------|-----------------------|----------------|-------------------|-----|
| Bac 07 | 2026-06-15 10:28:07 | 0 | 0 | 26 | (a) Bac re-rattaché en attente d'opération métier |
| Bac 08 | 2026-06-15 10:28:16 | 0 | 0 | 26 | (b) ANOMALIE — relevés guard-sensibles sur l'assignation precedente |

---

## Analyse par cas

### Bac 07 — Cas (a) : OK, pas d'action

L'AssignationBac de Bac 07 sur Vague 26-02 a été créée aujourd'hui (2026-06-15 10:28) dans le cadre d'une réassignation post-sprint CX.

**Aucun relevé** n'est enregistré pour Bac 07 sur Vague 26-02 (ni relevé guard-sensible, ni biométrie, ni alimentation). Le bac est vide et en attente d'une opération métier (ARRIVAGE ou TRANSFERT entrant) qui peuplera `nombrePoissonsInitial` et `nombrePoissons`.

Le guard CS.3 ne serait pas déclenché puisqu'il n'y a pas de relevés contradictoires. Toute future opération métier sur ce bac passera normalement.

**Verdict :** Bac vide attendant son premier peuplement. Pas d'anomalie.

---

### Bac 08 — Cas (b) : ANOMALIE IDENTIFIEE

#### Historique des assignations (Bac 08 sur Vague 26-02)

| Assignation | debut | fin | init | actuel |
|-------------|-------|-----|------|--------|
| Ancienne (close) | 2026-05-10 | 2026-05-25 | 0 | 0 |
| Nouvelle (active) | 2026-06-15 10:28 | — | 0 | 0 |

L'ancienne assignation (close le 2026-05-25) portait **50 relevés** dont :

| Type | Nb |
|------|----|
| MORTALITE | 15 |
| COMPTAGE | 2 |
| BIOMETRIE | 2 |
| ALIMENTATION | 16 |
| RENOUVELLEMENT | 15 |

Le dernier COMPTAGE (2026-05-23 15:01, note : "Comptage post-calibrage (bac source vide)") indique `nombreCompte = 0`, confirmant que ce bac a été vidé intentionnellement lors d'un calibrage (les poissons ont été transférés vers d'autres bacs — Bac 06, Bac 09, Bac 10 selon l'AssignationBac du 2026-05-23).

L'anomalie est que `nombrePoissonsInitial = 0` sur l'ancienne assignation (celle qui a porté toute l'activité de 2026-05-10 à 2026-05-25). C'est le bug source identifié dans CX.1 : lors de l'assignation initiale de Bac 08 au calibrage, `nombrePoissonsInitial` n'a pas été renseigné.

**La nouvelle assignation active (2026-06-15)** est une réassignation propre post-CX, également vide en attente de peuplement — même situation que Bac 07.

#### Impact sur le guard CS.3

Le guard CS.3 s'applique à l'AssignationBac **active** (dateFin IS NULL). La nouvelle assignation active de Bac 08 n'a aucun relevé associé. Le guard ne serait pas déclenché.

Cependant, si une future opération tentait de retrouver des données historiques via l'ancienne assignation close, elle trouverait `init=0` et `actuel=0` malgré 50 relevés — c'est une incohérence de données héritée, non bloquante pour les opérations futures.

---

## Cohérence avec le guard CS.3

Pour les **deux AssignationBac actives** identifiées :

| Bac | Relevés guard-sensibles sur l'assignation active | Risque guard |
|-----|--------------------------------------------------|--------------|
| Bac 07 | 0 | Aucun — opérations futures autorisées |
| Bac 08 | 0 | Aucun — opérations futures autorisées |

**Aucune des deux AssignationBac actives ne casserait le guard CS.3 si une opération métier y était tentée.** Les données guard-sensibles (MORTALITE, COMPTAGE) existent uniquement sur l'ancienne assignation close de Bac 08, qui n'est plus concernée par le guard.

---

## Recommandations

### Bac 07 (Vague 26-02)
Laisser tel quel. Attendre qu'une opération métier (ARRIVAGE ou TRANSFERT) vienne peupler l'assignation. Aucune action de base de données requise.

### Bac 08 (Vague 26-02) — ancienne assignation close (id: cmp071zk1000601o6ajujs8ab)
L'incohérence `init=0, actuel=0` sur une assignation close portant 50 relevés est un artefact du bug pré-CX.1. Elle est non bloquante : l'assignation est close, le guard ne l'évalue pas.

Option 1 (recommandée) : laisser tel quel. L'historique reste consultable, les opérations futures utilisent l'assignation active propre.

Option 2 (si reporting financier/biométrique nécessite init correct) : régulariser via un script SQL en staging d'abord, puis prod, en remontant `nombrePoissonsInitial` à la valeur du premier COMPTAGE disponible ou à la somme des poissons transférés vers ce bac. Ce n'est pas urgent.

### Nouvelle assignation Bac 08 (active, 2026-06-15)
Identique à Bac 07 — attendre l'opération métier de peuplement.

---

## Résumé exécutif

- **2 cas trouvés**, tous sur Vague 26-02
- **0 cas bloquant pour le guard CS.3** : aucune assignation active n'a de relevés contradictoires
- **1 incohérence historique** : ancienne assignation close de Bac 08 avec init=0 malgré 50 relevés (bug pré-CX.1, non bloquant)
- **Action immédiate requise** : aucune
- **Action future possible** : régulariser `nombrePoissonsInitial` de l'ancienne assignation close Bac 08 si nécessaire pour le reporting

---

## Fichier SQL

`/prisma/data-fixes/CX3-audit-empty-assignations.sql` — SELECT uniquement, aucun effet de bord.
