import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import {LotDetailClient, LotDetailData} from "@/components/reproduction/lot-detail-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getLotById } from "@/lib/queries/lots-alevins";
import { Permission } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReproductionLotDetailPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const lot = await getLotById(id, session.activeSiteId);

  if (!lot) notFound();

  return (
    <>
      <Header title={`${lot.code}`} />
      <div className="p-4">
        <LotDetailClient
          lot={JSON.parse(JSON.stringify(lot))}
          permissions={permissions}
        />
      </div>
    </>
  );
}
