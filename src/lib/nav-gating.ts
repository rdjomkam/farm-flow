/**
 * nav-gating.ts — Centralise toute la logique de visibilité de la navigation.
 *
 * Les 4 composants de navigation (FarmSidebar, FarmBottomNav, IngenieurSidebar,
 * IngenieurBottomNav) doivent utiliser ces fonctions plutôt que leur propre
 * logique inline.
 *
 * Fonctions pures uniquement — pas de dépendances React.
 */

import { Permission, SiteModule } from "@/types";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface NavItem {
  id: string;
  labelKey: string;
  href: string;
  /** Nom du composant Lucide (référence documentaire, non importé ici) */
  icon: string;
  /**
   * ANY / OR — visible si l'utilisateur possède AU MOINS UNE de ces permissions.
   * Si absent, la permission n'est pas vérifiée à ce niveau.
   */
  requiredPermissions?: Permission[];
  /**
   * ALL / AND — visible uniquement si l'utilisateur possède TOUTES ces permissions.
   * Si absent, la vérification "toutes" est ignorée.
   */
  requiredPermissionsAll?: Permission[];
  /** Masqué si le module n'est pas activé sur le site. */
  requiredModule?: SiteModule;
  /** Réservé aux super-admins : masqué pour tout autre utilisateur. */
  superAdminOnly?: boolean;
  /** Toujours affiché quel que soit le contexte (ex : Accueil, Menu). */
  alwaysVisible?: boolean;
}

export interface NavGroup {
  id: string;
  labelKey: string;
  items: NavItem[];
  /** Portail de groupe — permission unique requise (AND avec les autres gates). */
  gatePermission?: Permission;
  /** Portail de groupe — au moins une des permissions listées est requise. */
  gatePermissionsAny?: Permission[];
  /** Portail de groupe — module requis pour afficher le groupe. */
  gateModule?: SiteModule;
}

export interface BottomNavItem extends NavItem {
  // Les items de la bottom nav peuvent avoir alwaysVisible pour Accueil + Menu.
}

// ---------------------------------------------------------------------------
// Helpers privés
// ---------------------------------------------------------------------------

/** Normalise un tableau potentiellement null/undefined en tableau vide. */
function normalizeArray<T>(arr: T[] | null | undefined): T[] {
  if (!arr || !Array.isArray(arr)) return [];
  return arr;
}

// ---------------------------------------------------------------------------
// Fonctions publiques
// ---------------------------------------------------------------------------

/**
 * Détermine si un NavItem doit être affiché.
 *
 * Ordre d'évaluation :
 * 1. superAdmin → toujours visible
 * 2. superAdminOnly && !superAdmin → toujours masqué
 * 3. alwaysVisible → toujours visible
 * 4. requiredModule absent dans userModules → masqué
 * 5. requiredPermissions (ANY) → masqué si aucune ne correspond
 * 6. requiredPermissionsAll (ALL) → masqué si toutes ne correspondent pas
 * 7. Sinon → visible
 */
export function isNavItemVisible(
  item: NavItem,
  userPermissions: Permission[] | null | undefined,
  userModules: SiteModule[] | null | undefined,
  isSuperAdmin: boolean
): boolean {
  // Étape 1 : super-admin voit tout
  if (isSuperAdmin) return true;

  // Étape 2 : item réservé super-admin, mais utilisateur ne l'est pas
  if (item.superAdminOnly) return false;

  // Étape 3 : toujours visible (ex : Accueil, Menu)
  if (item.alwaysVisible) return true;

  const permissions = normalizeArray(userPermissions);
  const modules = normalizeArray(userModules);

  // Étape 4 : module requis non activé sur le site
  if (item.requiredModule && !modules.includes(item.requiredModule)) {
    return false;
  }

  // Étape 5 : ANY/OR — l'utilisateur doit posséder au moins une permission
  if (item.requiredPermissions && item.requiredPermissions.length > 0) {
    const hasAny = item.requiredPermissions.some((p) => permissions.includes(p));
    if (!hasAny) return false;
  }

  // Étape 6 : ALL/AND — l'utilisateur doit posséder toutes les permissions
  if (item.requiredPermissionsAll && item.requiredPermissionsAll.length > 0) {
    const hasAll = item.requiredPermissionsAll.every((p) =>
      permissions.includes(p)
    );
    if (!hasAll) return false;
  }

  return true;
}

/**
 * Détermine si un NavGroup doit être affiché.
 *
 * Un groupe est visible si :
 * - Les portails de groupe sont satisfaits (ou ignorés si superAdmin)
 * - Au moins un item du groupe est visible
 */
export function isGroupVisible(
  group: NavGroup,
  userPermissions: Permission[] | null | undefined,
  userModules: SiteModule[] | null | undefined,
  isSuperAdmin: boolean
): boolean {
  const permissions = normalizeArray(userPermissions);
  const modules = normalizeArray(userModules);

  if (!isSuperAdmin) {
    // Vérification portail permission unique
    if (
      group.gatePermission &&
      !permissions.includes(group.gatePermission)
    ) {
      return false;
    }

    // Vérification portail permissions ANY
    if (group.gatePermissionsAny && group.gatePermissionsAny.length > 0) {
      const hasAny = group.gatePermissionsAny.some((p) =>
        permissions.includes(p)
      );
      if (!hasAny) return false;
    }

    // Vérification portail module
    if (group.gateModule && !modules.includes(group.gateModule)) {
      return false;
    }
  }

  // Vérification finale : au moins un item visible dans le groupe
  const hasVisibleItem = group.items.some((item) =>
    isNavItemVisible(item, userPermissions, userModules, isSuperAdmin)
  );

  return hasVisibleItem;
}

/**
 * Retourne la liste des groupes visibles, avec leurs items filtrés.
 *
 * Les items non visibles sont retirés de chaque groupe.
 * Les groupes sans aucun item visible sont retirés de la liste.
 */
export function getVisibleGroups(
  groups: NavGroup[],
  userPermissions: Permission[] | null | undefined,
  userModules: SiteModule[] | null | undefined,
  isSuperAdmin: boolean
): NavGroup[] {
  return groups.reduce<NavGroup[]>((acc, group) => {
    if (!isGroupVisible(group, userPermissions, userModules, isSuperAdmin)) {
      return acc;
    }

    const visibleItems = group.items.filter((item) =>
      isNavItemVisible(item, userPermissions, userModules, isSuperAdmin)
    );

    // On inclut le groupe uniquement s'il contient des items visibles
    if (visibleItems.length > 0) {
      acc.push({ ...group, items: visibleItems });
    }

    return acc;
  }, []);
}

/**
 * Retourne la liste des items de bottom nav visibles.
 *
 * Garantie : les items avec `alwaysVisible: true` sont toujours inclus,
 * indépendamment des autres conditions.
 */
export function getVisibleBottomNavItems(
  items: BottomNavItem[],
  userPermissions: Permission[] | null | undefined,
  userModules: SiteModule[] | null | undefined,
  isSuperAdmin: boolean
): BottomNavItem[] {
  return items.filter((item) =>
    isNavItemVisible(item, userPermissions, userModules, isSuperAdmin)
  );
}

/**
 * Formate un compteur numérique pour l'affichage dans un badge.
 *
 * - Retourne "" si count <= 0, NaN ou Infinity
 * - Retourne "99+" si count > 99
 * - Retourne count.toString() sinon
 */
export function formatBadgeCount(count: number): string {
  if (!isFinite(count) || isNaN(count) || count <= 0) return "";
  if (count > 99) return "99+";
  return count.toString();
}
