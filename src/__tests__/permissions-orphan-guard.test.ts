/**
 * Garde-fou anti-récidive — Story SU.10 (permissions orphelines).
 *
 * Contexte : `VENTES_MODIFIER` n'était portée par AUCUN `SiteRole` seedé
 * (`prisma/seed.sql`), alors que 3 routes API l'exigent
 * (`/api/ventes/[id]/bon-livraison`, `/api/bons-livraison/[id]/signer`,
 * `/api/bons-livraison/[id]/quantites`, `/api/ventes/[id]`) — bloquant tout
 * utilisateur non-ADMIN-global. Cause racine : `SiteRole.permissions` est un
 * tableau STOCKÉ au moment de la création du rôle (pas recalculé
 * dynamiquement), donc toute valeur ajoutée à l'enum `Permission` sans
 * backfill applicatif (`prisma/seed.sql` pour dev/test + migration SQL pour
 * la prod, cf. `20260401000000_backfill_subscription_permissions` et
 * `20260726160000_backfill_ventes_modifier_permissions`) reste orpheline —
 * même si `SYSTEM_ROLE_DEFINITIONS` (source dynamique utilisée seulement à
 * la CRÉATION d'un nouveau site) semble "correcte".
 *
 * Ce fichier verrouille deux invariants pour empêcher que le problème se
 * reproduise au prochain ajout de permission :
 *
 *   1. Toute valeur de l'enum `Permission` doit être portée par le rôle
 *      système "Administrateur" tel que SEEDÉ dans `prisma/seed.sql`
 *      (représentatif de l'état réel stocké en base), SAUF exclusion
 *      explicite et documentée ci-dessous.
 *   2. Toute valeur de l'enum `Permission` doit avoir un libellé français
 *      dans `permissionLabels` (`src/lib/role-form-labels.ts`), sans
 *      exception (l'UI doit toujours pouvoir l'afficher, même pour une
 *      permission réservée à la plateforme).
 *
 * Test volontairement basé sur une lecture de fichier (seed.sql) plutôt que
 * sur `SYSTEM_ROLE_DEFINITIONS` : ce dernier calcule Administrateur =
 * `Object.values(Permission)` dynamiquement, ce qui rendrait le garde-fou
 * toujours vert par construction et ne détecterait jamais ce bug (la
 * définition dynamique n'est JAMAIS le problème — c'est le snapshot stocké
 * qui l'est).
 */

import { readFileSync } from "fs";
import { join } from "path";
import { Permission } from "@/types";
import { permissionLabels } from "@/lib/role-form-labels";

const SCHEMA_PATH = join(process.cwd(), "prisma/schema.prisma");
const SEED_PATH = join(process.cwd(), "prisma/seed.sql");

/** Toutes les valeurs de l'enum Permission (source de verite runtime). */
const ALL_PERMISSIONS = Object.values(Permission);

/**
 * Permissions volontairement absentes du rôle "Administrateur" seedé.
 * Chaque exclusion DOIT être justifiée en commentaire. N'ajouter une entrée
 * ici qu'après avoir vérifié que l'absence est un choix de conception
 * documenté, pas un oubli — sinon ce test devient une passoire.
 */
const ADMIN_ROLE_EXCLUSIONS: Partial<Record<Permission, string>> = {
  // ADR-021 (Admin Plateforme) : ces 3 permissions ne sont jamais accordées
  // via un SiteRole — elles ne s'appliquent que via le bypass global
  // `Role.ADMIN` dans `getServerPermissions()` (src/lib/auth/permissions-server.ts).
  // Les accorder à un SiteRole n'aurait aucun effet applicatif recherché et
  // laisserait croire à tort qu'un Administrateur de site a un accès
  // plateforme.
  [Permission.SITES_VOIR]: "ADR-021 — reservee au Role.ADMIN global (bypass), pas une permission de SiteRole",
  [Permission.SITES_GERER]: "ADR-021 — reservee au Role.ADMIN global (bypass), pas une permission de SiteRole",
  [Permission.ANALYTICS_PLATEFORME]: "ADR-021 — reservee au Role.ADMIN global (bypass), pas une permission de SiteRole",
  // Story SU.8 tranchee (arbitrage utilisateur) : BONS_LIVRAISON_RECTIFIER
  // est desormais assignee au role Administrateur seede — voir prisma/seed.sql
  // (blocs 'sr_admin_site_01' / 'sr_admin_client_01') et la migration
  // 20260726170000_backfill_bons_livraison_rectifier. Elle n'est plus
  // orpheline : PAS d'exclusion ici, elle est couverte par le test generique
  // ci-dessous comme toute autre permission assignee.
};

