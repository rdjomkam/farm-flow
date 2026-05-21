import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { VaguesListClient } from "@/components/vagues/vagues-list-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagues } from "@/lib/queries/vagues";
import { getBacsLibres } from "@/lib/queries/bacs";
import { prisma } from "@/lib/db";
import { StatutVague, Permission, TypeSystemeBac } from "@/types";
import type { VagueSummaryResponse, BacResponse } from "@/types";

export default async function VaguesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
    const [permissions, t, vaguesResult, bacsLibresRaw, configElevages, unitesProduction] = await Promise.all([
      checkPagePermission(session, Permission.VAGUES_VOIR),
      getTranslations("vagues"),
      getVagues(session.activeSiteId),
      getBacsLibres(session.activeSiteId),
      prisma.configElevage.findMany({
        where: { siteId: session.activeSiteId },
        select: { id: true, nom: true },
        orderBy: { nom: "asc" },
      }),
      prisma.uniteProduction.findMany({
        where: { siteId: session.activeSiteId, isActive: true },
        select: { id: true, code: true, nom: true, type: true },
        orderBy: { nom: "asc" },
      }),
    ]);
    if (!permissions) return <AccessDenied />;

    const vagues: VagueSummaryResponse[] = vaguesResult.data.map((v) => {
      const now = v.dateFin ?? new Date();
      const joursEcoules = Math.floor(
        (now.getTime() - v.dateDebut.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: v.id,
        code: v.code,
        dateDebut: v.dateDebut,
        dateFin: v.dateFin,
        statut: v.statut as StatutVague,
        nombreInitial: v.nombreInitial,
        poidsMoyenInitial: v.poidsMoyenInitial,
        origineAlevins: v.origineAlevins,
        // ADR-043 Phase 3: assignations actives remplacent _count.bacs
        nombreBacs: (v._count as { assignations?: number }).assignations ?? 0,
        joursEcoules,
        createdAt: v.createdAt,
        isBlocked: (v as { isBlocked?: boolean }).isBlocked ?? false,
      };
    });

    // ADR-043 Phase 3: les bacs libres n'ont pas d'assignation active
    // — les champs de production (nombrePoissons, vagueId, etc.) sont null par définition
    const bacsLibres: BacResponse[] = bacsLibresRaw.map((b) => ({
      id: b.id,
      nom: b.nom,
      volume: b.volume,
      nombrePoissons: null,
      nombreInitial: null,
      poidsMoyenInitial: null,
      typeSysteme: (b.typeSysteme as TypeSystemeBac | null) ?? null,
      isBlocked: (b as { isBlocked?: boolean }).isBlocked ?? false,
      vagueId: null,
      siteId: b.siteId,
      vagueCode: null,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    return (
      <>
        <Header title={t("page.title")} />
        <VaguesListClient vagues={vagues} bacsLibres={bacsLibres} permissions={permissions} configElevages={configElevages} unitesProduction={unitesProduction} />
      </>
    );
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[VaguesPage]", error);
    throw error;
  }
}
