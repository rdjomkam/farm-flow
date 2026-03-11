import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { VenteFormClient } from "@/components/ventes/vente-form-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getClients } from "@/lib/queries/clients";
import { prisma } from "@/lib/db";
import { StatutVague, Permission } from "@/types";

export default async function NouvelleVentePage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.VENTES_CREER);
  if (!permissions) return <AccessDenied />;

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

  const clientOptions = clients.map((c) => ({ id: c.id, nom: c.nom }));
  const vagueOptions = vagues.map((v) => ({
    id: v.id,
    code: v.code,
    poissonsDisponibles: v.bacs.reduce(
      (sum, bac) => sum + (bac.nombrePoissons ?? 0),
      0
    ),
  }));

  return (
    <>
      <Header title="Nouvelle vente" />
      <div className="p-4">
        <VenteFormClient
          clients={clientOptions}
          vagues={vagueOptions}
        />
      </div>
    </>
  );
}
