/**
 * Types d'authentification et multi-tenancy — DTOs, session et contexte auth.
 *
 * Les interfaces de base (User, Session, Site, SiteMember) et les enums
 * (Role, Permission) sont dans models.ts.
 * Ce fichier definit les DTOs pour les API routes auth/sites et le type
 * de session/contexte utilise cote middleware et route handlers.
 */

import type { Permission, Role } from "./models";

// ---------------------------------------------------------------------------
// Session utilisateur (donnees exposees cote client)
// ---------------------------------------------------------------------------

/**
 * UserSession — donnees de l'utilisateur authentifie.
 *
 * C'est ce que le middleware injecte dans les headers et ce que
 * les composants client utilisent pour afficher le user menu.
 * Ne contient JAMAIS le passwordHash.
 */
export interface UserSession {
  userId: string;
  email: string | null;
  phone: string | null;
  name: string;
  role: Role;
  activeSiteId: string | null;
}

// ---------------------------------------------------------------------------
// AuthContext (retourne par requireAuth dans les route handlers)
// ---------------------------------------------------------------------------

/**
 * AuthContext — contexte complet d'authentification multi-site.
 *
 * Retourne par requireAuth() dans les API routes.
 * Contient le role global ET le role dynamique/permissions du site actif.
 */
export interface AuthContext {
  userId: string;
  email: string | null;
  phone: string | null;
  name: string;
  /** Role global de l'utilisateur (ADMIN = super-admin multi-site) */
  globalRole: Role;
  /** ID du site actif */
  activeSiteId: string;
  /** ID du SiteRole de l'utilisateur sur le site actif */
  siteRoleId: string;
  /** Nom du SiteRole (ex: "Administrateur", "Pisciculteur") */
  siteRoleName: string;
  /** Permissions effectives de l'utilisateur sur le site actif */
  permissions: Permission[];
}

// ---------------------------------------------------------------------------
// DTOs — Login
// ---------------------------------------------------------------------------

/** Corps de la requete POST /api/auth/login */
export interface LoginDTO {
  /** Email ou telephone — identifiant unique de l'utilisateur */
  identifier: string;
  password: string;
}

// ---------------------------------------------------------------------------
// DTOs — Register
// ---------------------------------------------------------------------------

/** Corps de la requete POST /api/auth/register — au moins email ou phone requis */
export interface RegisterDTO {
  email?: string;
  phone?: string;
  name: string;
  password: string;
}

// ---------------------------------------------------------------------------
// DTOs — Sites
// ---------------------------------------------------------------------------

/** Corps de la requete POST /api/sites */
export interface CreateSiteDTO {
  name: string;
  address?: string;
}

/** Corps de la requete PUT /api/sites/[id] */
export interface UpdateSiteDTO {
  name?: string;
  address?: string;
  isActive?: boolean;
}

/** Corps de la requete PUT /api/auth/site (changer le site actif) */
export interface SwitchSiteDTO {
  siteId: string;
}

// ---------------------------------------------------------------------------
// DTOs — Membres
// ---------------------------------------------------------------------------

/** Corps de la requete POST /api/sites/[id]/members */
export interface AddMemberDTO {
  userId: string;
  siteRoleId: string;
}

/** Corps de la requete PUT /api/sites/[id]/members/[memberId] */
export interface UpdateMemberDTO {
  siteRoleId?: string;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// DTOs — Roles de site
// ---------------------------------------------------------------------------

/** Corps de la requete POST /api/sites/[id]/roles */
export interface CreateSiteRoleDTO {
  name: string;
  description?: string;
  permissions: Permission[];
}

/** Corps de la requete PUT /api/sites/[id]/roles/[roleId] */
export interface UpdateSiteRoleDTO {
  name?: string;
  description?: string;
  permissions?: Permission[];
}

// ---------------------------------------------------------------------------
// Reponses Auth
// ---------------------------------------------------------------------------

/**
 * AuthResponse — reponse des endpoints d'authentification.
 *
 * En cas de succes : success=true, user contient les donnees de session.
 * En cas d'echec : success=false, error contient le message.
 */
export interface AuthResponse {
  success: boolean;
  user?: UserSession;
  permissions?: Permission[];
  error?: string;
}
