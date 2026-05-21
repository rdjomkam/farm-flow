import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { VenteFormClient } from "@/components/ventes/vente-form-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getClients } from "@/lib/queries/clients";
import { prisma } from "@/lib/db";
import { StatutVague, Permission, TypeUniteProduction, StatutLotAlevins, PhaseLot } from "@/types";

interface NouvelleVentePageProps {
  searchParams: Promise<{
    lotAlevinsId?: string;
    quantite?: string;
    poidsTotalKg?: string;
    clientId?: string;
  }>;
}

export default async function NouvelleVentePage({ searchParams }: NouvelleVentePageProps) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.VENTES_CREER);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("ventes");
  const params = await searchParams;
  const activeSiteId = session.activeSiteId;

  // Fetch clients, active vagues, production units, and alevin lots
  const [clients, vagues, unites, lotsAlevins] = await Promise.all([
    getClients(activeSiteId),
    prisma.vague.findMany({
      where: {
        siteId: activeSiteId,
        statut: { notIn: [StatutVague.ANNULEE, StatutVague.TERMINEE] },
      },
      select: { id: true, code: true },
      orderBy: { dateDebut: "desc" },
    }),
    prisma.uniteProduction.findMany({
      where: { siteId: activeSiteId, isActive: true },
      select: { id: true, code: true, nom: true, type: true },
      orderBy: { code: "asc" },
    }),
    prisma.lotAlevins.findMany({
      where: {
        siteId: activeSiteId,
        statut: { in: [StatutLotAlevins.EN_INCUBATION, StatutLotAlevins.EN_ELEVAGE] },
        phase: { in: [PhaseLot.NURSERIE, PhaseLot.ALEVINAGE] },
        nombreActuel: { gt: 0 },
      },
      select: {
        id: true,
        code: true,
        nombreActuel: true,
        poidsMoyen: true,
        phase: true,
        ponte: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Fetch lot info for the banner when coming from a lot sortie
  let lotCode: string | null = null;
  if (params.lotAlevinsId) {
    const lot = await prisma.lotAlevins.findFirst({
      where: { id: params.lotAlevinsId, siteId: activeSiteId },
      select: { code: true },
    });
    lotCode = lot?.code ?? null;
  }

  const clientOptions = clients.map((c) => ({ id: c.id, nom: c.nom }));
  const vagueOptions = vagues.map((v) => ({ id: v.id, code: v.code }));
  const uniteOptions = unites.map((u) => ({
    id: u.id,
    code: u.code,
    nom: u.nom,
    type: u.type as TypeUniteProduction,
  }));
  const lotOptions = lotsAlevins.map((l) => ({
    id: l.id,
    code: l.code,
    nombreActuel: l.nombreActuel,
    poidsMoyen: l.poidsMoyen,
    phase: l.phase as PhaseLot,
    ponteCode: l.ponte.code,
  }));

  const prefill = params.lotAlevinsId
    ? {
        lotAlevinsId: params.lotAlevinsId,
        lotCode: lotCode ?? undefined,
        quantite: params.quantite ? parseInt(params.quantite, 10) : undefined,
        poidsTotalKg: params.poidsTotalKg ? parseFloat(params.poidsTotalKg) : undefined,
        clientId: params.clientId,
      }
    : undefined;

  return (
    <>
      <Header title={t("ventes.new")} />
      <div className="p-4">
        <VenteFormClient
          clients={clientOptions}
          vagues={vagueOptions}
          unites={uniteOptions}
          lotsAlevins={lotOptions}
          prefill={prefill}
        />
      </div>
    </>
  );
}
