import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/ui/access-denied";
import { CalibrageFormClient } from "@/components/calibrage/calibrage-form-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagueById } from "@/lib/queries/vagues";
import { Permission, StatutVague } from "@/types";
import type { BacResponse } from "@/types";

export default async function NouveauCalibragePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.CALIBRAGES_CREER
  );
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const vague = await getVagueById(id, session.activeSiteId);

  if (!vague) notFound();

  if (vague.statut !== StatutVague.EN_COURS) {
    redirect(`/vagues/${id}`);
  }

  const bacs: BacResponse[] = vague.bacs.map((b) => ({
    id: b.id,
    nom: b.nom,
    volume: b.volume ?? 0,
    nombrePoissons: b.nombrePoissons ?? 0,
    nombreInitial: b.nombreInitial ?? null,
    poidsMoyenInitial: b.poidsMoyenInitial ?? null,
    vagueId: b.vagueId ?? null,
    siteId: b.siteId,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    vagueCode: vague.code,
  }));

  return (
    <>
      <Header title="Nouveau calibrage" />
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/vagues/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              {vague.code}
            </Link>
          </Button>
        </div>
        <CalibrageFormClient vagueId={id} bacs={bacs} />
      </div>
    </>
  );
}
