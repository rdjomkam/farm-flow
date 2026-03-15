"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FileText, AlertTriangle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { VisibiliteNote } from "@/types";
import type { NoteIngenieurWithRelations } from "@/types";

interface NotesListProps {
  /**
   * Notes a afficher.
   * En mode ingenieur, contient PUBLIC + INTERNE.
   * En mode client (isClientView=true), contient uniquement PUBLIC.
   */
  notes: NoteIngenieurWithRelations[];
  /**
   * Active le mode vue client :
   * - masque les badges INTERNE
   * - masque le bouton "Marquer comme lue"
   * @default false
   */
  isClientView?: boolean;
  /** Callback de rechargement des donnees */
  onRefresh?: () => void;
}

/**
 * Formate une date en francais relatif (aujourd'hui, hier, ou JJ/MM/AAAA).
 */
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const dayMs = 86_400_000;
  if (diff < dayMs && d.getDate() === now.getDate()) {
    return `Aujourd'hui a ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diff < 2 * dayMs && d.getDate() === now.getDate() - 1) {
    return `Hier a ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Carte individuelle d'une note.
 */
function NoteCard({
  note,
  isClientView,
  onMarkRead,
}: {
  note: NoteIngenieurWithRelations;
  isClientView: boolean;
  onMarkRead?: (id: string) => void;
}) {
  const isUnread = !note.isRead;

  return (
    <Card
      className={`relative flex flex-col gap-0 transition-colors ${
        isUnread && !isClientView ? "border-primary/40 bg-primary/5" : ""
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {note.isUrgent && (
              <Badge variant="annulee" className="flex items-center gap-1 shrink-0">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Urgent
              </Badge>
            )}
            {!isClientView && note.visibility === VisibiliteNote.INTERNE && (
              <Badge variant="default" className="flex items-center gap-1 shrink-0">
                <EyeOff className="h-3 w-3" aria-hidden="true" />
                Interne
              </Badge>
            )}
            {!isClientView && note.visibility === VisibiliteNote.PUBLIC && (
              <Badge variant="en_cours" className="flex items-center gap-1 shrink-0">
                <Eye className="h-3 w-3" aria-hidden="true" />
                Public
              </Badge>
            )}
            {isUnread && !isClientView && (
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label="Non lue" />
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDate(note.createdAt)}
          </span>
        </div>
        <CardTitle className="text-base leading-snug mt-1">{note.titre}</CardTitle>
        {note.vague && (
          <p className="text-xs text-muted-foreground">
            Vague : <span className="font-medium text-foreground">{note.vague.code}</span>
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
          {note.contenu}
        </p>
        {!isClientView && note.clientSite && (
          <p className="text-xs text-muted-foreground">
            Destine a :{" "}
            <span className="font-medium text-foreground">{note.clientSite.name}</span>
          </p>
        )}
        {!isClientView && !note.isRead && onMarkRead && (
          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onMarkRead(note.id)}
              className="text-xs"
            >
              Marquer comme lue
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Liste des notes ingenieur avec filtres par onglet (Toutes / Urgentes / Non lues).
 *
 * Mode ingenieur : toutes les notes (PUBLIC + INTERNE) avec action "marquer comme lue".
 * Mode client (isClientView) : notes PUBLIC uniquement, sans actions de gestion.
 */
export function NotesList({ notes, isClientView = false, onRefresh }: NotesListProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [markingId, setMarkingId] = useState<string | null>(null);

  const urgentNotes = notes.filter((n) => n.isUrgent);
  const unreadNotes = notes.filter((n) => !n.isRead);

  const handleMarkRead = useCallback(
    async (id: string) => {
      if (markingId) return;
      setMarkingId(id);
      try {
        const res = await fetch(`/api/ingenieur/notes/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRead: true }),
        });
        if (!res.ok) {
          toast({ title: "Erreur lors du marquage de la note.", variant: "error" });
          return;
        }
        toast({ title: "Note marquee comme lue.", variant: "success" });
        if (onRefresh) {
          onRefresh();
        } else {
          router.refresh();
        }
      } catch {
        toast({ title: "Erreur reseau.", variant: "error" });
      } finally {
        setMarkingId(null);
      }
    },
    [markingId, onRefresh, router, toast]
  );

  function renderGrid(items: NoteIngenieurWithRelations[]) {
    if (items.length === 0) {
      return (
        <EmptyState
          icon={<FileText className="h-7 w-7" />}
          title="Aucune note"
          description="Aucune note ne correspond a ce filtre."
        />
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {items.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            isClientView={isClientView}
            onMarkRead={isClientView ? undefined : handleMarkRead}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* En-tete avec compteurs et bouton refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">
            {notes.length} note{notes.length > 1 ? "s" : ""}
          </span>
          {!isClientView && unreadNotes.length > 0 && (
            <Badge variant="en_cours">
              {unreadNotes.length} non lue{unreadNotes.length > 1 ? "s" : ""}
            </Badge>
          )}
          {urgentNotes.length > 0 && (
            <Badge variant="annulee" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {urgentNotes.length} urgente{urgentNotes.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {onRefresh && (
          <Button size="sm" variant="ghost" onClick={onRefresh} aria-label="Rafraichir">
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Onglets de filtrage */}
      <Tabs defaultValue="toutes">
        <TabsList>
          <TabsTrigger value="toutes">
            Toutes ({notes.length})
          </TabsTrigger>
          <TabsTrigger value="urgentes">
            Urgentes ({urgentNotes.length})
          </TabsTrigger>
          {!isClientView && (
            <TabsTrigger value="non_lues">
              Non lues ({unreadNotes.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="toutes">
          {renderGrid(notes)}
        </TabsContent>
        <TabsContent value="urgentes">
          {renderGrid(urgentNotes)}
        </TabsContent>
        {!isClientView && (
          <TabsContent value="non_lues">
            {renderGrid(unreadNotes)}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
