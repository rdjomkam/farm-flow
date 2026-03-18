import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getDepenseById } from "@/lib/queries/depenses";
import { Permission } from "@/types";
import { DepenseDetailClient } from "@/components/depenses/depense-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DepensePage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.DEPENSES_VOIR
  );
  if (!permissions) return <AccessDenied />;

  const depense = await getDepenseById(id, session.activeSiteId);
  if (!depense) notFound();

  const canManage = permissions.includes(Permission.DEPENSES_CREER);
  const canPay = permissions.includes(Permission.DEPENSES_PAYER);

  return (
    <>
      <Header title={depense.numero} />
      <DepenseDetailClient
        depense={JSON.parse(JSON.stringify(depense))}
        canManage={canManage}
        canPay={canPay}
      />
    </>
  );
}
