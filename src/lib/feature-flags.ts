/**
 * src/lib/feature-flags.ts
 *
 * Utilitaires pour les feature flags de la plateforme DKFarm.
 *
 * - getFeatureFlag(key)          — lecture DB avec React.cache() (une seule requete par render)
 * - isMaintenanceModeEnabled()   — raccourci cache pour le flag MAINTENANCE_MODE
 * - checkPlatformMaintenance()   — guard API (retourne 503 NextResponse ou null)
 *
 * Le mode maintenance est verifie directement en DB (pas de cookie).
 * Le layout root (src/app/layout.tsx) lit la DB directement (Server Component, Node.js runtime).
 *
 * ADR-maintenance-mode
 */

import { cache } from "react";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { FeatureFlag } from "@/types";

// ---------------------------------------------------------------------------
// DB helpers — cachees par requete HTTP (React.cache)
// ---------------------------------------------------------------------------

/**
 * Lit un feature flag par sa cle.
 * Cache par requete via React.cache() — une seule requete DB par render.
 */
export const getFeatureFlag = cache(
  async (key: string): Promise<FeatureFlag | null> => {
    const flag = await prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) return null;
    return {
      key: flag.key,
      enabled: flag.enabled,
      value: (flag.value as Record<string, unknown> | null) ?? null,
      updatedAt: flag.updatedAt,
      updatedBy: flag.updatedBy,
    };
  }
);

/**
 * Raccourci pour verifier si le mode maintenance est actif.
 * Cache par requete via React.cache() — une seule requete DB par render.
 *
 * @important Cette fonction utilise React.cache() et ne doit etre appelee
 * que dans un contexte de rendu Server Component (render phase).
 * Pour les API routes (POST/PUT/PATCH/DELETE), utiliser checkPlatformMaintenance()
 * a la place — elle effectue une lecture DB directe sans cache et retourne
 * directement une NextResponse 503 si la maintenance est active.
 */
export const isMaintenanceModeEnabled = cache(async (): Promise<boolean> => {
  const flag = await getFeatureFlag("MAINTENANCE_MODE");
  return flag?.enabled ?? false;
});

// ---------------------------------------------------------------------------
// Guard API — utilise dans les route handlers (lecture DB directe, sans cache)
// ---------------------------------------------------------------------------

/**
 * Verifie si la plateforme est en mode maintenance via une requete DB directe.
 *
 * A appeler dans les routes POST/PUT/PATCH/DELETE exposees aux utilisateurs normaux,
 * avant toute mutation.
 * Les super-admins ne sont PAS bloques par ce guard.
 *
 * @param isSuperAdmin - true si l'appelant est super-admin (bypass maintenance)
 *
 * Retourne null si tout va bien.
 * Retourne une NextResponse 503 si en maintenance et l'utilisateur n'est pas super-admin.
 */
export async function checkPlatformMaintenance(
  isSuperAdmin: boolean
): Promise<NextResponse | null> {
  // Les super-admins ne sont jamais bloques
  if (isSuperAdmin) return null;

  // Lecture DB directe (pas de cache — guard de securite)
  const flag = await prisma.featureFlag.findUnique({
    where: { key: "MAINTENANCE_MODE" },
    select: { enabled: true },
  });

  if (flag?.enabled) {
    return NextResponse.json(
      {
        status: 503,
        message: "Plateforme en maintenance. Veuillez reessayer plus tard.",
        code: "MAINTENANCE_MODE",
      },
      { status: 503 }
    );
  }

  return null;
}

