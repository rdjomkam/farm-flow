"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { useTranslations, useLocale } from "next-intl";
import { FileText, AlertTriangle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { NoteDetailDialog } from "@/components/notes/note-detail-dialog";
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
   * @default false
   */
  isClientView?: boolean;
  /** Callback de rechargement des donnees */
  onRefresh?: () => void;
}

/**
 * Formate une date en relatif (aujourd'hui, hier, ou JJ/MM/AAAA).
 * Accepts a translation function to produce locale-aware labels.
 */
function formatDate(date: Date | string, t: (key: string, values?: Record<string, string>) => string, locale: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const dayMs = 86_400_000;
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (diff < dayMs && d.getDate() === now.getDate()) {
    return t("list.todayAt", { time });
  }
  if (diff < 2 * dayMs && d.getDate() === now.getDate() - 1) {
    return t("list.yesterdayAt", { time });
  }
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Carte individuelle d'une note.
 */
function NoteCard({
  note,
  isClientView,
}: {
  note: NoteIngenieurWithRelations;
  isClientView: boolean;
}) {
  const t = useTranslations("notes");
  const locale = useLocale();
  const [localRead, setLocalRead] = useState(note.isRead);
  const isUnread = !localRead;

  return (
    <NoteDetailDialog note={note} isClientView={isClientView} onRead={() => setLocalRead(true)}>
    <Card
      className={`relative flex flex-col gap-0 transition-colors cursor-pointer hover:bg-accent/50 ${
        isUnread && !isClientView ? "border-primary/40 bg-primary/5" : ""
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {isClientView && (
              <Badge
                variant={note.isFromClient ? "default" : "en_cours"}
                className="shrink-0"
              >
                {note.isFromClient ? t("list.myObservation") : t("list.dkfarm")}
              </Badge>
            )}
            {note.isUrgent && (
              <Badge variant="annulee" className="flex items-center gap-1 shrink-0">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {t("list.urgent")}
              </Badge>
            )}
            {!isClientView && note.visibility === VisibiliteNote.INTERNE && (
              <Badge variant="default" className="flex items-center gap-1 shrink-0">
                <EyeOff className="h-3 w-3" aria-hidden="true" />
                {t("list.internal")}
              </Badge>
            )}
            {!isClientView && note.visibility === VisibiliteNote.PUBLIC && (
              <Badge variant="en_cours" className="flex items-center gap-1 shrink-0">
                <Eye className="h-3 w-3" aria-hidden="true" />
                {t("list.public")}
              </Badge>
            )}
            {isUnread && !isClientView && (
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label={t("list.unreadDot")} />
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDate(note.createdAt, t, locale)}
          </span>
        </div>
        <CardTitle className="text-base leading-snug mt-1">{note.titre}</CardTitle>
        {note.vague && (
          <p className="text-xs text-muted-foreground">
            {t("list.vagueLabel")} <span className="font-medium text-foreground">{note.vague.code}</span>
          </p>
        )}
        {(note._count?.replies ?? 0) > 0 && (
          <p className="text-xs text-muted-foreground">
            {note._count!.replies > 1 ? t("list.replyCountPlural", { count: note._count!.replies }) : t("list.replyCount", { count: note._count!.replies })}
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="prose-sm max-w-none">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="text-base font-bold leading-tight mt-3 mb-1.5 first:mt-0 text-foreground">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-sm font-semibold leading-tight mt-2.5 mb-1 text-foreground">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-semibold mt-2 mb-1 text-foreground">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-sm leading-relaxed mb-2 last:mb-0 text-muted-foreground">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-1 mb-2 text-sm text-muted-foreground pl-1">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-1 mb-2 text-sm text-muted-foreground pl-1">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="leading-relaxed">{children}</li>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="italic text-muted-foreground">{children}</em>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary pl-3 my-2 text-sm text-muted-foreground italic">
                  {children}
                </blockquote>
              ),
              code: ({ children }) => (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                  {children}
                </code>
              ),
              hr: () => <hr className="my-3 border-border" />,
            }}
          >
            {note.contenu}
          </ReactMarkdown>
        </div>
        {!isClientView && note.clientSite && (
          <p className="text-xs text-muted-foreground">
            {t("list.destinedTo")}{" "}
            <span className="font-medium text-foreground">{note.clientSite.name}</span>
          </p>
        )}
      </CardContent>
    </Card>
    </NoteDetailDialog>
  );
}

/**
 * Liste des notes ingenieur avec filtres par onglet (Toutes / Urgentes / Non lues).
 *
 * Mode ingenieur : toutes les notes (PUBLIC + INTERNE) avec action "marquer comme lue".
 * Mode client (isClientView) : notes PUBLIC uniquement, sans actions de gestion.
 */
export function NotesList({ notes, isClientView = false, onRefresh }: NotesListProps) {
  const t = useTranslations("notes");
  const urgentNotes = notes.filter((n) => n.isUrgent);
  const unreadNotes = notes.filter((n) => !n.isRead);
  const myObservations = notes.filter((n) => n.isFromClient);

  function renderGrid(items: NoteIngenieurWithRelations[]) {
    if (items.length === 0) {
      return (
        <EmptyState
          icon={<FileText className="h-7 w-7" />}
          title={t("emptyState.noNotes")}
          description={t("emptyState.noNotesFiltered")}
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
            {notes.length > 1 ? t("list.noteCountPlural", { count: notes.length }) : t("list.noteCount", { count: notes.length })}
          </span>
          {!isClientView && unreadNotes.length > 0 && (
            <Badge variant="en_cours">
              {unreadNotes.length > 1 ? t("list.unreadCountPlural", { count: unreadNotes.length }) : t("list.unreadCount", { count: unreadNotes.length })}
            </Badge>
          )}
          {urgentNotes.length > 0 && (
            <Badge variant="annulee" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {urgentNotes.length > 1 ? t("list.urgentCountPlural", { count: urgentNotes.length }) : t("list.urgentCount", { count: urgentNotes.length })}
            </Badge>
          )}
        </div>
        {onRefresh && (
          <Button size="sm" variant="ghost" onClick={onRefresh} aria-label={t("list.refreshButton")}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Onglets de filtrage */}
      <Tabs defaultValue="toutes">
        <TabsList>
          <TabsTrigger value="toutes">
            {t("list.allTab", { count: notes.length })}
          </TabsTrigger>
          <TabsTrigger value="urgentes">
            {t("list.urgentTab", { count: urgentNotes.length })}
          </TabsTrigger>
          {isClientView ? (
            <TabsTrigger value="mes_obs">
              {t("list.myObsTab", { count: myObservations.length })}
            </TabsTrigger>
          ) : (
            <TabsTrigger value="non_lues">
              {t("list.unreadTab", { count: unreadNotes.length })}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="toutes">
          {renderGrid(notes)}
        </TabsContent>
        <TabsContent value="urgentes">
          {renderGrid(urgentNotes)}
        </TabsContent>
        {isClientView ? (
          <TabsContent value="mes_obs">
            {renderGrid(myObservations)}
          </TabsContent>
        ) : (
          <TabsContent value="non_lues">
            {renderGrid(unreadNotes)}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
