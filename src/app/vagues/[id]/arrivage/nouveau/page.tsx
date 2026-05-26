import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/ui/access-denied";
import { ArrivageFormClient } from "@/components/arrivages/arrivage-form-client";
import type { BacDisponibleInfo } from "@/components/arrivages/arrivage-form-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagueById } from "@/lib/queries/vagues";
import { prisma } from "@/lib/db";
import { Permission, StatutVague, TypeVague } from "@/types";

export default async function NouvelArrivagedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const hasPermission = await checkPagePermission(session, Permission.VAGUES_CREER);
  if (!hasPermission) return <AccessDenied />;

  const { id } = await params;
  const vague = await getVagueById(id, session.activeSiteId);

  if (!vague) notFound();

  // Guard: la vague doit être de type PRE_GROSSISSEMENT et en cours
  if (vague.type !== TypeVague.PRE_GROSSISSEMENT || vague.statut !== StatutVague.EN_COURS) {
    redirect(`/vagues/${id}`);
  }

  const t = await getTranslations("arrivages");

  // Bacs disponibles = bacs déjà assignés à cette vague + bacs libres (sans assignation active)
  // Exclure les bacs assignés à UNE AUTRE vague (conflit)
  const [bacsDejaAssignes, bacsLibres] = await Promise.all([
    // Bacs déjà dans cette vague (assignation active)
    prisma.bac.findMany({
      where: {
        siteId: session.activeSiteId,
        assignations: { some: { vagueId: id, dateFin: null } },
      },
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    }),
    // Bacs libres (aucune assignation active du tout)
    prisma.bac.findMany({
      where: {
        siteId: session.activeSiteId,
        assignations: { none: { dateFin: null } },
      },
      select: { id: true, nom: true },
      orderBy: { nom: "asc" },
    }),
  ]);

  const bacsDisponibles: BacDisponibleInfo[] = [
    ...bacsDejaAssignes.map((b) => ({ id: b.id, nom: b.nom, dejaAssigne: true })),
    ...bacsLibres.map((b) => ({ id: b.id, nom: b.nom, dejaAssigne: false })),
  ];

  return (
    <>
      <Header title={t("page.title")} />
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/vagues/${id}`}>
              <ArrowLeft className="h-4 w-4" />
              {vague.code}
            </Link>
          </Button>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">{t("page.subtitle")}</p>
        </div>

        <ArrivageFormClient
          vagueId={id}
          vagueCode={vague.code}
          bacsDisponibles={bacsDisponibles}
        />
      </div>
    </>
  );
}
