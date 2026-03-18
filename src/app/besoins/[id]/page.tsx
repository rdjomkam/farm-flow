import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getListeBesoinsById } from "@/lib/queries/besoins";
import { Permission } from "@/types";
import { BesoinsDetailClient } from "@/components/besoins/besoins-detail-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BesoinsDetailPage({ params }: Props) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(
    session,
    Permission.BESOINS_SOUMETTRE
  );
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const listeBesoins = await getListeBesoinsById(id, session.activeSiteId);
  if (!listeBesoins) notFound();

  const canApprove = permissions.includes(Permission.BESOINS_APPROUVER);
  const canProcess = permissions.includes(Permission.BESOINS_TRAITER);
  // canEdit : demandeur OU approbateur, seulement si SOUMISE (la logique SOUMISE est dans le composant)
  const canEdit =
    permissions.includes(Permission.BESOINS_SOUMETTRE) &&
    (listeBesoins.demandeurId === session.userId || canApprove);

  return (
    <>
      <Header title={listeBesoins.numero} />
      <BesoinsDetailClient
        listeBesoins={JSON.parse(JSON.stringify(listeBesoins))}
        canApprove={canApprove}
        canProcess={canProcess}
        canEdit={canEdit}
      />
    </>
  );
}
