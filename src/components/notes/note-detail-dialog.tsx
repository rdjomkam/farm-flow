"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  User,
  Calendar,
  Fish,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { VisibiliteNote } from "@/types";
import type { NoteIngenieurWithRelations } from "@/types";
import { ReplyItem } from "./reply-item";
import { ReplyForm } from "./reply-form";

interface NoteDetailDialogProps {
  note: NoteIngenieurWithRelations;
  isClientView?: boolean;
  onRead?: () => void;
  children: React.ReactNode;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const dayMs = 86_400_000;
  if (diff < dayMs && d.getDate() === now.getDate()) {
    return `Aujourd'hui à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diff < 2 * dayMs && d.getDate() === now.getDate() - 1) {
    return `Hier à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-base font-bold mt-4 mb-2 first:mt-0 text-foreground border-b border-border/50 pb-1">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-[0.9rem] font-semibold mt-3.5 mb-1.5 text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold mt-3 mb-1 text-foreground">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm leading-[1.7] mb-2.5 last:mb-0 text-foreground/80">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside space-y-1 mb-2 text-sm text-foreground/80 pl-1 ml-1">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside space-y-1 mb-2 text-sm text-foreground/80 pl-1 ml-1">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-muted-foreground">{children}</em>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-[3px] border-primary/60 pl-3.5 my-3 text-sm text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  ),
  hr: () => <hr className="my-4 border-border/60" />,
};

export function NoteDetailDialog({
  note,
  isClientView = false,
  onRead,
  children,
}: NoteDetailDialogProps) {
  const router = useRouter();
  const [markedRead, setMarkedRead] = useState(false);

  const handleOpenChange = useCallback(
    async (open: boolean) => {
      if (open && !note.isRead && !isClientView && !markedRead) {
        setMarkedRead(true);
        try {
          await fetch(`/api/ingenieur/notes/${note.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isRead: true }),
          });
          onRead?.();
          router.refresh();
        } catch {
          setMarkedRead(false);
        }
      }
    },
    [note.id, note.isRead, isClientView, markedRead, router]
  );

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="overflow-hidden flex flex-col max-h-[90vh]">
          {/* ── Header zone ── */}
          <div
            className={cn(
              "rounded-lg px-1 pb-1",
              note.isUrgent && "bg-danger/5"
            )}
          >
            {/* Badge row */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2 pr-8">
              {note.isUrgent && (
                <Badge variant="annulee" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Urgent
                </Badge>
              )}
              {!isClientView &&
                note.visibility === VisibiliteNote.INTERNE && (
                  <Badge
                    variant="default"
                    className="flex items-center gap-1"
                  >
                    <EyeOff className="h-3 w-3" aria-hidden="true" />
                    Interne
                  </Badge>
                )}
              {!isClientView &&
                note.visibility === VisibiliteNote.PUBLIC && (
                  <Badge
                    variant="en_cours"
                    className="flex items-center gap-1"
                  >
                    <Eye className="h-3 w-3" aria-hidden="true" />
                    Public
                  </Badge>
                )}
              {isClientView && (
                <Badge
                  variant={note.isFromClient ? "default" : "en_cours"}
                >
                  {note.isFromClient ? "Mon observation" : "DKFarm"}
                </Badge>
              )}
            </div>

            {/* Title */}
            <DialogTitle className="text-lg font-bold leading-snug pr-8">
              {note.titre}
            </DialogTitle>

            {/* Metadata row — icon+label pairs */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-xs text-muted-foreground">
              {!isClientView && note.ingenieur && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  {note.ingenieur.name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                {formatDate(note.createdAt)}
              </span>
              {note.vague && (
                <span className="inline-flex items-center gap-1.5">
                  <Fish className="h-3.5 w-3.5 shrink-0" />
                  {note.vague.code}
                </span>
              )}
              {!isClientView && note.clientSite && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  {note.clientSite.name}
                </span>
              )}
            </div>
          </div>

          {/* ── Separator ── */}
          <hr className="border-border my-3 -mx-4 md:-mx-6" />

          {/* ── Scrollable body ── */}
          <div className="overflow-y-auto flex-1 -mx-4 md:-mx-6 px-4 md:px-6">
            {/* ── Content area ── */}
            <div className="rounded-lg bg-muted/30 p-4 -mx-1">
              <div className="prose-sm max-w-none">
                <ReactMarkdown components={markdownComponents}>
                  {note.contenu}
                </ReactMarkdown>
              </div>
            </div>

            {/* ── Replies section ── */}
            {note.replies && note.replies.length > 0 && (
              <>
                <hr className="border-border my-4 -mx-4 md:-mx-6" />
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    Reponses ({note.replies.length})
                  </p>
                  {note.replies.map((reply) => (
                    <ReplyItem
                      key={reply.id}
                      reply={reply}
                      isClientView={isClientView}
                    />
                  ))}
                </div>
              </>
            )}

            {/* ── Reply form ── */}
            <hr className="border-border my-4 -mx-4 md:-mx-6" />
            <ReplyForm
              parentNote={note}
              isClientView={isClientView}
              onSuccess={() => router.refresh()}
            />
          </div>

        {/* Hidden description for accessibility */}
        <DialogDescription className="sr-only">
          Note : {note.titre}
        </DialogDescription>
      </DialogContent>
    </Dialog>
  );
}
