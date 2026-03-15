import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getDepenses } from "@/lib/queries/depenses";
import { Permission } from "@/types";
import { DepensesListClient } from "@/components/depenses/depenses-list-client";

export default async function DepensesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.DEPENSES_VOIR
  );
  if (!permissions) return <AccessDenied />;

  const depenses = await getDepenses(session.activeSiteId);

  const canManage = permissions.includes(Permission.DEPENSES_CREER);
  const canPay = permissions.includes(Permission.DEPENSES_PAYER);

  return (
    <>
      <Header title="Depenses" />
      <DepensesListClient
        depenses={JSON.parse(JSON.stringify(depenses))}
        canManage={canManage}
        canPay={canPay}
      />
    </>
  );
}
