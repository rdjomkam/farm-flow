import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { GeniteurDetailClient } from "@/components/reproduction/geniteur-detail-client";
import { AccessDenied } from "@/components/ui/access-denied";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import {
  getLotGeniteursById,
  getReproducteurById,
} from "@/lib/queries/geniteurs";
import { Permission } from "@/types";

export default async function GeniteurDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.ALEVINS_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const sp = await searchParams;
  const mode = sp.mode ?? "GROUPE";

  let geniteur: Record<string, unknown> | null = null;
  let resolvedMode: "GROUPE" | "INDIVIDUEL" = "GROUPE";

  if (mode === "INDIVIDUEL") {
    const rep = await getReproducteurById(id, session.activeSiteId);
    if (rep) {
      geniteur = rep as unknown as Record<string, unknown>;
      resolvedMode = "INDIVIDUEL";
    }
  } else {
    // Défaut GROUPE — essayer LotGeniteurs d'abord, sinon Reproducteur
    const lot = await getLotGeniteursById(id, session.activeSiteId);
    if (lot) {
      geniteur = lot as unknown as Record<string, unknown>;
      resolvedMode = "GROUPE";
    } else {
      const rep = await getReproducteurById(id, session.activeSiteId);
      if (rep) {
        geniteur = rep as unknown as Record<string, unknown>;
        resolvedMode = "INDIVIDUEL";
      }
    }
  }

  if (!geniteur) notFound();

  const title =
    resolvedMode === "GROUPE"
      ? ((geniteur.nom as string) ?? (geniteur.code as string))
      : (geniteur.code as string);

  return (
    <>
      <Header title={title} />
      <div className="p-4">
        <GeniteurDetailClient
          geniteur={JSON.parse(JSON.stringify(geniteur))}
          mode={resolvedMode}
          permissions={permissions}
        />
      </div>
    </>
  );
}
