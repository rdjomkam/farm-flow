"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VisibiliteNote } from "@/types";
import type { NoteIngenieurWithRelations } from "@/types";
import { useNoteService } from "@/services";
import { useApi } from "@/hooks/use-api";

interface ReplyFormProps {
  parentNote: NoteIngenieurWithRelations;
  isClientView?: boolean;
  onSuccess?: () => void;
}

export function ReplyForm({
  parentNote,
  isClientView = false,
  onSuccess,
}: ReplyFormProps) {
  const queryClient = useQueryClient();
  const t = useTranslations("notes.replyForm");
  const noteService = useNoteService();
  const { call } = useApi();
  const [contenu, setContenu] = useState("");
  const [visibility, setVisibility] = useState<VisibiliteNote>(
    VisibiliteNote.PUBLIC
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contenu.trim()) return;

    let result;
    if (isClientView) {
      result = await call<Record<string, unknown>>(
        "/api/mes-observations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replyToId: parentNote.id,
            observationTexte: contenu.trim(),
            type: "autre",
          }),
        },
        { successMessage: t("successMessage") }
      );
    } else {
      result = await noteService.createNote({
        replyToId: parentNote.id,
        titre: `Re: ${parentNote.titre}`,
        contenu: contenu.trim(),
        visibility,
        isFromClient: false,
        clientSiteId: parentNote.clientSiteId,
      });
    }

    if (result.ok) {
      setContenu("");
      setVisibility(VisibiliteNote.PUBLIC);
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
      onSuccess?.();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Textarea
        label={t("repondreLabel")}
        placeholder={t("reponsePlaceholder")}
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        rows={3}
        className="min-h-[80px] resize-none"
      />

      {!isClientView && (
        <Select
          value={visibility}
          onValueChange={(v) => setVisibility(v as VisibiliteNote)}
        >
          <SelectTrigger label={t("visibiliteLabel")} className="h-10 min-h-[40px]">
            <SelectValue placeholder={t("visibiliteLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={VisibiliteNote.PUBLIC}>{t("visibilitePublic")}</SelectItem>
            <SelectItem value={VisibiliteNote.INTERNE}>{t("visibiliteInterne")}</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Button
        type="submit"
        disabled={!contenu.trim()}
        className="self-end"
        size="sm"
      >
        {t("repondreButton")}
      </Button>
    </form>
  );
}
