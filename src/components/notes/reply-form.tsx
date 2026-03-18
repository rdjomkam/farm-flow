"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [contenu, setContenu] = useState("");
  const [visibility, setVisibility] = useState<VisibiliteNote>(
    VisibiliteNote.PUBLIC
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contenu.trim()) return;

    setLoading(true);
    setError(null);

    try {
      if (isClientView) {
        const res = await fetch("/api/mes-observations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replyToId: parentNote.id,
            observationTexte: contenu.trim(),
            type: "autre",
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Erreur lors de l'envoi");
        }
      } else {
        const res = await fetch("/api/ingenieur/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            replyToId: parentNote.id,
            titre: `Re: ${parentNote.titre}`,
            contenu: contenu.trim(),
            visibility,
            clientSiteId: parentNote.clientSiteId,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Erreur lors de l'envoi");
        }
      }

      setContenu("");
      setVisibility(VisibiliteNote.PUBLIC);
      router.refresh();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Textarea
        label="Repondre"
        placeholder="Votre reponse..."
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        rows={3}
        className="min-h-[80px] resize-none"
        disabled={loading}
      />

      {!isClientView && (
        <Select
          value={visibility}
          onValueChange={(v) => setVisibility(v as VisibiliteNote)}
        >
          <SelectTrigger label="Visibilite" className="h-10 min-h-[40px]">
            <SelectValue placeholder="Visibilite" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={VisibiliteNote.PUBLIC}>Public (visible par le client)</SelectItem>
            <SelectItem value={VisibiliteNote.INTERNE}>Interne (DKFarm uniquement)</SelectItem>
          </SelectContent>
        </Select>
      )}

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      <Button
        type="submit"
        disabled={loading || !contenu.trim()}
        className="self-end"
        size="sm"
      >
        {loading ? "Envoi..." : "Repondre"}
      </Button>
    </form>
  );
}
