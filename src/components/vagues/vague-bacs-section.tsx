"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AssignationBacForVague } from "@/types";

interface VagueBacsSectionProps {
  /** Assignations actives (dateFin = null) */
  bacsActifs: AssignationBacForVague[];
  /** Assignations terminées (dateFin non null) */
  bacsRetires: AssignationBacForVague[];
}

/**
 * VagueBacsSection — Client Component avec Radix Collapsible.
 *
 * Affiche les bacs actifs normalement, et les bacs retirés dans un panneau
 * rétractable avec une apparence atténuée (border-dashed, opacity-60).
 * ADR-043 — Phase 2 Feature 2.
 */
export function VagueBacsSection({ bacsActifs, bacsRetires }: VagueBacsSectionProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("vagues.bacsSection");

  return (
    <div className="flex flex-col gap-3">
      {/* Bacs actifs */}
      {bacsActifs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2 text-center">
          Aucun bac actif pour cette vague.
        </p>
      ) : (
        bacsActifs.map((a) => (
          <Link key={a.id} href={`/bacs/${a.bacId}`} className="block">
            <Card className="hover:bg-accent/30 transition-colors cursor-pointer border-border">
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.bac.nom}</p>
                  {a.bac.volume != null && (
                    <p className="text-sm text-muted-foreground">{a.bac.volume} L</p>
                  )}
                  {a.nombrePoissons != null && (
                    <p className="text-sm text-muted-foreground">
                      {a.nombrePoissons} poissons
                    </p>
                  )}
                </div>
                <Badge variant="success">Actif</Badge>
              </CardContent>
            </Card>
          </Link>
        ))
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
                      {a.nombrePoissonsInitial != null && (
                        <p className="text-xs text-muted-foreground">
                          {t("poissonsDepart", { count: a.nombrePoissonsInitial })}
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
    </div>
  );
}
