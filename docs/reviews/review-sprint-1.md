# Review Sprint 1 — Fondations (DB + Types + Structure)

**Date :** 2026-03-08
**Reviewer :** @code-reviewer
**Stories couvertes :** 1.1, 1.2, 1.3, 1.4

---

## Verdict final : VALIDE — Sprint 1 approuve, Sprint 2 peut demarrer

---

## Re-review apres corrections

**Verdict : VALIDE — Toutes les corrections appliquees et verifiees.**

### Corrections verifiees et validees

| # | Probleme original | Statut | Details |
|---|-------------------|--------|---------|
| C1 | Enums casse differente | CORRIGE | 5 enums en MAJUSCULES dans Prisma et TS. Migration `enums_uppercase` correcte (rename type pattern). |
| C2 | TypeAliment valeurs differentes | CORRIGE | Prisma et TS alignes : `ARTISANAL`, `COMMERCIAL`, `MIXTE` |
| C3 | CauseMortalite valeurs differentes | CORRIGE | Union complete : 7 valeurs identiques (MALADIE, QUALITE_EAU, STRESS, PREDATION, CANNIBALISME, INCONNUE, AUTRE) |
| C4 | MethodeComptage valeurs differentes | CORRIGE | Prisma et TS alignes : `DIRECT`, `ESTIMATION`, `ECHANTILLONNAGE` |
| C5 | Vague noms de champs + dateFin | CORRIGE | `dateDebut`, `poidsMoyenInitial`, `dateFin DateTime?` dans Prisma. Migration `rename_fields` correcte. |
| C6 | Releve 4 noms de champs | CORRIGE | `echantillonCount`, `quantiteAliment`, `frequenceAliment`, `description` dans Prisma. Migration correcte. |
| I1 | Bac.volume nullabilite | CORRIGE | `Float` (non-nullable) dans Prisma, `number` en TS. Migration met a 0 les NULLs avant ALTER NOT NULL. |
| I2 | Bac.nombrePoissons absent TS | CORRIGE | `nombrePoissons: number | null` ajoute a l'interface `Bac` et `nombrePoissons?: number` dans `CreateBacDTO`. |
| M1 | ADR 001 seed.ts | CORRIGE | Reference `seed.sql` avec commentaire "(SQL direct)". |
| M2 | ADR 003 valeurs enum | CORRIGE | Resolu par C1 — valeurs MAJUSCULES coherentes partout. |
| S2 | VagueDashboardSummary.statut | CORRIGE | `statut: StatutVague` avec import dans `calculs.ts:8`. |

### Qualite des migrations

Les 2 migrations sont bien ecrites :

- **`20260308200300_enums_uppercase`** : approche correcte pour PostgreSQL — ajoute les nouvelles valeurs, migre les donnees, puis recree les enums sans les anciennes valeurs via le pattern rename/recreate/drop. Gere le DEFAULT sur `StatutVague`.
- **`20260308200600_rename_fields`** : renommages propres avec `ALTER TABLE RENAME COLUMN`, ajout de `dateFin`, et conversion de `volume` en NOT NULL avec mise a jour des NULLs existants.

---

## Derniere correction verifiee

### SEED-1 — prisma/seed.sql noms de colonnes : CORRIGE
Les 6 noms de colonnes ont ete mis a jour dans le seed SQL :
- `"dateDebut"` (etait `"dateDebutCharge"`), `"poidsMoyenInitial"` (etait `"poidsMoyenInit"`), `"dateFin"` ajoute
- `"echantillonCount"` (etait `echantillon`), `"quantiteAliment"` (etait `"quantiteKg"`), `"frequenceAliment"` (etait `frequence`), `description` (etait `observation`)
- Bonus : `dateFin` inclus dans l'INSERT Vague avec `NULL` pour en_cours et `'2025-12-22'` pour terminee

---

## Verification de coherence finale

### Schema Prisma vs Types TypeScript

**Enums** — 5/5 alignes :

| Enum | Prisma | TypeScript | Match |
|------|--------|-----------|-------|
| StatutVague | EN_COURS, TERMINEE, ANNULEE | EN_COURS, TERMINEE, ANNULEE | OK |
| TypeReleve | BIOMETRIE, MORTALITE, ALIMENTATION, QUALITE_EAU, COMPTAGE, OBSERVATION | idem | OK |
| TypeAliment | ARTISANAL, COMMERCIAL, MIXTE | ARTISANAL, COMMERCIAL, MIXTE | OK |
| CauseMortalite | MALADIE, QUALITE_EAU, STRESS, PREDATION, CANNIBALISME, INCONNUE, AUTRE | idem | OK |
| MethodeComptage | DIRECT, ESTIMATION, ECHANTILLONNAGE | DIRECT, ESTIMATION, ECHANTILLONNAGE | OK |

