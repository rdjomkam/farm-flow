import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Container } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BacAssignationHistory } from "@/components/bacs/bac-assignation-history";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getBacWithAssignations } from "@/lib/queries/bacs";
import { Permission, StatutVague } from "@/types";
import type { AssignationBacWithVague } from "@/types";
import { AccessDenied } from "@/components/ui/access-denied";

/**
 * Page de détail d'un bac — affiche les informations du bac et son historique
 * d'assignations à des vagues (ADR-043, Phase 2).
 */
export default async function BacDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.BACS_GERER);
  if (!permissions) return <AccessDenied />;

  const t = await getTranslations("bacs.detail");

  const { id } = await params;
  const bac = await getBacWithAssignations(id, session.activeSiteId);

  if (!bac) notFound();

  const isOccupe = bac.vagueId !== null || bac.assignations.some((a) => a.dateFin === null);

  return (
    <>
      <Header title={bac.nom} />

      <div className="flex flex-col gap-4 p-4">
        {/* Retour vers la liste des bacs */}
        <Button variant="ghost" size="sm" className="self-start -ml-2" asChild>
          <Link href="/bacs">
            <ArrowLeft className="h-4 w-4" />
            {t("retourBacs")}
          </Link>
        </Button>

        {/* Info bac */}
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Container className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold">{bac.nom}</h1>
                {isOccupe ? (
                  <Badge variant="warning">{t("occupe")}</Badge>
                ) : (
                  <Badge variant="info">{t("libre")}</Badge>
                )}
              </div>
              {bac.volume != null && (
                <p className="text-sm text-muted-foreground mt-0.5">{t("volume", { volume: bac.volume })}</p>
              )}
              {bac.typeSysteme && (
                <p className="text-sm text-muted-foreground">{t("type", { type: bac.typeSysteme })}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Historique des assignations */}
        <section>
          <h2 className="text-base font-semibold mb-3">
            {t("historiqueTitle")}
            {bac.assignations.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({bac.assignations.length})
              </span>
            )}
          </h2>
          <BacAssignationHistory
            assignations={bac.assignations.map((a) => ({
              id: a.id,
              bacId: a.bacId,
              vagueId: a.vagueId,
              siteId: a.siteId,
              dateAssignation: a.dateAssignation,
              dateFin: a.dateFin,
              nombrePoissonsInitial: a.nombrePoissonsInitial,
              poidsMoyenInitial: a.poidsMoyenInitial,
              nombrePoissons: a.nombrePoissons,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
              vague: {
                id: a.vague.id,
                code: a.vague.code,
                statut: a.vague.statut as StatutVague,
              },
            } satisfies AssignationBacWithVague))}
          />
        </section>
      </div>
    </>
  );
}
