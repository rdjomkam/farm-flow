import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getListeBesoinsById } from "@/lib/queries/besoins";
import { Permission, StatutBesoins } from "@/types";
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
  const hasRetroPerm = permissions.includes(Permission.BESOINS_MODIFIER_RETRO);
  const statut = listeBesoins.statut as StatutBesoins;

  // canEdit :
  //  - SOUMISE : demandeur OU approbateur avec BESOINS_SOUMETTRE
  //  - APPROUVEE / TRAITEE / CLOTUREE : requiert BESOINS_MODIFIER_RETRO
  //  - REJETEE : jamais
  const canEditSoumise =
    statut === StatutBesoins.SOUMISE &&
    permissions.includes(Permission.BESOINS_SOUMETTRE) &&
    (listeBesoins.demandeurId === session.userId || canApprove);
  const canEditRetro =
    statut !== StatutBesoins.SOUMISE &&
    statut !== StatutBesoins.REJETEE &&
    hasRetroPerm;
  const canEdit = canEditSoumise || canEditRetro;

  return (
    <>
      <Header title={listeBesoins.numero} />
      <BesoinsDetailClient
        listeBesoins={JSON.parse(JSON.stringify(listeBesoins))}
        canApprove={canApprove}
        canProcess={canProcess}
        canEdit={canEdit}
        canEditRetro={canEditRetro}
      />
    </>
  );
}
