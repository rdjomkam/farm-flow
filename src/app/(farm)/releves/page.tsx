import { redirect } from "next/navigation";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/ui/access-denied";
import { RelevesGlobalList } from "@/components/releves/releves-global-list";
import { ReleveFilterBar } from "@/components/releves/releves-filter-bar";
import { RelevesActiveFilters } from "@/components/releves/releves-active-filters";
import { PaginationFooter } from "@/components/releves/pagination-footer";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getReleves } from "@/lib/queries/releves";
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

  // Convertir en ReleveSearchParams (valeurs simples uniquement — inclut les nouveaux filtres specifiques)
  const current: ReleveSearchParams = {
    vagueId: typeof rawParams.vagueId === "string" ? rawParams.vagueId : undefined,
    bacId: typeof rawParams.bacId === "string" ? rawParams.bacId : undefined,
    typeReleve: typeof rawParams.typeReleve === "string" ? rawParams.typeReleve : undefined,
    dateFrom: typeof rawParams.dateFrom === "string" ? rawParams.dateFrom : undefined,
    dateTo: typeof rawParams.dateTo === "string" ? rawParams.dateTo : undefined,
    modifie: typeof rawParams.modifie === "string" ? rawParams.modifie : undefined,
    offset: typeof rawParams.offset === "string" ? rawParams.offset : undefined,
    // Filtres specifiques BIOMETRIE
    poidsMoyenMin: typeof rawParams.poidsMoyenMin === "string" ? rawParams.poidsMoyenMin : undefined,
    poidsMoyenMax: typeof rawParams.poidsMoyenMax === "string" ? rawParams.poidsMoyenMax : undefined,
    tailleMoyenneMin: typeof rawParams.tailleMoyenneMin === "string" ? rawParams.tailleMoyenneMin : undefined,
    tailleMoyenneMax: typeof rawParams.tailleMoyenneMax === "string" ? rawParams.tailleMoyenneMax : undefined,
    // Filtres specifiques MORTALITE
    causeMortalite: typeof rawParams.causeMortalite === "string" ? rawParams.causeMortalite : undefined,
    nombreMortsMin: typeof rawParams.nombreMortsMin === "string" ? rawParams.nombreMortsMin : undefined,
    nombreMortsMax: typeof rawParams.nombreMortsMax === "string" ? rawParams.nombreMortsMax : undefined,
    // Filtres specifiques ALIMENTATION
    produitId: typeof rawParams.produitId === "string" ? rawParams.produitId : undefined,
    typeAliment: typeof rawParams.typeAliment === "string" ? rawParams.typeAliment : undefined,
    comportementAlim: typeof rawParams.comportementAlim === "string" ? rawParams.comportementAlim : undefined,
    frequenceAlimentMin: typeof rawParams.frequenceAlimentMin === "string" ? rawParams.frequenceAlimentMin : undefined,
    frequenceAlimentMax: typeof rawParams.frequenceAlimentMax === "string" ? rawParams.frequenceAlimentMax : undefined,
    // Filtres specifiques QUALITE_EAU
    temperatureMin: typeof rawParams.temperatureMin === "string" ? rawParams.temperatureMin : undefined,
    temperatureMax: typeof rawParams.temperatureMax === "string" ? rawParams.temperatureMax : undefined,
    phMin: typeof rawParams.phMin === "string" ? rawParams.phMin : undefined,
    phMax: typeof rawParams.phMax === "string" ? rawParams.phMax : undefined,
    // Filtres specifiques COMPTAGE
    methodeComptage: typeof rawParams.methodeComptage === "string" ? rawParams.methodeComptage : undefined,
    // Filtres specifiques OBSERVATION
    descriptionSearch: typeof rawParams.descriptionSearch === "string" ? rawParams.descriptionSearch : undefined,
    // Filtres specifiques RENOUVELLEMENT
    pourcentageMin: typeof rawParams.pourcentageMin === "string" ? rawParams.pourcentageMin : undefined,
    pourcentageMax: typeof rawParams.pourcentageMax === "string" ? rawParams.pourcentageMax : undefined,
  };

  const parsed = parseReleveSearchParams(current);

  // Charger en parallele : vagues (pour le selecteur) + releves + produits + chips labels
  const [vaguesRaw, releveData, produitsDb, vagueForChip, bacForChip, produitForChip] = await Promise.all([
    // Vagues EN_COURS pour le selecteur de filtre
    prisma.vague.findMany({
      where: { siteId, statut: StatutVague.EN_COURS },
      select: { id: true, code: true, statut: true },
      orderBy: { dateDebut: "desc" },
      take: 50,
    }),
    // Releves via getReleves() qui supporte tous les filtres (ADR-038 B)
    getReleves(siteId, parsed, { limit: parsed.limit, offset: parsed.offset }),
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
    // Nom produit pour le chip de filtre actif
    current.produitId
      ? prisma.produit.findUnique({
          where: { id: current.produitId },
          select: { nom: true },
        })
      : Promise.resolve(null),
  ]);

  const { data: releves, total } = releveData;

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
          produitNom={produitForChip?.nom}
        />

        {/* Compteur de resultats */}
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "Aucun relevé trouvé"
            : total === 1
            ? "1 relevé trouvé"
            : `${total} relevés trouvés`}
        </p>

        {/* Liste des releves — carte blanche */}
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

        {/* Pagination — HORS de la carte blanche, avec marge */}
        <div className="mt-4 px-1">
          <PaginationFooter
            total={total}
            offset={parsed.offset}
            limit={parsed.limit}
          />
        </div>
      </div>
    </>
  );
}
