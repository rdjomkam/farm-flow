"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("common");

  const login = useCallback(
    (dto: LoginDTO) =>
      call<AuthResponse>(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dto),
        },
        { successMessage: t("toasts.loginSuccess") }
      ),
    [call, t]
  );

  const logout = useCallback(
    () =>
      call<{ success: boolean }>(
        "/api/auth/logout",
        { method: "POST" },
        { successMessage: t("toasts.logoutSuccess") }
      ),
    [call, t]
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
        { successMessage: t("toasts.registerSuccess") }
      ),
    [call, t]
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
        { successMessage: t("toasts.siteChanged") }
      ),
    [call, t]
  );

  const impersonate = useCallback(
    (userId: string) =>
      call<StartImpersonationResponse>(
        `/api/users/${userId}/impersonate`,
        { method: "POST" },
        { successMessage: t("toasts.impersonationStarted") }
      ),
    [call, t]
  );

  const stopImpersonate = useCallback(
    () =>
      call<StopImpersonationResponse>(
        "/api/users/impersonate",
        { method: "DELETE" },
        { successMessage: t("toasts.impersonationStopped") }
      ),
    [call, t]
  );

  return { login, logout, register, getMe, switchSite, impersonate, stopImpersonate };
}
