# Audit PX.5 — Signatures/cachets en base (DEV)

**Date d'exécution** : 2026-07-26
**Environnement** : DEV (PostgreSQL 16 Docker, conteneur `silures-db`, port `8432`, DB `farm-flow`)
**Exécuté par** : @db-specialist
**Script** : `scripts/data-fixes/px-audit-signatures-corrompues.ts` (strictement read-only)

## Contexte

Un PNG RGBA dont le flux IDAT est corrompu, stocké dans `BonLivraison.signatureClient`,
`BonLivraison.signatureLivreur`, `Site.signaturePromoteur` ou `Site.cachet`, provoque un
blocage indéfini de `renderToBuffer()` lors de la génération du PDF du bon de livraison
(cf. ADR-047). PX.1/PX.2/PX.3 ont durci l'écriture et la lecture. PX.5 vérifie si des
données legacy déjà en base (écrites avant ce durcissement) portent une image corrompue.

Note (PM) : la base de DEV a déjà été nettoyée manuellement avant cet audit — la signature
1×1 corrompue précédemment présente sur `BL-2026-001` a été remplacée par une vraie
signature. Un résultat « 0 corrompu » en DEV est donc **attendu**, pas une preuve que le
script fonctionne (un script qui ne détecte jamais rien passerait aussi ce test) — voir la
section « Preuve de détection » ci-dessous pour la preuve indépendante de la base.

## Commande exacte lancée (DEV)

```bash
source ~/.nvm/nvm.sh && nvm use 22
set -a; source /Users/ronald/project/dkfarm/farm-flow/.env; set +a
npx tsx scripts/data-fixes/px-audit-signatures-corrompues.ts
```

(Le `.env` du dépôt contient `DATABASE_URL` pointant vers le Docker `silures-db` sur le
port 8432 — voir MEMORY.md. Le conteneur doit être démarré : `docker compose up -d`.)

## Sortie complète du script

```
=== PX.5 — Audit read-only des signatures/cachet (STRICTEMENT LECTURE SEULE) ===
Cible : postgresql://dkfarm:***@localhost:8432/farm-flow?schema=public

--- BonLivraison.signatureClient / signatureLivreur ---
BonLivraison | cms1l3o5q000h4mekpwae2cd1 (BL-2026-001) | signatureClient | décodable=OUI | format=png | taille=20.7 Ko
BonLivraison | cms1l3o5q000h4mekpwae2cd1 (BL-2026-001) | signatureLivreur | décodable=OUI | format=png | taille=19.7 Ko
BonLivraison | cms1sn2ic0002o9eky7v7d3pr (BL-2026-002) | signatureClient | décodable=OUI | format=png | taille=20.7 Ko
BonLivraison | cms1sn2ic0002o9eky7v7d3pr (BL-2026-002) | signatureLivreur | décodable=OUI | format=png | taille=19.7 Ko

--- Site.signaturePromoteur / cachet ---
Site | site_01 (Ferme Douala) | signaturePromoteur | décodable=OUI | format=png | taille=12.0 Ko
Site | site_01 (Ferme Douala) | cachet | décodable=OUI | format=png | taille=14.1 Ko

=== RÉSUMÉ ===
Total inspecté      : 6
Total non décodable : 0
Toutes les images inspectées sont décodables.
```

**Code de sortie** : `0` (tout est décodable).

## Constat chiffré, par colonne

| Colonne | Lignes non nulles inspectées | Non décodables |
|---|---|---|
| `BonLivraison.signatureClient` | 2 | 0 |
| `BonLivraison.signatureLivreur` | 2 | 0 |
| `Site.signaturePromoteur` | 1 | 0 |
| `Site.cachet` | 1 | 0 |
| **Total** | **6** | **0** |

Le mot de passe de `DATABASE_URL` est masqué dans la sortie (`postgresql://dkfarm:***@...`),
confirmé par lecture du code (`maskDatabaseUrl()`).

## Preuve que le script détecte réellement un cas corrompu

Aucune donnée corrompue n'a été insérée en base (ni temporairement, ni définitivement) pour
produire cette preuve — conformément à la consigne. La preuve est apportée par un test
vitest **sans connexion base de données** :

- Fichier : `scripts/data-fixes/__tests__/px-audit-signatures-corrompues.test.ts`
- La fonction d'inspection unitaire du script (`auditValue()`, désormais exportée) est
  appelée directement avec deux fixtures PNG RGBA construites en mémoire :
  - un PNG RGBA valide (mono-IDAT) → classé `decodable: true`, `format: "png"` ;
  - un PNG RGBA à IDAT corrompu (bit-flip au milieu du flux zlib compressé, reproduisant
    exactement le scénario ADR-047) → classé `decodable: false`, `format: "png"`,
    `reason` renseignée et contenant `"IDAT"`.
- Un test complémentaire vérifie que `dataUrlByteSize()` calcule une taille décodée
  cohérente avec le payload base64 réel.
- Résultat : **5/5 tests passent**, aucune connexion DB requise (exécuté sans
  `DATABASE_URL` défini dans l'environnement).

Extrait du run :
```
✓ scripts/data-fixes/__tests__/px-audit-signatures-corrompues.test.ts (5 tests) 830ms
  ✓ détecte un PNG RGBA à IDAT corrompu comme non décodable (preuve que l'audit détecte un cas corrompu) 497ms
```

Cette preuve est indépendante de l'état de la base de DEV : elle démontre que la fonction
d'inspection utilisée ligne à ligne par le script (`auditValue`, qui délègue à
`decodeImageDataUrl()` de PX.1, sans réimplémentation) classe correctement un PNG RGBA
corrompu comme non décodable, avec le code de sortie `1` que produirait le script si une
telle ligne existait réellement en base (cf. `main()` : `if (nonDecodables.length > 0)
return 1`).

## Conclusion

- **DEV** : 6 valeurs non nulles inspectées sur les 4 colonnes, **0 non décodable**. Aucune
  action corrective nécessaire sur l'environnement de DEV actuel.
- Le script est confirmé **strictement read-only** (relecture du code : aucun
  `UPDATE`/`INSERT`/`DELETE`/`upsert`/`executeRaw` mutant — uniquement des `pool.query`
  en `SELECT`).
- Le script détecte correctement un cas corrompu (preuve par test unitaire ci-dessus),
  ce qui valide la fiabilité du constat « 0 corrompu » obtenu en DEV : le script n'est
  pas un simple test qui retournerait toujours 0.

## Commande exacte pour l'audit PROD (à lancer par l'utilisateur — jamais par un agent)

```bash
source ~/.nvm/nvm.sh && nvm use 22
DATABASE_URL="<url-de-prod-prisma-postgres>" npx tsx scripts/data-fixes/px-audit-signatures-corrompues.ts
echo "Code de sortie : $?"
```

Remplacer `<url-de-prod-prisma-postgres>` par l'URL de connexion Prisma Postgres de
production (ne jamais la committer, ne jamais la coller dans un message partagé en clair —
le script masque le mot de passe dans sa propre sortie mais la variable d'environnement
elle-même reste sensible). Le script est read-only : son exécution en prod est sans risque
de mutation, mais reste une opération à autoriser explicitement par l'utilisateur, jamais
déclenchée par un agent.
