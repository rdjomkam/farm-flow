import { redirect } from "next/navigation";
import { DollarSign } from "lucide-react";
import { Header } from "@/components/layout/header";
import { FinancesDashboardClient } from "@/components/finances/finances-dashboard-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import {
  getResumeFinancier,
  getRentabiliteParVague,
  getEvolutionFinanciere,
  getTopClients,
  genererDepensesRecurrentes,
} from "@/lib/queries";
import { Permission } from "@/types";

export default async function FinancesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.FINANCES_VOIR);
  if (!permissions) return <AccessDenied />;

  const siteId = session.activeSiteId;

  // Lazy generation: trigger recurring expenses before loading financial data.
  // Errors are silenced — generation failure must not break the dashboard.
  await genererDepensesRecurrentes(siteId, session.userId).catch(() => null);

  const [resume, parVague, evolution, topClients] = await Promise.all([
    getResumeFinancier(siteId),
    getRentabiliteParVague(siteId),
    getEvolutionFinanciere(siteId, 12),
    getTopClients(siteId, 5),
  ]);

  return (
    <>
      <Header title="Finances">
        <DollarSign className="h-5 w-5 text-muted-foreground" />
      </Header>
      <div className="p-4">
        <FinancesDashboardClient
          resume={resume}
          parVague={parVague}
          evolution={evolution}
          topClients={topClients}
        />
      </div>
    </>
  );
}
