# Review Sprint 15 — Upload Facture sur Commande

**Revieweur :** @code-reviewer
**Date :** 2026-03-15
**Sprint :** 15
**Verdict : VALIDE** (avec 3 observations mineures non-bloquantes)

---

## Périmètre de la review

Fichiers créés / modifiés dans ce sprint :

| Fichier | Nature |
|---------|--------|
| `prisma/schema.prisma` | Ajout `factureUrl String?` sur modèle Commande |
| `prisma/migrations/20260315100000_add_facture_url/migration.sql` | Migration ALTER TABLE ADD COLUMN |
| `prisma/seed.sql` | cmd_01 avec factureUrl fictive, cmd_02 avec NULL |
| `src/types/models.ts` | `Commande.factureUrl: string \| null` |
| `src/types/api.ts` | `UploadFactureCommandeDTO` + `FactureCommandeResponse` |
| `src/types/index.ts` | Barrel export Sprint 15 |
| `src/lib/storage.ts` | Client S3 Hetzner + uploadFile + deleteFile + getSignedUrl + validateFile + generateFactureKey |
| `.env.example` | Variables HETZNER_S3_* documentées |
| `src/app/api/commandes/[id]/facture/route.ts` | POST + GET + DELETE upload facture |
| `src/app/api/commandes/[id]/recevoir/route.ts` | Modifié pour accepter FormData optionnel |
| `src/components/stock/commande-detail-client.tsx` | Section facture + dialogs upload/suppression |
| `src/__tests__/api/commandes-facture.test.ts` | 23 tests Sprint 15 |
| `package.json` | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |

---

## Checklist R1-R9

### R1 — Enums MAJUSCULES

Pas de nouveaux enums dans ce sprint. Les enums existants (`StatutCommande`, `Permission`) sont toujours en UPPERCASE.

### R2 — Toujours importer les enums

| Fichier | Imports | Usage |
|---------|---------|-------|
| `src/app/api/commandes/[id]/facture/route.ts` | `import { Permission } from "@/types"` | `Permission.APPROVISIONNEMENT_GERER` |
| `src/app/api/commandes/[id]/recevoir/route.ts` | `import { Permission } from "@/types"` | `Permission.APPROVISIONNEMENT_GERER` |
| `src/components/stock/commande-detail-client.tsx` | `import { StatutCommande, UniteStock, Permission } from "@/types"` | Conforme |

R2 respecté.

### R3 — Prisma = TypeScript identiques

| Champ Prisma | Type Prisma | Type TypeScript |
|-------------|-------------|-----------------|
| `Commande.factureUrl` | `String?` | `string \| null` |

Alignement parfait.

### R4 — Opérations atomiques

Dans `/api/commandes/[id]/facture/route.ts` (DELETE) :
- `findFirst` pour vérifier l'existence + `updateMany` pour mettre null — même pattern que partout dans le codebase. Acceptable (voir note M1).

