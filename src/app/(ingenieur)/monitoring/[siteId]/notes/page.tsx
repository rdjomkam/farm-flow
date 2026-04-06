import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { AccessDenied } from "@/components/ui/access-denied";
import { Button } from "@/components/ui/button";
import { NouvelleNoteDialog } from "@/components/ingenieur/nouvelle-note-dialog";
import { NotesList } from "@/components/notes/notes-list";
import { getServerSession, checkPagePermission } from "@/lib/auth";
import { getClientIngenieurDetail } from "@/lib/queries/ingenieur";
import { getNotes } from "@/lib/queries/notes";
import { Permission, StatutVague } from "@/types";
import { prisma } from "@/lib/db";

export default async function IngenieurClientNotesPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  const permissions = await checkPagePermission(session, Permission.MONITORING_CLIENTS);
  if (!permissions) return <AccessDenied />;

  const { siteId: clientSiteId } = await params;

  const clientSummary = await getClientIngenieurDetail(session.activeSiteId, clientSiteId);
  if (!clientSummary) notFound();

  const notes = await getNotes(session.activeSiteId, { clientSiteId });

  const vagues = await prisma.vague.findMany({
    where: { siteId: clientSiteId, statut: StatutVague.EN_COURS },
    select: { id: true, code: true },
  });

  const notesSerialized = JSON.parse(JSON.stringify(notes));
  const vaguesPourNotes = vagues.map((v) => ({ id: v.id, code: v.code }));
  const t = await getTranslations("ingenieur.monitoring");

  return (
    <>
      <Header title={`Notes — ${clientSummary.siteName}`}>
        <Link href={`/monitoring/${clientSiteId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">{t("back")}</span>
          </Button>
        </Link>
      </Header>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("allNotes")}</h2>
          <NouvelleNoteDialog
            siteId={session.activeSiteId}
            clientSiteId={clientSiteId}
            vagues={vaguesPourNotes}
          />
        </div>

        <NotesList notes={notesSerialized} isClientView={false} />

        <div className="pb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/monitoring/${clientSiteId}`}>
              <ArrowLeft className="h-4 w-4" />
              {t("back")}
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
