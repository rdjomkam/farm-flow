import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getListeBesoins } from "@/lib/queries/besoins";
import { Permission } from "@/types";
import { BesoinsListClient } from "@/components/besoins/besoins-list-client";

export default async function BesoinsPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
    const permissions = await checkPagePermission(
      session,
      Permission.BESOINS_SOUMETTRE
    );
    if (!permissions) return <AccessDenied />;

    const listesBesoins = await getListeBesoins(session.activeSiteId);

    const canCreate = permissions.includes(Permission.BESOINS_SOUMETTRE);
    const canApprove = permissions.includes(Permission.BESOINS_APPROUVER);
    const canProcess = permissions.includes(Permission.BESOINS_TRAITER);

    return (
      <>
        <Header title="Listes de Besoins" />
        <BesoinsListClient
          listesBesoins={JSON.parse(JSON.stringify(listesBesoins.data))}
          canCreate={canCreate}
          canApprove={canApprove}
          canProcess={canProcess}
        />
      </>
    );
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[BesoinsPage]", error);
    throw error;
  }
}
