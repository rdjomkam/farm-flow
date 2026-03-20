"use client";

import { useCallback } from "react";
import { useApi } from "@/hooks/use-api";
import type {
  LoginDTO,
  RegisterDTO,
  AuthResponse,
  SwitchSiteDTO,
  StartImpersonationResponse,
  StopImpersonationResponse,
} from "@/types";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * useAuthService — Appels API pour /api/auth/**, /api/users/impersonate
 *
 * @example
 * const authService = useAuthService();
 * const { data, ok } = await authService.login(dto);
 */
export function useAuthService() {
  const { call } = useApi();

  const login = useCallback(
    (dto: LoginDTO) =>
      call<AuthResponse>(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Connexion reussie !" }
      ),
    [call]
  );

  const logout = useCallback(
    () =>
      call<{ success: boolean }>(
        "/api/auth/logout",
        { method: "POST" },
        { successMessage: "Deconnexion reussie." }
      ),
    [call]
  );

  const register = useCallback(
    (dto: RegisterDTO) =>
      call<AuthResponse>(
        "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Compte cree avec succes !" }
      ),
    [call]
  );

  const getMe = useCallback(
    () => call<AuthResponse>("/api/auth/me"),
    [call]
  );

  const switchSite = useCallback(
    (dto: SwitchSiteDTO) =>
      call<AuthResponse>(
        "/api/auth/site",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: "Site actif change." }
      ),
    [call]
  );

  const impersonate = useCallback(
    (userId: string) =>
      call<StartImpersonationResponse>(
        `/api/users/${userId}/impersonate`,
        { method: "POST" },
        { successMessage: "Impersonation demarree." }
      ),
    [call]
  );

  const stopImpersonate = useCallback(
    () =>
      call<StopImpersonationResponse>(
        "/api/users/impersonate",
        { method: "DELETE" },
        { successMessage: "Retour a votre compte." }
      ),
    [call]
  );

  return { login, logout, register, getMe, switchSite, impersonate, stopImpersonate };
}
