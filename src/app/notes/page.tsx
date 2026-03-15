import { redirect } from "next/navigation";
import { MessageSquare, Bell } from "lucide-react";
import { Header } from "@/components/layout/header";
import { NotesList } from "@/components/notes/notes-list";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { getServerSession } from "@/lib/auth";
import { getNotesPourClient } from "@/lib/queries/notes";
import type { NoteIngenieurWithRelations } from "@/types";

/**
 * Page /notes — Vue client des notes recues.
 *
 * - Affiche uniquement les notes avec visibility=PUBLIC destinees au site actif du client.
 * - Badge notification pour les notes non lues (compteur).
 * - Badge "Urgent" pour les notes urgentes.
 * - Marque automatiquement les notes comme lues lors de la consultation (via getNotesPourClient).
 * - Mobile first (360px).
 * - Server Component : pas de "use client".
 */
export default async function NotesPage() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!session.activeSiteId) redirect("/sites");

  // Recupere les notes PUBLIC destinees au site actif du client.
  // getNotesPourClient marque les notes non lues comme lues (R4 : atomique).
  const notes = await getNotesPourClient(session.activeSiteId);

  // Compter les notes non lues AVANT le marquage automatique
  // (getNotesPourClient retourne l'etat avant mise a jour, isRead peut etre false)
  const unreadCount = notes.filter((n) => !n.isRead).length;
  const urgentCount = notes.filter((n) => n.isUrgent).length;

  // Serialisation JSON pour les Client Components (Next.js App Router)
  // Le cast est necessaire car getNotesPourClient n'inclut pas clientSite/site (non necessaire cote client)
  const notesJson = JSON.parse(JSON.stringify(notes)) as NoteIngenieurWithRelations[];

  return (
    <>
      <Header title="Mes notes">
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
        {/* Bandeau de resume */}
        {(unreadCount > 0 || urgentCount > 0) && (
          <section
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3"
            aria-label="Resume des notes"
          >
            {unreadCount > 0 && (
              <Badge variant="en_cours">
                {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""} note{unreadCount > 1 ? "s" : ""}
              </Badge>
            )}
            {urgentCount > 0 && (
              <Badge variant="annulee" className="flex items-center gap-1">
                <span aria-hidden="true">!</span>
                {urgentCount} note{urgentCount > 1 ? "s" : ""} urgente{urgentCount > 1 ? "s" : ""}
              </Badge>
            )}
          </section>
        )}

        {/* Liste des notes */}
        {notes.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-7 w-7" />}
            title="Aucune note recue"
            description="Votre ingenieur DKFarm n'a pas encore envoye de notes pour votre elevage."
          />
        ) : (
          <NotesList notes={notesJson} isClientView={true} />
        )}
      </div>
    </>
  );
}