/**
 * Extrait le tableau de permissions du rôle système "Administrateur" tel
 * que défini dans le seed principal (bloc `sr_admin_site_01`) — c'est le
 * rôle qui doit avoir "l'acces complet au site" (cf. sa propre description
 * dans seed.sql), donc le candidat le plus fiable pour vérifier l'exhaustivité.
 */
function getSeededAdministrateurPermissions(): string[] {
  const seed = readFileSync(SEED_PATH, "utf-8");
  const marker = "'sr_admin_site_01'";
  const startIdx = seed.indexOf(marker);
  if (startIdx === -1) {
    throw new Error(
      "Bloc SiteRole 'sr_admin_site_01' introuvable dans prisma/seed.sql — le seed a-t-il ete restructure ?"
    );
  }
  const endIdx = seed.indexOf('::"Permission"[]', startIdx);
  const block = seed.slice(startIdx, endIdx);
  return Array.from(block.matchAll(/'([A-Z_]+)'/g)).map((m) => m[1]);
}

function getAllPermissionEnumValues(): string[] {
  const schema = readFileSync(SCHEMA_PATH, "utf-8");
  const match = schema.match(/enum Permission \{([\s\S]*?)\}/);
  if (!match) {
    throw new Error("Enum Permission introuvable dans prisma/schema.prisma");
  }
  return match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"));
}

describe("Garde-fou anti-recidive — permissions orphelines (SU.10)", () => {
  it("l'enum Permission (schema.prisma) et Permission (TypeScript) sont synchronises (R3)", () => {
    const schemaValues = getAllPermissionEnumValues();
    expect(new Set(ALL_PERMISSIONS)).toEqual(new Set(schemaValues));
  });

  it("toute permission de l'enum Permission est soit assignee au role Administrateur seede, soit explicitement exclue et justifiee", () => {
    const seeded = new Set(getSeededAdministrateurPermissions());
    const orphaned: string[] = [];

    for (const permission of ALL_PERMISSIONS) {
      const isExcluded = permission in ADMIN_ROLE_EXCLUSIONS;
      const isSeeded = seeded.has(permission);
      if (!isSeeded && !isExcluded) {
        orphaned.push(permission);
      }
    }

    expect(orphaned).toEqual([]);
  });

  it("toute exclusion documentee a une justification non vide", () => {
    for (const [permission, reason] of Object.entries(ADMIN_ROLE_EXCLUSIONS)) {
      expect(reason.trim().length).toBeGreaterThan(0);
      expect(ALL_PERMISSIONS).toContain(permission as Permission);
    }
  });

  it("BONS_LIVRAISON_RECTIFIER est desormais portee par le role Administrateur seede (arbitrage SU.8 tranche)", () => {
    // Arbitrage utilisateur (story SU.8) : accordee par defaut a
    // l'Administrateur de site uniquement, pas au Gerant. Le test generique
    // ci-dessus ("toute permission... soit assignee... soit explicitement
    // exclue") couvre deja cette permission puisqu'elle n'est plus dans
    // ADMIN_ROLE_EXCLUSIONS — ce test verifie explicitement qu'elle est bien
    // seedee (et non simplement retiree de la liste d'exclusion par erreur).
    const seeded = new Set(getSeededAdministrateurPermissions());
    expect(seeded.has(Permission.BONS_LIVRAISON_RECTIFIER)).toBe(true);
  });

  it("toute permission de l'enum Permission a un libelle francais dans permissionLabels (ERR-088)", () => {
    const missing = ALL_PERMISSIONS.filter((p) => !(p in permissionLabels));
    expect(missing).toEqual([]);
  });

  it("aucun libelle de permission n'est une chaine vide", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(permissionLabels[permission]?.trim().length ?? 0).toBeGreaterThan(0);
    }
  });
});