**Modele Bac** — tous champs alignes :

| Champ Prisma | Type Prisma | Champ TS | Type TS | Match |
|-------------|------------|---------|--------|-------|
| id | String @id | id | string | OK |
| nom | String | nom | string | OK |
| volume | Float | volume | number | OK |
| nombrePoissons | Int? | nombrePoissons | number \| null | OK |
| vagueId | String? | vagueId | string \| null | OK |
| createdAt | DateTime | createdAt | Date | OK |
| updatedAt | DateTime | updatedAt | Date | OK |

**Modele Vague** — tous champs alignes :

| Champ Prisma | Type Prisma | Champ TS | Type TS | Match |
|-------------|------------|---------|--------|-------|
| id | String @id | id | string | OK |
| code | String @unique | code | string | OK |
| dateDebut | DateTime | dateDebut | Date | OK |
| dateFin | DateTime? | dateFin | Date \| null | OK |
| nombreInitial | Int | nombreInitial | number | OK |
| poidsMoyenInitial | Float | poidsMoyenInitial | number | OK |
| origineAlevins | String? | origineAlevins | string \| null | OK |
| statut | StatutVague | statut | StatutVague | OK |

**Modele Releve** — tous champs alignes :

| Champ Prisma | Type Prisma | Champ TS | Type TS | Match |
|-------------|------------|---------|--------|-------|
| id | String @id | id | string | OK |
| date | DateTime | date | Date | OK |
| typeReleve | TypeReleve | typeReleve | TypeReleve | OK |
| vagueId | String | vagueId | string | OK |
| bacId | String | bacId | string | OK |
| notes | String? | notes | string \| null | OK |
| poidsMoyen | Float? | poidsMoyen | number \| null | OK |
| tailleMoyenne | Float? | tailleMoyenne | number \| null | OK |
| echantillonCount | Int? | echantillonCount | number \| null | OK |
| nombreMorts | Int? | nombreMorts | number \| null | OK |
| causeMortalite | CauseMortalite? | causeMortalite | CauseMortalite \| null | OK |
| typeAliment | TypeAliment? | typeAliment | TypeAliment \| null | OK |
| quantiteAliment | Float? | quantiteAliment | number \| null | OK |
| frequenceAliment | Int? | frequenceAliment | number \| null | OK |
| temperature | Float? | temperature | number \| null | OK |
| ph | Float? | ph | number \| null | OK |
| oxygene | Float? | oxygene | number \| null | OK |
| ammoniac | Float? | ammoniac | number \| null | OK |
| nombreCompte | Int? | nombreCompte | number \| null | OK |
| methodeComptage | MethodeComptage? | methodeComptage | MethodeComptage \| null | OK |
| description | String? | description | string \| null | OK |

### Types TS vs DTOs API — coherent

- `CreateBacDTO` : `nom`, `volume`, `nombrePoissons?` — alignes avec `Bac`
- `CreateVagueDTO` : `dateDebut`, `poidsMoyenInitial` — alignes avec `Vague`
- `UpdateVagueDTO` : `dateFin?`, `statut?` — alignes avec `Vague`
- `CreateReleveDTO` (union) : tous les champs specifiques alignes avec `Releve`

### Types TS vs ADR 003 — coherent

Les contrats documentes dans l'ADR 003 utilisent les memes noms de champs et valeurs enum que les DTOs dans `src/types/api.ts`.

### Structure de dossiers — conforme au CLAUDE.md

- `src/components/` : 5 sous-dossiers (ui, layout, dashboard, vagues, releves) OK
- `src/lib/queries/` : dossier cree avec `.gitkeep` OK
- `src/types/` : 5 fichiers (models, api, releves, calculs, index) OK
- `docs/decisions/` : 3 ADRs OK
- `src/lib/db.ts` : singleton Prisma correct OK

---

## Suggestions non bloquantes (conservees de la review initiale)

### S1 — Considerer les types generes Prisma
Les types dans `models.ts` sont ecrits manuellement. Importer/re-exporter les types de `@/generated/prisma` reduirait le risque de desynchronisation future. A considerer pour un sprint ulterieur.

### S3 — Type guards generiques
Les 6 type guards dans `releves.ts` sont repetitifs. Un type guard generique serait plus maintenable. Non bloquant.

---

## Conclusion

Le Sprint 1 est **valide**. Le schema Prisma, les types TypeScript, les DTOs API, le seed SQL, les decisions architecturales et la structure de dossiers sont **parfaitement alignes**.

Tous les problemes identifies lors de la review initiale (6 critiques, 2 importants, 2 mineurs) ont ete corriges et verifies. Les 3 migrations sont propres et correctes.

**Le Sprint 2 peut demarrer.**
