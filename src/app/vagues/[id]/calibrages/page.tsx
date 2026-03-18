import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Scissors } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/ui/access-denied";
import { CalibragesList } from "@/components/calibrage/calibrages-list";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagueById } from "@/lib/queries/vagues";
import { getCalibrages } from "@/lib/queries/calibrages";
import { Permission, StatutVague } from "@/types";
import type { CalibrageWithRelations } from "@/types";

export default async function VagueCalibragesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.CALIBRAGES_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const [vague, calibrages] = await Promise.all([
    getVagueById(id, session.activeSiteId),
    getCalibrages(session.activeSiteId, { vagueId: id }),
  ]);

  if (!vague) notFound();

  const isEnCours = vague.statut === StatutVague.EN_COURS;

  return (
    <>
      <Header title={`Calibrages — ${vague.code}`} />

      <div className="flex flex-col gap-4 p-4">
        {isEnCours && permissions.includes(Permission.CALIBRAGES_CREER) && (
          <div className="flex justify-end">
            <Button size="sm" asChild>
              <Link href={`/vagues/${id}/calibrage/nouveau`}>
                <Scissors className="h-4 w-4" />
                Nouveau
              </Link>
            </Button>
          </div>
        )}

        <CalibragesList calibrages={calibrages as CalibrageWithRelations[]} />

        <div className="pb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/vagues/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              Retour à la vague
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
