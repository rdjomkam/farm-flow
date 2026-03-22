"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNoteService } from "@/services";
import { queryKeys } from "@/lib/query-keys";
import type {
  NoteIngenieurWithRelations,
  CreateNoteIngenieurDTO,
  UpdateNoteIngenieurDTO,
  VisibiliteNote,
} from "@/types";

// ---------------------------------------------------------------------------
// Interfaces locales (types internes au service non exportés)
// ---------------------------------------------------------------------------

interface CreateObservationDTO {
  type: string;
  observationTexte: string;
  vagueId?: string;
  isUrgent?: boolean;
}

// ---------------------------------------------------------------------------
// Clés locales
// ---------------------------------------------------------------------------

const observationsKey = ["observations"] as const;

// --- Notes ingenieur (endpoint INGENIEUR) ---

export function useNotesList(filters?: {
  clientSiteId?: string;
  vagueId?: string;
  visibility?: VisibiliteNote;
  isUrgent?: boolean;
  isRead?: boolean;
  isFromClient?: boolean;
}) {
  const noteService = useNoteService();

  return useQuery({
    queryKey: queryKeys.notes.list(filters as Record<string, unknown>),
    queryFn: async () => {
      const result = await noteService.listNotes(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement notes");
      return result.data.notes as NoteIngenieurWithRelations[];
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useNoteDetail(id: string | undefined) {
  const noteService = useNoteService();

  return useQuery({
    queryKey: [...queryKeys.notes.all, "detail", id],
    queryFn: async () => {
      const result = await noteService.getNote(id!);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement note");
      return result.data as NoteIngenieurWithRelations;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  const noteService = useNoteService();

  return useMutation({
    mutationFn: async (dto: CreateNoteIngenieurDTO) => {
      const result = await noteService.createNote(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création note");
      return result.data as NoteIngenieurWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  const noteService = useNoteService();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateNoteIngenieurDTO }) => {
      const result = await noteService.updateNote(id, dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur modification note");
      return result.data as NoteIngenieurWithRelations;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
    },
  });
}

export function useMarkNoteRead() {
  const queryClient = useQueryClient();
  const noteService = useNoteService();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await noteService.markNoteRead(id);
      if (!result.ok) throw new Error(result.error ?? "Erreur marquage note");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
    },
  });
}

// --- Notes client (endpoint CLIENT — PUBLIC uniquement) ---

export function useNotesClientList(filters?: { vagueId?: string; isUrgent?: boolean }) {
  const noteService = useNoteService();

  return useQuery({
    queryKey: [...queryKeys.notes.list(filters as Record<string, unknown>), "client"],
    queryFn: async () => {
      const result = await noteService.listNotesClient(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement notes");
      return result.data.notes as NoteIngenieurWithRelations[];
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

// --- Observations client ---

export function useObservationsList(filters?: { vagueId?: string }) {
  const noteService = useNoteService();

  return useQuery({
    queryKey: [...observationsKey, filters],
    queryFn: async () => {
      const result = await noteService.listObservations(filters);
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement observations");
      return result.data.observations;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useCreateObservation() {
  const queryClient = useQueryClient();
  const noteService = useNoteService();

  return useMutation({
    mutationFn: async (dto: CreateObservationDTO) => {
      const result = await noteService.createObservation(dto);
      if (!result.ok) throw new Error(result.error ?? "Erreur création observation");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: observationsKey });
    },
  });
}

// --- Dashboard ingenieur ---

export function useDashboardIngenieur() {
  const noteService = useNoteService();

  return useQuery({
    queryKey: [...queryKeys.dashboard.all, "ingenieur"],
    queryFn: async () => {
      const result = await noteService.getDashboardIngenieur();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement dashboard ingénieur");
      return result.data;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useClientsIngenieur() {
  const noteService = useNoteService();

  return useQuery({
    queryKey: ["ingenieur", "clients"],
    queryFn: async () => {
      const result = await noteService.getClientsIngenieur();
      if (!result.ok || !result.data) throw new Error(result.error ?? "Erreur chargement clients ingénieur");
      return result.data;
    },
    staleTime: 2 * 60_000,
    gcTime: 5 * 60_000,
  });
}
