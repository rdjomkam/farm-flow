"use client";

/**
 * src/hooks/use-previsions-api.ts
 *
 * Wrapper mince autour de `useApi` (src/hooks/use-api.ts) pour le module
 * Previsions (Sprint PR2, story PR2.3). Pas de service TanStack Query dedie
 * par groupe de modele (7 groupes x CRUD aurait ete disproportionne pour le
 * perimetre de cette story) — chaque composant client refetch lui-meme apres
 * une mutation reussie (`router.refresh()` pour les Server Components
 * parents, ou re-appel direct de la fonction de chargement locale), suivant
 * le principe le plus simple deja pratique par
 * `gerer-ressources-client.tsx` (fetch brut + `router.refresh()`).
 *
 * `useApi` gere deja : loading global, toast d'erreur automatique, parsing
 * JSON. Ce hook ajoute uniquement des raccourcis GET/POST/PUT/PATCH/DELETE
 * typés pour `/api/previsions/*`.
 */
import { useCallback } from "react";
import { useApi, type ApiCallOptions } from "@/hooks/use-api";

export function usePrevisionsApi() {
  const { call } = useApi();

  const get = useCallback(
    <T>(url: string, options?: ApiCallOptions) => call<T>(url, undefined, options),
    [call]
  );

  const post = useCallback(
    <T>(url: string, body: unknown, options?: ApiCallOptions) =>
      call<T>(
        url,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        options
      ),
    [call]
  );

  const put = useCallback(
    <T>(url: string, body: unknown, options?: ApiCallOptions) =>
      call<T>(
        url,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        options
      ),
    [call]
  );

  const patch = useCallback(
    <T>(url: string, body: unknown, options?: ApiCallOptions) =>
      call<T>(
        url,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        options
      ),
    [call]
  );

  const del = useCallback(
    <T>(url: string, options?: ApiCallOptions) => call<T>(url, { method: "DELETE" }, options),
    [call]
  );

  return { get, post, put, patch, del };
}
