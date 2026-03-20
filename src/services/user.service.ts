"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type {
  User,
  CreateUserAdminDTO,
  UpdateUserAdminDTO,
  ResetPasswordAdminDTO,
  CreateSiteDTO,
  UpdateSiteDTO,
  AddMemberDTO,
  UpdateMemberDTO,
  CreateSiteRoleDTO,
  UpdateSiteRoleDTO,
  SiteWithMembers,
  SiteMemberWithRelations,
  SiteRoleWithCount,
} from "@/types";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface UserListResult {
  users: User[];
}

interface SiteListResult {
  sites: SiteWithMembers[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useUserService — Appels API pour /api/users/**, /api/sites/**
 *
 * Gestion des utilisateurs (admin), des sites et des membres.
 */
export function useUserService() {
  const { call } = useApi();

  // -- Utilisateurs --

  const listUsers = useCallback(
    () => call<UserListResult>("/api/users"),
    [call]
  );

  const getUser = useCallback(
    (id: string) => call<User>(`/api/users/${id}`),
    [call]
  );

  const createUser = useCallback(
    (dto: CreateUserAdminDTO) =>
      call<User>(
        "/api/users",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Utilisateur cree." }
      ),
    [call]
  );

  const updateUser = useCallback(
    (id: string, dto: UpdateUserAdminDTO) =>
      call<User>(
        `/api/users/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Utilisateur modifie." }
      ),
    [call]
  );

  const resetPassword = useCallback(
    (id: string, dto: ResetPasswordAdminDTO) =>
      call<{ message: string }>(
        `/api/users/${id}/password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Mot de passe reinitialise." }
      ),
    [call]
  );

  const getUserMemberships = useCallback(
    (id: string) =>
      call<{ memberships: SiteMemberWithRelations[] }>(`/api/users/${id}/memberships`),
    [call]
  );

  const deleteUserSessions = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/users/${id}/sessions`,
        { method: "DELETE" },
        { successMessage: "Sessions supprimees." }
      ),
    [call]
  );

  // -- Sites --

  const listSites = useCallback(
    () => call<SiteListResult>("/api/sites"),
    [call]
  );

  const getSite = useCallback(
    (id: string) => call<SiteWithMembers>(`/api/sites/${id}`),
    [call]
  );

  const createSite = useCallback(
    (dto: CreateSiteDTO) =>
      call<SiteWithMembers>(
        "/api/sites",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Site cree." }
      ),
    [call]
  );

  const updateSite = useCallback(
    (id: string, dto: UpdateSiteDTO) =>
      call<SiteWithMembers>(
        `/api/sites/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Site modifie." }
      ),
    [call]
  );

  // -- Membres --

  const listMembers = useCallback(
    (siteId: string) =>
      call<{ members: SiteMemberWithRelations[] }>(`/api/sites/${siteId}/members`),
    [call]
  );

  const addMember = useCallback(
    (siteId: string, dto: AddMemberDTO) =>
      call<SiteMemberWithRelations>(
        `/api/sites/${siteId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Membre ajoute." }
      ),
    [call]
  );

  const updateMember = useCallback(
    (siteId: string, userId: string, dto: UpdateMemberDTO) =>
      call<SiteMemberWithRelations>(
        `/api/sites/${siteId}/members/${userId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Membre modifie." }
      ),
    [call]
  );

  const removeMember = useCallback(
    (siteId: string, userId: string) =>
      call<{ message: string }>(
        `/api/sites/${siteId}/members/${userId}`,
        { method: "DELETE" },
        { successMessage: "Membre retire." }
      ),
    [call]
  );

  // -- Roles de site --

  const listRoles = useCallback(
    (siteId: string) =>
      call<{ roles: SiteRoleWithCount[] }>(`/api/sites/${siteId}/roles`),
    [call]
  );

  const createRole = useCallback(
    (siteId: string, dto: CreateSiteRoleDTO) =>
      call<SiteRoleWithCount>(
        `/api/sites/${siteId}/roles`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Role cree." }
      ),
    [call]
  );

  const updateRole = useCallback(
    (siteId: string, roleId: string, dto: UpdateSiteRoleDTO) =>
      call<SiteRoleWithCount>(
        `/api/sites/${siteId}/roles/${roleId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Role modifie." }
      ),
    [call]
  );

  const deleteRole = useCallback(
    (siteId: string, roleId: string) =>
      call<{ message: string }>(
        `/api/sites/${siteId}/roles/${roleId}`,
        { method: "DELETE" },
        { successMessage: "Role supprime." }
      ),
    [call]
  );

  return {
    listUsers,
    getUser,
    createUser,
    updateUser,
    resetPassword,
    getUserMemberships,
    deleteUserSessions,
    listSites,
    getSite,
    createSite,
    updateSite,
    listMembers,
    addMember,
    updateMember,
    removeMember,
    listRoles,
    createRole,
    updateRole,
    deleteRole,
  };
}
