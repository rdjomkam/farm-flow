import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MessageSquare, Bell } from "lucide-react";
import { Header } from "@/components/layout/header";
import { NotesList } from "@/components/notes/notes-list";
import { ObservationDialog } from "@/components/notes/observation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { getServerSession } from "@/lib/auth";
import { getServerSiteModules } from "@/lib/auth/permissions-server";
import { getClientFeed, getNotes } from "@/lib/queries/notes";
import { getVagues } from "@/lib/queries/vagues";
import { SiteModule, StatutVague } from "@/types";
import type { NoteIngenieurWithRelations } from "@/types";

/**
 * Page /notes — Vue adaptee selon le contexte du site.
 *
 * - Site supervise (client) : notes recues de l'ingenieur DKFarm (PUBLIC uniquement).
 * - Site DKFarm (admin/gerant/ingenieur) : apercu de toutes les notes envoyees aux clients.
 * - Mobile first (360px).
 * - Server Component : pas de "use client".
 */
export default async function NotesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/settings/sites");

  try {
    // Determiner si le site est supervise (client) via les modules actifs
    const siteModules = await getServerSiteModules(session.activeSiteId);
    const isSupervisedSite = !siteModules.includes(SiteModule.PACKS_PROVISIONING);

    if (isSupervisedSite) {
      return <ClientNotesView siteId={session.activeSiteId} />;
    }

    return <DKFarmNotesView siteId={session.activeSiteId} />;
  } catch (error: unknown) {
    const digest = error instanceof Error && "digest" in error ? (error as Record<string, unknown>).digest : undefined;
    if (typeof digest === "string" && /^[A-Z_]/.test(digest)) throw error;
    console.error("[NotesPage]", error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Vue client — notes recues
// ---------------------------------------------------------------------------

async function ClientNotesView({ siteId }: { siteId: string }) {
  const [notes, vaguesResult, t] = await Promise.all([
    getClientFeed(siteId),
    getVagues(siteId, { statut: StatutVague.EN_COURS }),
    getTranslations("notes"),
  ]);

  const vagues = vaguesResult.data.map((v) => ({ id: v.id, code: v.code }));

  const unreadCount = notes.filter((n) => !n.isRead && !n.isFromClient).length;
  const urgentCount = notes.filter((n) => n.isUrgent).length;
  const observationCount = notes.filter((n) => n.isFromClient).length;
  const notesJson = JSON.parse(JSON.stringify(notes)) as NoteIngenieurWithRelations[];

  return (
    <>
      <Header title="Echanges">
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <div className="relative" aria-label={`${unreadCount} note${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`}>
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                aria-hidden="true"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </div>
          )}
        </div>
      </Header>

      <div className="flex flex-col gap-4 p-4">
        {(unreadCount > 0 || urgentCount > 0 || observationCount > 0) && (
          <section
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"
            aria-label="Resume des echanges"
          >
            {unreadCount > 0 && (
              <Badge variant="en_cours">
                {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""} note{unreadCount > 1 ? "s" : ""}
              </Badge>
            )}
            {urgentCount > 0 && (
              <Badge variant="annulee" className="flex items-center gap-1">
                <span aria-hidden="true">!</span>
                {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
              </Badge>
            )}
            {observationCount > 0 && (
              <Badge variant="default">
                {observationCount} observation{observationCount > 1 ? "s" : ""}
              </Badge>
            )}
          </section>
        )}

        <ObservationDialog vagues={vagues} />

        {notes.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-7 w-7" />}
            title={t("emptyState.noEchanges")}
            description="Signalez un probleme pour commencer la conversation avec votre ingenieur DKFarm."
          />
        ) : (
          <NotesList notes={notesJson} isClientView={true} />
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Vue DKFarm — notes envoyees aux clients
// ---------------------------------------------------------------------------

async function DKFarmNotesView({ siteId }: { siteId: string }) {
  const t = await getTranslations("notes");
  const notes = await getNotes(siteId);
  const notesJson = JSON.parse(JSON.stringify(notes)) as NoteIngenieurWithRelations[];

  const urgentCount = notes.filter((n) => n.isUrgent).length;
  const unreadByClient = notes.filter((n) => !n.isRead && !n.isFromClient).length;

  return (
    <>
      <Header title="Notes envoyees" />

      <div className="flex flex-col gap-4 p-4">
        {(unreadByClient > 0 || urgentCount > 0) && (
          <section
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"
            aria-label="Resume des notes"
          >
            {unreadByClient > 0 && (
              <Badge variant="en_cours">
                {unreadByClient} non lue{unreadByClient > 1 ? "s" : ""} par les clients
              </Badge>
            )}
            {urgentCount > 0 && (
              <Badge variant="annulee" className="flex items-center gap-1">
                <span aria-hidden="true">!</span>
                {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
              </Badge>
            )}
          </section>
        )}

        {notes.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-7 w-7" />}
            title={t("emptyState.noNotesSent")}
            description="Vous n'avez pas encore envoye de notes a vos clients. Rendez-vous sur la fiche d'un client pour envoyer une note."
          />
        ) : (
          <NotesList notes={notesJson} isClientView={false} />
        )}
      </div>
    </>
  );
}
