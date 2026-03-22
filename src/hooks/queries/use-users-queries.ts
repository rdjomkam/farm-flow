"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUserService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
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

// --- Utilisateurs ---

export function useUsersList() {
  const userService = useUserService();

  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: async () => {
      const result = await userService.listUsers();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement utilisateurs");
      return result.data.users as User[];
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useUserDetail(id: string | undefined) {
  const userService = useUserService();

  return useQuery({
    queryKey: queryKeys.users.detail(id!),
    queryFn: async () => {
      const result = await userService.getUser(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement utilisateur");
      return result.data as User;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useUserMemberships(id: string | undefined) {
  const userService = useUserService();

  return useQuery({
    queryKey: [...queryKeys.users.detail(id!), "memberships"],
    queryFn: async () => {
      const result = await userService.getUserMemberships(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement memberships");
      return result.data.memberships as SiteMemberWithRelations[];
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  const userService = useUserService();

  return useMutation({
    mutationFn: async (dto: CreateUserAdminDTO) => {
      const result = await userService.createUser(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création utilisateur");
      return result.data as User;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  const userService = useUserService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateUserAdminDTO }) => {
      const result = await userService.updateUser(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification utilisateur");
      return result.data as User;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(id) });
    },
  });
}

export function useResetPassword() {
  const userService = useUserService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: ResetPasswordAdminDTO }) => {
      const result = await userService.resetPassword(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur réinitialisation mot de passe");
      return result.data;
    },
  });
}

export function useDeleteUserSessions() {
  const userService = useUserService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await userService.deleteUserSessions(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur suppression sessions");
      return result.data;
    },
  });
}

// --- Sites ---

export function useSitesList() {
  const userService = useUserService();

  return useQuery({
    queryKey: queryKeys.sites.list(),
    queryFn: async () => {
      const result = await userService.listSites();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement sites");
      return result.data.sites as SiteWithMembers[];
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useSiteDetail(id: string | undefined) {
  const userService = useUserService();

  return useQuery({
    queryKey: queryKeys.sites.detail(id!),
    queryFn: async () => {
      const result = await userService.getSite(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement site");
      return result.data as SiteWithMembers;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();
  const userService = useUserService();

  return useMutation({
    mutationFn: async (dto: CreateSiteDTO) => {
      const result = await userService.createSite(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création site");
      return result.data as SiteWithMembers;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
    },
  });
}

export function useUpdateSite() {
  const queryClient = useQueryClient();
  const userService = useUserService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateSiteDTO }) => {
      const result = await userService.updateSite(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification site");
      return result.data as SiteWithMembers;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.detail(id) });
    },
  });
}

// --- Membres ---

export function useSiteMembersList(siteId: string | undefined) {
  const userService = useUserService();

  return useQuery({
    queryKey: queryKeys.sites.members(siteId!),
    queryFn: async () => {
      const result = await userService.listMembers(siteId!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement membres");
      return result.data.members as SiteMemberWithRelations[];
    },
    enabled: !!siteId,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();
  const userService = useUserService();

  return useMutation({
    mutationFn: async ({ siteId, dto }: { siteId: string; dto: AddMemberDTO }) => {
      const result = await userService.addMember(siteId, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur ajout membre");
      return result.data as SiteMemberWithRelations;
    },
    onSuccess: (_data, { siteId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.members(siteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.detail(siteId) });
    },
  });
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  const userService = useUserService();

  return useMutation({
    mutationFn: async ({
      siteId,
      userId,
      dto,
    }: {
      siteId: string;
      userId: string;
      dto: UpdateMemberDTO;
    }) => {
      const result = await userService.updateMember(siteId, userId, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification membre");
      return result.data as SiteMemberWithRelations;
    },
    onSuccess: (_data, { siteId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.members(siteId) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  const userService = useUserService();

  return useMutation({
    mutationFn: async ({ siteId, userId }: { siteId: string; userId: string }) => {
      const result = await userService.removeMember(siteId, userId);
      if (!result.ok) throw new Error(result.error ?? "Erreur retrait membre");
      return result.data;
    },
    onSuccess: (_data, { siteId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.members(siteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.detail(siteId) });
    },
  });
}

// --- Roles de site ---

export function useSiteRolesList(siteId: string | undefined) {
  const userService = useUserService();

  return useQuery({
    queryKey: queryKeys.sites.roles(siteId!),
    queryFn: async () => {
      const result = await userService.listRoles(siteId!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement rôles");
      return result.data.roles as SiteRoleWithCount[];
    },
    enabled: !!siteId,
    staleTime: 30 * 60_000, // 30 min — config stable
    gcTime: 60 * 60_000,
  });
}

export function useCreateSiteRole() {
  const queryClient = useQueryClient();
  const userService = useUserService();

  return useMutation({
    mutationFn: async ({ siteId, dto }: { siteId: string; dto: CreateSiteRoleDTO }) => {
      const result = await userService.createRole(siteId, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création rôle");
      return result.data as SiteRoleWithCount;
    },
    onSuccess: (_data, { siteId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.roles(siteId) });
    },
  });
}

export function useUpdateSiteRole() {
  const queryClient = useQueryClient();
  const userService = useUserService();

  return useMutation({
    mutationFn: async ({
      siteId,
      roleId,
      dto,
    }: {
      siteId: string;
      roleId: string;
      dto: UpdateSiteRoleDTO;
    }) => {
      const result = await userService.updateRole(siteId, roleId, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification rôle");
      return result.data as SiteRoleWithCount;
    },
    onSuccess: (_data, { siteId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.roles(siteId) });
    },
  });
}

export function useDeleteSiteRole() {
  const queryClient = useQueryClient();
  const userService = useUserService();

  return useMutation({
    mutationFn: async ({ siteId, roleId }: { siteId: string; roleId: string }) => {
      const result = await userService.deleteRole(siteId, roleId);
      if (!result.ok) throw new Error(result.error ?? "Erreur suppression rôle");
      return result.data;
    },
    onSuccess: (_data, { siteId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sites.roles(siteId) });
    },
  });
}
