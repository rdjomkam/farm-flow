# Review Sprint SC2 — Poids du sac configurable dans le profil de production

**Verdict initial : CHANGES_REQUESTED** → **APPROVED après fix C1**

## Finding Critique (corrigé)

**C1 — `poidsSacKg` strippé par la validation Zod : feature non fonctionnelle via l'API.**

`src/lib/validation/config-elevage.ts` (`baseConfigElevageObject`) n'avait pas le champ. `createConfigElevageSchema` / `updateConfigElevageSchema` strippent les clés inconnues → le champ envoyé par le form était silencieusement supprimé au `safeParse` dans les routes API → jamais persisté.

**Leçon (R3 étendu)** : Prisma = TypeScript = **Zod**. La couche de validation runtime doit être mise à jour en même temps que le schema et les types — le DTO TS donnait une fausse confiance (compile OK, runtime strippé). Les tests query directs (mocks) ne couvrent pas ce maillon ; il faut des tests de parse sur les schémas Zod.

**Fix appliqué** :
- `poidsSacKg: z.number().positive().max(100).nullable().optional()` dans `baseConfigElevageObject`
- `max={100}` aligné sur les inputs des 2 forms + garde `Number.isNaN`
- 8 tests de régression (`src/__tests__/lib/config-elevage-validation.test.ts`) : conservation create/update, null accepté, absent accepté, rejet ≤0 et >100

## Checks passés

- R3/R7 : Prisma `poidsSacKg Float?` ↔ TS `poidsSacKg?: number | null` ↔ DTO ↔ Zod (post-fix)
- Migration `20260716234838_add_poids_sac_kg_config_elevage` : colonne nullable unique, non-breaking, prod-safe
- Priorité `finances.ts:1391-1410` conforme : profil > 0 → appliqué à tous les aliments sans condition uniteAchat ; sinon fallback SC ; sinon null. `contenanceSac` reflète la source réellement utilisée
- Optional chaining sur `vague.configElevage` (vagues sans profil OK)
- Edit form : pré-remplissage + clear vers null OK
- 4 tests priorité + tests SC existants verts (30/30 sur finances-cout-production)
- i18n FR/EN cohérents

## Nits restants (non bloquants)

- Aucun après fix.
