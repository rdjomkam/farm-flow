import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/ui/access-denied";
import { RelevesGlobalList } from "@/components/releves/releves-global-list";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagueByIdWithReleves } from "@/lib/queries/vagues";
import { prisma } from "@/lib/db";
import { Permission, CategorieProduit, StatutVague } from "@/types";
import type { ProduitOption } from "@/components/releves/consommation-fields";
import { RELEVES_PAGE_LIMIT } from "@/lib/releve-search-params";

export default async function VagueRelevesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
    const permissions = await checkPagePermission(session, Permission.VAGUES_VOIR);
    if (!permissions) return <AccessDenied />;

    const t = await getTranslations("releves");
    const tVagues = await getTranslations("vagues");

    const { id } = await params;
    const resolvedSearchParams = await searchParams;

    // Lire l'offset depuis les searchParams (pagination URL)
    const offsetRaw = resolvedSearchParams?.offset;
    const offset = Math.max(
      0,
      parseInt(Array.isArray(offsetRaw) ? offsetRaw[0] : (offsetRaw ?? "0"), 10) || 0
    );
    const limit = RELEVES_PAGE_LIMIT;

    const [result, produitsDb] = await Promise.all([
      getVagueByIdWithReleves(id, session.activeSiteId, { limit, offset }),
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

    if (!result) notFound();

    const { vague, releves, total } = result;
    const isEnCours = vague.statut === StatutVague.EN_COURS;

    return (
      <>
        <Header title={`${t("list.title", { count: total })} — ${vague.code}`} />

        <div className="flex flex-col gap-4 p-4">
          {isEnCours && permissions.includes(Permission.RELEVES_CREER) && (
            <div className="flex justify-end">
              <Button size="sm" asChild>
                <Link href={`/releves/nouveau?vagueId=${id}`}>
                  <PlusCircle className="h-4 w-4" />
                  {t("page.nouveau_btn")}
                </Link>
              </Button>
            </div>
          )}

          <RelevesGlobalList
            releves={releves}
            total={total}
            offset={offset}
            limit={limit}
            permissions={permissions}
            produits={produitsDb.map((p) => ({
              id: p.id,
              nom: p.nom,
              categorie: p.categorie,
              unite: p.unite,
              stockActuel: p.stockActuel,
            } satisfies ProduitOption))}
          />

          <div className="pb-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/vagues/${id}`}>
                <ArrowLeft className="h-4 w-4" />
                {tVagues("detail.retourVagues")}
              </Link>
            </Button>
          </div>
        </div>
      </>
    );
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[VagueRelevesPage]", error);
    throw error;
  }
}
