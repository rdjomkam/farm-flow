import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PonteDetailClient } from "@/components/alevins/ponte-detail-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getPonteById } from "@/lib/queries/pontes";
import { getReproducteurs } from "@/lib/queries/reproducteurs";
import { SexeReproducteur, Permission } from "@/types";

export default async function PonteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const [ponte, reproducteursResult] = await Promise.all([
    getPonteById(id, session.activeSiteId),
    getReproducteurs(session.activeSiteId),
  ]);

  if (!ponte) notFound();

  const femelles = reproducteursResult.data
    .filter((r) => r.sexe === SexeReproducteur.FEMELLE)
    .map((r) => ({ id: r.id, code: r.code }));

  const males = reproducteursResult.data
    .filter((r) => r.sexe === SexeReproducteur.MALE)
    .map((r) => ({ id: r.id, code: r.code }));

  return (
    <>
      <Header title={ponte.code} />
      <div className="p-4">
        <PonteDetailClient
          ponte={JSON.parse(JSON.stringify(ponte))}
          femelles={femelles}
          males={males}
          permissions={permissions}
        />
      </div>
    </>
  );
}
