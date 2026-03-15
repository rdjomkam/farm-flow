import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PackActiverClient } from "@/components/packs/pack-activer-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { AccessDenied } from "@/components/ui/access-denied";
import { getPackById } from "@/lib/queries/packs";
import { Permission } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PackActiverPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  const permissions = await checkPagePermission(session, Permission.ACTIVER_PACKS);
  if (!permissions) return <AccessDenied />;

  const pack = await getPackById(id, session.activeSiteId);
  if (!pack) notFound();
  if (!pack.isActive) {
    redirect(`/packs/${id}`);
  }

  return (
    <>
      <Header title={`Activer — ${pack.nom}`} />
      <div className="p-4">
        <PackActiverClient
          pack={JSON.parse(JSON.stringify(pack))}
        />
      </div>
    </>
  );
}
