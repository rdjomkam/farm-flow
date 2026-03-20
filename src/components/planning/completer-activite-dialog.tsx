"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

const typeReleveLabels: Record<TypeReleve, string> = {
  [TypeReleve.BIOMETRIE]: "Biometrie",
  [TypeReleve.MORTALITE]: "Mortalite",
  [TypeReleve.ALIMENTATION]: "Alimentation",
  [TypeReleve.QUALITE_EAU]: "Qualite eau",
  [TypeReleve.COMPTAGE]: "Comptage",
  [TypeReleve.OBSERVATION]: "Observation",
  [TypeReleve.RENOUVELLEMENT]: "Renouvellement",
};

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
  const router = useRouter();
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

      call<{ releves: UnlinkedReleve[] }>(
        `/api/releves?${params.toString()}`,
        undefined,
        { silentLoading: true, silentError: true }
      ).then((result) => {
        setUnlinkedReleves(result.data?.releves ?? []);
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
      router.refresh();
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
          Completer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Completer l'activite</DialogTitle>
          <DialogDescription>
            {isReleveType
              ? "Cette activite necessite un releve pour etre completee."
              : "Decrivez ce qui a ete fait pour completer cette activite."}
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
                    <p className="text-sm font-medium">Creer un releve</p>
                    <p className="text-xs text-muted-foreground">
                      Saisir un nouveau releve de type {mappedReleveType ? typeReleveLabels[mappedReleveType] : ""}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            )}

            {/* Option B: Lier un releve existant */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Ou lier un releve existant</p>
              {unlinkedReleves.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun releve non lie disponible.</p>
              ) : (
                <Select value={selectedReleveId} onValueChange={setSelectedReleveId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un releve..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Choisir un releve...</SelectItem>
                    {unlinkedReleves.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {typeReleveLabels[r.typeReleve] ?? r.typeReleve} —{" "}
                        {new Date(r.date).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button
                onClick={handleComplete}
                disabled={selectedReleveId === "__none__"}
              >
                Completer
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Textarea
              label="Note de completion *"
              placeholder="Decrivez ce qui a ete fait (minimum 10 caracteres)..."
              value={noteCompletion}
              onChange={(e) => setNoteCompletion(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {noteCompletion.trim().length}/10 caracteres minimum
            </p>

            <DialogFooter>
              <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button
                onClick={handleComplete}
                disabled={noteCompletion.trim().length < 10}
              >
                Completer
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
