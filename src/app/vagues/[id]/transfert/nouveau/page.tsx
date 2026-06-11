import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { AccessDenied } from "@/components/ui/access-denied";
import { TransfertFormClient } from "@/components/transferts/transfert-form-client";
import type { BacSourceInfo, BacDestInfo, VagueDestInfo, UniteProductionOption, BacsParVague } from "@/components/transferts/transfert-form-client";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getVagueById } from "@/lib/queries/vagues";
import { getBacsLibres } from "@/lib/queries/bacs";
import { getUnitesProduction } from "@/lib/queries/unites-production";
import { prisma } from "@/lib/db";
import { computeVivantsByBac } from "@/lib/calculs";
import { Permission, StatutVague, TypeVague } from "@/types";

export default async function NouveauTransfertPage({
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

  // Guard: la vague source doit être de type PRE_GROSSISSEMENT et en cours
  if (vague.type !== TypeVague.PRE_GROSSISSEMENT || vague.statut !== StatutVague.EN_COURS) {
    redirect(`/vagues/${id}`);
  }

  const t = await getTranslations("transferts");

  // Calculer les vivants par bac via les relevés (source de vérité)
  const relevesForVivants = await prisma.releve.findMany({
    where: { vagueId: id, siteId: session.activeSiteId },
    orderBy: { date: "asc" },
    select: {
      typeReleve: true,
      date: true,
      nombreMorts: true,
      nombreVendus: true,
      nombreTransferes: true,
      nombreCompte: true,
      bacId: true,
    },
  });
  const vivantsByBac = computeVivantsByBac(
    vague.bacs,
    relevesForVivants,
    vague.nombreInitial
  );

  // Construire la liste des bacs source avec vivants et poids moyen estimé
  const bacsSource: BacSourceInfo[] = vague.bacs.map((b) => ({
    id: b.id,
    nom: b.nom,
    vivants: vivantsByBac.get(b.id) ?? b.nombrePoissons ?? 0,
    poidsMoyenG: b.poidsMoyenInitial ?? 0,
  }));

  // Vagues GROSSISSEMENT EN_COURS du même site (pour mode B)
  const vaguesGrossissementRaw = await prisma.vague.findMany({
    where: {
      siteId: session.activeSiteId,
      type: TypeVague.GROSSISSEMENT,
      statut: StatutVague.EN_COURS,
      // Exclure la vague source (même si elle était GROSSISSEMENT, par sécurité)
      NOT: { id },
    },
    select: {
      id: true,
      code: true,
      nombreInitial: true,
      poidsMoyenInitial: true,
    },
    orderBy: { dateDebut: "desc" },
  });

  const vaguesGrossissementEnCours: VagueDestInfo[] = vaguesGrossissementRaw.map((v) => ({
    id: v.id,
    code: v.code,
    nombreInitial: v.nombreInitial ?? 0,
    poidsMoyenInitial: v.poidsMoyenInitial ?? 0,
  }));

  // Bacs libres (non assignés) pour le mode A
  const bacsLibresRaw = await getBacsLibres(session.activeSiteId);
  const bacsLibres: BacDestInfo[] = bacsLibresRaw.map((b) => ({
    id: b.id,
    nom: b.nom,
  }));

  // Unités de production actives du site
  const unitesRaw = await getUnitesProduction(session.activeSiteId, { isActive: true });
  const unitesProduction: UniteProductionOption[] = unitesRaw.map((u) => ({
    id: u.id,
    code: u.code,
    nom: u.nom,
  }));

  // Bacs déjà assignés aux vagues grossissement (pour mode B)
  // On charge toutes les AssignationBac actives (dateFin = null) des vagues dest candidates
  const vagueDestIds = vaguesGrossissementEnCours.map((v) => v.id);
  const bacsParVague: BacsParVague = {};
  if (vagueDestIds.length > 0) {
    const assignationsDestRaw = await prisma.assignationBac.findMany({
      where: {
        vagueId: { in: vagueDestIds },
        siteId: session.activeSiteId,
        dateFin: null,
      },
      select: {
        vagueId: true,
        bac: { select: { id: true, nom: true } },
      },
    });
    for (const a of assignationsDestRaw) {
      if (!bacsParVague[a.vagueId]) bacsParVague[a.vagueId] = [];
      bacsParVague[a.vagueId].push({ id: a.bac.id, nom: a.bac.nom });
    }
  }

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

        <TransfertFormClient
          vagueSourceId={id}
          vagueSourceCode={vague.code}
          bacsSource={bacsSource}
          vaguesGrossissementEnCours={vaguesGrossissementEnCours}
          unitesProduction={unitesProduction}
          bacsLibres={bacsLibres}
          bacsParVague={bacsParVague}
        />
      </div>
    </>
  );
}