Dans `/api/commandes/[id]/recevoir/route.ts` :
- `recevoirCommande` est dans une transaction Prisma (stock + statut LIVREE).
- L'upload facture se fait APRÈS la transaction. Si l'upload échoue, la réception est quand même validée (avec log d'erreur). Choix délibéré pour ne pas bloquer la réception sur une panne S3. Voir note M2.

### R5 — DialogTrigger asChild

Vérification dans `commande-detail-client.tsx` : les boutons "Uploader la facture" et "Supprimer" utilisent des `Button` natifs dans les `DialogFooter`, avec `DialogClose asChild` pour les boutons d'annulation — conforme.

### R6 — CSS variables du thème

Aucune couleur hexadécimale en dur. Classes Tailwind exclusivement (`text-muted-foreground`, `text-destructive`, `bg-muted/50`).

### R7 — Nullabilité explicite

`factureUrl String?` dans Prisma, `factureUrl: string | null` en TypeScript. Nullable explicitement.

### R8 — siteId PARTOUT

| Route | siteId vérifié |
|-------|---------------|
| `POST /api/commandes/[id]/facture` | `prisma.commande.findFirst({ where: { id, siteId: auth.activeSiteId } })` |
| `GET /api/commandes/[id]/facture` | Idem |
| `DELETE /api/commandes/[id]/facture` | `prisma.commande.findFirst({ where: { id, siteId } })` + `updateMany({ where: { id, siteId } })` |
| `POST /api/commandes/[id]/recevoir` | `recevoirCommande(id, auth.activeSiteId, ...)` |

R8 respecté sur toutes les routes.

### R9 — Tests avant review

- `npx vitest run` : 1102/1102 tests passent (38 fichiers), 0 échec
- `npm run build` : Build production OK
- Rapport de tests : `docs/tests/rapport-sprint-15.md` produit

---

## Sécurité — Points critiques

### Secrets S3 — CONFORME

Les clés S3 (`HETZNER_S3_ACCESS_KEY`, `HETZNER_S3_SECRET_KEY`) sont lues depuis les variables d'environnement dans `src/lib/storage.ts`. Aucune valeur en dur dans le code. Le `.env.example` documente les variables sans valeurs réelles.

### Signed URLs uniquement — CONFORME

Les fichiers ne sont pas publics. L'accès se fait exclusivement via `getSignedUrl()` (expiration 1h). Le client S3 est configuré sans ACL public (`ACL` non défini dans `PutObjectCommand`). Le bucket doit être configuré en privé côté Hetzner.

### Validation MIME côté serveur — CONFORME

`validateFile()` dans `storage.ts` vérifie le type MIME et la taille côté serveur, avant tout traitement du fichier. La validation côté client dans `commande-detail-client.tsx` est en plus pour l'UX (feedback immédiat).

---

## Observations

### M1 (Mineur) — Race condition sur findFirst + updateMany dans DELETE

**Fichier :** `src/app/api/commandes/[id]/facture/route.ts`, handler DELETE

**Description :** Le handler DELETE fait un `findFirst` (pour récupérer `factureUrl`) puis un `updateMany` séparé. En cas de concurrence, une deuxième suppression simultanée pourrait lire le même `factureUrl` et tenter de supprimer deux fois le même fichier S3.

**Impact :** Très faible (S3 `DeleteObjectCommand` sur un fichier déjà supprimé retourne 204 sans erreur). Non-bloquant.

### M2 (Mineur) — Upload facture dissocié de la transaction recevoir

**Fichier :** `src/app/api/commandes/[id]/recevoir/route.ts`

**Description :** Si l'upload S3 échoue après que `recevoirCommande` réussisse, le stock est mis à jour mais `factureUrl` n'est pas sauvegardé. L'utilisateur voit une réception réussie sans facture attachée.

**Impact :** Acceptable — l'utilisateur peut uploader la facture séparément via `POST /api/commandes/[id]/facture`. Le log d'erreur serveur est présent. Non-bloquant.

**Recommandation :** Documenter ce comportement dans les logs de l'application.

### M3 (Mineur) — État local factureUrl dans commande-detail-client

**Fichier :** `src/components/stock/commande-detail-client.tsx`

**Description :** Après un upload réussi, le composant met à jour localement `factureUrl` à une valeur fictive (`factures/${commande.id}/uploaded`) avant le `router.refresh()`. Cette valeur fictive pourrait afficher brièvement une icône incorrecte (pas le bon type PDF/image).

**Impact :** UX marginalement incorrecte pendant ~100-200ms avant le refresh. Non-bloquant.

**Recommandation :** Retirer la mise à jour optimiste et laisser le `router.refresh()` seul mettre à jour l'état, ou stocker la vraie clé retournée par l'API.

---

## Points positifs

1. **Gestion d'erreur robuste dans l'upload** : `validateFile` lève des erreurs descriptives en français, bien formatées pour l'UI.

2. **Rétro-compatibilité recevoir** : Le handler `recevoir` accepte JSON et FormData, le code existant (tests, clients) qui envoie du JSON continue de fonctionner sans modification.

3. **Fonction `extractFileNameFromKey`** : Permet d'afficher un nom de fichier lisible à l'utilisateur sans stocker le nom original en DB.

4. **Mobile first** : Les boutons dans `commande-detail-client.tsx` sont `w-full` sur mobile, le champ file input est accessible via un bouton (`hidden input + trigger button`), pas de tableau.

5. **Singleton S3 client** : Le pattern `_s3Client` évite de recréer le client à chaque requête.

---

## Verdict final

**VALIDE** — Le Sprint 15 respecte toutes les règles R1-R9 et les critères de sécurité (secrets, signed URLs, validation MIME serveur). Les 3 observations sont mineures et non-bloquantes.

La Phase 3 (Starter Packs & Guided Farming, renommée Sprint 16+) peut être planifiée.
