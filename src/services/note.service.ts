"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type {
  NoteIngenieurWithRelations,
  NoteIngenieurListResponse,
  CreateNoteIngenieurDTO,
  UpdateNoteIngenieurDTO,
  VisibiliteNote,
} from "@/types";

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface NoteListResult {
  notes: NoteIngenieurWithRelations[];
}

/** Reponse client notes (GET /api/notes) */
interface ClientNoteListResult {
  notes: NoteIngenieurWithRelations[];
}

/** Observation client (GET/POST /api/mes-observations) */
interface ObservationResult {
  observations: Array<Record<string, unknown>>;
}

interface CreateObservationDTO {
  type: string;
  observationTexte: string;
  vagueId?: string;
  isUrgent?: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useNoteService — Appels API pour /api/ingenieur/notes/**, /api/notes, /api/mes-observations
 *
 * Gestion des notes ingenieur (INTERNE + PUBLIC) et des observations client.
 */
export function useNoteService() {
  const { call } = useApi();

  // -- Notes ingenieur (endpoint INGENIEUR) --

  const listNotes = useCallback(
    (params?: {
      clientSiteId?: string;
      vagueId?: string;
      visibility?: VisibiliteNote;
      isUrgent?: boolean;
      isRead?: boolean;
      isFromClient?: boolean;
    }) => {
      const qs = new URLSearchParams();
      if (params?.clientSiteId) qs.set("clientSiteId", params.clientSiteId);
      if (params?.vagueId) qs.set("vagueId", params.vagueId);
      if (params?.visibility) qs.set("visibility", params.visibility);
      if (params?.isUrgent !== undefined) qs.set("isUrgent", String(params.isUrgent));
      if (params?.isRead !== undefined) qs.set("isRead", String(params.isRead));
      if (params?.isFromClient !== undefined) qs.set("isFromClient", String(params.isFromClient));
      const query = qs.toString();
      return call<NoteListResult>(`/api/ingenieur/notes${query ? `?${query}` : ""}`);
    },
    [call]
  );

  const getNote = useCallback(
    (id: string) => call<NoteIngenieurWithRelations>(`/api/ingenieur/notes/${id}`),
    [call]
  );

  const createNote = useCallback(
    (dto: CreateNoteIngenieurDTO) =>
      call<NoteIngenieurWithRelations>(
        "/api/ingenieur/notes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Note envoyee !" }
      ),
    [call]
  );

  const updateNote = useCallback(
    (id: string, dto: UpdateNoteIngenieurDTO) =>
      call<NoteIngenieurWithRelations>(
        `/api/ingenieur/notes/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Note modifiee." }
      ),
    [call]
  );

  const markNoteRead = useCallback(
    (id: string) =>
      call<{ message: string }>(
        `/api/ingenieur/notes/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        }
      ),
    [call]
  );

  // -- Dashboard ingenieur --

  const getDashboardIngenieur = useCallback(
    () => call<Record<string, unknown>>("/api/ingenieur/dashboard"),
    [call]
  );

  const getClientsIngenieur = useCallback(
    () => call<Record<string, unknown>>("/api/ingenieur/clients"),
    [call]
  );

  // -- Notes client (endpoint CLIENT — PUBLIC uniquement) --

  const listNotesClient = useCallback(
    (params?: { vagueId?: string; isUrgent?: boolean }) => {
      const qs = new URLSearchParams();
      if (params?.vagueId) qs.set("vagueId", params.vagueId);
      if (params?.isUrgent !== undefined) qs.set("isUrgent", String(params.isUrgent));
      const query = qs.toString();
      return call<ClientNoteListResult>(`/api/notes${query ? `?${query}` : ""}`);
    },
    [call]
  );

  // -- Observations client --

  const listObservations = useCallback(
    (params?: { vagueId?: string }) => {
      const qs = params?.vagueId
        ? `?vagueId=${encodeURIComponent(params.vagueId)}`
        : "";
      return call<ObservationResult>(`/api/mes-observations${qs}`);
    },
    [call]
  );

  const createObservation = useCallback(
    (dto: CreateObservationDTO) =>
      call<Record<string, unknown>>(
        "/api/mes-observations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Observation envoyee !" }
      ),
    [call]
  );

  return {
    listNotes,
    getNote,
    createNote,
    updateNote,
    markNoteRead,
    getDashboardIngenieur,
    getClientsIngenieur,
    listNotesClient,
    listObservations,
    createObservation,
  };
}
