"use client";

import ReactMarkdown from "react-markdown";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { VisibiliteNote } from "@/types";
import type { NoteIngenieurWithRelations } from "@/types";

interface ReplyItemProps {
  reply: NoteIngenieurWithRelations;
  isClientView?: boolean;
}

function formatDate(
  date: Date | string,
  t: (key: string, params?: Record<string, string>) => string
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const dayMs = 86_400_000;
  if (diff < dayMs && d.getDate() === now.getDate()) {
    return t("list.todayAt", { time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) });
  }
  if (diff < 2 * dayMs && d.getDate() === now.getDate() - 1) {
    return t("list.yesterdayAt", { time: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) });
  }
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const compactMarkdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm font-bold text-foreground">{children}</p>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm font-semibold text-foreground">{children}</p>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm font-semibold text-foreground">{children}</p>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm leading-relaxed text-foreground/80 mb-1 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside text-sm text-foreground/80 mb-1 pl-1">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside text-sm text-foreground/80 mb-1 pl-1">
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
    <blockquote className="border-l-2 border-primary/60 pl-2 my-1 text-sm text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  ),
  hr: () => <hr className="my-2 border-border/60" />,
};

export function ReplyItem({ reply, isClientView = false }: ReplyItemProps) {
  const t = useTranslations("notes");
  const isFromClient = reply.isFromClient;

  return (
    <div className="border-l-2 border-primary/40 pl-3 py-1">
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        {isClientView ? (
          <Badge variant={isFromClient ? "default" : "en_cours"} className="text-xs">
            {isFromClient ? t("detail.myObservation") : t("detail.dkfarm")}
          </Badge>
        ) : (
          <>
            <span className="text-xs font-medium text-foreground">
              {reply.ingenieur?.name ?? (isFromClient ? t("fallbackNames.client") : t("fallbackNames.ingenieur"))}
            </span>
            {reply.visibility === VisibiliteNote.INTERNE ? (
              <Badge variant="default" className="flex items-center gap-0.5 text-xs">
                <EyeOff className="h-2.5 w-2.5" aria-hidden="true" />
                Interne
              </Badge>
            ) : (
              <Badge variant="en_cours" className="flex items-center gap-0.5 text-xs">
                <Eye className="h-2.5 w-2.5" aria-hidden="true" />
                Public
              </Badge>
            )}
          </>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {formatDate(reply.createdAt, t)}
        </span>
      </div>

      {/* Content */}
      <div className="prose-sm max-w-none">
        <ReactMarkdown components={compactMarkdownComponents}>
          {reply.contenu}
        </ReactMarkdown>
      </div>
    </div>
  );
}
