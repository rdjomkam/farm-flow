"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotificationService, useConfigService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  NotificationWithRelations,
  ConfigAlerteWithRelations,
  CreateConfigAlerteDTO,
  UpdateConfigAlerteDTO,
} from "@/types";

// ---------------------------------------------------------------------------
// Clés locales pour alertes config (pas encore dans queryKeys global)
// ---------------------------------------------------------------------------

const alertesConfigKey = ["alertes", "config"] as const;

// --- Notifications ---

export function useNotificationsList() {
  const notificationService = useNotificationService();

  return useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: async () => {
      const result = await notificationService.list();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement notifications");
      return result.data.notifications as NotificationWithRelations[];
    },
    staleTime: 30_000, // 30s — données temps réel
    gcTime: 60_000,
  });
}

export function useNotificationsCount() {
  const notificationService = useNotificationService();

  return useQuery({
    queryKey: queryKeys.notifications.count(),
    queryFn: async () => {
      const result = await notificationService.getCount();
      if (!result.ok || !result.data) return 0;
      return result.data.count;
    },
    staleTime: 30_000, // 30s — utilisé en polling
    gcTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const notificationService = useNotificationService();

  return useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut?: string }) => {
      const result = await notificationService.markRead(id, statut);
      if (!result.ok) throw new Error(result.error ?? "Erreur marquage notification");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.count() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const notificationService = useNotificationService();

  return useMutation({
    mutationFn: async () => {
      const result = await notificationService.markAllRead();
      if (!result.ok) throw new Error(result.error ?? "Erreur marquage toutes notifications");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.count() });
    },
  });
}

// --- Config alertes ---

export function useConfigAlertesList() {
  const configService = useConfigService();

  return useQuery({
    queryKey: alertesConfigKey,
    queryFn: async () => {
      const result = await configService.listConfigAlertes();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement config alertes");
      return result.data.configs as ConfigAlerteWithRelations[];
    },
    staleTime: 30 * 60_000, // 30 min — config stable
    gcTime: 60 * 60_000,
  });
}

export function useCreateConfigAlerte() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async (dto: CreateConfigAlerteDTO) => {
      const result = await configService.createConfigAlerte(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création alerte");
      return result.data as ConfigAlerteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertesConfigKey });
    },
  });
}

export function useUpdateConfigAlerte() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateConfigAlerteDTO }) => {
      const result = await configService.updateConfigAlerte(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification alerte");
      return result.data as ConfigAlerteWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertesConfigKey });
    },
  });
}

export function useDeleteConfigAlerte() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await configService.deleteConfigAlerte(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur suppression alerte");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertesConfigKey });
    },
  });
}

export function useCheckAlertes() {
  const queryClient = useQueryClient();
  const configService = useConfigService();

  return useMutation({
    mutationFn: async () => {
      const result = await configService.checkAlertes();
      if (!result.ok) throw new Error(result.error ?? "Erreur vérification alertes");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.count() });
    },
  });
}
