import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { VenteFormClient } from "@/components/ventes/vente-form-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getClients } from "@/lib/queries/clients";
import { prisma } from "@/lib/db";
import { StatutVague, Permission } from "@/types";

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

  const [clients, vagues] = await Promise.all([
    getClients(session.activeSiteId),
    prisma.vague.findMany({
      where: {
        siteId: session.activeSiteId,
        statut: { not: StatutVague.ANNULEE },
      },
      include: {
        bacs: { select: { nombrePoissons: true } },
      },
      orderBy: { dateDebut: "desc" },
    }),
  ]);

  // Fetch lot info for the banner when coming from a lot sortie
  let lotCode: string | null = null;
  if (params.lotAlevinsId) {
    const lot = await prisma.lotAlevins.findFirst({
      where: { id: params.lotAlevinsId, siteId: session.activeSiteId },
      select: { code: true },
    });
    lotCode = lot?.code ?? null;
  }

  const clientOptions = clients.map((c) => ({ id: c.id, nom: c.nom }));
  const vagueOptions = vagues.map((v) => ({
    id: v.id,
    code: v.code,
    poissonsDisponibles: v.bacs.reduce(
      (sum, bac) => sum + (bac.nombrePoissons ?? 0),
      0
    ),
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
          prefill={prefill}
        />
      </div>
    </>
  );
}
