# Review Sprint BD — Rendre visibles les bacs en dérive

**Reviewer :** @code-reviewer
**Sprint :** BD
**Verdict global : VALIDÉ AVEC RÉSERVES**

Aucun problème Critique ou Haute sur le code livré. Le mécanisme SAVEPOINT + sonde canary de
BD.0 est le point le plus solide du sprint, vérifié adversarialement contre une vraie base
Postgres sur les deux origines possibles de poisoning de transaction. Les réserves portent sur
un point de process/CI et une limitation produit déjà documentée par ADR-051, pas sur une
régression à corriger avant merge.

**Périmètre revu :**
- BD.0 — `src/lib/queries/releves.ts` (~L.393-433)
- BD.1 — `docs/decisions/ADR-051-formulation-limite-detection-bacs-en-derive.md`,
  `src/lib/bacs-en-derive-constants.ts`
- BD.2 — `src/components/dashboard/bacs-en-derive-section.tsx`, `section-skeletons.tsx`,
  `src/app/(farm)/page.tsx`
- BD.3 — `src/components/dashboard/__tests__/bacs-en-derive-section.test.tsx` (18 tests)

---

## Checklist R1-R9

- **R1 (enums MAJUSCULES) :** OK — `ContexteDetectionEcart` (livré SU.2) réutilisé tel quel.
- **R2 (import enums) :** OK — `bacs-en-derive-constants.ts` importe `ContexteDetectionEcart`
  depuis `@/types`, `Record<ContexteDetectionEcart, string>` exhaustif ; `releves.ts` utilise
  `TypeReleveEnum.MORTALITE`/`TypeReleveEnum.COMPTAGE` et `ContexteDetectionEcart.INDETERMINE`.
- **R3 (Prisma=TS) :** OK avec note mineure — `src/lib/queries/ecarts-assignation.ts:39` fait
  `e.dernierContexte as ContexteDetectionEcart` (cast pré-existant SU.2, hors périmètre BD).
- **R4 (opérations atomiques) :** OK — le SAVEPOINT est lui-même un mécanisme d'atomicité de
  sous-transaction.
- **R5 (DialogTrigger asChild) :** N/A, aucun Dialog dans le périmètre.
- **R6 (CSS variables du thème) :** OK — `text-muted-foreground`, `text-primary`, `bg-muted`,
  `divide-border`, aucun hex en dur.
- **R7 (nullabilité) :** OK — décidée par ADR-048 §8.2, non retouchée par ce sprint.
- **R8 (siteId) :** OK avec une note — `getBacsEnDerive(siteId)` filtre bien siteId
  (`ecarts-assignation.ts:23`) ; le bloc ajouté dans `page.tsx` (L.169-201) passe uniquement par
  le query layer, aucun Prisma direct. Les appels `prisma.packActivation.count/findFirst`
  (`page.tsx` L.66, L.101) sont une dette PRÉEXISTANTE de la branche ingénieur, hors périmètre
  BD, non aggravée par ce sprint.
- **R9 (tests avant review) :** OK — `npx vitest run` 5753 passés / 0 échec avec `DATABASE_URL`
  exportée ; `npm run build` exit 0.
- **R10 (correctif de données = migration) :** OK — aucune migration ajoutée, aucun `.sql`
  orphelin à la racine de `prisma/migrations/`.

---

## Points d'investigation approfondie

### Point 1 — non-blocance de BD.0

Aucun chemin trouvé faisant échouer `createReleve`, hormis un risque résiduel accepté
(`ROLLBACK TO SAVEPOINT` pourrait lui-même échouer sur coupure physique de connexion — inhérent,
non catchable côté applicatif). Aucun chemin de perte silencieuse : le piège du COMMIT dégradé en
ROLLBACK a été explicitement testé via une connexion `pg` indépendante. La sonde canary comble un
vrai trou : `persisterEcartConstate` avale ses propres erreurs SQL sans les relancer, donc sans la
sonde le `catch` de `createReleve` ne se déclencherait jamais pour ce cas.
`$executeRawUnsafe`/`$queryRawUnsafe` n'utilisent que des littéraux fixes
(`"SAVEPOINT ecart_constate_sp"`, `"SELECT 1"`) — aucune valeur dynamique, aucun risque
d'injection. Portée respectée (MORTALITE + COMPTAGE, `bacId` et `vagueId` requis).

### Point 2 — symétrie entre types de relevé

Vérifiée indépendamment. Seuls MORTALITE (décrément historique) et le bloc BD.0 touchent l'état
de conservation dans `createReleve`. ARRIVAGE/VENTE/TRANSFERT ne passent jamais par `createReleve`
(déjà couverts par les call sites guardés). Aucun type oublié.

### Point 5 — honnêteté du libellé

Bien calibré. Titre « Écarts détectés sur des bacs » (verbe d'observation, pas d'état absolu),
phrase de nuance concrète, carte totalement absente à 0 résultat (`if (bacsEnDerive.length === 0)
return null`). Ni trop alarmiste (pas de bandeau permanent) ni trop discret. Réserve mineure déjà
actée par ADR-051 §7 : un bac réparé par COMPTAGE isolé sans opération guardée ultérieure reste
affiché indéfiniment.

### Point 8 — tests DB-gated

Confirmé et réel. Aucun fichier `.github/workflows/*.yml` dans le dépôt. Les 3 tests qui prouvent
la résilience SQL réelle de BD.0 skippent silencieusement sans `DATABASE_URL`. Sévérité Moyenne.

---

## Tableau des réserves

| # | Sévérité | Réserve | Fichier(s) | Traitement |
|---|----------|---------|------------|------------|
| 1 | Moyenne | Absence de garantie que `DATABASE_URL` est exportée en continu → les 3 preuves critiques de BD.0 ne sont jamais rejouées hors intervention manuelle | `src/lib/queries/__tests__/bd0-savepoint-integration.test.ts`, `bd0-savepoint-integration-persister-origin.test.ts`, `src/__tests__/bd0-comptage-recalcule-ecart.test.ts` | À traiter par @project-manager (décision infra/CI, pas un fix de code) |
| 2 | Basse | Cast `as ContexteDetectionEcart` dans `ecarts-assignation.ts:39`, pré-existant SU.2, pattern ERR-087 | `src/lib/queries/ecarts-assignation.ts:39` | @db-specialist si nettoyage général |
| 3 | Basse | Limitation résiduelle ADR-051 §7 (bac réparé isolément reste affiché indéfiniment) | ADR-051 | @architect/@project-manager, arbitrage produit futur — balayage périodique déjà recommandé ADR-048 §9 et ADR-051 §6 |

Problèmes Critique : aucun. Haute : aucun.

---

## Mobile-first 360px

Cartes empilées (`divide-y`), aucun `<table>`, lien `min-h-11` (44px), 3 tests dédiés (absence
table/thead/tr, absence grille multi-colonnes, absence largeur fixe >360px).

---

## Propreté de l'arbre

`docs/reviews/CS4-audit-prod.md` et `test-results/` sont préexistants (Sprint CS), non liés à BD.
Le fichier de test doublon a été fusionné puis supprimé, aucun résidu. Aucun fichier scratch à la
racine.

---

## Verdict

**VALIDÉ AVEC RÉSERVES.** Aucune réserve n'est bloquante avant merge : les réserves 1 et 3 sont
des décisions de process/produit à arbitrer par @project-manager, et la réserve 2 est un nit
pré-existant hors périmètre du sprint. Le sprint peut être clos dès que la réserve 1 (export de
`DATABASE_URL` en CI) est confirmée par le PM.
