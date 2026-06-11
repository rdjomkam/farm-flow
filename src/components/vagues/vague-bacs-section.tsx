"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { queryKeys } from "@/lib/query-keys";
import { useVagueService } from "@/services";
import type { AssignationBacForVague } from "@/types";

interface VagueBacsSectionProps {
  /** Vague id — utilise pour le retrait direct (mutation API) */
  vagueId: string;
  /** Assignations actives (dateFin = null), enrichies avec le nombre vivants calculé */
  bacsActifs: (AssignationBacForVague & { vivants: number | null })[];
  /** Assignations terminées (dateFin non null) */
  bacsRetires: AssignationBacForVague[];
  /** Active le bouton de retrait direct (permission VAGUES_MODIFIER + vague EN_COURS) */
  canDetachEmptyBacs?: boolean;
}

/**
 * VagueBacsSection — Client Component avec Radix Collapsible.
 *
 * Affiche les bacs actifs normalement, et les bacs retirés dans un panneau
 * rétractable avec une apparence atténuée (border-dashed, opacity-60).
 * ADR-043 — Phase 2 Feature 2.
 */
export function VagueBacsSection({ vagueId, bacsActifs, bacsRetires, canDetachEmptyBacs = false }: VagueBacsSectionProps) {
  const [open, setOpen] = useState(false);
  const [confirmBacId, setConfirmBacId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("vagues.bacsSection");
  const vagueService = useVagueService();
  const queryClient = useQueryClient();
  const router = useRouter();

  const confirmBac = bacsActifs.find((a) => a.bacId === confirmBacId) ?? null;
  const isLastActiveBac = bacsActifs.length <= 1;

  async function handleDetach(bacId: string) {
    setIsSubmitting(true);
    setError(null);
    const result = await vagueService.update(vagueId, { removeBacIds: [bacId] });
    setIsSubmitting(false);
    if (result.ok) {
      setConfirmBacId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.vagues.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.bacs.all });
      router.refresh();
    } else {
      setError(result.error ?? t("detach.errorGeneric"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Bacs actifs */}
      {bacsActifs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2 text-center">
          {t("aucunBacActif")}
        </p>
      ) : (
        bacsActifs.map((a) => {
          const isEmpty = a.vivants === 0;
          const showDetach = canDetachEmptyBacs && isEmpty && !isLastActiveBac;
          return (
            <div key={a.id} className="relative">
              <Link href={`/bacs/${a.bacId}`} className="block">
                <Card className="hover:bg-accent/30 transition-colors cursor-pointer border-border">
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.bac.nom}</p>
                      {a.bac.volume != null && (
                        <p className="text-sm text-muted-foreground">{a.bac.volume} L</p>
                      )}
                      {a.vivants != null && a.nombreInitial != null ? (
                        <p className="text-sm text-muted-foreground">
                          {t("poissonsActuels", { count: a.vivants, initial: a.nombreInitial })}
                        </p>
                      ) : a.vivants != null ? (
                        <p className="text-sm text-muted-foreground">
                          {t("poissons", { count: a.vivants })}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {showDetach && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label={t("detach.ariaLabel", { bac: a.bac.nom })}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmBacId(a.bacId);
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Badge variant="success">{t("actif")}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          );
        })
      )}

      {/* Bacs retirés — panneau Collapsible */}
      {bacsRetires.length > 0 && (
        <Collapsible.Root open={open} onOpenChange={setOpen}>
          <Collapsible.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full py-2"
            >
              {open ? (
                <ChevronDown className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" />
              )}
              <span>
                {bacsRetires.length > 1
                  ? t("bacsRetiresPlural", { count: bacsRetires.length })
                  : t("bacsRetires", { count: bacsRetires.length })}
              </span>
            </button>
          </Collapsible.Trigger>

          <Collapsible.Content className="flex flex-col gap-2 mt-1">
            {bacsRetires.map((a) => (
              <Link key={a.id} href={`/bacs/${a.bacId}`} className="block">
                <Card className="opacity-60 border-dashed border-border hover:opacity-80 transition-opacity cursor-pointer">
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.bac.nom}</p>
                      {a.bac.volume != null && (
                        <p className="text-sm text-muted-foreground">{a.bac.volume} L</p>
                      )}
                      {a.nombreInitial != null && (
                        <p className="text-xs text-muted-foreground">
                          {t("poissonsDepart", { count: a.nombreInitial })}
                        </p>
                      )}
                    </div>
                    <Badge variant="default">{t("retire")}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </Collapsible.Content>
        </Collapsible.Root>
      )}

      {/* Confirmation dialog — retrait direct bac vide */}
      <Dialog open={confirmBacId !== null} onOpenChange={(o) => { if (!o) { setConfirmBacId(null); setError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("detach.title")}</DialogTitle>
            <DialogDescription>
              {confirmBac ? t("detach.description", { bac: confirmBac.bac.nom }) : ""}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setConfirmBacId(null); setError(null); }}
              disabled={isSubmitting}
            >
              {t("detach.cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => confirmBac && handleDetach(confirmBac.bacId)}
              disabled={isSubmitting}
            >
              {isSubmitting ? t("detach.submitting") : t("detach.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
