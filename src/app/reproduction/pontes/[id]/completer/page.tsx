import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PonteCompleterClient } from "@/components/reproduction/ponte-completer-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getPonteById } from "@/lib/queries/pontes";
import { Permission, StatutPonte } from "@/types";

export default async function ReproductionPonteCompleterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.PONTES_GERER);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const { step: stepParam } = await searchParams;

  const ponte = await getPonteById(id, session.activeSiteId);
  if (!ponte) notFound();

  // Uniquement les pontes EN_COURS peuvent etre completees
  if (ponte.statut !== StatutPonte.EN_COURS) {
    redirect(`/reproduction/pontes/${id}`);
  }

  // Valider le step (1, 2 ou 3 ; defaut 1)
  const rawStep = parseInt(stepParam ?? "1", 10);
  const initialStep = (rawStep === 1 || rawStep === 2 || rawStep === 3
    ? rawStep
    : 1) as 1 | 2 | 3;

  return (
    <>
      <Header title={ponte.code} />
      <div className="p-4">
        <PonteCompleterClient
          ponte={JSON.parse(JSON.stringify(ponte))}
          initialStep={initialStep}
        />
      </div>
    </>
  );
}
