import { redirect } from "next/navigation";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/ui/access-denied";
import { RelevesGlobalList } from "@/components/releves/releves-global-list";
import { ReleveFilterBar } from "@/components/releves/releves-filter-bar";
import { RelevesActiveFilters } from "@/components/releves/releves-active-filters";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseReleveSearchParams } from "@/lib/releve-search-params";
import { StatutVague, Permission, CategorieProduit } from "@/types";
import type { Releve } from "@/types";
import type { ProduitOption } from "@/components/releves/consommation-fields";
import type { ReleveSearchParams } from "@/lib/releve-search-params";

export default async function RelevesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.RELEVES_VOIR);
  if (!permissions) return <AccessDenied />;

  const siteId = session.activeSiteId;

  // Resoudre les searchParams (Next.js 14+ App Router — Promise)
  const rawParams = await searchParams;

  // Convertir en ReleveSearchParams (valeurs simples uniquement)
  const current: ReleveSearchParams = {
    vagueId: typeof rawParams.vagueId === "string" ? rawParams.vagueId : undefined,
    bacId: typeof rawParams.bacId === "string" ? rawParams.bacId : undefined,
    typeReleve: typeof rawParams.typeReleve === "string" ? rawParams.typeReleve : undefined,
    dateFrom: typeof rawParams.dateFrom === "string" ? rawParams.dateFrom : undefined,
    dateTo: typeof rawParams.dateTo === "string" ? rawParams.dateTo : undefined,
    modifie: typeof rawParams.modifie === "string" ? rawParams.modifie : undefined,
    offset: typeof rawParams.offset === "string" ? rawParams.offset : undefined,
  };

  const parsed = parseReleveSearchParams(current);

  // Construire les filtres Prisma
  const where: Record<string, unknown> = { siteId };
  if (parsed.vagueId) where.vagueId = parsed.vagueId;
  if (parsed.bacId) where.bacId = parsed.bacId;
  if (parsed.typeReleve) where.typeReleve = parsed.typeReleve;
  if (parsed.dateFrom || parsed.dateTo) {
    where.date = {
      ...(parsed.dateFrom && { gte: new Date(parsed.dateFrom) }),
      ...(parsed.dateTo && { lte: new Date(parsed.dateTo) }),
    };
  }
  if (parsed.modifie) {
    where.modifie = true;
  }

  // Charger en parallele : vagues (pour le selecteur) + releves (avec relations) + produits
  const [vaguesRaw, releveData, produitsDb, vagueForChip, bacForChip] = await Promise.all([
    // Vagues EN_COURS pour le selecteur de filtre
    prisma.vague.findMany({
      where: { siteId, statut: StatutVague.EN_COURS },
      select: { id: true, code: true, statut: true },
      orderBy: { dateDebut: "desc" },
      take: 50,
    }),
    // Releves avec relations pour affichage
    Promise.all([
      prisma.releve.findMany({
        where,
        orderBy: { date: "desc" },
        take: parsed.limit,
        skip: parsed.offset,
        include: {
          bac: { select: { id: true, nom: true } },
          consommations: {
            include: { produit: true },
          },
          modifications: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { user: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.releve.count({ where }),
    ]),
    // Produits pour le formulaire de modification
    prisma.produit.findMany({
      where: {
        siteId,
        isActive: true,
        categorie: { in: [CategorieProduit.ALIMENT, CategorieProduit.INTRANT] },
      },
      select: { id: true, nom: true, categorie: true, unite: true, stockActuel: true },
      orderBy: { nom: "asc" },
    }),
    // Code vague pour le chip de filtre actif
    parsed.vagueId
      ? prisma.vague.findFirst({
          where: { id: parsed.vagueId, siteId },
          select: { code: true },
        })
      : Promise.resolve(null),
    // Nom bac pour le chip de filtre actif
    parsed.bacId
      ? prisma.bac.findFirst({
          where: { id: parsed.bacId, siteId },
          select: { nom: true },
        })
      : Promise.resolve(null),
  ]);

  const [releves, total] = releveData;

  const vagues = vaguesRaw.map((v) => ({
    id: v.id,
    code: v.code,
    statut: v.statut as StatutVague,
  }));

  const produits: ProduitOption[] = produitsDb.map((p) => ({
    id: p.id,
    nom: p.nom,
    categorie: p.categorie,
    unite: p.unite,
    stockActuel: p.stockActuel,
  }));

  const canCreate = permissions.includes(Permission.RELEVES_CREER);

  return (
    <>
      <Header title="Tous les relevés" />

      <div className="flex flex-col gap-4 p-4 pb-20">
        {/* Barre d'actions : filtres + bouton nouveau */}
        <div className="flex items-center justify-between gap-3">
          <ReleveFilterBar current={current} vagues={vagues} />
          {canCreate && (
            <Button size="sm" asChild className="shrink-0">
              <Link href="/releves/nouveau">
                <PlusCircle className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Nouveau</span>
              </Link>
            </Button>
          )}
        </div>

        {/* Chips des filtres actifs */}
        <RelevesActiveFilters
          current={current}
          vagueCode={vagueForChip?.code}
          bacNom={bacForChip?.nom}
        />

        {/* Compteur de resultats */}
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "Aucun relevé trouvé"
            : total === 1
            ? "1 relevé trouvé"
            : `${total} relevés trouvés`}
        </p>

        {/* Liste des releves */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <RelevesGlobalList
            releves={releves as unknown as Releve[]}
            total={total}
            offset={parsed.offset}
            limit={parsed.limit}
            permissions={permissions}
            produits={produits}
          />
        </div>
      </div>
    </>
  );
}
