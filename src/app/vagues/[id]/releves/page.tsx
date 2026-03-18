import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/ui/access-denied";
import { RelevesList } from "@/components/vagues/releves-list";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagueById } from "@/lib/queries/vagues";
import { prisma } from "@/lib/db";
import { Permission, CategorieProduit, StatutVague } from "@/types";
import type { Releve } from "@/types";
import type { ProduitOption } from "@/components/releves/consommation-fields";

export default async function VagueRelevesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.VAGUES_VOIR);
  if (!permissions) return <AccessDenied />;

  const { id } = await params;
  const [vague, produitsDb] = await Promise.all([
    getVagueById(id, session.activeSiteId),
    prisma.produit.findMany({
      where: {
        siteId: session.activeSiteId,
        isActive: true,
        categorie: { in: [CategorieProduit.ALIMENT, CategorieProduit.INTRANT] },
      },
      select: { id: true, nom: true, categorie: true, unite: true, stockActuel: true },
      orderBy: { nom: "asc" },
    }),
  ]);

  if (!vague) notFound();

  const isEnCours = vague.statut === StatutVague.EN_COURS;

  return (
    <>
      <Header title={`Relevés — ${vague.code}`} />

      <div className="flex flex-col gap-4 p-4">
        {isEnCours && permissions.includes(Permission.RELEVES_CREER) && (
          <div className="flex justify-end">
            <Button size="sm" asChild>
              <Link href={`/releves/nouveau?vagueId=${id}`}>
                <PlusCircle className="h-4 w-4" />
                Nouveau
              </Link>
            </Button>
          </div>
        )}

        <RelevesList
          releves={vague.releves as Releve[]}
          produits={produitsDb.map((p) => ({
            id: p.id,
            nom: p.nom,
            categorie: p.categorie,
            unite: p.unite,
            stockActuel: p.stockActuel,
          } satisfies ProduitOption))}
          permissions={permissions}
        />

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
