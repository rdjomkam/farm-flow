"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import Link from "next/link";
import { Check, ClipboardCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TypeActivite, TypeReleve } from "@/types";
import { useActiviteService } from "@/services";
import { useApi } from "@/hooks/use-api";
import { RELEVE_COMPATIBLE_TYPES, ACTIVITE_RELEVE_TYPE_MAP } from "@/types/api";
import type { ActiviteWithRelations } from "@/types";

interface CompleterActiviteDialogProps {
  activite: ActiviteWithRelations;
  onCompleted?: () => void;
}

interface UnlinkedReleve {
  id: string;
  typeReleve: TypeReleve;
  date: string;
}

export function CompleterActiviteDialog({ activite, onCompleted }: CompleterActiviteDialogProps) {
  const t = useTranslations("planning");
  const tReleves = useTranslations("releves");
  const queryClient = useQueryClient();
  const activiteService = useActiviteService();
  const { call } = useApi();
  const [open, setOpen] = useState(false);

  const isReleveType = RELEVE_COMPATIBLE_TYPES.includes(activite.typeActivite as TypeActivite);
  const mappedReleveType = ACTIVITE_RELEVE_TYPE_MAP[activite.typeActivite as TypeActivite];

  // For releve-compatible types: list of unlinked releves
  const [unlinkedReleves, setUnlinkedReleves] = useState<UnlinkedReleve[]>([]);
  const [selectedReleveId, setSelectedReleveId] = useState("__none__");

  // For non-releve types: note
  const [noteCompletion, setNoteCompletion] = useState("");

  useEffect(() => {
    if (open && isReleveType && mappedReleveType) {
      const params = new URLSearchParams();
      if (mappedReleveType) params.set("typeReleve", mappedReleveType);
      if (activite.vagueId) params.set("vagueId", activite.vagueId);
      params.set("nonLie", "true");

      call<{ data: UnlinkedReleve[]; total: number }>(
        `/api/releves?${params.toString()}`,
        undefined,
        { silentLoading: true, silentError: true }
      ).then((result) => {
        setUnlinkedReleves(result.data?.data ?? []);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function resetForm() {
    setSelectedReleveId("__none__");
    setNoteCompletion("");
    setUnlinkedReleves([]);
  }

  async function handleComplete() {
    if (isReleveType) {
      if (selectedReleveId === "__none__") return;
    } else {
      if (noteCompletion.trim().length < 10) return;
    }

    const body: Record<string, string> = {};
    if (isReleveType) {
      body.releveId = selectedReleveId;
    } else {
      body.noteCompletion = noteCompletion.trim();
    }

    const result = await activiteService.complete(activite.id, body);
    if (result.ok) {
      setOpen(false);
      onCompleted?.();
      queryClient.invalidateQueries({ queryKey: queryKeys.planning.activites() });
    }
  }

  // Build the "Creer un releve" link with pre-filled params
  const createReleveHref = isReleveType && mappedReleveType
    ? `/releves/nouveau?activiteId=${activite.id}${activite.vagueId ? `&vagueId=${activite.vagueId}` : ""}${mappedReleveType ? `&typeReleve=${mappedReleveType}` : ""}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Check className="h-3.5 w-3.5" />
          {t("completerActivite.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("completerActivite.title")}</DialogTitle>
          <DialogDescription>
            {isReleveType
              ? t("completerActivite.necessiteReleve")
              : t("completerActivite.descriptionPlaceholder")}
          </DialogDescription>
        </DialogHeader>

        {isReleveType ? (
          <div className="flex flex-col gap-4">
            {/* Option A: Creer un releve */}
            {createReleveHref && (
              <Link href={createReleveHref} onClick={() => setOpen(false)}>
                <div className="flex items-center gap-3 rounded-xl border border-border p-4 hover:bg-muted/50 transition-colors">
                  <ClipboardCheck className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t("completerActivite.creerReleve")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("completerActivite.saisirReleve", {
                        type: mappedReleveType ? tReleves(`types.${mappedReleveType}`) : "",
                      })}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            )}

            {/* Option B: Lier un releve existant */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t("completerActivite.ouLierReleve")}</p>
              {unlinkedReleves.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("completerActivite.aucunReleve")}</p>
              ) : (
                <Select value={selectedReleveId} onValueChange={setSelectedReleveId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("completerActivite.choisirReleve")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t("completerActivite.choisirReleve")}</SelectItem>
                    {unlinkedReleves.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {t("completerActivite.releveOption", {
                          type: tReleves(`types.${r.typeReleve}`) ?? r.typeReleve,
                          date: new Date(r.date).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }),
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>{t("completerActivite.annuler")}</Button>
              <Button
                onClick={handleComplete}
                disabled={selectedReleveId === "__none__"}
              >
                {t("completerActivite.completer")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Textarea
              label={t("completerActivite.noteCompletion")}
              placeholder={t("completerActivite.notePlaceholder")}
              value={noteCompletion}
              onChange={(e) => setNoteCompletion(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {t("completerActivite.noteMinimum", { count: noteCompletion.trim().length })}
            </p>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>{t("completerActivite.annuler")}</Button>
              <Button
                onClick={handleComplete}
                disabled={noteCompletion.trim().length < 10}
              >
                {t("completerActivite.completer")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
