import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { LotAlevinsDetailClient } from "@/components/alevins/lot-detail-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getLotAlevinsById } from "@/lib/queries/lots-alevins";
import { getBacs } from "@/lib/queries/bacs";
import { Permission } from "@/types";

export default async function LotAlevinsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const [lot, bacs] = await Promise.all([
    getLotAlevinsById(id, session.activeSiteId),
    getBacs(session.activeSiteId),
  ]);

  if (!lot) notFound();

  // Bacs libres (sans vague assignee)
  const bacsLibres = bacs
    .filter((b) => b.vagueId === null)
    .map((b) => ({ id: b.id, nom: b.nom }));

  return (
    <>
      <Header title={lot.code} />
      <div className="p-4">
        <LotAlevinsDetailClient
          lot={JSON.parse(JSON.stringify(lot))}
          bacsLibres={bacsLibres}
          permissions={permissions}

        />
      </div>
    </>
  );
}
