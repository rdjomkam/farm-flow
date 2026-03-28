"use client";

import { useState } from "react";
import { Trash2, Plus, Container } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryKeys } from "@/lib/query-keys";
import { Permission } from "@/types";
import type { Bac } from "@/types";
import { useVagueService } from "@/services";
import { useBacsLibres } from "@/hooks/queries/use-bacs-queries";

interface GererBacsDialogProps {
  vagueId: string;
  currentBacs: Bac[];
  permissions: Permission[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GererBacsDialog({
  vagueId,
  currentBacs,
  permissions,
  open,
  onOpenChange,
}: GererBacsDialogProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const vagueService = useVagueService();
  const t = useTranslations("vagues");

  const [selectedBacId, setSelectedBacId] = useState<string>("");
  const [nombrePoissons, setNombrePoissons] = useState<string>("");
  const [addError, setAddError] = useState<string>("");
  const [removeError, setRemoveError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: bacsLibres = [], isLoading: loadingLibres } = useBacsLibres({
    enabled: open,
  });

  if (!permissions.includes(Permission.VAGUES_MODIFIER)) return null;

  const canRemove = currentBacs.length > 1;

  function resetAddForm() {
    setSelectedBacId("");
    setNombrePoissons("");
    setAddError("");
  }

  async function handleAddBac() {
    setAddError("");

    if (!selectedBacId) {
      setAddError(t("gererBacs.errors.bacRequired"));
      return;
    }

    const count = nombrePoissons ? Number(nombrePoissons) : 0;
    if (!Number.isInteger(count) || count < 0) {
      setAddError(t("gererBacs.errors.nombrePoissonsInvalid"));
      return;
    }

    setIsSubmitting(true);
    const result = await vagueService.update(vagueId, {
      addBacs: [{ bacId: selectedBacId, nombrePoissons: count }],
    });
    setIsSubmitting(false);

    if (result.ok) {
      resetAddForm();
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bacs.all });
      router.refresh();
    } else {
      setAddError(result.error ?? t("gererBacs.errors.addFailed"));
    }
  }

  async function handleRemoveBac(bacId: string) {
    if (!canRemove) return;

    setIsSubmitting(true);
    const result = await vagueService.update(vagueId, {
      removeBacIds: [bacId],
    });
    setIsSubmitting(false);

    if (result.ok) {
      setRemoveError("");
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bacs.all });
      router.refresh();
    } else {
      setRemoveError(result.error ?? t("gererBacs.removeFailed"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAddForm(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("gererBacs.title")}</DialogTitle>
          <DialogDescription>{t("gererBacs.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Current bacs */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("gererBacs.bacsActuels")}
            </h3>
            {currentBacs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("gererBacs.aucunBac")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {currentBacs.map((bac) => (
                  <li
                    key={bac.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Container className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{bac.nom}</p>
                        {bac.nombrePoissons != null && (
                          <p className="text-xs text-muted-foreground">
                            {t("gererBacs.poissonsDansBac", { count: bac.nombrePoissons })}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-destructive hover:text-destructive shrink-0"
                      disabled={!canRemove || isSubmitting}
                      title={
                        !canRemove
                          ? t("gererBacs.errors.dernierBac")
                          : t("gererBacs.retirer")
                      }
                      onClick={() => handleRemoveBac(bac.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">{t("gererBacs.retirer")}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {removeError && (
            <p className="text-sm text-destructive">{removeError}</p>
          )}

          {/* Add a bac */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t("gererBacs.ajouterBac")}
            </h3>

            <Select
              value={selectedBacId}
              onValueChange={(val) => { setSelectedBacId(val); setAddError(""); }}
              disabled={loadingLibres || bacsLibres.length === 0}
            >
              <SelectTrigger
                label={t("gererBacs.selectBac")}
                error={addError && !selectedBacId ? addError : undefined}
              >
                <SelectValue
                  placeholder={
                    loadingLibres
                      ? t("gererBacs.chargement")
                      : bacsLibres.length === 0
                        ? t("form.fields.aucunBacLibre")
                        : t("gererBacs.selectBacPlaceholder")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {bacsLibres.map((bac) => (
                  <SelectItem key={bac.id} value={bac.id}>
                    {bac.nom} ({bac.volume} m³)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              id="nombrePoissons"
              label={t("gererBacs.nombrePoissons")}
              type="number"
              min="0"
              step="1"
              value={nombrePoissons}
              onChange={(e) => { setNombrePoissons(e.target.value); setAddError(""); }}
              placeholder="0"
              error={addError && selectedBacId ? addError : undefined}
              disabled={!selectedBacId}
            />

            {addError && !selectedBacId && (
              <p className="text-sm text-destructive">{addError}</p>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddBac}
              disabled={isSubmitting || bacsLibres.length === 0 || loadingLibres}
              className="w-full"
            >
              <Plus className="h-4 w-4" />
              {t("gererBacs.ajouterButton")}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => { resetAddForm(); onOpenChange(false); }}
          >
            {t("form.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
