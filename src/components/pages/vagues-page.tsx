import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { VaguesListClient } from "@/components/vagues/vagues-list-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagues } from "@/lib/queries/vagues";
import { getBacsLibres } from "@/lib/queries/bacs";
import { prisma } from "@/lib/db";
import { StatutVague, TypeReleve, TypeVague, TypeUniteProduction, Permission, TypeSystemeBac } from "@/types";
import type { VagueSummaryResponse, BacResponse } from "@/types";
import { computeVivantsByBac } from "@/lib/calculs";

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

      const vague = v as typeof v & {
        assignations?: { nombreInitial: number | null; bac: { id: string } }[];
        releves?: Array<{
          typeReleve: TypeReleve | string;
          date: Date;
          poidsMoyen: number | null;
          nombreMorts: number | null;
          nombreVendus: number | null;
          nombreTransferes: number | null;
          nombreCompte: number | null;
          bacId: string | null;
        }>;
        lignesVente?: { poidsTotalKg: number }[];
        configElevage?: { poidsObjectif: number } | null;
        poidsObjectifKg?: number | null;
      };

      const assignations = vague.assignations ?? [];
      const releves = vague.releves ?? [];
      const lignesVente = vague.lignesVente ?? [];

      const totalVenduKg = lignesVente.reduce((sum, lv) => sum + (lv.poidsTotalKg ?? 0), 0);

      let poidsObjectifKg: number | null = vague.poidsObjectifKg ?? null;
      if (poidsObjectifKg == null && vague.configElevage?.poidsObjectif && v.nombreInitial > 0) {
        poidsObjectifKg = (vague.configElevage.poidsObjectif * v.nombreInitial) / 1000;
      }

      let biomasse: number | null = null;
      const bacsMapped = assignations.map((a) => ({ id: a.bac.id, nombreInitial: a.nombreInitial }));
      const hasPerBacReleves = releves.some((r) => r.bacId !== null);
      if (bacsMapped.length > 0 && hasPerBacReleves) {
        const vivantsByBac = computeVivantsByBac(
          bacsMapped,
          releves as Parameters<typeof computeVivantsByBac>[1],
          v.nombreInitial,
          { excludeVentes: true }
        );
        const biometriesParBac = new Map<string, number>();
        for (const r of releves) {
          if (r.typeReleve === TypeReleve.BIOMETRIE && r.poidsMoyen !== null && r.bacId) {
            biometriesParBac.set(r.bacId, r.poidsMoyen);
          }
        }
        let totalBiomasse = 0;
        let hasBiomasse = false;
        for (const bac of bacsMapped) {
          const poidsMoyen = biometriesParBac.get(bac.id);
          const vivantsBac = vivantsByBac.get(bac.id) ?? 0;
          if (poidsMoyen && vivantsBac > 0) {
            totalBiomasse += (poidsMoyen * vivantsBac) / 1000;
            hasBiomasse = true;
          }
        }
        if (hasBiomasse) {
          biomasse = Math.max(0, Math.round((totalBiomasse - totalVenduKg) * 100) / 100);
        }
      }

      return {
        id: v.id,
        code: v.code,
        dateDebut: v.dateDebut,
        dateFin: v.dateFin,
        statut: v.statut as StatutVague,
        type: (v as { type?: TypeVague }).type ?? TypeVague.GROSSISSEMENT,
        nombreInitial: v.nombreInitial,
        poidsMoyenInitial: v.poidsMoyenInitial,
        origineAlevins: v.origineAlevins,
        // ADR-043 Phase 3: assignations actives remplacent _count.bacs
        nombreBacs: (v._count as { assignations?: number }).assignations ?? 0,
        joursEcoules,
        createdAt: v.createdAt,
        isBlocked: (v as { isBlocked?: boolean }).isBlocked ?? false,
        poidsObjectifKg,
        biomasse,
        totalVenduKg: Math.round(totalVenduKg * 100) / 100,
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
        <VaguesListClient
          vagues={vagues}
          bacsLibres={bacsLibres}
          permissions={permissions}
          configElevages={configElevages}
          unitesProduction={unitesProduction.map((u) => ({ ...u, type: u.type as TypeUniteProduction }))}
        />
      </>
    );
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[VaguesPage]", error);
    throw error;
  }
}
