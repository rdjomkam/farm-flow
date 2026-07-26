-- Migration : 20260727090006_unicite_numero_par_site_autosuffisante
--
-- POURQUOI CETTE MIGRATION EXISTE (voir ADR-049, docs/decisions/ADR-049-correctifs-donnees-migrations.md) :
--
-- Les deux migrations précédentes qui font la même transition (@unique global
-- -> @@unique([siteId, numero|code])) --
--   prisma/migrations/20260726174843_numero_unique_par_site/migration.sql
--   prisma/migrations/20260726212515_lotalevins_code_unique_par_site/migration.sql
-- -- documentent dans leur script d'audit associé
-- (scripts/data-fixes/su12-audit-doublons-numero.ts) qu'un humain doit
-- "penser à lancer" cet audit AVANT de déployer, "idéalement avant tout
-- déploiement en production". C'est exactement le défaut qu'ADR-049 interdit
-- désormais : une migration ne doit jamais dépendre d'un geste humain
-- préalable pour réussir en sécurité (ADR-049 §3.1, "Garde-fou de
-- migration" ; §3.3 point d).
--
-- On ne réécrit PAS les deux migrations existantes : leur statut d'exécution
-- en production est inconnu, et éditer un migration.sql déjà appliqué change
-- son checksum et fait échouer définitivement `prisma migrate deploy` avec
-- une erreur P3009 (dérive détectée). Cette migration s'AJOUTE après elles et
-- garantit, à elle seule, l'état final voulu quel que soit l'état de départ :
--   - si les deux migrations précédentes ont déjà tourné (cas probable en
--     production, cf. docker-entrypoint.sh qui lance `migrate deploy` à
--     chaque démarrage de conteneur) : cette migration est un no-op complet
--     et silencieux ;
--   - si elles n'ont pas tourné pour une raison quelconque : cette migration
--     produit elle-même l'état correct, sans dépendre d'aucun script lancé
--     à la main avant.
--
-- ANALYSE VÉRIFIÉE (pas supposée) — « composite plus permissif que le global
-- => ne peut pas échouer sur des doublons de données » :
-- Confirmé par lecture des deux migration.sql existantes : leur seul contenu
-- est `DROP INDEX <ancien index unique global sur la seule colonne>` suivi de
-- `CREATE UNIQUE INDEX <nouveau composite (siteId, champ)>` -- aucun UPDATE
-- de dédoublonnage de données dans aucune des deux. Une contrainte unique
-- composite (siteId, champ) est structurellement un sur-ensemble de
-- permissions par rapport à une contrainte unique globale sur (champ) seul :
-- si l'ancienne contrainte interdisait déjà deux lignes portant le même
-- `numero`/`code` tous sites confondus, il ne peut a fortiori pas exister
-- deux lignes portant le même (siteId, numero)/(siteId, code) après coup. Le
-- `CREATE UNIQUE INDEX` composite ne peut donc pas échouer sur des doublons
-- de données préexistants au titre de cette transition précise.
--
-- LE VRAI RISQUE (pas les doublons de données) :
-- Les deux migration.sql existantes utilisent `DROP INDEX "X_key"` et
-- `CREATE UNIQUE INDEX "X_siteId_key" ON ...` SANS `IF EXISTS` / `IF NOT
-- EXISTS`. Rejouer l'une d'elles sur une base où l'index nommé n'existe déjà
-- plus (ou déjà) échouerait immédiatement. Une dérive de schéma non
-- documentée (ERR-038 : l'unique global retiré ou renommé hors migration)
-- est la seule façon réaliste de faire échouer ce `CREATE UNIQUE INDEX` -- pas
-- un doublon de données. Cette migration corrige ce point précis en rendant
-- chaque DROP/CREATE strictement idempotent.
--
-- LES 10 FAMILLES CONCERNÉES (vérifiées contre prisma/schema.prisma, qui
-- porte déjà les @@unique([siteId, ...]) correspondants -- schema.prisma
-- n'est PAS modifié par cette migration) :
--   numero : BonLivraison, Commande, Depense, Facture, ListeBesoins, Vente
--   code   : Incubation, LotGeniteurs, Ponte, LotAlevins
--
-- DÉCISION -- résolution automatique des doublons vs échec explicite :
-- ÉCHEC EXPLICITE, choisi délibérément. Les valeurs concernées (numéro de
-- facture, de bon de livraison, de commande fournisseur, etc.) sont des
-- identifiants métier déjà communiqués à des tiers (clients, fournisseurs)
-- sur papier -- les renuméroter ou les suffixer automatiquement modifierait
-- une donnée que le tiers détient déjà, une conséquence largement plus
-- grave qu'un déploiement bloqué. ADR-049 §3.1 tranche explicitement ce
-- point : le sprint interdit qu'une action humaine soit requise AVANT le
-- déploiement pour que la migration réussisse -- il n'interdit pas qu'une
-- migration REFUSE de corrompre des données et le dise clairement, tôt,
-- avant toute écriture (ADR-049 §3.3 point d). Le coût réel de ce choix est
-- nul en pratique : l'analyse ci-dessus démontre que le garde-fou ne peut
-- structurellement pas se déclencher pour cette transition précise (l'ancien
-- `@unique` global les empêchait déjà) -- sa valeur est de rendre cette
-- hypothèse vérifiée par la machine, contre toute dérive de schéma non
-- documentée, plutôt qu'une simple croyance non testée.

-- ============================================================================
-- 1. GARDE-FOU -- AVANT toute modification. Détecte les doublons
--    (siteId, numero|code) sur les 10 familles, tolérant aux tables absentes
--    (schéma partiel : dev/test/nouveau site). Échoue tôt, en nommant les
--    doublons trouvés, si une dérive de schéma a réintroduit la possibilité
--    d'un doublon avant que cette migration n'ait pu re-garantir la
--    contrainte composite.
-- ============================================================================
DO $$
DECLARE
  v_families CONSTANT TEXT[][] := ARRAY[
    ARRAY['BonLivraison', 'numero'],
    ARRAY['Commande',     'numero'],
    ARRAY['Depense',      'numero'],
    ARRAY['Facture',      'numero'],
    ARRAY['ListeBesoins', 'numero'],
    ARRAY['Vente',        'numero'],
    ARRAY['Incubation',   'code'],
    ARRAY['LotGeniteurs', 'code'],
    ARRAY['Ponte',        'code'],
    ARRAY['LotAlevins',   'code']
  ];
  v_table TEXT;
  v_field TEXT;
  v_label TEXT;
  v_query TEXT;
  v_found TEXT;
  v_report TEXT := '';
BEGIN
  FOR i IN 1..array_length(v_families, 1) LOOP
    v_table := v_families[i][1];
    v_field := v_families[i][2];
    v_label := v_table || '.' || v_field;

    -- Tolérance aux tables absentes (schéma partiel) : to_regclass renvoie
    -- NULL sans lever d'exception si la table n'existe pas, contrairement à
    -- une requête directe sur un nom de table inconnu.
    IF to_regclass(format('%I', v_table)) IS NULL THEN
      CONTINUE;
    END IF;

    v_query := format(
      $q$
        SELECT string_agg(
          %L || ' | siteId=' || COALESCE(sub."siteId"::text, 'NULL')
             || ' | valeur=' || COALESCE(sub.val, 'NULL')
             || ' | occurrences=' || sub.cnt::text
             || ' | ids(5 premiers)=' || sub.ids_txt,
          chr(10) ORDER BY sub."siteId", sub.val
        )
        FROM (
          SELECT "siteId", %I::text AS val, count(*) AS cnt,
                 (array_agg(id ORDER BY id))[1:5]::text AS ids_txt
          FROM %I
          GROUP BY "siteId", %I
          HAVING count(*) > 1
          LIMIT 20
        ) sub
      $q$,
      v_label, v_field, v_table, v_field
    );

    EXECUTE v_query INTO v_found;

    IF v_found IS NOT NULL THEN
      v_report := v_report || CASE WHEN v_report = '' THEN '' ELSE chr(10) END || v_found;
    END IF;
  END LOOP;

  IF v_report <> '' THEN
    RAISE EXCEPTION E'Précondition non satisfaite (migration 20260727090006) : doublons (siteId, numero|code) détectés avant application de la contrainte composite. Aucune écriture n''a été effectuée. Corriger manuellement ces lignes (dédupliquer, jamais renuméroter automatiquement des identifiants déjà communiqués à des tiers), puis relancer le déploiement :\n%',
      v_report;
  END IF;
END $$;

-- ============================================================================
-- 2. DROP / CREATE idempotents -- no-op silencieux si les migrations
--    précédentes ont déjà fait le travail (cas probable en production),
--    produisent l'état correct sinon. Tolérants aux tables absentes.
-- ============================================================================
DO $$
DECLARE
  v_families CONSTANT TEXT[][] := ARRAY[
    ARRAY['BonLivraison', 'numero'],
    ARRAY['Commande',     'numero'],
    ARRAY['Depense',      'numero'],
    ARRAY['Facture',      'numero'],
    ARRAY['ListeBesoins', 'numero'],
    ARRAY['Vente',        'numero'],
    ARRAY['Incubation',   'code'],
    ARRAY['LotGeniteurs', 'code'],
    ARRAY['Ponte',        'code'],
    ARRAY['LotAlevins',   'code']
  ];
  v_table TEXT;
  v_field TEXT;
  v_old_index TEXT;
  v_new_index TEXT;
  v_dropped_count INT := 0;
  v_created_count INT := 0;
  v_dropped_list TEXT := '';
  v_created_list TEXT := '';
BEGIN
  FOR i IN 1..array_length(v_families, 1) LOOP
    v_table := v_families[i][1];
    v_field := v_families[i][2];
    -- Convention Prisma standard confirmée par lecture des deux migrations
    -- existantes : "<Table>_<champ>_key" (global) -> "<Table>_siteId_<champ>_key" (composite).
    v_old_index := v_table || '_' || v_field || '_key';
    v_new_index := v_table || '_siteId_' || v_field || '_key';

    IF to_regclass(format('%I', v_table)) IS NULL THEN
      -- Table absente (schéma partiel) : rien à faire pour cette famille.
      CONTINUE;
    END IF;

    -- DROP idempotent : IF EXISTS couvre à la fois le cas "déjà supprimé
    -- par la migration précédente" (no-op) et "jamais présent" (schéma
    -- partiel), sans jamais lever d'erreur -- contrairement aux deux
    -- migrations existantes qui n'ont pas cette garde.
    IF EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = v_old_index
    ) THEN
      EXECUTE format('DROP INDEX IF EXISTS %I', v_old_index);
      v_dropped_count := v_dropped_count + 1;
      v_dropped_list := v_dropped_list || CASE WHEN v_dropped_list = '' THEN '' ELSE ', ' END || v_old_index;
    END IF;

    -- CREATE idempotent : IF NOT EXISTS couvre le cas "déjà créé par la
    -- migration précédente" (no-op).
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = v_new_index
    ) THEN
      EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I("siteId", %I)',
        v_new_index, v_table, v_field
      );
      v_created_count := v_created_count + 1;
      v_created_list := v_created_list || CASE WHEN v_created_list = '' THEN '' ELSE ', ' END || v_new_index;
    END IF;
  END LOOP;

  -- ==========================================================================
  -- 3. JOURNALISATION -- ce qui a été effectivement créé/supprimé, ou rien.
  -- ==========================================================================
  IF v_dropped_count = 0 AND v_created_count = 0 THEN
    RAISE NOTICE '[20260727090006_unicite_numero_par_site_autosuffisante] Rien à faire -- les deux migrations précédentes (20260726174843, 20260726212515) avaient déjà appliqué la contrainte composite sur les 10 familles. No-op complet.';
  ELSE
    RAISE NOTICE '[20260727090006_unicite_numero_par_site_autosuffisante] % index global(aux) supprimé(s) [%], % index composite(s) créé(s) [%].',
      v_dropped_count, v_dropped_list, v_created_count, v_created_list;
  END IF;
END $$;
